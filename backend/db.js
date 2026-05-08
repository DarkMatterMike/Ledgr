/**
 * ledgr – backend/db.js
 *
 * Shared module: database pool, all helpers, Plaid client, sync logic,
 * push notifications, and email.  Both server.js and worker.js require
 * this file so there is exactly one pool and one copy of every helper.
 */

"use strict";

const { Pool }    = require("pg");
const webpush     = require("web-push");
const crypto      = require("crypto");
const bcrypt      = require("bcrypt");
const dotenv      = require("dotenv");
const { Resend }  = require("resend");
const {
  PlaidApi,
  PlaidEnvironments,
  Configuration,
} = require("plaid");

dotenv.config();

/* ── Config ──────────────────────────────────────────────────────── */
const FRONTEND_URL  = process.env.FRONTEND_URL || "http://localhost:5173";
const PLAID_ENV     = process.env.PLAID_ENV    || "sandbox";
const ENCRYPT_KEY   = process.env.ENCRYPT_KEY;
const OWNER_EMAIL   = process.env.OWNER_EMAIL;
const BCRYPT_ROUNDS = 12;
const FROM_EMAIL    = "noreply@ledgrfinance.app";

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
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails("mailto:admin@ledgr.app", VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.warn("⚠  VAPID keys not set — push notifications disabled");
}

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
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until BIGINT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at BIGINT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_price_id TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at BIGINT`);
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
      created_at   BIGINT,
      needs_reauth BOOLEAN DEFAULT false
    );
  `);
  await pool.query(`ALTER TABLE plaid_items ADD COLUMN IF NOT EXISTS needs_reauth BOOLEAN DEFAULT false`);
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id               TEXT          NOT NULL,
      user_id          UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plaid_account_id TEXT,
      plaid_item_id    TEXT,
      account_id       TEXT,
      date             TEXT,
      authorized_date  TEXT,
      merchant         TEXT,
      name             TEXT          NOT NULL DEFAULT '',
      amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
      category_id      TEXT,
      user_categorized BOOLEAN       NOT NULL DEFAULT false,
      pending          BOOLEAN       NOT NULL DEFAULT false,
      type             TEXT          NOT NULL DEFAULT 'expense',
      recurring        BOOLEAN       NOT NULL DEFAULT false,
      recurring_day    INTEGER,
      notes            TEXT,
      reviewed         BOOLEAN       NOT NULL DEFAULT false,
      currency         TEXT,
      logo_url         TEXT,
      institution      TEXT,
      fingerprint      TEXT,
      metadata         JSONB,
      created_at       BIGINT        NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      updated_at       BIGINT        NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      PRIMARY KEY (id, user_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_txn_user        ON transactions(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_txn_user_date   ON transactions(user_id, date DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_txn_user_cat    ON transactions(user_id, category_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_txn_user_acct   ON transactions(user_id, account_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_txn_fingerprint ON transactions(user_id, fingerprint) WHERE fingerprint IS NOT NULL`);
  await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurring_freq  TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`);
  await pool.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`);
  await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurring_start TEXT`);
  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mask TEXT`);
  // ── Accounts table (replaces the JSON blob in app_data) ───────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            TEXT          NOT NULL,
      user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plaid_id      TEXT,
      plaid_item_id TEXT,
      name          TEXT          NOT NULL,
      balance       NUMERIC(12,2) NOT NULL DEFAULT 0,
      available     NUMERIC(12,2),
      type          TEXT,
      institution   TEXT,
      is_manual     BOOLEAN       NOT NULL DEFAULT false,
      created_at    BIGINT        NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      updated_at    BIGINT        NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      PRIMARY KEY (id, user_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_acct_user      ON accounts(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_acct_plaid_id  ON accounts(user_id, plaid_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_acct_plaid_item ON accounts(user_id, plaid_item_id)`);
  // ── Rules table (replaces the JSON blob in app_data) ─────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rules (
      id           TEXT    NOT NULL,
      user_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pattern      TEXT    NOT NULL,
      match_type   TEXT    NOT NULL DEFAULT 'contains',
      category_id  TEXT,
      type_override TEXT,
      enabled      BOOLEAN NOT NULL DEFAULT true,
      created_at   BIGINT  NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000),
      PRIMARY KEY (id, user_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_rules_user ON rules(user_id)`);

  // System messages — shown to all users on login
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_messages (
      id         SERIAL PRIMARY KEY,
      text       TEXT        NOT NULL,
      active     BOOLEAN     NOT NULL DEFAULT true,
      created_by UUID        REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
    );
  `);

  // ── Households (family sharing) ──────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS households (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS household_members (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      household_id   UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
      invited_email  TEXT NOT NULL,
      invite_token   TEXT UNIQUE,
      status         TEXT NOT NULL DEFAULT 'pending',
      created_at     BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::BIGINT * 1000)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_household_owner  ON households(owner_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_household_member ON household_members(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_household_token  ON household_members(invite_token)`);

  console.info("  =>  Database ready");
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

async function findOrCreateGoogleUser(googleId, email, name, avatarUrl) {
  const normalEmail = email.toLowerCase().trim();
  // 1. Try to find existing user by google_id
  let res = await pool.query("SELECT * FROM users WHERE google_id = $1", [googleId]);
  if (res.rows[0]) {
    // Update last login
    await pool.query("UPDATE users SET last_login_at = $1 WHERE id = $2", [Date.now(), res.rows[0].id]);
    return res.rows[0];
  }
  // 2. Try to find by email (existing email/password user — link the Google account)
  res = await pool.query("SELECT * FROM users WHERE email = $1", [normalEmail]);
  if (res.rows[0]) {
    await pool.query(
      "UPDATE users SET google_id = $1, last_login_at = $2 WHERE id = $3",
      [googleId, Date.now(), res.rows[0].id]
    );
    return { ...res.rows[0], google_id: googleId };
  }
  // 3. Create new user (no password — Google-only account)
  const countRes     = await pool.query("SELECT COUNT(*) FROM users");
  const isFirst      = parseInt(countRes.rows[0].count, 10) === 0;
  const isOwnerEmail = OWNER_EMAIL && normalEmail === OWNER_EMAIL.toLowerCase().trim();
  const role         = (isOwnerEmail || isFirst) ? "owner" : "subscriber";
  const trialEnds    = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const insert = await pool.query(
    `INSERT INTO users (email, password, role, subscription_status, trial_ends_at, google_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [normalEmail, null, role, role === "owner" ? "active" : "trialing", trialEnds, googleId]
  );
  return insert.rows[0];
}

/* ── App data helpers ─────────────────────────────────────────────── */
async function getData(userId, key) {
  const res = await pool.query("SELECT value FROM app_data WHERE user_id = $1 AND key = $2", [userId, key]);
  return res.rows[0] ? JSON.parse(res.rows[0].value) : null;
}

async function setData(userId, key, value) {
  // For critical keys, save a timestamped backup before overwriting
  const criticalKeys = new Set(["categories", "goals", "rules"]);
  if (criticalKeys.has(key) && Array.isArray(value) && value.length > 0) {
    const backupKey = `${key}_backup`;
    await pool.query(
      `INSERT INTO app_data (user_id, key, value) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [userId, backupKey, JSON.stringify({ data: value, savedAt: Date.now() })]
    );
  }
  await pool.query(
    `INSERT INTO app_data (user_id, key, value) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [userId, key, JSON.stringify(value)]
  );
}

/* ── Account helpers ──────────────────────────────────────────────── */
function dbRowToAccount(row) {
  return {
    id:          row.id,
    plaidId:     row.plaid_id,
    plaidItemId: row.plaid_item_id,
    name:        row.name,
    balance:     parseFloat(row.balance),
    available:   row.available != null ? parseFloat(row.available) : null,
    type:        row.type,
    institution: row.institution,
    isManual:    row.is_manual,
    mask:        row.mask ?? null,
  };
}

async function getAccounts(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM accounts WHERE user_id = $1 ORDER BY is_manual DESC, created_at ASC`,
    [userId]
  );
  return rows.map(dbRowToAccount);
}

// Full upsert — used for manual account creates/edits and migration.
// For Plaid sync balance updates use upsertAccountFromPlaid instead.
async function upsertAccount(userId, a) {
  await pool.query(`
    INSERT INTO accounts (id, user_id, plaid_id, plaid_item_id, name, balance, available, type, institution, is_manual, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (id, user_id) DO UPDATE SET
      name         = EXCLUDED.name,
      balance      = EXCLUDED.balance,
      available    = EXCLUDED.available,
      type         = EXCLUDED.type,
      institution  = EXCLUDED.institution,
      plaid_item_id = EXCLUDED.plaid_item_id,
      updated_at   = EXCLUDED.updated_at
  `, [
    a.id, userId,
    a.plaidId      ?? null, a.plaidItemId ?? null,
    a.name         || "",
    a.balance      ?? 0,
    a.available    ?? null,
    a.type         ?? null,
    a.institution  ?? null,
    a.isManual     ?? false,
    Date.now(),
  ]);
}

// Plaid balance refresh — only updates balance fields, never the display name.
// This preserves any custom name the user has given to a Plaid account.
async function upsertAccountFromPlaid(userId, plaidId, plaidItemId, plaidName, balance, available, institution, type, mask) {
  const accountId = "a" + plaidId;
  await pool.query(`
    INSERT INTO accounts (id, user_id, plaid_id, plaid_item_id, name, balance, available, type, institution, mask, is_manual, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11)
    ON CONFLICT (id, user_id) DO UPDATE SET
      balance       = EXCLUDED.balance,
      available     = EXCLUDED.available,
      institution   = EXCLUDED.institution,
      type          = EXCLUDED.type,
      mask          = EXCLUDED.mask,
      plaid_item_id = EXCLUDED.plaid_item_id,
      updated_at    = EXCLUDED.updated_at
      -- name is intentionally NOT updated — preserves any user customisation
  `, [accountId, userId, plaidId, plaidItemId, plaidName, balance ?? 0, available ?? null, type ?? null, institution ?? null, mask ?? null, Date.now()]);
}

async function deleteAccountById(userId, id) {
  await pool.query(`DELETE FROM accounts WHERE user_id = $1 AND id = $2`, [userId, id]);
}

async function deleteAccountsByPlaidItem(userId, plaidItemId) {
  await pool.query(`DELETE FROM accounts WHERE user_id = $1 AND plaid_item_id = $2`, [userId, plaidItemId]);
}

async function deleteAllAccounts(userId) {
  await pool.query(`DELETE FROM accounts WHERE user_id = $1`, [userId]);
}

/* ── Rule helpers ─────────────────────────────────────────────────── */
function dbRowToRule(row) {
  return {
    id:           row.id,
    pattern:      row.pattern,
    matchType:    row.match_type,
    categoryId:   row.category_id,
    typeOverride: row.type_override,
    enabled:      row.enabled,
    createdAt:    parseInt(row.created_at, 10),
  };
}

async function getRules(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM rules WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return rows.map(dbRowToRule);
}

async function upsertRule(userId, r) {
  await pool.query(`
    INSERT INTO rules (id, user_id, pattern, match_type, category_id, type_override, enabled, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (id, user_id) DO UPDATE SET
      pattern       = EXCLUDED.pattern,
      match_type    = EXCLUDED.match_type,
      category_id   = EXCLUDED.category_id,
      type_override = EXCLUDED.type_override,
      enabled       = EXCLUDED.enabled
  `, [
    r.id,           userId,
    r.pattern       || "",
    r.matchType     || "contains",
    r.categoryId    ?? null,
    r.typeOverride  ?? null,
    r.enabled       !== false,
    r.createdAt     || Date.now(),
  ]);
}

async function deleteRuleById(userId, id) {
  await pool.query(`DELETE FROM rules WHERE user_id = $1 AND id = $2`, [userId, id]);
}

async function deleteAllRules(userId) {
  await pool.query(`DELETE FROM rules WHERE user_id = $1`, [userId]);
}

/* ── Transaction helpers ──────────────────────────────────────────── */
const KNOWN_TXN_FIELDS = new Set([
  "id", "plaidAccountId", "plaidItemId", "accountId", "date",
  "authorized_date", "merchant", "name", "amount", "categoryId",
  "userCategorized", "pending", "type", "recurring", "recurringDay",
  "notes", "reviewed", "currency", "logo_url", "institution", "fingerprint",
  "recurringFreq", "recurringStart",
]);

function computeFingerprint(t) {
  const date = t.date || "";
  const raw  = (t.merchant || t.merchant_name || t.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${date}__${t.amount}__${raw}`;
}

function dbRowToTransaction(row) {
  const t = {
    id:              row.id,
    plaidAccountId:  row.plaid_account_id,
    plaidItemId:     row.plaid_item_id,
    accountId:       row.account_id,
    date:            row.date,
    authorized_date: row.authorized_date,
    merchant:        row.merchant,
    name:            row.name,
    amount:          parseFloat(row.amount),
    categoryId:      row.category_id,
    userCategorized: row.user_categorized,
    pending:         row.pending,
    type:            row.type,
    recurring:       row.recurring,
    recurringDay:    row.recurring_day,
    recurringFreq:   row.recurring_freq,
    recurringStart:  row.recurring_start,
    notes:           row.notes,
    reviewed:        row.reviewed,
    currency:        row.currency,
    logo_url:        row.logo_url,
    institution:     row.institution,
  };
  if (row.metadata) Object.assign(t, row.metadata);
  return t;
}

async function getTransactions(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC`,
    [userId]
  );
  return rows.map(dbRowToTransaction);
}

async function upsertTransactionRow(userId, t) {
  const metadata = {};
  for (const [k, v] of Object.entries(t)) {
    if (!KNOWN_TXN_FIELDS.has(k)) metadata[k] = v;
  }
  const fp = t.fingerprint || computeFingerprint(t);
  await pool.query(`
    INSERT INTO transactions (
      id, user_id, plaid_account_id, plaid_item_id, account_id,
      date, authorized_date, merchant, name, amount,
      category_id, user_categorized, pending, type,
      recurring, recurring_day, recurring_freq, recurring_start, notes, reviewed,
      currency, logo_url, institution, fingerprint, metadata, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
    ON CONFLICT (id, user_id) DO UPDATE SET
      plaid_account_id = EXCLUDED.plaid_account_id,
      plaid_item_id    = EXCLUDED.plaid_item_id,
      account_id       = EXCLUDED.account_id,
      date             = EXCLUDED.date,
      authorized_date  = EXCLUDED.authorized_date,
      merchant         = EXCLUDED.merchant,
      name             = EXCLUDED.name,
      amount           = EXCLUDED.amount,
      category_id      = EXCLUDED.category_id,
      user_categorized = EXCLUDED.user_categorized,
      pending          = EXCLUDED.pending,
      type             = EXCLUDED.type,
      recurring        = EXCLUDED.recurring,
      recurring_day    = EXCLUDED.recurring_day,
      recurring_freq   = EXCLUDED.recurring_freq,
      recurring_start  = EXCLUDED.recurring_start,
      notes            = EXCLUDED.notes,
      reviewed         = EXCLUDED.reviewed,
      currency         = EXCLUDED.currency,
      logo_url         = EXCLUDED.logo_url,
      institution      = EXCLUDED.institution,
      fingerprint      = EXCLUDED.fingerprint,
      metadata         = EXCLUDED.metadata,
      updated_at       = EXCLUDED.updated_at
  `, [
    t.id,              userId,
    t.plaidAccountId   ?? null, t.plaidItemId    ?? null, t.accountId       ?? null,
    t.date             ?? null, t.authorized_date ?? null,
    t.merchant         ?? null, t.name           ?? "",   t.amount          ?? 0,
    t.categoryId       ?? null, t.userCategorized ?? false, t.pending        ?? false,
    t.type             ?? "expense",
    t.recurring        ?? false, t.recurringDay   ?? null,
    t.recurringFreq    ?? null,  t.recurringStart ?? null,
    t.notes            ?? null,  t.reviewed       ?? false,
    t.currency         ?? null,  t.logo_url       ?? null, t.institution     ?? null,
    fp,
    Object.keys(metadata).length > 0 ? metadata : null,
    Date.now(),
  ]);
}

async function applyModifiedTransaction(userId, m) {
  const fp = computeFingerprint(m);
  await pool.query(`
    UPDATE transactions SET
      date            = $3,
      authorized_date = $4,
      pending         = $5,
      amount          = $6,
      fingerprint     = $7,
      updated_at      = $8,
      merchant = CASE WHEN name <> '' THEN merchant ELSE $9 END
    WHERE user_id = $1 AND id = $2
  `, [
    userId, m.transaction_id,
    m.date, m.authorized_date ?? null,
    m.pending, m.amount,
    fp, Date.now(),
    m.merchant_name || m.name || null,
  ]);
}

async function removeTransactionsByIds(userId, ids) {
  if (!ids.length) return;
  await pool.query(
    `DELETE FROM transactions WHERE user_id = $1 AND id = ANY($2::text[])`,
    [userId, ids]
  );
}

// Transitional batch upsert — used by PATCH /api/data until item #2
// (incremental saves) removes the need for full-array writes entirely.
async function upsertTransactionsBatch(userId, transactions) {
  if (!Array.isArray(transactions)) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const t of transactions) {
      const metadata = {};
      for (const [k, v] of Object.entries(t)) {
        if (!KNOWN_TXN_FIELDS.has(k)) metadata[k] = v;
      }
      const fp = t.fingerprint || computeFingerprint(t);
      await client.query(`
        INSERT INTO transactions (
          id, user_id, plaid_account_id, plaid_item_id, account_id,
          date, authorized_date, merchant, name, amount,
          category_id, user_categorized, pending, type,
          recurring, recurring_day, recurring_freq, recurring_start, notes, reviewed,
          currency, logo_url, institution, fingerprint, metadata, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
        ON CONFLICT (id, user_id) DO UPDATE SET
          merchant         = EXCLUDED.merchant,
          name             = EXCLUDED.name,
          amount           = EXCLUDED.amount,
          category_id      = EXCLUDED.category_id,
          user_categorized = EXCLUDED.user_categorized,
          pending          = EXCLUDED.pending,
          type             = EXCLUDED.type,
          recurring        = EXCLUDED.recurring,
          recurring_day    = EXCLUDED.recurring_day,
          recurring_freq   = EXCLUDED.recurring_freq,
          recurring_start  = EXCLUDED.recurring_start,
          notes            = EXCLUDED.notes,
          reviewed         = EXCLUDED.reviewed,
          date             = EXCLUDED.date,
          authorized_date  = EXCLUDED.authorized_date,
          fingerprint      = EXCLUDED.fingerprint,
          metadata         = EXCLUDED.metadata,
          updated_at       = EXCLUDED.updated_at
      `, [
        t.id,              userId,
        t.plaidAccountId   ?? null, t.plaidItemId    ?? null, t.accountId       ?? null,
        t.date             ?? null, t.authorized_date ?? null,
        t.merchant         ?? null, t.name           ?? "",   t.amount          ?? 0,
        t.categoryId       ?? null, t.userCategorized ?? false, t.pending        ?? false,
        t.type             ?? "expense",
        t.recurring        ?? false, t.recurringDay   ?? null,
        t.recurringFreq    ?? null,  t.recurringStart ?? null,
        t.notes            ?? null,  t.reviewed       ?? false,
        t.currency         ?? null,  t.logo_url       ?? null, t.institution     ?? null,
        fp,
        Object.keys(metadata).length > 0 ? metadata : null,
        Date.now(),
      ]);
    }
    // Upsert-only — deletions handled via DELETE /api/transactions/* endpoints.
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
const resend = new Resend(process.env.RESEND_API_KEY || "");

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) { console.warn("[email] RESEND_API_KEY not set, skipping:", subject); return; }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    console.info(`[email] Sent "${subject}" to ${to}`);
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
const plaidClient = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET":    process.env.PLAID_SECRET,
    },
  },
}));

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
        await pool.query("UPDATE plaid_items SET needs_reauth = false WHERE item_id = $1", [item.item_id]);
      } catch (err) {
        const code = err.response?.data?.error_code;
        if (code === "ITEM_LOGIN_REQUIRED" || code === "ITEM_NOT_FOUND") {
          await pool.query("UPDATE plaid_items SET needs_reauth = true WHERE item_id = $1", [item.item_id]);
          console.error(`Item ${item.item_id} needs re-auth (${code})`);
        } else if (code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION") {
          await updateCursor(item.item_id, null);
          console.warn(`Item ${item.item_id} cursor reset due to mutation during pagination`);
        } else if (code === "PRODUCT_NOT_READY") {
          console.info(`Item ${item.item_id} transactions not ready yet`);
        } else {
          console.error(`sync error for item ${item.item_id}:`, err.response?.data || err.message);
        }
        hasMore = false;
      }
    }
  }
  return { added: allAdded, modified: allModified, removed: allRemoved };
}

async function applySyncResultsToDB(userId, added, modified, removed) {
  const { rows: existing } = await pool.query(
    `SELECT id, fingerprint FROM transactions WHERE user_id = $1`, [userId]
  );
  const existingIds  = new Set(existing.map(r => r.id));
  const fingerprints = new Set(existing.map(r => r.fingerprint).filter(Boolean));

  if (removed.length > 0) {
    const removeIds = removed.map(r => r.transaction_id);
    // Only delete transactions the user hasn't touched — prevents Plaid cursor
    // resets from wiping user-categorized or reviewed transactions
    await pool.query(
      `DELETE FROM transactions
       WHERE user_id = $1
       AND id = ANY($2::text[])
       AND user_categorized = false
       AND reviewed = false
       AND notes IS NULL`,
      [userId, removeIds]
    );
    removeIds.forEach(id => existingIds.delete(id));
  }

  for (const m of modified) {
    await applyModifiedTransaction(userId, m);
  }

  const newTxns = added
    .filter(t => !existingIds.has(t.transaction_id))
    .map(t => ({
      id:              t.transaction_id,
      plaidAccountId:  t.account_id,
      plaidItemId:     t.item_id,
      accountId:       "a" + t.account_id,
      date:            t.date,
      authorized_date: t.authorized_date || null,
      merchant:        t.merchant_name || t.name,
      name:            "",
      amount:          t.amount,
      categoryId:      null,
      userCategorized: false,
      pending:         t.pending,
      type:            t.amount < 0 ? "expense" : "income",
      recurring:       false,
      recurringDay:    null,
      currency:        t.currency   || null,
      logo_url:        t.logo_url   || null,
      institution:     t.institution || null,
    }))
    .filter(t => {
      const fp = computeFingerprint(t);
      if (fingerprints.has(fp)) return false;
      fingerprints.add(fp);
      return true;
    });

  // Bulk insert all new transactions in a single query for performance
  if (newTxns.length > 0) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Build bulk INSERT with all rows
      const vals = [];
      const rows = newTxns.map((t, i) => {
        const fp = t.fingerprint || computeFingerprint(t);
        const base = i * 26;
        vals.push(
          t.id, userId,
          t.plaidAccountId || null, t.plaidItemId || null, t.accountId || null,
          t.date, t.authorized_date || null,
          t.merchant || null, t.name || "",
          t.amount,
          t.categoryId || null, t.userCategorized || false,
          t.pending || false, t.type || (t.amount < 0 ? "expense" : "income"),
          t.recurring || false, t.recurringDay || null,
          t.recurringFreq || null, t.recurringStart || null,
          t.notes || null, t.reviewed || false,
          t.currency || null, t.logo_url || null,
          t.institution || null, fp,
          JSON.stringify({}), Date.now()
        );
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16},$${base+17},$${base+18},$${base+19},$${base+20},$${base+21},$${base+22},$${base+23},$${base+24},$${base+25},$${base+26})`;
      });
      await client.query(`
        INSERT INTO transactions (
          id, user_id, plaid_account_id, plaid_item_id, account_id,
          date, authorized_date, merchant, name, amount,
          category_id, user_categorized, pending, type,
          recurring, recurring_day, recurring_freq, recurring_start, notes, reviewed,
          currency, logo_url, institution, fingerprint, metadata, updated_at
        ) VALUES ${rows.join(",")}
        ON CONFLICT (id, user_id) DO NOTHING`,
        vals
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("Bulk insert failed, falling back to individual upserts:", e.message);
      for (const t of newTxns) await upsertTransactionRow(userId, t);
    } finally {
      client.release();
    }
  }

  // Refresh account balances — writes to accounts table, never overwrites user names
  try {
    const items = await getItemsForUser(userId);
    const seen  = new Set();
    for (const item of items) {
      try {
        const r = await plaidClient.accountsGet({ access_token: item.access_token });
        for (const a of r.data.accounts) {
          if (seen.has(a.account_id)) continue;
          seen.add(a.account_id);
          await upsertAccountFromPlaid(
            userId,
            a.account_id,
            item.item_id,
            a.name,
            a.balances.current,
            a.balances.available,
            item.institution,
            a.subtype || a.type,
            a.mask
          );
        }
      } catch (e) { console.error(`accountsGet failed for ${item.item_id}:`, e.message); }
    }
  } catch (e) { console.error("Balance refresh failed:", e.message); }

  return { added: newTxns.length, modified: modified.length, removed: removed.length, newTxns };
}

/* ── System messages ──────────────────────────────────────────────── */
async function createSystemMessage(text, createdBy) {
  const res = await pool.query(
    `INSERT INTO system_messages (text, created_by)
     VALUES ($1, $2) RETURNING *`,
    [text, createdBy]
  );
  return res.rows[0];
}

async function getSystemMessages() {
  const res = await pool.query(
    `SELECT * FROM system_messages ORDER BY created_at DESC LIMIT 50`
  );
  return res.rows;
}

async function getActiveSystemMessage() {
  const res = await pool.query(
    `SELECT * FROM system_messages
     WHERE active = true AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`
  );
  return res.rows[0] || null;
}

async function deleteSystemMessage(id) {
  await pool.query(`DELETE FROM system_messages WHERE id = $1`, [id]);
}

async function deactivateSystemMessage(id) {
  await pool.query(`UPDATE system_messages SET active = false WHERE id = $1`, [id]);
}

/* ── Exports ──────────────────────────────────────────────────────── */
/* ── Household helpers ──────────────────────────────────────────── */

/**
 * Given a user_id, returns the household owner's user_id.
 * If the user owns a household or is a member of one, returns the owner's id.
 * Otherwise returns the user's own id (no household).
 */
async function resolveHouseholdUid(userId) {
  // Check if this user owns a household
  const owned = await pool.query(
    `SELECT id FROM households WHERE owner_id = $1 LIMIT 1`,
    [userId]
  );
  if (owned.rows.length) return userId;

  // Check if this user is an active member of someone else's household
  const membership = await pool.query(`
    SELECT h.owner_id FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = $1 AND hm.status = 'active'
    LIMIT 1
  `, [userId]);
  if (membership.rows.length) return membership.rows[0].owner_id;

  return userId;
}

async function getHousehold(userId) {
  // Get household this user owns or belongs to
  const owned = await pool.query(`
    SELECT h.id, h.owner_id, u.email as owner_email, u.name as owner_name
    FROM households h JOIN users u ON u.id = h.owner_id
    WHERE h.owner_id = $1 LIMIT 1
  `, [userId]);
  if (owned.rows.length) {
    const h = owned.rows[0];
    const members = await pool.query(`
      SELECT hm.id, hm.invited_email, hm.status, hm.user_id, u.name
      FROM household_members hm LEFT JOIN users u ON u.id = hm.user_id
      WHERE hm.household_id = $1 ORDER BY hm.created_at
    `, [h.id]);
    return { ...h, role: "owner", members: members.rows };
  }
  const member = await pool.query(`
    SELECT h.id, h.owner_id, u.email as owner_email, u.name as owner_name, hm.status
    FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    JOIN users u ON u.id = h.owner_id
    WHERE hm.user_id = $1 AND hm.status = 'active' LIMIT 1
  `, [userId]);
  if (member.rows.length) return { ...member.rows[0], role: "member", members: [] };
  return null;
}

async function emailHouseholdInvite(toEmail, inviterName, inviteToken) {
  if (!resend) { console.warn("Resend not configured — skipping invite email"); return; }
  const link = `${FRONTEND_URL}?invite=${inviteToken}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `${inviterName || "Someone"} invited you to join their Ledgr household`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#00d4ff">You've been invited to Ledgr</h2>
        <p><strong>${inviterName || "A Ledgr user"}</strong> has invited you to share their financial data on Ledgr.</p>
        <p>Once you accept, you'll see all their transactions, accounts, categories, and recurring items.</p>
        <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#00d4ff;color:#000;border-radius:6px;text-decoration:none;font-weight:700">Accept Invite</a>
        <p style="color:#888;font-size:12px">This link expires in 7 days. If you didn't expect this, you can ignore it.</p>
      </div>
    `,
  });
}

/* ── Household helpers ──────────────────────────────────────────── */

async function resolveHouseholdUid(userId) {
  // If user owns a household, they are the data owner
  const owned = await pool.query(`SELECT id FROM households WHERE owner_id = $1 LIMIT 1`, [userId]);
  if (owned.rows.length) return userId;
  // If user is an active member, return the owner's id
  const membership = await pool.query(`
    SELECT h.owner_id FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    WHERE hm.user_id = $1 AND hm.status = 'active' LIMIT 1
  `, [userId]);
  if (membership.rows.length) return membership.rows[0].owner_id;
  return userId;
}

async function getHousehold(userId) {
  const owned = await pool.query(`
    SELECT h.id, h.owner_id, u.email as owner_email, u.name as owner_name
    FROM households h JOIN users u ON u.id = h.owner_id
    WHERE h.owner_id = $1 LIMIT 1
  `, [userId]);
  if (owned.rows.length) {
    const h = owned.rows[0];
    const members = await pool.query(`
      SELECT hm.id, hm.invited_email, hm.status, hm.user_id, u.name
      FROM household_members hm LEFT JOIN users u ON u.id = hm.user_id
      WHERE hm.household_id = $1 ORDER BY hm.created_at
    `, [h.id]);
    return { ...h, role: "owner", members: members.rows };
  }
  const member = await pool.query(`
    SELECT h.id, h.owner_id, u.email as owner_email, u.name as owner_name, hm.status
    FROM household_members hm
    JOIN households h ON h.id = hm.household_id
    JOIN users u ON u.id = h.owner_id
    WHERE hm.user_id = $1 AND hm.status = 'active' LIMIT 1
  `, [userId]);
  if (member.rows.length) return { ...member.rows[0], role: "member", members: [] };
  return null;
}

async function emailHouseholdInvite(toEmail, inviterName, inviteToken) {
  if (!resend) { console.warn("Resend not configured"); return; }
  const link = `${FRONTEND_URL}/accept-invite?token=${inviteToken}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: `${inviterName || "Someone"} invited you to join their Ledgr household`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#00d4ff">You've been invited to Ledgr</h2>
      <p><strong>${inviterName || "A Ledgr user"}</strong> has invited you to share their financial data on Ledgr.</p>
      <p>Once you accept, you'll see all their transactions, accounts, categories, and recurring items.</p>
      <a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#00d4ff;color:#000;border-radius:6px;text-decoration:none;font-weight:700">Accept Invite</a>
      <p style="color:#888;font-size:12px">This link expires in 7 days.</p>
    </div>`,
  });
}

module.exports = {
  pool,
  initDB,
  encrypt,
  decrypt,
  // User
  getUserById,
  getUserByEmail,
  getUserByStripeCustomerId,
  createUser,
  findOrCreateGoogleUser,
  // App data
  getData,
  setData,
  // Accounts
  getAccounts,
  upsertAccount,
  upsertAccountFromPlaid,
  deleteAccountById,
  deleteAccountsByPlaidItem,
  deleteAllAccounts,
  // Rules
  getRules,
  upsertRule,
  deleteRuleById,
  deleteAllRules,
  // Transactions
  getTransactions,
  upsertTransactionRow,
  upsertTransactionsBatch,
  // Plaid items
  getItem,
  getItemsForUser,
  saveItem,
  removeItem,
  updateCursor,
  // Push
  saveSubscription,
  getSubscriptionsForUser,
  removeSubscription,
  sendPushToUser,
  // Email
  sendEmail,
  emailWelcome,
  emailTrialExpiring,
  resolveHouseholdUid,
  getHousehold,
  emailHouseholdInvite,
  resolveHouseholdUid,
  getHousehold,
  emailHouseholdInvite,
  emailSubscriptionConfirmed,
  emailPasswordReset,
  // Plaid client + sync
  plaidClient,
  PLAID_ENV,
  syncItemTransactions,
  // System messages
  createSystemMessage,
  getSystemMessages,
  getActiveSystemMessage,
  deleteSystemMessage,
  deactivateSystemMessage,
  applySyncResultsToDB,
};
