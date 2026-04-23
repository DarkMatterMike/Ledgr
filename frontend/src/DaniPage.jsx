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
  t3:        "var(--t3)",
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
const label  = { fontSize:10, color:C.t3, textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:4, display:"block", fontFamily:C.fontDisp };
const cardTitle = { fontFamily:C.fontDisp, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"1.5px", color:C.t3, marginBottom:10 };

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function DaniPage({
  accounts       = [],
  transactions   = [],
  recurringTxns  = [],
  daniData       = { selectedAccountId: null, wishlist: [] },
  onSave,          // (patch) => void  — persists to server
}) {
  /* ── Local state (mirrors daniData props) ───────────────────────── */
  const [selectedAccountId, setSelectedAccountId] = useState(daniData.selectedAccountId || null);
  const [wishlist,  setWishlist]  = useState(daniData.wishlist || []);

  /* ── Add-item form ──────────────────────────────────────────────── */
  const [formName, setFormName] = useState("");
  const [formCost, setFormCost] = useState("");

  /* ── Drag state ─────────────────────────────────────────────────── */
  const dragIdx  = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  /* ── Persist on change ──────────────────────────────────────────── */
  const save = useCallback((patch) => {
    onSave?.(patch);
  }, [onSave]);

  function updateAccount(id) {
    setSelectedAccountId(id);
    save({ dani: { selectedAccountId: id, wishlist } });
  }

  function updateWishlist(next) {
    setWishlist(next);
    save({ dani: { selectedAccountId, wishlist: next } });
  }

  /* ── Selected account ───────────────────────────────────────────── */
  const account = accounts.find(a => a.id === selectedAccountId) || accounts[0] || null;
  const balance = account?.balance ?? 0;

  /* ── Free-to-spend calculation ──────────────────────────────────── */
  const freeToSpend = useMemo(() => {
    if (!account) return 0;

    const todayDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    // Upcoming expenses (recurring, this account or unassigned, days remaining this month)
    const upcomingExpenses = recurringTxns
      .filter(t => {
        if (t.amount >= 0) return false; // skip income
        const day = t.recurringDay || 0;
        return day > todayDay && day <= daysInMonth;
      })
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    // Expected income this month (recurring income txns not yet received)
    const upcomingIncome = recurringTxns
      .filter(t => {
        if (t.amount <= 0) return false;
        const day = t.recurringDay || 0;
        return day > todayDay && day <= daysInMonth;
      })
      .reduce((s, t) => s + t.amount, 0);

    // Unpurchased wishlist items don't subtract — we show those separately
    return balance - upcomingExpenses + upcomingIncome;
  }, [account, recurringTxns, balance]);

  /* ── Upcoming bills list ────────────────────────────────────────── */
  const upcomingBills = useMemo(() => {
    const todayDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return recurringTxns
      .filter(t => {
        const day = t.recurringDay || 0;
        return day > todayDay && day <= daysInMonth;
      })
      .sort((a, b) => (a.recurringDay||0) - (b.recurringDay||0));
  }, [recurringTxns]);

  /* ── Wishlist affordability ─────────────────────────────────────── */
  const wishlistWithStatus = useMemo(() => {
    let running = freeToSpend;
    return wishlist.map(item => {
      if (item.purchased) return { ...item, status: "purchased", runningAfter: running };
      const canAfford = running >= item.cost;
      const after = running - item.cost;
      running = canAfford ? after : running; // only subtract if affordable in priority order
      return { ...item, status: canAfford ? "affordable" : "wait", runningAfter: after };
    });
  }, [wishlist, freeToSpend]);

  /* ── Next payday ────────────────────────────────────────────────── */
  const nextPayday = useMemo(() => {
    const todayDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const incomeRecurring = recurringTxns.filter(t => t.amount > 0 && (t.recurringDay||0) > todayDay);
    if (!incomeRecurring.length) return null;
    incomeRecurring.sort((a,b)=>(a.recurringDay||0)-(b.recurringDay||0));
    const t = incomeRecurring[0];
    const d = new Date(today.getFullYear(), today.getMonth(), t.recurringDay);
    return { date: d.toLocaleDateString("en-US",{month:"short",day:"numeric"}), amount: t.amount, daysAway: (t.recurringDay||0) - todayDay };
  }, [recurringTxns]);

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
          <div style={{ fontSize:11, color:C.t3, marginTop:2 }}>Spending power & wishlist</div>
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
      <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 320px", gap:10, alignItems:"start" }}>

        {/* ══ LEFT: Wishlist ══════════════════════════════════════════ */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

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
                <div style={{ fontSize:10, color:C.t3 }}>
                  Drag to reorder priority
                </div>
              )}
            </div>

            {wishlist.length === 0 ? (
              <div style={{ padding:"32px 16px", textAlign:"center" }}>
                <div style={{ fontSize:24, marginBottom:8, opacity:0.3 }}>🛍️</div>
                <div style={{ fontSize:12, color:C.t3 }}>No items yet — add something above</div>
              </div>
            ) : (
              <div>
                {wishlistWithStatus.map((item, i) => {
                  const isAffordable = item.status === "affordable";
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
                      <div style={{ color:C.t3, fontSize:14, flexShrink:0, cursor:"grab", lineHeight:1, userSelect:"none" }}>⠿</div>

                      {/* Priority number */}
                      <div style={{
                        width:20, height:20, borderRadius:"50%", flexShrink:0,
                        background: isAffordable ? C.cyanDim : C.surface,
                        border: `1px solid ${isAffordable ? C.cyan+"66" : C.border2}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:10, fontFamily:C.fontMono, fontWeight:700,
                        color: isAffordable ? C.cyan : C.t3,
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
                          {isAffordable ? (
                            <span style={{ fontSize:10, fontWeight:600, color:C.green, background:C.greenDim, padding:"1px 6px", borderRadius:99, border:`1px solid ${C.green}33` }}>
                              ✓ Can buy now
                            </span>
                          ) : (
                            <span style={{ fontSize:10, fontWeight:600, color:C.t3, background:C.surface, padding:"1px 6px", borderRadius:99, border:`1px solid ${C.border2}` }}>
                              {nextPayday ? `After ${nextPayday.date}` : "Wait"}
                            </span>
                          )}
                          {isAffordable && item.runningAfter >= 0 && (
                            <span style={{ fontSize:10, color:C.t3 }}>
                              {fmt(item.runningAfter)} left after
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cost */}
                      <div style={{ fontFamily:C.fontMono, fontSize:13, fontWeight:700, color:C.t1, flexShrink:0 }}>
                        {fmt(item.cost)}
                      </div>

                      {/* Actions */}
                      <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                        <button
                          title="Mark as purchased"
                          onClick={() => markPurchased(item.id)}
                          style={btn("green", true)}
                        >
                          ✓ Bought
                        </button>
                        <button
                          title="Remove"
                          onClick={() => deleteItem(item.id)}
                          style={{ background:"none", border:"none", cursor:"pointer", color:C.t3, fontSize:15, padding:"2px 4px", lineHeight:1 }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Totals footer */}
                <div style={{ padding:"10px 14px", background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:11, color:C.t3 }}>{wishlist.length} item{wishlist.length !== 1 ? "s" : ""} · {wishlistWithStatus.filter(w=>w.status==="affordable").length} affordable now</span>
                  <span style={{ fontSize:12, fontFamily:C.fontMono, fontWeight:700, color:C.t1 }}>
                    {fmt(wishlist.reduce((s,w)=>s+w.cost,0))} total
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: Balance card + bills ════════════════════════════ */}
        <div style={{ display:"flex", flexDirection:"column", gap:10, position:"sticky", top:16 }}>

          {/* Free-to-spend card */}
          <div style={card({ padding:0, overflow:"hidden" })}>
            {/* Header */}
            <div style={{ padding:"14px 16px 10px", background:C.surface, borderBottom:`1px solid ${C.border}` }}>
              <div style={cardTitle}>Free to Spend</div>
              <div style={{ fontFamily:C.fontMono, fontSize:32, fontWeight:700, color: isFreePositive ? C.green : C.red, lineHeight:1 }}>
                {fmt(freeToSpend)}
              </div>
              <div style={{ fontSize:11, color:C.t3, marginTop:4 }}>
                After upcoming bills through end of {today.toLocaleDateString("en-US",{month:"long"})}
              </div>
            </div>

            {/* Account balance */}
            <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:11, color:C.t3 }}>{account?.name || "—"}</div>
                  <div style={{ fontFamily:C.fontMono, fontSize:16, fontWeight:600, color:C.cyan }}>
                    {fmt(balance)}
                  </div>
                </div>
                <div style={{ fontSize:10, color:C.t3, textAlign:"right" }}>Current balance</div>
              </div>
            </div>

            {/* Next payday */}
            {nextPayday && (
              <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>💸</span>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, color:C.t1 }}>Next payday</div>
                    <div style={{ fontSize:10, color:C.t3 }}>{nextPayday.date} · {nextPayday.daysAway}d away</div>
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
              <div style={{ padding:"20px 14px", textAlign:"center", fontSize:12, color:C.t3 }}>
                No upcoming transactions
              </div>
            ) : (
              <div>
                {upcomingBills.map((t, i) => (
                  <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderBottom: i < upcomingBills.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    {/* Day badge */}
                    <div style={{ width:28, height:28, borderRadius:"50%", background:C.surface, border:`1px solid ${C.border2}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:10, fontFamily:C.fontMono, color:C.t2 }}>{t.recurringDay}</span>
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
                    <div style={{ padding:"8px 14px", background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", fontSize:11, color:C.t3 }}>
                      <span style={{ color:C.red }}>−{fmt(billsTotal)} bills</span>
                      {incomeTotal > 0 && <span style={{ color:C.green }}>+{fmt(incomeTotal)} income</span>}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Wishlist summary against free-to-spend */}
          {wishlist.length > 0 && (
            <div style={card()}>
              <div style={cardTitle}>Wishlist vs Balance</div>
              {wishlistWithStatus.filter(w => w.status !== "purchased").map(item => (
                <div key={item.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:0, flex:1 }}>
                    <span style={{ width:6, height:6, borderRadius:"50%", flexShrink:0, display:"inline-block", background: item.status==="affordable" ? C.green : C.t3 }}/>
                    <span style={{ fontSize:11, color: item.status==="affordable" ? C.t1 : C.t3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</span>
                  </div>
                  <span style={{ fontFamily:C.fontMono, fontSize:11, color: item.status==="affordable" ? C.t1 : C.t3, flexShrink:0, marginLeft:8 }}>{fmt(item.cost)}</span>
                </div>
              ))}
              <div style={{ borderTop:`1px solid ${C.border}`, marginTop:6, paddingTop:8, display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, color:C.t3 }}>Total wishlist</span>
                <span style={{ fontFamily:C.fontMono, fontSize:12, fontWeight:700, color: wishlist.reduce((s,w)=>s+w.cost,0) <= freeToSpend ? C.green : C.amber }}>
                  {fmt(wishlist.reduce((s,w)=>s+w.cost,0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
