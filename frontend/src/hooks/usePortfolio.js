/**
 * usePortfolio
 *
 * All state and logic for the Portfolio / Investments page.
 * Isolated module — no TDZ risk from App.jsx's large scope.
 *
 * Data shapes:
 *   investmentAccount: { id, name, institution, type, subtype, balance,
 *                        costBasis, plaidAccountId?, plaidItemId?,
 *                        updatedAt, currency }
 *   holding: { id, accountId, ticker, name, quantity, costBasis,
 *               currentPrice, currentValue, updatedAt }
 *   netWorthSnapshot: { date, value }   (stored as array, max 24 months)
 */

import { useState, useMemo } from "react";

const ACCOUNT_TYPES = [
  "Brokerage",
  "IRA",
  "Roth IRA",
  "401(k)",
  "403(b)",
  "SEP IRA",
  "HSA",
  "529 Plan",
  "Crypto",
  "Other",
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export { ACCOUNT_TYPES };

export function usePortfolio(scheduleSave) {
  const [investmentAccounts, setInvestmentAccounts] = useState([]);
  const [holdings, setHoldings]                     = useState([]);
  const [netWorthSnapshots, setNetWorthSnapshots]   = useState([]);
  const [syncing, setSyncing]                       = useState(false);
  const [syncError, setSyncError]                   = useState(null);

  // ── Derived metrics ────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const totalValue = investmentAccounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalCost  = investmentAccounts.reduce((s, a) => s + (a.costBasis || 0), 0);
    const totalGain  = totalValue - totalCost;
    const totalReturn = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    const byType = {};
    investmentAccounts.forEach(a => {
      byType[a.type] = (byType[a.type] || 0) + (a.balance || 0);
    });

    const holdingMetrics = holdings.map(h => {
      const gain      = (h.currentValue || 0) - (h.costBasis || 0);
      const gainPct   = h.costBasis > 0 ? (gain / h.costBasis) * 100 : 0;
      const allocation = totalValue > 0 ? ((h.currentValue || 0) / totalValue) * 100 : 0;
      return { ...h, gain, gainPct, allocation };
    }).sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));

    return { totalValue, totalCost, totalGain, totalReturn, byType, holdingMetrics };
  }, [investmentAccounts, holdings]);

  // ── Save helpers ───────────────────────────────────────────────────

  function saveAccounts(next) {
    setInvestmentAccounts(next);
    scheduleSave({ investmentAccounts: next });
  }
  function saveHoldings(next) {
    setHoldings(next);
    scheduleSave({ holdings: next });
  }
  function saveSnapshots(next) {
    setNetWorthSnapshots(next);
    scheduleSave({ netWorthSnapshots: next });
  }

  // ── Snapshot recording (call when balance changes) ─────────────────

  function recordSnapshot(accounts) {
    const total = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const date  = new Date().toISOString().slice(0, 7); // YYYY-MM
    setNetWorthSnapshots(prev => {
      const existing = prev.find(s => s.date === date);
      const next = existing
        ? prev.map(s => s.date === date ? { ...s, value: total } : s)
        : [...prev, { date, value: total }].slice(-24);
      scheduleSave({ netWorthSnapshots: next });
      return next;
    });
  }

  // ── Investment account CRUD ────────────────────────────────────────

  function addAccount(form) {
    const account = {
      id:          uid(),
      name:        form.name.trim(),
      institution: form.institution.trim(),
      type:        form.type,
      subtype:     form.subtype || "",
      balance:     parseFloat(form.balance) || 0,
      costBasis:   parseFloat(form.costBasis) || 0,
      currency:    "USD",
      updatedAt:   Date.now(),
    };
    const next = [...investmentAccounts, account];
    saveAccounts(next);
    recordSnapshot(next);
    return account;
  }

  function updateAccount(id, patch) {
    const next = investmentAccounts.map(a =>
      a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a
    );
    saveAccounts(next);
    recordSnapshot(next);
  }

  function deleteAccount(id) {
    const next = investmentAccounts.filter(a => a.id !== id);
    saveAccounts(next);
    // Also remove holdings for this account
    const nextHoldings = holdings.filter(h => h.accountId !== id);
    saveHoldings(nextHoldings);
    recordSnapshot(next);
  }

  // ── Holding CRUD ───────────────────────────────────────────────────

  function addHolding(form) {
    const qty   = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.currentPrice) || 0;
    const cost  = parseFloat(form.costBasis) || 0;
    const holding = {
      id:           uid(),
      accountId:    form.accountId,
      ticker:       form.ticker.trim().toUpperCase(),
      name:         form.name.trim(),
      quantity:     qty,
      currentPrice: price,
      currentValue: qty * price,
      costBasis:    cost,
      updatedAt:    Date.now(),
    };
    const next = [...holdings, holding];
    saveHoldings(next);
    // Update account balance to reflect holdings
    _syncAccountBalanceFromHoldings(form.accountId, next);
    return holding;
  }

  function updateHolding(id, form) {
    const qty   = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.currentPrice) || 0;
    const cost  = parseFloat(form.costBasis) || 0;
    const next  = holdings.map(h =>
      h.id === id
        ? { ...h, ticker: form.ticker.trim().toUpperCase(), name: form.name.trim(),
            quantity: qty, currentPrice: price, currentValue: qty * price,
            costBasis: cost, updatedAt: Date.now() }
        : h
    );
    saveHoldings(next);
    const holding = next.find(h => h.id === id);
    if (holding) _syncAccountBalanceFromHoldings(holding.accountId, next);
  }

  function deleteHolding(id) {
    const holding = holdings.find(h => h.id === id);
    const next    = holdings.filter(h => h.id !== id);
    saveHoldings(next);
    if (holding) _syncAccountBalanceFromHoldings(holding.accountId, next);
  }

  function _syncAccountBalanceFromHoldings(accountId, allHoldings) {
    const total = allHoldings
      .filter(h => h.accountId === accountId)
      .reduce((s, h) => s + (h.currentValue || 0), 0);
    // Only auto-sync if account has holdings — don't override manual cash accounts
    const acct = investmentAccounts.find(a => a.id === accountId);
    if (!acct) return;
    const hasHoldings = allHoldings.some(h => h.accountId === accountId);
    if (hasHoldings) updateAccount(accountId, { balance: total });
  }

  // ── Plaid investments sync ─────────────────────────────────────────

  async function syncFromPlaid(showToast) {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(
        "https://ledgr-production-9e35.up.railway.app/api/plaid/investments/sync",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("ledgr_token") || ""}`,
          },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Sync failed");
      }
      const { accounts: plaidAccounts, holdings: plaidHoldings } = await res.json();

      // Merge plaid accounts — match on plaidAccountId, preserve manual fields
      setInvestmentAccounts(prev => {
        const next = [...prev];
        plaidAccounts.forEach(pa => {
          const idx = next.findIndex(a => a.plaidAccountId === pa.plaidAccountId);
          if (idx >= 0) {
            next[idx] = { ...next[idx], balance: pa.balance, updatedAt: Date.now() };
          } else {
            next.push({
              id:             uid(),
              name:           pa.name,
              institution:    pa.institution,
              type:           pa.type,
              subtype:        pa.subtype,
              balance:        pa.balance,
              costBasis:      0,
              currency:       pa.currency || "USD",
              plaidAccountId: pa.plaidAccountId,
              plaidItemId:    pa.plaidItemId,
              updatedAt:      Date.now(),
            });
          }
        });
        scheduleSave({ investmentAccounts: next });
        recordSnapshot(next);
        return next;
      });

      // Merge plaid holdings — match on accountId + ticker
      setHoldings(prev => {
        const next = [...prev.filter(h => !h.fromPlaid)];
        plaidHoldings.forEach(ph => {
          next.push({ ...ph, id: uid(), fromPlaid: true, updatedAt: Date.now() });
        });
        scheduleSave({ holdings: next });
        return next;
      });

      showToast(`Synced ${plaidAccounts.length} account${plaidAccounts.length === 1 ? "" : "s"}`);
    } catch (e) {
      setSyncError(e.message);
      showToast("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  // ── Load from server data ──────────────────────────────────────────

  function loadFromData(data) {
    if (data.investmentAccounts) setInvestmentAccounts(data.investmentAccounts);
    if (data.holdings)           setHoldings(data.holdings);
    if (data.netWorthSnapshots)  setNetWorthSnapshots(data.netWorthSnapshots);
  }

  return {
    // State
    investmentAccounts,
    holdings,
    netWorthSnapshots,
    syncing,
    syncError,
    // Derived
    metrics,
    // Actions
    addAccount, updateAccount, deleteAccount,
    addHolding, updateHolding, deleteHolding,
    syncFromPlaid,
    loadFromData,
  };
}
