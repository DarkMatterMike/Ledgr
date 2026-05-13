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
  const outerPad = isMobile ? '20px 16px' : '28px 28px 28px 16px';

  return (
    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--t1,#e8ddd0)' }}>

      {/* ── Page header — Playfair title, same pattern as Transactions ── */}
      <div style={{ padding: '28px 0 0', margin: isMobile ? '0' : '0 -16px', borderBottom: '1px solid rgba(0,0,0,0.35)', position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse 55% 80% at 0% 40%, rgba(201,149,106,0.055) 0%, transparent 65%), var(--bg,#0b0a08)' }}>
        {/* Top-edge seam */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,rgba(201,149,106,0.14) 0%,rgba(255,255,255,0.05) 35%,transparent 75%)', pointerEvents: 'none' }} />
        {/* Ghost roman numeral */}
        {!isMobile && (
          <div style={{ position: 'absolute', fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 96, fontWeight: 500, color: 'rgba(201,149,106,0.07)', pointerEvents: 'none', userSelect: 'none', top: '50%', transform: 'translateY(-55%)', left: 8, lineHeight: 1 }}>
            I
          </div>
        )}
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, position: 'relative', zIndex: 1, paddingBottom: 12, paddingLeft: 16, borderBottom: '1px solid rgba(201,149,106,0.12)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'rgba(201,149,106,0.45)', letterSpacing: '1px' }}>01 ·</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontWeight: 400, fontSize: 22, color: 'var(--t1)' }}>Calendar</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(201,149,106,0.15),transparent)', alignSelf: 'center', marginLeft: 4 }} />
        </div>
        {/* Sub-line */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--t3)', marginTop: 6, paddingLeft: 16, position: 'relative', zIndex: 1 }}>
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
            ) : (
              agendaDays.map(({ day, entries }) => {
                const isToday = isCurrentMonth && day === today.getDate();
                const headCls = ['ag-day-head', isToday && 'is-today'].filter(Boolean).join(' ');
                return (
                  <div key={day} className="ag-day-block" ref={el => { dayRefs.current[day] = el; }}>
                    <div className={headCls}>
                      <div className="ag-day-num">{day}</div>
                      <div className="ag-day-weekday">{dayWeekday(day)}</div>
                    </div>
                    {entries.map(t => renderEntry(t, isToday))}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
