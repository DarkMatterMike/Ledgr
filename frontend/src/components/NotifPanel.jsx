/**
 * NotifPanel.jsx — shared notification bell + slide-in panel
 * Used by LedgrBriefing, LedgrCalendar, LedgrSettings.
 *
 * Props:
 *   notifs          [{id, type, ...}]  — filtered list (already excludes dismissed)
 *   onDismiss       (id) => void
 *   onNavigate      (view) => void
 *   onFilterReview  () => void         — navigates to transactions + enables review filter
 */
import { useState } from "react";

const CSS = `
  .np-bell {
    width:40px;height:40px;border-radius:10px;
    display:flex;align-items:center;justify-content:center;
    color:var(--ink-3);font-size:18px;cursor:pointer;
    transition:.15s;user-select:none;position:relative;
  }
  .np-bell:hover { color:var(--ink-1); background:var(--bg-2); }
  .np-bell.has-notifs { color:var(--warn); }
  .np-badge {
    position:absolute;top:6px;right:6px;
    width:8px;height:8px;border-radius:50%;
    background:var(--debt);
    box-shadow:0 0 6px var(--debt);
  }
  .np-panel {
    position:fixed;top:0;right:0;bottom:0;
    width:300px;z-index:1000;
    background:var(--bg-1);
    border-left:1px solid var(--line);
    display:flex;flex-direction:column;
    transform:translateX(100%);
    transition:transform .25s cubic-bezier(.16,1,.3,1);
    pointer-events:none;
  }
  .np-panel.open {
    transform:translateX(0);
    pointer-events:all;
  }
  .np-backdrop {
    position:fixed;inset:0;z-index:999;
    background:rgba(0,0,0,0.4);
    opacity:0;pointer-events:none;transition:opacity .25s;
  }
  .np-backdrop.open { opacity:1;pointer-events:all; }
  .np-header {
    height:48px;padding:0 16px;
    border-bottom:1px solid var(--line);
    display:flex;align-items:center;justify-content:space-between;
    flex-shrink:0;
  }
  .np-title {
    font-family:var(--font-mono);font-size:10px;
    letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-2);
  }
  .np-close {
    width:24px;height:24px;border-radius:6px;
    background:none;border:1px solid var(--line);
    color:var(--ink-3);cursor:pointer;font-size:14px;
    display:flex;align-items:center;justify-content:center;
    transition:.12s;
  }
  .np-close:hover { color:var(--ink-1);border-color:var(--line-2); }
  .np-list { flex:1;overflow-y:auto;padding:8px; }
  .np-empty {
    padding:40px 16px;text-align:center;
    font-size:12px;color:var(--ink-3);
  }
  .np-item {
    border-radius:8px;padding:12px;margin-bottom:6px;
    background:var(--bg-2);border:1px solid var(--line);
    display:flex;align-items:flex-start;gap:10px;
    cursor:pointer;transition:.12s;
  }
  .np-item:hover { border-color:var(--line-2); }
  .np-item.review { border-color:rgba(93,202,165,0.2); }
  .np-item.reauth { border-color:rgba(232,115,99,0.2); }
  .np-item.newtxn { border-color:rgba(108,140,255,0.2); }
  .np-dot {
    width:8px;height:8px;border-radius:50%;
    flex-shrink:0;margin-top:4px;
  }
  .np-dot.review { background:var(--safe); }
  .np-dot.reauth { background:var(--debt); }
  .np-dot.newtxn { background:var(--calm); }
  .np-dot.goal   { background:var(--goal,#a78bff); }
  .np-dot.duplicates { background:var(--warn); }
  .np-body { flex:1;min-width:0; }
  .np-label {
    font-size:12px;color:var(--ink-1);
    line-height:1.4;margin-bottom:3px;
  }
  .np-sub {
    font-size:10px;color:var(--ink-3);
    font-family:var(--font-mono);
  }
  .np-dismiss {
    background:none;border:none;color:var(--ink-4);
    font-size:14px;cursor:pointer;flex-shrink:0;
    padding:0 2px;transition:color .12s;line-height:1;
  }
  .np-dismiss:hover { color:var(--ink-2); }
`;

const TYPE_DOT  = { review:"review", reauth:"reauth", newtxn:"newtxn", goal:"goal", duplicates:"duplicates" };

function notifContent(n, fmt) {
  switch (n.type) {
    case "review":
      return { label: `${n.count} transaction${n.count!==1?"s":""} need review`, sub: "Tap to filter transactions" };
    case "reauth":
      return { label: `${n.institution} needs reconnection`, sub: "Tap to go to Settings" };
    case "newtxn":
      return { label: `New: ${n.merchant}`, sub: `${n.date}  ·  ${fmt ? fmt(n.amount) : `$${Math.abs(n.amount).toFixed(2)}`}` };
    case "goal":
      return { label: `Goal reminder: ${n.goal?.title || "Goal"}`, sub: "Contribution due today" };
    case "duplicates":
      return { label: `${n.count} possible duplicate${n.count!==1?"s":""} found`, sub: "Tap to review" };
    default:
      return { label: "Notification", sub: "" };
  }
}

export default function NotifPanel({ notifs = [], onDismiss, onNavigate, onFilterReview, fmt }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{CSS}</style>

      {/* Bell button — sits in lb-nav */}
      <div
        className={`np-bell${notifs.length > 0 ? " has-notifs" : ""}`}
        onClick={() => setOpen(true)}
        title={`${notifs.length} notification${notifs.length !== 1 ? "s" : ""}`}
      >
        🔔
        {notifs.length > 0 && <span className="np-badge"/>}
      </div>

      {/* Backdrop */}
      <div className={`np-backdrop${open ? " open" : ""}`} onClick={() => setOpen(false)}/>

      {/* Panel */}
      <div className={`np-panel${open ? " open" : ""}`}>
        <div className="np-header">
          <span className="np-title">Notifications {notifs.length > 0 ? `· ${notifs.length}` : ""}</span>
          <button className="np-close" onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="np-list">
          {notifs.length === 0 ? (
            <div className="np-empty">You're all caught up ✓</div>
          ) : notifs.map(n => {
            const { label, sub } = notifContent(n, fmt);
            const dotClass = TYPE_DOT[n.type] || "goal";
            return (
              <div
                key={n.id}
                className={`np-item ${n.type}`}
                onClick={() => {
                  if (n.type === "review")      { onFilterReview?.(); setOpen(false); }
                  else if (n.type === "reauth") { onNavigate?.("settings"); setOpen(false); }
                  else if (n.type === "duplicates") { onNavigate?.("transactions"); setOpen(false); }
                  else if (n.type === "newtxn") { onNavigate?.("transactions"); setOpen(false); }
                  else setOpen(false);
                }}
              >
                <span className={`np-dot ${dotClass}`}/>
                <div className="np-body">
                  <div className="np-label">{label}</div>
                  {sub && <div className="np-sub">{sub}</div>}
                </div>
                <button className="np-dismiss" onClick={e => { e.stopPropagation(); onDismiss?.(n.id); }}>×</button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
