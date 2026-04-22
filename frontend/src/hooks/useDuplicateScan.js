/**
 * useDuplicateScan
 *
 * Manages duplicate / preauth transaction detection, reconciliation,
 * and scan memory (learns from confirm / dismiss decisions).
 *
 * All state and logic is isolated here so esbuild never has a TDZ
 * ordering problem — every const in this module is defined before
 * it is used within the same module.
 */

import { useState, useMemo } from "react";
import * as api from "../api.js";

/* ── Pure helpers (no state, defined first) ──────────────────────── */

function normalizeMerchantLabel(t) {
  return ((t.merchant || t.name || ""))
    .toLowerCase()
    .replace(/[#*]/g, " ")
    .replace(/\b(?:debit|credit|purchase|pos|checkcard|card|visa|mc|mastercard|pending|payment|online|auth|authorized|store|location|ticket|txn|preauthorized|preauth|pre-auth)\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function merchantsMatch(a, b) {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function isPreauth(t) {
  const raw = (t.merchant || t.name || "").toLowerCase();
  return (
    raw.includes("preauth") ||
    raw.includes("pre-auth") ||
    raw.includes("preauthorized") ||
    raw.includes("pre auth") ||
    !!t.pending
  );
}

function pickRemove(a, b) {
  if (a.pending && !b.pending) return a;
  if (b.pending && !a.pending) return b;
  if (isPreauth(a) && !isPreauth(b)) return a;
  if (isPreauth(b) && !isPreauth(a)) return b;
  return a.date <= b.date ? a : b;
}

function makeMemoryKey(a, b) {
  return [normalizeMerchantLabel(a), normalizeMerchantLabel(b)]
    .sort()
    .join("__");
}

/* ── Hook ────────────────────────────────────────────────────────── */

export function useDuplicateScan(transactions, showToast, setTransactions) {
  // Dismissed pair keys (individual pending id OR "aId__bId" from scan)
  const [dismissedPairs, setDismissedPairs] = useState([]);

  // Scan memory: tracks confirmed / dismissed merchant pairs
  const [scanMemory, setScanMemory] = useState({ confirmed: {}, dismissed: {} });

  // Manual scan results
  const [duplicatePairs, setDuplicatePairs] = useState([]);
  const [duplicateScanActive, setDuplicateScanActive] = useState(false);

  // Reconcile panel open/closed
  const [showReconcile, setShowReconcile] = useState(false);

  // Whether to show pending duplicates inline in the transaction list
  const [showDuplicates, setShowDuplicates] = useState(false);

  /* ── Memory helpers ─────────────────────────────────────────────── */

  function recordConfirmed(tA, tB) {
    const key = makeMemoryKey(tA, tB);
    setScanMemory(prev => ({
      ...prev,
      confirmed: { ...prev.confirmed, [key]: (prev.confirmed[key] || 0) + 1 },
    }));
  }

  function recordDismissed(tA, tB) {
    const key = makeMemoryKey(tA, tB);
    setScanMemory(prev => ({
      ...prev,
      dismissed: { ...prev.dismissed, [key]: (prev.dismissed[key] || 0) + 1 },
    }));
  }

  function isSuppressed(tA, tB) {
    const key = makeMemoryKey(tA, tB);
    const conf = scanMemory.confirmed[key] || 0;
    const dism = scanMemory.dismissed[key] || 0;
    return dism > 0;
  }

  function memoryBoost(tA, tB) {
    const key = makeMemoryKey(tA, tB);
    return (scanMemory.confirmed[key] || 0) > 0;
  }

  /* ── Auto-detected pending pairs (runs on every transaction change) */

  const pendingPairs = useMemo(() => {
    const pending = transactions.filter(
      t => t.pending && !dismissedPairs.includes(t.id)
    );
    const posted = transactions.filter(t => !t.pending);
    const pairs = [];
    const usedPostedIds = new Set();

    pending.forEach(p => {
      const pNorm = normalizeMerchantLabel(p);
      const pDate = new Date(p.date + "T12:00:00");
      const pAmt  = Math.abs(Number(p.amount || 0));
      const boost = false; // no memory boost for auto-detection

      const match = posted.find(t => {
        if (usedPostedIds.has(t.id)) return false;
        if (isSuppressed(p, t)) return false;
        const tDate   = new Date(t.date + "T12:00:00");
        const dayDiff = (tDate - pDate) / (1000 * 60 * 60 * 24);
        const maxDays = memoryBoost(p, t) ? 7 : 5;
        if (dayDiff < 0 || dayDiff > maxDays) return false;
        const tNorm = normalizeMerchantLabel(t);
        if (!merchantsMatch(pNorm, tNorm)) return false;
        const tAmt      = Math.abs(Number(t.amount || 0));
        const tolerance = Math.max(10, pAmt * 0.2);
        return Math.abs(pAmt - tAmt) <= tolerance;
      });

      if (match) {
        usedPostedIds.add(match.id);
        const remove = pickRemove(p, match);
        const keep   = remove.id === p.id ? match : p;
        pairs.push({ pending: remove, posted: keep });
      }
    });

    return pairs;
  }, [transactions, dismissedPairs, scanMemory]);

  const activeDuplicatePairs = duplicateScanActive ? duplicatePairs : pendingPairs;

  /* ── Manual scan ────────────────────────────────────────────────── */

  function scanForDuplicates() {
    const candidates = transactions.filter(
      t => t.date && t.amount < 0 && normalizeMerchantLabel(t)
    );

    const nextPairs = [];
    const seen = new Set();

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        const pairKey = [a.id, b.id].sort().join("__");
        if (seen.has(pairKey) || dismissedPairs.includes(pairKey)) continue;
        if (isSuppressed(a, b)) continue;

        const aDate   = new Date(`${a.date}T12:00:00`);
        const bDate   = new Date(`${b.date}T12:00:00`);
        const dayDiff = Math.abs((bDate - aDate) / (1000 * 60 * 60 * 24));
        const aNorm   = normalizeMerchantLabel(a);
        const bNorm   = normalizeMerchantLabel(b);
        if (!merchantsMatch(aNorm, bNorm)) continue;

        const aAmt         = Math.abs(Number(a.amount || 0));
        const bAmt         = Math.abs(Number(b.amount || 0));
        const amtDiff      = Math.abs(aAmt - bAmt);
        const eitherPreauth = isPreauth(a) || isPreauth(b);
        const boosted       = memoryBoost(a, b);

        if (eitherPreauth) {
          if (dayDiff > (boosted ? 7 : 5)) continue;
          if (amtDiff > Math.max(10, aAmt * 0.2)) continue;
        } else {
          if (dayDiff > (boosted ? 21 : 14)) continue;
          if (aAmt.toFixed(2) !== bAmt.toFixed(2)) continue;
        }

        const remove = pickRemove(a, b);
        const keep   = remove.id === a.id ? b : a;

        nextPairs.push({
          pending:        remove,
          posted:         keep,
          isPreauth:      eitherPreauth,
          wasConfirmed:   boosted,
        });
        seen.add(pairKey);
      }
    }

    nextPairs.sort((x, y) => {
      if (y.wasConfirmed !== x.wasConfirmed) return y.wasConfirmed ? 1 : -1;
      return String(y.posted.date || y.pending.date)
        .localeCompare(String(x.posted.date || x.pending.date));
    });

    setDuplicatePairs(nextPairs);
    setDuplicateScanActive(nextPairs.length > 0);
    setShowReconcile(nextPairs.length > 0);
    showToast(
      nextPairs.length > 0
        ? `Found ${nextPairs.length} possible duplicate${nextPairs.length === 1 ? "" : "s"}`
        : "No duplicates found"
    );
  }

  /* ── Confirm / dismiss actions ──────────────────────────────────── */

  function dismissPair(pendingId) {
    const pair = pendingPairs.find(pr => pr.pending.id === pendingId);
    if (pair) recordDismissed(pair.pending, pair.posted);
    setDismissedPairs(prev => [...prev, pendingId]);
  }

  function confirmPair(pendingId, postedId) {
    const pending = transactions.find(t => t.id === pendingId);
    const posted  = transactions.find(t => t.id === postedId);
    if (!pending || !posted) return;
    recordConfirmed(pending, posted);
    const mergedFields = {
      name:           pending.name           || posted.name,
      categoryId:     pending.categoryId     || posted.categoryId,
      recurring:      pending.recurring      || posted.recurring,
      recurringDay:   pending.recurringDay   || posted.recurringDay,
      recurringFreq:  pending.recurringFreq  || posted.recurringFreq,
      recurringStart: pending.recurringStart || posted.recurringStart,
      reviewed:       pending.reviewed       || posted.reviewed,
      type:           pending.type           || posted.type,
    };
    setTransactions(p =>
      p
        .filter(t => t.id !== pendingId)
        .map(t => t.id !== postedId ? t : { ...t, ...mergedFields })
    );
    api.deleteTransaction(pendingId).catch(console.error);
    api.updateTransaction(postedId, mergedFields).catch(console.error);
    showToast("Merged — metadata copied to posted transaction");
  }

  function dismissDuplicatePair(aId, bId) {
    const tA = transactions.find(t => t.id === aId);
    const tB = transactions.find(t => t.id === bId);
    if (tA && tB) recordDismissed(tA, tB);
    const pairKey = [aId, bId].sort().join("__");
    setDismissedPairs(prev => [...prev, pairKey]);
    setDuplicatePairs(prev => {
      const remaining = prev.filter(
        pair => [pair.pending.id, pair.posted.id].sort().join("__") !== pairKey
      );
      setShowReconcile(remaining.length > 0);
      return remaining;
    });
  }

  function confirmDuplicateRemoval(removeId, keepId) {
    const removeTxn = transactions.find(t => t.id === removeId);
    const keepTxn   = transactions.find(t => t.id === keepId);
    if (!removeTxn || !keepTxn) return;
    recordConfirmed(removeTxn, keepTxn);
    setTransactions(prev => prev.filter(t => t.id !== removeId));
    api.deleteTransaction(removeId).catch(console.error);
    setDuplicatePairs(prev =>
      prev.filter(
        pair =>
          !(pair.pending.id === removeId && pair.posted.id === keepId) &&
          !(pair.pending.id === keepId   && pair.posted.id === removeId)
      )
    );
    showToast("Duplicate removed");
  }

  return {
    // State
    dismissedPairs,
    scanMemory,
    setScanMemory,
    setDismissedPairs,
    duplicatePairs,
    duplicateScanActive,
    setDuplicateScanActive,
    showReconcile,
    setShowReconcile,
    showDuplicates,
    setShowDuplicates,
    // Computed
    pendingPairs,
    activeDuplicatePairs,
    // Actions
    scanForDuplicates,
    dismissPair,
    confirmPair,
    dismissDuplicatePair,
    confirmDuplicateRemoval,
    // Exposed for UI (remove label)
    pickRemove,
    isPreauth,
  };
}
