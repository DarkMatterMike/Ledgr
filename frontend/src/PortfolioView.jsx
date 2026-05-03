/**
 * PortfolioView.jsx
 * Tabbed investment portfolio page — mobile-first responsive.
 */

import { useState } from "react";
import { ACCOUNT_TYPES } from "./hooks/usePortfolio.js";

const fmt  = n => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(n);
const fmtP = n => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
const fmtK = n => Math.abs(n) >= 1000 ? (n < 0 ? "-" : "") + "$" + (Math.abs(n) / 1000).toFixed(1) + "k" : fmt(n);

const S = {
  card:   { background:"var(--card)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"var(--radius-lg)", padding:16 },
  label:  { fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:4, display:"block" },
  input:  { background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)",
            padding:"9px 12px", fontSize:14, color:"var(--t1)", outline:"none", width:"100%", WebkitAppearance:"none" },
  select: { background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)",
            padding:"10px 12px", fontSize:14, color:"var(--t1)", outline:"none", width:"100%", WebkitAppearance:"none" },
  btn: (v="ghost", sm=false) => {
    const base = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
                   padding:sm?"6px 14px":"10px 18px", borderRadius:"var(--radius)", fontSize:13,
                   fontWeight:500, cursor:"pointer", border:"1px solid transparent",
                   transition:"all 0.15s", userSelect:"none", whiteSpace:"nowrap", WebkitTapHighlightColor:"transparent" };
    if (v==="primary") return { ...base, background:"var(--cyan)", color:"#000", borderColor:"var(--cyan)" };
    if (v==="danger")  return { ...base, background:"var(--red-dim)", color:"var(--red)", borderColor:"#ff4d6d44" };
    return { ...base, background:"transparent", color:"var(--t2)", borderColor:"var(--border2)" };
  },
};

const TYPE_COLORS = {
  "Brokerage":"#00d4ff","IRA":"#a78bfa","Roth IRA":"#00e676","401(k)":"#fbbf24",
  "403(b)":"#f97316","SEP IRA":"#06b6d4","HSA":"#ec4899","529 Plan":"#14b8a6",
  "Crypto":"#ff4d6d","Other":"#3d5070",
};

function EmptyState({ icon, title, body }) {
  return (
    <div style={{ textAlign:"center", padding:"40px 20px", color:"var(--t3)" }}>
      <div style={{ fontSize:32, marginBottom:10 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:600, color:"var(--t2)", marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, lineHeight:1.6 }}>{body}</div>
    </div>
  );
}

function GainBadge({ value, pct }) {
  const color = value >= 0 ? "var(--green)" : "var(--red)";
  return (
    <span style={{ color, fontFamily:"var(--font-mono)", fontSize:12 }}>
      {value >= 0 ? "+" : ""}{fmt(value)}{pct != null ? ` (${fmtP(pct)})` : ""}
    </span>
  );
}

function BarChart({ data, height=100 }) {
  if (!data.length) return null;
  const bars = data.slice(-6);
  const max = Math.max(...bars.map(d => d.value), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:6, height, paddingTop:8 }}>
      {bars.map((d, i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <div style={{ fontSize:9, color:"var(--t3)", fontFamily:"var(--font-mono)" }}>{fmtK(d.value)}</div>
          <div style={{ width:"100%", background:"var(--cyan)", borderRadius:"2px 2px 0 0",
                        height: Math.max(4, (d.value / max) * (height - 30)),
                        opacity: i === bars.length - 1 ? 1 : 0.45 }} />
          <div style={{ fontSize:9, color:"var(--t3)", whiteSpace:"nowrap" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments, size=120 }) {
  const r = 46, cx = 60, cy = 60;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ flexShrink:0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={18} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const gap  = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={18}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            style={{ transform:"rotate(-90deg)", transformOrigin:"center" }}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy-4} textAnchor="middle" fill="var(--t1)"
        style={{ fontSize:11, fontFamily:"var(--font-mono)", fontWeight:700 }}>{fmtK(total)}</text>
      <text x={cx} y={cy+10} textAnchor="middle" fill="var(--t3)" style={{ fontSize:9 }}>total</text>
    </svg>
  );
}

function AccountModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ name:"", institution:"", type:"Brokerage", balance:"", costBasis:"", ...initial });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", backdropFilter:"blur(4px)",
                  zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div className="obsidian-card" style={{ background:"var(--card)", border:"1px solid var(--border2)", borderRadius:"16px 16px 0 0",
                    padding:"24px 20px 36px", width:"100%", maxWidth:520, maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:"var(--border2)", borderRadius:2, margin:"0 auto 20px" }} />
        <div style={{ fontFamily:"var(--font-disp)", fontSize:17, fontWeight:800, marginBottom:20 }}>
          {initial ? "Edit Account" : "Add Investment Account"}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <label><span style={S.label}>Account Name</span>
            <input style={S.input} value={form.name} onChange={set("name")} placeholder="e.g. Fidelity Brokerage" /></label>
          <label><span style={S.label}>Institution</span>
            <input style={S.input} value={form.institution} onChange={set("institution")} placeholder="e.g. Fidelity" /></label>
          <label><span style={S.label}>Account Type</span>
            <select style={S.select} value={form.type} onChange={set("type")}>
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <label><span style={S.label}>Balance ($)</span>
              <input style={S.input} type="number" min="0" step="0.01" value={form.balance} onChange={set("balance")} placeholder="0.00" /></label>
            <label><span style={S.label}>Cost Basis ($)</span>
              <input style={S.input} type="number" min="0" step="0.01" value={form.costBasis} onChange={set("costBasis")} placeholder="0.00" /></label>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:24 }}>
          <button style={{ ...S.btn("ghost"), width:"100%" }} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btn("primary"), width:"100%" }}
            onClick={() => { if (form.name.trim()) { onSave(form); onClose(); } }}>
            {initial ? "Save" : "Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HoldingModal({ accounts, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    accountId: accounts[0]?.id || "", ticker:"", name:"", quantity:"", currentPrice:"", costBasis:"",
    ...initial,
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const previewValue = form.quantity && form.currentPrice
    ? parseFloat(form.quantity) * parseFloat(form.currentPrice) : null;
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", backdropFilter:"blur(4px)",
                  zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div className="obsidian-card" style={{ background:"var(--card)", border:"1px solid var(--border2)", borderRadius:"16px 16px 0 0",
                    padding:"24px 20px 36px", width:"100%", maxWidth:520, maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:"var(--border2)", borderRadius:2, margin:"0 auto 20px" }} />
        <div style={{ fontFamily:"var(--font-disp)", fontSize:17, fontWeight:800, marginBottom:20 }}>
          {initial ? "Edit Holding" : "Add Holding"}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <label><span style={S.label}>Account</span>
            <select style={S.select} value={form.accountId} onChange={set("accountId")}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
            <label><span style={S.label}>Ticker</span>
              <input style={{ ...S.input, textTransform:"uppercase" }} value={form.ticker} onChange={set("ticker")} placeholder="AAPL" /></label>
            <label><span style={S.label}>Security Name</span>
              <input style={S.input} value={form.name} onChange={set("name")} placeholder="Apple Inc." /></label>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <label><span style={S.label}>Shares</span>
              <input style={S.input} type="number" min="0" step="0.0001" value={form.quantity} onChange={set("quantity")} placeholder="0" /></label>
            <label><span style={S.label}>Price ($)</span>
              <input style={S.input} type="number" min="0" step="0.01" value={form.currentPrice} onChange={set("currentPrice")} placeholder="0.00" /></label>
          </div>
          <label><span style={S.label}>Cost Basis ($)</span>
            <input style={S.input} type="number" min="0" step="0.01" value={form.costBasis} onChange={set("costBasis")} placeholder="0.00" /></label>
          {previewValue !== null && (
            <div style={{ fontSize:12, color:"var(--t3)", padding:"8px 12px", background:"var(--surface)", borderRadius:"var(--radius)" }}>
              Current value: <span style={{ color:"var(--cyan)", fontFamily:"var(--font-mono)", fontWeight:600 }}>{fmt(previewValue)}</span>
            </div>
          )}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:24 }}>
          <button style={{ ...S.btn("ghost"), width:"100%" }} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btn("primary"), width:"100%" }}
            onClick={() => { if (form.accountId && form.ticker.trim()) { onSave(form); onClose(); } }}>
            {initial ? "Save" : "Add Holding"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioView({
  investmentAccounts, holdings, netWorthSnapshots, metrics, syncing,
  addAccount, updateAccount, deleteAccount,
  addHolding, updateHolding, deleteHolding,
  syncFromPlaid, showToast, isMobile,
  PlaidButtonComponent, onPlaidSuccess,
}) {
  const [tab, setTab]               = useState("Overview");
  const [acctModal, setAcctModal]   = useState(null);
  const [holdModal, setHoldModal]   = useState(null);
  const [expandAcct, setExpandAcct] = useState(null);

  const hasAccounts = investmentAccounts.length > 0;
  const hasHoldings = holdings.length > 0;

  const TabBar = (
    <div style={{ display:"flex", borderBottom:"1px solid var(--border)", marginBottom:16,
                  overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
      {["Overview","Accounts","Holdings","Performance"].map(t => (
        <button key={t} onClick={() => setTab(t)} style={{
          padding: isMobile ? "8px 14px" : "8px 18px",
          fontSize: isMobile ? 12 : 13, fontWeight: tab===t ? 700 : 400,
          color: tab===t ? "var(--cyan)" : "var(--t3)",
          borderBottom: tab===t ? "2px solid var(--cyan)" : "2px solid transparent",
          background:"none", border:"none",
          cursor:"pointer", marginBottom:-1, flexShrink:0,
          WebkitTapHighlightColor:"transparent",
        }}>{t}</button>
      ))}
    </div>
  );

  const StatCard = ({ label, value, sub, color }) => (
    <div className="obsidian-card" style={{ ...S.card, padding:"12px 14px" }}>
      <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:isMobile?15:18, fontWeight:700, color:color||"var(--t1)" }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:color||"var(--t2)", marginTop:2 }}>{sub}</div>}
    </div>
  );

  const OverviewTab = (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <StatCard label="Portfolio Value" value={fmt(metrics.totalValue)} />
        <StatCard label="Total Gain/Loss" value={fmt(metrics.totalGain)}
          sub={metrics.totalCost > 0 ? fmtP(metrics.totalReturn) : null}
          color={metrics.totalGain >= 0 ? "var(--green)" : "var(--red)"} />
        <StatCard label="Cost Basis" value={fmt(metrics.totalCost)} />
        <StatCard label="Accounts" value={investmentAccounts.length} sub={`${holdings.length} holdings`} />
      </div>

      {!hasAccounts ? (
        <div className="obsidian-card" style={S.card}>
          <EmptyState icon="📈" title="No investment accounts yet" body="Add your first account manually or sync from Plaid." />
        </div>
      ) : (
        <>
          <div className="obsidian-card" style={S.card}>
            <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:12 }}>Allocation by Type</div>
            <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
              <DonutChart size={isMobile?110:130}
                segments={Object.entries(metrics.byType).map(([type, value]) => ({ label:type, value, color:TYPE_COLORS[type]||"#3d5070" }))} />
              <div style={{ display:"flex", flexDirection:"column", gap:7, flex:1, minWidth:100 }}>
                {Object.entries(metrics.byType).map(([type, value]) => (
                  <div key={type} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:TYPE_COLORS[type]||"#3d5070", flexShrink:0 }} />
                    <div style={{ flex:1, fontSize:12, color:"var(--t2)" }}>{type}</div>
                    <div style={{ fontSize:12, color:"var(--t1)", fontFamily:"var(--font-mono)" }}>{fmtK(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {netWorthSnapshots.length >= 2 && (
            <div className="obsidian-card" style={S.card}>
              <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:4 }}>Portfolio Over Time</div>
              <BarChart data={netWorthSnapshots.map(s => ({ label:s.date.slice(5), value:s.value }))} height={100} />
            </div>
          )}

          {hasHoldings && (
            <div className="obsidian-card" style={S.card}>
              <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:12 }}>Top Holdings</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {metrics.holdingMetrics.slice(0,5).map(h => (
                  <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:34, height:34, borderRadius:"var(--radius)", background:"var(--surface)",
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:10,
                      fontWeight:700, color:"var(--cyan)", fontFamily:"var(--font-mono)", flexShrink:0 }}>
                      {h.ticker.slice(0,4)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name||h.ticker}</div>
                      <div style={{ fontSize:11, color:"var(--t3)" }}>{h.allocation.toFixed(1)}% of portfolio</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--t1)", fontWeight:600 }}>{fmt(h.currentValue)}</div>
                      <div style={{ fontSize:11, color:h.gain>=0?"var(--green)":"var(--red)", fontFamily:"var(--font-mono)" }}>{h.gain>=0?"+":""}{fmtP(h.gainPct)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const AccountsTab = (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", flexDirection:isMobile?"column":"row", gap:8, justifyContent:"flex-end" }}>
        <button style={{ ...S.btn("ghost",true), justifyContent:"center" }} onClick={() => syncFromPlaid(showToast)} disabled={syncing}>
          {syncing ? "⟳ Syncing…" : "⟳ Sync Accounts"}
        </button>
        <button style={{ ...S.btn("ghost",true), justifyContent:"center" }} onClick={() => setAcctModal("add")}>
          + Add Manual Account
        </button>
        {PlaidButtonComponent && (
          <PlaidButtonComponent
            label="Connect via Plaid"
            products={["investments"]}
            style={{ width: isMobile ? "100%" : "auto" }}
            onSuccess={async (publicToken, institution) => {
              await onPlaidSuccess(publicToken, institution);
              await syncFromPlaid(showToast);
            }}
          />
        )}
      </div>

      {!hasAccounts ? (
        <div className="obsidian-card" style={S.card}><EmptyState icon="🏦" title="No accounts yet" body="Add accounts manually or sync from Plaid." /></div>
      ) : investmentAccounts.map(acct => {
        const acctHoldings = holdings.filter(h => h.accountId === acct.id);
        const isExpanded   = expandAcct === acct.id;
        const gain         = acct.balance - (acct.costBasis||0);
        const gainPct      = acct.costBasis > 0 ? (gain/acct.costBasis)*100 : 0;
        return (
          <div key={acct.id} style={{ ...S.card, padding:0, overflow:"hidden" }}>
            <div style={{ padding:"14px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}
              onClick={() => setExpandAcct(isExpanded ? null : acct.id)}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:TYPE_COLORS[acct.type]||"#3d5070", flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{acct.name}</div>
                <div style={{ fontSize:11, color:"var(--t3)" }}>{acct.institution} · {acct.type}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:15, fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--t1)" }}>{fmt(acct.balance)}</div>
                {acct.costBasis > 0 && (
                  <div style={{ fontSize:11, color:gain>=0?"var(--green)":"var(--red)", fontFamily:"var(--font-mono)" }}>{gain>=0?"+":""}{fmtP(gainPct)}</div>
                )}
              </div>
              <span style={{ color:"var(--t3)", fontSize:12 }}>{isExpanded?"▴":"▾"}</span>
            </div>

            {isExpanded && (
              <div style={{ borderTop:"1px solid var(--border)", padding:"12px 16px" }}>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                  <button style={{ ...S.btn("ghost",true), flex:1 }} onClick={() => setAcctModal(acct)}>Edit</button>
                  <button style={{ ...S.btn("ghost",true), flex:1 }} onClick={() => setHoldModal({ accountId:acct.id })}>+ Holding</button>
                  <button style={{ ...S.btn("danger",true), flex:1 }} onClick={() => { if (window.confirm(`Delete ${acct.name}?`)) deleteAccount(acct.id); }}>Delete</button>
                </div>
                {acctHoldings.length > 0 ? acctHoldings.map(h => (
                  <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--cyan)", fontFamily:"var(--font-mono)", width:44, flexShrink:0 }}>{h.ticker}</div>
                    <div style={{ flex:1, fontSize:12, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</div>
                    <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--t1)", flexShrink:0 }}>{fmt(h.currentValue)}</div>
                    <button style={{ ...S.btn("ghost",true), fontSize:11, padding:"3px 8px" }} onClick={() => setHoldModal(h)}>Edit</button>
                    <button style={{ ...S.btn("danger",true), fontSize:11, padding:"3px 8px" }} onClick={() => deleteHolding(h.id)}>✕</button>
                  </div>
                )) : (
                  <div style={{ fontSize:12, color:"var(--t3)", textAlign:"center", padding:"10px 0" }}>No holdings — tap + Holding above</div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
                  {[["Balance",fmt(acct.balance)],["Cost Basis",fmt(acct.costBasis||0)]].map(([l,v]) => (
                    <div key={l} style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:"8px 10px" }}>
                      <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--t1)" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const HoldingsTab = (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontSize:12, color:"var(--t3)" }}>{holdings.length} position{holdings.length!==1?"s":""}</div>
        {hasAccounts && <button style={S.btn("primary",true)} onClick={() => setHoldModal("add")}>+ Add Holding</button>}
      </div>
      {!hasAccounts ? (
        <div className="obsidian-card" style={S.card}><EmptyState icon="📊" title="Add an account first" body="Holdings are linked to investment accounts." /></div>
      ) : !hasHoldings ? (
        <div className="obsidian-card" style={S.card}><EmptyState icon="📊" title="No holdings yet" body="Add individual positions to track performance." /></div>
      ) : isMobile ? (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {metrics.holdingMetrics.map(h => (
            <div key={h.id} className="obsidian-card" style={S.card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--cyan)", fontFamily:"var(--font-mono)" }}>{h.ticker}</div>
                  <div style={{ fontSize:12, color:"var(--t2)", marginTop:2 }}>{h.name}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:14, fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--t1)" }}>{fmt(h.currentValue)}</div>
                  <GainBadge value={h.gain} pct={h.gainPct} />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
                {[["Shares",h.quantity.toFixed(4)],["Price",fmt(h.currentPrice)],["Cost Basis",fmt(h.costBasis)]].map(([l,v]) => (
                  <div key={l}>
                    <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:2 }}>{l}</div>
                    <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--t2)" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={{ ...S.btn("ghost",true), flex:1, justifyContent:"center" }} onClick={() => setHoldModal(h)}>Edit</button>
                <button style={{ ...S.btn("danger",true), flex:1, justifyContent:"center" }} onClick={() => deleteHolding(h.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="obsidian-card" style={{ ...S.card, padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                {["Ticker","Name","Shares","Price","Value","Cost Basis","Gain/Loss","Alloc",""].map(col => (
                  <th key={col} style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"1.2px", color:"var(--t3)", fontWeight:700,
                    padding:"10px 12px", textAlign:"left", borderBottom:"1px solid var(--border)", background:"var(--card)", position:"sticky", top:0, zIndex:2 }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.holdingMetrics.map(h => (
                <tr key={h.id}>
                  <td style={{ padding:"11px 12px", fontSize:12, borderBottom:"1px solid var(--border)", fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--cyan)" }}>{h.ticker}</td>
                  <td style={{ padding:"11px 12px", fontSize:13, borderBottom:"1px solid var(--border)", color:"var(--t2)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</td>
                  <td style={{ padding:"11px 12px", fontSize:13, borderBottom:"1px solid var(--border)", fontFamily:"var(--font-mono)", color:"var(--t2)" }}>{h.quantity.toFixed(4)}</td>
                  <td style={{ padding:"11px 12px", fontSize:13, borderBottom:"1px solid var(--border)", fontFamily:"var(--font-mono)", color:"var(--t2)" }}>{fmt(h.currentPrice)}</td>
                  <td style={{ padding:"11px 12px", fontSize:13, borderBottom:"1px solid var(--border)", fontFamily:"var(--font-mono)", color:"var(--t1)", fontWeight:600 }}>{fmt(h.currentValue)}</td>
                  <td style={{ padding:"11px 12px", fontSize:13, borderBottom:"1px solid var(--border)", fontFamily:"var(--font-mono)", color:"var(--t2)" }}>{fmt(h.costBasis)}</td>
                  <td style={{ padding:"11px 12px", borderBottom:"1px solid var(--border)" }}><GainBadge value={h.gain} pct={h.gainPct} /></td>
                  <td style={{ padding:"11px 12px", fontSize:12, borderBottom:"1px solid var(--border)", fontFamily:"var(--font-mono)", color:"var(--t2)" }}>{h.allocation.toFixed(1)}%</td>
                  <td style={{ padding:"11px 12px", borderBottom:"1px solid var(--border)" }}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={{ ...S.btn("ghost",true), fontSize:11, padding:"3px 8px" }} onClick={() => setHoldModal(h)}>Edit</button>
                      <button style={{ ...S.btn("danger",true), fontSize:11, padding:"3px 8px" }} onClick={() => deleteHolding(h.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const totalReturn  = metrics.totalReturn;
  const bestHolding  = metrics.holdingMetrics.reduce((b, h) => h.gainPct > (b?.gainPct ?? -Infinity) ? h : b, null);
  const worstHolding = metrics.holdingMetrics.reduce((w, h) => h.gainPct < (w?.gainPct ?? Infinity)  ? h : w, null);

  const PerformanceTab = (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {!hasAccounts ? (
        <div className="obsidian-card" style={S.card}><EmptyState icon="📈" title="No data yet" body="Add accounts and holdings to see performance metrics." /></div>
      ) : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { label:"Total Return",    value:fmtP(totalReturn),       color:totalReturn>=0?"var(--green)":"var(--red)" },
              { label:"Total Gain",      value:fmt(metrics.totalGain),  color:metrics.totalGain>=0?"var(--green)":"var(--red)" },
              { label:"Portfolio Value", value:fmt(metrics.totalValue),  color:"var(--t1)" },
              { label:"Cost Basis",      value:fmt(metrics.totalCost),   color:"var(--t1)" },
            ].map(stat => <StatCard key={stat.label} {...stat} />)}
          </div>

          {metrics.holdingMetrics.length >= 2 && (
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              {[{label:"Best Performer",h:bestHolding,color:"var(--green)"},{label:"Worst Performer",h:worstHolding,color:"var(--red)"}]
                .map(({ label, h, color }) => h && (
                  <div key={label} className="obsidian-card" style={S.card}>
                    <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:10 }}>{label}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ width:38, height:38, borderRadius:"var(--radius)", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--cyan)", fontFamily:"var(--font-mono)", flexShrink:0 }}>{h.ticker.slice(0,4)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name||h.ticker}</div>
                        <div style={{ fontSize:12, color, fontFamily:"var(--font-mono)" }}>{fmtP(h.gainPct)} · {fmt(h.gain)}</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {hasHoldings && (
            <div className="obsidian-card" style={S.card}>
              <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:12 }}>All Positions</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {metrics.holdingMetrics.map(h => (
                  <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--cyan)", fontFamily:"var(--font-mono)", width:46, flexShrink:0 }}>{h.ticker}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:12, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"60%" }}>{h.name||h.ticker}</span>
                        <GainBadge value={h.gain} pct={h.gainPct} />
                      </div>
                      <div style={{ height:4, borderRadius:2, background:"var(--border)", overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:2, background:h.gain>=0?"var(--green)":"var(--red)", width:Math.min(100,Math.abs(h.gainPct))+"%" }} />
                      </div>
                    </div>
                    <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--t1)", width:72, textAlign:"right", flexShrink:0 }}>{fmt(h.currentValue)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const CONTENT = { Overview:OverviewTab, Accounts:AccountsTab, Holdings:HoldingsTab, Performance:PerformanceTab };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:"var(--font-disp)", fontSize:isMobile?18:22, fontWeight:800, color:"var(--t1)", marginBottom:2 }}>Portfolio</div>
          <div style={{ fontSize:11, color:"var(--t3)" }}>Investments · holdings · performance</div>
        </div>
        {metrics.totalValue > 0 && (
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:isMobile?16:20, fontWeight:700, color:"var(--t1)" }}>{fmt(metrics.totalValue)}</div>
            <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:metrics.totalGain>=0?"var(--green)":"var(--red)" }}>{fmtP(metrics.totalReturn)} all time</div>
          </div>
        )}
      </div>

      {TabBar}
      {CONTENT[tab]}

      {acctModal && (
        <AccountModal
          initial={acctModal === "add" ? null : acctModal}
          onSave={form => acctModal === "add" ? addAccount(form) : updateAccount(acctModal.id, { name:form.name, institution:form.institution, type:form.type, balance:parseFloat(form.balance)||0, costBasis:parseFloat(form.costBasis)||0 })}
          onClose={() => setAcctModal(null)}
        />
      )}
      {holdModal && (
        <HoldingModal
          accounts={investmentAccounts}
          initial={holdModal === "add" ? null : holdModal}
          onSave={form => !holdModal.id ? addHolding(form) : updateHolding(holdModal.id, form)}
          onClose={() => setHoldModal(null)}
        />
      )}
    </div>
  );
}
