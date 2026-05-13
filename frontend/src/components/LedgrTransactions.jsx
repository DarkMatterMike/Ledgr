/**
 * LedgrTransactions.jsx
 * src/components/LedgrTransactions.jsx
 */
import { useState, useMemo } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  :root{--bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;--bg-4:#1c2330;--line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);--line-3:rgba(255,255,255,0.18);--ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;--safe:#5dcaa5;--safe-d:#0f6e56;--safe-bg:rgba(93,202,165,0.08);--warn:#f0b04c;--warn-bg:rgba(240,176,76,0.08);--debt:#e87363;--debt-bg:rgba(232,115,99,0.08);--calm:#6c8cff;--calm-bg:rgba(108,140,255,0.08);--goal:#a78bff;--goal-d:#2a1f5e;--goal-bg:rgba(167,139,255,0.08);--font-display:'Instrument Serif',Georgia,serif;--font-ui:'Geist',-apple-system,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;--r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;}
  .lt-wrap *,.lt-wrap *::before,.lt-wrap *::after{box-sizing:border-box;}
  .lt-wrap h1,.lt-wrap h2,.lt-wrap h3,.lt-wrap h4,.lt-wrap p{margin:0;padding:0;}
  .lt-wrap{font-family:var(--font-ui);color:var(--ink-0);-webkit-font-smoothing:antialiased;background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;}
  @media(max-width:1000px){.lt-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.lt-wrap{padding:0;}}
  .lt-frame{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden;max-width:1400px;margin:0 auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;flex-direction:column;min-height:800px;}
  @media(max-width:600px){.lt-frame{border-radius:0;border:none;}}
  .lt-bar{height:40px;background:var(--bg-2);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 18px;gap:8px;flex-shrink:0;}
  .lt-bar-dot{width:9px;height:9px;border-radius:50%;background:var(--ink-4);}
  .lt-bar-url{margin-left:14px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lt-bar-live{margin-left:auto;display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lt-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .lt-body{display:grid;grid-template-columns:64px 1fr;flex:1;}
  .lt-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);}
  .lt-nav-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d,#0f6e56) 80%);margin-bottom:24px;}
  .lt-nav-item{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;}
  .lt-nav-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .lt-nav-item.active{color:var(--safe);background:var(--safe-bg);}
  .lt-nav-spacer{flex:1;}
  .lt-main{display:flex;flex-direction:column;min-width:0;overflow:hidden;}
  .lt-topbar{height:60px;padding:0 32px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .lt-tb-left{display:flex;align-items:baseline;gap:16px;}
  .lt-tb-num{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lt-tb-title{font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px;}
  .lt-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .lt-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .lt-tb-right{display:flex;align-items:center;gap:14px;}
  .lt-search-box{background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:7px 14px;font-size:12px;color:var(--ink-3);font-family:var(--font-mono);display:flex;align-items:center;gap:8px;min-width:240px;}
  .lt-search-box input{background:none;border:none;outline:none;color:var(--ink-0);font-family:var(--font-mono);font-size:12px;flex:1;}
  .lt-search-box input::placeholder{color:var(--ink-3);}
  .lt-kbd{margin-left:auto;font-size:10px;padding:1px 6px;background:var(--bg-3);border-radius:4px;color:var(--ink-3);}
  .lt-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--goal-d),var(--goal));font-size:11px;display:flex;align-items:center;justify-content:center;color:var(--ink-0);font-weight:500;flex-shrink:0;}
  .lt-summary{display:grid;grid-template-columns:repeat(4,1fr);flex-shrink:0;}
  .lt-sum-cell{padding:14px 32px;border-right:1px solid var(--line);}
  .lt-sum-cell:last-child{border-right:none;}
  .lt-sum-lbl{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px;}
  .lt-sum-val{font-family:var(--font-mono);font-size:20px;font-weight:500;}
  .lt-filters{padding:14px 32px;border-bottom:1px solid var(--line);border-top:1px solid var(--line);display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0;background:var(--bg-1);}
  .lt-select{background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:5px 10px;font-size:11px;font-family:var(--font-mono);color:var(--ink-1);cursor:pointer;outline:none;}
  .lt-btn{background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 12px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:.15s;}
  .lt-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .lt-btn.active{background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe);}
  .lt-btn.primary{background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe);}
  .lt-content{flex:1;overflow-y:auto;}
  .lt-table{width:100%;border-collapse:collapse;}
  .lt-th{font-family:var(--font-mono);font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--ink-3);padding:10px 16px 12px;text-align:left;border-bottom:1px solid var(--line);cursor:pointer;user-select:none;white-space:nowrap;}
  .lt-th:hover{color:var(--ink-1);}
  .lt-th.active{color:var(--safe);}
  .lt-tr{border-bottom:1px solid var(--line);cursor:pointer;transition:background .1s;}
  .lt-tr:hover{background:rgba(255,255,255,0.02);}
  .lt-tr.sel{background:rgba(93,202,165,0.04);}
  .lt-td{padding:11px 16px;vertical-align:middle;font-size:13px;}
  .lt-empty{padding:80px;text-align:center;color:var(--ink-3);}
  .lt-empty-title{font-family:var(--font-display);font-size:28px;color:var(--ink-2);margin-bottom:6px;}
  .lt-pill{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:2px 8px;border-radius:99px;font-family:var(--font-mono);}
  .lt-bulk{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-3);border:1px solid var(--line-2);border-radius:var(--r-xl);padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:50;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:var(--font-mono);font-size:12px;}
`;

const DN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const NAV = [{icon:"◐",id:"dashboard"},{icon:"⇅",id:"transactions",active:true},{icon:"▣",id:"accounts"},{icon:"▦",id:"calendar"},{icon:"◆",id:"goals"}];

export default function LedgrTransactions({
  transactions=[],filteredTxns=[],
  categories=[],catMap={},accounts=[],acctMap={},
  search="",handleTxnSearchChange,
  filterCat="all",setFilterCat,
  filterAcct="all",setFilterAcct,
  txnTypeFilter="all",setTxnTypeFilter,
  txnSortCol="date",setTxnSortCol,
  txnSortDir="desc",setTxnSortDir,
  selectedTxns=new Set(),setSelectedTxns,
  needsReview=()=>false,
  deleteTxn,openAddTxn,openEditTxn,
  bulkSetCategory,bulkDelete,bulkMarkReviewed,
  selectAllVisible,clearSelection,
  txnLoading=false,loadMoreTransactions,
  fmt=n=>`$${Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
  today=new Date(),isMobile=false,navigate=()=>{},
}) {
  const [bulkCatOpen,setBulkCatOpen]=useState(false);
  const initials=accounts[0]?.institution?.slice(0,2).toUpperCase()||"ME";

  const sorted=useMemo(()=>{
    const base=txnTypeFilter==="all"?filteredTxns:txnTypeFilter==="income"?filteredTxns.filter(t=>t.amount>0):filteredTxns.filter(t=>t.amount<0);
    return [...base].sort((a,b)=>{
      let av,bv;
      switch(txnSortCol){
        case"date":    av=a.date||"";bv=b.date||"";break;
        case"merchant":av=(a.name||a.merchant||"").toLowerCase();bv=(b.name||b.merchant||"").toLowerCase();break;
        case"category":av=(catMap[a.categoryId]?.name||"").toLowerCase();bv=(catMap[b.categoryId]?.name||"").toLowerCase();break;
        case"account": av=(acctMap[a.accountId]?.name||"").toLowerCase();bv=(acctMap[b.accountId]?.name||"").toLowerCase();break;
        case"amount":  av=Math.abs(a.amount);bv=Math.abs(b.amount);break;
        default:       av=a.date||"";bv=b.date||"";
      }
      if(av<bv) return txnSortDir==="asc"?-1:1;
      if(av>bv) return txnSortDir==="asc"?1:-1;
      return 0;
    });
  },[filteredTxns,txnTypeFilter,txnSortCol,txnSortDir,catMap,acctMap]);

  const totalSpent =sorted.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const totalInc   =sorted.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const netAmt     =totalInc-totalSpent;
  const toReview   =transactions.filter(t=>needsReview(t)).length;

  function toggleSort(col){
    if(txnSortCol===col) setTxnSortDir(d=>d==="asc"?"desc":"asc");
    else{setTxnSortCol(col);setTxnSortDir(col==="amount"||col==="date"?"desc":"asc");}
  }
  function toggleSel(id){setSelectedTxns(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});}

  const Th=({col,label,align="left"})=>(
    <th className={`lt-th${txnSortCol===col?" active":""}`} style={{textAlign:align}} onClick={()=>toggleSort(col)}>
      {label}{txnSortCol===col?(txnSortDir==="asc"?" ↑":" ↓"):""}
    </th>
  );

  const timeLabel=`${DN[today.getDay()]}, ${MN[today.getMonth()]} ${today.getDate()}`;

  return (
    <>
      <style>{CSS}</style>
      <div className="lt-wrap">
        <div className="lt-frame">
          <div className="lt-bar">
            <div className="lt-bar-dot"/><div className="lt-bar-dot"/><div className="lt-bar-dot"/>
            <span className="lt-bar-url">app.ledgr.app / transactions</span>
            <span className="lt-bar-live">live · synced just now</span>
          </div>
          <div className="lt-body">
            <nav className="lt-nav">
              <div className="lt-nav-logo"/>
              {NAV.map(n=><div key={n.id} className={`lt-nav-item${n.active?" active":""}`} onClick={()=>navigate(n.id)} title={n.id}>{n.icon}</div>)}
              <div className="lt-nav-spacer"/>
              <div className="lt-nav-item" onClick={()=>navigate("settings")}>⚙</div>
            </nav>
            <div className="lt-main">
              <div className="lt-topbar">
                <div className="lt-tb-left">
                  <span className="lt-tb-num">ii ·</span>
                  <span className="lt-tb-title">Transactions</span>
                  <span className="lt-tb-div"/>
                  <span className="lt-tb-sub">{timeLabel}</span>
                </div>
                <div className="lt-tb-right">
                  <div className="lt-search-box">
                    <span style={{color:"var(--ink-2)"}}>⌕</span>
                    <input placeholder="ask anything…" value={search} onChange={handleTxnSearchChange}/>
                    <span className="lt-kbd">⌘K</span>
                  </div>
                  <div className="lt-avatar">{initials}</div>
                  <button className="lt-btn primary" onClick={openAddTxn}>+ Add</button>
                </div>
              </div>

              <div className="lt-summary">
                {[{lbl:"Spent",val:fmt(totalSpent),color:"var(--debt)"},{lbl:"Income",val:fmt(totalInc),color:"var(--safe)"},{lbl:"Net",val:(netAmt>=0?"+":"−")+fmt(Math.abs(netAmt)),color:netAmt>=0?"var(--safe)":"var(--debt)"},{lbl:"To review",val:String(toReview),color:toReview>0?"var(--warn)":"var(--ink-3)"}].map(c=>(
                  <div key={c.lbl} className="lt-sum-cell">
                    <div className="lt-sum-lbl">{c.lbl}</div>
                    <div className="lt-sum-val" style={{color:c.color}}>{c.val}</div>
                  </div>
                ))}
              </div>

              <div className="lt-filters">
                <select className="lt-select" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
                  <option value="all">All Categories</option>
                  {[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="lt-select" value={filterAcct} onChange={e=>setFilterAcct(e.target.value)}>
                  <option value="all">All Accounts</option>
                  {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {[["all","All"],["expense","Expenses"],["income","Income"]].map(([v,l])=>(
                  <button key={v} className={`lt-btn${txnTypeFilter===v?" active":""}`} onClick={()=>setTxnTypeFilter(v)}>{l}</button>
                ))}
                <span style={{marginLeft:"auto",fontFamily:"var(--font-mono)",fontSize:11,color:"var(--ink-3)"}}>{sorted.length} entries</span>
              </div>

              <div className="lt-content">
                {sorted.length===0 ? (
                  <div className="lt-empty"><div className="lt-empty-title">Nothing found</div><div>Adjust your filters or search</div></div>
                ) : (
                  <table className="lt-table">
                    <thead>
                      <tr style={{background:"var(--bg-1)"}}>
                        <th className="lt-th" style={{width:32,paddingLeft:20}}>
                          <input type="checkbox" style={{accentColor:"var(--safe)",cursor:"pointer"}}
                            checked={selectedTxns.size===sorted.length&&sorted.length>0}
                            onChange={e=>e.target.checked?selectAllVisible():clearSelection()}/>
                        </th>
                        <Th col="date"     label="Date"/>
                        <Th col="merchant" label="Merchant"/>
                        <Th col="category" label="Category"/>
                        <Th col="account"  label="Account"/>
                        <Th col="amount"   label="Amount" align="right"/>
                        <th className="lt-th" style={{width:48}}/>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(t=>{
                        const cat=catMap[t.categoryId];
                        const acct=acctMap[t.accountId];
                        const isInc=t.amount>0;
                        const sel=selectedTxns.has(t.id);
                        return (
                          <tr key={t.id} className={`lt-tr${sel?" sel":""}`} onClick={()=>openEditTxn&&openEditTxn(t)}>
                            <td className="lt-td" style={{paddingLeft:20}} onClick={e=>{e.stopPropagation();toggleSel(t.id);}}>
                              <input type="checkbox" checked={sel} onChange={()=>toggleSel(t.id)} style={{accentColor:"var(--safe)",cursor:"pointer"}} onClick={e=>e.stopPropagation()}/>
                            </td>
                            <td className="lt-td">
                              <div style={{fontFamily:"var(--font-mono)",fontSize:12,color:"var(--ink-2)"}}>{t.date}</div>
                              {needsReview(t)&&<span className="lt-pill" style={{background:"var(--warn-bg)",color:"var(--warn)",marginTop:2}}>review</span>}
                            </td>
                            <td className="lt-td">
                              <div style={{fontSize:13,color:"var(--ink-0)",fontWeight:500}}>{t.name||t.merchant}</div>
                              {t.recurring&&<span className="lt-pill" style={{background:"var(--calm-bg)",color:"var(--calm)",marginTop:2}}>↻ recurring</span>}
                            </td>
                            <td className="lt-td">
                              {cat ? (
                                <span className="lt-pill" style={{background:cat.color+"18",color:cat.color,border:`1px solid ${cat.color}30`}}>
                                  <span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
                                  {cat.name}
                                </span>
                              ) : <span style={{color:"var(--ink-4)",fontSize:12,fontFamily:"var(--font-mono)"}}>—</span>}
                            </td>
                            <td className="lt-td"><span style={{fontSize:12,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>{acct?.name||"—"}</span></td>
                            <td className="lt-td" style={{textAlign:"right"}}>
                              <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:isInc?"var(--safe)":"var(--ink-0)"}}>
                                {isInc?"+":"−"}{fmt(Math.abs(t.amount))}
                              </span>
                            </td>
                            <td className="lt-td" onClick={e=>e.stopPropagation()}>
                              <button className="lt-btn" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>deleteTxn&&deleteTxn(t.id)}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {loadMoreTransactions&&(
                  <div style={{padding:"20px 32px",textAlign:"center"}}>
                    <button className="lt-btn" onClick={loadMoreTransactions} disabled={txnLoading} style={{padding:"8px 20px",fontSize:12}}>{txnLoading?"Loading…":"Load more"}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedTxns.size>0&&(
        <div className="lt-bulk">
          <span style={{color:"var(--ink-2)"}}>{selectedTxns.size} selected</span>
          <span style={{width:1,height:16,background:"var(--line-2)",display:"inline-block"}}/>
          {bulkSetCategory&&(
            <div style={{position:"relative"}}>
              <button className="lt-btn" onClick={()=>setBulkCatOpen(p=>!p)}>Categorize ▾</button>
              {bulkCatOpen&&(
                <>
                  <div style={{position:"fixed",inset:0,zIndex:49}} onClick={()=>setBulkCatOpen(false)}/>
                  <div style={{position:"absolute",bottom:"100%",left:0,marginBottom:8,background:"var(--bg-3)",border:"1px solid var(--line-2)",borderRadius:"var(--r-lg)",minWidth:200,maxHeight:280,overflowY:"auto",zIndex:50,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
                    {categories.map(c=>(
                      <button key={c.id} onClick={()=>{bulkSetCategory(c.id);setBulkCatOpen(false);}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"9px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--ink-1)",textAlign:"left"}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {bulkMarkReviewed&&<button className="lt-btn" onClick={()=>bulkMarkReviewed(true)}>Mark reviewed</button>}
          {bulkDelete&&<button className="lt-btn" style={{color:"var(--debt)",borderColor:"rgba(232,115,99,0.3)"}} onClick={()=>{if(window.confirm(`Delete ${selectedTxns.size} transactions?`))bulkDelete();}}>Delete</button>}
          <button className="lt-btn" onClick={clearSelection}>✕ Clear</button>
        </div>
      )}
    </>
  );
}
