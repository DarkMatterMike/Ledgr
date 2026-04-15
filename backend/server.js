/**
 * ledgr – backend/server.js
 * Multi-user edition with owner (master) profile
 */

"use strict";

const express   = require("express");
const cors      = require("cors");
const dotenv    = require("dotenv");
const { Pool }  = require("pg");
const cron      = require("node-cron");
const webpush   = require("web-push");
const crypto    = require("crypto");
const bcrypt    = require("bcrypt");
const jwt       = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const {
  PlaidApi,
  PlaidEnvironments,
  Configuration,
} = require("plaid");

dotenv.config();

/* ── Config ──────────────────────────────────────────────────────── */
const PORT          = process.env.PORT || 3001;
const FRONTEND_URL  = process.env.FRONTEND_URL || "http://localhost:5173";
const PLAID_ENV     = process.env.PLAID_ENV || "sandbox";
const PRODUCTS      = (process.env.PLAID_PRODUCTS || "transactions").split(",").map(p => p.trim());
const COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || "US").split(",").map(c => c.trim());
const JWT_SECRET    = process.env.JWT_SECRET;
const ENCRYPT_KEY   = process.env.ENCRYPT_KEY;
const OWNER_EMAIL   = process.env.OWNER_EMAIL;
const BCRYPT_ROUNDS = 12;

if (!JWT_SECRET)  console.warn("⚠  JWT_SECRET not set");
if (!ENCRYPT_KEY) console.warn("⚠  ENCRYPT_KEY not set");
if (!OWNER_EMAIL) console.warn("⚠  OWNER_EMAIL not set — first registered user will become owner");

/* ── Encryption ───────────────────────────────────────────────────── */
function encrypt(text) {
  if (!ENCRYPT_KEY || !text) return text;
  const key = Buffer.from(ENCRYPT_KEY, "hex");
  const iv  = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  if (!ENCRYPT_KEY || !text) return text;
  if (!text.includes(":")) return text;
  try {
    const [ivHex, encHex] = text.split(":");
    const key     = Buffer.from(ENCRYPT_KEY, "hex");
    const iv      = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
  } catch { return text; }
}

/* ── VAPID ────────────────────────────────────────────────────────── */
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || "BLvUSGg-ljPgLVTY-54gYJrJvPEEIIokB5C-QTCAnSYW9ghmpeYmKQeIfQMsHl_opqis_d5QeORvyjoS1pfXRnY";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "FApjnt7VlZhG7Bw1t_wYv9BksoW0wFwz97bqGq-vSew";
webpush.setVapidDetails("mailto:admin@ledgr.app", VAPID_PUBLIC, VAPID_PRIVATE);

/* ── PostgreSQL ───────────────────────────────────────────────────── */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway")
    ? { rejectUnauthorized: false }
    : false,
});

async function initDB() {
  /* Users */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email               TEXT UNIQUE NOT NULL,
      password            TEXT NOT NULL,
      role                TEXT NOT NULL DEFAULT 'subscriber',
      stripe_customer_id  TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'trialing',
      trial_ends_at       BIGINT,
      created_at          BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    );
  `);

  /* App data — keyed per user */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_data (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key     TEXT NOT NULL,
      value   TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );
  `);

  /* Plaid items — scoped per user */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plaid_items (
      item_id      TEXT PRIMARY KEY,
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      institution  TEXT,
      cursor       TEXT,
      created_at   BIGINT
    );
  `);

  /* Push subscriptions — scoped per user */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id           SERIAL PRIMARY KEY,
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint     TEXT NOT NULL,
      subscription TEXT NOT NULL,
      created_at   BIGINT,
      UNIQUE (user_id, endpoint)
    );
  `);

  console.log("  =>  Database ready");
}

/* ── User helpers ─────────────────────────────────────────────────── */
async function getUserById(id) {
  const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return res.rows[0] || null;
}

async function getUserByEmail(email) {
  const res = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
  return res.rows[0] || null;
}

async function createUser(email, password) {
  const hash      = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const countRes  = await pool.query("SELECT COUNT(*) FROM users");
  const isFirst   = parseInt(countRes.rows[0].count, 10) === 0;
  const isOwnerEmail = OWNER_EMAIL && email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim();
  const role      = (isOwnerEmail || isFirst) ? "owner" : "subscriber";
  const trialEnds = Date.now() + 3 * 24 * 60 * 60 * 1000;
  const res = await pool.query(
    `INSERT INTO users (email, password, role, subscription_status, trial_ends_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      email.toLowerCase().trim(),
      hash,
      role,
      role === "owner" ? "active" : "trialing",
      trialEnds,
    ]
  );
  return res.rows[0];
}

/* ── App data helpers ─────────────────────────────────────────────── */
async function getData(userId, key) {
  const res = await pool.query(
    "SELECT value FROM app_data WHERE user_id = $1 AND key = $2",
    [userId, key]
  );
  return res.rows[0] ? JSON.parse(res.rows[0].value) : null;
}

async function setData(userId, key, value) {
  await pool.query(
    `INSERT INTO app_data (user_id, key, value) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [userId, key, JSON.stringify(value)]
  );
}

/* ── Plaid item helpers ───────────────────────────────────────────── */
async function getItem(itemId) {
  const res = await pool.query("SELECT * FROM plaid_items WHERE item_id = $1", [itemId]);
  if (!res.rows[0]) return null;
  return { ...res.rows[0], access_token: decrypt(res.rows[0].access_token) };
}

async function getItemsForUser(userId) {
  const res = await pool.query("SELECT * FROM plaid_items WHERE user_id = $1", [userId]);
  return res.rows.map(r => ({ ...r, access_token: decrypt(r.access_token) }));
}

async function saveItem(userId, itemId, data) {
  await pool.query(
    `INSERT INTO plaid_items (item_id, user_id, access_token, institution, cursor, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (item_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       institution  = EXCLUDED.institution,
       cursor       = COALESCE(EXCLUDED.cursor, plaid_items.cursor),
       created_at   = EXCLUDED.created_at`,
    [itemId, userId, encrypt(data.access_token), data.institution, data.cursor || null, data.created_at || Date.now()]
  );
}

async function removeItem(itemId) {
  await pool.query("DELETE FROM plaid_items WHERE item_id = $1", [itemId]);
}

async function updateCursor(itemId, cursor) {
  await pool.query("UPDATE plaid_items SET cursor = $1 WHERE item_id = $2", [cursor, itemId]);
}

/* ── Push helpers ─────────────────────────────────────────────────── */
async function saveSubscription(userId, sub) {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, subscription, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint) DO UPDATE SET subscription = EXCLUDED.subscription`,
    [userId, sub.endpoint, JSON.stringify(sub), Date.now()]
  );
}

async function getSubscriptionsForUser(userId) {
  const res = await pool.query(
    "SELECT subscription FROM push_subscriptions WHERE user_id = $1", [userId]
  );
  return res.rows.map(r => JSON.parse(r.subscription));
}

async function removeSubscription(userId, endpoint) {
  await pool.query(
    "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
    [userId, endpoint]
  );
}

async function sendPushToUser(userId, payload) {
  const subs = await getSubscriptionsForUser(userId);
  if (!subs.length) return;
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(async err => {
        if (err.statusCode === 410) await removeSubscription(userId, sub.endpoint);
        throw err;
      })
    )
  );
}

/* ── Plaid client ─────────────────────────────────────────────────── */
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET":    process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

/* ── Sync ─────────────────────────────────────────────────────────── */
async function syncItemTransactions(userId, targetItemId = null) {
  const items = targetItemId
    ? [await getItem(targetItemId)].filter(Boolean)
    : await getItemsForUser(userId);
  if (!items.length) return { added: [], modified: [], removed: [] };

  const allAdded = [], allModified = [], allRemoved = [];
  for (const item of items) {
    let cursor = item.cursor || undefined, hasMore = true;
    while (hasMore) {
      try {
        const syncRes = await plaidClient.transactionsSync({
          access_token: item.access_token, cursor, count: 500,
        });
        const { added, modified, removed, next_cursor, has_more } = syncRes.data;
        const mapTxn = t => ({
          transaction_id: t.transaction_id, account_id: t.account_id,
          item_id: item.item_id, institution: item.institution,
          date: t.date, authorized_date: t.authorized_date,
          name: t.name, merchant_name: t.merchant_name || t.name,
          amount: -t.amount,
          category: t.personal_finance_category?.primary || (t.category?.[0] || null),
          pending: t.pending, currency: t.iso_currency_code, logo_url: t.logo_url || null,
        });
        allAdded.push(...added.map(mapTxn));
        allModified.push(...modified.map(mapTxn));
        allRemoved.push(...removed.map(t => ({ transaction_id: t.transaction_id })));
        cursor = next_cursor; hasMore = has_more;
        await updateCursor(item.item_id, cursor);
      } catch (err) {
        console.error(`sync error for item ${item.item_id}:`, err.response?.data || err.message);
        hasMore = false;
      }
    }
  }
  return { added: allAdded, modified: allModified, removed: allRemoved };
}

async function applySyncResultsToDB(userId, added, modified, removed) {
  const existing  = (await getData(userId, "transactions")) || [];
  const removeIds = new Set(removed.map(r => r.transaction_id));
  let next = existing.filter(t => !removeIds.has(t.id));

  const modMap = Object.fromEntries(modified.map(t => [t.transaction_id, t]));
  next = next.map(t => {
    if (!modMap[t.id]) return t;
    const m = modMap[t.id];
    return { ...t, date: m.date, pending: m.pending, amount: m.amount };
  });

  const existingIds = new Set(next.map(t => t.id));
  const newTxns = added
    .filter(t => !existingIds.has(t.transaction_id))
    .map(t => ({
      id: t.transaction_id, plaidAccountId: t.account_id,
      accountId: "a" + t.account_id, date: t.date || t.authorized_date,
      merchant: t.merchant_name || t.name, name: "", amount: t.amount,
      categoryId: null, pending: t.pending,
      type: t.amount < 0 ? "expense" : "income",
      recurring: false, recurringDay: null,
    }));
  next = [...newTxns, ...next];
  await setData(userId, "transactions", next);

  try {
    const items = await getItemsForUser(userId);
    const allAccounts = [];
    for (const item of items) {
      try {
        const r = await plaidClient.accountsGet({ access_token: item.access_token });
        allAccounts.push(...r.data.accounts.map(a => ({
          plaidId: a.account_id, institution: item.institution,
          type: a.type, subtype: a.subtype,
          balance: a.balances.current, available: a.balances.available,
        })));
      } catch (e) {
        console.error(`accountsGet failed for ${item.item_id}:`, e.message);
      }
    }
    if (allAccounts.length > 0) {
      const saved   = (await getData(userId, "accounts")) || [];
      const byPlaid = Object.fromEntries(saved.map(a => [a.plaidId, a]));
      const updated = allAccounts.map(pa => ({
        ...(byPlaid[pa.plaidId] || { id: "a" + pa.plaidId }),
        plaidId: pa.plaidId, balance: pa.balance,
        available: pa.available, institution: pa.institution,
        type: pa.subtype || pa.type,
      }));
      await setData(userId, "accounts", updated);
    }
  } catch (e) {
    console.error("Balance refresh failed:", e.message);
  }

  return { added: newTxns.length, modified: modified.length, removed: removed.length, newTxns };
}

/* ═══════════════════════════════════════════════════════════════════
   EXPRESS
═══════════════════════════════════════════════════════════════════ */
const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, message: { error: "Too many login attempts." } });
const syncLimiter = rateLimit({ windowMs: 60*60*1000, max: 20, message: { error: "Sync rate limit exceeded." } });
app.use(rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false }));

/* ── JWT auth middleware ──────────────────────────────────────────── */
async function requireAuth(req, res, next) {
  if (!JWT_SECRET) return next();
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const user    = await getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* ── Subscription check (owner always passes) ─────────────────────── */
function requireSubscription(req, res, next) {
  const { role, subscription_status, trial_ends_at } = req.user;
  if (role === "owner") return next();
  if (subscription_status === "active") return next();
  if (subscription_status === "trialing" && Date.now() < trial_ends_at) return next();
  return res.status(402).json({ error: "subscription_required" });
}

/* ── Owner-only ───────────────────────────────────────────────────── */
function requireOwner(req, res, next) {
  if (req.user?.role !== "owner") return res.status(403).json({ error: "Owner access required" });
  next();
}

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC ROUTES
═══════════════════════════════════════════════════════════════════ */

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, env: PLAID_ENV, auth: !!JWT_SECRET });
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)    return res.status(400).json({ error: "Email and password required" });
  if (password.length < 8)    return res.status(400).json({ error: "Password must be at least 8 characters" });
  if (!JWT_SECRET)             return res.status(500).json({ error: "Auth not configured" });
  try {
    if (await getUserByEmail(email)) return res.status(409).json({ error: "Email already registered" });
    const user  = await createUser(email, password);
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, subscription_status: user.subscription_status } });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (!JWT_SECRET)          return res.status(500).json({ error: "Auth not configured" });
  try {
    const user  = await getUserByEmail(email);
    const valid = user && await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect email or password" });
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, subscription_status: user.subscription_status } });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Login failed" });
  }
});

/* ── All routes below require auth ───────────────────────────────── */
app.use(requireAuth);

app.get("/api/auth/me", (req, res) => {
  const { id, email, role, subscription_status, trial_ends_at } = req.user;
  res.json({ id, email, role, subscription_status, trial_ends_at });
});

app.post("/api/auth/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
  try {
    const valid = await bcrypt.compare(currentPassword, req.user.password);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   APP DATA + PLAID (require subscription)
═══════════════════════════════════════════════════════════════════ */
app.use(["/api/data", "/api/plaid"], requireSubscription);

app.get("/api/data", async (req, res) => {
  try {
    const uid = req.user.id;
    const [transactions, categories, accounts, plaidItems, rules, calendarAccounts] = await Promise.all([
      getData(uid, "transactions"), getData(uid, "categories"),
      getData(uid, "accounts"),     getData(uid, "plaidItems"),
      getData(uid, "rules"),        getData(uid, "calendarAccounts"),
    ]);
    res.json({
      transactions:     transactions     || [],
      categories:       categories       || [],
      accounts:         accounts         || [],
      plaidItems:       plaidItems       || [],
      rules:            rules            || [],
      calendarAccounts: calendarAccounts || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/data", async (req, res) => {
  try {
    const uid = req.user.id;
    const { transactions, categories, accounts, plaidItems, rules, calendarAccounts } = req.body;
    const ops = [];
    if (transactions     !== undefined) ops.push(setData(uid, "transactions",     transactions));
    if (categories       !== undefined) ops.push(setData(uid, "categories",       categories));
    if (accounts         !== undefined) ops.push(setData(uid, "accounts",         accounts));
    if (plaidItems       !== undefined) ops.push(setData(uid, "plaidItems",       plaidItems));
    if (rules            !== undefined) ops.push(setData(uid, "rules",            rules));
    if (Array.isArray(calendarAccounts)) ops.push(setData(uid, "calendarAccounts", calendarAccounts));
    await Promise.all(ops);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/plaid/create_link_token", async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user.id },
      client_name: "Ledgr Finance",
      products: PRODUCTS, country_codes: COUNTRY_CODES, language: "en",
      redirect_uri: process.env.FRONTEND_URL,
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("create_link_token error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.post("/api/plaid/exchange_public_token", async (req, res) => {
  const { public_token, institution_name } = req.body;
  if (!public_token) return res.status(400).json({ error: "public_token required" });
  try {
    const { data } = await plaidClient.itemPublicTokenExchange({ public_token });
    await saveItem(req.user.id, data.item_id, { access_token: data.access_token, institution: institution_name || "Unknown Bank", created_at: Date.now() });
    res.json({ item_id: data.item_id, institution: institution_name });
  } catch (err) {
    console.error("exchange_public_token error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.get("/api/plaid/items", async (req, res) => {
  try {
    const items = (await getItemsForUser(req.user.id)).map(
      ({ item_id, institution, created_at }) => ({ item_id, institution, created_at })
    );
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/plaid/items/:itemId", async (req, res) => {
  try {
    const item = await getItem(req.params.itemId);
    if (item) {
      // Verify ownership
      if (item.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
      // Tell Plaid to remove it (best effort)
      try { await plaidClient.itemRemove({ access_token: item.access_token }); }
      catch (e) { console.warn("Plaid itemRemove failed:", e.message); }
      // Remove from DB
      await removeItem(req.params.itemId);
    } else {
      // Item not in DB — try to clean up by item_id anyway, return success
      console.warn("Delete requested for unknown item:", req.params.itemId);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/plaid/accounts", async (req, res) => {
  try {
    const items = await getItemsForUser(req.user.id);
    const allAccounts = [];
    for (const item of items) {
      try {
        const r = await plaidClient.accountsGet({ access_token: item.access_token });
        allAccounts.push(...r.data.accounts.map(a => ({
          account_id: a.account_id, item_id: item.item_id, institution: item.institution,
          name: a.name, official: a.official_name, type: a.type, subtype: a.subtype,
          balance: a.balances.current, available: a.balances.available,
          currency: a.balances.iso_currency_code,
        })));
      } catch (err) {
        console.error(`accountsGet error for ${item.item_id}:`, err.response?.data || err.message);
      }
    }
    res.json({ accounts: allAccounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/plaid/transactions/sync", syncLimiter, async (req, res) => {
  const { item_id: targetItemId } = req.body;
  if (targetItemId) {
    const item = await getItem(targetItemId);
    if (!item || item.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const result = await syncItemTransactions(req.user.id, targetItemId || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   PUSH
═══════════════════════════════════════════════════════════════════ */
app.post("/api/push/subscribe", async (req, res) => {
  try {
    if (!req.body?.endpoint) return res.status(400).json({ error: "Invalid subscription" });
    await saveSubscription(req.user.id, req.body);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/push/unsubscribe", async (req, res) => {
  try {
    if (req.body?.endpoint) await removeSubscription(req.user.id, req.body.endpoint);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/push/test", async (req, res) => {
  try {
    await sendPushToUser(req.user.id, { title: "ledgr. test", body: "Push notifications are working!", url: "/" });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════════════════════════════
   OWNER-ONLY: admin
═══════════════════════════════════════════════════════════════════ */
app.get("/api/admin/users", requireOwner, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, role, subscription_status, trial_ends_at, created_at FROM users ORDER BY created_at ASC"
    );
    res.json({ users: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/api/admin/users/:userId", requireOwner, async (req, res) => {
  const { subscription_status, role } = req.body;
  try {
    const fields = [], vals = [];
    if (subscription_status) { fields.push(`subscription_status = $${fields.length+1}`); vals.push(subscription_status); }
    if (role)                 { fields.push(`role = $${fields.length+1}`);                vals.push(role); }
    if (!fields.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(req.params.userId);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${vals.length}`, vals);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/admin/users/:userId", requireOwner, async (req, res) => {
  if (req.params.userId === req.user.id) return res.status(400).json({ error: "Cannot delete your own account" });
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.userId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/admin/encrypt-tokens", requireOwner, async (_req, res) => {
  if (!ENCRYPT_KEY) return res.status(500).json({ error: "ENCRYPT_KEY not set" });
  try {
    const { rows } = await pool.query("SELECT item_id, access_token FROM plaid_items");
    let migrated = 0, skipped = 0;
    for (const row of rows) {
      if (row.access_token.includes(":")) { skipped++; continue; }
      await pool.query("UPDATE plaid_items SET access_token = $1 WHERE item_id = $2",
        [encrypt(row.access_token), row.item_id]);
      migrated++;
    }
    res.json({ ok: true, migrated, skipped });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════════════════════════════════════════════════
   CRON: sync active users every 4 hours
═══════════════════════════════════════════════════════════════════ */
cron.schedule("0 */4 * * *", async () => {
  console.log(`[cron] ${new Date().toISOString()} — syncing all active users`);
  try {
    const { rows } = await pool.query(`
      SELECT id FROM users
      WHERE role = 'owner'
         OR subscription_status = 'active'
         OR (subscription_status = 'trialing' AND trial_ends_at > $1)
    `, [Date.now()]);

    for (const { id: userId } of rows) {
      try {
        const items = await getItemsForUser(userId);
        if (!items.length) continue;
        const { added, modified, removed } = await syncItemTransactions(userId);
        const result = await applySyncResultsToDB(userId, added, modified, removed);
        console.log(`[cron] ${userId}: +${result.added} added, ${result.modified} modified, ${result.removed} removed`);
        if (result.added > 0) {
          const examples = result.newTxns.slice(0, 2).map(t => t.merchant || t.name).join(", ");
          await sendPushToUser(userId, {
            title: `ledgr. — ${result.added} new transaction${result.added !== 1 ? "s" : ""}`,
            body:  examples || `${result.added} new transaction${result.added !== 1 ? "s" : ""} synced`,
            url:   "/",
          });
        }
      } catch (err) {
        console.error(`[cron] Failed for user ${userId}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[cron] Failed:", err.message);
  }
});

/* ── Start ────────────────────────────────────────────────────────── */
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  🏦  Ledgr backend (multi-user)`);
    console.log(`  =>  http://localhost:${PORT}/api/health`);
    console.log(`  =>  Plaid:      ${PLAID_ENV}`);
    console.log(`  =>  Auth:       ${JWT_SECRET ? "enabled" : "DISABLED"}`);
    console.log(`  =>  Encryption: ${ENCRYPT_KEY ? "enabled" : "DISABLED"}`);
    console.log(`  =>  Owner:      ${OWNER_EMAIL || "(first registered user)"}\n`);
  });
}).catch(err => {
  console.error("DB init failed:", err.message);
  process.exit(1);
});
