/**
 * LedgrBriefing.jsx
 *
 * Dashboard concept 2 — "The Briefing" — implemented for Ledgr.
 * Drop this file into src/components/ and render it wherever DashboardContent
 * currently lives (swap in App.jsx or add a route).
 *
 * Props mirror what DashboardContent already receives:
 *   accounts        {Array}   — from state
 *   categories      {Array}   — with .id, .name, .color, .icon, .limit
 *   monthTxns       {Array}   — transactions for the selected month
 *   recurringItems  {Array}   — { name, amountMin, amountMax, recurringDay, recurringFreq, type, linkedTxnIds }
 *   totalSpent      {number}
 *   totalIncome     {number}
 *   totalBudget     {number}
 *   goals           {Array}   — { id, title, targetAmount, savedAmount }
 *   today           {Date}
 *   fmt             {Function} — currency formatter  e.g. n => "$1,234"
 *   navigate        {Function} — internal nav callback
 *   isMobile        {boolean}
 */

import { useState, useMemo } from "react";

/* ─── design tokens (matches lumen-dashboards.html concept 2) ─── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');

  .lb-root {
    --bg-0: #07090d;
    --bg-1: #0b0e14;
    --bg-2: #11151d;
    --bg-3: #161c26;
    --bg-4: #1c2330;
    --line:   rgba(255,255,255,0.06);
    --line-2: rgba(255,255,255,0.10);
    --line-3: rgba(255,255,255,0.18);
    --ink-0: #f4f4f1;
    --ink-1: #c8cdd6;
    --ink-2: #7d8594;
    --ink-3: #4a5161;
    --ink-4: #2e3340;
    --safe:    #5dcaa5; --safe-d:  #0f6e56; --safe-bg:  rgba(93,202,165,0.08);
    --warn:    #f0b04c; --warn-d:  #6b4708; --warn-bg:  rgba(240,176,76,0.08);
    --debt:    #e87363; --debt-d:  #5a1c14; --debt-bg:  rgba(232,115,99,0.08);
    --calm:    #6c8cff; --calm-d:  #1a2a66; --calm-bg:  rgba(108,140,255,0.08);
    --goal:    #a78bff; --goal-d:  #2a1f5e; --goal-bg:  rgba(167,139,255,0.08);
    --quiet:   #b4b2a9;
    --font-display: 'Instrument Serif', Georgia, serif;
    --font-ui:      'Geist', -apple-system, sans-serif;
    --font-mono:    'JetBrains Mono', ui-monospace, monospace;
    --r-sm: 6px; --r-md: 10px; --r-lg: 14px; --r-xl: 20px;

    font-family: var(--font-ui);
    background: var(--bg-0);
    color: var(--ink-0);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .lb-page       { background: var(--bg-0); min-height: 100vh; padding: 40px 48px 80px; }
  .lb-frame      { background: var(--bg-1); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 24px 80px rgba(0,0,0,0.4); }
  .lb-frame-bar  { height: 40px; background: var(--bg-2); border-bottom: 1px solid var(--line); display: flex; align-items: center; padding: 0 18px; gap: 8px; flex-shrink: 0; }
  .lb-frame-dot  { width: 9px; height: 9px; border-radius: 50%; background: var(--ink-4); }
  .lb-frame-url  { margin-left: 14px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); letter-spacing: 0.4px; }
  .lb-frame-live { margin-left: auto; display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }
  .lb-frame-live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--safe); box-shadow: 0 0 8px var(--safe); display: inline-block; }
  @media(max-width: 1000px) { .lb-page { padding: 20px 16px 60px; } }
  @media(max-width: 600px)  { .lb-page { padding: 0; } .lb-frame { border-radius: 0; border: none; } }
  /* layout shell */
  .lb-shell   { display: flex; flex: 1; position: relative; }
  .lb-sidenav { width: 64px; border-right: 1px solid var(--line); background: var(--bg-1);
                padding: 24px 0; display: flex; flex-direction: column; align-items: center; gap: 4px;
                flex-shrink: 0; }
  .lb-logo    { width: 28px; height: 28px; border-radius: 50%;
                background: radial-gradient(circle at 30% 30%, var(--safe), var(--safe-d) 80%);
                margin-bottom: 24px; flex-shrink: 0; }
  .lb-nav-item { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center;
                 justify-content: center; color: var(--ink-3); font-size: 17px; cursor: pointer;
                 transition: background 0.15s, color 0.15s; user-select: none; }
  .lb-nav-item:hover   { color: var(--ink-1); background: var(--bg-2); }
  .lb-nav-item.active  { color: var(--safe);  background: var(--safe-bg); }
  .lb-nav-spacer { flex: 1; }

  /* left agenda */
  .lb-agenda  { width: 300px; border-right: 1px solid var(--line); background: var(--bg-1);
                padding: 24px 20px; overflow-y: auto; flex-shrink: 0; }

  /* mini calendar */
  .lb-cal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .lb-cal-title { font-family: var(--font-display); font-size: 20px; letter-spacing: -0.3px; }
  .lb-cal-nav   { display: flex; gap: 6px; }
  .lb-cal-nav span { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--line);
                     display: flex; align-items: center; justify-content: center; color: var(--ink-2);
                     font-size: 11px; cursor: pointer; }
  .lb-cal-dow  { display: grid; grid-template-columns: repeat(7,1fr); margin-bottom: 6px; }
  .lb-cal-dow span { font-size: 9px; color: var(--ink-3); text-align: center; letter-spacing: 0.4px; }
  .lb-cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; }
  .lb-day      { aspect-ratio: 1; border-radius: 6px; display: flex; flex-direction: column;
                 align-items: center; justify-content: center; font-size: 12px; color: var(--ink-1);
                 font-family: var(--font-mono); position: relative; cursor: pointer; }
  .lb-day.muted  { color: var(--ink-4); }
  .lb-day.today  { background: var(--bg-3); color: var(--safe); border: 1px solid rgba(93,202,165,0.3); }
  .lb-day::after { content: ''; position: absolute; bottom: 3px; width: 4px; height: 4px; border-radius: 50%; display: none; }
  .lb-day.has-bill::after  { display: block; background: var(--debt); }
  .lb-day.has-inc::after   { display: block; background: var(--safe); }
  .lb-day.has-mix::after   { display: block; background: var(--warn); box-shadow: 5px 0 0 var(--debt); }

  /* mini stats */
  .lb-mini-stats { border-top: 1px solid var(--line); padding-top: 16px; display: flex; flex-direction: column; gap: 10px; }
  .lb-mini-stats .row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
  .lb-mini-stats .l   { color: var(--ink-2); }
  .lb-mini-stats .v   { font-family: var(--font-mono); }
  .lb-mini-stats .v.debt { color: var(--debt); }
  .lb-mini-stats .v.safe { color: var(--safe); }
  .lb-mini-stats .v.calm { color: var(--calm); }

  /* paycheck planning */
  .lb-paycheck-lbl { font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase; color: var(--ink-3); margin-bottom: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); }
  .lb-paycheck-card { background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px;
                      padding: 12px; display: grid; grid-template-columns: 60px 1fr 16px; gap: 12px;
                      align-items: center; margin-bottom: 8px; }
  .lb-paycheck-days  { font-size: 11px; color: var(--ink-2); }
  .lb-paycheck-range { font-family: var(--font-display); font-size: 16px; color: var(--ink-0); }
  .lb-paycheck-add   { margin-top: 14px; padding: 14px; border: 1px solid rgba(240,176,76,0.25);
                       border-radius: 8px; text-align: center; color: var(--warn); font-size: 12px; cursor: pointer; }

  /* main content */
  .lb-main   { flex: 1; padding: 36px 52px; overflow-y: auto; min-width: 0; }

  /* topbar */
  .lb-topbar { border-bottom: 1px solid var(--line); padding-bottom: 20px; margin-bottom: 28px;
               display: flex; align-items: center; justify-content: space-between; }
  .lb-topbar-left  { display: flex; align-items: baseline; gap: 16px; }
  .lb-topbar-label { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }
  .lb-topbar-title { font-family: var(--font-display); font-size: 22px; letter-spacing: -0.3px; }
  .lb-topbar-div   { width: 1px; height: 14px; background: var(--line-2); }
  .lb-topbar-sub   { font-size: 11px; color: var(--ink-3); letter-spacing: 1.5px; text-transform: uppercase; }
  .lb-topbar-right { display: flex; align-items: center; gap: 14px; }
  .lb-search  { background: var(--bg-2); border: 1px solid var(--line); border-radius: 8px;
                padding: 7px 14px; font-size: 12px; color: var(--ink-3); font-family: var(--font-mono);
                display: flex; align-items: center; gap: 8px; min-width: 220px; }
  .lb-kbd     { margin-left: auto; font-size: 10px; padding: 1px 6px; background: var(--bg-3);
                border-radius: 4px; color: var(--ink-3); }
  .lb-avatar  { width: 30px; height: 30px; border-radius: 50%;
                background: linear-gradient(135deg, var(--goal-d), var(--goal));
                font-size: 11px; display: flex; align-items: center; justify-content: center;
                color: var(--ink-0); font-weight: 500; flex-shrink: 0; }

  /* eyebrow */
  .lb-eyebrow { font-size: 10px; letter-spacing: 1.8px; text-transform: uppercase; color: var(--ink-3);
                font-weight: 500; margin-bottom: 8px; }

  /* hero headline */
  .lb-headline { font-family: var(--font-display); font-size: 52px; line-height: 1.02;
                 letter-spacing: -1.5px; font-weight: 400; margin-bottom: 20px; }
  .lb-headline .green { font-style: italic; color: var(--safe); }
  .lb-deck    { font-size: 16px; color: var(--ink-1); line-height: 1.65; max-width: 580px; margin-bottom: 28px; }
  .lb-deck .amt  { font-style: normal; font-family: var(--font-mono); color: var(--safe); }
  .lb-deck .debt { font-style: normal; font-family: var(--font-mono); color: var(--debt); }
  .lb-deck .calm { font-style: normal; font-family: var(--font-mono); color: var(--calm); }

  /* callout box */
  .lb-callout { background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--r-xl);
                padding: 28px; display: grid; grid-template-columns: 220px 1fr; gap: 28px; align-items: center; }
  .lb-callout-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; }
  .lb-stat    { border-left: 1px solid var(--line-2); padding-left: 14px; }
  .lb-stat .l { font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase; color: var(--ink-3); }
  .lb-stat .v { font-family: var(--font-mono); font-size: 18px; margin-top: 3px; }
  .lb-stat .v.debt { color: var(--debt); }
  .lb-stat .v.safe { color: var(--safe); }
  .lb-stat .v.calm { color: var(--calm); }
  .lb-stat .s { font-size: 11px; color: var(--ink-3); margin-top: 2px; }

  /* allocation bar */
  .lb-alloc   { margin-top: 28px; background: var(--bg-2); border: 1px solid var(--line);
                border-radius: var(--r-lg); padding: 22px 24px; }
  .lb-alloc-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
  .lb-alloc-head h4 { font-family: var(--font-display); font-size: 24px; font-weight: 400; letter-spacing: -0.4px; }
  .lb-alloc-head h4 em { font-style: italic; color: var(--safe); }
  .lb-alloc-head .total { font-family: var(--font-mono); font-size: 13px; color: var(--ink-2); }
  .lb-alloc-track { display: flex; gap: 2px; height: 32px; border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
  .lb-alloc-track .seg { display: flex; align-items: center; padding: 0 10px; font-family: var(--font-mono);
                         font-size: 11px; overflow: hidden; white-space: nowrap; min-width: 0; }
  .lb-alloc-track .seg.free    { background: rgba(93,202,165,0.18); color: var(--safe); }
  .lb-alloc-track .seg.bills   { background: rgba(232,115,99,0.18); color: var(--debt); }
  .lb-alloc-track .seg.cushion { background: rgba(108,140,255,0.18); color: var(--calm); }
  .lb-alloc-track .seg.goals   { background: rgba(167,139,255,0.18); color: var(--goal); }
  .lb-alloc-track .seg.flex    { background: rgba(240,176,76,0.18); color: var(--warn); }
  .lb-alloc-legend { display: flex; gap: 18px; font-size: 11px; color: var(--ink-3); flex-wrap: wrap; }
  .lb-alloc-legend span { display: flex; align-items: center; gap: 6px; }

  /* dot led */
  .lb-led      { width: 6px; height: 6px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .lb-led.safe { background: var(--safe); box-shadow: 0 0 6px var(--safe); }
  .lb-led.debt { background: var(--debt); }
  .lb-led.calm { background: var(--calm); }
  .lb-led.goal { background: var(--goal); }
  .lb-led.warn { background: var(--warn); }

  /* what-if */
  .lb-whatif       { margin-top: 24px; }
  .lb-whatif-head  { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .lb-whatif-head h4 { font-family: var(--font-display); font-size: 24px; font-weight: 400; letter-spacing: -0.4px; }
  .lb-whatif-head h4 em { font-style: italic; color: var(--safe); }
  .lb-whatif-hint  { font-size: 11px; color: var(--ink-3); font-family: var(--font-mono); }
  .lb-whatif-row   { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
  .lb-whatif-card  { background: var(--bg-2); border: 1px solid var(--line); border-radius: var(--r-md);
                     padding: 16px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .lb-whatif-card.selected { border-color: rgba(93,202,165,0.4); background: rgba(93,202,165,0.04); }
  .lb-whatif-card:hover    { border-color: var(--line-3); }
  .lb-whatif-nm   { font-size: 13px; color: var(--ink-1); line-height: 1.4; margin-bottom: 8px; }
  .lb-whatif-delta { display: flex; justify-content: space-between; align-items: center;
                     font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--ink-3); }
  .lb-whatif-delta .v { font-family: var(--font-mono); font-size: 14px; letter-spacing: 0; }
  .lb-whatif-delta .v.pos { color: var(--safe); }
  .lb-whatif-delta .v.neg { color: var(--debt); }

  /* pill */
  .lb-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 4px 10px;
             border-radius: 999px; font-family: var(--font-mono); }
  .lb-pill.safe { background: var(--safe-bg); color: var(--safe); }
  .lb-pill.warn { background: var(--warn-bg); color: var(--warn); }
  .lb-pill.debt { background: var(--debt-bg); color: var(--debt); }

  /* mobile */
  @media (max-width: 1100px) {
    .lb-agenda   { display: none; }
    .lb-callout  { grid-template-columns: 1fr; }
    .lb-whatif-row { grid-template-columns: 1fr 1fr; }
    .lb-headline { font-size: 36px; letter-spacing: -0.8px; }
  }
  @media (max-width: 700px) {
    .lb-sidenav  { display: none; }
    .lb-main     { padding: 20px 16px; }
    .lb-whatif-row { grid-template-columns: 1fr; }
  }
`;

/* ─── helpers ─────────────────────────────────────────────── */
const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];
const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function fmtShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`;
  return `$${Math.round(abs).toLocaleString()}`;
}

function daysUntil(targetDay, today) {
  const t = today.getDate();
  const daysInMo = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  if (targetDay >= t) return targetDay - t;
  return daysInMo - t + targetDay; // next month
}

/* ─── Gauge SVG ────────────────────────────────────────────── */
function PressureGauge({ pressurePct = 0.35 }) {
  // pressurePct: 0 = max tight (left), 1 = ahead (right)
  // needle angle: -90° (tight) to +90° (ahead), safe zone near 0
  const angle = -90 + pressurePct * 180;
  return (
    <svg viewBox="0 0 220 160" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <linearGradient id="lbGaugeGrad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0"    stopColor="#e87363"/>
          <stop offset="0.45" stopColor="#f0b04c"/>
          <stop offset="0.7"  stopColor="#5dcaa5"/>
          <stop offset="1"    stopColor="#6c8cff"/>
        </linearGradient>
      </defs>
      {/* track */}
      <path d="M 30 120 A 80 80 0 0 1 190 120" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="none" strokeLinecap="round"/>
      {/* color arc */}
      <path d="M 30 120 A 80 80 0 0 1 190 120" stroke="url(#lbGaugeGrad)" strokeWidth="12" fill="none" strokeLinecap="round"/>
      {/* needle */}
      <g transform={`rotate(${angle} 110 120)`}>
        <line x1="110" y1="120" x2="110" y2="50" stroke="#f4f4f1" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="110" cy="50" r="3.5" fill="#f4f4f1"/>
      </g>
      {/* center */}
      <circle cx="110" cy="120" r="9"   fill="#11151d" stroke="rgba(255,255,255,0.2)"/>
      <circle cx="110" cy="120" r="3.5" fill="#5dcaa5"/>
      {/* labels */}
      <text x="30"  y="138" fontSize="9" fill="#e87363" fontFamily="JetBrains Mono" textAnchor="middle">TIGHT</text>
      <text x="110" y="32"  fontSize="9" fill="#5dcaa5" fontFamily="JetBrains Mono" textAnchor="middle">SAFE</text>
      <text x="190" y="138" fontSize="9" fill="#6c8cff" fontFamily="JetBrains Mono" textAnchor="middle">AHEAD</text>
    </svg>
  );
}

/* ─── Mini Calendar ────────────────────────────────────────── */
function MiniCalendar({ today, billDays = new Set(), incDays = new Set(), mixDays = new Set() }) {
  const [calMonth, setCalMonth] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const prevM = () => setCalMonth(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
  const nextM = () => setCalMonth(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });

  const { y, m } = calMonth;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInM  = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const isCurrentMonth = y === today.getFullYear() && m === today.getMonth();

  const cells = [];
  // leading
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, muted: true });
  }
  // current month
  for (let d = 1; d <= daysInM; d++) {
    cells.push({ day: d, muted: false,
      isToday: isCurrentMonth && d === today.getDate(),
      hasBill: isCurrentMonth && billDays.has(d),
      hasInc:  isCurrentMonth && incDays.has(d),
      hasMix:  isCurrentMonth && mixDays.has(d),
    });
  }
  // trailing
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) cells.push({ day: d, muted: true });

  return (
    <div style={{ marginBottom: 22 }}>
      <div className="lb-cal-head">
        <div className="lb-cal-title">{MONTH_NAMES[m]} {y}</div>
        <div className="lb-cal-nav">
          <span onClick={prevM}>‹</span>
          <span onClick={nextM}>›</span>
        </div>
      </div>
      <div className="lb-cal-dow">
        {["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="lb-cal-grid">
        {cells.map((c, i) => {
          let cls = "lb-day";
          if (c.muted)   cls += " muted";
          if (c.isToday) cls += " today";
          if (c.hasMix)  cls += " has-mix";
          else if (c.hasBill) cls += " has-bill";
          else if (c.hasInc)  cls += " has-inc";
          return <div key={i} className={cls}>{c.day}</div>;
        })}
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────── */
export default function LedgrBriefing({
  accounts        = [],
  categories      = [],
  monthTxns       = [],
  recurringItems  = [],
  totalSpent      = 0,
  totalIncome     = 0,
  totalBudget     = 0,
  goals           = [],
  today           = new Date(),
  fmt             = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Math.abs(n)),
  navigate        = () => {},
  isMobile        = false,
}) {
  const [selectedWhatIf, setSelectedWhatIf] = useState(0);

  /* ── computed financials ─────────────────────────────────── */
  const totalBalance = useMemo(
    () => accounts.reduce((s, a) => s + (a.balance || 0), 0),
    [accounts]
  );

  const checkingBalance = useMemo(
    () => accounts.filter(a => a.type === "checking" || a.type === "savings")
                  .reduce((s, a) => s + (a.balance || 0), 0),
    [accounts]
  );

  // Upcoming bills: recurring items whose day is >= today that haven't posted this month
  const todayDate = today.getDate();
  const curY = today.getFullYear();
  const curM = today.getMonth() + 1;

  const upcomingBills = useMemo(() => {
    return recurringItems
      .filter(item => {
        if (item.type === "income" || !item.recurringDay) return false;
        // has it already posted this month?
        const posted = (item.linkedTxnIds || []).some(id => {
          const t = monthTxns.find(x => x.id === id);
          if (!t?.date) return false;
          const [ty, tm] = t.date.split("-").map(Number);
          return ty === curY && tm === curM;
        });
        return !posted;
      })
      .sort((a, b) => (parseInt(a.recurringDay) || 0) - (parseInt(b.recurringDay) || 0));
  }, [recurringItems, monthTxns, curY, curM]);

  const upcomingIncome = useMemo(() => {
    return recurringItems
      .filter(item => {
        if (item.type !== "income" || !item.recurringDay) return false;
        const posted = (item.linkedTxnIds || []).some(id => {
          const t = monthTxns.find(x => x.id === id);
          if (!t?.date) return false;
          const [ty, tm] = t.date.split("-").map(Number);
          return ty === curY && tm === curM;
        });
        return !posted;
      })
      .sort((a, b) => (parseInt(a.recurringDay) || 0) - (parseInt(b.recurringDay) || 0));
  }, [recurringItems, monthTxns, curY, curM]);

  // Bills in the next paycheck window (days remaining this month)
  const scheduledBillsTotal = useMemo(
    () => upcomingBills.reduce((s, b) => s + (b.amountMin || 0), 0),
    [upcomingBills]
  );

  // Next paycheck
  const nextPaycheck = useMemo(() => {
    if (!upcomingIncome.length) return null;
    return upcomingIncome[0];
  }, [upcomingIncome]);

  const nextPayDay = nextPaycheck?.recurringDay || null;
  const daysToPayday = nextPayDay ? daysUntil(nextPayDay, today) : null;

  // Safe-to-spend: checking balance minus scheduled bills until next paycheck
  const safeToSpend = useMemo(() => {
    const base = Math.max(0, checkingBalance - scheduledBillsTotal);
    return Math.round(base);
  }, [checkingBalance, scheduledBillsTotal]);

  const dailyPace = daysToPayday && daysToPayday > 0
    ? Math.round(safeToSpend / daysToPayday)
    : null;

  // Pressure: ratio of scheduled bills to total balance (0 = tight, 1 = ahead)
  const pressurePct = useMemo(() => {
    if (!checkingBalance) return 0.5;
    const ratio = scheduledBillsTotal / (checkingBalance || 1);
    return Math.max(0, Math.min(1, 1 - ratio * 0.8));
  }, [scheduledBillsTotal, checkingBalance]);

  const pressureLabel = pressurePct > 0.65 ? "low" : pressurePct > 0.4 ? "moderate" : "high";
  const pressureVariant = pressurePct > 0.65 ? "safe" : pressurePct > 0.4 ? "warn" : "debt";

  // Goals total saved
  const goalsSaved = useMemo(() => goals.reduce((s, g) => s + (g.savedAmount || 0), 0), [goals]);

  // Allocation bar: free | bills | savings | goals | flex
  const cushion   = Math.max(0, checkingBalance * 0.1);
  const flex      = Math.max(0, totalSpent * 0.05);
  const allocFree = safeToSpend;
  const allocBill = scheduledBillsTotal;
  const allocCush = Math.round(cushion);
  const allocGoal = Math.round(goalsSaved * 0.1); // monthly goal contribution proxy
  const allocFlex = Math.round(flex);
  const allocTotal = allocFree + allocBill + allocCush + allocGoal + allocFlex;

  // Calendar bill/income days from recurring items
  const billDays = useMemo(() => {
    const s = new Set();
    recurringItems.filter(r => r.type !== "income" && r.recurringDay).forEach(r => s.add(parseInt(r.recurringDay)));
    return s;
  }, [recurringItems]);
  const incDays = useMemo(() => {
    const s = new Set();
    recurringItems.filter(r => r.type === "income" && r.recurringDay).forEach(r => s.add(parseInt(r.recurringDay)));
    return s;
  }, [recurringItems]);
  const mixDays = useMemo(() => {
    const s = new Set();
    billDays.forEach(d => { if (incDays.has(d)) s.add(d); });
    return s;
  }, [billDays, incDays]);

  // What-if scenarios derived from data
  const whatIfScenarios = useMemo(() => {
    const diningCat = categories.find(c => c.name?.toLowerCase().includes("dining") || c.name?.toLowerCase().includes("restaurant"));
    const diningSpent = diningCat ? (monthTxns.filter(t => t.categoryId === diningCat.id && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)) : 0;
    const diningWeekly = Math.round(diningSpent / 4);
    const cardBill = upcomingBills.find(b => b.name?.toLowerCase().includes("card") || b.name?.toLowerCase().includes("credit"));
    const cardAmt  = cardBill ? (cardBill.amountMin || 0) : 0;
    return [
      { nm: "Skip dining out for the rest of the week",  delta: diningWeekly || 86,    pos: true  },
      { nm: "Move card payment to next cycle",            delta: cardAmt || 336,        pos: true  },
      { nm: "$200 weekend getaway",                       delta: 200,                   pos: false },
      { nm: "Auto-save $150 to emergency fund",           delta: 150,                   pos: false },
    ];
  }, [categories, monthTxns, upcomingBills]);

  // Paycheck planning rows
  const daysInMonth = new Date(curY, curM, 0).getDate();
  const halfIncome  = nextPaycheck ? (nextPaycheck.amountMin || 0) : (totalIncome / 2);
  const halfBills   = scheduledBillsTotal / 2;

  // Today label
  const todayLabel = `${DAY_NAMES[today.getDay()]}, ${MONTH_NAMES[today.getMonth()]} ${today.getDate()} · ${today.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

  // User initials from first account institution or fallback
  const initials = accounts[0]?.institution
    ? accounts[0].institution.slice(0, 2).toUpperCase()
    : "ME";

  /* ── render ────────────────────────────────────────────────── */
  return (
    <>
      <style>{CSS}</style>

      {/* ambient glow */}
      <div className="lb-page">
        <div className="lb-frame">
          <div className="lb-frame-bar">
            <div className="lb-frame-dot"/><div className="lb-frame-dot"/><div className="lb-frame-dot"/>
            <span className="lb-frame-url">app.ledgr.app / home</span>
            <span className="lb-frame-live">live · synced just now</span>
          </div>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse at 15% 0%, rgba(108,140,255,0.03), transparent 40%), radial-gradient(ellipse at 85% 100%, rgba(93,202,165,0.025), transparent 50%)",
      }}/>

      <div className="lb-root" style={{ position: "relative", zIndex: 1 }}>
        {/* browser chrome bar */}
        <div style={{
          height: 40, background: "var(--bg-2)", borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "center", padding: "0 18px", gap: 8,
        }}>
          {[1,2,3].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--ink-4)" }}/>)}
          <span style={{ marginLeft: 14, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.4px" }}>
            app.ledgr.app / home
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--safe)", boxShadow: "0 0 8px var(--safe)", display: "inline-block" }}/>
              live · synced just now
            </span>
          </div>
        </div>

        <div className="lb-shell">
          {/* side nav */}
          <nav className="lb-sidenav">
            <div className="lb-logo"/>
            {[
              { icon: "◐", id: "dashboard",    active: true  },
              { icon: "▦", id: "calendar",     active: false },
              { icon: "◇", id: "accounts",     active: false },
              { icon: "⌥", id: "transactions", active: false },
              { icon: "◆", id: "goals",        active: false },
            ].map(n => (
              <div key={n.id} className={`lb-nav-item${n.active ? " active" : ""}`}
                   onClick={() => navigate(n.id)} title={n.id}>
                {n.icon}
              </div>
            ))}
            <div className="lb-nav-spacer"/>
            <div className="lb-nav-item" onClick={() => navigate("settings")}>⚙</div>
          </nav>

          {/* left agenda panel */}
          <aside className="lb-agenda">
            <MiniCalendar today={today} billDays={billDays} incDays={incDays} mixDays={mixDays}/>

            <div className="lb-mini-stats">
              <div className="row">
                <span className="l">Monthly expenses</span>
                <span className="v debt">{fmt(totalSpent)}</span>
              </div>
              <div className="row">
                <span className="l">Expected income</span>
                <span className="v safe">+{fmt(totalIncome)}</span>
              </div>
              <div className="row">
                <span className="l">Posted so far</span>
                <span className="v">{fmt(Math.abs(totalBalance - safeToSpend))}</span>
              </div>
              <div className="row">
                <span className="l">Safe to spend</span>
                <span className="v calm">{fmt(safeToSpend)}</span>
              </div>
            </div>

            {/* paycheck planning */}
            <div className="lb-paycheck-lbl">Paycheck planning</div>

            {/* first half */}
            <div className="lb-paycheck-card">
              <div>
                <div className="lb-paycheck-days">Days</div>
                <div className="lb-paycheck-range">1 – 15</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--safe)", fontSize: 13 }}>
                  +{fmt(halfIncome)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--debt)", fontSize: 13 }}>
                  −{fmt(halfBills)}
                </span>
              </div>
              <span style={{ color: "var(--ink-3)", fontSize: 14 }}>▾</span>
            </div>

            {/* second half */}
            <div className="lb-paycheck-card">
              <div>
                <div className="lb-paycheck-days">Days</div>
                <div className="lb-paycheck-range" style={{ lineHeight: 1.1 }}>16 –<br/>End</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--safe)", fontSize: 13 }}>
                  +{fmt(halfIncome)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--debt)", fontSize: 13 }}>
                  −{fmt(scheduledBillsTotal - halfBills)}
                </span>
              </div>
              <span style={{ color: "var(--ink-3)", fontSize: 14 }}>▾</span>
            </div>

            <div className="lb-paycheck-add" onClick={() => navigate("calendar")}>
              + Add Recurring Item
            </div>
          </aside>

          {/* main content */}
          <main className="lb-main">
            {/* topbar */}
            <div className="lb-topbar">
              <div className="lb-topbar-left">
                <span className="lb-topbar-label">ii ·</span>
                <span className="lb-topbar-title" style={{ fontFamily: "var(--font-display)" }}>Briefing</span>
                <span className="lb-topbar-div"/>
                <span className="lb-topbar-sub">{todayLabel}</span>
              </div>
              <div className="lb-topbar-right">
                <div className="lb-search">
                  <span style={{ color: "var(--ink-2)" }}>⌕</span>
                  ask anything…
                  <span className="lb-kbd">⌘ K</span>
                </div>
                <div className="lb-avatar">{initials}</div>
              </div>
            </div>

            {/* hero section */}
            <div style={{ marginBottom: 28 }}>
              <div className="lb-eyebrow">
                Good {today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening"} · the headline
              </div>

              <h2 className="lb-headline">
                After everything you owe, you have{" "}
                <span className="green">{fmt(safeToSpend)}</span> truly free.
              </h2>

              <p className="lb-deck">
                {daysToPayday != null
                  ? <>That's <em className="amt">{daysToPayday} day{daysToPayday !== 1 ? "s" : ""}</em> of room until your next paycheck
                     {nextPayDay ? ` on ${MONTH_NAMES[today.getMonth()]} ${nextPayDay}` : ""}.</>
                  : <>Your funds are calculated across all accounts.</>
                }{" "}
                You've got <em className="debt">{fmt(scheduledBillsTotal)}</em> in scheduled bills already
                accounted for. The pressure gauge is sitting{" "}
                <em className="amt">{pressureLabel}</em>.{" "}
                {upcomingBills.length === 0
                  ? "No surprises in the queue."
                  : `${upcomingBills.length} item${upcomingBills.length > 1 ? "s" : ""} upcoming.`
                }
              </p>

              {/* callout: gauge + stats */}
              <div className="lb-callout">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
                  <PressureGauge pressurePct={pressurePct}/>
                </div>
                <div className="lb-callout-stats">
                  <div className="lb-stat">
                    <div className="l">Safe to spend</div>
                    <div className="v safe">{fmt(safeToSpend)}</div>
                    <div className="s">{daysToPayday != null ? `over ${daysToPayday} days` : "right now"}</div>
                  </div>
                  <div className="lb-stat">
                    <div className="l">Daily pace</div>
                    <div className="v">
                      {dailyPace != null ? `$${dailyPace.toLocaleString()}` : "—"}
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>/d</span>
                    </div>
                    <div className="s">if spread evenly</div>
                  </div>
                  <div className="lb-stat">
                    <div className="l">Bills incoming</div>
                    <div className="v debt">{fmt(scheduledBillsTotal)}</div>
                    <div className="s">{upcomingBills.length} scheduled · all expected</div>
                  </div>
                  <div className="lb-stat">
                    <div className="l">Next paycheck</div>
                    <div className="v calm">
                      {nextPaycheck
                        ? `+${fmt(nextPaycheck.amountMin || 0)}`
                        : accounts.filter(a => a.type === "savings").length
                          ? `+${fmt(accounts.filter(a => a.type === "savings").reduce((s,a)=>s+(a.balance||0),0))}`
                          : "—"
                      }
                    </div>
                    <div className="s">
                      {nextPayDay && daysToPayday != null
                        ? `${MONTH_NAMES[today.getMonth()]} ${nextPayDay} · ${daysToPayday} days`
                        : "check calendar"
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* allocation bar */}
            <div className="lb-alloc">
              <div className="lb-alloc-head">
                <h4>Where your <em>{fmt(allocTotal)}</em> is going</h4>
                <span className="total">total across checking + buffer</span>
              </div>
              <div className="lb-alloc-track">
                <div className="seg free"    style={{ flex: allocFree || 1 }}>
                  {allocFree > allocTotal * 0.15 ? `${fmt(allocFree)} free` : ""}
                </div>
                <div className="seg bills"   style={{ flex: allocBill || 1 }}>
                  {allocBill > allocTotal * 0.15 ? `${fmt(allocBill)} bills` : ""}
                </div>
                {allocCush > 0 && (
                  <div className="seg cushion" style={{ flex: allocCush }}>
                    {allocCush > allocTotal * 0.12 ? `${fmt(allocCush)} cushion` : ""}
                  </div>
                )}
                {allocGoal > 0 && (
                  <div className="seg goals"   style={{ flex: allocGoal }}>
                    {allocGoal > allocTotal * 0.1 ? `${fmt(allocGoal)} goals` : ""}
                  </div>
                )}
                {allocFlex > 0 && (
                  <div className="seg flex"    style={{ flex: allocFlex }}>
                    {allocFlex > allocTotal * 0.08 ? `${fmt(allocFlex)} flex` : ""}
                  </div>
                )}
              </div>
              <div className="lb-alloc-legend">
                <span><span className="lb-led safe"/>&nbsp;Free · safe to spend</span>
                <span><span className="lb-led debt"/>&nbsp;Bills ahead</span>
                <span><span className="lb-led calm"/>&nbsp;Cushion (auto)</span>
                {goals.length > 0 && <span><span className="lb-led goal"/>&nbsp;Goals</span>}
                <span><span className="lb-led warn"/>&nbsp;Flex pool</span>
              </div>
            </div>

            {/* what-if */}
            <div className="lb-whatif">
              <div className="lb-whatif-head">
                <h4>If you <em>did this</em>, what would it look like?</h4>
                <span className="lb-whatif-hint">tap to preview</span>
              </div>
              <div className="lb-whatif-row">
                {whatIfScenarios.map((s, i) => (
                  <div key={i}
                       className={`lb-whatif-card${selectedWhatIf === i ? " selected" : ""}`}
                       onClick={() => setSelectedWhatIf(i)}>
                    <div className="lb-whatif-nm">{s.nm}</div>
                    <div className="lb-whatif-delta">
                      <span>Safe-to-spend</span>
                      <span className={`v ${s.pos ? "pos" : "neg"}`}>
                        {s.pos ? "+" : "−"}${s.delta.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* selected scenario result */}
              {whatIfScenarios[selectedWhatIf] && (
                <div style={{
                  marginTop: 12, padding: "16px 20px", background: "rgba(93,202,165,0.04)",
                  border: "1px solid rgba(93,202,165,0.2)", borderRadius: "var(--r-md)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, color: "var(--ink-2)", fontStyle: "italic" }}>
                    "{whatIfScenarios[selectedWhatIf].nm}"
                  </span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: "-0.8px",
                                 color: whatIfScenarios[selectedWhatIf].pos ? "var(--safe)" : "var(--debt)" }}>
                    {fmt(safeToSpend + (whatIfScenarios[selectedWhatIf].pos ? 1 : -1) * whatIfScenarios[selectedWhatIf].delta)}
                  </span>
                </div>
              )}
            </div>

            {/* bottom padding */}
            <div style={{ height: 48 }}/>
          </main>
        </div>
      </div>
        </div>{/* /lb-frame */}
      </div>{/* /lb-page */}
    </>
  );
}
