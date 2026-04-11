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
      .ledgr-monthbar   { flex-direction: column !important; gap: 10px !important; align-items: flex-start !important; }
      .ledgr-monthbar-meta { flex-wrap: wrap !important; gap: 10px !important; }
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
    const base = { display:"inline-flex", alignItems:"center", gap:7, padding:sm?"6px 12px":"9px 16px", borderRadius:"var(--radius)", fontSize:sm?12:13, fontWeight:500, cursor:"pointer", border:"1px solid transparent", transition:"all 0.15s", userSelect:"none" };
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
const currentMonth = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
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

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App() {
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
  const [syncing,       setSyncing]       = useState(false);
  const [rulePrompt,    setRulePrompt]    = useState(null);
  const [drillCat,      setDrillCat]      = useState(null);
  const [calendarDay,      setCalendarDay]      = useState(null);
  const [selectedMonth,    setSelectedMonth]    = useState(currentMonth);
  const [calendarMonth,    setCalendarMonth]    = useState(currentMonth);
  const [calendarAccounts, setCalendarAccounts] = useState(null); // null = show all
  const [editingCalAccts,  setEditingCalAccts]  = useState(false);
  const [search,        setSearch]        = useState("");
  const [filterCat,     setFilterCat]     = useState("all");
  const [filterAcct,    setFilterAcct]    = useState("all");
  const [editingId,     setEditingId]     = useState(null);
  const [ellipsisId,    setEllipsisId]    = useState(null); // transaction id with open ⋯ menu
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
        setAccounts(data.accounts         || []);
        setCategories(data.categories     || []);
        setTransactions(data.transactions || []);
        setPlaidItems(data.plaidItems     || []);
        setRules(data.rules               || []);
        setCalendarAccounts(data.calendarAccounts || null);
      } catch (e) { console.warn("Load error:", e.message); }
      finally { setLoading(false); initialized.current = true; }
    })();
  }, []);

  /* ── Save ── */
  const saveTimeout = useRef(null);
  function scheduleSave(patch) {
    if (!initialized.current) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => api.saveData(patch), 800);
  }
  useEffect(() => { scheduleSave({ accounts });     }, [accounts]);
  useEffect(() => { scheduleSave({ categories });   }, [categories]);
  useEffect(() => { scheduleSave({ transactions }); }, [transactions]);
  useEffect(() => { scheduleSave({ plaidItems });   }, [plaidItems]);
  useEffect(() => { scheduleSave({ rules }); }, [rules]);
  useEffect(() => {
    if (Array.isArray(calendarAccounts)) scheduleSave({ calendarAccounts });
  }, [calendarAccounts]);

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
            const toAdd = brandNew.filter(t => !existingIds.has(t.id));
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
        await fetch("https://ledgr-production-9e35.up.railway.app/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        });
        navigator.serviceWorker.addEventListener("message", e => {
          if (e.data?.type === "NEW_TRANSACTIONS") setView("transactions");
        });
      } catch (err) {
        console.warn("Push setup:", err.message);
      }
    }
    setup();
  }, []);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2800); };
  const navigate  = id  => { setView(id); setDrawerOpen(false); };

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

  const filteredTxns = useMemo(() =>
    transactions.filter(t => {
      const label = (t.name||t.merchant||"").toLowerCase();
      if (search && !label.includes(search.toLowerCase())) return false;
      if (filterCat  !== "all" && t.categoryId !== filterCat)  return false;
      if (filterAcct !== "all" && t.accountId  !== filterAcct) return false;
      return true;
    }).sort((a,b) => b.date?.localeCompare(a.date)),
  [transactions, search, filterCat, filterAcct]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a,b) => {
      const remA=a.limit-(spentByCat[a.id]||0), remB=b.limit-(spentByCat[b.id]||0);
      const overA=remA<0, overB=remB<0, zeroA=remA===0, zeroB=remB===0;
      if (overA&&!overB) return -1; if (!overA&&overB) return 1;
      if (overA&&overB)  return remA-remB;
      if (zeroA&&!zeroB) return -1; if (!zeroA&&zeroB) return 1;
      return remA-remB;
    });
  }, [categories, spentByCat]);

  const catTxns = useMemo(() =>
    drillCat ? monthTxns.filter(t=>t.categoryId===drillCat.id&&t.amount<0).sort((a,b)=>b.date.localeCompare(a.date)) : [],
  [drillCat, monthTxns]);

  const recurringTxns     = useMemo(() => transactions.filter(t=>t.recurring&&t.recurringDay), [transactions]);
  const calendarTxnsByDay = useMemo(() => {
    const map = {};
    recurringTxns.forEach(t => { const d=parseInt(t.recurringDay); if(!map[d]) map[d]=[]; map[d].push(t); });
    return map;
  }, [recurringTxns]);

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
  function applyRules(txns, rs) {
    if (!rs?.length) return txns;
    return txns.map(t => {
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
  function deleteRule(id)  { setRules(p=>p.filter(r=>r.id!==id)); showToast("Rule deleted"); }
  function toggleRule(id)  { setRules(p=>p.map(r=>r.id===id?{...r,enabled:!r.enabled}:r)); }

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
        next=next.map(t=>modMap[t.id]?plaidTxnToLocal(modMap[t.id],catMap):t);
        const existing=new Set(next.map(t=>t.id));
        const rawNew=added.filter(t=>!existing.has(t.transaction_id)).map(t=>plaidTxnToLocal(t,catMap));
        return [...applyRules(rawNew,rules),...next];
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
  function updateTxnType(id,val) { setTransactions(p=>p.map(t=>t.id===id?{...t,type:val}:t)); }
  function updateTxnCat(id,val) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,categoryId:val||null}:t));
    if(val){const txn=transactions.find(t=>t.id===id);if(txn)promptSaveRule(txn,val);}
  }
  function updateTxnAcct(id,val) { setTransactions(p=>p.map(t=>t.id===id?{...t,accountId:val||null}:t)); }
  function deleteTxn(id)  { setTransactions(p=>p.filter(t=>t.id!==id)); showToast("Deleted"); }
  function toggleRecurring(id) {
    setTransactions(p=>p.map(t=>{
      if(t.id!==id) return t;
      const on=!t.recurring;
      const autoDay=t.date?parseInt(t.date.split("-")[2]):null;
      return {...t,recurring:on,recurringDay:on?(t.recurringDay||autoDay):null};
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
  const DrillDownModal = drillCat ? (
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
  const Dashboard = (
    <div>
      <div className="ledgr-monthbar" style={{...S.monthBar,justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={prevMonth} style={{background:"none",border:"1px solid var(--border2)",borderRadius:6,color:"var(--t2)",cursor:"pointer",padding:"4px 12px",fontSize:18,lineHeight:1.4}}>‹</button>
          <span style={{fontFamily:"var(--font-disp)",fontWeight:700,fontSize:15,color:"var(--t1)",minWidth:isMobile?90:180,textAlign:"center"}}>
            📅 {monthLabel(selectedMonth)}
            {isCurrentMonth&&<span style={{marginLeft:6,fontSize:10,color:"var(--cyan)",fontFamily:"var(--font-body)"}}>current</span>}
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
      </div>
      {DrillDownModal}
    </div>
  );

  /* ── Transactions ── */
  const Transactions = (
    <div>
      <div style={{...S.sectionHdr,marginBottom:16}}>
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
        <select style={{...S.select,padding:"9px 10px"}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="">Uncategorized</option>
        </select>
        <select style={{...S.select,padding:"9px 10px"}} value={filterAcct} onChange={e=>setFilterAcct(e.target.value)}>
          <option value="all">All Accounts</option>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filteredTxns.length===0&&<div style={{...S.card,textAlign:"center",padding:48,color:"var(--t3)"}}>No transactions found</div>}
          {filteredTxns.map(t=>(
            <div key={t.id} style={{...S.card,padding:"14px 16px",borderLeft:t.recurring?"3px solid var(--amber)":"3px solid transparent"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{flex:1,minWidth:0,marginRight:10}}>
                  {editingId===t.id?(
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <input style={{background:"var(--surface)",border:"1px solid var(--cyan)",borderRadius:6,padding:"4px 8px",fontSize:13,color:"var(--t1)",outline:"none",flex:1}}
                        value={editingName} onChange={e=>setEditingName(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")saveRename(t.id);if(e.key==="Escape")setEditingId(null);}} autoFocus/>
                      <button style={S.btn("primary",true)} onClick={()=>saveRename(t.id)}>✓</button>
                    </div>
                  ):(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {t.recurring&&<span style={{color:"var(--amber)",fontSize:12,flexShrink:0}}>↻</span>}
                      <span style={{fontSize:14,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</span>
                      <div style={{position:"relative",flexShrink:0}}>
                        <button onClick={()=>setEllipsisId(ellipsisId===t.id?null:t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:16,padding:"2px 4px",lineHeight:1}}>⋯</button>
                        {ellipsisId===t.id&&(
                          <div style={{position:"absolute",right:0,top:"100%",zIndex:30,background:"var(--card)",border:"1px solid var(--border2)",borderRadius:"var(--radius)",boxShadow:"0 4px 16px #00000060",minWidth:130,overflow:"hidden"}}>
                            <button onClick={()=>{startRename(t);setEllipsisId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t1)"}}>Rename</button>
                            <button onClick={()=>{deleteTxn(t.id);setEllipsisId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t2)"}}>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>{t.date}{t.pending&&<span style={{marginLeft:6,color:"var(--amber)"}}>pending</span>}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:700,color:t.amount<0?"var(--red)":"var(--green)"}}>
                    {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
                  </span>
                  <button onClick={()=>deleteTxn(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:13,padding:"2px 6px"}}>✕</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <select style={{...S.select,width:"100%",padding:"8px 10px",fontSize:12}} value={t.type||(t.amount<0?"expense":"income")} onChange={e=>updateTxnType(t.id,e.target.value)}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="refund">Refund</option>
                  <option value="reimbursement">Reimbursement</option>
                  <option value="transfer">Transfer</option>
                </select>
                <select style={{...S.select,width:"100%",padding:"8px 10px",fontSize:12}} value={t.categoryId||""}
                  onChange={e=>{ if(e.target.value==="__new__"){openAddCat();}else{updateTxnCat(t.id,e.target.value);} }}>
                  <option value="">— Category —</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new__">＋ New Category…</option>
                </select>
              </div>
              <div style={{marginBottom:8}}>
                <select style={{...S.select,width:"100%",padding:"8px 10px",fontSize:12}} value={t.accountId||""} onChange={e=>updateTxnAcct(t.id,e.target.value)}>
                  <option value="">— Account —</option>
                  {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:8,borderTop:"1px solid var(--border)"}}>
                <button onClick={()=>toggleRecurring(t.id)} style={{...S.btn(t.recurring?"amber":"ghost",true),padding:"4px 10px",fontSize:11}}>
                  {t.recurring?"↻ Recurring":"↻ Mark Recurring"}
                </button>
                {t.recurring&&(
                  <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--t2)"}}>
                    Day: <input type="number" min="1" max="31" style={{...S.input,width:52,padding:"4px 8px",fontSize:12}} value={t.recurringDay||""} onChange={e=>updateRecurringDay(t.id,e.target.value)}/> of month
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{...S.card,padding:0,overflow:"hidden"}}>
          <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 280px)"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>Name / Merchant</th>
                <th style={S.th}>Type</th>
                <th style={S.th}>Category</th>
                <th style={S.th}>Account</th>
                <th style={{...S.th,textAlign:"center"}}>Recurring</th>
                <th style={{...S.th,textAlign:"right"}}>Amount</th>
              </tr></thead>
              <tbody>
                {filteredTxns.length===0&&(
                  <tr><td colSpan={6} style={{...S.td,textAlign:"center",padding:"48px 0",color:"var(--t3)"}}>No transactions found</td></tr>
                )}
                {filteredTxns.map(t=>(
                  <tr key={t.id} style={{background:t.recurring?"#fbbf2408":"transparent"}}>
                    <td style={{...S.td,fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",whiteSpace:"nowrap"}}>{t.date}</td>
                    <td style={{...S.td,color:"var(--t1)",fontWeight:500}}>
                      {editingId===t.id?(
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <input style={{background:"var(--surface)",border:"1px solid var(--cyan)",borderRadius:6,padding:"4px 8px",fontSize:13,color:"var(--t1)",outline:"none",width:170}}
                            value={editingName} onChange={e=>setEditingName(e.target.value)}
                            onKeyDown={e=>{if(e.key==="Enter")saveRename(t.id);if(e.key==="Escape")setEditingId(null);}} autoFocus/>
                          <button style={S.btn("primary",true)} onClick={()=>saveRename(t.id)}>✓</button>
                          <button style={S.btn("ghost",true)} onClick={()=>setEditingId(null)}>✕</button>
                        </div>
                      ):(
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {t.recurring&&<span style={{color:"var(--amber)",fontSize:12}}>↻</span>}
                          <span>{t.name||t.merchant}</span>
                          {t.name&&<span style={{fontSize:10,color:"var(--t3)"}}>({t.merchant})</span>}
                          {t.pending&&<span style={{fontSize:10,color:"var(--amber)",border:"1px solid var(--amber)44",borderRadius:4,padding:"1px 5px"}}>pending</span>}
                          <div style={{position:"relative",marginLeft:"auto",flexShrink:0}}>
                            <button onClick={()=>setEllipsisId(ellipsisId===t.id?null:t.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:16,padding:"2px 6px",lineHeight:1}}>⋯</button>
                            {ellipsisId===t.id&&(
                              <div style={{position:"absolute",right:0,top:"100%",zIndex:30,background:"var(--card)",border:"1px solid var(--border2)",borderRadius:"var(--radius)",boxShadow:"0 4px 16px #00000060",minWidth:130,overflow:"hidden"}}>
                                <button onClick={()=>{startRename(t);setEllipsisId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t1)"}}>Rename</button>
                                <button onClick={()=>{deleteTxn(t.id);setEllipsisId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t2)"}}>Delete</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      <select style={{...S.select,width:120}} value={t.type||(t.amount<0?"expense":"income")} onChange={e=>updateTxnType(t.id,e.target.value)}>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="refund">Refund</option>
                        <option value="reimbursement">Reimbursement</option>
                        <option value="transfer">Transfer</option>
                      </select>
                    </td>
                    <td style={S.td}>
                      <select style={{...S.select,width:130}} value={t.categoryId||""}
                        onChange={e=>{ if(e.target.value==="__new__"){openAddCat();}else{updateTxnCat(t.id,e.target.value);} }}>
                        <option value="">— None —</option>
                        {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value="__new__">＋ New Category…</option>
                      </select>
                    </td>
                    <td style={S.td}>
                      <select style={{...S.select,width:130}} value={t.accountId||""} onChange={e=>updateTxnAcct(t.id,e.target.value)}>
                        <option value="">— None —</option>
                        {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </td>
                    <td style={{...S.td,textAlign:"center"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                        <button onClick={()=>toggleRecurring(t.id)}
                          style={{background:t.recurring?"#fbbf2422":"transparent",border:`1px solid ${t.recurring?"#fbbf2444":"var(--border2)"}`,borderRadius:6,cursor:"pointer",padding:"3px 8px",fontSize:12,color:t.recurring?"var(--amber)":"var(--t3)"}}>↻</button>
                        {t.recurring&&(
                          <input type="number" min="1" max="31"
                            style={{...S.input,width:46,padding:"3px 6px",fontSize:11,textAlign:"center"}}
                            value={t.recurringDay||""} onChange={e=>updateRecurringDay(t.id,e.target.value)}/>
                        )}
                      </div>
                    </td>
                    <td style={{...S.td,textAlign:"right",fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:t.amount<0?"var(--red)":"var(--green)"}}>
                      {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
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
  const [editingLimitId,  setEditingLimitId]  = useState(null);
  const [editingLimitVal, setEditingLimitVal] = useState("");

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
      <div style={{...S.sectionHdr,marginBottom:16}}>
        <div style={S.sectionTitle}>Budget Categories</div>
        <button style={S.btn("primary",true)} onClick={openAddCat}>+ New Category</button>
      </div>

      {categories.length===0 ? (
        <div style={{...S.card,textAlign:"center",padding:48,color:"var(--t3)"}}>No categories yet.</div>
      ) : isMobile ? (

        /* ── Mobile: card list ── */
        <div style={{display:"flex",flexDirection:"column",gap:0,...S.card,padding:0,overflow:"hidden"}}>
          {sortedCategories.map((cat,i)=>{
            const spent=spentByCat[cat.id]||0,pct=Math.min((spent/cat.limit)*100,100);
            const remaining=cat.limit-spent,isLast=i===sortedCategories.length-1;
            const over=remaining<0,warn=pct>=80&&!over&&remaining!==0,barC=over?"var(--red)":warn?"var(--amber)":remaining===0?"var(--t3)":cat.color;
            return (
              <div key={cat.id} onClick={()=>setDrillCat(cat)}
                style={{padding:"14px 16px",borderBottom:isLast?"none":"1px solid var(--border)",cursor:"pointer",transition:"background 0.12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {/* Name row */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{width:16,height:16,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,
                    background:over?"var(--red-dim)":remaining===0?"var(--surface)":warn?"#fbbf2422":"var(--green-dim)",
                    border:`1px solid ${over?"var(--red)":remaining===0?"var(--border2)":warn?"var(--amber)":"var(--green)"}55`,
                    color:over?"var(--red)":remaining===0?"var(--t3)":warn?"var(--amber)":"var(--green)"}}>
                    {over?"!":remaining===0?"○":warn?"~":"✓"}
                  </span>
                  <span style={{width:8,height:8,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
                  <span style={{fontSize:14,fontWeight:600,color:"var(--t1)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</span>
                  <button style={{...S.btn("ghost",true),padding:"3px 7px",fontSize:11}} onClick={e=>{e.stopPropagation();deleteCat(cat.id);}}>✕</button>
                </div>
                {/* Progress bar */}
                <div style={{height:4,background:"var(--border)",borderRadius:99,overflow:"hidden",marginBottom:10}}>
                  <div style={{height:"100%",borderRadius:99,background:barC,width:`${pct}%`,transition:"width 0.5s"}}/>
                </div>
                {/* Stats row */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {/* Budgeted */}
                  <div style={{background:"var(--surface)",borderRadius:"var(--radius)",padding:"8px 10px"}} onClick={e=>e.stopPropagation()}>
                    <div style={{fontSize:9,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4,fontFamily:"var(--font-disp)"}}>Budgeted</div>
                    {editingLimitId===cat.id ? (
                      <input type="number" autoFocus
                        style={{background:"none",border:"none",borderBottom:"1px solid var(--cyan)",fontSize:13,color:"var(--t1)",outline:"none",width:"100%",fontFamily:"var(--font-mono)",padding:"2px 0"}}
                        value={editingLimitVal}
                        onChange={e=>setEditingLimitVal(e.target.value)}
                        onBlur={()=>saveLimit(cat.id)}
                        onKeyDown={e=>{if(e.key==="Enter")saveLimit(cat.id);if(e.key==="Escape")setEditingLimitId(null);}}/>
                    ):(
                      <div onClick={e=>startEditLimit(cat,e)} style={{fontFamily:"var(--font-mono)",fontSize:13,color:"var(--t1)",cursor:"text"}}>
                        {fmt(cat.limit)} <span style={{fontSize:9,opacity:0.4}}>⋯</span>
                      </div>
                    )}
                  </div>
                  {/* Spent */}
                  <div style={{background:"var(--surface)",borderRadius:"var(--radius)",padding:"8px 10px"}}>
                    <div style={{fontSize:9,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4,fontFamily:"var(--font-disp)"}}>Spent</div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:13,color:spent>0?"var(--t1)":"var(--t3)"}}>{fmt(spent)}</div>
                  </div>
                  {/* Remaining */}
                  <div style={{background:over?"var(--red-dim)":remaining===0?"var(--surface)":"var(--green-dim)",border:`1px solid ${over?"var(--red)":remaining===0?"var(--border2)":"var(--green)"}33`,borderRadius:"var(--radius)",padding:"8px 10px"}}>
                    <div style={{fontSize:9,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4,fontFamily:"var(--font-disp)"}}>Left</div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:over?"var(--red)":remaining===0?"var(--t3)":"var(--green)"}}>
                      {over?`−${fmt(Math.abs(remaining))}`:fmt(remaining)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Mobile totals */}
          <div style={{padding:"12px 16px",borderTop:"2px solid var(--border)",background:"var(--surface)",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <div><div style={{fontSize:9,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4,fontFamily:"var(--font-disp)"}}>Budgeted</div><div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>{fmt(totalBudget)}</div></div>
            <div><div style={{fontSize:9,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4,fontFamily:"var(--font-disp)"}}>Spent</div><div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>{fmt(totalSpent)}</div></div>
            <div><div style={{fontSize:9,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4,fontFamily:"var(--font-disp)"}}>Left</div><div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:totalBudget-totalSpent>=0?"var(--green)":"var(--red)"}}>{fmt(totalBudget-totalSpent)}</div></div>
          </div>
        </div>

      ) : (

        /* ── Desktop: table ── */
        <div style={{...S.card,padding:0,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 150px 130px 150px 76px",borderBottom:"2px solid var(--border)",padding:"10px 20px",background:"var(--surface)"}}>
            {[["Category","left"],["Budgeted","right"],["Spent","right"],["Remaining","right"],["","right"]].map(([h,align])=>(
              <div key={h} style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:"var(--t3)",fontFamily:"var(--font-disp)",textAlign:align}}>{h}</div>
            ))}
          </div>
          {sortedCategories.map((cat,i)=>{
            const spent=spentByCat[cat.id]||0,pct=Math.min((spent/cat.limit)*100,100);
            const remaining=cat.limit-spent,isLast=i===sortedCategories.length-1;
            const over=remaining<0,warn=pct>=80&&!over&&remaining!==0,barC=over?"var(--red)":warn?"var(--amber)":remaining===0?"var(--t3)":cat.color;
            return (
              <div key={cat.id} onClick={()=>setDrillCat(cat)}
                style={{display:"grid",gridTemplateColumns:"1fr 150px 130px 150px 76px",padding:"13px 20px",borderBottom:isLast?"none":"1px solid var(--border)",cursor:"pointer",alignItems:"center",transition:"background 0.12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{minWidth:0,paddingRight:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <span style={{width:18,height:18,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
                      background:over?"var(--red-dim)":remaining===0?"var(--surface)":warn?"#fbbf2422":"var(--green-dim)",
                      border:`1px solid ${over?"var(--red)":remaining===0?"var(--border2)":warn?"var(--amber)":"var(--green)"}55`,
                      color:over?"var(--red)":remaining===0?"var(--t3)":warn?"var(--amber)":"var(--green)"}}>
                      {over?"!":remaining===0?"○":warn?"~":"✓"}
                    </span>
                    <span style={{width:8,height:8,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
                    <span style={{fontSize:14,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</span>
                    <span style={{fontSize:11,color:over?"var(--red)":warn?"var(--amber)":"var(--t3)",marginLeft:"auto",whiteSpace:"nowrap",flexShrink:0,paddingLeft:8}}>
                      {over?"Overspent":remaining===0?"Fully spent":warn?`${pct.toFixed(0)}% used`:"Funded"}
                    </span>
                  </div>
                  <div style={{height:4,background:"var(--border)",borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:99,background:barC,width:`${pct}%`,transition:"width 0.5s"}}/>
                  </div>
                </div>
                <div style={{textAlign:"right",paddingRight:16}} onClick={e=>e.stopPropagation()}>
                  {editingLimitId===cat.id ? (
                    <input type="number" autoFocus style={{...S.input,width:110,padding:"5px 8px",fontSize:13,textAlign:"right"}}
                      value={editingLimitVal} onChange={e=>setEditingLimitVal(e.target.value)}
                      onBlur={()=>saveLimit(cat.id)}
                      onKeyDown={e=>{if(e.key==="Enter")saveLimit(cat.id);if(e.key==="Escape")setEditingLimitId(null);}}/>
                  ):(
                    <span onClick={e=>startEditLimit(cat,e)} title="Click to edit"
                      style={{fontFamily:"var(--font-mono)",fontSize:13,color:"var(--t1)",cursor:"text",padding:"4px 8px",borderRadius:"var(--radius)",border:"1px solid transparent",transition:"border-color 0.15s",display:"inline-block"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor="var(--border2)"}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="transparent"}>
                      {fmt(cat.limit)} <span style={{fontSize:10,opacity:0.4}}>⋯</span>
                    </span>
                  )}
                </div>
                <div style={{textAlign:"right",paddingRight:16,fontFamily:"var(--font-mono)",fontSize:13,color:spent>0?"var(--t1)":"var(--t3)"}}>{fmt(spent)}</div>
                <div style={{textAlign:"right",paddingRight:16}}>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,display:"inline-block",padding:"4px 10px",borderRadius:6,
                    color:over?"var(--red)":remaining===0?"var(--t3)":"var(--green)",
                    background:over?"var(--red-dim)":remaining===0?"var(--surface)":"var(--green-dim)",
                    border:`1px solid ${over?"var(--red)":remaining===0?"var(--border2)":"var(--green)"}33`}}>
                    {over?`−${fmt(Math.abs(remaining))}`:fmt(remaining)}
                  </span>
                </div>
                <div style={{display:"flex",gap:4,justifyContent:"flex-end"}} onClick={e=>e.stopPropagation()}>
                  <button style={{...S.btn("ghost",true),padding:"4px 8px",fontSize:11}} onClick={()=>deleteCat(cat.id)}>✕</button>
                </div>
              </div>
            );
          })}
          <div style={{display:"grid",gridTemplateColumns:"1fr 150px 130px 150px 76px",padding:"12px 20px",borderTop:"2px solid var(--border)",background:"var(--surface)"}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--t3)",fontFamily:"var(--font-disp)",textTransform:"uppercase",letterSpacing:"0.5px"}}>Totals</div>
            <div style={{textAlign:"right",paddingRight:16,fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>{fmt(totalBudget)}</div>
            <div style={{textAlign:"right",paddingRight:16,fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--t1)"}}>{fmt(totalSpent)}</div>
            <div style={{textAlign:"right",paddingRight:16}}><span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:totalBudget-totalSpent>=0?"var(--green)":"var(--red)"}}>{fmt(totalBudget-totalSpent)}</span></div>
            <div/>
          </div>
        </div>
      )}
      {DrillDownModal}
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
  );

  /* ── Rules ── */
  const Rules = (
    <div>
      <div style={{...S.sectionHdr,marginBottom:8}}>
        <div style={S.sectionTitle}>Auto-Categorization Rules</div>
        <button style={S.btn("primary",true)} onClick={()=>{setRuleForm({pattern:"",matchType:"contains",categoryId:"",enabled:true});setModal("addRule");}}>+ New Rule</button>
      </div>
      <p style={{fontSize:13,color:"var(--t2)",marginBottom:20,lineHeight:1.6}}>Rules automatically assign categories to new transactions when they sync.</p>
      {rules.length===0?(
        <div style={{...S.card,textAlign:"center",padding:48}}>
          <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◎</div>
          <div style={{fontSize:14,fontWeight:600,color:"var(--t1)",marginBottom:6}}>No rules yet</div>
          <div style={{fontSize:13,color:"var(--t3)"}}>Categorize a transaction and you'll be prompted to save it as a rule.</div>
        </div>
      ):(
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
                    <div style={{fontSize:11,color:"var(--t3)"}}>Match: <strong style={{color:"var(--t2)"}}>{rule.matchType}</strong>{rule.createdAt&&` · ${new Date(rule.createdAt).toLocaleDateString()}`}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                    <button onClick={()=>toggleRule(rule.id)} style={{...S.btn("ghost",true),color:rule.enabled?"var(--green)":"var(--t3)",borderColor:rule.enabled?"var(--green)44":"var(--border2)"}}>
                      {rule.enabled?"✓ On":"Off"}
                    </button>
                    <button style={S.btn("ghost",true)} onClick={()=>{setRuleForm({pattern:rule.pattern,matchType:rule.matchType,categoryId:rule.categoryId,enabled:rule.enabled});setEditTarget(rule);setModal("editRule");}}>Edit</button>
                    <button style={S.btn("ghost",true)} onClick={()=>deleteRule(rule.id)}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ── Calendar ── */
  const calYear=parseInt(calendarMonth.split("-")[0]);
  const calMonthN=parseInt(calendarMonth.split("-")[1]);
  const firstDow=new Date(calYear,calMonthN-1,1).getDay();
  const daysInCal=daysInMonth(calYear,calMonthN);
  const totalCells=Math.ceil((firstDow+daysInCal)/7)*7;

  const Calendar = (
    <div>
      <div style={{...S.sectionHdr,marginBottom:16}}>
        <div style={S.sectionTitle}>Recurring Calendar</div>
        <div style={{fontSize:13,color:"var(--t2)"}}>{recurringTxns.length} recurring</div>
      </div>

      {recurringTxns.length===0&&(
        <div style={{...S.card,textAlign:"center",padding:32,marginBottom:20}}>
          <div style={{fontSize:13,color:"var(--t3)"}}>Go to Transactions and click ↻ on any transaction to mark it as recurring.</div>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <button onClick={prevCalMonth} style={{background:"none",border:"1px solid var(--border2)",borderRadius:6,color:"var(--t2)",cursor:"pointer",padding:"6px 14px",fontSize:18,lineHeight:1.4}}>‹</button>
        <div style={{fontFamily:"var(--font-disp)",fontSize:18,fontWeight:700}}>{monthLabel(calendarMonth)}</div>
        <button onClick={nextCalMonth} style={{background:"none",border:"1px solid var(--border2)",borderRadius:6,color:"var(--t2)",cursor:"pointer",padding:"6px 14px",fontSize:18,lineHeight:1.4}}>›</button>
      </div>

      <div style={{...S.card,padding:0,overflow:"hidden",marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid var(--border)"}}>
          {DAYS_OF_WEEK.map(d=>(
            <div key={d} style={{textAlign:"center",padding:"10px 4px",fontSize:11,fontWeight:700,color:"var(--t3)",fontFamily:"var(--font-disp)",textTransform:"uppercase",letterSpacing:"1px"}}>
              {isMobile?d[0]:d}
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:"var(--border)"}}>
          {Array.from({length:totalCells}).map((_,i)=>{
            const day=i-firstDow+1;
            const isValid=day>=1&&day<=daysInCal;
            const isToday=isValid&&calYear===today.getFullYear()&&calMonthN===today.getMonth()+1&&day===today.getDate();
            const dayTxns=isValid?(calendarTxnsByDay[day]||[]):[];
            return (
              <div key={i} className="ledgr-cal-cell"
                onClick={()=>{if(isValid&&dayTxns.length>0)setCalendarDay({day,txns:dayTxns});}}
                style={{background:"var(--card)",minHeight:80,padding:8,cursor:isValid&&dayTxns.length>0?"pointer":"default",opacity:isValid?1:0.3,transition:"background 0.12s"}}
                onMouseEnter={e=>{if(isValid&&dayTxns.length>0)e.currentTarget.style.background="var(--surface)";}}
                onMouseLeave={e=>{e.currentTarget.style.background="var(--card)";}}>
                <div style={{fontSize:13,fontWeight:isToday?700:500,color:isToday?"var(--cyan)":isValid?"var(--t1)":"var(--t3)",marginBottom:4,
                  ...(isToday?{background:"var(--cyan-dim)",border:"1px solid var(--cyan)44",borderRadius:"50%",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}:{})}}>
                  {isValid?day:""}
                </div>
                {dayTxns.slice(0,isMobile?1:2).map(t=>{
                  const cat=catMap[t.categoryId];
                  return (
                    <div key={t.id} style={{fontSize:isMobile?9:10,color:"var(--bg)",background:cat?.color||"var(--cyan)",borderRadius:4,padding:"1px 5px",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600}}>
                      {isMobile?fmt(Math.abs(t.amount)):(t.name||t.merchant)}
                    </div>
                  );
                })}
                {dayTxns.length>(isMobile?1:2)&&<div style={{fontSize:9,color:"var(--t3)"}}>+{dayTxns.length-(isMobile?1:2)} more</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Account charge summaries ── */}
      {recurringTxns.length>0&&(()=>{
        const isCurrentCalMonth = calYear===today.getFullYear()&&calMonthN===today.getMonth()+1;
        const isPastCalMonth    = calYear<today.getFullYear()||(calYear===today.getFullYear()&&calMonthN<today.getMonth()+1);
        const relevantTxns = recurringTxns.filter(t=>{
          if (isPastCalMonth) return false;
          if (isCurrentCalMonth) return (t.recurringDay||0)>=today.getDate();
          return true;
        });
        const shownIds = calendarAccounts || accounts.map(a=>a.id);
        const byAccount = {};
        shownIds.forEach(id=>{ const a=acctMap[id]; if(a) byAccount[id]={name:a.name,total:0,count:0}; });
        relevantTxns.forEach(t=>{
          if (!t.accountId||!byAccount[t.accountId]) return;
          byAccount[t.accountId].total+=Math.abs(t.amount);
          byAccount[t.accountId].count+=1;
        });
        const entries=Object.values(byAccount).sort((a,b)=>b.total-a.total);
        if (entries.length===0) return null;
        const totalRemaining=entries.reduce((a,e)=>a+e.total,0);
        const label=isPastCalMonth?"Charged in":isCurrentCalMonth?`Remaining in ${monthLabel(calendarMonth)}`:`Charges in ${monthLabel(calendarMonth)}`;
        return (
          <div style={{...S.card,marginBottom:20,padding:"14px 20px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:editingCalAccts?12:12}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",color:"var(--t3)",fontFamily:"var(--font-disp)"}}>{label}</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--red)"}}>{fmt(totalRemaining)}</div>
                <button onClick={()=>setEditingCalAccts(p=>!p)}
                  style={{...S.btn("ghost",true),padding:"3px 8px",fontSize:11,color:editingCalAccts?"var(--cyan)":"var(--t3)",borderColor:editingCalAccts?"var(--cyan)44":"var(--border2)"}}>
                  {editingCalAccts?"Done":"Edit"}
                </button>
              </div>
            </div>
            {editingCalAccts&&(
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:"1px solid var(--border)"}}>
                <div style={{fontSize:11,color:"var(--t3)",marginBottom:8}}>Select which accounts to show:</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {accounts.map(a=>{
                    const curIds=calendarAccounts||accounts.map(x=>x.id);
                    const selected=curIds.includes(a.id);
                    return (
                      <label key={a.id} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"8px 12px",borderRadius:"var(--radius)",background:selected?"var(--cyan-dim)":"var(--surface)",border:`1px solid ${selected?"var(--cyan)33":"var(--border2)"}`}}>
                        <input type="checkbox" checked={selected} onChange={()=>{
                          const cur=calendarAccounts||accounts.map(x=>x.id);
                          setCalendarAccounts(selected?cur.filter(id=>id!==a.id):[...cur,a.id]);
                        }} style={{accentColor:"var(--cyan)",width:14,height:14,flexShrink:0}}/>
                        <span style={{fontSize:13,color:selected?"var(--cyan)":"var(--t1)",fontWeight:selected?600:400,flex:1}}>{a.name}</span>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:12,color:"var(--red)"}}>{fmt(byAccount[a.id]?.total||0)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(entries.length,3)},1fr)`,gap:10}}>
              {entries.map(e=>(
                <div key={e.name} style={{background:"var(--surface)",borderRadius:"var(--radius)",padding:"10px 12px",borderTop:"2px solid var(--red)"}}>
                  <div style={{fontSize:11,color:"var(--t3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4}}>{e.name}</div>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:700,color:"var(--red)"}}>{fmt(e.total)}</div>
                  <div style={{fontSize:10,color:"var(--t3)",marginTop:2}}>{e.count} charge{e.count!==1?"s":""}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {recurringTxns.length>0&&(
        <div style={S.card}>
          <div style={S.cardTitle}>All Recurring Transactions</div>
          {recurringTxns.sort((a,b)=>(a.recurringDay||0)-(b.recurringDay||0)).map(t=>{
            const cat=catMap[t.categoryId];
            return (
              <div key={t.id}
                onClick={()=>{setEditTarget(t);setModal("editRecurring");}}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px",margin:"0 -8px 2px",borderBottom:"1px solid var(--border)",cursor:"pointer",borderRadius:6,transition:"background 0.12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                  <div style={{width:28,height:28,borderRadius:8,background:"var(--surface)",border:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font-mono)",fontSize:11,fontWeight:700,color:"var(--cyan)",flexShrink:0}}>
                    {t.recurringDay||"?"}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                    <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>Day {t.recurringDay||"?"} of month{cat&&<> · <span style={{color:cat.color}}>{cat.name}</span></>}</div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:10}}>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:t.amount<0?"var(--red)":"var(--green)"}}>{t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}</span>
                  <span style={{fontSize:11,color:"var(--t3)"}}>⋯</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {calendarDay&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setCalendarDay(null)}>
          <div style={{...S.modal,width:480}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <div style={S.modalTitle}>{new Date(calYear,calMonthN-1,calendarDay.day).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
                <div style={{fontSize:12,color:"var(--t3)",marginTop:-14}}>{calendarDay.txns.length} recurring charge{calendarDay.txns.length!==1?"s":""}</div>
              </div>
              <button onClick={()=>setCalendarDay(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:20,padding:"4px 8px"}}>✕</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {calendarDay.txns.map(t=>{
                const cat=catMap[t.categoryId];
                return (
                  <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",borderLeft:`3px solid ${cat?.color||"var(--cyan)"}`}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                      <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>Day {t.recurringDay}{cat&&<> · <span style={{color:cat.color}}>{cat.name}</span></>}</div>
                    </div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:16,fontWeight:700,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0,marginLeft:12}}>
                      {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,color:"var(--t3)"}}>Total: <span style={{fontFamily:"var(--font-mono)",color:"var(--red)",fontWeight:600}}>{fmt(calendarDay.txns.filter(t=>t.amount<0).reduce((a,t)=>a+Math.abs(t.amount),0))}</span></div>
              <button style={S.btn("ghost")} onClick={()=>setCalendarDay(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────
     MODALS
  ───────────────────────────────────────────────────────────────── */
  const EditRecurringModal = editTarget && modal==="editRecurring" ? (
    <Modal title="Edit Recurring Transaction" onClose={()=>{setModal(null);setEditTarget(null);}}
      actions={<>
        <button style={S.btn("ghost")} onClick={()=>{setModal(null);setEditTarget(null);}}>Cancel</button>
        <button style={S.btn("primary")} onClick={()=>{
          setTransactions(p=>p.map(t=>t.id===editTarget.id?{...t,name:editTarget.name,recurringDay:editTarget.recurringDay,categoryId:editTarget.categoryId||null}:t));
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
          <label style={S.label}>Recurring Day of Month</label>
          <input style={S.input} type="number" min="1" max="31" value={editTarget.recurringDay||""} onChange={e=>setEditTarget(p=>({...p,recurringDay:parseInt(e.target.value)||null}))}/>
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
  const NAV = [
    { id:"dashboard",    icon:"◈", label:"Dashboard"    },
    { id:"transactions", icon:"⇅", label:"Transactions" },
    { id:"budgets",      icon:"◉", label:"Budgets"      },
    { id:"accounts",     icon:"▣", label:"Accounts"     },
    { id:"rules",        icon:"◎", label:"Rules"        },
    { id:"calendar",     icon:"▦", label:"Calendar"     },
  ];
  const VIEWS = { dashboard:Dashboard, transactions:Transactions, budgets:Budgets, accounts:Accounts, rules:Rules, calendar:Calendar };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"var(--font-disp)",fontSize:28,fontWeight:800,color:"var(--t1)"}}>ledgr<span style={{color:"var(--cyan)"}}>.</span></div>
      <div style={{fontSize:13,color:"var(--t3)"}}>Loading your data…</div>
    </div>
  );

  /* ── Shared sidebar content ── */
  const SidebarContent = (onNav) => (
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
      <div style={{padding:"12px 10px",borderTop:"1px solid var(--border)",flexShrink:0}}>
        <button style={{...S.btn("ghost"),width:"100%",justifyContent:"center",fontSize:12}}
          onClick={()=>{ doSync(); onNav(view); }} disabled={syncing}>
          {syncing?"⟳ Syncing…":"⟳ Sync All"}
        </button>
      </div>
    </>
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
            {SidebarContent(id=>{ setView(id); setDrawerOpen(false); })}
          </div>
          {/* Content */}
          <div style={{height:"100%",overflowY:"auto"}} className="ledgr-content">
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
            {SidebarContent(id=>setView(id))}
          </aside>
          {/* Content */}
          <div style={{flex:1,overflowY:"auto"}} className="ledgr-content">
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
            style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#000",padding:"2px 6px"}}>✕</button>
        </div>
      )}

      <Toast msg={toast}/>
    </div>
  );
}

function cap(s) { return s ? s.charAt(0).toUpperCase()+s.slice(1) : ""; }
