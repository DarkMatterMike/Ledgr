/**
 * src/App.jsx — Ledgr personal finance app
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePlaidLink } from "react-plaid-link";
import * as api from "./api.js";

/* ─── Mobile detection ──────────────────────────────────────────── */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

/* ─── Global CSS ─────────────────────────────────────────────────── */
(function injectCSS() {
  if (document.getElementById("ledgr-css")) return;
  const s = document.createElement("style");
  s.id = "ledgr-css";
  s.textContent = `
    * { box-sizing: border-box; }
button {
  background: transparent;
  border: none;
  outline: none;
  box-shadow: none;
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}
    .ledgr-content   { padding: 28px; }
    .ledgr-stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
    .ledgr-dash-cards { display: flex; flex-direction: column; gap: 16px; }
    .ledgr-acct-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .ledgr-budget-grid { display: grid; grid-template-columns: 1fr; gap: 0; }
    .ledgr-cal-cell  { min-height: 80px; padding: 8px; }

    @media (max-width: 767px) {
      .ledgr-content   { padding: 16px !important; }
      .ledgr-stat-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
      .ledgr-filter-row { flex-direction: column !important; }
      .ledgr-filter-row > * { width: 100% !important; }
      .ledgr-txn-actions { flex-wrap: wrap !important; gap: 6px !important; }
      .ledgr-acct-grid  { grid-template-columns: 1fr !important; }
      .ledgr-monthbar   { flex-direction: column !important; gap: 10px !important; align-items: center !important; }
      .ledgr-monthbar-meta { flex-wrap: wrap !important; gap: 10px !important; justify-content: center !important; }
      .ledgr-cal-cell  { min-height: 54px !important; padding: 4px !important; }
    }
    @media (min-width: 768px) {
      .ledgr-dash-cards { flex-direction: row !important; align-items: flex-start; }
      .ledgr-dash-cards > * { flex: 1; min-width: 0; }
    }
  `;
  document.head.appendChild(s);
})();

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = {
  shell:        { display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", fontFamily:"var(--font-body)", color:"var(--t1)", background:"var(--bg)" },
  card:         { background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:20 },
  cardTitle:    { fontFamily:"var(--font-disp)", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"1.5px", color:"var(--t3)", marginBottom:16 },
  grid2:        { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  grid4:        { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 },
  stat:         { background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"20px 22px" },
  statLabel:    { fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 },
  statValue:    { fontFamily:"var(--font-mono)", fontSize:26, fontWeight:600 },
  statSub:      { fontSize:12, color:"var(--t2)", marginTop:4 },
  btn: (variant="ghost", sm=false) => {
    const base = { display:"inline-flex", alignItems:"center", gap:6, padding:sm?"5px 12px":"8px 16px", borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer", border:"1px solid transparent", transition:"all 0.15s", userSelect:"none", lineHeight:"1.4", whiteSpace:"nowrap" };
    if (variant==="primary") return { ...base, background:"var(--cyan)", color:"#000", borderColor:"var(--cyan)" };
    if (variant==="danger")  return { ...base, background:"var(--red-dim)", color:"var(--red)", borderColor:"#ff4d6d44" };
    if (variant==="amber")   return { ...base, background:"#fbbf2422", color:"var(--amber)", borderColor:"#fbbf2444" };
    return { ...base, background:"transparent", color:"var(--t2)", borderColor:"var(--border2)" };
  },
  input:        { background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"9px 12px", fontSize:13, color:"var(--t1)", outline:"none", width:"100%" },
  select:       { background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"6px 10px", fontSize:12, color:"var(--t1)", outline:"none" },
  field:        { display:"flex", flexDirection:"column", gap:6 },
  label:        { fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600 },
  overlay:      { position:"fixed", inset:0, background:"#00000088", backdropFilter:"blur(4px)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" },
  modal:        { background:"var(--card)", border:"1px solid var(--border2)", borderRadius:"var(--radius-lg)", padding:28, width:500, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto" },
  modalTitle:   { fontFamily:"var(--font-disp)", fontSize:18, fontWeight:800, marginBottom:20, letterSpacing:"-0.3px" },
  badge:        (color) => ({ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:99, fontSize:11, fontWeight:600, fontFamily:"var(--font-disp)", background:color+"22", color, border:`1px solid ${color}33`, whiteSpace:"nowrap" }),
  toast:        { position:"fixed", bottom:24, right:16, zIndex:999, background:"var(--card)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"12px 18px", fontSize:13, color:"var(--t1)", boxShadow:"0 8px 32px #00000060" },
  monthBar:     { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"10px 16px", display:"flex", alignItems:"center", gap:16, fontSize:12, color:"var(--t2)", marginBottom:20, flexWrap:"wrap" },
  sectionHdr:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 },
  sectionTitle: { fontFamily:"var(--font-disp)", fontSize:16, fontWeight:700, letterSpacing:"-0.2px" },
  th:           { fontSize:10, textTransform:"uppercase", letterSpacing:"1.2px", color:"var(--t3)", fontWeight:700, padding:"10px 12px", textAlign:"left", whiteSpace:"nowrap", fontFamily:"var(--font-disp)", borderBottom:"1px solid var(--border)", position:"sticky", top:0, background:"var(--card)", zIndex:2 },
  td:           { padding:"12px 12px", fontSize:13, color:"var(--t2)", borderBottom:"1px solid var(--border)", verticalAlign:"middle" },
  filterRow:    { display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" },
};

/* ─── Constants ─────────────────────────────────────────────────── */
const CAT_COLORS   = ["#00d4ff","#00e676","#ff4d6d","#fbbf24","#a78bfa","#f97316","#06b6d4","#84cc16","#ec4899","#14b8a6","#8b5cf6","#ef4444","#22c55e","#3b82f6","#f59e0b"];
const DAYS_OF_WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const today        = new Date();
const pad          = n => String(n).padStart(2,"0");
const fmt          = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const cap          = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : "";
const currentMonth = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
const NAV = [
  { id:"dashboard",    icon:"◈", label:"Dashboard"    },
  { id:"transactions", icon:"⇅", label:"Transactions" },
  { id:"budgets",      icon:"◉", label:"Budgets"      },
  { id:"accounts",     icon:"▣", label:"Accounts"     },
  { id:"rules",        icon:"◎", label:"Rules"        },
  { id:"calendar",     icon:"▦", label:"Calendar"     },
  { id:"settings",     icon:"⚙", label:"Settings"     },
];
function daysInMonth(y,m) { return new Date(y,m,0).getDate(); }
function daysLeft()        { return daysInMonth(today.getFullYear(), today.getMonth()+1) - today.getDate(); }

/* ─── Sub-components ─────────────────────────────────────────────── */
function CategoryBadge({ cat }) {
  if (!cat) return <span style={{color:"var(--t3)",fontSize:11}}>—</span>;
  return <span style={S.badge(cat.color)}><span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>{cat.name}</span>;
}
function Modal({ title, onClose, children, actions }) {
  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal}>
        <div style={S.modalTitle}>{title}</div>
        {children}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:24}}>{actions}</div>
      </div>
    </div>
  );
}
function Toast({ msg }) { return msg ? <div style={S.toast}>✓ {msg}</div> : null; }
function PlaidButton({ onSuccess, onExit, label="Connect a Bank" }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const fetchToken = useCallback(async () => {
    setLoading(true); setError(null);
    try { const { link_token } = await api.createLinkToken(); setLinkToken(link_token); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  const { open, ready } = usePlaidLink({ token:linkToken, onSuccess:(pt,meta)=>onSuccess(pt,meta?.institution?.name), onExit });
  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);
  return (
    <div>
      <button style={S.btn("primary")} onClick={fetchToken} disabled={loading}>{loading?"…":"🏦 "+label}</button>
      {error && <div style={{marginTop:8,fontSize:12,color:"var(--red)"}}>{error}</div>}
    </div>
  );
}


const PAGE_RIGHT_COL_W = 340;
const PAGE_COL_GAP = 16;
const SHARED_LEFT_WIDTH = `calc(100% - ${PAGE_RIGHT_COL_W + PAGE_COL_GAP}px)`;

function PageLayout({ left, right = null, isMobile = false }) {
  if (isMobile) {
    return (
      <div style={{ width: "100%" }}>
        {left}
        {right ? <div style={{ marginTop: 16 }}>{right}</div> : null}
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

/* ═══════════════════════════════════════════════════════════════════
   AUTH GATE  (email + password, multi-user)
═══════════════════════════════════════════════════════════════════ */
function isAuthValid() {
  try { return !!api.getToken() && !!api.getStoredUser(); }
  catch { return false; }
}

function AuthGate({ onAuth }) {
  const [mode,     setMode]     = useState("login");   // "login" | "register"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [shake,    setShake]    = useState(false);

  function triggerShake(msg) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (mode === "register" && password !== confirm) {
      triggerShake("Passwords do not match");
      return;
    }
    if (mode === "register" && password.length < 8) {
      triggerShake("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await api.login(email, password);
      } else {
        await api.register(email, password);
      }
      onAuth();
    } catch (err) {
      triggerShake(err.message || "Something went wrong");
      setPassword("");
      setConfirm("");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m) {
    setMode(m);
    setError("");
    setPassword("");
    setConfirm("");
  }

  const inputStyle = (hasError) => ({
    background: "var(--surface)",
    border: `1px solid ${hasError ? "var(--red)" : "var(--border2)"}`,
    borderRadius: "var(--radius)", padding: "11px 14px",
    fontSize: 14, color: "var(--t1)", outline: "none", width: "100%",
    transition: "border-color 0.15s",
  });

  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      height:"100vh", background:"var(--bg)", flexDirection:"column", gap:24,
      fontFamily:"var(--font-body)",
    }}>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        .shake { animation: shake 0.5s ease; }
      `}</style>

      <div>
        <div style={{fontFamily:"var(--font-disp)",fontSize:36,fontWeight:800,letterSpacing:"-1px",color:"var(--t1)",textAlign:"center"}}>
          ledgr<span style={{color:"var(--cyan)"}}>.</span>
        </div>
        <div style={{fontSize:13,color:"var(--t3)",textAlign:"center",marginTop:4}}>personal finance</div>
      </div>

      <div className={shake?"shake":""} style={{
        background:"var(--card)", border:"1px solid var(--border2)",
        borderRadius:"var(--radius-lg)", padding:"32px 28px",
        width:360, maxWidth:"92vw",
        boxShadow:"0 8px 40px #00000060",
      }}>
        {/* Tab switcher */}
        <div style={{display:"flex",gap:0,marginBottom:24,background:"var(--surface)",borderRadius:"var(--radius)",padding:3}}>
          {["login","register"].map(m => (
            <button key={m} onClick={()=>switchMode(m)} style={{
              flex:1, padding:"7px 0", borderRadius:"var(--radius)",
              fontSize:13, fontWeight:600, cursor:"pointer", border:"none",
              background: mode===m ? "var(--card)" : "transparent",
              color: mode===m ? "var(--t1)" : "var(--t3)",
              boxShadow: mode===m ? "0 1px 4px #00000030" : "none",
              transition:"all 0.15s",
            }}>
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              autoFocus
              onChange={e=>{ setEmail(e.target.value); setError(""); }}
              style={inputStyle(!!error && !password)}
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e=>{ setPassword(e.target.value); setError(""); }}
              style={inputStyle(!!error)}
            />
          </div>
          {mode === "register" && (
            <div>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={e=>{ setConfirm(e.target.value); setError(""); }}
                style={inputStyle(!!error && confirm !== password)}
              />
            </div>
          )}
          {error && (
            <div style={{fontSize:12,color:"var(--red)",marginTop:2}}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            marginTop:4,
            background:"var(--cyan)", color:"#000", border:"none",
            borderRadius:"var(--radius)", padding:"10px 16px",
            fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
            opacity:loading?0.7:1, transition:"opacity 0.15s",
          }}>
            {loading ? "…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => isAuthValid());

  if (!authed) return <AuthGate onAuth={()=>setAuthed(true)}/>;

  return <AppInner/>;
}

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS VIEW
═══════════════════════════════════════════════════════════════════ */
function SidebarContent({ onNav, view, syncing, doSync, showToast, avatarColor, avatarLetter }) {
  const currentUser = api.getStoredUser();
  const VAPID = "BLvUSGg-ljPgLVTY-54gYJrJvPEEIIokB5C-QTCAnSYW9ghmpeYmKQeIfQMsHl_opqis_d5QeORvyjoS1pfXRnY";
  return (
    <>
      <div style={{padding:"24px 20px 16px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
        <div style={{fontFamily:"var(--font-disp)",fontSize:20,fontWeight:800,letterSpacing:"-0.5px"}}>
          ledgr<span style={{color:"var(--cyan)"}}>.</span>
        </div>
        <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>personal finance</div>
      </div>
      <nav style={{flex:1,padding:"12px 10px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>onNav(n.id)}
            style={{
              display:"flex",alignItems:"center",gap:13,padding:"11px 14px",
              borderRadius:"var(--radius)",fontSize:14,fontWeight:500,cursor:"pointer",
              border:`1px solid ${view===n.id?"#00d4ff33":"transparent"}`,
              background:view===n.id?"var(--cyan-dim)":"transparent",
              color:view===n.id?"var(--cyan)":"var(--t2)",
              width:"100%",textAlign:"left",transition:"all 0.15s",
            }}>
            <span style={{fontSize:18,width:22,textAlign:"center",flexShrink:0}}>{n.icon}</span>
            <span>{n.label}</span>
            {view===n.id&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:"var(--cyan)",display:"inline-block"}}/>}
          </button>
        ))}
      </nav>
      <div style={{padding:"12px 10px",borderTop:"1px solid var(--border)",flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
        <button style={{...S.btn("ghost"),width:"100%",justifyContent:"center",fontSize:12}}
          onClick={()=>{ doSync(); onNav(view); }} disabled={syncing}>
          {syncing?"⟳ Syncing…":"⟳ Sync All"}
        </button>
        {"Notification" in window && Notification.permission !== "granted" && (
          <button style={{...S.btn("ghost"),width:"100%",justifyContent:"center",fontSize:12}}
            onClick={async ()=>{
              try {
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                  const reg = await navigator.serviceWorker.ready;
                  const toUint8 = b64 => {
                    const pad = "=".repeat((4-b64.length%4)%4);
                    const raw = atob((b64+pad).replace(/-/g,"+").replace(/_/g,"/"));
                    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
                  };
                  const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: toUint8(VAPID),
                  });
                  await api.subscribePush(sub);
                  showToast("Notifications enabled!");
                }
              } catch(e) { console.warn("Notification setup:",e.message); }
              onNav(view);
            }}>
            🔔 Enable Notifications
          </button>
        )}
        {/* User info + settings shortcut */}
        <div style={{borderTop:"1px solid var(--border)",paddingTop:8,marginTop:2}}>
          <button
            onClick={()=>onNav("settings")}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 6px",
              background:"transparent",border:"none",cursor:"pointer",borderRadius:"var(--radius)",
              textAlign:"left",transition:"background 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{
              width:28,height:28,borderRadius:"50%",flexShrink:0,
              background:avatarColor+"33",border:`1.5px solid ${avatarColor}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontFamily:"var(--font-disp)",fontSize:12,fontWeight:800,color:avatarColor,
            }}>
              {avatarLetter}
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {currentUser?.name || currentUser?.email}
              </div>
              {currentUser?.role==="owner"&&(
                <div style={{fontSize:9,color:"var(--cyan)",fontWeight:700,letterSpacing:"0.5px"}}>OWNER</div>
              )}
            </div>
            <span style={{fontSize:11,color:"var(--t3)",flexShrink:0}}>⚙</span>
          </button>
        </div>
      </div>
    </>
  );
}

function TxnRow({ t, expandedTxnId, setExpandedTxnId, ellipsisId, setEllipsisId,
  editingId, editingName, setEditingName, setEditingId,
  catMap, acctMap, categories, accounts,
  needsReview, markReviewed, startRename, deleteTxn,
  updateTxnType, updateTxnCat, updateTxnAcct,
  openAddCat, toggleRecurring, updateRecurringDay, saveRename }) {

  const expanded   = expandedTxnId === t.id;
  const reviewed   = !needsReview(t);
  const typeVal    = t.type||(t.amount<0?"expense":"income");
  const noCategory = ["income","transfer","reimbursement"].includes(typeVal);
  const cat        = catMap[t.categoryId];
  const acct       = acctMap[t.accountId];

  return (
    <div style={{borderBottom:"1px solid var(--border)"}}>
      <div onClick={()=>setExpandedTxnId(expanded?null:t.id)}
        style={{padding:"10px 0",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
          borderLeft:t.recurring?"3px solid var(--amber)":needsReview(t)?"3px solid var(--cyan)":"3px solid transparent",
          paddingLeft:t.recurring||needsReview(t)?10:0,
          transition:"background 0.1s"}}>
        <span style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:t.recurring?"var(--amber)":reviewed?"var(--green)":"var(--cyan)"}}/>
        <span style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>
          {t.name||t.merchant}
        </span>
        {cat ? (
          <span style={{fontSize:11,color:cat.color,whiteSpace:"nowrap",flexShrink:0,maxWidth:"25%",overflow:"hidden",textOverflow:"ellipsis"}}>{cat.name}</span>
        ) : (
          <span style={{fontSize:11,color:"var(--t3)",whiteSpace:"nowrap",flexShrink:0,textTransform:"capitalize"}}>{typeVal}</span>
        )}
        <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0}}>
          {t.amount<0?"-":"+"}{fmt(Math.abs(t.amount))}
        </span>
        <div style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setEllipsisId(ellipsisId===t.id?null:t.id)}
            style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:16,padding:"2px 4px",lineHeight:1}}>⋯</button>
          {ellipsisId===t.id&&(
            <div style={{position:"absolute",right:0,top:"100%",zIndex:30,background:"var(--card)",
              border:"1px solid var(--border2)",borderRadius:"var(--radius)",
              boxShadow:"0 4px 16px #00000060",minWidth:150,overflow:"hidden"}}>
              <button onClick={()=>{markReviewed(t.id);setEllipsisId(null);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:reviewed?"var(--t3)":"var(--green)"}}>
                {reviewed?"Mark Unreviewed":"✓ Mark Reviewed"}
              </button>
              <button onClick={()=>{startRename(t);setEllipsisId(null);setExpandedTxnId(t.id);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t1)"}}>Rename</button>
              <button onClick={()=>{deleteTxn(t.id);setEllipsisId(null);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t2)"}}>Delete</button>
            </div>
          )}
        </div>
      </div>

      {expanded&&(
        <div style={{background:"var(--surface)",borderRadius:"var(--radius)",padding:"12px",marginBottom:10,display:"flex",flexDirection:"column",gap:10}}>
          {editingId===t.id&&(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input style={{...S.input,flex:1,fontSize:13}}
                value={editingName} onChange={e=>setEditingName(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")saveRename(t.id);if(e.key==="Escape")setEditingId(null);}} autoFocus/>
              <button style={S.btn("primary",true)} onClick={()=>saveRename(t.id)}>✓</button>
              <button style={S.btn("ghost",true)} onClick={()=>setEditingId(null)}>✕</button>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <select style={{...S.select,width:"100%",padding:"7px 10px",fontSize:12}}
              value={typeVal} onChange={e=>updateTxnType(t.id,e.target.value)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="refund">Refund</option>
              <option value="reimbursement">Reimbursement</option>
              <option value="transfer">Transfer</option>
            </select>
            {noCategory ? (
              <div style={{...S.select,padding:"7px 10px",fontSize:12,color:"var(--t3)"}}>No category needed</div>
            ) : (
              <select style={{...S.select,width:"100%",padding:"7px 10px",fontSize:12}}
                value={t.categoryId||""}
                onChange={e=>{ if(e.target.value==="__new__"){openAddCat();}else{updateTxnCat(t.id,e.target.value);} }}>
                <option value="">— Category —</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__new__">＋ New Category…</option>
              </select>
            )}
          </div>
          <select style={{...S.select,width:"100%",padding:"7px 10px",fontSize:12}}
            value={t.accountId||""} onChange={e=>updateTxnAcct(t.id,e.target.value)}>
            <option value="">— Account —</option>
            {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>toggleRecurring(t.id)} style={{...S.btn(t.recurring?"amber":"ghost",true)}}>
              {t.recurring?"↻ Recurring":"↻ Mark Recurring"}
            </button>
            {t.recurring&&(
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--t2)"}}>
                Day: <input type="number" min="1" max="31"
                  style={{...S.input,width:52}}
                  value={t.recurringDay||""} onChange={e=>updateRecurringDay(t.id,e.target.value)}/>
              </div>
            )}
            <button onClick={()=>setExpandedTxnId(null)} style={{...S.btn("ghost",true),marginLeft:"auto"}}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsSection({ title, children }) {
  return (
    <div style={{ ...S.card, marginBottom:16 }}>
      <div style={S.cardTitle}>{title}</div>
      {children}
    </div>
  );
}

function SettingsView({ transactions, accounts, categories, catMap, acctMap, avatarColor, avatarLetter, showToast }) {
  const user = api.getStoredUser();
  const [name,       setName]       = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [currPw,     setCurrPw]     = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [pwError,    setPwError]    = useState("");
  const [pwSuccess,  setPwSuccess]  = useState(false);
  const [savingPw,   setSavingPw]   = useState(false);

  async function saveName() {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await api.saveData({ profile: { name: name.trim() } });
      api.setStoredUser({ ...user, name: name.trim() });
      showToast("Name saved");
    } catch { showToast("Failed to save name"); }
    finally { setSavingName(false); }
  }

  async function changePassword() {
    setPwError(""); setPwSuccess(false);
    if (!currPw || !newPw)   return setPwError("All fields required");
    if (newPw.length < 8)    return setPwError("New password must be at least 8 characters");
    if (newPw !== confirmPw) return setPwError("Passwords do not match");
    setSavingPw(true);
    try {
      await api.changePassword(currPw, newPw);
      setPwSuccess(true);
      setCurrPw(""); setNewPw(""); setConfirmPw("");
      showToast("Password updated");
    } catch (e) { setPwError(e.message || "Failed to update password"); }
    finally { setSavingPw(false); }
  }

  function exportCSV() {
    const headers = ["Date","Name","Merchant","Amount","Type","Category","Account","Recurring"];
    const rows = transactions.map(t => [
      t.date || "", t.name || "", t.merchant || "",
      t.amount ?? "", t.type || "",
      catMap[t.categoryId]?.name || "",
      acctMap[t.accountId]?.name || "",
      t.recurring ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `ledgr-export-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export downloaded");
  }

  const inputSt = { ...S.input, marginBottom:0 };

  return (
    <div style={{ maxWidth:560 }}>

      {/* Profile */}
      <SettingsSection title="Profile">
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
          <div style={{
            width:56, height:56, borderRadius:"50%", flexShrink:0,
            background:avatarColor+"33", border:`2px solid ${avatarColor}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"var(--font-disp)", fontSize:22, fontWeight:800, color:avatarColor,
          }}>
            {avatarLetter}
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)" }}>{user?.name || user?.email}</div>
            <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>{user?.email}</div>
            {user?.role === "owner" && (
              <div style={{ marginTop:4, display:"inline-flex", alignItems:"center", gap:5,
                background:"#00d4ff22", border:"1px solid #00d4ff44",
                borderRadius:99, padding:"2px 10px", fontSize:10, fontWeight:700, color:"var(--cyan)", letterSpacing:"0.5px" }}>
                ⚡ OWNER
              </div>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input style={{ ...inputSt, flex:1 }} placeholder="Display name"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveName()} />
          <button style={S.btn("primary",true)} onClick={saveName} disabled={savingName}>
            {savingName ? "…" : "Save"}
          </button>
        </div>
      </SettingsSection>

      {/* Subscription */}
      <SettingsSection title="Subscription">
        {user?.role === "owner" ? (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--green)", flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)" }}>Owner — Lifetime Access</div>
              <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>No subscription required</div>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
                background: user?.subscription_status === "active" ? "var(--green)" : "var(--amber)" }}/>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", textTransform:"capitalize" }}>
                  {user?.subscription_status || "Unknown"}
                </div>
                {user?.trial_ends_at && user?.subscription_status === "trialing" && (
                  <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>
                    Trial ends {new Date(user.trial_ends_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            <a href="https://billing.stripe.com/p/login/placeholder"
              target="_blank" rel="noopener noreferrer"
              style={{ ...S.btn("ghost"), textDecoration:"none", justifyContent:"center" }}>
              Manage Subscription →
            </a>
          </div>
        )}
      </SettingsSection>

      {/* Security */}
      <SettingsSection title="Security">
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={S.field}>
            <label style={S.label}>Current Password</label>
            <input style={inputSt} type="password" placeholder="••••••••"
              value={currPw} onChange={e => { setCurrPw(e.target.value); setPwError(""); setPwSuccess(false); }} />
          </div>
          <div style={S.field}>
            <label style={S.label}>New Password</label>
            <input style={inputSt} type="password" placeholder="Min. 8 characters"
              value={newPw} onChange={e => { setNewPw(e.target.value); setPwError(""); setPwSuccess(false); }} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Confirm New Password</label>
            <input style={inputSt} type="password" placeholder="••••••••"
              value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwError(""); setPwSuccess(false); }} />
          </div>
          {pwError   && <div style={{ fontSize:12, color:"var(--red)" }}>{pwError}</div>}
          {pwSuccess && <div style={{ fontSize:12, color:"var(--green)" }}>Password updated successfully</div>}
          <button style={{ ...S.btn("primary"), alignSelf:"flex-start" }} onClick={changePassword} disabled={savingPw}>
            {savingPw ? "Updating…" : "Update Password"}
          </button>
        </div>
      </SettingsSection>

      {/* Data export */}
      <SettingsSection title="Your Data">
        <div style={{ fontSize:13, color:"var(--t2)", marginBottom:14 }}>
          Export all your transactions as a CSV file you can open in Excel or Google Sheets.
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div style={{ fontSize:12, color:"var(--t3)" }}>
            {transactions.length} transactions · {accounts.length} accounts · {categories.length} categories
          </div>
          <button style={S.btn("ghost",true)} onClick={exportCSV}>↓ Export CSV</button>
        </div>
      </SettingsSection>

      {/* Legal */}
      <SettingsSection title="Legal">
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[["Privacy Policy","/privacy"],["Terms of Service","/terms"]].map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:13, color:"var(--t2)", textDecoration:"none",
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"10px 12px", background:"var(--surface)",
                borderRadius:"var(--radius)", border:"1px solid var(--border)" }}>
              {label} <span style={{ color:"var(--t3)" }}>→</span>
            </a>
          ))}
        </div>
      </SettingsSection>

      {/* Sign out */}
      <SettingsSection title="Account">
        <button style={{ ...S.btn("danger"), width:"100%" }}
          onClick={() => { api.clearToken(); window.location.reload(); }}>
          Sign Out
        </button>
      </SettingsSection>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
function AppInner() {
  const isMobile = useIsMobile();

  /* ── State ── */
  const [view,          setView]          = useState("dashboard");
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [accounts,      setAccounts]      = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [transactions,  setTransactions]  = useState([]);
  const [plaidItems,    setPlaidItems]    = useState([]);
  const [rules,         setRules]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState(null);
  const [editTarget,    setEditTarget]    = useState(null);
  const [toast,         setToast]         = useState("");
  const [newTxnCount,   setNewTxnCount]   = useState(0);
  const [undoAction,    setUndoAction]    = useState(null); // {label, fn}
  const undoTimer = useRef(null);
  const [syncing,       setSyncing]       = useState(false);
  const [rulePrompt,    setRulePrompt]    = useState(null);
  const [drillCat,      setDrillCat]      = useState(null);
  const [budgetExpandedCatId, setBudgetExpandedCatId] = useState(null);
  const [calendarDay,      setCalendarDay]      = useState(null);
  const [calendarAcctPopup,setCalendarAcctPopup]= useState(null);
  const [selectedMonth,    setSelectedMonth]    = useState(currentMonth);
  const [calendarMonth,    setCalendarMonth]    = useState(currentMonth);
  const [calendarAccounts, setCalendarAccounts] = useState(null);
  const [editingCalAccts,  setEditingCalAccts]  = useState(false);
  const [search,        setSearch]        = useState("");
  const txnSearchInputRef = useRef(null);
  const txnSearchHadFocusRef = useRef(false);
  const txnSearchCaretRef = useRef({ start: null, end: null });
  const [filterCat,     setFilterCat]     = useState("all");
  const [filterAcct,    setFilterAcct]    = useState("all");
  const [filterReview,  setFilterReview]  = useState(false);
  const [editingId,     setEditingId]     = useState(null);
  const [ellipsisId,    setEllipsisId]    = useState(null);
  const [expandedTxnId, setExpandedTxnId] = useState(null);
  const [editingName,   setEditingName]   = useState("");
  const [catForm,  setCatForm]  = useState({ name:"", limit:"", color:CAT_COLORS[0] });
  const [acctForm, setAcctForm] = useState({ name:"", balance:"", type:"Checking" });
  const [txnForm,  setTxnForm]  = useState({ merchant:"", amount:"", date:"", categoryId:"", accountId:"", sign:"-1" });
  const [ruleForm, setRuleForm] = useState({ pattern:"", matchType:"contains", categoryId:"", enabled:true });

  /* ── Load ── */
  const initialized = useRef(false);
  useEffect(() => {
    (async () => {
      try {
        const data = await api.loadData();
        const loadedRules = data.rules || [];
        const loadedTxns = data.transactions || [];
        setAccounts(data.accounts         || []);
        setCategories(data.categories     || []);
        setTransactions(applyRules(loadedTxns, loadedRules));
        setPlaidItems(data.plaidItems     || []);
        setRules(loadedRules);
        setCalendarAccounts(data.calendarAccounts || null);
      } catch (e) { console.warn("Load error:", e.message); }
      finally { setLoading(false); initialized.current = true; }
    })();
  }, []);

  /* ── Save ── */
  const saveTimeout = useRef(null);
  const pendingPatch = useRef({});
  const scheduleSave = useCallback((patch) => {
    if (!initialized.current) return;
    pendingPatch.current = {
      ...pendingPatch.current,
      ...patch,
    };
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const payload = pendingPatch.current;
      pendingPatch.current = {};
      api.saveData(payload);
    }, 800);
  }, []); // refs are stable — no deps needed
  useEffect(() => { scheduleSave({ accounts });     }, [accounts,     scheduleSave]);
  useEffect(() => { scheduleSave({ categories });   }, [categories,   scheduleSave]);
  useEffect(() => { scheduleSave({ transactions }); }, [transactions,  scheduleSave]);
  useEffect(() => { scheduleSave({ plaidItems });   }, [plaidItems,    scheduleSave]);
  useEffect(() => { scheduleSave({ rules });        }, [rules,         scheduleSave]);
  useEffect(() => {
    if (Array.isArray(calendarAccounts)) scheduleSave({ calendarAccounts });
  }, [calendarAccounts, scheduleSave]);

  /* ── Poll for new transactions every 30 minutes ── */
  const knownTxnIds = useRef(null);
  useEffect(() => {
    if (!initialized.current) return;
    // Record the IDs we loaded with
    if (knownTxnIds.current === null) {
      knownTxnIds.current = new Set(transactions.map(t => t.id));
    }
  }, [initialized.current, transactions.length]);

  useEffect(() => {
    const POLL_MS = 30 * 60 * 1000; // 30 minutes
    const interval = setInterval(async () => {
      if (!initialized.current) return;
      try {
        const data = await api.loadData();
        const incoming = data.transactions || [];
        const known = knownTxnIds.current || new Set();
        const brandNew = incoming.filter(t => !known.has(t.id));
        if (brandNew.length > 0) {
          // Merge new transactions into state without overwriting user edits
          setTransactions(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const toAdd = applyRules(
              brandNew.filter(t => !existingIds.has(t.id)),
              rules,
              { onlyUncategorized: true }
            );
            if (toAdd.length === 0) return prev;
            return [...toAdd, ...prev];
          });
          brandNew.forEach(t => knownTxnIds.current.add(t.id));
          setNewTxnCount(brandNew.length);
        }
      } catch (e) {
        console.warn("Poll error:", e.message);
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  /* ── Swipe gesture to open/close drawer on mobile ── */
  useEffect(() => {
    if (!isMobile) return;
    let startX = 0, startY = 0;
    const MIN_SWIPE    = 50;  // minimum horizontal distance to count as swipe
    const MAX_VERTICAL = 60;  // max vertical drift before ignoring

    function onTouchStart(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
    function onTouchEnd(e) {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (dy > MAX_VERTICAL) return; // too vertical — scroll, not swipe
      if (dx > MIN_SWIPE && !drawerOpen) {
        setDrawerOpen(true);  // swipe right from anywhere to open
      } else if (dx < -MIN_SWIPE && drawerOpen) {
        setDrawerOpen(false); // swipe left to close
      }
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [isMobile, drawerOpen]);

  /* ── Service worker + push notification subscription ── */
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const VAPID_PUBLIC = "BLvUSGg-ljPgLVTY-54gYJrJvPEEIIokB5C-QTCAnSYW9ghmpeYmKQeIfQMsHl_opqis_d5QeORvyjoS1pfXRnY";
    function urlBase64ToUint8Array(b64) {
      const pad = "=".repeat((4 - b64.length % 4) % 4);
      const raw = atob((b64 + pad).replace(/-/g,"+").replace(/_/g,"/"));
      return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
    }
    async function setup() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
          });
        }
        await api.subscribePush(sub);
        navigator.serviceWorker.addEventListener("message", e => {
          if (e.data?.type === "NEW_TRANSACTIONS") setView("transactions");
        });
      } catch (err) {
        console.warn("Push setup:", err.message);
      }
    }
    setup();
  }, []);

  const contentRef = useRef(null);
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2800); };
  const navigate  = id  => { setView(id); setDrawerOpen(false); contentRef.current?.scrollTo({ top: 0 }); };

  function showUndoToast(label, undoFn) {
    clearTimeout(undoTimer.current);
    setUndoAction({ label, fn: undoFn });
    undoTimer.current = setTimeout(() => setUndoAction(null), 4000);
  }

  function handleTxnSearchChange(e) {
    txnSearchHadFocusRef.current = true;
    txnSearchCaretRef.current = {
      start: e.target.selectionStart,
      end: e.target.selectionEnd,
    };
    setSearch(e.target.value);
  }

  // A transaction needs review if it has no category AND hasn't been marked reviewed
  // Income, transfer, reimbursement auto-reviewed when type set
  const needsReview = t => !t.reviewed && !t.categoryId && (t.type==="expense" || t.type==="refund" || !t.type);
  function markReviewed(id) { setTransactions(p=>p.map(t=>t.id===id?{...t,reviewed:!t.reviewed}:t)); }

  /* ── Computed ── */
  const monthTxns = useMemo(() =>
    transactions.filter(t => t.date?.startsWith(selectedMonth)),
  [transactions, selectedMonth]);

  const isCurrentMonth = selectedMonth === currentMonth;

  const spentByCat = useMemo(() => {
    const m = {};
    monthTxns.forEach(t => { if (t.amount<0 && t.categoryId) m[t.categoryId]=(m[t.categoryId]||0)+Math.abs(t.amount); });
    return m;
  }, [monthTxns]);

  const spentByAcct = useMemo(() => {
    const m = {};
    monthTxns.forEach(t => { if (t.amount<0 && t.accountId) m[t.accountId]=(m[t.accountId]||0)+Math.abs(t.amount); });
    return m;
  }, [monthTxns]);

  const totalSpent  = Object.values(spentByCat).reduce((a,b)=>a+b,0);
  const totalBudget = categories.reduce((a,c)=>a+c.limit,0);
  const totalIncome = monthTxns.filter(t=>t.amount>0&&(t.type==="income"||!t.type)).reduce((a,t)=>a+t.amount,0);
  const catMap      = useMemo(()=>Object.fromEntries(categories.map(c=>[c.id,c])), [categories]);
  const acctMap     = useMemo(()=>Object.fromEntries(accounts.map(a=>[a.id,a])),   [accounts]);

  // Smart pending reconciliation — match on merchant + date only, ignore amount
  const [dismissedPairs,  setDismissedPairs]  = useState(()=>{ try{return JSON.parse(localStorage.getItem("ledgr_dismissed_pairs")||"[]")}catch{return[]} });
  const [showReconcile,   setShowReconcile]   = useState(false);
  const [duplicatePairs,  setDuplicatePairs]  = useState([]);
  const [duplicateScanActive, setDuplicateScanActive] = useState(false);

  function normalizeMerchantLabel(t) {
    return ((t.merchant || t.name || ""))
      .toLowerCase()
      .replace(/[#*]/g, " ")
      .replace(/\b(?:debit|credit|purchase|pos|checkcard|card|visa|mc|mastercard|pending|payment|online|auth|authorized|store|location|ticket|txn)\b/g, " ")
      .replace(/\d+/g, " ")
      .replace(/[^a-z]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scanForDuplicates() {
    const candidates = monthTxns.filter(t => {
      if (!t.date) return false;
      if (t.amount >= 0) return false;
      const label = normalizeMerchantLabel(t);
      return !!label;
    });

    const groups = new Map();
    candidates.forEach(t => {
      const key = `${normalizeMerchantLabel(t)}__${Math.abs(Number(t.amount || 0)).toFixed(2)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    });

    const nextPairs = [];
    const seen = new Set();

    for (const txns of groups.values()) {
      if (txns.length < 2) continue;

      txns.sort((a, b) => String(a.date).localeCompare(String(b.date)));

      for (let i = 0; i < txns.length; i++) {
        for (let j = i + 1; j < txns.length; j++) {
          const a = txns[i];
          const b = txns[j];
          const pairKey = [a.id, b.id].sort().join("__");
          if (seen.has(pairKey) || dismissedPairs.includes(pairKey)) continue;

          const aDate = new Date(`${a.date}T12:00:00`);
          const bDate = new Date(`${b.date}T12:00:00`);
          const dayDiff = Math.abs((bDate - aDate) / (1000 * 60 * 60 * 24));

          if (dayDiff > 14) continue;

          const pending = a.pending ? a : (b.pending ? b : a);
          const posted  = pending.id === a.id ? b : a;

          nextPairs.push({ pending, posted });
          seen.add(pairKey);
        }
      }
    }

    nextPairs.sort((x, y) => String(y.posted.date || y.pending.date).localeCompare(String(x.posted.date || x.pending.date)));
    setDuplicatePairs(nextPairs);
    setDuplicateScanActive(nextPairs.length > 0);
    setShowReconcile(nextPairs.length > 0);
    showToast(nextPairs.length > 0 ? `Found ${nextPairs.length} possible duplicate${nextPairs.length === 1 ? "" : "s"}` : "No duplicates found");
  }

  function dismissPair(pendingId) {
    const next = [...dismissedPairs, pendingId];
    setDismissedPairs(next);
    localStorage.setItem("ledgr_dismissed_pairs", JSON.stringify(next));
  }

  function confirmPair(pendingId, postedId) {
    const pending = transactions.find(t=>t.id===pendingId);
    const posted  = transactions.find(t=>t.id===postedId);
    if (!pending||!posted) return;
    setTransactions(p=>p
      .filter(t=>t.id!==pendingId)
      .map(t=>t.id!==postedId?t:{
        ...t,
        name:          pending.name||t.name,
        categoryId:    pending.categoryId||t.categoryId,
        recurring:     pending.recurring||t.recurring,
        recurringDay:  pending.recurringDay||t.recurringDay,
        recurringFreq: pending.recurringFreq||t.recurringFreq,
        recurringStart:pending.recurringStart||t.recurringStart,
        reviewed:      pending.reviewed||t.reviewed,
        type:          pending.type||t.type,
      })
    );
    showToast("Merged — metadata copied to posted transaction");
  }

  function dismissDuplicatePair(aId, bId) {
    const pairKey = [aId, bId].sort().join("__");
    const next = [...dismissedPairs, pairKey];
    setDismissedPairs(next);
    localStorage.setItem("ledgr_dismissed_pairs", JSON.stringify(next));
    setDuplicatePairs(prev => {
      const remaining = prev.filter(pair => [pair.pending.id, pair.posted.id].sort().join("__") !== pairKey);
      setShowReconcile(remaining.length > 0);
      return remaining;
    });
  }

  function confirmDuplicateRemoval(removeId, keepId) {
    const removeTxn = transactions.find(t => t.id === removeId);
    const keepTxn = transactions.find(t => t.id === keepId);
    if (!removeTxn || !keepTxn) return;

    setTransactions(prev => prev.filter(t => t.id !== removeId));
    setDuplicatePairs(prev => prev.filter(pair => !(
      (pair.pending.id === removeId && pair.posted.id === keepId) ||
      (pair.pending.id === keepId && pair.posted.id === removeId)
    )));
    showToast("Duplicate removed");
  }

  const pendingPairs = useMemo(() => {
    const pending = transactions.filter(t=>t.pending && !dismissedPairs.includes(t.id));
    const posted  = transactions.filter(t=>!t.pending);
    const pairs   = [];
    const usedPostedIds = new Set();
    pending.forEach(p=>{
      const pMer  = (p.merchant||p.name||"").toLowerCase().trim();
      const pDate = new Date(p.date+"T12:00:00");
      const match = posted.find(t=>{
        if (usedPostedIds.has(t.id)) return false;
        const tDate   = new Date(t.date+"T12:00:00");
        const dayDiff = Math.abs((tDate-pDate)/(1000*60*60*24));
        const tMer    = (t.merchant||t.name||"").toLowerCase().trim();
        return dayDiff<=7 && tMer===pMer;
      });
      if (match) { usedPostedIds.add(match.id); pairs.push({pending:p, posted:match}); }
    });
    return pairs;
  }, [transactions, dismissedPairs]);

  const [showDuplicates, setShowDuplicates] = useState(false);

  const activeDuplicatePairs = duplicateScanActive ? duplicatePairs : pendingPairs;

  const filteredTxns = useMemo(() =>
    transactions.filter(t => {
      const label = (t.name||t.merchant||"").toLowerCase();
      if (!showDuplicates && pendingPairs.some(p=>p.pending.id===t.id)) return false;
      if (search && !label.includes(search.toLowerCase())) return false;
      if (filterCat    !== "all" && t.categoryId !== filterCat)  return false;
      if (filterAcct   !== "all" && t.accountId  !== filterAcct) return false;
      if (filterReview && !needsReview(t)) return false;
      return true;
    }).sort((a,b) => b.date?.localeCompare(a.date)),
  [transactions, search, filterCat, filterAcct, filterReview, showDuplicates, pendingPairs]);

  useEffect(() => {
    if (view !== "transactions" || !txnSearchHadFocusRef.current) return;
    const el = txnSearchInputRef.current;
    if (!el) return;
    const start = txnSearchCaretRef.current.start ?? search.length;
    const end = txnSearchCaretRef.current.end ?? search.length;
    requestAnimationFrame(() => {
      if (!txnSearchInputRef.current) return;
      txnSearchInputRef.current.focus();
      try {
        txnSearchInputRef.current.setSelectionRange(start, end);
      } catch {}
    });
  }, [search, view, filteredTxns.length]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a,b) => {
      const remA = a.limit-(spentByCat[a.id]||0);
      const remB = b.limit-(spentByCat[b.id]||0);
      const groupA = remA<0 ? 0 : remA===0 ? 2 : 1; // 0=overspent, 1=in progress, 2=fully spent
      const groupB = remB<0 ? 0 : remB===0 ? 2 : 1;
      if (groupA!==groupB) return groupA-groupB;
      return a.name.localeCompare(b.name); // alphabetize within each group
    });
  }, [categories, spentByCat]);

  const catTxns = useMemo(() =>
    drillCat ? monthTxns.filter(t=>t.categoryId===drillCat.id&&t.amount<0).sort((a,b)=>b.date.localeCompare(a.date)) : [],
  [drillCat, monthTxns]);

  const recurringTxns = useMemo(() => transactions.filter(t=>t.recurring), [transactions]);

  const calendarTxnsByDay = useMemo(() => {
    const map = {};
    const [calY, calM] = calendarMonth.split("-").map(Number);
    const daysInCalMonth = daysInMonth(calY, calM);

    recurringTxns.forEach(t => {
      const freq  = t.recurringFreq || "monthly";
      const start = t.recurringStart ? new Date(t.recurringStart + "T12:00:00") : null;

      function addDay(d) {
        if (d < 1 || d > daysInCalMonth) return;
        if (!map[d]) map[d] = [];
        map[d].push(t);
      }

      if (freq === "monthly") {
        if (t.recurringDay) addDay(parseInt(t.recurringDay));

      } else if (freq === "annual") {
        // Show only if start date month matches calendar month
        if (start && start.getMonth()+1 === calM) {
          addDay(start.getDate());
        }

      } else if (freq === "weekly" || freq === "biweekly") {
        // Need a start date to calculate weekly/biweekly occurrences
        if (!start) {
          // Fallback: use recurringDay as day-of-month if no start date
          if (t.recurringDay) addDay(parseInt(t.recurringDay));
          return;
        }
        const intervalDays = freq === "weekly" ? 7 : 14;
        // Walk from start date forward, finding all occurrences in this calendar month
        let current = new Date(start);
        // Move start back if needed to find earliest occurrence before the month
        while (current > new Date(calY, calM-1, 1)) {
          current = new Date(current.getTime() - intervalDays*24*60*60*1000);
        }
        // Now walk forward through the month
        for (let i = 0; i < 60; i++) {
          if (current.getFullYear() === calY && current.getMonth()+1 === calM) {
            addDay(current.getDate());
          }
          if (current.getFullYear() > calY || (current.getFullYear() === calY && current.getMonth()+1 > calM)) break;
          current = new Date(current.getTime() + intervalDays*24*60*60*1000);
        }
      }
    });
    return map;
  }, [recurringTxns, calendarMonth]);

  function prevMonth() {
    const [y,m]=selectedMonth.split("-").map(Number);
    const d=new Date(y,m-2,1);
    setSelectedMonth(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
  }
  function nextMonth() {
    const [y,m]=selectedMonth.split("-").map(Number);
    const d=new Date(y,m,1);
    const next=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    if(next<=currentMonth) setSelectedMonth(next);
  }
  function prevCalMonth() {
    const [y,m]=calendarMonth.split("-").map(Number);
    const d=new Date(y,m-2,1);
    setCalendarMonth(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
  }
  function nextCalMonth() {
    const [y,m]=calendarMonth.split("-").map(Number);
    const d=new Date(y,m,1);
    setCalendarMonth(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
  }
  function monthLabel(ym) {
    const [y,m]=ym.split("-").map(Number);
    return new Date(y,m-1,1).toLocaleString("default",{month:"long",year:"numeric"});
  }

  /* ── Rules ── */
  function applyRules(txns, rs, opts = {}) {
    if (!rs?.length) return txns;
    const { onlyUncategorized = false } = opts;
    return txns.map(t => {
      if (onlyUncategorized && t.categoryId) return t;
      const mer=(t.merchant||t.name||"").toLowerCase().trim();
      for (const r of rs) {
        if (!r.enabled) continue;
        const pat=r.pattern.toLowerCase().trim();
        if (!pat) continue;
        const match=r.matchType==="exact"?mer===pat:r.matchType==="starts"?mer.startsWith(pat):mer.includes(pat);
        if (match) return {...t,categoryId:r.categoryId||t.categoryId};
      }
      return t;
    });
  }
  function promptSaveRule(txn, categoryId) {
    const mer=(txn.merchant||txn.name||"").toLowerCase().trim();
    if (!rules.some(r=>r.pattern.toLowerCase().trim()===mer)&&mer&&categoryId)
      setRulePrompt({txnId:txn.id,merchant:txn.merchant||txn.name,categoryId});
  }
  function confirmSaveRule() {
    if (!rulePrompt) return;
    setRules(p=>[...p,{id:"r"+Date.now(),pattern:rulePrompt.merchant,matchType:"contains",categoryId:rulePrompt.categoryId,enabled:true,createdAt:Date.now()}]);
    setRulePrompt(null); showToast("Rule saved");
  }
  function saveRule(rule)  { setRules(p=>[...p.filter(r=>r.id!==rule.id),rule]); showToast("Rule saved"); }
  function deleteRule(id)  {
    const rule = rules.find(r=>r.id===id);
    setRules(p=>p.filter(r=>r.id!==id));
    showUndoToast("Rule deleted", ()=>setRules(p=>[...p,rule]));
  }
  function toggleRule(id)  { setRules(p=>p.map(r=>r.id===id?{...r,enabled:!r.enabled}:r)); }

  useEffect(() => {
    if (!initialized.current || !rules.length) return;
    setTransactions(prev => applyRules(prev, rules, { onlyUncategorized: true }));
  }, [rules]);

  /* ── Plaid ── */
  const handlePlaidSuccess = useCallback(async (publicToken, institutionName) => {
    try {
      const {item_id} = await api.exchangePublicToken(publicToken, institutionName);
      setPlaidItems(p=>[...p.filter(i=>i.item_id!==item_id),{item_id,institution:institutionName}]);
      showToast(`${institutionName} connected! Syncing…`);
      await doSync(item_id);
    } catch(e) { showToast("Connection failed: "+e.message); }
  }, []);

  async function doSync(itemId) {
    setSyncing(true);
    try {
      const {added,modified,removed} = await api.syncTransactions(itemId);
      setTransactions(prev => {
        let next=[...prev];
        const removeIds=new Set(removed.map(r=>r.transaction_id));
        next=next.filter(t=>!removeIds.has(t.id));
        const modMap=Object.fromEntries(modified.map(t=>[t.transaction_id,t]));
        next=next.map(t=>{
          if (!modMap[t.id]) return t;
          const updated = plaidTxnToLocal(modMap[t.id],catMap);
          const merged = {
            ...t,
            ...updated,
            categoryId: t.categoryId || updated.categoryId || null,
          };
          return applyRules([merged], rules, { onlyUncategorized: true })[0];
        });
        const existing=new Set(next.map(t=>t.id));
        const rawNew=added.filter(t=>!existing.has(t.transaction_id)).map(t=>plaidTxnToLocal(t,catMap));
        return [...applyRules(rawNew, rules, { onlyUncategorized: true }),...next];
      });
      const {accounts:plaidAccts} = await api.getAccounts();
      setAccounts(prev => {
        const byId=Object.fromEntries(prev.map(a=>[a.plaidId,a]));
        const updated=plaidAccts.map(pa=>({
          id:byId[pa.account_id]?.id||"a"+pa.account_id, plaidId:pa.account_id,
          name:byId[pa.account_id]?.name||pa.name, balance:pa.balance,
          available:pa.available, type:cap(pa.subtype||pa.type), institution:pa.institution,
        }));
        api.saveData({accounts:updated});
        return updated;
      });
      setTransactions(prev=>{
        const map={};
        plaidAccts.forEach(pa=>{map[pa.account_id]="a"+pa.account_id;});
        return prev.map(t=>t.plaidAccountId?{...t,accountId:map[t.plaidAccountId]||t.accountId}:t);
      });
      showToast(`Synced: +${added.length} transactions`);
    } catch(e) { showToast("Sync error: "+e.message); }
    finally { setSyncing(false); }
  }
  function plaidTxnToLocal(t,cm) {
    const pc=(t.category||"").toLowerCase();
    const matched=Object.values(cm).find(c=>pc.includes(c.name.toLowerCase().split(" ")[0]));
    return {id:t.transaction_id,plaidAccountId:t.account_id,accountId:"a"+t.account_id,
      date:t.date||t.authorized_date,merchant:t.merchant_name||t.name,name:"",
      amount:t.amount,categoryId:matched?.id||null,pending:t.pending,recurring:false,recurringDay:null,
      type:t.amount<0?"expense":"income"};
  }
  async function disconnectItem(itemId) {
    try { await api.deleteItem(itemId); setPlaidItems(p=>p.filter(i=>i.item_id!==itemId)); showToast("Disconnected"); }
    catch(e) { showToast("Error: "+e.message); }
  }

  /* ── Category CRUD ── */
  function openAddCat()   { setCatForm({name:"",limit:"",color:CAT_COLORS[0]}); setModal("addCat"); }
  function openEditCat(c) { setCatForm({name:c.name,limit:String(c.limit),color:c.color}); setEditTarget(c); setModal("editCat"); }
  function saveCat() {
    if (!catForm.name.trim()||!catForm.limit) return;
    if (modal==="addCat") setCategories(p=>[...p,{id:"c"+Date.now(),name:catForm.name.trim(),limit:parseFloat(catForm.limit),color:catForm.color}]);
    else setCategories(p=>p.map(c=>c.id===editTarget.id?{...c,...catForm,limit:parseFloat(catForm.limit)}:c));
    setModal(null); showToast("Category saved");
  }
  function deleteCat(id) {
    const cat  = categories.find(c=>c.id===id);
    const affected = transactions.filter(t=>t.categoryId===id);
    setCategories(p=>p.filter(c=>c.id!==id));
    setTransactions(p=>p.map(t=>t.categoryId===id?{...t,categoryId:null}:t));
    showUndoToast("Category deleted", ()=>{
      setCategories(p=>[...p,cat]);
      setTransactions(p=>p.map(t=>affected.find(a=>a.id===t.id)?{...t,categoryId:id}:t));
    });
  }

  /* ── Account CRUD ── */
  function openAddAcct()   { setAcctForm({name:"",balance:"",type:"Checking"}); setModal("addAcct"); }
  function openEditAcct(a) { setAcctForm({name:a.name,balance:String(a.balance),type:a.type}); setEditTarget(a); setModal("editAcct"); }
  function saveAcct() {
    if (!acctForm.name.trim()) return;
    if (modal==="addAcct") setAccounts(p=>[...p,{id:"a"+Date.now(),name:acctForm.name.trim(),balance:parseFloat(acctForm.balance)||0,type:acctForm.type}]);
    else setAccounts(p=>p.map(a=>a.id===editTarget.id?{...a,...acctForm,balance:parseFloat(acctForm.balance)||0}:a));
    setModal(null); showToast("Account saved");
  }
  function deleteAcct(id) {
    const acct = accounts.find(a=>a.id===id);
    setAccounts(p=>p.filter(a=>a.id!==id));
    showUndoToast("Account deleted", ()=>setAccounts(p=>[...p,acct]));
  }

  /* ── Transaction CRUD ── */
  function startRename(t) { setEditingId(t.id); setEditingName(t.name||t.merchant); }
  function saveRename(id) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,name:editingName.trim()||t.merchant}:t));
    setEditingId(null); showToast("Name updated");
  }
  function updateTxnType(id,val) {
    setTransactions(p=>p.map(t=>{
      if (t.id!==id) return t;
      const autoReviewed = val==="income"||val==="transfer"||val==="reimbursement";
      return {...t, type:val, reviewed: autoReviewed ? true : t.reviewed};
    }));
  }
  function updateTxnCat(id,val) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,categoryId:val||null,reviewed:val?true:t.reviewed}:t));
    if(val){const txn=transactions.find(t=>t.id===id);if(txn)promptSaveRule(txn,val);}
  }
  function updateTxnAcct(id,val) { setTransactions(p=>p.map(t=>t.id===id?{...t,accountId:val||null}:t)); }
  function deleteTxn(id) {
    const txn = transactions.find(t=>t.id===id);
    setTransactions(p=>p.filter(t=>t.id!==id));
    showUndoToast("Transaction deleted", ()=>setTransactions(p=>[txn,...p]));
  }
  function toggleRecurring(id) {
    setTransactions(p=>p.map(t=>{
      if(t.id!==id) return t;
      const on=!t.recurring;
      const autoDay=t.date?parseInt(t.date.split("-")[2]):null;
      return {...t, recurring:on, recurringDay:on?(t.recurringDay||autoDay):null,
        recurringFreq: on?(t.recurringFreq||"monthly"):null,
        recurringStart: on?(t.recurringStart||t.date||null):null};
    }));
  }
  function updateRecurringDay(id,day) { setTransactions(p=>p.map(t=>t.id===id?{...t,recurringDay:parseInt(day)||null}:t)); }
  function openAddTxn() {
    setTxnForm({merchant:"",amount:"",date:today.toISOString().slice(0,10),categoryId:"",accountId:"",sign:"-1"});
    setModal("addTxn");
  }
  function saveManualTxn() {
    if(!txnForm.merchant.trim()||!txnForm.amount) return;
    setTransactions(p=>[{id:"m"+Date.now(),date:txnForm.date,merchant:txnForm.merchant.trim(),name:"",
      amount:parseFloat(txnForm.amount)*parseInt(txnForm.sign),categoryId:txnForm.categoryId||null,
      accountId:txnForm.accountId||null,recurring:false,recurringDay:null,
      type:txnForm.sign==="-1"?"expense":"income"},...p]);
    setModal(null); showToast("Transaction added");
  }

  /* ── Drill-down modal ── */
  const showDrillModal = drillCat && (view !== "budgets" || isMobile);
  const DrillDownModal = showDrillModal ? (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setDrillCat(null)}>
      <div style={{...S.modal,width:620,maxHeight:"85vh",display:"flex",flexDirection:"column",padding:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{width:11,height:11,borderRadius:"50%",background:drillCat.color,display:"inline-block",flexShrink:0}}/>
            <div style={{fontSize:17,fontWeight:700,color:"var(--t1)"}}>{drillCat.name}</div>
          </div>
          <button onClick={()=>setDrillCat(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:20,padding:"4px 8px"}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12,flexShrink:0}}>
          {[
            {label:"Spent",value:fmt(spentByCat[drillCat.id]||0),color:drillCat.color},
            {label:"Budget",value:fmt(drillCat.limit),color:"var(--t2)"},
            {label:"Remaining",value:fmt(drillCat.limit-(spentByCat[drillCat.id]||0)),color:(spentByCat[drillCat.id]||0)<=drillCat.limit?"var(--green)":"var(--red)"},
            {label:"Transactions",value:catTxns.length,color:"var(--t1)"},
          ].map(s=>(
            <div key={s.label} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>{s.label}</div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:600,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:14,flexShrink:0}}>
          <div style={{height:5,background:"var(--border)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,
              background:(spentByCat[drillCat.id]||0)>=drillCat.limit?"var(--red)":(spentByCat[drillCat.id]||0)/drillCat.limit>=0.8?"var(--amber)":drillCat.color,
              width:`${Math.min(((spentByCat[drillCat.id]||0)/drillCat.limit)*100,100)}%`,transition:"width 0.5s"}}/>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {catTxns.length===0
            ? <div style={{textAlign:"center",padding:"40px 0",color:"var(--t3)"}}>No transactions in {monthLabel(selectedMonth)}</div>
            : catTxns.map((t,i)=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 4px",borderBottom:i<catTxns.length-1?"1px solid var(--border)":"none",flexWrap:"wrap"}}>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",whiteSpace:"nowrap",flexShrink:0}}>{t.date}</div>
                  <div style={{flex:1,minWidth:80,fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                  <select style={{...S.select,fontSize:12,padding:"5px 8px",flexShrink:0,maxWidth:150}}
                    value={t.categoryId||""}
                    onChange={e=>{updateTxnCat(t.id,e.target.value);if(e.target.value!==drillCat.id)showToast("Moved");}}>
                    {categories.map(c=><option key={c.id} value={c.id}>{c.id===drillCat.id?"✓ ":""}{c.name}</option>)}
                    <option value="">— Uncategorized —</option>
                  </select>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:"var(--red)",flexShrink:0,minWidth:70,textAlign:"right"}}>{fmt(Math.abs(t.amount))}</div>
                </div>
              ))
          }
        </div>
        <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",flexShrink:0}}>
          <button style={S.btn("ghost")} onClick={()=>setDrillCat(null)}>Close</button>
        </div>
      </div>
    </div>
  ) : null;

  /* ─────────────────────────────────────────────────────────────────
     SCREENS
  ───────────────────────────────────────────────────────────────── */

  /* ── Dashboard ── */
  const budgetAnalytics = useMemo(() => {
    const spentCats = categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        spent: spentByCat[c.id] || 0,
        limit: c.limit || 0,
      }))
      .filter((c) => c.spent > 0)
      .sort((a, b) => b.spent - a.spent);

    const totalSpentForBreakdown = spentCats.reduce((sum, c) => sum + c.spent, 0);
    const topBreakdownCats = spentCats.slice(0, 5);

    const monthlyMap = {};
    transactions.forEach((t) => {
      if (!t.date) return;
      const ym = t.date.slice(0, 7);
      if (!monthlyMap[ym]) monthlyMap[ym] = { income: 0, spending: 0 };
      if (t.amount > 0) monthlyMap[ym].income += t.amount;
      if (t.amount < 0) monthlyMap[ym].spending += Math.abs(t.amount);
    });

    const [selY, selM] = selectedMonth.split("-").map(Number);
    const monthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selY, selM - 1 - i, 1);
      monthKeys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }

    const cashFlowSeries = monthKeys.map((ym) => {
      const row = monthlyMap[ym] || { income: 0, spending: 0 };
      const [y, m] = ym.split("-").map(Number);
      return {
        key: ym,
        label: new Date(y, m - 1, 1).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        income: row.income,
        spending: row.spending,
      };
    });

    const avgDelta =
      cashFlowSeries.length > 0
        ? cashFlowSeries.reduce((sum, m) => sum + (m.spending - m.income), 0) / cashFlowSeries.length
        : 0;

    const topOverspent = categories
      .map((c) => {
        const spent = spentByCat[c.id] || 0;
        const remaining = (c.limit || 0) - spent;
        return {
          id: c.id,
          name: c.name,
          color: c.color,
          spent,
          limit: c.limit || 0,
          overBy: remaining < 0 ? Math.abs(remaining) : 0,
        };
      })
      .filter((c) => c.overBy > 0)
      .sort((a, b) => b.overBy - a.overBy)
      .slice(0, 4);

    return {
      topBreakdownCats,
      totalSpentForBreakdown,
      cashFlowSeries,
      avgDelta,
      topOverspent,
    };
  }, [categories, spentByCat, transactions, selectedMonth]);

  const BudgetSummaryCard = (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.2px",
          color: "var(--t3)",
          fontFamily: "var(--font-disp)",
          marginBottom: 10,
        }}
      >
        Summary
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          ["Budgeted", fmt(totalBudget), "var(--t1)"],
          ["Spent", fmt(totalSpent), "var(--t1)"],
          ["Left", fmt(totalBudget - totalSpent), totalBudget - totalSpent >= 0 ? "var(--green)" : "var(--red)"],
        ].map(([label, value, color]) => (
          <div key={label}>
            <div
              style={{
                fontSize: 10,
                color: "var(--t3)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 4,
                fontFamily: "var(--font-disp)",
              }}
            >
              {label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const SpendingBreakdownCard = (
    <div style={{ ...S.card, padding: 18 }}>
      <div style={{ ...S.sectionHdr, marginBottom: 8 }}>
        <div style={S.sectionTitle}>Spending Breakdown</div>
      </div>

      {budgetAnalytics.totalSpentForBreakdown > 0 ? (
        <>
          <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 14px" }}>
            {(() => {
              const size = 180;
              const stroke = 18;
              const radius = (size - stroke) / 2;
              const circumference = 2 * Math.PI * radius;
              let offsetAcc = 0;
              return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={stroke}
                  />
                  {budgetAnalytics.topBreakdownCats.map((cat) => {
                    const fraction = cat.spent / budgetAnalytics.totalSpentForBreakdown;
                    const dash = fraction * circumference;
                    const gap = circumference - dash;
                    const circle = (
                      <circle
                        key={cat.id}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={cat.color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${gap}`}
                        strokeDashoffset={-offsetAcc}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                      />
                    );
                    offsetAcc += dash;
                    return circle;
                  })}
                  <text
                    x="50%"
                    y="47%"
                    textAnchor="middle"
                    fill="var(--t1)"
                    style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)" }}
                  >
                    {fmt(budgetAnalytics.totalSpentForBreakdown)}
                  </text>
                  <text x="50%" y="58%" textAnchor="middle" fill="var(--t3)" style={{ fontSize: "10px" }}>
                    Total
                  </text>
                </svg>
              );
            })()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {budgetAnalytics.topBreakdownCats.map((cat) => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                  <span style={{ color: "var(--t2)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat.name}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>
                  {fmt(cat.spent)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ color: "var(--t3)", padding: "12px 0" }}>No spending data for this month.</div>
      )}
    </div>
  );

  const CashFlowCard = (
    <div style={{ ...S.card, padding: 18 }}>
      <div style={{ ...S.sectionHdr, marginBottom: 8 }}>
        <div style={S.sectionTitle}>Cash Flow</div>
      </div>

      <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 14 }}>
        On average, spending{" "}
        <span style={{ color: budgetAnalytics.avgDelta > 0 ? "var(--red)" : "var(--green)", fontWeight: 700 }}>
          {fmt(Math.abs(budgetAnalytics.avgDelta))}/month
        </span>{" "}
        {budgetAnalytics.avgDelta > 0 ? "more than earning" : "less than earnings"}
      </div>

      {(() => {
        const maxVal = Math.max(1, ...budgetAnalytics.cashFlowSeries.flatMap((m) => [m.income, m.spending]));
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginBottom: 10, fontSize: 12, color: "var(--t2)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />
                Income
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c95ff" }} />
                Spending
              </span>
            </div>

            <div
              style={{
                height: 220,
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
                padding: "10px 4px 0",
                borderTop: "1px solid var(--border)",
                overflowX: isMobile ? "auto" : "visible",
              }}
            >
              {budgetAnalytics.cashFlowSeries.map((m) => {
                const incomeH = Math.max(6, (m.income / maxVal) * 180);
                const spendingH = Math.max(6, (m.spending / maxVal) * 180);
                return (
                  <div
                    key={m.key}
                    style={{
                      flex: isMobile ? "0 0 auto" : 1,
                      minWidth: isMobile ? 40 : 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180 }}>
                      <div title={`Income: ${fmt(m.income)}`} style={{ width: 16, height: incomeH, borderRadius: "8px 8px 0 0", background: "var(--green)" }} />
                      <div title={`Spending: ${fmt(m.spending)}`} style={{ width: 16, height: spendingH, borderRadius: "8px 8px 0 0", background: "#7c95ff" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t3)", whiteSpace: "nowrap" }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );

  const OverspendingHighlightsCard = (
    <div style={{ ...S.card, padding: 18 }}>
      <div style={{ ...S.sectionHdr, marginBottom: 10 }}>
        <div style={S.sectionTitle}>Overspending Highlights</div>
      </div>

      {budgetAnalytics.topOverspent.length === 0 ? (
        <div style={{ color: "var(--green)", fontSize: 13 }}>No categories are over budget right now.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {budgetAnalytics.topOverspent.map((cat) => (
            <div key={cat.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat.name}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--red)" }}>
                  +{fmt(cat.overBy)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)" }}>Spent {fmt(cat.spent)} of {fmt(cat.limit)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

const reviewCount = transactions.filter(t => needsReview(t)).length;


  const Dashboard = (
    <div>
      <div className="ledgr-monthbar" style={{...S.monthBar,justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center",width:"100%"}}>
          <button onClick={prevMonth} style={{background:"none",border:"1px solid var(--border2)",borderRadius:"var(--radius)",color:"var(--t2)",cursor:"pointer",padding:"6px 12px",fontSize:16,lineHeight:"1"}}>‹</button>
          <span style={{fontFamily:"var(--font-disp)",fontWeight:700,fontSize:15,color:"var(--t1)",minWidth:isMobile?90:180,textAlign:"center"}}>
            📅 {monthLabel(selectedMonth)}
            {isCurrentMonth&&<span style={{marginLeft:6,fontSize:10,color:"var(--cyan)",fontFamily:"var(--font-body)"}}>current</span>}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth} style={{background:"none",border:"1px solid var(--border2)",borderRadius:"var(--radius)",color:isCurrentMonth?"var(--border2)":"var(--t2)",cursor:isCurrentMonth?"default":"pointer",padding:"6px 12px",fontSize:16,lineHeight:"1"}}>›</button>
        </div>
        <div className="ledgr-monthbar-meta" style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:12,color:"var(--t2)",justifyContent:"center",width:"100%"}}>
          {isCurrentMonth&&<span><span style={{fontFamily:"var(--font-mono)",color:"var(--t1)"}}>{daysLeft()}</span> days left</span>}
          <span>Spent: <span style={{fontFamily:"var(--font-mono)",color:"var(--t1)"}}>{fmt(totalSpent)}</span></span>
          <span>Income: <span style={{fontFamily:"var(--font-mono)",color:"var(--green)"}}>{fmt(totalIncome)}</span></span>
          <span>Net: <span style={{fontFamily:"var(--font-mono)",color:totalIncome-totalSpent>=0?"var(--green)":"var(--red)"}}>{fmt(totalIncome-totalSpent)}</span></span>
        </div>
      </div>
{reviewCount > 0 && (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "var(--cyan-dim)",
      borderLeft: "3px solid var(--cyan)",
      borderRadius: "var(--radius)",
      padding: "10px 14px",
      marginBottom: 16,
    }}
  >
    <span style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>
      <span style={{ color: "var(--cyan)", fontWeight: 700 }}>
        {reviewCount}
      </span>{" "}
      transactions need review
    </span>

    <button
      onClick={() => {
        setView("transactions");
        setFilterReview(true);
        setSearch("");
        setFilterCat("all");
        setFilterAcct("all");
      }}
      style={{
        background: "none",
        color: "var(--cyan)",
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      Review ›
    </button>
  </div>
)}
      <div className="ledgr-stat-grid" style={{marginBottom:20}}>
        {[
          {label:"Budget",      value:fmt(totalBudget),sub:`${categories.length} categories`,         color:"var(--t1)"   },
          {label:"Spent",       value:fmt(totalSpent), sub:`${fmt(totalBudget-totalSpent)} left`,      color:"var(--red)"  },
          {label:"Income",      value:fmt(totalIncome),sub:`Net ${fmt(totalIncome-totalSpent)}`,       color:"var(--green)"},
          {label:"Transactions",value:monthTxns.length,sub:monthLabel(selectedMonth),                 color:"var(--t1)"   },
        ].map(s=>(
          <div key={s.label} style={S.stat}>
            <div style={S.statLabel}>{s.label}</div>
            <div style={{...S.statValue,color:s.color,fontSize:isMobile?17:26}}>{s.value}</div>
            <div style={{...S.statSub,fontSize:isMobile?10:12}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {isMobile ? (
        <div className="ledgr-dash-cards">
          <div style={S.card}>
            <div style={{...S.sectionHdr,marginBottom:12}}>
              <div style={S.cardTitle}>Budget Progress</div>
              <button style={S.btn("ghost",true)} onClick={()=>navigate("budgets")}>All →</button>
            </div>
            {categories.length===0
              ? <div style={{textAlign:"center",padding:"24px 0",color:"var(--t3)"}}>No categories yet</div>
              : sortedCategories.slice(0,6).map(cat=>{
                  const spent=spentByCat[cat.id]||0,remaining=cat.limit-spent;
                  const pct=Math.min((spent/cat.limit)*100,100),over=remaining<0,warn=pct>=80&&!over&&remaining!==0;
                  return (
                    <div key={cat.id} style={{marginBottom:16,cursor:"pointer"}} onClick={()=>setDrillCat(cat)}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0,flex:1}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</span>
                        </div>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:over?"var(--red)":remaining===0?"var(--t3)":"var(--green)",flexShrink:0,marginLeft:8,fontWeight:600}}>
                          {over?`−${fmt(Math.abs(remaining))} over`:remaining===0?"Fully spent":fmt(remaining)+" left"}
                        </span>
                      </div>
                      <div style={{height:4,background:"var(--border)",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                        <div style={{height:"100%",borderRadius:99,width:`${pct}%`,transition:"width 0.5s",background:over?"var(--red)":warn?"var(--amber)":remaining===0?"var(--t3)":cat.color}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t3)"}}>
                        <span>{fmt(spent)} spent</span><span>{fmt(cat.limit)} budget</span>
                      </div>
                    </div>
                  );
                })
            }
          </div>

          <div style={S.card}>
            <div style={{...S.sectionHdr,marginBottom:12}}>
              <div style={S.cardTitle}>Recent Transactions</div>
              <button style={S.btn("ghost",true)} onClick={()=>navigate("transactions")}>All →</button>
            </div>
            {filteredTxns.slice(0,8).map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:10,marginBottom:10,borderBottom:"1px solid var(--border)"}}>
                <div style={{flex:1,minWidth:0,marginRight:10}}>
                  <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {t.recurring&&<span style={{color:"var(--amber)",marginRight:4,fontSize:11}}>↻</span>}
                    {t.name||t.merchant}
                  </div>
                  <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{t.date} · <CategoryBadge cat={catMap[t.categoryId]}/></div>
                </div>
                <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0}}>
                  {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
                </span>
              </div>
            ))}
            {filteredTxns.length===0&&<div style={{textAlign:"center",color:"var(--t3)",padding:32}}>No transactions yet</div>}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {BudgetSummaryCard}
            {SpendingBreakdownCard}
            {CashFlowCard}
            {OverspendingHighlightsCard}
          </div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1fr) 340px",gap:16,alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:16,minWidth:0}}>
            <div style={S.card}>
              <div style={{...S.sectionHdr,marginBottom:12}}>
                <div style={S.cardTitle}>Budget Progress</div>
                <button style={S.btn("ghost",true)} onClick={()=>navigate("budgets")}>All →</button>
              </div>
              {categories.length===0
                ? <div style={{textAlign:"center",padding:"24px 0",color:"var(--t3)"}}>No categories yet</div>
                : sortedCategories.slice(0,6).map(cat=>{
                    const spent=spentByCat[cat.id]||0,remaining=cat.limit-spent;
                    const pct=Math.min((spent/cat.limit)*100,100),over=remaining<0,warn=pct>=80&&!over&&remaining!==0;
                    return (
                      <div key={cat.id} style={{marginBottom:16,cursor:"pointer"}} onClick={()=>setDrillCat(cat)}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                          <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0,flex:1}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
                            <span style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</span>
                          </div>
                          <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:over?"var(--red)":remaining===0?"var(--t3)":"var(--green)",flexShrink:0,marginLeft:8,fontWeight:600}}>
                            {over?`−${fmt(Math.abs(remaining))} over`:remaining===0?"Fully spent":fmt(remaining)+" left"}
                          </span>
                        </div>
                        <div style={{height:4,background:"var(--border)",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                          <div style={{height:"100%",borderRadius:99,width:`${pct}%`,transition:"width 0.5s",background:over?"var(--red)":warn?"var(--amber)":remaining===0?"var(--t3)":cat.color}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t3)"}}>
                          <span>{fmt(spent)} spent</span><span>{fmt(cat.limit)} budget</span>
                        </div>
                      </div>
                    );
                  })
              }
            </div>

            <div style={S.card}>
              <div style={{...S.sectionHdr,marginBottom:12}}>
                <div style={S.cardTitle}>Recent Transactions</div>
                <button style={S.btn("ghost",true)} onClick={()=>navigate("transactions")}>All →</button>
              </div>
              {filteredTxns.slice(0,8).map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:10,marginBottom:10,borderBottom:"1px solid var(--border)"}}>
                  <div style={{flex:1,minWidth:0,marginRight:10}}>
                    <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {t.recurring&&<span style={{color:"var(--amber)",marginRight:4,fontSize:11}}>↻</span>}
                      {t.name||t.merchant}
                    </div>
                    <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{t.date} · <CategoryBadge cat={catMap[t.categoryId]}/></div>
                  </div>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0}}>
                    {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
                  </span>
                </div>
              ))}
              {filteredTxns.length===0&&<div style={{textAlign:"center",color:"var(--t3)",padding:32}}>No transactions yet</div>}
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:16,minWidth:0}}>
            {BudgetSummaryCard}
            {SpendingBreakdownCard}
            {CashFlowCard}
            {OverspendingHighlightsCard}
          </div>
        </div>
      )}
      {DrillDownModal}
    </div>
  );

  /* ── Transactions ── */
  const Transactions = (()=>{
    // Group filtered transactions by date
    const grouped = filteredTxns.reduce((acc, t) => {
      const d = t.date || "Unknown";
      if (!acc[d]) acc[d] = [];
      acc[d].push(t);
      return acc;
    }, {});
    const dates = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

    const toReview = transactions.filter(t=>needsReview(t)).length;
    const totalBalance = accounts.reduce((a,b)=>a+(b.balance||0),0);

    return (
      <PageLayout
        isMobile={isMobile}
        left={(
          <div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
          <div style={S.sectionTitle}>All Transactions</div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"var(--font-mono)",fontSize:18,fontWeight:700,color:"var(--green)"}}>{fmt(totalBalance)}</div>
            <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>Total Balance</div>
          </div>
        </div>

        {/* Review banner */}
        {toReview>0&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            background:"var(--cyan-dim)",borderLeft:"3px solid var(--cyan)",
            borderRadius:"var(--radius)",padding:"10px 14px",marginBottom:8}}>
            <span style={{fontSize:13,color:"var(--t1)",fontWeight:500}}>
              <span style={{color:"var(--cyan)",fontWeight:700}}>{toReview}</span> transactions need review
            </span>
            <button onClick={()=>{ setFilterReview(p=>!p); setSearch(""); setFilterCat("all"); }}
              style={{background:filterReview?"var(--cyan)":"none",color:filterReview?"#000":"var(--cyan)",border:"none",borderRadius:"var(--radius)",cursor:"pointer",fontSize:13,fontWeight:600,padding:filterReview?"3px 10px":"0"}}>
              {filterReview?"✕ Clear":"Review ›"}
            </button>
          </div>
        )}

        {/* Pending reconciliation banner */}
        {(activeDuplicatePairs.length>0)&&(
          <div style={{background:"#fbbf2412",borderLeft:"3px solid var(--amber)",
            borderRadius:"var(--radius)",padding:"10px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:13,color:"var(--t1)",fontWeight:500}}>
                <span style={{color:"var(--amber)",fontWeight:700}}>{activeDuplicatePairs.length}</span> possible duplicate transaction{activeDuplicatePairs.length!==1?"s":""} found
              </span>
              <button onClick={()=>{
                if (showReconcile && duplicateScanActive) setDuplicateScanActive(false);
                setShowReconcile(p=>!p);
              }}
                style={{background:showReconcile?"var(--amber)":"none",color:showReconcile?"#000":"var(--amber)",border:"none",borderRadius:"var(--radius)",cursor:"pointer",fontSize:13,fontWeight:600,padding:showReconcile?"3px 10px":"0"}}>
                {showReconcile?"✕ Close":"Review ›"}
              </button>
            </div>
            {showReconcile&&(
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
{activeDuplicatePairs.map(({pending:p,posted:po})=>{
                  const isScannedDuplicate = duplicateScanActive;
                  const pCat = catMap[p.categoryId];
                  return (
                    <div key={p.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"12px 14px"}}>
                      {/* Pending row */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:"var(--amber)",fontWeight:600,marginBottom:2}}>{isScannedDuplicate ? (p.pending ? "PENDING / CANDIDATE" : "CANDIDATE A") : "PENDING"}</div>
                          <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name||p.merchant}</div>
                          <div style={{fontSize:11,color:"var(--t3)"}}>{p.date}{pCat&&<span style={{color:pCat.color}}> · {pCat.name}</span>}{p.recurring&&<span style={{color:"var(--amber)"}}> · ↻</span>}</div>
                        </div>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:13,color:"var(--t3)",flexShrink:0,marginLeft:10}}>{fmt(Math.abs(p.amount))}</span>
                      </div>
                      {/* Arrow */}
                      <div style={{fontSize:11,color:"var(--t3)",textAlign:"center",margin:"4px 0"}}>{isScannedDuplicate ? "↓ possible duplicate match" : "↓ matches posted transaction"}</div>
                      {/* Posted row */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:"var(--green)",fontWeight:600,marginBottom:2}}>{isScannedDuplicate ? (po.pending ? "PENDING / CANDIDATE" : "CANDIDATE B") : "POSTED"}</div>
                          <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{po.name||po.merchant}</div>
                          <div style={{fontSize:11,color:"var(--t3)"}}>{po.date}</div>
                        </div>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:po.amount<0?"var(--red)":"var(--green)",flexShrink:0,marginLeft:10}}>{po.amount<0?"-":"+"}{fmt(Math.abs(po.amount))}</span>
                      </div>
                      {/* Actions */}
                      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                        <button style={{...S.btn("ghost",true),fontSize:12}} onClick={()=>{
                          if (isScannedDuplicate) {
                            dismissDuplicatePair(p.id, po.id);
                          } else {
                            dismissPair(p.id);
                          }
                        }}>
                          Not a match
                        </button>
                        <button style={{...S.btn("primary",true),fontSize:12}}
                          onClick={()=>{
                            if (isScannedDuplicate) {
                              const removeId = p.pending && !po.pending ? p.id : (!p.pending && po.pending ? po.id : p.id);
                              const keepId = removeId === p.id ? po.id : p.id;
                              confirmDuplicateRemoval(removeId, keepId);
                              const remaining = duplicatePairs.filter(pair => !(
                                (pair.pending.id===p.id && pair.posted.id===po.id) ||
                                (pair.pending.id===po.id && pair.posted.id===p.id)
                              ));
                              if (remaining.length === 0) setDuplicateScanActive(false);
                              setShowReconcile(remaining.length > 0);
                            } else {
                              confirmPair(p.id,po.id);
                              setShowReconcile(pendingPairs.length>1);
                            }
                          }}>
                          {isScannedDuplicate ? "✓ Confirm & remove one" : "✓ Confirm & remove pending"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
          <button style={S.btn("primary",true)} onClick={openAddTxn}>+ Add</button>
          <button style={S.btn("ghost",true)} onClick={scanForDuplicates}>Scan Duplicates</button>
          {plaidItems.length>0&&<button style={S.btn("ghost",true)} onClick={()=>doSync()} disabled={syncing}>{syncing?"⟳ Syncing…":"⟳ Sync"}</button>}
        </div>

        {/* Filter row */}
        <div className="ledgr-filter-row" style={{...S.filterRow,marginBottom:14}}>
          <div style={{position:"relative",flex:1,minWidth:140}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--t3)",fontSize:13}}>🔍</span>
            <input ref={txnSearchInputRef} onFocus={()=>{txnSearchHadFocusRef.current=true;}} onBlur={()=>{txnSearchHadFocusRef.current=false;}} style={{...S.input,paddingLeft:32,fontSize:13}} placeholder="Search…" value={search} onChange={handleTxnSearchChange}/>
          </div>
          <select style={{...S.select,padding:"8px 10px"}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="">Uncategorized</option>
          </select>
          <select style={{...S.select,padding:"8px 10px"}} value={filterAcct} onChange={e=>setFilterAcct(e.target.value)}>
            <option value="all">All Accounts</option>
            {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {/* Grouped transaction list */}
        {filteredTxns.length===0 ? (
          <div style={{textAlign:"center",padding:"48px 0",color:"var(--t3)"}}>No transactions found</div>
        ) : (
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"var(--radius)",overflow:"hidden"}}>
            {dates.map((date,di)=>{
              const txns    = grouped[date];
              const dayTotal = txns.reduce((a,t)=>a+t.amount,0);
              return (
                <div key={date}>
                  {/* Date header */}
                  <div style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"8px 16px",
                    background:"var(--surface)",
                    borderTop: di>0?"1px solid var(--border)":"none",
                  }}>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--t3)",fontFamily:"var(--font-disp)",textTransform:"uppercase",letterSpacing:"0.8px"}}>
                      {new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
                    </span>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:dayTotal>=0?"var(--green)":"var(--t3)"}}>
                      {dayTotal>=0?"+":""}{fmt(dayTotal)}
                    </span>
                  </div>
                  {/* Transactions for this date */}
                  <div style={{padding:"0 16px"}}>
                    {txns.map(t=><TxnRow key={t.id} t={t}
                      expandedTxnId={expandedTxnId} setExpandedTxnId={setExpandedTxnId}
                      ellipsisId={ellipsisId} setEllipsisId={setEllipsisId}
                      editingId={editingId} editingName={editingName}
                      setEditingName={setEditingName} setEditingId={setEditingId}
                      catMap={catMap} acctMap={acctMap}
                      categories={categories} accounts={accounts}
                      needsReview={needsReview} markReviewed={markReviewed}
                      startRename={startRename} deleteTxn={deleteTxn}
                      updateTxnType={updateTxnType} updateTxnCat={updateTxnCat}
                      updateTxnAcct={updateTxnAcct} openAddCat={openAddCat}
                      toggleRecurring={toggleRecurring} updateRecurringDay={updateRecurringDay}
                      saveRename={saveRename}
                    />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}
      />
    );
  })();


  /* ── Budgets ── */
  const [editingLimitId,   setEditingLimitId]   = useState(null);
  const [editingLimitVal,  setEditingLimitVal]  = useState("");
  const [editingCatNameId, setEditingCatNameId] = useState(null);
  const [editingCatName,   setEditingCatName]   = useState("");

  function saveCatName(id) {
    const trimmed = editingCatName.trim();
    if (trimmed) {
      setCategories(p=>p.map(c=>c.id===id?{...c,name:trimmed}:c));
      showToast("Category renamed");
    }
    setEditingCatNameId(null);
  }

  function startEditLimit(cat, e) {
    e.stopPropagation();
    setEditingLimitId(cat.id);
    setEditingLimitVal(String(cat.limit));
  }
  function saveLimit(id) {
    const val = parseFloat(editingLimitVal);
    if (!isNaN(val) && val > 0) {
      setCategories(p=>p.map(c=>c.id===id?{...c,limit:val}:c));
      showToast("Budget updated");
    }
    setEditingLimitId(null);
  }

  const Budgets = (
    <div>
      <div style={{ ...S.sectionHdr, marginBottom: 16 }}>
        <div style={S.sectionTitle}>Budget Categories</div>
        <button style={S.btn("primary", true)} onClick={openAddCat}>+ New Category</button>
      </div>

      {categories.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 48, color: "var(--t3)" }}>No categories yet.</div>
      ) : (
        <>
          {isMobile ? (
            <>
              {(() => {
                const sections = [
                  { key: "over", label: "Overspent", cats: sortedCategories.filter(c => (c.limit - (spentByCat[c.id] || 0)) < 0) },
                  { key: "progress", label: "In Progress", cats: sortedCategories.filter(c => { const r = c.limit - (spentByCat[c.id] || 0); return r > 0; }) },
                  { key: "done", label: "Fully Spent", cats: sortedCategories.filter(c => (c.limit - (spentByCat[c.id] || 0)) === 0) },
                ].filter(s => s.cats.length > 0);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    {sections.map((section) => (
                      <div key={section.key} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: section.key === "over" ? "var(--red)" : section.key === "done" ? "var(--t3)" : "var(--t2)", fontFamily: "var(--font-disp)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{section.label}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t3)" }}>{section.cats.length} {section.cats.length === 1 ? "category" : "categories"}</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, padding: 8 }}>
                          {section.cats.map((cat) => {
                            const spent = spentByCat[cat.id] || 0;
                            const pct = Math.min((spent / cat.limit) * 100, 100);
                            const remaining = cat.limit - spent;
                            const over = remaining < 0;
                            const warn = pct >= 80 && !over && remaining !== 0;
                            const zero = remaining === 0 && !over;
                            const barC = over ? "var(--red)" : warn ? "var(--amber)" : zero ? "var(--t3)" : cat.color;
                            const remColor = over ? "var(--red)" : zero ? "var(--t3)" : "var(--green)";
                            const remBg = over ? "var(--red-dim)" : zero ? "var(--surface)" : "var(--green-dim)";
                            return (
                              <div key={cat.id} onClick={() => setBudgetExpandedCatId(prev => prev === cat.id ? null : cat.id)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", cursor: "pointer" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: cat.color, flexShrink: 0, display: "inline-block" }} />
                                  {editingCatNameId === cat.id ? (
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }} onClick={(e) => e.stopPropagation()}>
                                      <input autoFocus style={{ ...S.input, fontSize: 14, fontWeight: 600, padding: "3px 8px", flex: 1 }} value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} onBlur={() => saveCatName(cat.id)} onKeyDown={(e) => { if (e.key === "Enter") saveCatName(cat.id); if (e.key === "Escape") setEditingCatNameId(null); }} />
                                    </div>
                                  ) : (
                                    <span onClick={(e) => { e.stopPropagation(); setEditingCatNameId(cat.id); setEditingCatName(cat.name); }} title="Tap to rename" style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text" }}>{cat.name}</span>
                                  )}
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: remColor, background: remBg, border: `1px solid ${remColor}33`, borderRadius: 6, padding: "3px 10px", flexShrink: 0 }}>{over ? `-${fmt(Math.abs(remaining))}` : fmt(remaining)}</span>
                                  <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 14, padding: "2px 4px", flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); deleteCat(cat.id); }}>✕</button>
                                </div>
                                <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginBottom: 7 }}>
                                  <div style={{ height: "100%", borderRadius: 99, background: barC, width: `${pct}%`, transition: "width 0.5s" }} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <span style={{ fontSize: 12, color: over ? "var(--red)" : warn ? "var(--amber)" : "var(--t3)" }}>
                                    {over && <span style={{ fontWeight: 600, marginRight: 4 }}>Overspent ·</span>}
                                    {zero && <span style={{ marginRight: 4 }}>Fully spent ·</span>}
                                    Spent {fmt(spent)} /{" "}
                                    {editingLimitId === cat.id ? (
                                      <input type="number" autoFocus style={{ background: "none", border: "none", borderBottom: "1px solid var(--cyan)", fontSize: 12, color: "var(--t1)", outline: "none", width: 70, fontFamily: "var(--font-mono)" }} value={editingLimitVal} onChange={(e) => setEditingLimitVal(e.target.value)} onBlur={() => saveLimit(cat.id)} onKeyDown={(e) => { if (e.key === "Enter") saveLimit(cat.id); if (e.key === "Escape") setEditingLimitId(null); }} onClick={(e) => e.stopPropagation()} />
                                    ) : (
                                      <span onClick={(e) => startEditLimit(cat, e)} style={{ cursor: "text", color: "var(--t3)", textDecoration: "underline dotted", textUnderlineOffset: 2 }}>{fmt(cat.limit)}</span>
                                    )}
                                  </span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <button style={{ ...S.btn("ghost", true) }} onClick={(e) => { e.stopPropagation(); openEditCat(cat); }}>Edit</button>
                                    <span style={{ color: "var(--t3)", fontSize: 12 }}>{budgetExpandedCatId === cat.id ? "▲" : "▼"}</span>
                                  </div>
                                </div>

                                {budgetExpandedCatId === cat.id && (
                                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                                    {(monthTxns.filter(t => t.categoryId === cat.id && t.amount < 0).sort((a,b)=>b.date.localeCompare(a.date))).length === 0 ? (
                                      <div style={{ fontSize: 12, color: "var(--t3)" }}>No transactions in {monthLabel(selectedMonth)}</div>
                                    ) : (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {monthTxns.filter(t => t.categoryId === cat.id && t.amount < 0).sort((a,b)=>b.date.localeCompare(a.date)).map((t) => (
                                          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
                                            <div style={{ minWidth: 0 }}>
                                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || t.merchant}</div>
                                              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{t.date}</div>
                                              <div style={{ marginTop: 8 }}>
                                                <select
                                                  style={{ ...S.select, width: "100%", padding: "7px 10px", fontSize: 12 }}
                                                  value={t.categoryId || ""}
                                                  onChange={(e) => updateTxnCat(t.id, e.target.value)}
                                                >
                                                  <option value="">— Uncategorized —</option>
                                                  {categories.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                  ))}
                                                </select>
                                              </div>
                                            </div>
                                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--red)", whiteSpace: "nowrap" }}>-{fmt(Math.abs(t.amount))}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 16, alignItems: "start" }}>
              <div style={{ minWidth: 0 }}>
                {(() => {
                  const sections = [
                    { key: "over", label: "Overspent", cats: sortedCategories.filter(c => (c.limit - (spentByCat[c.id] || 0)) < 0) },
                    { key: "progress", label: "In Progress", cats: sortedCategories.filter(c => { const r = c.limit - (spentByCat[c.id] || 0); return r > 0; }) },
                    { key: "done", label: "Fully Spent", cats: sortedCategories.filter(c => (c.limit - (spentByCat[c.id] || 0)) === 0) },
                  ].filter(s => s.cats.length > 0);

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {sections.map((section) => (
                        <div key={section.key} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: section.key === "over" ? "var(--red)" : section.key === "done" ? "var(--t3)" : "var(--t2)", fontFamily: "var(--font-disp)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{section.label}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t3)" }}>{section.cats.length} {section.cats.length === 1 ? "category" : "categories"}</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 8 }}>
                            {section.cats.map((cat) => {
                              const spent = spentByCat[cat.id] || 0;
                              const pct = Math.min((spent / cat.limit) * 100, 100);
                              const remaining = cat.limit - spent;
                              const over = remaining < 0;
                              const warn = pct >= 80 && !over && remaining !== 0;
                              const zero = remaining === 0 && !over;
                              const barC = over ? "var(--red)" : warn ? "var(--amber)" : zero ? "var(--t3)" : cat.color;
                              const remColor = over ? "var(--red)" : zero ? "var(--t3)" : "var(--green)";
                              const remBg = over ? "var(--red-dim)" : zero ? "var(--surface)" : "var(--green-dim)";
                              return (
                                <div key={cat.id} onClick={() => setDrillCat(cat)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px", cursor: "pointer", transition: "background 0.12s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--card)")}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: cat.color, flexShrink: 0, display: "inline-block" }} />
                                    {editingCatNameId === cat.id ? (
                                      <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }} onClick={(e) => e.stopPropagation()}>
                                        <input autoFocus style={{ ...S.input, fontSize: 14, fontWeight: 600, padding: "3px 8px", flex: 1 }} value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} onBlur={() => saveCatName(cat.id)} onKeyDown={(e) => { if (e.key === "Enter") saveCatName(cat.id); if (e.key === "Escape") setEditingCatNameId(null); }} />
                                      </div>
                                    ) : (
                                      <span onClick={(e) => { e.stopPropagation(); setEditingCatNameId(cat.id); setEditingCatName(cat.name); }} title="Click to rename" style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text" }}>{cat.name}</span>
                                    )}
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: remColor, background: remBg, border: `1px solid ${remColor}33`, borderRadius: 6, padding: "3px 10px", flexShrink: 0 }}>{over ? `-${fmt(Math.abs(remaining))}` : fmt(remaining)}</span>
                                    <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 14, padding: "2px 4px", flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); deleteCat(cat.id); }}>✕</button>
                                  </div>
                                  <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginBottom: 7 }}>
                                    <div style={{ height: "100%", borderRadius: 99, background: barC, width: `${pct}%`, transition: "width 0.5s" }} />
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 12, color: over ? "var(--red)" : warn ? "var(--amber)" : "var(--t3)" }}>
                                      {over && <span style={{ fontWeight: 600, marginRight: 4 }}>Overspent ·</span>}
                                      {zero && <span style={{ marginRight: 4 }}>Fully spent ·</span>}
                                      Spent {fmt(spent)} /{" "}
                                      {editingLimitId === cat.id ? (
                                        <input type="number" autoFocus style={{ background: "none", border: "none", borderBottom: "1px solid var(--cyan)", fontSize: 12, color: "var(--t1)", outline: "none", width: 70, fontFamily: "var(--font-mono)" }} value={editingLimitVal} onChange={(e) => setEditingLimitVal(e.target.value)} onBlur={() => saveLimit(cat.id)} onKeyDown={(e) => { if (e.key === "Enter") saveLimit(cat.id); if (e.key === "Escape") setEditingLimitId(null); }} onClick={(e) => e.stopPropagation()} />
                                      ) : (
                                        <span onClick={(e) => startEditLimit(cat, e)} style={{ cursor: "text", color: "var(--t3)", textDecoration: "underline dotted", textUnderlineOffset: 2 }}>{fmt(cat.limit)}</span>
                                      )}
                                    </span>
                                    <button style={{ ...S.btn("ghost", true) }} onClick={(e) => { e.stopPropagation(); openEditCat(cat); }}>Edit</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                <div style={{ ...S.card, padding: 18 }}>
                  <div style={{ ...S.sectionHdr, marginBottom: 8 }}>
                    <div style={S.sectionTitle}>{drillCat ? `${drillCat.name} Transactions` : 'Category Transactions'}</div>
                  </div>
                  {drillCat ? (
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,paddingBottom:12,borderBottom:"1px solid var(--border)"}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                            <span style={{width:9,height:9,borderRadius:"50%",background:drillCat.color,display:"inline-block"}} />
                            <span style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{drillCat.name}</span>
                          </div>
                          <div style={{fontSize:12,color:"var(--t3)"}}>{catTxns.length} transaction{catTxns.length!==1?"s":""} this month</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:"var(--font-mono)",fontSize:16,fontWeight:800,color:(spentByCat[drillCat.id]||0)>drillCat.limit?"var(--red)":"var(--t1)"}}>{fmt(spentByCat[drillCat.id]||0)}</div>
                          <div style={{fontSize:11,color:"var(--t3)"}}>of {fmt(drillCat.limit)}</div>
                        </div>
                      </div>
                      {catTxns.length === 0 ? (
                        <div style={{ color: "var(--t3)", padding: "24px 0", textAlign:"center" }}>No transactions assigned this month.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "70vh", overflowY: "auto", paddingRight: 2 }}>
                          {catTxns.map((t) => (
                            <div key={t.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 12px", display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || t.merchant}</div>
                                <div style={{ fontSize: 12, color: "var(--t3)" }}>{t.date}</div>
                                <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{acctMap[t.accountId]?.name || 'No account'}</div>
                                <div style={{ marginTop: 8 }}>
                                  <select
                                    style={{ ...S.select, width: "100%", padding: "7px 10px", fontSize: 12 }}
                                    value={t.categoryId || ""}
                                    onChange={(e) => updateTxnCat(t.id, e.target.value)}
                                  >
                                    <option value="">— Uncategorized —</option>
                                    {categories.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800, color: t.amount < 0 ? "var(--red)" : "var(--green)", whiteSpace: "nowrap" }}>{t.amount < 0 ? "-" : "+"}{fmt(Math.abs(t.amount))}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{border:"1px dashed var(--border2)",borderRadius:"var(--radius)",padding:24,color:"var(--t3)",textAlign:"center",fontSize:13}}>Click a budget category to view its transactions here.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {DrillDownModal}
    </div>
  );
  /* ── Accounts ── */
  const Accounts = (
    <PageLayout
      isMobile={isMobile}
      left={
        <div>
          <div style={{...S.sectionHdr,marginBottom:8}}>
            <div style={S.sectionTitle}>Accounts</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <PlaidButton onSuccess={handlePlaidSuccess} onExit={()=>{}} label="Link Bank"/>
              <button style={S.btn("ghost",true)} onClick={openAddAcct}>+ Manual</button>
            </div>
          </div>
          <div style={{fontSize:13,color:"var(--t2)",marginBottom:16}}>Projections based on your daily spend rate through end of {today.toLocaleString("default",{month:"long"})}.</div>
          {plaidItems.length>0&&(
            <div style={{...S.card,marginBottom:16}}>
              <div style={S.cardTitle}>Connected Banks</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {plaidItems.map(item=>(
                  <div key={item.item_id} style={{display:"flex",alignItems:"center",gap:8,background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:"var(--radius)",padding:"8px 12px"}}>
                    <span style={{fontSize:13,color:"var(--t1)",fontWeight:500}}>🏦 {item.institution}</span>
                    <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:13}} onClick={()=>doSync(item.item_id)}>⟳</button>
                    <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:13}} onClick={()=>disconnectItem(item.item_id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {accounts.length===0
            ? <div style={{...S.card,textAlign:"center",padding:48,color:"var(--t3)"}}>No accounts yet.</div>
            : <div className="ledgr-acct-grid">
                {accounts.map(acct=>{
                  const spent=spentByAcct[acct.id]||0;
                  const income=monthTxns.filter(t=>t.amount>0&&t.accountId===acct.id&&(t.type==="income"||!t.type)).reduce((a,t)=>a+t.amount,0);
                  const daily=today.getDate()>0?spent/today.getDate():0;
                  const typeIcon=acct.type==="Credit"?"💳":acct.type==="Savings"?"🏦":"🏧";
                  return (
                    <div key={acct.id} style={S.card}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{fontSize:12,color:"var(--t3)",marginBottom:4}}>{typeIcon} {acct.type}{acct.institution?` · ${acct.institution}`:""}</div>
                          <div style={{fontFamily:"var(--font-disp)",fontSize:15,fontWeight:700}}>{acct.name}</div>
                          <div style={{fontFamily:"var(--font-mono)",fontSize:isMobile?20:24,fontWeight:600,color:"var(--cyan)",margin:"8px 0"}}>{fmt(acct.balance)}</div>
                          {acct.available!=null&&<div style={{fontSize:11,color:"var(--t3)"}}>Available: {fmt(acct.available)}</div>}
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button style={S.btn("ghost",true)} onClick={()=>openEditAcct(acct)}>Edit</button>
                          <button style={S.btn("ghost",true)} onClick={()=>deleteAcct(acct.id)}>✕</button>
                        </div>
                      </div>
                      <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)"}}>
                        {[
                          ["Spent this month",fmt(spent),"var(--t1)"],
                          ["Income this month",fmt(income),"var(--green)"],
                          ["Daily avg spend",`${fmt(daily)}/day`,"var(--t1)"],
                          ["Projected month end",fmt(daily*daysInMonth(today.getFullYear(),today.getMonth()+1)),"var(--t1)"],
                        ].map(([label,value,color])=>(
                          <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--t2)",marginBottom:6}}>
                            <span>{label}</span><span style={{fontFamily:"var(--font-mono)",color}}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      }
    />
  );

  /* ── Rules ── */
  const Rules = (
    <PageLayout
      isMobile={isMobile}
      left={
        <div>
          <div style={{...S.sectionHdr,marginBottom:6}}>
            <div style={S.sectionTitle}>Auto-Categorization Rules</div>
            <button style={S.btn("primary",true)} onClick={()=>{setRuleForm({pattern:"",matchType:"contains",categoryId:"",enabled:true});setModal("addRule");}}>+ New Rule</button>
          </div>
          <p style={{fontSize:12,color:"var(--t3)",marginBottom:16,lineHeight:1.6}}>Automatically assign categories to new transactions when they sync.</p>

          {rules.length===0 ? (
            <div style={{...S.card,textAlign:"center",padding:48}}>
              <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◎</div>
              <div style={{fontSize:14,fontWeight:600,color:"var(--t1)",marginBottom:6}}>No rules yet</div>
              <div style={{fontSize:13,color:"var(--t3)"}}>Categorize a transaction and you'll be prompted to save it as a rule.</div>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8}}>
              {rules.map((rule)=>{
                const cat = catMap[rule.categoryId];
                return (
                  <div key={rule.id}
                    style={{
                      background:"var(--card)",border:"1px solid var(--border)",
                      borderRadius:"var(--radius)",padding:"13px 16px",
                      borderLeft:rule.enabled
                        ? `3px solid ${cat?.color||"var(--cyan)"}`
                        : "3px solid var(--border2)",
                      opacity:rule.enabled?1:0.45,
                    }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:"var(--t3)",marginBottom:4}}>
                          {rule.matchType==="exact"?"Exact":"Contains"} match
                        </div>
                        <div style={{fontFamily:"var(--font-mono)",fontSize:13,color:"var(--t1)",marginBottom:8,wordBreak:"break-word"}}>
                          "{rule.pattern}"
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:11,color:"var(--t3)"}}>→</span>
                          {cat ? <CategoryBadge cat={cat}/> : <span style={{fontSize:12,color:"var(--t3)"}}>No category</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button style={S.btn("ghost",true)} onClick={()=>toggleRule(rule.id)}>{rule.enabled?"On":"Off"}</button>
                        <button style={S.btn("ghost",true)} onClick={()=>{setRuleForm({pattern:rule.pattern,matchType:rule.matchType,categoryId:rule.categoryId||"",enabled:rule.enabled});setEditTarget(rule);setModal("editRule");}}>Edit</button>
                        <button style={S.btn("ghost",true)} onClick={()=>deleteRule(rule.id)}>✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      }
    />
  );


  /* ── Calendar ── */
  const calYear=parseInt(calendarMonth.split("-")[0]);
  const calMonthN=parseInt(calendarMonth.split("-")[1]);
  const firstDow=new Date(calYear,calMonthN-1,1).getDay();
  const daysInCal=daysInMonth(calYear,calMonthN);
  const totalCells=Math.ceil((firstDow+daysInCal)/7)*7;

  const Calendar = (()=>{
    const isCurrentCalMonth = calYear===today.getFullYear()&&calMonthN===today.getMonth()+1;
    const isPastCalMonth    = calYear<today.getFullYear()||(calYear===today.getFullYear()&&calMonthN<today.getMonth()+1);
    const relevantTxns = recurringTxns.filter(t=>{
      if (isPastCalMonth) return false;
      if (isCurrentCalMonth) return (t.recurringDay||0)>=today.getDate();
      return true;
    });

    const shownIds = calendarAccounts || accounts.map(a=>a.id);
    const byAccount = {};
    shownIds.forEach(id=>{ const a=acctMap[id]; if(a) byAccount[id]={id,name:a.name,total:0,count:0,txns:[]}; });
    relevantTxns.forEach(t=>{
      if (!t.accountId||!byAccount[t.accountId]) return;
      if (t.amount>=0) return;
      byAccount[t.accountId].total+=Math.abs(t.amount);
      byAccount[t.accountId].count+=1;
      byAccount[t.accountId].txns.push(t);
    });
    const acctEntries = Object.values(byAccount).sort((a,b)=>b.total-a.total);
    const acctTotal   = acctEntries.reduce((a,e)=>a+e.total,0);
    const acctLabel   = isPastCalMonth?`Charged in ${monthLabel(calendarMonth)}`:isCurrentCalMonth?`Remaining in ${monthLabel(calendarMonth)}`:`Charges in ${monthLabel(calendarMonth)}`;

    const selectedDayTxns = calendarDay?.day && calendarTxnsByDay[calendarDay.day]
      ? calendarTxnsByDay[calendarDay.day]
      : [];

    const selectedDayDateLabel = calendarDay?.day
      ? new Date(calYear, calMonthN - 1, calendarDay.day).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "No day selected";

    const selectedDayTotal = selectedDayTxns.reduce(
      (sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0),
      0
    );

    const selectedCatBreakdown = Object.values(
      selectedDayTxns.reduce((acc, t) => {
        const cat = catMap[t.categoryId];
        const key = t.categoryId || "__uncategorized__";
        if (!acc[key]) {
          acc[key] = {
            id: key,
            name: cat?.name || "Uncategorized",
            color: cat?.color || "var(--t3)",
            total: 0,
            count: 0,
          };
        }
        acc[key].total += Math.abs(t.amount || 0);
        acc[key].count += 1;
        return acc;
      }, {})
    ).sort((a, b) => b.total - a.total);

    const MobileCalendarView = (
      <div>
        <div style={{ ...S.sectionHdr, marginBottom: 16 }}>
          <div style={S.sectionTitle}>Recurring Calendar</div>
          <div style={{ fontSize: 13, color: "var(--t2)" }}>{recurringTxns.length} recurring</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button
            onClick={prevCalMonth}
            style={{
              background: "none",
              border: "1px solid var(--border2)",
              borderRadius: "var(--radius)",
              color: "var(--t2)",
              cursor: "pointer",
              padding: "6px 12px",
              fontSize: 16,
              lineHeight: "1",
            }}
          >
            ‹
          </button>

          <div style={{ fontFamily: "var(--font-disp)", fontSize: 17, fontWeight: 700 }}>
            {monthLabel(calendarMonth)}
          </div>

          <button
            onClick={nextCalMonth}
            style={{
              background: "none",
              border: "1px solid var(--border2)",
              borderRadius: "var(--radius)",
              color: "var(--t2)",
              cursor: "pointer",
              padding: "6px 12px",
              fontSize: 16,
              lineHeight: "1",
            }}
          >
            ›
          </button>
        </div>

        <div style={{ ...S.card, padding: 0, overflow: "hidden", marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,minmax(0,1fr))",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  padding: "8px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--t3)",
                  fontFamily: "var(--font-disp)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                {d[0]}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,minmax(0,1fr))",
              gap: 1,
              background: "var(--border)",
            }}
          >
            {Array.from({ length: totalCells }).map((_, i) => {
              const day = i - firstDow + 1;
              const isValid = day >= 1 && day <= daysInCal;
              const isToday =
                isValid &&
                calYear === today.getFullYear() &&
                calMonthN === today.getMonth() + 1 &&
                day === today.getDate();
              const dayTxns = isValid ? calendarTxnsByDay[day] || [] : [];
              const isSelected = calendarDay?.day === day;

              return (
                <div
                  key={i}
                  onClick={() => {
                    if (isValid) setCalendarDay(dayTxns.length > 0 ? { day, txns: dayTxns } : null);
                  }}
                  style={{
                    background: isSelected
                      ? "var(--cyan-dim)"
                      : isToday
                      ? "var(--surface)"
                      : "var(--card)",
                    border: isSelected ? "1px solid var(--cyan)44" : "1px solid transparent",
                    minHeight: 54,
                    padding: 4,
                    cursor: isValid ? "pointer" : "default",
                    opacity: isValid ? 1 : 0.25,
                    transition: "background 0.1s",
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: isToday || isSelected ? 700 : 400,
                      color: isSelected ? "var(--cyan)" : isToday ? "var(--cyan)" : "var(--t2)",
                      marginBottom: 3,
                      ...(isToday
                        ? {
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "var(--cyan)",
                            color: "#000",
                            fontSize: 10,
                          }
                        : {}),
                    }}
                  >
                    {isValid ? day : ""}
                  </div>

                  {dayTxns.slice(0, 1).map((t) => {
                    const cat = catMap[t.categoryId];
                    return (
                      <div
                        key={t.id}
                        style={{
                          fontSize: 9,
                          color: "var(--bg)",
                          background: cat?.color || "var(--cyan)",
                          borderRadius: 3,
                          padding: "1px 4px",
                          marginBottom: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                          display: "block",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        {t.name || t.merchant}
                      </div>
                    );
                  })}

                  {dayTxns.length > 1 && (
                    <div style={{ fontSize: 8, color: "var(--t3)" }}>
                      +{dayTxns.length - 1} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {acctEntries.length > 0 && (
          <div style={{ ...S.card, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  color: "var(--t3)",
                  fontFamily: "var(--font-disp)",
                }}
              >
                {acctLabel}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--red)",
                }}
              >
                {fmt(acctTotal)}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {acctEntries.slice(0, 3).map((acct) => (
                <button
                  key={acct.id}
                  type="button"
                  onClick={() => setCalendarAcctPopup(acct)}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--t1)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {acct.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>
                      {acct.count} charges
                    </div>
                  </div>

                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--red)",
                      flexShrink: 0,
                    }}
                  >
                    {fmt(acct.total)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {calendarDay?.day && selectedDayTxns.length > 0 && (
          <div style={{ ...S.card, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>
                {selectedDayDateLabel}
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 3 }}>
                {selectedDayTxns.length} charges · {fmt(selectedDayTotal)}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedDayTxns.map((t) => {
                const acct = acctMap[t.accountId];
                const cat = catMap[t.categoryId];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setEditTarget(t);
                      setModal("editRecurring");
                    }}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "10px 12px",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      appearance: "none",
                      WebkitAppearance: "none",
                      touchAction: "manipulation",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--t1)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.name || t.merchant}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                        {acct?.name || "No account"}
                      </div>
                      <div style={{ fontSize: 11, color: cat?.color || "var(--t3)", marginTop: 2 }}>
                        {cat?.name || "Uncategorized"}
                      </div>
                    </div>

                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 14,
                        fontWeight: 700,
                        color: t.amount < 0 ? "var(--red)" : "var(--green)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.amount < 0 ? "-" : "+"}
                      {fmt(Math.abs(t.amount))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1.2px",
              color: "var(--t3)",
              fontFamily: "var(--font-disp)",
            }}
          >
            All Recurring Transactions
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {recurringTxns.length === 0 ? (
              <div style={{ padding: 20, color: "var(--t3)", textAlign: "center" }}>
                No recurring transactions yet
              </div>
            ) : (
              recurringTxns
                .slice()
                .sort((a, b) => (a.recurringDay || 0) - (b.recurringDay || 0))
                .map((t, idx) => {
                  const cat = catMap[t.categoryId];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setEditTarget(t);
                        setModal("editRecurring");
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "32px 1fr auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "12px 16px",
                        borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        background: "transparent",
                        appearance: "none",
                        WebkitAppearance: "none",
                        touchAction: "manipulation",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: "1px solid var(--border2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--cyan)",
                          background: "var(--surface)",
                        }}
                      >
                        {t.recurringDay || "—"}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--t1)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.name || t.merchant}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                          {t.recurringFreq || "monthly"}
                          {cat ? <span style={{ color: cat.color }}> · {cat.name}</span> : null}
                        </div>
                      </div>

                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 13,
                          fontWeight: 700,
                          color: t.amount < 0 ? "var(--red)" : "var(--green)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.amount < 0 ? "-" : "+"}
                        {fmt(Math.abs(t.amount))}
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </div>
    );

    const DesktopCalendarView = (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--t1)" }}>
              Recurring Calendar
            </div>
            <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>
              {recurringTxns.length} recurring transactions
            </div>
          </div>

          <div style={{ fontSize: 12, color: "var(--t3)" }}>
            {acctLabel}{" "}
            <span style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              {fmt(acctTotal)}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 340px",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN: calendar + recurring list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {/* Calendar card */}
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr 48px",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))",
                }}
              >
                <button
                  onClick={prevCalMonth}
                  style={{
                    ...S.btn("ghost", true),
                    width: 36,
                    height: 36,
                    padding: 0,
                    justifyContent: "center",
                    justifySelf: "start",
                  }}
                >
                  ‹
                </button>

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-disp)",
                      fontSize: 28,
                      fontWeight: 800,
                      color: "var(--t1)",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    {monthLabel(calendarMonth)}
                  </div>
                </div>

                <button
                  onClick={nextCalMonth}
                  style={{
                    ...S.btn("ghost", true),
                    width: 36,
                    height: 36,
                    padding: 0,
                    justifyContent: "center",
                    justifySelf: "end",
                  }}
                >
                  ›
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                {DAYS_OF_WEEK.map((d) => (
                  <div
                    key={d}
                    style={{
                      textAlign: "center",
                      padding: "12px 6px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--t3)",
                      fontFamily: "var(--font-disp)",
                      textTransform: "uppercase",
                      letterSpacing: "1.2px",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  background: "var(--border)",
                  gap: 1,
                }}
              >
                {Array.from({ length: totalCells }).map((_, i) => {
                  const day = i - firstDow + 1;
                  const isValid = day >= 1 && day <= daysInCal;
                  const isToday =
                    isValid &&
                    calYear === today.getFullYear() &&
                    calMonthN === today.getMonth() + 1 &&
                    day === today.getDate();

                  const dayTxns = isValid ? calendarTxnsByDay[day] || [] : [];
                  const isSelected = calendarDay?.day === day;

                  const dayTotal = dayTxns.reduce(
                    (sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0),
                    0
                  );

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (!isValid) return;
                        setCalendarDay({ day, txns: dayTxns });
                      }}
                      style={{
                        minHeight: 154,
                        background: !isValid
                          ? "rgba(255,255,255,0.015)"
                          : isSelected
                          ? "rgba(59,130,246,0.10)"
                          : "var(--card)",
                        padding: 10,
                        cursor: isValid ? "pointer" : "default",
                        opacity: isValid ? 1 : 0.45,
                        border: isSelected
                          ? "1px solid rgba(96,165,250,0.45)"
                          : "1px solid transparent",
                        overflow: "hidden",
                      }}
                    >
                      {isValid && (
                        <>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: isToday ? "#08111f" : "var(--t1)",
                                background: isToday ? "var(--cyan)" : "transparent",
                                borderRadius: 999,
                                minWidth: isToday ? 26 : "auto",
                                height: isToday ? 26 : "auto",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: isToday ? "0 8px" : 0,
                              }}
                            >
                              {day}
                            </div>

                            {dayTotal > 0 && (
                              <div
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "var(--red)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                -{fmt(dayTotal).replace("$", "")}
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {dayTxns.slice(0, 4).map((t) => {
                              const cat = catMap[t.categoryId];
                              return (
                                <div
                                  key={t.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    minWidth: 0,
                                    fontSize: 11,
                                    lineHeight: 1.2,
                                    color: "var(--t1)",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: 999,
                                      background: cat?.color || "var(--cyan)",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      color: "var(--t1)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {t.name || t.merchant}
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: "auto",
                                      fontFamily: "var(--font-mono)",
                                      color: t.amount < 0 ? "var(--red)" : "var(--green)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {t.amount < 0 ? "-" : "+"}
                                    {fmt(Math.abs(t.amount)).replace("$", "")}
                                  </span>
                                </div>
                              );
                            })}

                            {dayTxns.length > 4 && (
                              <div
                                style={{
                                  marginTop: 2,
                                  fontSize: 11,
                                  color: "var(--t3)",
                                  fontWeight: 600,
                                }}
                              >
                                +{dayTxns.length - 4} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recurring list card now matches calendar width */}
            {recurringTxns.length > 0 && (
              <div style={{ ...S.card, minWidth: 0 }}>
                <div style={S.cardTitle}>All Recurring Transactions</div>

                {[...recurringTxns]
                  .sort((a, b) => {
                    const freqOrder = { weekly: 0, biweekly: 1, monthly: 2, annual: 3 };
                    const fa = freqOrder[a.recurringFreq || "monthly"] ?? 2;
                    const fb = freqOrder[b.recurringFreq || "monthly"] ?? 2;
                    if (fa !== fb) return fa - fb;
                    return (a.recurringDay || 0) - (b.recurringDay || 0);
                  })
                  .map((t) => {
                    const cat = catMap[t.categoryId];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setEditTarget(t);
                          setModal("editRecurring");
                        }}
                        onTouchEnd={isMobile ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditTarget(t);
                          setModal("editRecurring");
                        } : undefined}
                        onKeyDown={isMobile ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditTarget(t);
                            setModal("editRecurring");
                          }
                        } : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 8px",
                          margin: "0 -8px 2px",
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          boxShadow: "none",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          cursor: "pointer",
                          borderRadius: 6,
                          transition: "background 0.12s",
                          WebkitTapHighlightColor: "transparent",
                          touchAction: isMobile ? "manipulation" : undefined,
                          width: "calc(100% + 16px)",
                          textAlign: "left",
                          appearance: "none",
                          WebkitAppearance: "none",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: "var(--surface)",
                              border: "1px solid var(--border2)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--cyan)",
                              flexShrink: 0,
                            }}
                          >
                            {t.recurringDay || "?"}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "var(--t1)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t.name || t.merchant}
                            </div>

                            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                              {t.recurringFreq === "weekly"
                                ? "Weekly"
                                : t.recurringFreq === "biweekly"
                                ? "Bi-weekly"
                                : t.recurringFreq === "annual"
                                ? "Annual"
                                : `Day ${t.recurringDay || "?"} of month`}
                              {t.recurringStart && <span style={{ marginLeft: 6 }}>· from {t.recurringStart}</span>}
                              {cat && (
                                <>
                                  {" "}· <span style={{ color: cat.color }}>{cat.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: 10 }}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 14,
                              fontWeight: 700,
                              color: t.amount < 0 ? "var(--red)" : "var(--green)",
                            }}
                          >
                            {t.amount < 0 ? "−" : "+"}
                            {fmt(Math.abs(t.amount))}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--t3)" }}>⋯</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1.2px",
                      color: "var(--t3)",
                      fontFamily: "var(--font-disp)",
                      marginBottom: 6,
                    }}
                  >
                    {acctLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 24,
                      fontWeight: 800,
                      color: "var(--red)",
                    }}
                  >
                    {fmt(acctTotal)}
                  </div>
                </div>

                <button onClick={openAddTxn} style={S.btn("ghost", true)}>
                  Add
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {acctEntries.slice(0, 4).map((acct) => (
                  <div
                    key={acct.id}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "12px 12px",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--t1)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {acct.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                        {acct.count} charge{acct.count !== 1 ? "s" : ""}
                      </div>
                    </div>

                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 18,
                        fontWeight: 800,
                        color: "var(--red)",
                        alignSelf: "center",
                      }}
                    >
                      {fmt(acct.total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 16,
                minHeight: 420,
              }}
            >
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "var(--t1)",
                    letterSpacing: "-0.4px",
                  }}
                >
                  {calendarDay?.day ? selectedDayDateLabel : "No day selected"}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "var(--t3)",
                    marginTop: 4,
                  }}
                >
                  {calendarDay?.day
                    ? `${selectedDayTxns.length} recurring item${selectedDayTxns.length !== 1 ? "s" : ""} · ${fmt(selectedDayTotal)}`
                    : "Click a calendar day to see details"}
                </div>
              </div>

              {calendarDay?.day && selectedDayTxns.length > 0 ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "1.2px",
                        color: "var(--t3)",
                        fontFamily: "var(--font-disp)",
                        marginBottom: 10,
                      }}
                    >
                      Category Breakdown
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selectedCatBreakdown.map((cat) => {
                        const pct =
                          selectedDayTotal > 0 ? Math.round((cat.total / selectedDayTotal) * 100) : 0;

                        return (
                          <div
                            key={cat.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto auto",
                              gap: 10,
                              alignItems: "center",
                              fontSize: 13,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: 999,
                                  background: cat.color,
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  color: "var(--t2)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {cat.name}
                              </span>
                            </div>

                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--t1)",
                                fontWeight: 700,
                              }}
                            >
                              {fmt(cat.total)}
                            </span>

                            <span style={{ color: "var(--t3)", fontSize: 12 }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "1.2px",
                        color: "var(--t3)",
                        fontFamily: "var(--font-disp)",
                        marginBottom: 10,
                      }}
                    >
                      Transactions
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedDayTxns.map((t) => {
                        const acct = acctMap[t.accountId];
                        const cat = catMap[t.categoryId];

                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setEditTarget(t);
                              setModal("editRecurring");
                            }}
                            onTouchEnd={isMobile ? (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditTarget(t);
                              setModal("editRecurring");
                            } : undefined}
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                              padding: "12px 12px",
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 8,
                              alignItems: "start",
                              cursor: "pointer",
                              transition: "background 0.12s",
                              appearance: "none",
                              WebkitAppearance: "none",
                              width: "100%",
                              textAlign: "left",
                              touchAction: isMobile ? "manipulation" : undefined,
                              WebkitTapHighlightColor: "transparent",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--surface)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: "var(--t1)",
                                  marginBottom: 4,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {t.name || t.merchant}
                              </div>

                              <div style={{ fontSize: 12, color: "var(--t3)" }}>
                                {acct?.name || "No account"}
                              </div>

                              <div
                                style={{
                                  fontSize: 12,
                                  color: cat?.color || "var(--t3)",
                                  marginTop: 2,
                                }}
                              >
                                {cat?.name || "Uncategorized"}
                              </div>
                            </div>

                            <div
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 20,
                                fontWeight: 800,
                                color: t.amount < 0 ? "var(--red)" : "var(--green)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t.amount < 0 ? "-" : "+"}
                              {fmt(Math.abs(t.amount))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    border: "1px dashed var(--border2)",
                    borderRadius: "var(--radius)",
                    padding: 24,
                    color: "var(--t3)",
                    textAlign: "center",
                    fontSize: 13,
                  }}
                >
                  Choose a day on the calendar to show its recurring charges.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <>
        {isMobile ? MobileCalendarView : DesktopCalendarView}

        {/* Account charges popup (mobile + desktop) */}
        {calendarAcctPopup&&(
          <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setCalendarAcctPopup(null)}>
            <div style={{...S.modal,width:480}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <div style={S.modalTitle}>{calendarAcctPopup.name}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:-14}}>{calendarAcctPopup.count} charge{calendarAcctPopup.count!==1?"s":""} · {fmt(calendarAcctPopup.total)} total</div>
                </div>
                <button onClick={()=>setCalendarAcctPopup(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:20,padding:"4px 8px"}}>✕</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[...calendarAcctPopup.txns].sort((a,b)=>(a.recurringDay||0)-(b.recurringDay||0)).map(t=>{
                  const cat=catMap[t.categoryId];
                  const freq=t.recurringFreq||"monthly";
                  const freqLabel=freq==="biweekly"?"Bi-weekly":freq==="weekly"?"Weekly":freq==="annual"?"Annual":`Day ${t.recurringDay||"?"} of month`;
                  return (
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",borderLeft:`2px solid ${cat?.color||"var(--cyan)"}`}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                        <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>{freqLabel}{cat&&<span style={{color:cat.color}}> · {cat.name}</span>}</div>
                      </div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:700,color:"var(--red)",flexShrink:0}}>{fmt(Math.abs(t.amount))}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:20,display:"flex",justifyContent:"flex-end"}}>
                <button style={S.btn("ghost")} onClick={()=>setCalendarAcctPopup(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  })();
  /* ─────────────────────────────────────────────────────────────────
     MODALS
  ───────────────────────────────────────────────────────────────── */
  const EditRecurringModal = editTarget && modal==="editRecurring" ? (
    <Modal title="Edit Recurring Transaction" onClose={()=>{setModal(null);setEditTarget(null);}}
      actions={<>
        <button style={{...S.btn("ghost"),color:"var(--t3)"}} onClick={()=>{
          toggleRecurring(editTarget.id);
          setModal(null);setEditTarget(null);showToast("Removed from recurring");
        }}>Remove Recurring</button>
        <button style={S.btn("ghost")} onClick={()=>{setModal(null);setEditTarget(null);}}>Cancel</button>
        <button style={S.btn("primary")} onClick={()=>{
          setTransactions(p=>p.map(t=>t.id===editTarget.id?{
            ...t,
            name:           editTarget.name,
            recurringDay:   editTarget.recurringDay,
            recurringFreq:  editTarget.recurringFreq||"monthly",
            recurringStart: editTarget.recurringStart||null,
            categoryId:     editTarget.categoryId||null,
          }:t));
          setModal(null);setEditTarget(null);showToast("Updated");
        }}>Save</button>
      </>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{padding:"10px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:12,color:"var(--t3)"}}>
          Original: <span style={{color:"var(--t1)",fontWeight:500}}>{editTarget.merchant}</span>
        </div>
        <div style={S.field}>
          <label style={S.label}>Display Name</label>
          <input style={S.input} placeholder={editTarget.merchant} value={editTarget.name||""} onChange={e=>setEditTarget(p=>({...p,name:e.target.value}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Frequency</label>
          <select style={{...S.input,padding:"9px 12px"}} value={editTarget.recurringFreq||"monthly"} onChange={e=>setEditTarget(p=>({...p,recurringFreq:e.target.value}))}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        {(editTarget.recurringFreq==="monthly"||!editTarget.recurringFreq)&&(
          <div style={S.field}>
            <label style={S.label}>Day of Month</label>
            <input style={S.input} type="number" min="1" max="31" placeholder="e.g. 15"
              value={editTarget.recurringDay||""} onChange={e=>setEditTarget(p=>({...p,recurringDay:parseInt(e.target.value)||null}))}/>
          </div>
        )}
        <div style={S.field}>
          <label style={S.label}>Start Date</label>
          <input style={S.input} type="date" value={editTarget.recurringStart||""}
            onChange={e=>setEditTarget(p=>({...p,recurringStart:e.target.value||null}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Category</label>
          <select style={{...S.input,padding:"9px 12px"}} value={editTarget.categoryId||""} onChange={e=>setEditTarget(p=>({...p,categoryId:e.target.value||null}))}>
            <option value="">— None —</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  ) : null;

  const RuleModal = (
    <Modal title={modal==="addRule"?"New Rule":"Edit Rule"} onClose={()=>setModal(null)}
      actions={<>
        <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button>
        <button style={S.btn("primary")} onClick={()=>{
          if(!ruleForm.pattern.trim()||!ruleForm.categoryId) return;
          saveRule({id:modal==="editRule"?editTarget.id:"r"+Date.now(),...ruleForm,pattern:ruleForm.pattern.trim(),createdAt:modal==="editRule"?editTarget.createdAt:Date.now()});
          setModal(null);
        }}>Save</button>
      </>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={S.field}>
          <label style={S.label}>Merchant Pattern</label>
          <input style={S.input} placeholder='e.g. "Netflix"' value={ruleForm.pattern} onChange={e=>setRuleForm(p=>({...p,pattern:e.target.value}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Match Type</label>
          <select style={{...S.input,padding:"9px 12px"}} value={ruleForm.matchType} onChange={e=>setRuleForm(p=>({...p,matchType:e.target.value}))}>
            <option value="contains">Contains</option>
            <option value="starts">Starts with</option>
            <option value="exact">Exact match</option>
          </select>
        </div>
        <div style={S.field}>
          <label style={S.label}>Assign Category</label>
          <select style={{...S.input,padding:"9px 12px"}} value={ruleForm.categoryId} onChange={e=>setRuleForm(p=>({...p,categoryId:e.target.value}))}>
            <option value="">— Select —</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );

  const CatModal = (
    <Modal title={modal==="addCat"?"New Category":"Edit Category"} onClose={()=>setModal(null)}
      actions={<><button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button><button style={S.btn("primary")} onClick={saveCat}>Save</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={S.field}><label style={S.label}>Name</label><input style={S.input} placeholder="Groceries" value={catForm.name} onChange={e=>setCatForm(p=>({...p,name:e.target.value}))}/></div>
        <div style={S.field}><label style={S.label}>Monthly Limit ($)</label><input style={S.input} type="number" placeholder="500" value={catForm.limit} onChange={e=>setCatForm(p=>({...p,limit:e.target.value}))}/></div>
        <div style={S.field}>
          <label style={S.label}>Color</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {CAT_COLORS.map(c=>(
              <div key={c} onClick={()=>setCatForm(p=>({...p,color:c}))} style={{width:32,height:32,borderRadius:6,background:c,cursor:"pointer",border:`2px solid ${catForm.color===c?"var(--t1)":"transparent"}`,transition:"transform 0.15s",transform:catForm.color===c?"scale(1.15)":"scale(1)"}}/>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );

  const AcctModal = (
    <Modal title={modal==="addAcct"?"Add Account":"Edit Account"} onClose={()=>setModal(null)}
      actions={<><button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button><button style={S.btn("primary")} onClick={saveAcct}>Save</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={S.field}><label style={S.label}>Name</label><input style={S.input} placeholder="Chase Checking" value={acctForm.name} onChange={e=>setAcctForm(p=>({...p,name:e.target.value}))}/></div>
        <div style={S.field}><label style={S.label}>Type</label>
          <select style={{...S.input,padding:"9px 12px"}} value={acctForm.type} onChange={e=>setAcctForm(p=>({...p,type:e.target.value}))}>
            {["Checking","Savings","Credit","Investment"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={S.field}><label style={S.label}>Balance ($)</label><input style={S.input} type="number" placeholder="0.00" value={acctForm.balance} onChange={e=>setAcctForm(p=>({...p,balance:e.target.value}))}/></div>
      </div>
    </Modal>
  );

  const TxnModal = (
    <Modal title="Add Transaction" onClose={()=>setModal(null)}
      actions={<><button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button><button style={S.btn("primary")} onClick={saveManualTxn}>Save</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={S.field}><label style={S.label}>Description</label><input style={S.input} placeholder="Amazon" value={txnForm.merchant} onChange={e=>setTxnForm(p=>({...p,merchant:e.target.value}))}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div style={S.field}><label style={S.label}>Type</label>
            <select style={{...S.input,padding:"9px 12px"}} value={txnForm.sign} onChange={e=>setTxnForm(p=>({...p,sign:e.target.value}))}>
              <option value="-1">Expense (−)</option><option value="1">Income (+)</option>
            </select>
          </div>
          <div style={S.field}><label style={S.label}>Amount ($)</label><input style={S.input} type="number" placeholder="0.00" value={txnForm.amount} onChange={e=>setTxnForm(p=>({...p,amount:e.target.value}))}/></div>
        </div>
        <div style={S.field}><label style={S.label}>Date</label><input style={S.input} type="date" value={txnForm.date} onChange={e=>setTxnForm(p=>({...p,date:e.target.value}))}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div style={S.field}><label style={S.label}>Category</label>
            <select style={{...S.input,padding:"9px 12px"}} value={txnForm.categoryId} onChange={e=>setTxnForm(p=>({...p,categoryId:e.target.value}))}>
              <option value="">None</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={S.field}><label style={S.label}>Account</label>
            <select style={{...S.input,padding:"9px 12px"}} value={txnForm.accountId} onChange={e=>setTxnForm(p=>({...p,accountId:e.target.value}))}>
              <option value="">None</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );

  /* ─────────────────────────────────────────────────────────────────
     NAV + RENDER
  ───────────────────────────────────────────────────────────────── */

  /* ── Shared sidebar ── */
  const currentUser  = api.getStoredUser();
  const avatarColor  = (() => {
    const colors = ["#00d4ff","#00e676","#a78bfa","#f97316","#ec4899","#fbbf24","#14b8a6"];
    const i = (currentUser?.email || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
    return colors[i];
  })();
  const avatarLetter = (currentUser?.name || currentUser?.email || "?")[0].toUpperCase();

  const SettingsPage = (
    <SettingsView
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      catMap={catMap}
      acctMap={acctMap}
      avatarColor={avatarColor}
      avatarLetter={avatarLetter}
      showToast={showToast}
    />
  );
  const VIEWS = { dashboard:Dashboard, transactions:Transactions, budgets:Budgets, accounts:Accounts, rules:Rules, calendar:Calendar, settings:SettingsPage };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"var(--font-disp)",fontSize:28,fontWeight:800,color:"var(--t1)"}}>ledgr<span style={{color:"var(--cyan)"}}>.</span></div>
      <div style={{fontSize:13,color:"var(--t3)"}}>Loading your data…</div>
    </div>
  );

  return (
    <div style={S.shell}>
    {isMobile ? (
      /* ════════════════════════════════════
         MOBILE — hamburger + overlay drawer
         ════════════════════════════════════ */
      <>
        {/* Mobile top bar */}
        <div style={{height:52,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",background:"var(--surface)",borderBottom:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <button onClick={()=>setDrawerOpen(p=>!p)}
              style={{background:"none",border:"none",cursor:"pointer",padding:"6px 4px",color:"var(--t2)",display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
              <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:1}}/>
              <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:1}}/>
              <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:1}}/>
            </button>
            <div style={{fontFamily:"var(--font-disp)",fontSize:17,fontWeight:800,letterSpacing:"-0.5px"}}>
              ledgr<span style={{color:"var(--cyan)"}}>.</span>
            </div>
            <span style={{fontSize:12,color:"var(--t3)",fontWeight:500}}>{NAV.find(n=>n.id===view)?.label}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {syncing&&<span style={{fontSize:12,color:"var(--cyan)"}}>⟳</span>}
            <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--t3)"}}>{daysLeft()}d left</div>
          </div>
        </div>

        {/* Mobile body */}
        <div style={{flex:1,position:"relative",overflow:"hidden"}}>
          {/* Backdrop */}
          {drawerOpen&&(
            <div onClick={()=>setDrawerOpen(false)}
              style={{position:"absolute",inset:0,background:"#00000055",zIndex:40}}/>
          )}
          {/* Overlay drawer */}
          <div style={{
            position:"absolute",top:0,left:0,bottom:0,width:240,
            background:"var(--surface)",borderRight:"1px solid var(--border)",
            display:"flex",flexDirection:"column",
            transform:drawerOpen?"translateX(0)":"translateX(-100%)",
            transition:"transform 0.22s cubic-bezier(.4,0,.2,1)",
            zIndex:50,boxShadow:drawerOpen?"6px 0 24px #00000044":"none",
          }}>
            <SidebarContent onNav={id=>{ setView(id); setDrawerOpen(false); contentRef.current?.scrollTo({ top: 0 }); }} view={view} syncing={syncing} doSync={doSync} showToast={showToast} avatarColor={avatarColor} avatarLetter={avatarLetter} />
          </div>
          {/* Content */}
          <div ref={contentRef} style={{height:"100%",overflowY:"auto"}} className="ledgr-content">
            {VIEWS[view]}
          </div>
        </div>
      </>
    ) : (
      /* ════════════════════════════════════
         DESKTOP — persistent sidebar
         ════════════════════════════════════ */
      <>
        {/* Desktop top bar */}
        <div style={{height:56,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",background:"var(--surface)",borderBottom:"1px solid var(--border)"}}>
          <div style={{fontFamily:"var(--font-disp)",fontSize:15,fontWeight:700,color:"var(--t3)",letterSpacing:"-0.2px"}}>
            {NAV.find(n=>n.id===view)?.label}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {syncing&&<span style={{fontSize:12,color:"var(--cyan)"}}>⟳ Syncing…</span>}
            <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)"}}>
              {today.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} · {daysLeft()}d left
            </div>
          </div>
        </div>

        {/* Desktop body */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          {/* Persistent sidebar */}
          <aside style={{width:220,flexShrink:0,background:"var(--surface)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column"}}>
            <SidebarContent onNav={id=>{ setView(id); contentRef.current?.scrollTo({ top: 0 }); }} view={view} syncing={syncing} doSync={doSync} showToast={showToast} avatarColor={avatarColor} avatarLetter={avatarLetter} />
          </aside>
          {/* Content */}
          <div ref={contentRef} style={{flex:1,overflowY:"auto"}} className="ledgr-content">
            {VIEWS[view]}
          </div>
        </div>
      </>
    )}

      {/* ── Modals ── */}
      {(modal==="addCat"||modal==="editCat")   && CatModal}
      {(modal==="addAcct"||modal==="editAcct") && AcctModal}
      {modal==="addTxn"                        && TxnModal}
      {(modal==="addRule"||modal==="editRule") && RuleModal}
      {EditRecurringModal}

      {rulePrompt&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:200,background:"var(--card)",border:"1px solid var(--cyan)44",borderRadius:12,padding:"14px 20px",boxShadow:"0 8px 32px #00000080",display:"flex",alignItems:"center",gap:14,maxWidth:420,width:"90vw"}}>
          <div style={{flex:1,fontSize:13}}>
            <div style={{fontWeight:600,color:"var(--t1)",marginBottom:2}}>Save as a rule?</div>
            <div style={{fontSize:12,color:"var(--t2)"}}>&quot;{rulePrompt.merchant}&quot; → <strong>{catMap[rulePrompt.categoryId]?.name}</strong></div>
          </div>
          <button style={S.btn("primary",true)} onClick={confirmSaveRule}>Save Rule</button>
          <button style={S.btn("ghost",true)} onClick={()=>setRulePrompt(null)}>✕</button>
        </div>
      )}

      {newTxnCount>0&&(
        <div style={{
          position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
          zIndex:300,background:"var(--cyan)",color:"#000",
          borderRadius:12,padding:"12px 20px",
          boxShadow:"0 8px 32px #00000080",
          display:"flex",alignItems:"center",gap:14,
          maxWidth:400,width:"90vw",cursor:"pointer",
        }} onClick={()=>{ setView("transactions"); setNewTxnCount(0); }}>
          <span style={{fontSize:18}}>⇅</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14}}>
              {newTxnCount} new transaction{newTxnCount!==1?"s":""} synced
            </div>
            <div style={{fontSize:12,opacity:0.7}}>Tap to view</div>
          </div>
          <button onClick={e=>{e.stopPropagation();setNewTxnCount(0);}}
            style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#000"}}>✕</button>
        </div>
      )}

      {undoAction&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:500,
          background:"var(--card)",border:"1px solid var(--border2)",borderRadius:12,
          padding:"12px 16px",boxShadow:"0 8px 32px #00000080",
          display:"flex",alignItems:"center",gap:14,maxWidth:380,width:"90vw"}}>
          <span style={{fontSize:13,color:"var(--t1)",flex:1}}>{undoAction.label}</span>
          <button onClick={()=>{ undoAction.fn(); setUndoAction(null); clearTimeout(undoTimer.current); }}
            style={{...S.btn("primary",true),flexShrink:0}}>
            Undo
          </button>
          <button onClick={()=>setUndoAction(null)}
            style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:16,padding:"2px 4px"}}>✕</button>
        </div>
      )}

      <Toast msg={toast}/>
    </div>
  );
}
