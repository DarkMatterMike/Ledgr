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

export async function logout() {
  try {
    // Tell server to invalidate the token (increments token_version)
    await request("/api/auth/logout", { method: "POST" });
  } catch (e) {
    // Ignore errors — clear locally regardless
  } finally {
    clearToken();
  }
}

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
    const hadToken = !!getToken();
    clearToken();
    if (hadToken) {
      window.location.reload(); // token was revoked — fresh load will show login
    }
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

export async function checkEmail(email) {
  const res = await fetch(`${BASE}/api/auth/check-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { exists: false };
  return res.json();
}

export async function googleAuth(credential) {
  const res = await fetch(`${BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Google sign-in failed" }));
    throw new Error(err.error || "Google sign-in failed");
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

export function sendSupport(subject, message) {
  return request("/api/support", { method: "POST", body: JSON.stringify({ subject, message }) });
}

/* ── App data ─────────────────────────────────────────────────────── */
// Core data only — categories, accounts, rules, plaidItems, goals, etc.
// Transactions, portfolio, AI, and analytics load via their own endpoints.
export function loadData()      { return request("/api/data"); }
export function saveData(patch) { return request("/api/data", { method: "PATCH", body: JSON.stringify(patch) }); }

// Transactions — paginated. Params: { limit, offset, sort, search, category, account, month, recurring }
export function loadTransactions(params = {}) {
  const q = new URLSearchParams();
  if (params.limit    != null) q.set("limit",     params.limit);
  if (params.offset   != null) q.set("offset",    params.offset);
  if (params.sort     != null) q.set("sort",       params.sort);
  if (params.search   != null) q.set("search",    params.search);
  if (params.category != null) q.set("category",  params.category);
  if (params.account  != null) q.set("account",   params.account);
  if (params.month    != null) q.set("month",     params.month);
  if (params.fromDate != null) q.set("fromDate",  params.fromDate);
  if (params.toDate   != null) q.set("toDate",    params.toDate);
  if (params.recurring)        q.set("recurring", "true");
  const qs = q.toString();
  return request(`/api/transactions${qs ? "?" + qs : ""}`);
}

// Lazy-loaded when the portfolio view first opens
export function loadPortfolio()  { return request("/api/data/portfolio"); }

// Lazy-loaded when the AI chat view first opens
export function loadAiData()     { return request("/api/data/ai"); }

// Lazy-loaded when the analytics view first opens
export function loadAnalytics()  { return request("/api/data/analytics"); }

// Load ALL transactions for analytics — no limit, used only when the analytics
// view opens so it doesn't slow down initial page load.
export function loadAllTransactions() {
  return request("/api/transactions?limit=10000&offset=0");
}

// Dashboard summary — precomputed server-side aggregates for a given month.
// Much faster than scanning all transactions client-side.
export function loadSummary(month) {
  return request(`/api/data/summary?month=${encodeURIComponent(month)}`);
}

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

/* ── Rules (incremental) ──────────────────────────────────────────── */
export function createRule(rule) {
  return request("/api/rules", { method: "POST", body: JSON.stringify(rule) });
}
export function updateRule(id, patch) {
  return request(`/api/rules/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}
export function deleteRule(id) {
  return request(`/api/rules/${id}`, { method: "DELETE" });
}
export function deleteAllRulesApi() {
  return request("/api/rules/all", { method: "DELETE" });
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
export function getPlaidItems()                         { return request("/api/plaid/items"); }

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

export function suggestCategories(transactions) {
  return request("/api/ai/suggest-categories", {
    method: "POST",
    body: JSON.stringify({ transactions }),
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



export function getStatusMessages() {
  return request("/api/status-messages");
}
export function sendStatusMessage(text) {
  return request("/api/status-messages", { method: "POST", body: JSON.stringify({ text }) });
}
export function deleteStatusMessage(id) {
  return request(`/api/status-messages/${id}`, { method: "DELETE" });
}

export function getActiveMessage() {
  return fetch(`${BASE}/api/status-messages/active`)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null);
}
