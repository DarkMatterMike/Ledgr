/**
 * LedgrCalendar.jsx
 * src/components/LedgrCalendar.jsx
 */
import { useState, useMemo, useEffect } from "react";
import PageNav from "./PageNav.jsx";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
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
  .lc-bar-live{margin-left:auto;display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lc-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .lc-sync-btn{background:none;border:1px solid var(--line);border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-3);transition:.15s;flex-shrink:0;}
  .lc-sync-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .lc-sync-btn svg{transition:transform .6s;}
  .lc-sync-btn.spinning svg{animation:lc-spin .7s linear infinite;}
  @keyframes lc-spin{to{transform:rotate(360deg);}}
  .lc-body{display:grid;grid-template-columns:64px 320px 1fr 300px;flex:1;}
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
  @media(max-width:877px){
    .pn-nav{display:none !important;}
    .lc-body{grid-template-columns:1fr !important;}
    .lc-topbar{padding:14px 16px;}
    .lc-agenda{padding:16px;}
    .lc-mobile-sheet{position:fixed;left:0;right:0;bottom:0;z-index:200;
      background:var(--bg-2);border-top:1px solid var(--line-2);
      border-radius:20px 20px 0 0;padding:0 0 env(safe-area-inset-bottom,16px);
      transform:translateY(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);
      max-height:70vh;overflow-y:auto;}
    .lc-mobile-sheet.open{transform:translateY(0);}
    .lc-mobile-sheet-handle{width:36px;height:4px;border-radius:2px;background:var(--line-3);margin:12px auto 16px;display:block;}
    .lc-mobile-sheet-title{font-family:var(--font-display);font-size:20px;padding:0 20px 12px;border-bottom:1px solid var(--line);}
    .lc-mobile-sheet-body{padding:16px 20px 24px;}
    .lc-mobile-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:199;}
  }
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
  /* paycheck planning */
  .lc-pc-lbl{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);margin:0 0 10px;display:block;}
  .lc-pc-card{background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:12px;display:grid;grid-template-columns:60px 1fr 16px;gap:12px;align-items:center;margin-bottom:8px;cursor:pointer;}
  .lc-pc-card.open{border-radius:8px 8px 0 0;border-bottom-color:transparent;}
  .lc-pc-expand{background:var(--bg-1);border:1px solid var(--line);border-top:none;border-radius:0 0 8px 8px;padding:0 0 4px;margin-top:-8px;overflow:hidden;margin-bottom:8px;}
  .lc-pc-sect-lbl{font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-4);padding:10px 14px 4px;border-top:1px solid var(--line);}
  .lc-pc-sect-lbl:first-child{border-top:none;padding-top:12px;}
  .lc-pc-acct{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;gap:8px;}
  .lc-pc-acct .l{font-size:12px;color:var(--ink-2);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .lc-pc-acct .v{font-family:var(--font-mono);font-size:12px;color:var(--debt);flex-shrink:0;}
  .lc-pc-acct .v.ok{color:var(--safe);}
  .lc-pc-net{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;margin:4px 8px;background:var(--bg-2);border-radius:6px;border:1px solid var(--line);}
  .lc-pc-net .l{font-size:11px;color:var(--ink-3);}
  .lc-pc-net .v{font-family:var(--font-mono);font-size:14px;font-weight:600;}
  .lc-pc-net .v.ok{color:var(--safe);}
  .lc-pc-net .v.neg{color:var(--debt);}
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
  .lc-input{background:var(--bg-2);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--ink-0);width:100%;font-family:var(--font-ui);outline:none;-webkit-appearance:none;}
  .lc-input:focus{border-color:rgba(93,202,165,0.3);}
  .lc-input::placeholder{color:var(--ink-4);}
  .lc-select{background:var(--bg-2);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--ink-0);width:100%;font-family:var(--font-ui);outline:none;-webkit-appearance:none;appearance:none;cursor:pointer;}
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
  .lc-expand-input{background:var(--bg-2);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--ink-0);width:100%;font-family:var(--font-ui);outline:none;}
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
const NAV=[{icon:"◐",id:"dashboard"},{icon:"⇅",id:"transactions"},{icon:"▣",id:"accounts"},{icon:"◉",id:"budgets"},{icon:"▦",id:"calendar",active:true},{icon:"◈",id:"analytics"}];
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
  doSync=null,
  syncing=false,
  notifs=[],onDismissNotif=()=>{},onFilterReview=()=>{},
}){
  const now=calendarMonth||`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  const [cy,cm]=now.split("-").map(Number);
  const [selDay,setSelDay]=useState(cy===today.getFullYear()&&cm===today.getMonth()+1?today.getDate():1);
  const [sheetOpen,setSheetOpen]=useState(false);
  function handleDayClick(d){setSelDay(d);if(isMobile)setSheetOpen(true);}
  const [expandedRiDay,setExpandedRiDay]=useState(null);
  const isCurMo=cy===today.getFullYear()&&cm===today.getMonth()+1;
  const [selectedRiId,setSelectedRiId]=useState(null);    // which ri is selected for edit col
  const [selectedTxn,setSelectedTxn]=useState(null);      // which unlinked txn is selected for link search
  const [linkSearch,setLinkSearch]=useState("");
  const [expandedPcCard,setExpandedPcCard]=useState(null);

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

  // Paycheck planning data (current month only)
  const curY=today.getFullYear(),curM=today.getMonth()+1;
  const upcomingBillsCal=useMemo(()=>recurringItems.filter(r=>{
    if(r.type==="income"||!r.recurringDay) return false;
    return!(r.linkedTxnIds||[]).some(id=>{
      const t=monthTxns.find(x=>x.id===id);
      if(!t?.date) return false;
      const[ty,tm]=t.date.split("-").map(Number);
      return ty===curY&&tm===curM;
    });
  }).sort((a,b)=>(parseInt(a.recurringDay)||0)-(parseInt(b.recurringDay)||0)),[recurringItems,monthTxns,curY,curM]);
  const upcomingIncomeCal=useMemo(()=>recurringItems.filter(r=>r.type==="income"&&r.recurringDay).sort((a,b)=>(parseInt(a.recurringDay)||0)-(parseInt(b.recurringDay)||0)),[recurringItems]);
  const billsTotalCal=useMemo(()=>upcomingBillsCal.reduce((s,b)=>s+(b.amountMin||0),0),[upcomingBillsCal]);
  const nextPayCal=upcomingIncomeCal[0]||null;
  const halfIncomeCal=nextPayCal?(nextPayCal.amountMin||0):0;
  const bills1to15Cal   = useMemo(()=>upcomingBillsCal.filter(b=>(parseInt(b.recurringDay)||31)<=15).reduce((s,b)=>s+(b.amountMin||0),0),[upcomingBillsCal]);
  const bills16toEndCal = useMemo(()=>upcomingBillsCal.filter(b=>(parseInt(b.recurringDay)||31)>15).reduce((s,b)=>s+(b.amountMin||0),0),[upcomingBillsCal]);

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
            <span className="lc-bar-live">
              live · synced just now
              {doSync && (
                <button className={`lc-sync-btn${syncing?" spinning":""}`} onClick={()=>!syncing&&doSync()} title="Sync now">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                </button>
              )}
            </span>
          </div>
          <div className="lc-body">
            {!isMobile&&<PageNav activeId="calendar" navigate={navigate} notifs={notifs} onDismissNotif={onDismissNotif} onFilterReview={onFilterReview}/>}

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
                  return <div key={i} className={cls} onClick={()=>{
                  if(c.muted) return;
                  setSelDay(c.d);
                  setExpandedRiDay(p=>p===c.d?null:c.d);
                }}>{c.d}</div>;
                })}
              </div>
              {/* Paycheck planning */}
              <div style={{borderTop:"1px solid var(--line)",paddingTop:16,marginTop:4}}>
                <span className="lc-pc-lbl">Paycheck planning</span>
                {[
                  {label:"1 – 15",  income:halfIncomeCal, bills:bills1to15Cal,   billItems:upcomingBillsCal.filter(b=>(parseInt(b.recurringDay)||31)<=15)},
                  {label:"16 – End",income:halfIncomeCal, bills:bills16toEndCal, billItems:upcomingBillsCal.filter(b=>(parseInt(b.recurringDay)||31)>15)},
                ].map((card,i)=>{
                  const isOpen=expandedPcCard===i;
                  const byAcct={};
                  card.billItems.forEach(b=>{
                    const k=b.accountId||"__none__";
                    if(!byAcct[k]) byAcct[k]={name:b.accountId?(accounts.find(a=>a.id===b.accountId)?.name||"Account"):"Unassigned",total:0,items:[]};
                    byAcct[k].total+=(b.amountMin||0);
                    byAcct[k].items.push(b);
                  });
                  const acctRows=Object.values(byAcct);
                  const net=card.income-card.bills;
                  return(
                    <div key={i}>
                      <div className={`lc-pc-card${isOpen?" open":""}`} onClick={()=>setExpandedPcCard(isOpen?null:i)}>
                        <div><div style={{fontSize:11,color:"var(--ink-2)"}}>Days</div><div style={{fontFamily:"var(--font-display)",fontSize:16,lineHeight:1.1}}>{card.label}</div></div>
                        <div style={{display:"flex",flexDirection:"column",gap:2}}>
                          <span style={{fontFamily:"var(--font-mono)",color:"var(--safe)",fontSize:13}}>+{fmt(card.income)}</span>
                          <span style={{fontFamily:"var(--font-mono)",color:"var(--debt)",fontSize:13}}>−{fmt(card.bills)}</span>
                        </div>
                        <span style={{color:"var(--ink-3)",fontSize:11}}>{isOpen?"▴":"▾"}</span>
                      </div>
                      {isOpen&&(
                        <div className="lc-pc-expand">
                          {card.billItems.length===0?(
                            <div style={{padding:"14px",fontSize:11,color:"var(--ink-3)",fontStyle:"italic"}}>No bills in this period.</div>
                          ):acctRows.map(row=>(
                            <div key={row.name}>
                              {acctRows.length>1&&<div className="lc-pc-sect-lbl">{row.name}</div>}
                              {row.items.map(b=>(
                                <div key={b.id||b.name} className="lc-pc-acct">
                                  <span className="l">{b.name}</span>
                                  <span className="v">−{fmt(b.amountMin||0)}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                          {card.billItems.length>0&&(
                            <div style={{padding:"4px 8px 8px"}}>
                              <div className="lc-pc-net">
                                <span className="l">Period net</span>
                                <span className={`v${net>=0?" ok":" neg"}`}>{net>=0?"+":"−"}{fmt(Math.abs(net))}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="lc-ri-lbl">Recurring this month</div>
              {(() => {
                // Group by day
                const byDay = {};
                [...recurringItems].filter(r=>r.recurringDay).forEach(r=>{
                  const d = parseInt(r.recurringDay);
                  if(!byDay[d]) byDay[d]=[];
                  byDay[d].push(r);
                });
                return Object.keys(byDay).sort((a,b)=>Number(a)-Number(b)).map(dayStr=>{
                  const day = Number(dayStr);
                  const items = byDay[day];
                  const dow = DN[new Date(cy,cm-1,day).getDay()];
                  const isExpanded = expandedRiDay===day;
                  const dayIncome  = items.filter(r=>r.type==="income").reduce((s,r)=>s+(r.amountMin||0),0);
                  const dayExpense = items.filter(r=>r.type!=="income").reduce((s,r)=>s+(r.amountMin||0),0);
                  const dayTotal   = dayIncome - dayExpense;
                  const hasInc = dayIncome > 0;
                  const allInc = items.every(r=>r.type==="income");
                  const amtColor = dayTotal>0?"var(--safe)":dayTotal<0?"var(--debt)":"var(--ink-2)";
                  const isPast = isCurMo && day < today.getDate();
                  return (
                    <div key={day} style={{marginBottom:2}}>
                      {/* Day group header */}
                      <div
                        onClick={()=>setExpandedRiDay(p=>p===day?null:day)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:"var(--r-sm)",cursor:"pointer",
                          background:isExpanded?"rgba(93,202,165,0.04)":"transparent",
                          borderLeft:isExpanded?"2px solid var(--safe)":"2px solid transparent",
                          borderRadius:0,
                          opacity:isPast?0.5:1,transition:".12s"}}
                      >
                        <div style={{textAlign:"center",minWidth:28,flexShrink:0}}>
                          <div style={{fontFamily:"var(--font-mono)",fontSize:14,fontWeight:600,color:isExpanded?"var(--safe)":"var(--ink-1)",lineHeight:1}}>{day}</div>
                          <div style={{fontFamily:"var(--font-mono)",fontSize:8,color:"var(--ink-4)",letterSpacing:"0.5px",textTransform:"uppercase"}}>{dow}</div>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,color:"var(--ink-2)",display:"flex",gap:8}}>
                            {hasInc&&!allInc&&<span style={{color:"var(--safe)"}}>+{fmt(dayIncome)}</span>}
                            {dayExpense>0&&<span style={{color:"var(--debt)"}}>−{fmt(dayExpense)}</span>}
                            {allInc&&<span style={{color:"var(--safe)"}}>+{fmt(dayIncome)}</span>}
                          </div>
                          {hasInc&&dayExpense>0&&(
                            <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:amtColor,marginTop:1}}>
                              net {dayTotal>=0?"+":"−"}{fmt(Math.abs(dayTotal))}
                            </div>
                          )}
                        </div>
                        <span style={{fontSize:10,color:"var(--ink-4)",transform:isExpanded?"rotate(90deg)":"rotate(0)",transition:".15s",display:"inline-block"}}>›</span>
                      </div>
                      {/* Expanded items */}
                      {isExpanded && items.map(r=>{
                        const isSel=selectedRiId===r.id;
                        const isInc=r.type==="income";
                        return(
                          <div key={r.id}
                            onClick={()=>openRiEdit(r)}
                            style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                              padding:"6px 8px 6px 44px",cursor:"pointer",borderRadius:"var(--r-sm)",
                              background:isSel?"rgba(93,202,165,0.06)":"rgba(255,255,255,0.015)",
                              marginBottom:1,transition:".1s"}}
                          >
                            <span style={{fontSize:12,color:isSel?"var(--safe)":"var(--ink-1)",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span>
                            <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:isInc?"var(--safe)":"var(--debt)",flexShrink:0,marginLeft:8}}>
                              {isInc?"+":"−"}{fmt(r.amountMin||0)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
              <div className="lc-ri-add" onClick={()=>{setSelectedRiId('__new__');setSelectedTxn(null);setRiForm({name:"",amountMin:"",amountMax:"",recurringDay:"",recurringFreq:"monthly",recurringStart:"",categoryId:"",accountId:"",type:"expense"});}}>+ Add Recurring Item</div>
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
              {isMobile&&sheetOpen&&(
                <>
                  <div className="lc-mobile-backdrop" onClick={()=>setSheetOpen(false)}/>
                  <div className={`lc-mobile-sheet${sheetOpen?" open":""}`}>
                    <span className="lc-mobile-sheet-handle"/>
                    <div className="lc-mobile-sheet-title">{MN[cm-1]} {selDay}</div>
                    <div className="lc-mobile-sheet-body">
                      {(calendarTxnsByDay[`${cy}-${String(cm).padStart(2,"0")}-${String(selDay).padStart(2,"0")}`]||[]).length===0
                        ?<div style={{color:"var(--ink-3)",fontSize:13,fontStyle:"italic"}}>Nothing on this day</div>
                        :(calendarTxnsByDay[`${cy}-${String(cm).padStart(2,"0")}-${String(selDay).padStart(2,"0")}`]||[]).map((t,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--line)",fontFamily:"var(--font-mono)",fontSize:12}}>
                            <span style={{color:"var(--ink-1)"}}>{t.merchant||t.name}</span>
                            <span style={{color:(t.amount||0)>0?"var(--safe)":"var(--debt)"}}>{(t.amount||0)>0?"+":"−"}{fmt(Math.abs(t.amount||0))}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </>
              )}
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
