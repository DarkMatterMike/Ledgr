/**
 * LedgrCalendar.jsx
 * Full-screen calendar/agenda page matching the Briefing design system.
 * Place in: src/components/LedgrCalendar.jsx
 *
 * Props from AppInner (passed through CalendarAgenda):
 *   calendarMonth, calendarTxnsByDay, recurringItems
 *   transactions, catMap, acctMap
 *   prevCalMonth, nextCalMonth
 *   openNewRecurringItem, openEditRecurringItem
 *   fmt, today, isMobile, navigate
 */

import { useState, useMemo } from "react";

const SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  .lb-root {
    --bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;
    --line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);--line-3:rgba(255,255,255,0.18);
    --ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;
    --safe:#5dcaa5;--safe-bg:rgba(93,202,165,0.08);
    --warn:#f0b04c;--warn-bg:rgba(240,176,76,0.08);
    --debt:#e87363;--debt-bg:rgba(232,115,99,0.08);
    --calm:#6c8cff;--calm-bg:rgba(108,140,255,0.08);
    --goal:#a78bff;--goal-bg:rgba(167,139,255,0.08);
    --font-display:'Instrument Serif',Georgia,serif;
    --font-ui:'Geist',-apple-system,sans-serif;
    --font-mono:'JetBrains Mono',ui-monospace,monospace;
    --r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;
    font-family:var(--font-ui);background:var(--bg-0);color:var(--ink-0);
    -webkit-font-smoothing:antialiased;min-height:100vh;
  }
  .lb-outer { min-height:100vh;background:var(--bg-0); }
  .lb-frame { max-width:1480px;margin:0 auto;padding:0 48px;min-height:100vh;display:flex;flex-direction:column;box-shadow:0 0 0 1px var(--line); }
  @media(max-width:900px){ .lb-frame{padding:0 16px;} }
  @media(max-width:600px){ .lb-frame{padding:0;} }
  .lb-shell { display:flex;min-height:100vh; }
  .lb-sidenav { width:64px;border-right:1px solid var(--line);background:var(--bg-1);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0; }
  .lb-logo { width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),#0f6e56 80%);margin-bottom:24px;flex-shrink:0; }
  .lb-nav-item { width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:17px;cursor:pointer;transition:background .15s,color .15s;user-select:none; }
  .lb-nav-item:hover { color:var(--ink-1);background:var(--bg-2); }
  .lb-nav-item.active { color:var(--safe);background:var(--safe-bg); }
  .lb-nav-spacer { flex:1; }
  .lc-layout { flex:1;display:grid;grid-template-columns:300px 1fr;min-height:100vh;overflow:hidden; }
  .lc-left { border-right:1px solid var(--line);background:var(--bg-1);display:flex;flex-direction:column;overflow-y:auto; }
  .lc-right { overflow-y:auto; }
  .lc-topbar { height:60px;padding:0 52px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg-0);z-index:10; }
  .lc-topbar-left { display:flex;align-items:baseline;gap:16px; }
  .lc-label { font-family:var(--font-mono);font-size:11px;color:var(--ink-3); }
  .lc-title { font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px; }
  .lc-div { width:1px;height:14px;background:var(--line-2); }
  .lc-sub { font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase; }
  .lc-btn { background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 12px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:all .15s; }
  .lc-btn:hover { border-color:var(--line-3);color:var(--ink-0); }
  .lc-btn.primary { background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe); }
  /* mini cal */
  .lc-cal-pad { padding:24px 20px 16px; }
  .lc-cal-head { display:flex;justify-content:space-between;align-items:center;margin-bottom:14px; }
  .lc-cal-title { font-family:var(--font-display);font-size:20px;letter-spacing:-0.3px; }
  .lc-cal-nav { display:flex;gap:6px; }
  .lc-cal-nav span { width:24px;height:24px;border-radius:6px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--ink-2);font-size:12px;cursor:pointer;user-select:none; }
  .lc-cal-nav span:hover { border-color:var(--line-3);color:var(--ink-0); }
  .lc-cal-dow { display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:6px; }
  .lc-cal-dow span { font-size:9px;color:var(--ink-3);text-align:center;letter-spacing:0.4px; }
  .lc-cal-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:2px; }
  .lc-day { aspect-ratio:1;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;color:var(--ink-1);font-family:var(--font-mono);position:relative;cursor:pointer;user-select:none;transition:background .1s; }
  .lc-day:hover { background:rgba(255,255,255,0.04); }
  .lc-day.muted { color:var(--ink-4); }
  .lc-day.today { background:var(--bg-3);color:var(--safe);border:1px solid rgba(93,202,165,0.3); }
  .lc-day.selected { background:rgba(93,202,165,0.12);color:var(--safe);border:1px solid rgba(93,202,165,0.4); }
  .lc-day::after { content:'';position:absolute;bottom:3px;width:4px;height:4px;border-radius:50%;display:none; }
  .lc-day.has-bill::after { display:block;background:var(--debt); }
  .lc-day.has-inc::after { display:block;background:var(--safe); }
  .lc-day.has-mix::after { display:block;background:var(--warn);box-shadow:5px 0 0 var(--debt); }
  /* stats */
  .lc-stats { border-top:1px solid var(--line);padding:16px 20px;display:flex;flex-direction:column;gap:8px; }
  .lc-stat-row { display:flex;justify-content:space-between;align-items:center;font-size:12px; }
  .lc-stat-l { color:var(--ink-2); }
  .lc-stat-v { font-family:var(--font-mono); }
  /* recurring items */
  .lc-recurring-lbl { font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);padding:16px 20px 10px;border-top:1px solid var(--line); }
  .lc-ri-item { display:grid;grid-template-columns:60px 1fr;gap:10px;align-items:center;padding:10px 20px;border-top:1px solid var(--line); }
  .lc-ri-day { font-family:var(--font-display);font-size:20px;color:var(--ink-1);line-height:1; }
  .lc-ri-name { font-size:12px;color:var(--ink-0); }
  .lc-ri-amt { font-family:var(--font-mono);font-size:11px; }
  .lc-ri-add { margin:12px 20px;padding:10px;border:1px solid rgba(240,176,76,0.25);border-radius:var(--r-md);text-align:center;color:var(--warn);font-size:11px;cursor:pointer;font-family:var(--font-mono); }
  .lc-ri-add:hover { background:var(--warn-bg); }
  /* agenda right */
  .lc-agenda-content { padding:40px 52px; }
  .lc-agenda-day { margin-bottom:28px; }
  .lc-day-header { display:grid;grid-template-columns:60px 1fr;gap:0;padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:12px; }
  .lc-day-num { font-family:var(--font-display);font-size:32px;line-height:1;color:var(--ink-2); }
  .lc-day-num.today { color:var(--safe); }
  .lc-day-dow { font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-3);margin-top:4px; }
  .lc-today-marker { background:rgba(93,202,165,0.05);border-left:2px solid var(--safe);padding:6px 12px;margin:0 0 8px 60px;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--safe);display:inline-flex;align-items:center;gap:8px; }
  .lc-today-marker::before { content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe); }
  .lc-event { display:flex;justify-content:space-between;align-items:center;padding:8px 0 8px 60px; }
  .lc-event-left { display:flex;align-items:center;gap:10px; }
  .lc-event-ico { width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;font-family:var(--font-mono); }
  .lc-event-ico.bill { background:var(--debt-bg);color:var(--debt); }
  .lc-event-ico.income { background:var(--safe-bg);color:var(--safe); }
  .lc-event-ico.txn { background:rgba(255,255,255,0.05);color:var(--ink-2); }
  .lc-event-ico.recurring { background:var(--calm-bg);color:var(--calm); }
  .lc-event-info { display:flex;flex-direction:column;gap:1px; }
  .lc-event-name { font-size:13px;color:var(--ink-0);line-height:1.2; }
  .lc-event-sub { font-size:10px;color:var(--ink-3); }
  .lc-event-right { display:flex;flex-direction:column;align-items:flex-end;gap:2px; }
  .lc-event-amt { font-family:var(--font-mono);font-size:12px; }
  .lc-event-amt.income { color:var(--safe); }
  .lc-event-amt.expense { color:var(--debt); }
  .lc-event-status { font-size:9px;padding:1px 6px;border-radius:4px;letter-spacing:0.3px; }
  .lc-event-status.posted { background:var(--safe-bg);color:var(--safe); }
  .lc-event-status.upcoming { background:var(--warn-bg);color:var(--warn); }
  .lc-empty-day { padding:8px 0 8px 60px;font-size:12px;color:var(--ink-4);font-style:italic; }
  @media(max-width:900px){
    .lc-layout{grid-template-columns:1fr;}
    .lc-left{display:none;}
    .lb-sidenav{display:none;}
    .lc-agenda-content{padding:16px;}
    .lc-event{padding-left:48px;}
    .lc-today-marker{margin-left:48px;}
  }
`;

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const NAV_ITEMS   = [
  { icon: "◐", id: "dashboard" },
  { icon: "⇅", id: "transactions" },
  { icon: "▣",  id: "accounts" },
  { icon: "▦",  id: "calendar", active: true },
  { icon: "◆",  id: "goals" },
];

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

export default function LedgrCalendar({
  calendarMonth = "",
  calendarTxnsByDay = {},
  recurringItems = [],
  transactions = [],
  catMap = {},
  acctMap = {},
  prevCalMonth,
  nextCalMonth,
  openNewRecurringItem,
  openEditRecurringItem,
  fmt = n => `$${Math.abs(n).toFixed(2)}`,
  today = new Date(),
  isMobile = false,
  navigate = () => {},
}) {
  const [cy, cm] = calendarMonth ? calendarMonth.split("-").map(Number) : [today.getFullYear(), today.getMonth() + 1];
  const [selectedDay, setSelectedDay] = useState(
    cy === today.getFullYear() && cm === today.getMonth() + 1 ? today.getDate() : 1
  );

  const firstDow   = new Date(cy, cm - 1, 1).getDay();
  const daysInM    = daysInMonth(cy, cm);
  const daysInPrev = daysInMonth(cy, cm - 1 === 0 ? 12 : cm - 1);

  // Build calendar cells
  const cells = useMemo(() => {
    const arr = [];
    for (let i = firstDow - 1; i >= 0; i--) arr.push({ day: daysInPrev - i, muted: true });
    for (let d = 1; d <= daysInM; d++) {
      const key = `${cy}-${String(cm).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const dayTxns = calendarTxnsByDay[d] || [];
      const hasInc  = dayTxns.some(t => t.amount > 0 || t.type === "income");
      const hasBill = dayTxns.some(t => t.amount < 0 || t.type === "expense");
      arr.push({ day: d, muted: false,
        isToday: cy === today.getFullYear() && cm === today.getMonth() + 1 && d === today.getDate(),
        hasMix:  hasInc && hasBill,
        hasInc:  hasInc && !hasBill,
        hasBill: hasBill && !hasInc,
      });
    }
    const trailing = 42 - arr.length;
    for (let d = 1; d <= trailing; d++) arr.push({ day: d, muted: true });
    return arr;
  }, [cy, cm, calendarTxnsByDay, firstDow, daysInM, daysInPrev, today]);

  // Month summary stats
  const monthTxns     = Object.values(calendarTxnsByDay).flat();
  const monthSpent    = monthTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthIncome   = monthTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const monthBillsRem = recurringItems.filter(r => r.type !== "income" && r.recurringDay && r.recurringDay > today.getDate()).reduce((s, r) => s + (r.amountMin || 0), 0);

  // Build agenda — show days that have events, plus today
  const agendaDays = useMemo(() => {
    const days = new Set();
    Object.keys(calendarTxnsByDay).forEach(d => days.add(parseInt(d)));
    recurringItems.forEach(r => { if (r.recurringDay) days.add(parseInt(r.recurringDay)); });
    if (cy === today.getFullYear() && cm === today.getMonth() + 1) days.add(today.getDate());
    return [...days].sort((a, b) => a - b);
  }, [calendarTxnsByDay, recurringItems, cy, cm, today]);

  const todayLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const isCurrentMonth = cy === today.getFullYear() && cm === today.getMonth() + 1;

  return (
    <>
      <style>{SHARED_CSS}</style>
      <div className="lb-outer">
      <div className="lb-frame">
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse at 15% 0%,rgba(108,140,255,0.03),transparent 40%)" }} />

      <div className="lb-root" style={{ position: "relative", zIndex: 1 }}>
        <div className="lb-shell">
          {/* Sidenav */}
          <nav className="lb-sidenav">
            <div className="lb-logo" />
            {NAV_ITEMS.map(n => (
              <div key={n.id} className={`lb-nav-item${n.active ? " active" : ""}`} onClick={() => navigate(n.id)} title={n.id}>{n.icon}</div>
            ))}
            <div className="lb-nav-spacer" />
            <div className="lb-nav-item" onClick={() => navigate("settings")}>⚙</div>
          </nav>

          <div className="lc-layout">
            {/* Left panel */}
            <aside className="lc-left">
              {/* Mini calendar */}
              <div className="lc-cal-pad">
                <div className="lc-cal-head">
                  <div className="lc-cal-title">{MONTH_NAMES[cm - 1]} {cy}</div>
                  <div className="lc-cal-nav">
                    <span onClick={prevCalMonth}>‹</span>
                    <span onClick={nextCalMonth}>›</span>
                  </div>
                </div>
                <div className="lc-cal-dow">
                  {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <div className="lc-cal-grid">
                  {cells.map((c, i) => {
                    let cls = "lc-day";
                    if (c.muted)   cls += " muted";
                    if (c.isToday) cls += " today";
                    if (!c.muted && c.day === selectedDay) cls += " selected";
                    if (c.hasMix)  cls += " has-mix";
                    else if (c.hasBill) cls += " has-bill";
                    else if (c.hasInc)  cls += " has-inc";
                    return (
                      <div key={i} className={cls} onClick={() => !c.muted && setSelectedDay(c.day)}>
                        {c.day}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Month stats */}
              <div className="lc-stats">
                <div className="lc-stat-row">
                  <span className="lc-stat-l">Month spent</span>
                  <span className="lc-stat-v" style={{ color: "var(--debt)" }}>−{fmt(monthSpent)}</span>
                </div>
                <div className="lc-stat-row">
                  <span className="lc-stat-l">Month income</span>
                  <span className="lc-stat-v" style={{ color: "var(--safe)" }}>+{fmt(monthIncome)}</span>
                </div>
                <div className="lc-stat-row">
                  <span className="lc-stat-l">Bills remaining</span>
                  <span className="lc-stat-v" style={{ color: monthBillsRem > 0 ? "var(--warn)" : "var(--ink-3)" }}>
                    {monthBillsRem > 0 ? `−${fmt(monthBillsRem)}` : "—"}
                  </span>
                </div>
                <div className="lc-stat-row">
                  <span className="lc-stat-l">Net</span>
                  <span className="lc-stat-v" style={{ color: monthIncome - monthSpent >= 0 ? "var(--safe)" : "var(--debt)" }}>
                    {monthIncome - monthSpent >= 0 ? "+" : "−"}{fmt(Math.abs(monthIncome - monthSpent))}
                  </span>
                </div>
              </div>

              {/* Recurring items */}
              <div className="lc-recurring-lbl">Recurring this month</div>
              {recurringItems
                .filter(r => r.recurringDay)
                .sort((a, b) => (parseInt(a.recurringDay) || 0) - (parseInt(b.recurringDay) || 0))
                .map(r => (
                  <div key={r.id} className="lc-ri-item" onClick={() => openEditRecurringItem && openEditRecurringItem(r)}
                    style={{ cursor: "pointer" }}>
                    <div>
                      <div className="lc-ri-day">{r.recurringDay}</div>
                      <div style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.5px", textTransform: "uppercase", marginTop: 2 }}>
                        {DAY_NAMES[new Date(cy, cm - 1, r.recurringDay).getDay()]}
                      </div>
                    </div>
                    <div>
                      <div className="lc-ri-name">{r.name}</div>
                      <div className="lc-ri-amt" style={{ color: r.type === "income" ? "var(--safe)" : "var(--debt)" }}>
                        {r.type === "income" ? "+" : "−"}{fmt(r.amountMin || 0)}
                        {r.amountMax && r.amountMax !== r.amountMin ? `–${fmt(r.amountMax)}` : ""}
                      </div>
                    </div>
                  </div>
                ))}

              <div className="lc-ri-add" onClick={openNewRecurringItem}>+ Add Recurring Item</div>
            </aside>

            {/* Right — agenda */}
            <div className="lc-right">
              {/* Topbar */}
              <div className="lc-topbar">
                <div className="lc-topbar-left">
                  <span className="lc-label">iv ·</span>
                  <span className="lc-title">Calendar</span>
                  <span className="lc-div" />
                  <span className="lc-sub">{MONTH_NAMES[cm - 1]} {cy}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="lc-btn" onClick={prevCalMonth}>‹ Prev</button>
                  {!isCurrentMonth && <button className="lc-btn primary" onClick={() => { /* jump to today */ }}>Today</button>}
                  <button className="lc-btn" onClick={nextCalMonth}>Next ›</button>
                </div>
              </div>

              <div className="lc-agenda-content">
                {agendaDays.length === 0 ? (
                  <div style={{ padding: "80px 0", textAlign: "center", color: "var(--ink-3)" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginBottom: 8, color: "var(--ink-2)" }}>Nothing scheduled</div>
                    <div style={{ fontSize: 13 }}>Add recurring items to see them here</div>
                  </div>
                ) : agendaDays.map(d => {
                  const dayTxns = calendarTxnsByDay[d] || [];
                  const dayRIs  = recurringItems.filter(r => parseInt(r.recurringDay) === d);
                  const isToday = isCurrentMonth && d === today.getDate();
                  const dow     = DAY_NAMES[new Date(cy, cm - 1, d).getDay()];

                  return (
                    <div key={d} className="lc-agenda-day" id={`day-${d}`}>
                      <div className="lc-day-header">
                        <div>
                          <div className={`lc-day-num${isToday ? " today" : ""}`}>{d}</div>
                          <div className="lc-day-dow" style={{ color: isToday ? "var(--safe)" : "var(--ink-3)" }}>{dow}</div>
                        </div>
                        <div />
                      </div>

                      {isToday && (
                        <div className="lc-today-marker">today</div>
                      )}

                      {/* Recurring items for this day */}
                      {dayRIs.map(r => (
                        <div key={r.id} className="lc-event" onClick={() => openEditRecurringItem && openEditRecurringItem(r)}
                          style={{ cursor: "pointer" }}>
                          <div className="lc-event-left">
                            <div className={`lc-event-ico ${r.type === "income" ? "income" : "recurring"}`}>
                              {r.type === "income" ? "↗" : "↻"}
                            </div>
                            <div className="lc-event-info">
                              <div className="lc-event-name">{r.name}</div>
                              <div className="lc-event-sub">recurring · {r.recurringFreq || "monthly"}</div>
                            </div>
                          </div>
                          <div className="lc-event-right">
                            <span className={`lc-event-amt ${r.type === "income" ? "income" : "expense"}`}>
                              {r.type === "income" ? "+" : "−"}{fmt(r.amountMin || 0)}
                            </span>
                            <span className="lc-event-status upcoming">upcoming</span>
                          </div>
                        </div>
                      ))}

                      {/* Actual transactions */}
                      {dayTxns.map(t => {
                        const cat = catMap[t.categoryId];
                        const isInc = t.amount > 0;
                        return (
                          <div key={t.id} className="lc-event">
                            <div className="lc-event-left">
                              <div className={`lc-event-ico ${isInc ? "income" : "bill"}`}>
                                {isInc ? "↗" : "↙"}
                              </div>
                              <div className="lc-event-info">
                                <div className="lc-event-name">{t.name || t.merchant}</div>
                                <div className="lc-event-sub">
                                  {cat ? cat.name : "uncategorized"}
                                  {t.recurring ? " · ↻" : ""}
                                </div>
                              </div>
                            </div>
                            <div className="lc-event-right">
                              <span className={`lc-event-amt ${isInc ? "income" : "expense"}`}>
                                {isInc ? "+" : "−"}{fmt(Math.abs(t.amount))}
                              </span>
                              <span className="lc-event-status posted">posted ✓</span>
                            </div>
                          </div>
                        );
                      })}

                      {dayTxns.length === 0 && dayRIs.length === 0 && (
                        <div className="lc-empty-day">No activity</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>{/* /lb-frame */}
      </div>{/* /lb-outer */}
    </>
  );
}
