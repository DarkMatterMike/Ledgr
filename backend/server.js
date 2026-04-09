/**
 * ledgr – backend/server.js
 *
 * Express server that wraps the Plaid API.
 * Stores all app data (Plaid items, transactions, categories, accounts)
 * in a local JSON file so every device sees the same data.
 */

"use strict";

const express  = require("express");
const cors     = require("cors");
const dotenv   = require("dotenv");
const fs       = require("fs");
const path     = require("path");
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

/* ── JSON file storage ───────────────────────────────────────────── */
const DB_PATH = path.join(__dirname, "ledgr-data.json");

function readDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    }
  } catch (e) {
    console.warn("Could not read DB file, starting fresh:", e.message);
  }
  return { items: {}, transactions: [], categories: [], accounts: [], plaidItems: [] };
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("Could not write DB file:", e.message);
  }
}

function getItem(itemId)         { return readDB().items[itemId] || null; }
function getAllItems()            { return Object.values(readDB().items); }
function saveItem(itemId, data)  { const db = readDB(); db.items[itemId] = { ...db.items[itemId], ...data }; writeDB(db); }
function removeItem(itemId)      { const db = readDB(); delete db.items[itemId]; writeDB(db); }
function updateCursor(itemId, c) { const db = readDB(); if (db.items[itemId]) { db.items[itemId].cursor = c; writeDB(db); } }

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
   Replaces localStorage so all devices share the same data.
═══════════════════════════════════════════════════════════════════ */

/* GET /api/data — load all app data */
app.get("/api/data", (_req, res) => {
  const db = readDB();
  res.json({
    transactions: db.transactions || [],
    categories:   db.categories   || [],
    accounts:     db.accounts     || [],
    plaidItems:   db.plaidItems   || [],
  });
});

/* PATCH /api/data — save updated fields */
app.patch("/api/data", (req, res) => {
  const db = readDB();
  const { transactions, categories, accounts, plaidItems } = req.body;
  if (transactions !== undefined) db.transactions = transactions;
  if (categories   !== undefined) db.categories   = categories;
  if (accounts     !== undefined) db.accounts     = accounts;
  if (plaidItems   !== undefined) db.plaidItems   = plaidItems;
  writeDB(db);
  res.json({ ok: true });
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
	redirect_uri:  "https://ledgr-eight-zeta.vercel.app",
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
    saveItem(item_id, {
      item_id, access_token,
      institution: institution_name || "Unknown Bank",
      cursor: null, created_at: Date.now(),
    });
    res.json({ item_id, institution: institution_name });
  } catch (err) {
    console.error("exchange_public_token error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

app.get("/api/plaid/items", (_req, res) => {
  const items = getAllItems().map(({ item_id, institution, created_at }) => ({
    item_id, institution, created_at,
  }));
  res.json({ items });
});

app.delete("/api/plaid/items/:itemId", async (req, res) => {
  const { itemId } = req.params;
  const item = getItem(itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });
  try {
    await plaidClient.itemRemove({ access_token: item.access_token });
  } catch (e) {
    console.warn("Plaid itemRemove failed (continuing):", e.message);
  }
  removeItem(itemId);
  res.json({ ok: true });
});

app.get("/api/plaid/accounts", async (_req, res) => {
  const items = getAllItems();
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
});

app.post("/api/plaid/transactions/sync", async (req, res) => {
  const { item_id: targetItemId } = req.body;
  const items = targetItemId
    ? [getItem(targetItemId)].filter(Boolean)
    : getAllItems();

  if (!items.length) return res.json({ added: [], modified: [], removed: [] });

  const allAdded = [], allModified = [], allRemoved = [];

  for (const item of items) {
    let cursor = item.cursor || undefined;
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
        cursor = next_cursor;
        hasMore = has_more;
        updateCursor(item.item_id, cursor);
      } catch (err) {
        console.error(`transactions/sync error for item ${item.item_id}:`, err.response?.data || err.message);
        hasMore = false;
      }
    }
  }
  res.json({ added: allAdded, modified: allModified, removed: allRemoved });
});

/* ── Start ────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n  🏦  Ledgr backend running`);
  console.log(`  →  http://localhost:${PORT}/api/health`);
  console.log(`  →  Plaid env: ${PLAID_ENV}\n`);
});
