/**
 * components/layout/BottomNav.jsx
 * Mobile bottom navigation bar with sliding accent indicator.
 */
import { useRef, useEffect } from 'react';

const BOTTOM_NAV = [
  { id:"dashboard",    label:"Home",      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id:"transactions", label:"Txns",      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg> },
  { id:"budgets",      label:"Budgets",   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg> },
  { id:"calendar",     label:"Calendar",  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { id:"ai",           label:"Ask AI",    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c-1 2.5-2.5 4-5 5 2.5 1 4 2.5 5 5 1-2.5 2.5-4 5-5-2.5-1-4-2.5-5-5z"/><path d="M5 3c-.5 1.5-1.5 2.5-3 3 1.5.5 2.5 1.5 3 3 .5-1.5 1.5-2.5 3-3-1.5-.5-2.5-1.5-3-3z"/></svg> },
  { id:"analytics",    label:"Analytics", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { id:"__more__",     label:"More",      icon: <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.75"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg> },
];

function BottomNav({ view, navigate, moreOpen, setMoreOpen }) {
  const navRef = useRef(null);
  const indicatorRef = useRef(null);

  const activeIdx = moreOpen ? BOTTOM_NAV.length - 1
    : BOTTOM_NAV.findIndex(n => n.id === view && n.id !== "__more__");

  useEffect(() => {
    const nav = navRef.current;
    const ind = indicatorRef.current;
    if (!nav || !ind) return;
    const items = nav.querySelectorAll('.mobile-nav-item');
    const target = items[activeIdx < 0 ? 0 : activeIdx];
    if (!target) return;
    const navRect = nav.getBoundingClientRect();
    const itemRect = target.getBoundingClientRect();
    ind.style.left = (itemRect.left - navRect.left) + 'px';
    ind.style.width = itemRect.width + 'px';
  }, [activeIdx]);

  // Set initial position without transition
  useEffect(() => {
    const ind = indicatorRef.current;
    if (ind) {
      ind.style.transition = 'none';
      requestAnimationFrame(() => {
        ind.style.transition = 'left 0.28s cubic-bezier(0.4,0,0.2,1), width 0.28s cubic-bezier(0.4,0,0.2,1)';
      });
    }
  }, []);

  return (
    <div className="mobile-bottom-nav" ref={navRef}>
      <div className="mobile-nav-indicator" ref={indicatorRef}/>
      {BOTTOM_NAV.map((item, idx) => {
        const isMore = item.id === "__more__";
        const isActive = isMore ? moreOpen : (!moreOpen && view === item.id);
        return (
          <button key={item.id}
            className={`mobile-nav-item${isActive ? " active" : ""}`}
            onClick={() => {
              if (isMore) { setMoreOpen(p => !p); }
              else { setMoreOpen(false); navigate(item.id); }
            }}>
            {item.icon}
            <span className="mobile-nav-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { BottomNav, BOTTOM_NAV };
