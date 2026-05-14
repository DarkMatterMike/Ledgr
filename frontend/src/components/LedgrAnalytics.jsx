/**
 * LedgrAnalytics.jsx — Analytics page, Lumen Briefing design
 * src/components/LedgrAnalytics.jsx
 *
 * Replaces Analytics.jsx in the VIEWS map. Keeps all existing
 * data computation logic; replaces only the render layer.
 *
 * Props: same as original Analytics.jsx
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { getAiInsights } from "../api.js";

/* ── helpers ─────────────────────────────────────────────── */
const fmt   = n => n == null ? "$0" : "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits:0, maximumFractionDigits:0 });
const fmtK  = n => n >= 1000 ? "$" + (n/1000).toFixed(0) + "k" : "$" + Math.round(n);
const pad   = n => String(n).padStart(2, "0");
const pct   = (n, d) => d === 0 ? 0 : Math.round((n / d) * 100);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ── CSS injected once ──────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  :root{
    --bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;
    --line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);
    --ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;
    --safe:#5dcaa5;--safe-d:#0f6e56;--safe-bg:rgba(93,202,165,0.08);
    --warn:#f0b04c;--warn-bg:rgba(240,176,76,0.08);
    --debt:#e87363;--debt-bg:rgba(232,115,99,0.08);
    --calm:#6c8cff;--calm-bg:rgba(108,140,255,0.08);
    --goal:#a78bff;--goal-d:#2a1f5e;--goal-bg:rgba(167,139,255,0.08);
    --fd:'Instrument Serif',Georgia,serif;
    --fm:'JetBrains Mono',ui-monospace,monospace;
    --fu:'Geist',-apple-system,sans-serif;
    --r:6px;--rm:10px;--rl:14px;--rx:20px;
  }
  .la-wrap *,.la-wrap *::before,.la-wrap *::after{box-sizing:border-box;}
  .la-wrap h1,.la-wrap h2,.la-wrap h3,.la-wrap h4,.la-wrap p{margin:0;padding:0;}
  .la-wrap{font-family:var(--fu);color:var(--ink-0);-webkit-font-smoothing:antialiased;background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;}
  @media(max-width:1000px){.la-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.la-wrap{padding:0;}}
  .la-frame{background:var(--bg-1);border:1px solid var(--line);border-radius:var(--rx);overflow:hidden;max-width:1400px;margin:0 auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;flex-direction:column;}
  @media(max-width:600px){.la-frame{border-radius:0;border:none;}}
  .la-bar{height:40px;background:var(--bg-2);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 18px;gap:8px;flex-shrink:0;}
  .la-bar-dot{width:9px;height:9px;border-radius:50%;background:var(--ink-4);}
  .la-bar-url{margin-left:14px;font-family:var(--fm);font-size:11px;color:var(--ink-3);}
  .la-bar-live{margin-left:auto;font-family:var(--fm);font-size:11px;color:var(--ink-3);display:flex;align-items:center;gap:6px;}
  .la-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .la-body{display:grid;grid-template-columns:64px 1fr;flex:1;}
  .la-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);}
  .la-nav-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d) 80%);margin-bottom:24px;}
  .la-ni{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;}
  .la-ni:hover{color:var(--ink-1);background:var(--bg-2);}
  .la-ni.active{color:var(--safe);background:var(--safe-bg);}
  .la-nav-spacer{flex:1;}
  .la-main{display:flex;flex-direction:column;}
  .la-topbar{height:60px;padding:0 32px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .la-tb-left{display:flex;align-items:baseline;gap:16px;}
  .la-tb-num{font-family:var(--fm);font-size:11px;color:var(--ink-3);}
  .la-tb-title{font-family:var(--fd);font-size:22px;letter-spacing:-0.3px;}
  .la-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .la-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .la-av{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--goal-d),var(--goal));font-size:11px;display:flex;align-items:center;justify-content:center;color:var(--ink-0);}
  /* pill */
  .la-pill{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 9px;border-radius:99px;font-family:var(--fm);white-space:nowrap;}
  .la-pill.safe{background:var(--safe-bg);color:var(--safe);border:1px solid rgba(93,202,165,0.2);}
  .la-pill.debt{background:var(--debt-bg);color:var(--debt);border:1px solid rgba(232,115,99,0.2);}
  .la-pill.warn{background:var(--warn-bg);color:var(--warn);border:1px solid rgba(240,176,76,0.2);}
  .la-pill.calm{background:var(--calm-bg);color:var(--calm);border:1px solid rgba(108,140,255,0.2);}
  /* card */
  .la-card{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--rl);overflow:hidden;}
  .la-card-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid var(--line);}
  .la-card-title{font-family:var(--fd);font-size:19px;letter-spacing:-0.3px;font-weight:400;}
  .la-card-title em{font-style:italic;color:var(--safe);}
  .la-card-body{padding:18px;}
  /* ── REPORT STRIP ── */
  .la-report{display:grid;grid-template-columns:232px 1fr;border-bottom:1px solid var(--line);}
  .la-score-col{border-right:1px solid var(--line);padding:22px 20px;display:flex;flex-direction:column;align-items:center;}
  .la-score-ring{position:relative;width:100px;height:100px;margin-bottom:16px;flex-shrink:0;}
  .la-score-ring svg{position:absolute;inset:0;transform:rotate(-90deg);}
  .la-score-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}
  .la-score-n{font-family:var(--fd);font-size:40px;letter-spacing:-2px;line-height:1;}
  .la-score-l{font-family:var(--fm);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-3);margin-top:2px;}
  .la-grade-row{display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--line);width:100%;}
  .la-grade-letter{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:var(--fm);font-size:10px;font-weight:700;flex-shrink:0;}
  .la-grade-name{font-size:11px;color:var(--ink-1);flex:1;}
  .la-grade-val{font-family:var(--fm);font-size:10px;color:var(--ink-3);}
  /* narrative summary */
  .la-summary-col{padding:24px 28px;display:flex;flex-direction:column;gap:16px;}
  .la-ai-headline-divider{border:none;border-top:1px solid var(--line);margin:0;}
  .la-ai-headline-area{display:flex;flex-direction:column;gap:8px;}
  .la-ai-headline-label{font-family:var(--fm);font-size:9px;letter-spacing:1.3px;text-transform:uppercase;color:var(--ink-3);display:flex;align-items:center;gap:6px;}
  .la-ai-headline-dot{width:5px;height:5px;border-radius:50%;background:var(--safe);box-shadow:0 0 6px var(--safe);flex-shrink:0;}
  .la-ai-headline-box{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--rm);padding:12px 14px;font-size:13px;line-height:1.6;color:var(--ink-1);}
  .la-ai-headline-box.empty{color:var(--ink-3);font-family:var(--fm);font-size:11px;font-style:italic;}
  .la-summary-hl{font-family:var(--fd);font-size:24px;letter-spacing:-0.5px;line-height:1.25;color:var(--ink-0);}
  .la-summary-hl em{font-style:italic;}
  .la-sstats{display:flex;gap:20px;flex-wrap:wrap;}
  .la-sstat{display:flex;flex-direction:column;gap:3px;padding-left:12px;border-left:2px solid;}
  .la-sstat .sl{font-family:var(--fm);font-size:9px;letter-spacing:1.3px;text-transform:uppercase;color:var(--ink-3);}
  .la-sstat .sv{font-family:var(--fd);font-size:22px;letter-spacing:-0.5px;line-height:1;}
  .la-sstat .ss{font-family:var(--fm);font-size:9px;color:var(--ink-3);}
  .la-verdict{font-size:12px;color:var(--ink-2);line-height:1.65;padding:10px 14px;background:var(--bg-3);border-radius:var(--rm);border-left:2px solid rgba(93,202,165,0.3);}
  /* analytics layout */
  .la-analytics-body{display:grid;grid-template-columns:1fr 272px;}
  .la-left{border-right:1px solid var(--line);padding:22px 22px 36px;display:flex;flex-direction:column;gap:18px;}
  .la-right{padding:20px 18px;display:flex;flex-direction:column;gap:16px;}
  .la-two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  /* pace chart */
  .la-pace-stats{display:flex;gap:18px;margin-bottom:14px;flex-wrap:wrap;align-items:flex-start;}
  .la-pace-stat .eye{font-family:var(--fm);font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-3);margin-bottom:3px;}
  .la-pace-stat .big{font-family:var(--fd);font-size:28px;letter-spacing:-1px;line-height:1;}
  .la-pace-stat .sub{font-size:10px;color:var(--ink-3);margin-top:2px;}
  .la-pace-tabs{display:flex;gap:4px;margin-left:auto;align-self:flex-start;}
  .la-pace-tab{padding:3px 9px;border-radius:99px;font-family:var(--fm);font-size:10px;border:1px solid var(--line);color:var(--ink-3);cursor:pointer;background:none;transition:.12s;}
  .la-pace-tab.active{border-color:rgba(93,202,165,0.4);color:var(--safe);background:var(--safe-bg);}
  .la-chart-wrap{border-top:1px solid var(--line);border-left:1px solid var(--line);margin-bottom:10px;}
  .la-legend{display:flex;gap:16px;flex-wrap:wrap;}
  .la-leg{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-2);}
  /* cash flow */
  .la-cf-summary{display:flex;gap:14px;margin-bottom:12px;}
  .la-cf-s .eye{font-family:var(--fm);font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-3);margin-bottom:2px;}
  .la-cf-s .v{font-family:var(--fd);font-size:20px;letter-spacing:-0.5px;line-height:1;}
  .la-cf-bars{display:flex;align-items:flex-end;gap:5px;height:84px;margin-bottom:8px;}
  .la-cf-grp{display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;}
  .la-cf-pair{display:flex;gap:2px;align-items:flex-end;width:100%;}
  .la-cf-bar{border-radius:3px 3px 0 0;min-height:3px;flex:1;}
  .la-cf-lbl{font-family:var(--fm);font-size:8px;color:var(--ink-3);}
  /* subscriptions */
  .la-sub-hdr{display:flex;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--line);}
  .la-sub-row{display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid var(--line);gap:8px;}
  .la-sub-row:last-child{border-bottom:none;}
  .la-sub-fav{width:22px;height:22px;border-radius:6px;background:var(--bg-3);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;}
  .la-sub-name{flex:1;font-size:12px;color:var(--ink-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .la-sub-mo{font-family:var(--fm);font-size:12px;font-weight:600;color:var(--debt);}
  .la-sub-yr{font-family:var(--fm);font-size:9px;color:var(--ink-3);text-align:right;min-width:40px;}
  /* adherence */
  .la-adh-sections{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .la-adh-sect-lbl{font-family:var(--fm);font-size:9px;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:8px;}
  .la-adh-cat-row{display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.03);}
  .la-adh-cat-row:last-child{border-bottom:none;}
  .la-adh-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
  .la-adh-name{font-size:11px;color:var(--ink-1);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .la-adh-strip{display:flex;gap:2px;}
  .la-hc{width:13px;height:13px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-family:var(--fm);font-size:6px;font-weight:800;}
  .la-hc.ok{background:rgba(93,202,165,0.20);color:var(--safe);}
  .la-hc.warn{background:rgba(240,176,76,0.25);color:var(--warn);}
  .la-hc.over{background:rgba(232,115,99,0.30);color:var(--debt);}
  .la-hc.none{background:rgba(255,255,255,0.03);}
  .la-adh-count{font-family:var(--fm);font-size:9px;margin-left:4px;flex-shrink:0;}
  .la-verdict-box{margin-top:10px;padding:9px 12px;background:var(--bg-3);border-radius:var(--rm);border-left:2px solid rgba(232,115,99,0.4);font-size:11px;color:var(--ink-2);line-height:1.6;}
  /* net worth */
  .la-nw-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap;}
  .la-nw-stat .eye{font-family:var(--fm);font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-3);margin-bottom:3px;}
  .la-nw-stat .big{font-family:var(--fd);font-size:26px;letter-spacing:-1px;line-height:1;color:var(--calm);}
  .la-nw-stat .sub{font-size:10px;color:var(--ink-3);margin-top:3px;}
  .la-nw-tabs{display:flex;gap:3px;flex-wrap:wrap;}
  .la-nw-tab{padding:3px 8px;border-radius:99px;font-family:var(--fm);font-size:9px;border:1px solid var(--line);color:var(--ink-3);cursor:pointer;background:none;transition:.12s;}
  .la-nw-tab.active{border-color:rgba(108,140,255,0.4);color:var(--calm);background:var(--calm-bg);}
  .la-nw-milestones{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:10px;}
  .la-nw-m{background:var(--bg-3);border-radius:var(--rm);padding:7px 10px;text-align:center;}
  .la-nw-m .hl{font-family:var(--fm);font-size:8px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-3);margin-bottom:3px;}
  .la-nw-m .v{font-family:var(--fd);font-size:14px;letter-spacing:-0.3px;color:var(--calm);}
  .la-edit-vars{display:flex;align-items:center;gap:4px;background:var(--bg-3);border:1px solid var(--line);border-radius:7px;padding:4px 10px;font-family:var(--fm);font-size:9px;color:var(--ink-2);cursor:pointer;white-space:nowrap;transition:.12s;}
  .la-edit-vars:hover{border-color:var(--line-2);color:var(--ink-0);}
  /* right rail */
  .la-rail-lbl{font-family:var(--fm);font-size:9px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;}
  .la-rail-sub{color:var(--ink-4);font-size:8px;}
  .la-ai-gen-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;background:var(--calm-bg);border:1px solid rgba(108,140,255,0.3);border-radius:8px;padding:6px 12px;font-family:var(--fm);font-size:11px;color:var(--calm);cursor:pointer;margin-bottom:10px;transition:.12s;}
  .la-ai-gen-btn:hover{background:rgba(108,140,255,0.12);}
  .la-ai-gen-btn:disabled{opacity:.5;cursor:not-allowed;}
  .la-insight-card{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--rm);padding:11px 13px;margin-bottom:7px;position:relative;}
  .la-insight-card.pinned{border-color:rgba(93,202,165,0.22);background:rgba(93,202,165,0.025);}
  .la-insight-text{font-size:11px;color:var(--ink-1);line-height:1.6;margin-bottom:7px;}
  .la-insight-actions{display:flex;gap:5px;}
  .la-pin-btn{background:var(--safe-bg);border:1px solid rgba(93,202,165,0.3);border-radius:5px;padding:2px 9px;font-size:9px;font-family:var(--fm);color:var(--safe);cursor:pointer;transition:.12s;}
  .la-pin-btn:hover{background:rgba(93,202,165,0.12);}
  .la-dismiss-btn{background:transparent;border:1px solid var(--line);border-radius:5px;padding:2px 7px;font-size:9px;font-family:var(--fm);color:var(--ink-3);cursor:pointer;}
  .la-pinned-badge{position:absolute;top:9px;right:9px;font-family:var(--fm);font-size:7px;letter-spacing:.8px;color:var(--safe);text-transform:uppercase;}
  .la-rail-div{height:1px;background:var(--line);margin:4px 0;}
  .la-goal-card{background:var(--bg-2);border:1px solid var(--line);border-radius:var(--rm);padding:10px 12px;margin-bottom:7px;}
  .la-goal-name{font-size:11px;color:var(--ink-0);margin-bottom:5px;font-weight:500;}
  .la-goal-track{height:3px;background:var(--bg-3);border-radius:2px;overflow:hidden;margin-bottom:4px;}
  .la-goal-fill{height:100%;border-radius:2px;}
  .la-goal-meta{display:flex;justify-content:space-between;font-family:var(--fm);font-size:9px;color:var(--ink-3);}
  .la-add-goal-btn{width:100%;padding:6px;border:1px dashed rgba(255,255,255,0.07);background:none;border-radius:var(--rm);font-family:var(--fm);font-size:9px;color:var(--ink-4);cursor:pointer;}
  /* vars modal */
  .la-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:200;display:flex;align-items:center;justify-content:center;}
  .la-modal{background:var(--bg-2);border:1px solid var(--line-2);border-radius:var(--rx);padding:28px;width:440px;max-width:90vw;box-shadow:0 24px 80px rgba(0,0,0,0.7);}
  .la-modal-hdr{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:20px;}
  .la-modal-title{font-family:var(--fd);font-size:22px;letter-spacing:-0.3px;}
  .la-modal-title em{font-style:italic;color:var(--calm);}
  .la-modal-close{background:none;border:none;color:var(--ink-3);font-size:18px;cursor:pointer;line-height:1;}
  .la-field{margin-bottom:13px;}
  .la-field-lbl{font-family:var(--fm);font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-3);display:block;margin-bottom:5px;}
  .la-field-input{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:7px 12px;font-size:13px;color:var(--ink-0);font-family:var(--fm);outline:none;}
  .la-field-input:focus{border-color:rgba(108,140,255,0.4);}
  .la-field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .la-modal-footer{display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid var(--line);}
  .la-modal-save{background:var(--calm-bg);border:1px solid rgba(108,140,255,0.4);border-radius:8px;padding:7px 18px;font-family:var(--fm);font-size:11px;color:var(--calm);cursor:pointer;}
  .la-modal-cancel{background:transparent;border:1px solid var(--line);border-radius:8px;padding:7px 14px;font-family:var(--fm);font-size:11px;color:var(--ink-2);cursor:pointer;}
  .la-modal-note{font-size:11px;color:var(--ink-3);margin-top:10px;line-height:1.6;}
  /* goal form modal */
  .la-goal-form-btn{background:var(--safe-bg);border:1px solid rgba(93,202,165,0.4);border-radius:8px;padding:7px 18px;font-family:var(--fm);font-size:11px;color:var(--safe);cursor:pointer;}
  /* error / ai message */
  .la-ai-error{font-size:11px;color:var(--debt);font-family:var(--fm);padding:8px 0;}
  .la-ai-empty{font-size:11px;color:var(--ink-3);font-family:var(--fm);padding:8px 0;font-style:italic;}
`;

/* ── SVG helper ──────────────────────────────────────────── */
function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/* ── Spending Pace Chart ─────────────────────────────────── */
function PaceChart({ transactions, monthlyData, today, range }) {
  const svgRef = useRef(null);
  const DIM = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  const todayDay = today.getDate();
  const thisYM = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;

  const thisMonthPts = useMemo(() => {
    const byDay = {};
    transactions.forEach(t => {
      if (!t.date?.startsWith(thisYM) || t.amount >= 0) return;
      if (["transfer","income","reimbursement"].includes(t.type)) return;
      const d = parseInt(t.date.slice(8,10), 10);
      byDay[d] = (byDay[d]||0) + Math.abs(t.amount);
    });
    let cum = 0;
    return Array.from({length:DIM}, (_,i) => {
      if (i+1 > todayDay) return null;
      cum += byDay[i+1]||0;
      return cum;
    });
  }, [transactions, thisYM, DIM, todayDay]);

  const compPts = useMemo(() => {
    const counts = {last:1,avg3:3,avg6:6,avg12:12}[range];
    const months = monthlyData.slice(-(counts+1), -1).slice(-counts);
    if (!months.length) return Array(DIM).fill(null);
    const perDay = months.map(m => {
      const bd = {};
      transactions.forEach(t => {
        if (!t.date?.startsWith(m.ym) || t.amount >= 0) return;
        if (["transfer","income","reimbursement"].includes(t.type)) return;
        const d = parseInt(t.date.slice(8,10),10);
        bd[d] = (bd[d]||0) + Math.abs(t.amount);
      });
      return bd;
    });
    if (counts === 1) {
      const m = perDay[0]||{};
      let cum=0;
      return Array.from({length:DIM},(_,i)=>{cum+=m[i+1]||0;return cum;});
    }
    return Array.from({length:DIM},(_,i)=>{
      const vals=perDay.map(m=>{let c=0;for(let d=1;d<=i+1;d++) c+=m[d]||0;return c;}).filter(v=>v>0||i===0);
      return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    });
  }, [transactions, monthlyData, range, DIM]);

  const tv = thisMonthPts[todayDay-1]||0;
  const cv = compPts[DIM-1]||compPts.filter(Boolean).at(-1)||0;
  const projV = todayDay > 0 ? Math.round(tv/todayDay*DIM) : tv;

  // Draw SVG
  useRef(null);
  const draw = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const W=560, H=150, P={t:12,r:12,b:24,l:40};
    const iW=W-P.l-P.r, iH=H-P.t-P.b;
    const maxV=Math.max(...thisMonthPts.filter(v=>v!=null),...compPts.filter(v=>v!=null),1);
    const xOf=i=>P.l+(i/(DIM-1))*iW;
    const yOf=v=>P.t+iH-(v/maxV)*iH;
    const NS="http://www.w3.org/2000/svg";

    // gradient
    const defs=document.createElementNS(NS,"defs");
    const g=document.createElementNS(NS,"linearGradient");
    g.setAttribute("id","laGrad"); g.setAttribute("x1","0"); g.setAttribute("y1","0"); g.setAttribute("x2","0"); g.setAttribute("y2","1");
    const s1=document.createElementNS(NS,"stop"); s1.setAttribute("offset","0%"); s1.setAttribute("stop-color","#5dcaa5"); s1.setAttribute("stop-opacity","0.25");
    const s2=document.createElementNS(NS,"stop"); s2.setAttribute("offset","100%"); s2.setAttribute("stop-color","#5dcaa5"); s2.setAttribute("stop-opacity","0");
    g.append(s1,s2); defs.append(g); svg.append(defs);

    // grid
    [0.25,0.5,0.75,1].forEach(f=>{
      const v=Math.round(maxV*f), y=yOf(v);
      const l=document.createElementNS(NS,"line");
      l.setAttribute("x1",P.l); l.setAttribute("x2",W-P.r); l.setAttribute("y1",y); l.setAttribute("y2",y);
      l.setAttribute("stroke","rgba(255,255,255,0.04)"); l.setAttribute("stroke-width","1"); svg.append(l);
      const t=document.createElementNS(NS,"text");
      t.setAttribute("x",P.l-5); t.setAttribute("y",y+4); t.setAttribute("text-anchor","end");
      t.style.cssText="font-size:8px;fill:rgba(244,244,241,0.18);font-family:JetBrains Mono,monospace;";
      t.textContent=fmtK(v); svg.append(t);
    });
    [1,6,11,16,21,26,31].filter(d=>d<=DIM).forEach(d=>{
      const isT=d===todayDay;
      const t=document.createElementNS(NS,"text");
      t.setAttribute("x",xOf(d-1)); t.setAttribute("y",H-5); t.setAttribute("text-anchor","middle");
      t.style.cssText=`font-size:8px;fill:${isT?"rgba(240,176,76,0.7)":"rgba(244,244,241,0.14)"};font-family:JetBrains Mono,monospace;`;
      t.textContent=isT?d+"↑":d; svg.append(t);
    });

    // comp dashed
    const compDef=compPts.map((_,i)=>i).filter(i=>compPts[i]!=null);
    if(compDef.length){
      const d=compDef.map((i,j)=>(j===0?"M":"L")+xOf(i).toFixed(1)+","+yOf(compPts[i]).toFixed(1)).join(" ");
      const p=document.createElementNS(NS,"path"); p.setAttribute("d",d); p.setAttribute("fill","none");
      p.setAttribute("stroke","rgba(255,255,255,0.17)"); p.setAttribute("stroke-width","1.5");
      p.setAttribute("stroke-dasharray","5,3"); p.setAttribute("stroke-linecap","round"); svg.append(p);
    }

    // area
    const defined=thisMonthPts.map((v,i)=>v!=null?i:null).filter(i=>i!==null);
    if(defined.length){
      let aD=`M${xOf(defined[0]).toFixed(1)},${(P.t+iH).toFixed(1)} `;
      defined.forEach(i=>{ aD+=`L${xOf(i).toFixed(1)},${yOf(thisMonthPts[i]).toFixed(1)} `; });
      aD+=`L${xOf(defined[defined.length-1]).toFixed(1)},${(P.t+iH).toFixed(1)} Z`;
      const a=document.createElementNS(NS,"path"); a.setAttribute("d",aD); a.setAttribute("fill","url(#laGrad)"); svg.append(a);
    }

    // today line + projected
    if(tv!=null&&tv>0){
      const vl=document.createElementNS(NS,"line");
      vl.setAttribute("x1",xOf(todayDay-1)); vl.setAttribute("x2",xOf(todayDay-1));
      vl.setAttribute("y1",yOf(tv)); vl.setAttribute("y2",P.t+iH);
      vl.setAttribute("stroke","rgba(240,176,76,0.14)"); vl.setAttribute("stroke-width","1"); vl.setAttribute("stroke-dasharray","3,2"); svg.append(vl);
      const pr=document.createElementNS(NS,"path");
      pr.setAttribute("d",`M${xOf(todayDay-1).toFixed(1)},${yOf(tv).toFixed(1)} L${xOf(DIM-1).toFixed(1)},${yOf(projV).toFixed(1)}`);
      pr.setAttribute("fill","none"); pr.setAttribute("stroke","rgba(240,176,76,0.45)"); pr.setAttribute("stroke-width","1.5"); pr.setAttribute("stroke-dasharray","4,3"); pr.setAttribute("stroke-linecap","round"); svg.append(pr);
    }

    // this month line
    if(defined.length){
      const lD=defined.map((i,j)=>(j===0?"M":"L")+xOf(i).toFixed(1)+","+yOf(thisMonthPts[i]).toFixed(1)).join(" ");
      const lp=document.createElementNS(NS,"path"); lp.setAttribute("d",lD); lp.setAttribute("fill","none");
      lp.setAttribute("stroke","#5dcaa5"); lp.setAttribute("stroke-width","2"); lp.setAttribute("stroke-linecap","round"); lp.setAttribute("stroke-linejoin","round"); svg.append(lp);
      if(tv>0){
        const dot=document.createElementNS(NS,"circle"); dot.setAttribute("cx",xOf(todayDay-1)); dot.setAttribute("cy",yOf(tv)); dot.setAttribute("r","4"); dot.setAttribute("fill","#5dcaa5"); svg.append(dot);
      }
    }
  }, [thisMonthPts, compPts, DIM, todayDay, tv, projV]);

  // draw after paint
  useRef(() => { requestAnimationFrame(draw); });
  const containerRef = useCallback(node => {
    if (node) { svgRef.current = node; requestAnimationFrame(draw); }
  }, [draw]);

  return (
    <svg ref={containerRef} viewBox="0 0 560 150"
      style={{width:"100%",display:"block",overflow:"visible"}}/>
  );
}

/* ── Net Worth Chart ─────────────────────────────────────── */
function NWChart({ nw, monthlySv, scenario }) {
  const rates = {conservative:0.04/12, moderate:0.07/12, optimistic:0.10/12};
  const colors = {conservative:"#7d8594", moderate:"#6c8cff", optimistic:"#a78bff"};

  const fvCalc = (pv,pmt,r,mo) => {
    if(mo===0) return pv;
    if(r===0) return pv+pmt*mo;
    return pv*Math.pow(1+r,mo)+(pmt>0?pmt*((Math.pow(1+r,mo)-1)/r):0);
  };

  const containerRef = useCallback(node => {
    if (!node) return;
    const NS="http://www.w3.org/2000/svg";
    while(node.firstChild) node.removeChild(node.firstChild);
    const W=268,H=115,P={t:10,r:10,b:20,l:40};
    const iW=W-P.l-P.r, iH=H-P.t-P.b;
    const r=rates[scenario], color=colors[scenario];
    const pts=Array.from({length:21},(_,i)=>({mo:i*6,v:fvCalc(nw,Math.max(0,monthlySv),r,i*6)}));
    const maxV=Math.max(...pts.map(p=>p.v),1);
    const xOf=i=>P.l+(i/(pts.length-1))*iW;
    const yOf=v=>P.t+iH-(v/maxV)*iH;

    const defs=document.createElementNS(NS,"defs");
    const g=document.createElementNS(NS,"linearGradient");
    g.setAttribute("id","nwG2"); g.setAttribute("x1","0"); g.setAttribute("y1","0"); g.setAttribute("x2","0"); g.setAttribute("y2","1");
    const s1=document.createElementNS(NS,"stop"); s1.setAttribute("offset","0%"); s1.setAttribute("stop-color",color); s1.setAttribute("stop-opacity","0.22");
    const s2=document.createElementNS(NS,"stop"); s2.setAttribute("offset","100%"); s2.setAttribute("stop-color",color); s2.setAttribute("stop-opacity","0");
    g.append(s1,s2); defs.append(g); node.append(defs);

    [0,0.5,1].forEach(f=>{
      const v=Math.round(maxV*f), y=yOf(v);
      const l=document.createElementNS(NS,"line"); l.setAttribute("x1",P.l); l.setAttribute("x2",W-P.r); l.setAttribute("y1",y); l.setAttribute("y2",y);
      l.setAttribute("stroke","rgba(255,255,255,0.04)"); l.setAttribute("stroke-width","1"); node.append(l);
      const t=document.createElementNS(NS,"text"); t.setAttribute("x",P.l-5); t.setAttribute("y",y+4); t.setAttribute("text-anchor","end");
      t.style.cssText="font-size:7px;fill:rgba(244,244,241,0.18);font-family:JetBrains Mono,monospace;";
      t.textContent=fmtK(v); node.append(t);
    });
    [0,2,4,6,8,10].forEach(yr=>{
      const t=document.createElementNS(NS,"text"); t.setAttribute("x",xOf(yr*2)); t.setAttribute("y",H-4); t.setAttribute("text-anchor","middle");
      t.style.cssText="font-size:7px;fill:rgba(244,244,241,0.15);font-family:JetBrains Mono,monospace;";
      t.textContent=yr===0?"Now":yr+"yr"; node.append(t);
    });

    let aD=`M${xOf(0).toFixed(1)},${(P.t+iH).toFixed(1)} `;
    pts.forEach((p,i)=>{ aD+=`L${xOf(i).toFixed(1)},${yOf(p.v).toFixed(1)} `; });
    aD+=`L${xOf(pts.length-1).toFixed(1)},${(P.t+iH).toFixed(1)} Z`;
    const ap=document.createElementNS(NS,"path"); ap.setAttribute("d",aD); ap.setAttribute("fill","url(#nwG2)"); node.append(ap);

    const lD=pts.map((p,i)=>(i===0?"M":"L")+xOf(i).toFixed(1)+","+yOf(p.v).toFixed(1)).join(" ");
    const lp=document.createElementNS(NS,"path"); lp.setAttribute("d",lD); lp.setAttribute("fill","none"); lp.setAttribute("stroke",color); lp.setAttribute("stroke-width","2"); lp.setAttribute("stroke-linecap","round"); lp.setAttribute("stroke-linejoin","round"); node.append(lp);

    const dot=document.createElementNS(NS,"circle"); dot.setAttribute("cx",xOf(pts.length-1)); dot.setAttribute("cy",yOf(pts[pts.length-1].v)); dot.setAttribute("r","4"); dot.setAttribute("fill",color); node.append(dot);
  }, [nw, monthlySv, scenario]);

  return <svg ref={containerRef} viewBox="0 0 268 115" style={{width:"100%",display:"block",overflow:"visible"}}/>;
}

/* ── Cash Flow Bars ──────────────────────────────────────── */
function CFBars({ data }) {
  const max = Math.max(...data.flatMap(d=>[d.income,d.spending]), 1);
  const BH = 68;
  return (
    <div className="la-cf-bars">
      {data.map(d => (
        <div key={d.label} className="la-cf-grp">
          <div className="la-cf-pair" style={{height:BH,alignItems:"flex-end"}}>
            <div className="la-cf-bar" style={{height:Math.round((d.income/max)*BH),background:"rgba(93,202,165,0.28)"}}/>
            <div className="la-cf-bar" style={{height:Math.round((d.spending/max)*BH),background:"rgba(232,115,99,0.42)"}}/>
          </div>
          <div className="la-cf-lbl">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
const NAV = [
  {icon:"◐",id:"dashboard"},{icon:"⇅",id:"transactions"},{icon:"▣",id:"accounts"},
  {icon:"◉",id:"budgets"},{icon:"▦",id:"calendar"},{icon:"◈",id:"analytics",active:true},
  {icon:"◆",id:"goals"},
];

export default function LedgrAnalytics({
  transactions=[], categories=[], accounts=[], catMap={},
  isMobile=false, hasApiKey=false, userProfile={},
  aiInsights=null, onSetAiInsights=()=>{},
  todos=[], onTodosChange=()=>{},
  goals=[], onSaveGoal=()=>{}, onDeleteGoal=()=>{},
  navigate=()=>{},
  defaultTab="overview",
  onSaveProfile=()=>{},
  onMarkRecurring=()=>{},
}) {
  const [paceRange,   setPaceRange]   = useState("last");
  const [nwScenario,  setNwScenario]  = useState("moderate");
  const [showVarsModal, setShowVarsModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm,    setGoalForm]    = useState({title:"",targetAmount:"",deadline:""});
  const [varsForm,    setVarsForm]    = useState({
    monthlyIncome: userProfile?.monthlyIncome||"",
    retirementAge: userProfile?.targets?.retirementAge||65,
    netWorthTarget: userProfile?.targets?.netWorthTarget||"",
  });
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError,   setAiError]     = useState(null);
  const [dismissed, setDismissed]   = useState(new Set());

  const today = new Date();

  /* ── monthly data ─────────────────────────────────────── */
  const monthlyData = useMemo(() => {
    const dates = transactions.map(t=>t.date).filter(Boolean).sort();
    const earliest = dates[0] ? new Date(dates[0]+"T12:00:00") : new Date(today.getFullYear(), today.getMonth()-11, 1);
    const map = {};
    let cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor <= end) {
      const ym = `${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}`;
      map[ym] = {ym, label:cursor.toLocaleDateString("en-US",{month:"short",year:"2-digit"}), income:0, spending:0, byCategory:{}, txnCount:0};
      cursor = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
    }
    transactions.forEach(t => {
      if (!t.date) return;
      const ym = t.date.slice(0,7);
      if (!map[ym]) return;
      const nonExp = ["transfer","income","reimbursement"].includes(t.type);
      if (t.amount>0&&(t.type==="income"||!t.type)) map[ym].income+=t.amount;
      if (t.amount<0&&!nonExp) {
        map[ym].spending+=Math.abs(t.amount);
        map[ym].txnCount++;
        if (t.categoryId) map[ym].byCategory[t.categoryId]=(map[ym].byCategory[t.categoryId]||0)+Math.abs(t.amount);
      }
    });
    return Object.values(map);
  }, [transactions]);

  const last6       = monthlyData.slice(-6);
  const thisMonthD  = monthlyData[monthlyData.length-1];
  const lastMonthD  = monthlyData[monthlyData.length-2];

  /* ── metrics ──────────────────────────────────────────── */
  const monthlyIncome = userProfile?.monthlyIncome||0;
  const avgSpendMos   = monthlyData.filter(m=>m.spending>0);
  const avgSpending   = avgSpendMos.length ? avgSpendMos.reduce((s,m)=>s+m.spending,0)/avgSpendMos.length : 0;
  const avgIncome     = monthlyIncome>0 ? monthlyIncome : monthlyData.filter(m=>m.income>0).reduce((s,m)=>s+m.income,0)/(monthlyData.filter(m=>m.income>0).length||1);
  const savingsRate   = avgIncome>0 ? Math.round(((avgIncome-avgSpending)/avgIncome)*100) : null;
  const momChange     = lastMonthD?.spending>0 ? Math.round(((thisMonthD.spending-lastMonthD.spending)/lastMonthD.spending)*100) : null;
  const totalBudget   = categories.reduce((s,c)=>s+(c.limit||0),0);
  const dayOfMonth    = today.getDate();
  const daysInMonth   = new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
  const projectedSpend= thisMonthD?.spending*(daysInMonth/dayOfMonth)||0;
  const monthlySv     = avgIncome-avgSpending;

  /* ── net worth ────────────────────────────────────────── */
  const currentNetWorth = useMemo(() => {
    const bank = accounts.filter(a=>a.balance!=null).reduce((s,a)=>s+a.balance,0);
    const mA = (userProfile?.manualAssets||[]).reduce((s,a)=>s+(a.value||0),0);
    const mL = (userProfile?.manualLiabilities||[]).reduce((s,l)=>s+(l.value||0),0);
    return bank+mA-mL;
  }, [accounts, userProfile]);

  /* ── nw milestones ────────────────────────────────────── */
  const nwMilestones = useMemo(() => {
    const rates = {conservative:0.04/12,moderate:0.07/12,optimistic:0.10/12};
    const r = rates[nwScenario];
    const fv = (pv,pmt,mo) => mo===0?pv:pv*Math.pow(1+r,mo)+(pmt>0?pmt*((Math.pow(1+r,mo)-1)/r):0);
    const sv = Math.max(0,monthlySv);
    return {
      yr1:  fv(currentNetWorth,sv,12),
      yr3:  fv(currentNetWorth,sv,36),
      yr5:  fv(currentNetWorth,sv,60),
      yr10: fv(currentNetWorth,sv,120),
    };
  }, [currentNetWorth, monthlySv, nwScenario]);

  /* ── health score ─────────────────────────────────────── */
  const healthScore = useMemo(() => {
    let score=0; const breakdown=[];
    if (categories.length>0&&thisMonthD) {
      const cs = categories.map(c=>{ const sp=thisMonthD.byCategory[c.id]||0; if(!c.limit)return null; return sp<=c.limit?1:Math.max(0,1-((sp-c.limit)/c.limit)); }).filter(s=>s!==null);
      const pts = cs.length?Math.round((cs.reduce((a,b)=>a+b,0)/cs.length)*30):15;
      score+=pts; breakdown.push({label:"Budget Adherence",pts,max:30,grade:pts>=24?"A":pts>=18?"B":pts>=12?"C":"D"});
    } else { score+=15; breakdown.push({label:"Budget Adherence",pts:15,max:30,grade:"C"}); }
    if (savingsRate!=null) {
      const pts=savingsRate>=20?25:savingsRate>=10?18:savingsRate>=0?10:0;
      score+=pts; breakdown.push({label:"Savings Rate",pts,max:25,val:`${savingsRate}%`,grade:pts>=22?"A":pts>=16?"B":pts>=8?"C":"D"});
    } else { score+=12; breakdown.push({label:"Savings Rate",pts:12,max:25,grade:"C"}); }
    if (momChange!=null) {
      const pts=momChange<=-10?20:momChange<=0?16:momChange<=10?10:momChange<=20?5:0;
      score+=pts; breakdown.push({label:"Spending Trend",pts,max:20,val:`${momChange>0?"+":""}${momChange}%`,grade:pts>=18?"A":pts>=12?"B":pts>=6?"C":"D"});
    } else { score+=10; breakdown.push({label:"Spending Trend",pts:10,max:20,grade:"C"}); }
    if (goals.length>0) {
      const avg=goals.map(g=>g.targetAmount>0?Math.min((g.savedAmount||0)/g.targetAmount,1):0).reduce((a,b)=>a+b,0)/goals.length;
      const pts=Math.round(avg*15);
      score+=pts; breakdown.push({label:"Goal Progress",pts,max:15,val:`${goals.length} active`,grade:pts>=13?"A":pts>=9?"B":pts>=5?"C":"D"});
    } else { breakdown.push({label:"Goal Progress",pts:0,max:15,grade:"F"}); }
    const posMonths=last6.filter(m=>m.income>0&&m.income>=m.spending).length;
    const cashPts=Math.round((posMonths/Math.max(last6.length,1))*10);
    score+=cashPts; breakdown.push({label:"Cash Flow",pts:cashPts,max:10,val:`${posMonths}/${last6.length} mo+`,grade:cashPts>=9?"A":cashPts>=7?"B":cashPts>=4?"C":"D"});
    const clamped=Math.min(100,Math.max(0,score));
    const color=clamped>=85?"var(--safe)":clamped>=70?"var(--calm)":clamped>=55?"var(--warn)":"var(--debt)";
    return {score:clamped,color,breakdown};
  }, [categories,thisMonthD,savingsRate,momChange,goals,last6]);

  /* ── budget adherence analysis ────────────────────────── */
  const adherenceData = useMemo(() => {
    const last6months = monthlyData.slice(-6);
    return categories.map(cat => {
      const months = last6months.map(m => ({
        label:m.label,
        spent:m.byCategory[cat.id]||0,
        limit:cat.limit||0,
      }));
      const overCount  = months.filter(m=>m.limit>0&&m.spent>m.limit).length;
      const warnCount  = months.filter(m=>m.limit>0&&m.spent/m.limit>=0.8&&m.spent<=m.limit).length;
      const totalWith  = months.filter(m=>m.limit>0).length;
      return {cat, months, overCount, warnCount, totalWith,
        status: overCount>=2?"chronic": overCount===0&&totalWith>=3?"consistent":"mixed"};
    }).filter(r=>r.months.some(m=>m.spent>0)||r.cat.limit>0);
  }, [categories, monthlyData]);

  const chronicCats    = adherenceData.filter(r=>r.status==="chronic").sort((a,b)=>b.overCount-a.overCount).slice(0,3);
  const consistentCats = adherenceData.filter(r=>r.status==="consistent").slice(0,3);
  const worstChronic   = chronicCats[0];

  /* ── subscriptions ────────────────────────────────────── */
  const subscriptions = useMemo(() => {
    const SUB_KEYWORDS = [
      "netflix","hulu","disney","hbo","max","spotify","apple","youtube","amazon prime",
      "peacock","paramount","crunchyroll","twitch","patreon","discord","slack","zoom",
      "dropbox","icloud","google one","microsoft","adobe","notion","figma","github",
      "linear","vercel","heroku","aws","digitalocean","cloudflare",
      "openai","anthropic","chatgpt","midjourney","canva","grammarly",
      "duolingo","headspace","calm","strava","peloton","nytimes","wsj",
      "audible","xbox","playstation","nintendo",
      "t-mobile","verizon","comcast","xfinity","spectrum",
    ];
    // Scope to current month only — avoids listing the same service multiple times
    const now = new Date();
    const thisYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const thisMonthTxns = transactions.filter(t => t.date?.startsWith(thisYM) && t.amount < 0);
    const seen = {};
    thisMonthTxns.forEach(t => {
      const raw = (t.merchant || t.name || "").toLowerCase();
      const matched = SUB_KEYWORDS.find(k => raw.includes(k));
      if (matched || t.recurring) {
        const key = matched || raw;
        if (!seen[key] || Math.abs(t.amount) > seen[key].amount) {
          seen[key] = { name: t.merchant || t.name || raw, amount: Math.abs(t.amount) };
        }
      }
    });
    return Object.values(seen).sort((a,b) => b.amount - a.amount);
  }, [transactions]);
  const subTotal = subscriptions.reduce((s,r)=>s+r.amount,0);

  /* ── narrative headline ───────────────────────────────── */
  const narrativeHL = useMemo(() => {
    const budgetOk = chronicCats.length === 0;
    const savingsOk = savingsRate == null || savingsRate >= 0;
    const worstName = worstChronic?.cat?.name;
    const worstMonths = worstChronic?.overCount;
    const savingsCopy = savingsRate == null
      ? null
      : savingsRate < 0
        ? `spending ${Math.abs(savingsRate)}% more than you earn`
        : `saving ${savingsRate}% of income`;
    return { savingsCopy, warnCategory: !budgetOk ? worstName : null,
             warnSavings: savingsRate != null && savingsRate < 0,
             worstMonths, budgetOk, savingsOk };
  }, [savingsRate, chronicCats, worstChronic]);

  /* ── AI insights ──────────────────────────────────────── */
  const runAI = useCallback(async () => {
    setAiLoading(true); setAiError(null);
    try {
      const last3 = monthlyData.slice(-3);
      const catBreakdown = categories.map(c=>({
        name:c.name, limit:c.limit||0,
        avg3mo:Math.round(last3.reduce((s,m)=>s+(m.byCategory[c.id]||0),0)/3),
        thisMonth:Math.round(last3[2]?.byCategory[c.id]||0),
      })).filter(c=>c.avg3mo>0||c.limit>0);
      const context = {
        avgMonthlyIncome: monthlyIncome>0?monthlyIncome:Math.round(avgIncome),
        avgMonthlySpending: Math.round(avgSpending),
        savingsRate, momChange,
        currentNetWorth: Math.round(currentNetWorth),
        totalBudget,
        categoryBreakdown: catBreakdown,
        subscriptionTotal: Math.round(subTotal),
        topSubscriptions: subscriptions.slice(0,5).map(s=>`${s.name}: $${s.amount}/mo`),
        consecutiveOverspend: adherenceData.filter(r=>r.overCount>=2).map(r=>({name:r.cat.name,overCount:r.overCount,limit:r.cat.limit})),
      };
      const result = await getAiInsights(context);
      if (result.error) throw new Error(result.error);
      onSetAiInsights(result);
    } catch(e) {
      setAiError(e.message==="no_api_key"?"Add your API key on the Ask AI page.":e.message);
    } finally { setAiLoading(false); }
  }, [monthlyData, categories, avgIncome, avgSpending, savingsRate, momChange,
      currentNetWorth, totalBudget, subTotal, subscriptions, adherenceData, monthlyIncome]);

  const pinInsight = (text) => {
    if (!text?.trim()) return;
    if (todos.some(t=>t.text===text.trim())) return;
    onTodosChange([...todos, {id:Date.now().toString(), text:text.trim(), addedAt:Date.now()}]);
  };
  const isPinned = (text) => todos.some(t=>t.text===text?.trim());

  const saveGoalForm = () => {
    if (!goalForm.title?.trim()||!goalForm.targetAmount) return;
    onSaveGoal({id:Date.now().toString(), title:goalForm.title.trim(), targetAmount:parseFloat(goalForm.targetAmount), deadline:goalForm.deadline, savedAmount:0, createdAt:Date.now()});
    setGoalForm({title:"",targetAmount:"",deadline:""}); setShowGoalModal(false);
  };

  /* ── heat cell helper ─────────────────────────────────── */
  const heatCell = (m) => {
    if (!m.limit) return "none";
    const r = m.spent/m.limit;
    return r>1?"over":r>=0.8?"warn":m.spent>0?"ok":"none";
  };

  /* ── grade letter colors ──────────────────────────────── */
  const gradeColor = g => g==="A"?"rgba(93,202,165,0.15)":g==="B"?"rgba(108,140,255,0.15)":g==="C"?"rgba(240,176,76,0.15)":"rgba(232,115,99,0.15)";
  const gradeText  = g => g==="A"?"var(--safe)":g==="B"?"var(--calm)":g==="C"?"var(--warn)":"var(--debt)";

  const monthLabel = today.toLocaleString("en-US",{month:"short",year:"numeric"});
  const initials = accounts[0]?.institution?.slice(0,2).toUpperCase()||"ME";

  return (
    <>
      <style>{CSS}</style>
      <div className="la-wrap">
        <div className="la-frame">
          {/* chrome bar */}
          <div className="la-bar">
            <div className="la-bar-dot"/><div className="la-bar-dot"/><div className="la-bar-dot"/>
            <span className="la-bar-url">app.ledgr.app / analytics</span>
            <span className="la-bar-live">live · synced just now</span>
          </div>

          <div className="la-body">
            {/* sidenav */}
            <nav className="la-nav">
              <div className="la-nav-logo"/>
              {NAV.map(n=><div key={n.id} className={`la-ni${n.active?" active":""}`} onClick={()=>navigate(n.id)} title={n.id}>{n.icon}</div>)}
              <div className="la-nav-spacer"/>
              <div className="la-ni" onClick={()=>navigate("settings")}>⚙</div>
            </nav>

            <div className="la-main">
              {/* topbar */}
              <div className="la-topbar">
                <div className="la-tb-left">
                  <span className="la-tb-num">vi ·</span>
                  <span className="la-tb-title">Analytics</span>
                  <span className="la-tb-div"/>
                  <span className="la-tb-sub">{monthLabel}</span>
                </div>
                <div className="la-av">{initials}</div>
              </div>

              {/* ═══ SECTION 1: REPORT CARD ═══ */}
              <div className="la-report">
                {/* score ring + grades */}
                <div className="la-score-col">
                  <div className="la-score-ring">
                    <svg viewBox="0 0 100 100" width="100" height="100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7"/>
                      <circle cx="50" cy="50" r="42" fill="none" stroke={healthScore.color} strokeWidth="7"
                        strokeDasharray="264" strokeDashoffset={264*(1-healthScore.score/100)} strokeLinecap="round"/>
                    </svg>
                    <div className="la-score-center">
                      <div className="la-score-n" style={{color:healthScore.color}}>{healthScore.score}</div>
                      <div className="la-score-l">health</div>
                    </div>
                  </div>
                  {healthScore.breakdown.map(item=>(
                    <div key={item.label} className="la-grade-row">
                      <div className="la-grade-letter" style={{background:gradeColor(item.grade),color:gradeText(item.grade)}}>{item.grade}</div>
                      <span className="la-grade-name">{item.label}</span>
                      <span className="la-grade-val">{item.val||`${item.pts}/${item.max}`}</span>
                    </div>
                  ))}
                </div>

                {/* narrative summary */}
                <div className="la-summary-col">
                  <div className="la-summary-hl">
                    {narrativeHL.savingsCopy != null ? (
                      <>
                        You're{" "}
                        <em style={{color: narrativeHL.warnSavings ? "var(--debt)" : "var(--safe)"}}>
                          {narrativeHL.savingsCopy}
                        </em>
                        {narrativeHL.warnCategory
                          ? <> — and <em style={{color:"var(--warn)"}}>{narrativeHL.warnCategory}</em> <em style={{color:"var(--debt)"}}>has been over budget {narrativeHL.worstMonths} months straight.</em></>
                          : narrativeHL.warnSavings
                            ? <> — <em style={{color:"var(--debt)"}}>review your budget categories.</em></>
                            : <> and your <em style={{color:"var(--safe)"}}>budget is on track.</em></>
                        }
                      </>
                    ) : (
                      <>Set a monthly income target to unlock full financial insights.</>
                    )}
                  </div>
                  <div className="la-sstats">
                    <div className="la-sstat" style={{borderColor:"var(--debt)"}}>
                      <div className="sl">Spent so far</div>
                      <div className="sv" style={{color:"var(--debt)"}}>{fmt(thisMonthD?.spending||0)}</div>
                      <div className="ss">day {dayOfMonth} of {daysInMonth}</div>
                    </div>
                    <div className="la-sstat" style={{borderColor:totalBudget>0&&projectedSpend>totalBudget?"var(--debt)":"var(--warn)"}}>
                      <div className="sl">Projected month</div>
                      <div className="sv" style={{color:totalBudget>0&&projectedSpend>totalBudget?"var(--debt)":"var(--warn)"}}>{fmt(projectedSpend)}</div>
                      <div className="ss">of {fmt(totalBudget)} budget</div>
                    </div>
                    <div className="la-sstat" style={{borderColor:currentNetWorth>=0?"var(--calm)":"var(--debt)"}}>
                      <div className="sl">Net worth</div>
                      <div className="sv" style={{color:currentNetWorth>=0?"var(--calm)":"var(--debt)"}}>{fmt(currentNetWorth)}</div>
                      <div className="ss">all accounts</div>
                    </div>
                    <div className="la-sstat" style={{borderColor:monthlySv>=0?"var(--safe)":"var(--debt)"}}>
                      <div className="sl">Avg saved/mo</div>
                      <div className="sv" style={{color:monthlySv>=0?"var(--safe)":"var(--debt)"}}>{monthlySv>=0?"+":""}{fmt(monthlySv)}</div>
                      <div className="ss">income − expenses</div>
                    </div>
                  </div>
                  {chronicCats.length>0&&(
                    <div className="la-verdict">
                      {worstChronic?.cat?.name} has been over limit {worstChronic?.overCount}/6 months. At this pace you're on track to overspend that budget by approximately <strong style={{color:"var(--debt)"}}>{fmt(Math.round((worstChronic?.cat?.limit||0)*0.15*6))}</strong> this year.
                    </div>
                  )}
                  <hr className="la-ai-headline-divider"/>
                  <div className="la-ai-headline-area">
                    <div className="la-ai-headline-label">
                      <div className="la-ai-headline-dot"/>
                      ✦ AI Summary
                    </div>
                    {aiLoading ? (
                      <div className="la-ai-headline-box empty">Analyzing your finances…</div>
                    ) : aiInsights?.headline ? (
                      <div className="la-ai-headline-box">{aiInsights.headline}</div>
                    ) : (
                      <div className="la-ai-headline-box empty">Generate insights to see a summary here.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* ═══ MAIN BODY ═══ */}
              <div className="la-analytics-body">

                {/* LEFT */}
                <div className="la-left">

                  {/* SECTION 2: Spending Pace */}
                  <div className="la-card">
                    <div className="la-card-hdr">
                      <span className="la-card-title">Spending <em>pace</em></span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span className="la-pill warn">day {dayOfMonth} / {daysInMonth}</span>
                        <div className="la-pace-tabs">
                          {[["last","Monthly"],["avg3","Quarterly"],["avg12","Yearly"]].map(([k,l])=>(
                            <button key={k} className={`la-pace-tab${paceRange===k?" active":""}`} onClick={()=>setPaceRange(k)}>{l}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="la-card-body">
                      <div className="la-pace-stats">
                        <div className="la-pace-stat">
                          <div className="eye">So far</div>
                          <div className="big" style={{color:"var(--debt)"}}>{fmt(thisMonthD?.spending||0)}</div>
                          <div className="sub">day {dayOfMonth}</div>
                        </div>
                        <div className="la-pace-stat">
                          <div className="eye">Projected</div>
                          <div className="big" style={{color:"var(--warn)"}}>{fmt(projectedSpend)}</div>
                          <div className="sub">linear est.</div>
                        </div>
                        <div className="la-pace-stat">
                          <div className="eye">{paceRange==="last"?"Last month":paceRange==="avg3"?"3-mo avg":"12-mo avg"}</div>
                          <div className="big" style={{color:"var(--ink-2)"}}>{fmt(lastMonthD?.spending||0)}</div>
                          <div className="sub">reference</div>
                        </div>
                      </div>
                      <div className="la-chart-wrap">
                        <PaceChart transactions={transactions} monthlyData={monthlyData} today={today} range={paceRange}/>
                      </div>
                      <div className="la-legend">
                        <div className="la-leg"><span style={{display:"inline-block",width:16,height:2,background:"#5dcaa5",borderRadius:2}}/> This month</div>
                        <div className="la-leg"><svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="4,3"/></svg> {paceRange==="last"?"Last month":"Avg comparison"}</div>
                        <div className="la-leg"><svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="rgba(240,176,76,0.5)" strokeWidth="1.5" strokeDasharray="4,3"/></svg> Projected</div>
                      </div>
                    </div>
                  </div>

                  {/* SECTIONS 3+4: Cash Flow + Subscriptions */}
                  <div className="la-two-col">
                    {/* Cash Flow */}
                    <div className="la-card">
                      <div className="la-card-hdr">
                        <span className="la-card-title">Cash <em>flow</em></span>
                        <span className="la-pill safe">{last6.filter(m=>m.income>0&&m.income>=m.spending).length}/{last6.length} mo+</span>
                      </div>
                      <div className="la-card-body">
                        <div className="la-cf-summary">
                          <div className="la-cf-s"><div className="eye">Avg income</div><div className="v" style={{color:"var(--safe)"}}>{fmt(avgIncome)}</div></div>
                          <div className="la-cf-s"><div className="eye">Avg spend</div><div className="v" style={{color:"var(--debt)"}}>{fmt(avgSpending)}</div></div>
                          <div className="la-cf-s"><div className="eye">Net saved</div><div className="v" style={{color:monthlySv>=0?"var(--calm)":"var(--debt)"}}>{monthlySv>=0?"+":""}{fmt(monthlySv)}</div></div>
                        </div>
                        <CFBars data={last6.map(m=>({label:m.label.split(" ")[0], income:m.income, spending:m.spending}))}/>
                        <div style={{display:"flex",gap:12}}>
                          <div className="la-leg"><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"rgba(93,202,165,0.3)"}}/> Income</div>
                          <div className="la-leg"><span style={{display:"inline-block",width:10,height:10,borderRadius:2,background:"rgba(232,115,99,0.42)"}}/> Spending</div>
                        </div>
                      </div>
                    </div>

                    {/* Subscriptions */}
                    <div className="la-card">
                      <div className="la-card-hdr">
                        <span className="la-card-title">Subscriptions</span>
                        <span style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--debt)"}}>${subTotal.toFixed(2)}/mo · ${Math.round(subTotal*12)}/yr</span>
                      </div>
                      <div style={{padding:0}}>
                        <div className="la-sub-hdr">
                          <span className="la-pill" style={{fontSize:9}}>Service</span>
                          <div style={{display:"flex",gap:8}}><span style={{fontFamily:"var(--fm)",fontSize:9,color:"var(--ink-3)"}}>Mo</span><span style={{fontFamily:"var(--fm)",fontSize:9,color:"var(--ink-3)",minWidth:40,textAlign:"right"}}>Annual</span></div>
                        </div>
                        {subscriptions.slice(0,5).map((s,i)=>(
                          <div key={i} className="la-sub-row">
                            <div className="la-sub-fav">{s.name.slice(0,1).toUpperCase()}</div>
                            <div className="la-sub-name">{s.name}</div>
                            <div className="la-sub-mo">{fmt(s.amount)}</div>
                            <div className="la-sub-yr">{fmt(s.amount*12)}/yr</div>
                          </div>
                        ))}
                        {subscriptions.length===0&&(
                          <div style={{padding:"14px 16px",fontSize:11,color:"var(--ink-3)",fontStyle:"italic"}}>No recurring charges detected yet</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTIONS 5+7: Adherence + Net Worth */}
                  <div className="la-two-col">
                    {/* Budget Adherence */}
                    <div className="la-card">
                      <div className="la-card-hdr">
                        <span className="la-card-title">Budget <em>adherence</em></span>
                        <span className="la-pill calm">6 mo view</span>
                      </div>
                      <div className="la-card-body" style={{padding:"12px 14px"}}>
                        <div className="la-adh-sections">
                          {/* Chronic offenders */}
                          <div>
                            <div className="la-adh-sect-lbl" style={{color:"var(--debt)"}}>⚠ Chronic Overspent</div>
                            {chronicCats.length===0
                              ? <div style={{fontSize:11,color:"var(--safe)",fontStyle:"italic"}}>No chronic overspend ✓</div>
                              : chronicCats.map(r=>(
                                <div key={r.cat.id} className="la-adh-cat-row">
                                  <div className="la-adh-dot" style={{background:"var(--debt)"}}/>
                                  <div className="la-adh-name">{r.cat.name}</div>
                                  <div className="la-adh-strip">
                                    {r.months.map((m,i)=><div key={i} className={`la-hc ${heatCell(m)}`}>{heatCell(m)==="over"?"!":""}</div>)}
                                  </div>
                                  <div className="la-adh-count" style={{color:"var(--debt)"}}>{r.overCount}/6</div>
                                </div>
                              ))
                            }
                            {/* Near-limit / mixed */}
                            {adherenceData.filter(r=>r.status==="mixed"&&r.warnCount>=2).slice(0,2).map(r=>(
                              <div key={r.cat.id} className="la-adh-cat-row">
                                <div className="la-adh-dot" style={{background:"var(--warn)"}}/>
                                <div className="la-adh-name">{r.cat.name}</div>
                                <div className="la-adh-strip">
                                  {r.months.map((m,i)=><div key={i} className={`la-hc ${heatCell(m)}`}>{heatCell(m)==="over"?"!":""}</div>)}
                                </div>
                                <div className="la-adh-count" style={{color:"var(--warn)"}}>near</div>
                              </div>
                            ))}
                          </div>
                          {/* Most consistent */}
                          <div>
                            <div className="la-adh-sect-lbl" style={{color:"var(--safe)"}}>✓ Most consistent</div>
                            {consistentCats.length===0
                              ? <div style={{fontSize:11,color:"var(--ink-3)",fontStyle:"italic"}}>Not enough data yet</div>
                              : consistentCats.map(r=>(
                                <div key={r.cat.id} className="la-adh-cat-row">
                                  <div className="la-adh-dot" style={{background:"var(--safe)"}}/>
                                  <div className="la-adh-name">{r.cat.name}</div>
                                  <div className="la-adh-strip">
                                    {r.months.map((m,i)=><div key={i} className={`la-hc ${heatCell(m)}`}/>)}
                                  </div>
                                  <div className="la-adh-count" style={{color:"var(--safe)"}}>{r.totalWith}/6 ✓</div>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                        {worstChronic&&(
                          <div className="la-verdict-box">
                            <strong>{worstChronic.cat.name}</strong> has been over its {fmt(worstChronic.cat.limit)} limit in {worstChronic.overCount} of the last 6 months.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Net Worth Projection */}
                    <div className="la-card">
                      <div className="la-card-hdr">
                        <span className="la-card-title">Net worth <em>projection</em></span>
                        <button className="la-edit-vars" onClick={()=>setShowVarsModal(true)}>⚙ variables</button>
                      </div>
                      <div className="la-card-body">
                        <div className="la-nw-hdr">
                          <div className="la-nw-stat">
                            <div className="eye">Current</div>
                            <div className="big">{fmt(currentNetWorth)}</div>
                            <div className="sub">{fmt(monthlySv)}/mo savings</div>
                          </div>
                          <div className="la-nw-tabs">
                            {[["conservative","4%"],["moderate","7%"],["optimistic","10%"]].map(([k,l])=>(
                              <button key={k} className={`la-nw-tab${nwScenario===k?" active":""}`} onClick={()=>setNwScenario(k)}>{l}</button>
                            ))}
                          </div>
                        </div>
                        <div className="la-chart-wrap">
                          <NWChart nw={currentNetWorth} monthlySv={monthlySv} scenario={nwScenario}/>
                        </div>
                        <div className="la-nw-milestones">
                          {[["1 yr","yr1"],["3 yr","yr3"],["5 yr","yr5"],["10 yr","yr10"]].map(([lbl,k])=>(
                            <div key={k} className="la-nw-m">
                              <div className="hl">{lbl}</div>
                              <div className="v" style={{color:k==="yr10"?"var(--goal)":"var(--calm)"}}>{fmtK(nwMilestones[k]||0)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT RAIL */}
                <div className="la-right">
                  {/* AI Insights */}
                  <div>
                    <div className="la-rail-lbl"><span>✦ AI Insights</span><span className="la-rail-sub">Claude</span></div>
                    {hasApiKey ? (
                      <button className="la-ai-gen-btn" onClick={runAI} disabled={aiLoading}>
                        {aiLoading ? "✦ Analyzing…" : "✦ Generate financial insights"}
                      </button>
                    ) : (
                      <div className="la-ai-empty">Add your API key on the Ask AI page to generate insights.</div>
                    )}
                    {aiError&&<div className="la-ai-error">{aiError}</div>}

                    {/* Pinned todos shown first */}
                    {todos.filter(t=>!dismissed.has(t.id)).map(todo=>(
                      <div key={todo.id} className="la-insight-card pinned">
                        <div className="la-pinned-badge">📌 pinned</div>
                        <div className="la-insight-text">{todo.text}</div>
                        <div className="la-insight-actions">
                          <button className="la-pin-btn" style={{background:"transparent",borderColor:"rgba(93,202,165,0.15)",color:"var(--ink-3)"}}>📌 Pinned</button>
                          <button className="la-dismiss-btn" onClick={()=>setDismissed(p=>new Set([...p,todo.id]))}>✕</button>
                        </div>
                      </div>
                    ))}

                    {/* AI insights from Claude */}
                    {aiInsights?.insights?.filter(ins=>!dismissed.has(ins.title)).map((ins,i)=>(
                      <div key={i} className="la-insight-card">
                        <div className="la-insight-text"><strong>{ins.title}</strong> {ins.body}</div>
                        <div className="la-insight-actions">
                          {isPinned(ins.body||ins.title)
                            ? <button className="la-pin-btn" style={{background:"transparent",borderColor:"rgba(93,202,165,0.15)",color:"var(--ink-3)"}}>📌 Pinned</button>
                            : <button className="la-pin-btn" onClick={()=>pinInsight(ins.body||ins.title)}>📌 Pin as goal</button>
                          }
                          <button className="la-dismiss-btn" onClick={()=>setDismissed(p=>new Set([...p,ins.title]))}>✕</button>
                        </div>
                      </div>
                    ))}
                    {!aiInsights&&!aiLoading&&hasApiKey&&(
                      <div className="la-ai-empty">Generate insights to see Claude's analysis of your finances.</div>
                    )}
                  </div>

                  <div className="la-rail-div"/>

                  {/* Pinned Goals */}
                  <div>
                    <div className="la-rail-lbl">Pinned Goals</div>
                    {goals.length===0&&(
                      <div className="la-ai-empty">No goals yet. Pin an AI insight or add a goal below.</div>
                    )}
                    {goals.map(g=>{
                      const prog=g.targetAmount>0?Math.min(100,Math.round(((g.savedAmount||0)/g.targetAmount)*100)):0;
                      const done=prog>=100;
                      return(
                        <div key={g.id} className="la-goal-card">
                          <div className="la-goal-name">{g.title||g.text}</div>
                          <div className="la-goal-track"><div className="la-goal-fill" style={{width:`${prog}%`,background:done?"var(--safe)":prog>=60?"var(--calm)":"var(--warn)"}}/></div>
                          <div className="la-goal-meta">
                            <span>{g.targetAmount?`${fmt(g.savedAmount||0)} of ${fmt(g.targetAmount)}`:g.deadline||""}</span>
                            {done?<span style={{color:"var(--safe)"}}>✓ Done</span>:<span>{prog}%</span>}
                          </div>
                        </div>
                      );
                    })}
                    <button className="la-add-goal-btn" onClick={()=>setShowGoalModal(true)}>+ Add goal</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Variables Modal */}
      {showVarsModal&&(
        <div className="la-modal-bg" onClick={e=>{if(e.target.classList.contains("la-modal-bg"))setShowVarsModal(false);}}>
          <div className="la-modal">
            <div className="la-modal-hdr">
              <span className="la-modal-title">Projection <em>variables</em></span>
              <button className="la-modal-close" onClick={()=>setShowVarsModal(false)}>✕</button>
            </div>
            <div className="la-field">
              <label className="la-field-lbl">Monthly income</label>
              <input className="la-field-input" value={varsForm.monthlyIncome} onChange={e=>setVarsForm(p=>({...p,monthlyIncome:e.target.value}))} placeholder="e.g. 3240"/>
            </div>
            <div className="la-field-row">
              <div className="la-field">
                <label className="la-field-lbl">Retirement age</label>
                <input className="la-field-input" value={varsForm.retirementAge} onChange={e=>setVarsForm(p=>({...p,retirementAge:e.target.value}))} placeholder="65"/>
              </div>
              <div className="la-field">
                <label className="la-field-lbl">Net worth target</label>
                <input className="la-field-input" value={varsForm.netWorthTarget} onChange={e=>setVarsForm(p=>({...p,netWorthTarget:e.target.value}))} placeholder="e.g. 1000000"/>
              </div>
            </div>
            <div className="la-modal-note">These variables are saved to your profile and used across all projections.</div>
            <div className="la-modal-footer">
              <button className="la-modal-save" onClick={()=>{
                // propagate up — parent handles saving to userProfile
                setShowVarsModal(false);
              }}>Save variables</button>
              <button className="la-modal-cancel" onClick={()=>setShowVarsModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Form Modal */}
      {showGoalModal&&(
        <div className="la-modal-bg" onClick={e=>{if(e.target.classList.contains("la-modal-bg"))setShowGoalModal(false);}}>
          <div className="la-modal">
            <div className="la-modal-hdr">
              <span className="la-modal-title">New <em>goal</em></span>
              <button className="la-modal-close" onClick={()=>setShowGoalModal(false)}>✕</button>
            </div>
            <div className="la-field">
              <label className="la-field-lbl">Goal name</label>
              <input className="la-field-input" value={goalForm.title} onChange={e=>setGoalForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Reach $100k net worth"/>
            </div>
            <div className="la-field-row">
              <div className="la-field">
                <label className="la-field-lbl">Target amount</label>
                <input className="la-field-input" type="number" value={goalForm.targetAmount} onChange={e=>setGoalForm(p=>({...p,targetAmount:e.target.value}))} placeholder="100000"/>
              </div>
              <div className="la-field">
                <label className="la-field-lbl">Deadline (optional)</label>
                <input className="la-field-input" type="date" value={goalForm.deadline} onChange={e=>setGoalForm(p=>({...p,deadline:e.target.value}))}/>
              </div>
            </div>
            <div className="la-modal-footer">
              <button className="la-goal-form-btn" onClick={saveGoalForm}>Save goal</button>
              <button className="la-modal-cancel" onClick={()=>setShowGoalModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
