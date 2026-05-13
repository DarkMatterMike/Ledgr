/**
 * LedgrBriefing.jsx — Dashboard, concept 2 "The Briefing"
 * src/components/LedgrBriefing.jsx
 */
import { useState, useMemo } from "react";

const TOKENS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  :root {
    --bg-0:#07090d; --bg-1:#0b0e14; --bg-2:#11151d; --bg-3:#161c26; --bg-4:#1c2330;
    --line:rgba(255,255,255,0.06); --line-2:rgba(255,255,255,0.10); --line-3:rgba(255,255,255,0.18);
    --ink-0:#f4f4f1; --ink-1:#c8cdd6; --ink-2:#7d8594; --ink-3:#4a5161; --ink-4:#2e3340;
    --safe:#5dcaa5; --safe-d:#0f6e56; --safe-bg:rgba(93,202,165,0.08);
    --warn:#f0b04c; --warn-d:#6b4708; --warn-bg:rgba(240,176,76,0.08);
    --debt:#e87363; --debt-d:#5a1c14; --debt-bg:rgba(232,115,99,0.08);
    --calm:#6c8cff; --calm-d:#1a2a66; --calm-bg:rgba(108,140,255,0.08);
    --goal:#a78bff; --goal-d:#2a1f5e; --goal-bg:rgba(167,139,255,0.08);
    --font-display:'Instrument Serif',Georgia,serif;
    --font-ui:'Geist',-apple-system,sans-serif;
    --font-mono:'JetBrains Mono',ui-monospace,monospace;
    --r-sm:6px; --r-md:10px; --r-lg:14px; --r-xl:20px;
  }
`;

const CSS = `
  .lb-wrap *,.lb-wrap *::before,.lb-wrap *::after{box-sizing:border-box;}
  .lb-wrap h1,.lb-wrap h2,.lb-wrap h3,.lb-wrap h4,.lb-wrap p{margin:0;padding:0;}
  .lb-wrap{font-family:var(--font-ui);color:var(--ink-0);-webkit-font-smoothing:antialiased;background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;}
  @media(max-width:1000px){.lb-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.lb-wrap{padding:0;}}
  .lb-frame{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden;max-width:1400px;margin:0 auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);}
  @media(max-width:600px){.lb-frame{border-radius:0;border:none;}}
  .lb-bar{height:40px;background:var(--bg-2);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 18px;gap:8px;}
  .lb-bar-dot{width:9px;height:9px;border-radius:50%;background:var(--ink-4);}
  .lb-bar-url{margin-left:14px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);letter-spacing:0.4px;}
  .lb-bar-live{margin-left:auto;display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .lb-brief{display:grid;grid-template-columns:64px 320px 1fr;min-height:880px;}
  @media(max-width:1100px){.lb-brief{grid-template-columns:64px 1fr;}}
  .lb-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);}
  .lb-nav-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d) 80%);margin-bottom:24px;}
  .lb-nav-item{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;}
  .lb-nav-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .lb-nav-item.active{color:var(--safe);background:var(--safe-bg);}
  .lb-nav-spacer{flex:1;}
  .lb-agenda{border-right:1px solid var(--line);background:var(--bg-1);padding:24px 22px;overflow-y:auto;}
  @media(max-width:1100px){.lb-agenda{display:none;}}
  .lb-cal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
  .lb-cal-title{font-family:var(--font-display);font-size:20px;letter-spacing:-0.3px;}
  .lb-cal-navs{display:flex;gap:6px;}
  .lb-cal-navs span{width:22px;height:22px;border-radius:6px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--ink-2);font-size:11px;cursor:pointer;}
  .lb-cal-dow{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:6px;}
  .lb-cal-dow span{font-size:9px;color:var(--ink-3);text-align:center;}
  .lb-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
  .lb-day{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink-1);font-family:var(--font-mono);position:relative;cursor:pointer;}
  .lb-day.muted{color:var(--ink-4);}
  .lb-day.today{background:var(--bg-3);color:var(--safe);border:1px solid rgba(93,202,165,0.3);}
  .lb-day::after{content:'';position:absolute;bottom:3px;width:4px;height:4px;border-radius:50%;display:none;}
  .lb-day.has-bill::after{display:block;background:var(--debt);}
  .lb-day.has-inc::after{display:block;background:var(--safe);}
  .lb-day.has-mix::after{display:block;background:var(--warn);box-shadow:5px 0 0 var(--debt);}
  .lb-mstats{border-top:1px solid var(--line);padding-top:16px;display:flex;flex-direction:column;gap:10px;margin-top:2px;}
  .lb-mrow{display:flex;justify-content:space-between;align-items:center;font-size:12px;}
  .lb-mrow .l{color:var(--ink-2);}
  .lb-mrow .v{font-family:var(--font-mono);}
  .lb-mrow .v.debt{color:var(--debt);}
  .lb-mrow .v.safe{color:var(--safe);}
  .lb-mrow .v.calm{color:var(--calm);}
  .lb-pc-lbl{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);margin:20px 0 12px;padding-top:16px;border-top:1px solid var(--line);}
  .lb-pc-card{background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:12px;display:grid;grid-template-columns:60px 1fr 16px;gap:12px;align-items:center;margin-bottom:8px;}
  .lb-pc-add{margin-top:14px;padding:14px;border:1px solid rgba(240,176,76,0.25);border-radius:8px;text-align:center;color:var(--warn);font-size:12px;cursor:pointer;font-family:var(--font-mono);}
  .lb-main{padding:36px 40px;overflow-y:auto;min-width:0;}
  .lb-topbar{display:flex;align-items:center;justify-content:space-between;padding:0 0 20px;margin-bottom:28px;border-bottom:1px solid var(--line);}
  .lb-tb-left{display:flex;align-items:baseline;gap:16px;}
  .lb-tb-num{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-tb-title{font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px;}
  .lb-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .lb-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .lb-tb-right{display:flex;align-items:center;gap:14px;}
  .lb-search{background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:7px 14px;font-size:12px;color:var(--ink-3);font-family:var(--font-mono);display:flex;align-items:center;gap:8px;min-width:240px;}
  .lb-kbd{margin-left:auto;font-size:10px;padding:1px 6px;background:var(--bg-3);border-radius:4px;color:var(--ink-3);}
  .lb-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--goal-d),var(--goal));font-size:11px;display:flex;align-items:center;justify-content:center;color:var(--ink-0);font-weight:500;flex-shrink:0;}
  .lb-eyebrow{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:var(--ink-3);font-weight:500;margin-bottom:8px;}
  .lb-headline{font-family:var(--font-display);font-size:56px;line-height:1.02;letter-spacing:-1.5px;font-weight:400;margin-bottom:24px;}
  .lb-headline em{font-style:italic;color:var(--safe);}
  .lb-deck{font-size:16px;color:var(--ink-1);line-height:1.65;max-width:580px;margin-bottom:28px;}
  .lb-deck .amt{font-style:normal;font-family:var(--font-mono);color:var(--safe);}
  .lb-deck .debt{font-style:normal;font-family:var(--font-mono);color:var(--debt);}
  .lb-callout{margin-top:28px;background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-xl);padding:28px;display:grid;grid-template-columns:240px 1fr;gap:28px;align-items:center;}
  @media(max-width:900px){.lb-callout{grid-template-columns:1fr;}}
  .lb-cstats{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;}
  .lb-stat{border-left:1px solid var(--line-2);padding-left:14px;}
  .lb-stat .l{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);}
  .lb-stat .v{font-family:var(--font-mono);font-size:18px;margin-top:3px;}
  .lb-stat .v.safe{color:var(--safe);}
  .lb-stat .v.debt{color:var(--debt);}
  .lb-stat .v.calm{color:var(--calm);}
  .lb-stat .s{font-size:11px;color:var(--ink-3);margin-top:2px;}
  .lb-alloc{margin-top:12px;background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-lg);padding:22px 24px;}
  .lb-alloc-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;}
  .lb-alloc-head h4{font-family:var(--font-display);font-size:24px;font-weight:400;letter-spacing:-0.4px;}
  .lb-alloc-head h4 em{font-style:italic;color:var(--safe);}
  .lb-alloc-head .tot{font-family:var(--font-mono);font-size:13px;color:var(--ink-2);}
  .lb-track{display:flex;gap:2px;height:32px;border-radius:8px;overflow:hidden;margin-bottom:12px;}
  .lb-track .seg{display:flex;align-items:center;padding:0 12px;font-family:var(--font-mono);font-size:11px;overflow:hidden;white-space:nowrap;}
  .lb-track .seg.free{background:rgba(93,202,165,0.18);color:var(--safe);}
  .lb-track .seg.bills{background:rgba(232,115,99,0.18);color:var(--debt);}
  .lb-track .seg.cushion{background:rgba(108,140,255,0.18);color:var(--calm);}
  .lb-track .seg.goals{background:rgba(167,139,255,0.18);color:var(--goal);}
  .lb-track .seg.flex{background:rgba(240,176,76,0.18);color:var(--warn);}
  .lb-legend{display:flex;gap:18px;font-size:11px;color:var(--ink-3);flex-wrap:wrap;}
  .lb-legend span{display:flex;align-items:center;gap:6px;}
  .lb-led{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0;}
  .lb-led.safe{background:var(--safe);box-shadow:0 0 6px var(--safe);}
  .lb-led.debt{background:var(--debt);}
  .lb-led.calm{background:var(--calm);}
  .lb-led.goal{background:var(--goal);}
  .lb-led.warn{background:var(--warn);}
  .lb-whatif{margin-top:24px;}
  .lb-wi-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
  .lb-wi-head h4{font-family:var(--font-display);font-size:24px;font-weight:400;letter-spacing:-0.4px;}
  .lb-wi-head h4 em{font-style:italic;color:var(--safe);}
  .lb-wi-hint{font-size:11px;color:var(--ink-3);font-family:var(--font-mono);}
  .lb-wi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
  @media(max-width:900px){.lb-wi-row{grid-template-columns:1fr 1fr;}}
  @media(max-width:600px){.lb-wi-row{grid-template-columns:1fr;}}
  .lb-wi-card{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-md);padding:16px;cursor:pointer;transition:.15s;}
  .lb-wi-card:hover{border-color:var(--line-3);}
  .lb-wi-card.sel{border-color:rgba(93,202,165,0.4);background:rgba(93,202,165,0.04);}
  .lb-wi-nm{font-size:13px;color:var(--ink-1);line-height:1.4;margin-bottom:8px;}
  .lb-wi-delta{display:flex;justify-content:space-between;align-items:center;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-3);}
  .lb-wi-delta .v{font-family:var(--font-mono);font-size:14px;letter-spacing:0;}
  .lb-wi-delta .v.pos{color:var(--safe);}
  .lb-wi-delta .v.neg{color:var(--debt);}
`;

const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function daysUntil(d, today) {
  const t = today.getDate();
  const dim = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  return d >= t ? d - t : dim - t + d;
}

function Gauge({ pct=0.5 }) {
  const angle = -90 + pct * 180;
  return (
    <svg viewBox="0 0 220 160" style={{width:"100%",height:"100%",display:"block"}}>
      <defs>
        <linearGradient id="ggrad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0"    stopColor="#e87363"/>
          <stop offset="0.45" stopColor="#f0b04c"/>
          <stop offset="0.7"  stopColor="#5dcaa5"/>
          <stop offset="1"    stopColor="#6c8cff"/>
        </linearGradient>
      </defs>
      <path d="M 30 120 A 80 80 0 0 1 190 120" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="none" strokeLinecap="round"/>
      <path d="M 30 120 A 80 80 0 0 1 190 120" stroke="url(#ggrad)" strokeWidth="12" fill="none" strokeLinecap="round"/>
      <g transform={`rotate(${angle} 110 120)`}>
        <line x1="110" y1="120" x2="110" y2="50" stroke="#f4f4f1" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="110" cy="50" r="3.5" fill="#f4f4f1"/>
      </g>
      <circle cx="110" cy="120" r="9" fill="#11151d" stroke="rgba(255,255,255,0.2)"/>
      <circle cx="110" cy="120" r="3.5" fill="#5dcaa5"/>
      <text x="30"  y="138" fontSize="9" fill="#e87363" fontFamily="JetBrains Mono" textAnchor="middle">TIGHT</text>
      <text x="110" y="32"  fontSize="9" fill="#5dcaa5" fontFamily="JetBrains Mono" textAnchor="middle">SAFE</text>
      <text x="190" y="138" fontSize="9" fill="#6c8cff" fontFamily="JetBrains Mono" textAnchor="middle">AHEAD</text>
    </svg>
  );
}

function MiniCal({ today, bills, incs, mixes }) {
  const [cm, setCm] = useState({ y:today.getFullYear(), m:today.getMonth() });
  const { y, m } = cm;
  const first = new Date(y,m,1).getDay();
  const dim   = new Date(y,m+1,0).getDate();
  const dimp  = new Date(y,m,0).getDate();
  const isCur = y===today.getFullYear() && m===today.getMonth();
  const cells = [];
  for (let i=first-1;i>=0;i--) cells.push({d:dimp-i,muted:true});
  for (let d=1;d<=dim;d++) cells.push({d,isToday:isCur&&d===today.getDate(),hasMix:isCur&&mixes.has(d),hasBill:isCur&&bills.has(d),hasInc:isCur&&incs.has(d)});
  while (cells.length<42) cells.push({d:cells.length-first-dim+1,muted:true});
  return (
    <div style={{marginBottom:22}}>
      <div className="lb-cal-head">
        <div className="lb-cal-title">{MN[m]} {y}</div>
        <div className="lb-cal-navs">
          <span onClick={()=>setCm(({y,m})=>m===0?{y:y-1,m:11}:{y,m:m-1})}>‹</span>
          <span onClick={()=>setCm(({y,m})=>m===11?{y:y+1,m:0}:{y,m:m+1})}>›</span>
        </div>
      </div>
      <div className="lb-cal-dow">{["S","M","T","W","T","F","S"].map((d,i)=><span key={i}>{d}</span>)}</div>
      <div className="lb-cal-grid">
        {cells.map((c,i)=>{
          let cls="lb-day";
          if(c.muted) cls+=" muted";
          if(c.isToday) cls+=" today";
          if(c.hasMix) cls+=" has-mix";
          else if(c.hasBill) cls+=" has-bill";
          else if(c.hasInc) cls+=" has-inc";
          return <div key={i} className={cls}>{c.d}</div>;
        })}
      </div>
    </div>
  );
}

export default function LedgrBriefing({
  accounts=[],categories=[],monthTxns=[],recurringItems=[],
  totalSpent=0,totalIncome=0,totalBudget=0,goals=[],
  today=new Date(),
  fmt=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Math.abs(n)),
  navigate=()=>{},
  isMobile=false,
}) {
  const [selWI,setSelWI]=useState(0);
  const totalBalance  = useMemo(()=>accounts.reduce((s,a)=>s+(a.balance||0),0),[accounts]);
  const checkingBal   = useMemo(()=>accounts.filter(a=>a.type==="checking"||a.type==="savings").reduce((s,a)=>s+(a.balance||0),0),[accounts]);
  const curY=today.getFullYear(), curM=today.getMonth()+1;

  const upcomingBills = useMemo(()=>recurringItems.filter(r=>{
    if(r.type==="income"||!r.recurringDay) return false;
    return !(r.linkedTxnIds||[]).some(id=>{const t=monthTxns.find(x=>x.id===id);if(!t?.date)return false;const[ty,tm]=t.date.split("-").map(Number);return ty===curY&&tm===curM;});
  }).sort((a,b)=>(parseInt(a.recurringDay)||0)-(parseInt(b.recurringDay)||0)),[recurringItems,monthTxns,curY,curM]);

  const upcomingIncome = useMemo(()=>recurringItems.filter(r=>{
    if(r.type!=="income"||!r.recurringDay) return false;
    return !(r.linkedTxnIds||[]).some(id=>{const t=monthTxns.find(x=>x.id===id);if(!t?.date)return false;const[ty,tm]=t.date.split("-").map(Number);return ty===curY&&tm===curM;});
  }).sort((a,b)=>(parseInt(a.recurringDay)||0)-(parseInt(b.recurringDay)||0)),[recurringItems,monthTxns,curY,curM]);

  const billsTotal  = useMemo(()=>upcomingBills.reduce((s,b)=>s+(b.amountMin||0),0),[upcomingBills]);
  const nextPay     = upcomingIncome[0]||null;
  const nextPayDay  = nextPay?.recurringDay||null;
  const daysLeft    = nextPayDay ? daysUntil(nextPayDay,today) : null;
  const safeToSpend = Math.max(0,Math.round(checkingBal-billsTotal));
  const dailyPace   = daysLeft&&daysLeft>0 ? Math.round(safeToSpend/daysLeft) : null;
  const pressurePct = checkingBal ? Math.max(0,Math.min(1,1-(billsTotal/checkingBal)*0.8)) : 0.5;
  const pressureLabel = pressurePct>0.65?"safe":pressurePct>0.4?"moderate":"tight";
  const goalsSaved  = useMemo(()=>goals.reduce((s,g)=>s+(g.savedAmount||0),0),[goals]);

  const allocFree=safeToSpend, allocBill=billsTotal;
  const allocCush=Math.round(checkingBal*0.1);
  const allocGoal=Math.round(goalsSaved*0.1);
  const allocFlex=Math.round(totalSpent*0.05);
  const allocTotal=allocFree+allocBill+allocCush+allocGoal+allocFlex;

  const billDays=useMemo(()=>{const s=new Set();recurringItems.filter(r=>r.type!=="income"&&r.recurringDay).forEach(r=>s.add(parseInt(r.recurringDay)));return s;},[recurringItems]);
  const incDays =useMemo(()=>{const s=new Set();recurringItems.filter(r=>r.type==="income"&&r.recurringDay).forEach(r=>s.add(parseInt(r.recurringDay)));return s;},[recurringItems]);
  const mixDays =useMemo(()=>{const s=new Set();billDays.forEach(d=>{if(incDays.has(d))s.add(d);});return s;},[billDays,incDays]);

  const diningCat   = categories.find(c=>/dining|restaurant/i.test(c.name));
  const diningSpent = diningCat ? monthTxns.filter(t=>t.categoryId===diningCat.id&&t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0) : 0;
  const cardBill    = upcomingBills.find(b=>/card|credit/i.test(b.name));
  const whatIfs=[
    {nm:"Skip dining out for the rest of the week",delta:Math.round(diningSpent/4)||86,pos:true},
    {nm:"Move card payment to next cycle",delta:cardBill?.amountMin||336,pos:true},
    {nm:"$200 weekend getaway",delta:200,pos:false},
    {nm:"Auto-save $150 to emergency fund",delta:150,pos:false},
  ];

  const halfIncome=nextPay?(nextPay.amountMin||0):totalIncome/2;
  const halfBills=billsTotal/2;
  const initials=accounts[0]?.institution?.slice(0,2).toUpperCase()||"ME";
  const timeLabel=`${DN[today.getDay()]}, ${MN[today.getMonth()]} ${today.getDate()} · ${today.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`;
  const NAV=[{icon:"◐",id:"dashboard",active:true},{icon:"⇅",id:"transactions"},{icon:"▣",id:"accounts"},{icon:"▦",id:"calendar"},{icon:"◆",id:"goals"}];

  return (
    <>
      <style>{TOKENS+CSS}</style>
      <div className="lb-wrap">
        <div className="lb-frame">
          <div className="lb-bar">
            <div className="lb-bar-dot"/><div className="lb-bar-dot"/><div className="lb-bar-dot"/>
            <span className="lb-bar-url">app.ledgr.app / home</span>
            <span className="lb-bar-live">live · synced just now</span>
          </div>
          <div className="lb-brief">
            <nav className="lb-nav">
              <div className="lb-nav-logo"/>
              {NAV.map(n=><div key={n.id} className={`lb-nav-item${n.active?" active":""}`} onClick={()=>navigate(n.id)} title={n.id}>{n.icon}</div>)}
              <div className="lb-nav-spacer"/>
              <div className="lb-nav-item" onClick={()=>navigate("settings")}>⚙</div>
            </nav>
            <aside className="lb-agenda">
              <MiniCal today={today} bills={billDays} incs={incDays} mixes={mixDays}/>
              <div className="lb-mstats">
                <div className="lb-mrow"><span className="l">Monthly expenses</span><span className="v debt">{fmt(totalSpent)}</span></div>
                <div className="lb-mrow"><span className="l">Expected income</span><span className="v safe">+{fmt(totalIncome)}</span></div>
                <div className="lb-mrow"><span className="l">Posted so far</span><span className="v">{fmt(Math.abs(totalBalance-safeToSpend))}</span></div>
                <div className="lb-mrow"><span className="l">Remaining</span><span className="v calm">{fmt(safeToSpend)}</span></div>
              </div>
              <div className="lb-pc-lbl">Paycheck planning</div>
              <div className="lb-pc-card">
                <div><div style={{fontSize:11,color:"var(--ink-2)"}}>Days</div><div style={{fontFamily:"var(--font-display)",fontSize:16}}>1 – 15</div></div>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  <span style={{fontFamily:"var(--font-mono)",color:"var(--safe)",fontSize:13}}>+{fmt(halfIncome)}</span>
                  <span style={{fontFamily:"var(--font-mono)",color:"var(--debt)",fontSize:13}}>−{fmt(halfBills)}</span>
                </div>
                <span style={{color:"var(--ink-3)",fontSize:14}}>▾</span>
              </div>
              <div className="lb-pc-card">
                <div><div style={{fontSize:11,color:"var(--ink-2)"}}>Days</div><div style={{fontFamily:"var(--font-display)",fontSize:16,lineHeight:1.1}}>16 –<br/>End</div></div>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  <span style={{fontFamily:"var(--font-mono)",color:"var(--safe)",fontSize:13}}>+{fmt(halfIncome)}</span>
                  <span style={{fontFamily:"var(--font-mono)",color:"var(--debt)",fontSize:13}}>−{fmt(billsTotal-halfBills)}</span>
                </div>
                <span style={{color:"var(--ink-3)",fontSize:14}}>▾</span>
              </div>
              <div className="lb-pc-add" onClick={()=>navigate("calendar")}>+ Add Recurring Item</div>
            </aside>
            <main className="lb-main">
              <div className="lb-topbar">
                <div className="lb-tb-left">
                  <span className="lb-tb-num">ii ·</span>
                  <span className="lb-tb-title">Briefing</span>
                  <span className="lb-tb-div"/>
                  <span className="lb-tb-sub">{timeLabel}</span>
                </div>
                <div className="lb-tb-right">
                  <div className="lb-search"><span style={{color:"var(--ink-2)"}}>⌕</span> ask anything…<span className="lb-kbd">⌘K</span></div>
                  <div className="lb-avatar">{initials}</div>
                </div>
              </div>
              <div style={{marginBottom:40}}>
                <div className="lb-eyebrow">Good {today.getHours()<12?"morning":today.getHours()<17?"afternoon":"evening"} · the headline</div>
                <h2 className="lb-headline">After everything you owe, you have <em>{fmt(safeToSpend)}</em> truly free.</h2>
                <p className="lb-deck">
                  {daysLeft!=null?<>That's <em className="amt">{daysLeft} day{daysLeft!==1?"s":""}</em> of room until your next paycheck{nextPayDay?` on ${MN[today.getMonth()]} ${nextPayDay}`:""}.&nbsp;</>:<>Your funds are calculated across all accounts.&nbsp;</>}
                  You've got <em className="debt">{fmt(billsTotal)}</em> in scheduled bills already accounted for. The pressure gauge is sitting comfortably in <em className="amt">{pressureLabel}</em>. {upcomingBills.length===0?"No surprises in the queue.":`${upcomingBills.length} item${upcomingBills.length>1?"s":""} upcoming.`}
                </p>
                <div className="lb-callout">
                  <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:160}}><Gauge pct={pressurePct}/></div>
                  <div className="lb-cstats">
                    <div className="lb-stat"><div className="l">Safe to spend</div><div className="v safe">{fmt(safeToSpend)}</div><div className="s">{daysLeft!=null?`over ${daysLeft} days`:"right now"}</div></div>
                    <div className="lb-stat"><div className="l">Daily pace</div><div className="v">{dailyPace!=null?`$${dailyPace.toLocaleString()}`:"—"}<span style={{fontSize:12,color:"var(--ink-3)"}}>/d</span></div><div className="s">if spread evenly</div></div>
                    <div className="lb-stat"><div className="l">Bills incoming</div><div className="v debt">{fmt(billsTotal)}</div><div className="s">{upcomingBills.length} scheduled · all expected</div></div>
                    <div className="lb-stat"><div className="l">Next paycheck</div><div className="v calm">{nextPay?`+${fmt(nextPay.amountMin||0)}`:"—"}</div><div className="s">{nextPayDay&&daysLeft!=null?`${MN[today.getMonth()]} ${nextPayDay} · ${daysLeft} days`:"check calendar"}</div></div>
                  </div>
                </div>
              </div>
              <div className="lb-alloc">
                <div className="lb-alloc-head">
                  <h4>Where your <em>{fmt(allocTotal)}</em> is going</h4>
                  <span className="tot">total across checking + buffer</span>
                </div>
                <div className="lb-track">
                  <div className="seg free"    style={{flex:allocFree||1}}>{allocFree>allocTotal*0.15?`${fmt(allocFree)} free`:""}</div>
                  <div className="seg bills"   style={{flex:allocBill||1}}>{allocBill>allocTotal*0.15?`${fmt(allocBill)} bills`:""}</div>
                  {allocCush>0&&<div className="seg cushion" style={{flex:allocCush}}>{allocCush>allocTotal*0.12?`${fmt(allocCush)} cushion`:""}</div>}
                  {allocGoal>0&&<div className="seg goals"   style={{flex:allocGoal}}>{allocGoal>allocTotal*0.1?`${fmt(allocGoal)} goals`:""}</div>}
                  {allocFlex>0&&<div className="seg flex"    style={{flex:allocFlex}}>{allocFlex>allocTotal*0.08?`${fmt(allocFlex)} flex`:""}</div>}
                </div>
                <div className="lb-legend">
                  <span><span className="lb-led safe"/>&nbsp;Free · safe to spend</span>
                  <span><span className="lb-led debt"/>&nbsp;Bills ahead</span>
                  <span><span className="lb-led calm"/>&nbsp;Cushion (auto)</span>
                  {goals.length>0&&<span><span className="lb-led goal"/>&nbsp;Goals</span>}
                  <span><span className="lb-led warn"/>&nbsp;Flex pool</span>
                </div>
              </div>
              <div className="lb-whatif">
                <div className="lb-wi-head">
                  <h4>If you <em>did this</em>, what would it look like?</h4>
                  <span className="lb-wi-hint">tap to preview</span>
                </div>
                <div className="lb-wi-row">
                  {whatIfs.map((s,i)=>(
                    <div key={i} className={`lb-wi-card${selWI===i?" sel":""}`} onClick={()=>setSelWI(i)}>
                      <div className="lb-wi-nm">{s.nm}</div>
                      <div className="lb-wi-delta"><span>Safe-to-spend</span><span className={`v ${s.pos?"pos":"neg"}`}>{s.pos?"+":"−"}${s.delta.toLocaleString()}</span></div>
                    </div>
                  ))}
                </div>
                {whatIfs[selWI]&&(
                  <div style={{marginTop:12,padding:"16px 20px",background:"rgba(93,202,165,0.04)",border:"1px solid rgba(93,202,165,0.2)",borderRadius:"var(--r-md)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:13,color:"var(--ink-2)",fontStyle:"italic"}}>"{whatIfs[selWI].nm}"</span>
                    <span style={{fontFamily:"var(--font-display)",fontSize:28,letterSpacing:"-0.8px",color:whatIfs[selWI].pos?"var(--safe)":"var(--debt)"}}>{fmt(safeToSpend+(whatIfs[selWI].pos?1:-1)*whatIfs[selWI].delta)}</span>
                  </div>
                )}
              </div>
              <div style={{height:48}}/>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
