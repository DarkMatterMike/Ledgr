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
  return <div className="obsidian-card" style={{ background:"var(--card)", borderRadius:"var(--radius)", padding:"10px 14px", ...style }}>{children}</div>;
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
    <div style={{ background:"var(--card)", borderRadius:"var(--radius)", padding:"14px 16px", borderTop:`3px solid ${accent||"var(--border)"}` }}>
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
        <path d={areaD} fill="url(#nwGrad)" className="ledgr-area-fade" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ledgr-path-draw" style={{"--path-len":"2000"}} />
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
   SPENDING PACE CHART
═══════════════════════════════════════════════════════════════════ */
const PACE_RANGES = [
  { key:"last",  label:"Last month" },
  { key:"avg3",  label:"3 mo avg"   },
  { key:"avg6",  label:"6 mo avg"   },
  { key:"avg12", label:"12 mo avg"  },
];

function SpendingPaceCard({ transactions, monthlyData, today, isMobile }) {
  const [range,       setRange]       = useState("last");
  const [pickerOpen,  setPickerOpen]  = useState(false);

  const fmtK = n => n >= 1000 ? "$" + (n/1000).toFixed(1) + "k" : "$" + Math.round(n);

  // Current month cumulative spending by day
  const thisYM   = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();

  const thisMonthPoints = useMemo(() => {
    const byDay = {};
    transactions.forEach(t => {
      if (!t.date?.startsWith(thisYM) || t.amount >= 0) return;
      if (["transfer","income","reimbursement"].includes(t.type)) return;
      const day = parseInt(t.date.slice(8,10), 10);
      byDay[day] = (byDay[day] || 0) + Math.abs(t.amount);
    });
    let cum = 0;
    return Array.from({ length: daysInMonth }, (_, i) => {
      if (i + 1 > today.getDate()) return null; // future days undefined
      cum += byDay[i + 1] || 0;
      return cum;
    });
  }, [transactions, thisYM, daysInMonth, today]);

  // Comparison line — varies by range selection
  const compPoints = useMemo(() => {
    const counts = { last:1, avg3:3, avg6:6, avg12:12 }[range];
    const isLast = range === "last";

    // Build per-day spending for the relevant past months
    const months = monthlyData.slice(-(counts + 1), -1).slice(-counts); // exclude current month
    if (!months.length) return Array(daysInMonth).fill(null);

    const perDayPerMonth = months.map(m => {
      const byDay = {};
      transactions.forEach(t => {
        if (!t.date?.startsWith(m.ym) || t.amount >= 0) return;
        if (["transfer","income","reimbursement"].includes(t.type)) return;
        const day = parseInt(t.date.slice(8,10), 10);
        byDay[day] = (byDay[day] || 0) + Math.abs(t.amount);
      });
      return byDay;
    });

    if (isLast) {
      // Single line: cumulative for last month
      const m = perDayPerMonth[0] || {};
      const daysInComp = new Date(
        parseInt(months[0].ym.slice(0,4)),
        parseInt(months[0].ym.slice(5,7)),
        0
      ).getDate();
      let cum = 0;
      return Array.from({ length: daysInMonth }, (_, i) => {
        if (i >= daysInComp) return cum; // hold last value if comp month shorter
        cum += m[i + 1] || 0;
        return cum;
      });
    } else {
      // Average line: average cumulative across N months
      return Array.from({ length: daysInMonth }, (_, i) => {
        const vals = perDayPerMonth.map(m => {
          let cum = 0;
          for (let d = 1; d <= i + 1; d++) cum += m[d] || 0;
          return cum;
        }).filter(v => v > 0 || i === 0);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      });
    }
  }, [transactions, monthlyData, range, daysInMonth]);

  const thisTotal = thisMonthPoints[today.getDate() - 1] || 0;
  const compTotal = compPoints[daysInMonth - 1] || compPoints.filter(Boolean).at(-1) || 0;
  const selectedLabel = PACE_RANGES.find(r => r.key === range)?.label || "Last month";

  // SVG dimensions
  const W = 600, H = 180, PAD = { top:16, right:16, bottom:32, left:44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;

  const allVals = [...thisMonthPoints, ...compPoints].filter(v => v != null && v > 0);
  const maxVal  = Math.max(...allVals, 1);

  const xOf = i => PAD.left + (i / (daysInMonth - 1)) * innerW;
  const yOf = v => PAD.top  + innerH - (v / maxVal) * innerH;

  function buildPath(points, stopAtNull = true) {
    let d = "";
    points.forEach((v, i) => {
      if (v == null) { if (stopAtNull) return; else return; }
      d += (d === "" ? "M" : "L") + `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)} `;
    });
    return d.trim();
  }

  // Area fill for this month (up to today)
  function buildArea(points) {
    const defined = points.map((v,i) => v != null ? i : null).filter(i => i !== null);
    if (!defined.length) return "";
    const first = defined[0], last = defined[defined.length-1];
    let d = `M${xOf(first).toFixed(1)},${(PAD.top+innerH).toFixed(1)} `;
    defined.forEach(i => { d += `L${xOf(i).toFixed(1)},${yOf(points[i]).toFixed(1)} `; });
    d += `L${xOf(last).toFixed(1)},${(PAD.top+innerH).toFixed(1)} Z`;
    return d;
  }

  // Y-axis gridlines
  const gridVals = [0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));
  // X-axis day labels
  const xLabels = [1, 6, 11, 16, 21, 26, 31].filter(d => d <= daysInMonth);

  return (
    <Card style={{ position:"relative" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12, gap:8 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.8px", color:"var(--t3)", textTransform:"uppercase", marginBottom:4 }}>
            Spending Pace
          </div>
          <div style={{ display:"flex", gap:16, alignItems:"baseline", flexWrap:"wrap" }}>
            <div>
              <span style={{ fontSize:11, color:"var(--t3)" }}>This month: </span>
              <span style={{ fontSize:14, fontWeight:700, fontFamily:"var(--font-mono)", color:"var(--cyan)" }}>{fmt(thisTotal)}</span>
            </div>
            <div>
              <span style={{ fontSize:11, color:"var(--t3)" }}>{selectedLabel === "Last month" ? "Last month:" : "Avg:"} </span>
              <span style={{ fontSize:13, fontWeight:600, fontFamily:"var(--font-mono)", color:"var(--t2)" }}>{fmt(compTotal)}</span>
            </div>
          </div>
        </div>
        {/* Range picker */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <button
            onClick={() => setPickerOpen(p => !p)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
              background:"var(--surface)",
              borderRadius:20, cursor:"pointer", fontSize:12, color:"var(--t1)", fontWeight:500 }}>
            {selectedLabel}
            <span style={{ fontSize:10, color:"var(--t3)" }}>▾</span>
          </button>
          {pickerOpen && (
            <>
              <div style={{ position:"fixed", inset:0, zIndex:199 }} onClick={() => setPickerOpen(false)} />
              <div className="obsidian-card" style={{ position:"absolute", right:0, top:"calc(100% + 6px)", zIndex:200,
                background:"var(--card)", borderRadius:12,
                boxShadow:"0 8px 24px #0006", minWidth:160, overflow:"hidden" }}>
                {PACE_RANGES.map(r => (
                  <button key={r.key}
                    onClick={() => { setRange(r.key); setPickerOpen(false); }}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                      width:"100%", padding:"11px 16px", background:"none", border:"none",
                      cursor:"pointer", fontSize:13, color: r.key === range ? "var(--cyan)" : "var(--t1)",
                      fontWeight: r.key === range ? 700 : 400,
                      borderBottom:"1px solid var(--border)" }}>
                    {r.label}
                    {r.key === range && <span style={{ fontSize:14, color:"var(--cyan)" }}>✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", overflow:"visible" }}>
        <defs>
          <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Gridlines + Y labels */}
        {gridVals.map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yOf(v)} y2={yOf(v)}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="4,4" />
            <text x={PAD.left - 6} y={yOf(v) + 4} textAnchor="end"
              style={{ fontSize:9, fill:"var(--t3)", fontFamily:"var(--font-mono)" }}>
              {fmtK(v)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabels.map(d => (
          <text key={d} x={xOf(d-1)} y={H - 6} textAnchor="middle"
            style={{ fontSize:9, fill:"var(--t3)", fontFamily:"var(--font-mono)" }}>
            {d}
          </text>
        ))}

        {/* Area fill — this month */}
        <path d={buildArea(thisMonthPoints)} fill="url(#paceGrad)" />

        {/* Comparison line */}
        <path d={buildPath(compPoints, false)} fill="none"
          stroke="var(--t3)" strokeWidth="1.5" strokeDasharray="0" strokeLinecap="round" strokeLinejoin="round" />

        {/* This month line */}
        <path d={buildPath(thisMonthPoints)} fill="none"
          stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Today marker */}
        {thisMonthPoints[today.getDate()-1] != null && (
          <circle cx={xOf(today.getDate()-1)} cy={yOf(thisMonthPoints[today.getDate()-1])}
            r="4" fill="var(--cyan)" stroke="var(--card)" strokeWidth="2" />
        )}
      </svg>

      {/* Legend */}
      <div style={{ display:"flex", gap:16, justifyContent:"center", marginTop:6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--t2)" }}>
          <div style={{ width:16, height:2.5, borderRadius:2, background:"var(--cyan)" }} /> This month
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--t2)" }}>
          <div style={{ width:16, height:2, borderRadius:2, background:"var(--t3)" }} /> {selectedLabel}
        </div>
      </div>
    </Card>
  );
}

function SpendingPatternCard({ dowData, dowMax, weekOfMonthData, isMobile }) {
  const [view, setView] = useState("day");
  return (
    <Card>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <SectionHead title={view==="day"?"Spending by day of week":"Spending by week of month"} sub="Total, all time" />
        <div style={{ display:"flex", gap:3, background:"var(--surface)", borderRadius:"var(--radius)", padding:3 }}>
          {[["day","By Day"],["week","By Week"]].map(([k,l]) => (
            <button key={k} onClick={()=>setView(k)} style={{
              padding:"3px 10px", borderRadius:"var(--radius)", fontSize:11, fontWeight:500,
              background:view===k?"var(--card)":"transparent",
              color:view===k?"var(--t1)":"var(--t2)", border:"none", cursor:"pointer",
            }}>{l}</button>
          ))}
        </div>
      </div>
      {view==="day" ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4, alignItems:"end" }}>
          {dowData.map(d => {
            const h = dowMax>0?Math.round((d.total/dowMax)*72):0;
            const isTop = d.total === Math.max(...dowData.map(x=>x.total));
            return (
              <div key={d.day} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                {!isMobile && <div style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--t3)", textAlign:"center" }}>{fmt(d.total)}</div>}
                <div style={{ width:"100%", height:72, display:"flex", alignItems:"flex-end" }}>
                  <div style={{ width:"100%", height:h, minHeight:d.total>0?3:0, background:isTop?"var(--cyan)":"var(--border2)", borderRadius:"3px 3px 0 0", transition:"height 0.4s" }} />
                </div>
                <div style={{ fontSize:10, color:isTop?"var(--cyan)":"var(--t3)", fontWeight:isTop?700:400 }}>{d.day.slice(0,3)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, alignItems:"end" }}>
          {weekOfMonthData.map(w => {
            const wMax = Math.max(...weekOfMonthData.map(x=>x.total), 1);
            const h = wMax>0?Math.round((w.total/wMax)*72):0;
            const isTop = w.total === Math.max(...weekOfMonthData.map(x=>x.total));
            return (
              <div key={w.label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                {!isMobile && <div style={{ fontSize:9, fontFamily:"var(--font-mono)", color:"var(--t3)", textAlign:"center" }}>{fmt(w.total)}</div>}
                <div style={{ width:"100%", height:72, display:"flex", alignItems:"flex-end" }}>
                  <div style={{ width:"100%", height:h, minHeight:w.total>0?3:0, background:isTop?"var(--cyan)":"var(--border2)", borderRadius:"3px 3px 0 0", transition:"height 0.4s" }} />
                </div>
                <div style={{ fontSize:10, color:isTop?"var(--cyan)":"var(--t3)", fontWeight:isTop?700:400 }}>{w.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════ */
export default function Analytics({ transactions, categories, accounts, catMap, isMobile, hasApiKey, userProfile, aiInsights, onSetAiInsights, todos = [], onTodosChange, goals = [], onSaveGoal, onDeleteGoal, onMarkRecurring, defaultTab = "overview" }) {
  const [tab, setTab] = useState(defaultTab || "overview");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState(null);
  const [userCorrections, setUserCorrections] = useState("");
  const [dismissedRecurring, setDismissedRecurring] = useState(new Set());
  const [goalForm, setGoalForm]   = useState(null);
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
      if (txns.some(t => t.recurring)) return; // already tracked as recurring
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


  /* ─── Concept visual components ─────────────────────────────────── */
  const Tier = ({ ord, title, sub, children, last=false, ghost="" }) => (
    <div style={{
      padding:"28px 28px", borderBottom:last?"none":"1px solid rgba(0,0,0,0.35)",
      position:"relative", overflow:"hidden",
      background:"radial-gradient(ellipse 55% 80% at 0% 40%,rgba(201,149,106,0.04) 0%,transparent 65%),var(--bg,#0b0a08)",
    }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,
        background:"linear-gradient(90deg,rgba(201,149,106,0.1),rgba(255,255,255,0.03) 35%,transparent 75%)"}}/>
      {ghost && <div style={{position:"absolute",fontFamily:"'Playfair Display',serif",fontStyle:"italic",
        fontSize:88,fontWeight:500,color:"rgba(201,149,106,0.06)",top:"50%",transform:"translateY(-55%)",
        left:4,lineHeight:1,pointerEvents:"none",userSelect:"none",zIndex:0}}>{ghost}</div>}
      <div style={{display:"flex",alignItems:"baseline",gap:12,paddingBottom:10,
        borderBottom:"1px solid rgba(201,149,106,0.1)",marginBottom:6,position:"relative",zIndex:1}}>
        <span style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:600,
          color:"rgba(201,149,106,0.45)",letterSpacing:"1px"}}>{ord} ·</span>
        <span style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontWeight:400,
          fontSize:20,color:"var(--t1)"}}>{title}</span>
        <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(201,149,106,0.12),transparent)"}}/>
      </div>
      {sub && <div style={{fontFamily:"var(--font-mono)",fontSize:10,textTransform:"uppercase",
        letterSpacing:"0.7px",color:"var(--t3)",marginBottom:20,position:"relative",zIndex:1}}>{sub}</div>}
      <div style={{position:"relative",zIndex:1}}>{children}</div>
    </div>
  );

  const ColHdr = ({ children }) => (
    <div style={{fontFamily:"'Cormorant Garamond','Playfair Display',serif",fontStyle:"italic",
      fontSize:12,color:"var(--t3)",paddingBottom:8,
      borderBottom:"1px solid rgba(255,255,255,0.04)",marginBottom:10}}>{children}</div>
  );

  const FRow = ({ dot, pip, label, barW=0, barColor="var(--cyan)", val, delta, valColor, deltaColor, last=false, style={} }) => (
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",
      borderBottom:last?"none":"1px solid rgba(255,255,255,0.03)",...style}}>
      {dot && <div style={{width:7,height:7,borderRadius:"50%",background:dot,flexShrink:0}}/>}
      {pip && <div style={{width:2,height:24,borderRadius:1,background:"rgba(255,255,255,0.12)",flexShrink:0}}/>}
      <div style={{fontSize:12,color:"var(--t2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
      {barW > 0 && (
        <div style={{flex:1.5,height:2,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden",flexShrink:0}}>
          <div style={{height:"100%",width:`${barW}%`,background:barColor,borderRadius:99}}/>
        </div>
      )}
      {val != null && <div style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:600,
        width:70,textAlign:"right",flexShrink:0,color:valColor||"var(--t2)"}}>{val}</div>}
      {delta != null && <div style={{fontFamily:"var(--font-mono)",fontSize:10,
        width:48,textAlign:"right",flexShrink:0,color:deltaColor||"var(--t3)"}}>{delta}</div>}
    </div>
  );

  const AiCallout = ({ label, children }) => (
    <div style={{padding:"12px 14px",borderLeft:"2px solid var(--cyan)",
      background:"rgba(201,149,106,0.04)",margin:"16px 0",fontSize:12,
      color:"var(--t2)",lineHeight:1.6}}>
      {label && <div style={{fontFamily:"var(--font-mono)",fontSize:9,textTransform:"uppercase",
        letterSpacing:"0.8px",color:"var(--cyan)",marginBottom:5}}>{label}</div>}
      {children}
    </div>
  );

  /* ── Tab bar ──────────────────────────────────────────────────── */
  const TABS = ["overview","spending","budget","insights","goals"];
  const tabLabels = { overview:"Overview", spending:"Spending", budget:"Budget", insights:"Insights", goals:"Goals" };

  /* ── Derived display values ──────────────────────────────────── */
  const dowFull = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dowSorted = [...dowData].map((d,i) => ({...d, fullDay:dowFull[i]})).sort((a,b) => b.total - a.total);
  const dowTotalMax = Math.max(...dowData.map(d => d.total), 1);

  const risingCats  = [...catAcceleration].filter(c => c.delta > 0).sort((a,b)=>b.delta-a.delta).slice(0,5);
  const fallingCats = [...catAcceleration].filter(c => c.delta < 0).sort((a,b)=>a.delta-b.delta).slice(0,5);

  const txnCount = transactions.length;
  const monthLabel = today.toLocaleString("en-US",{month:"short",year:"numeric"});

  /* ── Health score breakdown as flat rows ────────────────────── */
  function HealthScoreCard() {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:0}}>
        {healthScore.breakdown.map((item,i) => {
          const pctVal = Math.round((item.pts/item.max)*100);
          const color = pctVal>=80?"var(--green)":pctVal>=55?"var(--amber)":"var(--red)";
          return (
            <FRow key={item.label} label={`${item.label}${item.note?` (${item.note})`:"" }`}
              barW={pctVal} barColor={color}
              val={`${item.pts} / ${item.max}`} valColor={color}
              last={i===healthScore.breakdown.length-1}/>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{width:"100%"}} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* ── Page header (phdr) ──────────────────────────────────── */}
      <div style={{padding:"28px 28px 0",position:"relative",overflow:"hidden",
        background:"radial-gradient(ellipse 55% 80% at 0% 40%,rgba(201,149,106,0.055) 0%,transparent 65%),var(--bg,#0b0a08)",
        borderBottom:"1px solid rgba(0,0,0,0.35)"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,
          background:"linear-gradient(90deg,rgba(201,149,106,0.14),rgba(255,255,255,0.04) 35%,transparent 75%)"}}/>
        <div style={{position:"absolute",fontFamily:"'Playfair Display',serif",fontStyle:"italic",
          fontSize:96,fontWeight:500,color:"rgba(201,149,106,0.07)",top:"50%",transform:"translateY(-55%)",
          left:8,lineHeight:1,pointerEvents:"none",userSelect:"none",zIndex:0}}>II</div>
        <div style={{display:"flex",alignItems:"baseline",gap:12,paddingBottom:12,
          borderBottom:"1px solid rgba(201,149,106,0.12)",position:"relative",zIndex:1}}>
          <span style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:600,
            color:"rgba(201,149,106,0.45)",letterSpacing:"1px"}}>II ·</span>
          <span style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",
            fontWeight:400,fontSize:22,color:"var(--t1)"}}>Analytics</span>
          <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(201,149,106,0.15),transparent)"}}/>
        </div>
        <div style={{fontFamily:"var(--font-mono)",fontSize:10,textTransform:"uppercase",
          letterSpacing:"0.7px",color:"var(--t3)",marginTop:6,paddingBottom:20,
          position:"relative",zIndex:1}}>
          {tabLabels[tab]} · {monthLabel} · {txnCount} transactions
        </div>
      </div>

      {/* ── Sticky tab bar ─────────────────────────────────────── */}
      <div style={{padding:"0 28px",background:"rgba(11,10,8,0.9)",position:"sticky",
        top:0,zIndex:10,borderBottom:"1px solid rgba(255,255,255,0.04)",backdropFilter:"blur(14px)"}}>
        <div style={{display:"flex",gap:0,borderBottom:"none",marginBottom:0}}>
          {TABS.map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"12px 18px",fontSize:11,cursor:"pointer",
              border:"none",background:"transparent",
              color:tab===t?"var(--cyan)":"var(--t3)",
              fontFamily:"var(--font-body)",
              borderBottom:tab===t?"2px solid var(--cyan)":"2px solid transparent",
              transition:"all .15s",marginBottom:-1,
              ...(isMobile?{flex:1,padding:"12px 8px",fontSize:10}:{}),
            }}>{tabLabels[t]}</button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          OVERVIEW — V3 Two-Column
      ══════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div key="overview" className="ledgr-panel-in">

          {/* T III: Cash Flow + Sources */}
          <Tier ord="III" title="Cash Flow + Sources" sub={`Last ${last6.length} months · income vs spending`} ghost="III">
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 260px",gap:48}}>
              {/* Left: monthly cash flow flat rows */}
              <div>
                <ColHdr>Monthly cash flow</ColHdr>
                {[...last6].reverse().map((m, i, arr) => {
                  const maxSpend = Math.max(...last6.map(x=>x.spending),1);
                  const barW = Math.round((m.spending/maxSpend)*100);
                  const isCurrent = i===0;
                  const momPct = arr[i+1] ? Math.round(((m.spending-arr[i+1].spending)/Math.max(arr[i+1].spending,1))*100) : null;
                  const color = m.spending > m.income ? "var(--red)" : m.spending > avgSpending*1.1 ? "var(--amber)" : "var(--green)";
                  return (
                    <FRow key={m.ym}
                      label={<span style={{width:44,flexShrink:0,display:"inline-block",fontFamily:"var(--font-mono)",fontSize:10,color:isCurrent?"var(--cyan)":"var(--t3)"}}>{m.label.split(" ")[0]}</span>}
                      barW={barW} barColor={isCurrent?"var(--red)":color}
                      val={fmt(m.spending)} valColor={isCurrent?"var(--red)":color}
                      delta={momPct!=null?(momPct>0?"+":"")+momPct+"%":null}
                      deltaColor={momPct==null?"var(--t3)":momPct>0?"var(--red)":"var(--green)"}
                      last={i===arr.length-1}
                    />
                  );
                })}
              </div>
              {/* Right: income sources + net saved */}
              <div>
                <ColHdr>Income sources · all time</ColHdr>
                {incomeSources.slice(0,3).map((s,i) => (
                  <div key={s.name} style={{padding:i===0?"10px 0":"8px 0 8px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                    <div style={{fontSize:13,color:"var(--t1)",fontWeight:500,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:18,fontWeight:700,color:"var(--green)"}}>{fmt(s.total)}</div>
                    <div style={{fontSize:10,color:"var(--t3)",marginTop:2}}>{Math.round((s.total/incomeSources.reduce((a,x)=>a+x.total,0))*100)}% of income · {s.count} payments</div>
                  </div>
                ))}
                <div style={{height:1,background:"rgba(255,255,255,0.04)",margin:"12px 0"}}/>
                <ColHdr>Net saved · last {monthlySavings.length} months</ColHdr>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {monthlySavings.map((m,i) => (
                    <div key={m.label} style={{textAlign:"center"}}>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:i===monthlySavings.length-1?"var(--cyan)":"var(--t3)"}}>{m.label.split(" ")[0]}</div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:i===monthlySavings.length-1?13:12,
                        fontWeight:i===monthlySavings.length-1?700:400,
                        color:m.value>=0?"var(--green)":"var(--red)"}}>
                        {m.value>=0?"+":""}{m.value>=1000?`$${Math.round(m.value/1000)}k`:fmt(m.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Tier>

          {/* T IV: Financial Health */}
          <Tier ord="IV" title="Financial Health" sub={`${healthScore.score} / 100 · ${healthScore.label}`} ghost="IV">
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:48}}>
              <div>
                <ColHdr>Score breakdown</ColHdr>
                <HealthScoreCard/>
              </div>
              <div>
                <ColHdr>Key metrics</ColHdr>
                <FRow label="Avg monthly spend" val={fmt(avgSpending)}
                  valColor={momChange>0?"var(--red)":"var(--green)"}
                  delta={momChange!=null?(momChange>0?"+":"")+momChange+"%":null}
                  deltaColor={momChange>0?"var(--red)":"var(--green)"}/>
                <FRow label="Savings rate"
                  val={savingsRate!=null?`${savingsRate}%`:"—"}
                  valColor={savingsRate>=20?"var(--green)":savingsRate>=0?"var(--amber)":"var(--red)"}
                  delta={savingsRate>=20?"great":savingsRate>=0?"ok":"low"}
                  deltaColor={savingsRate>=20?"var(--green)":savingsRate>=0?"var(--amber)":"var(--red)"}/>
                <FRow label="Budget efficiency"
                  val={efficiencyScore!=null?`${efficiencyScore}%`:"—"}
                  valColor={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"}
                  delta={efficiencyScore>=80?"great":efficiencyScore>=60?"ok":"low"}
                  deltaColor={efficiencyScore>=80?"var(--green)":efficiencyScore>=60?"var(--amber)":"var(--red)"}/>
                <FRow label="Subscriptions" val={fmt(subscriptionTotal)}
                  valColor="var(--amber)"
                  delta={`${subscriptions.length}×`}/>
                <FRow label="Spend-free days" val={String(spendingFreeDays)}
                  valColor={spendingFreeDays>=10?"var(--green)":spendingFreeDays>=5?"var(--amber)":"var(--red)"}
                  delta="this mo" last/>
              </div>
            </div>
          </Tier>

          {/* T V: Category Momentum */}
          <Tier ord="V" title="Category Momentum" sub="Month-over-month change · last 3 months" last ghost="V">
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:48}}>
              <div>
                <ColHdr>Rising ↑</ColHdr>
                {risingCats.length===0?<div style={{fontSize:12,color:"var(--t3)"}}>No rising categories</div>:
                  risingCats.map((c,i) => (
                    <FRow key={c.id} dot={c.color} label={c.name}
                      barW={Math.round((c.delta/Math.max(...risingCats.map(x=>x.delta),1))*100)}
                      barColor="var(--red)"
                      val={`+${fmt(c.delta)}`} valColor="var(--red)"
                      last={i===risingCats.length-1}/>
                  ))
                }
              </div>
              <div>
                <ColHdr>Falling ↓</ColHdr>
                {fallingCats.length===0?<div style={{fontSize:12,color:"var(--t3)"}}>No falling categories</div>:
                  fallingCats.map((c,i) => (
                    <FRow key={c.id} dot={c.color} label={c.name}
                      barW={Math.round((Math.abs(c.delta)/Math.max(...fallingCats.map(x=>Math.abs(x.delta)),1))*100)}
                      barColor="var(--green)"
                      val={fmt(c.delta)} valColor="var(--green)"
                      last={i===fallingCats.length-1}/>
                  ))
                }
              </div>
            </div>
          </Tier>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SPENDING — V2 Pace + Pattern
      ══════════════════════════════════════════════════════════ */}
      {tab === "spending" && (
        <div key="spending" className="ledgr-panel-in">

          {/* T III: Spending Pace (existing SVG chart, restyled) */}
          <Tier ord="III" title="Spending Pace"
            sub={`Cumulative spend day by day · ${today.toLocaleString("en-US",{month:"long"})} vs prior period`}
            ghost="III">
            <SpendingPaceCard transactions={transactions} monthlyData={monthlyData} today={today} isMobile={isMobile}/>
          </Tier>

          {/* T IV: Day of Week */}
          <Tier ord="IV" title="Spending by Day of Week" sub="Average spend per day · all time" ghost="IV">
            {dowSorted.map((d,i) => {
              const isTop = i===0;
              const barW = Math.round((d.total/dowTotalMax)*100);
              const color = isTop?"var(--red)":i===1?"rgba(224,112,112,0.6)":barW>55?"var(--cyan)":"rgba(201,149,106,0.45)";
              return (
                <FRow key={d.day}
                  label={<span style={{width:80,flexShrink:0,display:"inline-block"}}>{d.fullDay}</span>}
                  barW={barW} barColor={color}
                  val={`${fmt(Math.round(d.total/Math.max(monthlyData.length,1)))} avg`}
                  valColor={isTop?"var(--red)":"var(--t2)"}
                  last={i===dowSorted.length-1}/>
              );
            })}
            {dowSorted.length > 0 && (
              <AiCallout label="✦ Pattern">
                You spend most on {dowSorted[0].fullDay}s, which accounts for roughly {Math.round((dowSorted[0].total/Math.max(dowData.reduce((s,d)=>s+d.total,0),1))*100)}% of your total spending.
              </AiCallout>
            )}
          </Tier>

          {/* T V: Top Merchants */}
          <Tier ord="V" title="Top Merchants" sub="All time · ranked by total spend" last ghost="V">
            {merchantTotals.map((m,i) => {
              const cat = categories.find(c => transactions.find(t => (t.merchant||t.name)?.toLowerCase()===m.name.toLowerCase() && t.categoryId===c.id));
              return (
                <FRow key={m.name} pip
                  label={m.name}
                  barW={Math.round((m.total/Math.max(merchantTotals[0]?.total||1,1))*100)}
                  barColor={cat?.color||"rgba(255,255,255,0.2)"}
                  val={fmt(m.total)} valColor="var(--t1)"
                  delta={`${m.count}mo`}
                  last={i===merchantTotals.length-1}/>
              );
            })}
          </Tier>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          BUDGET — flat tiers (no month grid)
      ══════════════════════════════════════════════════════════ */}
      {tab === "budget" && (
        <div key="budget" className="ledgr-panel-in">

          {/* T III: Budget adherence flat rows */}
          <Tier ord="III" title="Budget Adherence" sub="Green = under · Amber = 80–100% · Red = over" ghost="III">
            {budgetGrid.length===0
              ? <div style={{fontSize:13,color:"var(--t3)"}}>Set budget limits on categories to track adherence.</div>
              : budgetGrid.map((row,i) => {
                const score = row.allMs>0 ? Math.round((1-row.overMs/row.allMs)*100) : null;
                const color = score==null?"var(--t3)":score>=80?"var(--green)":score>=55?"var(--amber)":"var(--red)";
                return (
                  <div key={row.cat.id}>
                    <FRow dot={row.cat.color} label={row.cat.name}
                      barW={score||0} barColor={color}
                      val={score!=null?`${score}%`:"—"} valColor={color}
                      delta={`${row.overMs}/${row.allMs}mo`}
                      deltaColor={row.overMs>0?"var(--red)":"var(--green)"}
                      last={i===budgetGrid.length-1}/>
                  </div>
                );
              })
            }
          </Tier>

          {/* T IV: Consecutive overspend */}
          <Tier ord="IV" title="Chronic Overspend" sub="Categories overspent 2+ consecutive months" ghost="IV">
            {budgetGrid.filter(r=>r.streak>=2).length===0
              ? <div style={{fontSize:13,color:"var(--green)"}}>✓ No consecutive overspends.</div>
              : budgetGrid.filter(r=>r.streak>=2).map((row,i,arr) => (
                <FRow key={row.cat.id} dot={row.cat.color} label={row.cat.name}
                  barW={Math.round((row.streak/Math.max(monthlyData.length,1))*100)}
                  barColor="var(--red)"
                  val={`${row.streak}mo streak`} valColor="var(--red)"
                  delta="chronic" deltaColor="var(--red)"
                  last={i===arr.length-1}/>
              ))
            }
          </Tier>

          {/* T V: Most consistent */}
          <Tier ord="V" title="Most Consistent" sub="Categories that stayed under budget most reliably" last ghost="V">
            {[...budgetGrid].sort((a,b)=>(b.allMs-b.overMs)-(a.allMs-a.overMs)).slice(0,6).map((row,i,arr) => {
              const underMs = row.allMs-row.overMs;
              const barW = row.allMs>0 ? Math.round((underMs/row.allMs)*100) : 0;
              return (
                <FRow key={row.cat.id} dot={row.cat.color} label={row.cat.name}
                  barW={barW} barColor="var(--green)"
                  val={`${underMs}/${row.allMs} months`} valColor="var(--green)"
                  delta={`avg ${fmt(row.avgSp)}`}
                  last={i===arr.length-1}/>
              );
            })}
          </Tier>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          INSIGHTS — V5 Narrative
      ══════════════════════════════════════════════════════════ */}
      {tab === "insights" && (
        <div key="insights" className="ledgr-panel-in">

          {/* T III: AI Financial Summary */}
          <Tier ord="III" title="AI Financial Summary" ghost="III"
            sub={<span style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>Claude analyzes your full financial picture</span>
              <span style={{fontFamily:"var(--font-mono)",fontSize:9,color:"rgba(201,149,106,0.45)",letterSpacing:"0.5px"}}>✦ Claude</span>
            </span>}>
            {/* Corrections textarea */}
            {hasApiKey && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,color:"var(--t3)",marginBottom:6,lineHeight:1.5}}>
                  <span style={{fontWeight:600,color:"var(--t2)"}}>Corrections</span> — tell Claude anything it might get wrong before generating
                </div>
                <textarea value={userCorrections} onChange={e=>setUserCorrections(e.target.value)}
                  placeholder='e.g. "My rent of $2,100 is not a subscription" · "Income is $6,500/mo after tax"'
                  rows={2} style={{width:"100%",background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.06)",
                    borderRadius:"var(--radius)",padding:"8px 10px",fontSize:12,
                    color:"var(--t1)",resize:"vertical",fontFamily:"var(--font-body)",
                    lineHeight:1.5,outline:"none",boxSizing:"border-box",marginBottom:8,colorScheme:"dark"}}/>
                <button style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",
                  borderRadius:"var(--radius)",fontSize:12,fontWeight:600,cursor:aiLoading?"default":"pointer",
                  border:"1px solid rgba(201,149,106,0.3)",marginLeft:"auto",
                  background:"rgba(201,149,106,0.08)",color:"var(--cyan)",
                  opacity:aiLoading?0.7:1,transition:"all 0.15s"}}
                  onClick={!aiLoading?runAiInsights:undefined} disabled={aiLoading}>
                  {aiLoading?"✦ Analyzing…":aiInsights?"✦ Regenerate Insights":"✦ Generate Insights"}
                </button>
              </div>
            )}
            {!hasApiKey && (
              <div style={{fontSize:13,color:"var(--t3)",padding:"24px 0",lineHeight:1.6}}>
                Add your Claude API key on the Ask AI page to unlock AI-powered insights.
              </div>
            )}
            {aiError && <div style={{fontSize:13,color:"var(--red)",padding:"10px 0"}}>{aiError}</div>}

            {/* AI pull quote */}
            {aiInsights && (
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:17,
                  color:"var(--t1)",lineHeight:1.7,marginBottom:20,paddingLeft:20,
                  borderLeft:"2px solid rgba(201,149,106,0.3)"}}>
                  {aiInsights.headline || "Your financial data has been analyzed. See insights below."}
                  {aiInsights.insights?.[0]?.body ? ` ${aiInsights.insights[0].body}` : ""}
                </div>
                {/* Signal pills */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
                  {aiInsights.insights?.filter(i=>i.type==="warning").slice(0,2).map((ins,i) => (
                    <div key={i} style={{padding:"4px 10px",borderRadius:99,
                      background:"rgba(224,112,112,0.08)",border:"1px solid rgba(224,112,112,0.2)",
                      fontSize:11,color:"var(--red)"}}>⚠ {ins.title}</div>
                  ))}
                  {aiInsights.insights?.filter(i=>i.type==="positive").slice(0,2).map((ins,i) => (
                    <div key={i} style={{padding:"4px 10px",borderRadius:99,
                      background:"rgba(109,184,138,0.08)",border:"1px solid rgba(109,184,138,0.2)",
                      fontSize:11,color:"var(--green)"}}>✓ {ins.title}</div>
                  ))}
                  {aiInsights.score && (
                    <div style={{padding:"4px 10px",borderRadius:99,
                      background:"rgba(201,149,106,0.08)",border:"1px solid rgba(201,149,106,0.2)",
                      fontSize:11,color:"var(--cyan)"}}>◎ Score: {aiInsights.score} / 100</div>
                  )}
                </div>
                {/* Insight list */}
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {aiInsights.insights?.map((ins,i) => (
                    <div key={i} style={{paddingLeft:20,borderLeft:`2px solid ${ins.type==="positive"?"var(--green)":ins.type==="warning"?"var(--amber)":"rgba(255,255,255,0.08)"}`}}>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",marginBottom:2}}>{ins.title}</div>
                      <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.5,marginBottom:ins.suggestion?6:0}}>{ins.body}</div>
                      {ins.suggestion && (
                        <div style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>{ins.suggestion}</div>
                      )}
                      {ins.suggestion && (
                        <button onClick={()=>addTodo(ins.suggestion)}
                          style={{fontSize:11,fontWeight:600,cursor:"pointer",background:"none",border:"none",padding:0,
                            color:isTodoAdded(ins.suggestion)?"var(--green)":"var(--cyan)"}}>
                          {isTodoAdded(ins.suggestion)?"✓ Added to To-Do":"+ Add to To-Do"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {aiInsights.recommendation && (
                  <div style={{marginTop:16,padding:"12px 14px",borderLeft:"2px solid var(--cyan)",
                    background:"rgba(201,149,106,0.04)"}}>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:9,textTransform:"uppercase",
                      letterSpacing:"0.8px",color:"var(--cyan)",marginBottom:5}}>✦ This month's action</div>
                    <div style={{fontSize:13,color:"var(--t1)",lineHeight:1.5,marginBottom:8}}>{aiInsights.recommendation}</div>
                    <button onClick={()=>addTodo(aiInsights.recommendation)}
                      style={{fontSize:11,fontWeight:600,cursor:"pointer",background:"none",border:"none",padding:0,
                        color:isTodoAdded(aiInsights.recommendation)?"var(--green)":"var(--cyan)"}}>
                      {isTodoAdded(aiInsights.recommendation)?"✓ Added to To-Do":"+ Add to To-Do"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {!aiInsights&&!aiLoading&&!aiError&&hasApiKey&&(
              <div style={{fontSize:13,color:"var(--t3)",padding:"24px 0",textAlign:"center"}}>
                Add any corrections above, then tap Generate Insights.
              </div>
            )}
          </Tier>

          {/* T IV: Action Items */}
          <Tier ord="IV" title="Action Items" sub="Suggested from your spending patterns" ghost="IV">
            {todos.length===0 ? (
              <div style={{fontSize:13,color:"var(--t3)"}}>
                Generate insights above and tap "+ Add to To-Do" on any suggestion.
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {todos.map(todo => (
                  <div key={todo.id} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <button onClick={()=>removeTodo(todo.id)} style={{
                      width:18,height:18,borderRadius:4,
                      border:"1px solid rgba(201,149,106,0.3)",
                      background:"none",cursor:"pointer",flexShrink:0,marginTop:2,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      color:"var(--cyan)",fontSize:10}}>✓</button>
                    <div>
                      <div style={{fontSize:13,color:"var(--t1)"}}>{todo.text}</div>
                    </div>
                  </div>
                ))}
                <button onClick={()=>onTodosChange([])}
                  style={{fontSize:11,color:"var(--t3)",background:"none",border:"none",
                    cursor:"pointer",textAlign:"left",padding:0,marginTop:4}}>Clear all</button>
              </div>
            )}
          </Tier>

          {/* T V: Detected Recurring Charges */}
          {detectedRecurring.filter(r=>!dismissedRecurring.has(r.name)).length>0 && (
            <Tier ord="V" title="Detected Recurring Charges" last
              sub="Unconfirmed · confirm to add to calendar" ghost="V">
              {detectedRecurring.filter(r=>!dismissedRecurring.has(r.name)).slice(0,8).map((r,i,arr) => (
                <div key={r.name} style={{display:"flex",alignItems:"center",gap:10,
                  padding:"9px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.03)":"none"}}>
                  <div style={{width:2,height:24,borderRadius:1,background:"rgba(255,255,255,0.12)",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0,fontSize:12,color:"var(--t2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {r.name} · ~{fmt(r.amount)}/{r.freqLabel.toLowerCase().replace("ly","")}
                  </div>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--t3)",flexShrink:0}}>{r.count} occurrences</div>
                  <div style={{display:"flex",gap:6,marginLeft:12,flexShrink:0}}>
                    <button onClick={()=>onMarkRecurring&&onMarkRecurring(r.txnIds)}
                      style={{padding:"3px 9px",borderRadius:5,
                        background:"rgba(201,149,106,0.1)",border:"1px solid rgba(201,149,106,0.25)",
                        color:"var(--cyan)",fontSize:10,cursor:"pointer"}}>Confirm</button>
                    <button onClick={()=>setDismissedRecurring(p=>new Set([...p,r.name]))}
                      style={{padding:"3px 9px",borderRadius:5,background:"none",
                        border:"1px solid rgba(255,255,255,0.06)",color:"var(--t3)",
                        fontSize:10,cursor:"pointer"}}>Dismiss</button>
                  </div>
                </div>
              ))}
            </Tier>
          )}
          {detectedRecurring.filter(r=>!dismissedRecurring.has(r.name)).length===0 && (
            <Tier ord="V" title="Detected Recurring Charges" last sub="Unconfirmed · confirm to add to calendar" ghost="V">
              <div style={{fontSize:13,color:"var(--t3)"}}>No new recurring charges detected.</div>
            </Tier>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          GOALS
      ══════════════════════════════════════════════════════════ */}
      {tab === "goals" && (
        <div key="goals" className="ledgr-panel-in">
          <Tier ord="III" title="Savings Goals" sub="Track progress toward your financial targets" last ghost="III">
            {goals.length===0 ? (
              <div style={{fontSize:13,color:"var(--t3)"}}>No goals yet. Add a savings goal to start tracking.</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {goals.map((g,i) => {
                  const pctVal = g.targetAmount>0 ? Math.min(Math.round(((g.savedAmount||0)/g.targetAmount)*100),100) : 0;
                  const color = pctVal>=100?"var(--green)":pctVal>=60?"var(--cyan)":"var(--amber)";
                  return (
                    <div key={g.id} style={{padding:"12px 0",borderBottom:i<goals.length-1?"1px solid rgba(255,255,255,0.03)":"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{fontSize:13,fontWeight:500,color:"var(--t1)"}}>{g.title}</div>
                        <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color}}>{pctVal}%</div>
                      </div>
                      <div style={{height:2,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden",marginBottom:6}}>
                        <div style={{height:"100%",width:`${pctVal}%`,background:color,borderRadius:99,transition:"width 0.5s"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t3)"}}>
                        <span>{fmt(g.savedAmount||0)} saved</span>
                        <span>{fmt(g.targetAmount)} target</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {onSaveGoal && (
              <button onClick={()=>setGoalForm({})}
                style={{marginTop:20,padding:"8px 16px",borderRadius:"var(--radius)",
                  fontSize:12,fontWeight:600,cursor:"pointer",
                  background:"rgba(201,149,106,0.08)",border:"1px solid rgba(201,149,106,0.25)",
                  color:"var(--cyan)"}}>+ Add Goal</button>
            )}
          </Tier>
        </div>
      )}

      {/* Goal form modal */}
      {goalForm !== null && (
        <>
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:199}}
            onClick={()=>setGoalForm(null)}/>
          <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            zIndex:200,background:"var(--card)",borderRadius:"var(--radius)",
            padding:24,width:"90vw",maxWidth:400,boxShadow:"0 16px 48px #0009"}}>
            <div style={{fontSize:16,fontWeight:700,color:"var(--t1)",marginBottom:16}}>
              {goalForm.id?"Edit Goal":"New Goal"}
            </div>
            {[["title","Goal name","text"],["targetAmount","Target amount","number"],["savedAmount","Amount saved so far","number"]].map(([k,label,type]) => (
              <div key={k} style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>{label}</div>
                <input type={type} value={goalForm[k]||""} onChange={e=>setGoalForm(f=>({...f,[k]:type==="number"?parseFloat(e.target.value)||0:e.target.value}))}
                  style={{width:"100%",background:"var(--surface)",border:"1px solid var(--border)",
                    borderRadius:"var(--radius)",padding:"8px 10px",fontSize:13,color:"var(--t1)",
                    outline:"none",boxSizing:"border-box",colorScheme:"dark"}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
              <button onClick={()=>setGoalForm(null)}
                style={{padding:"8px 16px",borderRadius:"var(--radius)",fontSize:12,
                  background:"none",border:"1px solid var(--border)",color:"var(--t2)",cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>{if(goalForm.title?.trim()&&goalForm.targetAmount>0){onSaveGoal({...goalForm,id:goalForm.id||Date.now().toString()});setGoalForm(null);}}}
                style={{padding:"8px 16px",borderRadius:"var(--radius)",fontSize:12,fontWeight:600,
                  background:"var(--cyan)",color:"#000",border:"none",cursor:"pointer"}}>Save</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
