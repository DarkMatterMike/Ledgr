/**
 * ledgr – frontend/src/api.js
 */

const BASE    = "https://ledgr-production-9e35.up.railway.app";
const TOKEN_KEY = "ledgr_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  if (res.status === 401) {
    // Token expired or invalid — clear it so the login screen shows
    clearToken();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

/* ── Auth ─────────────────────────────────────────────────────────── */
export async function login(password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(err.error || "Login failed");
  }
  const { token } = await res.json();
  setToken(token);
  return token;
}

/* ── App data ─────────────────────────────────────────────────────── */
export function loadData() {
  return request("/api/data");
}

export function saveData(patch) {
  return request("/api/data", {
    method: "PATCH",
    body:   JSON.stringify(patch),
  });
}

/* ── Plaid ────────────────────────────────────────────────────────── */
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

/* ── Push ─────────────────────────────────────────────────────────── */
export function subscribePush(subscription) {
  return request("/api/push/subscribe", {
    method: "POST",
    body:   JSON.stringify(subscription),
  });
}
