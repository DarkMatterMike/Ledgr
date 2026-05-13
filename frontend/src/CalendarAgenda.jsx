/**
 * CalendarAgenda.jsx — Concept 05: Agenda + Mini Cal
 *
 * Layout:
 *   - No outer card/border/container — content sits directly on the page bg
 *   - Padding matches Dashboard: left side starts at 36px (same as tier padding)
 *   - Page header: ghost roman numeral + Playfair italic title (same as Transactions)
 *   - Two-column body: 260px left (mini-cal + stats), flex-1 right (agenda)
 *   - Agenda scrolls with the PAGE, not inside a fixed-height container
 */

import { useState, useEffect, useRef, useMemo } from 'react';

/* ─── helpers ───────────────────────────────────────────────── */
function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* ─── CSS ───────────────────────────────────────────────────── */
function injectCSS() {
  if (document.getElementById('ag-css')) return;
  const s = document.createElement('style');
  s.id = 'ag-css';
  s.textContent = `
  /* ── Two-column body ── */
  .ag-body { display: grid; grid-template-columns: 260px 1fr; gap: 0; align-items: start; }

  /* ── Left panel ── */
  .ag-left {
    position: sticky;
    top: 0;
    background: var(--bg,#0b0a08);
    border-right: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding-bottom: 24px;
  }

  .ag-mini-header { padding: 20px 16px 16px; display: flex; align-items: center; justify-content: space-between; }
  .ag-mini-month  { font-family: var(--font-disp,'Syne',sans-serif); font-size: 15px; font-weight: 700; color: var(--t1,#e8ddd0); }
  .ag-mini-nav    { display: flex; gap: 4px; }
  .ag-mini-nav-btn { background: none; border: none; color: rgba(232,221,208,0.4); cursor: pointer; font-size: 13px; padding: 2px 5px; border-radius: 4px; transition: color .15s; }
  .ag-mini-nav-btn:hover { color: var(--t1,#e8ddd0); background: rgba(255,255,255,0.05); }

  .ag-mini-dow   { display: grid; grid-template-columns: repeat(7,1fr); padding: 0 8px; margin-bottom: 4px; }
  .ag-mini-dow-c { text-align: center; font-size: 9px; font-weight: 700; color: rgba(232,221,208,0.25); text-transform: uppercase; padding: 4px 0; font-family: var(--font-disp,'Syne',sans-serif); }

  .ag-mini-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 1px; padding: 0 8px; }
  .ag-mini-day  { display: flex; flex-direction: column; align-items: center; padding: 4px 2px; border-radius: 5px; cursor: pointer; transition: background .1s; min-height: 32px; }
  .ag-mini-day:hover       { background: rgba(255,255,255,0.04); }
  .ag-mini-day.today       { background: rgba(201,149,106,0.15); }
  .ag-mini-day.selected    { background: rgba(201,149,106,0.2); outline: 1px solid rgba(201,149,106,0.4); outline-offset: -1px; }
  .ag-mini-day.inactive    { opacity: .2; pointer-events: none; }
  .ag-mini-dn { font-size: 11px; font-weight: 500; color: rgba(232,221,208,0.4); line-height: 1.4; }
  .ag-mini-day.today    .ag-mini-dn { color: #c9956a; font-weight: 700; }
  .ag-mini-day.selected .ag-mini-dn { color: #c9956a; }
  .ag-mini-dots { display: flex; gap: 1px; margin-top: 2px; }
  .ag-mini-dot  { width: 3px; height: 3px; border-radius: 50%; }

  .ag-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 12px 16px; }

  .ag-stats    { padding: 0 16px 12px; display: flex; flex-direction: column; gap: 6px; }
  .ag-stat-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 7px; }
  .ag-stat-name { font-size: 11px; color: rgba(232,221,208,0.5); }
  .ag-stat-val  { font-family: var(--font-mono,'JetBrains Mono',monospace); font-size: 13px; font-weight: 700; }

  .ag-new-btn { margin: 16px 16px 0; padding: 9px; background: rgba(201,149,106,0.1); border: 1px solid rgba(201,149,106,0.2); border-radius: 8px; color: #c9956a; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-body,'DM Sans',sans-serif); text-align: center; transition: background .15s; }
  .ag-new-btn:hover { background: rgba(201,149,106,0.18); }

  /* ── Right panel — agenda ── */
  .ag-right { display: flex; flex-direction: column; border-left: 1px solid rgba(255,255,255,0.05); }

  .ag-agenda-header { padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; }
  .ag-agenda-title  { font-family: var(--font-disp,'Syne',sans-serif); font-size: 13px; font-weight: 700; color: rgba(232,221,208,0.5); text-transform: uppercase; letter-spacing: 1px; }
  .ag-filter-btns   { display: flex; gap: 4px; }
  .ag-filter-btn    { padding: 4px 10px; border-radius: 99px; font-size: 10px; font-weight: 600; cursor: pointer; border: none; transition: all .15s; font-family: var(--font-body,'DM Sans',sans-serif); }
  .ag-filter-btn.active   { background: rgba(201,149,106,0.18); color: #c9956a; }
  .ag-filter-btn.inactive { background: rgba(255,255,255,0.04); color: rgba(232,221,208,0.4); }
  .ag-filter-btn.inactive:hover { background: rgba(255,255,255,0.08); color: rgba(232,221,208,0.6); }

  /* Agenda list — no fixed height, flows naturally */
  .ag-agenda { padding: 8px 0; }

  /* ── Day block ── */
  .ag-day-block  { margin-bottom: 2px; }
  .ag-day-head   { padding: 10px 24px 6px; display: flex; align-items: baseline; gap: 10px; }
  .ag-day-num    { font-family: var(--font-mono,'JetBrains Mono',monospace); font-size: 22px; font-weight: 700; color: rgba(232,221,208,0.2); line-height: 1; }
  .ag-day-weekday { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: rgba(232,221,208,0.3); font-family: var(--font-disp,'Syne',sans-serif); }
  .ag-day-head.is-today .ag-day-num     { color: #c9956a; }
  .ag-day-head.is-today .ag-day-weekday { color: #c9956a; }

  /* ── Entry row ── */
  .ag-entry { display: flex; align-items: center; gap: 12px; padding: 9px 24px; cursor: pointer; transition: background .1s; position: relative; }
  .ag-entry::before { content: ''; position: absolute; left: 32px; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.04); }
  .ag-entry:hover { background: rgba(255,255,255,0.025) !important; }

  .ag-entry-time    { font-family: var(--font-mono,'JetBrains Mono',monospace); font-size: 10px; color: rgba(232,221,208,0.25); width: 28px; flex-shrink: 0; position: relative; z-index: 1; }
  .ag-entry-icon    { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; }
  .ag-entry-content { flex: 1; min-width: 0; }
  .ag-entry-name    { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--t1,#e8ddd0); }
  .ag-entry-sub     { font-size: 10px; color: rgba(232,221,208,0.35); margin-top: 2px; }
  .ag-entry-right   { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
  .ag-entry-amt     { font-family: var(--font-mono,'JetBrains Mono',monospace); font-size: 13px; font-weight: 700; }
  .ag-entry-tag     { font-size: 9px; padding: 1px 6px; border-radius: 99px; font-weight: 600; }
  .ag-entry-tag.posted { background: rgba(109,184,138,0.18); color: #6db88a; }
  .ag-entry-tag.sched  { background: rgba(201,149,106,0.15); color: #c9956a; }
  .ag-entry-tag.income { background: rgba(109,184,138,0.15); color: #6db88a; }

  /* ── Empty ── */
  .ag-empty     { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px; gap: 8px; color: rgba(232,221,208,0.25); font-size: 13px; }
  .ag-empty-add { background: rgba(201,149,106,0.1); border: 1px solid rgba(201,149,106,0.2); border-radius: 8px; color: #c9956a; font-size: 12px; font-weight: 600; padding: 7px 14px; cursor: pointer; margin-top: 8px; font-family: var(--font-body,'DM Sans',sans-serif); transition: background .15s; }
  .ag-empty-add:hover { background: rgba(201,149,106,0.18); }

  /* ── Split view ── */
  .ag-split-block { margin: 0 12px 4px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); }
  .ag-split-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; transition: background .12s; user-select: none; }
  .ag-split-row:hover { background: rgba(255,255,255,0.04); }
  .ag-split-row.open { background: rgba(201,149,106,0.06); }
  .ag-split-label { flex: 1; font-size: 12px; font-weight: 600; color: rgba(232,221,208,0.7); font-family: var(--font-body,'DM Sans',sans-serif); }
  .ag-split-total { font-family: var(--font-mono,'JetBrains Mono',monospace); font-size: 12px; font-weight: 700; color: #e07070; }
  .ag-split-total.income { color: #6db88a; }
  .ag-split-caret { font-size: 9px; color: rgba(232,221,208,0.3); transition: transform .15s; }
  .ag-split-caret.open { transform: rotate(180deg); }
  .ag-split-body { border-top: 1px solid rgba(255,255,255,0.05); padding: 8px 0 4px; background: rgba(0,0,0,0.15); }
  .ag-split-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; }
  .ag-split-item-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .ag-split-item-name { font-size: 11px; color: rgba(232,221,208,0.6); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ag-split-item-day { font-size: 10px; font-family: var(--font-mono,'JetBrains Mono',monospace); color: rgba(232,221,208,0.3); flex-shrink: 0; }
  .ag-split-item-amt { font-size: 11px; font-family: var(--font-mono,'JetBrains Mono',monospace); font-weight: 600; color: #e07070; flex-shrink: 0; }
  .ag-split-item-amt.posted { color: #6db88a; text-decoration: line-through; opacity: 0.6; }
  .ag-split-acct-hdr { padding: 8px 12px 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: rgba(232,221,208,0.28); font-family: var(--font-disp,'Syne',sans-serif); border-top: 1px solid rgba(255,255,255,0.04); margin-top: 4px; }
  .ag-split-acct-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 12px; }
  .ag-split-acct-name { font-size: 11px; color: rgba(232,221,208,0.5); }
  .ag-split-acct-amt { font-size: 11px; font-family: var(--font-mono,'JetBrains Mono',monospace); font-weight: 600; color: rgba(232,221,208,0.8); }
  .ag-split-divider { height: 1px; background: rgba(255,255,255,0.04); margin: 0 12px 4px; }

  /* ── Today chip + next-up card (concept 3) ── */
  .ag-today-chip-row { display: flex; align-items: center; gap: 10px; padding: 8px 24px; }
  .ag-today-chip { display: flex; align-items: center; gap: 6px; background: rgba(201,149,106,0.1); border: 1px solid rgba(201,149,106,0.28); border-radius: 99px; padding: 4px 12px; font-family: var(--font-mono,'JetBrains Mono',monospace); font-size: 10px; font-weight: 600; color: #c9956a; letter-spacing: 0.3px; flex-shrink: 0; }
  .ag-today-chip-dot { width: 5px; height: 5px; border-radius: 50%; background: #c9956a; }
  .ag-today-chip-rule { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(201,149,106,0.15), transparent); }
  .ag-next-up { margin: 2px 16px 8px; border-radius: 8px; background: rgba(201,149,106,0.06); border: 1px solid rgba(201,149,106,0.14); overflow: hidden; }
  .ag-next-up-label { font-family: var(--font-mono,'JetBrains Mono',monospace); font-size: 8px; text-transform: uppercase; letter-spacing: 1.2px; color: rgba(201,149,106,0.55); padding: 7px 14px 0; }
  .ag-day-block.past { opacity: 0.35; }
  .ag-day-block.past .ag-entry { pointer-events: none; }

  /* ── Mobile: stack columns ── */
  @media (max-width: 767px) {
    .ag-body { grid-template-columns: 1fr; }
    .ag-left { position: static; min-height: auto; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .ag-right { border-left: none; }
  }
  `;
  document.head.appendChild(s);
}

/* ─── icon mapping ──────────────────────────────────────────── */
const ICON_MAP = [
  [/stream|netflix|hulu|disney|paramount|hbo|peacock|apple.?tv/i, '📺'],
  [/music|spotify|apple.?music|tidal|pandora/i,                   '🎵'],
  [/rent|mortgage|housing/i,                                       '🏠'],
  [/electric|gas|water|util|pge|comed|xcel/i,                     '⚡'],
  [/gym|fitness|health|planet.?fitness|equinox/i,                  '💪'],
  [/car|auto|vehicle|insur|geico|state.?farm|progressive/i,        '🚗'],
  [/phone|mobile|cell|verizon|at&t|t.?mobile/i,                   '📱'],
  [/internet|cable|comcast|cox|spectrum|xfinity/i,                 '📡'],
  [/grocery|grocer|safeway|kroger|whole.?food|trader/i,            '🛒'],
  [/restaurant|food|eat|pizza|mcdonald|chipotle|doordash|grubhub/i,'🍔'],
  [/coffee|starbucks|dunkin/i,                                     '☕'],
  [/amazon|shop|retail|target|walmart|costco/i,                    '📦'],
  [/travel|flight|hotel|airbnb|uber|lyft|transit/i,                '✈️'],
  [/income|salary|paycheck|payroll|deposit|gig|freelance/i,        '💵'],
  [/transfer|zelle|venmo|paypal/i,                                  '🔄'],
  [/invest|robinhood|fidelity|vanguard|schwab/i,                   '📈'],
  [/medical|doctor|dental|prescr|pharmacy/i,                       '🏥'],
  [/pet|vet|animal/i,                                              '🐾'],
  [/child|school|tuition|daycare/i,                                '🎓'],
  [/charity|donate/i,                                              '❤️'],
];

function getIcon(name, catName, isIncome) {
  if (isIncome) return '💰';
  const text = `${name || ''} ${catName || ''}`;
  for (const [re, emoji] of ICON_MAP) {
    if (re.test(text)) return emoji;
  }
  return '💳';
}

function getIconBg(catColor, isIncome) {
  if (isIncome) return 'rgba(109,184,138,0.15)';
  if (catColor) {
    const c = catColor.replace('#', '');
    if (c.length === 6) {
      const r = parseInt(c.slice(0,2),16);
      const g = parseInt(c.slice(2,4),16);
      const b = parseInt(c.slice(4,6),16);
      return `rgba(${r},${g},${b},0.15)`;
    }
  }
  return 'rgba(201,149,106,0.15)';
}

/* ══════════════════════════════════════════════════════════════ */
export default function CalendarAgenda({
  calendarMonth,
  calendarTxnsByDay,
  recurringItems,
  transactions,
  catMap,
  acctMap,
  prevCalMonth,
  nextCalMonth,
  openNewRecurringItem,
  openEditRecurringItem,
  isMobile,
  today,
  fmt,
}) {
  useEffect(() => { injectCSS(); }, []);

  const [calY, calM] = calendarMonth.split('-').map(Number);
  const totalDays  = daysInMonth(calY, calM);
  const firstDow   = new Date(calY, calM - 1, 1).getDay();
  const totalCells = Math.ceil((firstDow + totalDays) / 7) * 7;
  const isCurrentMonth = calY === today.getFullYear() && calM === today.getMonth() + 1;

  const monthLabel = new Date(calY, calM - 1, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });

  const [selectedDay, setSelectedDay] = useState(
    () => isCurrentMonth ? today.getDate() : null
  );
  const [filter, setFilter] = useState('all');
  const [splitOpen, setSplitOpen] = useState(null); // null | 'first' | 'second'

  /* ── Split view data: first half (1-15) and second half (16-end) ── */
  const splitData = useMemo(() => {
    function buildHalf(items, dayMin, dayMax) {
      const halfItems = items
        .filter(item => {
          const day = item.recurringDay;
          if (!day) return false;
          return day >= dayMin && day <= dayMax;
        })
        .sort((a, b) => (a.recurringDay || 0) - (b.recurringDay || 0));

      const totalExpenses = halfItems
        .filter(i => i.type !== 'income')
        .reduce((s, i) => s + (i.amountMin || 0), 0);
      const totalIncome = halfItems
        .filter(i => i.type === 'income')
        .reduce((s, i) => s + (i.amountMin || 0), 0);

      // Per-account breakdown (expenses only, unposted)
      const acctMap_ = {};
      halfItems.forEach(item => {
        if (item.type === 'income') return;
        const isPosted = (item.linkedTxnIds || []).some(id => {
          const t = transactions.find(x => x.id === id);
          if (!t?.date) return false;
          const [ty, tm] = t.date.split('-').map(Number);
          return ty === calY && tm === calM;
        });
        if (isPosted) return; // already paid, skip from "needed" totals
        const acctId = item.accountId || '__unassigned__';
        if (!acctMap_[acctId]) acctMap_[acctId] = { id: acctId, total: 0 };
        acctMap_[acctId].total += item.amountMin || 0;
      });

      return {
        items: halfItems,
        totalExpenses,
        totalIncome,
        acctTotals: Object.values(acctMap_).sort((a, b) => b.total - a.total),
      };
    }

    return {
      first:  buildHalf(recurringItems, 1, 15),
      second: buildHalf(recurringItems, 16, 31),
    };
  }, [recurringItems, transactions, calY, calM]); // eslint-disable-line

  useEffect(() => {
    const now = calY === today.getFullYear() && calM === today.getMonth() + 1;
    setSelectedDay(now ? today.getDate() : null);
  }, [calendarMonth]); // eslint-disable-line

  const dayRefs = useRef({});

  function handleMiniDayClick(day) {
    setSelectedDay(day);
    // scroll the page to the day block
    const el = dayRefs.current[day];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function dotsForDay(day) {
    const entries = calendarTxnsByDay[day] || [];
    const seen = new Set();
    const out  = [];
    for (const t of entries) {
      const isIncome = t.type === 'income' || (t.amount != null && t.amount > 0);
      const cat = catMap[t.categoryId];
      const color = isIncome ? '#6db88a' : (cat?.color || '#c9956a');
      if (!seen.has(color)) { seen.add(color); out.push(color); }
      if (out.length >= 3) break;
    }
    return out;
  }

  const stats = useMemo(() => {
    let expenses = 0, income = 0, posted = 0;
    recurringItems.forEach(item => {
      const amt = item.amountMin != null ? item.amountMin : 0;
      const isInc = item.type === 'income';
      const postedThisMonth = (item.linkedTxnIds || []).some(id => {
        const t = transactions.find(x => x.id === id);
        if (!t?.date) return false;
        const [ty, tm] = t.date.split('-').map(Number);
        return ty === calY && tm === calM;
      });
      if (isInc) { income += amt; if (postedThisMonth) posted += amt; }
      else       { expenses += amt; if (postedThisMonth) posted += amt; }
    });
    transactions.forEach(t => {
      if (!t.date || t.recurringItemId) return;
      const [ty, tm] = t.date.split('-').map(Number);
      if (ty === calY && tm === calM && t.amount < 0) posted += Math.abs(t.amount);
    });
    return { expenses, income, posted, remaining: Math.max(0, expenses - posted) };
  }, [recurringItems, transactions, calY, calM]);

  function applyFilter(entries) {
    if (filter === 'all') return entries;
    return entries.filter(t => {
      const isInc = t.type === 'income' || (t.amount != null && t.amount > 0);
      return filter === 'income' ? isInc : !isInc;
    });
  }

  const agendaDays = useMemo(() => {
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      const entries = applyFilter(calendarTxnsByDay[d] || []);
      if (entries.length > 0) days.push({ day: d, entries });
    }
    return days;
  }, [calendarTxnsByDay, filter, totalDays]); // eslint-disable-line

  function dayWeekday(day) {
    const d = new Date(calY, calM - 1, day);
    const name = d.toLocaleDateString('en-US', { weekday: 'long' });
    const isToday = isCurrentMonth && day === today.getDate();
    return isToday ? `${name} · Today` : name;
  }

  function renderEntry(t, dayIsToday) {
    const cat      = catMap[t.categoryId];
    const isIncome = t.type === 'income' || (t.amount != null && t.amount > 0);
    const isPosted = t.isRecurringItem ? !!t.postedThisMonth : true;

    const icon   = getIcon(t.name || t.merchant || '', cat?.name || '', isIncome);
    const iconBg = getIconBg(cat?.color, isIncome);

    const amtRaw = t.amount != null ? Math.abs(t.amount)
                 : t.amountMin != null ? t.amountMin : 0;
    const amtColor = isIncome ? '#6db88a' : '#e07070';
    const isVariable = t.amountMin != null && t.amountMax != null && t.amountMax !== t.amountMin;
    const amtText = isVariable ? `~${fmt(t.amountMin)}`
                  : isIncome   ? `+${fmt(amtRaw)}`
                  : fmt(amtRaw);

    const subParts = [];
    if (cat) subParts.push(cat.name);
    const freq = t.recurringFreq;
    if (freq === 'weekly')        subParts.push('Weekly');
    else if (freq === 'biweekly') subParts.push('Bi-weekly');
    else if (freq === 'annual')   subParts.push('Annual');
    else if (freq === 'monthly')  subParts.push('Monthly');
    if (t.recurringDay) subParts.push(`Day ${t.recurringDay}`);
    const lc = (t.linkedTxnIds || []).length;
    if (lc > 0) subParts.push(`Linked to ${lc} txn${lc !== 1 ? 's' : ''}`);

    const tagClass = isIncome ? 'income' : isPosted ? 'posted' : 'sched';
    const tagLabel = isIncome ? 'Income ✓' : isPosted ? 'Posted ✓' : 'Upcoming';

    const rowBg = dayIsToday && !isIncome ? 'rgba(201,149,106,0.04)'
                : isIncome               ? 'rgba(109,184,138,0.04)'
                : 'transparent';

    return (
      <div
        key={t.id}
        className="ag-entry"
        style={{ background: rowBg }}
        onClick={() => {
          if (t.isRecurringItem) {
            const ri = recurringItems.find(r => r.id === (t.recurringItemId || t.id));
            if (ri) openEditRecurringItem(ri);
          }
        }}
      >
        <div className="ag-entry-time">—</div>
        <div className="ag-entry-icon" style={{ background: iconBg }}>{icon}</div>
        <div className="ag-entry-content">
          <div className="ag-entry-name">{t.name || t.merchant || 'Unknown'}</div>
          {subParts.length > 0 && (
            <div className="ag-entry-sub">{subParts.join(' · ')}</div>
          )}
        </div>
        <div className="ag-entry-right">
          <div className="ag-entry-amt" style={{ color: amtColor }}>{amtText}</div>
          <span className={`ag-entry-tag ${tagClass}`}>{tagLabel}</span>
        </div>
      </div>
    );
  }

  /* ── Dashboard-style page padding: 48px top, 36px left (matches DashboardNew tier) ── */
  const outerPad = isMobile ? '20px 16px' : '28px 28px';

  return (
    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--t1,#e8ddd0)' }}>

      {/* ── Page header — Playfair title, same pattern as Transactions ── */}
      <div style={{ padding: outerPad, background: 'radial-gradient(ellipse 55% 80% at 0% 40%, rgba(201,149,106,0.055) 0%, transparent 65%), var(--bg, #0b0a08)', borderBottom: '1px solid rgba(0,0,0,0.35)', position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse 55% 80% at 0% 40%, rgba(201,149,106,0.055) 0%, transparent 65%), var(--bg,#0b0a08)' }}>
        {/* Top-edge seam */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,rgba(201,149,106,0.14) 0%,rgba(255,255,255,0.05) 35%,transparent 75%)', pointerEvents: 'none' }} />
        {/* Ghost roman numeral */}
        {!isMobile && (
          <div style={{ position: 'absolute', fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 96, fontWeight: 500, color: 'rgba(201,149,106,0.07)', pointerEvents: 'none', userSelect: 'none', top: '50%', transform: 'translateY(-55%)', left: 8, lineHeight: 1 }}>
            I
          </div>
        )}
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, position: 'relative', zIndex: 1, paddingBottom: 12, borderBottom: '1px solid rgba(201,149,106,0.12)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'rgba(201,149,106,0.45)', letterSpacing: '1px' }}>II ·</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontWeight: 400, fontSize: 22, color: 'var(--t1)' }}>Calendar</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(201,149,106,0.15),transparent)', alignSelf: 'center', marginLeft: 4 }} />
        </div>
        {/* Sub-line */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--t3)', marginTop: 6, position: 'relative', zIndex: 1 }}>
          {monthLabel} · {recurringItems.length} recurring item{recurringItems.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Two-column body: left sticky panel + right flowing agenda ── */}
      <div className="ag-body">

        {/* LEFT: sticky mini-cal + stats */}
        <div className="ag-left">
          <div className="ag-mini-header">
            <div className="ag-mini-month">{monthLabel}</div>
            <div className="ag-mini-nav">
              <button className="ag-mini-nav-btn" onClick={prevCalMonth}>‹</button>
              <button className="ag-mini-nav-btn" onClick={nextCalMonth}>›</button>
            </div>
          </div>

          <div className="ag-mini-dow">
            {DOW_LABELS.map((d, i) => <div key={i} className="ag-mini-dow-c">{d}</div>)}
          </div>

          <div className="ag-mini-grid">
            {Array.from({ length: totalCells }).map((_, i) => {
              const day   = i - firstDow + 1;
              const valid = day >= 1 && day <= totalDays;
              const isToday = valid && isCurrentMonth && day === today.getDate();
              const isSel   = valid && day === selectedDay;
              const dots    = valid ? dotsForDay(day) : [];
              const cls = ['ag-mini-day', !valid && 'inactive', isToday && 'today', isSel && 'selected'].filter(Boolean).join(' ');
              return (
                <div key={i} className={cls} onClick={() => valid && handleMiniDayClick(day)}>
                  {valid && (
                    <>
                      <div className="ag-mini-dn">{day}</div>
                      {dots.length > 0 && (
                        <div className="ag-mini-dots">
                          {dots.map((c, di) => <div key={di} className="ag-mini-dot" style={{ background: c }} />)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="ag-divider" />

          <div className="ag-stats">
            {[
              ['Monthly expenses', fmt(stats.expenses),        '#e07070'],
              ['Expected income',  '+' + fmt(stats.income),    '#6db88a'],
              ['Posted so far',    fmt(stats.posted),          'rgba(232,221,208,0.6)'],
              ['Remaining',        fmt(stats.remaining),        '#c9956a'],
            ].map(([name, val, color]) => (
              <div key={name} className="ag-stat-row">
                <div className="ag-stat-name">{name}</div>
                <div className="ag-stat-val" style={{ color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* ── Split view: 1–15 / 16–End ─────────────────────── */}
          <div style={{ padding: '4px 0 8px' }}>
            <div style={{ padding: '8px 12px 6px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(232,221,208,0.28)', fontFamily: 'var(--font-disp)' }}>
              Paycheck Planning
            </div>

            {[
              { key: 'first',  label: 'Days 1 – 15',   data: splitData.first  },
              { key: 'second', label: 'Days 16 – End',  data: splitData.second },
            ].map(({ key, label, data }) => {
              const isOpen = splitOpen === key;
              const hasItems = data.items.length > 0;
              return (
                <div key={key} className="ag-split-block" style={{ marginBottom: 6 }}>
                  {/* Summary row */}
                  <div
                    className={`ag-split-row${isOpen ? ' open' : ''}`}
                    onClick={() => setSplitOpen(isOpen ? null : key)}
                  >
                    <div className="ag-split-label">{label}</div>
                    {data.totalIncome > 0 && (
                      <span className="ag-split-total income">+{fmt(data.totalIncome)}</span>
                    )}
                    {data.totalExpenses > 0 && (
                      <span className="ag-split-total">{fmt(data.totalExpenses)}</span>
                    )}
                    {!hasItems && (
                      <span style={{ fontSize: 10, color: 'rgba(232,221,208,0.25)' }}>—</span>
                    )}
                    <span className={`ag-split-caret${isOpen ? ' open' : ''}`}>▼</span>
                  </div>

                  {/* Expanded body */}
                  {isOpen && hasItems && (
                    <div className="ag-split-body">
                      {/* Item list */}
                      {data.items.map(item => {
                        const cat = catMap[item.categoryId];
                        const isIncome = item.type === 'income';
                        const isPosted = (item.linkedTxnIds || []).some(id => {
                          const t = transactions.find(x => x.id === id);
                          if (!t?.date) return false;
                          const [ty, tm] = t.date.split('-').map(Number);
                          return ty === calY && tm === calM;
                        });
                        return (
                          <div key={item.id} className="ag-split-item">
                            <div className="ag-split-item-dot"
                              style={{ background: isIncome ? '#6db88a' : (cat?.color || '#c9956a') }} />
                            <div className="ag-split-item-name">{item.name || item.merchant || '—'}</div>
                            <div className="ag-split-item-day">
                              {item.recurringDay ? `Day ${item.recurringDay}` : '—'}
                            </div>
                            <div className={`ag-split-item-amt${isPosted ? ' posted' : ''}`}
                              style={isIncome ? { color: '#6db88a' } : {}}>
                              {isIncome ? '+' : ''}{fmt(item.amountMin || 0)}
                              {isPosted ? ' ✓' : ''}
                            </div>
                          </div>
                        );
                      })}

                      {/* Per-account needed totals */}
                      {data.acctTotals.length > 0 && (
                        <>
                          <div className="ag-split-acct-hdr">Needed by account</div>
                          {data.acctTotals.map(({ id, total }) => {
                            const acct = acctMap[id];
                            return (
                              <div key={id} className="ag-split-acct-row">
                                <div className="ag-split-acct-name">
                                  {acct ? acct.name : 'Unassigned'}
                                </div>
                                <div className="ag-split-acct-amt">{fmt(total)}</div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {isOpen && !hasItems && (
                    <div className="ag-split-body" style={{ padding: '10px 12px', fontSize: 11, color: 'rgba(232,221,208,0.3)' }}>
                      No recurring items in this period.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button className="ag-new-btn" onClick={openNewRecurringItem}>
            + Add Recurring Item
          </button>
        </div>

        {/* RIGHT: agenda — flows with the page */}
        <div className="ag-right">
          <div className="ag-agenda-header">
            <div className="ag-agenda-title">{monthLabel} Schedule</div>
            <div className="ag-filter-btns">
              {[['all','All'],['expenses','Expenses'],['income','Income']].map(([val, label]) => (
                <button
                  key={val}
                  className={`ag-filter-btn ${filter === val ? 'active' : 'inactive'}`}
                  onClick={() => setFilter(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="ag-agenda">
            {agendaDays.length === 0 ? (
              <div className="ag-empty">
                <div style={{ fontSize: 28, opacity: 0.25 }}>▦</div>
                <div>No items for {monthLabel}</div>
                <button className="ag-empty-add" onClick={openNewRecurringItem}>
                  + Add Recurring Item
                </button>
              </div>
            ) : (() => {
              const todayNum = today.getDate();
              const chipInserted = { done: false };

              // Find the first upcoming entry (today or future) for "next up"
              let nextUpEntry = null;
              let nextUpDay   = null;
              for (const { day, entries } of agendaDays) {
                if (!isCurrentMonth || day >= todayNum) {
                  const upcoming = entries.find(t => {
                    const isInc = t.type === 'income' || (t.amount != null && t.amount > 0);
                    return !isInc; // show next expense as "up next"
                  }) || entries[0];
                  if (upcoming) { nextUpEntry = upcoming; nextUpDay = day; break; }
                }
              }

              return agendaDays.map(({ day, entries }) => {
                const isToday  = isCurrentMonth && day === todayNum;
                const isPast   = isCurrentMonth && day < todayNum;
                const isFuture = !isCurrentMonth || day > todayNum;
                const headCls  = ['ag-day-head', isToday && 'is-today'].filter(Boolean).join(' ');
                const blockCls = ['ag-day-block', isPast && 'past'].filter(Boolean).join(' ');

                // Insert chip + next-up before the first non-past day
                const insertChip = isCurrentMonth && !chipInserted.done && (isToday || isFuture);
                if (insertChip) chipInserted.done = true;

                const todayLabel = (() => {
                  const d = today;
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                })();

                return (
                  <div key={day}>
                    {insertChip && (
                      <>
                        {/* Today chip + rule */}
                        <div className="ag-today-chip-row">
                          <div className="ag-today-chip">
                            <div className="ag-today-chip-dot" />
                            Today, {todayLabel}
                          </div>
                          <div className="ag-today-chip-rule" />
                        </div>
                      </>
                    )}

                    <div className={blockCls} ref={el => { dayRefs.current[day] = el; }}>
                      <div className={headCls}>
                        <div className="ag-day-num">{day}</div>
                        <div className="ag-day-weekday">{dayWeekday(day)}</div>
                      </div>
                      {entries.map(t => renderEntry(t, isToday))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}
