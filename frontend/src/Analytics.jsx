/**
 * Analytics.jsx — Overview, Spending, Budget, Insights tabs
 * Owner-only during development.
 */

import { useState, useMemo, useCallback, useRef } from "react";

// PageLayout and PAGE_RIGHT_COL_W are defined in App.jsx — replicate the grid here
const DESKTOP_RIGHT = 340;
const DESKTOP_GAP   = 16;

const fmt   = (n) => n == null ? "$0" : "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits:0, maximumFractionDigits:0 });
const pct   = (n, d) => d === 0 ? 0 : Math.round((n / d) * 100);
const pad   = (n) => String(n).padStart(2, "0");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BASE  = "https://ledgr-production-9e35.up.railway.app";
function authHeaders() {
  const token = localStorage.getItem("ledgr_token") || "";
  return { "Content-Type":"application/json", ...(token ? { Authorization:`Bearer ${token}` } : {}) };
}

/* ── Shared components ────────────────────────────────────────────── */
function Card({ children, style }) {
  return <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:16, ...style }}>{children}</div>;
}
function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)" }}>{title}</div>
      {sub && <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{sub}</div>}
    </div>
  );
}
function StatCard({ label, value, sub, subColor, accent }) {
  return (
    <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"14px 16px", borderTop:`3px solid ${accent||"var(--border)"}` }}>
      <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:6 }}>{label}</div>
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
export default function Analytics({ transactions, categories, accounts, catMap, isMobile, hasApiKey, userProfile, aiInsights, onSetAiInsights }) {
  const TABS = ["overview","spending","budget","insights"];
  const [tab,       setTab]       = useState("overview");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState(null);
  const touchStartX = useRef(null);
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
    const map = {};
    for (let i = 11; i >= 0; i--) {
      const d  = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      map[ym]  = { ym, label: d.toLocaleDateString("en-US", { month:"short", year:"2-digit" }), income:0, spending:0, byCategory:{}, txnCount:0 };
    }
    transactions.forEach(t => {
      if (!t.date) return;
      const ym = t.date.slice(0, 7);
      if (!map[ym]) return;
      if (t.amount > 0 && (t.type === "income" || !t.type)) map[ym].income += t.amount;
      if (t.amount < 0) {
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

  /* ── AI Insights ───────────────────────────────────────────────── */
  const runAiInsights = useCallback(async () => {
    setAiLoading(true); setAiError(null);
    try {
      const context = {
        avgMonthlySpending:  Math.round(avgSpending),
        avgMonthlyIncome:    Math.round(avgIncome),
        savingsRate, momChange,
        currentNetWorth:     Math.round(currentNetWorth),
        projectedRetirement: Math.round(retirementProjection.fv),
        retirementTarget:    retirementProjection.target,
        yearsToRetire:       retirementProjection.years,
        subscriptionTotal:   Math.round(subscriptionTotal),
        topSubscriptions:    subscriptions.slice(0,5).map(s => `${s.name}: $${s.amount}/mo`),
        budgetEfficiency:    efficiencyScore,
        projectedSpendThisMonth: Math.round(projectedSpend),
        totalBudget,
        consecutiveOverspend: budgetGrid.filter(r => r.streak >= 2).map(r => ({ name:r.cat.name, streak:r.streak })),
        topCategories: budgetGrid.slice(0,5).map(r => ({ name:r.cat.name, avgSpend:Math.round(r.avgSp), limit:r.cat.limit, overMs:r.overMs })),
      };

      const prompt = `You are a personal finance advisor. Write a concise honest financial health summary based on this data:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON (no markdown fences) with exactly this shape:
{"headline":"one sentence summary","score":75,"scoreLabel":"Good","insights":[{"type":"positive|warning|neutral","title":"short title","body":"1-2 sentences with specific numbers","suggestion":"one concrete improvement action — omit this field entirely if type is positive"}],"recommendation":"one concrete action for this month"}
Include 3-5 insights. Be specific. Use actual dollar amounts. Only include suggestion for warning/neutral insights.`;

      const res = await fetch(`${BASE}/api/ai/chat`, {
        method:"POST", headers:authHeaders(),
        body:JSON.stringify({ message:prompt, history:[], context:{} }),
      });
      if (!res.ok) throw new Error("Claude request failed");

      const reader = res.body.getReader(); const decoder = new TextDecoder(); let full = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        for (const line of decoder.decode(value, { stream:true }).split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try { full += JSON.parse(line.slice(6)).delta || ""; } catch {}
          }
        }
      }
      onSetAiInsights(JSON.parse(full.replace(/```json|```/g,"").trim()));
    } catch(e) {
      setAiError(e.message.includes("no_api_key") ? "Add your Claude API key on the Ask AI page." : e.message);
    } finally { setAiLoading(false); }
  }, [avgSpending, avgIncome, savingsRate, momChange, currentNetWorth, retirementProjection, subscriptionTotal, subscriptions, efficiencyScore, projectedSpend, totalBudget, budgetGrid]);

  /* ── Right sidebar content (desktop only) ─────────────────────── */
  const Sidebar = (
    <div style={{ display:"flex", flexDirection:"column", gap:12, position:"sticky", top:16 }}>

      {/* Net worth */}
      <Card>
        <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:4 }}>Net Worth</div>
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
          <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:4 }}>{s.label}</div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:18, fontWeight:700, color:s.color, marginBottom:s.sub?2:0 }}>{s.value}</div>
          {s.sub && <div style={{ fontSize:11, color:"var(--t3)" }}>{s.sub}</div>}
        </Card>
      ))}

      {/* Retirement */}
      {retirementProjection.target > 0 && (
        <Card style={{ padding:"12px 14px" }}>
          <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>Retirement</div>
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
              <div style={{ fontSize:9, color:"var(--t3)", textAlign:"center" }}>{m.label}</div>
              <div style={{ fontSize:9, fontFamily:"var(--font-mono)", textAlign:"center", color:m.income>=m.spending?"var(--green)":"var(--red)" }}>
                {m.income>=m.spending?"+":"-"}{fmt(Math.abs(m.income-m.spending))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:12, marginTop:8, fontSize:11, color:"var(--t3)" }}>
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

  const MainContent = (
    <div>
      {/* Tab bar — original pill style, auto-width on desktop, full-width on mobile */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", gap:4, background:"var(--surface)", borderRadius:"var(--radius)", padding:4, ...(isMobile ? { width:"100%" } : { display:"inline-flex" }) }}>
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
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
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
            <OverspendHighlights budgetGrid={budgetGrid} fmt={fmt} />
            <Card><SectionHead title="Largest transactions" sub="All time" />{biggestTxns.map((t,i)=>{const cat=catMap[t.categoryId];return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<biggestTxns.length-1?"1px solid var(--border)":"none"}}><div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",flexShrink:0,width:70}}>{t.date}</div><div style={{flex:1,fontSize:13,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>{cat&&<span style={{fontSize:11,color:cat.color,flexShrink:0}}>{cat.name}</span>}<div style={{fontFamily:"var(--font-mono)",fontSize:14,fontWeight:700,color:"var(--red)",flexShrink:0}}>{fmt(Math.abs(t.amount))}</div></div>);})}</Card>
          </div>
        ) : (
          /* Desktop: larger left, narrower right — matching PageLayout */
          <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 340px", gap:16, alignItems:"start" }}>
            {/* Column 1 */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
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
              {/* Row 2: 4 mini stats */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
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
              </div>
              {/* Row 3: Spending Breakdown */}
              <SpendingBreakdown catTrends={catTrends} subscriptions={subscriptions} monthlyData={monthlyData} />
            </div>
            {/* Column 2 */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <CashFlowBarChart last6={last6} cashMax={cashMax} />
              <OverspendHighlights budgetGrid={budgetGrid} fmt={fmt} />
              <Card>
                <SectionHead title="Largest transactions" sub="All time" />
                {biggestTxns.map((t,i)=>{
                  const cat=catMap[t.categoryId];
                  return(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<biggestTxns.length-1?"1px solid var(--border)":"none"}}>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",flexShrink:0,width:70}}>{t.date}</div>
                      <div style={{flex:1,fontSize:13,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                      {cat&&<span style={{fontSize:11,color:cat.color,flexShrink:0}}>{cat.name}</span>}
                      <div style={{fontFamily:"var(--font-mono)",fontSize:14,fontWeight:700,color:"var(--red)",flexShrink:0}}>{fmt(Math.abs(t.amount))}</div>
                    </div>
                  );
                })}
              </Card>
            </div>
          </div>
        )
      )}

      {/* ═══ SPENDING ════════════════════════════════════════════════ */}
      {tab === "spending" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <Card>
            <SectionHead title="Top merchants" sub="All time, by total spend" />
            {merchantTotals.map((m, i) => (
              <div key={m.name} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3, gap:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                    <span style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--t3)", flexShrink:0, width:16, textAlign:"right" }}>{i+1}</span>
                    <span style={{ fontSize:13, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.name}</span>
                  </div>
                  <div style={{ display:"flex", gap:12, flexShrink:0 }}>
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6, alignItems:"end" }}>
              {dowData.map(d => {
                const h = dowMax>0?Math.round((d.total/dowMax)*80):0;
                const isTop = d.total === Math.max(...dowData.map(x=>x.total));
                return (
                  <div key={d.day} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--t3)" }}>{fmt(d.total)}</div>
                    <div style={{ width:"100%", height:80, display:"flex", alignItems:"flex-end" }}>
                      <div style={{ width:"100%", height:h, minHeight:d.total>0?3:0, background:isTop?"var(--cyan)":"var(--border2)", borderRadius:"3px 3px 0 0", transition:"height 0.4s" }} />
                    </div>
                    <div style={{ fontSize:11, color:isTop?"var(--cyan)":"var(--t3)", fontWeight:isTop?700:400 }}>{d.day}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionHead title="Category trends" sub="Last 3 months" />
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {catTrends.map(c => {
                const maxSp = Math.max(...c.monthly, 1);
                return (
                  <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, flexWrap: isMobile?"wrap":"nowrap" }}>
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
                          <div style={{ fontSize:9, color:"var(--t3)", textAlign:"center", marginTop:2 }}>{last3Labels[i]}</div>
                          <div style={{ fontSize:10, fontFamily:"var(--font-mono)", textAlign:"center", color:"var(--t2)" }}>{fmt(spent)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ BUDGET ══════════════════════════════════════════════════ */}
      {tab === "budget" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(3,1fr)", gap:10 }}>
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
            {isMobile ? (
              /* Mobile: stacked category list with mini bar per month */
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
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
            ) : (
              /* Desktop: full heatmap table */
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
            )}
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
      )}

      {/* ═══ INSIGHTS ════════════════════════════════════════════════ */}
      {tab === "insights" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

          {/* Spending velocity */}
          <Card>
            <SectionHead title="This month's spending pace" sub={`Day ${dayOfMonth} of ${daysInMonth_} — projected to end of month`} />
            <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
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

          {/* Subscriptions */}
          <Card>
            <SectionHead title="Recurring subscriptions"
              sub={`${subscriptions.length} detected · ${fmt(subscriptionTotal)}/mo · ${fmt(subscriptionTotal*12)}/yr`} />
            {subscriptions.length === 0 ? (
              <div style={{ fontSize:13, color:"var(--t3)", textAlign:"center", padding:"24px 0" }}>No recurring transactions detected yet</div>
            ) : subscriptions.map((s, i) => (
              <div key={s.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0",
                borderBottom:i<subscriptions.length-1?"1px solid var(--border)":"none" }}>
                <div style={{ flex:1, fontSize:13, color:"var(--t1)" }}>{s.name}</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:13, fontWeight:600, color:"var(--amber)" }}>{fmt(s.amount)}/mo</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--t3)", width:60, textAlign:"right" }}>{fmt(s.amount*12)}/yr</div>
              </div>
            ))}
          </Card>

          {/* AI Insights */}
          <Card>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, gap:10, flexWrap:"wrap" }}>
              <SectionHead title="AI Financial Summary" sub="Claude analyzes your full financial picture" />
              <button style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"8px 14px", borderRadius:"var(--radius)",
                fontSize:13, fontWeight:500,
                border:"1px solid transparent",
                background:hasApiKey?"var(--cyan)":"var(--surface)",
                color:hasApiKey?"#000":"var(--t3)",
                cursor:hasApiKey&&!aiLoading?"pointer":"default",
                opacity:aiLoading?0.7:1, transition:"all 0.15s",
              }} onClick={hasApiKey&&!aiLoading?runAiInsights:undefined} disabled={!hasApiKey||aiLoading}>
                {aiLoading?"✦ Analyzing…":"✦ Generate Insights"}
              </button>
            </div>

            {!hasApiKey && (
              <div style={{ fontSize:13, color:"var(--t3)", textAlign:"center", padding:"24px 0", lineHeight:1.6 }}>
                Add your Claude API key on the Ask AI page to unlock AI-powered insights.
              </div>
            )}
            {aiError && (
              <div style={{ fontSize:13, color:"var(--red)", padding:"10px 14px", background:"var(--red-dim)", borderRadius:"var(--radius)" }}>{aiError}</div>
            )}
            {aiInsights && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:16, background:"var(--surface)", borderRadius:"var(--radius)", padding:"14px 16px" }}>
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
                    <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.5 }}>{aiInsights.headline}</div>
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
                            <div style={{ marginTop:8, display:"flex", gap:8, alignItems:"flex-start",
                              background:"var(--card)", borderRadius:"var(--radius)", padding:"8px 10px",
                              border:"1px solid var(--border)" }}>
                              <span style={{ fontSize:11, color:"var(--cyan)", flexShrink:0, marginTop:1 }}>↗</span>
                              <div style={{ fontSize:11, color:"var(--t2)", lineHeight:1.5 }}>{ins.suggestion}</div>
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
                    <div style={{ fontSize:13, color:"var(--t1)", lineHeight:1.5 }}>{aiInsights.recommendation}</div>
                  </div>
                )}
              </div>
            )}
            {!aiInsights&&!aiLoading&&!aiError&&hasApiKey&&(
              <div style={{ fontSize:13, color:"var(--t3)", textAlign:"center", padding:"24px 0" }}>
                Click "Generate Insights" for a personalized financial health summary from Claude.
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );

  /* ── Two-column layout on desktop, single on mobile ─────────────── */
  return (
    <div style={{ width:"100%" }}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}>

      {/* Page title */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontFamily:"var(--font-disp)", fontSize: isMobile ? 18 : 22, fontWeight:800, color:"var(--t1)" }}>Analytics</div>
        <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>{transactions.filter(t => t.amount < 0).length} transactions · {monthlyData.filter(m => m.spending > 0).length} months of data</div>
      </div>

      {isMobile ? (
        <div>{MainContent}</div>
      ) : (
        <div style={{ width:"100%" }}>{MainContent}</div>
      )}
    </div>
  );
}
