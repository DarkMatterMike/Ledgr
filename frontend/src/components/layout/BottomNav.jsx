/**
 * BottomNav.jsx — New mobile bottom nav to match the redesign.
 * 5 tabs with dot indicator. "More" opens the drawer.
 */
import { useRef, useEffect } from 'react';

const BOTTOM_NAV = [
  { id: 'dashboard',    label: 'Home',     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: 'transactions', label: 'Txns',     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg> },
  { id: 'budgets',      label: 'Budgets',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { id: 'calendar',     label: 'Calendar', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { id: '__more__',     label: 'More',     icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.75"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg> },
];

const NAV_CSS = `
.new-bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
  background: rgba(11,10,8,0.97); backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex;
  padding-bottom: env(safe-area-inset-bottom, 4px);
}
.new-bottom-nav-tab {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 3px; padding: 10px 4px 6px;
  cursor: pointer; background: none; border: none;
  color: var(--t3); transition: color .15s;
  -webkit-tap-highlight-color: transparent;
}
.new-bottom-nav-tab svg { width: 20px; height: 20px; transition: transform .2s; }
.new-bottom-nav-tab.active svg { transform: scale(1.12); }
.new-bottom-nav-tab-label {
  font-family: var(--font-mono); font-size: 8px;
  text-transform: uppercase; letter-spacing: .5px;
  transition: color .15s;
}
.new-bottom-nav-tab.active { color: var(--safe); }
.new-bottom-nav-dot {
  width: 3px; height: 3px; border-radius: 50%;
  background: transparent; margin-top: 1px;
  transition: background .15s;
}
.new-bottom-nav-tab.active .new-bottom-nav-dot { background: var(--safe); }
`;

let bottomNavCssInjected = false;

function BottomNav({ view, navigate, moreOpen, setMoreOpen }) {
  useEffect(() => {
    if (bottomNavCssInjected) return;
    bottomNavCssInjected = true;
    const style = document.createElement('style');
    style.textContent = NAV_CSS;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="new-bottom-nav">
      {BOTTOM_NAV.map(item => {
        const isMore   = item.id === '__more__';
        const isActive = isMore ? moreOpen : (!moreOpen && view === item.id);
        return (
          <button
            key={item.id}
            className={`new-bottom-nav-tab${isActive ? ' active' : ''}`}
            onClick={() => {
              if (isMore) setMoreOpen(p => !p);
              else { setMoreOpen(false); navigate(item.id); }
            }}>
            {item.icon}
            <span className="new-bottom-nav-tab-label">{item.label}</span>
            <div className="new-bottom-nav-dot" />
          </button>
        );
      })}
    </div>
  );
}

export { BottomNav, BOTTOM_NAV };
