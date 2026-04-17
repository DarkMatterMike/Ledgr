/**
 * PortfolioView.jsx
 *
 * Tabbed investment portfolio page. Completely isolated from budgets
 * and transactions. Tabs: Overview | Accounts | Holdings | Performance
 */

import { useState } from "react";
import { ACCOUNT_TYPES } from "./hooks/usePortfolio.js";

const fmt  = n => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(n);
const fmtP = n => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
const fmtK = n => n >= 1000 ? "$" + (n / 1000).toFixed(1) + "k" : fmt(n);

const S = {
  card:   { background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:20 },
  label:  { fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600, marginBottom:6 },
  val:    { fontFamily:"var(--font-mono)", fontSize:24, fontWeight:600, color:"var(--t1)" },
  sub:    { fontSize:12, color:"var(--t2)", marginTop:4 },
  th:     { fontSize:10, textTransform:"uppercase", letterSpacing:"1.2px", color:"var(--t3)", fontWeight:700,
            padding:"10px 12px", textAlign:"left", borderBottom:"1px solid var(--border)",
            background:"var(--card)", position:"sticky", top:0, zIndex:2 },
  td:     { padding:"11px 12px", fontSize:13, color:"var(--t2)", borderBottom:"1px solid var(--border)", verticalAlign:"middle" },
  btn:    (v="ghost", sm=false) => {
    const base = { display:"inline-flex", alignItems:"center", gap:6, padding:sm?"5px 12px":"8px 16px",
                   borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer",
                   border:"1px solid transparent", transition:"all 0.15s", userSelect:"none", whiteSpace:"nowrap" };
    if (v==="primary") return { ...base, background:"var(--cyan)", color:"#000", borderColor:"var(--cyan)" };
    if (v==="danger")  return { ...base, background:"var(--red-dim)", color:"var(--red)", borderColor:"#ff4d6d44" };
    return { ...base, background:"transparent", color:"var(--t2)", borderColor:"var(--border2)" };
  },
  input:  { background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)",
            padding:"9px 12px", fontSize:13, color:"var(--t1)", outline:"none", width:"100%" },
  select: { background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)",
            padding:"8px 10px", fontSize:13, color:"var(--t1)", outline:"none", width:"100%" },
};

const TABS = ["Overview", "Accounts", "Holdings", "Performance"];

const TYPE_COLORS = {
  "Brokerage":"#00d4ff","IRA":"#a78bfa","Roth IRA":"#00e676","401(k)":"#fbbf24",
  "403(b)":"#f97316","SEP IRA":"#06b6d4","HSA":"#ec4899","529 Plan":"#14b8a6",
  "Crypto":"#ff4d6d","Other":"#3d5070",
};

function EmptyState({ icon, title, body }) {
  return (
    <div style={{ textAlign:"center", padding:"48px 24px", color:"var(--t3)" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:600, color:"var(--t2)", marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, lineHeight:1.6 }}>{body}</div>
    </div>
  );
}

function GainBadge({ value, pct }) {
  const color = value >= 0 ? "var(--green)" : "var(--red)";
  return (
    <span style={{ color, fontFamily:"var(--font-mono)", fontSize:12 }}>
      {value >= 0 ? "+" : ""}{fmt(value)} ({fmtP(pct)})
    </span>
  );
}

// Simple bar chart using divs
function BarChart({ data, height=120 }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:4, height, paddingTop:8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <div style={{ fontSize:9, color:"var(--t3)", fontFamily:"var(--font-mono)" }}>
            {fmtK(d.value)}
          </div>
          <div style={{
            width:"100%", background:"var(--cyan)", borderRadius:"2px 2px 0 0",
            height: Math.max(4, (d.value / max) * (height - 28)),
            opacity: i === data.length - 1 ? 1 : 0.5,
            transition:"height 0.3s ease",
          }} />
          <div style={{ fontSize:9, color:"var(--t3)", whiteSpace:"nowrap", overflow:"hidden", maxWidth:"100%" }}>
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// Donut chart using SVG
function DonutChart({ segments, size=140 }) {
  const r = 50, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 140 140">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={22} />
      {segments.map((seg, i) => {
        const pct   = seg.value / total;
        const dash  = pct * circ;
        const gap   = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={22}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            style={{ transform:"rotate(-90deg)", transformOrigin:"center" }}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy-6} textAnchor="middle" fill="var(--t1)"
        style={{ fontSize:13, fontFamily:"var(--font-mono)", fontWeight:600 }}>
        {fmtK(total)}
      </text>
      <text x={cx} y={cy+10} textAnchor="middle" fill="var(--t3)" style={{ fontSize:9 }}>
        total
      </text>
    </svg>
  );
}

// Modal for adding/editing an account
function AccountModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: "", institution: "", type: "Brokerage", balance: "", costBasis: "",
    ...initial,
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000088", backdropFilter:"blur(4px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"var(--card)", border:"1px solid var(--border2)", borderRadius:"var(--radius-lg)", padding:28, width:460, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontFamily:"var(--font-disp)", fontSize:18, fontWeight:800, marginBottom:20 }}>
          {initial ? "Edit Account" : "Add Investment Account"}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <label style={S.label}>Account Name
            <input style={{ ...S.input, marginTop:6 }} value={form.name} onChange={set("name")} placeholder="e.g. Fidelity Brokerage" />
          </label>
          <label style={S.label}>Institution
            <input style={{ ...S.input, marginTop:6 }} value={form.institution} onChange={set("institution")} placeholder="e.g. Fidelity" />
          </label>
          <label style={S.label}>Account Type
            <select style={{ ...S.select, marginTop:6 }} value={form.type} onChange={set("type")}>
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={S.label}>Current Balance ($)
            <input style={{ ...S.input, marginTop:6 }} type="number" min="0" step="0.01" value={form.balance} onChange={set("balance")} placeholder="0.00" />
          </label>
          <label style={S.label}>Total Cost Basis ($)
            <input style={{ ...S.input, marginTop:6 }} type="number" min="0" step="0.01" value={form.costBasis} onChange={set("costBasis")} placeholder="0.00" />
          </label>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
          <button style={S.btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={S.btn("primary")} onClick={() => { if (form.name.trim()) { onSave(form); onClose(); } }}>
            {initial ? "Save" : "Add Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal for adding/editing a holding
function HoldingModal({ accounts, initial, onSave, onClose }) {
  const [form, setForm] = useState({
    accountId: accounts[0]?.id || "", ticker: "", name: "",
    quantity: "", currentPrice: "", costBasis: "",
    ...initial,
  });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000088", backdropFilter:"blur(4px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"var(--card)", border:"1px solid var(--border2)", borderRadius:"var(--radius-lg)", padding:28, width:460, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontFamily:"var(--font-disp)", fontSize:18, fontWeight:800, marginBottom:20 }}>
          {initial ? "Edit Holding" : "Add Holding"}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <label style={S.label}>Account
            <select style={{ ...S.select, marginTop:6 }} value={form.accountId} onChange={set("accountId")}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
            <label style={S.label}>Ticker
              <input style={{ ...S.input, marginTop:6 }} value={form.ticker} onChange={set("ticker")} placeholder="AAPL" />
            </label>
            <label style={S.label}>Security Name
              <input style={{ ...S.input, marginTop:6 }} value={form.name} onChange={set("name")} placeholder="Apple Inc." />
            </label>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <label style={S.label}>Shares
              <input style={{ ...S.input, marginTop:6 }} type="number" min="0" step="0.0001" value={form.quantity} onChange={set("quantity")} placeholder="0" />
            </label>
            <label style={S.label}>Price ($)
              <input style={{ ...S.input, marginTop:6 }} type="number" min="0" step="0.01" value={form.currentPrice} onChange={set("currentPrice")} placeholder="0.00" />
            </label>
            <label style={S.label}>Cost Basis ($)
              <input style={{ ...S.input, marginTop:6 }} type="number" min="0" step="0.01" value={form.costBasis} onChange={set("costBasis")} placeholder="0.00" />
            </label>
          </div>
          {form.quantity && form.currentPrice && (
            <div style={{ fontSize:12, color:"var(--t3)", padding:"8px 12px", background:"var(--surface)", borderRadius:"var(--radius)" }}>
              Current value: <span style={{ color:"var(--cyan)", fontFamily:"var(--font-mono)" }}>
                {fmt(parseFloat(form.quantity) * parseFloat(form.currentPrice))}
              </span>
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
          <button style={S.btn("ghost")} onClick={onClose}>Cancel</button>
          <button style={S.btn("primary")} onClick={() => {
            if (form.accountId && form.ticker.trim()) { onSave(form); onClose(); }
          }}>
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
}) {
  const [tab, setTab]               = useState("Overview");
  const [acctModal, setAcctModal]   = useState(null); // null | "add" | account obj
  const [holdModal, setHoldModal]   = useState(null); // null | "add" | holding obj
  const [expandAcct, setExpandAcct] = useState(null);

  const hasAccounts = investmentAccounts.length > 0;
  const hasHoldings = holdings.length > 0;

  // ── Tab bar ────────────────────────────────────────────────────────

  const TabBar = (
    <div style={{ display:"flex", gap:4, borderBottom:"1px solid var(--border)", marginBottom:20 }}>
      {TABS.map(t => (
        <button key={t} onClick={() => setTab(t)} style={{
          padding:"8px 16px", fontSize:13, fontWeight:tab===t?700:400,
          color: tab===t ? "var(--cyan)" : "var(--t3)",
          borderBottom: tab===t ? "2px solid var(--cyan)" : "2px solid transparent",
          background:"none", border:"none", borderBottom: tab===t?"2px solid var(--cyan)":"2px solid transparent",
          cursor:"pointer", transition:"all 0.15s", marginBottom:-1,
        }}>{t}</button>
      ))}
    </div>
  );

  // ── Overview tab ───────────────────────────────────────────────────

  const OverviewTab = (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Stat row */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)", gap:12 }}>
        {[
          { label:"Portfolio Value", value:fmt(metrics.totalValue), sub:null },
          { label:"Total Gain/Loss", value:fmt(metrics.totalGain),
            sub: metrics.totalCost > 0 ? fmtP(metrics.totalReturn) : null,
            color: metrics.totalGain >= 0 ? "var(--green)" : "var(--red)" },
          { label:"Cost Basis", value:fmt(metrics.totalCost), sub:null },
          { label:"Accounts", value:investmentAccounts.length, sub:`${holdings.length} holdings` },
        ].map(stat => (
          <div key={stat.label} style={S.card}>
            <div style={S.label}>{stat.label}</div>
            <div style={{ ...S.val, fontSize:isMobile?18:22, color:stat.color||"var(--t1)" }}>{stat.value}</div>
            {stat.sub && <div style={{ ...S.sub, color:stat.color||"var(--t2)" }}>{stat.sub}</div>}
          </div>
        ))}
      </div>

      {hasAccounts ? (
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16 }}>
          {/* Allocation donut */}
          <div style={S.card}>
            <div style={S.label}>Allocation by Account Type</div>
            <div style={{ display:"flex", alignItems:"center", gap:20, marginTop:12, flexWrap:"wrap" }}>
              <DonutChart
                segments={Object.entries(metrics.byType).map(([type, value]) => ({
                  label: type, value, color: TYPE_COLORS[type] || "#3d5070",
                }))}
              />
              <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1, minWidth:120 }}>
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

          {/* Net worth over time */}
          <div style={S.card}>
            <div style={S.label}>Portfolio Value Over Time</div>
            {netWorthSnapshots.length >= 2 ? (
              <BarChart
                data={netWorthSnapshots.slice(-12).map(s => ({
                  label: s.date.slice(5),
                  value: s.value,
                }))}
                height={140}
              />
            ) : (
              <div style={{ fontSize:13, color:"var(--t3)", marginTop:16, textAlign:"center" }}>
                Update your balances monthly to track growth over time.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={S.card}>
          <EmptyState
            icon="📈"
            title="No investment accounts yet"
            body="Add your first account manually or connect via Plaid to get started."
          />
        </div>
      )}

      {/* Top holdings */}
      {hasHoldings && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom:12 }}>Top Holdings</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {metrics.holdingMetrics.slice(0, 5).map(h => (
              <div key={h.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:"var(--radius)", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"var(--cyan)", fontFamily:"var(--font-mono)", flexShrink:0 }}>
                  {h.ticker.slice(0,4)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name || h.ticker}</div>
                  <div style={{ fontSize:11, color:"var(--t3)" }}>{h.quantity} shares · {h.allocation.toFixed(1)}% of portfolio</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--t1)" }}>{fmt(h.currentValue)}</div>
                  <GainBadge value={h.gain} pct={h.gainPct} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Accounts tab ───────────────────────────────────────────────────

  const AccountsTab = (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:13, color:"var(--t3)" }}>{investmentAccounts.length} account{investmentAccounts.length!==1?"s":""}</div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={S.btn("ghost", true)} onClick={() => syncFromPlaid(showToast)} disabled={syncing}>
            {syncing ? "⟳ Syncing…" : "⟳ Sync via Plaid"}
          </button>
          <button style={S.btn("primary", true)} onClick={() => setAcctModal("add")}>+ Account</button>
        </div>
      </div>

      {!hasAccounts ? (
        <div style={S.card}>
          <EmptyState icon="🏦" title="No accounts yet" body="Add accounts manually or sync from Plaid." />
        </div>
      ) : (
        investmentAccounts.map(acct => {
          const acctHoldings = holdings.filter(h => h.accountId === acct.id);
          const isExpanded   = expandAcct === acct.id;
          return (
            <div key={acct.id} style={{ ...S.card, padding:0, overflow:"hidden" }}>
              <div
                style={{ padding:"16px 18px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}
                onClick={() => setExpandAcct(isExpanded ? null : acct.id)}
              >
                <div style={{ width:10, height:10, borderRadius:"50%", background:TYPE_COLORS[acct.type]||"#3d5070", flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)" }}>{acct.name}</div>
                  <div style={{ fontSize:11, color:"var(--t3)" }}>{acct.institution} · {acct.type}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:15, fontFamily:"var(--font-mono)", fontWeight:600, color:"var(--t1)" }}>{fmt(acct.balance)}</div>
                  {acct.costBasis > 0 && (
                    <GainBadge value={acct.balance - acct.costBasis} pct={((acct.balance - acct.costBasis) / acct.costBasis) * 100} />
                  )}
                </div>
                <span style={{ color:"var(--t3)", fontSize:12, marginLeft:4 }}>{isExpanded?"▴":"▾"}</span>
              </div>

              {isExpanded && (
                <div style={{ borderTop:"1px solid var(--border)", padding:"14px 18px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div style={{ fontSize:12, color:"var(--t3)" }}>{acctHoldings.length} holding{acctHoldings.length!==1?"s":""}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button style={S.btn("ghost", true)} onClick={() => setAcctModal(acct)}>Edit</button>
                      <button style={S.btn("ghost", true)} onClick={() => setHoldModal({ accountId: acct.id })}>+ Holding</button>
                      <button style={S.btn("danger", true)} onClick={() => { if (window.confirm(`Delete ${acct.name}?`)) deleteAccount(acct.id); }}>Delete</button>
                    </div>
                  </div>
                  {acctHoldings.length > 0 ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {acctHoldings.map(h => (
                        <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--cyan)", fontFamily:"var(--font-mono)", width:50, flexShrink:0 }}>{h.ticker}</div>
                          <div style={{ flex:1, fontSize:12, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</div>
                          <div style={{ fontSize:12, color:"var(--t3)" }}>{h.quantity} sh</div>
                          <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--t1)" }}>{fmt(h.currentValue)}</div>
                          <button style={{ ...S.btn("ghost", true), fontSize:11, padding:"3px 8px" }} onClick={() => setHoldModal(h)}>Edit</button>
                          <button style={{ ...S.btn("danger", true), fontSize:11, padding:"3px 8px" }} onClick={() => deleteHolding(h.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize:12, color:"var(--t3)", textAlign:"center", padding:"12px 0" }}>No holdings — add one above</div>
                  )}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:14 }}>
                    {[
                      { label:"Balance", val:fmt(acct.balance) },
                      { label:"Cost Basis", val:fmt(acct.costBasis) },
                    ].map(r => (
                      <div key={r.label} style={{ background:"var(--surface)", borderRadius:"var(--radius)", padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:4 }}>{r.label}</div>
                        <div style={{ fontSize:14, fontFamily:"var(--font-mono)", color:"var(--t1)" }}>{r.val}</div>
                      </div>
                    ))}
                  </div>
                  {acct.updatedAt && (
                    <div style={{ fontSize:11, color:"var(--t3)", marginTop:10 }}>
                      Updated {new Date(acct.updatedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // ── Holdings tab ───────────────────────────────────────────────────

  const HoldingsTab = (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:13, color:"var(--t3)" }}>{holdings.length} position{holdings.length!==1?"s":""}</div>
        {hasAccounts && (
          <button style={S.btn("primary", true)} onClick={() => setHoldModal("add")}>+ Holding</button>
        )}
      </div>

      {!hasAccounts ? (
        <div style={S.card}>
          <EmptyState icon="📊" title="Add an account first" body="Holdings are linked to investment accounts." />
        </div>
      ) : !hasHoldings ? (
        <div style={S.card}>
          <EmptyState icon="📊" title="No holdings yet" body="Add individual positions to track performance." />
        </div>
      ) : (
        <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                {["Ticker","Name","Shares","Price","Value","Cost Basis","Gain/Loss","Alloc",""].map(h => (
                  <th key={h} style={{ ...S.th, display: h==="Name"&&isMobile?"none":undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.holdingMetrics.map(h => (
                <tr key={h.id}>
                  <td style={{ ...S.td, fontFamily:"var(--font-mono)", fontWeight:700, color:"var(--cyan)", fontSize:12 }}>{h.ticker}</td>
                  <td style={{ ...S.td, display:isMobile?"none":undefined, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.name}</td>
                  <td style={{ ...S.td, fontFamily:"var(--font-mono)" }}>{h.quantity.toFixed(4)}</td>
                  <td style={{ ...S.td, fontFamily:"var(--font-mono)" }}>{fmt(h.currentPrice)}</td>
                  <td style={{ ...S.td, fontFamily:"var(--font-mono)", color:"var(--t1)", fontWeight:600 }}>{fmt(h.currentValue)}</td>
                  <td style={{ ...S.td, fontFamily:"var(--font-mono)" }}>{fmt(h.costBasis)}</td>
                  <td style={S.td}><GainBadge value={h.gain} pct={h.gainPct} /></td>
                  <td style={{ ...S.td, fontFamily:"var(--font-mono)", fontSize:12 }}>{h.allocation.toFixed(1)}%</td>
                  <td style={S.td}>
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={{ ...S.btn("ghost", true), fontSize:11, padding:"3px 8px" }} onClick={() => setHoldModal(h)}>Edit</button>
                      <button style={{ ...S.btn("danger", true), fontSize:11, padding:"3px 8px" }} onClick={() => deleteHolding(h.id)}>✕</button>
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

  // ── Performance tab ────────────────────────────────────────────────

  const totalReturn = metrics.totalReturn;
  const bestHolding  = metrics.holdingMetrics.reduce((b, h) => h.gainPct > (b?.gainPct ?? -Infinity) ? h : b, null);
  const worstHolding = metrics.holdingMetrics.reduce((w, h) => h.gainPct < (w?.gainPct ?? Infinity)  ? h : w, null);

  const PerformanceTab = (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {!hasAccounts ? (
        <div style={S.card}>
          <EmptyState icon="📈" title="No data yet" body="Add accounts and holdings to see performance metrics." />
        </div>
      ) : (
        <>
          {/* Return metrics */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:12 }}>
            {[
              { label:"Total Return", value:fmtP(totalReturn), color: totalReturn>=0?"var(--green)":"var(--red)" },
              { label:"Total Gain", value:fmt(metrics.totalGain), color: metrics.totalGain>=0?"var(--green)":"var(--red)" },
              { label:"Cost Basis", value:fmt(metrics.totalCost), color:"var(--t1)" },
            ].map(stat => (
              <div key={stat.label} style={S.card}>
                <div style={S.label}>{stat.label}</div>
                <div style={{ ...S.val, fontSize:20, color:stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Best / Worst */}
          {metrics.holdingMetrics.length >= 2 && (
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
              {[
                { label:"Best Performer", h:bestHolding, color:"var(--green)" },
                { label:"Worst Performer", h:worstHolding, color:"var(--red)" },
              ].map(({ label, h, color }) => h && (
                <div key={label} style={S.card}>
                  <div style={S.label}>{label}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:8 }}>
                    <div style={{ width:40, height:40, borderRadius:"var(--radius)", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--cyan)", fontFamily:"var(--font-mono)" }}>
                      {h.ticker.slice(0,4)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)" }}>{h.name || h.ticker}</div>
                      <div style={{ fontSize:12, color, fontFamily:"var(--font-mono)" }}>{fmtP(h.gainPct)} · {fmt(h.gain)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Holdings performance table */}
          {hasHoldings && (
            <div style={S.card}>
              <div style={{ ...S.label, marginBottom:12 }}>All Positions</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {metrics.holdingMetrics.map(h => (
                  <div key={h.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--cyan)", fontFamily:"var(--font-mono)", width:50, flexShrink:0 }}>{h.ticker}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:12, color:"var(--t2)" }}>{h.name || h.ticker}</span>
                        <GainBadge value={h.gain} pct={h.gainPct} />
                      </div>
                      {/* Return bar */}
                      <div style={{ height:4, borderRadius:2, background:"var(--border)", overflow:"hidden" }}>
                        <div style={{
                          height:"100%", borderRadius:2,
                          background: h.gain >= 0 ? "var(--green)" : "var(--red)",
                          width: Math.min(100, Math.abs(h.gainPct)) + "%",
                          transition:"width 0.4s ease",
                        }} />
                      </div>
                    </div>
                    <div style={{ fontSize:12, fontFamily:"var(--font-mono)", color:"var(--t1)", width:80, textAlign:"right", flexShrink:0 }}>{fmt(h.currentValue)}</div>
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
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:"var(--font-disp)", fontSize:22, fontWeight:800, color:"var(--t1)", marginBottom:2 }}>Portfolio</div>
          <div style={{ fontSize:12, color:"var(--t3)" }}>Investment accounts, holdings, and performance</div>
        </div>
        {metrics.totalValue > 0 && (
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:20, fontWeight:700, color:"var(--t1)" }}>{fmt(metrics.totalValue)}</div>
            <div style={{ fontSize:12, color: metrics.totalGain>=0?"var(--green)":"var(--red)", fontFamily:"var(--font-mono)" }}>
              {fmtP(metrics.totalReturn)} all time
            </div>
          </div>
        )}
      </div>

      {TabBar}
      {CONTENT[tab]}

      {/* Modals */}
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
          initial={holdModal === "add" ? (typeof holdModal === "object" && holdModal.accountId ? holdModal : null) : holdModal}
          onSave={form => holdModal === "add" || !holdModal.id ? addHolding(form) : updateHolding(holdModal.id, form)}
          onClose={() => setHoldModal(null)}
        />
      )}
    </div>
  );
}
