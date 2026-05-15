/**
 * LedgrTransactions.jsx
 * src/components/LedgrTransactions.jsx
 *
 * Layout: nav (64px) | ledger list (1fr) | edit panel (360px)
 * Rows:   3px type-color strip · date · merchant · category pill · account · amount
 * Panel:  display-serif amount · inline name / category / type / account / notes editing
 *
 * NEW PROPS — add these to the LedgrTransactions render in App.jsx:
 *   updateTxnType={updateTxnType}
 *   updateTxnCat={updateTxnCat}
 *   updateTxnNotes={updateTxnNotes}
 *   updateTxnName={(id, name) => {
 *     const n = name.trim();
 *     if (n) {
 *       setTransactions(p => p.map(t => t.id === id ? { ...t, name: n } : t));
 *       api.updateTransaction(id, { name: n }).catch(console.error);
 *     }
 *   }}
 *   markReviewed={markReviewed}
 *   onMakeRecurring={(t) => {
 *     setRiForm({
 *       name: t.name || t.merchant || '',
 *       amountMin: t.amount != null ? String(Math.abs(t.amount)) : '',
 *       amountMax: t.amount != null ? String(Math.abs(t.amount)) : '',
 *       type: t.amount >= 0 ? 'income' : 'expense',
 *       categoryId: t.categoryId || '',
 *       accountId:  t.accountId  || '',
 *       recurringFreq: 'monthly',
 *       recurringDay: '',
 *       recurringStart: '',
 *     });
 *     openNewRecurringItem();
 *   }}
 */
import PageNav from "./PageNav.jsx";
import { useState, useMemo, useEffect } from "react";

/* ─── CSS ─────────────────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  :root {
    --bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;--bg-4:#1c2330;
    --line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);--line-3:rgba(255,255,255,0.18);
    --ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;
    --safe:#5dcaa5;--safe-d:#0f6e56;--safe-bg:rgba(93,202,165,0.08);
    --warn:#f0b04c;--warn-d:#6b4708;--warn-bg:rgba(240,176,76,0.08);
    --debt:#e87363;--debt-d:#5a1c14;--debt-bg:rgba(232,115,99,0.08);
    --calm:#6c8cff;--calm-d:#1a2a66;--calm-bg:rgba(108,140,255,0.08);
    --goal:#a78bff;--goal-d:#2a1f5e;--goal-bg:rgba(167,139,255,0.08);
    --quiet:#b4b2a9;
    --font-display:'Instrument Serif',Georgia,serif;
    --font-ui:'Geist',-apple-system,sans-serif;
    --font-mono:'JetBrains Mono',ui-monospace,monospace;
    --r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;
  }
  .lt-wrap *,.lt-wrap *::before,.lt-wrap *::after { box-sizing:border-box; }
  .lt-wrap h1,.lt-wrap h2,.lt-wrap h3,.lt-wrap h4,.lt-wrap p { margin:0;padding:0; }
  .lt-wrap {
    font-family:var(--font-ui);color:var(--ink-0);-webkit-font-smoothing:antialiased;
    background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;
  }
  @media(max-width:1000px){.lt-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.lt-wrap{padding:0;}}

  /* Frame */
  .lt-frame {
    background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r-xl);
    overflow:clip;max-width:1400px;margin:0 auto;
    box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;flex-direction:column;min-height:820px;
  }
  @media(max-width:600px){.lt-frame{border-radius:0;border:none;}}

  /* Browser chrome */
  .lt-bar {
    height:40px;background:var(--bg-2);border-bottom:1px solid var(--line);
    display:flex;align-items:center;padding:0 18px;gap:8px;flex-shrink:0;
  }
  .lt-bar-dot{width:9px;height:9px;border-radius:50%;background:var(--ink-4);}
  .lt-bar-url{margin-left:14px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lt-bar-live{margin-left:auto;display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lt-sync-btn{background:none;border:1px solid var(--line);border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-3);transition:.15s;flex-shrink:0;}
  .lt-sync-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .lt-sync-btn svg{transition:transform .6s;}
  .lt-sync-btn.spinning svg{animation:lt-spin .7s linear infinite;}
  @keyframes lt-spin{to{transform:rotate(360deg);}}
  .lt-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}

  /* 3-column body */
  .lt-body { display:grid;grid-template-columns:64px 1fr 360px;flex:1;min-height:0;align-items:start; }
  @media(max-width:1100px){.lt-body{grid-template-columns:64px 1fr;}}

  /* Left nav */
  .lt-nav {
    width:64px;border-right:1px solid var(--line);padding:24px 0;
    display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);
  }
  .lt-nav-logo {
    width:28px;height:28px;border-radius:50%;
    background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d,#0f6e56) 80%);
    margin-bottom:24px;
  }
  .lt-nav-item {
    width:40px;height:40px;border-radius:10px;display:flex;align-items:center;
    justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;
    transition:.15s;user-select:none;
  }
  .lt-nav-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .lt-nav-item.active{color:var(--safe);background:var(--safe-bg);}
  .lt-nav-spacer{flex:1;}

  /* Center main */
  .lt-main { display:flex;flex-direction:column;min-width:0;overflow:hidden; }

  /* Topbar */
  .lt-topbar {
    height:60px;padding:0 28px;border-bottom:1px solid var(--line);
    display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
  }
  .lt-tb-left{display:flex;align-items:baseline;gap:14px;}
  .lt-tb-num{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lt-tb-title{font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px;}
  .lt-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .lt-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .lt-tb-right{display:flex;align-items:center;gap:10px;}

  /* Filter bar */
  .lt-filters {
    padding:10px 28px;border-bottom:1px solid var(--line);
    display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;background:var(--bg-1);
  }
  .lt-select {
    background:var(--bg-2);border:1px solid var(--line);border-radius:8px;
    padding:4px 9px;font-size:11px;font-family:var(--font-mono);color:var(--ink-1);cursor:pointer;outline:none;
  }
  .lt-btn {
    background:transparent;border:1px solid var(--line);border-radius:8px;
    padding:4px 11px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:.15s;
  }
  .lt-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .lt-btn.active{background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe);}
  .lt-btn.primary{background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe);}
  .lt-btn.danger{background:var(--debt-bg);border-color:rgba(232,115,99,0.3);color:var(--debt);}
  .lt-btn.ghost{border-color:transparent;color:var(--ink-3);}
  .lt-search-box {
    background:var(--bg-2);border:1px solid var(--line);border-radius:8px;
    padding:5px 12px;font-size:11px;color:var(--ink-3);font-family:var(--font-mono);
    display:flex;align-items:center;gap:7px;min-width:200px;
  }
  .lt-search-box input{background:none;border:none;outline:none;color:var(--ink-0);font-family:var(--font-mono);font-size:11px;flex:1;}
  .lt-search-box input::placeholder{color:var(--ink-3);}

  /* Ledger table */
  .lt-content{flex:1;overflow-y:auto;}
  .lt-table{width:100%;border-collapse:collapse;}
  .lt-thead-row{background:var(--bg-1);position:sticky;top:0;z-index:2;}
  .lt-th {
    font-family:var(--font-mono);font-size:9px;font-weight:600;
    text-transform:uppercase;letter-spacing:1px;color:var(--ink-3);
    padding:9px 12px;text-align:left;border-bottom:1px solid var(--line);
    cursor:pointer;user-select:none;white-space:nowrap;
  }
  .lt-th:first-child{padding-left:0;width:3px;}
  .lt-th:hover{color:var(--ink-1);}
  .lt-th.asc::after{content:' ↑';}
  .lt-th.desc::after{content:' ↓';}
  .lt-th.active{color:var(--safe);}

  /* Ledger rows */
  .lt-tr {
    border-bottom:1px solid var(--line);cursor:pointer;
    transition:background 0.08s;display:table-row;
  }
  .lt-tr:hover td{background:rgba(255,255,255,0.018);}
  .lt-tr.sel td{background:rgba(93,202,165,0.05);}
  .lt-tr.sel td:first-child{background:transparent;}
  .lt-td{padding:0;vertical-align:middle;}

  /* Color strip cell — 4 indicators */
  .lt-strip{width:3px;padding:0 !important;}
  .lt-cb-col{width:32px;padding:0 4px 0 10px !important;}
  .lt-cb{width:14px;height:14px;border-radius:3px;border:1px solid var(--line-2);
    appearance:none;-webkit-appearance:none;background:var(--bg-2);cursor:pointer;
    display:grid;place-content:center;transition:.1s;flex-shrink:0;}
  .lt-cb:checked{background:var(--safe);border-color:var(--safe);}
  .lt-cb:checked::after{content:'';width:4px;height:7px;border:1.5px solid #07090d;
    border-top:none;border-left:none;transform:rotate(42deg) translateY(-1px);display:block;}
  .lt-cb:hover:not(:checked){border-color:var(--safe);}
  .lt-strip-bar{width:3px;height:100%;min-height:42px;display:block;}
  .lt-strip-bar.unreviewed{background:#5dcaa5;}
  .lt-strip-bar.pending{background:var(--warn);}
  .lt-strip-bar.income{background:#5dcaa5;}
  .lt-strip-bar.recurring{background:#f97316;}
  .lt-strip-bar.none{background:transparent;}

  /* Cell inner */
  .lt-cell{padding:10px 12px;display:flex;align-items:center;gap:6px;min-height:42px;}
  .lt-cell.ra{justify-content:flex-end;}
  .lt-date-val{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);white-space:nowrap;}
  .lt-merchant-val{font-size:13px;color:var(--ink-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .lt-merchant-badge{font-size:10px;padding:1px 6px;border-radius:4px;font-family:var(--font-mono);flex-shrink:0;}
  .lt-merchant-badge.review{background:rgba(93,202,165,0.1);color:#5dcaa5;}
  .lt-merchant-badge.recur{background:var(--calm-bg);color:var(--calm);}
  .lt-acct-val{font-family:var(--font-mono);font-size:10px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .lt-amt-val{font-family:var(--font-mono);font-size:13px;font-weight:600;}
  .lt-amt-val.income{color:var(--safe);}
  .lt-amt-val.expense,.lt-amt-val.bill,.lt-amt-val.sub,.lt-amt-val.subscription{color:var(--ink-1);}

  /* Row hover actions */
  .lt-row-acts{display:flex;gap:4px;opacity:0;transition:opacity 0.1s;flex-shrink:0;}
  .lt-tr:hover .lt-row-acts,.lt-tr.sel .lt-row-acts{opacity:1;}
  .lt-row-btn{background:none;border:1px solid var(--line-2);border-radius:5px;padding:2px 7px;font-size:10px;font-family:var(--font-mono);color:var(--ink-3);cursor:pointer;}
  .lt-row-btn:hover{color:var(--debt);border-color:rgba(232,115,99,0.3);}

  /* Category pill */
  .lt-cat-pill{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:2px 8px;border-radius:99px;font-family:var(--font-mono);white-space:nowrap;}
  .lt-cat-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}

  /* Empty state */
  .lt-empty{padding:80px;text-align:center;color:var(--ink-3);}
  .lt-empty-title{font-family:var(--font-display);font-size:28px;color:var(--ink-2);margin-bottom:6px;}

  /* ── Edit panel (right column) ── */
  .lt-panel {
    border-left:1px solid var(--line);background:var(--bg-2);
    display:flex;flex-direction:column;
    position:sticky;top:0;
    height:calc(100vh - 40px);
    overflow-y:auto;
  }
  @media(max-width:1100px){.lt-panel{display:none;}}
  @media(hover:none)and(pointer:coarse){
    .lt-body{grid-template-columns:1fr!important;}
    .lt-panel{display:none!important;}
    .lt-topbar{padding:12px 16px;}
    .lt-bulk{bottom:98px!important;width:calc(100% - 32px);justify-content:center;z-index:150;left:16px;transform:none;}
  }

  /* Panel empty */
  .lt-panel-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:40px 24px;text-align:center;}
  .lt-panel-empty-icon{font-size:26px;color:var(--ink-4);}
  .lt-panel-empty-text{font-size:12px;color:var(--ink-4);line-height:1.65;}

  /* Panel populated */
  .lt-panel-head{padding:24px 22px 0;border-bottom:1px solid var(--line);padding-bottom:18px;}
  .lt-panel-eyebrow{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);margin-bottom:10px;font-family:var(--font-mono);}
  .lt-panel-amount{font-family:var(--font-display);font-size:48px;letter-spacing:-1.5px;line-height:1;margin-bottom:4px;}
  .lt-panel-amount.income{color:var(--safe);}
  .lt-panel-amount.expense,.lt-panel-amount.bill,.lt-panel-amount.sub{color:var(--debt);}
  .lt-panel-name{font-size:14px;color:var(--ink-1);margin-bottom:2px;}
  .lt-panel-meta{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}

  .lt-panel-fields{padding:20px 22px;display:flex;flex-direction:column;gap:14px;}
  .lt-field{display:flex;flex-direction:column;gap:5px;}
  .lt-field-lbl{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink-3);font-family:var(--font-mono);}
  .lt-field-input{
    background:var(--bg-3);border:1px solid var(--line-2);border-radius:var(--r-sm);
    padding:8px 11px;color:var(--ink-0);font-size:13px;font-family:var(--font-ui);width:100%;outline:none;
  }
  .lt-field-input:focus{border-color:rgba(93,202,165,0.4);}
  .lt-field-select{
    background:var(--bg-3);border:1px solid var(--line-2);border-radius:var(--r-sm);
    padding:8px 11px;color:var(--ink-1);font-size:12px;font-family:var(--font-mono);width:100%;outline:none;cursor:pointer;
  }
  .lt-field-select:focus{border-color:rgba(93,202,165,0.4);}
  .lt-field-textarea{
    background:var(--bg-3);border:1px solid var(--line-2);border-radius:var(--r-sm);
    padding:8px 11px;color:var(--ink-1);font-size:12px;font-family:var(--font-ui);width:100%;outline:none;
    resize:none;line-height:1.55;
  }
  .lt-field-textarea:focus{border-color:rgba(93,202,165,0.4);}
  .lt-panel-review-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-family:var(--font-mono);color:var(--warn);background:var(--warn-bg);padding:4px 10px;border-radius:99px;margin-top:6px;}
  .lt-panel-review-badge.done{color:var(--safe);background:var(--safe-bg);}

  .lt-panel-actions{padding:0 22px 22px;display:flex;flex-direction:column;gap:8px;}
  .lt-panel-btn{
    width:100%;padding:9px 14px;border-radius:var(--r-md);font-size:12px;font-family:var(--font-ui);
    cursor:pointer;border:1px solid var(--line-2);background:transparent;color:var(--ink-2);
    display:flex;align-items:center;justify-content:center;gap:7px;transition:.12s;
  }
  .lt-panel-btn:hover{border-color:var(--line-3);color:var(--ink-0);}
  .lt-panel-btn.recur{border-color:rgba(249,115,22,0.35);color:#f97316;background:rgba(249,115,22,0.08);}
  .lt-panel-btn.recur:hover{background:rgba(249,115,22,0.14);}
  .lt-panel-btn.del{border-color:rgba(232,115,99,0.25);color:var(--debt);background:var(--debt-bg);}
  .lt-panel-btn.del:hover{background:rgba(232,115,99,0.14);}
  .lt-panel-btn.saved{border-color:rgba(93,202,165,0.4);color:var(--safe);background:var(--safe-bg);pointer-events:none;}
  @keyframes lt-check-pop{0%{transform:scale(0.5);opacity:0}60%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}
  .lt-panel-btn.saved span{display:inline-block;animation:lt-check-pop .25s ease-out;}
  .lt-panel-row{display:flex;gap:8px;}
  .lt-panel-row .lt-panel-btn{flex:1;}

  /* Bulk bar */
  .lt-bulk{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-3);border:1px solid var(--line-2);border-radius:var(--r-xl);padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:50;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:var(--font-mono);font-size:12px;}

  /* Sort arrows inline with th */
  .lt-sort-arrow { font-size:9px; opacity:0.6; margin-left:3px; }
`;

/* ─── Static data ─────────────────────────────────────────────────────────── */
const DN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const NAV_ITEMS = [
  {icon:"◐",id:"dashboard"},{icon:"⇅",id:"transactions",active:true},
  {icon:"▣",id:"accounts"},{icon:"◉",id:"budgets"},
  {icon:"▦",id:"calendar"},{icon:"◈",id:"analytics"},
];
const TYPE_OPTIONS = [
  {value:"expense",label:"Expense"},
  {value:"income",label:"Income"},
  {value:"bill",label:"Bill"},
  {value:"sub",label:"Subscription"},
  {value:"transfer",label:"Transfer"},
  {value:"reimbursement",label:"Reimbursement"},
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function typeOf(t)  { return t.type || (t.amount >= 0 ? "income" : "expense"); }
function stripCls(type) {
  if (type === "income")       return "income";
  if (type === "bill")         return "bill";
  if (type === "sub" || type === "subscription") return "sub";
  if (type === "transfer" || type === "reimbursement") return "transfer";
  return "expense";
}
function amtCls(type) { return stripCls(type); }
// Panel amount color — just income=green, everything else coral

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function LedgrTransactions({
  /* existing props */
  transactions = [],
  filteredTxns = [],
  categories = [],
  catMap = {},
  accounts = [],
  acctMap = {},
  search = "",
  handleTxnSearchChange,
  filterCat = "all",
  setFilterCat,
  filterAcct = "all",
  setFilterAcct,
  txnTypeFilter = "all",
  setTxnTypeFilter,
  txnSortCol = "date",
  setTxnSortCol,
  txnSortDir = "desc",
  setTxnSortDir,
  selectedTxns = new Set(),
  setSelectedTxns,
  needsReview = () => false,
  filterReview = false,
  setFilterReview,
  deleteTxn,
  openAddTxn,
  bulkSetCategory,
  bulkSetType,
  bulkDelete,
  bulkMarkReviewed,
  selectAllVisible,
  clearSelection,
  txnLoading = false,
  loadMoreTransactions,
  fmt = n => `$${Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
  today = new Date(),
  isMobile = false,
  navigate = () => {},
  notifs = [],
  onDismissNotif = () => {},
  onFilterReview = () => {},
  /* NEW props — see header comment for App.jsx wiring */
  updateTxnType   = () => {},
  updateTxnCat    = () => {},
  updateTxnNotes  = () => {},
  updateTxnName   = () => {},
  markReviewed    = () => {},
  onMakeRecurring = null,
  doSync = null,
  syncing = false,
}) {
  /* ── Local state ── */
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [panelName,   setPanelName]   = useState("");
  const [panelNotes,  setPanelNotes]  = useState("");
  const [panelSaved,  setPanelSaved]  = useState(false);
  const [bulkCatOpen,  setBulkCatOpen]  = useState(false);
  const [bulkTypeOpen, setBulkTypeOpen] = useState(false);

  /* Sync panel local state when selection changes */
  useEffect(() => {
    if (selectedTxn) {
      setPanelName(selectedTxn.name  || selectedTxn.merchant || "");
      setPanelNotes(selectedTxn.notes || "");
    }
  }, [selectedTxn?.id]);

  /* Keep panel in sync if transaction data updates (e.g. category save) */
  useEffect(() => {
    if (!selectedTxn) return;
    const live = filteredTxns.find(t => t.id === selectedTxn.id);
    if (live) setSelectedTxn(live);
  }, [filteredTxns]);

  /* ── Sort + filter ── */
  const sorted = useMemo(() => {
    const base =
      txnTypeFilter === "all"     ? filteredTxns :
      txnTypeFilter === "income"  ? filteredTxns.filter(t => t.amount > 0) :
                                    filteredTxns.filter(t => t.amount < 0);
    return [...base].sort((a, b) => {
      let av, bv;
      switch (txnSortCol) {
        case "date":     av = a.date||"";    bv = b.date||"";    break;
        case "merchant": av = (a.name||a.merchant||"").toLowerCase(); bv = (b.name||b.merchant||"").toLowerCase(); break;
        case "category": av = (catMap[a.categoryId]?.name||"").toLowerCase(); bv = (catMap[b.categoryId]?.name||"").toLowerCase(); break;
        case "account":  av = (acctMap[a.accountId]?.name||"").toLowerCase(); bv = (acctMap[b.accountId]?.name||"").toLowerCase(); break;
        case "amount":   av = Math.abs(a.amount); bv = Math.abs(b.amount); break;
        default:         av = a.date||"";    bv = b.date||"";
      }
      if (av < bv) return txnSortDir === "asc" ? -1 : 1;
      if (av > bv) return txnSortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [filteredTxns, txnTypeFilter, txnSortCol, txnSortDir, catMap, acctMap]);

  /* ── Sort toggle ── */
  function toggleSort(col) {
    if (txnSortCol === col) setTxnSortDir(d => d === "asc" ? "desc" : "asc");
    else { setTxnSortCol(col); setTxnSortDir(col === "amount" || col === "date" ? "desc" : "asc"); }
  }

  /* ── Bulk select ── */
  function toggleSel(id) {
    setSelectedTxns(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  /* ── Misc ── */
  const initials = accounts[0]?.institution?.slice(0,2).toUpperCase() || "ME";
  const timeLabel = `${DN[today.getDay()]}, ${MN[today.getMonth()]} ${today.getDate()}`;

  /* ── Panel save helpers ── */
  function savePanelName() {
    if (!selectedTxn) return;
    if (panelName.trim() && panelName.trim() !== (selectedTxn.name || selectedTxn.merchant)) {
      updateTxnName(selectedTxn.id, panelName.trim());
    }
  }
  function savePanelNotes() {
    if (!selectedTxn) return;
    if (panelNotes !== (selectedTxn.notes || "")) {
      updateTxnNotes(selectedTxn.id, panelNotes);
    }
  }
  function handleMakeRecurring() {
    if (!selectedTxn) return;
    if (onMakeRecurring) { onMakeRecurring(selectedTxn); }
    else                 { navigate("calendar"); }
  }

  /* ── Sort-header helper ── */
  function Th({ col, label, align = "left", style = {} }) {
    const active = txnSortCol === col;
    const arrow  = active ? (txnSortDir === "asc" ? " ↑" : " ↓") : "";
    return (
      <th
        className={`lt-th${active ? " active" : ""}`}
        style={{ textAlign: align, ...style }}
        onClick={() => toggleSort(col)}
      >
        {label}{arrow}
      </th>
    );
  }

  /* ── Panel: selected transaction ── */
  const type     = selectedTxn ? typeOf(selectedTxn) : "expense";
  const panelCat = selectedTxn ? catMap[selectedTxn.categoryId] : null;
  const panelAct = selectedTxn ? acctMap[selectedTxn.accountId] : null;
  const reviewed = selectedTxn ? !needsReview(selectedTxn) : true;

  /* ─────────────────────────────────────────────────────────────── RENDER ── */
  return (
    <>
      <style>{CSS}</style>
      <div className="lt-wrap">
        <div className="lt-frame">

          {/* Browser chrome */}
          <div className="lt-bar">
            <div className="lt-bar-dot"/><div className="lt-bar-dot"/><div className="lt-bar-dot"/>
            <span className="lt-bar-url">app.ledgr.app / transactions</span>
            <span className="lt-bar-live">
              live · synced just now
              {doSync && (
                <button
                  className={`lt-sync-btn${syncing ? " spinning" : ""}`}
                  onClick={() => !syncing && doSync()}
                  title="Sync now"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                </button>
              )}
            </span>
          </div>

          {/* 3-column body */}
          <div className="lt-body" style={isMobile?{display:"block",width:"100%"}:{}}>

            {/* ── Col 1: Nav ── */}
            {!isMobile&&<PageNav activeId="transactions" navigate={navigate} notifs={notifs} onDismissNotif={onDismissNotif} onFilterReview={onFilterReview}/>}

            {/* ── Col 2: Ledger list ── */}
            <div className="lt-main">

              {/* Topbar */}
              <div className="lt-topbar">
                <div className="lt-tb-left">
                  <span className="lt-tb-num">ii ·</span>
                  <span className="lt-tb-title">Transactions</span>
                  <span className="lt-tb-div"/>
                  <span className="lt-tb-sub">{timeLabel}</span>
                </div>
                <div className="lt-tb-right">
                  <button className="lt-btn primary" onClick={openAddTxn}>+ Add</button>
                </div>
              </div>

              {/* Filter bar */}
              <div className="lt-filters">
                <select className="lt-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                  <option value="all">All Categories</option>
                  {[...categories].sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select className="lt-select" value={filterAcct} onChange={e => setFilterAcct(e.target.value)}>
                  <option value="all">All Accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {[["all","All"],["income","Income"],["expense","Expenses"]].map(([v,l]) => (
                  <button
                    key={v}
                    className={`lt-btn${txnTypeFilter === v ? " active" : ""}`}
                    onClick={() => setTxnTypeFilter(v)}
                  >{l}</button>
                ))}
                {setFilterReview && (() => {
                  const unreviewedCount = filteredTxns.filter(t => needsReview(t)).length;
                  return unreviewedCount > 0 ? (
                    <button
                      className={`lt-btn${filterReview ? " active" : ""}`}
                      onClick={() => setFilterReview(p => !p)}
                      style={{display:"flex",alignItems:"center",gap:5}}
                    >
                      Unreviewed
                      <span style={{background:filterReview?"var(--safe)":"rgba(232,115,99,0.18)",color:filterReview?"#07090d":"var(--debt)",borderRadius:99,padding:"0 5px",fontSize:9,fontFamily:"var(--font-mono)",fontWeight:600,lineHeight:"16px",display:"inline-block"}}>
                        {unreviewedCount}
                      </span>
                    </button>
                  ) : null;
                })()}
                <div className="lt-search-box" style={{ marginLeft: "auto" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    placeholder="Search transactions…"
                    value={search}
                    onChange={handleTxnSearchChange}
                  />
                </div>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:11, color:"var(--ink-3)", whiteSpace:"nowrap" }}>
                  {sorted.length} entries
                </span>
              </div>

              {/* Ledger table */}
              <div className="lt-content">
                {sorted.length === 0 ? (
                  <div className="lt-empty">
                    <div className="lt-empty-title">Nothing found</div>
                    <div>Adjust your filters or search</div>
                  </div>
                ) : (
                  <table className="lt-table">
                    <thead>
                      <tr className="lt-thead-row">
                        {/* strip col — no header */}
                        <th className="lt-th" style={{ width:3, padding:0 }}/>
                        {/* checkbox — select all */}
                        <th className="lt-th lt-cb-col">
                          <input type="checkbox" className="lt-cb"
                            checked={sorted.length > 0 && sorted.every(t => selectedTxns.has(t.id))}
                            onChange={e => e.target.checked ? selectAllVisible?.() : clearSelection?.()}
                          />
                        </th>
                        <Th col="date"     label="Date"        style={{ width:80 }}/>
                        <Th col="merchant" label="Description"/>
                        <Th col="category" label="Category"    style={{ width:150 }}/>
                        <Th col="account"  label="Account"     style={{ width:130 }}/>
                        <Th col="amount"   label="Amount"      align="right" style={{ width:100 }}/>
                        {/* actions — no sort */}
                        <th className="lt-th" style={{ width:36 }}/>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(t => {
                        const cat     = catMap[t.categoryId];
                        const acct    = acctMap[t.accountId];
                        const ttype   = typeOf(t);
                        const isSel   = selectedTxn?.id === t.id;
                        const isInc   = t.amount > 0;
                        const review  = needsReview(t);
                        const isRecur = !!(t.recurringItemId || t.recurring);
                        // Priority: unreviewed > pending > income > recurring > none
                        const sCls    = review ? 'unreviewed' : t.pending ? 'pending' : isInc ? 'income' : isRecur ? 'recurring' : 'none';

                        return (
                          <tr
                            key={t.id}
                            className={`lt-tr${isSel ? " sel" : ""}`}
                            onClick={() => {
                              setSelectedTxn(isSel ? null : t);
                            }}
                          >
                            {/* Color strip */}
                            <td className="lt-td lt-strip">
                              <span className={`lt-strip-bar ${sCls}`}/>
                            </td>

                            {/* Checkbox */}
                            <td className="lt-td lt-cb-col" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" className="lt-cb"
                                checked={selectedTxns.has(t.id)}
                                onChange={() => setSelectedTxns(prev => {
                                  const n = new Set(prev);
                                  n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                                  return n;
                                })}
                              />
                            </td>

                            {/* Date */}
                            <td className="lt-td">
                              <div className="lt-cell">
                                <span className="lt-date-val">{t.date}</span>
                              </div>
                            </td>

                            {/* Merchant */}
                            <td className="lt-td" style={{ maxWidth:0 }}>
                              <div className="lt-cell">
                                <span className="lt-merchant-val">{t.name || t.merchant}</span>
                                {t.recurringItemId && (
                                  <span className="lt-merchant-badge recur">↻</span>
                                )}
                                {t.pending && (
                                  <span className="lt-merchant-badge" style={{background:"var(--warn-bg)",color:"var(--warn)"}}>pending</span>
                                )}
                                {review && (
                                  <span className="lt-merchant-badge review">review</span>
                                )}
                              </div>
                            </td>

                            {/* Category */}
                            <td className="lt-td">
                              <div className="lt-cell">
                                {cat ? (
                                  <span
                                    className="lt-cat-pill"
                                    style={{ background: cat.color + "18", color: cat.color, border: `1px solid ${cat.color}28` }}
                                  >
                                    <span className="lt-cat-dot" style={{ background: cat.color }}/>
                                    {cat.name}
                                  </span>
                                ) : (
                                  <span style={{ color:"var(--ink-4)", fontSize:11, fontFamily:"var(--font-mono)" }}>—</span>
                                )}
                              </div>
                            </td>

                            {/* Account */}
                            <td className="lt-td">
                              <div className="lt-cell">
                                <span className="lt-acct-val">{acct?.name || "—"}</span>
                              </div>
                            </td>

                            {/* Amount */}
                            <td className="lt-td">
                              <div className="lt-cell ra">
                                <span className={`lt-amt-val ${sCls}`}>
                                  {isInc ? "+" : "−"}{fmt(Math.abs(t.amount))}
                                </span>
                              </div>
                            </td>

                            {/* Row actions (visible on hover/select) */}
                            <td className="lt-td" onClick={e => e.stopPropagation()}>
                              <div className="lt-cell" style={{ justifyContent:"center" }}>
                                <div className="lt-row-acts">
                                  <button
                                    className="lt-row-btn"
                                    title="Delete"
                                    onClick={() => {
                                      if (selectedTxn?.id === t.id) setSelectedTxn(null);
                                      deleteTxn && deleteTxn(t.id);
                                    }}
                                  >✕</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {loadMoreTransactions && (
                  <div style={{ padding:"20px 28px", textAlign:"center" }}>
                    <button
                      className="lt-btn"
                      onClick={loadMoreTransactions}
                      disabled={txnLoading}
                      style={{ padding:"8px 20px", fontSize:12 }}
                    >
                      {txnLoading ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Col 3: Edit panel ── */}
            {!isMobile&&<div className="lt-panel">
              {!selectedTxn ? (
                /* Empty state */
                <div className="lt-panel-empty">
                  <div className="lt-panel-empty-icon">⇅</div>
                  <div className="lt-panel-empty-text">
                    Select a transaction to review or edit name, category, type, and notes
                  </div>
                </div>
              ) : (
                /* Populated */
                <>
                  {/* Head */}
                  <div className="lt-panel-head">
                    <div className="lt-panel-eyebrow">
                      transaction · {selectedTxn.date}
                      {selectedTxn.recurringItemId && (
                        <span style={{ color:"var(--calm)", marginLeft:8 }}>↻ recurring</span>
                      )}
                    </div>

                    <div className={`lt-panel-amount ${amtCls(type)}`}>
                      {selectedTxn.amount >= 0 ? "+" : "−"}{fmt(Math.abs(selectedTxn.amount))}
                    </div>

                    <div className="lt-panel-name">{selectedTxn.name || selectedTxn.merchant}</div>
                    <div className="lt-panel-meta">
                      {acctMap[selectedTxn.accountId]?.name || "No account"}
                      {selectedTxn.pending && (
                        <span style={{ color:"var(--warn)", marginLeft:8 }}>· pending</span>
                      )}
                    </div>

                    <div
                      className={`lt-panel-review-badge${reviewed ? " done" : ""}`}
                      style={{ cursor:"pointer" }}
                      onClick={() => markReviewed(selectedTxn.id)}
                    >
                      {reviewed ? "✓ Reviewed" : "⚠ Needs review — click to mark"}
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="lt-panel-fields">

                    <div className="lt-field">
                      <span className="lt-field-lbl">Name</span>
                      <input
                        className="lt-field-input"
                        value={panelName}
                        onChange={e => setPanelName(e.target.value)}
                        onBlur={savePanelName}
                        onKeyDown={e => { if (e.key === "Enter") { savePanelName(); e.target.blur(); } }}
                        placeholder="Transaction name…"
                      />
                    </div>

                    <div className="lt-field">
                      <span className="lt-field-lbl">Category</span>
                      <select
                        className="lt-field-select"
                        value={selectedTxn.categoryId || ""}
                        onChange={e => { const v = e.target.value; updateTxnCat(selectedTxn.id, v); }}
                      >
                        <option value="">— None —</option>
                        {[...categories]
                          .sort((a,b) => a.name.localeCompare(b.name))
                          .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                        }
                      </select>
                    </div>

                    <div className="lt-field">
                      <span className="lt-field-lbl">Type</span>
                      <select
                        className="lt-field-select"
                        value={typeOf(selectedTxn)}
                        onChange={e => updateTxnType(selectedTxn.id, e.target.value)}
                      >
                        {TYPE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="lt-field">
                      <span className="lt-field-lbl">Account</span>
                      <select
                        className="lt-field-select"
                        value={selectedTxn.accountId || ""}
                        onChange={e => {
                          /* updateTxnAcct is not a standard prop yet — extend when ready */
                          /* updateTxnAcct && updateTxnAcct(selectedTxn.id, e.target.value) */
                        }}
                      >
                        <option value="">— None —</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>

                    <div className="lt-field" style={{ flex:1 }}>
                      <span className="lt-field-lbl">Notes</span>
                      <textarea
                        className="lt-field-textarea"
                        rows={3}
                        placeholder="Add a note…"
                        value={panelNotes}
                        onChange={e => setPanelNotes(e.target.value)}
                        onBlur={savePanelNotes}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="lt-panel-actions">
                    <button className="lt-panel-btn recur" onClick={handleMakeRecurring}>
                      ↻ Make Recurring → Calendar
                    </button>
                    <div className="lt-panel-row">
                      <button
                        className={`lt-panel-btn${panelSaved ? " saved" : ""}`}
                        onClick={() => {
                          savePanelName();
                          savePanelNotes();
                          setPanelSaved(true);
                          setTimeout(() => setPanelSaved(false), 1800);
                        }}
                      >
                        {panelSaved ? <span>✓ Saved</span> : "Save Changes"}
                      </button>
                      <button
                        className="lt-panel-btn del"
                        onClick={() => {
                          if (window.confirm("Delete this transaction?")) {
                            deleteTxn && deleteTxn(selectedTxn.id);
                            setSelectedTxn(null);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <button
                      className="lt-panel-btn ghost"
                      style={{ fontSize:11, color:"var(--ink-3)" }}
                      onClick={() => setSelectedTxn(null)}
                    >
                      ✕ Dismiss
                    </button>
                  </div>
                </>
              )}
            </div>}
            {/* end edit panel */}

          </div>
          {/* end lt-body */}

        </div>
        {/* end lt-frame */}
      </div>
      {/* end lt-wrap */}

      {/* ── Bulk action bar ── */}
      {selectedTxns.size > 0 && (
        <div className="lt-bulk">
          <span style={{ color:"var(--ink-2)" }}>{selectedTxns.size} selected</span>
          <span style={{ width:1, height:16, background:"var(--line-2)", display:"inline-block" }}/>
          {bulkSetCategory && (
            <div style={{ position:"relative" }}>
              <button className="lt-btn" onClick={() => setBulkCatOpen(p => !p)}>Categorize ▾</button>
              {bulkCatOpen && (
                <>
                  <div style={{ position:"fixed", inset:0, zIndex:49 }} onClick={() => setBulkCatOpen(false)}/>
                  <div style={{ position:"absolute", bottom:"100%", left:0, marginBottom:8, background:"var(--bg-3)", border:"1px solid var(--line-2)", borderRadius:"var(--r-lg)", minWidth:200, maxHeight:280, overflowY:"auto", zIndex:50, boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
                    {categories.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { bulkSetCategory(c.id); setBulkCatOpen(false); }}
                        style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 14px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:"var(--ink-1)", textAlign:"left" }}
                      >
                        <span style={{ width:8, height:8, borderRadius:"50%", background:c.color, flexShrink:0 }}/>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {bulkSetType && (
            <div style={{ position:"relative" }}>
              <button className="lt-btn" onClick={() => setBulkTypeOpen(p => !p)}>Set type ▾</button>
              {bulkTypeOpen && (
                <>
                  <div style={{ position:"fixed", inset:0, zIndex:49 }} onClick={() => setBulkTypeOpen(false)}/>
                  <div style={{ position:"absolute", bottom:"100%", left:0, marginBottom:8, background:"var(--bg-3)", border:"1px solid var(--line-2)", borderRadius:"var(--r-lg)", minWidth:170, zIndex:50, boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
                    {[["expense","Expense"],["income","Income"],["transfer","Transfer"],["reimbursement","Reimbursement"]].map(([v,l]) => (
                      <button key={v}
                        onClick={() => { bulkSetType(v); setBulkTypeOpen(false); }}
                        style={{ display:"block", width:"100%", padding:"9px 14px", background:"none", border:"none", cursor:"pointer", fontSize:13, color:"var(--ink-1)", textAlign:"left" }}
                      >{l}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {bulkMarkReviewed && (
            <button className="lt-btn" onClick={() => bulkMarkReviewed(true)}>Mark reviewed</button>
          )}
          {bulkDelete && (
            <button
              className="lt-btn"
              style={{ color:"var(--debt)", borderColor:"rgba(232,115,99,0.3)" }}
              onClick={() => { if (window.confirm(`Delete ${selectedTxns.size} transactions?`)) bulkDelete(); }}
            >Delete</button>
          )}
          <button className="lt-btn" onClick={clearSelection}>✕ Clear</button>
        </div>
      )}
    </>
  );
}
