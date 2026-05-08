/**
 * DaniPage.jsx — Owner-only personal spending power + wishlist tracker
 * Two independent tabs, each with their own account selection and wishlist.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";

const fmt = n => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(n ?? 0);
const today = new Date();

/* ── Colour tokens ──────────────────────────────────────────────── */
const C = {
  card:"var(--card)",surface:"var(--surface)",border:"var(--border)",border2:"var(--border2)",
  t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t2)",cyan:"var(--cyan)",green:"var(--green)",
  red:"var(--red)",amber:"var(--amber)",cyanDim:"var(--cyan-dim)",greenDim:"var(--green-dim)",
  redDim:"var(--red-dim)",amberDim:"var(--amber-dim)",radius:"var(--radius)",
  radiusLg:"var(--radius-lg)",fontMono:"var(--font-mono)",fontDisp:"var(--font-disp)",fontBody:"var(--font-body)",
};

/* ── Style helpers ──────────────────────────────────────────────── */
const card=(x={})=>({background:C.card,border:`1px solid ${C.border}`,borderRadius:C.radiusLg,padding:"12px 16px",...x});
const btn=(variant="ghost",sm=false)=>{
  const base={display:"inline-flex",alignItems:"center",gap:5,padding:sm?"3px 8px":"5px 11px",borderRadius:C.radius,fontSize:12,fontWeight:500,cursor:"pointer",border:"1px solid transparent",transition:"all 0.15s",userSelect:"none",lineHeight:"1.4",whiteSpace:"nowrap",fontFamily:C.fontBody};
  if(variant==="primary") return{...base,background:C.cyan,color:"#000",borderColor:C.cyan};
  if(variant==="danger")  return{...base,background:C.redDim,color:C.red,borderColor:"#ff4d6d44"};
  if(variant==="green")   return{...base,background:C.greenDim,color:C.green,borderColor:"#00e67644"};
  return{...base,background:"transparent",color:C.t2,borderColor:C.border2};
};
const inp=(x={})=>({background:C.surface,border:`1px solid ${C.border2}`,borderRadius:C.radius,padding:"7px 10px",fontSize:12,color:C.t1,outline:"none",width:"100%",fontFamily:C.fontBody,boxSizing:"border-box",...x});
const lbl={fontSize:10,color:C.t2,textTransform:"uppercase",letterSpacing:"1px",fontWeight:600,marginBottom:4,display:"block",fontFamily:C.fontDisp};
const cardTitle={fontFamily:C.fontDisp,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.5px",color:C.t2,marginBottom:10};

/* ── DST-safe biweekly projection (mirrors calendar logic) ──────── */
function getOccurrenceDaysThisMonth(t) {
  const yr=today.getFullYear(),mo=today.getMonth();
  const daysInMo=new Date(yr,mo+1,0).getDate();
  const freq=t.recurringFreq||"monthly";
  const start=t.recurringStart?new Date(t.recurringStart+"T12:00:00"):null;
  if(freq==="monthly"){const d=parseInt(t.recurringDay||0);return d>=1&&d<=daysInMo?[d]:[];}
  if(freq==="annual"){return start&&start.getMonth()===mo?[start.getDate()]:[]; }
  if(freq==="weekly"||freq==="biweekly"){
    if(!start){const d=parseInt(t.recurringDay||0);return d>=1&&d<=daysInMo?[d]:[];}
    const interval=freq==="weekly"?7:14;
    let cur=new Date(start.getFullYear(),start.getMonth(),start.getDate());
    const mStart=new Date(yr,mo,1);
    while(cur>=mStart) cur=new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()-interval);
    const days=[];
    for(let i=0;i<60;i++){
      cur=new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()+interval);
      if(cur.getFullYear()===yr&&cur.getMonth()===mo) days.push(cur.getDate());
      if(cur.getFullYear()>yr||(cur.getFullYear()===yr&&cur.getMonth()>mo)) break;
    }
    return days;
  }
  return [];
}

/* ════════════════════════════════════════════════════════════════════
   DaniTab — one full tab: account selector + wishlist + balance card
   ════════════════════════════════════════════════════════════════════ */
function DaniTab({ accounts, recurringTxns, recurringItems=[], tabData, onTabSave, isMobile, tabKey }) {
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    try { const v = localStorage.getItem("dani_accountId_"+tabKey) || (tabKey==="tab1"?localStorage.getItem("dani_accountId"):null); if (v) return v; } catch {}
    return tabData.selectedAccountId || null;
  });
  const [wishlist, setWishlist] = useState(() => {
    try {
      // Check tab-specific key first, then migrate from old flat key (tab1 only)
      const v = localStorage.getItem("dani_wishlist_"+tabKey) || (tabKey==="tab1"?localStorage.getItem("dani_wishlist"):null);
      if (v) { const p = JSON.parse(v); if (p?.length) return p; }
    } catch {}
    return tabData.wishlist || [];
  });

  // Sync when server data arrives (only if local state is still empty)
  const prevRef=useRef(null);
  useEffect(()=>{
    const key=JSON.stringify(tabData);
    if(prevRef.current===key) return;
    prevRef.current=key;
    if(tabData.selectedAccountId) setSelectedAccountId(id => id || tabData.selectedAccountId);
    setWishlist(prev=>(!prev.length&&tabData.wishlist?.length)?tabData.wishlist:prev);
  },[tabData]);

  const [formName,setFormName]=useState("");
  const [formCost,setFormCost]=useState("");
  const [editingId,setEditingId]=useState(null);
  const [editingCost,setEditingCost]=useState("");
  const dragIdx=useRef(null);
  const [dragOver,setDragOver]=useState(null);

  function updateAccount(id){
    setSelectedAccountId(id);
    try { localStorage.setItem("dani_accountId_"+tabKey, id); } catch {}
    onTabSave({selectedAccountId:id,wishlist});
  }
  function updateWishlist(next){
    setWishlist(next);
    try { localStorage.setItem("dani_wishlist_"+tabKey, JSON.stringify(next)); } catch {}
    onTabSave({selectedAccountId,wishlist:next});
  }
  function startEdit(item){setEditingId(item.id);setEditingCost(String(item.cost));}
  function commitEdit(id){
    const cost=parseFloat(editingCost);
    if(!isNaN(cost)&&cost>0) updateWishlist(wishlist.map(w=>w.id===id?{...w,cost}:w));
    setEditingId(null);setEditingCost("");
  }
  function addItem(){
    const name=formName.trim(),cost=parseFloat(formCost);
    if(!name||isNaN(cost)||cost<=0) return;
    updateWishlist([...wishlist,{id:`w${Date.now()}`,name,cost,purchased:false,addedAt:Date.now()}]);
    setFormName("");setFormCost("");
  }
  function markPurchased(id){updateWishlist(wishlist.filter(w=>w.id!==id));}
  function deleteItem(id){updateWishlist(wishlist.filter(w=>w.id!==id));}
  function onDragStart(i){dragIdx.current=i;}
  function onDragEnter(i){setDragOver(i);}
  function onDragEnd(){
    if(dragIdx.current===null||dragOver===null||dragIdx.current===dragOver){dragIdx.current=null;setDragOver(null);return;}
    const next=[...wishlist];const[moved]=next.splice(dragIdx.current,1);next.splice(dragOver,0,moved);
    dragIdx.current=null;setDragOver(null);updateWishlist(next);
  }

  const account=accounts.find(a=>a.id===selectedAccountId)||accounts[0]||null;
  const balance=account?.balance??0;

  // Merge recurringItems into recurring txn format for upcoming calculations
  const allRecurring = useMemo(() => {
    const fromItems = recurringItems.map(item => ({
      id: "ri_" + item.id,
      name: item.name,
      merchant: item.name,
      accountId: item.accountId,
      categoryId: item.categoryId,
      recurringFreq: item.recurringFreq || "monthly",
      recurringDay: item.recurringDay,
      recurringStart: item.recurringStart,
      amount: item.type === "income"
        ? (item.amountMin || 0)
        : -(item.amountMin || 0),
    }));
    return [...recurringTxns, ...fromItems];
  }, [recurringTxns, recurringItems]);

  const freeToSpend=useMemo(()=>{
    if(!account) return 0;
    const todayDay=today.getDate(),DEDUCTION=1100;
    let expenses=0,income=0;
    allRecurring.forEach(t=>{
      if(account&&t.accountId&&t.accountId!==account.id) return;
      const days=getOccurrenceDaysThisMonth(t).filter(d=>d>todayDay);
      if(!days.length) return;
      if(t.amount<0) expenses+=Math.abs(t.amount)*days.length;
      else income+=Math.max(0,t.amount-DEDUCTION)*days.length;
    });
    return Math.max(0, (balance-100)-expenses+income);
  },[account,allRecurring,balance]);

  const upcomingBills=useMemo(()=>{
    if(!account) return[];
    const todayDay=today.getDate(),rows=[];
    allRecurring.forEach(t=>{
      if(account&&t.accountId&&t.accountId!==account.id) return;
      getOccurrenceDaysThisMonth(t).filter(d=>d>todayDay).forEach(d=>rows.push({...t,_occurrenceDay:d}));
    });
    return rows.sort((a,b)=>a._occurrenceDay-b._occurrenceDay);
  },[allRecurring,account]);

  const{wishlistWithStatus,nextPayday}=useMemo(()=>{
    const todayDay=today.getDate(),yr=today.getFullYear(),mo=today.getMonth();
    const daysInMo=new Date(yr,mo+1,0).getDate(),DEDUCTION=1100;
    const start=Math.max(0,(balance??0)-100);
    const baseBalance={};baseBalance[todayDay]=start;
    for(let d=todayDay+1;d<=daysInMo;d++){
      let delta=0;
      allRecurring.forEach(t=>{
        if(account&&t.accountId&&t.accountId!==account.id) return;
        const days=getOccurrenceDaysThisMonth(t);
        if(!days.includes(d)) return;
        if(t.amount<0) delta+=t.amount;
        else delta+=Math.max(0,t.amount-DEDUCTION);
      });
      baseBalance[d]=(baseBalance[d-1]??start)+delta;
    }
    let np=null;
    for(let d=todayDay+1;d<=daysInMo;d++){
      let found=null;
      allRecurring.forEach(t=>{
        if(found||t.amount<=0) return;
        if(account&&t.accountId&&t.accountId!==account.id) return;
        if(getOccurrenceDaysThisMonth(t).includes(d)) found=t;
      });
      if(found){np={day:d,date:new Date(yr,mo,d).toLocaleDateString("en-US",{month:"short",day:"numeric"}),amount:found.amount,net:Math.max(0,found.amount-DEDUCTION),daysAway:d-todayDay};break;}
    }
    const committed={};
    const addCommit=(d,cost)=>{committed[d]=(committed[d]||0)+cost;};
    const availableOn=(d)=>{
      const base=baseBalance[d]??baseBalance[daysInMo]??0;
      let used=0;for(const[k,v] of Object.entries(committed)){if(Number(k)<=d)used+=v;}
      return base-used;
    };
    const enriched=wishlist.map(item=>{
      if(item.purchased) return{...item,status:"purchased",availableDay:null,availableDate:null,balanceAfter:null};
      for(let d=todayDay;d<=daysInMo;d++){
        const avail=availableOn(d);
        if(avail>=item.cost){
          addCommit(d,item.cost);const after=avail-item.cost;
          if(d===todayDay) return{...item,status:"now",availableDay:d,availableDate:"Now",balanceAfter:after};
          return{...item,status:"soon",availableDay:d,availableDate:new Date(yr,mo,d).toLocaleDateString("en-US",{month:"short",day:"numeric"}),balanceAfter:after};
        }
      }
      return{...item,status:"wait",availableDay:null,availableDate:null,balanceAfter:null};
    });
    return{wishlistWithStatus:enriched,nextPayday:np};
  },[wishlist,balance,allRecurring,account]);

  return(
    <div>
      {/* Account selector */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",marginBottom:10}}>
        <select value={selectedAccountId||""} onChange={e=>updateAccount(e.target.value)}
          style={{background:C.surface,border:`1px solid ${C.border2}`,borderRadius:C.radius,padding:"5px 8px",fontSize:11,color:C.t1,outline:"none",cursor:"pointer"}}>
          {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Two-column layout */}
      <div style={{display:isMobile?"flex":"grid",flexDirection:"column-reverse",gridTemplateColumns:"minmax(0,1fr) 320px",gap:10,alignItems:"start",width:"100%"}}>

        {/* LEFT: Wishlist */}
        <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",minWidth:0}}>
          {/* Add form */}
          <div style={card()}>
            <div style={cardTitle}>Add to Wishlist</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,alignItems:"end"}}>
              <div>
                <span style={lbl}>Item name</span>
                <input style={inp()} placeholder="e.g. AirPods Pro" value={formName}
                  onChange={e=>setFormName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()}/>
              </div>
              <div>
                <span style={lbl}>Cost</span>
                <input style={inp({width:100,fontFamily:C.fontMono})} type="number" min="0" step="0.01"
                  placeholder="0.00" value={formCost}
                  onChange={e=>setFormCost(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()}/>
              </div>
              <button style={{...btn("primary"),padding:"7px 14px",lineHeight:"normal"}} onClick={addItem}>+ Add</button>
            </div>
          </div>

          {/* Wishlist */}
          <div style={card({padding:0,overflow:"hidden"})}>
            <div style={{padding:"10px 14px 8px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={cardTitle}>Wishlist</div>
              {wishlist.length>0&&<div style={{fontSize:10,color:C.t2}}>Drag to reorder priority</div>}
            </div>
            {wishlist.length===0?(
              <div style={{padding:"32px 16px",textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:8,opacity:0.3}}>🛍️</div>
                <div style={{fontSize:12,color:C.t2}}>No items yet — add something above</div>
              </div>
            ):(
              <div>
                {wishlistWithStatus.map((item,i)=>{
                  const isNow=item.status==="now",isSoon=item.status==="soon";
                  const isDragging=dragOver===i;
                  const isPayment=item.name.toLowerCase().includes("payment");
                  return(
                    <div key={item.id} draggable
                      onDragStart={()=>onDragStart(i)} onDragEnter={()=>onDragEnter(i)}
                      onDragEnd={onDragEnd} onDragOver={e=>e.preventDefault()}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",
                        borderBottom:i<wishlist.length-1?`1px solid ${C.border}`:"none",
                        borderTop:isDragging?`2px solid ${C.cyan}`:"2px solid transparent",
                        background:isDragging?C.cyanDim:"transparent",cursor:"grab"}}>
                      <div style={{color:C.t2,fontSize:14,flexShrink:0,cursor:"grab",lineHeight:1,userSelect:"none"}}>⠿</div>
                      <div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,
                        background:isNow?C.cyanDim:isSoon?C.amberDim:C.surface,
                        border:`1px solid ${isNow?C.cyan+"66":isSoon?C.amber+"66":C.border2}`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:10,fontFamily:C.fontMono,fontWeight:700,
                        color:isNow?C.cyan:isSoon?C.amber:C.t2}}>
                        {i+1}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                        <div style={{marginTop:3,display:"flex",alignItems:"center",gap:6}}>
                          {isNow?(<span style={{fontSize:10,fontWeight:600,color:C.green,background:C.greenDim,padding:"1px 6px",borderRadius:99,border:`1px solid ${C.green}33`}}>✓ Buy now</span>)
                            :isSoon?(<span style={{fontSize:10,fontWeight:600,color:C.amber,background:C.amberDim,padding:"1px 6px",borderRadius:99,border:`1px solid ${C.amber}33`}}>After {item.availableDate}</span>)
                            :(<span style={{fontSize:10,fontWeight:600,color:C.t2,background:C.surface,padding:"1px 6px",borderRadius:99,border:`1px solid ${C.border2}`}}>Not this month</span>)}
                          {(isNow||isSoon)&&item.balanceAfter!=null&&(
                            <span style={{fontSize:10,color:C.t2}}>{fmt(item.balanceAfter)} left after</span>
                          )}
                        </div>
                      </div>
                      {editingId===item.id?(
                        <input autoFocus type="number" min="0" step="0.01" value={editingCost}
                          onChange={e=>setEditingCost(e.target.value)}
                          onBlur={()=>commitEdit(item.id)}
                          onKeyDown={e=>{if(e.key==="Enter")commitEdit(item.id);if(e.key==="Escape")setEditingId(null);}}
                          style={{width:80,fontFamily:C.fontMono,fontSize:12,fontWeight:700,color:C.t1,background:C.surface,border:`1px solid ${C.cyan}`,borderRadius:C.radius,padding:"3px 6px",outline:"none",textAlign:"right"}}/>
                      ):(
                        <div title="Click to edit cost" onClick={()=>startEdit(item)}
                          style={{fontFamily:C.fontMono,fontSize:13,fontWeight:700,color:C.t1,flexShrink:0,cursor:"text",borderBottom:`1px dashed ${C.border2}`,paddingBottom:1}}>
                          {fmt(item.cost)}
                        </div>
                      )}
                      <div style={{display:"flex",gap:4,flexShrink:0}}>
                        <button title={isPayment?"Mark as paid":"Mark as purchased"}
                          onClick={()=>markPurchased(item.id)} style={btn("ghost",true)}
                          onMouseEnter={e=>{e.currentTarget.style.background=C.greenDim;e.currentTarget.style.color=C.green;e.currentTarget.style.borderColor=C.green+"44";}}
                          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.t2;e.currentTarget.style.borderColor=C.border2;}}>
                          {isPayment?"✓ Paid":"✓ Bought"}
                        </button>
                        <button title="Remove" onClick={()=>deleteItem(item.id)}
                          style={{background:"none",border:"none",cursor:"pointer",color:C.t2,fontSize:15,padding:"2px 4px",lineHeight:1}}>×</button>
                      </div>
                    </div>
                  );
                })}
                <div style={{padding:"10px 14px",background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:11,color:C.t2}}>{wishlist.length} item{wishlist.length!==1?"s":""} · {wishlistWithStatus.filter(w=>w.status==="now").length} affordable now</span>
                  <span style={{fontFamily:C.fontMono,fontSize:12,fontWeight:700,color:C.t1}}>{fmt(wishlist.reduce((s,w)=>s+w.cost,0))} total</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Balance card */}
        <div style={{display:"flex",flexDirection:"column",gap:10,position:isMobile?"static":"sticky",top:16,width:"100%",minWidth:0}}>
          <div style={card({padding:0,overflow:"hidden"})}>
            <div style={{padding:"14px 16px 10px",background:C.surface,borderBottom:`1px solid ${C.border}`}}>
              <div style={cardTitle}>Free to Spend</div>
              <div style={{fontFamily:C.fontMono,fontSize:32,fontWeight:700,color:freeToSpend>0?C.green:C.amber,lineHeight:1}}>{fmt(freeToSpend)}</div>
              <div style={{fontSize:11,color:C.t2,marginTop:4}}>After upcoming bills through end of {today.toLocaleDateString("en-US",{month:"long"})}</div>
            </div>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:11,color:C.t2}}>{account?.name||"—"}</div>
                  <div style={{fontFamily:C.fontMono,fontSize:16,fontWeight:600,color:C.cyan}}>{fmt(balance)}</div>
                </div>
                <div style={{fontSize:10,color:C.t2,textAlign:"right"}}>Current balance</div>
              </div>
            </div>
            {nextPayday&&(
              <div style={{padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>💸</span>
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:C.t1}}>Next payday</div>
                    <div style={{fontSize:10,color:C.t2}}>{nextPayday.date} · {nextPayday.daysAway}d away</div>
                  </div>
                </div>
                <div style={{fontFamily:C.fontMono,fontSize:12,fontWeight:700,color:C.green}}>+{fmt(nextPayday.amount)}</div>
              </div>
            )}
          </div>

          <div style={card({padding:0,overflow:"hidden"})}>
            <div style={{padding:"10px 14px 8px",borderBottom:`1px solid ${C.border}`}}>
              <div style={cardTitle}>Upcoming This Month</div>
            </div>
            {upcomingBills.length===0?(
              <div style={{padding:"20px 14px",textAlign:"center",fontSize:12,color:C.t2}}>No upcoming transactions</div>
            ):(
              <div>
                {upcomingBills.map((t,i)=>(
                  <div key={`${t.id}-${t._occurrenceDay}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:i<upcomingBills.length-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:C.surface,border:`1px solid ${C.border2}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:10,fontFamily:C.fontMono,color:C.t2}}>{t._occurrenceDay}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:C.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                    </div>
                    <div style={{fontFamily:C.fontMono,fontSize:12,fontWeight:600,color:t.amount<0?C.red:C.green,flexShrink:0}}>
                      {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
                    </div>
                  </div>
                ))}
                {(()=>{
                  const billsTotal=upcomingBills.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
                  const incomeTotal=upcomingBills.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
                  return(
                    <div style={{padding:"8px 14px",background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",fontSize:11}}>
                      <span style={{color:C.red}}>−{fmt(billsTotal)} bills</span>
                      {incomeTotal>0&&<span style={{color:C.green}}>+{fmt(incomeTotal)} income</span>}
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

/* ════════════════════════════════════════════════════════════════════
   DaniPage — tab shell
   ════════════════════════════════════════════════════════════════════ */
const TABS=["tab1","tab2"];
const TAB_LABELS=["Stearns","Cap1 Child"];

export default function DaniPage({accounts=[],transactions=[],recurringTxns=[],recurringItems=[],daniData={},isMobile=false,onSave}){
  const[activeTab,setActiveTab]=useState("tab1");

  // Normalise old flat shape → { tab1, tab2 }
  const normalised=useMemo(()=>{
    if(daniData.tab1||daniData.tab2) return daniData;
    if(daniData.wishlist||daniData.selectedAccountId)
      return{tab1:{selectedAccountId:daniData.selectedAccountId||null,wishlist:daniData.wishlist||[]},tab2:{selectedAccountId:null,wishlist:[]}};
    return{tab1:{selectedAccountId:null,wishlist:[]},tab2:{selectedAccountId:null,wishlist:[]}};
  },[daniData]);

  function handleTabSave(tabKey,tabPatch){
    onSave?.({dani:{...normalised,[tabKey]:tabPatch}});
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div>
          <div style={{fontFamily:"var(--font-disp)",fontSize:14,fontWeight:700,color:"var(--t1)"}}>Dani</div>
          <div style={{fontSize:11,color:"var(--t2)",marginTop:2}}>Spending power & wishlist</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",gap:3,background:"var(--surface)",borderRadius:"var(--radius)",padding:4,...(isMobile?{width:"100%"}:{display:"inline-flex"})}}>
          {TABS.map((t,i)=>{
            const active=activeTab===t;
            return(
              <button key={t} onClick={()=>setActiveTab(t)} style={{
                padding:"7px 8px",borderRadius:"var(--radius)",fontSize:12,fontWeight:500,
                cursor:"pointer",border:"1px solid transparent",
                background:active?"var(--cyan)":"transparent",
                color:active?"#000":"var(--t2)",transition:"all 0.15s",whiteSpace:"nowrap",
                textAlign:"center",flex:isMobile?1:undefined,
              }}>{TAB_LABELS[i]}</button>
            );
          })}
        </div>
      </div>

      {TABS.map(t=>(
        <div key={t} style={{display:activeTab===t?"block":"none"}}>
          <DaniTab
            accounts={accounts}
            recurringTxns={recurringTxns}
            recurringItems={recurringItems}
            tabData={normalised[t]||{selectedAccountId:null,wishlist:[]}}
            onTabSave={patch=>handleTabSave(t,patch)}
            isMobile={isMobile}
            tabKey={t}
          />
        </div>
      ))}
    </div>
  );
}
