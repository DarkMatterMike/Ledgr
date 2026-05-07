/**
 * components/ui/index.jsx
 * Shared UI primitives used throughout the app.
 *   Modal, Toast, CustomSelect, CategoryBadge, PageLayout
 */
import { useState, useRef, useEffect } from 'react';
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

export function Toast({ msg }) { return msg ? <div style={S.toast} className="ledgr-toast-anim">✓ {msg}</div> : null; }

export function CustomSelect({ value, onChange, options, style = {}, compact = false }) {
  const isBlock = style.width === "100%" || style.flex;
  return (
    <select
      value={String(value)}
      onChange={e => onChange(e.target.value)}
      style={{
        backgroundColor:"var(--card)", border:"none",
        borderRadius:20, cursor:"pointer", outline:"none",
        padding: compact ? "5px 10px" : "8px 14px",
        fontSize: compact ? 12 : 13, color:"var(--t1)", fontWeight:500,
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

/* --- DragCard — drag-to-reorder wrapper with handle ---------------- */

export function CategoryBadge({ cat }) {
  if (!cat) return <span style={{color:"var(--t3)",fontSize:11}}>—</span>;
  return <span style={S.badge(cat.color)}><span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>{cat.name}</span>;
}

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
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: `minmax(0, 1fr) ${PAGE_RIGHT_COL_W}px`,
          gap: PAGE_COL_GAP,
          alignItems: "start",
        }}
      >
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

/* ✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓
   AUTH GATE  (email + password, multi-user)
✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓ */