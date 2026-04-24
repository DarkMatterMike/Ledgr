/**
 * Analytics.jsx — Overview, Spending, Budget, Insights tabs
 * Owner-only during development.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { getAiInsights } from "./api.js";

// PageLayout and PAGE_RIGHT_COL_W are defined in App.jsx — replicate the grid here
const DESKTOP_RIGHT = 340;
const DESKTOP_GAP   = 16;

const fmt   = (n) => n == null ? "$0" : "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits:0, maximumFractionDigits:0 });
const pct   = (n, d) => d === 0 ? 0 : Math.round((n / d) * 100);
const pad   = (n) => String(n).padStart(2, "0");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ── Shared components ────────────────────────────────────────────── */
function Card({ children, style }) {
  return <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"10px 14px", ...style }}>{children}</div>;
}
function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"2px", marginBottom:8 }}>{title}</div>
      {sub && <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{sub}</div>}
    </div>
  );
}
function StatCard({ label, value, sub, subColor, accent }) {
  return (
    <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"14px 16px", borderTop:`3px solid ${accent||"var(--border)"}` }}>
      <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"2px", marginBottom:8 }}>{label}</div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:700, color:"var(--t1)", marginBottom:4 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:subColor||"var(--t3)" }}>{sub}</div>}
    </div>
  );
}
function Tab({ label, active, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      padding:"7px 8px", borderRadius:"var(--radius)", fontSize:12, fontWeight:500,
      cursor:"pointer", border:"1px solid transparent",
      background:active?"var(--cyan)":"transparent",
      color:active?"#000":"var(--t2)", transition:"all 0.15s", whiteSpace:"nowrap",
      textAlign:"center",
      ...style,
    }}>{label}</button>
  );
}

/* ── SVG line chart ───────────────────────────────────────────────── */
function LineChart({ points, height=120, color="var(--cyan)" }) {
  if (!points || points.length < 2) return (
    <div style={{ height, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--t3)", fontSize:12 }}>
      Not enough data yet
    </div>
  );
  const vals  = points.map(p => p.value);
  const min   = Math.min(...vals);
  const max   = Math.max(...vals);
  const range = max - min || 1;
  const W = 500, H = height - 16, p = 8;
  const coords = points.map((pt, i) => ({
    x: p + (i / (points.length - 1)) * (W - p * 2),
    y: p + (1 - (pt.value - min) / range) * H,
    ...pt,
  }));
  const pathD = coords.map((c, i) => `${i===0?"M":"L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${coords[coords.length-1].x.toFixed(1)} ${(H+p).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(H+p).toFixed(1)} Z`;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ overflow:"visible", display:"block" }}>
        <defs>
          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#nwGrad)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (i === 0 || i === coords.length-1) && (
          <circle key={i} cx={c.x} cy={c.y} r={4} fill={color} />
        ))}
      </svg>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--t3)", marginTop:4 }}>
        <span>{points[0]?.label}</span>
        <span>{points[points.length-1]?.label}</span>
      </div>
    </div>
  );
}

/* ── Budget adherence cell ────────────────────────────────────────── */
function AdherenceCell({ spent, limit, label }) {
  if (!limit) return <div style={{ width:24, height:24, background:"var(--surface)", borderRadius:3 }} />;
  const ratio = spent / limit;
  const color = ratio > 1 ? "var(--red)" : ratio > 0.85 ? "var(--amber)" : spent > 0 ? "var(--green)" : "var(--surface)";
  const opacity = clamp(0.25 + ratio * 0.75, 0.25, 1);
  return (
    <div title={label} style={{ width:24, height:24, borderRadius:3, background:color, opacity,
      display:"flex", alignItems:"center", justifyContent:"center", cursor:"default" }}>
      {ratio > 1 && <span style={{ fontSize:8, color:"#fff", fontWeight:800, lineHeight:1 }}>!</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════ */
export default function Analytics({ transactions, categories, accounts, catMap, isMobile, hasApiKey, userProfile, aiInsights, onSetAiInsights, todos = [], onTodosChange, goals = [], onSaveGoal, onDeleteGoal, onMarkRecurring, defaultTab = "overview" }) {
  const TABS = ["overview","spending","budget","insights","goals"];
  const [tab, setTab] = useState(defaultTab);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState(null);
  const [userCorrections, setUserCorrections] = useState("");
  const [dismissedRecurring, setDismissedRecurring] = useState(new Set());
  const [goalForm, setGoalForm]   = useState(null); // null = closed, {} = new, {id,...} = edit
  const touchStartX = useRef(null);
  useEffect(() => { if (defaultTab && TABS.includes(defaultTab)) setTab(defaultTab); }, [defaultTab]);
  const today = new Date();

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    const idx = TABS.indexOf(tab);
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1]);
    if (dx > 0 && idx > 0)               setTab(TABS[idx - 1]);
  }

  /* ── 12-month data ─────────────────────────────────────────────── */
  const monthlyData = useMemo(() => {
    // Build from the earliest transaction date, not just 12 months
    const dates = transactions.map(t => t.date).filter(Boolean).sort();
    const earliest = dates[0] ? new Date(dates[0] + "T12:00:00") : new Date(today.getFullYear(), today.getMonth() - 11, 1);
    const map = {};
    let cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end   = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor <= end) {
      const ym = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;
      map[ym]  = { ym, label: cursor.toLocaleDateString("en-US", { month:"short", year:"2-digit" }), income:0, spending:0, byCategory:{}, txnCount:0 };
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    transactions.forEach(t => {
      if (!t.date) return;
      const ym = t.date.slice(0, 7);
      if (!map[ym]) return;
      const isNonExpense = ["transfer","income","reimbursement"].includes(t.type);
      if (t.amount > 0 && (t.type === "income" || !t.type)) map[ym].income += t.amount;
      if (t.amount < 0 && !isNonExpense) {
        map[ym].spending += Math.abs(t.amount);
        map[ym].txnCount++;
        if (t.categoryId) map[ym].byCategory[t.categoryId] = (map[ym].byCategory[t.categoryId] || 0) + Math.abs(t.amount);
      }
    });
    return Object.values(map);
  }, [transactions]);

  const last6      = monthlyData.slice(-6);
  const thisMonthD = monthlyData[monthlyData.length - 1];
  const lastMonthD = monthlyData[monthlyData.length - 2];

  /* ── Metrics ───────────────────────────────────────────────────── */
  const monthlyIncome  = userProfile?.monthlyIncome || 0;
  const avgSpendMonths = monthlyData.filter(m => m.spending > 0);
  const avgSpending    = avgSpendMonths.length ? avgSpendMonths.reduce((s, m) => s + m.spending, 0) / avgSpendMonths.length : 0;
  const avgIncome      = monthlyIncome > 0 ? monthlyIncome : monthlyData.filter(m => m.income > 0).reduce((s, m) => s + m.income, 0) / (monthlyData.filter(m => m.income > 0).length || 1);
  const savingsRate    = avgIncome > 0 ? Math.round(((avgIncome - avgSpending) / avgIncome) * 100) : null;
  const momChange      = lastMonthD?.spending > 0 ? Math.round(((thisMonthD.spending - lastMonthD.spending) / lastMonthD.spending) * 100) : null;
  const totalBudget    = categories.reduce((s, c) => s + (c.limit || 0), 0);
  const dayOfMonth     = today.getDate();
  const daysInMonth_   = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const projectedSpend = thisMonthD?.spending * (daysInMonth_ / dayOfMonth);
  const velocityPct    = totalBudget > 0 ? pct(projectedSpend, totalBudget) : null;

  /* ── Net worth ─────────────────────────────────────────────────── */
  const currentNetWorth = useMemo(() => {
    const bank  = accounts.filter(a => a.balance != null).reduce((s, a) => s + a.balance, 0);
    const mAssets = (userProfile?.manualAssets || []).reduce((s, a) => s + (a.value || 0), 0);
    const mLiabs  = (userProfile?.manualLiabilities || []).reduce((s, l) => s + (l.value || 0), 0);
    return bank + mAssets - mLiabs;
  }, [accounts, userProfile]);

  const netWorthSeries = useMemo(() => {
    return monthlyData.map((m, i) => {
      const futureCashFlow = monthlyData.slice(i + 1).reduce((s, mo) => s + (mo.income - mo.spending), 0);
      return { label: m.label, value: Math.round(currentNetWorth - futureCashFlow) };
    });
  }, [monthlyData, currentNetWorth]);

  /* ── Retirement ────────────────────────────────────────────────── */
  const retirementProjection = useMemo(() => {
    const retAge    = userProfile?.targets?.retirementAge || 65;
    const retTarget = userProfile?.targets?.retirementTargetAmount || 0;
    const monthlySv = avgIncome - avgSpending;
    const years     = Math.max(0, retAge - (userProfile?.age || 35));
    const rate      = 0.07 / 12;
    const months    = years * 12;
    const fv = monthlySv > 0 && months > 0
      ? monthlySv * ((Math.pow(1 + rate, months) - 1) / rate) + currentNetWorth * Math.pow(1.07, years)
      : currentNetWorth;
    return { fv: Math.round(fv), target: retTarget, years, monthlySavings: monthlySv };
  }, [avgIncome, avgSpending, currentNetWorth, userProfile]);

  /* ── Subscriptions ─────────────────────────────────────────────── */
  const subscriptions = useMemo(() => {
    const seen = {};
    transactions.filter(t => t.recurring && t.amount < 0).forEach(t => {
      const key = (t.merchant || t.name || "").toLowerCase();
      if (!seen[key]) seen[key] = { name: t.merchant || t.name || key, amount: Math.abs(t.amount) };
    });
    return Object.values(seen).sort((a, b) => b.amount - a.amount);
  }, [transactions]);
  const subscriptionTotal = subscriptions.reduce((s, r) => s + r.amount, 0);

  /* ── Budget grid ───────────────────────────────────────────────── */
  const budgetGrid = useMemo(() => {
    return categories.map(cat => {
      const months = monthlyData.map(m => ({ label:m.label, ym:m.ym, spent: m.byCategory[cat.id]||0, limit: cat.limit||0 }));
      const overMs = months.filter(m => m.spent > m.limit && m.limit > 0).length;
      const allMs  = months.filter(m => m.limit > 0).length;
      let streak = 0;
      for (let i = months.length - 1; i >= 0; i--) {
        if (months[i].spent > months[i].limit && months[i].limit > 0) streak++;
        else break;
      }
      const avgSp = months.filter(m => m.spent > 0).reduce((s, m) => s + m.spent, 0) / (months.filter(m => m.spent > 0).length || 1);
      return { cat, months, overMs, allMs, streak, avgSp };
    }).filter(r => r.months.some(m => m.spent > 0));
  }, [categories, monthlyData]);

  const efficiencyScore = useMemo(() => {
    const sc = budgetGrid.filter(r => r.allMs > 0);
    if (!sc.length) return null;
    return Math.round(sc.reduce((s, r) => s + (1 - r.overMs / r.allMs), 0) / sc.length * 100);
  }, [budgetGrid]);

  /* ── Merchant + DoW + cat trends ──────────────────────────────── */
  const merchantTotals = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      if (t.amount >= 0) return;
      const key = (t.merchant || t.name || "Unknown").trim();
      if (!map[key]) map[key] = { name:key, total:0, count:0 };
      map[key].total += Math.abs(t.amount); map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [transactions]);

  const dowData = useMemo(() => {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const totals = Array(7).fill(0);
    transactions.forEach(t => {
      if (t.amount >= 0 || !t.date) return;
      totals[new Date(t.date + "T12:00:00").getDay()] += Math.abs(t.amount);
    });
    return days.map((d, i) => ({ day:d, total:totals[i] }));
  }, [transactions]);
  const dowMax = Math.max(...dowData.map(d => d.total), 1);

  const catTrends = useMemo(() => {
    const last3 = monthlyData.slice(-3);
    return categories.map(c => {
      const monthly = last3.map(m => m.byCategory[c.id] || 0);
      return { ...c, monthly, avg: monthly.reduce((s,v) => s+v,0)/3, trend: monthly[2]-monthly[1] };
    }).filter(c => c.avg > 0).sort((a,b) => b.avg - a.avg).slice(0,8);
  }, [categories, monthlyData]);

  const last3Labels  = monthlyData.slice(-3).map(m => m.label);
  const cashMax      = Math.max(...last6.map(m => Math.max(m.income, m.spending)), 1);
  const biggestTxns  = useMemo(() => [...transactions].filter(t => t.amount < 0).sort((a,b) => a.amount-b.amount).slice(0,5), [transactions]);

  /* ── Extra analytics ──────────────────────────────────────────── */
  const avgDailySpend = useMemo(() => {
    const days = today.getDate();
    return days > 0 ? Math.round((thisMonthD?.spending || 0) / days) : 0;
  }, [thisMonthD]);

  const spendingFreeDays = useMemo(() => {
    const thisMonthStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
    const daysWithSpend = new Set(
      transactions.filter(t => t.date?.startsWith(thisMonthStr) && t.amount < 0).map(t => t.date)
    );
    return today.getDate() - daysWithSpend.size;
  }, [transactions]);

  const topSpendingDay = useMemo(() => {
    const byDay = {};
    transactions.forEach(t => { if (t.amount < 0 && t.date) byDay[t.date] = (byDay[t.date]||0) + Math.abs(t.amount); });
    const top = Object.entries(byDay).sort((a,b) => b[1]-a[1])[0];
    return top ? { date: top[0], total: top[1] } : null;
  }, [transactions]);

  const catAcceleration = useMemo(() => {
    const cur  = monthlyData[monthlyData.length - 1]?.byCategory || {};
    const prev = monthlyData[monthlyData.length - 2]?.byCategory || {};
    return categories.map(c => ({
      ...c, curSpend: cur[c.id]||0, prevSpend: prev[c.id]||0,
      delta: (cur[c.id]||0) - (prev[c.id]||0),
    })).filter(c => c.curSpend > 0 || c.prevSpend > 0)
      .sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0,8);
  }, [categories, monthlyData]);

  const incomeSources = useMemo(() => {
    const map = {};
    transactions.filter(t => t.amount > 0 && (t.type==="income"||!t.type)).forEach(t => {
      const key = (t.merchant||t.name||"Unknown").trim();
      if (!map[key]) map[key] = { name:key, total:0, count:0 };
      map[key].total += t.amount; map[key].count++;
    });
    return Object.values(map).sort((a,b) => b.total-a.total).slice(0,6);
  }, [transactions]);

  const monthlySavings = useMemo(() =>
    last6.map(m => ({ label: m.label, value: Math.round(m.income - m.spending) }))
  , [last6]);

  /* ── Financial Health Score ──────────────────────────────────────── */
  const healthScore = useMemo(() => {
    let score = 0;
    const breakdown = [];

    // 1. Budget adherence (0-30 pts)
    if (categories.length > 0 && thisMonthD) {
      const catScores = categories.map(cat => {
        const spent = thisMonthD.byCategory[cat.id] || 0;
        if (!cat.limit) return null;
        return spent <= cat.limit ? 1 : Math.max(0, 1 - ((spent - cat.limit) / cat.limit));
      }).filter(s => s !== null);
      const pts = catScores.length ? Math.round((catScores.reduce((a,b)=>a+b,0)/catScores.length)*30) : 15;
      score += pts;
      breakdown.push({ label:"Budget Adherence", pts, max:30, icon:"📊" });
    } else {
      score += 15;
      breakdown.push({ label:"Budget Adherence", pts:15, max:30, icon:"📊", note:"Set budgets to improve" });
    }

    // 2. Savings rate (0-25 pts)
    if (savingsRate !== null) {
      const pts = savingsRate >= 20 ? 25 : savingsRate >= 10 ? 18 : savingsRate >= 0 ? 10 : 0;
      score += pts;
      breakdown.push({ label:"Savings Rate", pts, max:25, icon:"💰", note:`${savingsRate}% avg` });
    } else {
      score += 12;
      breakdown.push({ label:"Savings Rate", pts:12, max:25, icon:"💰", note:"Add income for accuracy" });
    }

    // 3. Spending trend (0-20 pts)
    if (momChange !== null) {
      const pts = momChange <= -10 ? 20 : momChange <= 0 ? 16 : momChange <= 10 ? 10 : momChange <= 20 ? 5 : 0;
      score += pts;
      breakdown.push({ label:"Spending Trend", pts, max:20, icon:"📈", note:`${momChange > 0 ? "+" : ""}${momChange}% vs last month` });
    } else {
      score += 10;
      breakdown.push({ label:"Spending Trend", pts:10, max:20, icon:"📈" });
    }

    // 4. Goal progress (0-15 pts)
    if (goals.length > 0) {
      const avgGoal = goals.map(g => g.targetAmount > 0 ? Math.min((g.savedAmount||0)/g.targetAmount, 1) : 0).reduce((a,b)=>a+b,0) / goals.length;
      const pts = Math.round(avgGoal * 15);
      score += pts;
      breakdown.push({ label:"Goal Progress", pts, max:15, icon:"🎯", note:`${goals.length} active goal${goals.length!==1?"s":""}` });
    } else {
      breakdown.push({ label:"Goal Progress", pts:0, max:15, icon:"🎯", note:"Set savings goals" });
    }

    // 5. Cash flow (0-10 pts)
    const posMonths = last6.filter(m => m.income > 0 && m.income >= m.spending).length;
    const cashPts = Math.round((posMonths / Math.max(last6.length, 1)) * 10);
    score += cashPts;
    breakdown.push({ label:"Cash Flow", pts:cashPts, max:10, icon:"💳", note:`${posMonths}/${last6.length} months positive` });

    const clamped = Math.min(100, Math.max(0, score));
    const grade = clamped >= 85 ? "A" : clamped >= 70 ? "B" : clamped >= 55 ? "C" : clamped >= 40 ? "D" : "F";
    const label = clamped >= 85 ? "Excellent" : clamped >= 70 ? "Good" : clamped >= 55 ? "Fair" : clamped >= 40 ? "Needs Work" : "Critical";
    const color = clamped >= 85 ? "var(--green)" : clamped >= 70 ? "var(--cyan)" : clamped >= 55 ? "var(--amber)" : "var(--red)";
    return { score:clamped, grade, label, color, breakdown };
  }, [categories, thisMonthD, savingsRate, momChange, goals, last6]);

  /* ── Recurring charge detection ──────────────────────────────────── */
  const detectedRecurring = useMemo(() => {
    const expenses = transactions.filter(t => t.amount < 0 && !["transfer","income","reimbursement"].includes(t.type));
    const byMerchant = {};
    expenses.forEach(t => {
      const key = (t.merchant || t.name || "").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20);
      if (!key) return;
      if (!byMerchant[key]) byMerchant[key] = { name: t.merchant || t.name, txns: [] };
      byMerchant[key].txns.push(t);
    });
    const candidates = [];
    Object.values(byMerchant).forEach(({ name, txns }) => {
      if (txns.length < 2) return;
      if (txns.every(t => t.recurring)) return; // already marked
      txns.sort((a,b) => a.date.localeCompare(b.date));
      const amounts = txns.map(t => Math.abs(t.amount));
      const avgAmt = amounts.reduce((a,b)=>a+b,0)/amounts.length;
      if (!amounts.every(a => Math.abs(a - avgAmt)/Math.max(avgAmt,0.01) < 0.06)) return;
      const dates = txns.map(t => new Date(t.date+"T12:00:00").getTime());
      const intervals = [];
      for (let i=1; i<dates.length; i++) intervals.push(Math.round((dates[i]-dates[i-1])/86400000));
      const avgInterval = intervals.reduce((a,b)=>a+b,0)/intervals.length;
      const near = [7,14,30,90,365].find(r => Math.abs(avgInterval-r) <= 4);
      if (!near) return;
      const freqLabel = near<=7?"Weekly":near<=14?"Bi-weekly":near<=31?"Monthly":near<=91?"Quarterly":"Yearly";
      const cleanName = name.toLowerCase().replace(/[^a-z]/g,"");
      const domainGuess = `${cleanName}.com`;
      candidates.push({ name, amount:avgAmt, freqLabel, domainGuess, txnIds:txns.map(t=>t.id), count:txns.length });
    });
    return candidates.sort((a,b) => b.amount - a.amount);
  }, [transactions]);

  const weekOfMonthData = useMemo(() => {
    const weeks = [0,0,0,0,0];
    transactions.filter(t => t.amount < 0 && t.date).forEach(t => {
      const day = new Date(t.date+"T12:00:00").getDate();
      weeks[Math.min(Math.floor((day-1)/7),4)] += Math.abs(t.amount);
    });
    return ["Wk 1","Wk 2","Wk 3","Wk 4","Wk 5"].map((label,i) => ({ label, total: weeks[i] }));
  }, [transactions]);
  const runAiInsights = useCallback(async () => {
    setAiLoading(true); setAiError(null);
    try {
      // Build last 3 months of actual category spending for Claude to verify against
      const last3Months = monthlyData.slice(-3);
      const catBreakdown = categories.map(c => ({
        name:    c.name,
        limit:   c.limit || 0,
        avg3mo:  Math.round(last3Months.reduce((s, m) => s + (m.byCategory[c.id] || 0), 0) / 3),
        thisMonth: Math.round(last3Months[2]?.byCategory[c.id] || 0),
      })).filter(c => c.avg3mo > 0 || c.limit > 0);

      // Filter subscriptions — exclude likely rent/housing/transfer by category name
      const subscriptionExcludes = ["rent", "housing", "mortgage", "transfer", "paycheck", "salary", "income"];
      const filteredSubscriptions = subscriptions.filter(s => {
        const name = s.name.toLowerCase();
        return !subscriptionExcludes.some(ex => name.includes(ex));
      });

      const context = {
        avgMonthlyIncome:        monthlyIncome > 0 ? monthlyIncome : Math.round(avgIncome),
        incomeSource:            monthlyIncome > 0 ? "user-provided" : "estimated from transactions (may be inaccurate)",
        avgMonthlySpending:      Math.round(avgSpending),
        savingsRate, momChange,
        currentNetWorth:         Math.round(currentNetWorth),
        projectedRetirement:     Math.round(retirementProjection.fv),
        retirementTarget:        retirementProjection.target,
        yearsToRetire:           retirementProjection.years,
        subscriptionTotal:       Math.round(filteredSubscriptions.reduce((s, r) => s + r.amount, 0)),
        topSubscriptions:        filteredSubscriptions.slice(0, 8).map(s => `${s.name}: $${s.amount}/mo`),
        subscriptionNote:        "Subscriptions exclude likely rent/housing/transfer transactions. Verify against category breakdown below.",
        budgetEfficiency:        efficiencyScore,
        projectedSpendThisMonth: Math.round(projectedSpend),
        totalBudget,
        categoryBreakdown:       catBreakdown,
        consecutiveOverspend:    budgetGrid.filter(r => r.streak >= 2).map(r => ({ name: r.cat.name, streak: r.streak, avgSpend: Math.round(r.avgSp), limit: r.cat.limit })),
        userCorrections:         userCorrections || null,
      };
      const result = await getAiInsights(context);
      if (result.error) throw new Error(result.error);
      onSetAiInsights(result);
    } catch(e) {
      setAiError(e.message === "no_api_key" ? "Add your Claude API key on the Ask AI page." : e.message);
    } finally { setAiLoading(false); }
  }, [avgSpending, avgIncome, savingsRate, momChange, currentNetWorth, retirementProjection, subscriptionTotal, subscriptions, efficiencyScore, projectedSpend, totalBudget, budgetGrid]);

  function addTodo(text) {
    if (!text?.trim()) return;
    if (todos.some(t => t.text === text.trim())) return;
    const next = [...todos, { id: Date.now().toString(), text: text.trim(), addedAt: Date.now() }];
    onTodosChange(next);
  }
  function removeTodo(id) {
    onTodosChange(todos.filter(t => t.id !== id));
  }
  function isTodoAdded(text) {
    return todos.some(t => t.text === text?.trim());
  }

  /* ── Right sidebar content (desktop only) ─────────────────────── */
  const Sidebar = (
    <div style={{ display:"flex", flexDirection:"column", gap:10, position:"sticky", top:16 }}>

      {/* Net worth */}
      <Card>
        <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"2px", marginBottom:8 }}>Net Worth</div>
        <div style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:700, color:"var(--t1)", marginBottom:4 }}>{fmt(currentNetWorth)}</div>
        <LineChart points={netWorthSeries} height={60} />
      </Card>

      {/* Key stats */}
      {[
        { label:"Avg monthly spend",  value:fmt(avgSpending),       color: momChange>0?"var(--red)":"var(--green)",  sub: momChange!=null?`${momChange>0?"+":""}${momChange}% vs last month`:"" },
        { label:"Savings rate",        value:savingsRate!=null?`${savingsRate}%`:"—", color:savingsRate>20?"var(--green)":savingsRate>0?"var(--amber)":"var(--red)", sub: savingsRate>20?"Great shape":savingsRate>0?"Room to improve":"Spending > income" },
        { label:"Subscriptions",       value:fmt(subscriptionTotal), color:"var(--amber)",  sub:`${subscriptions.length} recurring · ${fmt(subscriptionTotal*12)}/yr` },
        { label:"Budget efficiency",   value:efficiencyScore!=null?`${efficiencyScore}%`:"—", color:efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)", sub:efficiencyScore>=80?"Consistently on track":efficiencyScore>=60?"Some overspends":"Needs attention" },
      ].map(s => (
        <Card key={s.label} style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"2px", marginBottom:8 }}>{s.label}</div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, color:s.color, marginBottom:s.sub?2:0 }}>{s.value}</div>
          {s.sub && <div style={{ fontSize:11, color:"var(--t3)" }}>{s.sub}</div>}
        </Card>
      ))}

      {/* Retirement */}
      {retirementProjection.target > 0 && (
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"2px", marginBottom:8 }}>Retirement</div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:11, color:"var(--t3)" }}>Projected</span>
            <span style={{ fontSize:12, fontFamily:"var(--font-mono)", fontWeight:700, color:retirementProjection.fv>=retirementProjection.target?"var(--green)":"var(--amber)" }}>{fmt(retirementProjection.fv)}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:11, color:"var(--t3)" }}>Target</span>
            <span style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--t2)" }}>{fmt(retirementProjection.target)}</span>
          </div>
          <div style={{ height:4, background:"var(--border)", borderRadius:99, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:99, transition:"width 0.5s",
              width:`${Math.min(pct(retirementProjection.fv, retirementProjection.target), 100)}%`,
              background:retirementProjection.fv>=retirementProjection.target?"var(--green)":"var(--cyan)" }} />
          </div>
          <div style={{ fontSize:10, color:"var(--t3)", marginTop:6, textAlign:"right" }}>{retirementProjection.years}y to retire</div>
        </Card>
      )}
    </div>
  );

  /* ── Main tab content ──────────────────────────────────────────── */
  /* ── Overview sub-components ─────────────────────────────────── */
  function SpendingBreakdown({ catTrends }) {
    const totalSpent = catTrends.reduce((s, c) => s + c.avg, 0);
    if (!totalSpent) return <Card><SectionHead title="Spending breakdown" sub="No spending data yet" /></Card>;
    const size = 160, stroke = 16, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
    let offsetAcc = 0;
    return (
      <Card>
        <SectionHead title="Spending breakdown" sub="Avg monthly by category" />
        <div style={{ display:"flex", justifyContent:"center", margin:"6px 0 12px" }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
            {catTrends.slice(0,6).map(c => {
              const frac = c.avg / totalSpent;
              const dash = frac * circ, gap = circ - dash;
              const el = <circle key={c.id} cx={size/2} cy={size/2} r={r} fill="none" stroke={c.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offsetAcc} transform={`rotate(-90 ${size/2} ${size/2})`} />;
              offsetAcc += dash;
              return el;
            })}
            <text x="50%" y="46%" textAnchor="middle" fill="var(--t1)" style={{ fontSize:"11px", fontWeight:700, fontFamily:"var(--font-mono)" }}>{fmt(totalSpent)}</text>
            <text x="50%" y="57%" textAnchor="middle" fill="var(--t3)" style={{ fontSize:"9px" }}>avg/mo</text>
          </svg>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {catTrends.slice(0,5).map(c => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                <span style={{ width:9, height:9, borderRadius:"50%", background:c.color, flexShrink:0 }} />
                <span style={{ fontSize:12, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
              </div>
              <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:700, color:"var(--t1)", flexShrink:0 }}>{fmt(c.avg)}</span>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  function CashFlowBarChart({ last6, cashMax }) {
    return (
      <Card>
        <SectionHead title="Cash flow" sub="Last 6 months · income vs spending" />
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${last6.length},1fr)`, gap:6, alignItems:"end" }}>
          {last6.map(m => (
            <div key={m.ym} style={{ display:"flex", flexDirection:"column", gap:3 }}>
              <div style={{ display:"flex", gap:2, alignItems:"flex-end", height:100 }}>
                {[{ v:m.income, c:"var(--green)" }, { v:m.spending, c:m.spending>m.income?"var(--red)":"var(--cyan)" }].map(({ v, c }, j) => (
                  <div key={j} style={{ flex:1, display:"flex", alignItems:"flex-end" }}>
                    <div style={{ width:"100%", height:cashMax>0?Math.round((v/cashMax)*100):0, minHeight:v>0?2:0, background:c, borderRadius:"2px 2px 0 0", transition:"height 0.4s" }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize:9, color:"var(--t3)", textAlign:"center", whiteSpace:"nowrap", overflow:"hidden" }}>{isMobile ? m.label.split(" ")[0] : m.label}</div>
              {!isMobile && <div style={{ fontSize:9, fontFamily:"var(--font-mono)", textAlign:"center", color:m.income>=m.spending?"var(--green)":"var(--red)" }}>
                {m.income>=m.spending?"+":"-"}{fmt(Math.abs(m.income-m.spending))}
              </div>}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10, marginTop:8, fontSize:11, color:"var(--t3)" }}>
          {[["var(--green)","Income"],["var(--cyan)","Spending"]].map(([c,l]) => (
            <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:8, height:8, background:c, borderRadius:2 }} />{l}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  function OverspendHighlights({ budgetGrid, fmt }) {
    const overCats = budgetGrid.filter(r => r.streak >= 1 || r.overMs >= 2);
    return (
      <Card>
        <SectionHead title="Overspending highlights" sub="Categories over budget recently" />
        {overCats.length === 0 ? (
          <div style={{ color:"var(--green)", fontSize:13 }}>No categories over budget.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {overCats.slice(0, 5).map(row => (
              <div key={row.cat.id} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"10px 12px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:row.cat.color, flexShrink:0 }} />
                    <span style={{ fontSize:12, fontWeight:600, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.cat.name}</span>
                  </div>
                  {row.streak >= 1 && <span style={{ fontSize:11, color:"var(--red)", fontWeight:600, flexShrink:0 }}>{row.streak}mo streak</span>}
                </div>
                <div style={{ fontSize:11, color:"var(--t3)" }}>Over budget {row.overMs} of {row.allMs} months · avg {fmt(row.avgSp)}/mo vs {fmt(row.cat.limit)} limit</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  /* ── Shared Action Items sidebar (right column on all tabs) ───── */
  const ActionItemsSidebar = (
    <div style={{ position:"sticky", top:16 }}>
      <Card>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <SectionHead title="Action items" sub={todos.length > 0 ? `${todos.length} item${todos.length===1?"":"s"}` : null} />
          {todos.length > 0 && (
            <button onClick={() => onTodosChange([])}
              style={{ fontSize:11, color:"var(--t3)", background:"none", border:"none", cursor:"pointer" }}>
              Clear all
            </button>
          )}
        </div>
        {todos.length === 0 ? (
          <div style={{ fontSize:12, color:"var(--t3)", textAlign:"center", padding:"24px 0", lineHeight:1.6 }}>
            Go to <strong style={{color:"var(--t1)"}}>Insights</strong>, generate AI analysis,<br/>
            then tap <span style={{ color:"var(--cyan)" }}>+ Add to To-Do</span> on any suggestion.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {todos.map(todo => (
              <div key={todo.id} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                <button onClick={() => removeTodo(todo.id)} style={{
                  width:18, height:18, borderRadius:4,
                  border:"1.5px solid var(--border2)", background:"none",
                  cursor:"pointer", flexShrink:0, marginTop:2,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"all 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background="var(--cyan)"; e.currentTarget.style.borderColor="var(--cyan)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.borderColor="var(--border2)"; }}>
                  <span style={{ fontSize:10, color:"var(--cyan)", lineHeight:1 }}>✓</span>
                </button>
                <span style={{ fontSize:12, color:"var(--t2)", lineHeight:1.5, flex:1 }}>{todo.text}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  const MainContent = (
    <div>
      {/* Tab bar — original pill style, auto-width on desktop, full-width on mobile */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:3, background:"var(--surface)", borderRadius:"var(--radius)", padding:4, ...(isMobile ? { width:"100%" } : { display:"inline-flex" }) }}>
          {TABS.map(t => (
            <Tab key={t} label={t.charAt(0).toUpperCase()+t.slice(1)} active={tab===t} onClick={() => setTab(t)} style={isMobile ? { flex:1 } : {}} />
          ))}
        </div>
      </div>
      {/* Swipe dots (mobile only) */}
      {isMobile && (
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:16 }}>
          {TABS.map(t => (
            <div key={t} onClick={() => setTab(t)} style={{
              width: tab===t ? 20 : 6, height:6, borderRadius:3,
              background: tab===t ? "var(--cyan)" : "var(--border2)",
              transition:"all 0.2s", cursor:"pointer",
            }} />
          ))}
        </div>
      )}

      {/* ═══ OVERVIEW ═══════════════════════════════════════════════ */}
      {tab === "overview" && (
        isMobile ? (
          /* Mobile: stacked */
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <Card><SectionHead title="Net worth" sub={`Current: ${fmt(currentNetWorth)}`} /><LineChart points={netWorthSeries} height={90} /></Card>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <StatCard label="Avg monthly spend" value={fmt(avgSpending)}
                sub={momChange!=null?`${momChange>0?"+":""}${momChange}% vs last month`:""} subColor={momChange>0?"var(--red)":"var(--green)"} accent="var(--cyan)" />
              <StatCard label="Savings rate" value={savingsRate!=null?`${savingsRate}%`:"—"}
                sub={savingsRate>20?"Great shape":savingsRate>0?"Room to improve":"Spending > income"}
                subColor={savingsRate>20?"var(--green)":savingsRate>0?"var(--amber)":"var(--red)"}
                accent={savingsRate>20?"var(--green)":savingsRate>0?"var(--amber)":"var(--red)"} />
              <StatCard label="Subscriptions" value={fmt(subscriptionTotal)} sub={`${subscriptions.length} recurring`} accent="var(--amber)" />
              <StatCard label="Budget efficiency" value={efficiencyScore!=null?`${efficiencyScore}%`:"—"}
                sub={efficiencyScore>=80?"On track":efficiencyScore>=60?"Some overspends":"Needs attention"}
                subColor={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"}
                accent={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"} />
            </div>
            <SpendingBreakdown catTrends={catTrends} subscriptions={subscriptions} monthlyData={monthlyData} />
            <CashFlowBarChart last6={last6} cashMax={cashMax} />
            {HealthScoreCard}
          </div>
        ) : (
          /* Desktop: larger left, narrower right — matching PageLayout */
          <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 340px", gap:10, alignItems:"start" }}>
            {/* Column 1 */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {/* Row 1: Net worth */}
              <Card>
                <SectionHead title="Net worth" sub={`Current: ${fmt(currentNetWorth)}`} />
                <LineChart points={netWorthSeries} height={90} />
                {(userProfile?.manualAssets||[]).length > 0 && (
                  <div style={{ fontSize:11, color:"var(--t3)", marginTop:8 }}>
                    Assets: {fmt((userProfile.manualAssets||[]).reduce((s,a)=>s+(a.value||0),0))} · Liabilities: {fmt((userProfile.manualLiabilities||[]).reduce((s,l)=>s+(l.value||0),0))}
                  </div>
                )}
              </Card>
              {/* Row 2: 6 mini stats */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr", gap:10 }}>
                <StatCard label="Avg monthly spend" value={fmt(avgSpending)}
                  sub={momChange!=null?`${momChange>0?"+":""}${momChange}% vs last month`:""} subColor={momChange>0?"var(--red)":"var(--green)"} accent="var(--cyan)" />
                <StatCard label="Savings rate" value={savingsRate!=null?`${savingsRate}%`:"—"}
                  sub={savingsRate>20?"Great shape":savingsRate>0?"Room to improve":"Spending > income"}
                  subColor={savingsRate>20?"var(--green)":savingsRate>0?"var(--amber)":"var(--red)"}
                  accent={savingsRate>20?"var(--green)":savingsRate>0?"var(--amber)":"var(--red)"} />
                <StatCard label="Subscriptions" value={fmt(subscriptionTotal)} sub={`${subscriptions.length} recurring · ${fmt(subscriptionTotal*12)}/yr`} accent="var(--amber)" />
                <StatCard label="Budget efficiency" value={efficiencyScore!=null?`${efficiencyScore}%`:"—"}
                  sub={efficiencyScore>=80?"Consistently on track":efficiencyScore>=60?"Some overspends":"Needs attention"}
                  subColor={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"}
                  accent={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"} />
                <StatCard label="Avg daily spend" value={fmt(avgDailySpend)} sub="This month so far" accent="var(--cyan)" />
                <StatCard label="Spend-free days" value={spendingFreeDays} sub="This month" accent={spendingFreeDays>=10?"var(--green)":spendingFreeDays>=5?"var(--amber)":"var(--red)"} />
              </div>
              {/* Row 3: Spending Breakdown */}
              <SpendingBreakdown catTrends={catTrends} subscriptions={subscriptions} monthlyData={monthlyData} />
              {/* Row 3b: Cash Flow */}
              <CashFlowBarChart last6={last6} cashMax={cashMax} />
              {/* Row 4: Monthly savings trend */}
              <Card>
                <SectionHead title="Monthly savings" sub="Income minus spending, last 6 months" />
                <div style={{ display:"grid", gridTemplateColumns:`repeat(${monthlySavings.length},1fr)`, gap:6, alignItems:"end" }}>
                  {monthlySavings.map(m => {
                    const maxAbs = Math.max(...monthlySavings.map(x => Math.abs(x.value)), 1);
                    const h = Math.round((Math.abs(m.value) / maxAbs) * 80);
                    const positive = m.value >= 0;
                    return (
                      <div key={m.label} style={{ display:"flex", flexDirection:"column", gap:3 }}>
                        <div style={{ display:"flex", justifyContent:"center", height:80, alignItems:"flex-end" }}>
                          <div style={{ width:"60%", height:Math.max(h,2), borderRadius:"3px 3px 0 0",
                            background:positive?"var(--green)":"var(--red)", transition:"height 0.4s" }} />
                        </div>
                        <div style={{ fontSize:9, color:"var(--t3)", textAlign:"center" }}>{m.label}</div>
                        {!isMobile && <div style={{ fontSize:9, fontFamily:"var(--font-mono)", textAlign:"center",
                          color:positive?"var(--green)":"var(--red)", fontWeight:600 }}>
                          {positive?"+":""}{fmt(m.value)}
                        </div>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
              {/* Health Score */}
              {HealthScoreCard}
            </div>
            {/* Column 2: Action items */}
            {ActionItemsSidebar}
          </div>
        )
      )}

      {/* ═══ SPENDING ════════════════════════════════════════════════ */}
      {tab === "spending" && (
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"minmax(0,1fr) 340px", gap:10, alignItems:"start" }}>
          <div style={{ display:"flex", flexDirection:"column", gap: isMobile?16:20 }}>
          <Card>
            <SectionHead title="Top merchants" sub="All time, by total spend" />
            {merchantTotals.map((m, i) => (
              <div key={m.name} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, gap:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--t3)", flexShrink:0, width:16, textAlign:"right" }}>{i+1}</span>
                    <span style={{ fontSize:12, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0 }}>{m.name}</span>
                  </div>
                  <div style={{ display:"flex", gap:10, flexShrink:0 }}>
                    <span style={{ fontSize:11, color:"var(--t3)" }}>{m.count}×</span>
                    <span style={{ fontSize:13, fontFamily:"var(--font-mono)", fontWeight:600, color:"var(--t1)" }}>{fmt(m.total)}</span>
                  </div>
                </div>
                <div style={{ height:3, background:"var(--border)", borderRadius:99, overflow:"hidden", marginLeft:24 }}>
                  <div style={{ height:"100%", width:`${pct(m.total, merchantTotals[0]?.total||1)}%`, background:"var(--cyan)", borderRadius:99, transition:"width 0.5s" }} />
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <SectionHead title="Spending by day of week" sub="Total, all time" />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, alignItems:"end" }}>
              {dowData.map(d => {
                const h = dowMax>0?Math.round((d.total/dowMax)*72):0;
                const isTop = d.total === Math.max(...dowData.map(x=>x.total));
                return (
                  <div key={d.day} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    {!isMobile && <div style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--t3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%", textAlign:"center" }}>{fmt(d.total)}</div>}
                    <div style={{ width:"100%", height:72, display:"flex", alignItems:"flex-end" }}>
                      <div style={{ width:"100%", height:h, minHeight:d.total>0?3:0, background:isTop?"var(--cyan)":"var(--border2)", borderRadius:"3px 3px 0 0", transition:"height 0.4s" }} />
                    </div>
                    <div style={{ fontSize:10, color:isTop?"var(--cyan)":"var(--t3)", fontWeight:isTop?700:400 }}>{d.day.slice(0,3)}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionHead title="Category trends" sub="Last 3 months" />
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {catTrends.map(c => {
                const maxSp = Math.max(...c.monthly, 1);
                return (
                  <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, flexWrap: isMobile?"wrap":"nowrap" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, width: isMobile?"100%":140, flexShrink:0 }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:c.color, flexShrink:0, display:"inline-block" }} />
                      <span style={{ fontSize:12, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                      {c.trend!==0&&<span style={{ fontSize:10, color:c.trend>0?"var(--red)":"var(--green)", flexShrink:0 }}>{c.trend>0?"↑":"↓"}{fmt(Math.abs(c.trend))}</span>}
                    </div>
                    <div style={{ display:"flex", gap:6, flex:1, minWidth:0 }}>
                      {c.monthly.map((spent, i) => (
                        <div key={i} style={{ flex:1 }}>
                          <div style={{ height:32, background:"var(--border)", borderRadius:"var(--radius)", overflow:"hidden", position:"relative" }}>
                            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct(spent,maxSp)}%`, background:c.color+"99", borderRadius:"var(--radius)", transition:"height 0.4s" }} />
                          </div>
                          <div style={{ fontSize:8, color:"var(--t3)", textAlign:"center", marginTop:2, overflow:"hidden" }}>{last3Labels[i]}</div>
                          {!isMobile && <div style={{ fontSize:9, fontFamily:"var(--font-mono)", textAlign:"center", color:"var(--t2)" }}>{fmt(spent)}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Category acceleration */}
          <Card>
            <SectionHead title="Category momentum" sub="Month-over-month change" />
            {catAcceleration.length === 0 ? (
              <div style={{ fontSize:13, color:"var(--t3)" }}>Not enough data yet</div>
            ) : catAcceleration.map(c => {
              const maxDelta = Math.max(...catAcceleration.map(x => Math.abs(x.delta)), 1);
              const barW = Math.round((Math.abs(c.delta) / maxDelta) * 100);
              return (
                <div key={c.id} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ width:7, height:7, borderRadius:"50%", background:c.color, flexShrink:0 }} />
                      <span style={{ fontSize:12, color:"var(--t1)" }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize:12, fontFamily:"var(--font-mono)", fontWeight:600,
                      color:c.delta>0?"var(--red)":c.delta<0?"var(--green)":"var(--t3)" }}>
                      {c.delta>0?"+":""}{fmt(c.delta)}
                    </span>
                  </div>
                  <div style={{ height:3, background:"var(--border)", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${barW}%`,
                      background:c.delta>0?"var(--red)":c.delta<0?"var(--green)":"var(--border2)",
                      borderRadius:99, transition:"width 0.5s" }} />
                  </div>
                  {!isMobile && <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--t3)", marginTop:2 }}>
                    <span>Last: {fmt(c.prevSpend)}</span>
                    <span>Now: {fmt(c.curSpend)}</span>
                  </div>}
                </div>
              );
            })}
          </Card>

          {/* Spending by week of month */}
          <Card>
            <SectionHead title="Spending by week of month" sub="All time, which week you spend most" />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:4, alignItems:"end" }}>
              {weekOfMonthData.map(w => {
                const wMax = Math.max(...weekOfMonthData.map(x=>x.total), 1);
                const h = Math.round((w.total/wMax)*72);
                const isTop = w.total === wMax;
                return (
                  <div key={w.label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    {!isMobile && <div style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--t3)", textAlign:"center" }}>{fmt(w.total)}</div>}
                    <div style={{ width:"100%", height:72, display:"flex", alignItems:"flex-end" }}>
                      <div style={{ width:"100%", height:Math.max(h,2), minHeight:w.total>0?3:0,
                        background:isTop?"var(--cyan)":"var(--border2)", borderRadius:"3px 3px 0 0", transition:"height 0.4s" }} />
                    </div>
                    <div style={{ fontSize:10, color:isTop?"var(--cyan)":"var(--t3)", fontWeight:isTop?700:400 }}>{w.label}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Income sources */}
          {incomeSources.length > 0 && (
            <Card>
              <SectionHead title="Income sources" sub="All time, by total received" />
              {incomeSources.map((s, i) => (
                <div key={s.name} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, gap:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                      <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--t3)", flexShrink:0, width:16, textAlign:"right" }}>{i+1}</span>
                      <span style={{ fontSize:12, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0 }}>{s.name}</span>
                    </div>
                    <div style={{ display:"flex", gap:10, flexShrink:0 }}>
                      <span style={{ fontSize:11, color:"var(--t3)" }}>{s.count}×</span>
                      <span style={{ fontSize:13, fontFamily:"var(--font-mono)", fontWeight:600, color:"var(--green)" }}>{fmt(s.total)}</span>
                    </div>
                  </div>
                  <div style={{ height:3, background:"var(--border)", borderRadius:99, overflow:"hidden", marginLeft:24 }}>
                    <div style={{ height:"100%", width:`${pct(s.total, incomeSources[0]?.total||1)}%`, background:"var(--green)", borderRadius:99, transition:"width 0.5s" }} />
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Top spending day */}
          {topSpendingDay && (
            <Card>
              <SectionHead title="Notable spending days" sub="Largest single day all time" />
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0" }}>
                <div>
                  <div style={{ fontSize:13, color:"var(--t1)", fontWeight:600 }}>{topSpendingDay.date}</div>
                  <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>Highest single-day total</div>
                </div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, color:"var(--red)" }}>{fmt(topSpendingDay.total)}</div>
              </div>
            </Card>
          )}
          </div>
          {!isMobile && ActionItemsSidebar}
        </div>
      )}

      {/* ═══ BUDGET ══════════════════════════════════════════════════ */}
      {tab === "budget" && (
        isMobile ? (
          /* Mobile: stacked */
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <StatCard label="Budget efficiency" value={efficiencyScore!=null?`${efficiencyScore}%`:"—"}
              sub={efficiencyScore>=80?"Consistently on track":efficiencyScore>=60?"Some overspends":"Needs attention"}
              subColor={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"}
              accent={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"} />
            <StatCard label="Spending pace" value={velocityPct!=null?`${velocityPct}%`:"—"}
              sub={`Projected ${fmt(projectedSpend)} vs ${fmt(totalBudget)} budget`}
              subColor={velocityPct>100?"var(--red)":velocityPct>85?"var(--amber)":"var(--green)"}
              accent={velocityPct>100?"var(--red)":velocityPct>85?"var(--amber)":"var(--cyan)"} />
            <StatCard label="Monthly budget" value={fmt(totalBudget)} sub={`${categories.length} categories`} accent="var(--t3)" />
          </div>

          <Card>
            <SectionHead title="12-month budget adherence" sub="Green = under · Amber = 80–100% · Red = over" />
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {budgetGrid.map(row => {
                const score = row.allMs > 0 ? Math.round((1 - row.overMs/row.allMs)*100) : null;
                const scoreColor = row.overMs===0?"var(--green)":row.overMs<=2?"var(--amber)":"var(--red)";
                return (
                  <div key={row.cat.id}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ width:7, height:7, borderRadius:"50%", background:row.cat.color, flexShrink:0, display:"inline-block" }} />
                        <span style={{ fontSize:12, color:"var(--t1)", fontWeight:600 }}>{row.cat.name}</span>
                      </div>
                      {score!=null && <span style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:700, color:scoreColor }}>{score}%</span>}
                    </div>
                    <div style={{ display:"flex", gap:2 }}>
                      {row.months.map(m => {
                        const ratio = m.limit > 0 ? m.spent/m.limit : 0;
                        const color = ratio > 1 ? "var(--red)" : ratio > 0.85 ? "var(--amber)" : m.spent > 0 ? "var(--green)" : "var(--surface)";
                        return (
                          <div key={m.ym} title={`${m.label}: ${fmt(m.spent)}/${fmt(m.limit)}`}
                            style={{ flex:1, height:8, borderRadius:2, background:color,
                              opacity: m.limit > 0 ? clamp(0.3 + ratio*0.7, 0.3, 1) : 0.15 }} />
                        );
                      })}
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:3, fontSize:9, color:"var(--t3)" }}>
                      <span>{monthlyData[0]?.label}</span>
                      <span>{monthlyData[monthlyData.length-1]?.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {budgetGrid.filter(r => r.streak >= 2).length > 0 && (
            <Card style={{ borderLeft:"3px solid var(--red)" }}>
              <SectionHead title="Consecutive overspend" sub="Categories overspent 2+ months in a row" />
              {budgetGrid.filter(r => r.streak >= 2).map(row => (
                <div key={row.cat.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:row.cat.color, flexShrink:0, display:"inline-block" }} />
                  <span style={{ fontSize:13, color:"var(--t1)", flex:1 }}>{row.cat.name}</span>
                  <span style={{ fontSize:12, color:"var(--red)", fontWeight:600 }}>{row.streak} months in a row</span>
                  <span style={{ fontSize:12, color:"var(--t3)" }}>avg {fmt(row.avgSp)}/mo · limit {fmt(row.cat.limit)}</span>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <SectionHead title="Most consistent categories" sub="Stayed under budget most reliably" />
            {[...budgetGrid].sort((a,b) => (b.allMs-b.overMs)-(a.allMs-a.overMs)).slice(0,5).map(row => (
              <div key={row.cat.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:row.cat.color, flexShrink:0, display:"inline-block" }} />
                <span style={{ fontSize:13, color:"var(--t1)", flex:1 }}>{row.cat.name}</span>
                <span style={{ fontSize:12, color:"var(--green)", fontWeight:600 }}>{row.allMs-row.overMs}/{row.allMs} months under</span>
                <span style={{ fontSize:12, color:"var(--t3)" }}>avg {fmt(row.avgSp)}/mo</span>
              </div>
            ))}
          </Card>
          </div>
        ) : (
          /* Desktop: 3-column — col1 heatmap, col2 overspend+consistent, col3 placeholder */
          <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr) 340px", gap:10, alignItems:"start" }}>

            {/* Column 1: stat cards + heatmap */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr", gap:10 }}>
                <StatCard label="Budget efficiency" value={efficiencyScore!=null?`${efficiencyScore}%`:"—"}
                  sub={efficiencyScore>=80?"Consistently on track":efficiencyScore>=60?"Some overspends":"Needs attention"}
                  subColor={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"}
                  accent={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"} />
                <StatCard label="Spending pace" value={velocityPct!=null?`${velocityPct}%`:"—"}
                  sub={`Projected ${fmt(projectedSpend)} vs ${fmt(totalBudget)} budget`}
                  subColor={velocityPct>100?"var(--red)":velocityPct>85?"var(--amber)":"var(--green)"}
                  accent={velocityPct>100?"var(--red)":velocityPct>85?"var(--amber)":"var(--cyan)"} />
                <StatCard label="Monthly budget" value={fmt(totalBudget)} sub={`${categories.length} categories`} accent="var(--t3)" />
              </div>

              <Card>
                <SectionHead title="12-month budget adherence" sub="Green = under · Amber = 80–100% · Red = over" />
                <div style={{ overflowX:"auto" }}>
                  <table style={{ borderCollapse:"collapse", minWidth:480 }}>
                    <thead>
                      <tr>
                        <td style={{ width:120, fontSize:10, color:"var(--t3)", paddingBottom:6, paddingRight:8 }}>Category</td>
                        {monthlyData.map(m => (
                          <td key={m.ym} style={{ fontSize:9, color:"var(--t3)", textAlign:"center", paddingBottom:6, width:26 }}>{m.label}</td>
                        ))}
                        <td style={{ fontSize:10, color:"var(--t3)", paddingBottom:6, paddingLeft:8 }}>Score</td>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetGrid.map(row => (
                        <tr key={row.cat.id}>
                          <td style={{ paddingRight:8, paddingBottom:4 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <span style={{ width:7, height:7, borderRadius:"50%", background:row.cat.color, flexShrink:0, display:"inline-block" }} />
                              <span style={{ fontSize:11, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:100 }}>{row.cat.name}</span>
                            </div>
                          </td>
                          {row.months.map(m => (
                            <td key={m.ym} style={{ padding:"0 1px 4px" }}>
                              <AdherenceCell spent={m.spent} limit={m.limit} label={`${m.label}: ${fmt(m.spent)}/${fmt(m.limit)}`} />
                            </td>
                          ))}
                          <td style={{ paddingLeft:8, paddingBottom:4 }}>
                            <span style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:700,
                              color:row.overMs===0?"var(--green)":row.overMs<=2?"var(--amber)":"var(--red)" }}>
                              {row.allMs>0?`${Math.round((1-row.overMs/row.allMs)*100)}%`:"—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Column 2: consecutive overspend + most consistent */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {budgetGrid.filter(r => r.streak >= 2).length > 0 ? (
                <Card style={{ borderLeft:"3px solid var(--red)" }}>
                  <SectionHead title="Consecutive overspend" sub="Categories overspent 2+ months in a row" />
                  {budgetGrid.filter(r => r.streak >= 2).map(row => (
                    <div key={row.cat.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:row.cat.color, flexShrink:0, display:"inline-block" }} />
                      <span style={{ fontSize:13, color:"var(--t1)", flex:1 }}>{row.cat.name}</span>
                      <span style={{ fontSize:12, color:"var(--red)", fontWeight:600 }}>{row.streak} months in a row</span>
                      <div style={{ width:"100%", fontSize:12, color:"var(--t3)" }}>avg {fmt(row.avgSp)}/mo · limit {fmt(row.cat.limit)}</div>
                    </div>
                  ))}
                </Card>
              ) : (
                <Card style={{ borderLeft:"3px solid var(--green)" }}>
                  <SectionHead title="Consecutive overspend" sub="Categories overspent 2+ months in a row" />
                  <div style={{ color:"var(--green)", fontSize:13 }}>No consecutive overspends — great work.</div>
                </Card>
              )}

              <Card>
                <SectionHead title="Most consistent categories" sub="Stayed under budget most reliably" />
                {[...budgetGrid].sort((a,b) => (b.allMs-b.overMs)-(a.allMs-a.overMs)).slice(0,5).map(row => (
                  <div key={row.cat.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:row.cat.color, flexShrink:0, display:"inline-block" }} />
                    <span style={{ fontSize:13, color:"var(--t1)", flex:1 }}>{row.cat.name}</span>
                    <span style={{ fontSize:12, color:"var(--green)", fontWeight:600 }}>{row.allMs-row.overMs}/{row.allMs} months under</span>
                    <div style={{ width:"100%", fontSize:12, color:"var(--t3)" }}>avg {fmt(row.avgSp)}/mo</div>
                  </div>
                ))}
              </Card>
            </div>

            {/* Column 3: Action items */}
            {ActionItemsSidebar}
          </div>
        )
      )}

      {/* ═══ INSIGHTS ════════════════════════════════════════════════ */}
      {tab === "insights" && (
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"minmax(0,1fr) 340px", gap:10, alignItems:"start" }}>
          <div style={{ display:"flex", flexDirection:"column", gap: isMobile?16:20 }}>

          {/* Health Score shown on Overview tab */}

          {/* ── Detected Recurring Charges ── */}
          {detectedRecurring.filter(r => !dismissedRecurring.has(r.name)).length > 0 && (
            <Card>
              <SectionHead title="Detected recurring charges" sub={`${detectedRecurring.length} unconfirmed — confirm to track on your calendar`} />
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                {detectedRecurring.filter(r => !dismissedRecurring.has(r.name)).slice(0,8).map((r,i) => (
                  <div key={r.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0",
                    borderBottom:i<Math.min(detectedRecurring.length,8)-1?"1px solid var(--border)":"none" }}>
                    {/* Merchant icon */}
                    <div style={{ width:32, height:32, borderRadius:8, background:"var(--surface)",
                      border:"1px solid var(--border2)", flexShrink:0, overflow:"hidden",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${r.domainGuess}&sz=32`}
                        alt=""
                        style={{ width:20, height:20 }}
                        onError={e => { e.target.style.display="none"; e.target.parentNode.innerHTML=`<span style="fontSize:14;color:var(--t3)">💳</span>`; }}
                      />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</div>
                      <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>
                        {r.freqLabel} · {r.count} charges found
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0, marginRight:10 }}>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--red)" }}>{fmt(r.amount)}</div>
                      <div style={{ fontSize:10, color:"var(--t3)" }}>{r.freqLabel.toLowerCase()}</div>
                    </div>
                    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                      <button
                        onClick={() => onMarkRecurring && onMarkRecurring(r.txnIds)}
                        style={{ padding:"4px 10px", borderRadius:"var(--radius)", fontSize:11, fontWeight:600,
                          background:"var(--cyan-dim)", color:"var(--cyan)", border:"1px solid var(--cyan)44",
                          cursor:"pointer", whiteSpace:"nowrap" }}>
                        ✓ Confirm
                      </button>
                      <button
                        onClick={() => setDismissedRecurring(p => new Set([...p, r.name]))}
                        style={{ padding:"4px 8px", borderRadius:"var(--radius)", fontSize:11,
                          background:"none", color:"var(--t3)", border:"1px solid var(--border2)",
                          cursor:"pointer", lineHeight:1 }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Spending velocity */}
          <Card>
            <SectionHead title="This month's spending pace" sub={`Day ${dayOfMonth} of ${daysInMonth_} — projected to end of month`} />
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ height:10, background:"var(--border)", borderRadius:99, overflow:"hidden", marginBottom:8 }}>
                  <div style={{ height:"100%", width:`${Math.min(velocityPct||0,100)}%`,
                    background:velocityPct>100?"var(--red)":velocityPct>85?"var(--amber)":"var(--green)",
                    borderRadius:99, transition:"width 0.5s" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--t3)" }}>
                  <span>Spent: {fmt(thisMonthD?.spending)}</span>
                  <span>Budget: {fmt(totalBudget)}</span>
                </div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:20, fontFamily:"var(--font-mono)", fontWeight:700,
                  color:velocityPct>100?"var(--red)":velocityPct>85?"var(--amber)":"var(--green)" }}>
                  {fmt(projectedSpend)}
                </div>
                <div style={{ fontSize:11, color:"var(--t3)" }}>projected total</div>
              </div>
            </div>
          </Card>

          {/* Chronic overspenders */}
          {(()=>{
            const chronic = budgetGrid.filter(r => r.streak >= 2).sort((a,b) => b.streak - a.streak);
            if (!chronic.length) return null;
            return (
              <Card>
                <SectionHead title="Chronic overspending" sub="Categories over budget 2+ months in a row" />
                {chronic.slice(0,5).map((r, i) => {
                  const avgOver = r.avgSp - r.cat.limit;
                  return (
                    <div key={r.cat.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0",
                      borderBottom:i<Math.min(chronic.length,5)-1?"1px solid var(--border)":"none" }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:r.cat.color, flexShrink:0, display:"inline-block" }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.cat.name}</div>
                        <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>
                          {r.streak} month streak · avg {fmt(r.avgSp)}/mo vs {fmt(r.cat.limit)} limit
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:700, color:"var(--red)" }}>+{fmt(avgOver)}</div>
                        <div style={{ fontSize:10, color:"var(--t3)" }}>avg over</div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            );
          })()}

          {/* Biggest transactions this month */}
          {(()=>{
            const thisYm = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
            const bigTxns = transactions
              .filter(t => t.amount < 0 && t.date?.startsWith(thisYm) && !["transfer","income","reimbursement"].includes(t.type))
              .sort((a,b) => a.amount - b.amount)
              .slice(0,6);
            if (!bigTxns.length) return null;
            const monthTotal = bigTxns.reduce((s,t) => s + Math.abs(t.amount), 0);
            const thisMonthSpending = thisMonthD?.spending || 1;
            return (
              <Card>
                <SectionHead title="Biggest transactions this month" sub={`Top ${bigTxns.length} account for ${Math.round(monthTotal/thisMonthSpending*100)}% of spending`} />
                {bigTxns.map((t, i) => {
                  const cat = catMap[t.categoryId];
                  return (
                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0",
                      borderBottom:i<bigTxns.length-1?"1px solid var(--border)":"none" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name||t.merchant}</div>
                        <div style={{ fontSize:11, color:"var(--t3)", marginTop:1, display:"flex", alignItems:"center", gap:5 }}>
                          <span>{t.date}</span>
                          {cat && <><span>·</span><span style={{ color:cat.color }}>{cat.name}</span></>}
                        </div>
                      </div>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:14, fontWeight:700, color:"var(--red)", flexShrink:0 }}>
                        {fmt(Math.abs(t.amount))}
                      </div>
                    </div>
                  );
                })}
              </Card>
            );
          })()}

          {/* Savings rate trend */}
          {(()=>{
            const months = monthlySavings.filter(m => m.value !== 0);
            if (months.length < 2) return null;
            const maxAbs = Math.max(...months.map(m => Math.abs(m.value)), 1);
            const improving = months.length >= 2 && months[months.length-1].value > months[months.length-2].value;
            const avgSavings = Math.round(months.reduce((s,m) => s+m.value, 0) / months.length);
            return (
              <Card>
                <SectionHead
                  title="Net savings trend"
                  sub={`6-month avg: ${avgSavings >= 0 ? "+" : ""}${fmt(avgSavings)}/mo · ${improving ? "↑ improving" : "↓ declining"}`}
                />
                <div style={{ display:"grid", gridTemplateColumns:`repeat(${months.length},1fr)`, gap:4, alignItems:"end", height:60, marginBottom:6 }}>
                  {months.map((m, i) => {
                    const positive = m.value >= 0;
                    const h = Math.max(Math.round((Math.abs(m.value)/maxAbs)*52), 3);
                    return (
                      <div key={m.label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                        <div style={{ width:"100%", height:52, display:"flex", alignItems: positive?"flex-end":"flex-start" }}>
                          <div style={{ width:"100%", height:h,
                            background: positive ? "var(--green)" : "var(--red)",
                            borderRadius: positive ? "3px 3px 0 0" : "0 0 3px 3px",
                            opacity: i === months.length-1 ? 1 : 0.55,
                            transition:"height 0.4s",
                          }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:`repeat(${months.length},1fr)`, gap:4 }}>
                  {months.map((m, i) => (
                    <div key={m.label} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9, color:"var(--t3)", overflow:"hidden" }}>{m.label.split(" ")[0]}</div>
                      {!isMobile && <div style={{ fontSize:9, fontFamily:"var(--font-mono)", color: m.value>=0?"var(--green)":"var(--red)" }}>
                        {m.value>=0?"+":""}{fmt(m.value)}
                      </div>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          {/* AI Insights */}
          <Card>
            <div style={{ marginBottom:12 }}>
              <SectionHead title="AI Financial Summary" sub="Claude analyzes your full financial picture" />
            </div>

            {/* Corrections + generate button */}
            {hasApiKey && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:"var(--t3)", marginBottom:6, lineHeight:1.5 }}>
                  <span style={{ fontWeight:600, color:"var(--t2)" }}>Corrections</span> — tell Claude anything it might get wrong before generating (e.g. "rent $2,100 is not a subscription", "income is $6,500/mo")
                </div>
                <textarea
                  value={userCorrections}
                  onChange={e => setUserCorrections(e.target.value)}
                  placeholder='e.g. "My rent of $2,100 is not a subscription" · "Income is $6,500/mo after tax"'
                  rows={2}
                  style={{
                    width:"100%", background:"var(--surface)", border:"1px solid var(--border2)",
                    borderRadius:"var(--radius)", padding:"8px 10px", fontSize:12,
                    color:"var(--t1)", resize:"vertical", fontFamily:"var(--font-body)",
                    lineHeight:1.5, outline:"none", boxSizing:"border-box",
                    marginBottom:8,
                  }}
                />
                <button style={{
                  display:"flex", alignItems:"center", justifyContent:"flex-end", gap:6,
                  padding:"8px 14px", borderRadius:"var(--radius)",
                  fontSize:13, fontWeight:500, cursor:aiLoading?"default":"pointer",
                  border:"1px solid transparent", marginLeft:"auto",
                  background:"var(--cyan)", color:"#000",
                  opacity:aiLoading?0.7:1, transition:"all 0.15s",
                }} onClick={!aiLoading?runAiInsights:undefined} disabled={aiLoading}>
                  {aiLoading?"✦ Analyzing…":aiInsights?"✦ Regenerate Insights":"✦ Generate Insights"}
                </button>
              </div>
            )}

            {!hasApiKey && (
              <div style={{ fontSize:13, color:"var(--t3)", textAlign:"center", padding:"24px 0", lineHeight:1.6 }}>
                Add your Claude API key on the Ask AI page to unlock AI-powered insights.
              </div>
            )}
            {aiError && (
              <div style={{ fontSize:13, color:"var(--red)", padding:"10px 14px", background:"var(--red-dim)", borderRadius:"var(--radius)" }}>{aiError}</div>
            )}
            {aiInsights && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, background:"var(--surface)", borderRadius:"var(--radius)", padding:"14px 16px" }}>
                  <div style={{ position:"relative", width:64, height:64, flexShrink:0 }}>
                    <svg viewBox="0 0 64 64" style={{ width:64, height:64, transform:"rotate(-90deg)" }}>
                      <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="6" />
                      <circle cx="32" cy="32" r="28" fill="none"
                        stroke={aiInsights.score>=80?"var(--green)":aiInsights.score>=60?"var(--cyan)":aiInsights.score>=40?"var(--amber)":"var(--red)"}
                        strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={`${(aiInsights.score/100)*175.9} 175.9`} />
                    </svg>
                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:"var(--font-mono)", fontSize:16, fontWeight:800, color:"var(--t1)" }}>{aiInsights.score}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:"var(--t1)", marginBottom:4 }}>{aiInsights.scoreLabel}</div>
                    <div style={{ fontSize:11, color:"var(--t2)", lineHeight:1.5 }}>{aiInsights.headline}</div>
                  </div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {(aiInsights.insights||[]).map((ins, i) => (
                    <div key={i} style={{ padding:"11px 14px", background:"var(--surface)", borderRadius:"var(--radius)",
                      borderLeft:`3px solid ${ins.type==="positive"?"var(--green)":ins.type==="warning"?"var(--amber)":"var(--border)"}` }}>
                      <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                        <span style={{ fontSize:13, flexShrink:0, marginTop:1, color:ins.type==="positive"?"var(--green)":ins.type==="warning"?"var(--amber)":"var(--t3)" }}>
                          {ins.type==="positive"?"✓":ins.type==="warning"?"⚠":"→"}
                        </span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", marginBottom:2 }}>{ins.title}</div>
                          <div style={{ fontSize:12, color:"var(--t2)", lineHeight:1.5 }}>{ins.body}</div>
                          {ins.suggestion && (
                            <div style={{ marginTop:8, background:"var(--card)", borderRadius:"var(--radius)", padding:"8px 10px", border:"1px solid var(--border)" }}>
                              <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                                <span style={{ fontSize:11, color:"var(--cyan)", flexShrink:0, marginTop:1 }}>↗</span>
                                <div style={{ fontSize:11, color:"var(--t2)", lineHeight:1.5, flex:1 }}>{ins.suggestion}</div>
                              </div>
                              <button
                                onClick={() => addTodo(ins.suggestion)}
                                style={{ marginTop:8, fontSize:11, fontWeight:600, cursor:"pointer",
                                  background:"none", border:"none", padding:0,
                                  color: isTodoAdded(ins.suggestion) ? "var(--green)" : "var(--cyan)" }}>
                                {isTodoAdded(ins.suggestion) ? "✓ Added to To-Do" : "+ Add to To-Do"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {aiInsights.recommendation && (
                  <div style={{ background:"var(--cyan-dim)", border:"1px solid var(--cyan)44", borderRadius:"var(--radius)", padding:"12px 14px" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--cyan)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:4 }}>This month's action</div>
                    <div style={{ fontSize:13, color:"var(--t1)", lineHeight:1.5, marginBottom:8 }}>{aiInsights.recommendation}</div>
                    <button
                      onClick={() => addTodo(aiInsights.recommendation)}
                      style={{ fontSize:11, fontWeight:600, cursor:"pointer", background:"none", border:"none", padding:0,
                        color: isTodoAdded(aiInsights.recommendation) ? "var(--green)" : "var(--cyan)" }}>
                      {isTodoAdded(aiInsights.recommendation) ? "✓ Added to To-Do" : "+ Add to To-Do"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {!aiInsights&&!aiLoading&&!aiError&&hasApiKey&&(
              <div style={{ fontSize:13, color:"var(--t3)", textAlign:"center", padding:"24px 0" }}>
                Add any corrections above, then tap Generate Insights.
              </div>
            )}
          </Card>

          {/* To-Do list — mobile: show below AI card */}
          {isMobile && (
            <Card>
              <SectionHead title="Action items" sub={todos.length > 0 ? `${todos.length} item${todos.length===1?"":"s"}` : "Add suggestions from insights above"} />
              {todos.length === 0 ? (
                <div style={{ fontSize:12, color:"var(--t3)", textAlign:"center", padding:"20px 0" }}>
                  Generate insights and tap "+ Add to To-Do" on any suggestion.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {todos.map(todo => (
                    <div key={todo.id} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                      <button onClick={() => removeTodo(todo.id)} style={{
                        width:18, height:18, borderRadius:4, border:"1.5px solid var(--border2)",
                        background:"none", cursor:"pointer", flexShrink:0, marginTop:2,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        <span style={{ fontSize:10, color:"var(--cyan)", lineHeight:1 }}>✓</span>
                      </button>
                      <span style={{ fontSize:12, color:"var(--t2)", lineHeight:1.5, flex:1 }}>{todo.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          </div>
          {!isMobile && ActionItemsSidebar}
        </div>
      )}

      {/* ═══ GOALS ════════════════════════════════════════════════════ */}
      {tab === "goals" && (
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"minmax(0,1fr) 340px", gap:10, alignItems:"start" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {goalForm !== null && (
              <Card style={{ border:"1px solid var(--cyan)44" }}>
                <SectionHead title={goalForm.id ? "Edit goal" : "New goal"} />
                <div style={{ display:"flex", flexDirection:"column", gap:10, minWidth:0, width:"100%" }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>Title</div>
                    <input style={{ width:"100%", maxWidth:"100%", minWidth:0, background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"8px 10px", fontSize:13, color:"var(--t1)", boxSizing:"border-box", fontFamily:"var(--font-body)", outline:"none", display:"block" }}
                      placeholder="e.g. Emergency fund, Vacation, New car" value={goalForm.title||""} onChange={e=>setGoalForm(f=>({...f,title:e.target.value}))} />
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>Target amount</div>
                      <input type="number" min="0" style={{ width:"100%", maxWidth:"100%", minWidth:0, background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"8px 10px", fontSize:13, color:"var(--t1)", boxSizing:"border-box", fontFamily:"var(--font-mono)", outline:"none", display:"block" }}
                        placeholder="0" value={goalForm.targetAmount||""}
                        onChange={e=>setGoalForm(f=>({...f, targetAmount:parseFloat(e.target.value)||0, periodAmount:"" }))} />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>Period</div>
                      <select style={{ width:"100%", maxWidth:"100%", minWidth:0, background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"8px 10px", fontSize:13, color:"var(--t1)", boxSizing:"border-box", display:"block" }}
                        value={goalForm.period||"month"}
                        onChange={e=>setGoalForm(f=>({...f, period:e.target.value, periodAmount:"" }))}>
                        <option value="week">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="month">Monthly</option>
                        <option value="quarter">Quarterly</option>
                        <option value="year">Yearly</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
                    <div style={{ minWidth:0, overflow:"hidden" }}>
                      <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>Start date</div>
                      <input type="date" style={{ width:"100%", maxWidth:"100%", minWidth:0, background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"6px 8px", fontSize:11, color:"var(--t1)", boxSizing:"border-box", outline:"none", display:"block", WebkitAppearance:"none", appearance:"none", overflow:"hidden" }}
                        value={goalForm.startDate||""}
                        onChange={e=>setGoalForm(f=>({...f, startDate:e.target.value, periodAmount:"" }))} />
                    </div>
                    <div style={{ minWidth:0, overflow:"hidden" }}>
                      <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>Deadline (optional)</div>
                      <input type="date" style={{ width:"100%", maxWidth:"100%", minWidth:0, background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"6px 8px", fontSize:11, color:"var(--t1)", boxSizing:"border-box", outline:"none", display:"block", WebkitAppearance:"none", appearance:"none", overflow:"hidden" }}
                        value={goalForm.deadline||""}
                        onChange={e=>setGoalForm(f=>({...f, deadline:e.target.value, periodAmount:"" }))} />
                    </div>
                  </div>

                  {/* Auto-calculated period amount */}
                  {(()=>{
                    const target = goalForm.targetAmount || 0;
                    const start  = goalForm.startDate ? new Date(goalForm.startDate + "T12:00:00") : null;
                    const end    = goalForm.deadline  ? new Date(goalForm.deadline  + "T12:00:00") : null;
                    let suggested = null;
                    let periodsCount = null;
                    let contributionDates = [];

                    if (target > 0 && start && end && end >= start) {
                      // Step backwards from deadline counting dates >= start
                      // This ensures both start and end are counted if they land on period boundaries
                      const periodDays = { week:7, biweekly:14, month:30, quarter:91, year:365 }[goalForm.period||"month"];
                      let d = new Date(end);
                      while (d >= start) {
                        contributionDates.unshift(new Date(d));
                        d = new Date(d.getTime() - periodDays * 86400000);
                      }
                      periodsCount = contributionDates.length;
                      if (periodsCount > 0) suggested = Math.ceil((target / periodsCount) * 100) / 100;
                    }
                    const auto = suggested !== null && !goalForm._periodManual;
                    const firstDate = contributionDates[0];
                    const firstLabel = firstDate ? firstDate.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : null;
                    return (
                      <div>
                        <div style={{ display:"flex", alignItems:isMobile?"flex-start":"center", justifyContent:"space-between", flexWrap:"wrap", gap:4, marginBottom:4 }}>
                          <div style={{ fontSize:11, color:"var(--t3)" }}>Set aside each period</div>
                          {suggested !== null && (
                            <div style={{ fontSize:10, color:auto?"var(--cyan)":"var(--t3)" }}>
                              {periodsCount} contribution{periodsCount!==1?"s":""} · auto-calculated
                              {!auto && <button onClick={()=>setGoalForm(f=>({...f, periodAmount:suggested, _periodManual:false }))}
                                style={{ marginLeft:6, fontSize:10, color:"var(--cyan)", background:"none", border:"none", cursor:"pointer", padding:0, textDecoration:"underline" }}>
                                Reset
                              </button>}
                            </div>
                          )}
                        </div>
                        <input type="number" min="0" step="0.01"
                          style={{ width:"100%", maxWidth:"100%", minWidth:0, background:"var(--surface)", border:`1px solid ${auto?"var(--cyan)44":"var(--border2)"}`, borderRadius:"var(--radius)", padding:"8px 10px", fontSize:13, color:"var(--t1)", boxSizing:"border-box", fontFamily:"var(--font-mono)", outline:"none", display:"block" }}
                          placeholder={suggested !== null ? `${suggested.toFixed(2)} (suggested)` : "0"}
                          value={auto ? suggested.toString() : (goalForm.periodAmount||"")}
                          onChange={e=>setGoalForm(f=>({...f, periodAmount:parseFloat(e.target.value)||0, _periodManual:true }))}
                        />
                        {firstLabel && auto && (
                          <div style={{ fontSize:10, color:"var(--t3)", marginTop:4 }}>
                            First contribution: <span style={{ color:"var(--cyan)" }}>{firstLabel}</span>
                            {periodsCount > 1 && ` · then every ${goalForm.period==="biweekly"?"2 weeks":goalForm.period||"month"}`}
                          </div>
                        )}
                        {suggested !== null && goalForm._periodManual && goalForm.periodAmount > 0 && (
                          <div style={{ fontSize:10, color:"var(--t3)", marginTop:3 }}>
                            Suggested {fmt(suggested)}/period · your total: {fmt(goalForm.periodAmount * periodsCount)} over {periodsCount} contributions
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:4, flexWrap:"wrap" }}>
                    <button onClick={()=>setGoalForm(null)} style={{ padding:"8px 14px", borderRadius:"var(--radius)", border:"1px solid var(--border2)", background:"none", color:"var(--t2)", fontSize:13, cursor:"pointer", flex:isMobile?"1":"none" }}>Cancel</button>
                    <button disabled={!goalForm.title?.trim()||!goalForm.targetAmount}
                      onClick={()=>{
                        // Resolve periodAmount using same backwards enumeration
                        const target = goalForm.targetAmount || 0;
                        const start  = goalForm.startDate ? new Date(goalForm.startDate + "T12:00:00") : null;
                        const end    = goalForm.deadline  ? new Date(goalForm.deadline  + "T12:00:00") : null;
                        let resolvedAmount = goalForm.periodAmount || 0;
                        if (!goalForm._periodManual && target > 0 && start && end && end >= start) {
                          const periodDays = { week:7, biweekly:14, month:30, quarter:91, year:365 }[goalForm.period||"month"];
                          let count = 0, d = new Date(end);
                          while (d >= start) { count++; d = new Date(d.getTime() - periodDays * 86400000); }
                          if (count > 0) resolvedAmount = Math.ceil((target / count) * 100) / 100;
                        }
                        onSaveGoal({ ...goalForm, periodAmount: resolvedAmount });
                        setGoalForm(null);
                      }}
                      style={{ padding:"8px 16px", borderRadius:"var(--radius)", border:"none", background:"var(--cyan)", color:"#000", fontSize:13, fontWeight:600, cursor:"pointer", opacity:(!goalForm.title?.trim()||!goalForm.targetAmount)?0.5:1, flex:isMobile?"1":"none" }}>
                      {goalForm.id ? "Save changes" : "Create goal"}
                    </button>
                  </div>
                </div>
              </Card>
            )}
            {goals.length === 0 && goalForm === null ? (
              <Card>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 0", gap:10 }}>
                  <span style={{ fontSize:36, opacity:0.3 }}>🎯</span>
                  <div style={{ fontSize:15, fontWeight:600, color:"var(--t1)" }}>No goals yet</div>
                  <div style={{ fontSize:13, color:"var(--t3)", textAlign:"center", maxWidth:280 }}>Create a savings goal to track progress and assign transactions toward it.</div>
                  <button onClick={()=>setGoalForm({title:"",targetAmount:0,startDate:"",deadline:"",periodAmount:"",period:"month",_periodManual:false})}
                    style={{ padding:"10px 20px", borderRadius:"var(--radius)", border:"none", background:"var(--cyan)", color:"#000", fontSize:13, fontWeight:600, cursor:"pointer", marginTop:4 }}>
                    + Create first goal
                  </button>
                </div>
              </Card>
            ) : goals.map(g => {
              const pct = g.targetAmount > 0 ? Math.min(Math.round((g.savedAmount||0)/g.targetAmount*100),100) : 0;
              const deadline = g.deadline ? new Date(g.deadline + "T12:00:00") : null;
              const daysLeft = deadline ? Math.ceil((deadline.getTime()-Date.now())/86400000) : null;
              const barColor = pct>=100?"var(--green)":pct>=60?"var(--cyan)":pct>=30?"var(--amber)":"var(--red)";
              const assignedTxns = transactions.filter(t=>(g.assignedTxnIds||[]).includes(t.id));
              return (
                <Card key={g.id}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12, gap:10 }}>
                    <div>
                      <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)", marginBottom:2 }}>{g.title}</div>
                      <div style={{ fontSize:12, color:"var(--t3)" }}>
                        {g.periodAmount>0 && <span>{fmt(g.periodAmount)} / {g.period||"month"}</span>}
                        {deadline && <span style={{ marginLeft:8 }}>· due {deadline.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
                        {daysLeft!=null && daysLeft>0 && <span style={{ color:daysLeft<30?"var(--amber)":"var(--t3)", marginLeft:4 }}>({daysLeft}d left)</span>}
                        {daysLeft!=null && daysLeft<=0 && <span style={{ color:"var(--red)", marginLeft:4 }}>(past deadline)</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button onClick={()=>setGoalForm({...g})} style={{ padding:"5px 10px", borderRadius:"var(--radius)", border:"1px solid var(--border2)", background:"none", color:"var(--t2)", fontSize:11, cursor:"pointer" }}>Edit</button>
                      <button onClick={()=>onDeleteGoal(g.id)} style={{ padding:"5px 8px", borderRadius:"var(--radius)", border:"none", background:"none", color:"var(--t3)", fontSize:14, cursor:"pointer" }}>✕</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:12 }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontWeight:700, color:barColor }}>{fmt(g.savedAmount||0)} saved</span>
                    <span style={{ color:"var(--t3)" }}>of {fmt(g.targetAmount)}</span>
                  </div>
                  <div style={{ height:8, background:"var(--border)", borderRadius:99, overflow:"hidden", marginBottom:6 }}>
                    <div style={{ height:"100%", borderRadius:99, width:`${pct}%`, background:barColor, transition:"width 0.5s" }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--t3)", marginBottom:assignedTxns.length>0?12:0 }}>
                    <span>{pct}% complete</span>
                    {pct<100 && <span>{fmt((g.targetAmount||0)-(g.savedAmount||0))} remaining</span>}
                    {pct>=100 && <span style={{ color:"var(--green)", fontWeight:600 }}>Goal reached!</span>}
                  </div>
                  {assignedTxns.length > 0 && (
                    <div style={{ borderTop:"1px solid var(--border)", paddingTop:10 }}>
                      <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>Assigned transactions</div>
                      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {assignedTxns.slice(0,5).map(t=>(
                          <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                            <span style={{ color:"var(--t3)", flexShrink:0, width:68, fontFamily:"var(--font-mono)", fontSize:11 }}>{t.date}</span>
                            <span style={{ flex:1, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name||t.merchant}</span>
                            <span style={{ fontFamily:"var(--font-mono)", color:"var(--green)", fontWeight:600, flexShrink:0 }}>{fmt(Math.abs(t.amount))}</span>
                          </div>
                        ))}
                        {assignedTxns.length>5 && <div style={{ fontSize:11, color:"var(--t3)" }}>+{assignedTxns.length-5} more</div>}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          {!isMobile && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, position:"sticky", top:16 }}>
              {goals.length > 0 && (
                <Card style={{ padding:"14px 16px" }}>
                  <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>Summary</div>
                  {[
                    { label:"Total goals",  value:goals.length },
                    { label:"Total saved",  value:fmt(goals.reduce((s,g)=>s+(g.savedAmount||0),0)) },
                    { label:"Total target", value:fmt(goals.reduce((s,g)=>s+(g.targetAmount||0),0)) },
                    { label:"Completed",    value:goals.filter(g=>(g.savedAmount||0)>=(g.targetAmount||1)&&g.targetAmount>0).length },
                  ].map(s=>(
                    <div key={s.label} style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:12 }}>
                      <span style={{ color:"var(--t3)" }}>{s.label}</span>
                      <span style={{ fontFamily:"var(--font-mono)", fontWeight:600, color:"var(--t1)" }}>{s.value}</span>
                    </div>
                  ))}
                </Card>
              )}
              <Card style={{ padding:"14px 16px" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--t2)", marginBottom:6 }}>How progress is tracked</div>
                <div style={{ fontSize:12, color:"var(--t3)", lineHeight:1.6 }}>When you transfer to savings, find that transaction and tap ⋯ → Add to goal to count it toward your target.</div>
                {goalForm === null && (
                  <button onClick={()=>setGoalForm({title:"",targetAmount:0,startDate:"",deadline:"",periodAmount:"",period:"month",_periodManual:false})}
                    style={{ width:"100%", marginTop:12, padding:"9px", borderRadius:"var(--radius)", border:"none", background:"var(--cyan)", color:"#000", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                    + New goal
                  </button>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ── Two-column layout on desktop, single on mobile ─────────────── */
  const HealthScoreCard = (
    <Card>
      <SectionHead title="Financial Health Score" />
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
        {/* Gauge — front and center */}
        {(()=>{
          const r=68,cx=80,cy=80,stroke=12;
          const circ=2*Math.PI*r;
          const filled=circ*(healthScore.score/100);
          return (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <svg width={160} height={160} viewBox="0 0 160 160">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={healthScore.color} strokeWidth={stroke}
                  strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ transition:"stroke-dasharray 0.8s ease" }}/>
                <text x={cx} y={cy-10} textAnchor="middle" fill={healthScore.color}
                  style={{ fontSize:36, fontWeight:800, fontFamily:"var(--font-mono)" }}>{healthScore.score}</text>
                <text x={cx} y={cy+16} textAnchor="middle" fill={healthScore.color}
                  style={{ fontSize:15, fontWeight:700, fontFamily:"var(--font-disp)" }}>{healthScore.grade}</text>
                <text x={cx} y={cy+34} textAnchor="middle" fill="var(--t3)"
                  style={{ fontSize:10, fontFamily:"var(--font-body)" }}>{healthScore.label}</text>
              </svg>
            </div>
          );
        })()}
        {/* Breakdown bars */}
        <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:10 }}>
          {healthScore.breakdown.map(item => (
            <div key={item.label}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:11, color:"var(--t2)", display:"flex", alignItems:"center", gap:6 }}>
                  <span>{item.icon}</span>
                  <span style={{ fontWeight:500 }}>{item.label}</span>
                  {item.note && <span style={{ color:"var(--t3)", fontSize:10 }}>· {item.note}</span>}
                </span>
                <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--t2)", fontWeight:600 }}>{item.pts}/{item.max}</span>
              </div>
              <div style={{ height:5, background:"var(--border)", borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:99,
                  width:`${(item.pts/item.max)*100}%`,
                  background: item.pts/item.max>=0.8?"var(--green)":item.pts/item.max>=0.5?"var(--cyan)":item.pts/item.max>=0.3?"var(--amber)":"var(--red)",
                  transition:"width 0.6s ease" }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );

  return (
    <div style={{ width:"100%" }}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}>

      {/* Page title */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontFamily:"var(--font-disp)", fontSize:17, fontWeight:700, letterSpacing:"-0.5px", color:"var(--t1)", lineHeight:1 }}>Analytics</div>
        <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>{transactions.filter(t => t.amount < 0).length} transactions · {monthlyData.filter(m => m.spending > 0).length} months of data</div>
      </div>

      {isMobile ? (
        <div style={{ width:"100%", overflowX:"hidden" }}>{MainContent}</div>
      ) : (
        <div style={{ width:"100%" }}>{MainContent}</div>
      )}
    </div>
  );
}
