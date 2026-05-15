/**
 * components/ui/index.jsx
 * Shared UI primitives used throughout the app.
 *   Modal, Toast, CustomSelect, CategoryBadge, PageLayout
 */
import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { S } from '../../theme/index.js';
import { PAGE_RIGHT_COL_W, PAGE_COL_GAP, SHARED_LEFT_WIDTH } from '../../constants.js';

export function Modal({ title, onClose, children, actions }) {
  return (
    <div style={S.overlay} className="ledgr-overlay-anim" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal} className="ledgr-modal-anim">
        <div style={S.modalTitle}>{title}</div>
        {children}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:24}}>{actions}</div>
      </div>
    </div>
  );
}
Modal.propTypes = {
  title:    PropTypes.string.isRequired,
  onClose:  PropTypes.func.isRequired,
  children: PropTypes.node,
  actions:  PropTypes.node,
};

/* ── Ledger Line Toast ─────────────────────────────────────────────
   Concept 1: a slim ruled line rising from the bottom of the viewport.
   Handles both regular toasts (msg) and undo toasts (undoAction).
   On mobile sits above the bottom nav (isMobile=true adds bottom offset).
────────────────────────────────────────────────────────────────── */
function toastType(msg) {
  if (!msg) return 'safe';
  const m = msg.toLowerCase();
  if (m.includes('error') || m.includes('fail') || m.includes('delet') || m.includes('disconnect')) return 'debt';
  if (m.includes('sync') || m.includes('review') || m.includes('pending') || m.includes('categoriz')) return 'warn';
  return 'safe';
}

const TOAST_CSS = `
  .lt-toast-wrap {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 999;
    pointer-events: none;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  .lt-toast-wrap.mobile { bottom: 58px; }
  .lt-toast {
    height: 38px;
    padding: 0 22px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-2, #11151d);
    border-top: 1px solid rgba(255,255,255,0.08);
    font-size: 12px;
    color: var(--ink-1, #c8cdd6);
    transform: translateY(100%);
    transition: transform 0.22s cubic-bezier(0.22,1,0.36,1);
    pointer-events: auto;
    white-space: nowrap;
    overflow: hidden;
  }
  .lt-toast.visible { transform: translateY(0); }
  .lt-pip {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    transition: background 0.2s;
  }
  .lt-pip.safe { background: #5dcaa5; box-shadow: 0 0 7px #5dcaa5; animation: lt-pip-pulse 1.1s ease-out forwards; }
  .lt-pip.warn { background: #f0b04c; box-shadow: 0 0 7px #f0b04c; animation: lt-pip-pulse 1.1s ease-out forwards; }
  .lt-pip.debt { background: #e87363; box-shadow: 0 0 7px #e87363; animation: lt-pip-pulse 1.1s ease-out forwards; }
  @keyframes lt-pip-pulse {
    0%  { transform: scale(1.9); }
    60% { transform: scale(1); }
    100%{ transform: scale(1); }
  }
  .lt-toast-msg { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .lt-undo-btn {
    background: none; border: none; cursor: pointer;
    font-family: inherit; font-size: 12px;
    color: #6c8cff; padding: 0; margin-left: 8px; flex-shrink: 0;
  }
  .lt-undo-btn:hover { text-decoration: underline; }
  .lt-close-btn {
    background: none; border: none; cursor: pointer;
    color: var(--ink-4, #2e3340); font-size: 14px; line-height: 1;
    padding: 0; margin-left: 10px; flex-shrink: 0;
  }
  .lt-close-btn:hover { color: var(--ink-0, #f4f4f1); }
`;

export function Toast({ msg, undoAction, onUndo, onDismiss, isMobile = false }) {
  const [visible, setVisible]     = useState(false);
  const [type,    setType]        = useState('safe');
  const [display, setDisplay]     = useState('');
  const [hasUndo, setHasUndo]     = useState(false);
  const hideTimer = useRef(null);
  const pipRef    = useRef(null);

  // Active content is either the undo action label or the regular msg
  useEffect(() => {
    const active = undoAction ? undoAction.label : msg;
    if (active) {
      const t = undoAction ? 'safe' : toastType(active);
      setDisplay(active);
      setType(t);
      setHasUndo(!!undoAction);
      setVisible(true);
      // Re-trigger pip animation
      if (pipRef.current) {
        pipRef.current.style.animation = 'none';
        void pipRef.current.offsetHeight;
        pipRef.current.style.animation = '';
      }
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        if (undoAction) onDismiss?.();
      }, undoAction ? 4200 : 2800);
    } else {
      setVisible(false);
    }
    return () => clearTimeout(hideTimer.current);
  }, [msg, undoAction]);

  function handleUndo() {
    clearTimeout(hideTimer.current);
    setVisible(false);
    onUndo?.();
  }
  function handleClose() {
    clearTimeout(hideTimer.current);
    setVisible(false);
    if (undoAction) onDismiss?.();
  }

  return (
    <>
      <style>{TOAST_CSS}</style>
      <div className={`lt-toast-wrap${isMobile ? ' mobile' : ''}`}>
        <div className={`lt-toast${visible ? ' visible' : ''}`}>
          <span ref={pipRef} className={`lt-pip ${type}`} />
          <span className="lt-toast-msg">{display}</span>
          {hasUndo && (
            <button className="lt-undo-btn" onClick={handleUndo}>Undo</button>
          )}
          <button className="lt-close-btn" onClick={handleClose}>✕</button>
        </div>
      </div>
    </>
  );
}
Toast.propTypes = {
  msg:        PropTypes.string,
  undoAction: PropTypes.shape({ label: PropTypes.string, fn: PropTypes.func }),
  onUndo:     PropTypes.func,
  onDismiss:  PropTypes.func,
  isMobile:   PropTypes.bool,
};

export function CustomSelect({ value, onChange, options, style = {}, compact = false }) {
  const isBlock = style.width === "100%" || style.flex;
  return (
    <select
      value={String(value)}
      onChange={e => onChange(e.target.value)}
      style={{
        backgroundColor:"var(--bg-2)", border:"none",
        borderRadius:20, cursor:"pointer", outline:"none",
        padding: compact ? "5px 10px" : "8px 14px",
        fontSize: compact ? 12 : 13, color:"var(--ink-0)", fontWeight:500,
        width: isBlock ? "100%" : "auto",
        appearance:"none", WebkitAppearance:"none",
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E")`,
        backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center",
        paddingRight:28, boxSizing:"border-box",
        ...style,
      }}>
      {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}
CustomSelect.propTypes = {
  value:    PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  options:  PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    label: PropTypes.string.isRequired,
  })).isRequired,
  style:   PropTypes.object,
  compact: PropTypes.bool,
};

export function CategoryBadge({ cat }) {
  if (!cat) return <span style={{color:"var(--ink-2)",fontSize:11}}>—</span>;
  return (
    <span style={S.badge(cat.color)}>
      <span style={{width:5,height:5,borderRadius:"50%",background:cat.color,display:"inline-block",opacity:0.85}}/>
      {cat.name}
    </span>
  );
}
CategoryBadge.propTypes = {
  cat: PropTypes.shape({
    id:    PropTypes.string,
    name:  PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
  }),
};

export function PageLayout({ left, right = null, isMobile = false, mobileRightFirst = false }) {
  if (isMobile) {
    return (
      <div style={{ width: "100%" }}>
        {mobileRightFirst && right ? <div style={{ marginBottom: 10 }}>{right}</div> : null}
        {left}
        {!mobileRightFirst && right ? <div style={{ marginTop: 16 }}>{right}</div> : null}
      </div>
    );
  }

  if (right) {
    return (
      <div style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: `minmax(0, 1fr) ${PAGE_RIGHT_COL_W}px`,
        gap: PAGE_COL_GAP,
        alignItems: "start",
      }}>
        <div style={{ minWidth: 0 }}>{left}</div>
        <div style={{ minWidth: 0 }}>{right}</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: SHARED_LEFT_WIDTH, minWidth: 0 }}>
      {left}
    </div>
  );
}
PageLayout.propTypes = {
  left:             PropTypes.node.isRequired,
  right:            PropTypes.node,
  isMobile:         PropTypes.bool,
  mobileRightFirst: PropTypes.bool,
};
