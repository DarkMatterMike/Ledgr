/**
 * LedgrBudgets.jsx — "The Runway" budget page
 * src/components/LedgrBudgets.jsx
 *
 * Props from AppInner:
 *   categories        {Array}   — with .id, .name, .color, .limit, .completedMonths
 *   sortedCategories  {Array}   — pre-sorted version
 *   spentByCat        {Object}  — { [catId]: number }
 *   monthTxns         {Array}   — transactions for selected month
 *   catMap            {Object}  — { [catId]: category }
 *   selectedMonth     {string}  — "YYYY-MM"
 *   monthLabel        {Function}
 *   totalSpent        {number}
 *   totalBudget       {number}
 *   today             {Date}
 *   fmt               {Function}
 *   isMobile          {boolean}
 *   navigate          {Function}
 *   openAddCat        {Function}
 *   openEditCat       {Function}
 *   deleteCat         {Function}
 *   toggleCatComplete {Function}
 *   updateTxnCat      {Function}
 *   editingLimitId    {string|null}
 *   setEditingLimitId {Function}
 *   editingLimitVal   {string}
 *   setEditingLimitVal{Function}
 *   saveLimit         {Function}
 *   startEditLimit    {Function}
 *   limitSuggestions  {Array}
 *   setLimitSuggestions{Function}
 *   suggestingLimits  {boolean}
 *   runSuggestLimits  {Function}
 *   hasApiKey         {boolean}
 */
import PageNav from "./PageNav.jsx";
import { useState, useMemo } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  :root{--bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;--bg-4:#1c2330;--line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);--line-3:rgba(255,255,255,0.18);--ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;--safe:#5dcaa5;--safe-d:#0f6e56;--safe-bg:rgba(93,202,165,0.08);--warn:#f0b04c;--warn-bg:rgba(240,176,76,0.08);--debt:#e87363;--debt-bg:rgba(232,115,99,0.08);--calm:#6c8cff;--calm-bg:rgba(108,140,255,0.08);--goal:#a78bff;--font-display:'Instrument Serif',Georgia,serif;--font-ui:'Geist',-apple-system,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;--r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;}
  .lb-wrap *,.lb-wrap *::before,.lb-wrap *::after{box-sizing:border-box;}
  .lb-wrap h1,.lb-wrap h2,.lb-wrap h3,.lb-wrap h4,.lb-wrap p{margin:0;padding:0;}
  .lb-wrap{font-family:var(--font-ui);color:var(--ink-0);-webkit-font-smoothing:antialiased;background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;}
  @media(max-width:1000px){.lb-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.lb-wrap{padding:0;}}
  .lb-frame{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden;max-width:1400px;margin:0 auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;flex-direction:column;min-height:800px;}
  @media(max-width:600px){.lb-frame{border-radius:0;border:none;}}
  .lb-bar{height:40px;background:var(--bg-2);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 18px;gap:8px;flex-shrink:0;}
  .lb-bar-live{margin-left:auto;display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .lb-sync-btn{background:none;border:1px solid rgba(255,255,255,0.06);border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-3);transition:.15s;flex-shrink:0;}
  .lb-sync-btn:hover{border-color:rgba(255,255,255,0.18);color:var(--ink-0);}
  .lb-sync-btn svg{transition:transform .6s;}
  .lb-sync-btn.spinning svg{animation:lb-bspin .7s linear infinite;}
  @keyframes lb-bspin{to{transform:rotate(360deg);}}
  .lb-bar-dot{width:9px;height:9px;border-radius:50%;background:var(--ink-4);}
  .lb-bar-url{margin-left:14px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-bar-live{margin-left:auto;display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .lb-body{display:grid;grid-template-columns:64px 1fr;flex:1;}
  .lb-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);flex-shrink:0;}
  .lb-nav-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d) 80%);margin-bottom:24px;}
  .lb-nav-item{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;}
  .lb-nav-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .lb-nav-item.active{color:var(--safe);background:var(--safe-bg);}
  .lb-nav-spacer{flex:1;}
  .lb-main{overflow-y:auto;min-width:0;}
  .lb-topbar{height:60px;padding:0 40px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg-1);z-index:10;flex-shrink:0;}
  .lb-tb-left{display:flex;align-items:baseline;gap:16px;}
  .lb-tb-num{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-tb-title{font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px;}
  .lb-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .lb-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .lb-tb-right{display:flex;align-items:center;gap:10px;}
  .lb-btn{background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 14px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:.15s;white-space:nowrap;}
  .lb-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .lb-btn.primary{background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe);}
  .lb-btn.ai{background:var(--calm-bg);border-color:rgba(108,140,255,0.3);color:var(--calm);}
  .lb-btn.ai:disabled{opacity:.4;cursor:not-allowed;}
  .lb-content{padding:36px 40px;}

  /* master runway */
  .lb-runway{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-xl);padding:28px 30px;margin-bottom:28px;}
  .lb-runway-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:20px;}
  .lb-runway-title{font-family:var(--font-display);font-size:28px;letter-spacing:-0.5px;font-weight:400;}
  .lb-runway-title em{font-style:italic;}
  .lb-runway-title em.ok{color:var(--safe);}
  .lb-runway-title em.warn{color:var(--warn);}
  .lb-runway-title em.over{color:var(--debt);}
  .lb-runway-meta{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-runway-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-bottom:20px;border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;}
  .lb-rstat{padding:12px 18px;border-right:1px solid var(--line);}
  .lb-rstat:last-child{border-right:none;}
  .lb-rstat-l{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px;}
  .lb-rstat-v{font-family:var(--font-mono);font-size:18px;font-weight:500;}
  /* track */
  .lb-track-wrap{position:relative;margin-bottom:8px;}
  .lb-track{height:44px;background:rgba(255,255,255,0.03);border-radius:var(--r-md);overflow:hidden;display:flex;border:1px solid var(--line);}
  .lb-track-spent{height:100%;display:flex;align-items:center;padding-left:14px;font-family:var(--font-mono);font-size:12px;white-space:nowrap;overflow:hidden;transition:width .6s ease;}
  .lb-track-free{height:100%;display:flex;align-items:center;justify-content:flex-end;padding-right:14px;font-family:var(--font-mono);font-size:12px;color:var(--safe);white-space:nowrap;background:rgba(93,202,165,0.06);transition:width .6s ease;}
  .lb-today-line{position:absolute;top:-4px;bottom:-4px;width:2px;background:rgba(255,255,255,0.35);border-radius:1px;pointer-events:none;}
  .lb-today-tip{position:absolute;top:-22px;transform:translateX(-50%);font-family:var(--font-mono);font-size:9px;color:var(--ink-2);white-space:nowrap;letter-spacing:0.3px;}
  .lb-track-ticks{display:flex;justify-content:space-between;padding:4px 2px 0;font-family:var(--font-mono);font-size:9px;color:var(--ink-4);}

  /* AI suggestions */
  .lb-suggest{background:rgba(108,140,255,0.04);border:1px solid rgba(108,140,255,0.2);border-radius:var(--r-lg);padding:18px 20px;margin-bottom:24px;}
  .lb-suggest-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
  .lb-suggest-title{font-size:13px;font-weight:600;color:var(--ink-0);display:flex;align-items:center;gap:8px;}
  .lb-suggest-sub{font-size:11px;color:var(--ink-3);margin-top:2px;}
  .lb-suggest-item{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-2);border-radius:var(--r-md);border:1px solid var(--line);margin-bottom:8px;}
  .lb-suggest-item:last-child{margin-bottom:0;}
  .lb-suggest-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
  .lb-suggest-name{font-size:13px;flex:1;min-width:0;}
  .lb-suggest-nums{display:flex;align-items:center;gap:8px;flex-shrink:0;}
  .lb-suggest-current{font-family:var(--font-mono);font-size:12px;color:var(--ink-3);}
  .lb-suggest-arrow{color:var(--ink-4);font-size:12px;}
  .lb-suggest-new{font-family:var(--font-mono);font-size:13px;font-weight:600;}
  .lb-suggest-reasoning{font-size:11px;color:var(--ink-3);margin-top:3px;}
  .lb-suggest-actions{display:flex;gap:6px;}
  .lb-suggest-accept{background:var(--safe-bg);border:1px solid rgba(93,202,165,0.3);border-radius:6px;padding:3px 10px;font-size:11px;font-family:var(--font-mono);color:var(--safe);cursor:pointer;}
  .lb-suggest-dismiss{background:transparent;border:1px solid var(--line);border-radius:6px;padding:3px 8px;font-size:11px;color:var(--ink-3);cursor:pointer;}

  /* category section */
  .lb-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
  .lb-section-label{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:var(--ink-3);font-family:var(--font-mono);}
  .lb-section-count{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-4);font-family:var(--font-mono);}

  /* band rows */
  .lb-band-row{display:grid;grid-template-columns:180px 1fr 100px 44px;gap:14px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.03);}
  .lb-band-row:last-child{border-bottom:none;}
  @media(max-width:800px){.lb-band-row{grid-template-columns:120px 1fr 80px;}}
  .lb-band-name{display:flex;align-items:center;gap:9px;min-width:0;}
  .lb-band-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .lb-band-nm{font-family:var(--font-display);font-size:16px;letter-spacing:-0.1px;color:var(--ink-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .lb-band-nm.done{color:var(--ink-3);text-decoration:line-through;text-decoration-color:var(--ink-4);}
  .lb-band-track{height:24px;background:rgba(255,255,255,0.03);border-radius:6px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,0.04);cursor:pointer;}
  .lb-band-fill{height:100%;border-radius:6px;display:flex;align-items:center;padding-left:10px;font-family:var(--font-mono);font-size:10px;white-space:nowrap;overflow:hidden;transition:width .5s ease;}
  .lb-band-limit-marker{position:absolute;top:0;bottom:0;right:0;width:1px;background:rgba(255,255,255,0.1);}
  .lb-band-remain{font-family:var(--font-mono);font-size:12px;font-weight:600;text-align:right;white-space:nowrap;}
  .lb-band-remain.ok{color:var(--safe);}
  .lb-band-remain.warn{color:var(--warn);}
  .lb-band-remain.over{color:var(--debt);}
  .lb-band-remain.done{color:var(--ink-4);}
  .lb-band-kebab{display:flex;align-items:center;justify-content:center;position:relative;}
  .lb-band-kebab-btn{background:none;border:none;cursor:pointer;color:var(--ink-4);font-size:16px;padding:4px;line-height:1;border-radius:6px;transition:.12s;}
  .lb-band-kebab-btn:hover{color:var(--ink-2);background:var(--bg-2);}
  .lb-band-menu{position:absolute;right:0;top:100%;margin-top:4px;background:var(--bg-3);border:1px solid var(--line-2);border-radius:var(--r-md);min-width:160px;z-index:50;box-shadow:0 8px 24px rgba(0,0,0,0.5);overflow:hidden;}
  .lb-band-menu button{display:block;width:100%;text-align:left;padding:9px 14px;background:none;border:none;cursor:pointer;font-size:13px;color:var(--ink-1);transition:background .1s;}
  .lb-band-menu button:hover{background:rgba(255,255,255,0.04);}
  .lb-band-menu button.danger{color:var(--debt);}
  .lb-band-menu-div{height:1px;background:var(--line);}

  /* expanded drill-down */
  .lb-drill{margin:0 0 8px 188px;padding:14px 16px;background:var(--bg-2);border-radius:0 0 var(--r-md) var(--r-md);border:1px solid var(--line);border-top:none;}
  @media(max-width:800px){.lb-drill{margin-left:0;}}
  .lb-drill-head{font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:var(--ink-3);margin-bottom:10px;display:flex;justify-content:space-between;}
  .lb-drill-txn{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.03);}
  .lb-drill-txn:last-child{border-bottom:none;}
  .lb-drill-bar{width:2px;height:22px;border-radius:1px;flex-shrink:0;}
  .lb-drill-name{flex:1;font-size:12px;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .lb-drill-date{font-family:var(--font-mono);font-size:10px;color:var(--ink-3);}
  .lb-drill-amt{font-family:var(--font-mono);font-size:12px;font-weight:600;color:var(--debt);flex-shrink:0;}
  .lb-drill-remove{background:none;border:none;cursor:pointer;color:var(--ink-4);font-size:13px;padding:2px 4px;line-height:1;transition:.1s;}
  .lb-drill-remove:hover{color:var(--debt);}
  .lb-drill-assign{border-top:1px solid var(--line);margin-top:10px;padding-top:10px;}
  .lb-drill-assign-label{font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:var(--ink-3);margin-bottom:6px;}
  .lb-drill-input{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--ink-0);width:100%;font-family:var(--font-ui);outline:none;}
  .lb-drill-input:focus{border-color:rgba(93,202,165,0.3);}
  .lb-drill-input::placeholder{color:var(--ink-4);}
  .lb-drill-candidate{display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:4px;}
  .lb-drill-candidate-name{flex:1;font-size:12px;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .lb-drill-candidate-meta{font-size:10px;color:var(--ink-3);font-family:var(--font-mono);}
  .lb-drill-candidate-amt{font-family:var(--font-mono);font-size:12px;font-weight:600;color:var(--debt);flex-shrink:0;}
  .lb-drill-assign-btn{background:rgba(93,202,165,0.1);border:1px solid rgba(93,202,165,0.25);border-radius:6px;padding:3px 10px;font-size:11px;font-family:var(--font-mono);color:var(--safe);cursor:pointer;flex-shrink:0;}

  /* limit inline edit */
  .lb-limit-edit{background:none;border:none;border-bottom:1px solid var(--calm);font-size:11px;color:var(--ink-0);outline:none;width:54px;font-family:var(--font-mono);padding:0 2px;}

  /* empty */
  .lb-empty{padding:80px 40px;text-align:center;color:var(--ink-3);}
  .lb-empty-title{font-family:var(--font-display);font-size:28px;color:var(--ink-2);margin-bottom:8px;}

  @media(max-width:700px){.lb-topbar,.lb-content{padding-left:20px;padding-right:20px;}.lb-runway-stats{grid-template-columns:1fr 1fr;}}

  @media(max-width:768px){.pn-nav{display:none !important;}}
`;

const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const NAV = [
  {icon:"◐",id:"dashboard"},
  {icon:"⇅",id:"transactions"},
  {icon:"▣",id:"accounts"},
  {icon:"◉",id:"budgets",active:true},
  {icon:"▦",id:"calendar"},
  {icon:"◈",id:"analytics"},
];

export default function LedgrBudgets({
  categories=[],sortedCategories=[],spentByCat={},monthTxns=[],catMap={},
  selectedMonth="",monthLabel=m=>m,
  totalSpent=0,totalBudget=0,
  today=new Date(),
  fmt=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Math.abs(n)),
  isMobile=false,navigate=()=>{},
  notifs=[],onDismissNotif=()=>{},onFilterReview=()=>{},
  openAddCat=()=>{},openEditCat=()=>{},deleteCat=()=>{},
  toggleCatComplete=()=>{},updateTxnCat=()=>{},
  editingLimitId=null,setEditingLimitId=()=>{},
  editingLimitVal="",setEditingLimitVal=()=>{},
  saveLimit=()=>{},startEditLimit=()=>{},
  limitSuggestions=[],setLimitSuggestions=()=>{},
  suggestingLimits=false,runSuggestLimits=()=>{},
  hasApiKey=false,
  showToast=()=>{},
  doSync=null,syncing=false,
}){
  const [expandedId,setExpandedId]  = useState(null);
  const [drillSearch,setDrillSearch]= useState("");
  const [kebabId,setKebabId]        = useState(null);

  // ── derived ─────────────────────────────────────────────────────
  const [cy,cm] = selectedMonth
    ? selectedMonth.split("-").map(Number)
    : [today.getFullYear(), today.getMonth()+1];

  const daysInMonth = new Date(cy, cm, 0).getDate();
  const todayDay    = cy===today.getFullYear()&&cm===today.getMonth()+1 ? today.getDate() : daysInMonth;
  const todayPct    = Math.min(100, Math.round((todayDay/daysInMonth)*100));

  const remaining    = totalBudget - totalSpent;
  const overBudget   = remaining < 0;
  const pctUsed      = totalBudget > 0 ? Math.min(totalSpent/totalBudget, 1.15) : 0;
  const spentWidth   = Math.min(Math.round(pctUsed*100), 100);
  const freeWidth    = 100 - spentWidth;

  const overCats     = (sortedCategories.length ? sortedCategories : categories).filter(c=>(spentByCat[c.id]||0)>c.limit&&c.limit>0);
  const warnCats     = (sortedCategories.length ? sortedCategories : categories).filter(c=>{const s=spentByCat[c.id]||0;const p=c.limit>0?s/c.limit:0;return p>=0.8&&p<=1&&!overCats.includes(c)&&!(c.completedMonths||[]).includes(selectedMonth);});
  const okCats       = (sortedCategories.length ? sortedCategories : categories).filter(c=>!overCats.includes(c)&&!warnCats.includes(c));
  const doneCats     = okCats.filter(c=>(c.completedMonths||[]).includes(selectedMonth));
  const activeCats   = okCats.filter(c=>!(c.completedMonths||[]).includes(selectedMonth));

  const allOrdered   = [...overCats,...warnCats,...activeCats,...doneCats];

  const monthName    = `${MN[cm-1]} ${cy}`;

  // ── band render ─────────────────────────────────────────────────
  function BandRow({cat}){
    const spent     = spentByCat[cat.id]||0;
    const limit     = cat.limit||0;
    const remaining = limit-spent;
    const pct       = limit>0 ? Math.min(spent/limit,1.15)*100 : 0;
    const over      = remaining<0;
    const warn      = !over&&limit>0&&spent/limit>=0.8;
    const done      = !over&&(cat.completedMonths||[]).includes(selectedMonth);
    const expanded  = expandedId===cat.id;

    const fillColor = over  ? "rgba(232,115,99,0.22)"
                    : done  ? "rgba(255,255,255,0.06)"
                    : warn  ? "rgba(240,176,76,0.18)"
                    : `${cat.color}22`;
    const textColor = over?"var(--debt)":done?"var(--ink-4)":warn?"var(--warn)":cat.color;
    const remainClass= over?"over":done?"done":warn?"warn":"ok";
    const remainLabel= over ? `−${fmt(Math.abs(remaining))}` : done ? "✓ done" : limit===0 ? fmt(spent) : `${fmt(remaining)} left`;

    // drill-down transactions
    const catTxns = monthTxns.filter(t=>t.categoryId===cat.id&&t.amount<0).sort((a,b)=>b.date.localeCompare(a.date));
    const q = drillSearch.toLowerCase().trim();
    const candidates = monthTxns.filter(t=>t.amount<0&&t.categoryId!==cat.id)
      .filter(t=>!q||(t.name||t.merchant||"").toLowerCase().includes(q)||(t.date||"").includes(q))
      .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,q?20:3);

    return(
      <>
        <div className="lb-band-row" style={{background:expanded?"rgba(255,255,255,0.01)":"transparent",borderRadius:expanded?"var(--r-md) var(--r-md) 0 0":"var(--r-sm)",cursor:"pointer"}} onClick={()=>{setExpandedId(p=>p===cat.id?null:cat.id);setDrillSearch("");}}>
          {/* name */}
          <div className="lb-band-name">
            <div className="lb-band-dot" style={{background:over?"var(--debt)":done?"var(--ink-4)":cat.color,boxShadow:over?"0 0 5px var(--debt)":warn?`0 0 4px ${cat.color}88`:"none"}}/>
            <span className={`lb-band-nm${done?" done":""}`}>{cat.name}</span>
          </div>

          {/* runway band */}
          <div className="lb-band-track" onClick={e=>e.stopPropagation()}>
            <div className="lb-band-fill" style={{width:`${Math.min(pct,100)}%`,background:fillColor,color:textColor}}>
              {pct>25?`${fmt(spent)} / ${fmt(limit)}`:""}
            </div>
            {!over&&<div className="lb-band-limit-marker"/>}
          </div>

          {/* remaining */}
          <div style={{display:"flex",flexDirection:"column",gap:1,alignItems:"flex-end"}}>
            <div className={`lb-band-remain ${remainClass}`}>{remainLabel}</div>
            {limit>0&&(
              <div style={{fontFamily:"var(--font-mono)",fontSize:9,color:"var(--ink-4)"}}>
                {editingLimitId===cat.id
                  ? <input className="lb-limit-edit" type="number" autoFocus
                      value={editingLimitVal}
                      onChange={e=>setEditingLimitVal(e.target.value)}
                      onBlur={()=>saveLimit(cat.id)}
                      onKeyDown={e=>{if(e.key==="Enter")saveLimit(cat.id);if(e.key==="Escape")setEditingLimitId(null);}}
                      onClick={e=>e.stopPropagation()}/>
                  : <span style={{cursor:"text",textDecorationLine:"underline",textDecorationStyle:"dotted",textUnderlineOffset:"2px"}}
                      onClick={e=>startEditLimit(cat,e)}>
                      {fmt(limit)} budget
                    </span>
                }
              </div>
            )}
          </div>

          {/* kebab */}
          <div className="lb-band-kebab">
            <button className="lb-band-kebab-btn" onClick={e=>{e.stopPropagation();setKebabId(p=>p===cat.id?null:cat.id);}}>⋯</button>
            {kebabId===cat.id&&(
              <>
                <div style={{position:"fixed",inset:0,zIndex:49}} onClick={()=>setKebabId(null)}/>
                <div className="lb-band-menu">
                  <button onClick={()=>{toggleCatComplete(cat.id);setKebabId(null);}}>{done?"✓ Unmark complete":"✓ Mark complete"}</button>
                  <button onClick={()=>{openEditCat(cat);setKebabId(null);}}>Edit category</button>
                  <div className="lb-band-menu-div"/>
                  <button className="danger" onClick={()=>{deleteCat(cat.id);setKebabId(null);}}>Delete</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* expanded drill */}
        {expanded&&(
          <div className="lb-drill">
            <div className="lb-drill-head">
              <span>Transactions · {catTxns.length} assigned</span>
              <span>{fmt(spent)} spent</span>
            </div>
            {catTxns.length===0
              ? <div style={{fontSize:12,color:"var(--ink-3)",marginBottom:12}}>No transactions assigned in {monthName}.</div>
              : catTxns.map(t=>(
                  <div key={t.id} className="lb-drill-txn">
                    <div className="lb-drill-bar" style={{background:cat.color+"66"}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="lb-drill-name">{t.name||t.merchant}</div>
                      <div className="lb-drill-date">{t.date}</div>
                    </div>
                    <div className="lb-drill-amt">{fmt(Math.abs(t.amount))}</div>
                    <button className="lb-drill-remove" title="Remove from category" onClick={()=>{updateTxnCat(t.id,"");showToast("Removed from "+cat.name);}}>✕</button>
                  </div>
                ))
            }
            <div className="lb-drill-assign">
              <div className="lb-drill-assign-label">Assign a transaction</div>
              <input className="lb-drill-input" placeholder="Search by name or date…" value={drillSearch} onChange={e=>setDrillSearch(e.target.value)} onClick={e=>e.stopPropagation()}/>
              <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:4}}>
                {candidates.length===0&&q
                  ? <div style={{fontSize:12,color:"var(--ink-3)"}}>No matching transactions.</div>
                  : candidates.map(t=>(
                      <div key={t.id} className="lb-drill-candidate">
                        <div style={{flex:1,minWidth:0}}>
                          <div className="lb-drill-candidate-name">{t.name||t.merchant}</div>
                          <div className="lb-drill-candidate-meta">{t.date}{t.categoryId&&catMap[t.categoryId]?` · ${catMap[t.categoryId].name}`:""}</div>
                        </div>
                        <div className="lb-drill-candidate-amt">{fmt(Math.abs(t.amount))}</div>
                        <button className="lb-drill-assign-btn" onClick={()=>{updateTxnCat(t.id,cat.id);setDrillSearch("");showToast("Assigned to "+cat.name);}}>+ Assign</button>
                      </div>
                    ))
                }
                {!q&&<div style={{fontSize:11,color:"var(--ink-4)",textAlign:"center",paddingTop:2}}>Showing 3 most recent · search to find more</div>}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── render ───────────────────────────────────────────────────────
  return(
    <>
      <style>{CSS}</style>
      <div className="lb-wrap">
        <div className="lb-frame">
          {/* chrome bar */}
          <div className="lb-bar">
            <div className="lb-bar-dot"/><div className="lb-bar-dot"/><div className="lb-bar-dot"/>
            <span className="lb-bar-url">app.ledgr.app / budgets</span>
            <span className="lb-bar-live">
              live · synced just now
              {doSync && (
                <button className={`lb-sync-btn${syncing?" spinning":""}`} onClick={()=>!syncing&&doSync()} title="Sync now">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
              )}
            </span>
          </div>

          <div className="lb-body">
            {/* sidenav */}
            {!isMobile&&<PageNav activeId="budgets" navigate={navigate} notifs={notifs} onDismissNotif={onDismissNotif} onFilterReview={onFilterReview}/>}

            <main className="lb-main">
              {/* topbar */}
              <div className="lb-topbar">
                <div className="lb-tb-left">
                  <span className="lb-tb-num">iii ·</span>
                  <span className="lb-tb-title">Budget Runway</span>
                  <span className="lb-tb-div"/>
                  <span className="lb-tb-sub">{monthName}</span>
                </div>
                <div className="lb-tb-right">
                  {hasApiKey&&(
                    <button className="lb-btn ai" onClick={runSuggestLimits} disabled={suggestingLimits}>
                      {suggestingLimits?"✦ Analyzing…":"✦ Optimize limits"}
                    </button>
                  )}
                  <button className="lb-btn primary" onClick={openAddCat}>+ New category</button>
                </div>
              </div>

              <div className="lb-content">

                {/* AI suggestions */}
                {limitSuggestions.length>0&&(
                  <div className="lb-suggest">
                    <div className="lb-suggest-head">
                      <div>
                        <div className="lb-suggest-title">✦ AI limit suggestions</div>
                        <div className="lb-suggest-sub">Based on your last 3 months of spending — accept or dismiss each</div>
                      </div>
                      <button className="lb-btn" onClick={()=>setLimitSuggestions([])}>Dismiss all</button>
                    </div>
                    {limitSuggestions.map(s=>{
                      const cat=catMap[s.categoryId];
                      if(!cat) return null;
                      const diff=s.suggestedLimit-(cat.limit||0);
                      return(
                        <div key={s.categoryId} className="lb-suggest-item">
                          <div className="lb-suggest-dot" style={{background:cat.color}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div className="lb-suggest-name">{cat.name}</div>
                            <div className="lb-suggest-reasoning">{s.reasoning}</div>
                          </div>
                          <div className="lb-suggest-nums">
                            <span className="lb-suggest-current">{fmt(cat.limit||0)}</span>
                            <span className="lb-suggest-arrow">→</span>
                            <span className="lb-suggest-new" style={{color:diff>0?"var(--warn)":diff<0?"var(--safe)":"var(--ink-2)"}}>{fmt(s.suggestedLimit)}</span>
                          </div>
                          <div className="lb-suggest-actions">
                            <button className="lb-suggest-accept" onClick={()=>{
                              setLimitSuggestions(p=>p.filter(x=>x.categoryId!==s.categoryId));
                              showToast(`${cat.name} updated to ${fmt(s.suggestedLimit)}`);
                            }}>Accept</button>
                            <button className="lb-suggest-dismiss" onClick={()=>setLimitSuggestions(p=>p.filter(x=>x.categoryId!==s.categoryId))}>✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* master runway */}
                <div className="lb-runway">
                  <div className="lb-runway-head">
                    <h2 className="lb-runway-title">
                      {overBudget
                        ? <><em className="over">{fmt(Math.abs(remaining))} over budget</em> this month</>
                        : remaining===0
                          ? <>Budget <em className="warn">fully spent</em> this month</>
                          : <><em className="ok">{fmt(remaining)}</em> left to spend within your budget</>
                      }
                    </h2>
                    <span className="lb-runway-meta">day {todayDay} of {daysInMonth}</span>
                  </div>

                  <div className="lb-runway-stats">
                    <div className="lb-rstat">
                      <div className="lb-rstat-l">Total budget</div>
                      <div className="lb-rstat-v" style={{color:"var(--ink-0)"}}>{fmt(totalBudget)}</div>
                    </div>
                    <div className="lb-rstat">
                      <div className="lb-rstat-l">Spent</div>
                      <div className="lb-rstat-v" style={{color:overBudget?"var(--debt)":"var(--ink-0)"}}>{fmt(totalSpent)}</div>
                    </div>
                    <div className="lb-rstat">
                      <div className="lb-rstat-l">Remaining</div>
                      <div className="lb-rstat-v" style={{color:overBudget?"var(--debt)":"var(--safe)"}}>{overBudget?"−":""}{fmt(Math.abs(remaining))}</div>
                    </div>
                    <div className="lb-rstat">
                      <div className="lb-rstat-l">% used</div>
                      <div className="lb-rstat-v" style={{color:overBudget?"var(--debt)":pctUsed>=0.8?"var(--warn)":"var(--ink-0)"}}>{Math.round(pctUsed*100)}%</div>
                    </div>
                  </div>

                  {/* runway track */}
                  <div className="lb-track-wrap" style={{paddingTop:24}}>
                    <div className="lb-today-line" style={{left:`${todayPct}%`}}>
                      <div className="lb-today-tip">today · {todayPct}%</div>
                    </div>
                    <div className="lb-track">
                      <div className="lb-track-spent" style={{
                        width:`${spentWidth}%`,
                        background:overBudget
                          ? "rgba(232,115,99,0.18)"
                          : pctUsed>=0.8
                            ? "linear-gradient(90deg,rgba(93,202,165,0.1),rgba(240,176,76,0.15))"
                            : "linear-gradient(90deg,rgba(93,202,165,0.12),rgba(93,202,165,0.06))",
                        color:overBudget?"var(--debt)":"var(--ink-1)",
                        minWidth:spentWidth>0?80:0,
                      }}>
                        {spentWidth>18?`${fmt(totalSpent)} spent`:""}
                      </div>
                      {!overBudget&&freeWidth>0&&(
                        <div className="lb-track-free" style={{width:`${freeWidth}%`,minWidth:freeWidth>0?60:0}}>
                          {freeWidth>12?`${fmt(remaining)} free`:""}
                        </div>
                      )}
                    </div>
                    <div className="lb-track-ticks">
                      <span>{MN[cm-1].slice(0,3)} 1</span>
                      <span>{MN[cm-1].slice(0,3)} {Math.round(daysInMonth/2)}</span>
                      <span>{MN[cm-1].slice(0,3)} {daysInMonth}</span>
                    </div>
                  </div>
                </div>

                {/* category bands */}
                {categories.length===0 ? (
                  <div className="lb-empty">
                    <div className="lb-empty-title">No categories yet</div>
                    <div>Add a category to start tracking your budget runway</div>
                    <button className="lb-btn primary" style={{marginTop:16}} onClick={openAddCat}>+ New category</button>
                  </div>
                ) : (
                  <>
                    {/* overspent */}
                    {overCats.length>0&&(
                      <div style={{marginBottom:24}}>
                        <div className="lb-section-head">
                          <span className="lb-section-label" style={{color:"var(--debt)"}}>⚠ Overspent</span>
                          <span className="lb-section-count">{overCats.length} {overCats.length===1?"category":"categories"}</span>
                        </div>
                        {overCats.map(cat=><BandRow key={cat.id} cat={cat}/>)}
                      </div>
                    )}

                    {/* warning */}
                    {warnCats.length>0&&(
                      <div style={{marginBottom:24}}>
                        <div className="lb-section-head">
                          <span className="lb-section-label" style={{color:"var(--warn)"}}>↑ Running low</span>
                          <span className="lb-section-count">{warnCats.length} {warnCats.length===1?"category":"categories"}</span>
                        </div>
                        {warnCats.map(cat=><BandRow key={cat.id} cat={cat}/>)}
                      </div>
                    )}

                    {/* on track */}
                    {activeCats.length>0&&(
                      <div style={{marginBottom:24}}>
                        <div className="lb-section-head">
                          <span className="lb-section-label">On track</span>
                          <span className="lb-section-count">{activeCats.length} {activeCats.length===1?"category":"categories"}</span>
                        </div>
                        {activeCats.map(cat=><BandRow key={cat.id} cat={cat}/>)}
                      </div>
                    )}

                    {/* completed */}
                    {doneCats.length>0&&(
                      <div style={{marginBottom:24}}>
                        <div className="lb-section-head">
                          <span className="lb-section-label" style={{color:"var(--ink-4)"}}>✓ Completed</span>
                          <span className="lb-section-count">{doneCats.length} {doneCats.length===1?"category":"categories"}</span>
                        </div>
                        {doneCats.map(cat=><BandRow key={cat.id} cat={cat}/>)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
