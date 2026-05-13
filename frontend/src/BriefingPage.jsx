/**
 * BriefingPage.jsx
 *
 * Standalone full-screen wrapper for LedgrBriefing.
 * Fetches its own data — no app shell, no sidebar, no DashboardHero.
 * Rendered when window.location.pathname === "/briefing".
 *
 * Place in: src/BriefingPage.jsx
 */

import { useState, useEffect, useMemo } from "react";
import * as api from "./api.js";
import LedgrBriefing from "./components/LedgrBriefing.jsx";

const fmt = n =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(n));

const today = new Date();

function getSelectedMonth() {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export default function BriefingPage() {
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [accounts, setAccounts]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [monthTxns, setMonthTxns]       = useState([]);
  const [recurringItems, setRecurringItems] = useState([]);
  const [goals, setGoals]               = useState([]);
  const [totalSpent, setTotalSpent]     = useState(0);
  const [totalIncome, setTotalIncome]   = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const selectedMonth = getSelectedMonth();
        const now = new Date();
        const fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString().slice(0, 10);

        const [coreResult, txnResult, recurringResult] = await Promise.allSettled([
          api.loadData(),
          api.loadTransactions({ fromDate, limit: 500 }),
          api.loadTransactions({ recurring: true }),
        ]);

        const core      = coreResult.status      === "fulfilled" ? coreResult.value      : {};
        const txnPage   = txnResult.status       === "fulfilled" ? txnResult.value       : { transactions: [] };
        const recurring = recurringResult.status === "fulfilled" ? recurringResult.value : { transactions: [] };

        const accts  = core.accounts       || [];
        const cats   = core.categories     || [];
        const ri     = core.recurringItems || [];
        const gs     = core.goals          || [];

        // filter to current month
        const [cy, cm] = selectedMonth.split("-").map(Number);
        const txns = (txnPage.transactions || []).filter(t => {
          if (!t.date) return false;
          const [ty, tm] = t.date.split("-").map(Number);
          return ty === cy && tm === cm;
        });

        const spent  = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
        const income = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

        setAccounts(accts);
        setCategories(cats.map(c => ({ ...c, limit: c.monthlyLimit || c.limit || 0 })));
        setMonthTxns(txns);
        setRecurringItems(ri);
        setGoals(gs);
        setTotalSpent(spent);
        setTotalIncome(income);
      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalBudget = useMemo(
    () => categories.reduce((s, c) => s + (c.limit || 0), 0),
    [categories]
  );

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#07090d",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 16,
        fontFamily: "'JetBrains Mono', monospace", color: "#4a5161",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #5dcaa5, #0f6e56 80%)",
          boxShadow: "0 0 24px rgba(93,202,165,0.35)",
          animation: "lb-pulse 1.8s ease-in-out infinite",
        }}/>
        <style>{`@keyframes lb-pulse { 0%,100%{opacity:0.4;transform:scale(0.95)} 50%{opacity:1;transform:scale(1.05)} }`}</style>
        <span style={{ fontSize: 11, letterSpacing: "1.8px", textTransform: "uppercase" }}>
          loading briefing…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: "100vh", background: "#07090d",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <div style={{ color: "#e87363", fontSize: 13 }}>Failed to load: {error}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ background: "rgba(232,115,99,0.1)", border: "1px solid rgba(232,115,99,0.3)",
                   color: "#e87363", borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                   fontFamily: "inherit", fontSize: 11 }}
        >
          retry
        </button>
      </div>
    );
  }

  return (
    <LedgrBriefing
      accounts={accounts}
      categories={categories}
      monthTxns={monthTxns}
      recurringItems={recurringItems}
      totalSpent={totalSpent}
      totalIncome={totalIncome}
      totalBudget={totalBudget}
      goals={goals}
      today={today}
      fmt={fmt}
      navigate={(view) => { window.location.href = view === "dashboard" ? "/" : `/${view}`; }}
      isMobile={window.innerWidth < 768}
    />
  );
}
