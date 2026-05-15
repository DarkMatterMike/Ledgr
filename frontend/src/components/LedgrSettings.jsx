/**
 * LedgrSettings.jsx — Settings page, Lumen shell design
 * src/components/LedgrSettings.jsx
 *
 * Fully self-contained. No dependency on App.jsx theme variables.
 * Props: same interface as the old SettingsView in App.jsx
 */
import { useState, useEffect } from "react";
import PageNav from "./PageNav.jsx";
import * as api from "../api.js";
import { applyTheme, applyGlobalOpacity } from "../theme/index.js";

/* ─────────────────────────────────────────────────────────
   CSS — scoped to .lgs-* namespace, Lumen dark tokens
───────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');

  /* ── Shared shell (matches LedgrBriefing lb-* exactly) ── */
  .lb-wrap{font-family:var(--font-ui);color:var(--ink-0);-webkit-font-smoothing:antialiased;background:var(--bg-0);min-height:100vh;padding:40px 48px 80px;}
  @media(max-width:1000px){.lb-wrap{padding:20px 16px 60px;}}
  @media(max-width:600px){.lb-wrap{padding:0;}}
  .lb-frame{background:var(--bg-1);border:1px solid var(--line);border-radius:20px;overflow:hidden;max-width:1400px;margin:0 auto;box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;flex-direction:column;min-height:80vh;}
  @media(max-width:600px){.lb-frame{border-radius:0;border:none;}
  @media(hover:none)and(pointer:coarse){
    .pn-nav{display:none!important;}
    .lgs-topbar{padding:0 16px;}
    .lgs-theme-grid{grid-template-columns:repeat(3,1fr)!important;}
    .lgs-input{width:100%!important;box-sizing:border-box;}
  }}
  .lb-bar{height:40px;background:var(--bg-2);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 18px;gap:8px;flex-shrink:0;}
  .lb-bar-dot{width:9px;height:9px;border-radius:50%;background:var(--ink-4);}
  .lb-bar-url{margin-left:14px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-bar-live{margin-left:auto;display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lb-bar-live::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--safe);box-shadow:0 0 8px var(--safe);display:inline-block;}
  .lb-brief{display:grid;grid-template-columns:64px 1fr;min-height:880px;}
  .lb-nav{width:64px;border-right:1px solid var(--line);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--bg-1);}
  .lb-nav-logo{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),var(--safe-d) 80%);margin-bottom:24px;}
  .lb-nav-item{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:18px;cursor:pointer;transition:.15s;user-select:none;}
  .lb-nav-item:hover{color:var(--ink-1);background:var(--bg-2);}
  .lb-nav-item.active{color:var(--safe);background:rgba(93,202,165,0.08);}
  .lb-nav-spacer{flex:1;}

  /* ── Settings main column ── */
  .lgs-main{display:flex;flex-direction:column;min-height:0;overflow:hidden;}
  .lgs-topbar{height:60px;padding:0 32px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .lgs-tb-left{display:flex;align-items:baseline;gap:16px;}
  .lgs-tb-eyebrow{font-family:var(--font-mono);font-size:11px;color:var(--ink-3);}
  .lgs-tb-title{font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px;color:var(--ink-0);}
  .lgs-tb-div{width:1px;height:14px;background:var(--line-2);flex-shrink:0;}
  .lgs-tb-sub{font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase;}
  .lgs-tabbar{border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 32px;background:var(--bg-1);flex-shrink:0;overflow-x:auto;}
  .lgs-tab{padding:12px 16px;font-family:var(--font-mono);font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-3);cursor:pointer;border-bottom:2px solid transparent;transition:.12s;white-space:nowrap;display:flex;align-items:center;gap:6px;flex-shrink:0;}
  .lgs-tab:hover{color:var(--ink-2);}
  .lgs-tab.active{color:var(--safe);border-bottom-color:var(--safe);}
  .lgs-content{flex:1;overflow-y:auto;}
  .lgs-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:24px;align-content:start;max-width:1016px;}

  /* Blocks */
  .lgs-block {
    background:var(--bg-2);
    border:1px solid var(--line);
    border-radius:10px;
    overflow:hidden;
  }
  .lgs-block.wide { grid-column:span 2; }
  .lgs-block.danger { border-color:rgba(232,115,99,0.18); }
  .lgs-block-hdr {
    padding:13px 18px;
    border-bottom:1px solid rgba(255,255,255,0.05);
    display:flex;
    align-items:center;
    justify-content:space-between;
  }
  .lgs-block-title {
    font-family:var(--font-mono);
    font-size:9px;
    letter-spacing:1.6px;
    text-transform:uppercase;
    color:var(--ink-3);
  }
  .lgs-block.danger .lgs-block-title { color:rgba(232,115,99,0.5); }
  .lgs-block.danger .lgs-block-hdr { border-bottom-color:rgba(232,115,99,0.1); }

  /* Rows */
  .lgs-row {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:11px 18px;
    border-bottom:1px solid rgba(255,255,255,0.03);
    gap:12px;
    flex-wrap:wrap;
  }
  .lgs-row:last-child { border-bottom:none; }
  .lgs-row.col { flex-direction:column; align-items:flex-start; gap:3px; }
  .lgs-row-label { font-size:12px; color:var(--ink-2); }
  .lgs-row-hint  { font-size:10px; color:var(--ink-3); margin-top:2px; }
  .lgs-row-val   { font-family:var(--font-mono); font-size:13px; color:var(--ink-0); }
  .lgs-row-sublabel { font-size:9px; color:var(--ink-3); text-transform:uppercase; letter-spacing:0.8px; }

  /* Inputs */
  .lgs-input {
    background:var(--bg-3);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:8px;
    padding:7px 10px;
    font-size:12px;
    font-family:var(--font-ui);
    color:var(--ink-0);
    outline:none;
    transition:.12s;
    width:100%;
  }
  .lgs-input:focus { border-color:rgba(93,202,165,0.4); box-shadow:0 0 0 2px rgba(93,202,165,0.08); }
  .lgs-input::placeholder { color:var(--ink-4); }
  .lgs-input.mono { font-family:var(--font-mono); font-size:11px; }

  /* Buttons */
  .lgs-btn {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 12px;
    border-radius:8px;
    font-size:12px; font-weight:500;
    cursor:pointer;
    transition:all .15s;
    white-space:nowrap;
    font-family:var(--font-ui);
    border:none;
    user-select:none;
  }
  .lgs-btn.primary {
    background:var(--safe);
    color:var(--bg-0);
    border:1px solid var(--safe);
  }
  .lgs-btn.primary:hover { filter:brightness(1.1); }
  .lgs-btn.primary:disabled { opacity:0.4; cursor:not-allowed; }
  .lgs-btn.ghost {
    background:var(--bg-3);
    color:var(--ink-2);
    border:1px solid rgba(255,255,255,0.07);
  }
  .lgs-btn.ghost:hover { color:var(--ink-1); border-color:rgba(255,255,255,0.12); }
  .lgs-btn.danger {
    background:rgba(232,115,99,0.1);
    color:var(--debt);
    border:1px solid rgba(232,115,99,0.25);
  }
  .lgs-btn.danger:hover { background:rgba(232,115,99,0.18); }
  .lgs-btn.sm { padding:3px 8px; font-size:11px; }

  /* Badges */
  .lgs-badge-connected {
    display:inline-flex; align-items:center; gap:5px;
    background:rgba(93,202,165,0.08);
    border:1px solid rgba(93,202,165,0.2);
    color:var(--safe);
    font-family:var(--font-mono);
    font-size:9px;
    padding:2px 8px;
    border-radius:99px;
  }
  .lgs-badge-connected::before {
    content:'';
    width:5px; height:5px;
    border-radius:50%;
    background:var(--safe);
    box-shadow:0 0 6px var(--safe);
    display:inline-block;
  }
  .lgs-badge-owner {
    display:inline-flex; align-items:center; gap:4px;
    background:rgba(93,202,165,0.08);
    border:1px solid rgba(93,202,165,0.2);
    border-radius:99px;
    padding:2px 8px;
    font-family:var(--font-mono);
    font-size:9px;
    color:var(--safe);
    letter-spacing:0.5px;
    margin-top:5px;
  }

  /* Identity avatar */

  /* Stats strip */
  .lgs-stats { display:grid; grid-template-columns:repeat(4,1fr); }
  .lgs-stat  { padding:14px 18px; border-right:1px solid rgba(255,255,255,0.04); }
  .lgs-stat:last-child { border-right:none; }
  .lgs-stat-l { font-family:var(--font-mono); font-size:9px; letter-spacing:1.2px; text-transform:uppercase; color:var(--ink-3); margin-bottom:5px; }
  .lgs-stat-v { font-family:var(--font-mono); font-size:20px; font-weight:600; color:var(--ink-0); }

  /* Theme swatches */
  .lgs-theme-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:5px; padding:14px 18px; }
  .lgs-swatch {
    display:flex; align-items:center; gap:6px;
    padding:6px 8px;
    border-radius:8px;
    background:var(--bg-3);
    border:1px solid rgba(255,255,255,0.05);
    cursor:pointer;
    font-size:11px; color:var(--ink-2);
    transition:.12s;
  }
  .lgs-swatch:hover { border-color:var(--safe); color:var(--ink-1); }

  /* Range slider */
  .lgs-range { width:100px; accent-color:var(--safe); }

  /* Trash items */
  .lgs-trash-item {
    display:flex; align-items:center; gap:10px;
    padding:7px 0;
    border-bottom:1px solid rgba(255,255,255,0.04);
  }
  .lgs-trash-item:last-child { border-bottom:none; }
`;

/* ─────────────────────────────────────────────────────────
   Theme presets (same list as App.jsx)
───────────────────────────────────────────────────────── */
const PRESETS = [
  { name:"Lumen",     bg:"#07090d", surface:"#0b0e14", card:"#11151d", accent:"#5dcaa5", t1:"#f4f4f1", t2:"rgba(244,244,241,0.55)", t3:"rgba(244,244,241,0.3)" },
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

const NAV=[{icon:"◐",id:"dashboard"},{icon:"⇅",id:"transactions"},{icon:"▣",id:"accounts"},{icon:"◉",id:"budgets"},{icon:"▦",id:"calendar"},{icon:"◈",id:"analytics"}];

const TABS = [
  { id:"profile",      label:"Profile",      icon:"◈" },
  { id:"ai",           label:"AI & API",     icon:"✦" },
  { id:"appearance",   label:"Appearance",   icon:"◑" },
  { id:"household",    label:"Household",    icon:"⬡" },
  { id:"data",         label:"Data",         icon:"⊟" },
  { id:"subscription", label:"Subscription", icon:"◆" },
];

/* ─────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────── */
export default function LedgrSettings({
  transactions=[], accounts=[], categories=[], catMap={}, acctMap={},
  avatarLetter="?",
  showToast=()=>{},
  setTransactions=()=>{}, setAccounts=()=>{}, setCategories=()=>{},
  setRules=()=>{}, setPlaidItems=()=>{}, plaidItems=[],
  access="free",
  userProfile={}, onSaveProfile=()=>{},
  theme={}, onSaveTheme=()=>{},
  deletedTransactions=[], setDeletedTransactions=()=>{},
  showTrash=false, setShowTrash=()=>{},
  scheduleSaveRef=null,
  isFamilyPlan=false,
  settingsTab="profile", setSettingsTab=()=>{},
  hasApiKey=false, saveApiKey=async()=>{},
  navigate=()=>{},
  isMobile=false,
  notifs=[],onDismissNotif=()=>{},onFilterReview=()=>{},
}) {
  const user = api.getStoredUser();

  /* ── local state ── */
  const [name,          setName]          = useState(user?.name || "");
  const [savingName,    setSavingName]    = useState(false);
  const [currPw,        setCurrPw]        = useState("");
  const [newPw,         setNewPw]         = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");
  const [pwError,       setPwError]       = useState("");
  const [pwSuccess,     setPwSuccess]     = useState(false);
  const [savingPw,      setSavingPw]      = useState(false);
  const [household,     setHousehold]     = useState(null);
  const [householdLoaded,setHouseholdLoaded]=useState(false);
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviting,      setInviting]      = useState(false);
  const [profileForm,   setProfileForm]   = useState(null);
  const [saveThemeName, setSaveThemeName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [apiKeyVal,     setApiKeyVal]     = useState("");
  const [savingKey,     setSavingKey]     = useState(false);

  useEffect(() => {
    api.getHousehold()
      .then(d => { setHousehold(d?.household || null); setHouseholdLoaded(true); })
      .catch(() => setHouseholdLoaded(true));
  }, []);

  /* ── handlers ── */
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

  async function handleSaveApiKey() {
    if (!apiKeyVal.trim()) return;
    setSavingKey(true);
    try { await saveApiKey(apiKeyVal.trim()); showToast("API key saved"); setApiKeyVal(""); }
    catch(e) { showToast(e.message || "Failed to save key"); }
    finally { setSavingKey(false); }
  }

  async function handleRemoveApiKey() {
    setSavingKey(true);
    try { await saveApiKey(""); showToast("API key removed"); }
    catch(e) { showToast(e.message || "Failed to remove key"); }
    finally { setSavingKey(false); }
  }

  function exportCSV() {
    const headers = ["Date","Name","Merchant","Amount","Type","Category","Account","Recurring"];
    const rows = transactions.map(t => [
      t.date||"", t.name||"", t.merchant||"", t.amount??"",
      t.type||"", catMap[t.categoryId]?.name||"", acctMap[t.accountId]?.name||"",
      t.recurring?"Yes":"No"
    ]);
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
    if (!window.confirm("Clear ALL data? This cannot be undone.")) return;
    for (const item of plaidItems||[]) { try { await api.deleteItem(item.item_id); } catch {} }
    setTransactions([]); setAccounts([]); setCategories([]); setRules([]); setPlaidItems([]);
    await Promise.all([api.deleteAllTransactions(),api.deleteAllAccountsApi(),api.deleteAllRulesApi(),api.saveData({categories:[],plaidItems:[]})]);
    showToast("All data cleared");
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try { await api.inviteToHousehold(inviteEmail.trim()); showToast("Invite sent!"); setInviteEmail(""); const d = await api.getHousehold(); setHousehold(d?.household||null); }
    catch(e) { showToast(e.message || "Failed to send invite"); }
    finally { setInviting(false); }
  }
  async function removeMember(id) {
    try { await api.removeHouseholdMember(id); const d = await api.getHousehold(); setHousehold(d?.household||null); showToast("Member removed"); }
    catch { showToast("Failed to remove member"); }
  }
  async function leaveHousehold() {
    try { await api.leaveHousehold(); setHousehold(null); showToast("Left household"); }
    catch { showToast("Failed to leave"); }
  }

  /* ── theme helpers ── */
  const defaults = PRESETS[0];
  const current  = { ...defaults, fontDisp:"'Syne', sans-serif", reviewColor:"#00d4ff", recurringColor:"#fbbf24", ...(theme||{}) };
  const gradSteps     = current.gradSteps ?? 6;
  const gradAngle     = current.gradAngle ?? 315;
  const globalOpacity = current.globalOpacity ?? 100;
  const savedThemes   = current._savedThemes || [];

  function patch(k,v) { onSaveTheme({...current,[k]:v}); }
  function patchGradSteps(steps) {
    const h2r = h => { const v=h.replace("#",""); return [parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16)]; };
    const r2h = ([r,g,b]) => "#"+[r,g,b].map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,"0")).join("");
    document.documentElement.style.setProperty("--card-hi", r2h(h2r(current.card||"var(--bg-2)").map(c=>c+steps)));
    patch("gradSteps",steps);
  }
  function patchGradAngle(a) { document.documentElement.style.setProperty("--grad-angle",a+"deg"); patch("gradAngle",a); }
  function patchGlobalOpacity(v) { applyGlobalOpacity(v,current); patch("globalOpacity",v); }
  function applyPreset(p) { onSaveTheme({...current,...p}); }
  function saveCurrentTheme() {
    if (!saveThemeName.trim()) return;
    const {_savedThemes:_,...data}=current;
    const entry={...data,name:saveThemeName.trim()};
    patch("_savedThemes",[...savedThemes.filter(t=>t.name!==entry.name),entry]);
    setSaveThemeName(""); setShowSaveInput(false); showToast("Theme saved: "+entry.name);
  }
  function deleteCustomTheme(n) { patch("_savedThemes",savedThemes.filter(t=>t.name!==n)); }
  function resetTheme() {
    ["--bg","--surface","--card","--border","--border2","--cyan","--cyan-dim","--t1","--t2","--t3","--font-disp"]
      .forEach(v=>document.documentElement.style.removeProperty(v));
    document.body.style.removeProperty("background");
    document.body.style.removeProperty("background-image");
    try { localStorage.removeItem("ledgr_theme"); } catch {}
    onSaveTheme({});
  }

  /* ── sub-components ── */
  const Block = ({ children, wide, danger, style={} }) => (
    <div className={`lgs-block${wide?" wide":""}${danger?" danger":""}`} style={style}>{children}</div>
  );
  const BH = ({ title, action }) => (
    <div className="lgs-block-hdr">
      <span className="lgs-block-title">{title}</span>
      {action}
    </div>
  );
  const Row = ({ children, col, style={} }) => (
    <div className={`lgs-row${col?" col":""}`} style={style}>{children}</div>
  );
  const RL = ({ label, hint }) => (
    <div>
      <div className="lgs-row-label">{label}</div>
      {hint && <div className="lgs-row-hint">{hint}</div>}
    </div>
  );
  const Btn = ({ children, variant="ghost", sm, disabled, onClick, style={} }) => (
    <button className={`lgs-btn ${variant}${sm?" sm":""}`} disabled={disabled} onClick={onClick} style={style}>{children}</button>
  );

  /* ─────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────── */
  return (
    <div className="lb-wrap">
      <style>{CSS}</style>

      <div className="lb-frame">

        {/* Chrome bar — identical to LedgrBriefing */}
        <div className="lb-bar">
          <div className="lb-bar-dot"/><div className="lb-bar-dot"/><div className="lb-bar-dot"/>
          <span className="lb-bar-url">app.ledgr.app / settings</span>
          <span className="lb-bar-live">live · synced just now</span>
        </div>

        <div className="lb-brief">

          {/* Nav rail — identical to LedgrBriefing */}
          {!isMobile&&<PageNav activeId="settings" navigate={navigate} notifs={notifs} onDismissNotif={onDismissNotif} onFilterReview={onFilterReview}/>}

          {/* Main */}
          <div className="lgs-main">

            {/* Topbar */}
            <div className="lgs-topbar">
              <div className="lgs-tb-left">
                <span className="lgs-tb-eyebrow">settings ·</span>
                <span className="lgs-tb-title">Settings</span>
                <div className="lgs-tb-div"/>
                <span className="lgs-tb-sub">{TABS.find(t=>t.id===settingsTab)?.label}</span>
              </div>
            </div>

            {/* Tab bar */}
            <div className="lgs-tabbar">
              {TABS.map(t => (
                <div key={t.id} className={`lgs-tab${settingsTab===t.id?" active":""}`} onClick={()=>setSettingsTab(t.id)}>
                  {t.icon} {t.label}
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="lgs-content">
              <div className="lgs-grid">

                {/* ══ PROFILE ══ */}
                {settingsTab === "profile" && <>
                  <Block>
                    <BH title="Identity"/>
                    <Row>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:"var(--ink-0)"}}>{user?.name||user?.email}</div>
                          <div style={{fontSize:10,color:"var(--ink-3)",marginTop:2}}>{user?.email}</div>
                          {user?.role==="owner" && <div className="lgs-badge-owner">◈ OWNER</div>}
                        </div>
                      </div>
                    </Row>
                    <Row>
                      <RL label="Display name" hint="Shown in app header"/>
                      <div style={{display:"flex",gap:6}}>
                        <input className="lgs-input" style={{width:150}} value={name}
                          onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveName()}/>
                        <Btn variant="primary" sm onClick={saveName} disabled={savingName}>{savingName?"…":"Save"}</Btn>
                      </div>
                    </Row>
                  </Block>

                  <Block>
                    <BH title="Security"/>
                    <Row>
                      <RL label="Current password"/>
                      <input className="lgs-input" style={{width:170}} type="password" placeholder="••••••••"
                        value={currPw} onChange={e=>{setCurrPw(e.target.value);setPwError("");}}/>
                    </Row>
                    <Row>
                      <RL label="New password"/>
                      <input className="lgs-input" style={{width:170}} type="password" placeholder="Min. 8 characters"
                        value={newPw} onChange={e=>{setNewPw(e.target.value);setPwError("");}}/>
                    </Row>
                    <Row>
                      <RL label="Confirm new password"/>
                      <input className="lgs-input" style={{width:170}} type="password" placeholder="••••••••"
                        value={confirmPw} onChange={e=>{setConfirmPw(e.target.value);setPwError("");}}/>
                    </Row>
                    {pwError   && <div style={{padding:"4px 18px",fontSize:11,color:"var(--debt)"}}>{pwError}</div>}
                    {pwSuccess && <div style={{padding:"4px 18px",fontSize:11,color:"var(--safe)"}}>Password updated ✓</div>}
                    <Row style={{justifyContent:"flex-end",borderBottom:"none"}}>
                      <Btn variant="primary" sm onClick={changePassword} disabled={savingPw}>{savingPw?"Updating…":"Update password"}</Btn>
                    </Row>
                  </Block>

                  <Block wide>
                    <BH title="Financial Profile" action={
                      <Btn variant="ghost" sm onClick={()=>setProfileForm(profileForm?null:{...userProfile})}>
                        {profileForm?"Cancel":"Edit"}
                      </Btn>
                    }/>
                    {profileForm ? (
                      <div style={{padding:"16px 18px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                        <div>
                          <div style={{fontSize:10,color:"var(--ink-3)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.8px"}}>Monthly income</div>
                          <input className="lgs-input" type="number" placeholder="0"
                            value={profileForm.monthlyIncome||""}
                            onChange={e=>setProfileForm(p=>({...p,monthlyIncome:parseFloat(e.target.value)||0}))}/>
                        </div>
                        {[["savingsGoal","Savings goal"],["emergencyFund","Emergency fund"],["netWorthTarget","Net worth target"],["retirementTargetAmount","Retirement nest egg"],["retirementAge","Retirement age"]].map(([k,l])=>(
                          <div key={k}>
                            <div style={{fontSize:10,color:"var(--ink-3)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.8px"}}>{l}</div>
                            <input className="lgs-input" type="number" placeholder="0"
                              value={k==="retirementAge"?profileForm.targets?.retirementAge||"":profileForm.targets?.[k]||""}
                              onChange={e=>setProfileForm(p=>({...p,targets:{...p.targets,[k]:(k==="retirementAge"?parseInt:parseFloat)(e.target.value)||0}}))}/>
                          </div>
                        ))}
                        <div style={{gridColumn:"span 3",display:"flex",gap:8,justifyContent:"flex-end",paddingTop:4}}>
                          <Btn variant="ghost" onClick={()=>setProfileForm(null)}>Cancel</Btn>
                          <Btn variant="primary" onClick={()=>{onSaveProfile(profileForm);setProfileForm(null);showToast("Profile saved");}}>Save profile</Btn>
                        </div>
                      </div>
                    ) : (
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)"}}>
                        {[
                          ["Monthly income",    userProfile?.monthlyIncome?`$${userProfile.monthlyIncome.toLocaleString()}`:"Not set"],
                          ["Retirement age",    userProfile?.targets?.retirementAge||"Not set"],
                          ["Net worth target",  userProfile?.targets?.netWorthTarget?`$${userProfile.targets.netWorthTarget.toLocaleString()}`:"Not set"],
                          ["Retirement target", userProfile?.targets?.retirementTargetAmount?`$${userProfile.targets.retirementTargetAmount.toLocaleString()}`:"Not set"],
                          ["Savings goal",      userProfile?.targets?.savingsGoal?`$${userProfile.targets.savingsGoal.toLocaleString()}/mo`:"Not set"],
                          ["Emergency fund",    userProfile?.targets?.emergencyFund?`$${userProfile.targets.emergencyFund.toLocaleString()}`:"Not set"],
                        ].map(([label,value])=>(
                          <Row key={label} col>
                            <div className="lgs-row-sublabel">{label}</div>
                            <div className="lgs-row-val">{value}</div>
                          </Row>
                        ))}
                      </div>
                    )}
                  </Block>

                  <Block wide>
                    <BH title="Manual Assets & Liabilities" action={
                      <Btn variant="ghost" sm onClick={()=>setProfileForm(profileForm?null:{...userProfile})}>Edit</Btn>
                    }/>
                    {profileForm ? (
                      <div style={{padding:"14px 18px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                        <div>
                          <div style={{fontSize:10,color:"var(--ink-3)",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.8px"}}>Assets</div>
                          {(profileForm.manualAssets||[]).map((a,i)=>(
                            <div key={i} style={{display:"flex",gap:6,marginBottom:6}}>
                              <input className="lgs-input" style={{flex:2}} placeholder="Name (e.g. Home)" value={a.name}
                                onChange={e=>setProfileForm(p=>{const assets=[...p.manualAssets];assets[i]={...assets[i],name:e.target.value};return{...p,manualAssets:assets};})}/>
                              <input className="lgs-input" type="number" style={{flex:1}} placeholder="Value" value={a.value||""}
                                onChange={e=>setProfileForm(p=>{const assets=[...p.manualAssets];assets[i]={...assets[i],value:parseFloat(e.target.value)||0};return{...p,manualAssets:assets};})}/>
                              <Btn variant="ghost" sm onClick={()=>setProfileForm(p=>({...p,manualAssets:p.manualAssets.filter((_,j)=>j!==i)}))}>✕</Btn>
                            </div>
                          ))}
                          <Btn variant="ghost" style={{width:"100%"}} onClick={()=>setProfileForm(p=>({...p,manualAssets:[...(p.manualAssets||[]),{name:"",value:0}]}))}>+ Add asset</Btn>
                        </div>
                        <div>
                          <div style={{fontSize:10,color:"var(--ink-3)",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.8px"}}>Liabilities</div>
                          {(profileForm.manualLiabilities||[]).map((l,i)=>(
                            <div key={i} style={{display:"flex",gap:6,marginBottom:6}}>
                              <input className="lgs-input" style={{flex:2}} placeholder="Name (e.g. Loan)" value={l.name}
                                onChange={e=>setProfileForm(p=>{const liabs=[...p.manualLiabilities];liabs[i]={...liabs[i],name:e.target.value};return{...p,manualLiabilities:liabs};})}/>
                              <input className="lgs-input" type="number" style={{flex:1}} placeholder="Amount" value={l.value||""}
                                onChange={e=>setProfileForm(p=>{const liabs=[...p.manualLiabilities];liabs[i]={...liabs[i],value:parseFloat(e.target.value)||0};return{...p,manualLiabilities:liabs};})}/>
                              <Btn variant="ghost" sm onClick={()=>setProfileForm(p=>({...p,manualLiabilities:p.manualLiabilities.filter((_,j)=>j!==i)}))}>✕</Btn>
                            </div>
                          ))}
                          <Btn variant="ghost" style={{width:"100%"}} onClick={()=>setProfileForm(p=>({...p,manualLiabilities:[...(p.manualLiabilities||[]),{name:"",value:0}]}))}>+ Add liability</Btn>
                        </div>
                        <div style={{gridColumn:"span 2",display:"flex",gap:8,justifyContent:"flex-end"}}>
                          <Btn variant="ghost" onClick={()=>setProfileForm(null)}>Cancel</Btn>
                          <Btn variant="primary" onClick={()=>{onSaveProfile(profileForm);setProfileForm(null);showToast("Profile saved");}}>Save</Btn>
                        </div>
                      </div>
                    ) : (
                      <Row style={{borderBottom:"none"}}>
                        <div style={{fontSize:12,color:"var(--ink-3)",fontStyle:"italic"}}>
                          {((userProfile?.manualAssets||[]).length+(userProfile?.manualLiabilities||[]).length)===0
                            ?"No manual assets or liabilities added."
                            :`${(userProfile?.manualAssets||[]).length} assets · ${(userProfile?.manualLiabilities||[]).length} liabilities`}
                        </div>
                      </Row>
                    )}
                  </Block>
                </>}

                {/* ══ AI & API ══ */}
                {settingsTab === "ai" && (
                  <Block wide>
                    <BH title="Claude API Key" action={hasApiKey ? <div className="lgs-badge-connected">connected</div> : null}/>
                    <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:12}}>
                      <div style={{fontSize:12,color:"var(--ink-3)",lineHeight:1.65,maxWidth:520}}>
                        Powers AI financial summaries on the Analytics page and daily Briefing insights.
                        Your key is encrypted at rest and never exposed in the UI.{" "}
                        <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
                          style={{color:"var(--safe)",textDecoration:"none"}}>Get a key → console.anthropic.com</a>
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <input className="lgs-input mono" style={{flex:1,maxWidth:400}}
                          type="password" placeholder="sk-ant-api03-…"
                          value={apiKeyVal} onChange={e=>setApiKeyVal(e.target.value)}
                          onKeyDown={e=>e.key==="Enter"&&handleSaveApiKey()}/>
                        <Btn variant="primary" onClick={handleSaveApiKey} disabled={savingKey||!apiKeyVal.trim()}>
                          {savingKey?"Saving…":"Save key"}
                        </Btn>
                        {hasApiKey && (
                          <Btn variant="ghost" style={{color:"var(--debt)"}} onClick={handleRemoveApiKey} disabled={savingKey}>Remove</Btn>
                        )}
                      </div>
                    </div>
                  </Block>
                )}

                {/* ══ APPEARANCE ══ */}
                {settingsTab === "appearance" && <>
                  <Block wide>
                    <BH title="Themes" action={
                      <Btn variant="ghost" sm onClick={()=>setShowSaveInput(p=>!p)}>
                        {showSaveInput?"Cancel":"+ Save current"}
                      </Btn>
                    }/>
                    {showSaveInput && (
                      <div style={{padding:"10px 18px 0",display:"flex",gap:8}}>
                        <input autoFocus className="lgs-input" style={{flex:1,fontSize:12}}
                          value={saveThemeName} onChange={e=>setSaveThemeName(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter")saveCurrentTheme();if(e.key==="Escape")setShowSaveInput(false);}}
                          placeholder="Theme name…"/>
                        <Btn variant="primary" sm onClick={saveCurrentTheme} disabled={!saveThemeName.trim()}>Save</Btn>
                      </div>
                    )}
                    {savedThemes.length>0 && (
                      <div style={{padding:"10px 18px 0"}}>
                        <div style={{fontSize:10,color:"var(--ink-3)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.8px"}}>My themes</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5,marginBottom:4}}>
                          {savedThemes.map(t=>(
                            <div key={t.name} style={{display:"flex",borderRadius:8,overflow:"hidden",border:"1px solid rgba(255,255,255,0.07)"}}>
                              <button onClick={()=>applyPreset(t)} style={{flex:1,display:"flex",alignItems:"center",gap:5,padding:"6px 8px",background:"var(--bg-3)",color:"var(--ink-2)",border:"none",cursor:"pointer",fontSize:11}}>
                                <span style={{display:"inline-flex",gap:2,flexShrink:0}}>
                                  {["bg","accent","t1"].map(k=><span key={k} style={{width:7,height:7,borderRadius:"50%",background:t[k]||"#888",display:"inline-block"}}/>)}
                                </span>
                                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                              </button>
                              <button onClick={()=>deleteCustomTheme(t.name)} style={{background:"var(--bg-3)",border:"none",borderLeft:"1px solid rgba(255,255,255,0.07)",color:"var(--ink-3)",cursor:"pointer",padding:"0 8px",fontSize:14}}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="lgs-theme-grid">
                      {PRESETS.map(p=>(
                        <div key={p.name} className="lgs-swatch" onClick={()=>applyPreset(p)}>
                          <span style={{display:"inline-flex",gap:2,flexShrink:0}}>
                            {["bg","accent","t1"].map(k=><span key={k} style={{width:7,height:7,borderRadius:"50%",background:p[k],display:"inline-block"}}/>)}
                          </span>
                          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </Block>

                  <Block>
                    <BH title="Custom Colors"/>
                    {VARS.map(({key,label})=>(
                      <Row key={key}>
                        <div className="lgs-row-label">{label}</div>
                        <input type="color"
                          value={current[key]?.startsWith("rgba")||current[key]?.startsWith("rgb")?"#888888":current[key]||"#888888"}
                          onChange={e=>patch(key,e.target.value)}
                          style={{width:36,height:28,borderRadius:6,border:"1px solid rgba(255,255,255,0.1)",background:"none",cursor:"pointer",padding:2}}/>
                      </Row>
                    ))}
                  </Block>

                  <Block>
                    <BH title="Typography"/>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,padding:"12px 18px"}}>
                      {FONTS.map(f=>{
                        const active=(current.fontDisp||"'Syne', sans-serif")===f.value;
                        return (
                          <button key={f.value} onClick={()=>patch("fontDisp",f.value)} style={{
                            padding:"8px 10px",borderRadius:8,fontSize:12,fontFamily:f.value,cursor:"pointer",
                            border:active?"1px solid rgba(93,202,165,0.3)":"1px solid rgba(255,255,255,0.05)",
                            background:active?"rgba(93,202,165,0.08)":"var(--bg-3)",
                            color:active?"var(--safe)":"var(--ink-2)",transition:"all .12s",
                          }}>{f.label}</button>
                        );
                      })}
                    </div>
                  </Block>

                  <Block>
                    <BH title="Fine Tuning"/>
                    {[
                      ["Surface contrast","Brightness between layers",gradSteps,0,30,v=>patchGradSteps(Number(v)),""],
                      ["Card angle","Gradient direction",gradAngle,0,360,v=>patchGradAngle(Number(v)),"°"],
                      ["Global opacity","UI transparency",globalOpacity,20,100,v=>patchGlobalOpacity(Number(v)),"%"],
                    ].map(([label,hint,val,min,max,fn,unit])=>(
                      <Row key={label}>
                        <RL label={label} hint={hint}/>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <input type="range" className="lgs-range" min={min} max={max} value={val} onChange={e=>fn(e.target.value)}/>
                          <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--ink-2)",width:36,textAlign:"right"}}>{val}{unit}</span>
                        </div>
                      </Row>
                    ))}
                  </Block>

                  <Block>
                    <BH title="Background Image"/>
                    <Row style={{borderBottom:"none",flexWrap:"wrap",gap:8}}>
                      <input id="lgs-bg-upload" type="file" accept="image/*" style={{display:"none"}}
                        onChange={e=>{
                          const file=e.target.files?.[0]; if(!file) return;
                          const reader=new FileReader();
                          reader.onload=ev=>onSaveTheme({...current,bgImage:ev.target.result});
                          reader.readAsDataURL(file); e.target.value="";
                        }}/>
                      <Btn variant="ghost" onClick={()=>document.getElementById("lgs-bg-upload").click()}>
                        🖼 {current.bgImage?"Change image":"Choose image"}
                      </Btn>
                      {current.bgImage && <>
                        <div style={{width:48,height:30,borderRadius:6,overflow:"hidden",flexShrink:0}}>
                          <img src={current.bgImage} alt="bg" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                        </div>
                        <Btn variant="ghost" style={{color:"var(--ink-3)"}} onClick={()=>{const n={...current};delete n.bgImage;onSaveTheme(n);}}>Remove</Btn>
                      </>}
                      <Btn variant="ghost" style={{color:"var(--ink-3)"}} onClick={resetTheme}>Reset theme</Btn>
                    </Row>
                  </Block>
                </>}

                {/* ══ HOUSEHOLD ══ */}
                {settingsTab === "household" && (
                  !householdLoaded ? (
                    <Block wide><Row style={{borderBottom:"none"}}><div style={{color:"var(--ink-3)",fontSize:13}}>Loading…</div></Row></Block>
                  ) : household ? (
                    <>
                      <Block>
                        <BH title="Members"/>
                        {(household.members||[]).map(m=>(
                          <Row key={m.id}>
                            <RL label={m.name||m.email} hint={m.role==="owner"?"Owner":m.status||""}/>
                            {m.role!=="owner" && <Btn variant="ghost" sm style={{color:"var(--debt)"}} onClick={()=>removeMember(m.id)}>Remove</Btn>}
                          </Row>
                        ))}
                        <Row style={{borderBottom:"none"}}>
                          <Btn variant="ghost" style={{color:"var(--debt)"}} onClick={leaveHousehold}>Leave household</Btn>
                        </Row>
                      </Block>
                      <Block>
                        <BH title="Invite Member"/>
                        <div style={{padding:"12px 18px",display:"flex",gap:8}}>
                          <input className="lgs-input" type="email" placeholder="Email address"
                            value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendInvite()}/>
                          <Btn variant="primary" onClick={sendInvite} disabled={inviting||!inviteEmail.trim()}>
                            {inviting?"Sending…":"Send invite"}
                          </Btn>
                        </div>
                      </Block>
                    </>
                  ) : (
                    <Block wide>
                      <BH title="Family Sharing"/>
                      <Row><div style={{fontSize:12,color:"var(--ink-3)",lineHeight:1.6}}>Share Ledgr with up to 2 household members. Each person keeps their own settings and theme.</div></Row>
                      <div style={{padding:"12px 18px",display:"flex",gap:8}}>
                        <input className="lgs-input" type="email" placeholder="Invite by email" style={{flex:1,maxWidth:300}}
                          value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendInvite()}/>
                        <Btn variant="primary" onClick={sendInvite} disabled={inviting||!inviteEmail.trim()}>
                          {inviting?"Sending…":"Invite"}
                        </Btn>
                      </div>
                    </Block>
                  )
                )}

                {/* ══ DATA ══ */}
                {settingsTab === "data" && <>
                  <Block wide>
                    <BH title="Overview"/>
                    <div className="lgs-stats">
                      {[["Transactions",transactions.length],["Accounts",accounts.length],["Categories",categories.length],["Bank connections",plaidItems?.length||0]].map(([label,val])=>(
                        <div key={label} className="lgs-stat">
                          <div className="lgs-stat-l">{label}</div>
                          <div className="lgs-stat-v">{val}</div>
                        </div>
                      ))}
                    </div>
                  </Block>

                  <Block>
                    <BH title="Export"/>
                    <Row>
                      <RL label="Download CSV" hint="All transactions, categories, and dates"/>
                      <Btn variant="primary" sm onClick={exportCSV}>Export CSV</Btn>
                    </Row>
                    <Row style={{borderBottom:"none"}}>
                      <RL label="Deleted transactions" hint={`${deletedTransactions?.length||0} items in trash`}/>
                      <Btn variant="ghost" sm onClick={()=>setShowTrash(p=>!p)}>{showTrash?"Hide trash":"View trash"}</Btn>
                    </Row>
                    {showTrash && (
                      <div style={{padding:"0 18px 12px"}}>
                        {(deletedTransactions||[]).length===0
                          ? <div style={{fontSize:12,color:"var(--ink-3)",padding:"10px 0"}}>Trash is empty</div>
                          : (deletedTransactions||[]).slice(0,20).map(t=>(
                            <div key={t.id} className="lgs-trash-item">
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,color:"var(--ink-2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                                <div style={{fontSize:10,color:"var(--ink-3)",marginTop:2}}>{t.date}</div>
                              </div>
                              <div style={{fontFamily:"var(--font-mono)",fontSize:12,color:t.amount<0?"var(--debt)":"var(--safe)",flexShrink:0}}>
                                {t.amount<0?"-":"+"}{`$${Math.abs(t.amount).toFixed(2)}`}
                              </div>
                              <Btn variant="ghost" sm onClick={()=>{
                                const restored={...t}; delete restored.deletedAt;
                                setTransactions(p=>[restored,...p]);
                                setDeletedTransactions(p=>{const next=p.filter(x=>x.id!==t.id);scheduleSaveRef?.current?.({deletedTransactions:next});return next;});
                                api.createTransaction(restored).catch(console.error);
                                showToast("Restored");
                              }}>Restore</Btn>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </Block>

                  <Block danger>
                    <BH title="Danger Zone"/>
                    <Row>
                      <RL label="Delete all transactions" hint="Cannot be undone"/>
                      <Btn variant="danger" sm onClick={deleteAllTransactions}>Delete all</Btn>
                    </Row>
                    <Row style={{borderBottom:"none"}}>
                      <RL label="Clear all data" hint="Removes all transactions, accounts, categories, rules, and bank connections"/>
                      <Btn variant="danger" sm onClick={clearAllData}>Clear everything</Btn>
                    </Row>
                  </Block>
                </>}

                {/* ══ SUBSCRIPTION ══ */}
                {settingsTab === "subscription" && <>
                  <Block wide>
                    <BH title="Current Plan"/>
                    <Row>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:"var(--ink-0)",marginBottom:3}}>
                          {access==="full"?(isFamilyPlan?"Family Plan":"Personal Plan"):"Free"}
                        </div>
                        <div style={{fontSize:12,color:"var(--ink-3)"}}>
                          {access==="full"?"Full access to all features":"Limited to dashboard and settings"}
                        </div>
                      </div>
                      {access==="full" && <div className="lgs-badge-connected">active</div>}
                    </Row>
                    {access!=="full" && (
                      <div style={{padding:"0 18px 14px"}}>
                        {["Unlimited transactions & accounts","Budget tracking & categories","Recurring calendar","Analytics & spending trends","AI-powered insights","Bank sync via Plaid"].map(f=>(
                          <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--ink-2)",padding:"4px 0"}}>
                            <span style={{color:"var(--safe)",fontSize:10}}>✓</span>{f}
                          </div>
                        ))}
                      </div>
                    )}
                    <Row style={{borderBottom:"none"}}>
                      <a href="https://www.useledgr.com/#pricing" target="_blank" rel="noreferrer"
                        style={{display:"inline-flex",alignItems:"center",padding:"5px 12px",borderRadius:8,background:"var(--safe)",color:"var(--bg-0)",fontWeight:600,fontSize:12,textDecoration:"none"}}>
                        {access==="full"?"Manage subscription":"Upgrade plan"}
                      </a>
                    </Row>
                  </Block>

                  <Block>
                    <BH title="Legal"/>
                    <Row>
                      <div className="lgs-row-label">Privacy Policy</div>
                      <a href="https://www.useledgr.com/privacy" target="_blank" rel="noreferrer" style={{fontSize:12,color:"var(--safe)",textDecoration:"none"}}>View →</a>
                    </Row>
                    <Row style={{borderBottom:"none"}}>
                      <div className="lgs-row-label">Terms of Service</div>
                      <a href="https://www.useledgr.com/terms" target="_blank" rel="noreferrer" style={{fontSize:12,color:"var(--safe)",textDecoration:"none"}}>View →</a>
                    </Row>
                  </Block>
                </>}

              </div>{/* /lgs-grid */}
            </div>{/* /lgs-content */}
          </div>{/* /lgs-main */}
        </div>{/* /lb-brief */}
      </div>{/* /lb-frame */}
    </div>
  );
}
