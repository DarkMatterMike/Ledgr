/**
 * RulesPage.jsx — Two-pane split rules view
 *
 * Layout mirrors CalendarAgenda:
 *   - No outer card/border — sits directly on page background
 *   - Padding: 48px top, 36px left (matches Dashboard/Calendar)
 *   - Playfair italic page header with ghost numeral
 *   - Two columns: sticky left list (sortable) + flowing right detail panel
 *   - Page scrolls; left column sticks. No inner overflow containers.
 */

import { useState, useEffect, useRef, useMemo } from 'react';

/* ─── CSS ───────────────────────────────────────────── */
function injectCSS() {
  if (document.getElementById('rules-css')) return;
  const s = document.createElement('style');
  s.id = 'rules-css';
  s.textContent = `
  /* ── Two-column body ── */
  .rp-body {
    display: grid;
    grid-template-columns: minmax(0,1fr) 300px;
    align-items: start;
  }

  /* ── Left: sortable list ── */
  .rp-left {
    position: sticky;
    top: 0;
    min-height: 100vh;
    border-right: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    padding-bottom: 40px;
  }

  /* column header row */
  .rp-col-hdr {
    display: grid;
    grid-template-columns: 1fr 100px 52px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.015);
    flex-shrink: 0;
  }
  .rp-col-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 10px 14px;
    background: none; border: none; cursor: pointer;
    font-family: var(--font-mono); font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.4px;
    color: var(--ink-2); transition: color .15s;
    text-align: left; white-space: nowrap; user-select: none;
  }
  .rp-col-btn:hover { color: var(--ink-0); }
  .rp-col-btn.active { color: var(--warn); }
  .rp-col-btn:last-child { justify-content: center; padding: 10px 8px; }
  .rp-sort-arr { font-size: 9px; opacity: 0; color: var(--warn); transition: opacity .15s; }
  .rp-col-btn.active .rp-sort-arr { opacity: 1; }

  /* rule rows */
  .rp-row {
    display: grid;
    grid-template-columns: 1fr 100px 52px;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    cursor: pointer;
    transition: background .1s;
  }
  .rp-row:last-child { border-bottom: none; }
  .rp-row:hover { background: rgba(255,255,255,0.025); }
  .rp-row.selected {
    background: rgba(201,149,106,0.07);
    border-left: 2px solid var(--warn);
  }
  .rp-row.off { opacity: .38; }

  /* pattern cell */
  .rp-cell-pat {
    padding: 10px 14px;
    display: flex; align-items: center; gap: 8px;
    min-width: 0; overflow: hidden;
  }
  .rp-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .rp-dot.override { border-radius: 2px; }
  .rp-pat-text {
    font-size: 13px; font-weight: 500; color: var(--ink-0);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rp-row.off .rp-pat-text { text-decoration: line-through; color: var(--ink-2); }

  /* category cell */
  .rp-cell-cat { padding: 10px 8px 10px 0; }
  .rp-cat-chip {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 600; padding: 2px 9px;
    border-radius: 99px; white-space: nowrap;
    max-width: 88px; overflow: hidden; text-overflow: ellipsis;
  }
  .rp-type-chip {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 700; padding: 2px 9px;
    border-radius: 99px; white-space: nowrap;
  }

  /* toggle cell */
  .rp-cell-tog { padding: 10px 0; display: flex; align-items: center; justify-content: center; }

  /* toggle */
  .rp-tog { display:inline-flex; align-items:center; width:32px; height:18px; border-radius:99px; padding:2px; cursor:pointer; flex-shrink:0; }
  .rp-tog.on  { background:rgba(201,149,106,0.15); border:1.5px solid var(--warn); }
  .rp-tog.off { background:rgba(255,255,255,0.04); border:1.5px solid rgba(255,255,255,0.1); }
  .rp-tog-t   { width:12px; height:12px; border-radius:50%; transition:transform .2s; }
  .rp-tog.on  .rp-tog-t { background:var(--warn); transform:translateX(14px); }
  .rp-tog.off .rp-tog-t { background:rgba(232,221,208,0.25); }

  /* empty states */
  .rp-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 64px 24px; gap: 8px;
    color: var(--ink-2); font-size: 13px; text-align: center;
  }

  /* ── Right: detail panel ── */
  .rp-right {
    padding: 28px 28px 40px;
    display: flex; flex-direction: column; gap: 20px;
  }

  .rp-detail-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 64px 0; gap: 8px;
    color: var(--ink-2); font-size: 12px; text-align: center;
  }

  /* pattern hero */
  .rp-d-pattern {
    font-family: var(--font-mono); font-size: 18px; font-weight: 700;
    color: var(--ink-0); letter-spacing: -0.5px;
    line-height: 1.1; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rp-d-subline {
    font-family: var(--font-mono); font-size: 9px; color: var(--ink-2);
    text-transform: uppercase; letter-spacing: 1px; margin-top: 5px;
  }

  /* field */
  .rp-d-field { display: flex; flex-direction: column; gap: 6px; }
  .rp-d-label {
    font-family: var(--font-display); font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px; color: var(--ink-2);
  }
  .rp-d-cat {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 600; padding: 5px 13px;
    border-radius: 99px; align-self: flex-start;
  }
  .rp-d-type {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 13px; font-weight: 700; padding: 5px 13px;
    border-radius: 99px; align-self: flex-start;
  }

  /* match diagram */
  .rp-d-match-box {
    background: rgba(255,255,255,0.03); border-radius: 8px; padding: 11px 13px;
  }
  .rp-d-match-mode { font-family: var(--font-mono); font-size: 12px; color: var(--ink-1); }
  .rp-d-match-desc { font-size: 11px; color: var(--ink-2); margin-top: 4px; line-height: 1.6; }
  .rp-d-match-ex   { font-family: var(--font-mono); font-size: 10px; color: var(--ink-2); margin-top: 6px; line-height: 1.8; }
  .rp-d-match-ex em { color: var(--warn); font-style: normal; font-weight: 700; }
  .rp-d-match-ex s  { color: rgba(232,221,208,0.18); text-decoration: line-through; }

  /* active row */
  .rp-d-active-row { display: flex; align-items: center; gap: 8px; }
  .rp-d-active-lbl { font-size: 12px; color: var(--ink-1); }

  /* action buttons */
  .rp-d-actions { display: flex; gap: 8px; padding-top: 4px; }
  .rp-d-edit {
    flex: 1; background: rgba(255,255,255,0.04); border: none; border-radius: 8px;
    padding: 9px; font-size: 12px; font-weight: 600; color: var(--ink-1);
    cursor: pointer; font-family: var(--font-ui); transition: background .15s;
  }
  .rp-d-edit:hover { background: rgba(255,255,255,0.08); color: var(--ink-0); }
  .rp-d-del {
    flex: 1; background: rgba(224,112,112,0.07); border: none; border-radius: 8px;
    padding: 9px; font-size: 12px; font-weight: 600; color: var(--debt);
    cursor: pointer; font-family: var(--font-ui); transition: background .15s;
  }
  .rp-d-del:hover { background: rgba(224,112,112,0.15); }

  /* ── Mobile: stack ── */
  @media (max-width: 767px) {
    .rp-body { grid-template-columns: 1fr; }
    .rp-left { position: static; min-height: auto; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .rp-right { padding: 20px 0 32px; }
  }
  `;
  document.head.appendChild(s);
}

/* ─── constants ─────────────────────────────────────── */
const TYPE_META = {
  income:        { label: '→ Income',   bg: 'rgba(109,184,138,0.12)',  color: 'var(--safe)' },
  transfer:      { label: '→ Transfer', bg: 'rgba(255,255,255,0.06)',  color: 'var(--ink-1)'    },
  reimbursement: { label: '→ Reimb.',   bg: 'rgba(201,149,106,0.12)', color: 'var(--warn)'  },
  expense:       { label: '→ Expense',  bg: 'rgba(224,112,112,0.10)', color: 'var(--debt)'   },
  refund:        { label: '→ Refund',   bg: 'rgba(109,184,138,0.10)', color: 'var(--safe)' },
};

const MATCH_INFO = {
  contains: {
    mode: 'contains',
    desc: 'Matches if the merchant name contains this text anywhere.',
    exYes: '"whole foods market"',
    exNo:  '"wholesome"',
  },
  exact: {
    mode: 'exact match',
    desc: 'Matches only if the merchant name is exactly this text.',
    exYes: '"netflix"',
    exNo:  '"netflix inc"',
  },
  starts: {
    mode: 'starts with',
    desc: 'Matches if the merchant name begins with this text.',
    exYes: '"uber eats"',
    exNo:  '"get uber"',
  },
};

/* ─── helpers ───────────────────────────────────────── */
function hex2rgba(hex, a) {
  if (!hex || !hex.startsWith('#')) return `rgba(200,150,100,${a})`;
  const c = hex.replace('#', '');
  if (c.length !== 6) return `rgba(200,150,100,${a})`;
  const r = parseInt(c.slice(0,2),16);
  const g = parseInt(c.slice(2,4),16);
  const b = parseInt(c.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ─── sub-components ────────────────────────────────── */
function RpToggle({ on, onClick }) {
  return (
    <div className={`rp-tog ${on ? 'on' : 'off'}`} onClick={e => { e.stopPropagation(); onClick(); }}>
      <div className="rp-tog-t" />
    </div>
  );
}

function CatChip({ rule, catMap }) {
  if (rule.typeOverride) {
    const m = TYPE_META[rule.typeOverride] || TYPE_META.transfer;
    return (
      <span className="rp-type-chip" style={{ background: m.bg, color: m.color }}>
        {m.label}
      </span>
    );
  }
  if (rule.categoryId) {
    const cat = catMap[rule.categoryId];
    if (cat) {
      return (
        <span className="rp-cat-chip" style={{ background: hex2rgba(cat.color, 0.12), color: cat.color }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
          {cat.name}
        </span>
      );
    }
  }
  return <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>—</span>;
}

function DotEl({ rule, catMap }) {
  if (rule.typeOverride) {
    return <div className="rp-dot override" style={{ background: 'var(--warn)' }} />;
  }
  const cat = catMap[rule.categoryId];
  return <div className="rp-dot" style={{ background: cat?.color || 'var(--ink-2)' }} />;
}

/* ─── detail panel ──────────────────────────────────── */
function DetailPanel({ rule, catMap, onToggle, onEdit, onDelete }) {
  if (!rule) {
    return (
      <div className="rp-right">
        <div className="rp-detail-empty">
          <div style={{ fontSize: 28, opacity: 0.2 }}>◎</div>
          <div>Select a rule to preview</div>
        </div>
      </div>
    );
  }

  const cat     = rule.categoryId ? catMap[rule.categoryId] : null;
  const matchI  = MATCH_INFO[rule.matchType] || MATCH_INFO.contains;
  const srcLabel = rule.source === 'ai' ? '✦ AI generated' : 'Manual — created by you';

  const patternWord = rule.pattern.split(' ')[0];

  return (
    <div className="rp-right">
      {/* Pattern hero */}
      <div>
        <div className="rp-d-pattern">{rule.pattern}</div>
        <div className="rp-d-subline">{srcLabel} · {rule.enabled ? 'active' : 'disabled'}</div>
      </div>

      {/* Category or type override */}
      {rule.typeOverride ? (
        <div className="rp-d-field">
          <div className="rp-d-label">Type Override</div>
          {(() => {
            const m = TYPE_META[rule.typeOverride] || TYPE_META.transfer;
            return (
              <div className="rp-d-type" style={{ background: m.bg, color: m.color }}>
                {m.label}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="rp-d-field">
          <div className="rp-d-label">Category</div>
          {cat ? (
            <div className="rp-d-cat" style={{ background: hex2rgba(cat.color, 0.12), color: cat.color }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color }} />
              {cat.name}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>No category assigned</div>
          )}
        </div>
      )}

      {/* Match diagram */}
      <div className="rp-d-field">
        <div className="rp-d-label">Match rule</div>
        <div className="rp-d-match-box">
          <div className="rp-d-match-mode">{matchI.mode}</div>
          <div className="rp-d-match-desc">{matchI.desc}</div>
          <div className="rp-d-match-ex">
            <em>"{rule.pattern}"</em> ✓<br />
            <s>"{patternWord}xyz"</s> ✗
          </div>
        </div>
      </div>

      {/* Source */}
      <div className="rp-d-field">
        <div className="rp-d-label">Source</div>
        <div style={{ fontSize: 12, color: 'var(--ink-1)' }}>{srcLabel}</div>
      </div>

      {/* Active toggle */}
      <div className="rp-d-field">
        <div className="rp-d-label">Active</div>
        <div className="rp-d-active-row">
          <RpToggle on={rule.enabled} onClick={() => onToggle(rule.id)} />
          <span className="rp-d-active-lbl">{rule.enabled ? 'Rule is active' : 'Rule is disabled'}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="rp-d-actions">
        <button className="rp-d-edit" onClick={() => onEdit(rule)}>Edit Rule</button>
        <button className="rp-d-del"  onClick={() => onDelete(rule.id)}>Delete</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════ */
export default function RulesPage({
  rules,
  catMap,
  isMobile,
  ruleSearch,
  setRuleSearch,
  toggleRule,
  deleteRule,
  onOpenAdd,
  onOpenEdit,
}) {
  useEffect(() => { injectCSS(); }, []);

  const [sortCol, setSortCol] = useState('pattern'); // 'pattern' | 'category' | 'on'
  const [sortDir, setSortDir] = useState('asc');     // 'asc' | 'desc'
  const [selectedId, setSelectedId] = useState(null);

  // Auto-select first rule on mount or when rules change and selection is gone
  useEffect(() => {
    if (rules.length === 0) { setSelectedId(null); return; }
    if (!rules.find(r => r.id === selectedId)) {
      setSelectedId(rules[0].id);
    }
  }, [rules]); // eslint-disable-line

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    const q = ruleSearch.toLowerCase().trim();
    return rules.filter(r =>
      !q ||
      r.pattern.toLowerCase().includes(q) ||
      catMap[r.categoryId]?.name.toLowerCase().includes(q) ||
      r.typeOverride?.toLowerCase().includes(q)
    );
  }, [rules, ruleSearch, catMap]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av, bv;
      if (sortCol === 'pattern') {
        av = a.pattern.toLowerCase();
        bv = b.pattern.toLowerCase();
      } else if (sortCol === 'category') {
        av = (catMap[a.categoryId]?.name || a.typeOverride || '').toLowerCase();
        bv = (catMap[b.categoryId]?.name || b.typeOverride || '').toLowerCase();
      } else { // 'on'
        av = a.enabled ? 0 : 1;
        bv = b.enabled ? 0 : 1;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortCol, sortDir, catMap]);

  const selectedRule = rules.find(r => r.id === selectedId) || null;
  const manualCount  = rules.filter(r => r.source !== 'ai').length;
  const aiCount      = rules.filter(r => r.source === 'ai').length;

  function ColHdrBtn({ col, label, center }) {
    const active = sortCol === col;
    return (
      <button
        className={`rp-col-btn${active ? ' active' : ''}`}
        style={center ? { justifyContent: 'center', padding: '10px 8px' } : {}}
        onClick={() => handleSort(col)}
      >
        {label}
        <span className="rp-sort-arr">
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↑'}
        </span>
      </button>
    );
  }

  /* outer padding matches Dashboard/Calendar: 48px top, 36px left */
  const outerPad = isMobile ? '20px 16px' : '28px 28px';

  return (
    <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink-0)' }}>

      {/* ── Page header ── */}
      <div style={{
        padding: outerPad,
        background: 'radial-gradient(ellipse 55% 80% at 0% 40%, rgba(201,149,106,0.055) 0%, transparent 65%), var(--bg-0,#0b0a08)',
        borderBottom: '1px solid rgba(0,0,0,0.35)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* top-edge seam */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,rgba(201,149,106,0.14),rgba(255,255,255,0.04) 35%,transparent 75%)', pointerEvents: 'none' }} />
        {/* ghost numeral */}
        {!isMobile && (
          <div style={{ position: 'absolute', fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontSize: 96, fontWeight: 500, color: 'rgba(201,149,106,0.07)', pointerEvents: 'none', userSelect: 'none', top: '50%', transform: 'translateY(-55%)', left: 8, lineHeight: 1 }}>
            II
          </div>
        )}
        {/* title row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingBottom: 12, borderBottom: '1px solid rgba(201,149,106,0.12)', position: 'relative', zIndex: 1 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'rgba(201,149,106,0.45)', letterSpacing: '1px' }}>II ·</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontStyle: 'italic', fontWeight: 400, fontSize: isMobile ? 18 : 22, color: 'var(--ink-0)' }}>Rules</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(201,149,106,0.15),transparent)', alignSelf: 'center', marginLeft: 4 }} />
        </div>
        {/* meta */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--ink-2)', marginTop: 6, paddingBottom: 20, position: 'relative', zIndex: 1 }}>
          Auto-categorization · {rules.length} rule{rules.length !== 1 ? 's' : ''} · {manualCount} manual · {aiCount} AI
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ padding: isMobile ? '14px 16px' : '14px 0 14px 36px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ position: 'relative', flex: '0 0 240px' }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-2)', fontSize: 11, pointerEvents: 'none' }}>🔍</span>
          <input
            style={{ width: '100%', background: 'var(--card-hi,#231f1a)', border: 'none', borderRadius: 8, padding: '7px 10px 7px 28px', fontSize: 12, color: 'var(--ink-0)', outline: 'none', fontFamily: 'var(--font-ui)' }}
            placeholder="Search patterns…"
            value={ruleSearch}
            onChange={e => setRuleSearch(e.target.value)}
          />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', display: 'flex', gap: 12 }}>
          <span>{manualCount} manual</span>
          <span style={{ color: 'var(--warn)' }}>{aiCount} AI</span>
        </div>
        <button
          onClick={onOpenAdd}
          style={{ marginLeft: 'auto', background: 'var(--warn)', color: '#000', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}
        >
          + New Rule
        </button>
      </div>

      {/* ── Two-pane body ── */}
      {rules.length === 0 ? (
        <div style={{ padding: isMobile ? '48px 16px' : '48px 36px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.25 }}>◎</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-0)', marginBottom: 6 }}>No rules yet</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Categorize a transaction and you'll be prompted to save it as a rule.</div>
        </div>
      ) : (
        <div className="rp-body">

          {/* LEFT: list */}
          <div className="rp-left">

            {/* Column headers */}
            <div className="rp-col-hdr">
              <ColHdrBtn col="pattern"  label="Pattern"  />
              <ColHdrBtn col="category" label="Category" />
              <ColHdrBtn col="on"       label="On" center />
            </div>

            {/* No results */}
            {sorted.length === 0 && (
              <div className="rp-empty">
                <div style={{ fontSize: 24, opacity: 0.2 }}>🔍</div>
                <div>No rules match "{ruleSearch}"</div>
              </div>
            )}

            {/* Rule rows */}
            {sorted.map((rule, i) => (
              <div
                key={rule.id}
                className={[
                  'rp-row',
                  rule.id === selectedId ? 'selected' : '',
                  !rule.enabled ? 'off' : '',
                ].filter(Boolean).join(' ')}
                style={i === sorted.length - 1 ? { borderBottom: 'none' } : {}}
                onClick={() => setSelectedId(rule.id)}
              >
                <div className="rp-cell-pat">
                  <DotEl rule={rule} catMap={catMap} />
                  <span className="rp-pat-text">{rule.pattern}</span>
                </div>
                <div className="rp-cell-cat">
                  <CatChip rule={rule} catMap={catMap} />
                </div>
                <div className="rp-cell-tog">
                  <RpToggle
                    on={rule.enabled}
                    onClick={() => toggleRule(rule.id)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: detail */}
          <DetailPanel
            rule={selectedRule}
            catMap={catMap}
            onToggle={toggleRule}
            onEdit={onOpenEdit}
            onDelete={deleteRule}
          />

        </div>
      )}
    </div>
  );
}
