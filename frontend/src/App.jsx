/**
 * App.jsx
 *
 * Root application component and main orchestrator.
 * Holds shared application state and renders the appropriate view
 * based on the current navigation state.
 *
 * Architecture:
 *   - AppInner: stateful orchestrator, owns all shared data state
 *   - Pages (Dashboard, Transactions, etc.) defined inline as they share
 *     state via closure — see Phase 3 for context-based extraction
 *   - Extracted standalone components: /components, /auth, /layout, /theme
 */
import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { usePlaidLink } from "react-plaid-link";
import * as api from "./api.js";
const { debounce } = api;
import { useAppData } from "./hooks/useAppData.js";
import LedgrBriefing from "./components/LedgrBriefing.jsx";
import LedgrTransactions from "./components/LedgrTransactions.jsx";
import LedgrAccounts from "./components/LedgrAccounts.jsx";
import LedgrCalendar from "./components/LedgrCalendar.jsx";
import LedgrBudgets from "./components/LedgrBudgets.jsx";
import OnboardingWizard, { ONBOARDING_STORAGE_KEY } from "./components/OnboardingWizard.jsx";
import { useDuplicateScan } from "./hooks/useDuplicateScan.js";
import { usePortfolio } from "./hooks/usePortfolio.js";
import { useAiChat } from "./hooks/useAiChat.js";
import PortfolioView from "./PortfolioView.jsx";
import AiChat from "./AiChat.jsx";
import Analytics from "./Analytics.jsx";
import DaniPage from "./DaniPage.jsx";
import { DEMO_CATEGORIES, DEMO_ACCOUNTS, DEMO_TRANSACTIONS, DEMO_RULES, DEMO_GOALS, DEMO_USER_PROFILE } from "./demoData.js";

// Extracted modules — see src/components, src/theme, src/constants
import { S, applyTheme, applyGlobalOpacity } from "./theme/index.js";
import { CAT_COLORS, DAYS_OF_WEEK, PAGE_RIGHT_COL_W, PAGE_COL_GAP, SHARED_LEFT_WIDTH, INSTALL_KEY, getDaysLeft } from "./constants.js";
import { Modal, Toast, CustomSelect, PageLayout, CategoryBadge } from "./components/ui/index.jsx";
import MerchantIcon from "./components/MerchantIcon.jsx";
import TxnRow from "./components/TxnRow.jsx";
import { SidebarContent } from "./components/layout/Sidebar.jsx";
import { BottomNav, BOTTOM_NAV } from "./components/layout/BottomNav.jsx";
import { InstallPrompt } from "./components/layout/InstallPrompt.jsx";
import { PrivacyPolicy, TermsOfService } from "./auth/Legal.jsx";
import { SecurityBadges } from "./auth/SecurityBadges.jsx";
import RulesPage from "./RulesPage.jsx";

/* --- Mobile detection -------------------------------------------- */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

/* --- Global CSS --------------------------------------------------- */
(function injectCSS() {
  if (document.getElementById("ledgr-css")) return;
  const el = document.createElement("style");
  el.id = "ledgr-css";
  el.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body { overscroll-behavior: none; }
    button {
      background: transparent; border: none; outline: none;
      box-shadow: none; -webkit-appearance: none; appearance: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* ─── OBSIDIAN DESIGN SYSTEM ──────────────────────────── */

    /* Layout */
    .ledgr-content     { padding: 0; }
    .ledgr-view-padded { padding: 0; }
    .ledgr-stat-grid   { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
    .ledgr-dash-cards  { display: flex; flex-direction: column; gap: 12px; }
    .ledgr-acct-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .ledgr-budget-grid { display: grid; grid-template-columns: 1fr; gap: 0; }
    .ledgr-cal-cell    { min-height: 80px; padding: 8px; }
    .ledgr-monthbar-meta { display: flex; align-items: center; gap: 16px; }

    @media (max-width: 768px) {
      .ledgr-content { padding: 0 !important; }
      .ledgr-monthbar-meta { flex-wrap: wrap !important; gap: 8px !important; justify-content: center !important; }
    }

    /* ── Sidebar ── */
    .obsidian-nav {
      background: var(--surface);
    }

    /* ── Nav items ── */
    .obsidian-nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 20px; font-size: 13px; font-weight: 400;
      color: rgba(232,221,208,0.35);
      cursor: pointer;
      transition: color 0.18s ease, background 0.18s ease;
      background: transparent; border: none;
      width: 100%; text-align: left;
      font-family: var(--font-body);
      box-sizing: border-box;
      border-radius: 0;
    }
    .obsidian-nav-item:hover {
      color: rgba(232,221,208,0.6);
      background: rgba(255,255,255,0.03);
    }
    .obsidian-nav-item.active {
      color: #e8ddd0;
      background: var(--cyan-dim);
      font-weight: 500;
      border-radius: 0;
    }
    .obsidian-nav-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: currentColor; opacity: 0.4; flex-shrink: 0;
      transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1),
                  opacity 0.18s ease,
                  background 0.18s ease,
                  box-shadow 0.18s ease;
    }
    .obsidian-nav-item.active .obsidian-nav-dot {
      background: var(--cyan);
      opacity: 1;
      transform: scale(1.5);
      box-shadow: 0 0 7px var(--cyan);
    }
    /* Sliding right-edge indicator */
    .obsidian-nav-indicator {
      position: absolute;
      right: 0;
      width: 2px;
      background: var(--cyan);
      box-shadow: 0 0 8px var(--cyan), -2px 0 12px var(--glow-color, rgba(0,210,190,0.3));
      border-radius: 2px 0 0 2px;
      pointer-events: none;
      transition: top 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                  height 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 10;
    }

    /* ── Cards: solid warm surface, clean border ── */
    .obsidian-card {
      background: linear-gradient(var(--grad-angle, 315deg), var(--card, #181511) 0%, var(--card-hi, #1e1b17) 100%) !important;
      border: none !important;
      border-radius: 12px !important;
      position: relative;
      transition: box-shadow 0.2s ease, filter 0.2s ease;
    }
    @media (hover: hover) {
      .obsidian-card:hover {
        box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.25);
        filter: brightness(1.06);
      }
    }
    .obsidian-card::before { display: none !important; }

    /* ── Topbar accent line ── */
    .obsidian-topbar {
      position: relative;
    }

    /* ─── ANIMATIONS ─────────────────────────────── */
    @keyframes obsidian-view-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ledgr-view-enter { animation: obsidian-view-in 0.28s cubic-bezier(0.22,1,0.36,1) both; }

    @keyframes ledgr-card-up {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ledgr-card-anim { animation: ledgr-card-up 0.35s cubic-bezier(0.22,1,0.36,1) both; }
    .ledgr-card-anim:nth-child(1)  { animation-delay: 0ms; }
    .ledgr-card-anim:nth-child(2)  { animation-delay: 50ms; }
    .ledgr-card-anim:nth-child(3)  { animation-delay: 100ms; }
    .ledgr-card-anim:nth-child(4)  { animation-delay: 150ms; }
    .ledgr-card-anim:nth-child(5)  { animation-delay: 200ms; }
    .ledgr-card-anim:nth-child(n+6){ animation-delay: 250ms; }

    @keyframes ledgr-bar-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    .ledgr-bar-anim { transform-origin: left center; animation: ledgr-bar-fill 1s cubic-bezier(0.22,1,0.36,1) both; }
    .ledgr-bar-anim:nth-child(1)  { animation-delay: 60ms; }
    .ledgr-bar-anim:nth-child(2)  { animation-delay: 150ms; }
    .ledgr-bar-anim:nth-child(3)  { animation-delay: 240ms; }
    .ledgr-bar-anim:nth-child(4)  { animation-delay: 330ms; }
    .ledgr-bar-anim:nth-child(5)  { animation-delay: 420ms; }
    .ledgr-bar-anim:nth-child(n+6){ animation-delay: 500ms; }
    .ledgr-bar { }

    @keyframes ledgr-donut-seg-in { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
    .ledgr-donut-seg { transform-origin: center; transform-box: fill-box; animation: ledgr-donut-seg-in 0.45s cubic-bezier(0.22,1,0.36,1) both; }
    .ledgr-donut-seg:nth-child(1) { animation-delay: 60ms; }
    .ledgr-donut-seg:nth-child(2) { animation-delay: 150ms; }
    .ledgr-donut-seg:nth-child(3) { animation-delay: 240ms; }
    .ledgr-donut-seg:nth-child(4) { animation-delay: 320ms; }
    .ledgr-donut-seg:nth-child(5) { animation-delay: 400ms; }

    @keyframes ledgr-ring-fill { from { stroke-dashoffset: 200; } }
    .ledgr-ring-fill { animation: ledgr-ring-fill 1.1s cubic-bezier(0.22,1,0.36,1) both; }

    @keyframes ledgr-arc-fill { from { stroke-dashoffset: var(--arc-len, 200); } to { stroke-dashoffset: 0; } }
    .ledgr-arc-fill { animation: ledgr-arc-fill 1.2s cubic-bezier(0.22,1,0.36,1) both; }

    @keyframes ledgr-stat-in { from { opacity:0; transform:scale(0.9) translateY(4px); } to { opacity:1; transform:scale(1) translateY(0); } }
    .ledgr-stat-val { animation: ledgr-stat-in 0.4s cubic-bezier(0.22,1,0.36,1) both; }
    .ledgr-stat-val:nth-child(1) { animation-delay: 60ms; }
    .ledgr-stat-val:nth-child(2) { animation-delay: 130ms; }
    .ledgr-stat-val:nth-child(3) { animation-delay: 200ms; }
    .ledgr-stat-val:nth-child(4) { animation-delay: 270ms; }

    @keyframes ledgr-bell-ring {
      0%,70%,100% { transform: rotate(0deg); }
      10% { transform: rotate(14deg); } 20% { transform: rotate(-12deg); }
      30% { transform: rotate(10deg); } 40% { transform: rotate(-8deg); }
      50% { transform: rotate(5deg);  } 60% { transform: rotate(-3deg); }
    }
    .ledgr-bell-ring { animation: ledgr-bell-ring 2.4s ease-in-out infinite; transform-origin: top center; display: inline-flex; }

    @keyframes ledgr-notif-enter { from { opacity:0; transform:translateX(8px); } to { opacity:1; transform:translateX(0); } }
    .ledgr-notif-enter { animation: ledgr-notif-enter 0.22s ease both; }

    @keyframes ledgr-overlay-in { from { opacity:0; } to { opacity:1; } }
    .ledgr-overlay-anim { animation: ledgr-overlay-in 0.16s ease both; }

    @keyframes ledgr-modal-in { from { opacity:0; transform:scale(0.97) translateY(6px); } to { opacity:1; transform:scale(1) translateY(0); } }
    .ledgr-modal-anim { animation: ledgr-modal-in 0.2s cubic-bezier(0.22,1,0.36,1) both; }

    @keyframes ledgr-logo-pulse { 0%,100% { opacity:1; } 50% { opacity:0.75; } }
    .ledgr-logo-pulse { animation: ledgr-logo-pulse 3s ease-in-out infinite; }

    @keyframes ledgr-pulse-glow {
      0%,100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
      50%      { box-shadow: 0 0 0 3px rgba(201,149,106,0.2); }
    }
    .ledgr-pulse-glow { animation: ledgr-pulse-glow 2s ease-in-out infinite; }

    /* ── Mobile bottom nav ── */
    .mobile-bottom-nav {
      height: 82px;
      background: var(--surface);
      border-top: 1px solid rgba(255,255,255,0.07);
      box-shadow: 0 -8px 24px rgba(0,0,0,0.6);
      display: flex; align-items: stretch; flex-shrink: 0;
      position: relative; z-index: 50;
    }
    .mobile-nav-indicator {
      position: absolute; top: -2px; height: 2px;
      background: var(--cyan);
      box-shadow: 0 0 10px var(--cyan), 0 0 20px var(--glow-color);
      border-radius: 0 0 2px 2px;
      transition: left 0.28s cubic-bezier(0.4,0,0.2,1), width 0.28s cubic-bezier(0.4,0,0.2,1);
      pointer-events: none; z-index: 11;
    }
    .mobile-nav-item {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start;
      gap: 4px; cursor: pointer; border: none;
      background: transparent; position: relative;
      padding: 10px 0 max(env(safe-area-inset-bottom, 0px), 12px);
      transition: background 0.18s;
      -webkit-tap-highlight-color: transparent;
      align-self: stretch;
    }
    .mobile-nav-item.active { background: var(--cyan-dim); }
    .mobile-nav-item svg {
      width: 24px; height: 24px;
      stroke: rgba(232,221,208,0.32); fill: none;
      stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round;
      transition: stroke 0.18s, filter 0.18s;
    }
    .mobile-nav-item.active svg {
      stroke: var(--cyan);
      filter: drop-shadow(0 0 4px var(--glow-color));
    }
    .mobile-nav-label {
      font-size: 10px; font-weight: 500; letter-spacing: 0.2px;
      color: rgba(232,221,208,0.32); transition: color 0.18s;
      font-family: var(--font-body); line-height: 1;
    }
    .mobile-nav-item.active .mobile-nav-label { color: var(--cyan); }

    /* ── Top-right glow orb ── */
    .mobile-glow-orb {
      position: absolute; top: -60px; right: -60px;
      width: 200px; height: 200px; border-radius: 50%;
      background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%);
      pointer-events: none; z-index: 0;
      opacity: 1;
    }

    /* ── More sheet ── */
    .mobile-more-sheet {
      position: fixed; left: 0; right: 0; bottom: 82px;
      background: var(--surface);
      border-top: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px 20px 0 0;
      padding: 8px 0 12px;
      transform: translateY(100%);
      transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
      z-index: 40;
    }
    .mobile-more-sheet.open { transform: translateY(0); }
    .mobile-sheet-handle {
      width: 32px; height: 3px; background: rgba(255,255,255,0.15);
      border-radius: 99px; margin: 6px auto 10px;
    }
    .mobile-sheet-item {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 20px; font-size: 14px; color: var(--t2);
      cursor: pointer; transition: background 0.15s;
      border: none; background: none; width: 100%; text-align: left;
      font-family: var(--font-body);
    }
    .mobile-sheet-item:hover, .mobile-sheet-item:active { background: rgba(255,255,255,0.04); }
    .mobile-sheet-item svg {
      width: 18px; height: 18px; stroke: var(--t3); fill: none;
      stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0;
    }
    .mobile-sheet-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 6px 20px; }

    /* ── Dashboard edit-order mode ── */
    .dash-edit-card {
      position: relative;
      outline: 1px dashed rgba(255,255,255,0.15);
      outline-offset: 2px;
    }
    .dash-reorder-btns {
      position: absolute; top: 8px; right: 8px;
      display: flex; gap: 4px; z-index: 5;
    }
    .dash-reorder-btn {
      width: 24px; height: 24px; border-radius: 6px;
      background: var(--surface); border: none;
      color: var(--t2); font-size: 12px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .dash-reorder-btn:hover { background: var(--cyan); color: #000; }
    .dash-reorder-btn:disabled { opacity: 0.2; cursor: default; }

    .ledgr-chevron { display: inline-block; transition: transform 0.2s; font-size: 10px; }
    .ledgr-chevron-open { transform: rotate(180deg); }

    @keyframes ledgr-expand { from { opacity:0; max-height:0; } to { opacity:1; max-height:600px; } }
    .ledgr-expand { animation: ledgr-expand 0.22s ease both; overflow: hidden; }

    .ledgr-card-hover { transition: transform 0.2s ease; cursor: pointer; }
    .ledgr-card-hover:hover { transform: translateY(-2px); }

    /* Transaction list gradient fade */
    .ledgr-txn-gradient {
      background: linear-gradient(var(--grad-angle, 315deg),
        var(--card, #181511) 0%,
        var(--card-hi, #1e1b17) 100%
      );
      border-radius: 12px;
    }
    /* Budget list gradient */
    .ledgr-budget-gradient {
      background: linear-gradient(var(--grad-angle, 315deg),
        var(--card, #181511) 0%,
        var(--card-hi, #1e1b17) 100%
      );
      border-radius: 12px;
    }
    /* Loading bar animation */
    @keyframes ledgr-rule-prompt-in {
      from { transform: translateX(-50%) translateY(20px); opacity: 0; }
      to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
    }
    .ledgr-rule-prompt { animation: ledgr-rule-prompt-in 0.22s cubic-bezier(0.34,1.56,0.64,1) both; }

    @keyframes ledgr-loading-bar {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(200%); }
    }
    .ledgr-loading-bar {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 1px;
      overflow: hidden;
      border-radius: 0 0 4px 4px;
    }
    .ledgr-loading-bar::after {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 50%;
      height: 100%;
      background: linear-gradient(90deg, transparent, var(--cyan, #c9956a), transparent);
      animation: ledgr-loading-bar 1.6s ease-in-out infinite;
    }
    .ledgr-content::-webkit-scrollbar { width: 3px; }
    .ledgr-content::-webkit-scrollbar-track { background: transparent; }
    .ledgr-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
  `;
  document.head.appendChild(el);
})();




/* --- Styles ------------------------------------------------------- */
const today        = new Date();
const pad          = n => String(n).padStart(2,"0");
const fmt          = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);

const cap          = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : "";
const currentMonth = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
export const NAV = [
  { id:"dashboard",    icon:"◈", label:"Dashboard"    },
  { id:"transactions", icon:"⇅", label:"Transactions" },
  { id:"budgets",      icon:"◉", label:"Budgets"      },
  { id:"accounts",     icon:"▣", label:"Accounts"     },
  { id:"rules",        icon:"◎", label:"Rules"        },
  { id:"calendar",     icon:"▦", label:"Calendar"     },
  { id:"ai",           icon:"✦", label:"Ask AI"       },
  { id:"analytics",   icon:"◎", label:"Analytics"    },
];
function daysInMonth(y,m) { return new Date(y,m,0).getDate(); }
/** @deprecated Use getDaysLeft() from constants.js — kept during Phase 2 transition */
function daysLeft()        { return daysInMonth(today.getFullYear(), today.getMonth()+1) - today.getDate(); }

/* --- Sub-components ----------------------------------------------- */
function DragCard({ id, children, onMoveUp, onMoveDown, canMoveUp, canMoveDown, editMode }) {
  return (
    <div
      data-card-id={id}
      style={{ position: 'relative', borderRadius: 'var(--radius-lg)' }}
      className={editMode ? 'dash-edit-card' : ''}
    >
      {editMode && (
        <div className="dash-reorder-btns">
          <button className="dash-reorder-btn" disabled={!canMoveUp} onClick={onMoveUp} title="Move up">↑</button>
          <button className="dash-reorder-btn" disabled={!canMoveDown} onClick={onMoveDown} title="Move down">↓</button>
        </div>
      )}
      {children}
    </div>
  );
}

/* --- useDashboardColumns — 3-column layout with per-column reorder --- */
function useDashboardColumns(defaultCols, scheduleSaveRef, setDefaultCols) {
  const DEFAULT_COLS = { col1:["spending","balances"], col2:["budget","action"], col3:["goals","upcoming"] };

  // Normalize: accept old flat array or new col object
  function normalize(val) {
    if (!val) return DEFAULT_COLS;
    if (Array.isArray(val)) {
      // Migrate flat array into 3 columns
      const all = val.filter(Boolean);
      const third = Math.ceil(all.length / 3);
      return {
        col1: all.slice(0, third),
        col2: all.slice(third, third * 2),
        col3: all.slice(third * 2),
      };
    }
    if (val.col1 || val.col2 || val.col3) return { col1:val.col1||[], col2:val.col2||[], col3:val.col3||[] };
    return DEFAULT_COLS;
  }

  const [cols, setCols] = useState(() => normalize(defaultCols));
  const needsMigrationRef = useRef(Array.isArray(defaultCols));
  const prevRef = useRef(JSON.stringify(defaultCols));
  const key = JSON.stringify(defaultCols);
  if (key !== prevRef.current) {
    prevRef.current = key;
    const normalized = normalize(defaultCols);
    setCols(normalized);
    // If the incoming value was a flat array, immediately persist the normalized format
    if (Array.isArray(defaultCols)) {
      scheduleSaveRef?.current?.({ dashboardCardOrder: normalized });
    }
  }

  function moveItem(colKey, idx, dir) {
    setCols(prev => {
      const col = [...(prev[colKey]||[])];
      const swap = idx + dir;
      if (swap < 0 || swap >= col.length) return prev;
      [col[idx], col[swap]] = [col[swap], col[idx]];
      const next = { ...prev, [colKey]: col };
      scheduleSaveRef?.current?.({ dashboardCardOrder: next });
      setDefaultCols?.(next);
      return next;
    });
  }

  function moveToCol(id, fromCol, toCol) {
    setCols(prev => {
      const from = (prev[fromCol]||[]).filter(x => x !== id);
      const to = [...(prev[toCol]||[]), id];
      const next = { ...prev, [fromCol]: from, [toCol]: to };
      scheduleSaveRef?.current?.({ dashboardCardOrder: next });
      setDefaultCols?.(next);
      return next;
    });
  }

  return { cols, moveItem, moveToCol };
}

function PlaidButton({ onSuccess, onExit, label="Connect a Bank", products=null, itemId=null, style={} }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const fetchToken = useCallback(async () => {
    setLoading(true); setError(null);
    try { const { link_token } = await api.createLinkToken(products, itemId); setLinkToken(link_token); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [products, itemId]);
  const { open, ready } = usePlaidLink({ token:linkToken, onSuccess:(pt,meta)=>onSuccess(pt,meta?.institution?.name), onExit });
  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);
  return (
    <div>
      <button style={{...S.btn("primary"), ...style}} onClick={fetchToken} disabled={loading}>{loading?"…":label}</button>
      {error && <div style={{marginTop:8,fontSize:12,color:"var(--red)"}}>{error}</div>}
    </div>
  );
}



function isAuthValid() {
  try {
    const token = api.getToken();
    if (!token || !api.getStoredUser()) return false;
    // Decode the JWT payload (base64url middle section) to check expiry
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return false;
    // exp is in seconds, Date.now() is in ms
    if (Date.now() >= payload.exp * 1000) {
      api.clearToken(); // clean up expired token
      return false;
    }
    return true;
  } catch { return false; }
}

function AuthGate({ onAuth, inviteToken = null }) {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const resetToken = new URLSearchParams(window.location.search).get("reset");

  // Invite flow state
  const [inviteStatus, setInviteStatus] = useState(inviteToken ? "loading" : "none");
  const [inviteEmail2, setInviteEmail2] = useState("");
  useEffect(() => {
    if (!inviteToken) return;
    api.checkHouseholdInvite(inviteToken)
      .then(d => {
        if (!d || d.error) { setInviteStatus("error"); return; }
        setInviteEmail2(d.email || "");
        setEmail(d.email || "");
        setInviteStatus("ready");
      })
      .catch(() => setInviteStatus("error"));
  }, [inviteToken]);

  async function acceptAfterAuth() {
    try {
      await api.acceptHouseholdInvite(inviteToken);
      window.history.replaceState({}, "", window.location.pathname);
    } catch(e) { console.error("Failed to accept invite:", e); }
  }

  // step: "email" | "password" | "register" | "forgot" | "reset"
  const [step,          setStep]          = useState(resetToken ? "reset" : "email");
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [confirm,       setConfirm]       = useState("");
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState("");
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [shake,         setShake]         = useState(false);
  const [agreedTerms,   setAgreedTerms]   = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [legalModal,    setLegalModal]    = useState(null);
  const googleBtnRef = useRef(null);
  const googleCbRef  = useRef(null);

  function triggerShake(msg) {
    setError(msg); setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  async function handleGoogleCallback(response) {
    setGoogleLoading(true);
    setError("");
    try {
      await api.googleAuth(response.credential);
      onAuth();
    } catch(err) {
      triggerShake(err.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }
  googleCbRef.current = handleGoogleCallback;

  // Initialize Google Identity Services button
  useEffect(() => {
    if (!window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (r) => googleCbRef.current(r),
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: googleBtnRef.current?.offsetWidth || 300,
    });
  }, [step]);

  async function handleEmailContinue(e) {
    e.preventDefault();
    if (!email.trim()) return triggerShake("Email required");
    setLoading(true);
    setError("");
    try {
      // Check if account exists
      const { exists } = await api.checkEmail(email);
      setStep(exists ? "password" : "register");
    } catch {
      setStep("password");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (step === "forgot") {
      if (!email) return triggerShake("Email required");
      setLoading(true);
      try {
        await fetch((import.meta.env.VITE_API_URL || "") + "/api/auth/forgot-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setSuccess("If that email is registered, you'll receive a reset link shortly.");
      } catch { setSuccess("Check your email for a reset link."); }
      finally { setLoading(false); }
      return;
    }

    if (step === "reset") {
      if (!password) return triggerShake("Password required");
      if (password.length < 8) return triggerShake("Password must be at least 8 characters");
      if (password !== confirm) return triggerShake("Passwords do not match");
      setLoading(true);
      try {
        const r = await fetch((import.meta.env.VITE_API_URL || "") + "/api/auth/reset-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, newPassword: password }),
        });
        const d = await r.json();
        if (!r.ok) return triggerShake(d.error || "Reset failed");
        window.history.replaceState({}, "", window.location.pathname);
        setSuccess("Password updated! You can now sign in.");
        setTimeout(() => setStep("email"), 1500);
      } catch { triggerShake("Reset failed. Please try again."); }
      finally { setLoading(false); }
      return;
    }

    if (step === "register") {
      if (password !== confirm) return triggerShake("Passwords do not match");
      if (password.length < 8) return triggerShake("Password must be at least 8 characters");
      if (!agreedTerms || !agreedPrivacy) return triggerShake("Please agree to the Terms of Service and Privacy Policy");
    }

    setLoading(true);
    try {
      if (step === "password") await api.login(email, password);
      else                     await api.register(email, password);
      if (inviteToken && inviteStatus === "ready") await acceptAfterAuth();
      onAuth();
    } catch(err) {
      triggerShake(err.message || "Something went wrong");
      setPassword(""); setConfirm("");
    } finally { setLoading(false); }
  }

  function inputStyle(hasError = false) {
    return {
      background: "var(--surface)",
      border: `1px solid ${hasError ? "var(--red)" : "var(--border2)"}`,
      borderRadius: "var(--radius)", padding: "11px 14px",
      fontSize: 14, color: "var(--t1)", outline: "none", width: "100%",
      transition: "border-color 0.15s",
    };
  }

  const showEmailStep  = step === "email";
  const showPassStep   = step === "password" || step === "register";
  const showGoogleBtn  = step === "email" || step === "password" || step === "register";
  const isForgotReset  = step === "forgot" || step === "reset";

  const headingMap = {
    email:    ["Welcome", "back"],
    password: ["Welcome", "back"],
    register: ["Create your", "account"],
    forgot:   ["Forgot your", "password?"],
    reset:    ["Reset your", "password"],
  };
  const [h1, h2] = headingMap[step] || ["Welcome", "back"];

  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      height:"100vh", background:"var(--bg)", flexDirection:"column", gap:24,
      fontFamily:"var(--font-body)",
    }}>
      {/* Logo */}
      <div>
        <div style={{fontFamily:"'Syne', sans-serif",fontSize:36,fontWeight:800,letterSpacing:"-1px",color:"var(--t1)",textAlign:"center"}}>
          ledgr<span style={{color:"var(--cyan)"}}>.</span>
        </div>
        <div style={{fontSize:13,color:"var(--t3)",textAlign:"center",marginTop:4}}>personal finance</div>
      </div>

      {/* Card */}
      <div className={shake?"shake":""} style={{
        background:"var(--card)", border:"none",
        borderRadius:"var(--radius-lg)", padding:"32px 28px",
        width:360, maxWidth:"92vw",
        boxShadow:"0 8px 40px #00000060",
        display:"flex", flexDirection:"column", gap:0,
      }}>

        {/* Invite banner */}
        {inviteToken && inviteStatus === "ready" && (
          <div style={{background:"var(--cyan-dim)",border:"1px solid var(--cyan)33",borderRadius:8,padding:"10px 12px",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--cyan)",marginBottom:2}}>Household Invite</div>
            <div style={{fontSize:12,color:"var(--t2)"}}>Sign in or create an account to join the household.</div>
          </div>
        )}
        {inviteToken && inviteStatus === "error" && (
          <div style={{background:"#ff4d6d11",border:"1px solid #ff4d6d33",borderRadius:8,padding:"10px 12px",marginBottom:16}}>
            <div style={{fontSize:12,color:"var(--red)"}}>This invite link is invalid or has expired.</div>
          </div>
        )}

        {/* Tab switcher — email and password/register steps */}
        {!isForgotReset && (showEmailStep || showPassStep) && (
          <div style={{display:"flex",gap:0,marginBottom:24,background:"var(--surface)",borderRadius:"var(--radius)",padding:3}}>
            {["Sign In","Create Account"].map((label, i) => {
              const isActive = i === 0 ? (step==="email"||step==="password") : step==="register";
              return (
                <button key={label} onClick={()=>{ if(i===0){setStep("email");}else{setStep("register");} setError(""); }} style={{
                  flex:1, padding:"7px 0", borderRadius:"var(--radius)",
                  fontSize:13, fontWeight:600, cursor:"pointer", border:"none",
                  background: isActive ? "var(--cyan)" : "transparent",
                  color: isActive ? "#000" : "var(--t3)",
                  boxShadow: isActive ? "0 1px 4px #00000030" : "none",
                  transition:"all 0.15s",
                }}>{label}</button>
              );
            })}
          </div>
        )}

        {/* Forgot/reset header */}
        {isForgotReset && (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:16,fontWeight:700,color:"var(--t1)",marginBottom:4}}>
              {step === "forgot" ? "Forgot password" : "Reset password"}
            </div>
            <div style={{fontSize:13,color:"var(--t3)"}}>
              {step === "forgot" ? "Enter your email and we'll send you a reset link." : "Enter your new password below."}
            </div>
          </div>
        )}

        {/* Google button — shown on all non-forgot/reset steps */}
        {showGoogleBtn && (
          <>
            <div ref={googleBtnRef} style={{width:"100%",marginBottom:4,minHeight:44,overflow:"hidden",borderRadius:"var(--radius)"}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,margin:"16px 0"}}>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
              <span style={{fontSize:11,color:"var(--t3)",letterSpacing:"0.5px"}}>OR</span>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
            </div>
          </>
        )}

        {/* Email step */}
        {showEmailStep && (
          <form onSubmit={handleEmailContinue} style={{display:"flex",flexDirection:"column",gap:10}}>
            <input type="email" placeholder="Email address" value={email} autoFocus
              onChange={e=>{setEmail(e.target.value);setError("");}}
              style={inputStyle(!!error&&!password)}/>
            {error && <div style={{fontSize:12,color:"var(--red)"}}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              marginTop:4, background:"var(--cyan)", color:"#000", border:"none",
              borderRadius:"var(--radius)", padding:"10px 16px",
              fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
              opacity:loading?0.7:1, transition:"opacity 0.15s",
            }}>
              {loading ? "…" : "Continue"}
            </button>
          </form>
        )}

        {/* Password step (sign in) */}
        {step === "password" && (
          <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:12,color:"var(--t3)",marginBottom:2}}>
              Signing in as <span style={{color:"var(--cyan)"}}>{email}</span>{" "}
              <button type="button" onClick={()=>{setStep("email");setError("");}}
                style={{background:"none",border:"none",color:"var(--t3)",cursor:"pointer",fontSize:12,textDecoration:"underline",padding:0}}>change</button>
            </div>
            <input type="password" placeholder="Password" value={password} autoFocus
              onChange={e=>{setPassword(e.target.value);setError("");}}
              style={inputStyle(!!error)}/>
            {error && <div style={{fontSize:12,color:"var(--red)"}}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              marginTop:4, background:"var(--cyan)", color:"#000", border:"none",
              borderRadius:"var(--radius)", padding:"10px 16px",
              fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
              opacity:loading?0.7:1, transition:"opacity 0.15s",
            }}>
              {loading ? "…" : "Sign In"}
            </button>
            <button type="button" onClick={()=>{setStep("forgot");setError("");}}
              style={{fontSize:12,color:"var(--t3)",background:"none",border:"none",cursor:"pointer",textAlign:"center"}}>
              Forgot your password?
            </button>
          </form>
        )}

        {/* Register step */}
        {step === "register" && (
          <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:10}}>
            <input type="email" placeholder="Email address" value={email} autoFocus
              onChange={e=>{setEmail(e.target.value);setError("");}}
              style={inputStyle(!!error&&!password)}/>
            <input type="password" placeholder="Password" value={password}
              onChange={e=>{setPassword(e.target.value);setError("");}}
              style={inputStyle(!!error)}/>
            <input type="password" placeholder="Confirm password" value={confirm}
              onChange={e=>{setConfirm(e.target.value);setError("");}}
              style={inputStyle(!!error&&confirm!==password)}/>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
              {[
                {checked:agreedTerms,   set:setAgreedTerms,   doc:"terms",   label:"Terms of Service"},
                {checked:agreedPrivacy, set:setAgreedPrivacy, doc:"privacy", label:"Privacy Policy"},
              ].map(({checked,set,doc,label})=>(
                <label key={doc} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:12,color:"var(--t2)"}}>
                  <input type="checkbox" checked={checked} onChange={e=>set(e.target.checked)}
                    style={{width:15,height:15,accentColor:"var(--cyan)",flexShrink:0,cursor:"pointer"}}/>
                  I agree to the{" "}
                  <button type="button" onClick={()=>setLegalModal(doc)}
                    style={{background:"none",border:"none",padding:0,color:"var(--cyan)",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>
                    {label}
                  </button>
                </label>
              ))}
            </div>
            {error   && <div style={{fontSize:12,color:"var(--red)"}}>{error}</div>}
            {success && <div style={{fontSize:12,color:"var(--green)"}}>{success}</div>}
            <button type="submit" disabled={loading} style={{
              marginTop:4, background:"var(--cyan)", color:"#000", border:"none",
              borderRadius:"var(--radius)", padding:"10px 16px",
              fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
              opacity:loading?0.7:1, transition:"opacity 0.15s",
            }}>
              {loading ? "…" : "Create Account"}
            </button>
          </form>
        )}

        {/* Forgot / Reset */}
        {isForgotReset && (
          <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:10}}>
            {step === "forgot" && (
              <input type="email" placeholder="Email address" value={email} autoFocus
                onChange={e=>{setEmail(e.target.value);setError("");}}
                style={inputStyle(!!error)}/>
            )}
            {step === "reset" && (<>
              <input type="password" placeholder="New password" value={password} autoFocus
                onChange={e=>{setPassword(e.target.value);setError("");}}
                style={inputStyle(!!error)}/>
              <input type="password" placeholder="Confirm password" value={confirm}
                onChange={e=>{setConfirm(e.target.value);setError("");}}
                style={inputStyle(!!error&&confirm!==password)}/>
            </>)}
            {error   && <div style={{fontSize:12,color:"var(--red)"}}>{error}</div>}
            {success && <div style={{fontSize:12,color:"var(--green)"}}>{success}</div>}
            <button type="submit" disabled={loading} style={{
              marginTop:4, background:"var(--cyan)", color:"#000", border:"none",
              borderRadius:"var(--radius)", padding:"10px 16px",
              fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
              opacity:loading?0.7:1, transition:"opacity 0.15s",
            }}>
              {loading ? "…" : step==="forgot" ? "Send Reset Link" : "Reset Password"}
            </button>
            <button type="button" onClick={()=>{setStep("email");setError("");setSuccess("");}}
              style={{fontSize:12,color:"var(--t3)",background:"none",border:"none",cursor:"pointer",textAlign:"center"}}>
              → Back to sign in
            </button>
          </form>
        )}

        {/* Footer links */}
        <div style={{marginTop:20,textAlign:"center",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{display:"flex",justifyContent:"center",gap:16}}>
            <button onClick={()=>setLegalModal("privacy")}
              style={{fontSize:11,color:"var(--t3)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
              Privacy Policy
            </button>
            <button onClick={()=>setLegalModal("terms")}
              style={{fontSize:11,color:"var(--t3)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
              Terms of Service
            </button>
          </div>
        </div>
      </div>

      {step === "register" && <SecurityBadges />}

      {/* Legal modal */}
      {legalModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setLegalModal(null)}>
          <div style={{background:"var(--card)",borderRadius:12,padding:"28px 24px",width:640,maxWidth:"92vw",maxHeight:"82vh",display:"flex",flexDirection:"column"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexShrink:0}}>
              <div style={{fontSize:18,fontWeight:700,color:"var(--t1)"}}>
                {legalModal === "privacy" ? "Privacy Policy" : "Terms of Service"}
              </div>
              <button onClick={()=>setLegalModal(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:20}}>✕</button>
            </div>
            <div style={{overflowY:"auto",flex:1,fontSize:13,color:"var(--t2)",lineHeight:1.7}}>
              {legalModal === "privacy" ? <PrivacyPolicy /> : <TermsOfService />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function App() {
  // Wake up the Railway backend immediately on load to minimize cold start delay
  useEffect(() => {
    fetch((import.meta.env.VITE_API_URL || "") + "/api/health").catch(() => {});
  }, []);

  useEffect(() => {
    if (openDuplicatesOnLoad) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);


  const isDemo = new URLSearchParams(window.location.search).get("demo") === "true";
  const openDuplicatesOnLoad = new URLSearchParams(window.location.search).get("openDuplicates") === "true";

  const [authed, setAuthed] = useState(() => isDemo || isAuthValid());

  // Periodically check if token has expired mid-session
  useEffect(() => {
    if (isDemo) return;
    const interval = setInterval(() => {
      if (!isAuthValid()) setAuthed(false);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [isDemo]);

  // Detect invite token at App level and pass to AuthGate
  const appInviteToken = (() => {
    const t = new URLSearchParams(window.location.search).get("invite");
    return t && /^[a-f0-9]{64}$/.test(t) ? t : null;
  })();

  if (!authed) return <AuthGate onAuth={()=>setAuthed(true)} inviteToken={appInviteToken}/>;

  return <AppInner isDemo={isDemo}/>;
}

/* ✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓
   SETTINGS VIEW
✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓ */
function Paywall({ onUpgrade }) {
  const [loading, setLoading] = useState(false);
  const user = api.getStoredUser();
  const trialEnded = user?.subscription_status === "trialing"
    ? Date.now() >= (user?.trial_ends_at || 0)
    : user?.subscription_status !== "active";

  async function handleUpgrade() {
    setLoading(true);
    try { await api.startCheckout(); }
    catch (e) { setLoading(false); }
  }

  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      minHeight:"60vh", padding:"40px 24px", textAlign:"center",
    }}>
      <div style={{ fontSize:40, marginBottom:16 }}>\U0001F514</div>
      <div style={{ fontFamily:"var(--font-disp)", fontSize:24, fontWeight:800, color:"var(--t1)", marginBottom:8 }}>
        {trialEnded ? "Your trial has ended" : "Upgrade to continue"}
      </div>
      <div style={{ fontSize:14, color:"var(--t3)", maxWidth:360, marginBottom:32, lineHeight:1.6 }}>
        {trialEnded
          ? "Your 7-day free trial has ended. Subscribe to continue tracking your finances and connecting bank accounts."
          : "Subscribe to unlock full access — add transactions, connect banks, and sync automatically."}
      </div>

      <div style={{
        background:"var(--card)", border:"none",
        borderRadius:"var(--radius-lg)", padding:"28px 32px",
        width:"100%", maxWidth:320, marginBottom:24,
        boxShadow:"0 4px 24px #00000040",
      }}>
        <div style={{ fontSize:13, color:"var(--t3)", marginBottom:4, textTransform:"uppercase", letterSpacing:"1px", fontWeight:600 }}>
          Ledgr Pro
        </div>
        <div style={{ display:"flex", alignItems:"baseline", gap:4, justifyContent:"center", marginBottom:8 }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:40, fontWeight:800, color:"var(--t1)" }}>$4.99</span>
          <span style={{ fontSize:14, color:"var(--t3)" }}>/month</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24, textAlign:"left" }}>
          {["Unlimited transactions", "Connect bank accounts via Plaid", "Auto-sync every 4 hours", "Budget tracking & categories", "Recurring calendar", "CSV export"].map(f => (
            <div key={f} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, color:"var(--t2)" }}>
              <span style={{ color:"var(--cyan)", flexShrink:0 }}>✓</span> {f}
            </div>
          ))}
        </div>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          style={{
            width:"100%", padding:"12px 0",
            background:"var(--cyan)", color:"#000",
            border:"none", borderRadius:"var(--radius)",
            fontSize:15, fontWeight:700, cursor:loading?"wait":"pointer",
            opacity:loading?0.7:1, transition:"opacity 0.15s",
          }}>
          {loading ? "Redirecting…" : "Subscribe — $4.99/mo"}
        </button>
      </div>

      <button
        onClick={() => { api.logout().then(() => window.location.reload()); }}
        style={{ fontSize:12, color:"var(--t3)", background:"none", border:"none", cursor:"pointer" }}>
        Sign out
      </button>
    </div>
  );
}



/* ── Settings helpers ─────────────────────────────────────────── */
function SettingsSection({ title, children }) {
  return (
    <div style={{ marginBottom:0 }}>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:9, textTransform:"uppercase",
        letterSpacing:"1.2px", color:"rgba(201,149,106,0.45)", marginBottom:12 }}>{title}</div>
      {children}
    </div>
  );
}

function SettingRow({ label, hint, children, danger }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      gap:16, padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", flexWrap:"wrap" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color: danger ? "var(--red)" : "var(--t1)", fontWeight:500 }}>{label}</div>
        {hint && <div style={{ fontSize:11, color:"var(--t3)", marginTop:2, lineHeight:1.5 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink:0 }}>{children}</div>
    </div>
  );
}

function SettingsView({ transactions, accounts, categories, catMap, acctMap, avatarColor, avatarLetter, showToast, setTransactions, setAccounts, setCategories, setRules, setPlaidItems, plaidItems, access, userProfile, onSaveProfile, theme = {}, onSaveTheme, deletedTransactions, setDeletedTransactions, showTrash, setShowTrash, scheduleSaveRef, isFamilyPlan = false, isMobile = false, settingsTab = "profile", setSettingsTab = () => {} }) {
  const user = api.getStoredUser();
  const [name,       setName]       = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [currPw,     setCurrPw]     = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [pwError,    setPwError]    = useState("");
  const [pwSuccess,  setPwSuccess]  = useState(false);
  const [savingPw,   setSavingPw]   = useState(false);
  const [legalDoc,   setLegalDoc]   = useState(null);
  const [household,      setHousehold]      = useState(null);
  const [householdLoaded, setHouseholdLoaded] = useState(false);
  const [inviteEmail,    setInviteEmail]    = useState("");
  const [inviting,       setInviting]       = useState(false);
  const [profileForm, setProfileForm] = useState(null);
  const [saveThemeName, setSaveThemeName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    api.getHousehold().then(d => { setHousehold(d?.household || null); setHouseholdLoaded(true); }).catch(() => setHouseholdLoaded(true));
  }, []);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try { await api.inviteToHousehold(inviteEmail.trim()); showToast("Invite sent!"); setInviteEmail(""); const d = await api.getHousehold(); setHousehold(d?.household || null); }
    catch(e) { showToast(e.message || "Failed to send invite"); }
    finally { setInviting(false); }
  }
  async function removeMember(memberId) {
    try { await api.removeHouseholdMember(memberId); const d = await api.getHousehold(); setHousehold(d?.household || null); showToast("Member removed"); }
    catch { showToast("Failed to remove member"); }
  }
  async function leaveHousehold() {
    try { await api.leaveHousehold(); setHousehold(null); showToast("Left household"); }
    catch { showToast("Failed to leave"); }
  }
  async function saveName() {
    if (!name.trim()) return;
    setSavingName(true);
    try { await api.updateProfile(name.trim()); api.setStoredUser({ ...user, name: name.trim() }); showToast("Name saved"); }
    catch { showToast("Failed to save name"); }
    finally { setSavingName(false); }
  }
  async function changePassword() {
    setPwError(""); setPwSuccess(false);
    if (!currPw || !newPw) return setPwError("All fields required");
    if (newPw.length < 8)  return setPwError("New password must be at least 8 characters");
    if (newPw !== confirmPw) return setPwError("Passwords do not match");
    setSavingPw(true);
    try { await api.changePassword(currPw, newPw); setPwSuccess(true); setCurrPw(""); setNewPw(""); setConfirmPw(""); showToast("Password updated"); }
    catch(e) { setPwError(e.message || "Failed to update password"); }
    finally { setSavingPw(false); }
  }
  function exportCSV() {
    const headers = ["Date","Name","Merchant","Amount","Type","Category","Account","Recurring"];
    const rows = transactions.map(t => [t.date||"",t.name||"",t.merchant||"",t.amount??"",t.type||"",catMap[t.categoryId]?.name||"",acctMap[t.accountId]?.name||"",t.recurring?"Yes":"No"]);
    const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`ledgr-export-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url); showToast("Export downloaded");
  }
  function deleteAllTransactions() {
    if (!transactions.length) { showToast("No transactions to delete"); return; }
    if (!window.confirm(`Delete all ${transactions.length} transactions? This cannot be undone.`)) return;
    setTransactions([]); api.deleteAllTransactions().catch(console.error); showToast("All transactions deleted");
  }
  async function clearAllData() {
    if (!window.confirm("Clear ALL data? This will delete all transactions, accounts, categories, rules, and bank connections. This cannot be undone.")) return;
    for (const item of plaidItems||[]) { try { await api.deleteItem(item.item_id); } catch {} }
    setTransactions([]); setAccounts([]); setCategories([]); setRules([]); setPlaidItems([]);
    await Promise.all([api.deleteAllTransactions(),api.deleteAllAccountsApi(),api.deleteAllRulesApi(),api.saveData({categories:[],plaidItems:[]})]);
    showToast("All data cleared");
  }

  // ── Theme data ──
  const PRESETS = [
    { name:"Obsidian",  bg:"#0b0a08", surface:"#1a1612", card:"#181511", accent:"#c9956a", t1:"#e8ddd0", t2:"rgba(232,221,208,0.55)", t3:"rgba(232,221,208,0.3)" },
    { name:"Midnight",  bg:"#09090f", surface:"#111120", card:"#18181e", accent:"#a78bfa", t1:"#e8e8ff", t2:"rgba(232,232,255,0.5)",  t3:"rgba(232,232,255,0.3)" },
    { name:"Ledgr Dark",bg:"#060a0f", surface:"#0d1520", card:"#111a28", accent:"#00d4ff", t1:"#daeaf8", t2:"rgba(218,234,248,0.5)",  t3:"rgba(218,234,248,0.3)" },
    { name:"Deep Green",bg:"#050f08", surface:"#0a1c0e", card:"#0e2414", accent:"#4ade80", t1:"#d4f0df", t2:"rgba(212,240,223,0.5)",  t3:"rgba(212,240,223,0.3)" },
    { name:"Ember",     bg:"#100600", surface:"#1c0e00", card:"#241400", accent:"#fb923c", t1:"#f5e4d0", t2:"rgba(245,228,208,0.5)",  t3:"rgba(245,228,208,0.3)" },
    { name:"Rose",      bg:"#0f0608", surface:"#1c0c12", card:"#241018", accent:"#f472b6", t1:"#f5d8e8", t2:"rgba(245,216,232,0.5)",  t3:"rgba(245,216,232,0.3)" },
    { name:"Slate",     bg:"#080c10", surface:"#101820", card:"#16222c", accent:"#60a5fa", t1:"#dce8f8", t2:"rgba(220,232,248,0.5)",  t3:"rgba(220,232,248,0.3)" },
    { name:"Ocean",     bg:"#020c14", surface:"#041a2a", card:"#062238", accent:"#38bdf8", t1:"#d8f0ff", t2:"rgba(216,240,255,0.5)",  t3:"rgba(216,240,255,0.3)" },
    { name:"Crimson",   bg:"#0f0206", surface:"#1a060c", card:"#220a12", accent:"#f87171", t1:"#fde8e8", t2:"rgba(253,232,232,0.5)",  t3:"rgba(253,232,232,0.3)" },
    { name:"Dusk",      bg:"#090610", surface:"#100e1c", card:"#161428", accent:"#f59e0b", t1:"#f0e8ff", t2:"rgba(240,232,255,0.5)",  t3:"rgba(240,232,255,0.3)" },
    { name:"Arctic",    bg:"#06101a", surface:"#0e1e2e", card:"#142640", accent:"#67e8f9", t1:"#e0f8ff", t2:"rgba(224,248,255,0.5)",  t3:"rgba(224,248,255,0.3)" },
    { name:"Graphite",  bg:"#0a0a0a", surface:"#141414", card:"#1c1c1c", accent:"#e2e8f0", t1:"#f1f5f9", t2:"rgba(241,245,249,0.5)",  t3:"rgba(241,245,249,0.28)" },
    { name:"Copper",    bg:"#0c0806", surface:"#1a1008", card:"#221608", accent:"#d97706", t1:"#fef3c7", t2:"rgba(254,243,199,0.5)",  t3:"rgba(254,243,199,0.3)" },
    { name:"Forest",    bg:"#050a06", surface:"#0a1a0c", card:"#0d2410", accent:"#86efac", t1:"#dcfce7", t2:"rgba(220,252,231,0.5)",  t3:"rgba(220,252,231,0.3)" },
    { name:"Violet",    bg:"#08060f", surface:"#120e20", card:"#1a1430", accent:"#c084fc", t1:"#f3e8ff", t2:"rgba(243,232,255,0.5)",  t3:"rgba(243,232,255,0.3)" },
    { name:"Gold",      bg:"#0e0b00", surface:"#1c1600", card:"#261e00", accent:"#fbbf24", t1:"#fffbeb", t2:"rgba(255,251,235,0.5)",  t3:"rgba(255,251,235,0.28)" },
    { name:"Steel",     bg:"#070a0e", surface:"#0f151e", card:"#16202e", accent:"#94a3b8", t1:"#e2e8f0", t2:"rgba(226,232,240,0.5)",  t3:"rgba(226,232,240,0.28)" },
    { name:"Teal",      bg:"#040e0e", surface:"#081c1c", card:"#0c2626", accent:"#2dd4bf", t1:"#ccfbf1", t2:"rgba(204,251,241,0.5)",  t3:"rgba(204,251,241,0.3)" },
    { name:"Sakura",    bg:"#100810", surface:"#1e0e1e", card:"#2a1228", accent:"#fb7185", t1:"#ffe4e6", t2:"rgba(255,228,230,0.5)",  t3:"rgba(255,228,230,0.3)" },
    { name:"Noir",      bg:"#050505", surface:"#0f0f0f", card:"#181818", accent:"#facc15", t1:"#fafafa", t2:"rgba(250,250,250,0.45)", t3:"rgba(250,250,250,0.25)" },
  ];
  const FONTS = [
    { label:"Syne (default)",   value:"'Syne', sans-serif" },
    { label:"DM Sans",          value:"'DM Sans', sans-serif" },
    { label:"Dancing Script",   value:"'Dancing Script', cursive" },
    { label:"JetBrains Mono",   value:"'JetBrains Mono', monospace" },
    { label:"Georgia",          value:"'Georgia', serif" },
    { label:"Trebuchet MS",     value:"'Trebuchet MS', sans-serif" },
  ];
  const VARS = [
    { key:"bg",             label:"Background" },
    { key:"surface",        label:"Surface" },
    { key:"card",           label:"Card" },
    { key:"accent",         label:"Accent" },
    { key:"t1",             label:"Text primary" },
    { key:"t2",             label:"Text secondary" },
    { key:"t3",             label:"Text muted" },
    { key:"reviewColor",    label:"Review stripe" },
    { key:"recurringColor", label:"Recurring stripe" },
  ];
  const defaults = PRESETS[0];
  const current = { ...defaults, fontDisp:"'Syne', sans-serif", reviewColor:"#00d4ff", recurringColor:"#fbbf24", ...(theme||{}) };
  const gradSteps     = current.gradSteps ?? 6;
  const gradAngle     = current.gradAngle ?? 315;
  const globalOpacity = current.globalOpacity ?? 100;
  const savedThemes   = current._savedThemes || [];

  function patch(k, v) { onSaveTheme({ ...current, [k]: v }); }
  function patchGradSteps(steps) {
    const hex2rgb = h => { const v=h.replace("#",""); return [parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16)]; };
    const rgb2hex = ([r,g,b]) => "#"+[r,g,b].map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0")).join("");
    const hi = rgb2hex(hex2rgb(current.card||"#181511").map(c=>c+steps));
    document.documentElement.style.setProperty("--card-hi", hi);
    patch("gradSteps", steps);
  }
  function patchGradAngle(angle) { document.documentElement.style.setProperty("--grad-angle", angle+"deg"); patch("gradAngle", angle); }
  function patchGlobalOpacity(val) { applyGlobalOpacity(val, current); patch("globalOpacity", val); }
  function applyPreset(preset) { onSaveTheme({ ...current, ...preset }); }
  function saveCurrentTheme() {
    if (!saveThemeName.trim()) return;
    const { _savedThemes: _, ...themeData } = current;
    const entry = { ...themeData, name: saveThemeName.trim() };
    const next = [...savedThemes.filter(t=>t.name!==entry.name), entry];
    patch("_savedThemes", next); setSaveThemeName(""); setShowSaveInput(false); showToast("Theme saved: "+entry.name);
  }
  function deleteCustomTheme(name) { patch("_savedThemes", savedThemes.filter(t=>t.name!==name)); }
  function reset() {
    ["--bg","--surface","--card","--border","--border2","--cyan","--cyan-dim","--t1","--t2","--t3","--font-disp"].forEach(v=>document.documentElement.style.removeProperty(v));
    document.body.style.removeProperty("background"); document.body.style.removeProperty("background-image"); document.body.style.removeProperty("background-color");
    document.documentElement.classList.remove("ledgr-has-bgimage");
    try { localStorage.removeItem("ledgr_theme"); } catch {}
    onSaveTheme({});
  }

  const inputSt = { ...S.input, marginBottom:0 };
  const STABS = [
    { id:"profile",      label:"Profile",      icon:"◈" },
    { id:"appearance",   label:"Appearance",   icon:"◑" },
    { id:"household",    label:"Household",    icon:"⬡" },
    { id:"data",         label:"Data",         icon:"⊟" },
    { id:"subscription", label:"Subscription", icon:"◆" },
  ];

  const Section = ({ title, children }) => (
    <div style={{ paddingBottom:28, marginBottom:28, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
      <SettingsSection title={title}>{children}</SettingsSection>
    </div>
  );

  return (
    <>
    {/* ── Page header ── */}
    <div style={{ position:"relative", overflow:"hidden",
      background:"radial-gradient(ellipse 55% 80% at 0% 40%,rgba(201,149,106,0.04) 0%,transparent 65%),var(--bg,#0b0a08)",
      borderBottom:"1px solid rgba(0,0,0,0.35)" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1,
        background:"linear-gradient(90deg,rgba(201,149,106,0.14),rgba(255,255,255,0.04) 35%,transparent 75%)" }}/>
      {!isMobile && <div style={{ position:"absolute", fontFamily:"'Playfair Display',serif", fontStyle:"italic",
        fontSize:80, fontWeight:500, color:"rgba(201,149,106,0.06)", top:"50%", transform:"translateY(-50%)",
        left:6, lineHeight:1, pointerEvents:"none", userSelect:"none" }}>IV</div>}
      <div style={{ padding:"14px 28px 0", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:12, paddingBottom:12,
          borderBottom:"1px solid rgba(201,149,106,0.12)" }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600,
            color:"rgba(201,149,106,0.45)", letterSpacing:"1px" }}>IV ·</span>
          <span style={{ fontFamily:"'Playfair Display',serif", fontStyle:"italic",
            fontWeight:400, fontSize:20, color:"var(--t1)" }}>Settings</span>
          <div style={{ flex:1, height:1, background:"linear-gradient(90deg,rgba(201,149,106,0.12),transparent)" }}/>
          <div style={{ width:28, height:28, borderRadius:"50%", background:avatarColor+"22",
            border:`1.5px solid ${avatarColor}`, display:"flex", alignItems:"center",
            justifyContent:"center", fontFamily:"var(--font-disp)", fontSize:12,
            fontWeight:800, color:avatarColor }}>{avatarLetter}</div>
        </div>
        <div style={{ display:"flex", gap:0, ...(isMobile?{overflowX:"auto",scrollbarWidth:"none"}:{}) }}>
          {STABS.map(t => (
            <button key={t.id} onClick={()=>setSettingsTab(t.id)} style={{
              padding:"10px 16px", fontSize:11, cursor:"pointer", border:"none",
              background:"transparent", color:settingsTab===t.id?"var(--cyan)":"var(--t3)",
              fontFamily:"var(--font-body)", display:"flex", alignItems:"center", gap:6,
              borderBottom:settingsTab===t.id?"2px solid var(--cyan)":"2px solid transparent",
              transition:"all .15s", marginBottom:-1, flexShrink:0,
              ...(isMobile?{flex:1,padding:"10px 8px",fontSize:10,justifyContent:"center"}:{}),
            }}>
              {!isMobile && <span style={{ fontSize:9, opacity:0.5 }}>{t.icon}</span>}
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* ── Tab content ── */}
    <div style={{ maxWidth:640, padding:"28px 28px" }}>
      <div key={settingsTab} className="ledgr-panel-in">

      {/* ══ PROFILE ═══════════════════════════════════════════ */}
      {settingsTab === "profile" && <>
        <Section title="Identity">
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
            <div style={{ width:52, height:52, borderRadius:"50%", flexShrink:0,
              background:avatarColor+"22", border:`2px solid ${avatarColor}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"var(--font-disp)", fontSize:22, fontWeight:800, color:avatarColor }}>
              {avatarLetter}
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)" }}>{user?.name || user?.email}</div>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{user?.email}</div>
              {user?.role === "owner" && (
                <div style={{ marginTop:5, display:"inline-flex", alignItems:"center", gap:5,
                  background:"rgba(201,149,106,0.1)", border:"1px solid rgba(201,149,106,0.25)",
                  borderRadius:99, padding:"2px 9px", fontSize:9, fontWeight:700,
                  color:"var(--cyan)", letterSpacing:"0.5px" }}>◈ OWNER</div>
              )}
            </div>
          </div>
          <SettingRow label="Display name" hint="Shown in the app header">
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...inputSt, width:180 }} placeholder="Your name"
                value={name} onChange={e=>setName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&saveName()} />
              <button style={S.btn("primary",true)} onClick={saveName} disabled={savingName}>
                {savingName?"…":"Save"}
              </button>
            </div>
          </SettingRow>
        </Section>

        <Section title="Security">
          <div style={{ display:"flex", flexDirection:"column", gap:10, maxWidth:360 }}>
            {[["Current password","password",currPw,v=>{setCurrPw(v);setPwError("");setPwSuccess(false);},"••••••••"],
              ["New password","password",newPw,v=>{setNewPw(v);setPwError("");setPwSuccess(false);},"Min. 8 characters"],
              ["Confirm new password","password",confirmPw,v=>{setConfirmPw(v);setPwError("");setPwSuccess(false);},"••••••••"]
            ].map(([label,type,val,fn,ph])=>(
              <div key={label}>
                <div style={{ fontSize:11, color:"var(--t3)", marginBottom:5 }}>{label}</div>
                <input style={inputSt} type={type} placeholder={ph} value={val} onChange={e=>fn(e.target.value)} />
              </div>
            ))}
            {pwError   && <div style={{ fontSize:12, color:"var(--red)" }}>{pwError}</div>}
            {pwSuccess && <div style={{ fontSize:12, color:"var(--green)" }}>Password updated ✓</div>}
            <button style={{ ...S.btn("primary"), alignSelf:"flex-start" }} onClick={changePassword} disabled={savingPw}>
              {savingPw?"Updating…":"Update password"}
            </button>
          </div>
        </Section>

        <Section title="Financial Profile">
          {profileForm ? (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <div style={{ fontSize:11, color:"var(--t3)", marginBottom:6 }}>Monthly income (after tax)</div>
                <input type="number" style={{ ...inputSt, maxWidth:200 }} placeholder="0"
                  value={profileForm.monthlyIncome||""} onChange={e=>setProfileForm(p=>({...p,monthlyIncome:parseFloat(e.target.value)||0}))} />
              </div>
              <div>
                <div style={{ fontSize:11, color:"var(--t3)", marginBottom:8 }}>Targets</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[["savingsGoal","Monthly savings goal"],["emergencyFund","Emergency fund"],["netWorthTarget","Net worth target"],["retirementTargetAmount","Retirement nest egg"],["retirementAge","Retirement age"]].map(([k,l])=>(
                    <div key={k}>
                      <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>{l}</div>
                      <input type="number" style={{ ...inputSt, fontSize:13 }} placeholder="0"
                        value={k==="retirementAge"?profileForm.targets?.retirementAge||"":profileForm.targets?.[k]||""}
                        onChange={e=>setProfileForm(p=>({...p,targets:{...p.targets,[k]:(k==="retirementAge"?parseInt:parseFloat)(e.target.value)||0}}))} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:11, color:"var(--t3)", marginBottom:8 }}>Manual assets</div>
                {(profileForm.manualAssets||[]).map((a,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                    <input style={{ ...inputSt, flex:2 }} placeholder="Name (e.g. Home)" value={a.name}
                      onChange={e=>setProfileForm(p=>{const assets=[...p.manualAssets];assets[i]={...assets[i],name:e.target.value};return{...p,manualAssets:assets};})} />
                    <input type="number" style={{ ...inputSt, flex:1 }} placeholder="Value" value={a.value||""}
                      onChange={e=>setProfileForm(p=>{const assets=[...p.manualAssets];assets[i]={...assets[i],value:parseFloat(e.target.value)||0};return{...p,manualAssets:assets};})} />
                    <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={()=>setProfileForm(p=>({...p,manualAssets:p.manualAssets.filter((_,j)=>j!==i)}))}>✕</button>
                  </div>
                ))}
                <button style={{ ...S.btn("ghost",true), width:"100%" }} className="ledgr-btn"
                  onClick={()=>setProfileForm(p=>({...p,manualAssets:[...(p.manualAssets||[]),{name:"",value:0}]}))}>+ Add asset</button>
              </div>
              <div>
                <div style={{ fontSize:11, color:"var(--t3)", marginBottom:8 }}>Manual liabilities</div>
                {(profileForm.manualLiabilities||[]).map((l,i)=>(
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                    <input style={{ ...inputSt, flex:2 }} placeholder="Name (e.g. Loan)" value={l.name}
                      onChange={e=>setProfileForm(p=>{const liabs=[...p.manualLiabilities];liabs[i]={...liabs[i],name:e.target.value};return{...p,manualLiabilities:liabs};})} />
                    <input type="number" style={{ ...inputSt, flex:1 }} placeholder="Amount" value={l.value||""}
                      onChange={e=>setProfileForm(p=>{const liabs=[...p.manualLiabilities];liabs[i]={...liabs[i],value:parseFloat(e.target.value)||0};return{...p,manualLiabilities:liabs};})} />
                    <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={()=>setProfileForm(p=>({...p,manualLiabilities:p.manualLiabilities.filter((_,j)=>j!==i)}))}>✕</button>
                  </div>
                ))}
                <button style={{ ...S.btn("ghost",true), width:"100%" }} className="ledgr-btn"
                  onClick={()=>setProfileForm(p=>({...p,manualLiabilities:[...(p.manualLiabilities||[]),{name:"",value:0}]}))}>+ Add liability</button>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>setProfileForm(null)}>Cancel</button>
                <button style={S.btn("primary")} className="ledgr-btn-primary"
                  onClick={()=>{onSaveProfile(profileForm);setProfileForm(null);showToast("Profile saved");}}>Save profile</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                {[
                  ["Monthly income",    userProfile?.monthlyIncome ? `$${(userProfile.monthlyIncome).toLocaleString()}` : "Not set"],
                  ["Retirement age",    userProfile?.targets?.retirementAge||"Not set"],
                  ["Net worth target",  userProfile?.targets?.netWorthTarget ? `$${(userProfile.targets.netWorthTarget).toLocaleString()}` : "Not set"],
                  ["Retirement target", userProfile?.targets?.retirementTargetAmount ? `$${(userProfile.targets.retirementTargetAmount).toLocaleString()}` : "Not set"],
                ].map(([label,value])=>(
                  <div key={label} style={{ padding:"10px 12px", background:"rgba(255,255,255,0.03)", borderRadius:"var(--radius)", border:"1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize:10, color:"var(--t3)", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"var(--t1)", fontFamily:"var(--font-mono)" }}>{value}</div>
                  </div>
                ))}
              </div>
              <button style={{ ...S.btn("ghost"), width:"100%" }} onClick={()=>setProfileForm({...userProfile})}>Edit profile</button>
            </div>
          )}
        </Section>
      </>}

      {/* ══ APPEARANCE ════════════════════════════════════════ */}
      {settingsTab === "appearance" && <>
        <Section title="Themes">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:5, marginBottom:16 }}>
            {PRESETS.map(p=>(
              <button key={p.name} onClick={()=>applyPreset(p)} style={{
                display:"flex", alignItems:"center", gap:6, padding:"6px 10px",
                borderRadius:"var(--radius)", fontSize:11, fontWeight:500,
                border:"1px solid rgba(255,255,255,0.07)", background:"var(--surface)",
                color:"var(--t2)", cursor:"pointer", transition:"all .12s",
                whiteSpace:"nowrap", overflow:"hidden",
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=current.accent||"var(--cyan)";e.currentTarget.style.color="var(--t1)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";e.currentTarget.style.color="var(--t2)";}}>
                <span style={{ display:"inline-flex", gap:2, flexShrink:0 }}>
                  {["bg","accent","t1"].map(k=><span key={k} style={{ width:7,height:7,borderRadius:"50%",background:p[k],display:"inline-block" }}/>)}
                </span>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</span>
              </button>
            ))}
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontSize:11, color:"var(--t3)" }}>My themes</div>
              <button style={{ ...S.btn("ghost",true), fontSize:11 }} className="ledgr-btn"
                onClick={()=>setShowSaveInput(p=>!p)}>{showSaveInput?"Cancel":"+ Save current"}</button>
            </div>
            {showSaveInput && (
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                <input autoFocus value={saveThemeName} onChange={e=>setSaveThemeName(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")saveCurrentTheme();if(e.key==="Escape")setShowSaveInput(false);}}
                  placeholder="Theme name…" style={{ ...inputSt, flex:1, fontSize:12 }} />
                <button style={S.btn("primary",true)} onClick={saveCurrentTheme} disabled={!saveThemeName.trim()}>Save</button>
              </div>
            )}
            {savedThemes.length===0&&!showSaveInput && <div style={{ fontSize:11, color:"var(--t3)", padding:"6px 0" }}>No saved themes yet.</div>}
            {savedThemes.length>0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:5 }}>
                {savedThemes.map(t=>(
                  <div key={t.name} style={{ display:"flex", borderRadius:"var(--radius)", overflow:"hidden", border:"1px solid rgba(255,255,255,0.07)" }}>
                    <button onClick={()=>applyPreset(t)} style={{ flex:1, display:"flex", alignItems:"center", gap:5, padding:"6px 8px", background:"var(--surface)", color:"var(--t2)", border:"none", cursor:"pointer", fontSize:11, overflow:"hidden", textAlign:"left" }}
                      onMouseEnter={e=>e.currentTarget.style.color="var(--t1)"}
                      onMouseLeave={e=>e.currentTarget.style.color="var(--t2)"}>
                      <span style={{ display:"inline-flex", gap:2, flexShrink:0 }}>
                        {["bg","accent","t1"].map(k=><span key={k} style={{ width:7,height:7,borderRadius:"50%",background:t[k]||"#888",display:"inline-block" }}/>)}
                      </span>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</span>
                    </button>
                    <button onClick={()=>deleteCustomTheme(t.name)} style={{ background:"var(--surface)", border:"none", borderLeft:"1px solid rgba(255,255,255,0.07)", color:"var(--t3)", cursor:"pointer", padding:"0 8px", fontSize:14 }}
                      onMouseEnter={e=>e.currentTarget.style.color="var(--red)"}
                      onMouseLeave={e=>e.currentTarget.style.color="var(--t3)"}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Custom Colors">
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {VARS.map(({ key, label })=>(
              <SettingRow key={key} label={label}>
                <input type="color" value={current[key]?.startsWith("rgba")||current[key]?.startsWith("rgb")?"#888888":current[key]||"#888888"}
                  onChange={e=>patch(key,e.target.value)}
                  style={{ width:36, height:28, borderRadius:6, border:"1px solid rgba(255,255,255,0.1)", background:"none", cursor:"pointer", padding:2 }} />
              </SettingRow>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:5 }}>
            {FONTS.map(f=>{
              const active=(current.fontDisp||"'Syne', sans-serif")===f.value;
              return (
                <button key={f.value} onClick={()=>patch("fontDisp",f.value)} style={{
                  padding:"8px 10px", borderRadius:"var(--radius)", fontSize:12,
                  fontFamily:f.value, cursor:"pointer", border:"none",
                  background: active?"rgba(201,149,106,0.12)":"var(--surface)",
                  color: active?"var(--cyan)":"var(--t2)",
                  outline: active?"1px solid rgba(201,149,106,0.3)":"none",
                  transition:"all .12s",
                }}>{f.label}</button>
              );
            })}
          </div>
        </Section>

        <Section title="Fine Tuning">
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {[
              ["Surface contrast","Brightness step between card layers",gradSteps,0,30,v=>patchGradSteps(Number(v)),""],
              ["Card angle","Gradient direction on obsidian cards",gradAngle,0,360,v=>patchGradAngle(Number(v)),"°"],
              ["Global opacity","Overall UI transparency",globalOpacity,20,100,v=>patchGlobalOpacity(Number(v)),"%"],
            ].map(([label,hint,val,min,max,fn,unit])=>(
              <SettingRow key={label} label={label} hint={hint}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <input type="range" min={min} max={max} value={val} onChange={e=>fn(e.target.value)}
                    style={{ width:120, accentColor:"var(--cyan)" }} />
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--t2)", width:36, textAlign:"right" }}>{val}{unit}</span>
                </div>
              </SettingRow>
            ))}
          </div>
        </Section>

        <Section title="Background Image">
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <input id="ledgr-bg-upload" type="file" accept="image/*" style={{ display:"none" }}
              onChange={e=>{
                const file=e.target.files?.[0]; if(!file) return;
                if(file.size>8*1024*1024) alert("Image is very large and may slow down the app.");
                const reader=new FileReader();
                reader.onload=ev=>onSaveTheme({...current,bgImage:ev.target.result});
                reader.readAsDataURL(file); e.target.value="";
              }} />
            <button onClick={()=>document.getElementById("ledgr-bg-upload").click()}
              style={{ ...S.btn("ghost",true), display:"flex", alignItems:"center", gap:8 }}>
              <span>🖼</span><span>{current.bgImage?"Change image":"Choose image"}</span>
            </button>
            {current.bgImage && (
              <>
                <div style={{ width:60, height:36, borderRadius:"var(--radius)", overflow:"hidden", flexShrink:0 }}>
                  <img src={current.bgImage} alt="bg" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                </div>
                <button onClick={()=>{const next={...current};delete next.bgImage;onSaveTheme(next);}}
                  style={{ ...S.btn("ghost",true), color:"var(--t3)" }}>Remove</button>
              </>
            )}
          </div>
        </Section>

        <div style={{ paddingBottom:8 }}>
          <button style={{ ...S.btn("ghost"), color:"var(--t3)" }} onClick={reset}>Reset to default theme</button>
        </div>
      </>}

      {/* ══ HOUSEHOLD ════════════════════════════════════════ */}
      {settingsTab === "household" && <>
        {!householdLoaded ? (
          <div style={{ color:"var(--t3)", fontSize:13, padding:"24px 0" }}>Loading…</div>
        ) : household ? (
          <>
            <Section title="Household">
              <div style={{ fontSize:13, color:"var(--t2)", marginBottom:14 }}>
                Sharing with <strong style={{ color:"var(--t1)" }}>{household.members?.length||0} member{household.members?.length!==1?"s":""}</strong>.
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                {(household.members||[]).map(m=>(
                  <SettingRow key={m.id} label={m.name||m.email} hint={m.role==="owner"?"Owner":m.status||""}>
                    {m.role !== "owner" && (
                      <button style={{ ...S.btn("ghost",true), color:"var(--red)", fontSize:11 }} onClick={()=>removeMember(m.id)}>Remove</button>
                    )}
                  </SettingRow>
                ))}
              </div>
            </Section>
            <Section title="Invite member">
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...inputSt, flex:1 }} type="email" placeholder="Email address"
                  value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&sendInvite()} />
                <button style={S.btn("primary",true)} onClick={sendInvite} disabled={inviting||!inviteEmail.trim()}>
                  {inviting?"Sending…":"Send invite"}
                </button>
              </div>
            </Section>
            <button style={{ ...S.btn("ghost"), color:"var(--red)" }} onClick={leaveHousehold}>Leave household</button>
          </>
        ) : (
          <Section title="Family Sharing">
            <div style={{ fontSize:13, color:"var(--t2)", marginBottom:16, lineHeight:1.6 }}>
              Share Ledgr with up to 2 household members. Each person keeps their own settings and theme.
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...inputSt, flex:1 }} type="email" placeholder="Invite by email"
                value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&sendInvite()} />
              <button style={S.btn("primary",true)} onClick={sendInvite} disabled={inviting||!inviteEmail.trim()}>
                {inviting?"Sending…":"Invite"}
              </button>
            </div>
          </Section>
        )}
      </>}

      {/* ══ DATA ════════════════════════════════════════════ */}
      {settingsTab === "data" && <>
        <Section title="Overview">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {[["Transactions",transactions.length],["Accounts",accounts.length],["Categories",categories.length],["Bank connections",plaidItems?.length||0]].map(([label,val])=>(
              <div key={label} style={{ padding:"12px 14px", background:"rgba(255,255,255,0.03)", borderRadius:"var(--radius)", border:"1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize:10, color:"var(--t3)", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:20, fontWeight:700, color:"var(--t1)" }}>{val}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Export">
          <SettingRow label="Download CSV" hint="All transactions with categories, accounts, and dates">
            <button style={S.btn("primary",true)} onClick={exportCSV}>Export CSV</button>
          </SettingRow>
        </Section>

        <Section title="Trash">
          <SettingRow label="Deleted transactions" hint={`${deletedTransactions?.length||0} items in trash`}>
            <button style={S.btn("ghost",true)} onClick={()=>setShowTrash(p=>!p)}>
              {showTrash?"Hide trash":"View trash"}
            </button>
          </SettingRow>
          {showTrash && (
            <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:0 }}>
              {(deletedTransactions||[]).length === 0 ? (
                <div style={{ fontSize:12, color:"var(--t3)", padding:"12px 0" }}>Trash is empty</div>
              ) : (deletedTransactions||[]).slice(0,20).map(t=>(
                <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name||t.merchant}</div>
                    <div style={{ fontSize:10, color:"var(--t3)", marginTop:2 }}>{t.date}</div>
                  </div>
                  <div style={{ fontFamily:"var(--font-mono)", fontSize:12, color:t.amount<0?"var(--red)":"var(--green)", flexShrink:0 }}>
                    {t.amount<0?"-":"+"}{`$${Math.abs(t.amount).toFixed(2)}`}
                  </div>
                  <button style={{ ...S.btn("ghost",true), fontSize:11, flexShrink:0 }}
                    onClick={()=>{
                      const restored={...t}; delete restored.deletedAt;
                      setTransactions(p=>[restored,...p]);
                      setDeletedTransactions(p=>{const next=p.filter(x=>x.id!==t.id);scheduleSaveRef.current?.({deletedTransactions:next});return next;});
                      api.createTransaction(restored).catch(console.error);
                      showToast("Restored");
                    }}>Restore</button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Danger Zone">
          <SettingRow label="Delete all transactions" hint="Cannot be undone" danger>
            <button style={{ ...S.btn("ghost",true), color:"var(--red)", borderColor:"rgba(224,112,112,0.3)" }}
              onClick={deleteAllTransactions}>Delete all</button>
          </SettingRow>
          <SettingRow label="Clear all data" hint="Removes all transactions, accounts, categories, rules, and bank connections" danger>
            <button style={{ ...S.btn("ghost",true), color:"var(--red)", borderColor:"rgba(224,112,112,0.3)" }}
              onClick={clearAllData}>Clear everything</button>
          </SettingRow>
        </Section>
      </>}

      {/* ══ SUBSCRIPTION ════════════════════════════════════ */}
      {settingsTab === "subscription" && <>
        <Section title="Current Plan">
          <div style={{ padding:"16px 18px", background:"rgba(201,149,106,0.06)", borderRadius:"var(--radius)", border:"1px solid rgba(201,149,106,0.15)", marginBottom:16 }}>
            <div style={{ fontFamily:"var(--font-mono)", fontSize:10, textTransform:"uppercase", letterSpacing:"1px", color:"rgba(201,149,106,0.5)", marginBottom:6 }}>Active plan</div>
            <div style={{ fontSize:16, fontWeight:700, color:"var(--t1)", marginBottom:3 }}>
              {access==="full" ? (isFamilyPlan ? "Family Plan" : "Personal Plan") : "Free"}
            </div>
            <div style={{ fontSize:12, color:"var(--t3)" }}>
              {access==="full" ? "Full access to all features" : "Limited to dashboard and settings"}
            </div>
          </div>
          {access !== "full" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
              {["Unlimited transactions & accounts","Budget tracking & categories","Recurring calendar","Analytics & spending trends","AI-powered insights","Bank sync via Plaid"].map(f=>(
                <div key={f} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"var(--t2)" }}>
                  <span style={{ color:"var(--cyan)", fontSize:10 }}>✓</span>{f}
                </div>
              ))}
            </div>
          )}
          <a href="https://www.useledgr.com/#pricing" target="_blank" rel="noreferrer"
            style={{ display:"inline-block", padding:"9px 18px", borderRadius:"var(--radius)", background:"var(--cyan)", color:"#000", fontWeight:700, fontSize:13, textDecoration:"none" }}>
            {access==="full" ? "Manage subscription" : "Upgrade plan"}
          </a>
        </Section>
        <Section title="Legal">
          <SettingRow label="Privacy Policy">
            <a href="https://www.useledgr.com/privacy" target="_blank" rel="noreferrer"
              style={{ fontSize:12, color:"var(--cyan)", textDecoration:"none" }}>View →</a>
          </SettingRow>
          <SettingRow label="Terms of Service">
            <a href="https://www.useledgr.com/terms" target="_blank" rel="noreferrer"
              style={{ fontSize:12, color:"var(--cyan)", textDecoration:"none" }}>View →</a>
          </SettingRow>
        </Section>
      </>}

      </div>
    </div>
    </>
  );
}


/* ✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓
   MAIN APP
✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓ */
/* ── useCountUp — animates a number from its previous value to the new one ── */
function useCountUp(value, duration = 650) {
  const [display, setDisplay] = useState(value);
  const prev    = useRef(value);
  const rafRef  = useRef(null);

  useEffect(() => {
    const from = prev.current;
    const to   = value;
    prev.current = value;
    if (from === to) return;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return display;
}


/* -- Theme application helper ------------------------------------ */
function AdminPanel() {
  const isMobile = useIsMobile();
  const [adminTab,     setAdminTab]     = useState("users");
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [editing,  setEditing]  = useState(null);
  const [editForm, setEditForm] = useState({ subscription_status:"", role:"" });
  const [saving,   setSaving]   = useState(false);
  const [confirm,  setConfirm]  = useState(null);
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 25;
  const [messages,   setMessages]   = useState([]);
  const [msgText,    setMsgText]    = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError,   setMsgError]   = useState("");

  async function loadMessages() {
    setMsgLoading(true);
    try { const d = await api.getStatusMessages(); setMessages(d.messages || []); }
    catch(e) { console.warn("Failed to load messages:", e.message); }
    finally { setMsgLoading(false); }
  }
  async function sendMessage() {
    if (!msgText.trim()) return;
    setMsgSending(true);
    setMsgError("");
    try {
      await api.sendStatusMessage(msgText.trim());
      setMsgText("");
      await loadMessages();
    } catch(e) {
      setMsgError(e.message || "Failed to send message");
    } finally {
      setMsgSending(false);
    }
  }
  async function deleteMessage(id) {
    try { await api.deleteStatusMessage(id); setMessages(p => p.filter(m => m.id !== id)); }
    catch(e) { alert("Failed to delete: " + e.message); }
  }
  useEffect(() => { if (adminTab === "messages") loadMessages(); }, [adminTab]);

  async function loadUsers() {
    setLoading(true); setError("");
    try { const d = await api.adminGetUsers(); setUsers(d.users); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadUsers(); }, []);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

  async function saveEdit(userId) {
    setSaving(true);
    try {
      const patch = {};
      if (editForm.subscription_status) patch.subscription_status = editForm.subscription_status;
      if (editForm.role) patch.role = editForm.role;
      await api.adminUpdateUser(userId, patch);
      setEditing(null);
      await loadUsers();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteUser(userId) {
    try {
      await api.adminDeleteUser(userId);
      setConfirm(null);
      await loadUsers();
    } catch(e) { setError(e.message); }
  }

  const stats = {
    total:    users.length,
    active:   users.filter(u => u.subscription_status === "active").length,
    trialing: users.filter(u => u.subscription_status === "trialing").length,
    canceled: users.filter(u => u.subscription_status === "canceled" || u.subscription_status === "past_due").length,
    mrr:      users.filter(u => u.subscription_status === "active" && u.role !== "owner" && u.role !== "free").length * 4.99,
  };

  const statusColor = s => s === "active" ? "var(--green)" : s === "trialing" ? "var(--amber)" : s === "past_due" ? "var(--red)" : "var(--t3)";
  const statusDot   = s => <span style={{width:7,height:7,borderRadius:"50%",background:statusColor(s),display:"inline-block",marginRight:6,flexShrink:0}}/>;
  const roleColor   = r => r === "owner" ? "var(--cyan)" : r === "free" ? "var(--green)" : "var(--t2)";

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase().trim()));
  const totalPages    = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedUsers    = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{width:"100%"}}>
      <div style={{fontFamily:"var(--font-disp)",fontSize:22,fontWeight:800,marginBottom:14,letterSpacing:"-0.3px"}}>
        Admin Panel
      </div>

      {/* Tab switcher */}
      <div style={{display:"flex",gap:0,marginBottom:20,background:"var(--surface)",borderRadius:"var(--radius)",padding:3,width:"fit-content"}}>
        {[["users","Users"],["messages","Messages"]].map(([id,label]) => (
          <button key={id} onClick={()=>setAdminTab(id)}
            style={{background:adminTab===id?"var(--card)":"none",border:"none",color:adminTab===id?"var(--t1)":"var(--t3)",padding:"6px 16px",borderRadius:"var(--radius)",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all 0.15s"}}>
            {label}
          </button>
        ))}
      </div>

      {/* Messages Tab */}
      {adminTab === "messages" && (
        <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:640}}>
          <div className="obsidian-card" style={{...S.card,padding:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:8}}>Send Status Message</div>
            <div style={{fontSize:11,color:"var(--t3)",marginBottom:12,lineHeight:1.5}}>
              Appears as a modal to all users on next login. Expires after 24 hours. Users can dismiss with "Don't show again".
            </div>
            <textarea value={msgText} onChange={e=>{ setMsgText(e.target.value); setMsgError(""); }}
              placeholder="e.g. We're performing scheduled maintenance tonight from 11pm-1am EST..."
              style={{...S.input,minHeight:100,resize:"vertical",fontFamily:"inherit",lineHeight:1.6,fontSize:13,marginBottom:8}}/>
            {msgError && (
              <div style={{fontSize:12,color:"var(--red)",marginBottom:8,padding:"6px 10px",background:"var(--red-dim)",borderRadius:"var(--radius)"}}>
                ✗ {msgError}
              </div>
            )}
            <button style={S.btn("primary",true)} onClick={sendMessage} disabled={msgSending||!msgText.trim()}>
              {msgSending?"Sending...":"Send Message"}
            </button>
          </div>
          <div className="obsidian-card" style={{...S.card,padding:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:12}}>Message History</div>
            {msgLoading ? (
              <div style={{fontSize:13,color:"var(--t3)",textAlign:"center",padding:"20px 0"}}>Loading...</div>
            ) : messages.length === 0 ? (
              <div style={{fontSize:13,color:"var(--t3)",textAlign:"center",padding:"20px 0"}}>No messages sent yet</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {messages.map(m => {
                  const expired = Date.now() - m.created_at > 24*60*60*1000;
                  return (
                    <div key={m.id} style={{padding:"12px 14px",background:"var(--surface)",borderRadius:"var(--radius)",border:`1px solid ${expired?"var(--border)":"rgba(0,212,255,0.3)"}`,opacity:expired?0.5:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6}}>
                        <div style={{fontSize:11,color:expired?"var(--t3)":"var(--cyan)",fontWeight:600}}>
                          {expired?"EXPIRED":"ACTIVE"} · {new Date(m.created_at).toLocaleString()}
                        </div>
                        <button onClick={()=>deleteMessage(m.id)}
                          style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:14,padding:"0 2px",lineHeight:1,flexShrink:0}}>x</button>
                      </div>
                      <div style={{fontSize:13,color:"var(--t1)",lineHeight:1.6}}>{m.text}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {adminTab === "users" && (
      <div>

      {/* Stats -- 2x2 on mobile, 4 columns on desktop */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:24}}>
        {[
          { label:"Total Users", value:stats.total,                  color:"var(--t1)"    },
          { label:"Active",      value:stats.active,                  color:"var(--green)" },
          { label:"Trialing",    value:stats.trialing,                color:"var(--amber)" },
          { label:"MRR",         value:`$${stats.mrr.toFixed(2)}`,   color:"var(--cyan)"  },
        ].map(({label,value,color}) => (
          <div key={label} className="obsidian-card" style={{...S.card,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"1px",fontWeight:600,marginBottom:4}}>{label}</div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:isMobile?20:24,fontWeight:700,color}}>{value}</div>
          </div>
        ))}
      </div>

      {error && <div style={{color:"var(--red)",fontSize:13,marginBottom:16,padding:"10px 14px",background:"#ff4d6d11",borderRadius:"var(--radius)",border:"1px solid #ff4d6d33"}}>{error}</div>}

      {/* Users list */}
      <div className="obsidian-card" style={{...S.card,padding:0,overflow:"hidden"}}>
        <div style={{padding:"10px 12px",borderBottom:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontFamily:"var(--font-disp)",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"var(--t3)"}}>
              Users ({search ? `${filteredUsers.length} of ${users.length}` : users.length})
            </div>
            <button style={{...S.btn("ghost",true)}} className="ledgr-btn" onClick={loadUsers} disabled={loading}>
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
          <input
            style={{...S.input, fontSize:13}}
            placeholder="Search by email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:"center",color:"var(--t3)",fontSize:13}}>Loading users…</div>
        ) : isMobile ? (
          /* -- Mobile: card-per-user -- */
          <div style={{display:"flex",flexDirection:"column"}}>
            {pagedUsers.map((user, i) => (
              <div key={user.id} style={{
                padding:"14px 16px",
                borderBottom: i < pagedUsers.length-1 ? "1px solid var(--border)" : "none",
                background: editing === user.id ? "var(--surface)" : "transparent",
              }}>
                {/* Email + ID */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{user.email}</div>
                    <div style={{fontSize:10,color:"var(--t3)",fontFamily:"var(--font-mono)",marginTop:2}}>{user.id.slice(0,8)}…</div>
                  </div>
                  {!editing && user.role !== "owner" && (
                    <button style={S.btn("danger",true)} onClick={() => setConfirm(user.id)}>✕</button>
                  )}
                </div>

                {/* Info row */}
                {editing !== user.id ? (
                  <>
                    <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:10}}>
                      <div>
                        <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>Role</div>
                        <span style={{fontSize:12,color:roleColor(user.role),fontWeight:700}}>{user.role}</span>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>Status</div>
                        <span style={{display:"inline-flex",alignItems:"center",fontSize:12}}>
                          {statusDot(user.subscription_status)}{user.subscription_status}
                        </span>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>Joined</div>
                        <span style={{fontSize:12,color:"var(--t3)"}}>{new Date(Number(user.created_at)).toLocaleDateString("en-US")}</span>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>Last Activity</div>
                        <span style={{fontSize:12,color:"var(--t3)"}}>{user.last_activity_at ? new Date(Number(user.last_activity_at)).toLocaleDateString("en-US") : "—"}</span>
                      </div>
                    </div>
                    <button style={{...S.btn("ghost",true),width:"100%",justifyContent:"center"}} className="ledgr-btn" onClick={() => {
                      setEditing(user.id);
                      setEditForm({ subscription_status: user.subscription_status, role: user.role });
                    }}>Edit</button>
                  </>
                ) : (
                  /* Edit mode */
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <div>
                        <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4}}>Role</div>
                        <select style={{...S.select,width:"100%",fontSize:12}} value={editForm.role || user.role}
                          onChange={e => setEditForm(p => ({...p, role: e.target.value}))}>
                          <option value="subscriber">subscriber</option>
                          <option value="free">free</option>
                          <option value="owner">owner</option>
                        </select>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4}}>Status</div>
                        <select style={{...S.select,width:"100%",fontSize:12}} value={editForm.subscription_status || user.subscription_status}
                          onChange={e => setEditForm(p => ({...p, subscription_status: e.target.value}))}>
                          <option value="active">active</option>
                          <option value="pro">pro ($4.99)</option>
                          <option value="family">family ($9.99)</option>
                          <option value="trialing">trialing</option>
                          <option value="canceled">canceled</option>
                          <option value="past_due">past_due</option>
                          <option value="expired">expired</option>
                        </select>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button style={{...S.btn("primary",true),flex:1,justifyContent:"center"}} onClick={() => saveEdit(user.id)} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button style={{...S.btn("ghost",true),flex:1,justifyContent:"center"}} className="ledgr-btn" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* -- Desktop: table -- */
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  {["Email","Role","Status","Trial Ends","Last Activity","Joined","Actions"].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map(user => (
                  <tr key={user.id} style={{background: editing === user.id ? "var(--surface)" : "transparent"}}>
                    <td style={S.td}>
                      <div style={{fontSize:13,color:"var(--t1)",fontWeight:500}}>{user.email}</div>
                      <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--font-mono)"}}>{user.id.slice(0,8)}…</div>
                    </td>
                    <td style={S.td}>
                      {editing === user.id ? (
                        <select style={{...S.select,fontSize:12}} value={editForm.role || user.role}
                          onChange={e => setEditForm(p => ({...p, role: e.target.value}))}>
                          <option value="subscriber">subscriber</option>
                          <option value="free">free</option>
                          <option value="owner">owner</option>
                        </select>
                      ) : (
                        <span style={{fontSize:12,color:roleColor(user.role),fontWeight: user.role !== "subscriber" ? 700 : 400}}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td style={S.td}>
                      {editing === user.id ? (
                        <select style={{...S.select,fontSize:12}} value={editForm.subscription_status || user.subscription_status}
                          onChange={e => setEditForm(p => ({...p, subscription_status: e.target.value}))}>
                          <option value="active">active</option>
                          <option value="pro">pro ($4.99)</option>
                          <option value="family">family ($9.99)</option>
                          <option value="trialing">trialing</option>
                          <option value="canceled">canceled</option>
                          <option value="past_due">past_due</option>
                          <option value="expired">expired</option>
                        </select>
                      ) : (
                        <span style={{display:"inline-flex",alignItems:"center",fontSize:12}}>
                          {statusDot(user.subscription_status)}{user.subscription_status}
                        </span>
                      )}
                    </td>
                    <td style={S.td}>
                      <span style={{fontSize:12,color:"var(--t3)",fontFamily:"var(--font-mono)"}}>
                        {user.trial_ends_at ? new Date(Number(user.trial_ends_at)).toLocaleDateString("en-US") : "—"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{fontSize:12,color:"var(--t3)",fontFamily:"var(--font-mono)"}}>
                        {user.last_activity_at ? new Date(Number(user.last_activity_at)).toLocaleDateString("en-US") : "—"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{fontSize:12,color:"var(--t3)",fontFamily:"var(--font-mono)"}}>
                        {new Date(Number(user.created_at)).toLocaleDateString("en-US")}
                      </span>
                    </td>
                    <td style={S.td}>
                      {editing === user.id ? (
                        <div style={{display:"flex",gap:6}}>
                          <button style={S.btn("primary",true)} onClick={() => saveEdit(user.id)} disabled={saving}>
                            {saving ? "…" : "Save"}
                          </button>
                          <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{display:"flex",gap:6}}>
                          <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={() => {
                            setEditing(user.id);
                            setEditForm({ subscription_status: user.subscription_status, role: user.role });
                          }}>Edit</button>
                          {user.role !== "owner" && (
                            <button style={S.btn("danger",true)} onClick={() => setConfirm(user.id)}>✕</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:14,gap:8}}>
          <button
            style={{...S.btn("ghost",true)}} className="ledgr-btn"
            onClick={() => setPage(p => Math.max(1, p-1))}
            disabled={page === 1}>
            → Prev
          </button>
          <span style={{fontSize:13,color:"var(--t3)"}}>
            Page {page} of {totalPages}
          </span>
          <button
            style={{...S.btn("ghost",true)}} className="ledgr-btn"
            onClick={() => setPage(p => Math.min(totalPages, p+1))}
            disabled={page === totalPages}>
            Next ←
          </button>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirm && (
        <div style={S.overlay} className="ledgr-overlay-anim" onClick={() => setConfirm(null)}>
          <div style={{...S.modal,maxWidth:380}} className="ledgr-modal-anim" onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Delete User?</div>
            <div style={{fontSize:13,color:"var(--t2)",marginBottom:20}}>
              This will permanently delete the user and all their data. This cannot be undone.
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button style={S.btn("ghost")} className="ledgr-btn" onClick={() => setConfirm(null)}>Cancel</button>
              <button style={S.btn("danger")} className="ledgr-btn-danger" onClick={() => deleteUser(confirm)}>Delete User</button>
            </div>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}


function AppInner({ isDemo = false }) {
  const isMobile = useIsMobile();

  /* -- State -- */
  // Invite accept flow — detected from URL ?invite=token
  const inviteToken = (() => {
    const t = new URLSearchParams(window.location.search).get("invite");
    return t && /^[a-f0-9]{64}$/.test(t) ? t : null;
  })();
  const [showInviteModal, setShowInviteModal] = useState(!!inviteToken);
  const [inviteStatus, setInviteStatus]       = useState("idle"); // idle|loading|ready|accepting|done|error
  const [inviteEmail,  setInviteEmail]        = useState("");
  const [invitePw,     setInvitePw]           = useState("");
  const [inviteIsNew,  setInviteIsNew]        = useState(false);
  const [inviteError,  setInviteError]        = useState("");

  useEffect(() => {
    if (!inviteToken) return;
    setInviteStatus("loading");
    api.checkHouseholdInvite(inviteToken)
      .then(d => {
        if (!d || d.error) { setInviteStatus("error"); return; }
        setInviteEmail(d.email || "");
        setInviteStatus("ready");
      })
      .catch(() => setInviteStatus("error"));
  }, []);

  async function acceptInvite() {
    setInviteError(""); setInviteStatus("accepting");
    try {
      if (inviteIsNew) {
        await api.register(inviteEmail, invitePw);
      } else {
        await api.login(inviteEmail, invitePw);
      }
      await api.acceptHouseholdInvite(inviteToken);
      window.history.replaceState({}, "", window.location.pathname);
      window.location.reload();
    } catch(e) {
      setInviteError(e.message || "Something went wrong");
      setInviteStatus("ready");
    }
  }

  const [view,          setView]          = useState("dashboard");
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [newTxnNotifs,  setNewTxnNotifs]  = useState([]); // [{id, merchant, amount, date}]
  const [pendingDuplicates, setPendingDuplicates] = useState(null); // {count, detectedAt}
  const [dismissedNotifs, setDismissedNotifs] = useState(new Set()); // Set of notif ids dismissed this session
  const [systemMsg,     setSystemMsg]     = useState(null);  // active system message from server
  const [systemMsgOpen, setSystemMsgOpen] = useState(false); // modal open
  const [moreOpen,      setMoreOpen]      = useState(false); // mobile more sheet
  const [accounts,      setAccounts]      = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [transactions,  setTransactions]  = useState([]);
  const [allTransactions, setAllTransactions] = useState(null); // null = not yet loaded; set when analytics opens
  const [txnTotal,      setTxnTotal]      = useState(0);    // total count from server
  const [txnOffset,     setTxnOffset]     = useState(0);    // current pagination offset
  const [txnLoading,    setTxnLoading]    = useState(false);// loading more transactions
  const TXN_PAGE_SIZE = 100;

  // Server-side summary — replaces client-side spentByCat/spentByAcct/totalSpent/totalIncome
  const [summary,       setSummary]       = useState({ spentByCat:{}, spentByAcct:{}, totalSpent:0, totalIncome:0 });
  const [summaryMonth,  setSummaryMonth]  = useState(null); // which month the summary is for
  const [plaidItems,    setPlaidItems]    = useState([]);
  const [staleItemIds,  setStaleItemIds]  = useState(new Set()); // items that returned 0 accounts on last sync
  const [reconnectingItemId, setReconnectingItemId] = useState(null);
  const [rules,         setRules]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState(null);
  const [editTarget,    setEditTarget]    = useState(null);
  const [toast,         setToast]         = useState("");
  const [newTxnIds,     setNewTxnIds]     = useState(new Set());
  const [settingsTab,   setSettingsTab]   = useState("profile");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const navKeyRef = useRef(0);
  const prevViewRef = useRef(null);
  if (prevViewRef.current !== view) { navKeyRef.current += 1; prevViewRef.current = view; }
  const navKey = navKeyRef.current;
  const [newTxnCount,   setNewTxnCount]   = useState(0);
  const [undoAction,    setUndoAction]    = useState(null); // {label, fn}
  const undoTimer = useRef(null);
  const budgetBarsAnimated = useRef(false);
  useEffect(() => {
    if (!budgetBarsAnimated.current) {
      const t = setTimeout(() => { budgetBarsAnimated.current = true; }, 1200);
      return () => clearTimeout(t);
    }
  }, []);
  const [syncing,       setSyncing]       = useState(false);
  const [rulePrompt,    setRulePrompt]    = useState(null);
  const [typeRulePrompt, setTypeRulePrompt] = useState(null); // {merchant, type}
  const [selectedTxns,  setSelectedTxns]  = useState(new Set()); // bulk edit
  const [drillCat,      setDrillCat]      = useState(null);
  const [budgetExpandedCatId, setBudgetExpandedCatId] = useState(null);
  const [budgetTxnSearch, setBudgetTxnSearch] = useState("");
  const [budgetKebabId, setBudgetKebabId] = useState(null);
  const [drillTxnSearch, setDrillTxnSearch] = useState("");
  const [budgetDrillCat, setBudgetDrillCat] = useState(null);
  const [calendarDay,      setCalendarDay]      = useState(null);
  const [expandedCalendarAcct,setExpandedCalendarAcct]= useState(null);
  const [selectedMonth,    setSelectedMonth]    = useState(() => localStorage.getItem("ledgr_month") || currentMonth);
  const [calendarMonth,    setCalendarMonth]    = useState(currentMonth);
  const [calendarAccounts,   setCalendarAccounts]   = useState(null);
  const [calendarSplitView, setCalendarSplitView] = useState("full");
  const [editingCalAccts,  setEditingCalAccts]  = useState(false);
  const [search,        setSearch]        = useState("");
  const txnSearchInputRef = useRef(null);
  const txnSearchHadFocusRef = useRef(false);
  const txnSearchCaretRef = useRef({ start: null, end: null });
  const [filterCat,     setFilterCat]     = useState("all");
  const [filterAcct,    setFilterAcct]    = useState("all");
  const [recurringItems, setRecurringItems] = useState([]);
  const [recurringItemModal, setRecurringItemModal] = useState(false);
  const [editingRecurringItem, setEditingRecurringItem] = useState(null);
  const [riForm, setRiForm] = useState({ name:"", amountMin:"", amountMax:"", recurringDay:"", recurringFreq:"monthly", recurringStart:"", categoryId:"", accountId:"", type:"expense" });
  const [calendarOpenNewRi, setCalendarOpenNewRi] = useState(false);
  const [riSearch, setRiSearch] = useState("");
  const [riSearchResults, setRiSearchResults] = useState([]);
  const [riSearchLoading, setRiSearchLoading] = useState(false);
  const [deletedTransactions, setDeletedTransactions] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [filterReview,  setFilterReview]  = useState(false);
  const [txnSortCol,    setTxnSortCol]    = useState("date");
  const [txnSortDir,    setTxnSortDir]    = useState("desc");
  const [txnTypeFilter, setTxnTypeFilter] = useState("all");
  const [txnPage,       setTxnPage]       = useState(0);
  const [editingId,     setEditingId]     = useState(null);
  const [ellipsisId,    setEllipsisId]    = useState(null);
  const [expandedTxnId, setExpandedTxnId] = useState(null);
  const [editingName,   setEditingName]   = useState("");
  const [catForm,  setCatForm]  = useState({ name:"", limit:"", color:CAT_COLORS[0] });
  const [acctForm, setAcctForm] = useState({ name:"", balance:"", type:"Checking" });
  const [txnForm,  setTxnForm]  = useState({ merchant:"", amount:"", date:"", categoryId:"", accountId:"", sign:"-1" });
  const [ruleForm, setRuleForm] = useState({ pattern:"", matchType:"contains", categoryId:"", typeOverride:"", enabled:true });
  const [editingLimitId,   setEditingLimitId]   = useState(null);
  const [editingLimitVal,  setEditingLimitVal]  = useState("");
  const [editingCatNameId, setEditingCatNameId] = useState(null);
  const [editingCatName,   setEditingCatName]   = useState("");
  const [limitSuggestions,    setLimitSuggestions]    = useState([]); // [{categoryId, suggestedLimit, reasoning}]
  const [suggestingLimits,    setSuggestingLimits]    = useState(false);
  const [access,   setAccess]   = useState(() => {
    // Derive initial access from stored user to avoid flash of full access
    const u = api.getStoredUser();
    if (!u) return "free";
    if (u.role === "owner") return "full";
    if (u.role === "free")  return "full";
    if (u.subscription_status === "active") return "full";
    if (u.subscription_status === "trialing" && u.trial_ends_at && Date.now() < u.trial_ends_at) return "full";
    return "free";
  });

  /* -- Stable save ref (allows portfolio hook to be defined before useAppData) -- */
  const scheduleSaveRef = useRef(null);
  const rulesRef        = useRef([]);  // always holds current rules for use inside stale closures

  /* -- Portfolio (via hook) -- */
  const portfolio = usePortfolio((patch) => scheduleSaveRef.current?.(patch));

  /* -- AI Chat (via hook) -- */
  const aiChat = useAiChat((patch) => scheduleSaveRef.current?.(patch));

  /* -- AI categorization examples (memory) -- */
  const [aiCatExamples, setAiCatExamples] = useState([]);
  const [autoCatRunning, setAutoCatRunning] = useState(false);
  const [catSuggestions, setCatSuggestions] = useState(null);

  /* -- User profile (income, assets, targets) -- */
  const [userProfile, setUserProfile] = useState({
    monthlyIncome: 0,
    manualAssets:       [], // [{id, name, value}]
    manualLiabilities:  [], // [{id, name, value}]
    targets: {
      savingsGoal:             0,
      emergencyFund:           0,
      netWorthTarget:          0,
      retirementAge:           65,
      retirementTargetAmount:  0,
    },
  });

  /* -- Analytics AI insights — persisted across tab/view switches -- */
  const [analyticsInsights, setAnalyticsInsights] = useState(null);
  const [analyticsTab, setAnalyticsTab] = useState("overview");


  /* -- Insights to-do list -- */
  const [insightsTodos, setInsightsTodos] = useState([]);
  const [theme,         setTheme]         = useState({});
  const [daniData,      setDaniData]      = useState({ tab1:{ selectedAccountId:null, wishlist:[] }, tab2:{ selectedAccountId:null, wishlist:[] } });
  const [goals, setGoals] = useState([]);
  const [customAccountNames, setCustomAccountNames] = useState({});
  const [dashboardCardOrder, setDashboardCardOrder] = useState({ col1:["spending","balances"], col2:["budget","action"], col3:["goals","upcoming"] }); // [{id, title, targetAmount, deadline, periodAmount, period, savedAmount, assignedTxnIds, createdAt}]

  /* -- Demo mode: inject fake data once on mount -- */
  useEffect(() => {
    if (!isDemo) return;
    setCategories(DEMO_CATEGORIES);
    setAccounts(DEMO_ACCOUNTS);
    setTransactions(DEMO_TRANSACTIONS);
    setRules(DEMO_RULES);
    setGoals(DEMO_GOALS);
    setUserProfile(DEMO_USER_PROFILE);
    setLoading(false);
  }, [isDemo]);

  /* -- Load + Save (via hook) -- */
  const { initialized, scheduleSave, loadPortfolioOnce, loadAiOnce, loadAnalyticsOnce,
          resetAnalyticsLoad } = isDemo ? { initialized:true, scheduleSave:()=>{}, loadPortfolioOnce:()=>{}, loadAiOnce:()=>{}, loadAnalyticsOnce:()=>{}, resetAnalyticsLoad:()=>{} } : useAppData({
    accounts, categories, transactions, plaidItems, rules, calendarAccounts, calendarSplitView,
    setAccounts, setCategories, setTransactions, setPlaidItems, setRules,
    setCalendarAccounts, setCalendarSplitView, setAccess, setLoading, applyRules,
    onData: (data, txnTotal) => {
      aiChat.loadFromData(data);
      if (data.aiCatExamples)  setAiCatExamples(data.aiCatExamples);
      if (data.userProfile)    setUserProfile(p => ({ ...p, ...data.userProfile }));
      if (data.goals)              setGoals(data.goals);
      if (data.dashboardCardOrder) setDashboardCardOrder(data.dashboardCardOrder);
      if (data.pendingDuplicates?.count > 0) setPendingDuplicates(data.pendingDuplicates);
      if (data.customAccountNames && Object.keys(data.customAccountNames).length) {
        setCustomAccountNames(data.customAccountNames);
        setAccounts(prev => prev.map(a =>
          data.customAccountNames[a.id] ? { ...a, name: data.customAccountNames[a.id] } : a
        ));
      }
      if (data.dismissedPairs) setDismissedPairs(data.dismissedPairs);
      if (data.scanMemory)     setScanMemory(data.scanMemory);
      if (Array.isArray(data.deletedTransactions)) setDeletedTransactions(data.deletedTransactions);
      if (Array.isArray(data.recurringItems)) setRecurringItems(data.recurringItems);
      if (data.insightsTodos)  setInsightsTodos(data.insightsTodos);
      if (data.dani)           setDaniData(data.dani);
      if (data.theme) {
        const t = (data.theme.bg === "#0f0e0d" || data.theme.bg === "#0F0E0D")
          ? { ...data.theme, bg: "#0b0a08", surface: data.theme.surface || "#1a1612", card: data.theme.card || "#181511" }
          : data.theme;
        setTheme(t); applyTheme(t);
      }
      setTxnTotal(txnTotal || 0);
      // Offset is now managed by oldest-date pagination in loadMoreTransactions
      setTxnOffset(0);
      if (data.reauthItemIds?.length) setStaleItemIds(new Set(data.reauthItemIds));

      // Clean up orphaned Plaid accounts — accounts whose item no longer exists
      if (data.accounts && data.plaidItems !== undefined) {
        const activeItemIds = new Set((data.plaidItems || []).map(i => i.item_id));
        const orphans = (data.accounts || []).filter(a =>
          a.plaidId && a.plaidItemId && !activeItemIds.has(a.plaidItemId)
        );
        if (orphans.length > 0) {
          console.log("Cleaning up orphaned Plaid accounts:", orphans.map(a => a.name));
          // Clean from DB — group by plaidItemId if available, else delete individually
          const itemIds = [...new Set(orphans.map(a => a.plaidItemId).filter(Boolean))];
          const orphanIds = orphans.map(a => a.id);
          itemIds.forEach(id => api.deleteAccountsByItem(id).catch(() => {}));
          // For accounts with no plaidItemId, delete individually
          orphans.filter(a => !a.plaidItemId).forEach(a =>
            api.deleteAccount(a.id).catch(() => {})
          );
          // Remove from local state
          const orphanIdSet = new Set(orphanIds);
          setAccounts(prev => prev.filter(a => !orphanIdSet.has(a.id)));
        }
      }

      api.loadSummary(currentMonth).then(s => {
        setSummary(s);
        setSummaryMonth(s.month);
      }).catch(console.warn);
    },
    // Called the first time the portfolio view opens
    onPortfolioData: (data) => {
      portfolio.loadFromData(data);
    },
    // Called the first time the AI view opens
    onAiData: (data) => {
      aiChat.loadFromData(data);
    },
    // Called the first time the analytics view opens
    onAnalyticsData: (data, allTxns) => {
      if (data.analyticsInsights) setAnalyticsInsights(data.analyticsInsights);
      if (data.insightsTodos)     setInsightsTodos(data.insightsTodos);
      if (data.dani)              setDaniData(data.dani);
      if (data.theme) {
        const t = (data.theme.bg === "#0f0e0d" || data.theme.bg === "#0F0E0D")
          ? { ...data.theme, bg: "#0b0a08", surface: data.theme.surface || "#1a1612", card: data.theme.card || "#181511" }
          : data.theme;
        setTheme(t); applyTheme(t);
      }
      // Store the full transaction set for analytics computations.
      // Falls back to the paginated set if the full load failed.
      if (allTxns?.length) setAllTransactions(allTxns);
    },
  });

  // Wire the ref once scheduleSave is available
  scheduleSaveRef.current = scheduleSave;

  // Show onboarding wizard for new users with no categories
  useEffect(() => {
    if (!initialized.current) return;
    if (isDemo) return;
    if (categories.length > 0) return;
    if (localStorage.getItem(ONBOARDING_STORAGE_KEY)) return;
    // Small delay so app finishes rendering first
    const t = setTimeout(() => setShowOnboarding(true), 600);
    return () => clearTimeout(t);
  }, [initialized.current, isDemo]);

  rulesRef.current        = rules;

  /* -- Fetch active system message on mount -- */
  useEffect(() => {
    if (isDemo) return;
    const DISMISS_KEY = "ledgr_dismissed_msgs";
    api.getActiveMessage()
      .then(data => {
        const msg = data?.message;
        if (!msg) return;
        // Check if user already dismissed this message id
        try {
          const dismissed = JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
          if (dismissed.includes(msg.id)) return;
        } catch {}
        setSystemMsg(msg);
        setSystemMsgOpen(true);
      })
      .catch(() => {}); // silently fail — non-critical
  }, []);
  const knownTxnIds    = useRef(null);
  const lastSyncedAt   = useRef(0);
  useEffect(() => {
    if (!initialized.current) return;
    // Record the IDs we loaded with
    if (knownTxnIds.current === null) {
      knownTxnIds.current = new Set(transactions.map(t => t.id));
    }
  }, [initialized.current, transactions.length]);

  useEffect(() => {
    const POLL_MS = 30 * 60 * 1000; // 30 minutes
    const interval = setInterval(async () => {
      if (!initialized.current) return;
      try {
        // Poll latest 100 transactions, refresh summary, and refresh account balances
        const [txnData, summaryData, acctData] = await Promise.allSettled([
          api.loadTransactions({ limit: 100, offset: 0 }),
          api.loadSummary(selectedMonth),
          api.getAccounts(),
        ]);
        if (txnData.status === "fulfilled") {
          const incoming = txnData.value.transactions || [];
          const known = knownTxnIds.current || new Set();
          const brandNew = incoming.filter(t => !known.has(t.id));
          if (brandNew.length > 0) {
            setTransactions(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              const toAdd = applyRules(
                brandNew.filter(t => !existingIds.has(t.id)),
                rulesRef.current,   // ref always has current rules, even in stale closure
                { onlyUncategorized: true }
              );
              if (toAdd.length === 0) return prev;
              return [...toAdd, ...prev];
            });
            brandNew.forEach(t => {
              knownTxnIds.current.add(t.id);
              autoLinkTransaction(t, recurringItems);
            });
            setNewTxnCount(brandNew.length);
          }
          setTxnTotal(txnData.value.total || 0);
        }
        if (summaryData.status === "fulfilled") {
          setSummary(summaryData.value);
          setSummaryMonth(summaryData.value.month);
        }
        // Refresh balances only — never touch plaidId/plaidItemId/name/user fields
        if (acctData.status === "fulfilled") {
          const freshAccts = acctData.value.accounts || [];
          if (freshAccts.length > 0) {
            const balanceMap = Object.fromEntries(
              freshAccts.map(a => [a.account_id, { balance: a.balance, available: a.available }])
            );
            setAccounts(prev => prev.map(a =>
              a.plaidId && balanceMap[a.plaidId]
                ? { ...a, balance: balanceMap[a.plaidId].balance, available: balanceMap[a.plaidId].available }
                : a
            ));
          }
        }
      } catch (e) {
        console.warn("Poll error:", e.message);
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Refresh server summary after mutations that affect totals (category changes, type changes)
  function refreshSummary() {
    api.loadSummary(selectedMonth).then(s => {
      setSummary(s);
      setSummaryMonth(s.month);
    }).catch(console.warn);
  }
  async function loadMoreTransactions() {
    if (txnLoading) return;
    setTxnLoading(true);
    try {
      // Use the oldest loaded transaction date as cursor — fetch 100 transactions before it
      const dates = transactions.map(t => t.date).filter(Boolean).sort();
      const oldestDate = dates[0];
      if (!oldestDate) return;
      const data = await api.loadTransactions({ limit: TXN_PAGE_SIZE, toDate: oldestDate });
      const existingIds = new Set(transactions.map(t => t.id));
      const newTxns = applyRules(
        (data.transactions||[]).filter(t => !existingIds.has(t.id)),
        rules, { onlyUncategorized: true }
      );
      if (newTxns.length === 0) { setTxnTotal(transactions.length); return; }
      setTransactions(prev => [...prev, ...newTxns]);
      setTxnTotal(data.total || 0);
    } catch (e) {
      console.warn("Load more error:", e.message);
    } finally {
      setTxnLoading(false);
    }
  }

  // Refresh server-side summary whenever the selected month changes
  useEffect(() => {
    if (!initialized.current || !selectedMonth) return;
    if (summaryMonth === selectedMonth) return; // already loaded
    api.loadSummary(selectedMonth).then(s => {
      setSummary(s);
      setSummaryMonth(s.month);
    }).catch(console.warn);
  }, [selectedMonth, initialized.current]);

  /* -- Swipe gesture to open/close drawer on mobile -- */

  /* -- Service worker + push notification subscription -- */
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
    function urlBase64ToUint8Array(b64) {
      const pad = "=".repeat((4 - b64.length % 4) % 4);
      const raw = atob((b64 + pad).replace(/-/g,"+").replace(/_/g,"/"));
      return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
    }
    async function setup() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        // If we have a local sub, verify the server still knows about it.
        // iOS APNs endpoints expire silently — a 410/404 from the server means
        // the endpoint is dead and we need to force a fresh subscription.
        if (sub) {
          const result = await api.subscribePush(sub).catch(() => null);
          if (!result?.ok) {
            // Server rejected or endpoint is dead — unsubscribe so we re-create below
            await sub.unsubscribe().catch(() => {});
            sub = null;
          }
        }

        if (!sub) {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
          });
          await api.subscribePush(sub);
        }

        navigator.serviceWorker.addEventListener("message", e => {
          if (e.data?.type === "NEW_TRANSACTIONS") setView("transactions");
        });
      } catch (err) {
        console.warn("Push setup:", err.message);
      }
    }
    setup();
  }, []);

  const contentRef = useRef(null);
  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2800); };
  const navigate  = id  => {
    setView(id);
    contentRef.current?.scrollTo({ top: 0 });
    // Lazy-load section data on first navigation — each loads at most once per session
    if (id === "portfolio") loadPortfolioOnce();
    if (id === "ai")        loadAiOnce();
    if (id === "analytics") loadAnalyticsOnce();
  };

  function showUndoToast(label, undoFn) {
    clearTimeout(undoTimer.current);
    setUndoAction({ label, fn: undoFn });
    undoTimer.current = setTimeout(() => setUndoAction(null), 4000);
  }

  function handleTxnSearchChange(e) {
    txnSearchHadFocusRef.current = true;
    txnSearchCaretRef.current = {
      start: e.target.selectionStart,
      end: e.target.selectionEnd,
    };
    setSearch(e.target.value);
  }

  // A transaction needs review if it has no category AND hasn't been marked reviewed
  // Income, transfer, reimbursement auto-reviewed when type set
  const needsReview = t => !t.reviewed && !t.categoryId && (t.type==="expense" || t.type==="refund" || !t.type);
  function markReviewed(id) {
    setTransactions(p => p.map(t => {
      if (t.id !== id) return t;
      const reviewed = !t.reviewed;
      api.updateTransaction(id, { reviewed }).catch(console.error);
      return { ...t, reviewed };
    }));
  }

  /* -- Computed -- */
  const monthTxns = useMemo(() =>
    transactions.filter(t => t.date?.startsWith(selectedMonth)),
  [transactions, selectedMonth]);

  const isCurrentMonth = selectedMonth === currentMonth;

  // Use server-side precomputed summary for dashboard aggregates.
  // Falls back to client-side computation from loaded transactions while
  // the server summary is loading (e.g. on first render or month switch).
  // spentByCat always computed from in-memory transactions so category changes
  // reflect immediately without waiting for a server summary refresh.
  // The server summary is still used for totalSpent/totalIncome on the dashboard
  // where all-time accuracy matters more than instant updates.
  const spentByCat = useMemo(() => {
    const m = {};
    monthTxns.forEach(t => {
      if (t.amount < 0 && t.categoryId && t.type !== "transfer" && t.type !== "income" && t.type !== "reimbursement")
        m[t.categoryId] = (m[t.categoryId] || 0) + Math.abs(t.amount);
    });
    return m;
  }, [monthTxns]);

  const spentByAcct = useMemo(() => {
    if (summaryMonth === selectedMonth) return summary.spentByAcct;
    const m = {};
    monthTxns.forEach(t => { if (t.amount<0 && t.accountId) m[t.accountId]=(m[t.accountId]||0)+Math.abs(t.amount); });
    return m;
  }, [summary, summaryMonth, selectedMonth, monthTxns]);

  const totalSpent  = summaryMonth === selectedMonth ? summary.totalSpent  : Object.values(spentByCat).reduce((a,b)=>a+b,0);
  const totalIncome = summaryMonth === selectedMonth ? summary.totalIncome : monthTxns.filter(t=>t.amount>0&&(t.type==="income"||!t.type)).reduce((a,t)=>a+t.amount,0);
  const displaySpent  = useCountUp(totalSpent);
  const displayIncome = useCountUp(totalIncome);
  const displayNet    = useCountUp(totalIncome - totalSpent);
  const totalBudget = categories.reduce((a,c)=>a+c.limit,0);
  const catMap      = useMemo(()=>Object.fromEntries(categories.map(c=>[c.id,c])), [categories]);
  const acctMap     = useMemo(()=>Object.fromEntries(accounts.map(a=>[a.id,a])),   [accounts]);

  /* -- Duplicate scan (via hook) -- */
  const {
    dismissedPairs, setDismissedPairs,
    scanMemory, setScanMemory,
    duplicatePairs, setDuplicatePairs,
    duplicateScanActive, setDuplicateScanActive,
    showReconcile, setShowReconcile,
    showDuplicates, setShowDuplicates,
    pendingPairs,
    activeDuplicatePairs,
    scanForDuplicates,
    dismissPair, confirmPair,
    dismissDuplicatePair, confirmDuplicateRemoval,
    pickRemove, isPreauth, processingIds,
  } = useDuplicateScan(transactions, showToast, setTransactions, showUndoToast);

  // Persist dismissed pairs + scan memory whenever they change
  useEffect(() => {
    if (dismissedPairs.length > 0) scheduleSaveRef.current?.({ dismissedPairs });
  }, [dismissedPairs]);
  useEffect(() => {
    const hasData = Object.keys(scanMemory?.confirmed||{}).length > 0 || Object.keys(scanMemory?.dismissed||{}).length > 0;
    if (hasData) scheduleSaveRef.current?.({ scanMemory });
  }, [scanMemory]);

  const deletedTxnIds = useMemo(() => new Set(deletedTransactions.map(t => t.id)), [deletedTransactions]);

  const filteredTxns = useMemo(() =>
    transactions.filter(t => {
      const label = (t.name||t.merchant||"").toLowerCase();
      if (deletedTxnIds.has(t.id)) return false;  // hide soft-deleted transactions
      if (!showDuplicates && pendingPairs.some(p=>p.pending.id===t.id)) return false;
      if (search && !label.includes(search.toLowerCase())) return false;
      if (filterCat    !== "all" && t.categoryId !== filterCat)  return false;
      if (filterAcct   !== "all" && filterAcct === "__unlinked__" && t.accountId && acctMap[t.accountId]) return false;
      if (filterAcct   !== "all" && filterAcct !== "__unlinked__" && t.accountId !== filterAcct) return false;
      if (filterReview && !needsReview(t)) return false;
      return true;
    }).sort((a,b) => b.date?.localeCompare(a.date)),
  [transactions, deletedTxnIds, search, filterCat, filterAcct, filterReview, showDuplicates, pendingPairs]);

  // Auto-clear the review filter once the last transaction has been reviewed —
  // so the user lands back on the full unfiltered list rather than a blank screen.
  useEffect(() => {
    if (!filterReview) return;
    const remaining = transactions.filter(t => needsReview(t)).length;
    if (remaining === 0) setFilterReview(false);
  }, [transactions, filterReview]);

  useEffect(() => {
    if (view !== "transactions" || !txnSearchHadFocusRef.current) return;
    const el = txnSearchInputRef.current;
    if (!el) return;
    const start = txnSearchCaretRef.current.start ?? search.length;
    const end = txnSearchCaretRef.current.end ?? search.length;
    requestAnimationFrame(() => {
      if (!txnSearchInputRef.current) return;
      txnSearchInputRef.current.focus();
      try {
        txnSearchInputRef.current.setSelectionRange(start, end);
      } catch {}
    });
  }, [search, view, filteredTxns.length]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a,b) => {
      const remA = a.limit-(spentByCat[a.id]||0);
      const remB = b.limit-(spentByCat[b.id]||0);
      const compA = a.completedMonths?.includes(selectedMonth);
      const compB = b.completedMonths?.includes(selectedMonth);
      const groupA = compA ? 2 : remA<0 ? 0 : remA===0 ? 2 : 1; // 0=overspent, 1=in progress, 2=done
      const groupB = compB ? 2 : remB<0 ? 0 : remB===0 ? 2 : 1;
      if (groupA!==groupB) return groupA-groupB;
      return a.name.localeCompare(b.name);
    });
  }, [categories, spentByCat, selectedMonth]);

  const catTxns = useMemo(() =>
    drillCat ? monthTxns.filter(t=>t.categoryId===drillCat.id&&t.amount<0).sort((a,b)=>b.date.localeCompare(a.date)) : [],
  [drillCat, monthTxns]);

  // Separate from drillCat — used by budgets page right panel only, never triggers the dashboard modal
  const budgetCatTxns = useMemo(() =>
    budgetDrillCat ? monthTxns.filter(t=>t.categoryId===budgetDrillCat.id&&t.amount<0).sort((a,b)=>b.date.localeCompare(a.date)) : [],
  [budgetDrillCat, monthTxns]);

  const recurringTxns = useMemo(() => transactions.filter(t=>t.recurring), [transactions]);

  const calendarTxnsByDay = useMemo(() => {
    const map = {};
    const [calY, calM] = calendarMonth.split("-").map(Number);
    const daysInCalMonth = daysInMonth(calY, calM);

    function addToDay(d, entry) {
      if (d < 1 || d > daysInCalMonth) return;
      if (!map[d]) map[d] = [];
      // Avoid duplicates by id
      if (!map[d].find(x => x.id === entry.id)) map[d].push(entry);
    }

    function plotOccurrences(freq, startDate, recurringDay, addFn) {
      if (freq === "monthly") {
        if (recurringDay) addFn(parseInt(recurringDay));
      } else if (freq === "annual") {
        if (startDate && startDate.getMonth()+1 === calM && startDate.getFullYear() <= calY) {
          addFn(startDate.getDate());
        }
      } else if (freq === "weekly" || freq === "biweekly") {
        if (!startDate) { if (recurringDay) addFn(parseInt(recurringDay)); return; }
        const intervalDays = freq === "weekly" ? 7 : 14;
        let current = new Date(startDate);
        while (current > new Date(calY, calM-1, 1)) {
          current = new Date(current.getTime() - intervalDays*24*60*60*1000);
        }
        for (let i = 0; i < 60; i++) {
          if (current.getFullYear() === calY && current.getMonth()+1 === calM) addFn(current.getDate());
          if (current.getFullYear() > calY || (current.getFullYear() === calY && current.getMonth()+1 > calM)) break;
          current = new Date(current.getTime() + intervalDays*24*60*60*1000);
        }
      }
    }

    // Recurring items — plot from their start date onward
    recurringItems.forEach(item => {
      const freq  = item.recurringFreq || "monthly";
      const start = item.recurringStart ? new Date(item.recurringStart + "T12:00:00") : null;

      // Don't show this item in months before its start date
      if (start) {
        const startY = start.getFullYear();
        const startM = start.getMonth() + 1;
        if (calY < startY || (calY === startY && calM < startM)) return;
      }

      // Get linked transactions that posted this calendar month
      const linkedThisMonth = (item.linkedTxnIds||[])
        .map(txnId => transactions.find(x => x.id === txnId))
        .filter(t => {
          if (!t || !t.date) return false;
          const [ty, tm] = t.date.split("-").map(Number);
          return ty === calY && tm === calM;
        });

      // For biweekly/weekly, plot per-occurrence entries so each can independently show posted/upcoming
      // A given occurrence is "posted" if a linked transaction fell within 4 days of that day
      plotOccurrences(freq, start, item.recurringDay, d => {
        const postedOnDay = linkedThisMonth.some(t => {
          const txnDay = parseInt(t.date.split("-")[2]);
          return Math.abs(txnDay - d) <= 4;
        });
        const entry = {
          id: "ri_sched_" + item.id + "_" + d,
          name: item.name,
          merchant: item.name,
          categoryId: item.categoryId,
          accountId: item.accountId,
          type: item.type,
          amount: item.amountMin != null ? (item.type==="income" ? item.amountMin : -item.amountMin) : 0,
          amountMin: item.amountMin,
          amountMax: item.amountMax,
          isRecurringItem: true,
          recurringItemId: item.id,
          postedThisMonth: postedOnDay,
          recurringDay: d,
          recurringFreq: item.recurringFreq,
        };
        addToDay(d, entry);
      });
    });

    return map;
  }, [recurringItems, transactions, calendarMonth]);

  function prevMonth() {
    const [y,m]=selectedMonth.split("-").map(Number);
    const d=new Date(y,m-2,1);
    const month=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    setSelectedMonth(month);
    localStorage.setItem("ledgr_month", month);
  }
  function nextMonth() {
    const [y,m]=selectedMonth.split("-").map(Number);
    const d=new Date(y,m,1);
    const next=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    if(next<=currentMonth) { setSelectedMonth(next); localStorage.setItem("ledgr_month", next); }
  }
  function prevCalMonth() {
    const [y,m]=calendarMonth.split("-").map(Number);
    const d=new Date(y,m-2,1);
    setCalendarMonth(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
  }
  function nextCalMonth() {
    const [y,m]=calendarMonth.split("-").map(Number);
    const d=new Date(y,m,1);
    setCalendarMonth(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
  }
  function monthLabel(ym) {
    const [y,m]=ym.split("-").map(Number);
    return new Date(y,m-1,1).toLocaleString("default",{month:"long",year:"numeric"});
  }

  /* -- Rules -- */
  function applyRules(txns, rs, opts = {}) {
    if (!rs?.length) return txns;
    const { onlyUncategorized = false } = opts;
    const manualRules  = rs.filter(r => r.source !== "ai");
    const aiRules      = rs.filter(r => r.source === "ai");
    const orderedRules = [...manualRules, ...aiRules];
    return txns.map(t => {
      if (t.userCategorized) return t; // never touch manually-categorized txns
      if (onlyUncategorized && t.categoryId) return t;
      const mer = (t.merchant || t.name || "").toLowerCase().trim();
      for (const r of orderedRules) {
        if (!r.enabled) continue;
        const pat = r.pattern.toLowerCase().trim();
        if (!pat) continue;
        const match = r.matchType === "exact"  ? mer === pat
                    : r.matchType === "starts" ? mer.startsWith(pat)
                    : mer.includes(pat);
        if (match) {
          const updates = {};
          if (r.categoryId)   updates.categoryId = r.categoryId;
          if (r.typeOverride) { updates.type = r.typeOverride; updates.reviewed = true; }
          if (Object.keys(updates).length) return { ...t, ...updates };
        }
      }
      return t;
    });
  }
  function toggleSelectTxn(id) {
    setSelectedTxns(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function selectAllVisible() { setSelectedTxns(new Set(filteredTxns.map(t => t.id))); }
  function clearSelection()   { setSelectedTxns(new Set()); }
  function bulkSetCategory(catId) {
    const ids = [...selectedTxns];
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, categoryId:catId||null, reviewed: catId ? true : t.reviewed, userCategorized: !!catId} : t));
    api.bulkUpdateTransactions(ids, { categoryId: catId || null, reviewed: !!catId, userCategorized: !!catId }).catch(console.error);
    showToast(`Updated ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""}`);
    clearSelection();
    refreshSummary();
  }
  function bulkSetType(type) {
    const ids = [...selectedTxns];
    const autoReviewed = ["income","transfer","reimbursement"].includes(type);
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, type, reviewed: autoReviewed ? true : t.reviewed} : t));
    api.bulkUpdateTransactions(ids, { type, ...(autoReviewed ? { reviewed: true } : {}) }).catch(console.error);
    showToast(`Updated ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""}`);
    clearSelection();
    refreshSummary();
  }
  function bulkSetAccount(accountId) {
    const ids = [...selectedTxns];
    const val = accountId || null;
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, accountId: val} : t));
    api.bulkUpdateTransactions(ids, { accountId: val }).catch(console.error);
    showToast(`Updated ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""}`);
    clearSelection();
  }
  function bulkMarkReviewed(reviewed) {
    const ids = [...selectedTxns];
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, reviewed} : t));
    api.bulkUpdateTransactions(ids, { reviewed }).catch(console.error);
    showToast(`Marked ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""} ${reviewed?"reviewed":"unreviewed"}`);
    clearSelection();
  }
  function bulkDelete() {
    const removed = transactions.filter(t => selectedTxns.has(t.id));
    const removedIds = removed.map(t => t.id);
    setTransactions(p => p.filter(t => !selectedTxns.has(t.id)));
    api.bulkDeleteTransactions(removedIds).catch(console.error);
    showUndoToast(`Deleted ${removed.length} transaction${removed.length!==1?"s":""}`, () => {
      setTransactions(p => [...p, ...removed]);
      Promise.all(removed.map(t => api.createTransaction(t))).catch(console.error);
    });
    clearSelection();
  }
  function promptSaveRule(txn, categoryId) {
    const mer=(txn.merchant||txn.name||"").toLowerCase().trim();
    if (!rules.some(r=>r.pattern.toLowerCase().trim()===mer)&&mer&&categoryId)
      setRulePrompt({txnId:txn.id,merchant:txn.merchant||txn.name,categoryId});
  }
  function confirmSaveRule() {
    if (!rulePrompt) return;
    const rule = { id:"r"+Date.now(), pattern:rulePrompt.merchant, matchType:"contains", categoryId:rulePrompt.categoryId, enabled:true, createdAt:Date.now() };
    setRules(p => [...p, rule]);
    api.createRule(rule).catch(console.error);
    setRulePrompt(null); showToast("Rule saved");
  }
  function confirmTypeRule() {
    if (!typeRulePrompt) return;
    const { merchant, type } = typeRulePrompt;
    const pattern = merchant.toLowerCase();
    const newRule = { id:"r"+Date.now(), pattern:merchant, matchType:"contains", typeOverride:type, categoryId:null, enabled:true, createdAt:Date.now() };
    setRules(p => {
      const filtered = p.filter(r => !(r.pattern.toLowerCase() === pattern && r.typeOverride));
      // Delete any replaced rule from the server
      filtered.length < p.length && p.filter(r => r.pattern.toLowerCase() === pattern && r.typeOverride)
        .forEach(r => api.deleteRule(r.id).catch(console.error));
      return [...filtered, newRule];
    });
    api.createRule(newRule).catch(console.error);
    setTypeRulePrompt(null);
    showToast(`Rule saved — "${merchant}" will always be ${type}`);
  }
  function saveRule(rule) {
    const isNew = !rules.find(r => r.id === rule.id);
    setRules(p => [...p.filter(r => r.id !== rule.id), rule]);
    if (isNew) api.createRule(rule).catch(console.error);
    else       api.updateRule(rule.id, rule).catch(console.error);
    showToast("Rule saved");
  }
  function deleteRule(id)  {
    const rule = rules.find(r => r.id === id);
    setRules(p => p.filter(r => r.id !== id));
    api.deleteRule(id).catch(console.error);
    showUndoToast("Rule deleted", () => {
      setRules(p => [...p, rule]);
      api.createRule(rule).catch(console.error);
    });
  }
  function toggleRule(id)  {
    setRules(p => p.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, enabled: !r.enabled };
      api.updateRule(id, { enabled: updated.enabled }).catch(console.error);
      return updated;
    }));
  }

  /* -- Goals -- */
  function saveGoal(goal) {
    const isNew = !goals.find(g => g.id === goal.id);
    const next = isNew
      ? [...goals, { ...goal, id: "g" + Date.now(), createdAt: Date.now(), savedAmount: 0, assignedTxnIds: [] }]
      : goals.map(g => g.id === goal.id ? { ...g, ...goal } : g);
    setGoals(next);
    scheduleSaveRef.current?.({ goals: next });
    showToast(isNew ? "Goal created" : "Goal updated");
  }
  function deleteGoal(id) {
    const next = goals.filter(g => g.id !== id);
    setGoals(next);
    scheduleSaveRef.current?.({ goals: next });
    showToast("Goal deleted");
  }
  function assignTxnToGoal(txnId, goalId) {
    const next = goals.map(g => {
      const assigned = new Set(g.assignedTxnIds || []);
      if (g.id === goalId) {
        assigned.add(txnId);
        const totalSaved = transactions
          .filter(t => assigned.has(t.id))
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return { ...g, assignedTxnIds: [...assigned], savedAmount: totalSaved };
      }
      // Remove from any other goal
      if (assigned.has(txnId)) {
        assigned.delete(txnId);
        const totalSaved = transactions
          .filter(t => assigned.has(t.id))
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        return { ...g, assignedTxnIds: [...assigned], savedAmount: totalSaved };
      }
      return g;
    });
    setGoals(next);
    scheduleSaveRef.current?.({ goals: next });
    showToast("Transaction assigned to goal");
  }

  useEffect(() => {
    if (!initialized.current || !rules.length) return;
    setTransactions(prev => {
      const next = applyRules(prev, rules, { onlyUncategorized: true });
      const prevMap = Object.fromEntries(prev.map(t => [t.id, t]));
      const changed = next.filter(t => prevMap[t.id] && t.categoryId !== prevMap[t.id].categoryId);
      if (changed.length > 0) {
        // Group by categoryId for efficient bulk updates
        const byCat = {};
        changed.forEach(t => {
          const k = t.categoryId || "__null__";
          if (!byCat[k]) byCat[k] = { ids: [], categoryId: t.categoryId };
          byCat[k].ids.push(t.id);
        });
        Promise.all(Object.values(byCat).map(({ ids, categoryId }) =>
          api.bulkUpdateTransactions(ids, { categoryId, userCategorized: false })
        )).catch(console.error);
      }
      return next;
    });
  }, [rules]);

  useEffect(() => {
    if (!budgetKebabId) return;
    const close = () => setBudgetKebabId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [budgetKebabId]);

  /* -- Plaid -- */
  const doSync = useCallback(async (itemId) => {
    if (syncing) return; // prevent concurrent syncs causing duplicate accounts
    setSyncing(true);
    try {
      const {added,modified,removed} = await api.syncTransactions(itemId);
      if (added && added.length > 0) {
        const notifs = added.slice(0, 5).map(t => ({
          id: `txn-${t.transaction_id || t.id || Date.now()}`,
          type: "newtxn",
          merchant: t.merchant_name || t.name || "Transaction",
          amount: t.amount,
          date: t.date,
        }));
        setNewTxnNotifs(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          return [...notifs.filter(n => !existingIds.has(n.id)), ...prev].slice(0, 20);
        });
        setNotifOpen(true);
      }
      setTransactions(prev => {
        // Normalise merchant name for fingerprinting — matches server logic
        function normMerchant(t) {
          return (t.merchant || t.name || "")
            .toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
        }
        function fp(t) {
          const date = t.authorized_date || t.date || "";
          return `${date}__${t.amount}__${normMerchant(t)}`;
        }

        let next=[...prev];
        const removeIds=new Set(removed.map(r=>r.transaction_id));
        next=next.filter(t=>!removeIds.has(t.id));
        const modMap=Object.fromEntries(modified.map(t=>[t.transaction_id,t]));
        next=next.map(t=>{
          if (!modMap[t.id]) return t;
          const updated = plaidTxnToLocal(modMap[t.id],catMap);
          const merged = {
            ...t,
            // Only update the fields Plaid owns — never touch user fields
            date:       updated.date       || t.date,
            authorized_date: updated.authorized_date || t.authorized_date || null,
            amount:     updated.amount,
            pending:    updated.pending,
            // Merchant: only update if user hasn't renamed
            merchant:   t.name ? t.merchant : (updated.merchant || t.merchant),
            // User fields: never touch
            categoryId:     t.categoryId,
            userCategorized: t.userCategorized || false,
            name:       t.name  || "",
            notes:      t.notes || "",
            reviewed:   t.reviewed || false,
          };
          // Only apply rules if user hasn't manually categorized this txn
          return applyRules([merged], rules, { onlyUncategorized: true })[0];
        });
        const existingIds=new Set(next.map(t=>t.id));
        const fingerprints=new Set(next.map(t=>fp(t)));
        const rawNew=added
          .filter(t=>!existingIds.has(t.transaction_id))
          .map(t=>plaidTxnToLocal(t,catMap))
          .filter(t=>{
            const f=fp(t);
            if(fingerprints.has(f)) return false;
            fingerprints.add(f);
            return true;
          });
        const finalNew = applyRules(rawNew, rules, { onlyUncategorized: true });
        if (finalNew.length > 0) {
          setNewTxnIds(new Set(finalNew.map(t => t.id)));
          setTimeout(() => setNewTxnIds(new Set()), 1200);
        }
        return [...finalNew, ...next];
      });
      const {accounts:plaidAccts} = await api.getAccounts();
      // Fetch fresh items from server — don't trust stale React state
      const freshItemsRes = await api.getPlaidItems();
      const freshItems = freshItemsRes?.items || [];
      const freshItemIds = new Set(freshItems.map(i => i.item_id));
      // Update plaidItems state so UI stays in sync
      if (freshItems.length > 0) setPlaidItems(freshItems);

      // Detect stale items — connected items that returned no accounts
      if (plaidAccts.length === 0 && plaidItems.length > 0) {
        setStaleItemIds(new Set(plaidItems.map(i => i.item_id)));
      } else if (itemId) {
        const itemAccts = plaidAccts.filter(a => a.item_id === itemId);
        setStaleItemIds(prev => {
          const next = new Set(prev);
          if (itemAccts.length === 0) next.add(itemId);
          else next.delete(itemId);
          return next;
        });
      }
      setAccounts(prev => {
        const manual = prev.filter(a => !a.plaidId);
        const byPlaidId = Object.fromEntries(prev.filter(a => a.plaidId).map(a => [a.plaidId, a]));
        // Use FRESH item IDs from server — never stale React state
        const activeItemIds = new Set([
          ...freshItemIds,
          ...plaidAccts.map(pa => pa.item_id),
        ]);
        // Build merged Plaid accounts - deduplicated by plaid account_id
        const seenPlaidIds = new Set();
        const plaidUpdated = plaidAccts
          .filter(pa => { const dup = seenPlaidIds.has(pa.account_id); seenPlaidIds.add(pa.account_id); return !dup; })
          .map(pa => ({
            ...(byPlaidId[pa.account_id] || { id: "a" + pa.account_id }),
            plaidId: pa.account_id,
            plaidItemId: pa.item_id,
            name: customAccountNames['a'+pa.account_id] || byPlaidId[pa.account_id]?.name || pa.name,
            balance: pa.balance,
            available: pa.available,
            type: cap(pa.subtype || pa.type),
            institution: pa.institution,
            mask: pa.mask,
          }));
        // Keep existing Plaid accounts from OTHER active items not returned by this sync
        const returnedPlaidIds = new Set(plaidAccts.map(pa => pa.account_id));
        const existingOtherPlaid = prev.filter(a =>
          a.plaidId && !returnedPlaidIds.has(a.plaidId) && activeItemIds.has(a.plaidItemId)
        );
        const updated = [...manual, ...existingOtherPlaid, ...plaidUpdated];
        // Clean up genuine orphans — items no longer in server's plaid_items table
        const orphans = prev.filter(a =>
          a.plaidId && a.plaidItemId && !activeItemIds.has(a.plaidItemId)
        );
        if (orphans.length > 0) {
          const itemIds = [...new Set(orphans.map(a => a.plaidItemId).filter(Boolean))];
          itemIds.forEach(id => api.deleteAccountsByItem(id).catch(() => {}));
        }
        return updated;
      });
      setTransactions(prev=>{
        const map={};
        plaidAccts.forEach(pa=>{map[pa.account_id]="a"+pa.account_id;});
        return prev.map(t=>t.plaidAccountId?{...t,accountId:map[t.plaidAccountId]||t.accountId}:t);
      });
      if (added.length > 0) {
        showToast(`Synced: +${added.length} new transaction${added.length !== 1 ? "s" : ""}`);
      } else if (modified.length > 0 || removed.length > 0) {
        showToast(`Sync complete — ${modified.length} updated, ${removed.length} removed`);
      } else {
        showToast("Sync complete — you're up to date ✓");
      }
      // Invalidate the full analytics transaction set — it will reload fresh next time analytics opens
      if (added.length > 0 || removed.length > 0) {
        setAllTransactions(null);
        resetAnalyticsLoad();
      }
      // Auto-categorize new uncategorized transactions if user has AI key
      if (added.length > 0) {
        const count = await runAutoCategorize();
        if (count > 0) showToast(`✦ Auto-categorized ${count} transaction${count === 1 ? "" : "s"}`);
      }
    } catch(e) { showToast("Sync error: "+e.message); }
    finally { setSyncing(false); lastSyncedAt.current = Date.now(); }
  }, [catMap, rules]);

  const handlePlaidSuccess = useCallback(async (publicToken, institutionName) => {
    try {
      const {item_id} = await api.exchangePublicToken(publicToken, institutionName);
      setPlaidItems(p=>[...p.filter(i=>i.item_id!==item_id),{item_id,institution:institutionName}]);
      showToast(`${institutionName} connected! Syncing…`);
      await doSync(item_id);
    } catch(e) { showToast("Connection failed: "+e.message); }
  }, [doSync]);

  // Auto-sync on boot if last sync was >4 hours ago
  useEffect(() => {
    if (!initialized.current) return;
    if (plaidItems.length === 0) return;
    if (Date.now() - lastSyncedAt.current > 4 * 60 * 60 * 1000) {
      doSync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized.current]);

  // Auto-sync on tab/window focus if last sync was >30 minutes ago
  useEffect(() => {
    function handleFocus() {
      if (!initialized.current) return;
      if (plaidItems.length === 0) return;
      if (Date.now() - lastSyncedAt.current > 30 * 60 * 1000) {
        doSync();
      }
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [doSync]);
  function plaidTxnToLocal(t,cm) {
    // Do NOT use Plaid's category string — it's too vague and causes false matches.
    // Rules (manual + AI) are the single source of truth for categorization.
    void cm;
    return {id:t.transaction_id,plaidAccountId:t.account_id,plaidItemId:t.item_id,accountId:"a"+t.account_id,
      date:t.date||t.authorized_date,authorized_date:t.authorized_date||null,
      merchant:t.merchant_name||t.name,name:"",
      amount:t.amount,categoryId:null,pending:t.pending,recurring:false,recurringDay:null,
      type:t.amount<0?"expense":"income"};
  }
  async function disconnectItem(itemId) {
    // Server-first: confirm all deletes before touching local state.
    try {
      try { await api.deleteItem(itemId); } catch(e) {
        if (!e.message?.includes("404") && !e.message?.includes("not found")) throw e;
      }
      await Promise.all([
        api.deleteAllTransactions(itemId),
        api.deleteAccountsByItem(itemId),
      ]);
      const cleanPlaidItems = plaidItems.filter(i => i.item_id !== itemId);
      await api.saveData({ plaidItems: cleanPlaidItems });
      setAccounts(prev => prev.filter(a => a.plaidItemId !== itemId));
      setTransactions(prev => prev.filter(t => t.plaidItemId !== itemId));
      setPlaidItems(cleanPlaidItems);
      setStaleItemIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
      showToast("Bank disconnected");
    } catch(e) { showToast("Disconnect failed — please try again: " + e.message); }
  }

  /* -- Category CRUD -- */
  function openAddCat()   { setCatForm({name:"",limit:"",color:CAT_COLORS[0]}); setModal("addCat"); }
  function openEditCat(c) { setCatForm({name:c.name,limit:String(c.limit),color:c.color}); setEditTarget(c); setModal("editCat"); }
  function saveCat() {
    if (!catForm.name.trim()||!catForm.limit) return;
    if (modal==="addCat") setCategories(p=>[...p,{id:"c"+Date.now(),name:catForm.name.trim(),limit:parseFloat(catForm.limit),color:catForm.color,completedMonths:[]}]);
    else setCategories(p=>p.map(c=>c.id===editTarget.id?{...c,...catForm,limit:parseFloat(catForm.limit)}:c));
    setModal(null); showToast("Category saved");
  }
  function toggleCatComplete(catId, e) {
    e?.stopPropagation();
    setCategories(p => p.map(c => {
      if (c.id !== catId) return c;
      const months = c.completedMonths || [];
      const already = months.includes(selectedMonth);
      return { ...c, completedMonths: already ? months.filter(m => m !== selectedMonth) : [...months, selectedMonth] };
    }));
  }
  function deleteCat(id) {
    const cat  = categories.find(c=>c.id===id);
    const affected = transactions.filter(t=>t.categoryId===id);
    setCategories(p=>p.filter(c=>c.id!==id));
    setTransactions(p=>p.map(t=>t.categoryId===id?{...t,categoryId:null}:t));
    if (affected.length > 0) api.bulkUpdateTransactions(affected.map(t=>t.id), { categoryId: null }).catch(console.error);
    showUndoToast("Category deleted", ()=>{
      setCategories(p=>[...p,cat]);
      setTransactions(p=>p.map(t=>affected.find(a=>a.id===t.id)?{...t,categoryId:id}:t));
      if (affected.length > 0) api.bulkUpdateTransactions(affected.map(t=>t.id), { categoryId: id }).catch(console.error);
    });
  }

  /* -- Account CRUD -- */
  function openAddAcct()   { setAcctForm({name:"",balance:"",type:"Checking"}); setModal("addAcct"); }
  function openEditAcct(a) { setAcctForm({name:a.name,balance:String(a.balance),type:a.type}); setEditTarget(a); setModal("editAcct"); }
  function saveAcct() {
    if (!acctForm.name.trim()) return;
    if (modal === "addAcct") {
      const newAcct = { id:"a"+Date.now(), name:acctForm.name.trim(), balance:parseFloat(acctForm.balance)||0, type:acctForm.type, isManual:true };
      setAccounts(p => [...p, newAcct]);
      api.createAccount(newAcct).catch(console.error);
    } else {
      const patch = { name:acctForm.name.trim(), balance:parseFloat(acctForm.balance)||0, type:acctForm.type };
      setAccounts(p => p.map(a => a.id === editTarget.id ? {...a, ...patch} : a));
      api.updateAccount(editTarget.id, patch).catch(e => console.warn("PATCH accounts failed:", e.message));
      const updatedNames = { ...customAccountNames, [editTarget.id]: acctForm.name.trim() };
      setCustomAccountNames(updatedNames);
      scheduleSaveRef.current?.({ customAccountNames: updatedNames });
    }
    setModal(null); showToast("Account saved");
  }
  function deleteAcct(id) {
    const acct = accounts.find(a => a.id === id);
    setAccounts(p => p.filter(a => a.id !== id));
    api.deleteAccount(id).catch(console.error);
    showUndoToast("Account deleted", () => {
      setAccounts(p => [...p, acct]);
      api.createAccount(acct).catch(console.error);
    });
  }

  /* -- Transaction CRUD -- */
  function startRename(t) { setEditingId(t.id); setEditingName(t.name||t.merchant); }
  function saveRename(id) {
    const newName = editingName.trim() || "";
    setTransactions(p=>p.map(t=>t.id===id?{...t,name:newName}:t));
    api.updateTransaction(id, { name: newName }).catch(console.error);
    setEditingId(null); showToast("Name updated");
  }
  function updateTxnName(id, name) {
    const n = (name || "").trim();
    if (!n) return;
    setTransactions(p => p.map(t => t.id === id ? { ...t, name: n } : t));
    api.updateTransaction(id, { name: n }).catch(console.error);
    showToast("Name updated");
  }
  function updateTxnType(id,val) {
    const clearCat = ["income","transfer","reimbursement"].includes(val);
    setTransactions(p=>{
      const next = p.map(t=>{
        if (t.id!==id) return t;
        const autoReviewed = val==="income"||val==="transfer"||val==="reimbursement";
        return {...t, type:val, reviewed: autoReviewed ? true : t.reviewed, categoryId: clearCat ? null : t.categoryId, userCategorized: clearCat ? false : t.userCategorized};
      });
      // Save immediately when clearing category — don't rely on debounce
      if (clearCat) {
        api.updateTransaction(id, { type: val, reviewed: ["income","transfer","reimbursement"].includes(val), categoryId: null, userCategorized: false }).catch(console.error);
      } else {
        api.updateTransaction(id, { type: val, reviewed: ["income","transfer","reimbursement"].includes(val) }).catch(console.error);
      }
      return next;
    });
    // Offer to create a type rule for the merchant
    const txn = transactions.find(t => t.id === id);
    const merchant = (txn?.merchant || txn?.name || "").trim();
    if (merchant && ["transfer","income","reimbursement"].includes(val)) {
      // Check if a type rule already exists for this merchant
      const alreadyHasRule = rules.some(r =>
        r.pattern.toLowerCase() === merchant.toLowerCase() && r.typeOverride === val
      );
      if (!alreadyHasRule) {
        setTypeRulePrompt({ merchant, type: val });
      }
    }
  }
  function updateTxnCat(id, val) {
    setTransactions(p => {
      // userCategorized:true locks this txn from being re-categorized by rules or sync
      const next = p.map(t => t.id === id ? { ...t, categoryId: val || null, reviewed: val ? true : t.reviewed, userCategorized: !!val } : t);
      // Save immediately — don't rely on debounce, a sync could arrive within 800ms
      // When removing a category (val is falsy), also reset reviewed so the transaction
      // returns to the review queue rather than staying silently "reviewed" with no category.
      api.updateTransaction(id, { categoryId: val || null, reviewed: val ? true : false, userCategorized: !!val }).catch(console.error);
      return next;
    });
    if (val) {
      const txn = transactions.find(t => t.id === id);
      if (txn) {
        promptSaveRule(txn, val);
        // Record as a manual rule — overwrites any AI rule for same merchant
        const merchant = (txn.merchant || txn.name || "").trim();
        if (merchant) {
          setAiCatExamples(prev => {
            const filtered = prev.filter(e => !(e.merchant === merchant && e.categoryId === val));
            const next = [...filtered, { merchant, categoryId: val }].slice(-200);
            scheduleSaveRef.current?.({ aiCatExamples: next });
            return next;
          });
          // Upsert into rules: if AI rule exists for this pattern, upgrade it to manual
          setRules(prev => {
            const pattern = merchant.toLowerCase();
            const existingIdx = prev.findIndex(r =>
              r.pattern.toLowerCase() === pattern && r.categoryId === val
            );
            if (existingIdx >= 0) {
              // Upgrade AI rule to manual
              const next = [...prev];
              next[existingIdx] = { ...next[existingIdx], source: "manual" };
              return next;
            }
            // Check if there's an AI rule for this merchant with a different category — replace it
            const aiIdx = prev.findIndex(r =>
              r.pattern.toLowerCase() === pattern && r.source === "ai"
            );
            if (aiIdx >= 0) {
              const next = [...prev];
              next[aiIdx] = { ...next[aiIdx], categoryId: val, source: "manual" };
              return next;
            }
            return prev; // promptSaveRule handles creating new manual rules
          });
        }
      }
    }
    refreshSummary();
  }
  async function runAutoCategorize(txnsToCheck) {
    const uncategorized = (txnsToCheck || transactions).filter(t =>
      !t.categoryId && (t.type === "expense" || t.type === "refund" || !t.type) && t.amount < 0
    );
    if (!uncategorized.length) { showToast("No uncategorized transactions to process"); return 0; }

    // -- No categories yet ← suggest a full set -------------------
    if (!categories.length) {
      setAutoCatRunning(true);
      try {
        const payload = uncategorized.slice(0, 100).map(t => ({
          id: t.id,
          merchant: (t.merchant || t.name || "").trim(),
          amount: t.amount,
        }));
        const { suggestions } = await api.suggestCategories(payload);
        if (!suggestions?.length) { showToast("Couldn't generate suggestions — try again"); return 0; }
        setCatSuggestions(suggestions.map(s => ({ ...s, limit: s.suggestedLimit || 0 })));
      } catch (e) {
        if (!e.message?.includes("no_api_key")) showToast("Auto-categorize failed: " + e.message);
        return 0;
      } finally {
        setAutoCatRunning(false);
      }
      return 0;
    }

    // -- Categories exist ← assign to existing only, never overwrite -
    const examples = rules
      .filter(r => r.enabled && r.categoryId)
      .map(r => ({ merchant: r.pattern, categoryId: r.categoryId }));

    setAutoCatRunning(true);
    try {
      const payload = uncategorized.slice(0, 80).map(t => ({
        id: t.id,
        merchant: (t.merchant || t.name || "").trim(),
        amount: t.amount,
      }));
      const { assignments } = await api.autoCategorize(payload, categories, examples);
      const count = Object.keys(assignments).length;
      if (count === 0) { showToast("Nothing new to categorize"); return 0; }

      const manualPatterns = new Set(
        rules.filter(r => r.source !== "ai").map(r => r.pattern.toLowerCase())
      );
      const newRules = [];
      const seenMerchants = new Set();

      for (const [txnId, catId] of Object.entries(assignments)) {
        const txn = uncategorized.find(t => t.id === txnId);
        if (!txn) continue;
        const merchant = (txn.merchant || txn.name || "").trim();
        const pattern  = merchant.toLowerCase();
        if (!merchant || seenMerchants.has(pattern)) continue;
        seenMerchants.add(pattern);
        if (manualPatterns.has(pattern)) continue;
        const existingAiRule = rules.find(r => r.source === "ai" && r.pattern.toLowerCase() === pattern);
        if (!existingAiRule) {
          newRules.push({
            id:         "ai" + Date.now() + Math.random().toString(36).slice(2),
            pattern:    merchant,
            matchType:  "contains",
            categoryId: catId,
            enabled:    true,
            source:     "ai",
            createdAt:  Date.now(),
          });
        }
      }

      // Only assign to currently uncategorized — never overwrite
      const updatedTxnIds = [];
      setTransactions(prev => prev.map(t => {
        if (assignments[t.id] && !t.categoryId) {
          updatedTxnIds.push(t.id);
          return { ...t, categoryId: assignments[t.id], reviewed: true };
        }
        return t;
      }));
      Object.entries(assignments).forEach(([txnId, catId]) => {
        if (updatedTxnIds.includes(txnId))
          api.updateTransaction(txnId, { categoryId: catId, reviewed: true, userCategorized: false }).catch(console.error);
      });

      if (newRules.length > 0) {
        setRules(prev => [...prev, ...newRules]);
        newRules.forEach(r => api.createRule(r).catch(console.error));
      }

      return count;
    } catch (e) {
      if (!e.message?.includes("no_api_key")) console.warn("Auto-categorize failed:", e.message);
      return 0;
    } finally {
      setAutoCatRunning(false);
    }
  }

  async function confirmCatSuggestions(confirmed) {
    setCatSuggestions(null);
    if (!confirmed?.length) return;

    const newCats = confirmed.map(s => ({
      id:              "cat" + Date.now() + Math.random().toString(36).slice(2),
      name:            s.name,
      color:           s.color || "var(--cyan)",
      limit:           parseFloat(s.limit) || 0,
      completedMonths: [],
    }));
    setCategories(prev => [...prev, ...newCats]);

    const catByName = Object.fromEntries(newCats.map(c => [c.name, c.id]));
    const assignments = {};
    const newRules = [];
    const seenMerchants = new Set();

    confirmed.forEach(s => {
      const catId = catByName[s.name];
      if (!catId) return;
      (s.transactions || []).forEach(txnId => { assignments[txnId] = catId; });
      (s.transactions || []).forEach(txnId => {
        const txn = transactions.find(t => t.id === txnId);
        if (!txn) return;
        const merchant = (txn.merchant || txn.name || "").trim();
        const pattern  = merchant.toLowerCase();
        if (!merchant || seenMerchants.has(pattern)) return;
        seenMerchants.add(pattern);
        newRules.push({
          id:         "ai" + Date.now() + Math.random().toString(36).slice(2),
          pattern:    merchant,
          matchType:  "contains",
          categoryId: catId,
          enabled:    true,
          source:     "ai",
          createdAt:  Date.now(),
        });
      });
    });

    setTransactions(prev => prev.map(t =>
      assignments[t.id] && !t.categoryId
        ? { ...t, categoryId: assignments[t.id], reviewed: true }
        : t
    ));
    Object.entries(assignments).forEach(([txnId, catId]) => {
      api.updateTransaction(txnId, { categoryId: catId, reviewed: true, userCategorized: false }).catch(console.error);
    });
    setRules(prev => [...prev, ...newRules]);
    newRules.forEach(r => api.createRule(r).catch(console.error));

    showToast(`✦ Created ${newCats.length} categories, assigned ${Object.keys(assignments).length} transactions`);
  }

  function updateTxnAcct(id,val) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,accountId:val||null}:t));
    api.updateTransaction(id, { accountId: val || null }).catch(console.error);
  }
  const _debouncedSaveNotes = useMemo(() => debounce((id, val) => api.updateTransaction(id, { notes: val }).catch(console.error), 800), []);
  function updateTxnNotes(id,val) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,notes:val}:t));
    _debouncedSaveNotes(id, val);
  }
  function deleteTxn(id) {
    const txn = transactions.find(t=>t.id===id);
    if (!txn) return;
    // Move to trash immediately
    const trashed = { ...txn, deletedAt: new Date().toISOString() };
    setTransactions(p=>p.filter(t=>t.id!==id));
    setDeletedTransactions(p => {
      const next = [trashed, ...p];
      scheduleSaveRef.current?.({ deletedTransactions: next });
      return next;
    });
    showUndoToast("Moved to trash", () => {
      // Undo — restore from trash
      setTransactions(p=>[txn,...p]);
      setDeletedTransactions(p => {
        const next = p.filter(t=>t.id!==id);
        scheduleSaveRef.current?.({ deletedTransactions: next });
        return next;
      });
    });
    // Actually delete on backend after undo window (4.2s)
    setTimeout(() => api.deleteTransaction(id).catch(console.error), 4200);
  }
  // ── Recurring Item CRUD ───────────────────────────────────────────
  function saveRecurringItem(item) {
    const next = editingRecurringItem
      ? recurringItems.map(r => r.id === item.id ? item : r)
      : [...recurringItems, item];
    setRecurringItems(next);
    scheduleSaveRef.current?.({ recurringItems: next });
  }
  function deleteRecurringItem(id) {
    // Unlink any transactions that were linked to this item
    setTransactions(prev => prev.map(t => t.recurringItemId === id ? { ...t, recurringItemId: null } : t));
    const next = recurringItems.filter(r => r.id !== id);
    setRecurringItems(next);
    scheduleSaveRef.current?.({ recurringItems: next });
    showToast("Recurring item removed");
  }
  function linkTxnToRecurringItem(txnId, itemId) {
    const item = recurringItems.find(r => r.id === itemId);
    if (!item) return;
    const txn = transactions.find(t => t.id === txnId);
    const linkedIds = [...new Set([...(item.linkedTxnIds||[]), txnId])];

    // Auto-populate amount range from linked transactions if not manually set
    let amountUpdate = {};
    if (txn && item.amountMin == null && item.amountMax == null) {
      const amt = Math.abs(txn.amount);
      amountUpdate = { amountMin: amt, amountMax: amt };
    } else if (txn) {
      // Widen the range if this txn is outside it
      const amt = Math.abs(txn.amount);
      const newMin = item.amountMin != null ? Math.min(item.amountMin, amt) : amt;
      const newMax = item.amountMax != null ? Math.max(item.amountMax, amt) : amt;
      if (newMin !== item.amountMin || newMax !== item.amountMax) {
        amountUpdate = { amountMin: newMin, amountMax: newMax };
      }
    }

    const next = recurringItems.map(r => r.id === itemId ? { ...r, linkedTxnIds: linkedIds, ...amountUpdate } : r);
    setRecurringItems(next);
    scheduleSaveRef.current?.({ recurringItems: next });

    // Also update riForm so the modal reflects the new amounts immediately
    if (Object.keys(amountUpdate).length > 0) {
      setRiForm(p => ({
        ...p,
        amountMin: amountUpdate.amountMin != null ? String(amountUpdate.amountMin) : p.amountMin,
        amountMax: amountUpdate.amountMax != null ? String(amountUpdate.amountMax) : p.amountMax,
      }));
      setEditingRecurringItem(prev => prev ? { ...prev, linkedTxnIds: linkedIds, ...amountUpdate } : prev);
    } else {
      setEditingRecurringItem(prev => prev ? { ...prev, linkedTxnIds: linkedIds } : prev);
    }

    setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, recurringItemId: itemId } : t));
    api.updateTransaction(txnId, { recurringItemId: itemId }).catch(console.error);
  }
  // Auto-link a transaction to a recurring item based on name + amount + date proximity
  function autoLinkTransaction(txn, recurringItemsList) {
    if (!txn || txn.recurringItemId) return; // already linked
    const txnAmt = Math.abs(txn.amount);
    const txnDate = txn.date ? parseInt(txn.date.split("-")[2]) : null;
    const txnName = (txn.name || txn.merchant || "").toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    recurringItemsList.forEach(item => {
      // Skip income items for expense txns and vice versa
      if (item.type === "income" && txn.amount < 0) return;
      if (item.type !== "income" && txn.amount > 0) return;

      const itemName = (item.name || "").toLowerCase();

      // Name similarity — check if either contains the other or share significant words
      const itemWords = itemName.split(/\s+/).filter(w => w.length > 2);
      const nameMatch = txnName.includes(itemName) || itemName.includes(txnName) ||
        itemWords.some(w => txnName.includes(w));
      if (!nameMatch) return;

      let score = 1;

      // Amount proximity — within 20% of amountMin
      if (item.amountMin != null && item.amountMin > 0) {
        const diff = Math.abs(txnAmt - item.amountMin) / item.amountMin;
        if (diff > 0.3) return; // too different
        score += diff < 0.05 ? 3 : diff < 0.15 ? 2 : 1;
      }

      // Date proximity — within 5 days of recurringDay
      if (item.recurringDay && txnDate) {
        const dayDiff = Math.abs(txnDate - parseInt(item.recurringDay));
        if (dayDiff <= 2) score += 3;
        else if (dayDiff <= 5) score += 1;
      }

      if (score > bestScore) { bestScore = score; bestMatch = item; }
    });

    if (bestMatch && bestScore >= 2) {
      linkTxnToRecurringItem(txn.id, bestMatch.id);
    }
  }

  function unlinkTxnFromRecurringItem(txnId, itemId) {
    const next = recurringItems.map(r => r.id === itemId
      ? { ...r, linkedTxnIds: (r.linkedTxnIds||[]).filter(id => id !== txnId) }
      : r);
    setRecurringItems(next);
    scheduleSaveRef.current?.({ recurringItems: next });
    setTransactions(prev => prev.map(t => t.id === txnId ? { ...t, recurringItemId: null } : t));
    api.updateTransaction(txnId, { recurringItemId: null }).catch(console.error);
  }
  function openNewRecurringItem() {
    setEditingRecurringItem(null);
    setRiForm({ name:"", amountMin:"", amountMax:"", recurringDay:"", recurringFreq:"monthly", recurringStart:"", categoryId:"", accountId:"", type:"expense" });
    setRiSearch(""); setRiSearchResults([]);
    setRecurringItemModal(true);
  }
  function openEditRecurringItem(item) {
    setEditingRecurringItem(item);
    // Compute average from linked transactions if no amount set yet
    const linkedAmts = (item.linkedTxnIds||[])
      .map(id => transactions.find(t => t.id === id))
      .filter(Boolean)
      .map(t => Math.abs(t.amount));
    const avg = linkedAmts.length > 0
      ? (linkedAmts.reduce((a,b) => a+b, 0) / linkedAmts.length).toFixed(2)
      : null;
    const prefilledAmount = item.amountMin != null ? String(item.amountMin) : (avg || "");
    setRiForm({ name:item.name||"", amountMin:prefilledAmount, amountMax:prefilledAmount, recurringDay:item.recurringDay||"", recurringFreq:item.recurringFreq||"monthly", recurringStart:item.recurringStart||"", categoryId:item.categoryId||"", accountId:item.accountId||"", type:item.type||"expense" });
    setRiSearch(""); setRiSearchResults([]);
    setRecurringItemModal(true);

    // Fetch any linked transactions not yet in local state
    const linkedIds = item.linkedTxnIds||[];
    const missingIds = linkedIds.filter(id => !transactions.find(t => t.id === id));
    if (missingIds.length > 0) {
      // Load a large batch and pick out the ones we need by ID
      api.loadTransactions({ limit: 1000, offset: 0 })
        .then(r => {
          const found = (r.transactions||[]).filter(t => missingIds.includes(t.id));
          if (found.length > 0) {
            setTransactions(prev => {
              const existingIds = new Set(prev.map(t => t.id));
              return [...prev, ...found.filter(t => !existingIds.has(t.id))];
            });
          }
        })
        .catch(console.error);
    }
  }
  async function searchTxnsForRI() {
    if (!riSearch.trim()) return;
    setRiSearchLoading(true);
    try {
      const searchLower = riSearch.trim().toLowerCase();

      // Fetch all matching transactions directly from the server — no pagination limit
      // This ensures results are complete regardless of how many txns are loaded locally
      const pages = await Promise.all([
        api.loadTransactions({ limit: 500, offset: 0,   search: riSearch.trim() }),
        api.loadTransactions({ limit: 500, offset: 500, search: riSearch.trim() }),
      ]);
      const serverTxns = pages.flatMap(p => p.transactions || []);

      // Also check local state to catch any unsaved/in-memory transactions
      const localOnly = transactions.filter(t => {
        if (serverTxns.find(s => s.id === t.id)) return false; // already in server results
        const m = (t.merchant||"").toLowerCase();
        const n = (t.name||"").toLowerCase();
        return m.includes(searchLower) || n.includes(searchLower);
      });

      const merged = [...serverTxns, ...localOnly]
        .sort((a,b) => (b.date||"").localeCompare(a.date||""));

      setRiSearchResults(merged.slice(0, 100));
    } catch(e) { showToast("Search failed: " + e.message); }
    setRiSearchLoading(false);
  }
  function saveRecurringItemForm() {
    if (!riForm.name.trim()) return;
    const item = {
      id: editingRecurringItem ? editingRecurringItem.id : "ri"+Date.now(),
      name: riForm.name.trim(),
      amountMin: riForm.amountMin !== "" ? parseFloat(riForm.amountMin) : null,
      amountMax: riForm.amountMax !== "" ? parseFloat(riForm.amountMax) : null,
      recurringDay: parseInt(riForm.recurringDay)||null,
      recurringFreq: riForm.recurringFreq||"monthly",
      recurringStart: riForm.recurringStart||null,
      categoryId: riForm.categoryId||null,
      accountId: riForm.accountId||null,
      type: riForm.type||"expense",
      linkedTxnIds: editingRecurringItem ? ((recurringItems.find(r=>r.id===editingRecurringItem.id)||editingRecurringItem).linkedTxnIds||[]) : [],
    };
    saveRecurringItem(item);
    setRecurringItemModal(false);
    setEditingRecurringItem(null);
    showToast(editingRecurringItem ? "Updated" : "Recurring item added");
  }

  function toggleRecurring(id) {
    setTransactions(p=>p.map(t=>{
      if(t.id!==id) return t;
      const on=!t.recurring;
      const autoDay=t.date?parseInt(t.date.split("-")[2]):null;
      const updated = {...t, recurring:on, recurringDay:on?(t.recurringDay||autoDay):null,
        recurringFreq: on?(t.recurringFreq||"monthly"):null,
        recurringStart: on?(t.recurringStart||t.date||null):null};
      api.updateTransaction(id, { recurring: updated.recurring, recurringDay: updated.recurringDay, recurringFreq: updated.recurringFreq, recurringStart: updated.recurringStart }).catch(console.error);
      return updated;
    }));
  }
  function updateRecurringDay(id,day) {
    const val = parseInt(day) || null;
    setTransactions(p=>p.map(t=>t.id===id?{...t,recurringDay:val}:t));
    api.updateTransaction(id, { recurringDay: val }).catch(console.error);
  }
  function openAddTxn() {
    setTxnForm({merchant:"",amount:"",date:today.toISOString().slice(0,10),categoryId:"",accountId:"",sign:"-1"});
    setModal("addTxn");
  }
  function saveManualTxn() {
    if(!txnForm.merchant.trim()||!txnForm.amount) return;
    const newTxn = {id:"m"+Date.now(),date:txnForm.date,merchant:txnForm.merchant.trim(),name:"",
      amount:parseFloat(txnForm.amount)*parseInt(txnForm.sign),categoryId:txnForm.categoryId||null,
      accountId:txnForm.accountId||null,recurring:false,recurringDay:null,
      type:txnForm.sign==="-1"?"expense":"income"};
    setTransactions(p=>[newTxn,...p]);
    api.createTransaction(newTxn).catch(console.error);
    setModal(null); showToast("Transaction added");
  }

  /* -- Drill-down modal -- */
  const showDrillModal = drillCat && (view !== "budgets" || isMobile);
  const DrillDownModal = showDrillModal ? (
    <div style={S.overlay} className="ledgr-overlay-anim" onClick={e=>e.target===e.currentTarget&&setDrillCat(null)}>
      <div style={{...S.modal,width:620,maxHeight:"85vh",display:"flex",flexDirection:"column",padding:20}} className="ledgr-modal-anim">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{width:11,height:11,borderRadius:"50%",background:drillCat.color,display:"inline-block",flexShrink:0}}/>
            <div style={{fontSize:17,fontWeight:700,color:"var(--t1)"}}>{drillCat.name}</div>
          </div>
          <button onClick={()=>setDrillCat(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:20,padding:"4px 8px"}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12,flexShrink:0}}>
          {[
            {label:"Spent",value:fmt(spentByCat[drillCat.id]||0),color:drillCat.color},
            {label:"Budget",value:fmt(drillCat.limit),color:"var(--t2)"},
            {label:"Remaining",value:fmt(drillCat.limit-(spentByCat[drillCat.id]||0)),color:(spentByCat[drillCat.id]||0)<=drillCat.limit?"var(--green)":"var(--red)"},
            {label:"Transactions",value:catTxns.length,color:"var(--t1)"},
          ].map(s=>(
            <div key={s.label} style={{background:"var(--surface)",border:"none",borderRadius:"var(--radius)",padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>{s.label}</div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:600,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:14,flexShrink:0}}>
          <div style={{height:5,background:"var(--border)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,
              background:(spentByCat[drillCat.id]||0)>=drillCat.limit?"var(--red)":(spentByCat[drillCat.id]||0)/drillCat.limit>=0.8?"var(--amber)":drillCat.color,
              width:`${Math.min(((spentByCat[drillCat.id]||0)/drillCat.limit)*100,100)}%`,transition:"width 0.5s"}} className={budgetBarsAnimated.current?"ledgr-bar":"ledgr-bar ledgr-bar-anim"}/>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {catTxns.length===0
            ? <div style={{textAlign:"center",padding:"40px 0",color:"var(--t3)"}}>No transactions in {monthLabel(selectedMonth)}</div>
            : catTxns.map((t,i)=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 4px",borderBottom:i<catTxns.length-1?"1px solid var(--border)":"none",flexWrap:"wrap"}}>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",whiteSpace:"nowrap",flexShrink:0}}>{t.date}</div>
                  <div style={{flex:1,minWidth:80,fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:"var(--red)",flexShrink:0,minWidth:70,textAlign:"right"}}>{fmt(Math.abs(t.amount))}</div>
                </div>
              ))
          }
        </div>
        <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)",display:"flex",justifyContent:"flex-end",flexShrink:0}}>
          <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>setDrillCat(null)}>Close</button>
        </div>
      </div>
    </div>
  ) : null;

  /* -----------------------------------------------------------------
     SCREENS
  ----------------------------------------------------------------- */

  /* -- Dashboard -- */
  const budgetAnalytics = useMemo(() => {
    const spentCats = categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        spent: spentByCat[c.id] || 0,
        limit: c.limit || 0,
      }))
      .filter((c) => c.spent > 0)
      .sort((a, b) => b.spent - a.spent);

    const totalSpentForBreakdown = spentCats.reduce((sum, c) => sum + c.spent, 0);
    const topBreakdownCats = spentCats;
    const donutCats = spentCats.slice(0, 8);

    const monthlyMap = {};
    transactions.forEach((t) => {
      if (!t.date) return;
      const ym = t.date.slice(0, 7);
      if (!monthlyMap[ym]) monthlyMap[ym] = { income: 0, spending: 0 };
      if (t.amount > 0) monthlyMap[ym].income += t.amount;
      if (t.amount < 0) monthlyMap[ym].spending += Math.abs(t.amount);
    });

    const [selY, selM] = selectedMonth.split("-").map(Number);
    const monthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selY, selM - 1 - i, 1);
      monthKeys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }

    const cashFlowSeries = monthKeys.map((ym) => {
      const row = monthlyMap[ym] || { income: 0, spending: 0 };
      const [y, m] = ym.split("-").map(Number);
      return {
        key: ym,
        label: new Date(y, m - 1, 1).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        income: row.income,
        spending: row.spending,
      };
    });

    const avgDelta =
      cashFlowSeries.length > 0
        ? cashFlowSeries.reduce((sum, m) => sum + (m.spending - m.income), 0) / cashFlowSeries.length
        : 0;

    const topOverspent = categories
      .map((c) => {
        const spent = spentByCat[c.id] || 0;
        const remaining = (c.limit || 0) - spent;
        return {
          id: c.id,
          name: c.name,
          color: c.color,
          spent,
          limit: c.limit || 0,
          overBy: remaining < 0 ? Math.abs(remaining) : 0,
        };
      })
      .filter((c) => c.overBy > 0)
      .sort((a, b) => b.overBy - a.overBy)
      .slice(0, 4);

    return {
      topBreakdownCats,
      donutCats,
      totalSpentForBreakdown,
      cashFlowSeries,
      avgDelta,
      topOverspent,
    };
  }, [categories, spentByCat, transactions, selectedMonth]);


  /* ── BudgetSummaryCard ─────────────────────────────────── */
  const BudgetSummaryCard = (
    <div
      style={{
        background: "var(--card)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.2px",
          color: "var(--t3)",
          fontFamily: "var(--font-disp)",
          marginBottom: 10,
        }}
      >
        Summary
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          ["Budgeted", fmt(totalBudget), "var(--t1)"],
          ["Spent", fmt(totalSpent), "var(--t1)"],
          ["Left", fmt(totalBudget - totalSpent), totalBudget - totalSpent >= 0 ? "var(--green)" : "var(--red)"],
        ].map(([label, value, color]) => (
          <div key={label}>
            <div
              style={{
                fontSize: 10,
                color: "var(--t3)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 4,
                fontFamily: "var(--font-disp)",
              }}
            >
              {label}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );


  /* ── SpendingBreakdownCard ─────────────────────────────────── */
  const SpendingBreakdownCard = (
    <div className="obsidian-card" style={{ ...S.card, height:isMobile?"auto":"395px", boxSizing:"border-box", overflow:"hidden" }}>
      <div style={{ ...S.sectionHdr, marginBottom: 8, paddingLeft: 22 }}>
        <div style={S.cardTitle}>Spending Breakdown</div>
      </div>

      {budgetAnalytics.totalSpentForBreakdown > 0 ? (
        <>
          <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 14px" }}>
            {(() => {
              const size = 180;
              const stroke = 18;
              const radius = (size - stroke) / 2;
              const circumference = 2 * Math.PI * radius;
              let offsetAcc = 0;
              return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={stroke}
                  />
                  {budgetAnalytics.donutCats.map((cat) => {
                    const fraction = cat.spent / budgetAnalytics.totalSpentForBreakdown;
                    const dash = fraction * circumference;
                    const gap = circumference - dash;
                    const circle = (
                      <circle
                        key={cat.id}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={cat.color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={`${dash} ${gap}`}
                        strokeDashoffset={-offsetAcc}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        />
                    );
                    offsetAcc += dash;
                    return circle;
                  })}
                  <text
                    x="50%"
                    y="47%"
                    textAnchor="middle"
                    fill="var(--t1)"
                    style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)" }}
                  >
                    {fmt(budgetAnalytics.totalSpentForBreakdown)}
                  </text>
                  <text x="50%" y="58%" textAnchor="middle" fill="var(--t3)" style={{ fontSize: "10px" }}>
                    Total
                  </text>
                </svg>
              );
            })()}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {budgetAnalytics.topBreakdownCats.map((cat) => (
              <div key={cat.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                  <span style={{ color: "var(--t2)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat.name}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>
                  {fmt(cat.spent)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ color: "var(--t3)", padding: "12px 0" }}>No spending data for this month.</div>
      )}
    </div>
  );


  /* ── AccountBalanceStrip ──────────────────────────────────── */
  const AccountBalanceStrip = accounts.length === 0 ? null : (
    <div className="obsidian-card" style={{...S.card, padding:0, overflow:"hidden"}}>
      <div
        style={{display:"flex",overflowX:"auto",scrollbarWidth:"thin",scrollbarColor:"var(--border2) transparent",alignItems:"center",WebkitOverflowScrolling:"touch"}}
        onWheel={e=>{e.currentTarget.scrollLeft+=e.deltaY;}}
      >
        {accounts.map((acct, i) => {
          const t = (acct.type||"").toLowerCase();
          const color = t.includes("credit") ? "var(--red)" : t.includes("saving") ? "var(--green)" : "var(--cyan)";
          return (
            <div key={acct.id} onClick={()=>navigate("accounts")}
              style={{flexShrink:0,display:"flex",alignItems:"center",gap:6,padding:"9px 14px",
                borderRight:i<accounts.length-1?"1px solid var(--border2)":"none",cursor:"pointer"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0}}/>
              <span style={{fontSize:11,color:"var(--t2)",whiteSpace:"nowrap"}}>{acct.name}</span>
              <span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color,whiteSpace:"nowrap"}}>
                {acct.balance != null ? fmt(Math.abs(acct.balance)) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── CashFlowCard ─────────────────────────────────── */
  const CashFlowCard = (
    <div className="obsidian-card" style={{ ...S.card }}>
      <div style={{ ...S.sectionHdr, marginBottom: 8 }}>
        <div style={S.cardTitle}>Cash Flow</div>
      </div>

      <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 14 }}>
        On average, spending{" "}
        <span style={{ color: budgetAnalytics.avgDelta > 0 ? "var(--red)" : "var(--green)", fontWeight: 700 }}>
          {fmt(Math.abs(budgetAnalytics.avgDelta))}/month
        </span>{" "}
        {budgetAnalytics.avgDelta > 0 ? "more than earning" : "less than earnings"}
      </div>

      {(() => {
        const maxVal = Math.max(1, ...budgetAnalytics.cashFlowSeries.flatMap((m) => [m.income, m.spending]));
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap:10, marginBottom: 10, fontSize: 12, color: "var(--t2)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />
                Income
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c95ff" }} />
                Spending
              </span>
            </div>

            <div
              style={{
                height: 220,
                display: "flex",
                alignItems: "flex-end",
                gap:10,
                padding: "10px 4px 0",
                borderTop: "1px solid var(--border)",
                overflowX: isMobile ? "auto" : "visible",
              }}
            >
              {budgetAnalytics.cashFlowSeries.map((m) => {
                const incomeH = Math.max(6, (m.income / maxVal) * 180);
                const spendingH = Math.max(6, (m.spending / maxVal) * 180);
                return (
                  <div
                    key={m.key}
                    style={{
                      flex: isMobile ? "0 0 auto" : 1,
                      minWidth: isMobile ? 40 : 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180 }}>
                      <div title={`Income: ${fmt(m.income)}`} style={{ width: 16, height: incomeH, borderRadius: "8px 8px 0 0", background: "var(--green)" }} />
                      <div title={`Spending: ${fmt(m.spending)}`} style={{ width: 16, height: spendingH, borderRadius: "8px 8px 0 0", background: "#7c95ff" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t3)", whiteSpace: "nowrap" }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );


  /* ── OverspendingHighlightsCard ─────────────────────────────────── */
  const OverspendingHighlightsCard = (
    <div className="obsidian-card" style={{ ...S.card }}>
      <div style={{ ...S.sectionHdr, marginBottom: 10 }}>
        <div style={S.cardTitle}>Overspending Highlights</div>
      </div>

      {budgetAnalytics.topOverspent.length === 0 ? (
        <div style={{ color: "var(--green)", fontSize: 13 }}>No categories are over budget right now.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {budgetAnalytics.topOverspent.map((cat) => (
            <div key={cat.id} style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: "12px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat.name}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--red)" }}>
                  +{fmt(cat.overBy)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)" }}>Spent <span className="ledgr-amt">{fmt(cat.spent)}</span> of <span className="ledgr-amt">{fmt(cat.limit)}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const reviewCount = transactions.filter(t => needsReview(t)).length;

  // Notification list — shared by bell popout and dashboard cards
  const notifList = useMemo(() => {
    const todayStr = today.toISOString().slice(0,10);
    const goalReminders = (goals||[]).flatMap(g => {
      if (!g.startDate || !g.deadline || !g.period) return [];
      const start = new Date(g.startDate + "T12:00:00");
      const end   = new Date(g.deadline  + "T12:00:00");
      const periodDays = { week:7, biweekly:14, month:30, quarter:91, year:365 }[g.period] || 30;
      const dates = [];
      let d = new Date(end);
      while (d >= start) { dates.unshift(d.toISOString().slice(0,10)); d = new Date(d.getTime() - periodDays*86400000); }
      return dates.includes(todayStr) ? [{ id:`goal-${g.id}`, type:"goal", goal:g }] : [];
    });
    // One notification per stale item so the user can see exactly which bank needs attention
    const reauthNotifs = [...staleItemIds].map(itemId => {
      const item = plaidItems.find(i => i.item_id === itemId);
      return { id:`reauth-${itemId}`, type:"reauth", itemId, institution: item?.institution || "Connected bank" };
    });
    return [
      ...reauthNotifs,
      ...(reviewCount > 0 ? [{ id:"review", type:"review", count:reviewCount }] : []),
      ...goalReminders,
      ...newTxnNotifs,
      ...(pendingDuplicates?.count > 0 ? [{
        id: "duplicates",
        type: "duplicates",
        count: pendingDuplicates.count,
      }] : []),
    ];
  }, [reviewCount, goals, today, staleItemIds, plaidItems, newTxnNotifs, pendingDuplicates]);

  const visibleNotifs = useMemo(
    () => notifList.filter(n => !dismissedNotifs.has(n.id)),
    [notifList, dismissedNotifs]
  );
  const notifCount = visibleNotifs.length;
  const isNewUser = transactions.length === 0 && plaidItems.length === 0 && accounts.length === 0;

  // Onboarding steps — checked off as user completes them
  const onboardingSteps = [
    {
      id: "bank",
      done: plaidItems.length > 0 || accounts.length > 0,
      icon: "▣",
      title: "Connect your bank",
      desc: "Link a bank account to automatically import transactions.",
      action: () => navigate("accounts"),
      cta: "Go to Accounts ←",
    },
    {
      id: "categories",
      done: categories.length > 0,
      icon: "◉",
      title: "Create budget categories",
      desc: "Set up spending categories with limits to track your budget.",
      action: () => navigate("budgets"),
      cta: "Go to Budgets ←",
    },
    {
      id: "rules",
      done: rules.length > 0 || transactions.some(t => t.categoryId),
      icon: "◎",
      title: "Categorize a transaction",
      desc: "Review your transactions and assign categories. Set up rules to auto-categorize going forward.",
      action: () => navigate("transactions"),
      cta: "Go to Transactions ←",
    },
  ];
  const onboardingComplete = onboardingSteps.every(s => s.done);
  const onboardingProgress = onboardingSteps.filter(s => s.done).length;

  /* -- useDashboardOrder hook -- */
  const { cols: dashCols, moveItem: dashMoveItem, moveToCol: dashMoveToCol } = useDashboardColumns(dashboardCardOrder, scheduleSaveRef, setDashboardCardOrder);
  const [dashEditMode, setDashEditMode] = useState(false);

  // dashOrder from useDashboardOrder is the source of truth for rendering

  /* -- Dashboard card definitions -- */
  const dashCardDefs = useMemo(() => {
    const now = Date.now();
    const atRisk = goals.filter(g => {
      const pct = g.targetAmount > 0 ? (g.savedAmount||0)/g.targetAmount : 0;
      const dl = g.deadline ? new Date(g.deadline).getTime() : null;
      const dl_days = dl ? Math.ceil((dl-now)/86400000) : null;
      return pct < 0.9 && (dl_days === null || dl_days < 90);
    });
    const todayD = today.getDate();
    const currentMonth = today.toISOString().slice(0,7); // "YYYY-MM"
    const [curY, curM] = [today.getFullYear(), today.getMonth()+1];
    const upcoming = [...recurringItems]
      .filter(item => {
        if (!item.recurringDay || item.recurringFreq !== "monthly") return false;
        // Show all unposted items for the current month regardless of day
        const postedThisMonth = (item.linkedTxnIds||[]).some(txnId => {
          const t = transactions.find(x => x.id === txnId);
          if (!t || !t.date) return false;
          const [ty, tm] = t.date.split("-").map(Number);
          return ty === curY && tm === curM;
        });
        return !postedThisMonth;
      })
      .sort((a,b) => (parseInt(a.recurringDay)||0)-(parseInt(b.recurringDay)||0))
      .slice(0,5);

    return {
      spending: SpendingBreakdownCard,
      balances: AccountBalanceStrip,
      budget: (
        <div className="obsidian-card ledgr-budget-gradient" style={{...S.card, height:isMobile?"auto":"395px", boxSizing:"border-box", overflow:"hidden"}}>
          <div style={{...S.sectionHdr,marginBottom:8,paddingLeft:22}}>
            <div style={S.cardTitle}>Budget Progress</div>
            <button style={{...S.btn("ghost",true),color:"var(--cyan)"}} className="ledgr-btn" onClick={()=>navigate("budgets")}>All →</button>
          </div>
          {categories.length===0
            ? <div className="ledgr-empty"><div className="ledgr-empty-icon">🏷️</div><div className="ledgr-empty-title">No categories yet</div><div>Add a category to start tracking budgets</div></div>
            : <div style={{overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"6px auto 1fr auto",alignItems:"center",columnGap:8,rowGap:7}}>
                {(isMobile ? sortedCategories.slice(0,5) : [...sortedCategories].sort((a,b) => {
                    const remA = a.limit - (spentByCat[a.id]||0);
                    const remB = b.limit - (spentByCat[b.id]||0);
                    const doneA = remA === 0 || (a.completedMonths||[]).includes(selectedMonth);
                    const doneB = remB === 0 || (b.completedMonths||[]).includes(selectedMonth);
                    if (doneA && !doneB) return 1;
                    if (!doneA && doneB) return -1;
                    return remA - remB;
                  }).slice(0,15))
                  .map(cat=>{
                  const spent=spentByCat[cat.id]||0,remaining=cat.limit-spent;
                  const pct=Math.min((spent/cat.limit)*100,100),over=remaining<0,warn=pct>=80&&!over&&remaining!==0;
                  const complete=!over&&(cat.completedMonths||[]).includes(selectedMonth);
                  const barC=over?"var(--red)":warn?"var(--amber)":(remaining===0||complete)?"var(--t3)":cat.color;
                  const valColor=(complete||remaining===0)?"var(--t3)":over?"var(--red)":"var(--green)";
                  const valLabel=complete?"✓":over?`-${fmt(Math.abs(remaining))}`:remaining===0?"Full":fmt(remaining);
                  return (
                    <Fragment key={cat.id}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",justifySelf:"center"}}/>
                      <span style={{fontSize:12,fontWeight:500,color:"var(--t1)",whiteSpace:"nowrap",opacity:complete?0.6:1}}>{cat.name}</span>
                      <div style={{height:3,background:"rgba(255,255,255,0.07)",borderRadius:99,overflow:"hidden",cursor:"pointer",minWidth:0}} onClick={()=>setDrillCat(cat)}>
                        <div style={{height:"100%",borderRadius:99,width:`${complete?100:pct}%`,background:barC}} className={budgetBarsAnimated.current?"ledgr-bar":"ledgr-bar ledgr-bar-anim"}/>
                      </div>
                      <span style={{fontFamily:"var(--font-mono)",fontSize:11,fontWeight:600,color:valColor,whiteSpace:"nowrap",textAlign:"right"}}>{valLabel}</span>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          }
        </div>
      ),
      action: (
        <div className="obsidian-card" style={S.card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingLeft:22}}>
            <div style={S.cardTitle}>Action Items</div>
            {insightsTodos.length > 0 && (
              <button onClick={()=>{ const next=[]; setInsightsTodos(next); scheduleSaveRef.current?.({insightsTodos:next}); }}
                style={{...S.btn("ghost",true),color:"var(--cyan)"}}>Clear all</button>
            )}
          </div>
          {insightsTodos.length === 0 ? (
            <div style={{fontSize:12,color:"var(--t3)",textAlign:"center",padding:"20px 0",lineHeight:1.6}}>
              Go to <strong style={{color:"var(--t1)"}}>Analytics ← Insights</strong>, generate AI analysis, then tap <span style={{color:"var(--cyan)"}}>+ Add to To-Do</span>.
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {insightsTodos.map(todo => (
                <div key={todo.id} style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <button
                    onClick={()=>{ const next=insightsTodos.filter(t=>t.id!==todo.id); setInsightsTodos(next); scheduleSaveRef.current?.({insightsTodos:next}); }}
                    style={{width:16,height:16,borderRadius:3,border:"1.5px solid var(--border2)",background:"none",cursor:"pointer",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="var(--cyan)";e.currentTarget.style.borderColor="var(--cyan)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.borderColor="var(--border2)";}}>
                    <span style={{fontSize:9,color:"var(--cyan)",lineHeight:1}}>✓</span>
                  </button>
                  <span style={{fontSize:12,color:"var(--t2)",lineHeight:1.5,flex:1}}>{todo.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      goals: goals.length === 0 ? null : (
        <div className="obsidian-card" style={S.card}>
          <div style={{...S.sectionHdr,marginBottom:8,paddingLeft:22}}>
            <div style={S.cardTitle}>Goals</div>
            <button style={{...S.btn("ghost",true),color:"var(--cyan)"}} className="ledgr-btn" onClick={()=>{ setAnalyticsTab("goals"); navigate("analytics"); }}>All →</button>
          </div>
          {atRisk.length === 0 ? (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"var(--green-dim)",border:"1px solid var(--green)44",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:10,color:"var(--green)"}}>✓</span>
              </div>
              <div style={{fontSize:12,color:"var(--t2)"}}>All goals on track</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {atRisk.slice(0,3).map(g => {
                const pct = g.targetAmount > 0 ? Math.min(Math.round((g.savedAmount||0)/g.targetAmount*100),100) : 0;
                const deadline = g.deadline ? new Date(g.deadline) : null;
                const dl_days = deadline ? Math.ceil((deadline.getTime()-now)/86400000) : null;
                return (
                  <div key={g.id}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,marginRight:8}}>{g.title}</span>
                      <span style={{fontSize:11,fontFamily:"var(--font-mono)",color:pct<50?"var(--red)":"var(--amber)",flexShrink:0}}>{pct}%</span>
                    </div>
                    <div style={{height:3,background:"var(--border)",borderRadius:99,overflow:"hidden",marginBottom:2}}>
                      <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:pct<50?"var(--red)":"var(--amber)",transition:"width 0.5s"}} className={budgetBarsAnimated.current?"ledgr-bar":"ledgr-bar ledgr-bar-anim"}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t3)"}}>
                      <span>{fmt(g.savedAmount||0)} saved</span>
                      <span>{dl_days!=null?`${dl_days}d left`:fmt(g.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
      upcoming: (
        <div className="obsidian-card ledgr-txn-gradient" style={S.card}>
          <div style={{...S.sectionHdr,marginBottom:8,paddingLeft:22}}>
            <div style={S.cardTitle}>Upcoming</div>
            <button style={{...S.btn("ghost",true),color:"var(--cyan)"}} className="ledgr-btn" onClick={()=>navigate("transactions")}>All →</button>
          </div>
          {upcoming.length === 0
            ? <div style={{fontSize:12,color:"var(--t3)",padding:"4px 0 2px"}}>No upcoming transactions this month.</div>
            : <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {upcoming.map((t,i) => (
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<upcoming.length-1?"1px solid rgba(0,0,0,0.25)":"none"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:"var(--surface)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:10,fontFamily:"var(--font-mono)",color:"var(--t2)"}}>{t.recurringDay}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
                      <div style={{fontSize:10,color:"var(--t3)",marginTop:1}}>{catMap[t.categoryId]?.name||"Uncategorized"}</div>
                    </div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:600,color:"var(--red)",flexShrink:0}}>
                      {t.amountMin!=null?(t.type==="income"?"+":"")+fmt(t.amountMin):"—"}
                      {t.amountMin!=null&&t.amountMax!=null&&t.amountMax!==t.amountMin?`–${fmt(t.amountMax)}`:""}
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      ),
    };
  }, [goals, today, recurringTxns, recurringItems, transactions, categories, sortedCategories, spentByCat, selectedMonth,
      insightsTodos, isMobile, catMap]);

  const Dashboard = null; // rendered via early return above


  /* -- Transactions -- */

  /* ── Transactions — Clarity flat table ─────────────── */
  const Transactions = (
    <LedgrTransactions
      transactions={transactions}
      filteredTxns={filteredTxns}
      categories={categories}
      catMap={catMap}
      accounts={accounts}
      acctMap={acctMap}
      search={search}
      handleTxnSearchChange={handleTxnSearchChange}
      filterCat={filterCat}
      setFilterCat={setFilterCat}
      filterAcct={filterAcct}
      setFilterAcct={setFilterAcct}
      txnTypeFilter={txnTypeFilter}
      setTxnTypeFilter={setTxnTypeFilter}
      txnSortCol={txnSortCol}
      setTxnSortCol={setTxnSortCol}
      txnSortDir={txnSortDir}
      setTxnSortDir={setTxnSortDir}
      selectedTxns={selectedTxns}
      setSelectedTxns={setSelectedTxns}
      needsReview={needsReview}
      deleteTxn={deleteTxn}
      openAddTxn={openAddTxn}
      bulkSetCategory={bulkSetCategory}
      bulkDelete={bulkDelete}
      bulkMarkReviewed={bulkMarkReviewed}
      selectAllVisible={selectAllVisible}
      clearSelection={clearSelection}
      txnLoading={txnLoading}
      fmt={fmt}
      today={today}
      isMobile={isMobile}
      navigate={navigate}
      updateTxnType={updateTxnType}
      updateTxnCat={updateTxnCat}
      updateTxnNotes={updateTxnNotes}
      updateTxnName={updateTxnName}
      markReviewed={markReviewed}
      onMakeRecurring={(t) => {
        const raw = t.date || '';
        const day = raw.includes('-') ? raw.split('-')[2] : raw.split('/')[1] || '';
        setRiForm({
          name:           t.name || t.merchant || '',
          amountMin:      t.amount != null ? String(Math.abs(t.amount)) : '',
          amountMax:      t.amount != null ? String(Math.abs(t.amount)) : '',
          type:           t.amount >= 0 ? 'income' : 'expense',
          categoryId:     t.categoryId  || '',
          accountId:      t.accountId   || '',
          recurringFreq:  'monthly',
          recurringDay:   day ? String(parseInt(day)) : '',
          recurringStart: raw,
        });
        setCalendarOpenNewRi(true);
        navigate('calendar');
      }}
      doSync={doSync}
      syncing={syncing}
    />
  );


  function saveCatName(id) {
    const trimmed = editingCatName.trim();
    if (trimmed) {
      setCategories(p=>p.map(c=>c.id===id?{...c,name:trimmed}:c));
      showToast("Category renamed");
    }
    setEditingCatNameId(null);
  }

  function startEditLimit(cat, e) {
    e.stopPropagation();
    setEditingLimitId(cat.id);
    setEditingLimitVal(String(cat.limit));
  }

  function saveLimit(id) {
    const val = parseFloat(editingLimitVal);
    if (!isNaN(val) && val > 0) {
      setCategories(p=>p.map(c=>c.id===id?{...c,limit:val}:c));
      showToast("Budget updated");
    }
    setEditingLimitId(null);
  }

  async function runSuggestLimits() {
    if (!categories.length) return;
    setSuggestingLimits(true);
    try {
      const monthKeys = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const summaries = await Promise.all(monthKeys.map(m => api.loadSummary(m)));
      const months = summaries.map(s => ({ month: s.month, byCategory: s.spentByCat }));
      const avgIncome = summaries.reduce((a, s) => a + (s.totalIncome || 0), 0) / summaries.length;
      const { suggestions } = await api.suggestLimits(
        categories.map(c => ({ id: c.id, name: c.name, limit: c.limit || 0 })),
        months,
        avgIncome,
      );
      setLimitSuggestions(suggestions);
      if (!suggestions.length) showToast("Not enough spending history yet — need at least 2 months of data");
    } catch (e) {
      if (!e.message?.includes("no_api_key")) showToast("Suggestion failed: " + e.message);
    } finally {
      setSuggestingLimits(false);
    }
  }

  /* ── Budgets ─────────────────────────────────── */
  const Budgets = (() => {

    /* ── Compute category groups ─────────────────────── */
    const overCats     = sortedCategories.filter(c => (spentByCat[c.id]||0) > c.limit);
    const completedCats= sortedCategories.filter(c => !overCats.includes(c) && (c.completedMonths||[]).includes(selectedMonth));
    const progressCats = sortedCategories.filter(c => !overCats.includes(c) && !completedCats.includes(c));

    const rawPct    = totalBudget > 0 ? totalSpent / totalBudget : 0;
    const displayPct= Math.round(rawPct * 100);
    const budgetOver= rawPct > 1;

    /* ── Shared tier styles ─────────────────────────── */
    const tierBase = {
      padding: isMobile ? "28px 16px 32px" : "28px 28px 40px",
      borderBottom: "1px solid rgba(0,0,0,0.35)",
      position: "relative", overflow: "hidden",
    };
    const seam = (color="rgba(201,149,106,0.12)") => ({
      position:"absolute", top:0, left:0, right:0, height:1,
      background:`linear-gradient(90deg,${color},rgba(255,255,255,0.03) 40%,transparent 75%)`,
      pointerEvents:"none",
    });

    /* ── Section header ─────────────────────────────── */
    const SectionHdr = ({ord, title, sub, count, accentColor="rgba(201,149,106,0.45)", ruleColor="rgba(201,149,106,0.14)", ghost}) => (
      <div style={{marginBottom:18,position:"relative"}}>
        {ghost && !isMobile && (
          <div style={{position:"absolute",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:88,fontWeight:500,color:"rgba(201,149,106,0.07)",pointerEvents:"none",userSelect:"none",top:"50%",transform:"translateY(-60%)",left:8,lineHeight:1}}>
            {ghost}
          </div>
        )}
        <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"baseline",gap:12,paddingBottom:10,borderBottom:`1px solid ${ruleColor}`}}>
          <span style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:600,color:accentColor,letterSpacing:"1px",flexShrink:0}}>{ord} ·</span>
          <span style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontWeight:400,fontSize:isMobile?18:22,color:title==="Overspent"?"var(--red)":title==="Completed"?"var(--green)":"var(--t1)"}}>{title}</span>
          <div style={{flex:1,height:1,background:`linear-gradient(90deg,${ruleColor},transparent)`,alignSelf:"center"}}/>
          {count != null && <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--t3)",flexShrink:0}}>{count} {count===1?"category":"categories"}</span>}
        </div>
        {sub && <div style={{fontFamily:"var(--font-mono)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.7px",color:"var(--t3)",marginTop:5}}>{sub}</div>}
      </div>
    );

    /* ── Category row ───────────────────────────────── */
    const CatRow = ({cat}) => {
      const spent     = spentByCat[cat.id] || 0;
      const remaining = cat.limit - spent;
      const pct       = Math.min((spent / (cat.limit||1)) * 100, 100);
      const over      = remaining < 0;
      const warn      = pct >= 80 && !over;
      const complete  = !over && (cat.completedMonths||[]).includes(selectedMonth);
      const barColor  = over ? "var(--red)" : complete ? "rgba(255,255,255,0.1)" : warn ? "var(--amber)" : cat.color;
      const valColor  = over ? "var(--red)" : complete ? "var(--t3)" : remaining === 0 ? "var(--t3)" : "var(--green)";
      const valLabel  = over ? `−${fmt(Math.abs(remaining))} over` : complete ? "✓ done" : remaining === 0 ? "fully spent" : `${fmt(remaining)} left`;
      const expanded  = budgetExpandedCatId === cat.id;

      return (
        <div key={cat.id}>
          <div
            onClick={()=>{ setBudgetExpandedCatId(p=>p===cat.id?null:cat.id); setBudgetTxnSearch(""); }}
            style={{display:"flex",alignItems:"center",gap:10,padding:isMobile?"10px 0":"9px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",cursor:"pointer",transition:"background .12s",borderRadius:4}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            {/* Signal dot */}
            <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:barColor,boxShadow:over?"0 0 6px var(--red)":warn?"0 0 5px rgba(201,149,106,0.5)":"none"}}/>
            {/* Name */}
            {editingCatNameId===cat.id ? (
              <div onClick={e=>e.stopPropagation()} style={{minWidth:0,width:isMobile?100:120,flexShrink:0}}>
                <input autoFocus style={{...S.input,fontSize:12,padding:"2px 6px",width:"100%"}} value={editingCatName} onChange={e=>setEditingCatName(e.target.value)} onBlur={()=>saveCatName(cat.id)} onKeyDown={e=>{if(e.key==="Enter")saveCatName(cat.id);if(e.key==="Escape")setEditingCatNameId(null);}}/>
              </div>
            ) : (
              <span style={{fontSize:13,color:complete?"var(--t3)":"var(--t2)",width:isMobile?100:120,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",opacity:complete?0.55:1}}>{cat.name}</span>
            )}
            {/* Bar */}
            {!isMobile && (
              <div style={{flex:1.5,height:2,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",borderRadius:99,background:barColor,width:`${complete?100:pct}%`,transition:"width 0.5s"}} className={budgetBarsAnimated.current?"ledgr-bar":"ledgr-bar ledgr-bar-anim"}/>
              </div>
            )}
            {/* Spent / limit */}
            {!isMobile && (
              <>
                <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",width:54,textAlign:"right",flexShrink:0}}>{fmt(spent)}</span>
                <span style={{color:"var(--t3)",fontSize:10,opacity:.4,flexShrink:0}}>/</span>
                <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",width:50,flexShrink:0}}>
                  {editingLimitId===cat.id
                    ? <input type="number" autoFocus onClick={e=>e.stopPropagation()} style={{background:"none",border:"none",borderBottom:"1px solid var(--cyan)",fontSize:11,color:"var(--t1)",outline:"none",width:50,fontFamily:"var(--font-mono)"}} value={editingLimitVal} onChange={e=>setEditingLimitVal(e.target.value)} onBlur={()=>saveLimit(cat.id)} onKeyDown={e=>{if(e.key==="Enter")saveLimit(cat.id);if(e.key==="Escape")setEditingLimitId(null);}}/>
                    : <span onClick={e=>startEditLimit(cat,e)} style={{cursor:"text",textDecoration:"underline dotted",textUnderlineOffset:2}}>{fmt(cat.limit)}</span>
                  }
                </span>
              </>
            )}
            {/* Remaining */}
            <span style={{fontFamily:"var(--font-mono)",fontSize:isMobile?12:11,fontWeight:700,color:valColor,width:isMobile?undefined:88,textAlign:"right",flexShrink:0}}>{valLabel}</span>
            {/* Mobile bar */}
            {isMobile && (
              <div style={{width:60,height:2,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden",flexShrink:0}}>
                <div style={{height:"100%",borderRadius:99,background:barColor,width:`${complete?100:pct}%`}} className={budgetBarsAnimated.current?"ledgr-bar":"ledgr-bar ledgr-bar-anim"}/>
              </div>
            )}
            {/* Chevron + kebab */}
            <div style={{display:"flex",alignItems:"center",gap:2,flexShrink:0}} onClick={e=>e.stopPropagation()}>
              {!isMobile && (
                <span onClick={()=>{setBudgetExpandedCatId(p=>p===cat.id?null:cat.id);setBudgetTxnSearch("");}}
                  className={`ledgr-chevron${expanded?" ledgr-chevron-open":""}`}
                  style={{color:"var(--t3)",fontSize:10,cursor:"pointer",padding:"4px 2px"}}>▼</span>
              )}
              <div style={{position:"relative"}}>
                <button onClick={e=>{e.stopPropagation();setBudgetKebabId(p=>p===cat.id?null:cat.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:16,padding:"4px 4px",lineHeight:1,borderRadius:"var(--radius)"}}>⋯</button>
                {budgetKebabId===cat.id && (
                  <>
                    <div style={{position:"fixed",inset:0,zIndex:39}} onClick={()=>setBudgetKebabId(null)}/>
                    <div style={{position:"absolute",right:0,top:"100%",zIndex:40,background:"var(--card)",border:"none",borderRadius:"var(--radius)",boxShadow:"0 4px 16px #00000055",minWidth:160,overflow:"hidden"}}>
                      <button onClick={()=>{toggleCatComplete(cat.id);setBudgetKebabId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t1)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>{complete?"✓ Unmark Complete":"✓ Mark Complete"}</button>
                      <button onClick={e=>{e.stopPropagation();openEditCat(cat);setBudgetKebabId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t1)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>Edit Category</button>
                      <button onClick={e=>{e.stopPropagation();deleteCat(cat.id);setBudgetKebabId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--red)"}}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Expanded drill-down — Ledger Inline */}
          {expanded && (
            <div className="ledgr-expand" style={{margin:"0 0 4px 8px",padding:"14px 14px 14px 16px",background:"var(--bg)",borderRadius:0,borderLeft:`2px solid ${cat.color}`}} onClick={e=>e.stopPropagation()}>

              {/* Assigned transactions */}
              {(()=>{
                const catTxns = monthTxns.filter(t=>t.categoryId===cat.id&&t.amount<0).sort((a,b)=>b.date.localeCompare(a.date));
                return catTxns.length===0
                  ? <div style={{fontSize:12,color:"var(--t3)",marginBottom:12}}>No transactions assigned in {monthLabel(selectedMonth)}.</div>
                  : (
                    <div style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--font-mono)",fontSize:9,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--t3)",marginBottom:8}}>
                        <span>Assigned this month</span><span>{catTxns.length} transaction{catTxns.length!==1?"s":""}</span>
                      </div>
                      {catTxns.map(t=>(
                        <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                          <div style={{width:2,height:24,borderRadius:1,flexShrink:0,background:"rgba(255,255,255,0.12)"}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                            <div style={{fontSize:10,color:"var(--t3)",marginTop:1}}>{t.date}</div>
                          </div>
                          <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:"var(--red)",flexShrink:0}}>{fmt(Math.abs(t.amount))}</div>
                          <button title="Remove from this category" onClick={()=>{updateTxnCat(t.id,"");showToast("Removed from "+cat.name);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:14,padding:"2px 4px",lineHeight:1,flexShrink:0}}>✕</button>
                        </div>
                      ))}
                    </div>
                  );
              })()}

              {/* Divider */}
              <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"10px 0"}}/>

              {/* Assign section */}
              <div style={{fontFamily:"var(--font-mono)",fontSize:9,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--t3)",marginBottom:8}}>Manually assign a transaction</div>
              <input placeholder="Search by name or merchant…" value={budgetExpandedCatId===cat.id?budgetTxnSearch:""} onChange={e=>setBudgetTxnSearch(e.target.value)} onClick={e=>e.stopPropagation()} style={{...S.input,width:"100%",fontSize:12,padding:"7px 10px",marginBottom:8,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:"rgba(255,255,255,0.04)"}}/>
              {(()=>{
                const q=budgetTxnSearch.toLowerCase().trim();
                const candidates=monthTxns.filter(t=>t.amount<0&&t.categoryId!==cat.id).filter(t=>!q||(t.name||t.merchant||"").toLowerCase().includes(q)||(t.date||"").includes(q)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,q?20:2);
                if(!q&&candidates.length===0) return <div style={{fontSize:12,color:"var(--t3)"}}>All transactions in this month are already assigned here.</div>;
                return (
                  <div style={{display:"flex",flexDirection:"column",gap:2,maxHeight:240,overflowY:"auto"}}>
                    {candidates.length===0&&q&&<div style={{fontSize:12,color:"var(--t3)"}}>No matching transactions found.</div>}
                    {candidates.map(t=>(
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",marginBottom:3,borderRadius:6,background:"rgba(255,255,255,0.04)"}}>
                        <div style={{width:2,height:24,borderRadius:1,flexShrink:0,background:"rgba(255,255,255,0.07)"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                          <div style={{fontSize:10,color:"var(--t3)",marginTop:1}}>{t.date}{t.categoryId&&catMap[t.categoryId]&&<span style={{marginLeft:6,color:catMap[t.categoryId].color}}>· {catMap[t.categoryId].name}</span>}{!t.categoryId&&<span style={{marginLeft:6,color:"var(--t3)"}}>· Uncategorized</span>}</div>
                        </div>
                        <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:"var(--red)",flexShrink:0,whiteSpace:"nowrap"}}>{fmt(Math.abs(t.amount))}</div>
                        <button onClick={()=>{updateTxnCat(t.id,cat.id);setBudgetTxnSearch("");showToast("Assigned to "+cat.name);}} style={{background:"rgba(201,149,106,0.1)",border:"1px solid rgba(201,149,106,0.25)",borderRadius:6,color:"var(--cyan)",fontSize:11,fontWeight:600,cursor:"pointer",padding:"4px 10px",flexShrink:0,whiteSpace:"nowrap",fontFamily:"var(--fb)"}}>+ Assign</button>
                      </div>
                    ))}
                    {!q&&<div style={{fontSize:11,color:"var(--t3)",textAlign:"center",paddingTop:4}}>Showing 5 most recent · search to find more</div>}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{width:"100%",maxWidth:1080}}>

        {/* ── Page header ── */}
        <div style={{padding:isMobile?"20px 16px 0":"28px 28px 0",borderBottom:"1px solid rgba(0,0,0,0.35)",position:"relative",overflow:"hidden",background:"radial-gradient(ellipse 55% 80% at 0% 40%, rgba(201,149,106,0.055) 0%, transparent 65%), var(--bg,#0b0a08)"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,rgba(201,149,106,0.14),rgba(255,255,255,0.04) 35%,transparent 75%)",pointerEvents:"none"}}/>
          {!isMobile && <div style={{position:"absolute",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:96,fontWeight:500,color:"rgba(201,149,106,0.07)",pointerEvents:"none",userSelect:"none",top:"50%",transform:"translateY(-55%)",left:8,lineHeight:1}}>II</div>}
          <div style={{display:"flex",alignItems:"baseline",gap:12,paddingBottom:12,borderBottom:"1px solid rgba(201,149,106,0.12)",position:"relative",zIndex:1}}>
            <span style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:600,color:"rgba(201,149,106,0.45)",letterSpacing:"1px"}}>II ·</span>
            <span style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontWeight:400,fontSize:isMobile?18:22,color:"var(--t1)"}}>Budget Categories</span>
            <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(201,149,106,0.15),transparent)",alignSelf:"center",marginLeft:4}}/>
          </div>
          <div style={{fontFamily:"var(--font-mono)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.7px",color:"var(--t3)",marginTop:6,paddingBottom:20,position:"relative",zIndex:1}}>
            {monthLabel(selectedMonth)} · {categories.length} categories · {fmt(totalBudget)} total
          </div>
        </div>

        <div style={{padding:"0 28px 28px",background:"radial-gradient(ellipse 55% 80% at 0% 40%, rgba(201,149,106,0.055) 0%, transparent 65%),var(--bg,#0b0a08)"}}>
        {/* ── Stat strip ──────────────────────────────── */}
        <div style={{display:"flex",gap:0,marginBottom:20,border:"1px solid rgba(255,255,255,0.08)",borderRadius:"var(--radius)",overflow:"hidden"}}>
          {[
            {label:"Total budget", val:fmt(totalBudget),                    color:"var(--t1)"},
            {label:"Spent",        val:fmt(totalSpent),                     color:"var(--red)"},
            {label:"Remaining",    val:fmt(totalBudget - totalSpent),       color:(totalBudget-totalSpent)>=0?"var(--green)":"var(--red)"},
            {label:"Used",         val:`${displayPct}%`,                    color:budgetOver?"var(--red)":rawPct>=0.8?"var(--amber)":"var(--t1)"},
          ].map((c,i,arr)=>(
            <div key={c.label} style={{flex:1,padding:"9px 14px",borderRight:i<arr.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
              <div style={{fontFamily:"var(--font-mono)",fontSize:9,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--t3)",marginBottom:3}}>{c.label}</div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:14,fontWeight:600,color:c.color}}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* ── Action bar ──────────────────────────────── */}
        <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap",alignItems:"center"}}>
          <button style={S.btn("primary",true)} onClick={openAddCat}>+ New Category</button>
          {aiChat.hasApiKey && (
            <button style={S.btn("ghost",true)} className="ledgr-btn" disabled={suggestingLimits} onClick={runSuggestLimits}>
              {suggestingLimits?"✦ Analyzing…":"✦ Optimize Limits"}
            </button>
          )}
        </div>

        {/* ── AI Limit Suggestions ─────────────────────── */}
        {limitSuggestions.length > 0 && (
          <div style={{background:"var(--card)",border:"1px solid rgba(201,149,106,0.25)",borderRadius:"var(--radius-lg)",padding:16,marginBottom:24}} className="ledgr-card-anim">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"var(--t1)"}}>✦ AI Limit Suggestions</div>
                <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>Based on your last 3 months of spending. Accept or dismiss each.</div>
              </div>
              <button style={{...S.btn("ghost",true),fontSize:11}} className="ledgr-btn" onClick={()=>setLimitSuggestions([])}>Dismiss all</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {limitSuggestions.map(s=>{
                const cat=catMap[s.categoryId];
                if(!cat)return null;
                const diff=s.suggestedLimit-(cat.limit||0);
                const diffColor=diff>0?"var(--amber)":diff<0?"var(--green)":"var(--t3)";
                return (
                  <div key={s.categoryId} style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:"var(--surface)",borderRadius:"var(--radius)",padding:"10px 14px",borderLeft:`3px solid ${cat.color}`}}>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:cat.color,flexShrink:0,display:"inline-block"}}/>
                        <span style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{cat.name}</span>
                      </div>
                      <div style={{fontSize:11,color:"var(--t3)",lineHeight:1.5}}>{s.reasoning}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:11,color:"var(--t3)"}}>Current</div>
                        <div style={{fontSize:13,fontFamily:"var(--font-mono)",color:"var(--t2)"}}>{fmt(cat.limit||0)}</div>
                      </div>
                      <div style={{fontSize:13,color:"var(--t3)"}}>←</div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:11,color:"var(--t3)"}}>Suggested</div>
                        <div style={{fontSize:14,fontFamily:"var(--font-mono)",fontWeight:700,color:cat.color}}>{fmt(s.suggestedLimit)}</div>
                        {diff!==0&&<div style={{fontSize:10,color:diffColor,fontFamily:"var(--font-mono)"}}>{diff>0?"+":""}{fmt(diff)}</div>}
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button style={{...S.btn("primary",true),fontSize:12}} onClick={()=>{setCategories(p=>p.map(c=>c.id===s.categoryId?{...c,limit:s.suggestedLimit}:c));setLimitSuggestions(p=>p.filter(x=>x.categoryId!==s.categoryId));showToast(`${cat.name} limit updated to ${fmt(s.suggestedLimit)}`)}}>Accept</button>
                        <button style={{...S.btn("ghost",true),fontSize:12}} className="ledgr-btn" onClick={()=>setLimitSuggestions(p=>p.filter(x=>x.categoryId!==s.categoryId))}>✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        </div>{/* /content wrapper */}
        {categories.length === 0 ? (
          <div className="ledgr-empty"><div className="ledgr-empty-icon">🏷️</div><div className="ledgr-empty-title">No categories yet</div><div>Add a category to start tracking budgets</div></div>
        ) : (
          <>
            {/* ── TIER 1: OVERSPENT ─────────────────── */}
            {overCats.length > 0 && (
              <div style={{...tierBase,background:"radial-gradient(ellipse 60% 80% at 0% 50%,rgba(224,112,112,0.04) 0%,transparent 70%)"}}>
                <div style={seam("rgba(224,112,112,0.22)")}/>
                <SectionHdr ord="III" title="Overspent" ghost="!" count={overCats.length} accentColor="rgba(224,112,112,0.5)" ruleColor="rgba(224,112,112,0.15)"/>
                {overCats.map(cat=><CatRow key={cat.id} cat={cat}/>)}
              </div>
            )}

            {/* ── TIER 2: IN PROGRESS ───────────────── */}
            {progressCats.length > 0 && (
              <div style={{...tierBase,background:"radial-gradient(ellipse 55% 80% at 0% 50%,rgba(201,149,106,0.04) 0%,transparent 65%)"}}>
                <div style={seam("rgba(201,149,106,0.16)")}/>
                <SectionHdr
                  ord={overCats.length>0?"IV":"III"}
                  title="In Progress"
                  ghost={overCats.length>0?"IV":"III"}
                  count={progressCats.length}
                  sub={`${monthLabel(selectedMonth)} · tracking spend vs budget`}
                />
                {progressCats.map(cat=><CatRow key={cat.id} cat={cat}/>)}
              </div>
            )}

            {/* ── TIER 3: COMPLETED ─────────────────── */}
            {completedCats.length > 0 && (
              <div style={{...tierBase,borderBottom:"none",background:"radial-gradient(ellipse 55% 80% at 0% 50%,rgba(109,184,138,0.03) 0%,transparent 65%)"}}>
                <div style={seam("rgba(109,184,138,0.1)")}/>
                <SectionHdr
                  ord={overCats.length>0&&progressCats.length>0?"V":overCats.length>0||progressCats.length>0?"IV":"III"}
                  title="Completed"
                  ghost={overCats.length>0&&progressCats.length>0?"V":overCats.length>0||progressCats.length>0?"IV":"III"}
                  count={completedCats.length}
                  accentColor="rgba(109,184,138,0.4)"
                  ruleColor="rgba(109,184,138,0.1)"
                />
                {completedCats.map(cat=><CatRow key={cat.id} cat={cat}/>)}
              </div>
            )}
          </>
        )}

      </div>
    );
  })();

  /* -- Accounts -- */

  /* ── Accounts ─────────────────────────────────── */
  const Accounts = (
    <LedgrAccounts
      accounts={accounts}
      plaidItems={plaidItems}
      staleItemIds={staleItemIds}
      spentByAcct={spentByAcct}
      monthTxns={monthTxns}
      openAddAcct={openAddAcct}
      openEditAcct={openEditAcct}
      deleteAcct={deleteAcct}
      disconnectItem={disconnectItem}
      doSync={doSync}
      syncing={syncing}
      reconnectingItemId={reconnectingItemId}
      setReconnectingItemId={setReconnectingItemId}
      handlePlaidSuccess={handlePlaidSuccess}
      PlaidButton={PlaidButton}
      fmt={fmt}
      today={today}
      isMobile={isMobile}
      navigate={navigate}
    />
  )

  /* -- Rules -- */
  const [ruleSearch, setRuleSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});

  /* ── Rules ─────────────────────────────────── */
  const Rules = (
    <RulesPage
      rules={rules}
      catMap={catMap}
      isMobile={isMobile}
      ruleSearch={ruleSearch}
      setRuleSearch={setRuleSearch}
      toggleRule={toggleRule}
      deleteRule={deleteRule}
      onOpenAdd={() => { setRuleForm({ pattern:"", matchType:"contains", categoryId:"", enabled:true }); setModal("addRule"); }}
      onOpenEdit={(rule) => { setRuleForm({ pattern:rule.pattern, matchType:rule.matchType, categoryId:rule.categoryId||"", typeOverride:rule.typeOverride||"", enabled:rule.enabled }); setEditTarget(rule); setModal("editRule"); }}
    />
  );



  /* -- Calendar -- */
  const calYear=parseInt(calendarMonth.split("-")[0]);
  const calMonthN=parseInt(calendarMonth.split("-")[1]);
  const firstDow=new Date(calYear,calMonthN-1,1).getDay();
  const daysInCal=daysInMonth(calYear,calMonthN);
  const totalCells=Math.ceil((firstDow+daysInCal)/7)*7;


  /* ── Calendar — Agenda View ────────────────────── */
  const Calendar = (
    <LedgrCalendar
      accounts={accounts}
      categories={categories}
      calendarMonth={calendarMonth}
      calendarTxnsByDay={calendarTxnsByDay}
      recurringItems={recurringItems}
      transactions={transactions}
      monthTxns={Object.values(calendarTxnsByDay).flat()}
      catMap={catMap}
      acctMap={acctMap}
      prevCalMonth={prevCalMonth}
      nextCalMonth={nextCalMonth}
      openNewRecurringItem={openNewRecurringItem}
      openEditRecurringItem={openEditRecurringItem}
      saveRecurringItemForm={saveRecurringItemForm}
      riForm={riForm}
      setRiForm={setRiForm}
      setEditingRecurringItem={setEditingRecurringItem}
      linkTxnToRecurringItem={linkTxnToRecurringItem}
      unlinkTxnFromRecurringItem={unlinkTxnFromRecurringItem}
      deleteRecurringItem={deleteRecurringItem}
      calendarOpenNewRi={calendarOpenNewRi}
      onCalendarOpenNewRiConsumed={() => setCalendarOpenNewRi(false)}
      fmt={fmt}
      today={today}
      isMobile={isMobile}
      navigate={navigate}
    />
  );
  /* -----------------------------------------------------------------
     MODALS
  ----------------------------------------------------------------- */
  const EditRecurringModal = editTarget && modal==="editRecurring" ? (
    <Modal title="Edit Recurring Transaction" onClose={()=>{setModal(null);setEditTarget(null);}}
      actions={<>
        <button style={{...S.btn("ghost"),color:"var(--t3)"}} onClick={()=>{
          toggleRecurring(editTarget.id);
          setModal(null);setEditTarget(null);showToast("Removed from recurring");
        }}>Remove Recurring</button>
        <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>{setModal(null);setEditTarget(null);}}>Cancel</button>
        <button style={S.btn("primary")} className="ledgr-btn-primary" onClick={()=>{
          const patch = { name: editTarget.name, recurringDay: editTarget.recurringDay, recurringFreq: editTarget.recurringFreq||"monthly", recurringStart: editTarget.recurringStart||null, categoryId: editTarget.categoryId||null, accountId: editTarget.accountId||null };
          setTransactions(p=>p.map(t=>t.id===editTarget.id?{...t,...patch}:t));
          api.updateTransaction(editTarget.id, patch).catch(console.error);
          setModal(null);setEditTarget(null);showToast("Updated");
        }}>Save</button>
      </>}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{padding:"10px 14px",background:"var(--surface)",border:"none",borderRadius:"var(--radius)",fontSize:12,color:"var(--t3)"}}>
          Original: <span style={{color:"var(--t1)",fontWeight:500}}>{editTarget.merchant}</span>
        </div>
        <div style={S.field}>
          <label style={S.label}>Display Name</label>
          <input style={S.input} placeholder={editTarget.merchant} value={editTarget.name||""} onChange={e=>setEditTarget(p=>({...p,name:e.target.value}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Frequency</label>
          <CustomSelect value={editTarget.recurringFreq||"monthly"} onChange={v=>setEditTarget(p=>({...p,recurringFreq:v}))} options={[{value:"weekly",label:"Weekly"},{value:"biweekly",label:"Bi-weekly"},{value:"monthly",label:"Monthly"},{value:"annual",label:"Annual"}]} style={{width:"100%",backgroundColor:"var(--card-hi)"}}/>
        </div>
        {(editTarget.recurringFreq==="monthly"||!editTarget.recurringFreq)&&(
          <div style={S.field}>
            <label style={S.label}>Day of Month</label>
            <input style={S.input} type="number" min="1" max="31" placeholder="e.g. 15"
              value={editTarget.recurringDay||""} onChange={e=>setEditTarget(p=>({...p,recurringDay:parseInt(e.target.value)||null}))}/>
          </div>
        )}
        <div style={S.field}>
          <label style={S.label}>Start Date</label>
          <input style={S.input} type="date" value={editTarget.recurringStart||""}
            onChange={e=>setEditTarget(p=>({...p,recurringStart:e.target.value||null}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Category</label>
          <CustomSelect value={editTarget.categoryId||""} onChange={v=>setEditTarget(p=>({...p,categoryId:v||null}))} options={[{value:"",label:"— None —"},...[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({value:c.id,label:c.name}))]} style={{width:"100%",backgroundColor:"var(--card-hi)"}}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Bank Account</label>
          <CustomSelect value={editTarget.accountId||""} onChange={v=>setEditTarget(p=>({...p,accountId:v||null}))} options={[{value:"",label:"— None —"},...[...accounts].sort((a,b)=>a.name.localeCompare(b.name)).map(a=>({value:a.id,label:a.name}))]} style={{width:"100%",backgroundColor:"var(--card-hi)"}}/>
        </div>
      </div>
    </Modal>
  ) : null;

  const RecurringItemModal = recurringItemModal ? (
    <Modal
      title={editingRecurringItem ? "Edit Recurring" : "New Recurring"}
      onClose={()=>{ setRecurringItemModal(false); setEditingRecurringItem(null); }}
      actions={<>
        {editingRecurringItem && (
          <button style={{...S.btn("ghost"),color:"var(--t3)"}} onClick={()=>{
            deleteRecurringItem(editingRecurringItem.id);
            setRecurringItemModal(false); setEditingRecurringItem(null);
          }}>Delete</button>
        )}
        <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>{ setRecurringItemModal(false); setEditingRecurringItem(null); }}>Cancel</button>
        <button style={S.btn("primary")} className="ledgr-btn-primary" onClick={saveRecurringItemForm}>Save</button>
      </>}
    >
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Name */}
        <div style={S.field}>
          <label style={S.label}>Name</label>
          <input style={S.input} placeholder="e.g. Netflix" value={riForm.name} onChange={e=>setRiForm(p=>({...p,name:e.target.value}))}/>
        </div>
        {/* Type */}
        <div style={S.field}>
          <label style={S.label}>Type</label>
          <CustomSelect value={riForm.type||"expense"} onChange={v=>setRiForm(p=>({...p,type:v}))}
            options={[{value:"expense",label:"Expense"},{value:"income",label:"Income"},{value:"transfer",label:"Transfer"},{value:"reimbursement",label:"Reimbursement"}]}
            style={{width:"100%",backgroundColor:"var(--card-hi)"}}/>
        </div>
        {/* Frequency + Day */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={S.field}>
            <label style={S.label}>Frequency</label>
            <CustomSelect value={riForm.recurringFreq} onChange={v=>setRiForm(p=>({...p,recurringFreq:v}))} options={[{value:"weekly",label:"Weekly"},{value:"biweekly",label:"Bi-weekly"},{value:"monthly",label:"Monthly"},{value:"annual",label:"Annual"}]} style={{width:"100%",backgroundColor:"var(--card-hi)"}}/>
          </div>
          {(riForm.recurringFreq==="monthly"||!riForm.recurringFreq) && (
            <div style={S.field}>
              <label style={S.label}>Day of Month</label>
              <input style={S.input} type="number" min="1" max="31" placeholder="e.g. 15" value={riForm.recurringDay} onChange={e=>setRiForm(p=>({...p,recurringDay:e.target.value}))}/>
            </div>
          )}
        </div>
        {/* Expected amount — single field, auto-averaged from linked txns */}
        <div style={S.field}>
          <label style={S.label}>Expected Amount ($)</label>
          {(()=>{
            const liveItem = editingRecurringItem && (recurringItems.find(r=>r.id===editingRecurringItem.id) || editingRecurringItem);
            const linkedAmts = (liveItem?.linkedTxnIds||[])
              .map(id=>transactions.find(t=>t.id===id))
              .filter(Boolean)
              .map(t=>Math.abs(t.amount));
            const avg = linkedAmts.length > 0
              ? (linkedAmts.reduce((a,b)=>a+b,0)/linkedAmts.length).toFixed(2)
              : null;
            return (
              <input
                style={S.input}
                type="number"
                step="0.01"
                placeholder={avg ? `${avg}` : "e.g. 14.99"}
                value={riForm.amountMin}
                onChange={e=>setRiForm(p=>({...p, amountMin:e.target.value, amountMax:e.target.value}))}
              />
            );
          })()}
        </div>
        {/* Category + Account */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={S.field}>
            <label style={S.label}>Category</label>
            <CustomSelect value={riForm.categoryId} onChange={v=>setRiForm(p=>({...p,categoryId:v}))} options={[{value:"",label:"— None —"},...[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({value:c.id,label:c.name}))]} style={{width:"100%",backgroundColor:"var(--card-hi)"}}/>
          </div>
          <div style={S.field}>
            <label style={S.label}>Account</label>
            <CustomSelect value={riForm.accountId} onChange={v=>setRiForm(p=>({...p,accountId:v}))} options={[{value:"",label:"— None —"},...[...accounts].sort((a,b)=>a.name.localeCompare(b.name)).map(a=>({value:a.id,label:a.name}))]} style={{width:"100%",backgroundColor:"var(--card-hi)"}}/>
          </div>
        </div>
        {/* Start Date */}
        <div style={S.field}>
          <label style={S.label}>Start Date</label>
          <input style={S.input} type="date" value={riForm.recurringStart} onChange={e=>setRiForm(p=>({...p,recurringStart:e.target.value}))}/>
        </div>

        {/* Transaction search */}
        <div style={{borderTop:"1px solid var(--border)",paddingTop:12,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--t2)"}}>Link Transactions</div>
          {/* Always-visible linked transactions */}
          {(()=>{
            const liveItem = editingRecurringItem && (recurringItems.find(r=>r.id===editingRecurringItem.id) || editingRecurringItem);
            const liveLinked = liveItem ? (liveItem.linkedTxnIds||[]) : [];
            if (liveLinked.length === 0) return null;
            return (
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <div style={{fontSize:11,color:"var(--t3)",marginBottom:2}}>Linked ({liveLinked.length})</div>
                {liveLinked.map(txnId=>{
                  const t = transactions.find(x=>x.id===txnId);
                  return (
                    <div key={txnId} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"var(--surface)",borderRadius:"var(--radius)"}}>
                      <div style={{flex:1,minWidth:0,fontSize:12,color:t?"var(--t1)":"var(--t3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {t ? (t.name||t.merchant) : <span style={{fontStyle:"italic"}}>Transaction not loaded — scroll transactions list to load more</span>}
                      </div>
                      {t&&<span style={{fontSize:11,color:"var(--t3)",flexShrink:0}}>{t.date}</span>}
                      {t&&<span style={{fontFamily:"var(--font-mono)",fontSize:12,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0}}>
                        {t.amount<0?"-":"+"}{fmt(Math.abs(t.amount))}
                      </span>}
                      <button style={{...S.btn("danger",true),fontSize:11,flexShrink:0}} onClick={()=>{
                        unlinkTxnFromRecurringItem(txnId, editingRecurringItem.id);
                        setEditingRecurringItem(prev=>({...prev, linkedTxnIds:(prev.linkedTxnIds||[]).filter(id=>id!==txnId)}));
                      }}>✕</button>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div style={{display:"flex",gap:8}}>
            <input
              style={{...S.input,flex:1}}
              placeholder="Search merchant name…"
              value={riSearch}
              onChange={e=>setRiSearch(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&searchTxnsForRI()}
            />
            <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={searchTxnsForRI} disabled={riSearchLoading}>
              {riSearchLoading?"…":"Search"}
            </button>
          </div>
          {riSearchResults.length > 0 && (
            <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
              {riSearchResults.map(t=>{
                const itemId = editingRecurringItem?.id || ("ri"+Date.now()+"_pending");
                const liveRI = editingRecurringItem && (recurringItems.find(r=>r.id===editingRecurringItem.id) || editingRecurringItem);
                const alreadyLinked = liveRI && (liveRI.linkedTxnIds||[]).includes(t.id);
                const cat = catMap[t.categoryId];
                return (
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"var(--surface)",borderRadius:"var(--radius)",flexShrink:0}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                      <div style={{fontSize:11,color:"var(--t3)"}}>{t.date}{cat&&<span style={{color:cat.color}}> · {cat.name}</span>}</div>
                    </div>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:12,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0}}>
                      {t.amount<0?"-":"+"}{fmt(Math.abs(t.amount))}
                    </span>
                    {editingRecurringItem ? (
                      <button style={{...S.btn(alreadyLinked?"danger":"ghost",true),fontSize:11,flexShrink:0}} onClick={()=>{
                        alreadyLinked
                          ? unlinkTxnFromRecurringItem(t.id, editingRecurringItem.id)
                          : linkTxnToRecurringItem(t.id, editingRecurringItem.id);
                        setEditingRecurringItem(prev => ({
                          ...prev,
                          linkedTxnIds: alreadyLinked
                            ? (prev.linkedTxnIds||[]).filter(id=>id!==t.id)
                            : [...(prev.linkedTxnIds||[]),t.id]
                        }));
                      }}>{alreadyLinked?"Unlink":"Link"}</button>
                    ) : (
                      <span style={{fontSize:11,color:"var(--t3)"}}>Save first to link</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  ) : null;


  /* ── RuleModal ─────────────────────────────────── */
  const RuleModal = (
    <Modal title={modal==="addRule"?"New Rule":"Edit Rule"} onClose={()=>setModal(null)}
      actions={<>
        <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>setModal(null)}>Cancel</button>
        <button style={S.btn("primary")} className="ledgr-btn-primary" onClick={()=>{
          if(!ruleForm.pattern.trim()||(!ruleForm.categoryId&&!ruleForm.typeOverride)) return;
          saveRule({id:modal==="editRule"?editTarget.id:"r"+Date.now(),...ruleForm,pattern:ruleForm.pattern.trim(),createdAt:modal==="editRule"?editTarget.createdAt:Date.now()});
          setModal(null);
        }}>Save</button>
      </>}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.field}>
          <label style={S.label}>Merchant Pattern</label>
          <input style={S.input} placeholder='e.g. "Netflix"' value={ruleForm.pattern} onChange={e=>setRuleForm(p=>({...p,pattern:e.target.value}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Match Type</label>
          <CustomSelect value={ruleForm.matchType} onChange={v=>setRuleForm(p=>({...p,matchType:v}))} options={[{value:"contains",label:"Contains"},{value:"starts",label:"Starts with"},{value:"exact",label:"Exact match"}]} style={{width:"100%"}}/>
        </div>
        {ruleForm.typeOverride || (editTarget?.typeOverride && !editTarget?.categoryId) ? (
          <div style={S.field}>
            <label style={S.label}>Assign Type</label>
            <CustomSelect value={ruleForm.typeOverride} onChange={v=>setRuleForm(p=>({...p,typeOverride:v,categoryId:""}))} options={[{value:"",label:"— Select —"},{value:"transfer",label:"Transfer"},{value:"income",label:"Income"},{value:"reimbursement",label:"Reimbursement"}]} style={{width:"100%"}}/>
          </div>
        ) : (
          <div style={S.field}>
            <label style={S.label}>Assign Category</label>
            <CustomSelect value={ruleForm.categoryId} onChange={v=>setRuleForm(p=>({...p,categoryId:v,typeOverride:""}))} options={[{value:"",label:"— Select —"},...[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({value:c.id,label:c.name}))]} style={{width:"100%"}}/>
          </div>
        )}
      </div>
    </Modal>
  );


  /* ── CatModal ─────────────────────────────────── */
  const CatModal = (
    <Modal title={modal==="addCat"?"New Category":"Edit Category"} onClose={()=>setModal(null)}
      actions={<><button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>setModal(null)}>Cancel</button><button style={S.btn("primary")} className="ledgr-btn-primary" onClick={saveCat}>Save</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.field}><label style={S.label}>Name</label><input style={S.input} placeholder="Groceries" value={catForm.name} onChange={e=>setCatForm(p=>({...p,name:e.target.value}))}/></div>
        <div style={S.field}><label style={S.label}>Monthly Limit ($)</label><input style={S.input} type="number" placeholder="500" value={catForm.limit} onChange={e=>setCatForm(p=>({...p,limit:e.target.value}))}/></div>
        <div style={S.field}>
          <label style={S.label}>Color</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {CAT_COLORS.map(c=>(
              <div key={c} onClick={()=>setCatForm(p=>({...p,color:c}))} style={{width:32,height:32,borderRadius:6,background:c,cursor:"pointer",border:`2px solid ${catForm.color===c?"var(--t1)":"transparent"}`,transition:"transform 0.15s",transform:catForm.color===c?"scale(1.15)":"scale(1)"}}/>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );


  /* ── AcctModal ─────────────────────────────────── */
  const AcctModal = (
    <Modal title={modal==="addAcct"?"Add Account":"Edit Account"} onClose={()=>setModal(null)}
      actions={<><button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>setModal(null)}>Cancel</button><button style={S.btn("primary")} className="ledgr-btn-primary" onClick={saveAcct}>Save</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.field}><label style={S.label}>Name</label><input style={S.input} placeholder="Chase Checking" value={acctForm.name} onChange={e=>setAcctForm(p=>({...p,name:e.target.value}))}/></div>
        <div style={S.field}><label style={S.label}>Type</label>
          <CustomSelect value={acctForm.type} onChange={v=>setAcctForm(p=>({...p,type:v}))} options={["Checking","Savings","Credit","Investment"].map(t=>({value:t,label:t}))} style={{width:"100%"}}/>
        </div>
        <div style={S.field}><label style={S.label}>Balance ($)</label><input style={S.input} type="number" placeholder="0.00" value={acctForm.balance} onChange={e=>setAcctForm(p=>({...p,balance:e.target.value}))}/></div>
      </div>
    </Modal>
  );


  /* ── TxnModal — Lumen themed ─────────────────── */
  const TxnModal = modal === "addTxn" ? (
    <>
      <style>{`
        .lm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
        .lm-modal{background:#0b0e14;border:1px solid rgba(255,255,255,0.08);border-radius:16px;width:100%;max-width:440px;box-shadow:0 32px 80px rgba(0,0,0,0.6);overflow:hidden;}
        .lm-mhead{padding:20px 22px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:baseline;justify-content:space-between;}
        .lm-mtitle{font-family:'Instrument Serif',Georgia,serif;font-size:22px;letter-spacing:-0.3px;color:#f4f4f1;}
        .lm-mclose{background:none;border:none;color:#4a5161;font-size:18px;cursor:pointer;line-height:1;padding:0;}
        .lm-mclose:hover{color:#f4f4f1;}
        .lm-mbody{padding:20px 22px;display:flex;flex-direction:column;gap:12px;}
        .lm-mfield{display:flex;flex-direction:column;gap:5px;}
        .lm-mlabel{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#4a5161;font-family:'JetBrains Mono',monospace;}
        .lm-minput{background:#161c26;border:1px solid rgba(255,255,255,0.10);border-radius:8px;padding:9px 12px;color:#f4f4f1;font-size:13px;width:100%;outline:none;box-sizing:border-box;}
        .lm-minput:focus{border-color:rgba(93,202,165,0.45);}
        .lm-mselect{background:#161c26;border:1px solid rgba(255,255,255,0.10);border-radius:8px;padding:9px 12px;color:#c8cdd6;font-size:12px;font-family:'JetBrains Mono',monospace;width:100%;outline:none;cursor:pointer;box-sizing:border-box;}
        .lm-mselect:focus{border-color:rgba(93,202,165,0.45);}
        .lm-mfoot{padding:14px 22px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;justify-content:flex-end;}
        .lm-mbtn{padding:8px 16px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid rgba(255,255,255,0.10);background:transparent;color:#7d8594;transition:.12s;}
        .lm-mbtn:hover{border-color:rgba(255,255,255,0.18);color:#f4f4f1;}
        .lm-mbtn-p{padding:8px 18px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid rgba(93,202,165,0.4);background:rgba(93,202,165,0.1);color:#5dcaa5;font-weight:500;transition:.12s;}
        .lm-mbtn-p:hover{background:rgba(93,202,165,0.18);}
        .lm-m2col{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      `}</style>
      <div className="lm-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
        <div className="lm-modal">
          <div className="lm-mhead">
            <span className="lm-mtitle">Add Transaction</span>
            <button className="lm-mclose" onClick={()=>setModal(null)}>✕</button>
          </div>
          <div className="lm-mbody">
            <div className="lm-mfield">
              <label className="lm-mlabel">Description</label>
              <input className="lm-minput" placeholder="Amazon, Paycheck…" value={txnForm.merchant} onChange={e=>setTxnForm(p=>({...p,merchant:e.target.value}))}/>
            </div>
            <div className="lm-m2col">
              <div className="lm-mfield">
                <label className="lm-mlabel">Type</label>
                <select className="lm-mselect" value={txnForm.sign} onChange={e=>setTxnForm(p=>({...p,sign:e.target.value}))}>
                  <option value="-1">Expense</option>
                  <option value="1">Income</option>
                </select>
              </div>
              <div className="lm-mfield">
                <label className="lm-mlabel">Amount ($)</label>
                <input className="lm-minput" type="number" placeholder="0.00" value={txnForm.amount} onChange={e=>setTxnForm(p=>({...p,amount:e.target.value}))}/>
              </div>
            </div>
            <div className="lm-mfield">
              <label className="lm-mlabel">Date</label>
              <input className="lm-minput" type="date" value={txnForm.date} onChange={e=>setTxnForm(p=>({...p,date:e.target.value}))}/>
            </div>
            <div className="lm-m2col">
              <div className="lm-mfield">
                <label className="lm-mlabel">Category</label>
                <select className="lm-mselect" value={txnForm.categoryId} onChange={e=>setTxnForm(p=>({...p,categoryId:e.target.value}))}>
                  <option value="">— None —</option>
                  {[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="lm-mfield">
                <label className="lm-mlabel">Account</label>
                <select className="lm-mselect" value={txnForm.accountId} onChange={e=>setTxnForm(p=>({...p,accountId:e.target.value}))}>
                  <option value="">— None —</option>
                  {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="lm-mfoot">
            <button className="lm-mbtn" onClick={()=>setModal(null)}>Cancel</button>
            <button className="lm-mbtn-p" onClick={saveManualTxn}>Save Transaction</button>
          </div>
        </div>
      </div>
    </>
  ) : null;

  /* -----------------------------------------------------------------
     NAV + RENDER
  ----------------------------------------------------------------- */

  /* -- Shared sidebar -- */
  const currentUser  = api.getStoredUser();
  const PREMIUM_PRICE_ID = import.meta.env.VITE_PREMIUM_PRICE_ID || "";
  const FAMILY_PRICE_ID  = import.meta.env.VITE_FAMILY_PRICE_ID  || "";
  const isPremium = currentUser?.role === "owner" ||
    (currentUser?.isPremium === true) ||
    (PREMIUM_PRICE_ID && currentUser?.stripe_price_id === PREMIUM_PRICE_ID);
  const isFamilyPlan = currentUser?.role === "owner" ||
    (FAMILY_PRICE_ID && currentUser?.stripe_price_id === FAMILY_PRICE_ID);
  const _avatarColors = ["#00d4ff","#00e676","#a78bfa","#f97316","#ec4899","#fbbf24","#14b8a6"];
  const avatarColor  = _avatarColors[(currentUser?.email || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % _avatarColors.length];
  const avatarLetter = (currentUser?.name || currentUser?.email || "?")[0].toUpperCase();


  /* ── SettingsPage ─────────────────────────────────── */
  const SettingsPage = (
    <SettingsView
      theme={theme}
      onSaveTheme={t => {
        setTheme(t);
        applyTheme(t);
        // Strip bgImage before server save — base64 images are too large for app_data
        // They live only in localStorage on each device
        const { bgImage, ...themeForServer } = t;
        scheduleSaveRef.current?.({ theme: themeForServer });
        try { localStorage.setItem('ledgr_theme', JSON.stringify(t)); } catch {}
      }}
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      catMap={catMap}
      acctMap={acctMap}
      avatarColor={avatarColor}
      avatarLetter={avatarLetter}
      showToast={showToast}
      setTransactions={setTransactions}
      setAccounts={setAccounts}
      setCategories={setCategories}
      setRules={setRules}
      setPlaidItems={setPlaidItems}
      plaidItems={plaidItems}
      access={access}
      userProfile={userProfile}
      onSaveProfile={p => {
        setUserProfile(p);
        scheduleSaveRef.current?.({ userProfile: p });
      }}
      deletedTransactions={deletedTransactions}
      setDeletedTransactions={setDeletedTransactions}
      showTrash={showTrash}
      setShowTrash={setShowTrash}
      scheduleSaveRef={scheduleSaveRef}
      isFamilyPlan={isFamilyPlan}
      isMobile={isMobile}
      settingsTab={settingsTab}
      setSettingsTab={setSettingsTab}
    />
  );

  const DaniPageView = currentUser?.role === "owner" ? (
    <DaniPage
      accounts={accounts}
      transactions={transactions}
      recurringTxns={recurringTxns}
      recurringItems={recurringItems}
      daniData={daniData}
      isMobile={isMobile}
      onSave={(patch) => {
        if (patch.dani) {
          setDaniData(patch.dani);
          scheduleSaveRef.current?.({ dani: patch.dani });
        }
      }}
    />
  ) : null;

  const AdminPage = currentUser?.role === "owner" ? <AdminPanel /> : null;

  // Free-tier users get read-only dashboard + settings, paywall for everything else
  const paywallView = <Paywall />;
  const handlePortfolioPlaidSuccess = useCallback(async (publicToken, institutionName) => {
    try {
      const { item_id } = await api.exchangePublicToken(publicToken, institutionName);
      setPlaidItems(p => [...p.filter(i => i.item_id !== item_id), { item_id, institution: institutionName }]);
      showToast(`${institutionName} connected!`);
    } catch(e) { showToast("Connection failed: " + e.message); }
  }, []);


  /* ── PortfolioPage ─────────────────────────────────── */
  const PortfolioPage = (
    <PortfolioView
      investmentAccounts={portfolio.investmentAccounts}
      holdings={portfolio.holdings}
      netWorthSnapshots={portfolio.netWorthSnapshots}
      metrics={portfolio.metrics}
      syncing={portfolio.syncing}
      addAccount={portfolio.addAccount}
      updateAccount={portfolio.updateAccount}
      deleteAccount={portfolio.deleteAccount}
      addHolding={portfolio.addHolding}
      updateHolding={portfolio.updateHolding}
      deleteHolding={portfolio.deleteHolding}
      syncFromPlaid={portfolio.syncFromPlaid}
      showToast={showToast}
      isMobile={isMobile}
      PlaidButtonComponent={PlaidButton}
      onPlaidSuccess={handlePortfolioPlaidSuccess}
      isPremium={isPremium}
    />
  );


  /* ── AiChatPage ─────────────────────────────────── */
  const AiChatPage = (
    <AiChat
      messages={aiChat.messages}
      hasApiKey={aiChat.hasApiKey}
      keyChecked={aiChat.keyChecked}
      loading={aiChat.loading}
      error={aiChat.error}
      checkApiKey={aiChat.checkApiKey}
      saveApiKey={aiChat.saveApiKey}
      sendMessage={aiChat.sendMessage}
      clearHistory={aiChat.clearHistory}
      transactions={transactions}
      categories={categories}
      accounts={accounts}
      catMap={catMap}
      acctMap={acctMap}
      isMobile={isMobile}
    />
  );


  /* ── AnalyticsPage ─────────────────────────────────── */
  const AnalyticsPage = useMemo(() => (
    <Analytics
      transactions={allTransactions ?? transactions}
      categories={categories}
      accounts={accounts}
      catMap={catMap}
      isMobile={isMobile}
      hasApiKey={aiChat.hasApiKey}
      userProfile={userProfile}
      onSaveProfile={p => {
        setUserProfile(p);
        scheduleSaveRef.current?.({ userProfile: p });
      }}
      aiInsights={analyticsInsights}
      onSetAiInsights={insights => {
        setAnalyticsInsights(insights);
        scheduleSaveRef.current?.({ analyticsInsights: insights });
      }}
      todos={insightsTodos}
      onTodosChange={todos => {
        setInsightsTodos(todos);
        scheduleSaveRef.current?.({ insightsTodos: todos });
      }}
      goals={goals}
      onSaveGoal={saveGoal}
      onDeleteGoal={deleteGoal}
      onMarkRecurring={ids => {
        // Find the most common day-of-month across these transactions
        const txns = transactions.filter(t => ids.includes(t.id));
        const dayCounts = {};
        txns.forEach(t => {
          if (t.date) {
            const d = parseInt(t.date.split("-")[2]);
            dayCounts[d] = (dayCounts[d] || 0) + 1;
          }
        });
        const recurringDay = Object.keys(dayCounts).length > 0
          ? parseInt(Object.entries(dayCounts).sort((a,b) => b[1]-a[1])[0][0])
          : null;
        // Use earliest transaction date as recurringStart
        const dates = txns.map(t => t.date).filter(Boolean).sort();
        const recurringStart = dates[0] || null;

        setTransactions(prev => prev.map(t => ids.includes(t.id) ? {
          ...t,
          recurring: true,
          recurringDay: t.recurringDay || recurringDay,
          recurringFreq: t.recurringFreq || "monthly",
          recurringStart: t.recurringStart || recurringStart,
        } : t));

        ids.forEach(id => {
          const t = transactions.find(tx => tx.id === id);
          api.updateTransaction(id, {
            recurring: true,
            recurringDay: t?.recurringDay || recurringDay,
            recurringFreq: t?.recurringFreq || "monthly",
            recurringStart: t?.recurringStart || recurringStart,
          }).catch(console.error);
        });
      }}
      defaultTab={analyticsTab}
    />
  ), [allTransactions, transactions, categories, accounts, catMap, isMobile,
       analyticsInsights, analyticsTab, insightsTodos, goals, userProfile,
       aiChat.hasApiKey]);

  const VIEWS = access === "full"
    ? { dashboard:Dashboard, transactions:Transactions, budgets:Budgets, accounts:Accounts, portfolio:PortfolioPage, rules:Rules, calendar:Calendar, ai:AiChatPage, analytics:AnalyticsPage, settings:SettingsPage, admin:AdminPage, dani:DaniPageView }
    : { dashboard:Dashboard, transactions:paywallView, budgets:paywallView, accounts:paywallView, portfolio:paywallView, rules:paywallView, calendar:paywallView, ai:AiChatPage, analytics:AnalyticsPage, settings:SettingsPage, admin:AdminPage, dani:DaniPageView };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",flexDirection:"column",gap:10}}>
      <div style={{fontFamily:"var(--font-script)",fontSize:52,fontWeight:700,lineHeight:1,background:"linear-gradient(135deg, var(--grad-a), var(--grad-b))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}} className="ledgr-logo-pulse">ℓ</div>
      <div style={{position:"relative",display:"inline-block"}}>
        <div style={{fontFamily:"'Syne', sans-serif",fontSize:20,fontWeight:700,color:"var(--t1)",letterSpacing:"-0.5px"}}>ledgr<span style={{color:"var(--cyan)"}}>.</span></div>
        <div className="ledgr-loading-bar"/>
      </div>
      <div style={{fontSize:12,color:"var(--t3)",marginTop:4}}>Loading your data…</div>
    </div>
  );

  const _trialUser = api.getStoredUser();
  const trialDaysLeft = (_trialUser && _trialUser.role !== "owner" && _trialUser.role !== "free" && _trialUser.subscription_status === "trialing")
    ? Math.max(0, Math.ceil((_trialUser.trial_ends_at - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Full-screen views — bypass app shell entirely
  if (view === "dashboard") return (
    <LedgrBriefing
      accounts={accounts}
      categories={categories}
      monthTxns={monthTxns}
      recurringItems={recurringItems}
      totalSpent={totalSpent}
      totalIncome={totalIncome}
      totalBudget={totalBudget}
      goals={goals}
      today={today}
      fmt={fmt}
      navigate={navigate}
      isMobile={isMobile}
      hasApiKey={aiChat.hasApiKey}
      apiBase={(import.meta.env.VITE_API_URL || "https://ledgr-production-9e35.up.railway.app")}
      authHeaders={() => ({ "Authorization": `Bearer ${api.getToken()}`, "Content-Type": "application/json" })}
    />
  );

  if (view === "transactions") return (
    <>
      <LedgrTransactions
      transactions={transactions}
      filteredTxns={filteredTxns}
      categories={categories}
      catMap={catMap}
      accounts={accounts}
      acctMap={acctMap}
      search={search}
      handleTxnSearchChange={handleTxnSearchChange}
      filterCat={filterCat}
      setFilterCat={setFilterCat}
      filterAcct={filterAcct}
      setFilterAcct={setFilterAcct}
      txnTypeFilter={txnTypeFilter}
      setTxnTypeFilter={setTxnTypeFilter}
      txnSortCol={txnSortCol}
      setTxnSortCol={setTxnSortCol}
      txnSortDir={txnSortDir}
      setTxnSortDir={setTxnSortDir}
      selectedTxns={selectedTxns}
      setSelectedTxns={setSelectedTxns}
      needsReview={needsReview}
      deleteTxn={deleteTxn}
      openAddTxn={openAddTxn}
      bulkSetCategory={bulkSetCategory}
      bulkDelete={bulkDelete}
      bulkMarkReviewed={bulkMarkReviewed}
      selectAllVisible={selectAllVisible}
      clearSelection={clearSelection}
      txnLoading={txnLoading}
      fmt={fmt}
      today={today}
      isMobile={isMobile}
      navigate={navigate}
      updateTxnType={updateTxnType}
      updateTxnCat={updateTxnCat}
      updateTxnNotes={updateTxnNotes}
      updateTxnName={updateTxnName}
      markReviewed={markReviewed}
      onMakeRecurring={(t) => {
        const raw = t.date || '';
        const day = raw.includes('-') ? raw.split('-')[2] : raw.split('/')[1] || '';
        setRiForm({
          name:           t.name || t.merchant || '',
          amountMin:      t.amount != null ? String(Math.abs(t.amount)) : '',
          amountMax:      t.amount != null ? String(Math.abs(t.amount)) : '',
          type:           t.amount >= 0 ? 'income' : 'expense',
          categoryId:     t.categoryId  || '',
          accountId:      t.accountId   || '',
          recurringFreq:  'monthly',
          recurringDay:   day ? String(parseInt(day)) : '',
          recurringStart: raw,
        });
        setCalendarOpenNewRi(true);
        navigate('calendar');
      }}
      doSync={doSync}
      syncing={syncing}
    />
      {modal==="addTxn" && TxnModal}
    </>
  );

  if (view === "accounts") return (
    <>
      <LedgrAccounts
      accounts={accounts}
      plaidItems={plaidItems}
      staleItemIds={staleItemIds}
      spentByAcct={spentByAcct}
      monthTxns={monthTxns}
      openAddAcct={openAddAcct}
      openEditAcct={openEditAcct}
      deleteAcct={deleteAcct}
      disconnectItem={disconnectItem}
      doSync={doSync}
      syncing={syncing}
      reconnectingItemId={reconnectingItemId}
      setReconnectingItemId={setReconnectingItemId}
      handlePlaidSuccess={handlePlaidSuccess}
      PlaidButton={PlaidButton}
      fmt={fmt}
      today={today}
      isMobile={isMobile}
      navigate={navigate}
    />
      {(modal==="addAcct"||modal==="editAcct") && AcctModal}
    </>
  );

  if (view === "budgets") return (
    <>
      <LedgrBudgets
      categories={categories}
      sortedCategories={sortedCategories}
      spentByCat={spentByCat}
      monthTxns={monthTxns}
      catMap={catMap}
      selectedMonth={selectedMonth}
      monthLabel={monthLabel}
      totalSpent={totalSpent}
      totalBudget={totalBudget}
      today={today}
      fmt={fmt}
      isMobile={isMobile}
      navigate={navigate}
      openAddCat={openAddCat}
      openEditCat={openEditCat}
      deleteCat={deleteCat}
      toggleCatComplete={toggleCatComplete}
      updateTxnCat={updateTxnCat}
      editingLimitId={editingLimitId}
      setEditingLimitId={setEditingLimitId}
      editingLimitVal={editingLimitVal}
      setEditingLimitVal={setEditingLimitVal}
      saveLimit={saveLimit}
      startEditLimit={startEditLimit}
      limitSuggestions={limitSuggestions}
      setLimitSuggestions={setLimitSuggestions}
      suggestingLimits={suggestingLimits}
      runSuggestLimits={runSuggestLimits}
      hasApiKey={aiChat.hasApiKey}
      showToast={showToast}
    />
      {(modal==="addCat"||modal==="editCat") && CatModal}
    </>
  );

  if (view === "calendar") return (
    <>
      <LedgrCalendar
        accounts={accounts}
        categories={categories}
        calendarMonth={calendarMonth}
        calendarTxnsByDay={calendarTxnsByDay}
        recurringItems={recurringItems}
        transactions={transactions}
        monthTxns={monthTxns}
        catMap={catMap}
        acctMap={acctMap}
        prevCalMonth={prevCalMonth}
        nextCalMonth={nextCalMonth}
        openNewRecurringItem={openNewRecurringItem}
        linkTxnToRecurringItem={linkTxnToRecurringItem}
        unlinkTxnFromRecurringItem={unlinkTxnFromRecurringItem}
        deleteRecurringItem={deleteRecurringItem}
        saveRecurringItemForm={saveRecurringItemForm}
        searchTxnsForRI={searchTxnsForRI}
        riForm={riForm}
        setRiForm={setRiForm}
        riSearch={riSearch}
        setRiSearch={setRiSearch}
        riSearchResults={riSearchResults}
        riSearchLoading={riSearchLoading}
        editingRecurringItem={editingRecurringItem}
        setEditingRecurringItem={setEditingRecurringItem}
        fmt={fmt}
        today={today}
        isMobile={isMobile}
        navigate={navigate}
      />
    </>
  );

  return (
    <div style={{...S.shell, paddingTop: isDemo ? 45 : 0, ...(theme.bgImage ? {
      background: "transparent",
      backgroundImage: `url(${theme.bgImage})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
      backgroundRepeat: "no-repeat",
    } : {})}}>
    {/* --- Demo mode banner --- */}
    {isDemo && (
      <div style={{
        position:"fixed", top:0, left:0, right:0, zIndex:9999,
        background:"linear-gradient(90deg,rgba(0,212,255,0.12),rgba(0,212,255,0.07))",
        borderBottom:"2px solid var(--cyan)",
        padding:"0 20px", height:45,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        backdropFilter:"blur(12px)",
      }}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <span style={{background:"var(--cyan)", color:"#000", fontSize:10, fontWeight:800,
            padding:"2px 8px", borderRadius:99, letterSpacing:"1px", textTransform:"uppercase", flexShrink:0}}>
            Demo
          </span>
          <span style={{fontSize:13, color:"var(--t2)"}}>
            Exploring with sample data — nothing is saved
          </span>
        </div>
        <a href="https://ledgr-eight-zeta.vercel.app"
          style={{background:"var(--cyan)", color:"#000", padding:"7px 18px",
            borderRadius:"var(--radius)", fontSize:13, fontWeight:700,
            textDecoration:"none", whiteSpace:"nowrap", flexShrink:0}}>
          Get Started — It's Free ←
        </a>
      </div>
    )}
    <InstallPrompt />

    {/* System message modal */}
    {systemMsgOpen && systemMsg && (
      <div className="ledgr-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div className="ledgr-modal-anim obsidian-card" style={{...S.modal,maxWidth:460,width:"100%",display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>📢</span>
              <div style={{fontFamily:"var(--font-disp)",fontSize:15,fontWeight:700,color:"var(--t1)"}}>Message from Ledgr</div>
            </div>
            <button onClick={()=>setSystemMsgOpen(false)}
              style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:18,lineHeight:1,padding:"2px 4px",flexShrink:0}}>✕</button>
          </div>
          <div style={{fontSize:14,color:"var(--t2)",lineHeight:1.7,padding:"4px 0"}}>
            {systemMsg.text}
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:4}}>
            <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={()=>{
              // Remember dismissal so it doesn't show again
              try {
                const key = "ledgr_dismissed_msgs";
                const dismissed = JSON.parse(localStorage.getItem(key)||"[]");
                dismissed.push(systemMsg.id);
                localStorage.setItem(key, JSON.stringify(dismissed));
              } catch {}
              setSystemMsgOpen(false);
            }}>Don't show again</button>
            <button style={S.btn("primary",true)} onClick={()=>setSystemMsgOpen(false)}>Got it</button>
          </div>
        </div>
      </div>
    )}

    {/* Trial countdown banner */}
    {trialDaysLeft !== null && (
      <div style={{
        flexShrink:0, background: trialDaysLeft <= 1 ? "var(--red-dim)" : "#fbbf2415",
        borderBottom:`1px solid ${trialDaysLeft <= 1 ? "#ff4d6d44" : "#fbbf2433"}`,
        padding:"8px 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", gap:10,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color: trialDaysLeft <= 1 ? "var(--red)" : "var(--amber)"}}>
          <span style={{fontSize:14}}>{trialDaysLeft <= 1 ? "⚠⚠" : "·"}</span>
          <span style={{fontWeight:600}}>
            {trialDaysLeft === 0
              ? "Your trial expires today"
              : trialDaysLeft === 1
              ? "Your trial expires tomorrow"
              : `${trialDaysLeft} days left in your free trial`}
          </span>
        </div>
        <button
          onClick={() => { setSettingsTab("subscription"); navigate("settings"); }}
          style={{
            background: trialDaysLeft <= 1 ? "var(--red)" : "var(--amber)",
            color:"#000", border:"none", borderRadius:"var(--radius)",
            padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer",
            flexShrink:0, whiteSpace:"nowrap",
          }}>
          View plans
        </button>
      </div>
    )}
    {isMobile ? (
      /* ── MOBILE — bottom nav ── */
      <>
        <div ref={contentRef} style={{flex:1,overflowY:"auto",overscrollBehavior:"none"}} className="ledgr-content">
          {view === "analytics"
            ? <div className="ledgr-view-enter"><div style={{width:"100%",maxWidth:1080}}>{AnalyticsPage}</div></div>
            : view === "dashboard"
            ? <div key={navKey} className="ledgr-view-enter">{VIEWS[view]}</div>
            : view === "calendar" || view === "rules"
            ? <div key={navKey} className="ledgr-view-enter">{VIEWS[view]}</div>
            : <div key={navKey} className="ledgr-view-enter"><div style={{width:"100%",maxWidth:1080}}>{VIEWS[view]}</div></div>
          }
        </div>

        {/* More sheet overlay */}
        {moreOpen && <div onClick={()=>setMoreOpen(false)} style={{position:"fixed",inset:0,bottom:82,zIndex:39}}/>}

        {/* More sheet */}
        <div className={`mobile-more-sheet${moreOpen?" open":""}`}>
          <div className="mobile-sheet-handle"/>
          <button className="mobile-sheet-item" onClick={()=>{ setMoreOpen(false); navigate("settings"); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            Profile & Settings
          </button>
          <button className="mobile-sheet-item" onClick={()=>{ setMoreOpen(false); navigate("accounts"); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            Accounts
          </button>
          <button className="mobile-sheet-item" onClick={()=>{ setMoreOpen(false); navigate("rules"); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
            Rules
          </button>
          {currentUser?.role === "owner" && <>
            <div className="mobile-sheet-divider"/>
            <button className="mobile-sheet-item" onClick={()=>{ setMoreOpen(false); navigate("admin"); }} style={{color:"var(--cyan)"}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Admin
            </button>
            <button className="mobile-sheet-item" onClick={()=>{ setMoreOpen(false); navigate("dani"); }} style={{color:"#f9a8d4"}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              Dani
            </button>
          </>}
        </div>

        {/* Bottom nav */}
        <BottomNav view={view} navigate={navigate} moreOpen={moreOpen} setMoreOpen={setMoreOpen} currentUser={currentUser}/>
      </>
    ) : (
      /* ✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓
         DESKTOP — persistent sidebar
         ✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓✓ */
      <>
        {/* Desktop body */}
        <div style={{flex:1,overflowY:"auto",position:"relative"}} className="ledgr-content" ref={contentRef}>
          <div style={{display:"flex",maxWidth:1080,margin:"0 auto",minHeight:"100%"}}>
          {/* Rail */}
          <aside style={{
            width:72,flexShrink:0,display:"flex",flexDirection:"column",
            position:"sticky",top:0,height:"100vh",overflow:"visible",
            alignSelf:"flex-start",
          }}>
            <SidebarContent onNav={navigate} view={view} syncing={syncing} doSync={doSync} showToast={showToast} avatarColor={avatarColor} avatarLetter={avatarLetter} />
          </aside>
          {/* Content */}
          <div style={{flex:1,minWidth:0,position:"relative"}}>
            
            
            {view === "analytics"
              ? <div className="ledgr-view-enter" style={{position:"relative",zIndex:1}}><div style={{width:"100%",maxWidth:1080}}>{AnalyticsPage}</div></div>
              : view === "dashboard"
              ? <div key={navKey} className="ledgr-view-enter" style={{position:"relative",zIndex:1}}>{VIEWS[view]}</div>
              : view === "calendar" || view === "rules"
              ? <div key={navKey} className="ledgr-view-enter" style={{position:"relative",zIndex:1}}>{VIEWS[view]}</div>
              : <div key={navKey} className="ledgr-view-enter" style={{position:"relative",zIndex:1}}><div style={{width:"100%",maxWidth:1080}}>{VIEWS[view]}</div></div>
            }
          </div>
          </div>{/* /max-width wrapper */}
        </div>
      </>
    )}

      {/* -- Modals -- */}
      {(modal==="addCat"||modal==="editCat")   && CatModal}
      {(modal==="addAcct"||modal==="editAcct") && AcctModal}
      {modal==="addTxn"                        && TxnModal}
      {(modal==="addRule"||modal==="editRule") && RuleModal}
      {EditRecurringModal}
      {RecurringItemModal}

      {/* Category suggestion confirmation modal */}
      {catSuggestions && (
        <div style={{position:"fixed",inset:0,background:"#0009",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={e=>{ if(e.target===e.currentTarget) setCatSuggestions(null); }}>
          <div style={{background:"var(--card)",border:"none",borderRadius:"var(--radius-lg)",width:"100%",maxWidth:580,maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"20px 20px 14px",borderBottom:"1px solid var(--border)"}}>
              <div style={{fontSize:16,fontWeight:700,color:"var(--t1)",marginBottom:4}}>✦ Suggested Categories</div>
              <div style={{fontSize:12,color:"var(--t3)"}}>AI analyzed your transactions and suggested these categories. Set a monthly budget limit for each, then confirm to create them.</div>
            </div>
            <div style={{overflowY:"auto",padding:"14px 20px",flex:1,display:"flex",flexDirection:"column",gap:8}}>
              {catSuggestions.map((s, i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--surface)",borderRadius:"var(--radius)",border:"none",borderLeft:`3px solid ${s.color||"var(--cyan)"}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--t1)"}}>{s.name}</div>
                    <div style={{fontSize:11,color:"var(--t3)",marginTop:1}}>{(s.transactions||[]).length} transaction{(s.transactions||[]).length!==1?"s":""}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    <span style={{fontSize:11,color:"var(--t3)"}}>Limit $</span>
                    <input
                      type="number" min="0" step="10"
                      value={s.limit || ""}
                      onChange={e => setCatSuggestions(prev => prev.map((x,j) => j===i ? {...x,limit:e.target.value} : x))}
                      style={{...S.input,width:80,padding:"5px 8px",fontSize:13,textAlign:"right"}}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={()=>setCatSuggestions(null)}>Cancel</button>
              <button style={S.btn("primary",true)} onClick={()=>confirmCatSuggestions(catSuggestions)}>
                Create {catSuggestions.length} Categories
              </button>
            </div>
          </div>
        </div>
      )}

      {rulePrompt&&(
        <div className="ledgr-rule-prompt" style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:200,maxWidth:420,width:"90vw",borderRadius:12,overflow:"hidden",boxShadow:"0 12px 40px #00000090",display:"flex"}}>
          <div style={{width:4,background:"var(--cyan)",flexShrink:0}}/>
          <div style={{flex:1,background:"#1e1a15",padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",marginBottom:2}}>Save as a rule?</div>
              <div style={{fontSize:12,color:"var(--t2)"}}>&quot;{rulePrompt.merchant}&quot; ← <strong style={{color:"var(--cyan)"}}>{catMap[rulePrompt.categoryId]?.name}</strong></div>
            </div>
            <button style={S.btn("primary",true)} onClick={confirmSaveRule}>Save Rule</button>
            <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={()=>setRulePrompt(null)}>✕</button>
          </div>
        </div>
      )}

      {typeRulePrompt&&(
        <div className="ledgr-rule-prompt" style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:200,maxWidth:440,width:"90vw",borderRadius:12,overflow:"hidden",boxShadow:"0 12px 40px #00000090",display:"flex"}}>
          <div style={{width:4,background:"#fbbf24",flexShrink:0}}/>
          <div style={{flex:1,background:"#1e1a15",padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",marginBottom:2}}>Create a type rule?</div>
              <div style={{fontSize:12,color:"var(--t2)"}}>Always mark &quot;{typeRulePrompt.merchant}&quot; as <strong style={{color:"#fbbf24",textTransform:"capitalize"}}>{typeRulePrompt.type}</strong></div>
            </div>
            <button style={{...S.btn("primary",true),background:"#fbbf24",borderColor:"#fbbf24",color:"#000"}} onClick={confirmTypeRule}>Save Rule</button>
            <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={()=>setTypeRulePrompt(null)}>✕</button>
          </div>
        </div>
      )}

      {selectedTxns.size > 0 && (
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:210,
          background:"var(--card)",border:"none",borderRadius:12,
          padding:"12px 18px",boxShadow:"0 8px 32px #00000090",
          display:"flex",alignItems:"center",gap:10,maxWidth:640,width:"92vw",flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:700,color:"var(--cyan)",marginRight:4,flexShrink:0}}>
            {selectedTxns.size} selected
          </span>
          {/* Category */}
          <CustomSelect value="" onChange={v=>{ if(v) bulkSetCategory(v); }} options={[{value:"",label:"Set category…"},...[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({value:c.id,label:c.name}))]} style={{flex:1,minWidth:130}} compact/>
          {/* Type */}
          <CustomSelect value="" onChange={v=>{ if(v) bulkSetType(v); }} options={[{value:"",label:"Set type…"},{value:"expense",label:"Expense"},{value:"income",label:"Income"},{value:"transfer",label:"Transfer"},{value:"reimbursement",label:"Reimbursement"}]} style={{flex:1,minWidth:120}} compact/>
          <CustomSelect value="" onChange={v=>{ if(v) bulkSetAccount(v==="__none__"?"":v); }} options={[{value:"",label:"Set account…"},{value:"__none__",label:"— Remove —"},...[...accounts].sort((a,b)=>a.name.localeCompare(b.name)).map(a=>({value:a.id,label:a.name}))]} style={{flex:1,minWidth:130}} compact/>
          <button style={{...S.btn("ghost",true),fontSize:12}} className="ledgr-btn" onClick={()=>bulkMarkReviewed(true)}>✓ Reviewed</button>
          <button style={{...S.btn("danger",true),fontSize:12}} onClick={bulkDelete}>Delete</button>
          <button style={{...S.btn("ghost",true),fontSize:12,marginLeft:"auto"}} className="ledgr-btn" onClick={clearSelection}>✕</button>
        </div>
      )}

      {newTxnCount>0&&(
        <div style={{
          position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
          zIndex:300,background:"var(--cyan)",color:"#000",
          borderRadius:12,padding:"12px 20px",
          boxShadow:"0 8px 32px #00000080",
          display:"flex",alignItems:"center",gap:10,
          maxWidth:400,width:"90vw",cursor:"pointer",
        }} onClick={()=>{ setView("transactions"); setNewTxnCount(0); }}>
          <span style={{fontSize:18}}>⇅</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14}}>
              {newTxnCount} new transaction{newTxnCount!==1?"s":""} synced
            </div>
            <div style={{fontSize:12,opacity:0.7}}>Tap to view</div>
          </div>
          <button onClick={e=>{e.stopPropagation();setNewTxnCount(0);}}
            style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#000"}}>✕</button>
        </div>
      )}



      {showTrash && (
        <div style={S.overlay} className="ledgr-overlay-anim" onClick={()=>setShowTrash(false)}>
          <div className="ledgr-modal-anim" style={{...S.modal, width:560, maxHeight:"82vh", display:"flex", flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexShrink:0}}>
              <div style={S.modalTitle}>Deleted Transactions</div>
              <button onClick={()=>setShowTrash(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:20,lineHeight:1}}>✕</button>
            </div>
            {deletedTransactions.length === 0 ? (
              <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--t3)", fontSize:13}}>No deleted transactions</div>
            ) : (
              <>
                <div style={{fontSize:11, color:"var(--t3)", marginBottom:12, flexShrink:0}}>{deletedTransactions.length} deleted transaction{deletedTransactions.length!==1?"s":""}</div>
                <div style={{overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:2}}>
                  {deletedTransactions.map(t=>{
                    const cat = catMap[t.categoryId];
                    const acct = acctMap[t.accountId];
                    const deletedDate = t.deletedAt ? new Date(t.deletedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "Unknown";
                    return (
                      <div key={t.id} style={{display:"flex", alignItems:"center", gap:10, padding:"9px 10px", background:"var(--surface)", borderRadius:"var(--radius)", flexShrink:0}}>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontSize:13, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                          <div style={{fontSize:11, color:"var(--t3)", marginTop:2}}>
                            {t.date} · {cat ? <span style={{color:cat.color}}>{cat.name}</span> : "Uncategorized"}
                            {acct && <span> · {acct.name}</span>}
                            <span style={{marginLeft:6, opacity:0.6}}>deleted {deletedDate}</span>
                          </div>
                        </div>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0}}>
                          {t.amount<0?"-":"+"}{fmt(Math.abs(t.amount))}
                        </span>
                        <button style={{...S.btn("ghost",true),fontSize:11,flexShrink:0}} className="ledgr-btn" onClick={()=>{
                          const { deletedAt, ...restored } = t;
                          setTransactions(p=>[restored,...p]);
                          setDeletedTransactions(p=>{ const next=p.filter(x=>x.id!==t.id); scheduleSaveRef.current?.({ deletedTransactions: next }); return next; });
                          api.createTransaction(restored).catch(console.error);
                          showToast("Transaction restored");
                        }}>Restore</button>
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:14, flexShrink:0, display:"flex", justifyContent:"flex-end", gap:8}}>
                  <button style={{...S.btn("danger",true),fontSize:12}} onClick={()=>{
                    if(!window.confirm(`Permanently delete all ${deletedTransactions.length} transactions? This cannot be undone.`)) return;
                    setDeletedTransactions([]);
                    scheduleSaveRef.current?.({ deletedTransactions: [] });
                  }}>Empty Trash</button>
                  <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>setShowTrash(false)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Invite Accept Modal */}
      {showInviteModal && inviteToken && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--card)",borderRadius:16,padding:"24px",width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontFamily:"var(--font-disp)",fontSize:20,fontWeight:800,color:"var(--t1)"}}>ledgr.</div>
            {inviteStatus==="loading" && <div style={{fontSize:13,color:"var(--t3)"}}>Checking invite…</div>}
            {inviteStatus==="error"   && <div style={{fontSize:13,color:"var(--red)"}}>This invite link is invalid or has expired.</div>}
            {(inviteStatus==="ready"||inviteStatus==="accepting") && (<>
              <div style={{background:"var(--surface)",borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",marginBottom:4}}>You've been invited to a Ledgr household</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>Sign in or create an account to accept.</div>
              </div>
              <input style={S.input} placeholder="Email" type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/>
              <input style={S.input} placeholder="Password" type="password" value={invitePw} onChange={e=>setInvitePw(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&acceptInvite()}/>
              {inviteError && <div style={{fontSize:12,color:"var(--red)"}}>{inviteError}</div>}
              <button style={{...S.btn("primary"),width:"100%"}} onClick={acceptInvite} disabled={inviteStatus==="accepting"}>
                {inviteStatus==="accepting"?"Please wait…":inviteIsNew?"Create account & Accept":"Sign in & Accept"}
              </button>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:12,textAlign:"center"}}
                onClick={()=>setInviteIsNew(p=>!p)}>
                {inviteIsNew?"Already have an account? Sign in":"New to Ledgr? Create an account"}
              </button>
            </>)}
          </div>
        </div>
      )}
      <Toast
        msg={undoAction ? "" : toast}
        undoAction={undoAction}
        onUndo={() => { undoAction?.fn(); setUndoAction(null); clearTimeout(undoTimer.current); }}
        onDismiss={() => setUndoAction(null)}
        isMobile={isMobile}
      />
      {showOnboarding && (
        <OnboardingWizard
          onComplete={cats => {
            setCategories(cats);
            setShowOnboarding(false);
            showToast("Budget categories created!");
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
