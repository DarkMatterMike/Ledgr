/**
 * src/api.js
 * Thin wrapper around fetch() for all backend endpoints.
 */

const BASE = "https://ledgr-production-9e35.up.railway.app/api";

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── Plaid Link ─────────────────────────────────────────────────── */

/** Create a Plaid link_token to initialise Plaid Link */
export const createLinkToken = () =>
  request("POST", "/plaid/create_link_token");

/**
 * Exchange the public_token returned by Plaid Link for a stored access_token.
 * @param {string} publicToken
 * @param {string} institutionName
 */
export const exchangePublicToken = (publicToken, institutionName) =>
  request("POST", "/plaid/exchange_public_token", {
    public_token: publicToken,
    institution_name: institutionName,
  });

/* ── Items ──────────────────────────────────────────────────────── */

/** List all connected Plaid items (banks) */
export const getItems = () => request("GET", "/plaid/items");

/** Remove a connected item */
export const deleteItem = (itemId) =>
  request("DELETE", `/plaid/items/${itemId}`);

/* ── Accounts ───────────────────────────────────────────────────── */

/** Fetch all accounts across all connected items */
export const getAccounts = () => request("GET", "/plaid/accounts");

/* ── Transactions ───────────────────────────────────────────────── */

/**
 * Sync transactions (incremental via Plaid cursor).
 * Optionally pass an itemId to sync only one institution.
 * Returns { added, modified, removed }
 */
export const syncTransactions = (itemId) =>
  request("POST", "/plaid/transactions/sync", itemId ? { item_id: itemId } : {});

/* ── App data (shared across all devices) ───────────────────────── */

/** Load all app data from the backend */
export const loadData = () => request("GET", "/data");

/** Save a partial update to the backend */
export const saveData = (patch) => request("PATCH", "/data", patch);

/* ── Health ─────────────────────────────────────────────────────── */
export const healthCheck = () => request("GET", "/health");
