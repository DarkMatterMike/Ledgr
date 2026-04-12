/**
 * ledgr – backend/server.js
 */

"use strict";

const express   = require("express");
const cors      = require("cors");
const dotenv    = require("dotenv");
const { Pool }  = require("pg");
const cron      = require("node-cron");
const webpush   = require("web-push");
const crypto    = require("crypto");
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
const API_SECRET    = process.env.API_SECRET;
const ENCRYPT_KEY   = process.env.ENCRYPT_KEY; // 32-char hex string for AES-256

if (!API_SECRET) console.warn("⚠  API_SECRET not set — endpoints are unprotected");
if (!ENCRYPT_KEY) console.warn("⚠  ENCRYPT_KEY not set — Plaid tokens stored in plaintext");

/* ── Plaid token encryption ───────────────────────────────────────── */
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
  // If not encrypted (legacy plaintext), return as-is
  if (!text.includes(":")) return text;
  try {
    const [ivHex, encHex] = text.split(":");
    const key = Buffer.from(ENCRYPT_KEY, "hex");
    const iv  = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    // Fallback for legacy unencrypted tokens
    return text;
  }
}

/* ── VAPID setup ─────────────────────────────────────────────────── */
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_data (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plaid_items (
      item_id      TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      institution  TEXT,
      cursor       TEXT,
      created_at   BIGINT
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id           SERIAL PRIMARY KEY,
      endpoint     TEXT UNIQUE NOT NULL,
      subscription TEXT NOT NULL,
      created_at   BIGINT
    );
  `);
  console.log("  →  Database ready");
}

async function getData(key) {
  const res = await pool.query("SELECT value FROM app_data WHERE key = $1", [key]);
  return res.rows[0] ? JSON.parse(res.rows[0].value) : null;
}

async function setData(key, value) {
  await pool.query(
    `INSERT INTO app_data (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)]
  );
}

async function getItem(itemId) {
  const res = await pool.query("SELECT * FROM plaid_items WHERE item_id = $1", [itemId]);
  if (!res.rows[0]) return null;
  return { ...res.rows[0], access_token: decrypt(res.rows[0].access_token) };
}

async function getAllItems() {
  const res = await pool.query("SELECT * FROM plaid_items");
  return res.rows.map(r => ({ ...r, access_token: decrypt(r.access_token) }));
}

async function saveItem(itemId, data) {
  await pool.query(
    `INSERT INTO plaid_items (item_id, access_token, institution, cursor, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (item_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       institution  = EXCLUDED.institution,
       cursor       = COALESCE(EXCLUDED.cursor, plaid_items.cursor),
       created_at   = EXCLUDED.created_at`,
    [itemId, encrypt(data.access_token), data.institution, data.cursor || null, data.created_at || Date.now()]
  );
}

async function removeItem(itemId) {
  await pool.query("DELETE FROM plaid_items WHERE item_id = $1", [itemId]);
}

async function updateCursor(itemId, cursor) {
  await pool.query("UPDATE plaid_items SET cursor = $1 WHERE item_id = $2", [cursor, itemId]);
}

/* ── Push helpers ─────────────────────────────────────────────────── */
async function saveSubscription(sub) {
  await pool.query(
    `INSERT INTO push_subscriptions (endpoint, subscription, created_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET subscription = EXCLUDED.subscription`,
    [sub.endpoint, JSON.stringify(sub), Date.now()]
  );
}

async function getAllSubscriptions() {
  const res = await pool.query("SELECT subscription FROM push_subscriptions");
  return res.rows.map(r => JSON.parse(r.subscription));
}

async function removeSubscription(endpoint) {
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
}

async function sendPushToAll(payload) {
  const subs = await getAllSubscriptions();
  if (!subs.length) return;
  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(async err => {
        if (err.statusCode === 410) await removeSubscription(sub.endpoint);
        throw err;
      })
    )
  );
  const sent   = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  console.log(`[push] Sent: ${sent}, Failed: ${failed}`);
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

/* ── Sync functions ───────────────────────────────────────────────── */
async function syncItemTransactions(targetItemId = null) {
  const items = targetItemId
    ? [await getItem(targetItemId)].filter(Boolean)
    : await getAllItems();

  if (!items.length) return { added: [], modified: [], removed: [] };

  const allAdded = [], allModified = [], allRemoved = [];

  for (const item of items) {
    let cursor  = item.cursor || undefined;
    let hasMore = true;
    while (hasMore) {
      try {
        const syncRes = await plaidClient.transactionsSync({
          access_token: item.access_token, cursor, count: 500,
        });
        const { added, modified, removed, next_cursor, has_more } = syncRes.data;
        const mapTxn = t => ({
          transaction_id:  t.transaction_id,
          account_id:      t.account_id,
          item_id:         item.item_id,
          institution:     item.institution,
          date:            t.date,
          authorized_date: t.authorized_date,
          name:            t.name,
          merchant_name:   t.merchant_name || t.name,
          amount:          -t.amount,
          category:        t.personal_finance_category?.primary || (t.category?.[0] || null),
          pending:         t.pending,
          currency:        t.iso_currency_code,
          logo_url:        t.logo_url || null,
        });
        allAdded.push(...added.map(mapTxn));
        allModified.push(...modified.map(mapTxn));
        allRemoved.push(...removed.map(t => ({ transaction_id: t.transaction_id })));
        cursor  = next_cursor;
        hasMore = has_more;
        await updateCursor(item.item_id, cursor);
      } catch (err) {
        console.error(`sync error for item ${item.item_id}:`, err.response?.data || err.message);
        hasMore = false;
      }
    }
  }
  return { added: allAdded, modified: allModified, removed: allRemoved };
}

async function applySyncResultsToDB(added, modified, removed) {
  const existing = (await getData("transactions")) || [];
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
      id:             t.transaction_id,
      plaidAccountId: t.account_id,
      accountId:      "a" + t.account_id,
      date:           t.date || t.authorized_date,
      merchant:       t.merchant_name || t.name,
      name:           "",
      amount:         t.amount,
      categoryId:     null,
      pending:        t.pending,
      type:           t.amount < 0 ? "expense" : "income",
      recurring:      false,
      recurringDay:   null,
    }));
  next = [...newTxns, ...next];
  await setData("transactions", next);
  return { added: newTxns.length, modified: modified.length, removed: removed.length, newTxns };
}

/* ── Express ──────────────────────────────────────────────────────── */
const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));

/* ── Rate limiting ────────────────────────────────────────────────── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // max requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
}));

// Stricter limit on sync endpoints to avoid Plaid API abuse
const syncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: "Sync rate limit exceeded." },
});

/* ── API key authentication ───────────────────────────────────────── */
app.use((req, res, next) => {
  // Always allow health check
  if (req.path === "/api/health") return next();
  // If no API_SECRET set, warn but allow (dev mode)
  if (!API_SECRET) return next();
  const key = req.headers["x-api-key"];
  if (key !== API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/* ── Health ──────────────────────────────────────────────────────── */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, env: PLAID_ENV, products: PRODUCTS });
});

/* ═══════════════════════════════════════════════════════════════════
   APP DATA
═══════════════════════════════════════════════════════════════════ */

app.get("/api/data", async (_req, res) => {
  try {
    const [transactions, categories, accounts, plaidItems, rules, calendarAccounts] = await Promise.all([
      getData("transactions"),
      getData("categories"),
      getData("accounts"),
      getData("plaidItems"),
      getData("rules"),
      getData("calendarAccounts"),
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
    console.error("GET /api/data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/data", async (req, res) => {
  try {
    const { transactions, categories, accounts, plaidItems, rules, calendarAccounts } = req.body;
    const ops = [];
    if (transactions     !== undefined) ops.push(setData("transactions",     transactions));
    if (categories       !== undefined) ops.push(setData("categories",       categories));
    if (accounts         !== undefined) ops.push(setData("accounts",         accounts));
    if (plaidItems       !== undefined) ops.push(setData("plaidItems",       plaidItems));
    if (rules            !== undefined) ops.push(setData("rules",            rules));
    if (Array.isArray(calendarAccounts)) ops.push(setData("calendarAccounts", calendarAccounts));
    await Promise.all(ops);
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   PLAID
═══════════════════════════════════════════════════════════════════ */

app.post("/api/plaid/create_link_token", async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user:          { client_user_id: "ledgr-user" },
      client_name:   "Ledgr Finance",
      products:      PRODUCTS,
      country_codes: COUNTRY_CODES,
      language:      "en",
      redirect_uri:  process.env.FRONTEND_URL,
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
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeRes.data;
    await saveItem(item_id, {
      access_token,  // encrypted inside saveItem()
      institution: institution_name || "Unknown Bank",
      created_at:  Date.now(),
    });
    res.json({ item_id, institution: institution_name });
  } catch (err) {
    console.error("exchange_public_token error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.get("/api/plaid/items", async (_req, res) => {
  try {
    const items = (await getAllItems()).map(({ item_id, institution, created_at }) => ({
      item_id, institution, created_at,
    }));
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/plaid/items/:itemId", async (req, res) => {
  const { itemId } = req.params;
  try {
    const item = await getItem(itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });
    try {
      await plaidClient.itemRemove({ access_token: item.access_token });
    } catch (e) {
      console.warn("Plaid itemRemove failed (continuing):", e.message);
    }
    await removeItem(itemId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/plaid/accounts", async (_req, res) => {
  try {
    const items = await getAllItems();
    const allAccounts = [];
    for (const item of items) {
      try {
        const r = await plaidClient.accountsGet({ access_token: item.access_token });
        allAccounts.push(...r.data.accounts.map(a => ({
          account_id:  a.account_id,
          item_id:     item.item_id,
          institution: item.institution,
          name:        a.name,
          official:    a.official_name,
          type:        a.type,
          subtype:     a.subtype,
          balance:     a.balances.current,
          available:   a.balances.available,
          currency:    a.balances.iso_currency_code,
        })));
      } catch (err) {
        console.error(`accountsGet error for item ${item.item_id}:`, err.response?.data || err.message);
      }
    }
    res.json({ accounts: allAccounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/plaid/transactions/sync", syncLimiter, async (req, res) => {
  const { item_id: targetItemId } = req.body;
  try {
    const result = await syncItemTransactions(targetItemId || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   PUSH NOTIFICATIONS
═══════════════════════════════════════════════════════════════════ */

app.post("/api/push/subscribe", async (req, res) => {
  try {
    const sub = req.body;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: "Invalid subscription" });
    await saveSubscription(sub);
    console.log("[push] Subscription saved:", sub.endpoint.slice(0, 50) + "...");
    res.json({ ok: true });
  } catch (err) {
    console.error("push/subscribe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/push/unsubscribe", async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await removeSubscription(endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/push/test", async (req, res) => {
  try {
    await sendPushToAll({ title: "ledgr. test", body: "Push notifications are working!", url: "/" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── One-time migration: encrypt any plaintext Plaid tokens ───────── */
app.post("/api/admin/encrypt-tokens", async (req, res) => {
  if (!ENCRYPT_KEY) return res.status(500).json({ error: "ENCRYPT_KEY not set" });
  try {
    const { rows } = await pool.query("SELECT item_id, access_token FROM plaid_items");
    let migrated = 0, skipped = 0;
    for (const row of rows) {
      // Already encrypted if it contains ":"
      if (row.access_token.includes(":")) {
        skipped++;
        continue;
      }
      const encrypted = encrypt(row.access_token);
      await pool.query("UPDATE plaid_items SET access_token = $1 WHERE item_id = $2", [encrypted, row.item_id]);
      migrated++;
    }
    console.log(`[migrate] Encrypted ${migrated} tokens, skipped ${skipped} already encrypted`);
    res.json({ ok: true, migrated, skipped });
  } catch (err) {
    console.error("Migration error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Cron: sync every 4 hours ─────────────────────────────────────── */
cron.schedule("0 */4 * * *", async () => {
  console.log(`[cron] ${new Date().toISOString()} — starting sync`);
  try {
    const items = await getAllItems();
    if (!items.length) { console.log("[cron] No items"); return; }
    const { added, modified, removed } = await syncItemTransactions();
    const result = await applySyncResultsToDB(added, modified, removed);
    console.log(`[cron] +${result.added} added, ${result.modified} modified, ${result.removed} removed`);
    if (result.added > 0) {
      const count    = result.added;
      const examples = result.newTxns.slice(0, 2).map(t => t.merchant || t.name).join(", ");
      await sendPushToAll({
        title: `ledgr. — ${count} new transaction${count !== 1 ? "s" : ""}`,
        body:  examples ? `${examples}${count > 2 ? ` and ${count - 2} more` : ""}` : `${count} new transaction${count !== 1 ? "s" : ""} synced`,
        url:   "/",
      });
    }
  } catch (err) {
    console.error("[cron] Failed:", err.message);
  }
});

console.log("[cron] Registered — runs every 4 hours");

/* ── Start ────────────────────────────────────────────────────────── */
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  🏦  Ledgr backend`);
    console.log(`  →  http://localhost:${PORT}/api/health`);
    console.log(`  →  Plaid env:    ${PLAID_ENV}`);
    console.log(`  →  Auth:         ${API_SECRET ? "enabled" : "DISABLED"}`);
    console.log(`  →  Encryption:   ${ENCRYPT_KEY ? "enabled" : "DISABLED"}`);
    console.log(`  →  Auto-sync:    every 4 hours\n`);
  });
}).catch(err => {
  console.error("DB init failed:", err.message);
  process.exit(1);
});
