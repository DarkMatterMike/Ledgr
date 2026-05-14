/**
 * LedgrCalendar.jsx
 * src/components/LedgrCalendar.jsx
 */
import { useState, useMemo, useEffect } from "react";

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
  .lc-body{display:grid;grid-template-columns:64px 280px 1fr 300px;flex:1;}
  @media(max-width:1200px){.lc-body{grid-template-columns:64px 280px 1fr;}}
  @media(max-width:900px){.lc-body{grid-template-columns:64px 1fr;}}
  .lc-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);}
  .lc-nav-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d) 80%);margin-bottom:24px;}
  .lc-nav-item{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;}
  .lc-nav-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .lc-nav-item.active{color:var(--safe);background:var(--safe-bg);}
  .lc-nav-spacer{flex:1;}
  .lc-aside{border-right:1px solid var(--line);background:var(--bg-1);padding:22px 18px;overflow-y:auto;}
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
  .lc-ri-add{margin-top:12px;padding:10px;border:1px solid rgba(240,176,76,0.25);border-radius:var(--r-md);text-align:center;color:var(--warn);font-size:11px;cursor:pointer;font-family:var(--font-mono);}
  /* left column ri item */
  .lc-ri-row{padding:10px 0;border-top:1px solid var(--line);cursor:pointer;}
  .lc-ri-row:hover .lc-ri-name{color:var(--ink-0);}
  .lc-ri-summary{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:center;}
  .lc-ri-day{font-family:var(--font-display);font-size:20px;color:var(--ink-1);line-height:1;}
  .lc-ri-dow{font-size:9px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.4px;margin-top:2px;}
  .lc-ri-name{font-size:12px;color:var(--ink-1);transition:.1s;}
  .lc-ri-amt{font-family:var(--font-mono);font-size:11px;}
  .lc-ri-chevron{font-size:9px;color:var(--ink-4);margin-top:2px;transition:transform .15s;}
  .lc-ri-chevron.open{transform:rotate(180deg);}
  /* third column — edit panel */
  .lc-edit-col{border-left:1px solid var(--line);background:var(--bg-1);padding:22px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:0;}
  @media(max-width:1200px){.lc-edit-col{display:none;}}
  .lc-edit-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:8px;padding:40px 20px;text-align:center;}
  .lc-edit-empty-icon{font-size:28px;color:var(--ink-4);}
  .lc-edit-empty-text{font-size:12px;color:var(--ink-4);line-height:1.6;}
  .lc-edit-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid var(--line);margin-bottom:16px;}
  .lc-edit-title{font-family:var(--font-display);font-size:18px;letter-spacing:-0.2px;}
  .lc-edit-close{background:none;border:none;cursor:pointer;color:var(--ink-3);font-size:16px;padding:2px;line-height:1;}
  .lc-edit-close:hover{color:var(--ink-0);}
  .lc-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;}
  .lc-field-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;}
  .lc-field-row .lc-field{margin-bottom:0;}
  .lc-label{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-3);font-family:var(--font-mono);}
  .lc-input{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--ink-0);width:100%;font-family:var(--font-ui);outline:none;-webkit-appearance:none;}
  .lc-input:focus{border-color:rgba(93,202,165,0.3);}
  .lc-input::placeholder{color:var(--ink-4);}
  .lc-select{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--ink-0);width:100%;font-family:var(--font-ui);outline:none;-webkit-appearance:none;appearance:none;cursor:pointer;}
  .lc-edit-section{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-3);font-family:var(--font-mono);margin:16px 0 10px;padding-top:14px;border-top:1px solid var(--line);}
  .lc-linked-txn{display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:6px;margin-bottom:4px;}
  .lc-linked-name{flex:1;font-size:11px;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .lc-linked-date{font-family:var(--font-mono);font-size:10px;color:var(--ink-3);}
  .lc-linked-amt{font-family:var(--font-mono);font-size:11px;font-weight:600;flex-shrink:0;}
  .lc-unlink-btn{background:none;border:none;cursor:pointer;color:var(--ink-4);font-size:12px;padding:2px 4px;transition:.1s;}
  .lc-unlink-btn:hover{color:var(--debt);}
  .lc-link-candidate{display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:6px;margin-bottom:4px;cursor:pointer;transition:background .1s;}
  .lc-link-candidate:hover{background:rgba(255,255,255,0.05);}
  .lc-link-cname{flex:1;font-size:11px;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .lc-link-cmeta{font-size:10px;color:var(--ink-3);font-family:var(--font-mono);}
  .lc-link-camt{font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--debt);flex-shrink:0;}
  .lc-link-btn{background:rgba(93,202,165,0.1);border:1px solid rgba(93,202,165,0.25);border-radius:6px;padding:2px 8px;font-size:10px;font-family:var(--font-mono);color:var(--safe);cursor:pointer;flex-shrink:0;}
  .lc-edit-actions{display:flex;gap:8px;padding-top:14px;margin-top:4px;border-top:1px solid var(--line);}
  .lc-btn-save{background:var(--safe-bg);border:1px solid rgba(93,202,165,0.4);border-radius:8px;padding:5px 14px;font-size:11px;font-family:var(--font-mono);color:var(--safe);cursor:pointer;}
  .lc-btn-ghost{background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 12px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;}
  .lc-btn-ghost:hover{border-color:var(--line-3);color:var(--ink-0);}
  .lc-btn-danger{background:var(--debt-bg);border:1px solid rgba(232,115,99,0.3);border-radius:8px;padding:5px 12px;font-size:11px;font-family:var(--font-mono);color:var(--debt);cursor:pointer;margin-left:auto;}
  /* right column */
  .lc-right{overflow-y:auto;display:flex;flex-direction:column;}
  .lc-topbar{height:60px;padding:0 32px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg-1);z-index:10;flex-shrink:0;}
  .lc-tb-left{display:flex;align-items:baseline;gap:16px;}
  .lc-tb-num{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lc-tb-title{font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px;}
  .lc-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .lc-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .lc-tb-right{display:flex;align-items:center;gap:10px;}
  .lc-nav-btn{background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 12px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:.15s;}
  .lc-nav-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .lc-agenda{padding:24px 32px;flex:1;}
  /* condensed agenda */
  .lc-aday{margin-bottom:2px;}
  .lc-aday-hdr{display:flex;align-items:center;gap:8px;padding:5px 0;margin-bottom:2px;}
  .lc-day-chip{font-family:var(--font-mono);font-size:11px;font-weight:500;color:var(--ink-3);min-width:42px;white-space:nowrap;}
  .lc-day-chip.today{color:var(--safe);}
  .lc-today-pill{font-family:var(--font-mono);font-size:9px;font-weight:600;background:var(--safe);color:#07090d;border-radius:99px;padding:2px 9px;letter-spacing:0.5px;white-space:nowrap;flex-shrink:0;}
  .lc-day-rule{flex:1;height:1px;background:rgba(255,255,255,0.04);}
  .lc-day-rule.today{background:rgba(93,202,165,0.3);}
  .lc-event{display:flex;align-items:center;gap:7px;padding:4px 0 4px 42px;cursor:pointer;}
  .lc-event:hover .lc-event-name{color:var(--ink-0);}
  .lc-event-bar{width:4px;height:26px;border-radius:2px;flex-shrink:0;}
  .lc-event-body{flex:1;min-width:0;display:flex;align-items:center;gap:5px;}
  .lc-event-name{font-size:12px;color:var(--ink-1);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:.1s;}
  .lc-event-tag{font-size:9px;padding:1px 5px;border-radius:4px;font-family:var(--font-mono);flex-shrink:0;}
  .lc-event-tag.posted{background:var(--safe-bg);color:var(--safe);}
  .lc-event-tag.upcoming{background:var(--warn-bg);color:var(--warn);}
  .lc-event-tag.rec{background:var(--calm-bg);color:var(--calm);}
  .lc-event-amt{font-family:var(--font-mono);font-size:12px;font-weight:500;flex-shrink:0;}
  .lc-event-amt.income{color:var(--safe);}
  .lc-event-amt.expense{color:var(--debt);}
  .lc-empty-day{padding:3px 0 3px 42px;font-size:11px;color:var(--ink-4);font-style:italic;}
  /* agenda link expand */
  .lc-expand{margin:2px 0 6px 42px;background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-md);padding:12px 14px;}
  .lc-expand-label{font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:var(--ink-3);margin-bottom:8px;}
  .lc-expand-input{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--ink-0);width:100%;font-family:var(--font-ui);outline:none;}
  .lc-expand-input:focus{border-color:rgba(93,202,165,0.3);}
  .lc-expand-input::placeholder{color:var(--ink-4);}
  .lc-expand-candidate{display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:6px;margin-top:4px;cursor:pointer;transition:background .1s;}
  .lc-expand-candidate:hover{background:rgba(255,255,255,0.05);}
  .lc-expand-cname{flex:1;font-size:12px;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .lc-expand-cmeta{font-size:10px;color:var(--ink-3);font-family:var(--font-mono);}
  .lc-expand-camt{font-family:var(--font-mono);font-size:12px;font-weight:600;color:var(--debt);flex-shrink:0;}
  .lc-expand-link{background:rgba(93,202,165,0.1);border:1px solid rgba(93,202,165,0.25);border-radius:6px;padding:3px 10px;font-size:11px;font-family:var(--font-mono);color:var(--safe);cursor:pointer;flex-shrink:0;}
  .lc-expand-none{font-size:11px;color:var(--ink-4);padding:4px 0;}
`;

const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const NAV=[{icon:"◐",id:"dashboard"},{icon:"⇅",id:"transactions"},{icon:"▣",id:"accounts"},{icon:"◉",id:"budgets"},{icon:"▦",id:"calendar",active:true},{icon:"◆",id:"goals"}];
function daysInM(y,m){return new Date(y,m,0).getDate();}

export default function LedgrCalendar({
  accounts=[],categories=[],calendarMonth="",calendarTxnsByDay={},
  recurringItems=[],transactions=[],monthTxns=[],catMap={},acctMap={},
  prevCalMonth,nextCalMonth,openNewRecurringItem,
  linkTxnToRecurringItem=()=>{},
  unlinkTxnFromRecurringItem=()=>{},
  deleteRecurringItem=()=>{},
  saveRecurringItemForm=()=>{},
  riForm={name:"",amountMin:"",amountMax:"",recurringDay:"",recurringFreq:"monthly",recurringStart:"",categoryId:"",accountId:"",type:"expense"},
  setRiForm=()=>{},
  setEditingRecurringItem=()=>{},
  fmt=n=>`$${Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
  today=new Date(),isMobile=false,navigate=()=>{},
  calendarOpenNewRi=false,onCalendarOpenNewRiConsumed=()=>{},
}){
  const now=calendarMonth||`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  const [cy,cm]=now.split("-").map(Number);
  const [selDay,setSelDay]=useState(cy===today.getFullYear()&&cm===today.getMonth()+1?today.getDate():1);
  const isCurMo=cy===today.getFullYear()&&cm===today.getMonth()+1;
  const [selectedRiId,setSelectedRiId]=useState(null);    // which ri is selected for edit col
  const [selectedTxn,setSelectedTxn]=useState(null);      // which unlinked txn is selected for link search
  const [linkSearch,setLinkSearch]=useState("");

  // When navigated here from "Make Recurring → Calendar", open the new-item form
  useEffect(()=>{
    if(calendarOpenNewRi){
      setSelectedRiId('__new__');
      setSelectedTxn(null);
      setLinkSearch('');
      onCalendarOpenNewRiConsumed();
    }
  },[calendarOpenNewRi]);

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

  const calMonthTxns=Object.values(calendarTxnsByDay).flat();
  const monthSpent=calMonthTxns.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
  const monthIncome=calMonthTxns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const billsLeft=recurringItems.filter(r=>r.type!=="income"&&r.recurringDay&&isCurMo&&parseInt(r.recurringDay)>today.getDate()).reduce((s,r)=>s+(r.amountMin||0),0);

  const agendaDays=useMemo(()=>{
    const s=new Set();
    Object.keys(calendarTxnsByDay).forEach(d=>s.add(parseInt(d)));
    recurringItems.forEach(r=>{if(r.recurringDay)s.add(parseInt(r.recurringDay));});
    if(isCurMo) s.add(today.getDate());
    return [...s].sort((a,b)=>a-b);
  },[calendarTxnsByDay,recurringItems,isCurMo,today]);

  const initials=accounts[0]?.institution?.slice(0,2).toUpperCase()||"ME";

  function openRiEdit(r){
    setSelectedRiId(r.id);
    setSelectedTxn(null);
    setLinkSearch("");
    setEditingRecurringItem(r);
    setRiForm({
      name:r.name||"",
      amountMin:r.amountMin!=null?String(r.amountMin):"",
      amountMax:r.amountMax!=null?String(r.amountMax):"",
      recurringDay:r.recurringDay||"",
      recurringFreq:r.recurringFreq||"monthly",
      recurringStart:r.recurringStart||"",
      categoryId:r.categoryId||"",
      accountId:r.accountId||"",
      type:r.type||"expense",
    });
  }

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

            {/* ── left aside ── */}
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
              {[...recurringItems].filter(r=>r.recurringDay).sort((a,b)=>(parseInt(a.recurringDay)||0)-(parseInt(b.recurringDay)||0)).map(r=>{
                const isSel=selectedRiId===r.id;
                const dow=DN[new Date(cy,cm-1,parseInt(r.recurringDay)).getDay()];
                const isInc=r.type==="income";
                return(
                  <div key={r.id} className="lc-ri-row"
                    style={{background:isSel?"rgba(93,202,165,0.04)":undefined,borderRadius:isSel?"var(--r-sm)":undefined,paddingLeft:isSel?6:0}}
                    onClick={()=>openRiEdit(r)}>
                    <div className="lc-ri-summary">
                      <div>
                        <div className="lc-ri-day" style={{color:isSel?"var(--safe)":undefined}}>{r.recurringDay}</div>
                        <div className="lc-ri-dow">{dow}</div>
                      </div>
                      <div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span className="lc-ri-name" style={{color:isSel?"var(--safe)":undefined}}>{r.name}</span>
                          <span style={{fontSize:9,color:isSel?"var(--safe)":"var(--ink-4)",fontFamily:"var(--font-mono)"}}>›</span>
                        </div>
                        <div className="lc-ri-amt" style={{color:isInc?"var(--safe)":"var(--debt)"}}>
                          {isInc?"+":"−"}{fmt(r.amountMin||0)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="lc-ri-add" onClick={openNewRecurringItem}>+ Add Recurring Item</div>
            </aside>

            {/* ── right agenda ── */}
            <div className="lc-right">
              <div className="lc-topbar">
                <div className="lc-tb-left">
                  <span className="lc-tb-num">iv ·</span>
                  <span className="lc-tb-title">Calendar</span>
                  <span className="lc-tb-div"/>
                  <span className="lc-tb-sub">{MN[cm-1]} {cy}</span>
                </div>
                <div className="lc-tb-right">
                  <button className="lc-nav-btn" onClick={prevCalMonth}>‹</button>
                  {!isCurMo&&<button className="lc-nav-btn" onClick={nextCalMonth}>Today</button>}
                  <button className="lc-nav-btn" onClick={nextCalMonth}>›</button>
                </div>
              </div>
              <div className="lc-agenda">
                {agendaDays.length===0?(
                  <div style={{padding:"80px 0",textAlign:"center",color:"var(--ink-3)"}}>
                    <div style={{fontFamily:"var(--font-display)",fontSize:28,color:"var(--ink-2)",marginBottom:8}}>Nothing scheduled</div>
                    <div style={{fontSize:13}}>Add recurring items to see them here</div>
                  </div>
                ):agendaDays.map(d=>{
                  const allEntries=calendarTxnsByDay[d]||[];
                  const riEntries=allEntries.filter(t=>t.isRecurringItem);
                  const riItemIds=new Set(riEntries.map(t=>t.recurringItemId));
                  const realTxns=allEntries.filter(t=>!t.isRecurringItem&&!riItemIds.has(t.recurringItemId));
                  const todayMidnight=new Date(today.getFullYear(),today.getMonth(),today.getDate());
                  const isToday=isCurMo&&d===today.getDate();
                  const dow=DN[new Date(cy,cm-1,d).getDay()];
                  const isEmpty=riEntries.length===0&&realTxns.length===0;
                  return(
                    <div key={d} className="lc-aday">
                      <div className="lc-aday-hdr">
                        <span className={`lc-day-chip${isToday?" today":""}`}>{dow} {d}</span>
                        {isToday&&<span className="lc-today-pill">today</span>}
                        <div className={`lc-day-rule${isToday?" today":""}`}/>
                      </div>
                      {/* recurring item entries — click selects for edit col */}
                      {riEntries.map(t=>{
                        const isInc=t.type==="income";
                        const posted=t.postedThisMonth;
                        const barColor=isInc?"rgba(93,202,165,0.5)":"rgba(108,140,255,0.4)";
                        const riItem=recurringItems.find(r=>r.id===t.recurringItemId);
                        const isSel=selectedRiId===t.recurringItemId;
                        return(
                          <div key={t.id} className="lc-event"
                            style={{background:isSel?"rgba(93,202,165,0.04)":undefined,borderRadius:isSel?"4px":undefined}}
                            onClick={()=>riItem&&openRiEdit(riItem)}>
                            <div className="lc-event-bar" style={{background:posted?barColor.replace("0.4","0.6").replace("0.5","0.7"):barColor}}/>
                            <div className="lc-event-body">
                              <span className="lc-event-name">{t.name}</span>
                              <span className="lc-event-tag rec">↻</span>
                              {posted
                                ?<span className="lc-event-tag posted">✓</span>
                                :<span className="lc-event-tag upcoming">due</span>
                              }
                            </div>
                            <span className={`lc-event-amt ${isInc?"income":"expense"}`}>{isInc?"+":"−"}{fmt(Math.abs(t.amount))}</span>
                          </div>
                        );
                      })}
                      {/* real unlinked transactions — click selects for link search in edit col */}
                      {realTxns.map(t=>{
                        const isInc=t.amount>0;
                        const barColor=isInc?"rgba(93,202,165,0.5)":"rgba(232,115,99,0.4)";
                        const txnDate=t.date?new Date(t.date+"T00:00:00"):null;
                        const posted=txnDate&&txnDate<=todayMidnight;
                        const isSel=selectedTxn?.id===t.id;
                        return(
                          <div key={t.id} className="lc-event"
                            style={{background:isSel?"rgba(108,140,255,0.04)":undefined,borderRadius:isSel?"4px":undefined}}
                            onClick={()=>{setSelectedTxn(p=>p?.id===t.id?null:t);setSelectedRiId(null);setLinkSearch("");}}>
                            <div className="lc-event-bar" style={{background:barColor}}/>
                            <div className="lc-event-body">
                              <span className="lc-event-name">{t.name||t.merchant}</span>
                              {posted?<span className="lc-event-tag posted">✓</span>:<span className="lc-event-tag upcoming">due</span>}
                              <span style={{fontSize:9,color:isSel?"var(--calm)":"var(--ink-4)",fontFamily:"var(--font-mono)",marginLeft:"auto"}}>link ›</span>
                            </div>
                            <span className={`lc-event-amt ${isInc?"income":"expense"}`}>{isInc?"+":"−"}{fmt(Math.abs(t.amount))}</span>
                          </div>
                        );
                      })}
                      {isEmpty&&<div className="lc-empty-day">no activity</div>}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* ── edit column ── */}
            <div className="lc-edit-col">
              {!selectedRiId&&!selectedTxn&&(
                <div className="lc-edit-empty">
                  <div className="lc-edit-empty-icon">↻</div>
                  <div className="lc-edit-empty-text">Select a recurring item or transaction to edit or link</div>
                </div>
              )}
              {selectedRiId==='__new__'&&(
                <>
                  <div className="lc-edit-header">
                    <span className="lc-edit-title" style={{fontStyle:'italic',color:'var(--safe)'}}>New recurring item</span>
                    <button className="lc-edit-close" onClick={()=>setSelectedRiId(null)}>✕</button>
                  </div>
                  <div className="lc-field">
                    <label className="lc-label">Name</label>
                    <input className="lc-input" value={riForm.name} autoFocus onChange={e=>setRiForm(p=>({...p,name:e.target.value}))}/>
                  </div>
                  <div className="lc-field">
                    <label className="lc-label">Type</label>
                    <select className="lc-select" value={riForm.type||'expense'} onChange={e=>setRiForm(p=>({...p,type:e.target.value}))}>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                      <option value="transfer">Transfer</option>
                      <option value="reimbursement">Reimbursement</option>
                    </select>
                  </div>
                  <div className="lc-field-row">
                    <div className="lc-field">
                      <label className="lc-label">Frequency</label>
                      <select className="lc-select" value={riForm.recurringFreq||'monthly'} onChange={e=>setRiForm(p=>({...p,recurringFreq:e.target.value}))}>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </div>
                    <div className="lc-field">
                      <label className="lc-label">Day of Month</label>
                      <input className="lc-input" type="number" min="1" max="31" value={riForm.recurringDay} onChange={e=>setRiForm(p=>({...p,recurringDay:e.target.value}))}/>
                    </div>
                  </div>
                  <div className="lc-field">
                    <label className="lc-label">Expected Amount</label>
                    <input className="lc-input" type="number" step="0.01" placeholder="e.g. 14.99" value={riForm.amountMin} onChange={e=>setRiForm(p=>({...p,amountMin:e.target.value,amountMax:e.target.value}))}/>
                  </div>
                  <div className="lc-field-row">
                    <div className="lc-field">
                      <label className="lc-label">Category</label>
                      <select className="lc-select" value={riForm.categoryId} onChange={e=>setRiForm(p=>({...p,categoryId:e.target.value}))}>
                        <option value="">— None —</option>
                        {[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}
                      </select>
                    </div>
                    <div className="lc-field">
                      <label className="lc-label">Account</label>
                      <select className="lc-select" value={riForm.accountId} onChange={e=>setRiForm(p=>({...p,accountId:e.target.value}))}>
                        <option value="">— None —</option>
                        {[...accounts].sort((a,b)=>a.name.localeCompare(b.name)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="lc-field">
                    <label className="lc-label">Start Date</label>
                    <input className="lc-input" type="date" value={riForm.recurringStart} onChange={e=>setRiForm(p=>({...p,recurringStart:e.target.value}))}/>
                  </div>
                  <div className="lc-edit-actions">
                    <button className="lc-btn-save" onClick={()=>{saveRecurringItemForm();setSelectedRiId(null);}}>Save</button>
                    <button className="lc-btn-ghost" onClick={()=>setSelectedRiId(null)}>Cancel</button>
                  </div>
                </>
              )}
              {selectedRiId&&selectedRiId!=='__new__'&&(()=>{
                const r=recurringItems.find(x=>x.id===selectedRiId);
                if(!r) return null;
                const isInc=r.type==="income";
                const linkedTxns=(r.linkedTxnIds||[]).map(id=>transactions.find(t=>t.id===id)).filter(Boolean);
                return(
                  <>
                    <div className="lc-edit-header">
                      <span className="lc-edit-title">{r.name}</span>
                      <button className="lc-edit-close" onClick={()=>setSelectedRiId(null)}>✕</button>
                    </div>
                    <div className="lc-field">
                      <label className="lc-label">Name</label>
                      <input className="lc-input" value={riForm.name} onChange={e=>setRiForm(p=>({...p,name:e.target.value}))}/>
                    </div>
                    <div className="lc-field">
                      <label className="lc-label">Type</label>
                      <select className="lc-select" value={riForm.type||"expense"} onChange={e=>setRiForm(p=>({...p,type:e.target.value}))}>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="transfer">Transfer</option>
                        <option value="reimbursement">Reimbursement</option>
                      </select>
                    </div>
                    <div className="lc-field-row">
                      <div className="lc-field">
                        <label className="lc-label">Frequency</label>
                        <select className="lc-select" value={riForm.recurringFreq||"monthly"} onChange={e=>setRiForm(p=>({...p,recurringFreq:e.target.value}))}>
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Bi-weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="annual">Annual</option>
                        </select>
                      </div>
                      <div className="lc-field">
                        <label className="lc-label">Day of Month</label>
                        <input className="lc-input" type="number" min="1" max="31" value={riForm.recurringDay} onChange={e=>setRiForm(p=>({...p,recurringDay:e.target.value}))}/>
                      </div>
                    </div>
                    <div className="lc-field">
                      <label className="lc-label">Expected Amount</label>
                      <input className="lc-input" type="number" step="0.01" placeholder="e.g. 14.99" value={riForm.amountMin} onChange={e=>setRiForm(p=>({...p,amountMin:e.target.value,amountMax:e.target.value}))}/>
                    </div>
                    <div className="lc-field-row">
                      <div className="lc-field">
                        <label className="lc-label">Category</label>
                        <select className="lc-select" value={riForm.categoryId} onChange={e=>setRiForm(p=>({...p,categoryId:e.target.value}))}>
                          <option value="">— None —</option>
                          {[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                      </div>
                      <div className="lc-field">
                        <label className="lc-label">Account</label>
                        <select className="lc-select" value={riForm.accountId} onChange={e=>setRiForm(p=>({...p,accountId:e.target.value}))}>
                          <option value="">— None —</option>
                          {[...accounts].sort((a,b)=>a.name.localeCompare(b.name)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="lc-field">
                      <label className="lc-label">Start Date</label>
                      <input className="lc-input" type="date" value={riForm.recurringStart} onChange={e=>setRiForm(p=>({...p,recurringStart:e.target.value}))}/>
                    </div>
                    {linkedTxns.length>0&&(
                      <>
                        <div className="lc-edit-section">Linked transactions</div>
                        {linkedTxns.map(t=>(
                          <div key={t.id} className="lc-linked-txn">
                            <span className="lc-linked-name">{t.name||t.merchant}</span>
                            <span className="lc-linked-date">{t.date}</span>
                            <span className="lc-linked-amt" style={{color:t.amount<0?"var(--debt)":"var(--safe)"}}>{fmt(Math.abs(t.amount))}</span>
                            <button className="lc-unlink-btn" onClick={()=>unlinkTxnFromRecurringItem(t.id,r.id)}>✕</button>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="lc-edit-section">Link a transaction</div>
                    <input className="lc-input" placeholder="Search by name or merchant…" value={linkSearch}
                      onChange={e=>setLinkSearch(e.target.value)} style={{marginBottom:8}}/>
                    {(()=>{
                      const q=linkSearch.toLowerCase().trim();
                      const linkedIds=new Set(r.linkedTxnIds||[]);
                      const candidates=(monthTxns.length>0?monthTxns:transactions)
                        .filter(t=>{
                          if(linkedIds.has(t.id)) return false;
                          if(isInc&&t.amount<0) return false;
                          if(!isInc&&t.amount>0) return false;
                          if(!q) return true;
                          return (t.name||t.merchant||"").toLowerCase().includes(q)||(t.date||"").includes(q);
                        })
                        .sort((a,b)=>(b.date||"").localeCompare(a.date||""))
                        .slice(0,q?20:5);
                      if(candidates.length===0)
                        return <div style={{fontSize:11,color:"var(--ink-4)",padding:"4px 0"}}>{q?"No matching transactions":"Search to find transactions to link"}</div>;
                      return candidates.map(t=>(
                        <div key={t.id} className="lc-link-candidate"
                          onClick={()=>linkTxnToRecurringItem(t.id,r.id)}>
                          <div style={{flex:1,minWidth:0}}>
                            <div className="lc-link-cname">{t.name||t.merchant}</div>
                            <div className="lc-link-cmeta">{t.date}</div>
                          </div>
                          <span className="lc-link-camt" style={{color:t.amount<0?"var(--debt)":"var(--safe)"}}>{fmt(Math.abs(t.amount))}</span>
                          <button className="lc-link-btn">Link ↗</button>
                        </div>
                      ));
                    })()}
                    <div className="lc-edit-actions">
                      <button className="lc-btn-save" onClick={()=>{saveRecurringItemForm();setSelectedRiId(null);}}>Save</button>
                      <button className="lc-btn-ghost" onClick={()=>setSelectedRiId(null)}>Cancel</button>
                      <button className="lc-btn-danger" onClick={()=>{deleteRecurringItem(r.id);setSelectedRiId(null);}}>Delete</button>
                    </div>
                  </>
                );
              })()}
              {selectedTxn&&!selectedRiId&&(()=>{
                const t=selectedTxn;
                const isInc=t.amount>0;
                const q=linkSearch.toLowerCase().trim();
                const candidates=recurringItems.filter(r=>{
                  if(isInc&&r.type!=="income") return false;
                  if(!isInc&&r.type==="income") return false;
                  return !q||(r.name||"").toLowerCase().includes(q);
                });
                return(
                  <>
                    <div className="lc-edit-header">
                      <span className="lc-edit-title">{t.name||t.merchant}</span>
                      <button className="lc-edit-close" onClick={()=>setSelectedTxn(null)}>✕</button>
                    </div>
                    <div style={{fontSize:12,color:"var(--ink-2)",marginBottom:4}}>{fmt(Math.abs(t.amount))} · {t.date}</div>
                    <div style={{fontSize:11,color:"var(--ink-3)",marginBottom:16}}>Link this transaction to a recurring item so it shows as posted on the calendar.</div>
                    <div className="lc-edit-section" style={{marginTop:0,paddingTop:0,borderTop:"none"}}>Link to recurring item</div>
                    <input className="lc-input" placeholder="Search by name…" value={linkSearch}
                      onChange={e=>setLinkSearch(e.target.value)} style={{marginBottom:8}}/>
                    {candidates.length===0
                      ?<div style={{fontSize:11,color:"var(--ink-4)",padding:"8px 0"}}>No matching recurring items</div>
                      :candidates.slice(0,8).map(r=>(
                        <div key={r.id} className="lc-link-candidate"
                          onClick={()=>{linkTxnToRecurringItem(t.id,r.id);setSelectedTxn(null);setLinkSearch("");}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div className="lc-link-cname">{r.name}</div>
                            <div className="lc-link-cmeta">day {r.recurringDay} · {r.recurringFreq||"monthly"}</div>
                          </div>
                          <span className="lc-link-camt">{fmt(r.amountMin||0)}</span>
                          <button className="lc-link-btn">Link ↗</button>
                        </div>
                      ))
                    }
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
