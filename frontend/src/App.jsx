/**
 * src/App.jsx
 * Ledgr – personal finance app
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

/* ─── Mobile CSS ─────────────────────────────────────────────────── */
(function injectCSS() {
  if (document.getElementById("ledgr-mobile-css")) return;
  const s = document.createElement("style");
  s.id = "ledgr-mobile-css";
  s.textContent = `
    @media (max-width: 767px) {
      .ledgr-sidebar    { display: none !important; }
      .ledgr-topbar     { padding: 0 16px !important; height: 52px !important; }
      .ledgr-content    { padding: 16px !important; padding-bottom: 80px !important; }
      .ledgr-bottomnav  {
        display: flex !important;
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
        background: var(--surface); border-top: 1px solid var(--border);
        height: 64px; align-items: center; justify-content: space-around;
      }
      .ledgr-bottomnav-item {
        display: flex; flex-direction: column; align-items: center; gap: 3px;
        flex: 1; padding: 8px 4px; cursor: pointer;
        font-size: 10px; color: var(--t3); font-family: var(--font-disp);
        font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
        border: none; background: none; transition: color 0.15s;
      }
      .ledgr-bottomnav-item.active { color: var(--cyan); }
      .ledgr-bottomnav-item .nav-icon { font-size: 20px; line-height: 1; }
      .ledgr-stat-grid   { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
      .ledgr-dash-grid   { grid-template-columns: 1fr !important; gap: 14px !important; }
      .ledgr-budget-grid { grid-template-columns: 1fr !important; }
      .ledgr-acct-grid   { grid-template-columns: 1fr !important; }
      .ledgr-monthbar    { flex-direction: column !important; gap: 10px !important; align-items: flex-start !important; }
      .ledgr-monthbar-meta { flex-wrap: wrap !important; gap: 10px !important; }
      .ledgr-filter-row  { flex-direction: column !important; }
      .ledgr-filter-row > * { width: 100% !important; }
      .ledgr-section-hdr { flex-wrap: wrap; gap: 8px; }
      .ledgr-txn-actions { flex-wrap: wrap !important; gap: 6px !important; }
    }
    @media (min-width: 768px) {
      .ledgr-bottomnav { display: none !important; }
    }
  `;
  document.head.appendChild(s);
})();

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = {
  shell:        { display:"flex", height:"100vh", overflow:"hidden", fontFamily:"var(--font-body)", color:"var(--t1)", background:"var(--bg)" },
  sidebar:      { width:220, flexShrink:0, background:"var(--surface)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column" },
  sidebarLogo:  { padding:"28px 24px 20px", fontFamily:"var(--font-disp)", fontSize:18, fontWeight:800, letterSpacing:"-0.5px", borderBottom:"1px solid var(--border)" },
  nav:          { flex:1, padding:"16px 12px", display:"flex", flexDirection:"column", gap:4 },
  navItem:      (active) => ({
    display:"flex", alignItems:"center", gap:12, padding:"10px 12px",
    borderRadius:"var(--radius)", fontSize:14, fontWeight:500,
    color: active ? "var(--cyan)" : "var(--t2)",
    background: active ? "var(--cyan-dim)" : "transparent",
    border: `1px solid ${active ? "#00d4ff33" : "transparent"}`,
    cursor:"pointer", transition:"all 0.15s", userSelect:"none",
  }),
  footer:       { padding:"16px 12px", borderTop:"1px solid var(--border)" },
  main:         { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  topbar:       { height:60, flexShrink:0, borderBottom:"1px solid var(--border)", background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px" },
  content:      { flex:1, overflowY:"auto", padding:28 },
  card:         { background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:20 },
  cardTitle:    { fontFamily:"var(--font-disp)", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"1.5px", color:"var(--t3)", marginBottom:16 },
  grid2:        { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  grid4:        { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 },
  stat:         { background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"20px 22px" },
  statLabel:    { fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 },
  statValue:    { fontFamily:"var(--font-mono)", fontSize:26, fontWeight:600 },
  statSub:      { fontSize:12, color:"var(--t2)", marginTop:4 },
  btn: (variant="ghost", sm=false) => {
    const base = { display:"inline-flex", alignItems:"center", gap:7, padding:sm?"6px 12px":"9px 16px", borderRadius:"var(--radius)", fontSize:sm?12:13, fontWeight:500, cursor:"pointer", border:"1px solid transparent", transition:"all 0.15s", userSelect:"none" };
    if (variant==="primary") return { ...base, background:"var(--cyan)", color:"#000", borderColor:"var(--cyan)" };
    if (variant==="danger")  return { ...base, background:"var(--red-dim)", color:"var(--red)", borderColor:"#ff4d6d44" };
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
  toast:        { position:"fixed", bottom:24, right:24, zIndex:999, background:"var(--card)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"12px 18px", fontSize:13, color:"var(--t1)", boxShadow:"0 8px 32px #00000060" },
  monthBar:     { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"10px 16px", display:"flex", alignItems:"center", gap:16, fontSize:12, color:"var(--t2)", marginBottom:20, flexWrap:"wrap" },
  sectionHdr:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 },
  sectionTitle: { fontFamily:"var(--font-disp)", fontSize:16, fontWeight:700, letterSpacing:"-0.2px" },
  tableWrap:    { overflowX:"auto" },
  th:           { fontSize:10, textTransform:"uppercase", letterSpacing:"1.2px", color:"var(--t3)", fontWeight:700, padding:"14px 12px", textAlign:"left", whiteSpace:"nowrap", fontFamily:"var(--font-disp)", borderBottom:"1px solid var(--border)" },
  td:           { padding:"12px 12px", fontSize:13, color:"var(--t2)", borderBottom:"1px solid var(--border)", verticalAlign:"middle" },
  filterRow:    { display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" },
};

/* ─── Constants ─────────────────────────────────────────────────── */
const CAT_COLORS = ["#00d4ff","#00e676","#ff4d6d","#fbbf24","#a78bfa","#f97316","#06b6d4","#84cc16","#ec4899","#14b8a6","#8b5cf6","#ef4444","#22c55e","#3b82f6","#f59e0b"];
const today       = new Date();
const pad         = n => String(n).padStart(2,"0");
const fmt         = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const currentMonth = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
function daysInMonth(y,m) { return new Date(y,m,0).getDate(); }
function daysLeft()       { return daysInMonth(today.getFullYear(), today.getMonth()+1) - today.getDate(); }

/* ─── Sub-components ─────────────────────────────────────────────── */

function ProgressBar({ cat, spent }) {
  const pct  = Math.min((spent/cat.limit)*100, 100);
  const over = pct >= 100, warn = pct >= 80 && !over;
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:500,color:"var(--t1)"}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
          {cat.name}
        </div>
        <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t2)"}}>
          {fmt(spent)} / {fmt(cat.limit)}
          <span style={{marginLeft:8,color:cat.limit-spent>=0?"var(--green)":"var(--red)"}}>
            {cat.limit-spent>=0?`+${fmt(cat.limit-spent)}`:fmt(cat.limit-spent)}
          </span>
        </div>
      </div>
      <div style={{height:6,background:"var(--border)",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:99,width:`${pct}%`,transition:"width 0.6s cubic-bezier(.4,0,.2,1)",
          background:over?"var(--red)":warn?"var(--amber)":cat.color}}/>
      </div>
    </div>
  );
}

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

function Toast({ msg }) {
  return msg ? <div style={S.toast}>✓ {msg}</div> : null;
}

function PlaidButton({ onSuccess, onExit, label="Connect a Bank" }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const fetchToken = useCallback(async () => {
    setLoading(true); setError(null);
    try { const { link_token } = await api.createLinkToken(); setLinkToken(link_token); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (pt, meta) => onSuccess(pt, meta?.institution?.name),
    onExit,
  });

  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);

  return (
    <div>
      <button style={S.btn("primary")} onClick={fetchToken} disabled={loading}>
        {loading ? "…" : "🏦 " + label}
      </button>
      {error && <div style={{marginTop:8,fontSize:12,color:"var(--red)"}}>{error}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const isMobile = useIsMobile();

  /* ── All state at top level — never inside JSX ── */
  const [view,          setView]          = useState("dashboard");
  const [accounts,      setAccounts]      = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [transactions,  setTransactions]  = useState([]);
  const [plaidItems,    setPlaidItems]    = useState([]);
  const [rules,         setRules]         = useState([]);
  const [loading,       setLoading]       = useState(true);

  const [modal,         setModal]         = useState(null);
  const [editTarget,    setEditTarget]    = useState(null);
  const [toast,         setToast]         = useState("");
  const [syncing,       setSyncing]       = useState(false);
  const [rulePrompt,    setRulePrompt]    = useState(null);
  const [drillCat,      setDrillCat]      = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [search,        setSearch]        = useState("");
  const [filterCat,     setFilterCat]     = useState("all");
  const [filterAcct,    setFilterAcct]    = useState("all");
  const [editingId,     setEditingId]     = useState(null);
  const [editingName,   setEditingName]   = useState("");

  const [catForm,  setCatForm]  = useState({ name:"", limit:"", color:CAT_COLORS[0] });
  const [acctForm, setAcctForm] = useState({ name:"", balance:"", type:"Checking" });
  const [txnForm,  setTxnForm]  = useState({ merchant:"", amount:"", date:"", categoryId:"", accountId:"", sign:"-1" });
  const [ruleForm, setRuleForm] = useState({ pattern:"", matchType:"contains", categoryId:"", enabled:true });

/* ── Load from backend ── */
  useEffect(() => {
    (async () => {
      try {
        const data = await api.loadData();
        setAccounts(data.accounts         || []);
        setCategories(data.categories     || []);
        setTransactions(data.transactions || []);
        setPlaidItems(data.plaidItems     || []);
        setRules(data.rules               || []);
      } catch (e) { console.warn("Could not load data:", e.message); }
      finally {
        setLoading(false);
        initialized.current = true;
      }
    })();
  }, []);

  /* ── Auto-save to backend ── */
const saveTimeout  = useRef(null);
const initialized  = useRef(false);

function scheduleSave(patch) {
  if (!initialized.current) return;
  clearTimeout(saveTimeout.current);
  saveTimeout.current = setTimeout(() => api.saveData(patch), 800);
}

useEffect(() => { scheduleSave({ accounts });     }, [accounts]);
useEffect(() => { scheduleSave({ categories });   }, [categories]);
useEffect(() => { scheduleSave({ transactions }); }, [transactions]);
useEffect(() => { scheduleSave({ plaidItems });   }, [plaidItems]);
useEffect(() => { scheduleSave({ rules });        }, [rules]);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2800); };

  /* ── Computed ── */
  const monthTxns = useMemo(() =>
    transactions.filter(t => t.date?.startsWith(selectedMonth)),
  [transactions, selectedMonth]);

  const isCurrentMonth = selectedMonth === currentMonth;

  const catTxns = useMemo(() =>
    drillCat
      ? monthTxns.filter(t => t.categoryId===drillCat.id && t.amount<0)
                 .sort((a,b) => b.date.localeCompare(a.date))
      : [],
  [drillCat, monthTxns]);

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
  const totalIncome = monthTxns.filter(t=>t.amount>0).reduce((a,t)=>a+t.amount,0);

  const catMap  = useMemo(()=>Object.fromEntries(categories.map(c=>[c.id,c])), [categories]);
  const acctMap = useMemo(()=>Object.fromEntries(accounts.map(a=>[a.id,a])),   [accounts]);

  const filteredTxns = useMemo(() =>
    transactions.filter(t => {
      const label = (t.name||t.merchant||"").toLowerCase();
      if (search && !label.includes(search.toLowerCase())) return false;
      if (filterCat  !== "all" && t.categoryId !== filterCat)  return false;
      if (filterAcct !== "all" && t.accountId  !== filterAcct) return false;
      return true;
    }).sort((a,b) => b.date?.localeCompare(a.date)),
  [transactions, search, filterCat, filterAcct]);

  function prevMonth() {
    const [y,m] = selectedMonth.split("-").map(Number);
    const d = new Date(y,m-2,1);
    setSelectedMonth(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
  }
  function nextMonth() {
    const [y,m] = selectedMonth.split("-").map(Number);
    const d = new Date(y,m,1);
    const next = `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    if (next <= currentMonth) setSelectedMonth(next);
  }
  function monthLabel(ym) {
    const [y,m] = ym.split("-").map(Number);
    return new Date(y,m-1,1).toLocaleString("default",{month:"long",year:"numeric"});
  }

  /* ── Rules engine ── */
  function applyRules(txns, currentRules) {
    if (!currentRules?.length) return txns;
    return txns.map(t => {
      const merchant = (t.merchant||t.name||"").toLowerCase().trim();
      for (const rule of currentRules) {
        if (!rule.enabled) continue;
        const pattern = rule.pattern.toLowerCase().trim();
        if (!pattern) continue;
        const match =
          rule.matchType==="exact"  ? merchant===pattern :
          rule.matchType==="starts" ? merchant.startsWith(pattern) :
          merchant.includes(pattern);
        if (match) return { ...t, categoryId: rule.categoryId||t.categoryId };
      }
      return t;
    });
  }

  function promptSaveRule(txn, categoryId) {
    const merchant = (txn.merchant||txn.name||"").toLowerCase().trim();
    const exists = rules.some(r=>r.pattern.toLowerCase().trim()===merchant);
    if (!exists && merchant && categoryId) setRulePrompt({ txnId:txn.id, merchant:txn.merchant||txn.name, categoryId });
  }

  function confirmSaveRule() {
    if (!rulePrompt) return;
    setRules(p=>[...p,{ id:"r"+Date.now(), pattern:rulePrompt.merchant, matchType:"contains", categoryId:rulePrompt.categoryId, enabled:true, createdAt:Date.now() }]);
    setRulePrompt(null);
    showToast("Rule saved — applies on next sync");
  }

  function saveRule(rule)  { setRules(p=>[...p.filter(r=>r.id!==rule.id),rule]); showToast("Rule saved"); }
  function deleteRule(id)  { setRules(p=>p.filter(r=>r.id!==id)); showToast("Rule deleted"); }
  function toggleRule(id)  { setRules(p=>p.map(r=>r.id===id?{...r,enabled:!r.enabled}:r)); }

  /* ── Plaid ── */
  const handlePlaidSuccess = useCallback(async (publicToken, institutionName) => {
    try {
      const { item_id } = await api.exchangePublicToken(publicToken, institutionName);
      setPlaidItems(p=>[...p.filter(i=>i.item_id!==item_id),{ item_id, institution:institutionName }]);
      showToast(`${institutionName} connected! Syncing…`);
      await doSync(item_id);
    } catch (e) { showToast("Connection failed: "+e.message); }
  }, []);

  async function doSync(itemId) {
    setSyncing(true);
    try {
      const { added, modified, removed } = await api.syncTransactions(itemId);
      setTransactions(prev => {
        let next = [...prev];
        const removeIds = new Set(removed.map(r=>r.transaction_id));
        next = next.filter(t=>!removeIds.has(t.id));
        const modMap = Object.fromEntries(modified.map(t=>[t.transaction_id,t]));
        next = next.map(t=>modMap[t.id]?plaidTxnToLocal(modMap[t.id],catMap):t);
        const existingIds = new Set(next.map(t=>t.id));
        const rawNew = added.filter(t=>!existingIds.has(t.transaction_id)).map(t=>plaidTxnToLocal(t,catMap));
        return [...applyRules(rawNew,rules), ...next];
      });
      const { accounts: plaidAccts } = await api.getAccounts();
      setAccounts(prev => {
        const byId = Object.fromEntries(prev.map(a=>[a.plaidId,a]));
        return plaidAccts.map(pa=>({
          id: byId[pa.account_id]?.id||"a"+pa.account_id,
          plaidId: pa.account_id,
          name: byId[pa.account_id]?.name||pa.name,
          balance: pa.balance, available: pa.available,
          type: capitalise(pa.subtype||pa.type),
          institution: pa.institution,
        }));
      });
      setTransactions(prev => {
        const map = {};
        plaidAccts.forEach(pa=>{ map[pa.account_id]="a"+pa.account_id; });
        return prev.map(t=>t.plaidAccountId?{...t,accountId:map[t.plaidAccountId]||t.accountId}:t);
      });
      showToast(`Synced: +${added.length} transactions`);
    } catch (e) { showToast("Sync error: "+e.message); }
    finally { setSyncing(false); }
  }

  function plaidTxnToLocal(t, cm) {
    const plaidCat = (t.category||"").toLowerCase();
    const matched  = Object.values(cm).find(c=>plaidCat.includes(c.name.toLowerCase().split(" ")[0]));
    return {
      id:t.transaction_id, plaidAccountId:t.account_id, accountId:"a"+t.account_id,
      date:t.date||t.authorized_date, merchant:t.merchant_name||t.name, name:"",
      amount:t.amount, categoryId:matched?.id||null, pending:t.pending,
    };
  }

  async function disconnectItem(itemId) {
    try { await api.deleteItem(itemId); setPlaidItems(p=>p.filter(i=>i.item_id!==itemId)); showToast("Account disconnected"); }
    catch (e) { showToast("Error: "+e.message); }
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
    setCategories(p=>p.filter(c=>c.id!==id));
    setTransactions(p=>p.map(t=>t.categoryId===id?{...t,categoryId:null}:t));
    showToast("Category removed");
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
  function deleteAcct(id) { setAccounts(p=>p.filter(a=>a.id!==id)); showToast("Account removed"); }

  /* ── Transaction CRUD ── */
  function startRename(t) { setEditingId(t.id); setEditingName(t.name||t.merchant); }
  function saveRename(id) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,name:editingName.trim()||t.merchant}:t));
    setEditingId(null); showToast("Name updated");
  }
  function updateTxnCat(id, val) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,categoryId:val||null}:t));
    if (val) { const txn=transactions.find(t=>t.id===id); if (txn) promptSaveRule(txn,val); }
  }
  function updateTxnAcct(id, val) { setTransactions(p=>p.map(t=>t.id===id?{...t,accountId:val||null}:t)); }
  function deleteTxn(id) { setTransactions(p=>p.filter(t=>t.id!==id)); showToast("Deleted"); }

  function openAddTxn() {
    setTxnForm({merchant:"",amount:"",date:today.toISOString().slice(0,10),categoryId:"",accountId:"",sign:"-1"});
    setModal("addTxn");
  }
  function saveManualTxn() {
    if (!txnForm.merchant.trim()||!txnForm.amount) return;
    setTransactions(p=>[{ id:"m"+Date.now(), date:txnForm.date, merchant:txnForm.merchant.trim(), name:"",
      amount:parseFloat(txnForm.amount)*parseInt(txnForm.sign), categoryId:txnForm.categoryId||null, accountId:txnForm.accountId||null },...p]);
    setModal(null); showToast("Transaction added");
  }

  /* ─────────────────────────────────────────────────────────────────
     SCREENS
  ───────────────────────────────────────────────────────────────── */

  /* ── Dashboard ── */
  const Dashboard = (
    <div>
      <div className="ledgr-monthbar" style={{...S.monthBar,justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={prevMonth} style={{background:"none",border:"1px solid var(--border2)",borderRadius:6,color:"var(--t2)",cursor:"pointer",padding:"4px 12px",fontSize:18,lineHeight:1.4}}>‹</button>
          <span style={{fontFamily:"var(--font-disp)",fontWeight:700,fontSize:15,color:"var(--t1)",minWidth:isMobile?100:180,textAlign:"center"}}>
            📅 {monthLabel(selectedMonth)}
            {isCurrentMonth&&<span style={{marginLeft:6,fontSize:10,color:"var(--cyan)",fontWeight:500,fontFamily:"var(--font-body)"}}>current</span>}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth} style={{background:"none",border:"1px solid var(--border2)",borderRadius:6,color:isCurrentMonth?"var(--border2)":"var(--t2)",cursor:isCurrentMonth?"default":"pointer",padding:"4px 12px",fontSize:18,lineHeight:1.4}}>›</button>
        </div>
        <div className="ledgr-monthbar-meta" style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:12,color:"var(--t2)"}}>
          {isCurrentMonth&&<span><span style={{fontFamily:"var(--font-mono)",color:"var(--t1)"}}>{daysLeft()}</span> days left</span>}
          <span>Spent: <span style={{fontFamily:"var(--font-mono)",color:"var(--t1)"}}>{fmt(totalSpent)}</span></span>
          <span>Income: <span style={{fontFamily:"var(--font-mono)",color:"var(--green)"}}>{fmt(totalIncome)}</span></span>
          <span>Net: <span style={{fontFamily:"var(--font-mono)",color:totalIncome-totalSpent>=0?"var(--green)":"var(--red)"}}>{fmt(totalIncome-totalSpent)}</span></span>
        </div>
      </div>

      <div className="ledgr-stat-grid" style={{...S.grid4,marginBottom:20}}>
        {[
          { label:"Budget",       value:fmt(totalBudget), sub:`${categories.length} categories`,          color:"var(--t1)"    },
          { label:"Spent",        value:fmt(totalSpent),  sub:`${fmt(totalBudget-totalSpent)} left`,       color:"var(--red)"   },
          { label:"Income",       value:fmt(totalIncome), sub:`Net ${fmt(totalIncome-totalSpent)}`,        color:"var(--green)" },
          { label:"Transactions", value:monthTxns.length, sub:monthLabel(selectedMonth),                  color:"var(--t1)"    },
        ].map(s=>(
          <div key={s.label} style={S.stat}>
            <div style={S.statLabel}>{s.label}</div>
            <div style={{...S.statValue,color:s.color,fontSize:isMobile?18:26}}>{s.value}</div>
            <div style={{...S.statSub,fontSize:isMobile?10:12}}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="ledgr-dash-grid" style={{...S.grid2,gap:16}}>
        <div style={S.card}>
          <div style={S.cardTitle}>Budget Progress</div>
          {categories.length===0
            ? <div style={{textAlign:"center",padding:"32px 0",color:"var(--t3)"}}>No categories yet</div>
            : categories.map(cat=><ProgressBar key={cat.id} cat={cat} spent={spentByCat[cat.id]||0}/>)
          }
        </div>
        <div style={S.card}>
          <div style={{...S.sectionHdr,marginBottom:12}}>
            <div style={S.cardTitle}>Recent Transactions</div>
            <button style={S.btn("ghost",true)} onClick={()=>setView("transactions")}>All →</button>
          </div>
          {filteredTxns.slice(0,9).map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:10,marginBottom:10,borderBottom:"1px solid var(--border)"}}>
              <div style={{flex:1,minWidth:0,marginRight:10}}>
                <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
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
    </div>
  );

  /* ── Transactions ── */
  const Transactions = (
    <div>
      <div className="ledgr-section-hdr" style={{...S.sectionHdr,marginBottom:16}}>
        <div style={S.sectionTitle}>Transactions</div>
        <div className="ledgr-txn-actions" style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {syncing&&<span style={{fontSize:12,color:"var(--cyan)"}}>⟳ Syncing…</span>}
          <PlaidButton onSuccess={handlePlaidSuccess} onExit={()=>{}} label="Add Bank"/>
          {plaidItems.length>0&&<button style={S.btn("ghost",true)} onClick={()=>doSync()} disabled={syncing}>⟳ Sync</button>}
          <button style={S.btn("primary",true)} onClick={openAddTxn}>+ Add</button>
        </div>
      </div>

      <div className="ledgr-filter-row" style={S.filterRow}>
        <div style={{position:"relative",flex:1,minWidth:160}}>
          <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"var(--t3)",fontSize:14}}>🔍</span>
          <input style={{...S.input,paddingLeft:36}} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select style={{...S.select,width:isMobile?"100%":160,padding:"9px 10px"}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">Uncategorized</option>
        </select>
        <select style={{...S.select,width:isMobile?"100%":160,padding:"9px 10px"}} value={filterAcct} onChange={e=>setFilterAcct(e.target.value)}>
          <option value="all">All Accounts</option>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filteredTxns.length===0&&<div style={{...S.card,textAlign:"center",padding:48,color:"var(--t3)"}}>
            <div style={{fontSize:28,marginBottom:10,opacity:0.3}}>⇅</div>No transactions found
          </div>}
          {filteredTxns.map(t=>(
            <div key={t.id} style={{...S.card,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{flex:1,minWidth:0,marginRight:10}}>
                  {editingId===t.id ? (
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <input style={{background:"var(--surface)",border:"1px solid var(--cyan)",borderRadius:6,padding:"4px 8px",fontSize:13,color:"var(--t1)",outline:"none",flex:1}}
                        value={editingName} onChange={e=>setEditingName(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")saveRename(t.id);if(e.key==="Escape")setEditingId(null);}} autoFocus/>
                      <button style={S.btn("primary",true)} onClick={()=>saveRename(t.id)}>✓</button>
                    </div>
                  ) : (
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:14,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</span>
                      <button onClick={()=>startRename(t)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:12,padding:"2px",flexShrink:0}}>✏</button>
                    </div>
                  )}
                  <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>
                    {t.date}{t.pending&&<span style={{marginLeft:6,color:"var(--amber)"}}>pending</span>}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:700,color:t.amount<0?"var(--red)":"var(--green)"}}>
                    {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
                  </span>
                  <button onClick={()=>deleteTxn(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:13}}>🗑</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <select style={{...S.select,width:"100%",padding:"8px 10px",fontSize:12}} value={t.categoryId||""} onChange={e=>updateTxnCat(t.id,e.target.value)}>
                  <option value="">— Category —</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select style={{...S.select,width:"100%",padding:"8px 10px",fontSize:12}} value={t.accountId||""} onChange={e=>updateTxnAcct(t.id,e.target.value)}>
                  <option value="">— Account —</option>
                  {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      ) : (
       <div style={{...S.card,padding:0,overflow:"hidden"}}>
          <div style={{...S.tableWrap,overflowY:"auto",maxHeight:"calc(100vh - 280px)"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={{...S.th,position:"sticky",top:0,background:"var(--card)",zIndex:2}}>Date</th>
                <th style={{...S.th,position:"sticky",top:0,background:"var(--card)",zIndex:2}}>Name / Merchant</th>
                <th style={{...S.th,position:"sticky",top:0,background:"var(--card)",zIndex:2}}>Category</th>
                <th style={{...S.th,position:"sticky",top:0,background:"var(--card)",zIndex:2}}>Account</th>
                <th style={{...S.th,position:"sticky",top:0,background:"var(--card)",zIndex:2,textAlign:"right"}}>Amount</th>
                <th style={{...S.th,position:"sticky",top:0,background:"var(--card)",zIndex:2}}/>
              </tr></thead>
              <tbody>
                {filteredTxns.length===0&&(
                  <tr><td colSpan={6} style={{...S.td,textAlign:"center",padding:"48px 0",color:"var(--t3)"}}>
                    <div style={{fontSize:28,marginBottom:10,opacity:0.3}}>⇅</div>No transactions found
                  </td></tr>
                )}
                {filteredTxns.map(t=>(
                  <tr key={t.id}>
                    <td style={{...S.td,fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",whiteSpace:"nowrap"}}>{t.date}</td>
                    <td style={{...S.td,color:"var(--t1)",fontWeight:500}}>
                      {editingId===t.id ? (
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <input style={{background:"var(--surface)",border:"1px solid var(--cyan)",borderRadius:6,padding:"4px 8px",fontSize:13,color:"var(--t1)",outline:"none",width:170}}
                            value={editingName} onChange={e=>setEditingName(e.target.value)}
                            onKeyDown={e=>{if(e.key==="Enter")saveRename(t.id);if(e.key==="Escape")setEditingId(null);}} autoFocus/>
                          <button style={S.btn("primary",true)} onClick={()=>saveRename(t.id)}>✓</button>
                          <button style={S.btn("ghost",true)} onClick={()=>setEditingId(null)}>✕</button>
                        </div>
                      ) : (
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span>{t.name||t.merchant}</span>
                          {t.name&&<span style={{fontSize:10,color:"var(--t3)"}}>({t.merchant})</span>}
                          {t.pending&&<span style={{fontSize:10,color:"var(--amber)",border:"1px solid var(--amber)44",borderRadius:4,padding:"1px 5px"}}>pending</span>}
                          {t.date&&!t.date.startsWith(selectedMonth)&&<span title={`From ${t.date?.slice(0,7)}`} style={{fontSize:10,color:"var(--t3)",border:"1px solid var(--border2)",borderRadius:4,padding:"1px 5px",cursor:"help"}}>≠ {t.date?.slice(0,7)}</span>}
                          <button onClick={()=>startRename(t)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:11,padding:"2px 4px"}}>✏</button>
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      <select style={{...S.select,width:140}} value={t.categoryId||""} onChange={e=>updateTxnCat(t.id,e.target.value)}>
                        <option value="">— None —</option>
                        {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td style={S.td}>
                      <select style={{...S.select,width:140}} value={t.accountId||""} onChange={e=>updateTxnAcct(t.id,e.target.value)}>
                        <option value="">— None —</option>
                        {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </td>
                    <td style={{...S.td,textAlign:"right",fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:t.amount<0?"var(--red)":"var(--green)"}}>
                      {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
                    </td>
                    <td style={{...S.td,width:36}}>
                      <button onClick={()=>deleteTxn(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:14}}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Budgets ── */
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const spentA = spentByCat[a.id] || 0;
      const spentB = spentByCat[b.id] || 0;
      const remA   = a.limit - spentA;
      const remB   = b.limit - spentB;
      const overA  = remA < 0;
      const overB  = remB < 0;
      const zeroA  = remA === 0;
      const zeroB  = remB === 0;

      // Overspent always first
      if (overA && !overB) return -1;
      if (!overA && overB) return 1;

      // Both overspent — most over first
      if (overA && overB) return remA - remB;

      // Zero remaining next
      if (zeroA && !zeroB) return -1;
      if (!zeroA && zeroB) return 1;

      // Then sort by least remaining
      return remA - remB;
    });
  }, [categories, spentByCat]);

  const Budgets = (
    <div>
      <div style={{...S.sectionHdr,marginBottom:16}}>
        <div style={S.sectionTitle}>Budget Categories</div>
        <button style={S.btn("primary",true)} onClick={openAddCat}>+ New Category</button>
      </div>

      {categories.length===0
        ? <div style={{...S.card,textAlign:"center",padding:48,color:"var(--t3)"}}>No categories yet. Create one to get started.</div>
       : <div style={{...S.card,padding:0,overflow:"hidden"}}>
            {sortedCategories.map((cat,i)=>{
              const spent    = spentByCat[cat.id]||0;
              const pct      = Math.min((spent/cat.limit)*100,100);
              const over     = pct>=100, warn = pct>=80&&!over;
              const barC     = over?"var(--red)":warn?"var(--amber)":cat.color;
              const remaining = cat.limit - spent;
              const txnCount = monthTxns.filter(t=>t.categoryId===cat.id&&t.amount<0).length;
              return (
                <div key={cat.id}
                  onClick={()=>setDrillCat(cat)}
                  style={{padding:"14px 20px",borderBottom:i<sortedCategories.length-1?"1px solid var(--border)":"none",cursor:"pointer",transition:"background 0.12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>

                  {/* Row 1: name + spent + remaining */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <span style={{width:9,height:9,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
                    <span style={{fontFamily:"var(--font-disp)",fontSize:14,fontWeight:700,color:"var(--t1)",flex:1}}>{cat.name}</span>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:13,color:"var(--t2)"}}>{fmt(spent)}</span>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,
                      color:over?"var(--red)":remaining===0?"var(--t3)":"var(--green)",
                      background:over?"var(--red-dim)":remaining===0?"var(--surface)":"var(--green-dim)",
                      border:`1px solid ${over?"var(--red)":remaining===0?"var(--border2)":"var(--green)"}33`,
                      borderRadius:99,padding:"3px 10px",minWidth:70,textAlign:"center"}}>
                      {over?`−${fmt(Math.abs(remaining))}`:fmt(remaining)}
                    </span>
                    <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                      <button style={{...S.btn("ghost",true),padding:"4px 8px",fontSize:11}} onClick={()=>openEditCat(cat)}>Edit</button>
                      <button style={{...S.btn("danger",true),padding:"4px 8px",fontSize:11}} onClick={()=>deleteCat(cat.id)}>✕</button>
                    </div>
                  </div>

                  {/* Row 2: progress bar */}
                  <div style={{height:5,background:"var(--border)",borderRadius:99,overflow:"hidden",marginBottom:6}}>
                    <div style={{height:"100%",borderRadius:99,background:barC,width:`${pct}%`,transition:"width 0.5s ease"}}/>
                  </div>

                  {/* Row 3: status text */}
                  <div style={{fontSize:11,color:"var(--t3)"}}>
                    {over
                      ? <span style={{color:"var(--red)"}}>Overspent. {fmt(spent)} of {fmt(cat.limit)}</span>
                      : remaining===0
                        ? <span>Fully spent. {fmt(spent)} of {fmt(cat.limit)}</span>
                        : <span>{fmt(spent)} of {fmt(cat.limit)} · {txnCount} transaction{txnCount!==1?"s":""}</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
      }

      {/* Category drill-down modal */}
      {drillCat&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setDrillCat(null)}>
          <div style={{...S.modal,width:620,maxHeight:"80vh",display:"flex",flexDirection:"column",padding:24}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{width:12,height:12,borderRadius:"50%",background:drillCat.color,display:"inline-block",flexShrink:0}}/>
                <div style={S.modalTitle}>{drillCat.name}</div>
              </div>
              <button onClick={()=>setDrillCat(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:20,lineHeight:1,padding:"4px 8px"}}>✕</button>
            </div>

            <div style={{display:"flex",gap:10,marginBottom:14,flexShrink:0,flexWrap:"wrap"}}>
              {[
                { label:"Spent",        value:fmt(spentByCat[drillCat.id]||0), color:drillCat.color },
                { label:"Budget",       value:fmt(drillCat.limit),             color:"var(--t2)"    },
                { label:"Remaining",    value:fmt(drillCat.limit-(spentByCat[drillCat.id]||0)), color:(spentByCat[drillCat.id]||0)<=drillCat.limit?"var(--green)":"var(--red)" },
                { label:"Transactions", value:catTxns.length,                  color:"var(--t1)"    },
              ].map(s=>(
                <div key={s.label} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"10px 14px",flex:1,minWidth:80}}>
                  <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>{s.label}</div>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:600,color:s.color}}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{marginBottom:14,flexShrink:0}}>
              <div style={{height:6,background:"var(--border)",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:99,
                  background:(spentByCat[drillCat.id]||0)>=drillCat.limit?"var(--red)":(spentByCat[drillCat.id]||0)/drillCat.limit>=0.8?"var(--amber)":drillCat.color,
                  width:`${Math.min(((spentByCat[drillCat.id]||0)/drillCat.limit)*100,100)}%`,transition:"width 0.5s ease"}}/>
              </div>
            </div>

            <div style={{overflowY:"auto",flex:1}}>
              {catTxns.length===0 ? (
                <div style={{textAlign:"center",padding:"40px 0",color:"var(--t3)"}}>
                  <div style={{fontSize:24,marginBottom:8,opacity:0.3}}>◉</div>
                  No transactions in {monthLabel(selectedMonth)}
                </div>
              ) : (
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    <th style={{...S.th,padding:"0 10px 10px"}}>Date</th>
                    <th style={{...S.th,padding:"0 10px 10px"}}>Merchant</th>
                    <th style={{...S.th,padding:"0 10px 10px"}}>Move to</th>
                    <th style={{...S.th,padding:"0 10px 10px",textAlign:"right"}}>Amount</th>
                  </tr></thead>
                  <tbody>
                    {catTxns.map(t=>(
                      <tr key={t.id}>
                        <td style={{...S.td,fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",whiteSpace:"nowrap",padding:"10px 10px"}}>{t.date}</td>
                        <td style={{...S.td,color:"var(--t1)",fontWeight:500,padding:"10px 10px"}}>
                          <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{t.name||t.merchant}</div>
                        </td>
                        <td style={{...S.td,padding:"10px 10px"}}>
                          <select style={{...S.select,width:"100%",fontSize:11,padding:"5px 8px"}}
                            value={t.categoryId||""}
                            onChange={e=>{ updateTxnCat(t.id,e.target.value); if(e.target.value!==drillCat.id) showToast("Transaction moved"); }}>
                            {categories.map(c=>(
                              <option key={c.id} value={c.id}>{c.id===drillCat.id?"✓ ":""}{c.name}</option>
                            ))}
                            <option value="">— Uncategorized —</option>
                          </select>
                        </td>
                        <td style={{...S.td,textAlign:"right",fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:"var(--red)",padding:"10px 10px"}}>
                          {fmt(Math.abs(t.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",flexShrink:0}}>
              <button style={S.btn("ghost")} onClick={()=>setDrillCat(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Accounts ── */
  const Accounts = (
    <div>
      <div style={{...S.sectionHdr,marginBottom:8}}>
        <div style={S.sectionTitle}>Accounts</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <PlaidButton onSuccess={handlePlaidSuccess} onExit={()=>{}} label="Link Bank"/>
          <button style={S.btn("ghost",true)} onClick={openAddAcct}>+ Manual</button>
        </div>
      </div>
      <div style={{fontSize:13,color:"var(--t2)",marginBottom:16}}>
        Projections show estimated spend needed through end of {today.toLocaleString("default",{month:"long"})} based on your daily rate.
      </div>

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
        : <div className="ledgr-acct-grid" style={S.grid2}>
            {accounts.map(acct=>{
              const spent    = spentByAcct[acct.id]||0;
              const income   = monthTxns.filter(t=>t.amount>0&&t.accountId===acct.id).reduce((a,t)=>a+t.amount,0);
              const daysGone = today.getDate();
              const daily    = daysGone>0?spent/daysGone:0;
              const needed   = daily*daysLeft();
              const tight    = needed>acct.balance;
              const typeIcon = acct.type==="Credit"?"💳":acct.type==="Savings"?"🏦":"🏧";
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
                      <button style={S.btn("danger",true)} onClick={()=>deleteAcct(acct.id)}>✕</button>
                    </div>
                  </div>
                  <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)"}}>
                    {[
                      ["Spent this month",    fmt(spent),         "var(--t1)"   ],
                      ["Income this month",   fmt(income),        "var(--green)"],
                      ["Daily avg spend",     `${fmt(daily)}/day`,"var(--t1)"   ],
                      ["Projected month end", fmt(daily*daysInMonth(today.getFullYear(),today.getMonth()+1)), "var(--t1)"],
                    ].map(([label,value,color])=>(
                      <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--t2)",marginBottom:6}}>
                        <span>{label}</span><span style={{fontFamily:"var(--font-mono)",color}}>{value}</span>
                      </div>
                    ))}
                    <div style={{marginTop:10,padding:"10px 12px",borderRadius:8,background:tight?"var(--red-dim)":"var(--green-dim)",border:`1px solid ${tight?"var(--red)":"var(--green)"}33`}}>
                      <div style={{fontSize:11,color:"var(--t3)",marginBottom:3}}>Est. needed · {daysLeft()} days left</div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:isMobile?18:20,fontWeight:700,color:tight?"var(--red)":"var(--green)"}}>{fmt(needed)}</div>
                      <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>
                        {tight?`⚠ May fall short by ${fmt(needed-acct.balance)}`:`Comfortable — ${fmt(acct.balance-needed)} cushion`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );

  /* ── Rules ── */
  const Rules = (
    <div>
      <div style={{...S.sectionHdr,marginBottom:8}}>
        <div style={S.sectionTitle}>Auto-Categorization Rules</div>
        <button style={S.btn("primary",true)} onClick={()=>{ setRuleForm({pattern:"",matchType:"contains",categoryId:"",enabled:true}); setModal("addRule"); }}>+ New Rule</button>
      </div>
      <p style={{fontSize:13,color:"var(--t2)",marginBottom:20,lineHeight:1.6}}>
        Rules automatically assign categories to new transactions when they sync. When you categorize a transaction manually, you'll be prompted to save it as a rule.
      </p>

      {rules.length===0 ? (
        <div style={{...S.card,textAlign:"center",padding:48}}>
          <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◎</div>
          <div style={{fontSize:14,fontWeight:600,color:"var(--t1)",marginBottom:6}}>No rules yet</div>
          <div style={{fontSize:13,color:"var(--t3)"}}>Assign a category to any transaction and you'll be prompted to save it as a rule.</div>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {rules.map(rule=>{
            const cat=catMap[rule.categoryId];
            return (
              <div key={rule.id} style={{...S.card,padding:"16px 20px",opacity:rule.enabled?1:0.5,borderLeft:`3px solid ${cat?.color||"var(--border2)"}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:13,color:"var(--cyan)",background:"var(--cyan-dim)",padding:"2px 10px",borderRadius:6}}>
                        {rule.matchType==="exact"?"=":rule.matchType==="starts"?"starts:":"~"} {rule.pattern}
                      </span>
                      <span style={{fontSize:13,color:"var(--t3)"}}>→</span>
                      {cat?<span style={S.badge(cat.color)}>{cat.name}</span>:<span style={{fontSize:12,color:"var(--t3)"}}>Unknown category</span>}
                    </div>
                    <div style={{fontSize:11,color:"var(--t3)"}}>
                      Match: <strong style={{color:"var(--t2)"}}>{rule.matchType}</strong>
                      {rule.createdAt&&` · Created ${new Date(rule.createdAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                    <button onClick={()=>toggleRule(rule.id)} style={{...S.btn("ghost",true),color:rule.enabled?"var(--green)":"var(--t3)",borderColor:rule.enabled?"var(--green)44":"var(--border2)"}}>
                      {rule.enabled?"✓ On":"Off"}
                    </button>
                    <button style={S.btn("ghost",true)} onClick={()=>{ setRuleForm({pattern:rule.pattern,matchType:rule.matchType,categoryId:rule.categoryId,enabled:rule.enabled}); setEditTarget(rule); setModal("editRule"); }}>Edit</button>
                    <button style={S.btn("danger",true)} onClick={()=>deleteRule(rule.id)}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{marginTop:24,padding:"16px 20px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-lg)"}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:10}}>Match Types</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,fontSize:13,color:"var(--t2)"}}>
          <div><span style={{fontFamily:"var(--font-mono)",color:"var(--cyan)",marginRight:8}}>contains</span>Merchant includes the text anywhere. "whole" matches "Whole Foods".</div>
          <div><span style={{fontFamily:"var(--font-mono)",color:"var(--cyan)",marginRight:8}}>starts</span>Merchant begins with the text. "amazon" matches "Amazon Prime".</div>
          <div><span style={{fontFamily:"var(--font-mono)",color:"var(--cyan)",marginRight:8}}>exact</span>Full name must match exactly. Best for unique names like "Netflix".</div>
        </div>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────
     MODALS
  ───────────────────────────────────────────────────────────────── */

  const RuleModal = (
    <Modal title={modal==="addRule"?"New Rule":"Edit Rule"} onClose={()=>setModal(null)}
      actions={<>
        <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button>
        <button style={S.btn("primary")} onClick={()=>{
          if (!ruleForm.pattern.trim()||!ruleForm.categoryId) return;
          const rule={ id:modal==="editRule"?editTarget.id:"r"+Date.now(), ...ruleForm, pattern:ruleForm.pattern.trim(), createdAt:modal==="editRule"?editTarget.createdAt:Date.now() };
          saveRule(rule); setModal(null);
        }}>Save</button>
      </>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={S.field}>
          <label style={S.label}>Merchant Pattern</label>
          <input style={S.input} placeholder='e.g. "Netflix" or "whole foods"' value={ruleForm.pattern} onChange={e=>setRuleForm(p=>({...p,pattern:e.target.value}))}/>
          <div style={{fontSize:11,color:"var(--t3)",marginTop:4}}>Case-insensitive. Matched against the merchant name.</div>
        </div>
        <div style={S.field}>
          <label style={S.label}>Match Type</label>
          <select style={{...S.input,padding:"9px 12px"}} value={ruleForm.matchType} onChange={e=>setRuleForm(p=>({...p,matchType:e.target.value}))}>
            <option value="contains">Contains — includes this text anywhere</option>
            <option value="starts">Starts with — begins with this text</option>
            <option value="exact">Exact — full merchant name must match</option>
          </select>
        </div>
        <div style={S.field}>
          <label style={S.label}>Assign Category</label>
          <select style={{...S.input,padding:"9px 12px"}} value={ruleForm.categoryId} onChange={e=>setRuleForm(p=>({...p,categoryId:e.target.value}))}>
            <option value="">— Select a category —</option>
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
        <div style={S.field}><label style={S.label}>Current Balance ($)</label><input style={S.input} type="number" placeholder="0.00" value={acctForm.balance} onChange={e=>setAcctForm(p=>({...p,balance:e.target.value}))}/></div>
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

  const NAV = [
    { id:"dashboard",    icon:"◈", label:"Dashboard"    },
    { id:"transactions", icon:"⇅", label:"Transactions" },
    { id:"budgets",      icon:"◉", label:"Budgets"      },
    { id:"accounts",     icon:"▣", label:"Accounts"     },
    { id:"rules",        icon:"◎", label:"Rules"        },
  ];
  const VIEWS = { dashboard:Dashboard, transactions:Transactions, budgets:Budgets, accounts:Accounts, rules:Rules };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"var(--font-disp)",fontSize:28,fontWeight:800,color:"var(--t1)"}}>ledgr<span style={{color:"var(--cyan)"}}>.</span></div>
      <div style={{fontSize:13,color:"var(--t3)"}}>Loading your data…</div>
    </div>
  );

  return (
    <div style={S.shell}>
      <aside className="ledgr-sidebar" style={S.sidebar}>
        <div style={S.sidebarLogo}>ledgr<span style={{color:"var(--cyan)"}}>.</span></div>
        <nav style={S.nav}>
          {NAV.map(n=>(
            <div key={n.id} style={S.navItem(view===n.id)} onClick={()=>setView(n.id)}>
              <span style={{width:18,textAlign:"center"}}>{n.icon}</span>
              <span>{n.label}</span>
            </div>
          ))}
        </nav>
        <div style={S.footer}>
          <button style={{...S.btn("ghost"),width:"100%",fontSize:11,justifyContent:"center"}} onClick={()=>doSync()} disabled={syncing}>
            {syncing?"Syncing…":"⟳ Sync All"}
          </button>
        </div>
      </aside>

      <div style={S.main}>
        <div className="ledgr-topbar" style={S.topbar}>
          <div style={{fontFamily:"var(--font-disp)",fontSize:16,fontWeight:700,letterSpacing:"-0.3px"}}>
            ledgr<span style={{color:"var(--cyan)"}}>.</span>
            {!isMobile&&<span style={{marginLeft:12,fontSize:13,fontWeight:500,color:"var(--t3)"}}>{NAV.find(n=>n.id===view)?.label}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {isMobile&&syncing&&<span style={{fontSize:12,color:"var(--cyan)"}}>⟳</span>}
            {!isMobile&&<div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)"}}>
              {today.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
              {" · "}{daysLeft()}d left
            </div>}
          </div>
        </div>
        <div className="ledgr-content" style={S.content}>{VIEWS[view]}</div>
      </div>

      <nav className="ledgr-bottomnav">
        {NAV.map(n=>(
          <button key={n.id} className={`ledgr-bottomnav-item ${view===n.id?"active":""}`} onClick={()=>setView(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {(modal==="addCat"||modal==="editCat")   && CatModal}
      {(modal==="addAcct"||modal==="editAcct") && AcctModal}
      {modal==="addTxn"                        && TxnModal}
      {(modal==="addRule"||modal==="editRule") && RuleModal}

      {rulePrompt&&(
        <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:200,background:"var(--card)",border:"1px solid var(--cyan)44",borderRadius:12,padding:"14px 20px",boxShadow:"0 8px 32px #00000080",display:"flex",alignItems:"center",gap:14,maxWidth:420,width:"90vw"}}>
          <div style={{flex:1,fontSize:13}}>
            <div style={{fontWeight:600,color:"var(--t1)",marginBottom:2}}>Save as a rule?</div>
            <div style={{fontSize:12,color:"var(--t2)"}}>&quot;{rulePrompt.merchant}&quot; → <strong>{catMap[rulePrompt.categoryId]?.name}</strong></div>
          </div>
          <button style={S.btn("primary",true)} onClick={confirmSaveRule}>Save Rule</button>
          <button style={S.btn("ghost",true)} onClick={()=>setRulePrompt(null)}>✕</button>
        </div>
      )}

      <Toast msg={toast}/>
    </div>
  );
}

function capitalise(s) { return s ? s.charAt(0).toUpperCase()+s.slice(1) : ""; }
