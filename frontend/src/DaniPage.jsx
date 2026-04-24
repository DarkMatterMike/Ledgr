/**
 * DaniPage.jsx — Owner-only personal spending power + wishlist tracker
 *
 * Left col:  Drag-and-drop wishlist with purchase tracking
 * Right col: Balance card — freely spendable amount after upcoming bills & income
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const fmt = n => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(n ?? 0);
const today = new Date();
const pad   = n => String(n).padStart(2, "0");

/* ── Colour tokens (match app theme) ─────────────────────────────── */
const C = {
  card:      "var(--card)",
  surface:   "var(--surface)",
  border:    "var(--border)",
  border2:   "var(--border2)",
  t1:        "var(--t1)",
  t2:        "var(--t2)",
  t3:        "var(--t2)",  // use t2 shade throughout this page
  cyan:      "var(--cyan)",
  green:     "var(--green)",
  red:       "var(--red)",
  amber:     "var(--amber)",
  cyanDim:   "var(--cyan-dim)",
  greenDim:  "var(--green-dim)",
  redDim:    "var(--red-dim)",
  amberDim:  "var(--amber-dim)",
  radius:    "var(--radius)",
  radiusLg:  "var(--radius-lg)",
  fontMono:  "var(--font-mono)",
  fontDisp:  "var(--font-disp)",
  fontBody:  "var(--font-body)",
};

/* ── Tiny style helpers ───────────────────────────────────────────── */
const card   = (extra={}) => ({ background:C.card, border:`1px solid ${C.border}`, borderRadius:C.radiusLg, padding:"12px 16px", ...extra });
const btn    = (variant="ghost", sm=false) => {
  const base = { display:"inline-flex", alignItems:"center", gap:5, padding:sm?"3px 8px":"5px 11px", borderRadius:C.radius, fontSize:12, fontWeight:500, cursor:"pointer", border:"1px solid transparent", transition:"all 0.15s", userSelect:"none", lineHeight:"1.4", whiteSpace:"nowrap", fontFamily:C.fontBody };
  if (variant==="primary") return { ...base, background:C.cyan, color:"#000", borderColor:C.cyan };
  if (variant==="danger")  return { ...base, background:C.redDim, color:C.red, borderColor:"#ff4d6d44" };
  if (variant==="green")   return { ...base, background:C.greenDim, color:C.green, borderColor:"#00e67644" };
  return { ...base, background:"transparent", color:C.t2, borderColor:C.border2 };
};
const input  = (extra={}) => ({ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:C.radius, padding:"7px 10px", fontSize:12, color:C.t1, outline:"none", width:"100%", fontFamily:C.fontBody, boxSizing:"border-box", ...extra });
const label  = { fontSize:10, color:C.t2, textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:4, display:"block", fontFamily:C.fontDisp };
const cardTitle = { fontFamily:C.fontDisp, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"1.5px", color:C.t2, marginBottom:10 };

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function DaniPage({
  accounts       = [],
  transactions   = [],
  recurringTxns  = [],
  daniData       = { selectedAccountId: null, wishlist: [] },
  isMobile       = false,
  onSave,          // (patch) => void  — persists to server
}) {
  /* ── Local state (mirrors daniData props) ───────────────────────── */
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    // localStorage first (has existing data), then server prop
    return localStorage.getItem("dani_accountId") || daniData.selectedAccountId || null;
  });
  const [wishlist, setWishlist] = useState(() => {
    // localStorage first (has existing data from previous sessions), then server prop
    try {
      const stored = localStorage.getItem("dani_wishlist");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.length) return parsed;
      }
    } catch {}
    return daniData.wishlist || [];
  });

  // One-time migration: if localStorage has data the server doesn't yet know about,
  // push it up to the server so future devices see it
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    try {
      const stored = localStorage.getItem("dani_wishlist");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.length && (!daniData.wishlist || daniData.wishlist.length === 0)) {
          // Server is empty but localStorage has data — push it up
          const acctId = localStorage.getItem("dani_accountId") || daniData.selectedAccountId || null;
          onSave?.({ dani: { selectedAccountId: acctId, wishlist: parsed } });
        }
      }
    } catch {}
  }, []); // eslint-disable-line

  // Sync from server when it loads (only if local state is empty)
  const prevDaniRef = useRef(null);
  useEffect(() => {
    const key = JSON.stringify(daniData);
    if (prevDaniRef.current === key) return;
    prevDaniRef.current = key;
    if (daniData.selectedAccountId) setSelectedAccountId(daniData.selectedAccountId);
    // Only overwrite local wishlist from server if we have no local data
    setWishlist(prev => {
      if (prev.length === 0 && daniData.wishlist?.length) return daniData.wishlist;
      return prev;
    });
  }, [daniData]);

  /* ── Add-item form ──────────────────────────────────────────────── */
  const [formName, setFormName] = useState("");
  const [formCost, setFormCost] = useState("");

  /* ── Editing state ──────────────────────────────────────────────── */
  const [editingId,   setEditingId]   = useState(null);
  const [editingCost, setEditingCost] = useState("");

  /* ── Drag state ─────────────────────────────────────────────────── */
  const dragIdx  = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  /* ── Persist on change ──────────────────────────────────────────── */
  const save = useCallback((patch) => { onSave?.(patch); }, [onSave]);

  function updateAccount(id) {
    setSelectedAccountId(id);
    localStorage.setItem("dani_accountId", id);
    save({ dani: { selectedAccountId: id, wishlist } });
  }

  function updateWishlist(next) {
    setWishlist(next);
    localStorage.setItem("dani_wishlist", JSON.stringify(next));
    save({ dani: { selectedAccountId, wishlist: next } });
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditingCost(String(item.cost));
  }

  function commitEdit(id) {
    const cost = parseFloat(editingCost);
    if (!isNaN(cost) && cost > 0) {
      updateWishlist(wishlist.map(w => w.id === id ? { ...w, cost } : w));
    }
    setEditingId(null);
    setEditingCost("");
  }

  /* ── Selected account ───────────────────────────────────────────── */
  const account = accounts.find(a => a.id === selectedAccountId) || accounts[0] || null;
  const balance = account?.balance ?? 0;

  /* ── Shared frequency helper (mirrors calendar logic) ───────────── */
  const getOccurrenceDaysThisMonth = useCallback((t) => {
    const yr      = today.getFullYear();
    const mo      = today.getMonth();
    const daysInMo = new Date(yr, mo + 1, 0).getDate();
    const freq    = t.recurringFreq || "monthly";
    const start   = t.recurringStart ? new Date(t.recurringStart + "T12:00:00") : null;
    if (freq === "monthly") {
      const d = parseInt(t.recurringDay || 0);
      return d >= 1 && d <= daysInMo ? [d] : [];
    }
    if (freq === "annual") {
      if (!start) return [];
      return start.getMonth() === mo ? [start.getDate()] : [];
    }
    if (freq === "weekly" || freq === "biweekly") {
      if (!start) {
        const d = parseInt(t.recurringDay || 0);
        return d >= 1 && d <= daysInMo ? [d] : [];
      }
      const interval = freq === "weekly" ? 7 : 14;
      // Use setDate for DST-safe day arithmetic (avoids off-by-one across spring-forward)
      let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const monthStart = new Date(yr, mo, 1);
      while (cur >= monthStart) { cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - interval); }
      const days = [];
      for (let i = 0; i < 60; i++) {
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + interval);
        if (cur.getFullYear() === yr && cur.getMonth() === mo) days.push(cur.getDate());
        if (cur.getFullYear() > yr || (cur.getFullYear() === yr && cur.getMonth() > mo)) break;
      }
      return days;
    }
    return [];
  }, []);

  /* ── Free-to-spend calculation ──────────────────────────────────── */
  const freeToSpend = useMemo(() => {
    if (!account) return 0;
    const todayDay = today.getDate();
    const PAYCHECK_DEDUCTION = 1100;
    let expenses = 0, income = 0;
    recurringTxns.forEach(t => {
      if (account && t.accountId && t.accountId !== account.id) return;
      const days = getOccurrenceDaysThisMonth(t).filter(d => d > todayDay);
      if (!days.length) return;
      if (t.amount < 0) expenses += Math.abs(t.amount) * days.length;
      else income += Math.max(0, t.amount - PAYCHECK_DEDUCTION) * days.length;
    });
    return (balance - 100) - expenses + income;
  }, [account, recurringTxns, balance, getOccurrenceDaysThisMonth]);

  /* ── Upcoming bills list ────────────────────────────────────────── */
  const upcomingBills = useMemo(() => {
    if (!account) return [];
    const todayDay = today.getDate();
    const rows = [];
    recurringTxns.forEach(t => {
      if (account && t.accountId && t.accountId !== account.id) return;
      const days = getOccurrenceDaysThisMonth(t).filter(d => d > todayDay);
      days.forEach(d => rows.push({ ...t, _occurrenceDay: d }));
    });
    return rows.sort((a, b) => a._occurrenceDay - b._occurrenceDay);
  }, [recurringTxns, account, getOccurrenceDaysThisMonth]);

  /* ── Day-by-day cash flow simulation ───────────────────────────── */
  const { wishlistWithStatus, nextPayday, dailyBalances } = useMemo(() => {
    const todayDay  = today.getDate();
    const yr        = today.getFullYear();
    const mo        = today.getMonth();
    const daysInMo  = new Date(yr, mo + 1, 0).getDate();
    const DEDUCTION = 1100;
    const start     = Math.max(0, (balance ?? 0) - 100);

    // ── Helper: get all days-of-month a recurring txn fires this month
    // Mirrors the calendar's projection logic exactly (handles biweekly/weekly/monthly/annual)
    function getOccurrenceDays(t) {
      const freq  = t.recurringFreq || "monthly";
      const start = t.recurringStart ? new Date(t.recurringStart + "T12:00:00") : null;

      if (freq === "monthly") {
        const d = parseInt(t.recurringDay || 0);
        return d >= 1 && d <= daysInMo ? [d] : [];
      }
      if (freq === "annual") {
        if (!start) return [];
        return start.getMonth() === mo ? [start.getDate()] : [];
      }
      if (freq === "weekly" || freq === "biweekly") {
        if (!start) {
          const d = parseInt(t.recurringDay || 0);
          return d >= 1 && d <= daysInMo ? [d] : [];
        }
        const interval = freq === "weekly" ? 7 : 14;
        // Use setDate for DST-safe day arithmetic
        let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const monthStart = new Date(yr, mo, 1);
        while (cur >= monthStart) { cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - interval); }
        const days = [];
        for (let i = 0; i < 60; i++) {
          cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + interval);
          if (cur.getFullYear() === yr && cur.getMonth() === mo) days.push(cur.getDate());
          if (cur.getFullYear() > yr || (cur.getFullYear() === yr && cur.getMonth() > mo)) break;
        }
        return days;
      }
      return [];
    }

    // ── Step 1: Build baseBalance[d] = account balance at start of day d
    // Day todayDay = current API balance. Each future day applies scheduled events.
    const baseBalance = {};
    baseBalance[todayDay] = start;
    for (let d = todayDay + 1; d <= daysInMo; d++) {
      let delta = 0;
      recurringTxns.forEach(t => {
        // Scope to selected account
        if (account && t.accountId && t.accountId !== account.id) return;
        const hits = getOccurrenceDays(t);
        if (!hits.includes(d)) return;
        if (t.amount < 0) {
          delta += t.amount;
        } else {
          delta += Math.max(0, t.amount - DEDUCTION);
        }
      });
      baseBalance[d] = (baseBalance[d - 1] ?? start) + delta;
    }

    // ── Step 2: Next payday — first upcoming income occurrence for this account
    let np = null;
    for (let d = todayDay + 1; d <= daysInMo; d++) {
      let found = null;
      recurringTxns.forEach(t => {
        if (found) return;
        if (t.amount <= 0) return;
        if (account && t.accountId && t.accountId !== account.id) return;
        if (getOccurrenceDays(t).includes(d)) found = t;
      });
      if (found) {
        np = {
          day:      d,
          date:     new Date(yr, mo, d).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
          amount:   found.amount,
          net:      Math.max(0, found.amount - DEDUCTION),
          daysAway: d - todayDay,
        };
        break;
      }
    }

    // ── Step 3: Wishlist affordability — single-pass in priority order.
    // We maintain a running "committed spend" that reduces available balance
    // on the day of purchase and every day after.
    // committed[d] = total wishlist cost committed to be spent on day d.
    const committed = {};
    const addCommit = (d, cost) => { committed[d] = (committed[d] || 0) + cost; };

    // availableOn(d) = baseBalance[d] minus all wishlist purchases on days <= d
    const availableOn = (d) => {
      const base = baseBalance[d] ?? baseBalance[daysInMo] ?? 0;
      let used = 0;
      for (const [k, v] of Object.entries(committed)) {
        if (Number(k) <= d) used += v;
      }
      return base - used;
    };

    const enriched = wishlist.map(item => {
      if (item.purchased) {
        return { ...item, status:"purchased", availableDay:null, availableDate:null, balanceAfter:null };
      }

      // Search every day from today onward for the first day we can afford this item
      for (let d = todayDay; d <= daysInMo; d++) {
        const avail = availableOn(d);
        if (avail >= item.cost) {
          addCommit(d, item.cost);
          const after = avail - item.cost;
          if (d === todayDay) {
            return { ...item, status:"now", availableDay:d, availableDate:"Now", balanceAfter:after };
          }
          const dateStr = new Date(yr, mo, d).toLocaleDateString("en-US", { month:"short", day:"numeric" });
          return { ...item, status:"soon", availableDay:d, availableDate:dateStr, balanceAfter:after };
        }
      }

      return { ...item, status:"wait", availableDay:null, availableDate:null, balanceAfter:null };
    });

    return { wishlistWithStatus: enriched, nextPayday: np, dailyBalances: baseBalance };
  }, [wishlist, balance, recurringTxns, account]);

  /* ── Add item ───────────────────────────────────────────────────── */
  function addItem() {
    const name = formName.trim();
    const cost = parseFloat(formCost);
    if (!name || isNaN(cost) || cost <= 0) return;
    const next = [...wishlist, { id: `w${Date.now()}`, name, cost, purchased: false, addedAt: Date.now() }];
    updateWishlist(next);
    setFormName(""); setFormCost("");
  }

  /* ── Mark purchased ─────────────────────────────────────────────── */
  function markPurchased(id) {
    const next = wishlist.filter(w => w.id !== id);
    updateWishlist(next);
  }

  /* ── Delete item ────────────────────────────────────────────────── */
  function deleteItem(id) {
    updateWishlist(wishlist.filter(w => w.id !== id));
  }

  /* ── Drag handlers ──────────────────────────────────────────────── */
  function onDragStart(i) { dragIdx.current = i; }
  function onDragEnter(i) { setDragOver(i); }
  function onDragEnd() {
    if (dragIdx.current === null || dragOver === null || dragIdx.current === dragOver) {
      dragIdx.current = null; setDragOver(null); return;
    }
    const next = [...wishlist];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(dragOver, 0, moved);
    dragIdx.current = null; setDragOver(null);
    updateWishlist(next);
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  const isFreePositive = freeToSpend > 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {/* Page header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontFamily:C.fontDisp, fontSize:14, fontWeight:700, color:C.t1 }}>Dani</div>
          <div style={{ fontSize:11, color:C.t2, marginTop:2 }}>Spending power & wishlist</div>
        </div>
        {/* Account selector */}
        <select
          value={selectedAccountId || ""}
          onChange={e => updateAccount(e.target.value)}
          style={{ background:C.surface, border:`1px solid ${C.border2}`, borderRadius:C.radius, padding:"5px 8px", fontSize:11, color:C.t1, outline:"none", cursor:"pointer" }}
        >
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Two-column layout */}
      <div style={{ display:isMobile?"flex":"grid", flexDirection:"column-reverse", gridTemplateColumns:"minmax(0,1fr) 320px", gap:10, alignItems:"start", width:"100%" }}>

        {/* ══ LEFT: Wishlist ══════════════════════════════════════════ */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", minWidth:0 }}>

          {/* Add item form */}
          <div style={card()}>
            <div style={cardTitle}>Add to Wishlist</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:8, alignItems:"end" }}>
              <div>
                <span style={label}>Item name</span>
                <input
                  style={input()}
                  placeholder="e.g. AirPods Pro"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addItem()}
                />
              </div>
              <div>
                <span style={label}>Cost</span>
                <input
                  style={input({ width:100, fontFamily:C.fontMono })}
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  value={formCost}
                  onChange={e => setFormCost(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addItem()}
                />
              </div>
              <button style={btn("primary")} onClick={addItem}>+ Add</button>
            </div>
          </div>

          {/* Wishlist */}
          <div style={card({ padding:0, overflow:"hidden" })}>
            <div style={{ padding:"10px 14px 8px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={cardTitle}>Wishlist</div>
              {wishlist.length > 0 && (
                <div style={{ fontSize:10, color:C.t2 }}>
                  Drag to reorder priority
                </div>
              )}
            </div>

            {wishlist.length === 0 ? (
              <div style={{ padding:"32px 16px", textAlign:"center" }}>
                <div style={{ fontSize:24, marginBottom:8, opacity:0.3 }}>🛍️</div>
                <div style={{ fontSize:12, color:C.t2 }}>No items yet — add something above</div>
              </div>
            ) : (
              <div>
                {wishlistWithStatus.map((item, i) => {
                  const isNow        = item.status === "now";
                  const isSoon       = item.status === "soon";
                  const isDragging   = dragOver === i;
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => onDragStart(i)}
                      onDragEnter={() => onDragEnter(i)}
                      onDragEnd={onDragEnd}
                      onDragOver={e => e.preventDefault()}
                      style={{
                        display:"flex", alignItems:"center", gap:10,
                        padding:"11px 14px",
                        borderBottom: i < wishlist.length - 1 ? `1px solid ${C.border}` : "none",
                        borderTop: isDragging ? `2px solid ${C.cyan}` : "2px solid transparent",
                        background: isDragging ? C.cyanDim : "transparent",
                        transition:"background 0.1s, border-color 0.1s",
                        cursor:"grab",
                        opacity: item.purchased ? 0.5 : 1,
                      }}
                    >
                      {/* Drag handle */}
                      <div style={{ color:C.t2, fontSize:14, flexShrink:0, cursor:"grab", lineHeight:1, userSelect:"none" }}>⠿</div>

                      {/* Priority number */}
                      <div style={{
                        width:20, height:20, borderRadius:"50%", flexShrink:0,
                        background: isNow ? C.cyanDim : isSoon ? C.amberDim : C.surface,
                        border: `1px solid ${isNow ? C.cyan+"66" : isSoon ? C.amber+"66" : C.border2}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:10, fontFamily:C.fontMono, fontWeight:700,
                        color: isNow ? C.cyan : isSoon ? C.amber : C.t2,
                      }}>
                        {i + 1}
                      </div>

                      {/* Name */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:C.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {item.name}
                        </div>
                        {/* Status badge */}
                        <div style={{ marginTop:3, display:"flex", alignItems:"center", gap:6 }}>
                          {isNow ? (
                            <span style={{ fontSize:10, fontWeight:600, color:C.green, background:C.greenDim, padding:"1px 6px", borderRadius:99, border:`1px solid ${C.green}33` }}>
                              ✓ Buy now
                            </span>
                          ) : isSoon ? (
                            <span style={{ fontSize:10, fontWeight:600, color:C.amber, background:C.amberDim, padding:"1px 6px", borderRadius:99, border:`1px solid ${C.amber}33` }}>
                              After {item.availableDate}
                            </span>
                          ) : (
                            <span style={{ fontSize:10, fontWeight:600, color:C.t2, background:C.surface, padding:"1px 6px", borderRadius:99, border:`1px solid ${C.border2}` }}>
                              Not this month
                            </span>
                          )}
                          {(isNow || isSoon) && item.balanceAfter != null && (
                            <span style={{ fontSize:10, color:C.t2 }}>
                              {fmt(item.balanceAfter)} left after
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cost — click to edit */}
                      {editingId === item.id ? (
                        <input
                          autoFocus
                          type="number" min="0" step="0.01"
                          value={editingCost}
                          onChange={e => setEditingCost(e.target.value)}
                          onBlur={() => commitEdit(item.id)}
                          onKeyDown={e => { if (e.key === "Enter") commitEdit(item.id); if (e.key === "Escape") { setEditingId(null); } }}
                          style={{ width:80, fontFamily:C.fontMono, fontSize:12, fontWeight:700, color:C.t1, background:C.surface, border:`1px solid ${C.cyan}`, borderRadius:C.radius, padding:"3px 6px", outline:"none", textAlign:"right" }}
                        />
                      ) : (
                        <div
                          title="Click to edit cost"
                          onClick={() => startEdit(item)}
                          style={{ fontFamily:C.fontMono, fontSize:13, fontWeight:700, color:C.t1, flexShrink:0, cursor:"text", borderBottom:`1px dashed ${C.border2}`, paddingBottom:1 }}
                        >
                          {fmt(item.cost)}
                        </div>
                      )}

                      {/* Actions */}
                      {(() => {
                        const isPayment = item.name.toLowerCase().includes("payment");
                        return (
                        <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                          <button
                            title={isPayment ? "Mark as paid" : "Mark as purchased"}
                            onClick={() => markPurchased(item.id)}
                            style={btn("ghost", true)}
                            onMouseEnter={e => { e.currentTarget.style.background=C.greenDim; e.currentTarget.style.color=C.green; e.currentTarget.style.borderColor=C.green+"44"; }}
                            onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color=C.t2; e.currentTarget.style.borderColor=C.border2; }}
                          >
                            {isPayment ? "✓ Paid" : "✓ Bought"}
                          </button>
                        <button
                          title="Remove"
                          onClick={() => deleteItem(item.id)}
                          style={{ background:"none", border:"none", cursor:"pointer", color:C.t2, fontSize:15, padding:"2px 4px", lineHeight:1 }}
                        >
                          ×
                        </button>
                      </div>
                      );})()}
                    </div>
                  );
                })}

                {/* Totals footer */}
                <div style={{ padding:"10px 14px", background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, color:C.t2 }}>{wishlist.length} item{wishlist.length !== 1 ? "s" : ""} · {wishlistWithStatus.filter(w=>w.status==="now").length} affordable now</span>
                  <span style={{ fontSize:12, fontFamily:C.fontMono, fontWeight:700, color:C.t1 }}>
                    {fmt(wishlist.reduce((s,w)=>s+w.cost,0))} total
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: Balance card + bills ════════════════════════════ */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, position:isMobile?"static":"sticky", top:16, width:"100%", minWidth:0 }}>

          {/* Free-to-spend card */}
          <div style={card({ padding:0, overflow:"hidden" })}>
            {/* Header */}
            <div style={{ padding:"14px 16px 10px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
              <div style={cardTitle}>Free to Spend</div>
              <div style={{ fontFamily:C.fontMono, fontSize:32, fontWeight:700, color: isFreePositive ? C.green : C.red, lineHeight:1 }}>
                {fmt(freeToSpend)}
              </div>
              <div style={{ fontSize:11, color:C.t2, marginTop:4 }}>
                After upcoming bills through end of {today.toLocaleDateString("en-US",{month:"long"})}
              </div>
            </div>

            {/* Account balance */}
            <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:11, color:C.t2 }}>{account?.name || "—"}</div>
                  <div style={{ fontFamily:C.fontMono, fontSize:16, fontWeight:600, color:C.cyan }}>
                    {fmt(balance)}
                  </div>
                </div>
                <div style={{ fontSize:10, color:C.t2, textAlign:"right" }}>Current balance</div>
              </div>
            </div>

            {/* Next payday */}
            {nextPayday && (
              <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>💸</span>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:C.t1 }}>Next payday</div>
                    <div style={{ fontSize:10, color:C.t2 }}>{nextPayday.date} · {nextPayday.daysAway}d away</div>
                  </div>
                </div>
                <div style={{ fontFamily:C.fontMono, fontSize:12, fontWeight:700, color:C.green }}>
                  +{fmt(nextPayday.amount)}
                </div>
              </div>
            )}
          </div>

          {/* Upcoming bills card */}
          <div style={card({ padding:0, overflow:"hidden" })}>
            <div style={{ padding:"10px 14px 8px", borderBottom:`1px solid ${C.border}` }}>
              <div style={cardTitle}>Upcoming This Month</div>
            </div>

            {upcomingBills.length === 0 ? (
              <div style={{ padding:"20px 14px", textAlign:"center", fontSize:12, color:C.t2 }}>
                No upcoming transactions
              </div>
            ) : (
              <div>
                {upcomingBills.map((t, i) => (
                  <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderBottom: i < upcomingBills.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    {/* Day badge */}
                    <div style={{ width:28, height:28, borderRadius:"50%", background:C.surface, border:`1px solid ${C.border2}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:10, fontFamily:C.fontMono, color:C.t2 }}>{t._occurrenceDay}</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:C.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name || t.merchant}</div>
                    </div>
                    <div style={{ fontFamily:C.fontMono, fontSize:12, fontWeight:600, color: t.amount < 0 ? C.red : C.green, flexShrink:0 }}>
                      {t.amount < 0 ? "−" : "+"}{fmt(Math.abs(t.amount))}
                    </div>
                  </div>
                ))}

                {/* Summary row */}
                {(() => {
                  const billsTotal    = upcomingBills.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
                  const incomeTotal   = upcomingBills.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
                  return (
                    <div style={{ padding:"8px 14px", background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", fontSize:11, color:C.t2 }}>
                      <span style={{ color:C.red }}>−{fmt(billsTotal)} bills</span>
                      {incomeTotal > 0 && <span style={{ color:C.green }}>+{fmt(incomeTotal)} income</span>}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
}
