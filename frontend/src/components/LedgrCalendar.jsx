/**
 * LedgrCalendar.jsx
 * src/components/LedgrCalendar.jsx
 */
import { useState, useMemo } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  :root{--bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;--bg-4:#1c2330;--line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);--line-3:rgba(255,255,255,0.18);--ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;--safe:#5dcaa5;--safe-d:#0f6e56;--safe-bg:rgba(93,202,165,0.08);--warn:#f0b04c;--warn-bg:rgba(240,176,76,0.08);--debt:#e87363;--debt-bg:rgba(232,115,99,0.08);--calm:#6c8cff;--calm-bg:rgba(108,140,255,0.08);--goal:#a78bff;--goal-d:#2a1f5e;--font-display:'Instrument Serif',Georgia,serif;--font-ui:'Geist',-apple-system,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;--r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;}
  .lc-wrap *,.lc-wrap *::before,.lc-wrap *::after{box-sizing:border-box;}
  .lc-wrap h1,.lc-wrap h2,.lc-wrap h3,.lc-wrap h4,.lc-wrap p{margin:0;padding:0;}
  .lc-wrap{font-family:var(--font-ui);color:var(--ink-0);-webkit-font-smoothing:antialiased;background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;}
  @media(max-width:1000px){.lc-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.lc-wrap{padding:0;}}
  .lc-frame{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden;max-width:1400px;margin:0 auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;flex-direction:column;min-height:800px;}
  @media(max-width:600px){.lc-frame{border-radius:0;border:none;}}
  .lc-bar{height:40px;background:var(--bg-2);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 18px;gap:8px;flex-shrink:0;}
  .lc-bar-dot{width:9px;height:9px;border-radius:50%;background:var(--ink-4);}
  .lc-bar-url{margin-left:14px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lc-bar-live{margin-left:auto;display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lc-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .lc-body{display:grid;grid-template-columns:64px 280px 1fr;flex:1;}
  @media(max-width:900px){.lc-body{grid-template-columns:64px 1fr;}}
  .lc-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);}
  .lc-nav-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d) 80%);margin-bottom:24px;}
  .lc-nav-item{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;}
  .lc-nav-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .lc-nav-item.active{color:var(--safe);background:var(--safe-bg);}
  .lc-nav-spacer{flex:1;}
  .lc-aside{border-right:1px solid var(--line);background:var(--bg-1);padding:24px 20px;overflow-y:auto;}
  @media(max-width:900px){.lc-aside{display:none;}}
  .lc-cal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
  .lc-cal-title{font-family:var(--font-display);font-size:20px;letter-spacing:-0.3px;}
  .lc-cal-navs{display:flex;gap:6px;}
  .lc-cal-navs span{width:22px;height:22px;border-radius:6px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--ink-2);font-size:11px;cursor:pointer;}
  .lc-cal-dow{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:6px;}
  .lc-cal-dow span{font-size:9px;color:var(--ink-3);text-align:center;}
  .lc-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
  .lc-day{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink-1);font-family:var(--font-mono);position:relative;cursor:pointer;transition:background .1s;}
  .lc-day:hover{background:rgba(255,255,255,0.04);}
  .lc-day.muted{color:var(--ink-4);}
  .lc-day.today{background:var(--bg-3);color:var(--safe);border:1px solid rgba(93,202,165,0.3);}
  .lc-day.sel{background:rgba(93,202,165,0.12);color:var(--safe);border:1px solid rgba(93,202,165,0.4);}
  .lc-day::after{content:'';position:absolute;bottom:3px;width:4px;height:4px;border-radius:50%;display:none;}
  .lc-day.has-bill::after{display:block;background:var(--debt);}
  .lc-day.has-inc::after{display:block;background:var(--safe);}
  .lc-day.has-mix::after{display:block;background:var(--warn);box-shadow:5px 0 0 var(--debt);}
  .lc-mstats{border-top:1px solid var(--line);padding-top:16px;margin-top:4px;display:flex;flex-direction:column;gap:8px;}
  .lc-mrow{display:flex;justify-content:space-between;align-items:center;font-size:12px;}
  .lc-mrow .l{color:var(--ink-2);}
  .lc-mrow .v{font-family:var(--font-mono);}
  .lc-ri-lbl{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);margin:16px 0 10px;padding-top:14px;border-top:1px solid var(--line);}
  .lc-ri-item{display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);cursor:pointer;}
  .lc-ri-day{font-family:var(--font-display);font-size:20px;color:var(--ink-1);line-height:1;}
  .lc-ri-add{margin-top:12px;padding:10px;border:1px solid rgba(240,176,76,0.25);border-radius:var(--r-md);text-align:center;color:var(--warn);font-size:11px;cursor:pointer;font-family:var(--font-mono);}
  .lc-right{overflow-y:auto;display:flex;flex-direction:column;}
  .lc-topbar{height:60px;padding:0 32px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg-1);z-index:10;flex-shrink:0;}
  .lc-tb-left{display:flex;align-items:baseline;gap:16px;}
  .lc-tb-num{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lc-tb-title{font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px;}
  .lc-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .lc-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .lc-tb-right{display:flex;align-items:center;gap:10px;}
  .lc-search{background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:7px 14px;font-size:12px;color:var(--ink-3);font-family:var(--font-mono);display:flex;align-items:center;gap:8px;min-width:240px;}
  .lc-kbd{margin-left:auto;font-size:10px;padding:1px 6px;background:var(--bg-3);border-radius:4px;color:var(--ink-3);}
  .lc-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--goal-d),var(--goal));font-size:11px;display:flex;align-items:center;justify-content:center;color:var(--ink-0);font-weight:500;flex-shrink:0;}
  .lc-nav-btn{background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 12px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:.15s;}
  .lc-nav-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .lc-agenda{padding:24px 32px;flex:1;}
  .lc-aday{margin-bottom:2px;}
  .lc-aday-hdr{display:flex;align-items:center;gap:8px;padding:5px 0;margin-bottom:2px;}
  .lc-day-chip{font-family:var(--font-mono);font-size:11px;font-weight:500;color:var(--ink-3);min-width:42px;white-space:nowrap;}
  .lc-day-chip.today{color:var(--safe);}
  .lc-today-pill{font-family:var(--font-mono);font-size:9px;font-weight:600;background:var(--safe);color:#07090d;border-radius:99px;padding:2px 9px;letter-spacing:0.5px;white-space:nowrap;flex-shrink:0;}
  .lc-day-rule{flex:1;height:1px;background:rgba(255,255,255,0.04);}
  .lc-day-rule.today{background:rgba(93,202,165,0.3);}
  .lc-event{display:flex;align-items:center;gap:7px;padding:4px 0 4px 42px;}
  .lc-event-bar{width:4px;height:26px;border-radius:2px;flex-shrink:0;}
  .lc-event-body{flex:1;min-width:0;display:flex;align-items:center;gap:5px;}
  .lc-event-name{font-size:12px;color:var(--ink-1);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .lc-event-tag{font-size:9px;padding:1px 5px;border-radius:4px;font-family:var(--font-mono);flex-shrink:0;}
  .lc-event-tag.posted{background:var(--safe-bg);color:var(--safe);}
  .lc-event-tag.upcoming{background:var(--warn-bg);color:var(--warn);}
  .lc-event-tag.rec{background:var(--calm-bg);color:var(--calm);}
  .lc-event-amt{font-family:var(--font-mono);font-size:12px;font-weight:500;flex-shrink:0;}
  .lc-event-amt.income{color:var(--safe);}
  .lc-event-amt.expense{color:var(--debt);}
  .lc-empty-day{padding:3px 0 3px 42px;font-size:11px;color:var(--ink-4);font-style:italic;}
`;

const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const NAV=[{icon:"◐",id:"dashboard"},{icon:"⇅",id:"transactions"},{icon:"▣",id:"accounts"},{icon:"◉",id:"budgets"},{icon:"▦",id:"calendar",active:true},{icon:"◆",id:"goals"}];
function daysInM(y,m){return new Date(y,m,0).getDate();}

export default function LedgrCalendar({
  accounts=[],calendarMonth="",calendarTxnsByDay={},recurringItems=[],
  transactions=[],catMap={},acctMap={},
  prevCalMonth,nextCalMonth,openNewRecurringItem,openEditRecurringItem,
  fmt=n=>`$${Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
  today=new Date(),isMobile=false,navigate=()=>{},
}) {
  const now=calendarMonth||`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  const [cy,cm]=now.split("-").map(Number);
  const [selDay,setSelDay]=useState(cy===today.getFullYear()&&cm===today.getMonth()+1?today.getDate():1);
  const isCurMo=cy===today.getFullYear()&&cm===today.getMonth()+1;

  const first=new Date(cy,cm-1,1).getDay();
  const dim=daysInM(cy,cm);
  const dimp=daysInM(cy,cm-1===0?12:cm-1);

  const cells=useMemo(()=>{
    const arr=[];
    for(let i=first-1;i>=0;i--) arr.push({d:dimp-i,muted:true});
    for(let d=1;d<=dim;d++){
      const txns=calendarTxnsByDay[d]||[];
      const hasInc=txns.some(t=>t.amount>0);
      const hasBill=txns.some(t=>t.amount<0);
      arr.push({d,isToday:isCurMo&&d===today.getDate(),isSel:d===selDay,hasMix:hasInc&&hasBill,hasInc:hasInc&&!hasBill,hasBill:hasBill&&!hasInc});
    }
    while(arr.length<42) arr.push({d:arr.length-first-dim+1,muted:true});
    return arr;
  },[cy,cm,calendarTxnsByDay,first,dim,dimp,isCurMo,today,selDay]);

  const monthTxns=Object.values(calendarTxnsByDay).flat();
  const monthSpent=monthTxns.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const monthIncome=monthTxns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const billsLeft=recurringItems.filter(r=>r.type!=="income"&&r.recurringDay&&isCurMo&&parseInt(r.recurringDay)>today.getDate()).reduce((s,r)=>s+(r.amountMin||0),0);

  const agendaDays=useMemo(()=>{
    const s=new Set();
    Object.keys(calendarTxnsByDay).forEach(d=>s.add(parseInt(d)));
    recurringItems.forEach(r=>{if(r.recurringDay)s.add(parseInt(r.recurringDay));});
    if(isCurMo) s.add(today.getDate());
    return [...s].sort((a,b)=>a-b);
  },[calendarTxnsByDay,recurringItems,isCurMo,today]);

  const initials=accounts[0]?.institution?.slice(0,2).toUpperCase()||"ME";

  return (
    <>
      <style>{CSS}</style>
      <div className="lc-wrap">
        <div className="lc-frame">
          <div className="lc-bar">
            <div className="lc-bar-dot"/><div className="lc-bar-dot"/><div className="lc-bar-dot"/>
            <span className="lc-bar-url">app.ledgr.app / calendar</span>
            <span className="lc-bar-live">live · synced just now</span>
          </div>
          <div className="lc-body">
            <nav className="lc-nav">
              <div className="lc-nav-logo"/>
              {NAV.map(n=><div key={n.id} className={`lc-nav-item${n.active?" active":""}`} onClick={()=>navigate(n.id)} title={n.id}>{n.icon}</div>)}
              <div className="lc-nav-spacer"/>
              <div className="lc-nav-item" onClick={()=>navigate("settings")}>⚙</div>
            </nav>

            <aside className="lc-aside">
              <div className="lc-cal-head">
                <div className="lc-cal-title">{MN[cm-1]} {cy}</div>
                <div className="lc-cal-navs"><span onClick={prevCalMonth}>‹</span><span onClick={nextCalMonth}>›</span></div>
              </div>
              <div className="lc-cal-dow">{["S","M","T","W","T","F","S"].map((d,i)=><span key={i}>{d}</span>)}</div>
              <div className="lc-cal-grid">
                {cells.map((c,i)=>{
                  let cls="lc-day";
                  if(c.muted) cls+=" muted";
                  if(c.isToday) cls+=" today";
                  if(!c.muted&&c.isSel&&!c.isToday) cls+=" sel";
                  if(c.hasMix) cls+=" has-mix";
                  else if(c.hasBill) cls+=" has-bill";
                  else if(c.hasInc) cls+=" has-inc";
                  return <div key={i} className={cls} onClick={()=>!c.muted&&setSelDay(c.d)}>{c.d}</div>;
                })}
              </div>
              <div className="lc-mstats">
                <div className="lc-mrow"><span className="l">Month spent</span><span className="v" style={{color:"var(--debt)"}}>−{fmt(monthSpent)}</span></div>
                <div className="lc-mrow"><span className="l">Month income</span><span className="v" style={{color:"var(--safe)"}}>+{fmt(monthIncome)}</span></div>
                <div className="lc-mrow"><span className="l">Bills remaining</span><span className="v" style={{color:billsLeft>0?"var(--warn)":"var(--ink-3)"}}>{billsLeft>0?`−${fmt(billsLeft)}`:"—"}</span></div>
                <div className="lc-mrow"><span className="l">Net</span><span className="v" style={{color:monthIncome-monthSpent>=0?"var(--safe)":"var(--debt)"}}>{monthIncome-monthSpent>=0?"+":"−"}{fmt(Math.abs(monthIncome-monthSpent))}</span></div>
              </div>
              <div className="lc-ri-lbl">Recurring this month</div>
              {[...recurringItems].filter(r=>r.recurringDay).sort((a,b)=>(parseInt(a.recurringDay)||0)-(parseInt(b.recurringDay)||0)).map(r=>(
                <div key={r.id} className="lc-ri-item" onClick={()=>openEditRecurringItem&&openEditRecurringItem(r)}>
                  <div>
                    <div className="lc-ri-day">{r.recurringDay}</div>
                    <div style={{fontSize:9,color:"var(--ink-3)",letterSpacing:"0.5px",textTransform:"uppercase",marginTop:2}}>{DN[new Date(cy,cm-1,r.recurringDay).getDay()]}</div>
                  </div>
                  <div>
                    <div style={{fontSize:12,color:"var(--ink-0)"}}>{r.name}</div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:r.type==="income"?"var(--safe)":"var(--debt)"}}>{r.type==="income"?"+":"−"}{fmt(r.amountMin||0)}</div>
                  </div>
                </div>
              ))}
              <div className="lc-ri-add" onClick={openNewRecurringItem}>+ Add Recurring Item</div>
            </aside>

            <div className="lc-right">
              <div className="lc-topbar">
                <div className="lc-tb-left">
                  <span className="lc-tb-num">iv ·</span>
                  <span className="lc-tb-title">Calendar</span>
                  <span className="lc-tb-div"/>
                  <span className="lc-tb-sub">{MN[cm-1]} {cy}</span>
                </div>
                <div className="lc-tb-right">
                  <div className="lc-avatar">{initials}</div>
                  <button className="lc-nav-btn" onClick={prevCalMonth}>‹</button>
                  {!isCurMo&&<button className="lc-nav-btn" onClick={nextCalMonth}>Today</button>}
                  <button className="lc-nav-btn" onClick={nextCalMonth}>›</button>
                </div>
              </div>
              <div className="lc-agenda">
                {agendaDays.length===0 ? (
                  <div style={{padding:"80px 0",textAlign:"center",color:"var(--ink-3)"}}>
                    <div style={{fontFamily:"var(--font-display)",fontSize:28,color:"var(--ink-2)",marginBottom:8}}>Nothing scheduled</div>
                    <div style={{fontSize:13}}>Add recurring items to see them here</div>
                  </div>
                ) : agendaDays.map(d=>{
                  const dayTxns=calendarTxnsByDay[d]||[];
                  const dayRIs=recurringItems.filter(r=>parseInt(r.recurringDay)===d);
                  const isToday=isCurMo&&d===today.getDate();
                  const dow=DN[new Date(cy,cm-1,d).getDay()];
                  return (
                    <div key={d} className="lc-aday">
                      {/* condensed day header */}
                      <div className="lc-aday-hdr">
                        <span className={`lc-day-chip${isToday?" today":""}`}>{dow} {d}</span>
                        {isToday&&<span className="lc-today-pill">today</span>}
                        <div className={`lc-day-rule${isToday?" today":""}`}/>
                      </div>
                      {dayRIs.map(r=>{
                        const isInc=r.type==="income";
                        const barColor=isInc?"rgba(93,202,165,0.5)":r.recurringFreq?"rgba(108,140,255,0.4)":"rgba(240,176,76,0.4)";
                        return(
                          <div key={r.id} className="lc-event" style={{cursor:"pointer"}} onClick={()=>openEditRecurringItem&&openEditRecurringItem(r)}>
                            <div className="lc-event-bar" style={{background:barColor}}/>
                            <div className="lc-event-body">
                              <span className="lc-event-name">{r.name}</span>
                              <span className="lc-event-tag rec">↻</span>
                              <span className="lc-event-tag upcoming">due</span>
                            </div>
                            <span className={`lc-event-amt ${isInc?"income":"expense"}`}>{isInc?"+":"−"}{fmt(r.amountMin||0)}</span>
                          </div>
                        );
                      })}
                      {dayTxns.map(t=>{
                        const isInc=t.amount>0;
                        const barColor=isInc?"rgba(93,202,165,0.5)":"rgba(232,115,99,0.4)";
                        const txnDate=t.date?new Date(t.date+"T00:00:00"):null;
                        const todayMidnight=new Date(today.getFullYear(),today.getMonth(),today.getDate());
                        const hasPosted=txnDate&&txnDate<=todayMidnight;
                        return(
                          <div key={t.id} className="lc-event">
                            <div className="lc-event-bar" style={{background:barColor}}/>
                            <div className="lc-event-body">
                              <span className="lc-event-name">{t.name||t.merchant}</span>
                              {t.recurring&&<span className="lc-event-tag rec">↻</span>}
                              {hasPosted
                                ? <span className="lc-event-tag posted">✓</span>
                                : <span className="lc-event-tag upcoming">due</span>
                              }
                            </div>
                            <span className={`lc-event-amt ${isInc?"income":"expense"}`}>{isInc?"+":"−"}{fmt(Math.abs(t.amount))}</span>
                          </div>
                        );
                      })}
                      {dayTxns.length===0&&dayRIs.length===0&&<div className="lc-empty-day">no activity</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
