/**
 * ledgr – backend/server.js
 * Multi-user + Stripe billing
 */

"use strict";

const express   = require("express");
const cors      = require("cors");
const helmet    = require("helmet");
const dotenv    = require("dotenv");
const { Pool }  = require("pg");
const cron      = require("node-cron");
const webpush   = require("web-push");
const crypto    = require("crypto");
const bcrypt    = require("bcrypt");
const jwt       = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const Stripe    = require("stripe");
const { Resend } = require("resend");
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

// Stripe
const stripe                  = Stripe(process.env.STRIPE_SECRET_KEY || "");
const STRIPE_PRICE_ID         = process.env.STRIPE_PRICE_ID         || "";
const STRIPE_PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || "";
const STRIPE_WEBHOOK_SECRET   = process.env.STRIPE_WEBHOOK_SECRET   || "";

// Resend
const resend    = new Resend(process.env.RESEND_API_KEY || "");
const FROM_EMAIL = "noreply@ledgrfinance.app";

if (!JWT_SECRET)           console.warn("⚠  JWT_SECRET not set");
if (!ENCRYPT_KEY)          console.warn("⚠  ENCRYPT_KEY not set");
if (!OWNER_EMAIL)          console.warn("⚠  OWNER_EMAIL not set");
if (!process.env.STRIPE_SECRET_KEY) console.warn("⚠  STRIPE_SECRET_KEY not set");
if (!STRIPE_PRICE_ID)      console.warn("⚠  STRIPE_PRICE_ID not set");
if (!STRIPE_WEBHOOK_SECRET) console.warn("⚠  STRIPE_WEBHOOK_SECRET not set");
if (!process.env.RESEND_API_KEY) console.warn("⚠  RESEND_API_KEY not set");

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
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email                TEXT UNIQUE NOT NULL,
      password             TEXT NOT NULL,
      role                 TEXT NOT NULL DEFAULT 'subscriber',
      stripe_customer_id   TEXT,
      subscription_status  TEXT NOT NULL DEFAULT 'trialing',
      trial_ends_at        BIGINT,
      failed_login_attempts INT NOT NULL DEFAULT 0,
      locked_until         BIGINT,
      created_at           BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    );
  `);
  // Add lockout columns for existing deployments that predate this migration
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until BIGINT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at BIGINT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_price_id TEXT`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_data (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key     TEXT NOT NULL,
      value   TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );
  `);
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      expires_at BIGINT NOT NULL,
      used       BOOLEAN NOT NULL DEFAULT FALSE,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
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

async function getUserByStripeCustomerId(customerId) {
  const res = await pool.query("SELECT * FROM users WHERE stripe_customer_id = $1", [customerId]);
  return res.rows[0] || null;
}

async function createUser(email, password) {
  const hash         = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const countRes     = await pool.query("SELECT COUNT(*) FROM users");
  const isFirst      = parseInt(countRes.rows[0].count, 10) === 0;
  const isOwnerEmail = OWNER_EMAIL && email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim();
  const role         = (isOwnerEmail || isFirst) ? "owner" : "subscriber";
  const trialEnds    = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const res = await pool.query(
    `INSERT INTO users (email, password, role, subscription_status, trial_ends_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [email.toLowerCase().trim(), hash, role, role === "owner" ? "active" : "trialing", trialEnds]
  );
  return res.rows[0];
}

/* ── App data helpers ─────────────────────────────────────────────── */
async function getData(userId, key) {
  const res = await pool.query("SELECT value FROM app_data WHERE user_id = $1 AND key = $2", [userId, key]);
  return res.rows[0] ? JSON.parse(res.rows[0].value) : null;
}

async function setData(userId, key, value) {
  await pool.query(
    `INSERT INTO app_data (user_id, key, value) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [userId, key, JSON.stringify(value)]
  );
}

/* ── Plaid helpers ────────────────────────────────────────────────── */
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
       access_token = EXCLUDED.access_token, institution = EXCLUDED.institution,
       cursor = COALESCE(EXCLUDED.cursor, plaid_items.cursor), created_at = EXCLUDED.created_at`,
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
     VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, endpoint) DO UPDATE SET subscription = EXCLUDED.subscription`,
    [userId, sub.endpoint, JSON.stringify(sub), Date.now()]
  );
}

async function getSubscriptionsForUser(userId) {
  const res = await pool.query("SELECT subscription FROM push_subscriptions WHERE user_id = $1", [userId]);
  return res.rows.map(r => JSON.parse(r.subscription));
}

async function removeSubscription(userId, endpoint) {
  await pool.query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [userId, endpoint]);
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

/* ── Email helpers ────────────────────────────────────────────────── */
async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) { console.warn("[email] RESEND_API_KEY not set, skipping:", subject); return; }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    console.log(`[email] Sent "${subject}" to ${to}`);
  } catch(e) { console.error("[email] Failed:", e.message); }
}

function emailWelcome(email) {
  return sendEmail(email, "Welcome to ledgr.", `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d1117;color:#e6edf3;border-radius:12px">
      <div style="font-size:24px;font-weight:800;margin-bottom:4px">ledgr<span style="color:#00d4ff">.</span></div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:28px">personal finance</div>
      <h2 style="font-size:20px;font-weight:700;margin:0 0 12px">Welcome aboard 👋</h2>
      <p style="color:#8b949e;line-height:1.6;margin:0 0 20px">
        Your ledgr account is ready. You have a 7-day free trial to explore everything — connect your bank, track spending, and set budgets.
      </p>
      <a href="${FRONTEND_URL}" style="display:inline-block;padding:12px 24px;background:#00d4ff;color:#000;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px">
        Open ledgr →
      </a>
      <p style="color:#8b949e;font-size:12px;margin-top:28px">
        After your trial, ledgr is $4.99/month. You can subscribe anytime from Settings.
      </p>
    </div>
  `);
}

function emailTrialExpiring(email, daysLeft) {
  return sendEmail(email, `Your ledgr trial ends ${daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`}`, `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d1117;color:#e6edf3;border-radius:12px">
      <div style="font-size:24px;font-weight:800;margin-bottom:4px">ledgr<span style="color:#00d4ff">.</span></div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:28px">personal finance</div>
      <h2 style="font-size:20px;font-weight:700;margin:0 0 12px">⏰ Your trial ends ${daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`}</h2>
      <p style="color:#8b949e;line-height:1.6;margin:0 0 20px">
        Don't lose access to your financial data. Subscribe now to keep tracking your spending, budgets, and bank connections.
      </p>
      <a href="${FRONTEND_URL}" style="display:inline-block;padding:12px 24px;background:#00d4ff;color:#000;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px">
        Subscribe — $4.99/mo →
      </a>
      <p style="color:#8b949e;font-size:12px;margin-top:28px">
        Cancel anytime. No hidden fees.
      </p>
    </div>
  `);
}

function emailSubscriptionConfirmed(email) {
  return sendEmail(email, "You're now a ledgr Pro subscriber 🎉", `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d1117;color:#e6edf3;border-radius:12px">
      <div style="font-size:24px;font-weight:800;margin-bottom:4px">ledgr<span style="color:#00d4ff">.</span></div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:28px">personal finance</div>
      <h2 style="font-size:20px;font-weight:700;margin:0 0 12px">Subscription confirmed 🎉</h2>
      <p style="color:#8b949e;line-height:1.6;margin:0 0 20px">
        Thanks for subscribing to ledgr Pro at $4.99/month. You now have full access to all features including bank connections and automatic sync.
      </p>
      <a href="${FRONTEND_URL}" style="display:inline-block;padding:12px 24px;background:#00d4ff;color:#000;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px">
        Open ledgr →
      </a>
      <p style="color:#8b949e;font-size:12px;margin-top:28px">
        Manage your subscription anytime from Settings → Subscription.
      </p>
    </div>
  `);
}

function emailPasswordReset(email, resetUrl) {
  return sendEmail(email, "Reset your ledgr password", `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d1117;color:#e6edf3;border-radius:12px">
      <div style="font-size:24px;font-weight:800;margin-bottom:4px">ledgr<span style="color:#00d4ff">.</span></div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:28px">personal finance</div>
      <h2 style="font-size:20px;font-weight:700;margin:0 0 12px">Reset your password</h2>
      <p style="color:#8b949e;line-height:1.6;margin:0 0 20px">
        Click the button below to reset your password. This link expires in 1 hour.
      </p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#00d4ff;color:#000;font-weight:700;border-radius:8px;text-decoration:none;font-size:14px">
        Reset Password →
      </a>
      <p style="color:#8b949e;font-size:12px;margin-top:28px">
        If you didn't request this, you can safely ignore this email. Your password won't change.
      </p>
    </div>
  `);
}

/* ── Plaid client ─────────────────────────────────────────────────── */
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: { headers: { "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID, "PLAID-SECRET": process.env.PLAID_SECRET } },
});
const plaidClient = new PlaidApi(plaidConfig);

/* ── Sync ─────────────────────────────────────────────────────────── */
async function syncItemTransactions(userId, targetItemId = null) {
  const items = targetItemId ? [await getItem(targetItemId)].filter(Boolean) : await getItemsForUser(userId);
  if (!items.length) return { added: [], modified: [], removed: [] };
  const allAdded = [], allModified = [], allRemoved = [];
  for (const item of items) {
    let cursor = item.cursor || undefined, hasMore = true;
    while (hasMore) {
      try {
        const syncRes = await plaidClient.transactionsSync({ access_token: item.access_token, cursor, count: 500 });
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
  next = next.map(t => { if (!modMap[t.id]) return t; const m = modMap[t.id]; return { ...t, date: m.date, pending: m.pending, amount: m.amount }; });
  const existingIds = new Set(next.map(t => t.id));
  const fingerprints = new Set(next.map(t => `${t.date}__${t.amount}__${(t.merchant||t.name||"").toLowerCase().trim()}`));
  const newTxns = added
    .filter(t => !existingIds.has(t.transaction_id))
    .map(t => ({
      id: t.transaction_id, plaidAccountId: t.account_id, plaidItemId: t.item_id,
      accountId: "a" + t.account_id, date: t.date || t.authorized_date,
      merchant: t.merchant_name || t.name, name: "", amount: t.amount,
      categoryId: null, pending: t.pending,
      type: t.amount < 0 ? "expense" : "income", recurring: false, recurringDay: null,
    }))
    .filter(t => {
      const fp = `${t.date}__${t.amount}__${(t.merchant||t.name||"").toLowerCase().trim()}`;
      if (fingerprints.has(fp)) return false;
      fingerprints.add(fp);
      return true;
    });
  next = [...newTxns, ...next];
  await setData(userId, "transactions", next);
  try {
    const items = await getItemsForUser(userId);
    const allAccounts = [];
    for (const item of items) {
      try {
        const r = await plaidClient.accountsGet({ access_token: item.access_token });
        allAccounts.push(...r.data.accounts.map(a => ({ plaidId: a.account_id, plaidItemId: item.item_id, institution: item.institution, name: a.name, type: a.type, subtype: a.subtype, balance: a.balances.current, available: a.balances.available })));
      } catch (e) { console.error(`accountsGet failed for ${item.item_id}:`, e.message); }
    }
    if (allAccounts.length > 0) {
      const saved = (await getData(userId, "accounts")) || [];
      const manual = saved.filter(a => !a.plaidId);
      const byPlaid = Object.fromEntries(saved.filter(a => a.plaidId).map(a => [a.plaidId, a]));
      // Deduplicate by plaidId — same account from multiple connections gets collapsed
      const seen = new Set();
      const unique = allAccounts.filter(pa => {
        if (seen.has(pa.plaidId)) return false;
        seen.add(pa.plaidId);
        return true;
      });
      const plaidUpdated = unique.map(pa => ({
          ...(byPlaid[pa.plaidId] || { id: "a" + pa.plaidId }),
          plaidId: pa.plaidId, plaidItemId: pa.plaidItemId,
          balance: pa.balance, available: pa.available,
          institution: pa.institution, type: pa.subtype || pa.type,
        }));
      await setData(userId, "accounts", [...manual, ...plaidUpdated]);
    }
  } catch (e) { console.error("Balance refresh failed:", e.message); }
  return { added: newTxns.length, modified: modified.length, removed: removed.length, newTxns };
}

/* ═══════════════════════════════════════════════════════════════════
   EXPRESS
═══════════════════════════════════════════════════════════════════ */
const app = express();

const IS_PROD = process.env.NODE_ENV === "production";

// Generic error response — never leak internal details in production
function serverError(res, err, fallback = "Internal server error") {
  console.error(err?.message || err);
  return res.status(500).json({ error: IS_PROD ? fallback : (err?.message || fallback) });
}

// Stripe webhook needs raw body — must be registered BEFORE express.json()
app.post("/api/billing/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).json({ error: "Webhook signature failed" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const userId  = session.metadata?.userId;
          if (userId) {
            // Fetch the subscription to get the price ID
            let priceId = null;
            try {
              if (session.subscription) {
                const sub = await stripe.subscriptions.retrieve(session.subscription);
                priceId = sub.items?.data[0]?.price?.id || null;
              }
            } catch (e) { console.warn("[stripe] could not fetch subscription price:", e.message); }
            await pool.query(
              "UPDATE users SET stripe_customer_id = $1, subscription_status = 'active', stripe_price_id = $2 WHERE id = $3",
              [session.customer, priceId, userId]
            );
            const user = await getUserById(userId);
            if (user) emailSubscriptionConfirmed(user.email).catch(() => {});
            console.log(`[stripe] checkout complete for user ${userId}, price: ${priceId}`);
          }
          break;
        }
        case "customer.subscription.updated": {
          const sub  = event.data.object;
          const user = await getUserByStripeCustomerId(sub.customer);
          if (user) {
            const status  = sub.status === "active"   ? "active"
              : sub.status === "trialing" ? "trialing"
              : sub.status === "past_due"  ? "past_due"
              : "canceled";
            const priceId = sub.items?.data[0]?.price?.id || user.stripe_price_id;
            await pool.query(
              "UPDATE users SET subscription_status = $1, stripe_price_id = $2 WHERE id = $3",
              [status, priceId, user.id]
            );
            console.log(`[stripe] subscription updated for user ${user.id}: ${status}, price: ${priceId}`);
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub  = event.data.object;
          const user = await getUserByStripeCustomerId(sub.customer);
          if (user) {
            await pool.query("UPDATE users SET subscription_status = 'canceled' WHERE id = $1", [user.id]);
            console.log(`[stripe] subscription canceled for user ${user.id}`);
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const user    = await getUserByStripeCustomerId(invoice.customer);
          if (user) {
            await pool.query("UPDATE users SET subscription_status = 'past_due' WHERE id = $1", [user.id]);
            console.log(`[stripe] payment failed for user ${user.id}`);
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error("Webhook handler error:", err.message);
    }

    res.json({ received: true });
  }
);

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(helmet({
  crossOriginEmbedderPolicy: false, // needed for Plaid Link iframe
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.plaid.com"],
      frameSrc: ["cdn.plaid.com"],
      connectSrc: ["'self'", "https://production.plaid.com", "https://sandbox.plaid.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(express.json({ limit: "512kb" }));

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

/* ── Subscription status helper ───────────────────────────────────── */
function getAccessLevel(user) {
  if (user.role === "owner") return "full";
  if (user.role === "free")  return "full"; // complimentary full access, not billed
  if (user.subscription_status === "active") return "full";
  if (user.subscription_status === "trialing" && Date.now() < user.trial_ends_at) return "full";
  return "free"; // read-only, no Plaid
}

/* ── Subscription check for write/Plaid routes ────────────────────── */
function requireSubscription(req, res, next) {
  if (getAccessLevel(req.user) === "full") return next();
  return res.status(402).json({ error: "subscription_required" });
}

/* ── Premium (higher tier) check for investment sync ─────────────── */
function requirePremium(req, res, next) {
  const u = req.user;
  if (u.role === "owner") return next();
  if (u.stripe_price_id && u.stripe_price_id === STRIPE_PREMIUM_PRICE_ID) return next();
  return res.status(402).json({ error: "premium_required" });
}

/* ── Owner-only ───────────────────────────────────────────────────── */
function requireOwner(req, res, next) {
  if (req.user?.role !== "owner") return res.status(403).json({ error: "Owner access required" });
  next();
}

/* ═══════════════════════════════════════════════════════════════════
   PUBLIC ROUTES
═══════════════════════════════════════════════════════════════════ */

app.get("/api/health", (_req, res) => res.json({ ok: true, env: PLAID_ENV, auth: !!JWT_SECRET }));

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)  return res.status(400).json({ error: "Email and password required" });
  if (password.length < 8)  return res.status(400).json({ error: "Password must be at least 8 characters" });
  if (!JWT_SECRET)           return res.status(500).json({ error: "Auth not configured" });
  try {
    if (await getUserByEmail(email)) return res.status(409).json({ error: "Email already registered" });
    const user  = await createUser(email, password);
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    // Send welcome email (non-blocking)
    if (user.role !== "owner") emailWelcome(user.email).catch(() => {});
    res.json({ token, user: { id: user.id, email: user.email, name: user.name || null, role: user.role, subscription_status: user.subscription_status, trial_ends_at: user.trial_ends_at } });
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
    const user = await getUserByEmail(email);

    // Check account lockout
    if (user?.locked_until && Date.now() < user.locked_until) {
      const minutesLeft = Math.ceil((user.locked_until - Date.now()) / 60000);
      return res.status(429).json({ error: `Account locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.` });
    }

    const valid = user && await bcrypt.compare(password, user.password);

    if (!valid) {
      // Increment failed attempts and lock after 10 failures
      if (user) {
        const attempts = (user.failed_login_attempts || 0) + 1;
        const lockedUntil = attempts >= 10 ? Date.now() + 30 * 60 * 1000 : null; // 30 min lockout
        await pool.query(
          "UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3",
          [attempts, lockedUntil, user.id]
        );
      }
      return res.status(401).json({ error: "Incorrect email or password" });
    }

    // Successful login — reset failed attempts and record last login
    await pool.query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = $1 WHERE id = $2",
      [Date.now(), user.id]
    );

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name || null, role: user.role, subscription_status: user.subscription_status, trial_ends_at: user.trial_ends_at } });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: IS_PROD ? "Login failed" : err.message });
  }
});

/* ── Forgot / reset password (public) ────────────────────────────── */
app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  // Always return success to prevent email enumeration
  res.json({ ok: true });
  try {
    const user = await getUserByEmail(email);
    if (!user) return; // silently ignore unknown emails
    // Create reset token
    const token   = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour
    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, token, expires]
    );
    const resetUrl = `${FRONTEND_URL}?reset=${token}`;
    await emailPasswordReset(user.email, resetUrl);
  } catch(e) { console.error("[forgot-password]", e.message); }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: "Token and new password required" });
  if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM password_resets WHERE token = $1 AND used = FALSE AND expires_at > $2`,
      [token, Date.now()]
    );
    if (!rows[0]) return res.status(400).json({ error: "Invalid or expired reset link" });
    const reset = rows[0];
    const hash  = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hash, reset.user_id]);
    await pool.query("UPDATE password_resets SET used = TRUE WHERE id = $1", [reset.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── All routes below require auth ───────────────────────────────── */
app.use(requireAuth);

app.get("/api/auth/me", (req, res) => {
  const { id, email, name, role, subscription_status, trial_ends_at, stripe_price_id } = req.user;
  const access    = getAccessLevel(req.user);
  const isPremium = role === "owner" || (stripe_price_id && stripe_price_id === STRIPE_PREMIUM_PRICE_ID);
  res.json({ id, email, name, role, subscription_status, trial_ends_at, stripe_price_id, access, isPremium });
});

app.patch("/api/auth/profile", async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name required" });
  try {
    await pool.query("UPDATE users SET name = $1 WHERE id = $2", [name.trim(), req.user.id]);
    res.json({ ok: true, name: name.trim() });
  } catch (err) { serverError(res, err, "Failed to update profile"); }
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
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   BILLING
═══════════════════════════════════════════════════════════════════ */

/* Create Stripe checkout session */
app.post("/api/billing/create-checkout", async (req, res) => {
  if (!STRIPE_PRICE_ID) return res.status(500).json({ error: "Stripe not configured" });
  try {
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      await pool.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customerId, req.user.id]);
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${FRONTEND_URL}?subscribed=true`,
      cancel_url:  `${FRONTEND_URL}?canceled=true`,
      metadata: { userId: req.user.id },
      subscription_data: {
        metadata: { userId: req.user.id },
      },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Create checkout error:", err.message);
    serverError(res, err, "Checkout failed");
  }
});

/* Create Stripe customer portal session (manage/cancel) */
app.post("/api/billing/portal", async (req, res) => {
  try {
    const customerId = req.user.stripe_customer_id;
    if (!customerId) return res.status(400).json({ error: "No billing account found" });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: FRONTEND_URL,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Portal error:", err.message);
    serverError(res, err, "Portal failed");
  }
});

/* Get billing status */
app.get("/api/billing/status", (req, res) => {
  const { role, subscription_status, trial_ends_at, stripe_customer_id } = req.user;
  const access = getAccessLevel(req.user);
  const daysLeft = trial_ends_at ? Math.max(0, Math.ceil((trial_ends_at - Date.now()) / (1000*60*60*24))) : 0;
  res.json({ role, subscription_status, trial_ends_at, access, daysLeft, hasStripe: !!stripe_customer_id });
});

/* ═══════════════════════════════════════════════════════════════════
   APP DATA — read allowed for all authed users, write requires sub
═══════════════════════════════════════════════════════════════════ */

app.get("/api/data", async (req, res) => {
  try {
    const uid = req.user.id;
    const [transactions, categories, accounts, plaidItems, rules, calendarAccounts,
           investmentAccounts, holdings, netWorthSnapshots, aiMessages, aiCatExamples,
           userProfile, insightsTodos] = await Promise.all([
      getData(uid, "transactions"), getData(uid, "categories"),
      getData(uid, "accounts"),     getData(uid, "plaidItems"),
      getData(uid, "rules"),        getData(uid, "calendarAccounts"),
      getData(uid, "investmentAccounts"), getData(uid, "holdings"),
      getData(uid, "netWorthSnapshots"),  getData(uid, "aiMessages"),
      getData(uid, "aiCatExamples"),      getData(uid, "userProfile"),
      getData(uid, "insightsTodos"),
    ]);
    res.json({
      transactions:       transactions       || [],
      categories:         categories         || [],
      accounts:           accounts           || [],
      plaidItems:         plaidItems         || [],
      rules:              rules              || [],
      calendarAccounts:   calendarAccounts   || null,
      investmentAccounts: investmentAccounts || [],
      holdings:           holdings           || [],
      netWorthSnapshots:  netWorthSnapshots  || [],
      aiMessages:         aiMessages         || [],
      aiCatExamples:      aiCatExamples      || [],
      userProfile:        userProfile        || null,
      insightsTodos:      insightsTodos      || [],
      access:             getAccessLevel(req.user),
    });
  } catch (err) { serverError(res, err); }
});

// Writes require subscription
app.patch("/api/data", requireSubscription, async (req, res) => {
  try {
    const uid = req.user.id;
    const { transactions, categories, accounts, plaidItems, rules, calendarAccounts,
            investmentAccounts, holdings, netWorthSnapshots, aiMessages, aiCatExamples,
            userProfile, insightsTodos } = req.body;
    const ops = [];
    if (transactions       !== undefined) ops.push(setData(uid, "transactions",       transactions));
    if (categories         !== undefined) ops.push(setData(uid, "categories",         categories));
    if (accounts           !== undefined) ops.push(setData(uid, "accounts",           accounts));
    if (plaidItems         !== undefined) ops.push(setData(uid, "plaidItems",         plaidItems));
    if (rules              !== undefined) ops.push(setData(uid, "rules",              rules));
    if (Array.isArray(calendarAccounts))   ops.push(setData(uid, "calendarAccounts",   calendarAccounts));
    if (Array.isArray(investmentAccounts)) ops.push(setData(uid, "investmentAccounts", investmentAccounts));
    if (Array.isArray(holdings))           ops.push(setData(uid, "holdings",           holdings));
    if (Array.isArray(netWorthSnapshots))  ops.push(setData(uid, "netWorthSnapshots",  netWorthSnapshots));
    if (Array.isArray(aiMessages))         ops.push(setData(uid, "aiMessages",         aiMessages));
    if (Array.isArray(aiCatExamples))      ops.push(setData(uid, "aiCatExamples",      aiCatExamples));
    if (userProfile !== undefined && userProfile !== null) ops.push(setData(uid, "userProfile", userProfile));
    if (Array.isArray(insightsTodos))      ops.push(setData(uid, "insightsTodos",      insightsTodos));
    await Promise.all(ops);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   PLAID — requires subscription
═══════════════════════════════════════════════════════════════════ */
app.use("/api/plaid", requireSubscription);

app.post("/api/plaid/create_link_token", async (req, res) => {
  try {
    const requestedProducts = (req.body?.products && Array.isArray(req.body.products))
      ? req.body.products
      : PRODUCTS;

    // Investment connections require premium tier
    if (requestedProducts.includes("investments")) {
      const isPremium = req.user.role === "owner" ||
        (req.user.stripe_price_id && req.user.stripe_price_id === STRIPE_PREMIUM_PRICE_ID);
      if (!isPremium) return res.status(402).json({ error: "premium_required" });
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user.id },
      client_name: "Ledgr Finance",
      products: requestedProducts, country_codes: COUNTRY_CODES, language: "en",
      redirect_uri: process.env.FRONTEND_URL,
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("create_link_token error:", err.response?.data || err.message);
    serverError(res, err, "Failed to create link token");
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
    serverError(res, err, "Failed to connect bank");
  }
});

app.get("/api/plaid/items", async (req, res) => {
  try {
    const items = (await getItemsForUser(req.user.id)).map(({ item_id, institution, created_at }) => ({ item_id, institution, created_at }));
    res.json({ items });
  } catch (err) { serverError(res, err); }
});

app.delete("/api/plaid/items/:itemId", async (req, res) => {
  try {
    const item = await getItem(req.params.itemId);
    if (!item) return res.json({ ok: true }); // already gone, treat as success
    if (item.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    try { await plaidClient.itemRemove({ access_token: item.access_token }); }
    catch (e) { console.warn("Plaid itemRemove failed:", e.message); }
    await removeItem(req.params.itemId);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
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
          balance: a.balances.current, available: a.balances.available, currency: a.balances.iso_currency_code,
        })));
      } catch (err) { console.error(`accountsGet error for ${item.item_id}:`, err.response?.data || err.message); }
    }
    // Deduplicate by account_id — same account_id from multiple connections gets collapsed
    const seen = new Set();
    const deduped = allAccounts.filter(a => {
      if (seen.has(a.account_id)) return false;
      seen.add(a.account_id);
      return true;
    });
    res.json({ accounts: deduped });
  } catch (err) { serverError(res, err); }
});

app.post("/api/plaid/investments/sync", requirePremium, async (req, res) => {
  try {
    const items = await getItemsForUser(req.user.id);
    const allAccounts = [];
    const allHoldings = [];

    for (const item of items) {
      try {
        // Get investment holdings (includes securities and account info)
        const r = await plaidClient.investmentsHoldingsGet({ access_token: item.access_token });

        // Build a map of security_id -> security details
        const secMap = {};
        (r.data.securities || []).forEach(s => { secMap[s.security_id] = s; });

        // Investment accounts from this item
        (r.data.accounts || []).filter(a => a.type === "investment").forEach(a => {
          allAccounts.push({
            plaidAccountId: a.account_id,
            plaidItemId:    item.item_id,
            institution:    item.institution,
            name:           a.name,
            type:           a.subtype || "Brokerage",
            subtype:        a.subtype || "",
            balance:        a.balances.current || 0,
            currency:       a.balances.iso_currency_code || "USD",
          });
        });

        // Holdings
        (r.data.holdings || []).forEach(h => {
          const sec = secMap[h.security_id] || {};
          const acct = allAccounts.find(a => a.plaidAccountId === h.account_id);
          if (!acct) return;
          allHoldings.push({
            accountId:    acct.plaidAccountId, // will be matched in frontend
            ticker:       sec.ticker_symbol || sec.name?.slice(0,6) || "N/A",
            name:         sec.name || sec.ticker_symbol || "Unknown",
            quantity:     h.quantity || 0,
            currentPrice: h.institution_price || 0,
            currentValue: h.institution_value || 0,
            costBasis:    h.cost_basis || 0,
            fromPlaid:    true,
          });
        });
      } catch (err) {
        // Item may not have investment products — skip silently
        const code = err.response?.data?.error_code;
        if (code !== "PRODUCTS_NOT_SUPPORTED" && code !== "ITEM_NOT_SUPPORTED") {
          console.warn(`investments sync error for ${item.item_id}:`, code || err.message);
        }
      }
    }

    res.json({ accounts: allAccounts, holdings: allHoldings });
  } catch (err) { serverError(res, err); }
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
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   PUSH
═══════════════════════════════════════════════════════════════════ */
app.post("/api/push/subscribe", async (req, res) => {
  try {
    if (!req.body?.endpoint) return res.status(400).json({ error: "Invalid subscription" });
    await saveSubscription(req.user.id, req.body);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

app.post("/api/push/unsubscribe", async (req, res) => {
  try {
    if (req.body?.endpoint) await removeSubscription(req.user.id, req.body.endpoint);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

app.post("/api/push/test", async (req, res) => {
  try {
    await sendPushToUser(req.user.id, { title: "ledgr. test", body: "Push notifications are working!", url: "/" });
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   AI ASSISTANT
═══════════════════════════════════════════════════════════════════ */

// Get whether user has an API key (never return the raw key)
app.get("/api/ai/key", async (req, res) => {
  try {
    const row = await getData(req.user.id, "aiApiKey");
    res.json({ hasKey: !!row });
  } catch (err) { serverError(res, err); }
});

// Save encrypted API key
app.patch("/api/ai/key", async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) {
      // Allow clearing the key
      await setData(req.user.id, "aiApiKey", null);
      return res.json({ ok: true });
    }
    if (!key.startsWith("sk-ant-")) {
      return res.status(400).json({ error: "Invalid Anthropic API key format" });
    }
    await setData(req.user.id, "aiApiKey", encrypt(key));
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// Chat endpoint — streams Claude's response
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, history = [], context = {} } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    // Get user's encrypted API key
    const encryptedKey = await getData(req.user.id, "aiApiKey");
    if (!encryptedKey) return res.status(402).json({ error: "no_api_key" });
    const apiKey = decrypt(encryptedKey);
    if (!apiKey) return res.status(402).json({ error: "no_api_key" });

    // Build system prompt with user's financial context
    const { categories = [], accounts = [], thisMonthTransactions = [],
            lastMonthTransactions = [], recentTransactions = [],
            currentMonth = "", totalTransactions = 0 } = context;

    const systemPrompt = `You are a helpful personal finance assistant for a user of Ledgr, a budgeting app.

You have access to the user's financial data for this conversation. Be concise, specific, and use actual numbers from their data. Format currency as dollars. When referencing transactions, use merchant names. Keep responses focused and practical.

Current month: ${currentMonth}
Total transactions on record: ${totalTransactions}

Budget categories:
${categories.map(c => `- ${c.name}: $${c.spent.toFixed(2)} spent of $${(c.limit || 0).toFixed(2)} budget`).join("\n") || "None set up yet"}

Accounts:
${accounts.map(a => `- ${a.name} (${a.type}): $${(a.balance || 0).toFixed(2)}`).join("\n") || "None connected"}

This month's transactions (${thisMonthTransactions.length}):
${thisMonthTransactions.slice(0, 50).map(t =>
  `${t.date} | ${t.merchant} | $${Math.abs(t.amount).toFixed(2)} ${t.amount < 0 ? "expense" : "income"}${t.category ? ` | ${t.category}` : ""}${t.pending ? " (pending)" : ""}`
).join("\n") || "None yet this month"}

Last month's transactions (sample of ${lastMonthTransactions.length}):
${lastMonthTransactions.slice(0, 30).map(t =>
  `${t.date} | ${t.merchant} | $${Math.abs(t.amount).toFixed(2)} ${t.amount < 0 ? "expense" : "income"}${t.category ? ` | ${t.category}` : ""}`
).join("\n") || "None"}`;

    // Build message history for Claude
    const claudeMessages = [
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    // Call Claude API with streaming
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "messages-2023-12-15",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
        stream: true,
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      const msg = err.error?.message || `Claude API error: ${claudeRes.status}`;
      return res.status(claudeRes.status).json({ error: msg });
    }

    // Stream response back to client as SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = claudeRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              res.write(`data: ${JSON.stringify({ delta: parsed.delta.text })}\n\n`);
            } else if (parsed.type === "message_stop") {
              res.write("data: [DONE]\n\n");
            }
          } catch { /* skip */ }
        }
      }
    }

    res.end();
  } catch (err) {
    console.error("AI chat error:", err.message);
    if (!res.headersSent) serverError(res, err);
    else res.end();
  }
});

// Auto-categorize uncategorized transactions using Claude
app.post("/api/ai/categorize", async (req, res) => {
  try {
    const { transactions = [], categories = [], examples = [] } = req.body;

    if (!transactions.length) return res.json({ assignments: {} });

    // Get user's encrypted API key
    const encryptedKey = await getData(req.user.id, "aiApiKey");
    if (!encryptedKey) return res.status(402).json({ error: "no_api_key" });
    const apiKey = decrypt(encryptedKey);
    if (!apiKey) return res.status(402).json({ error: "no_api_key" });

    // Build compact prompt
    const catList = categories.map(c => `${c.id}: ${c.name}`).join("\n");
    const exampleList = examples.slice(-60).map(e =>
      `"${e.merchant}" → ${e.categoryId}`
    ).join("\n");

    const txnList = transactions.map(t =>
      `id:${t.id} merchant:"${t.merchant}" amount:${t.amount}`
    ).join("\n");

    const prompt = `You are categorizing financial transactions. Return ONLY valid JSON, no other text.

Categories available (id: name):
${catList}

Past categorizations to learn from (merchant → categoryId):
${exampleList || "None yet"}

Transactions to categorize:
${txnList}

Return a JSON object mapping transaction id to the best matching category id.
Only include transactions you can confidently categorize. Skip if unsure.
Example: {"txn123": "cat456", "txn789": "cat101"}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // fast + cheap for categorization
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return res.status(claudeRes.status).json({ error: err.error?.message || "Claude API error" });
    }

    const data = await claudeRes.json();
    const text = data.content?.[0]?.text || "{}";

    // Parse JSON from response, strip any markdown fences
    const clean = text.replace(/```json|```/g, "").trim();
    let assignments = {};
    try { assignments = JSON.parse(clean); } catch { assignments = {}; }

    // Validate — only keep assignments where categoryId exists in our list
    const validCatIds = new Set(categories.map(c => c.id));
    const validAssignments = {};
    for (const [txnId, catId] of Object.entries(assignments)) {
      if (validCatIds.has(catId)) validAssignments[txnId] = catId;
    }

    res.json({ assignments: validAssignments });
  } catch (err) {
    console.error("AI categorize error:", err.message);
    serverError(res, err);
  }
});

// Suggest budget limits based on historical spending
app.post("/api/ai/suggest-limits", async (req, res) => {
  try {
    const { categories = [], monthlySpending = [], avgMonthlyIncome = 0 } = req.body;
    if (!categories.length) return res.json({ suggestions: [] });

    const encryptedKey = await getData(req.user.id, "aiApiKey");
    if (!encryptedKey) return res.status(402).json({ error: "no_api_key" });
    const apiKey = decrypt(encryptedKey);
    if (!apiKey) return res.status(402).json({ error: "no_api_key" });

    // Build spending summary per category across months
    const catSummary = categories.map(c => {
      const monthly = monthlySpending.map(m => ({
        month: m.month,
        spent: m.byCategory[c.id] || 0,
      }));
      const months  = monthly.filter(m => m.spent > 0);
      const avg     = months.length ? months.reduce((s, m) => s + m.spent, 0) / months.length : 0;
      const max     = months.length ? Math.max(...months.map(m => m.spent)) : 0;
      return {
        id:           c.id,
        name:         c.name,
        currentLimit: c.limit || 0,
        avgSpending:  Math.round(avg * 100) / 100,
        maxSpending:  Math.round(max * 100) / 100,
        monthsOfData: months.length,
        monthlyDetail: monthly.map(m => `${m.month}: $${m.spent.toFixed(2)}`).join(", "),
      };
    }).filter(c => c.monthsOfData > 0);

    if (!catSummary.length) return res.json({ suggestions: [] });

    const prompt = `You are a personal finance advisor analyzing a user's spending habits to suggest monthly budget limits.

${avgMonthlyIncome > 0 ? `Average monthly income: $${avgMonthlyIncome.toFixed(2)}` : ""}

Spending history by category (last 3 months):
${catSummary.map(c => `
Category: ${c.name} (id: ${c.id})
Current limit: $${c.currentLimit.toFixed(2)}
Average monthly spending: $${c.avgSpending.toFixed(2)}
Highest month: $${c.maxSpending.toFixed(2)}
Monthly detail: ${c.monthlyDetail}`).join("\n")}

Suggest a realistic monthly budget limit for each category. Consider:
- Slightly above average spending (10-15%) to be achievable but not too loose
- Round to nearest $5 or $10 for clean numbers
- If current limit is already sensible, you can keep it
- Skip categories with less than 2 months of data

Return ONLY valid JSON, no other text:
{
  "suggestions": [
    {
      "categoryId": "string",
      "suggestedLimit": number,
      "reasoning": "one short sentence explaining why"
    }
  ]
}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return res.status(claudeRes.status).json({ error: err.error?.message || "Claude API error" });
    }

    const data = await claudeRes.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    let parsed = { suggestions: [] };
    try { parsed = JSON.parse(clean); } catch { parsed = { suggestions: [] }; }

    // Validate
    const validCatIds = new Set(categories.map(c => c.id));
    const suggestions = (parsed.suggestions || []).filter(s =>
      validCatIds.has(s.categoryId) &&
      typeof s.suggestedLimit === "number" &&
      s.suggestedLimit > 0
    );

    res.json({ suggestions });
  } catch (err) {
    console.error("AI suggest-limits error:", err.message);
    serverError(res, err);
  }
});

// Financial insights summary — non-streaming JSON response
app.post("/api/ai/insights", async (req, res) => {
  try {
    const { context = {} } = req.body;

    const encryptedKey = await getData(req.user.id, "aiApiKey");
    if (!encryptedKey) return res.status(402).json({ error: "no_api_key" });
    const apiKey = decrypt(encryptedKey);
    if (!apiKey) return res.status(402).json({ error: "no_api_key" });

    const prompt = `You are a personal finance advisor. Write a concise honest financial health summary based on this data:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON (no markdown fences) with exactly this shape:
{"headline":"one sentence summary","score":75,"scoreLabel":"Good","insights":[{"type":"positive|warning|neutral","title":"short title","body":"1-2 sentences with specific numbers","suggestion":"one concrete improvement action — omit this field entirely if type is positive"}],"recommendation":"one concrete action for this month"}
Include 3-5 insights. Be specific. Use actual dollar amounts. Only include suggestion for warning/neutral insights.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      return res.status(claudeRes.status).json({ error: err.error?.message || "Claude API error" });
    }

    const data = await claudeRes.json();
    const text = data.content?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    let insights = {};
    try { insights = JSON.parse(clean); } catch { insights = {}; }

    res.json(insights);
  } catch (err) {
    console.error("AI insights error:", err.message);
    serverError(res, err);
  }
});




app.get("/api/admin/users", requireOwner, async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, email, role, subscription_status, trial_ends_at, stripe_customer_id, last_login_at, created_at FROM users ORDER BY created_at ASC");
    // Convert BIGINT strings to numbers for JSON serialization
    const users = rows.map(u => ({
      ...u,
      trial_ends_at:  u.trial_ends_at  ? Number(u.trial_ends_at)  : null,
      last_login_at:  u.last_login_at  ? Number(u.last_login_at)  : null,
      created_at:     u.created_at     ? Number(u.created_at)     : null,
    }));
    res.json({ users });
  } catch (err) { serverError(res, err); }
});

app.patch("/api/admin/users/:userId", requireOwner, async (req, res) => {
  const { subscription_status, role, trial_ends_at } = req.body;
  const validStatuses = ["active", "trialing", "canceled", "past_due", "expired"];
  const validRoles    = ["owner", "subscriber", "free"];
  if (subscription_status && !validStatuses.includes(subscription_status))
    return res.status(400).json({ error: "Invalid subscription_status" });
  if (role && !validRoles.includes(role))
    return res.status(400).json({ error: "Invalid role" });
  try {
    const fields = [], vals = [];
    if (subscription_status) { fields.push(`subscription_status = $${fields.length+1}`); vals.push(subscription_status); }
    if (role)                 { fields.push(`role = $${fields.length+1}`);                vals.push(role); }
    if (trial_ends_at)        { fields.push(`trial_ends_at = $${fields.length+1}`);       vals.push(Number(trial_ends_at)); }
    if (!fields.length) return res.status(400).json({ error: "Nothing to update" });
    vals.push(req.params.userId);
    await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${vals.length}`, vals);
    res.json({ ok: true });
  } catch (err) { serverError(res, err, "Failed to update user"); }
});

app.delete("/api/admin/users/:userId", requireOwner, async (req, res) => {
  if (req.params.userId === req.user.id) return res.status(400).json({ error: "Cannot delete your own account" });
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.userId]);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

app.post("/api/admin/encrypt-tokens", requireOwner, async (_req, res) => {
  if (!ENCRYPT_KEY) return res.status(500).json({ error: "ENCRYPT_KEY not set" });
  try {
    const { rows } = await pool.query("SELECT item_id, access_token FROM plaid_items");
    let migrated = 0, skipped = 0;
    for (const row of rows) {
      if (row.access_token.includes(":")) { skipped++; continue; }
      await pool.query("UPDATE plaid_items SET access_token = $1 WHERE item_id = $2", [encrypt(row.access_token), row.item_id]);
      migrated++;
    }
    res.json({ ok: true, migrated, skipped });
  } catch (err) { serverError(res, err); }
});

/* ═══════════════════════════════════════════════════════════════════
   CRON
═══════════════════════════════════════════════════════════════════ */

// Every hour: expire trials that have ended + send 1-day warning emails
cron.schedule("0 * * * *", async () => {
  const now = Date.now();
  try {
    // Expire trials that ended
    const expired = await pool.query(`
      UPDATE users SET subscription_status = 'expired'
      WHERE subscription_status = 'trialing' AND trial_ends_at < $1
      RETURNING id, email
    `, [now]);
    for (const u of expired.rows) {
      console.log(`[cron] Trial expired for ${u.email}`);
    }

    // Send "trial ending tomorrow" emails (trial ends in 20-28 hours)
    const expiringSoon = await pool.query(`
      SELECT id, email, trial_ends_at FROM users
      WHERE subscription_status = 'trialing'
        AND trial_ends_at BETWEEN $1 AND $2
    `, [now + 20 * 60 * 60 * 1000, now + 28 * 60 * 60 * 1000]);
    for (const u of expiringSoon.rows) {
      await emailTrialExpiring(u.email, 1).catch(() => {});
      console.log(`[cron] Sent trial expiring email to ${u.email}`);
    }

    // Clean up expired/used password reset tokens older than 24 hours
    await pool.query(`
      DELETE FROM password_resets
      WHERE used = TRUE OR expires_at < $1
    `, [now - 24 * 60 * 60 * 1000]);

    // Clear lockouts that have expired
    await pool.query(`
      UPDATE users SET failed_login_attempts = 0, locked_until = NULL
      WHERE locked_until IS NOT NULL AND locked_until < $1
    `, [now]);

  } catch(e) { console.error("[cron] Hourly check failed:", e.message); }
});

// Every 4 hours: sync active users
cron.schedule("0 */4 * * *", async () => {
  console.log(`[cron] ${new Date().toISOString()} — syncing active users`);
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
            body: examples || `${result.added} new transaction${result.added !== 1 ? "s" : ""} synced`,
            url: "/",
          });
        }
      } catch (err) { console.error(`[cron] Failed for user ${userId}:`, err.message); }
    }
  } catch (err) { console.error("[cron] Failed:", err.message); }
});

/* ── Start ────────────────────────────────────────────────────────── */
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  🏦  Ledgr backend (multi-user + Stripe)`);
    console.log(`  =>  http://localhost:${PORT}/api/health`);
    console.log(`  =>  Plaid:      ${PLAID_ENV}`);
    console.log(`  =>  Stripe:     ${process.env.STRIPE_SECRET_KEY ? "enabled" : "DISABLED"}`);
    console.log(`  =>  Auth:       ${JWT_SECRET ? "enabled" : "DISABLED"}`);
    console.log(`  =>  Owner:      ${OWNER_EMAIL || "(first registered user)"}\n`);
  });
}).catch(err => {
  console.error("DB init failed:", err.message);
  process.exit(1);
});
