/**
 * CalendarAgenda.jsx
 *
 * Agenda View — replaces the Calendar page.
 * Layout: 260px mini-cal + stats on the left, chronological agenda on the right.
 * Exactly matches Concept 05 from ledgr-calendar-concepts.html.
 */

import { useState, useEffect, useRef, useMemo } from 'react';

/* ─── helpers ─────────────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');
const fmt = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

const DOW_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* ─── Inject scoped CSS once ───────────────────────────────── */
function injectAgendaCSS() {
  if (document.getElementById('ledgr-agenda-css')) return;
  const el = document.createElement('style');
  el.id = 'ledgr-agenda-css';
  el.textContent = `
    /* ── Agenda layout ── */
    .ag-wrap {
      background: var(--card, #0d0c0a);
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.06);
      font-family: var(--font-body, 'DM Sans', sans-serif);
    }
    .ag-layout {
      display: grid;
      grid-template-columns: 260px 1fr;
      min-height: 640px;
    }
    @media (max-width: 767px) {
      .ag-layout { grid-template-columns: 1fr; }
      .ag-left { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); }
    }

    /* ── Left panel ── */
    .ag-left {
      background: var(--bg, #0b0a08);
      border-right: 1px solid rgba(255,255,255,0.05);
      display: flex;
      flex-direction: column;
    }
    .ag-mini-header {
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .ag-mini-month {
      font-family: var(--font-disp, 'Syne', sans-serif);
      font-size: 15px;
      font-weight: 700;
      color: var(--t1, #e8ddd0);
    }
    .ag-mini-nav { display: flex; gap: 4px; }
    .ag-mini-nav-btn {
      background: none;
      border: none;
      color: rgba(232,221,208,0.4);
      cursor: pointer;
      font-size: 13px;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
      line-height: 1.2;
    }
    .ag-mini-nav-btn:hover { background: rgba(255,255,255,0.06); color: var(--t1, #e8ddd0); }

    /* Mini calendar grid */
    .ag-mini-dow {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      padding: 0 8px;
      margin-bottom: 4px;
    }
    .ag-mini-dow-c {
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      color: rgba(232,221,208,0.25);
      text-transform: uppercase;
      padding: 4px 0;
      font-family: var(--font-disp, 'Syne', sans-serif);
    }
    .ag-mini-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      padding: 0 8px;
    }
    .ag-mini-day {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 2px;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.1s;
      min-height: 32px;
    }
    .ag-mini-day:hover { background: rgba(255,255,255,0.04); }
    .ag-mini-day.today { background: rgba(201,149,106,0.15); }
    .ag-mini-day.selected { background: rgba(201,149,106,0.22); outline: 1px solid rgba(201,149,106,0.4); outline-offset: -1px; }
    .ag-mini-day.inactive { opacity: 0.2; cursor: default; pointer-events: none; }
    .ag-mini-dn {
      font-size: 11px;
      font-weight: 500;
      color: rgba(232,221,208,0.4);
      line-height: 1.4;
    }
    .ag-mini-day.today .ag-mini-dn { color: var(--cyan, #c9956a); font-weight: 700; }
    .ag-mini-day.selected .ag-mini-dn { color: var(--cyan, #c9956a); }
    .ag-mini-dots { display: flex; gap: 2px; margin-top: 2px; }
    .ag-mini-dot { width: 3px; height: 3px; border-radius: 50%; }

    /* Divider + stats */
    .ag-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 12px 16px; }
    .ag-stats { padding: 0 16px 12px; display: flex; flex-direction: column; gap: 6px; }
    .ag-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      background: rgba(255,255,255,0.02);
      border-radius: 7px;
    }
    .ag-stat-name { font-size: 11px; color: rgba(232,221,208,0.5); }
    .ag-stat-val {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 13px;
      font-weight: 700;
    }
    .ag-new-btn {
      margin: 0 16px 16px;
      padding: 9px;
      background: rgba(201,149,106,0.1);
      border: 1px solid rgba(201,149,106,0.2);
      border-radius: 8px;
      color: var(--cyan, #c9956a);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--font-body, 'DM Sans', sans-serif);
      text-align: center;
      transition: background 0.15s;
    }
    .ag-new-btn:hover { background: rgba(201,149,106,0.18); }

    /* ── Right panel ── */
    .ag-right { display: flex; flex-direction: column; overflow: hidden; }
    .ag-agenda-header {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .ag-agenda-title {
      font-family: var(--font-disp, 'Syne', sans-serif);
      font-size: 13px;
      font-weight: 700;
      color: rgba(232,221,208,0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .ag-filter-btns { display: flex; gap: 4px; }
    .ag-filter-btn {
      padding: 4px 10px;
      border-radius: 99px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.15s;
      font-family: var(--font-body, 'DM Sans', sans-serif);
    }
    .ag-filter-btn.active { background: rgba(201,149,106,0.18); color: var(--cyan, #c9956a); }
    .ag-filter-btn.inactive { background: rgba(255,255,255,0.04); color: rgba(232,221,208,0.4); }
    .ag-filter-btn:hover.inactive { background: rgba(255,255,255,0.08); color: rgba(232,221,208,0.6); }

    /* Agenda scroll area */
    .ag-agenda {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
      scroll-behavior: smooth;
    }
    .ag-agenda::-webkit-scrollbar { width: 3px; }
    .ag-agenda::-webkit-scrollbar-track { background: transparent; }
    .ag-agenda::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }

    /* Day block */
    .ag-day-block { margin-bottom: 2px; }
    .ag-day-head {
      padding: 10px 20px 6px;
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .ag-day-num {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 22px;
      font-weight: 700;
      color: rgba(232,221,208,0.2);
      line-height: 1;
    }
    .ag-day-weekday {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(232,221,208,0.3);
      font-family: var(--font-disp, 'Syne', sans-serif);
    }
    .ag-day-head.is-today .ag-day-num { color: var(--cyan, #c9956a); }
    .ag-day-head.is-today .ag-day-weekday { color: var(--cyan, #c9956a); }
    .ag-day-head.is-selected .ag-day-num { color: var(--cyan, #c9956a); opacity: 0.7; }

    /* Entry row */
    .ag-entry {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 20px;
      cursor: pointer;
      transition: background 0.1s;
      position: relative;
    }
    .ag-entry::before {
      content: '';
      position: absolute;
      left: 28px;
      top: 0;
      bottom: 0;
      width: 1px;
      background: rgba(255,255,255,0.04);
    }
    .ag-entry:hover { background: rgba(255,255,255,0.025); }
    .ag-entry-time {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 10px;
      color: rgba(232,221,208,0.25);
      width: 28px;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }
    .ag-entry-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 11px;
    }
    .ag-entry-content { flex: 1; min-width: 0; }
    .ag-entry-name {
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--t1, #e8ddd0);
    }
    .ag-entry-sub {
      font-size: 10px;
      color: rgba(232,221,208,0.35);
      margin-top: 2px;
    }
    .ag-entry-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 3px;
      flex-shrink: 0;
    }
    .ag-entry-amt {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 13px;
      font-weight: 700;
    }
    .ag-entry-tag {
      font-size: 9px;
      padding: 1px 6px;
      border-radius: 99px;
      font-weight: 600;
    }
    .ag-entry-tag.posted  { background: rgba(109,184,138,0.18); color: var(--green, #6db88a); }
    .ag-entry-tag.sched   { background: rgba(201,149,106,0.15); color: var(--cyan, #c9956a); }
    .ag-entry-tag.income  { background: rgba(109,184,138,0.15); color: var(--green, #6db88a); }
    .ag-empty-day {
      padding: 6px 20px 10px;
      font-size: 11px;
      color: rgba(232,221,208,0.2);
    }
    .ag-empty-month {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: rgba(232,221,208,0.25);
      font-size: 13px;
      gap: 8px;
    }
  `;
  document.head.appendChild(el);
}

/* ─── Emoji icons per category ─────────────────────────────── */
function getCategoryIcon(cat) {
  if (!cat) return '💳';
  const name = (cat.name || '').toLowerCase();
  if (name.includes('stream') || name.includes('netflix') || name.includes('hulu') || name.includes('disney')) return '📺';
  if (name.includes('music') || name.includes('spotify')) return '🎵';
  if (name.includes('rent') || name.includes('housing') || name.includes('mortgage')) return '🏠';
  if (name.includes('electric') || name.includes('util')) return '⚡';
  if (name.includes('gym') || name.includes('health') || name.includes('fitness')) return '💪';
  if (name.includes('car') || name.includes('auto') || name.includes('insur')) return '🚗';
  if (name.includes('food') || name.includes('grocer') || name.includes('restaurant')) return '🍔';
  if (name.includes('income') || name.includes('paycheck') || name.includes('salary')) return '💵';
  if (name.includes('transfer')) return '🔄';
  return '💳';
}

function getEntryIcon(item, cat, isIncome) {
  if (isIncome) return '💰';
  return getCategoryIcon(cat);
}

/* ─── Main component ───────────────────────────────────────── */
export default function CalendarAgenda({
  /* data */
  calendarMonth,          // "YYYY-MM"
  calendarTxnsByDay,      // { [day]: Array<txn|recurringItem> }
  recurringItems,
  transactions,
  catMap,
  acctMap,
  /* actions */
  prevCalMonth,
  nextCalMonth,
  openNewRecurringItem,
  openEditRecurringItem,
  /* layout */
  isMobile,
  /* misc */
  today,
  fmt: fmtProp,
}) {
  // Allow consumer to pass their own fmt or fall back
  const fmtAmt = fmtProp || fmt;

  useEffect(() => { injectAgendaCSS(); }, []);

  const calYear  = parseInt(calendarMonth.split('-')[0]);
  const calMonthN = parseInt(calendarMonth.split('-')[1]);
  const firstDow = new Date(calYear, calMonthN - 1, 1).getDay();
  const totalDays = daysInMonth(calYear, calMonthN);
  const totalCells = Math.ceil((firstDow + totalDays) / 7) * 7;

  const monthName = new Date(calYear, calMonthN - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  const isCurrentMonth = calYear === today.getFullYear() && calMonthN === today.getMonth() + 1;

  // Selected day — default to today if current month, else null
  const [selectedDay, setSelectedDay] = useState(() =>
    isCurrentMonth ? today.getDate() : null
  );
  const [filter, setFilter] = useState('all'); // 'all' | 'expenses' | 'income'

  // Reset selected day when month changes
  useEffect(() => {
    const nowIsThisMonth = calYear === today.getFullYear() && calMonthN === today.getMonth() + 1;
    setSelectedDay(nowIsThisMonth ? today.getDate() : null);
  }, [calendarMonth]);

  // Ref map for scrolling agenda to a day
  const dayRefs = useRef({});

  function scrollToDay(day) {
    const el = dayRefs.current[day];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleMiniDayClick(day) {
    setSelectedDay(day);
    scrollToDay(day);
  }

  /* ── Aggregate stats ─────────────────────────── */
  const stats = useMemo(() => {
    let monthExpenses = 0, monthIncome = 0, postedSoFar = 0;

    recurringItems.forEach(item => {
      const isIncome = item.type === 'income';
      const postedCount = (item.linkedTxnIds || []).filter(txnId => {
        const t = transactions.find(x => x.id === txnId);
        if (!t || !t.date) return false;
        const [ty, tm] = t.date.split('-').map(Number);
        return ty === calYear && tm === calMonthN;
      }).length;

      const amt = item.amountMin != null ? item.amountMin : 0;
      if (isIncome) {
        monthIncome += amt;
        if (postedCount > 0) postedSoFar += amt;
      } else {
        monthExpenses += amt;
        if (postedCount > 0) postedSoFar += amt;
      }
    });

    // Also count actual posted transactions this month that aren't recurring
    transactions.forEach(t => {
      if (!t.date) return;
      const [ty, tm] = t.date.split('-').map(Number);
      if (ty !== calYear || tm !== calMonthN) return;
      if (!t.recurringItemId) {
        if (t.amount < 0) postedSoFar += Math.abs(t.amount);
      }
    });

    const remaining = monthExpenses - postedSoFar;
    return { monthExpenses, monthIncome, postedSoFar, remaining };
  }, [recurringItems, transactions, calYear, calMonthN]);

  /* ── Build days that have entries ───────────────── */
  const daysWithEntries = useMemo(() => {
    const result = [];
    for (let d = 1; d <= totalDays; d++) {
      const entries = calendarTxnsByDay[d] || [];
      if (entries.length > 0) result.push(d);
    }
    return result;
  }, [calendarTxnsByDay, totalDays]);

  /* ── Filter entries ─────────────────────────────── */
  function filterEntries(entries) {
    if (filter === 'all') return entries;
    return entries.filter(t => {
      const isIncome = t.type === 'income' || t.amount > 0;
      return filter === 'income' ? isIncome : !isIncome;
    });
  }

  /* ── Mini-cal dot colors for a day ─────────────── */
  function getDotColors(day) {
    const entries = calendarTxnsByDay[day] || [];
    const colors = new Set();
    entries.slice(0, 3).forEach(t => {
      const cat = catMap[t.categoryId];
      if (t.type === 'income' || t.amount > 0) colors.add('var(--green, #6db88a)');
      else if (cat?.color) colors.add(cat.color);
      else colors.add('var(--cyan, #c9956a)');
    });
    return [...colors];
  }

  /* ── Weekday label ─────────────────────────────── */
  function weekdayLabel(day) {
    const d = new Date(calYear, calMonthN - 1, day);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const isToday = calYear === today.getFullYear() && calMonthN === today.getMonth() + 1 && day === today.getDate();
    return isToday ? `${dayName} · Today` : dayName;
  }

  /* ── Entry rendering ───────────────────────────── */
  function renderEntry(t, idx) {
    const cat        = catMap[t.categoryId];
    const isIncome   = t.type === 'income' || (t.amount != null && t.amount > 0);
    const isPosted   = t.isRecurringItem ? t.postedThisMonth : true; // actual txns are always "posted"
    const isScheduled = t.isRecurringItem && !t.postedThisMonth;

    const amtValue = t.amount != null
      ? Math.abs(t.amount)
      : (t.amountMin != null ? t.amountMin : 0);

    const amtColor  = isIncome ? 'var(--green, #6db88a)' : 'var(--red, #e07070)';
    const amtPrefix = isIncome ? '+' : '';

    const iconBg  = isIncome
      ? 'rgba(109,184,138,0.15)'
      : cat?.color ? `${cat.color}22` : 'rgba(201,149,106,0.15)';
    const icon = getEntryIcon(t, cat, isIncome);

    const subParts = [];
    if (cat) subParts.push(cat.name);
    const freq = t.recurringFreq;
    if (freq) {
      subParts.push(freq === 'weekly' ? 'Weekly' : freq === 'biweekly' ? 'Bi-weekly' : freq === 'annual' ? 'Annual' : 'Monthly');
    }
    if (t.isRecurringItem && (t.linkedTxnIds || []).length > 0) {
      subParts.push(`Linked to ${t.linkedTxnIds.length} txn${t.linkedTxnIds.length !== 1 ? 's' : ''}`);
    }

    const tagClass = isIncome ? 'income' : isPosted ? 'posted' : 'sched';
    const tagLabel = isIncome ? 'Income ✓' : isPosted ? 'Posted ✓' : 'Upcoming';

    const bgStyle = isIncome
      ? { background: 'rgba(109,184,138,0.04)' }
      : isPosted && !isScheduled
      ? {}
      : {};

    return (
      <div
        key={t.id + '_' + idx}
        className="ag-entry"
        style={bgStyle}
        onClick={() => {
          if (t.isRecurringItem) {
            const ri = recurringItems.find(r => r.id === t.recurringItemId || r.id === t.id);
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
          <div className="ag-entry-amt" style={{ color: amtColor }}>
            {amtPrefix}{fmtAmt(amtValue)}
            {t.amountMax != null && t.amountMin != null && t.amountMax !== t.amountMin
              ? `–${fmtAmt(t.amountMax)}`
              : ''}
          </div>
          <span className={`ag-entry-tag ${tagClass}`}>{tagLabel}</span>
        </div>
      </div>
    );
  }

  /* ── Agenda days list ──────────────────────────── */
  const agendaDays = useMemo(() => {
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      const entries = filterEntries(calendarTxnsByDay[d] || []);
      if (entries.length > 0) days.push({ day: d, entries });
    }
    return days;
  }, [calendarTxnsByDay, filter, totalDays]);

  /* ── Render ─────────────────────────────────────── */
  return (
    <div className="ag-wrap">
      <div className="ag-layout">

        {/* ── LEFT: Mini calendar + stats ── */}
        <div className="ag-left">

          {/* Month nav */}
          <div className="ag-mini-header">
            <div className="ag-mini-month">{monthName}</div>
            <div className="ag-mini-nav">
              <button className="ag-mini-nav-btn" onClick={prevCalMonth}>‹</button>
              <button className="ag-mini-nav-btn" onClick={nextCalMonth}>›</button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div className="ag-mini-dow">
            {DOW_SHORT.map((d, i) => (
              <div key={i} className="ag-mini-dow-c">{d}</div>
            ))}
          </div>

          {/* Mini calendar grid */}
          <div className="ag-mini-grid">
            {Array.from({ length: totalCells }).map((_, i) => {
              const day = i - firstDow + 1;
              const isValid = day >= 1 && day <= totalDays;
              const isToday = isValid && isCurrentMonth && day === today.getDate();
              const isSelected = isValid && day === selectedDay;
              const dots = isValid ? getDotColors(day) : [];

              let cls = 'ag-mini-day';
              if (!isValid) cls += ' inactive';
              if (isToday) cls += ' today';
              if (isSelected) cls += ' selected';

              return (
                <div
                  key={i}
                  className={cls}
                  onClick={() => isValid && handleMiniDayClick(day)}
                >
                  {isValid && (
                    <>
                      <div className="ag-mini-dn">{day}</div>
                      {dots.length > 0 && (
                        <div className="ag-mini-dots">
                          {dots.map((color, di) => (
                            <div key={di} className="ag-mini-dot" style={{ background: color }} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="ag-divider" />

          {/* Stats */}
          <div className="ag-stats">
            <div className="ag-stat-row">
              <div className="ag-stat-name">Monthly expenses</div>
              <div className="ag-stat-val" style={{ color: 'var(--red, #e07070)' }}>
                {fmtAmt(stats.monthExpenses)}
              </div>
            </div>
            <div className="ag-stat-row">
              <div className="ag-stat-name">Expected income</div>
              <div className="ag-stat-val" style={{ color: 'var(--green, #6db88a)' }}>
                +{fmtAmt(stats.monthIncome)}
              </div>
            </div>
            <div className="ag-stat-row">
              <div className="ag-stat-name">Posted so far</div>
              <div className="ag-stat-val" style={{ color: 'rgba(232,221,208,0.6)' }}>
                {fmtAmt(stats.postedSoFar)}
              </div>
            </div>
            <div className="ag-stat-row">
              <div className="ag-stat-name">Remaining</div>
              <div className="ag-stat-val" style={{ color: 'var(--cyan, #c9956a)' }}>
                {fmtAmt(Math.max(0, stats.remaining))}
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Add recurring button */}
          <button className="ag-new-btn" onClick={openNewRecurringItem}>
            + Add Recurring Item
          </button>
        </div>

        {/* ── RIGHT: Agenda ── */}
        <div className="ag-right">

          {/* Header */}
          <div className="ag-agenda-header">
            <div className="ag-agenda-title">{monthName} Schedule</div>
            <div className="ag-filter-btns">
              {['all', 'expenses', 'income'].map(f => (
                <button
                  key={f}
                  className={`ag-filter-btn ${filter === f ? 'active' : 'inactive'}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Agenda scroll */}
          <div className="ag-agenda">
            {agendaDays.length === 0 ? (
              <div className="ag-empty-month">
                <div style={{ fontSize: 28, opacity: 0.3 }}>▦</div>
                <div>No recurring items for {monthName}</div>
                <button
                  onClick={openNewRecurringItem}
                  style={{
                    background: 'rgba(201,149,106,0.1)',
                    border: '1px solid rgba(201,149,106,0.2)',
                    borderRadius: 8,
                    color: 'var(--cyan, #c9956a)',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '7px 14px',
                    cursor: 'pointer',
                    marginTop: 8,
                  }}
                >
                  + Add Recurring Item
                </button>
              </div>
            ) : (
              agendaDays.map(({ day, entries }) => {
                const isToday = isCurrentMonth && day === today.getDate();
                const isSelected = day === selectedDay;

                let headCls = 'ag-day-head';
                if (isToday) headCls += ' is-today';
                else if (isSelected) headCls += ' is-selected';

                return (
                  <div
                    key={day}
                    className="ag-day-block"
                    ref={el => { dayRefs.current[day] = el; }}
                  >
                    <div className={headCls}>
                      <div className="ag-day-num">{day}</div>
                      <div className="ag-day-weekday">{weekdayLabel(day)}</div>
                    </div>
                    {entries.map((t, idx) => renderEntry(t, idx))}
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
