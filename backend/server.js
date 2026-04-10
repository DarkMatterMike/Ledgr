/**
 * ledgr – backend/server.js
 *
 * Express server that wraps the Plaid API.
 * Uses PostgreSQL for persistent storage that survives redeployments.
 */

"use strict";

const express  = require("express");
const cors     = require("cors");
const dotenv   = require("dotenv");
const { Pool } = require("pg");
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
  return res.rows[0] || null;
}

async function getAllItems() {
  const res = await pool.query("SELECT * FROM plaid_items");
  return res.rows;
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
    [itemId, data.access_token, data.institution, data.cursor || null, data.created_at || Date.now()]
  );
}

async function removeItem(itemId) {
  await pool.query("DELETE FROM plaid_items WHERE item_id = $1", [itemId]);
}

async function updateCursor(itemId, cursor) {
  await pool.query("UPDATE plaid_items SET cursor = $1 WHERE item_id = $2", [cursor, itemId]);
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

/* ── Express ──────────────────────────────────────────────────────── */
const app = express();
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));

/* ── Health ──────────────────────────────────────────────────────── */
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, env: PLAID_ENV, products: PRODUCTS });
});

/* ═══════════════════════════════════════════════════════════════════
   APP DATA STORAGE
═══════════════════════════════════════════════════════════════════ */

app.get("/api/data", async (_req, res) => {
  try {
    const [transactions, categories, accounts, plaidItems, rules] = await Promise.all([
      getData("transactions"),
      getData("categories"),
      getData("accounts"),
      getData("plaidItems"),
      getData("rules"),
    ]);
    res.json({
      transactions: transactions || [],
      categories:   categories   || [],
      accounts:     accounts     || [],
      plaidItems:   plaidItems   || [],
      rules:        rules        || [],
    });  } catch (err) {
    console.error("GET /api/data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/data", async (req, res) => {
  try {
    const { transactions, categories, accounts, plaidItems, rules } = req.body;
    const ops = [];
    if (transactions !== undefined) ops.push(setData("transactions", transactions));
    if (categories   !== undefined) ops.push(setData("categories",   categories));
    if (accounts     !== undefined) ops.push(setData("accounts",     accounts));
    if (plaidItems   !== undefined) ops.push(setData("plaidItems",   plaidItems));
    if (rules        !== undefined) ops.push(setData("rules",        rules));
    await Promise.all(ops);
    res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   PLAID ENDPOINTS
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
      access_token,
      institution: institution_name || "Unknown Bank",
      created_at: Date.now(),
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

app.post("/api/plaid/transactions/sync", async (req, res) => {
  const { item_id: targetItemId } = req.body;
  try {
    const items = targetItemId
      ? [await getItem(targetItemId)].filter(Boolean)
      : await getAllItems();

    if (!items.length) return res.json({ added: [], modified: [], removed: [] });

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
          console.error(`transactions/sync error for item ${item.item_id}:`, err.response?.data || err.message);
          hasMore = false;
        }
      }
    }
    res.json({ added: allAdded, modified: allModified, removed: allRemoved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Start ────────────────────────────────────────────────────────── */
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  🏦  Ledgr backend running`);
    console.log(`  →  http://localhost:${PORT}/api/health`);
    console.log(`  →  Plaid env: ${PLAID_ENV}\n`);
  });
}).catch(err => {
  console.error("Failed to initialize database:", err.message);
  process.exit(1);
});
