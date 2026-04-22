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
  setAccounts,
  setCategories,
  setTransactions,
  setPlaidItems,
  setRules,
  setCalendarAccounts,
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
        // Load core data and first page of transactions in parallel
        const [data, txnData, me] = await Promise.allSettled([
          api.loadData(),
          api.loadTransactions({ limit: 100, offset: 0 }),
          api.fetchMe(),
        ]);

        const coreData = data.status  === "fulfilled" ? data.value  : {};
        const txnPage  = txnData.status === "fulfilled" ? txnData.value : { transactions: [], total: 0 };
        const meData   = me.status    === "fulfilled" ? me.value    : null;

        if (data.status   === "rejected") console.warn("Core data load failed:",   data.reason?.message);
        if (txnData.status === "rejected") console.warn("Transactions load failed:", txnData.reason?.message);
        if (me.status     === "rejected") console.warn("Auth check failed:",        me.reason?.message);

        if (meData) {
          api.setStoredUser({ ...api.getStoredUser(), ...meData });
          if (meData.access) setAccess(meData.access);
        }

        const loadedRules = coreData.rules || [];
        const rawTxns     = txnPage.transactions || [];

        // Strip categoryId from transfer/income/reimbursement types
        const NON_CAT_TYPES = new Set(["transfer", "income", "reimbursement"]);
        const cleanedTxns = rawTxns.map(t =>
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
        if (coreData.access) setAccess(coreData.access);
        if (onData) onData(coreData, txnPage.total || 0);
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
      const data = await api.loadAnalytics();
      if (onAnalyticsData) onAnalyticsData(data);
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
  useEffect(() => { scheduleSave({ categories });   }, [categories,   scheduleSave]);
  useEffect(() => { scheduleSave({ plaidItems });   }, [plaidItems,    scheduleSave]);
  useEffect(() => {
    if (Array.isArray(calendarAccounts)) scheduleSave({ calendarAccounts });
  }, [calendarAccounts, scheduleSave]);

  return { initialized, scheduleSave, loadPortfolioOnce, loadAiOnce, loadAnalyticsOnce };
}
