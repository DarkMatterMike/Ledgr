/**
 * useAppData
 *
 * Handles all server load / save / scheduleSave logic for AppInner.
 * Extracted to its own module so the debounced save callback and
 * the initialised ref are never in the same scope as JSX view constants,
 * which previously caused TDZ errors after Vite minification.
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
}) {
  const initialized  = useRef(false);
  const saveTimeout  = useRef(null);
  const pendingPatch = useRef({});

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
        const [data, me] = await Promise.all([api.loadData(), api.fetchMe()]);
        if (me) {
          api.setStoredUser({ ...api.getStoredUser(), ...me });
          if (me.access) setAccess(me.access);
        }
        const loadedRules = data.rules || [];
        const loadedTxns  = data.transactions || [];

        // Strip categoryId from any transaction whose type is transfer/income/reimbursement.
        // These may exist from before the no-category rule was enforced.
        const NON_CAT_TYPES = new Set(["transfer", "income", "reimbursement"]);
        const cleanedTxns = loadedTxns.map(t =>
          NON_CAT_TYPES.has(t.type) && t.categoryId
            ? { ...t, categoryId: null, userCategorized: false }
            : t
        );

        setAccounts(data.accounts              || []);
        setCategories(data.categories          || []);
        setTransactions(applyRules(cleanedTxns, loadedRules));
        setPlaidItems(data.plaidItems          || []);
        setRules(loadedRules);
        setCalendarAccounts(data.calendarAccounts || null);
        if (data.access) setAccess(data.access);
        if (onData) onData(data);
      } catch (e) {
        console.warn("Load error:", e.message);
      } finally {
        setLoading(false);
        initialized.current = true;
      }
    })();
  }, []);

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
  useEffect(() => { scheduleSave({ accounts });     }, [accounts,     scheduleSave]);
  useEffect(() => { scheduleSave({ categories });   }, [categories,   scheduleSave]);
  // transactions are no longer auto-saved — all changes go via /api/transactions/* endpoints
  useEffect(() => { scheduleSave({ plaidItems });   }, [plaidItems,    scheduleSave]);
  useEffect(() => { scheduleSave({ rules });        }, [rules,         scheduleSave]);
  useEffect(() => {
    if (Array.isArray(calendarAccounts)) scheduleSave({ calendarAccounts });
  }, [calendarAccounts, scheduleSave]);

  return { initialized, scheduleSave };
}
