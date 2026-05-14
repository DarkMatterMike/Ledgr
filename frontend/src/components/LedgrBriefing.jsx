/**
 * LedgrBriefing.jsx — Dashboard, concept 2 "The Briefing"
 * src/components/LedgrBriefing.jsx
 *
 * Props:
 *   accounts, categories, monthTxns, recurringItems
 *   totalSpent, totalIncome, totalBudget, goals
 *   today, fmt, navigate, isMobile
 *   hasApiKey {boolean}  — from aiChat.hasApiKey
 *   apiBase   {string}   — Railway base URL e.g. "https://ledgr-production-9e35.up.railway.app"
 *   authHeaders {Function} — from api.js, returns { Authorization: "Bearer …" }
 */
import { useState, useMemo, useRef, useCallback } from "react";
import PageNav from "./PageNav.jsx";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  :root{--bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;--bg-4:#1c2330;--line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);--line-3:rgba(255,255,255,0.18);--ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;--safe:#5dcaa5;--safe-d:#0f6e56;--safe-bg:rgba(93,202,165,0.08);--warn:#f0b04c;--warn-d:#6b4708;--warn-bg:rgba(240,176,76,0.08);--debt:#e87363;--debt-d:#5a1c14;--debt-bg:rgba(232,115,99,0.08);--calm:#6c8cff;--calm-d:#1a2a66;--calm-bg:rgba(108,140,255,0.08);--goal:#a78bff;--goal-d:#2a1f5e;--goal-bg:rgba(167,139,255,0.08);--font-display:'Instrument Serif',Georgia,serif;--font-ui:'Geist',-apple-system,sans-serif;--font-mono:'JetBrains Mono',ui-monospace,monospace;--r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;}
  .lb-wrap *,.lb-wrap *::before,.lb-wrap *::after{box-sizing:border-box;}
  .lb-wrap h1,.lb-wrap h2,.lb-wrap h3,.lb-wrap h4,.lb-wrap p{margin:0;padding:0;}
  .lb-wrap{font-family:var(--font-ui);color:var(--ink-0);-webkit-font-smoothing:antialiased;background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;}
  @media(max-width:1000px){.lb-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.lb-wrap{padding:0;}}
  .lb-frame{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden;max-width:1400px;margin:0 auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);}
  @media(max-width:600px){.lb-frame{border-radius:0;border:none;}}
  .lb-bar{height:40px;background:var(--bg-2);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 18px;gap:8px;flex-shrink:0;}
  .lb-bar-dot{width:9px;height:9px;border-radius:50%;background:var(--ink-4);}
  .lb-bar-url{margin-left:14px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-bar-live{margin-left:auto;display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-sync-btn{background:none;border:1px solid rgba(255,255,255,0.06);border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-3);transition:.15s;flex-shrink:0;}
  .lb-sync-btn:hover{border-color:rgba(255,255,255,0.18);color:var(--ink-0);}
  .lb-sync-btn svg{transition:transform .6s;}
  .lb-sync-btn.spinning svg{animation:lb-brspin .7s linear infinite;}
  @keyframes lb-brspin{to{transform:rotate(360deg);}}
  .lb-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .lb-brief{display:grid;grid-template-columns:64px 320px 1fr;min-height:880px;}
  @media(max-width:1100px){.lb-brief{grid-template-columns:64px 1fr;}}
  .lb-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);}
  .lb-nav-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d) 80%);margin-bottom:24px;}
  .lb-nav-item{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;}
  .lb-nav-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .lb-nav-item.active{color:var(--safe);background:var(--safe-bg);}
  .lb-nav-spacer{flex:1;}
  .lb-agenda{border-right:1px solid var(--line);background:var(--bg-1);padding:22px 18px;overflow-y:auto;}
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
  .lb-pc-expand{background:var(--bg-1);border:1px solid var(--line);border-top:none;border-radius:0 0 8px 8px;padding:0 0 4px;margin-top:-8px;overflow:hidden;}
  .lb-pc-sect-lbl{font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-4);padding:10px 14px 4px;border-top:1px solid var(--line);}
  .lb-pc-sect-lbl:first-child{border-top:none;padding-top:12px;}
  .lb-pc-acct{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;gap:8px;}
  .lb-pc-acct .l{font-size:12px;color:var(--ink-2);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .lb-pc-acct .v{font-family:var(--font-mono);font-size:12px;color:var(--debt);flex-shrink:0;}
  .lb-pc-acct .v.ok{color:var(--safe);}
  .lb-pc-net{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;margin:4px 8px;background:var(--bg-2);border-radius:6px;border:1px solid var(--line);}
  .lb-pc-net .l{font-size:11px;color:var(--ink-3);letter-spacing:0.5px;}
  .lb-pc-net .v{font-family:var(--font-mono);font-size:14px;font-weight:600;}
  .lb-pc-net .v.ok{color:var(--safe);}
  .lb-pc-net .v.neg{color:var(--debt);}
  .lb-pc-card.open{border-radius:8px 8px 0 0;border-bottom-color:transparent;}
  .lb-main{padding:36px 40px;overflow-y:auto;min-width:0;}
  .lb-topbar{display:flex;align-items:center;justify-content:space-between;padding:0 0 20px;margin-bottom:28px;border-bottom:1px solid var(--line);}
  .lb-tb-left{display:flex;align-items:baseline;gap:16px;}
  .lb-tb-num{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-tb-title{font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px;}
  .lb-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .lb-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .lb-tb-right{display:flex;align-items:center;gap:14px;}
  .lb-eyebrow{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:var(--ink-3);font-weight:500;margin-bottom:8px;}
  .lb-headline{font-family:var(--font-display);font-size:56px;line-height:1.02;letter-spacing:-1.5px;font-weight:400;margin-bottom:24px;transition:color .3s;}
  .lb-headline em{font-style:italic;color:var(--safe);}
  .lb-headline em.warn{color:var(--warn);}
  .lb-headline em.debt{color:var(--debt);}
  .lb-deck{font-size:16px;color:var(--ink-1);line-height:1.65;max-width:580px;margin-bottom:28px;}
  .lb-deck .amt{font-style:normal;font-family:var(--font-mono);color:var(--safe);}
  .lb-deck .debt{font-style:normal;font-family:var(--font-mono);color:var(--debt);}
  .lb-callout{margin-top:28px;background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-xl);padding:28px;display:grid;grid-template-columns:240px 1fr;gap:28px;align-items:center;}
  @media(max-width:900px){.lb-callout{grid-template-columns:1fr;}}
  .lb-cstats{display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;}
  .lb-stat{border-left:1px solid var(--line-2);padding-left:14px;}
  .lb-stat .l{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);}
  .lb-stat .v{font-family:var(--font-mono);font-size:18px;margin-top:3px;transition:color .3s;}
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
  .lb-track .seg{display:flex;align-items:center;padding:0 12px;font-family:var(--font-mono);font-size:11px;overflow:hidden;white-space:nowrap;transition:flex .4s ease;}
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

  /* story headline */
  .lb-story-head{font-family:var(--font-display);font-size:60px;line-height:0.98;letter-spacing:-2px;font-weight:400;margin-bottom:24px;}
  .lb-story-head .story-num{font-family:var(--font-display);font-style:italic;display:inline-block;margin:0 4px;}
  @media(max-width:900px){.lb-story-head{font-size:40px;letter-spacing:-1px;}}

  /* gauge + pool callout */
  .lb-story-callout{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch;}
  @media(max-width:900px){.lb-story-callout{grid-template-columns:1fr;}}
  .lb-gauge-card{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-xl);padding:24px 20px 20px;display:flex;flex-direction:column;align-items:center;}
  .lb-gauge-lbl{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:var(--ink-3);margin-bottom:10px;align-self:flex-start;}
  .lb-gauge-readout{text-align:center;margin-top:6px;}
  .lb-gauge-pct{font-family:var(--font-display);font-size:48px;letter-spacing:-1.5px;line-height:1;transition:color .3s;}
  .lb-gauge-sub{font-size:12px;color:var(--ink-2);margin-top:6px;font-family:var(--font-mono);}
  .lb-pools{display:flex;flex-direction:column;gap:12px;}
  .lb-pool-card{display:grid;grid-template-columns:6px 1fr auto;gap:16px;align-items:center;padding:20px 20px;border-radius:var(--r-lg);border:1px solid var(--line);}
  .lb-pool-card.lb-pool-free{background:linear-gradient(180deg,rgba(93,202,165,0.06),rgba(93,202,165,0.01));border-color:rgba(93,202,165,0.22);}
  .lb-pool-card.lb-pool-locked{background:var(--bg-2);}
  .lb-pool-stripe{width:4px;border-radius:2px;height:40px;flex-shrink:0;}
  .lb-pool-card.lb-pool-free .lb-pool-stripe{background:var(--safe);box-shadow:0 0 10px var(--safe);}
  .lb-pool-card.lb-pool-locked .lb-pool-stripe{background:var(--ink-4);}
  .lb-pool-nm{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;margin-bottom:4px;}
  .lb-pool-card.lb-pool-free .lb-pool-nm{color:var(--safe);}
  .lb-pool-card.lb-pool-locked .lb-pool-nm{color:var(--ink-3);}
  .lb-pool-desc{font-size:12px;color:var(--ink-1);}
  .lb-pool-v{font-family:var(--font-display);font-size:32px;letter-spacing:-1px;transition:color .3s;}
  .lb-pool-card.lb-pool-free .lb-pool-v{color:var(--safe);}
  .lb-pool-card.lb-pool-locked .lb-pool-v{color:var(--ink-0);}

  /* what-if section */
  .lb-whatif{margin-top:24px;}
  .lb-wi-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
  .lb-wi-head h4{font-family:var(--font-display);font-size:24px;font-weight:400;letter-spacing:-0.4px;}
  .lb-wi-head h4 em{font-style:italic;color:var(--safe);}
  .lb-wi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;}
  @media(max-width:900px){.lb-wi-row{grid-template-columns:1fr 1fr;}}
  @media(max-width:600px){.lb-wi-row{grid-template-columns:1fr;}}
  .lb-wi-card{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-md);padding:16px;cursor:pointer;transition:border-color .15s,background .15s;position:relative;}
  .lb-wi-card:hover{border-color:var(--line-3);}
  .lb-wi-card.sel{border-color:rgba(93,202,165,0.4);background:rgba(93,202,165,0.04);}
  .lb-wi-card.ai-card{border-color:rgba(108,140,255,0.3);background:rgba(108,140,255,0.04);}
  .lb-wi-card.ai-card.sel{border-color:rgba(108,140,255,0.5);background:rgba(108,140,255,0.08);}
  .lb-wi-card.impossible{border-color:rgba(232,115,99,0.25);background:rgba(232,115,99,0.04);}
  .lb-wi-card.impossible:hover{border-color:rgba(232,115,99,0.35);}
  .lb-wi-card.impossible.sel{border-color:rgba(232,115,99,0.5);background:rgba(232,115,99,0.08);}
  .lb-wi-impossible{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--debt);font-family:var(--font-mono);margin-top:4px;}
  .lb-wi-tag{font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:var(--calm);font-family:var(--font-mono);margin-bottom:6px;}
  .lb-wi-nm{font-size:13px;color:var(--ink-1);line-height:1.4;margin-bottom:8px;}
  .lb-wi-delta{display:flex;justify-content:space-between;align-items:center;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-3);}
  .lb-wi-delta .v{font-family:var(--font-mono);font-size:14px;letter-spacing:0;}
  .lb-wi-delta .v.pos{color:var(--safe);}
  .lb-wi-delta .v.neg{color:var(--debt);}
  .lb-wi-clear{position:absolute;top:10px;right:10px;background:rgba(255,255,255,0.06);border:1px solid var(--line);border-radius:99px;font-size:9px;padding:2px 8px;color:var(--ink-3);cursor:pointer;font-family:var(--font-mono);letter-spacing:0.5px;transition:.15s;}
  .lb-wi-clear:hover{background:rgba(255,255,255,0.1);color:var(--ink-1);}
  .lb-wi-loading{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-3);font-family:var(--font-mono);}
  .lb-wi-loading::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--calm);animation:lb-pulse 1.2s ease-in-out infinite;}
  @keyframes lb-pulse{0%,100%{opacity:.3}50%{opacity:1}}

  /* AI ask bar */
  .lb-ask{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--r-lg);padding:14px 18px;display:flex;align-items:center;gap:12px;}
  .lb-ask-ico{font-size:14px;color:var(--calm);flex-shrink:0;}
  .lb-ask input{background:none;border:none;outline:none;color:var(--ink-0);font-family:var(--font-mono);font-size:13px;flex:1;min-width:0;}
  .lb-ask input::placeholder{color:var(--ink-3);}
  .lb-ask-hint{font-size:11px;color:var(--ink-3);font-family:var(--font-mono);white-space:nowrap;}
  .lb-ask-send{background:var(--calm-bg);border:1px solid rgba(108,140,255,0.3);border-radius:8px;padding:5px 14px;font-size:11px;font-family:var(--font-mono);color:var(--calm);cursor:pointer;transition:.15s;white-space:nowrap;}
  .lb-ask-send:hover{background:rgba(108,140,255,0.15);}
  .lb-ask-send:disabled{opacity:.4;cursor:not-allowed;}
  .lb-no-key{font-size:12px;color:var(--ink-3);font-family:var(--font-mono);text-align:center;padding:10px 0;}
  .lb-no-key a{color:var(--calm);cursor:pointer;text-decoration:underline;}
`;

const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const NAV=[{icon:"◐",id:"dashboard",active:true},{icon:"⇅",id:"transactions"},{icon:"▣",id:"accounts"},{icon:"◉",id:"budgets"},{icon:"▦",id:"calendar"},{icon:"◈",id:"analytics"}];

function daysUntil(d,today){
  const t=today.getDate(),dim=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  return d>=t?d-t:dim-t+d;
}

/* ─── Pressure Gauge ──────────────────────────────────────────── */
function Gauge({pct=0.5}){
  const angle=-90+pct*180;
  const needleColor=pct>0.5?"#5dcaa5":pct>0.25?"#f0b04c":"#e87363";
  return(
    <svg viewBox="0 0 220 160" style={{width:"100%",height:"100%",display:"block"}}>
      <defs>
        <linearGradient id="ggrad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#e87363"/>
          <stop offset="0.45" stopColor="#f0b04c"/>
          <stop offset="0.7" stopColor="#5dcaa5"/>
          <stop offset="1" stopColor="#6c8cff"/>
        </linearGradient>
      </defs>
      <path d="M 30 120 A 80 80 0 0 1 190 120" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="none" strokeLinecap="round"/>
      <path d="M 30 120 A 80 80 0 0 1 190 120" stroke="url(#ggrad)" strokeWidth="12" fill="none" strokeLinecap="round"/>
      <g transform={`rotate(${angle} 110 120)`} style={{transition:"transform .6s cubic-bezier(.34,1.56,.64,1)"}}>
        <line x1="110" y1="120" x2="110" y2="50" stroke={needleColor} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="110" cy="50" r="3.5" fill={needleColor}/>
      </g>
      <circle cx="110" cy="120" r="9" fill="#11151d" stroke="rgba(255,255,255,0.2)"/>
      <circle cx="110" cy="120" r="3.5" fill={needleColor}/>
      <text x="30" y="138" fontSize="9" fill="#e87363" fontFamily="JetBrains Mono" textAnchor="middle">TIGHT</text>
      <text x="110" y="32" fontSize="9" fill="#5dcaa5" fontFamily="JetBrains Mono" textAnchor="middle">SAFE</text>
      <text x="190" y="138" fontSize="9" fill="#6c8cff" fontFamily="JetBrains Mono" textAnchor="middle">AHEAD</text>
    </svg>
  );
}

/* ─── Mini Calendar ───────────────────────────────────────────── */
function MiniCal({today,bills,incs,mixes}){
  const[cm,setCm]=useState({y:today.getFullYear(),m:today.getMonth()});
  const{y,m}=cm;
  const first=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate(),dimp=new Date(y,m,0).getDate();
  const isCur=y===today.getFullYear()&&m===today.getMonth();
  const cells=[];
  for(let i=first-1;i>=0;i--) cells.push({d:dimp-i,muted:true});
  for(let d=1;d<=dim;d++) cells.push({d,isToday:isCur&&d===today.getDate(),hasMix:isCur&&mixes.has(d),hasBill:isCur&&bills.has(d),hasInc:isCur&&incs.has(d)});
  while(cells.length<42) cells.push({d:cells.length-first-dim+1,muted:true});
  return(
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

/* ─── Scenario generation ─────────────────────────────────────── */
function generateScenarios(categories,monthTxns,upcomingBills,accounts,safeToSpend){
  const pool=[];

  // Pool 1: skip a spending category for the week
  const spendCats=categories.filter(c=>c.limit>0);
  spendCats.forEach(cat=>{
    const spent=monthTxns.filter(t=>t.categoryId===cat.id&&t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    if(spent>0){
      const weekly=Math.round(spent/4.33);
      if(weekly>5) pool.push({nm:`Skip ${cat.name.toLowerCase()} for one week`,delta:weekly,pos:true,source:"category"});
    }
  });

  // Pool 2: defer an upcoming bill
  upcomingBills.forEach(b=>{
    if(b.amountMin>0) pool.push({nm:`Defer ${b.name} to next cycle`,delta:b.amountMin,pos:true,source:"bill"});
  });

  // Pool 3: cancel a subscription-type bill
  const subs=upcomingBills.filter(b=>/netflix|spotify|hulu|disney|amazon prime|apple|gym|fitness|sub/i.test(b.name));
  subs.forEach(s=>{
    if(s.amountMin>0) pool.push({nm:`Cancel ${s.name}`,delta:s.amountMin,pos:true,source:"sub"});
  });

  // Pool 4: fixed hypothetical expenses (always available)
  pool.push({nm:"$200 weekend trip",delta:200,pos:false,source:"fixed"});
  pool.push({nm:"$100 impulse purchase",delta:100,pos:false,source:"fixed"});
  pool.push({nm:"$500 emergency buffer",delta:500,pos:false,source:"fixed"});

  // Pool 5: save a portion of safe-to-spend
  if(safeToSpend>100){
    const save=Math.round(safeToSpend*0.2/10)*10;
    pool.push({nm:`Auto-save $${save} to emergency fund`,delta:save,pos:false,source:"save"});
  }

  // Shuffle and pick 4 unique ones, preferring variety of source types
  const shuffled=[...pool].sort(()=>Math.random()-0.5);
  const picked=[];
  const usedSources=new Set();
  // First pass: one of each source type
  for(const s of shuffled){
    if(picked.length>=4) break;
    if(!usedSources.has(s.source)){picked.push(s);usedSources.add(s.source);}
  }
  // Second pass: fill remaining slots
  for(const s of shuffled){
    if(picked.length>=4) break;
    if(!picked.includes(s)) picked.push(s);
  }
  return picked.slice(0,4);
}

/* ─── Main component ──────────────────────────────────────────── */
export default function LedgrBriefing({
  accounts=[],categories=[],monthTxns=[],recurringItems=[],
  totalSpent=0,totalIncome=0,totalBudget=0,goals=[],
  today=new Date(),
  fmt=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Math.abs(n)),
  navigate=()=>{},
  isMobile=false,
  hasApiKey=false,
  apiBase="https://ledgr-production-9e35.up.railway.app",
  authHeaders=()=>({}),
  doSync=null,syncing=false,
  notifs=[],onDismissNotif=()=>{},onFilterReview=()=>{},
}){
  // ── Computed financials ────────────────────────────────────────
  const totalBalance=useMemo(()=>accounts.reduce((s,a)=>s+(a.balance||0),0),[accounts]);
  const checkingBal =useMemo(()=>accounts.filter(a=>a.type==="checking").reduce((s,a)=>s+(a.balance||0),0),[accounts]);
  const curY=today.getFullYear(),curM=today.getMonth()+1;

  const upcomingBills=useMemo(()=>recurringItems.filter(r=>{
    if(r.type==="income"||!r.recurringDay) return false;
    return!(r.linkedTxnIds||[]).some(id=>{
      const t=monthTxns.find(x=>x.id===id);
      if(!t?.date) return false;
      const[ty,tm]=t.date.split("-").map(Number);
      return ty===curY&&tm===curM;
    });
  }).sort((a,b)=>(parseInt(a.recurringDay)||0)-(parseInt(b.recurringDay)||0)),[recurringItems,monthTxns,curY,curM]);

  const upcomingIncome=useMemo(()=>recurringItems.filter(r=>{
    if(r.type!=="income"||!r.recurringDay) return false;
    return!(r.linkedTxnIds||[]).some(id=>{
      const t=monthTxns.find(x=>x.id===id);
      if(!t?.date) return false;
      const[ty,tm]=t.date.split("-").map(Number);
      return ty===curY&&tm===curM;
    });
  }).sort((a,b)=>(parseInt(a.recurringDay)||0)-(parseInt(b.recurringDay)||0)),[recurringItems,monthTxns,curY,curM]);

  const billsTotal  =useMemo(()=>upcomingBills.reduce((s,b)=>s+(b.amountMin||0),0),[upcomingBills]);
  const nextPay     =upcomingIncome[0]||null;
  const nextPayDay  =nextPay?.recurringDay||null;
  const daysLeft    =nextPayDay?daysUntil(nextPayDay,today):null;
  const safeToSpend =Math.max(0,Math.round(checkingBal-billsTotal));
  const dailyPace   =daysLeft&&daysLeft>0?Math.round(safeToSpend/daysLeft):null;
  const pressurePct =checkingBal>0?Math.max(0,Math.min(1,safeToSpend/checkingBal)):0;
  const pressureLabel=pressurePct>0.5?"safe":pressurePct>0.25?"moderate":"tight";
  const goalsSaved  =useMemo(()=>goals.reduce((s,g)=>s+(g.savedAmount||0),0),[goals]);

  const billDays=useMemo(()=>{const s=new Set();recurringItems.filter(r=>r.type!=="income"&&r.recurringDay).forEach(r=>s.add(parseInt(r.recurringDay)));return s;},[recurringItems]);
  const incDays =useMemo(()=>{const s=new Set();recurringItems.filter(r=>r.type==="income"&&r.recurringDay).forEach(r=>s.add(parseInt(r.recurringDay)));return s;},[recurringItems]);
  const mixDays =useMemo(()=>{const s=new Set();billDays.forEach(d=>{if(incDays.has(d))s.add(d);});return s;},[billDays,incDays]);

  // ── What-if state ──────────────────────────────────────────────
  const initScenarios=useMemo(()=>generateScenarios(categories,monthTxns,upcomingBills,accounts,safeToSpend),[]);
  const[scenarios,setScenarios]=useState(initScenarios);
  const[selIdx,setSelIdx]=useState(null); // null = none active
  const[expandedCard,setExpandedCard]=useState(null); // 0 | 1 | null
  const[aiLoading,setAiLoading]=useState(false);
  const[aiInput,setAiInput]=useState("");
  const aiInputRef=useRef(null);

  // Active delta — 0 when nothing selected
  const activeDelta=selIdx!==null&&scenarios[selIdx]
    ?scenarios[selIdx].pos?scenarios[selIdx].delta:-scenarios[selIdx].delta
    :0;

  // All displayed values adjust when a scenario is active
  const displaySafe   =Math.max(0,safeToSpend+activeDelta);
  const displayPct    =checkingBal>0?Math.max(0,Math.min(1,displaySafe/checkingBal)):0;
  const displayLabel  =displayPct>0.5?"safe":displayPct>0.25?"moderate":"tight";
  const displayPace   =daysLeft&&daysLeft>0?Math.round(displaySafe/daysLeft):null;

  // Alloc bar uses displaySafe
  const allocFree =displaySafe;
  const allocBill =billsTotal;
  const allocCush =Math.round(checkingBal*0.1);
  const allocGoal =Math.round(goalsSaved*0.1);
  const allocFlex =Math.round(totalSpent*0.05);
  const allocTotal=allocFree+allocBill+allocCush+allocGoal+allocFlex;

  // Headline color based on pressure
  const safeColor=displayPct>0.5?"var(--safe)":displayPct>0.25?"var(--warn)":"var(--debt)";

  // ── AI scenario handler ────────────────────────────────────────
  const askScenario=useCallback(async()=>{
    const q=aiInput.trim();
    if(!q||aiLoading) return;
    setAiLoading(true);
    setAiInput("");

    try{
      const context={
        safeToSpend,checkingBal,billsTotal,
        upcomingBills:upcomingBills.map(b=>({name:b.name,amount:b.amountMin})),
        topCategories:categories.slice(0,8).map(c=>({
          name:c.name,
          spent:monthTxns.filter(t=>t.categoryId===c.id&&t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0),
        })),
        totalIncome,totalSpent,
      };

      // Embed JSON instruction in the message itself — backend system prompt is fixed
      // so we can't override it, but the user message content gets processed faithfully.
      const enrichedMessage=`Analyze this financial what-if and respond with ONLY a raw JSON object, no markdown or explanation.

My finances: safe-to-spend $${safeToSpend}, checking $${checkingBal}, upcoming bills $${billsTotal} (${upcomingBills.map(b=>b.name+" $"+b.amountMin).join(", ")||"none"}), monthly income $${totalIncome}, monthly expenses $${totalSpent}, top spending: ${context.topCategories.map(c=>c.name+" $"+Math.round(c.spent)).join(", ")||"none"}.

Scenario: "${q}"

Reply with ONLY: {"name":"max 8 word label","delta":positiveNumber,"positive":trueOrFalse}`;

      const res=await fetch(`${apiBase}/api/ai/chat`,{
        method:"POST",
        headers:{...authHeaders(),"Content-Type":"application/json"},
        body:JSON.stringify({
          message:enrichedMessage,
          history:[],
          context,
        }),
      });

      if(!res.ok) throw new Error("API error");

      // Collect streamed response
      const reader=res.body.getReader();
      const decoder=new TextDecoder();
      let full="";
      while(true){
        const{done,value}=await reader.read();
        if(done) break;
        const chunk=decoder.decode(value,{stream:true});
        for(const line of chunk.split("\n")){
          if(line.startsWith("data: ")){
            const data=line.slice(6);
            if(data==="[DONE]") break;
            try{const j=JSON.parse(data);full+=j.delta?.text||"";}catch{}
          }
        }
      }

      // Parse JSON — try strict match first, then fallback extraction
      let parsed=null;
      const jsonMatch=full.match(/\{[^{}]*"name"[^{}]*"delta"[^{}]*\}/s)||full.match(/\{[\s\S]*?\}/);
      if(jsonMatch){
        try{ parsed=JSON.parse(jsonMatch[0]); }catch(e){
          // try to clean up common issues: unquoted values, trailing commas
          try{ parsed=JSON.parse(jsonMatch[0].replace(/,\s*}/g,"}").replace(/([{,]\s*)(\w+):/g,'$1"$2:')); }catch{}
        }
      }
      // If JSON failed entirely, try to extract a dollar amount from plain text
      if(!parsed||!parsed.delta){
        const amtMatch=full.match(/\$([\d,]+)/);
        const amt=amtMatch?parseInt(amtMatch[1].replace(/,/g,"")):0;
        const isPositive=!/spend|cost|buy|purchase|trip|vacation|lose|reduce|cut/i.test(full)||/save|earn|raise|income|gain/i.test(full);
        parsed={ name:q.slice(0,40), delta:amt, positive:isPositive };
      }

      const newScenario={
        nm:(parsed.name||q).slice(0,50),
        delta:Math.round(Math.abs(parsed.delta||0)),
        pos:parsed.positive!==false,
        source:"ai",
        isAi:true,
      };

      // Shift: new card at index 0, card 4 drops off
      setScenarios(prev=>[newScenario,...prev.slice(0,3)]);
      setSelIdx(0); // auto-select the new AI scenario
    }catch(err){
      console.warn("What-if AI error:",err);
      // Fallback: add a simple scenario from the question
      const fallback={nm:q.slice(0,40)+"…",delta:0,pos:true,source:"ai",isAi:true,error:true};
      setScenarios(prev=>[fallback,...prev.slice(0,3)]);
      setSelIdx(null);
    }finally{
      setAiLoading(false);
    }
  },[aiInput,aiLoading,safeToSpend,checkingBal,billsTotal,upcomingBills,categories,monthTxns,totalIncome,totalSpent,apiBase,authHeaders]);

  function handleAiKey(e){if(e.key==="Enter") askScenario();}

  function selectCard(i){setSelIdx(prev=>prev===i?null:i);}
  function clearCard(e,i){e.stopPropagation();if(selIdx===i)setSelIdx(null);}

  // ── Display helpers ────────────────────────────────────────────
  const initials=accounts[0]?.institution?.slice(0,2).toUpperCase()||"ME";
  const halfIncome=nextPay?(nextPay.amountMin||0):totalIncome/2;
  const halfBills=billsTotal/2;
  const timeLabel=`${DN[today.getDay()]}, ${MN[today.getMonth()]} ${today.getDate()} · ${today.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`;

  return(
    <>
      <style>{CSS}</style>
      <div className="lb-wrap">
        <div className="lb-frame">

          {/* chrome bar */}
          <div className="lb-bar">
            <div className="lb-bar-dot"/><div className="lb-bar-dot"/><div className="lb-bar-dot"/>
            <span className="lb-bar-url">app.ledgr.app / home</span>
            <span className="lb-bar-live">
              live · synced just now
              {doSync && (
                <button className={`lb-sync-btn${syncing?" spinning":""}`} onClick={()=>!syncing&&doSync()} title="Sync now">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
              )}
            </span>
          </div>

          {/* brief grid */}
          <div className="lb-brief">

            {/* sidenav */}
            <PageNav activeId="dashboard" navigate={navigate} notifs={notifs} onDismissNotif={onDismissNotif} onFilterReview={onFilterReview} fmt={fmt}/>

            {/* agenda */}
            <aside className="lb-agenda">
              <MiniCal today={today} bills={billDays} incs={incDays} mixes={mixDays}/>
              <div className="lb-mstats">
                <div className="lb-mrow"><span className="l">Monthly expenses</span><span className="v debt">−{fmt(totalBudget)}</span></div>
                <div className="lb-mrow"><span className="l">Expected income</span><span className="v safe">+{fmt(recurringItems.filter(r=>r.type==="income").reduce((s,r)=>s+(r.amountMin||0),0))}</span></div>
                <div className="lb-mrow"><span className="l">Posted so far</span><span className="v">{fmt(totalSpent)}</span></div>
                <div className="lb-mrow"><span className="l">Remaining</span><span className="v calm">{fmt(displaySafe)}</span></div>
              </div>
              <div className="lb-pc-lbl">Paycheck planning</div>
              {[
                {label:"1 – 15",  income:halfIncome, bills:halfBills,            billItems:upcomingBills.filter(b=>(parseInt(b.recurringDay)||31)<=15)},
                {label:"16 – End",income:halfIncome, bills:billsTotal-halfBills, billItems:upcomingBills.filter(b=>(parseInt(b.recurringDay)||31)>15)},
              ].map((card,i)=>{
                const isOpen=expandedCard===i;
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
                  <div key={i} style={{marginBottom:8}}>
                    <div className={`lb-pc-card${isOpen?" open":""}`} onClick={()=>setExpandedCard(isOpen?null:i)}>
                      <div><div style={{fontSize:11,color:"var(--ink-2)"}}>Days</div><div style={{fontFamily:"var(--font-display)",fontSize:16,lineHeight:1.1}}>{card.label}</div></div>
                      <div style={{display:"flex",flexDirection:"column",gap:2}}>
                        <span style={{fontFamily:"var(--font-mono)",color:"var(--safe)",fontSize:13}}>+{fmt(card.income)}</span>
                        <span style={{fontFamily:"var(--font-mono)",color:"var(--debt)",fontSize:13}}>−{fmt(card.bills)}</span>
                      </div>
                      <span className={`lb-pc-chevron${isOpen?" open":""}`} style={{color:"var(--ink-3)",fontSize:11}}>▾</span>
                    </div>
                    {isOpen&&(
                      <div className="lb-pc-expand">
                        {card.billItems.length===0 ? (
                          <div style={{padding:"14px",fontSize:11,color:"var(--ink-3)",fontStyle:"italic"}}>No bills in this period.</div>
                        ) : acctRows.map(row=>(
                          <div key={row.name}>
                            {acctRows.length>1&&(
                              <div className="lb-pc-sect-lbl">{row.name}</div>
                            )}
                            {row.items.map(b=>(
                              <div key={b.id||b.name} className="lb-pc-acct">
                                <span className="l">{b.name}</span>
                                <span className="v">−{fmt(b.amountMin||0)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {card.billItems.length>0&&(
                          <div style={{padding:"4px 8px 8px"}}>
                            <div className="lb-pc-net">
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
            </aside>

            {/* main */}
            <main className="lb-main">
              <div className="lb-topbar">
                <div className="lb-tb-left">
                  <span className="lb-tb-num">ii ·</span>
                  <span className="lb-tb-title">Briefing</span>
                  <span className="lb-tb-div"/>
                  <span className="lb-tb-sub">{timeLabel}</span>
                </div>
                <div className="lb-tb-right">
                </div>
              </div>

              {/* hero */}
              <div style={{marginBottom:40}}>
                <div className="lb-eyebrow">
                  Good {today.getHours()<12?"morning":today.getHours()<17?"afternoon":"evening"} · the headline
                  {selIdx!==null&&<span style={{marginLeft:10,fontSize:9,letterSpacing:"1.2px",color:"var(--calm)",fontFamily:"var(--font-mono)",textTransform:"uppercase"}}>· scenario active</span>}
                </div>

                {/* Story-style headline */}
                <h2 className="lb-story-head">
                  You’re sitting on<br/>
                  <span className="story-num" style={{color:safeColor}}>{fmt(displaySafe)}</span><br/>
                  that’s actually yours.
                </h2>

                {/* Narrative deck */}
                <p className="lb-deck">
                  After every bill that’s already promised{daysLeft!=null?<> over the next <em className="amt">{daysLeft} day{daysLeft!==1?"s":""}</em>,</>:","} this is what’s left.
                  {" "}The pressure gauge reads <em className="amt" style={{color:displayLabel==="safe"?"var(--safe)":displayLabel==="tight"?"var(--debt)":"var(--warn)"}}>{displayLabel}</em>.
                  {" "}Bills total <em className="debt">{fmt(billsTotal)}</em>{upcomingBills.length>0?` and ${upcomingBills.length===1?"it’s":"they’re"} spaced across the period`:""}.
                  {nextPay&&daysLeft!=null?<> Your next paycheck is <em style={{fontStyle:"normal",fontFamily:"var(--font-mono)",color:"var(--calm)"}}>+{fmt(nextPay.amountMin||0)}</em> on {MN[today.getMonth()]} {nextPayDay}.</>:null}
                </p>

                {/* Gauge + Pool cards side by side */}
                <div className="lb-story-callout">
                  {/* Left: pressure gauge with % readout */}
                  <div className="lb-gauge-card">
                    <div className="lb-gauge-lbl">Pressure · how tight things feel</div>
                    <div style={{width:"100%",maxWidth:260}}>
                      <Gauge pct={displayPct}/>
                    </div>
                    <div className="lb-gauge-readout">
                      <div className="lb-gauge-pct" style={{color:safeColor}}>{Math.round(displayPct*100)}%</div>
                      <div className="lb-gauge-sub">of your typical comfort · {displayLabel} this month</div>
                    </div>
                  </div>

                  {/* Right: FREE + VAULT pool cards */}
                  <div className="lb-pools">
                    <div className="lb-pool-card lb-pool-free">
                      <div className="lb-pool-stripe"/>
                      <div>
                        <div className="lb-pool-nm">Free · yours</div>
                        <div className="lb-pool-desc">spend without thinking</div>
                      </div>
                      <div className="lb-pool-v">{fmt(displaySafe)}</div>
                    </div>
                    <div className="lb-pool-card lb-pool-locked">
                      <div className="lb-pool-stripe"/>
                      <div>
                        <div className="lb-pool-nm">Vault · spoken for</div>
                        <div className="lb-pool-desc">bills, cushion, goals</div>
                      </div>
                      <div className="lb-pool-v">{fmt(allocBill+allocCush+allocGoal+allocFlex)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* what-if */}
              <div className="lb-whatif">
                <div className="lb-wi-head">
                  <h4>What if you <em>changed something</em>?</h4>
                  {selIdx!==null&&(
                    <button onClick={()=>setSelIdx(null)} style={{background:"rgba(255,255,255,0.06)",border:"1px solid var(--line)",borderRadius:99,padding:"3px 12px",fontSize:11,color:"var(--ink-3)",cursor:"pointer",fontFamily:"var(--font-mono)"}}>
                      × clear scenario
                    </button>
                  )}
                </div>

                <div className="lb-wi-row">
                  {scenarios.map((s,i)=>{
                    // A negative scenario is impossible if it would exceed current safe-to-spend
                    const wouldResult=displaySafe+(s.pos?s.delta:-s.delta);
                    const impossible=!s.pos&&s.delta>displaySafe;
                    const classes=["lb-wi-card",s.isAi?"ai-card":"",impossible?"impossible":"",selIdx===i?"sel":""].filter(Boolean).join(" ");
                    return(
                      <div key={i} className={classes} onClick={()=>!impossible?selectCard(i):null}>
                        {s.isAi&&<div className="lb-wi-tag">✦ your question</div>}
                        {selIdx===i&&!impossible&&<span className="lb-wi-clear" onClick={e=>clearCard(e,i)}>× clear</span>}
                        <div className="lb-wi-nm" style={{color:impossible?"var(--ink-3)":undefined}}>{s.nm}</div>
                        {s.error?(
                          <div style={{fontSize:11,color:"var(--ink-3)",fontFamily:"var(--font-mono)"}}>couldn't compute delta</div>
                        ):impossible?(
                          <>
                            <div className="lb-wi-delta">
                              <span>Safe-to-spend</span>
                              <span className="v neg">−${s.delta.toLocaleString()}</span>
                            </div>
                            <div className="lb-wi-impossible">✕ not enough free cash</div>
                          </>
                        ):(
                          <div className="lb-wi-delta">
                            <span>Safe-to-spend</span>
                            <span className={`v ${s.pos?"pos":"neg"}`}>{s.pos?"+":"−"}${s.delta.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* AI ask bar */}
                {hasApiKey?(
                  <div className="lb-ask">
                    <span className="lb-ask-ico">✦</span>
                    <input
                      ref={aiInputRef}
                      value={aiInput}
                      onChange={e=>setAiInput(e.target.value)}
                      onKeyDown={handleAiKey}
                      placeholder="Ask anything — e.g. what if I got a $500 raise, or what if I cut dining this month?"
                      disabled={aiLoading}
                    />
                    {aiLoading?(
                      <span className="lb-wi-loading">thinking</span>
                    ):(
                      <button className="lb-ask-send" onClick={askScenario} disabled={!aiInput.trim()}>
                        Ask ↵
                      </button>
                    )}
                  </div>
                ):(
                  <div className="lb-ask" style={{justifyContent:"center"}}>
                    <span className="lb-no-key">
                      Add your Claude API key on the{" "}
                      <a onClick={()=>navigate("ai")}>Ask AI page</a>{" "}
                      to ask custom what-if questions
                    </span>
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
