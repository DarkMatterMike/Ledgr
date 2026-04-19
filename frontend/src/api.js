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
export function loadData()        { return request("/api/data"); }
export function saveData(patch)   { return request("/api/data", { method: "PATCH", body: JSON.stringify(patch) }); }

/* ── Plaid ────────────────────────────────────────────────────────── */
export function createLinkToken(products) {
  return request("/api/plaid/create_link_token", {
    method: "POST",
    body: JSON.stringify(products ? { products } : {}),
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

/* ── AI ───────────────────────────────────────────────────────────── */
export function autoCategorize(transactions, categories, examples) {
  return request("/api/ai/categorize", {
    method: "POST",
    body: JSON.stringify({ transactions, categories, examples }),
  });
}
