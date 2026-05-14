/**
 * PageNav.jsx — shared nav rail used by every lb-* page
 *
 * Renders the 64px left nav rail with logo, nav items, notification bell,
 * and settings cog. Replaces the duplicated nav in each page component.
 *
 * Props:
 *   activeId       {string}   — current page id (highlights the matching icon)
 *   navigate       {Function}
 *   notifs         {Array}    — passed to NotifPanel
 *   onDismissNotif {Function}
 *   onFilterReview {Function}
 *   fmt            {Function} — optional, passed to NotifPanel
 */
import NotifPanel from "./NotifPanel.jsx";

export const NAV = [
  { icon:"◐", id:"dashboard"    },
  { icon:"⇅", id:"transactions" },
  { icon:"▣", id:"accounts"     },
  { icon:"◉", id:"budgets"      },
  { icon:"▦", id:"calendar"     },
  { icon:"◈", id:"analytics"    },
];

const CSS = `
  .pn-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);flex-shrink:0;align-self:stretch;min-height:100%;}
  .pn-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d,#0f6e56) 80%);margin-bottom:24px;flex-shrink:0;}
  .pn-item{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;flex-shrink:0;}
  .pn-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .pn-item.active{color:var(--safe);background:var(--safe-bg,rgba(93,202,165,0.08));}
  .pn-spacer{flex:1;}
  .pn-divider{width:32px;height:1px;background:var(--line-2);margin:4px 0;flex-shrink:0;}
  .pn-settings{color:var(--ink-3);}
`;

let cssInjected = false;

export default function PageNav({ activeId, navigate, notifs=[], onDismissNotif=()=>{}, onFilterReview=()=>{}, fmt }) {
  if (!cssInjected) {
    cssInjected = true;
    const s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  return (
    <nav className="pn-nav">
      <div className="pn-logo"/>
      {NAV.map(n => (
        <div key={n.id} className={`pn-item${n.id === activeId ? " active" : ""}`} onClick={() => navigate(n.id)} title={n.id}>
          {n.icon}
        </div>
      ))}
      <div className="pn-spacer"/>
      <div className="pn-divider"/>
      <NotifPanel notifs={notifs} onDismiss={onDismissNotif} onNavigate={navigate} onFilterReview={onFilterReview} fmt={fmt}/>
      <div
        className={`pn-item pn-settings${activeId === "settings" ? " active" : ""}`}
        onClick={() => navigate("settings")}
        title="settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </div>
    </nav>
  );
}
