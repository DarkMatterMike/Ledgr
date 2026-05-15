/**
 * LedgrAccounts.jsx
 * src/components/LedgrAccounts.jsx
 */
import { useMemo } from "react";
import PageNav from "./PageNav.jsx";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  :root{--bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;--bg-4:#1c2330;--line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);--line-3:rgba(255,255,255,0.18);--ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;--safe:#5dcaa5;--safe-d:#0f6e56;--safe-bg:rgba(93,202,165,0.08);--warn:#f0b04c;--warn-bg:rgba(240,176,76,0.08);--debt:#e87363;--debt-bg:rgba(232,115,99,0.08);--calm:#6c8cff;--calm-bg:rgba(108,140,255,0.08);--goal:#a78bff;--goal-d:#2a1f5e;--font-display:'Instrument Serif',Georgia,serif;--font-ui:'Geist',-apple-system,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;--r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;}
  .la-wrap *,.la-wrap *::before,.la-wrap *::after{box-sizing:border-box;}
  .la-wrap h1,.la-wrap h2,.la-wrap h3,.la-wrap h4,.la-wrap p{margin:0;padding:0;}
  .la-wrap{font-family:var(--font-ui);color:var(--ink-0);-webkit-font-smoothing:antialiased;background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;}
  @media(max-width:1000px){.la-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.la-wrap{padding:0;}}
  .la-frame{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden;max-width:1400px;margin:0 auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;flex-direction:column;min-height:800px;}
  @media(max-width:600px){.la-frame{border-radius:0;border:none;}}
  @media(hover:none)and(pointer:coarse){
    .la-content{padding:16px!important;}
    .la-hero-num{font-size:36px!important;}
    .la-acct-card{padding:10px 14px!important;}
    .la-balance{font-size:24px!important;}
    .la-group-hdr{padding:8px 14px!important;}
  }
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
  .la-topbar{height:60px;padding:0 32px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg-1);z-index:10;}
  .la-tb-left{display:flex;align-items:baseline;gap:16px;}
  .la-tb-num{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .la-tb-title{font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px;}
  .la-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .la-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .la-tb-right{display:flex;align-items:center;gap:14px;}
  .la-search{background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:7px 14px;font-size:12px;color:var(--ink-3);font-family:var(--font-mono);display:flex;align-items:center;gap:8px;min-width:240px;}
  .la-kbd{margin-left:auto;font-size:10px;padding:1px 6px;background:var(--bg-3);border-radius:4px;color:var(--ink-3);}
  .la-btn{background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 14px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:.15s;}
  .la-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .la-btn.primary{background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe);}
  .la-btn.danger{background:var(--debt-bg);border-color:rgba(232,115,99,0.3);color:var(--debt);}
  .la-content{padding:40px;}
  .la-hero{margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid var(--line);}
  .la-hero-eye{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px;}
  .la-hero-num{font-family:var(--font-display);font-size:72px;line-height:0.9;letter-spacing:-2px;color:var(--ink-0);margin-bottom:12px;}
  .la-hero-sub{font-size:14px;color:var(--ink-2);line-height:1.6;}
  .la-groups{display:flex;flex-direction:column;gap:16px;}
  .la-group{border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden;}
  .la-group-seam{height:2px;}
  .la-group-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:rgba(255,255,255,0.02);border-bottom:1px solid var(--line);}
  .la-group-left{display:flex;align-items:center;gap:10px;}
  .la-group-name{font-size:14px;font-weight:600;}
  .la-group-count{font-family:var(--font-mono);font-size:10px;color:var(--ink-3);}
  .la-group-right{display:flex;align-items:center;gap:10px;}
  .la-group-total{font-family:var(--font-mono);font-size:16px;font-weight:500;color:var(--ink-1);}
  .la-stale-bar{padding:10px 20px;background:rgba(232,115,99,0.05);border-bottom:1px solid rgba(232,115,99,0.1);font-size:12px;color:var(--ink-3);}
  .la-acct-grid{display:grid;}
  .la-acct-card{padding:20px 24px;border-bottom:1px solid var(--line);}
  .la-acct-card:last-child{border-bottom:none;}
  .la-acct-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;}
  .la-acct-name{font-size:13px;color:var(--ink-2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .la-acct-actions{display:flex;gap:6px;flex-shrink:0;}
  .la-balance{font-family:var(--font-display);font-size:40px;line-height:1;letter-spacing:-1px;color:var(--ink-0);margin-bottom:6px;}
  .la-balance.neg{color:var(--debt);}
  .la-acct-type{font-family:var(--font-mono);font-size:10px;color:var(--ink-3);margin-bottom:12px;}
  .la-pills{display:flex;gap:6px;flex-wrap:wrap;}
  .la-pill{display:inline-flex;align-items:center;font-size:10px;padding:3px 10px;border-radius:99px;font-family:var(--font-mono);}
  .la-empty{padding:80px;text-align:center;color:var(--ink-3);}
  .la-empty-title{font-family:var(--font-display);font-size:28px;color:var(--ink-2);margin-bottom:6px;}
  @media(max-width:700px){.la-wrap{padding:0;}.la-topbar,.la-content{padding-left:16px;padding-right:16px;}.la-hero-num{font-size:48px;}.la-balance{font-size:28px;}}
`;

const DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const NAV=[{icon:"◐",id:"dashboard"},{icon:"⇅",id:"transactions"},{icon:"▣",id:"accounts",active:true},{icon:"◉",id:"budgets"},{icon:"▦",id:"calendar"},{icon:"◈",id:"analytics"}];
function daysInMonth(y,m){return new Date(y,m,0).getDate();}

export default function LedgrAccounts({
  accounts=[],plaidItems=[],staleItemIds=new Set(),spentByAcct={},monthTxns=[],
  openAddAcct,openEditAcct,deleteAcct,disconnectItem,doSync,syncing=false,
  reconnectingItemId=null,setReconnectingItemId,handlePlaidSuccess,PlaidButton,showToast=()=>{},
  fmt=n=>`$${Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
  today=new Date(),isMobile=false,navigate=()=>{},
  notifs=[],onDismissNotif=()=>{},onFilterReview=()=>{},
}) {
  const totalBalance =accounts.reduce((s,a)=>s+(a.balance||0),0);
  const totalSpentAc=accounts.reduce((s,a)=>s+(spentByAcct[a.id]||0),0);
  const totalIncome =monthTxns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);

  const groups=useMemo(()=>{
    const g={};
    accounts.forEach(a=>{
      const key=a.plaidItemId||"__manual__";
      if(!g[key]){const item=plaidItems.find(i=>i.item_id===a.plaidItemId);g[key]={label:item?.institution||a.institution||"Manual",accts:[]};}
      g[key].accts.push(a);
    });
    return Object.entries(g).sort(([ka],[kb])=>{if(ka==="__manual__")return 1;if(kb==="__manual__")return -1;return g[ka].label.localeCompare(g[kb].label);});
  },[accounts,plaidItems]);

  const initials=accounts[0]?.institution?.slice(0,2).toUpperCase()||"ME";
  const timeLabel=`${DN[today.getDay()]}, ${MN[today.getMonth()]} ${today.getDate()}`;

  return (
    <>
      <style>{CSS}</style>
      <div className="la-wrap">
        <div className="la-frame">
          <div className="la-bar">
            <div className="la-bar-dot"/><div className="la-bar-dot"/><div className="la-bar-dot"/>
            <span className="la-bar-url">app.ledgr.app / accounts</span>
            <span className="la-bar-live">
              live · synced just now
              {doSync && (
                <button className={`la-sync-btn${syncing?" spinning":""}`} onClick={()=>!syncing&&doSync()} title="Sync now">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
              )}
            </span>
          </div>
          <div className="la-body" style={isMobile?{display:"block",width:"100%"}:{}}>
            {!isMobile&&<PageNav activeId="accounts" navigate={navigate} notifs={notifs} onDismissNotif={onDismissNotif} onFilterReview={onFilterReview}/>}
            <main className="la-main">
              <div className="la-topbar">
                <div className="la-tb-left">
                  <span className="la-tb-num">iii ·</span>
                  <span className="la-tb-title">Accounts</span>
                  <span className="la-tb-div"/>
                  <span className="la-tb-sub">{timeLabel}</span>
                </div>
                <div className="la-tb-right">
                  {PlaidButton&&<PlaidButton onSuccess={handlePlaidSuccess} onExit={()=>{}} label="Link Bank" showToast={showToast} style={{}}/>}
                  <button className="la-btn" onClick={openAddAcct}>+ Manual</button>
                </div>
              </div>
              <div className="la-content">
                <div className="la-hero">
                  <div className="la-hero-eye">Total balance across all accounts</div>
                  <div className="la-hero-num">{fmt(totalBalance)}</div>
                  <div className="la-hero-sub">
                    {accounts.length} account{accounts.length!==1?"s":""} ·{" "}
                    <span style={{color:"var(--debt)",fontFamily:"var(--font-mono)"}}>−{fmt(totalSpentAc)}</span> spent ·{" "}
                    <span style={{color:"var(--safe)",fontFamily:"var(--font-mono)"}}>+{fmt(totalIncome)}</span> income this month
                  </div>
                </div>
                {accounts.length===0 ? (
                  <div className="la-empty"><div className="la-empty-title">No accounts yet</div><div>Link a bank or add a manual account to get started</div></div>
                ) : (
                  <div className="la-groups">
                    {groups.map(([key,{label,accts}])=>{
                      const plaidItem=plaidItems.find(i=>i.item_id===key);
                      const isStale=plaidItem&&staleItemIds.has(plaidItem.item_id);
                      const isManual=key==="__manual__";
                      const groupTotal=accts.reduce((s,a)=>s+(a.balance||0),0);
                      const seam=isManual?"linear-gradient(90deg,rgba(255,255,255,0.1),transparent)":isStale?"linear-gradient(90deg,rgba(232,115,99,0.5),transparent)":"linear-gradient(90deg,rgba(93,202,165,0.5),transparent)";
                      return (
                        <div key={key} className="la-group">
                          <div className="la-group-seam" style={{background:seam}}/>
                          <div className="la-group-hdr">
                            <div className="la-group-left">
                              {isStale&&<span style={{color:"var(--warn)",fontSize:14}}>⚠</span>}
                              <span className="la-group-name" style={{color:isStale?"var(--warn)":"var(--ink-0)"}}>{label}</span>
                              <span className="la-group-count">{accts.length} account{accts.length!==1?"s":""}</span>
                            </div>
                            <div className="la-group-right">
                              <span className="la-group-total">{fmt(groupTotal)}</span>
                              {!isManual&&plaidItem&&(isStale?(
                                <>
                                  {PlaidButton&&<PlaidButton itemId={plaidItem.item_id} onSuccess={async(pt,inst)=>{await handlePlaidSuccess(pt,inst||label);setReconnectingItemId&&setReconnectingItemId(null);}} onExit={()=>setReconnectingItemId&&setReconnectingItemId(null)} label={reconnectingItemId===plaidItem.item_id?"Opening…":"Reconnect"} showToast={showToast} style={{fontSize:11,padding:"4px 10px"}}/>}
                                  <button className="la-btn danger" style={{fontSize:11}} onClick={()=>disconnectItem(plaidItem.item_id)}>Remove</button>
                                </>
                              ):(
                                <>
                                  <button className="la-btn" style={{fontSize:11}} onClick={()=>doSync(plaidItem.item_id)} disabled={syncing}>{syncing?"…":"↻ Sync"}</button>
                                  <button className="la-btn danger" style={{fontSize:11}} onClick={()=>disconnectItem(plaidItem.item_id)}>Disconnect</button>
                                </>
                              ))}
                            </div>
                          </div>
                          {isStale&&<div className="la-stale-bar">Connection expired — reconnect to restore syncing. Your existing data won't be affected.</div>}
                          <div className="la-acct-grid" style={{gridTemplateColumns:!isMobile&&accts.length>1?"1fr 1fr":"1fr"}}>
                            {accts.map((acct,i)=>{
                              const spent=spentByAcct[acct.id]||0;
                              const income=monthTxns.filter(t=>t.amount>0&&t.accountId===acct.id).reduce((s,t)=>s+t.amount,0);
                              const daily=today.getDate()>0?spent/today.getDate():0;
                              const proj=daily*daysInMonth(today.getFullYear(),today.getMonth()+1);
                              const isNeg=(acct.balance||0)<0;
                              const showBorder=!isMobile&&accts.length>1&&i%2===0&&i<accts.length-1;
                              return (
                                <div key={acct.id} className="la-acct-card" style={{borderRight:showBorder?"1px solid var(--line)":"none"}}>
                                  <div className="la-acct-hdr">
                                    <span className="la-acct-name">{acct.name}</span>
                                    <div className="la-acct-actions">
                                      <button className="la-btn" style={{fontSize:10,padding:"2px 8px"}} onClick={()=>openEditAcct(acct)}>Edit</button>
                                      <button className="la-btn" style={{fontSize:10,padding:"2px 8px",borderColor:"transparent"}} onClick={()=>deleteAcct(acct.id)}>✕</button>
                                    </div>
                                  </div>
                                  <div className={`la-balance${isNeg?" neg":""}`}>{isNeg?"−":""}{fmt(Math.abs(acct.balance||0))}</div>
                                  <div className="la-acct-type">{acct.type}{acct.mask?` ····${acct.mask}`:""}{acct.available!=null?` · Avail ${fmt(acct.available)}`:""}</div>
                                  <div className="la-pills">
                                    {spent>0&&<span className="la-pill" style={{background:"var(--debt-bg)",color:"var(--debt)",border:"1px solid rgba(232,115,99,0.2)"}}>−{fmt(spent)} spent</span>}
                                    {income>0&&<span className="la-pill" style={{background:"var(--safe-bg)",color:"var(--safe)",border:"1px solid rgba(93,202,165,0.2)"}}>+{fmt(income)} income</span>}
                                    {!isMobile&&daily>0&&<span className="la-pill" style={{background:"rgba(255,255,255,0.03)",color:"var(--ink-3)",border:"1px solid var(--line)"}}>~{fmt(proj)} proj</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
