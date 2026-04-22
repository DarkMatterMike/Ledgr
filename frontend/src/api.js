/**
 * ledgr – frontend/src/api.js
 * Multi-user edition
 */

const BASE      = "https://ledgr-production-9e35.up.railway.app";
const TOKEN_KEY = "ledgr_token";
const USER_KEY  = "ledgr_user";

/* ── Token / user storage ─────────────────────────────────────────── */
export function getToken()  { return localStorage.getItem(TOKEN_KEY) || ""; }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken(){ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}
export function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/* ── Request helper ───────────────────────────────────────────────── */
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
export async function register(email, password) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Registration failed" }));
    throw new Error(err.error || "Registration failed");
  }
  const { token, user } = await res.json();
  setToken(token);
  setStoredUser(user);
  return { token, user };
}

export async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Login failed" }));
    throw new Error(err.error || "Login failed");
  }
  const { token, user } = await res.json();
  setToken(token);
  setStoredUser(user);
  return { token, user };
}

export async function fetchMe() {
  return request("/api/auth/me");
}

export async function updateProfile(name) {
  return request("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ name }) });
}

export async function changePassword(currentPassword, newPassword) {
  return request("/api/auth/change-password", {
    method: "POST",
    body:   JSON.stringify({ currentPassword, newPassword }),
  });
}

/* ── App data ─────────────────────────────────────────────────────── */
// Core data only — categories, accounts, rules, plaidItems, goals, etc.
// Transactions, portfolio, AI, and analytics load via their own endpoints.
export function loadData()      { return request("/api/data"); }
export function saveData(patch) { return request("/api/data", { method: "PATCH", body: JSON.stringify(patch) }); }

// Transactions — paginated. Params: { limit, offset, sort, search, category, account, month }
export function loadTransactions(params = {}) {
  const q = new URLSearchParams();
  if (params.limit    != null) q.set("limit",    params.limit);
  if (params.offset   != null) q.set("offset",   params.offset);
  if (params.sort     != null) q.set("sort",      params.sort);
  if (params.search   != null) q.set("search",   params.search);
  if (params.category != null) q.set("category", params.category);
  if (params.account  != null) q.set("account",  params.account);
  if (params.month    != null) q.set("month",    params.month);
  const qs = q.toString();
  return request(`/api/transactions${qs ? "?" + qs : ""}`);
}

// Lazy-loaded when the portfolio view first opens
export function loadPortfolio()  { return request("/api/data/portfolio"); }

// Lazy-loaded when the AI chat view first opens
export function loadAiData()     { return request("/api/data/ai"); }

// Lazy-loaded when the analytics view first opens
export function loadAnalytics()  { return request("/api/data/analytics"); }

/* ── Accounts (incremental) ───────────────────────────────────────── */
export function createAccount(account) {
  return request("/api/accounts", { method: "POST", body: JSON.stringify(account) });
}
export function updateAccount(id, patch) {
  return request(`/api/accounts/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export function deleteAccount(id) {
  return request(`/api/accounts/${id}`, { method: "DELETE" });
}
export function deleteAccountsByItem(plaidItemId) {
  return request(`/api/accounts/plaid-item/${plaidItemId}`, { method: "DELETE" });
}
export function deleteAllAccountsApi() {
  return request("/api/accounts/all", { method: "DELETE" });
}

/* ── Plaid ────────────────────────────────────────────────────────── */
export function createLinkToken(products, itemId) {
  return request("/api/plaid/create_link_token", {
    method: "POST",
    body: JSON.stringify(itemId ? { item_id: itemId } : products ? { products } : {}),
  });
}
export function exchangePublicToken(publicToken, name)  { return request("/api/plaid/exchange_public_token", { method: "POST", body: JSON.stringify({ public_token: publicToken, institution_name: name }) }); }
export function syncTransactions(itemId)                { return request("/api/plaid/transactions/sync", { method: "POST", body: JSON.stringify(itemId ? { item_id: itemId } : {}) }); }
export function getAccounts()                           { return request("/api/plaid/accounts"); }
export function deleteItem(itemId)                      { return request(`/api/plaid/items/${itemId}`, { method: "DELETE" }); }

/* ── Push ─────────────────────────────────────────────────────────── */
export function subscribePush(subscription) {
  return request("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription) });
}

/* ── Billing ──────────────────────────────────────────────────────── */
export function getBillingStatus()  { return request("/api/billing/status"); }
export async function startCheckout() {
  const { url } = await request("/api/billing/create-checkout", { method: "POST" });
  window.location.href = url;
}
export async function openBillingPortal() {
  const { url } = await request("/api/billing/portal", { method: "POST" });
  window.location.href = url;
}

/* ── Admin (owner only) ───────────────────────────────────────────── */
export function adminGetUsers()               { return request("/api/admin/users"); }
export function adminUpdateUser(userId, data) { return request(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(data) }); }
export function adminDeleteUser(userId)       { return request(`/api/admin/users/${userId}`, { method: "DELETE" }); }

/* ── Transactions (incremental) ───────────────────────────────────── */
export function updateTransaction(id, patch) {
  return request(`/api/transactions/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export function deleteTransaction(id) {
  return request(`/api/transactions/${id}`, { method: "DELETE" });
}
export function createTransaction(txn) {
  return request("/api/transactions", { method: "POST", body: JSON.stringify(txn) });
}
export function bulkUpdateTransactions(ids, patch) {
  return request("/api/transactions/bulk", { method: "PATCH", body: JSON.stringify({ ids, patch }) });
}
export function bulkDeleteTransactions(ids) {
  return request("/api/transactions/bulk", { method: "DELETE", body: JSON.stringify({ ids }) });
}
// plaidItemId is optional — omit to delete ALL transactions for the user
export function deleteAllTransactions(plaidItemId) {
  return request("/api/transactions/all", { method: "DELETE", body: JSON.stringify(plaidItemId ? { plaidItemId } : {}) });
}

// Simple debounce — used for notes input so we don't fire on every keystroke
export function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/* ── AI ───────────────────────────────────────────────────────────── */
export function autoCategorize(transactions, categories, examples) {
  return request("/api/ai/categorize", {
    method: "POST",
    body: JSON.stringify({ transactions, categories, examples }),
  });
}

export function suggestLimits(categories, monthlySpending, avgMonthlyIncome) {
  return request("/api/ai/suggest-limits", {
    method: "POST",
    body: JSON.stringify({ categories, monthlySpending, avgMonthlyIncome }),
  });
}

export function getAiInsights(context) {
  return request("/api/ai/insights", {
    method: "POST",
    body: JSON.stringify({ context }),
  });
}



