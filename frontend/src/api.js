/**
 * ledgr – frontend/src/api.js
 * All backend communication goes through here.
 */

const BASE = import.meta.env.VITE_API_URL || "https://ledgr-production-9e35.up.railway.app";

const HEADERS = {
  "Content-Type": "application/json",
  "x-api-key":    import.meta.env.VITE_API_SECRET || "",
};

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...HEADERS, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

/* ── App data ────────────────────────────────────────────────────── */
export function loadData() {
  return request("/api/data");
}

export function saveData(patch) {
  return request("/api/data", {
    method: "PATCH",
    body:   JSON.stringify(patch),
  });
}

/* ── Plaid ───────────────────────────────────────────────────────── */
export function createLinkToken() {
  return request("/api/plaid/create_link_token", { method: "POST" });
}

export function exchangePublicToken(publicToken, institutionName) {
  return request("/api/plaid/exchange_public_token", {
    method: "POST",
    body:   JSON.stringify({ public_token: publicToken, institution_name: institutionName }),
  });
}

export function syncTransactions(itemId) {
  return request("/api/plaid/transactions/sync", {
    method: "POST",
    body:   JSON.stringify(itemId ? { item_id: itemId } : {}),
  });
}

export function getAccounts() {
  return request("/api/plaid/accounts");
}

export function deleteItem(itemId) {
  return request(`/api/plaid/items/${itemId}`, { method: "DELETE" });
}

/* ── Push ────────────────────────────────────────────────────────── */
export function subscribePush(subscription) {
  return request("/api/push/subscribe", {
    method: "POST",
    body:   JSON.stringify(subscription),
  });
}
