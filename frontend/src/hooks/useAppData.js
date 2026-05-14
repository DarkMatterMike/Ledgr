/**
 * useAppData
 *
 * Handles all server load / save / scheduleSave logic for AppInner.
 *
 * Loading strategy:
 *   1. Core data (categories, accounts, rules, etc.) + transactions load in
 *      parallel on startup — both are needed for the dashboard.
 *   2. Portfolio, AI, and analytics data are loaded lazily the first time
 *      the user navigates to those views. The returned lazy-load functions
 *      are called by the navigate() handler in App.jsx.
 *   3. Transactions are no longer part of the auto-save loop — all mutation
 *      goes through PATCH/DELETE /api/transactions/* endpoints.
 */

import { useRef, useEffect, useCallback } from "react";
import * as api from "../api.js";

export function useAppData({
  accounts,
  categories,
  transactions,
  plaidItems,
  rules,
  calendarAccounts,
  calendarSplitView,
  setAccounts,
  setCategories,
  setTransactions,
  setPlaidItems,
  setRules,
  setCalendarAccounts,
  setCalendarSplitView,
  setAccess,
  setLoading,
  applyRules,
  onData,
  onPortfolioData,
  onAiData,
  onAnalyticsData,
}) {
  const initialized  = useRef(false);
  const saveTimeout  = useRef(null);
  const pendingPatch = useRef({});

  // Track which lazy sections have already been fetched so we only load once
  const portfolioLoaded  = useRef(false);
  const aiLoaded         = useRef(false);
  const analyticsLoaded  = useRef(false);

  /* ── Stripe redirect handling ───────────────────────────────────── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscribed") === "true") {
      api.fetchMe().then(me => {
        api.setStoredUser({ ...api.getStoredUser(), ...me });
        setAccess(me.access || "full");
        window.history.replaceState({}, "", window.location.pathname);
      }).catch(() => {});
    }
    if (params.get("canceled") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  /* ── Initial data load ──────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        // Load core data, first page of transactions, recurring transactions, and auth in parallel.
        // Recurring transactions are loaded separately so they're always in memory regardless
        // of which page they fall on — the calendar and upcoming widget depend on them.
        // Load current month + all of last month on boot so linked recurring transactions,
        // recent budgets, and calendar data are fully available without paginating.
        const now = new Date();
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const fromDate = firstOfLastMonth.toISOString().slice(0, 10);

        const [coreResult, txnResult, recurringResult, meResult] = await Promise.allSettled([
          api.loadData(),
          api.loadTransactions({ fromDate, limit: 1000 }),
          api.loadTransactions({ recurring: true }),
          api.fetchMe(),
        ]);

        const coreData    = coreResult.status      === "fulfilled" ? coreResult.value      : {};
        const txnPage     = txnResult.status       === "fulfilled" ? txnResult.value       : { transactions: [], total: 0 };
        const recurringTx = recurringResult.status === "fulfilled" ? recurringResult.value : { transactions: [] };
        const meData      = meResult.status        === "fulfilled" ? meResult.value        : null;

        if (coreResult.status      === "rejected") console.warn("Core data load failed:",   coreResult.reason?.message);
        if (txnResult.status       === "rejected") console.warn("Transactions load failed:", txnResult.reason?.message);
        if (recurringResult.status === "rejected") console.warn("Recurring load failed:",    recurringResult.reason?.message);
        if (meResult.status        === "rejected") console.warn("Auth check failed:",        meResult.reason?.message);

        if (meData) {
          api.setStoredUser({ ...api.getStoredUser(), ...meData });
          if (meData.access) setAccess(meData.access);
        }

        const loadedRules = coreData.rules || [];
        const rawTxns     = txnPage.transactions || [];
        const recurringRaw = recurringTx.transactions || [];

        // Merge recurring into the first page — deduplicate by id so transactions
        // that appear in both (recurring txns within the first 100) aren't doubled.
        const pageIds = new Set(rawTxns.map(t => t.id));
        const extraRecurring = recurringRaw.filter(t => !pageIds.has(t.id));
        const mergedRaw = [...rawTxns, ...extraRecurring];

        // Strip categoryId from transfer/income/reimbursement types
        const NON_CAT_TYPES = new Set(["transfer", "income", "reimbursement"]);
        const cleanedTxns = mergedRaw.map(t =>
          NON_CAT_TYPES.has(t.type) && t.categoryId
            ? { ...t, categoryId: null, userCategorized: false }
            : t
        );

        setAccounts(coreData.accounts              || []);
        setCategories(coreData.categories          || []);
        setTransactions(applyRules(cleanedTxns, loadedRules));
        setPlaidItems(coreData.plaidItems          || []);
        setRules(loadedRules);
        setCalendarAccounts(coreData.calendarAccounts || null);
        if (coreData.calendarSplitView) setCalendarSplitView(coreData.calendarSplitView);
        if (coreData.access) setAccess(coreData.access);
        if (onData) onData(coreData, txnPage.total || 0);

        // Sync Plaid data while the loading screen is still showing so the
        // dashboard appears with fresh data and never visibly reloads.
        // Capped at 10s — if Plaid is slow the app still opens with DB data.
        if ((coreData.plaidItems || []).length > 0) {
          try {
            await Promise.race([
              api.syncTransactions(),
              new Promise(r => setTimeout(r, 10000)),
            ]);
            // Re-fetch accounts (balances) and transactions from DB after sync
            const [freshCoreRes, freshTxnRes] = await Promise.allSettled([
              api.loadData(),
              api.loadTransactions({ fromDate, limit: 1000 }),
            ]);
            if (freshCoreRes.status === "fulfilled" && freshCoreRes.value.accounts) {
              setAccounts(freshCoreRes.value.accounts);
            }
            if (freshTxnRes.status === "fulfilled") {
              const freshRaw  = freshTxnRes.value.transactions || [];
              const freshIds  = new Set(freshRaw.map(t => t.id));
              const merged    = [...freshRaw, ...recurringRaw.filter(t => !freshIds.has(t.id))];
              const cleaned   = merged.map(t =>
                NON_CAT_TYPES.has(t.type) && t.categoryId
                  ? { ...t, categoryId: null, userCategorized: false } : t
              );
              setTransactions(applyRules(cleaned, loadedRules));
            }
          } catch (e) {
            console.warn("Boot sync failed (non-fatal):", e.message);
          }
        }
      } catch (e) {
        console.warn("Load error:", e.message);
      } finally {
        setLoading(false);
        initialized.current = true;
      }
    })();
  }, []);

  /* ── Lazy loaders — called by navigate() in App.jsx ────────────── */
  const loadPortfolioOnce = useCallback(async () => {
    if (portfolioLoaded.current) return;
    portfolioLoaded.current = true;
    try {
      const data = await api.loadPortfolio();
      if (onPortfolioData) onPortfolioData(data);
    } catch (e) { console.warn("Portfolio load error:", e.message); }
  }, [onPortfolioData]);

  const loadAiOnce = useCallback(async () => {
    if (aiLoaded.current) return;
    aiLoaded.current = true;
    try {
      const data = await api.loadAiData();
      if (onAiData) onAiData(data);
    } catch (e) { console.warn("AI data load error:", e.message); }
  }, [onAiData]);

  const loadAnalyticsOnce = useCallback(async () => {
    if (analyticsLoaded.current) return;
    analyticsLoaded.current = true;
    try {
      // Load analytics blob data and full transaction set in parallel.
      // The full set is needed so analytics computations (monthly history,
      // merchant totals, day-of-week patterns, etc.) see all transactions
      // not just the first page loaded at startup.
      const [analyticsData, txnData] = await Promise.allSettled([
        api.loadAnalytics(),
        api.loadAllTransactions(),
      ]);
      const data    = analyticsData.status === "fulfilled" ? analyticsData.value : {};
      const allTxns = txnData.status      === "fulfilled" ? txnData.value.transactions || [] : [];
      if (txnData.status === "rejected") console.warn("Full txn load failed:", txnData.reason?.message);
      if (onAnalyticsData) onAnalyticsData(data, allTxns);
    } catch (e) { console.warn("Analytics load error:", e.message); }
  }, [onAnalyticsData]);

  /* ── Debounced save ─────────────────────────────────────────────── */
  const scheduleSave = useCallback((patch) => {
    if (!initialized.current) return;
    const u = api.getStoredUser();
    if (u?.role === "owner" || u?.role === "free") { /* always allow */ }
    else if (u?.subscription_status !== "active") {
      const trialOk =
        u?.subscription_status === "trialing" &&
        Date.now() < (u?.trial_ends_at || 0);
      if (!trialOk) return;
    }
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const payload = pendingPatch.current;
      pendingPatch.current = {};
      api.saveData(payload);
    }, 800);
  }, []); // refs never change — stable callback

  /* ── Auto-save each piece of state when it changes ─────────────── */
  // accounts     → POST/PATCH/DELETE /api/accounts/*
  // rules        → POST/PATCH/DELETE /api/rules/*
  // transactions → PATCH/DELETE /api/transactions/*
  useEffect(() => {
    if (!initialized.current) return;
    scheduleSave({ categories });
  }, [categories, scheduleSave]);
  useEffect(() => {
    if (!initialized.current) return;
    scheduleSave({ plaidItems });
  }, [plaidItems, scheduleSave]);
  useEffect(() => {
    if (!initialized.current) return;
    if (Array.isArray(calendarAccounts)) scheduleSave({ calendarAccounts });
  }, [calendarAccounts, scheduleSave]);
  useEffect(() => {
    if (!initialized.current) return;
    if (calendarSplitView) scheduleSave({ calendarSplitView });
  }, [calendarSplitView, scheduleSave]);

  return { initialized, scheduleSave, loadPortfolioOnce, loadAiOnce, loadAnalyticsOnce,
    // Call this to force analytics to reload all transactions on next navigation
    resetAnalyticsLoad: () => { analyticsLoaded.current = false; },
  };
}
