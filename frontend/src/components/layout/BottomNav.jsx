/**
 * BottomNav.jsx — Lumen Glass Pill nav
 * Always rendered in the DOM. CSS (hover:none + pointer:coarse) handles show/hide.
 * No JS viewport detection — immune to initial-scale, DPR, device width.
 */
import { useEffect, useRef } from 'react';

const TABS = [
  { id: 'dashboard',    label: 'Home',     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'transactions', label: 'Txns',     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg> },
  { id: 'budgets',      label: 'Budget',   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { id: 'calendar',     label: 'Cal',      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { id: '__more__',     label: 'More',     icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.75"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg> },
];

const CSS = `
  /* ── Hidden on desktop (mouse/trackpad), shown on touch screens ── */
  .lumen-nav-wrap { display: none; }
  @media (hover: none) and (pointer: coarse) {
    .lumen-nav-wrap { display: block; }
    .pn-nav { display: none !important; }
    .lb-brief { grid-template-columns: 1fr !important; }
    .lc-body  { grid-template-columns: 1fr !important; }
    .lt-body  { grid-template-columns: 1fr !important; }
    .la-body  { grid-template-columns: 1fr !important; }
    .lb-agenda { display: none !important; }
    .lc-aside  { display: none !important; }
    .lt-panel  { display: none !important; }
    .lc-edit-col { display: none !important; }
  }

  /* ── Wrapper: positions pill above safe area ── */
  .lumen-nav-wrap {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 200;
    padding: 0 12px env(safe-area-inset-bottom, 10px);
    padding-bottom: max(env(safe-area-inset-bottom, 10px), 10px);
    background: linear-gradient(to top, rgba(7,9,13,0.95) 60%, transparent);
    pointer-events: none;
  }

  /* ── Glass pill ── */
  .lumen-nav {
    display: flex;
    background: rgba(17,21,29,0.82);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 20px;
    overflow: hidden;
    pointer-events: all;
    box-shadow:
      0 8px 32px rgba(0,0,0,0.55),
      0 2px 8px rgba(0,0,0,0.3),
      inset 0 1px 0 rgba(255,255,255,0.05);
  }

  /* ── Tabs ── */
  .lumen-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 4px 10px;
    cursor: pointer;
    background: none;
    border: none;
    border-right: 1px solid rgba(255,255,255,0.05);
    color: rgba(74,81,97,1);
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5px;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    transition: color 0.15s, background 0.15s;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    position: relative;
  }
  .lumen-tab:last-child { border-right: none; }
  .lumen-tab svg {
    width: 17px; height: 17px;
    transition: transform 0.2s, filter 0.2s;
  }

  /* ── Active state ── */
  .lumen-tab.lumen-active {
    color: var(--safe, #5dcaa5);
  }
  .lumen-tab.lumen-active svg {
    transform: scale(1.1);
    filter: drop-shadow(0 0 6px rgba(93,202,165,0.45));
  }
  .lumen-tab.lumen-active .lumen-tab-text {
    text-shadow: 0 0 10px rgba(93,202,165,0.3);
  }

  /* ── More sheet ── */
  .lumen-sheet {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    background: var(--bg-2, #11151d);
    border-top: 1px solid rgba(255,255,255,0.09);
    border-radius: 20px 20px 0 0;
    padding: 0 0 env(safe-area-inset-bottom, 12px);
    transform: translateY(100%);
    transition: transform 0.26s cubic-bezier(0.4,0,0.2,1);
    z-index: 190;
    pointer-events: all;
  }
  .lumen-sheet.open { transform: translateY(0); }
  .lumen-sheet-handle {
    width: 32px; height: 3px;
    background: rgba(255,255,255,0.12);
    border-radius: 99px;
    margin: 10px auto 6px;
  }
  .lumen-sheet-item {
    display: flex; align-items: center; gap: 14px;
    padding: 13px 22px;
    font-size: 13px;
    color: var(--ink-1, #c8cdd6);
    cursor: pointer; border: none; background: none;
    width: 100%; text-align: left;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px; letter-spacing: 0.3px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.12s;
    -webkit-tap-highlight-color: transparent;
  }
  .lumen-sheet-item:last-child { border-bottom: none; }
  .lumen-sheet-item:active { background: rgba(255,255,255,0.04); }
  .lumen-sheet-item svg {
    width: 16px; height: 16px;
    color: var(--ink-3, #4a5161);
    stroke: currentColor; fill: none;
    stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round;
    flex-shrink: 0;
  }
  .lumen-sheet-divider {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 4px 20px;
  }
  .lumen-sheet-backdrop {
    position: fixed; inset: 0;
    z-index: 189;
    background: rgba(0,0,0,0);
  }

  /* ── Page content padding so content isn't hidden under nav ── */
  @media (hover: none) and (pointer: coarse) {
    .ledgr-content,
    .lb-wrap, .lc-wrap, .la-wrap, .lt-wrap, .lgs-wrap {
      padding-bottom: 90px !important;
    }
  }
`;

let cssInjected = false;

function BottomNav({ view, navigate, moreOpen, setMoreOpen, currentUser }) {
  useEffect(() => {
    if (cssInjected) return;
    cssInjected = true;
    const el = document.createElement('style');
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);

  return (
    <>
      {/* Backdrop for more sheet */}
      {moreOpen && (
        <div
          className="lumen-sheet-backdrop"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More sheet */}
      <div className={`lumen-sheet${moreOpen ? ' open' : ''}`}>
        <div className="lumen-sheet-handle"/>
        <button className="lumen-sheet-item" onClick={() => { setMoreOpen(false); navigate('settings'); }}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          Profile & Settings
        </button>
        <button className="lumen-sheet-item" onClick={() => { setMoreOpen(false); navigate('accounts'); }}>
          <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          Accounts
        </button>
        <button className="lumen-sheet-item" onClick={() => { setMoreOpen(false); navigate('rules'); }}>
          <svg viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18"/></svg>
          Rules
        </button>
        {currentUser?.role === 'owner' && <>
          <div className="lumen-sheet-divider"/>
          <button className="lumen-sheet-item" onClick={() => { setMoreOpen(false); navigate('admin'); }} style={{color:'var(--calm, #6c8cff)'}}>
            <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Admin
          </button>
          <button className="lumen-sheet-item" onClick={() => { setMoreOpen(false); navigate('dani'); }} style={{color:'#f9a8d4'}}>
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            Dani
          </button>
        </>}
      </div>

      {/* Glass pill nav */}
      <div className="lumen-nav-wrap">
        <div className="lumen-nav">
          {TABS.map(tab => {
            const isMore   = tab.id === '__more__';
            const isActive = isMore ? moreOpen : (!moreOpen && view === tab.id);
            return (
              <button
                key={tab.id}
                className={`lumen-tab${isActive ? ' lumen-active' : ''}`}
                onClick={() => {
                  if (isMore) setMoreOpen(p => !p);
                  else { setMoreOpen(false); navigate(tab.id); }
                }}>
                {tab.icon}
                <span className="lumen-tab-text">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export { BottomNav, TABS as BOTTOM_NAV };
