/**
 * LedgrAccounts.jsx
 * src/components/LedgrAccounts.jsx
 */
import { useMemo, useState, useEffect, useRef } from "react";
import PageNav from "./PageNav.jsx";

/* ── Account Modal ────────────────────────────────────────────────────
   Self-contained add/edit modal in Ledgr's dark design system.
   Exported so App.jsx renders it: {acctModal && <AccountModal .../>}
──────────────────────────────────────────────────────────────────── */
const MODAL_CSS = `
  .am-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
  .am-modal{background:#0b0e14;border:1px solid rgba(255,255,255,0.08);border-radius:16px;width:100%;max-width:400px;box-shadow:0 32px 80px rgba(0,0,0,0.7);overflow:hidden;animation:am-in .2s cubic-bezier(0.22,1,0.36,1);}
  @keyframes am-in{from{opacity:0;transform:translateY(10px) scale(0.97);}to{opacity:1;transform:none;}}
  .am-head{padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:baseline;justify-content:space-between;}
  .am-title{font-family:'Instrument Serif',Georgia,serif;font-size:20px;letter-spacing:-0.3px;color:#f4f4f1;}
  .am-close{background:none;border:none;color:#4a5161;font-size:18px;cursor:pointer;line-height:1;padding:2px 4px;border-radius:4px;transition:.15s;}
  .am-close:hover{color:#f4f4f1;background:rgba(255,255,255,0.06);}
  .am-body{padding:18px 20px;}
  .am-field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px;}
  .am-field:last-child{margin-bottom:0;}
  .am-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#4a5161;font-family:'JetBrains Mono',monospace;}
  .am-input{background:#11151d;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 12px;font-size:13px;color:#f4f4f1;font-family:'Geist',-apple-system,sans-serif;outline:none;transition:.15s;width:100%;box-sizing:border-box;}
  .am-input:focus{border-color:rgba(93,202,165,0.5);background:#131820;}
  .am-input::placeholder{color:#2e3340;}
  .am-input[readonly]{color:#4a5161;cursor:default;}
  .am-select{background:#11151d;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 32px 8px 12px;font-size:13px;color:#f4f4f1;font-family:'Geist',-apple-system,sans-serif;outline:none;transition:.15s;width:100%;box-sizing:border-box;appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234a5161'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;}
  .am-select:focus{border-color:rgba(93,202,165,0.5);background-color:#131820;}
  .am-hint{font-size:10px;color:#4a5161;font-family:'JetBrains Mono',monospace;margin-top:2px;}
  .am-foot{padding:14px 20px;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:flex-end;gap:8px;}
  .am-btn{background:transparent;border:1px solid rgba(255,255,255,0.10);border-radius:7px;padding:6px 16px;font-size:11px;font-family:'JetBrains Mono',monospace;color:#7d8594;cursor:pointer;transition:.15s;}
  .am-btn:hover{border-color:rgba(255,255,255,0.2);color:#f4f4f1;}
  .am-btn.primary{background:rgba(93,202,165,0.1);border-color:rgba(93,202,165,0.45);color:#5dcaa5;}
  .am-btn.primary:hover{background:rgba(93,202,165,0.18);}

  @media(max-width:768px){.pn-nav{display:none !important;}}
`;

export function AccountModal({ mode="add", acct=null, onSave, onClose }) {
  const nameRef = useRef(null);
  const isEdit  = mode === "edit";
  const isPlaid = !!(acct?.plaidId);

  const [name,    setName]    = useState(acct?.name || "");
  const [type,    setType]    = useState(acct?.type || "Checking");
  const [balance, setBalance] = useState(acct ? String(Math.abs(acct.balance || 0)) : "");

  useEffect(() => { if (!isPlaid) nameRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSave() {
    if (!name.trim()) { nameRef.current?.focus(); return; }
    onSave({ name: name.trim(), type, balance: parseFloat(balance) || 0 });
  }

  const isCreditType = /credit/i.test(type);

  return (
    <>
      <style>{MODAL_CSS}</style>
      <div className="am-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="am-modal">
          <div className="am-head">
            <span className="am-title">{isEdit ? "Edit Account" : "Add Account"}</span>
            <button className="am-close" onClick={onClose}>✕</button>
          </div>
          <div className="am-body">

            {/* Name */}
            <div className="am-field">
              <label className="am-label">Name</label>
              <input
                ref={nameRef}
                className="am-input"
                placeholder="Chase Checking"
                value={name}
                readOnly={isPlaid}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
              {isPlaid && <span className="am-hint">Rename via your bank connection or edit directly on this page.</span>}
            </div>

            {/* Type */}
            <div className="am-field">
              <label className="am-label">Type</label>
              {isPlaid ? (
                <input className="am-input" value={acct.type || "—"} readOnly/>
              ) : (
                <select className="am-select" value={type} onChange={e => setType(e.target.value)}>
                  {["Checking","Savings","Credit","Investment","Cash"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Balance */}
            <div className="am-field">
              <label className="am-label">{isCreditType ? "Amount Owed ($)" : "Balance ($)"}</label>
              <input
                className="am-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={balance}
                readOnly={isPlaid}
                onChange={e => setBalance(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
              {isPlaid
                ? <span className="am-hint">Balance syncs automatically from your bank.</span>
                : isCreditType
                  ? <span className="am-hint">Enter the amount you currently owe — treated as a liability.</span>
                  : null}
            </div>

            {/* Last 4 — read-only info for Plaid accounts */}
            {isPlaid && acct?.mask && (
              <div className="am-field">
                <label className="am-label">Account</label>
                <input className="am-input" value={"••••" + acct.mask} readOnly style={{fontFamily:"'JetBrains Mono',monospace"}}/>
              </div>
            )}

          </div>
          <div className="am-foot">
            <button className="am-btn" onClick={onClose}>Cancel</button>
            <button className="am-btn primary" onClick={handleSave}>
              {isEdit ? "Save Changes" : "Add Account"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  :root{--bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;--bg-4:#1c2330;--line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);--line-3:rgba(255,255,255,0.18);--ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;--safe:#5dcaa5;--safe-d:#0f6e56;--safe-bg:rgba(93,202,165,0.08);--warn:#f0b04c;--warn-bg:rgba(240,176,76,0.08);--debt:#e87363;--debt-bg:rgba(232,115,99,0.08);--calm:#6c8cff;--calm-bg:rgba(108,140,255,0.08);--goal:#a78bff;--goal-d:#2a1f5e;--font-display:'Instrument Serif',Georgia,serif;--font-ui:'Geist',-apple-system,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;--r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;}
  .la-wrap *,.la-wrap *::before,.la-wrap *::after{box-sizing:border-box;}
  .la-wrap h1,.la-wrap h2,.la-wrap h3,.la-wrap h4,.la-wrap p{margin:0;padding:0;}
  .la-wrap{font-family:var(--font-ui);color:var(--ink-0);-webkit-font-smoothing:antialiased;background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;}
  @media(max-width:1000px){.la-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.la-wrap{padding:0;}}
  .la-frame{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden;max-width:1400px;margin:0 auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;flex-direction:column;min-height:600px;}
  @media(max-width:600px){.la-frame{border-radius:0;border:none;}}
  .la-bar{height:40px;background:var(--bg-2);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 18px;gap:8px;flex-shrink:0;}
  .la-bar-dot{width:9px;height:9px;border-radius:50%;background:var(--ink-4);}
  .la-bar-url{margin-left:14px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .la-bar-live{margin-left:auto;display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .la-sync-btn{background:none;border:1px solid rgba(255,255,255,0.06);border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-3);transition:.15s;flex-shrink:0;}
  .la-sync-btn:hover{border-color:rgba(255,255,255,0.18);color:var(--ink-0);}
  .la-sync-btn svg{transition:transform .6s;}
  .la-sync-btn.spinning svg{animation:la-spin .7s linear infinite;}
  @keyframes la-spin{to{transform:rotate(360deg);}}
  .la-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .la-body{display:grid;grid-template-columns:64px 1fr;flex:1;}
  .la-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);}
  .la-nav-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d) 80%);margin-bottom:24px;}
  .la-nav-item{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;}
  .la-nav-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .la-nav-item.active{color:var(--safe);background:var(--safe-bg);}
  .la-nav-spacer{flex:1;}
  .la-main{overflow-y:auto;min-width:0;}

  /* topbar */
  .la-topbar{height:50px;padding:0 24px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg-1);z-index:10;}
  .la-tb-left{display:flex;align-items:baseline;gap:12px;}
  .la-tb-num{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .la-tb-title{font-family:var(--font-display);font-size:20px;letter-spacing:-0.3px;}
  .la-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .la-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1px;text-transform:uppercase;}
  .la-tb-right{display:flex;align-items:center;gap:8px;}
  .la-btn{background:transparent;border:1px solid var(--line-2);border-radius:6px;padding:4px 12px;font-size:10px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:.15s;letter-spacing:0.3px;}
  .la-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .la-btn.primary{background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe);}
  .la-btn.danger{background:var(--debt-bg);border-color:rgba(232,115,99,0.3);color:var(--debt);}

  /* summary strip */
  .la-strip{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--line);flex-shrink:0;}
  .la-stat{padding:10px 24px;border-right:1px solid var(--line);}
  .la-stat:last-child{border-right:none;}
  .la-stat-lbl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-3);margin-bottom:2px;font-family:var(--font-mono);}
  .la-stat-val{font-family:var(--font-mono);font-size:14px;font-weight:500;color:var(--ink-0);}
  @media(max-width:700px){.la-strip{grid-template-columns:1fr 1fr;}.la-stat{border-bottom:1px solid var(--line);}}

  /* table */
  .la-table{width:100%;}
  .la-thead{display:grid;padding:0 24px;height:28px;align-items:center;border-bottom:1px solid var(--line);background:var(--bg-2);}
  .la-th{font-family:var(--font-mono);font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-3);}
  .la-th.r{text-align:right;}

  /* group header row */
  .la-group-row{display:flex;align-items:center;padding:0 24px;height:28px;background:rgba(255,255,255,0.015);border-bottom:1px solid var(--line);border-top:1px solid var(--line);gap:8px;}
  .la-group-row:first-of-type{border-top:none;}
  .la-group-pip{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
  .la-group-name{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-3);font-family:var(--font-mono);}
  .la-group-count{font-size:9px;color:var(--ink-4);font-family:var(--font-mono);}
  .la-group-sum{margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--ink-2);}
  .la-group-actions{display:flex;gap:4px;margin-left:8px;}
  .la-sm-btn{background:transparent;border:1px solid var(--line-2);border-radius:4px;padding:2px 8px;font-size:9px;font-family:var(--font-mono);color:var(--ink-3);cursor:pointer;transition:.15s;}
  .la-sm-btn:hover{color:var(--ink-1);border-color:var(--line-3);}
  .la-sm-btn.danger{border-color:rgba(232,115,99,0.2);color:var(--debt);}
  .la-sm-btn.warn{border-color:rgba(240,176,76,0.3);color:var(--warn);}

  /* stale bar */
  .la-stale-bar{padding:6px 24px;background:rgba(232,115,99,0.05);border-bottom:1px solid rgba(232,115,99,0.1);font-size:11px;color:var(--ink-3);}

  /* account row */
  .la-row{display:grid;padding:0 24px;height:40px;align-items:center;border-bottom:1px solid var(--line);transition:background .1s;cursor:default;}
  .la-row:last-child{border-bottom:none;}
  .la-row:hover{background:rgba(255,255,255,0.02);}
  .la-row:hover .la-row-actions{opacity:1;}
  .la-acct-icon{width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;font-family:var(--font-mono);flex-shrink:0;}
  .la-acct-name{font-size:12px;color:var(--ink-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:12px;}
  .la-acct-sub{font-size:9px;color:var(--ink-3);font-family:var(--font-mono);}
  .la-cell{font-family:var(--font-mono);font-size:12px;color:var(--ink-1);text-align:right;}
  .la-cell.dim{color:var(--ink-3);font-size:11px;}
  .la-cell.safe{color:var(--safe);}
  .la-cell.debt{color:var(--debt);}
  .la-cell.goal{color:var(--goal);}
  .la-row-actions{display:flex;justify-content:flex-end;gap:4px;opacity:0;transition:opacity .15s;}
  .la-act-btn{background:var(--bg-3);border:1px solid var(--line-2);border-radius:4px;padding:2px 8px;font-size:9px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:.15s;}
  .la-act-btn:hover{color:var(--ink-0);border-color:var(--line-3);}
  .la-act-btn.danger{border-color:rgba(232,115,99,0.2);color:var(--debt);}

  /* empty */
  .la-empty{padding:80px;text-align:center;color:var(--ink-3);}
  .la-empty-title{font-family:var(--font-display);font-size:28px;color:var(--ink-2);margin-bottom:6px;}

  /* mobile: hide some columns */
  @media(max-width:700px){
    .la-wrap{padding:0;}
    .la-col-hide{display:none;}
  }
`;

const DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
function daysInMonth(y,m){return new Date(y,m,0).getDate();}

// Stable color per institution name
const INST_COLORS=["var(--calm)","var(--safe)","var(--warn)","var(--goal)","#e87363","#f0b04c"];
function instColor(label,isManual){
  if(isManual) return "var(--ink-3)";
  let h=0; for(let i=0;i<label.length;i++) h=(h*31+label.charCodeAt(i))&0xffff;
  return INST_COLORS[h%INST_COLORS.length];
}
function instInitials(label){return label.slice(0,2).toUpperCase();}

// Grid column definition — used for both thead and rows
const COLS_DESKTOP="28px 1fr 100px 110px 110px 90px 76px";
const COLS_MOBILE="28px 1fr 90px";

export default function LedgrAccounts({
  accounts=[],plaidItems=[],staleItemIds=new Set(),spentByAcct={},monthTxns=[],
  openAddAcct,openEditAcct,deleteAcct,disconnectItem,doSync,syncing=false,
  reconnectingItemId=null,setReconnectingItemId,handlePlaidSuccess,PlaidButton,showToast=()=>{},
  fmt=n=>`$${Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
  today=new Date(),isMobile=false,navigate=()=>{},
  notifs=[],onDismissNotif=()=>{},onFilterReview=()=>{},
}) {
  const isCredit = a => /(credit)/i.test(a.type||"");
  const totalBalance  = accounts.reduce((s,a)=>s+(isCredit(a)?-(a.balance||0):(a.balance||0)),0);
  const totalSpentAc  = accounts.reduce((s,a)=>s+(spentByAcct[a.id]||0),0);
  const totalIncome   = monthTxns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const totalAccounts = accounts.length;

  const groups = useMemo(()=>{
    const g={};
    accounts.forEach(a=>{
      const key=a.plaidItemId||"__manual__";
      if(!g[key]){
        const item=plaidItems.find(i=>i.item_id===a.plaidItemId);
        g[key]={label:item?.institution||a.institution||"Manual",accts:[]};
      }
      g[key].accts.push(a);
    });
    return Object.entries(g).sort(([ka],[kb])=>{
      if(ka==="__manual__") return 1;
      if(kb==="__manual__") return -1;
      return g[ka].label.localeCompare(g[kb].label);
    });
  },[accounts,plaidItems]);

  const timeLabel=`${DN[today.getDay()]}, ${MN[today.getMonth()]} ${today.getDate()}`;
  const cols = isMobile ? COLS_MOBILE : COLS_DESKTOP;

  return (
    <>
      <style>{CSS}</style>
      <div className="la-wrap">
        <div className="la-frame">

          {/* chrome bar */}
          <div className="la-bar">
            <div className="la-bar-dot"/><div className="la-bar-dot"/><div className="la-bar-dot"/>
            <span className="la-bar-url">app.ledgr.app / accounts</span>
            <span className="la-bar-live">
              live · synced just now
              {doSync&&(
                <button className={`la-sync-btn${syncing?" spinning":""}`} onClick={()=>!syncing&&doSync()} title="Sync now">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
              )}
            </span>
          </div>

          <div className="la-body">
            {!isMobile&&<PageNav activeId="accounts" navigate={navigate} notifs={notifs} onDismissNotif={onDismissNotif} onFilterReview={onFilterReview}/>}

            <main className="la-main">

              {/* topbar */}
              <div className="la-topbar">
                <div className="la-tb-left">
                  <span className="la-tb-num">iii ·</span>
                  <span className="la-tb-title">Accounts</span>
                  <span className="la-tb-div"/>
                  <span className="la-tb-sub">{timeLabel}</span>
                </div>
                <div className="la-tb-right">
                  {PlaidButton&&<PlaidButton onSuccess={handlePlaidSuccess} onExit={()=>{}} label="+ Link Bank" showToast={showToast} style={{}}/>}
                  <button className="la-btn" onClick={openAddAcct}>+ Manual</button>
                </div>
              </div>

              {/* summary strip */}
              <div className="la-strip">
                <div className="la-stat">
                  <div className="la-stat-lbl">Net Worth</div>
                  <div className="la-stat-val" style={{color:totalBalance>=0?"var(--safe)":"var(--debt)"}}>{totalBalance<0?"−":""}{fmt(Math.abs(totalBalance))}</div>
                </div>
                <div className="la-stat">
                  <div className="la-stat-lbl">Accounts</div>
                  <div className="la-stat-val">{totalAccounts}</div>
                </div>
                <div className="la-stat la-col-hide">
                  <div className="la-stat-lbl">Spent MTD</div>
                  <div className="la-stat-val" style={{color:"var(--debt)"}}>−{fmt(totalSpentAc)}</div>
                </div>
                <div className="la-stat la-col-hide">
                  <div className="la-stat-lbl">Income MTD</div>
                  <div className="la-stat-val" style={{color:"var(--safe)"}}>+{fmt(totalIncome)}</div>
                </div>
              </div>

              {/* table */}
              {accounts.length===0 ? (
                <div className="la-empty">
                  <div className="la-empty-title">No accounts yet</div>
                  <div>Link a bank or add a manual account to get started.</div>
                </div>
              ) : (
                <div className="la-table">

                  {/* thead */}
                  <div className="la-thead" style={{gridTemplateColumns:cols}}>
                    <div className="la-th"/>
                    <div className="la-th">Account</div>
                    {!isMobile&&<div className="la-th r">Type</div>}
                    {!isMobile&&<div className="la-th r">Spent MTD</div>}
                    {!isMobile&&<div className="la-th r">Income MTD</div>}
                    {!isMobile&&<div className="la-th r">Proj. Spend</div>}
                    <div className="la-th r">Balance</div>
                  </div>

                  {groups.map(([key,{label,accts}])=>{
                    const plaidItem = plaidItems.find(i=>i.item_id===key);
                    const isStale   = plaidItem&&staleItemIds.has(plaidItem.item_id);
                    const isManual  = key==="__manual__";
                    const groupTotal= accts.reduce((s,a)=>s+(isCredit(a)?-(a.balance||0):(a.balance||0)),0);
                    const color     = instColor(label,isManual);

                    return (
                      <div key={key}>

                        {/* institution group header */}
                        <div className="la-group-row">
                          <div className="la-group-pip" style={{background:color}}/>
                          <span className="la-group-name" style={{color:isStale?"var(--warn)":undefined}}>
                            {isStale&&"⚠ "}{label}
                          </span>
                          <span className="la-group-count">{accts.length} acct{accts.length!==1?"s":""}</span>
                          <span className="la-group-sum" style={{color:groupTotal<0?"var(--debt)":undefined}}>{groupTotal<0?"−":""}{fmt(Math.abs(groupTotal))}</span>
                          {!isMobile&&!isManual&&plaidItem&&(
                            <div className="la-group-actions">
                              {isStale ? (
                                <>
                                  {PlaidButton&&<PlaidButton itemId={plaidItem.item_id} onSuccess={async(pt,inst)=>{await handlePlaidSuccess(pt,inst||label);setReconnectingItemId&&setReconnectingItemId(null);}} onExit={()=>setReconnectingItemId&&setReconnectingItemId(null)} label={reconnectingItemId===plaidItem.item_id?"Opening…":"Reconnect"} showToast={showToast} style={{fontSize:9,padding:"2px 8px"}}/>}
                                  <button className="la-sm-btn danger" onClick={()=>disconnectItem(plaidItem.item_id)}>Remove</button>
                                </>
                              ) : (
                                <>
                                  <button className="la-sm-btn" onClick={()=>doSync(plaidItem.item_id)} disabled={syncing}>{syncing?"…":"↻ Sync"}</button>
                                  <button className="la-sm-btn danger" onClick={()=>disconnectItem(plaidItem.item_id)}>Disconnect</button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* stale warning */}
                        {isStale&&<div className="la-stale-bar">Connection expired — reconnect to restore syncing. Your existing data won't be affected.</div>}

                        {/* account rows */}
                        {accts.map(acct=>{
                          const spent  = spentByAcct[acct.id]||0;
                          const income = monthTxns.filter(t=>t.amount>0&&t.accountId===acct.id).reduce((s,t)=>s+t.amount,0);
                          const daily  = today.getDate()>0 ? spent/today.getDate() : 0;
                          const proj   = daily*daysInMonth(today.getFullYear(),today.getMonth()+1);
                          const isNeg  = (acct.balance||0)<0;
                          const isInvestment = /invest|401|ira|brokerage|retirement/i.test(acct.type||"");
                          const isCreditAcct = isCredit(acct);
                          // For credit cards: Plaid current balance is positive = amount owed (a liability)
                          // For manual credit entries: user may enter positive; treat as owed
                          const effectiveBal = isCreditAcct ? -(Math.abs(acct.balance||0)) : (acct.balance||0);
                          const balColor = effectiveBal<0?"var(--debt)":isInvestment?"var(--goal)":"var(--ink-0)";
                          const availLabel = isCreditAcct ? "credit left" : "avail";
                          const initials = instInitials(isManual?(acct.name||"ME"):label);
                          const iconBg   = isManual?"var(--bg-3)":`color-mix(in srgb, ${color} 15%, transparent)`;

                          return (
                            <div key={acct.id} className="la-row" style={{gridTemplateColumns:cols}}>
                              {/* icon */}
                              <div className="la-acct-icon" style={{background:iconBg,color}}>{initials}</div>

                              {/* name + mask */}
                              <div style={{minWidth:0}}>
                                <div className="la-acct-name">{acct.name}</div>
                                {!isMobile&&(acct.mask||acct.available!=null)&&(
                                  <div className="la-acct-sub">
                                    {acct.mask&&`••${acct.mask}`}
                                    {acct.mask&&acct.available!=null&&" · "}
                                    {acct.available!=null&&`${availLabel} ${fmt(acct.available)}`}
                                  </div>
                                )}
                              </div>

                              {/* type */}
                              {!isMobile&&<div className="la-cell dim" style={{textAlign:"right"}}>{acct.type||"—"}</div>}

                              {/* spent */}
                              {!isMobile&&<div className={`la-cell${spent>0?" debt":""}`}>{spent>0?`−${fmt(spent)}`:<span style={{color:"var(--ink-4)"}}>—</span>}</div>}

                              {/* income */}
                              {!isMobile&&<div className={`la-cell${income>0?" safe":""}`}>{income>0?`+${fmt(income)}`:<span style={{color:"var(--ink-4)"}}>—</span>}</div>}

                              {/* proj spend */}
                              {!isMobile&&<div className="la-cell dim">{proj>0?`~${fmt(proj)}`:<span style={{color:"var(--ink-4)"}}>—</span>}</div>}

                              {/* balance + hover actions */}
                              <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6}}>
                                <div className="la-row-actions">
                                  <button className="la-act-btn" onClick={()=>openEditAcct(acct)}>Edit</button>
                                  <button className="la-act-btn danger" onClick={()=>deleteAcct(acct.id)}>✕</button>
                                </div>
                                <div className="la-cell" style={{color:balColor,minWidth:72,textAlign:"right"}}>
                                  {effectiveBal<0?"−":""}{fmt(Math.abs(effectiveBal))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
