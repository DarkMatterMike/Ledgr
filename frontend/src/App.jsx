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
import LedgrSettings from "./components/LedgrSettings.jsx";
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
import Analytics from "./components/LedgrAnalytics.jsx";
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
import BudgetView from "./views/BudgetView.jsx";
import AppModals from "./components/AppModals.jsx";
import { useDashboardCards } from "./hooks/useDashboardCards.jsx";
import { useTransactionActions } from "./hooks/useTransactionActions.js";
import useCountUp from "./hooks/useCountUp.js";
import Paywall from "./components/Paywall.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import { usePlaidSync } from "./hooks/usePlaidSync.js";
import { useRulesAndGoals } from "./hooks/useRulesAndGoals.js";

import useIsMobile from "./hooks/useIsMobile.js";
import { DragCard, useDashboardColumns } from "./components/DragCard.jsx";
import PlaidButton from "./components/PlaidButton.jsx";
import { isAuthValid, AuthGate } from "./auth/AuthGate.jsx";

import "./styles/globalCSS.js";

/* --- Mobile detection -------------------------------------------- */


import { today, pad, fmt, cap, currentMonth, daysInMonth, daysLeft, NAV } from "./utils/globals.js";
export { NAV };









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
  const applyRulesRef    = useRef(null); // set after useRulesAndGoals initializes

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
    setCalendarAccounts, setCalendarSplitView, setAccess, setLoading, applyRulesRef,
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
  const lastSyncedAt   = useRef(parseInt(localStorage.getItem("ledgr_last_sync") || "0"));
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
              const toAdd = applyRulesRef.current
                ? applyRulesRef.current(brandNew.filter(t => !existingIds.has(t.id)), rulesRef.current, { onlyUncategorized: true })
                : brandNew.filter(t => !existingIds.has(t.id));
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
      const newTxns = applyRulesRef.current
        ? applyRulesRef.current((data.transactions||[]).filter(t => !existingIds.has(t.id)), rules, { onlyUncategorized: true })
        : (data.transactions||[]).filter(t => !existingIds.has(t.id));
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

  /* -- Rules + Goals (via hook) -- */
  const {
    applyRules, toggleSelectTxn, selectAllVisible, clearSelection,
    bulkSetCategory, bulkSetType, bulkSetAccount, bulkMarkReviewed, bulkDelete,
    promptSaveRule, confirmSaveRule, confirmTypeRule, saveRule, deleteRule, toggleRule,
    saveGoal, deleteGoal, assignTxnToGoal,
  } = useRulesAndGoals({
    rules, setRules,
    transactions, setTransactions,
    categories, accounts,
    showToast,
    selectedTxns, setSelectedTxns,
    filteredTxns,
    goals, setGoals,
    budgetKebabId, setBudgetKebabId,
    setRulePrompt, setTypeRulePrompt,
    scheduleSaveRef,
  });
  applyRulesRef.current = applyRules;
  /* -- Plaid (via hook) -- */
  const {
    normMerchant, fp, handleFocus, plaidTxnToLocal,
    disconnectItem, doSync, handlePlaidSuccess,
  } = usePlaidSync({
    accounts, setAccounts,
    transactions, setTransactions,
    plaidItems, setPlaidItems,
    setStaleItemIds, rules,
    showToast, syncing, setSyncing,
    setNewTxnNotifs, setNewTxnIds,
    initialized,
    applyRulesRef,
  });
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

  /* -- Transaction CRUD (via hook) -- */
  const {
    startRename, saveRename, updateTxnName, updateTxnType,
    updateTxnCat, updateTxnAcct, updateTxnNotes, deleteTxn,
    saveRecurringItem, deleteRecurringItem, linkTxnToRecurringItem,
    autoLinkTransaction, unlinkTxnFromRecurringItem,
    openNewRecurringItem, openEditRecurringItem, saveRecurringItemForm,
    toggleRecurring, updateRecurringDay, openAddTxn, saveManualTxn,
    runAutoCategorize, confirmCatSuggestions, searchTxnsForRI,
  } = useTransactionActions({
    transactions, setTransactions,
    categories, setCategories,
    rules, setRules,
    aiCatExamples, setAiCatExamples,
    showToast, showUndoToast,
    deletedTransactions, setDeletedTransactions,
    refreshSummary,
    setModal, setRecurringItemModal,
    setEditingId, setEditingName,
    setAutoCatRunning, setCatSuggestions,
    setRecurringItems,
    setRiForm, setEditingRecurringItem,
    setRiSearch, setRiSearchResults, setRiSearchLoading,
    setTxnForm, setTypeRulePrompt,
    scheduleSaveRef,
  });
  // DrillDownModal → extracted to AppModals

  const {
    dashCols, dashMoveItem, dashMoveToCol, dashEditMode, setDashEditMode,
    budgetAnalytics, onboardingSteps, onboardingComplete, onboardingProgress,
    dashCardDefs,
  } = useDashboardCards({
    categories, spentByCat, totalSpent, totalBudget, selectedMonth,
    isMobile, fmt, catMap, transactions, recurringTxns, recurringItems,
    accounts, goals, today, insightsTodos, sortedCategories, setDrillCat,
    dashboardCardOrder, setDashboardCardOrder, scheduleSaveRef,
    navigate, plaidItems, staleItemIds,
  });
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
      bulkSetType={bulkSetType}
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
  // BudgetView extracted to src/views/BudgetView.jsx
  const Budgets = <BudgetView
    sortedCategories={sortedCategories} spentByCat={spentByCat}
    totalSpent={totalSpent} totalBudget={totalBudget} selectedMonth={selectedMonth}
    isMobile={isMobile} fmt={fmt} catMap={catMap} monthTxns={monthTxns}
    budgetExpandedCatId={budgetExpandedCatId} setBudgetExpandedCatId={setBudgetExpandedCatId}
    budgetTxnSearch={budgetTxnSearch} setBudgetTxnSearch={setBudgetTxnSearch}
    saveCat={saveCat} deleteCat={deleteCat} toggleCatComplete={toggleCatComplete}
    showToast={showToast} categories={categories}
    budgetKebabId={budgetKebabId} setBudgetKebabId={setBudgetKebabId}
    openEditCat={openEditCat} openAddCat={openAddCat}
    saveCatName={saveCatName} startEditLimit={startEditLimit} saveLimit={saveLimit}
    editingCatNameId={editingCatNameId} setEditingCatNameId={setEditingCatNameId}
    editingCatName={editingCatName} setEditingCatName={setEditingCatName}
    editingLimitId={editingLimitId} setEditingLimitId={setEditingLimitId}
    editingLimitVal={editingLimitVal} setEditingLimitVal={setEditingLimitVal}
  />;

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
      showToast={showToast}
      fmt={fmt}
      today={today}
      isMobile={isMobile}
      navigate={navigate}
      notifs={visibleNotifs}
      onDismissNotif={id => setDismissedNotifs(prev => new Set([...prev, id]))}
      onFilterReview={() => { setFilterReview(true); navigate("transactions"); }}
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
  // All modals → extracted to AppModals

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


  /* ── Portfolio Plaid handler — must be declared before any early returns ── */
  const handlePortfolioPlaidSuccess = useCallback(async (publicToken, institutionName) => {
    try {
      const { item_id } = await api.exchangePublicToken(publicToken, institutionName);
      setPlaidItems(p => [...p.filter(i => i.item_id !== item_id), { item_id, institution: institutionName }]);
      showToast(`${institutionName} connected!`);
    } catch(e) { showToast("Connection failed: " + e.message); }
  }, []);

  /* ── SettingsPage ─────────────────────────────────── */
  if (view === "settings") return (
    <LedgrSettings
      theme={theme}
      onSaveTheme={t => {
        setTheme(t);
        applyTheme(t);
        const { bgImage, ...themeForServer } = t;
        scheduleSaveRef.current?.({ theme: themeForServer });
        try { localStorage.setItem('ledgr_theme', JSON.stringify(t)); } catch {}
      }}
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      catMap={catMap}
      acctMap={acctMap}
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
      settingsTab={settingsTab}
      setSettingsTab={setSettingsTab}
      hasApiKey={aiChat.hasApiKey}
      saveApiKey={aiChat.saveApiKey}
      navigate={navigate}
      notifs={visibleNotifs}
      onDismissNotif={id => setDismissedNotifs(prev => new Set([...prev, id]))}
      onFilterReview={() => { setFilterReview(true); navigate("transactions"); }}
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


  /* ── AnalyticsPage — full-screen bypass (same pattern as other Ledgr* views) ── */
  if (view === "analytics") return (
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
      navigate={navigate}
    />
  );


  const VIEWS = access === "full"
    ? { dashboard:Dashboard, transactions:Transactions, budgets:Budgets, accounts:Accounts, portfolio:PortfolioPage, rules:Rules, calendar:Calendar, ai:AiChatPage, admin:AdminPage, dani:DaniPageView }
    : { dashboard:Dashboard, transactions:paywallView, budgets:paywallView, accounts:paywallView, portfolio:paywallView, rules:paywallView, calendar:paywallView, ai:AiChatPage, admin:AdminPage, dani:DaniPageView };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#07090d",flexDirection:"column"}}>
      <div className="ll-orb" style={{width:44,height:44,borderRadius:"50%",background:"#085041",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
        <div style={{width:18,height:18,borderRadius:"50%",background:"#5dcaa5"}}/>
      </div>
      <div className="ll-fade" style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:36,letterSpacing:"-1px",color:"#f4f4f1",lineHeight:1,marginBottom:6}}>
        your <em style={{fontStyle:"italic",color:"#5dcaa5"}}>money</em>, told plainly.
      </div>
      <div className="ll-fade2" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:"2px",textTransform:"uppercase",color:"#4a5161",marginBottom:28}}>
        ledgr finance
      </div>
      <div style={{width:120,height:1,background:"#161c26",borderRadius:1,overflow:"hidden",position:"relative"}}>
        <div className="ll-bar" style={{position:"absolute",inset:0,width:40,background:"#5dcaa5",borderRadius:1}}/>
      </div>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#2e3340",marginTop:16,letterSpacing:"0.5px"}}>
        loading your data…
      </div>
    </div>
  );

  const _trialUser = api.getStoredUser();
  const trialDaysLeft = (_trialUser && _trialUser.role !== "owner" && _trialUser.role !== "free" && _trialUser.subscription_status === "trialing")
    ? Math.max(0, Math.ceil((_trialUser.trial_ends_at - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Mobile shell wrapper
  const MobileWrap = ({ children }) => isMobile ? (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden",background:"var(--bg-0,#07090d)"}}>
      <div style={{flex:1,overflowY:"auto",overscrollBehavior:"none"}}>{children}</div>
      <BottomNav view={view} navigate={navigate} moreOpen={moreOpen} setMoreOpen={setMoreOpen} currentUser={currentUser}/>
    </div>
  ) : <>{children}</>;

  // Full-screen views — bypass app shell entirely
  if (view === "dashboard") return <MobileWrap><LedgrBriefing
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
      doSync={doSync}
      syncing={syncing}
      notifs={visibleNotifs}
      onDismissNotif={id => setDismissedNotifs(prev => new Set([...prev, id]))}
      onFilterReview={() => { setFilterReview(true); navigate("transactions"); }}
    /></MobileWrap>;

  if (view === "transactions") return <MobileWrap><>
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
      bulkSetType={bulkSetType}
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
      filterReview={filterReview}
      setFilterReview={setFilterReview}
      notifs={visibleNotifs}
      onDismissNotif={id => setDismissedNotifs(prev => new Set([...prev, id]))}
      onFilterReview={() => { setFilterReview(true); navigate("transactions"); }}
    />
    </></MobileWrap>;

  if (view === "accounts") return <MobileWrap><>
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
    </></MobileWrap>;

  if (view === "budgets") return <MobileWrap><>
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
      doSync={doSync}
      syncing={syncing}
      notifs={visibleNotifs}
      onDismissNotif={id => setDismissedNotifs(prev => new Set([...prev, id]))}
      onFilterReview={() => { setFilterReview(true); navigate("transactions"); }}
    />
    </></MobileWrap>;

  if (view === "calendar") return <MobileWrap><>
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
        doSync={doSync}
        syncing={syncing}
        notifs={visibleNotifs}
        onDismissNotif={id => setDismissedNotifs(prev => new Set([...prev, id]))}
        onFilterReview={() => { setFilterReview(true); navigate("transactions"); }}
      />
    </></MobileWrap>;

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
        borderBottom:"2px solid var(--warn)",
        padding:"0 20px", height:45,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        backdropFilter:"blur(12px)",
      }}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <span style={{background:"var(--warn)", color:"#000", fontSize:10, fontWeight:800,
            padding:"2px 8px", borderRadius:99, letterSpacing:"1px", textTransform:"uppercase", flexShrink:0}}>
            Demo
          </span>
          <span style={{fontSize:13, color:"var(--ink-1)"}}>
            Exploring with sample data — nothing is saved
          </span>
        </div>
        <a href="https://ledgr-eight-zeta.vercel.app"
          style={{background:"var(--warn)", color:"#000", padding:"7px 18px",
            borderRadius:"var(--r-md)", fontSize:13, fontWeight:700,
            textDecoration:"none", whiteSpace:"nowrap", flexShrink:0}}>
          Get Started — It's Free ←
        </a>
      </div>
    )}
    <InstallPrompt />

    {/* System message modal */}
    {systemMsgOpen && systemMsg && (
      <div className="ledgr-overlay-anim" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(6px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div className="ledgr-modal-anim lumen-card" style={{...S.modal,maxWidth:460,width:"100%",display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>📢</span>
              <div style={{fontFamily:"var(--font-display)",fontSize:15,fontWeight:700,color:"var(--ink-0)"}}>Message from Ledgr</div>
            </div>
            <button onClick={()=>setSystemMsgOpen(false)}
              style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-2)",fontSize:18,lineHeight:1,padding:"2px 4px",flexShrink:0}}>✕</button>
          </div>
          <div style={{fontSize:14,color:"var(--ink-1)",lineHeight:1.7,padding:"4px 0"}}>
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
        flexShrink:0, background: trialDaysLeft <= 1 ? "var(--debt-bg)" : "#fbbf2415",
        borderBottom:`1px solid ${trialDaysLeft <= 1 ? "#ff4d6d44" : "#fbbf2433"}`,
        padding:"8px 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", gap:10,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color: trialDaysLeft <= 1 ? "var(--debt)" : "var(--warn)"}}>
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
            background: trialDaysLeft <= 1 ? "var(--debt)" : "var(--warn)",
            color:"#000", border:"none", borderRadius:"var(--r-md)",
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
        <div ref={contentRef} style={{flex:1,overflowY:"auto",overscrollBehavior:"none"}} className="lumen-content">
          {view === "dashboard"
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
            <button className="mobile-sheet-item" onClick={()=>{ setMoreOpen(false); navigate("admin"); }} style={{color:"var(--warn)"}}>
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
        <div style={{flex:1,overflowY:"auto",position:"relative"}} className="lumen-content" ref={contentRef}>
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
            
            
            {view === "dashboard"
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
      <AppModals
        drillCat={drillCat} setDrillCat={setDrillCat} catTxns={catTxns} spentByCat={spentByCat}
        budgetBarsAnimated={budgetBarsAnimated} view={view} isMobile={isMobile}
        selectedMonth={selectedMonth} monthLabel={monthLabel}
        editTarget={editTarget} setEditTarget={setEditTarget} modal={modal} setModal={setModal}
        toggleRecurring={toggleRecurring} showToast={showToast} recurringItems={recurringItems}
        recurringItemModal={recurringItemModal} setRecurringItemModal={setRecurringItemModal}
        categories={categories} accounts={accounts} transactions={transactions}
        setTransactions={setTransactions} saveCat={saveCat} saveAcct={saveAcct}
        acctForm={acctForm} setAcctForm={setAcctForm} catForm={catForm} setCatForm={setCatForm}
        fmt={fmt}
        editingRecurringItem={editingRecurringItem} setEditingRecurringItem={setEditingRecurringItem}
        riForm={riForm} setRiForm={setRiForm}
        riSearch={riSearch} setRiSearch={setRiSearch}
        ruleForm={ruleForm} setRuleForm={setRuleForm}
        txnForm={txnForm} setTxnForm={setTxnForm}
      />

      {/* Category suggestion confirmation modal */}
      {catSuggestions && (
        <div style={{position:"fixed",inset:0,background:"#0009",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
          onClick={e=>{ if(e.target===e.currentTarget) setCatSuggestions(null); }}>
          <div style={{background:"var(--bg-2)",border:"none",borderRadius:"var(--r-lg)",width:"100%",maxWidth:580,maxHeight:"85vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"20px 20px 14px",borderBottom:"1px solid var(--line)"}}>
              <div style={{fontSize:16,fontWeight:700,color:"var(--ink-0)",marginBottom:4}}>✦ Suggested Categories</div>
              <div style={{fontSize:12,color:"var(--ink-2)"}}>AI analyzed your transactions and suggested these categories. Set a monthly budget limit for each, then confirm to create them.</div>
            </div>
            <div style={{overflowY:"auto",padding:"14px 20px",flex:1,display:"flex",flexDirection:"column",gap:8}}>
              {catSuggestions.map((s, i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--bg-1)",borderRadius:"var(--r-md)",border:"none",borderLeft:`3px solid ${s.color||"var(--warn)"}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--ink-0)"}}>{s.name}</div>
                    <div style={{fontSize:11,color:"var(--ink-2)",marginTop:1}}>{(s.transactions||[]).length} transaction{(s.transactions||[]).length!==1?"s":""}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    <span style={{fontSize:11,color:"var(--ink-2)"}}>Limit $</span>
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
            <div style={{padding:"14px 20px",borderTop:"1px solid var(--line)",display:"flex",gap:8,justifyContent:"flex-end"}}>
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
          <div style={{width:4,background:"var(--warn)",flexShrink:0}}/>
          <div style={{flex:1,background:"#1e1a15",padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--ink-0)",marginBottom:2}}>Save as a rule?</div>
              <div style={{fontSize:12,color:"var(--ink-1)"}}>&quot;{rulePrompt.merchant}&quot; ← <strong style={{color:"var(--warn)"}}>{catMap[rulePrompt.categoryId]?.name}</strong></div>
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
              <div style={{fontSize:13,fontWeight:600,color:"var(--ink-0)",marginBottom:2}}>Create a type rule?</div>
              <div style={{fontSize:12,color:"var(--ink-1)"}}>Always mark &quot;{typeRulePrompt.merchant}&quot; as <strong style={{color:"#fbbf24",textTransform:"capitalize"}}>{typeRulePrompt.type}</strong></div>
            </div>
            <button style={{...S.btn("primary",true),background:"#fbbf24",borderColor:"#fbbf24",color:"#000"}} onClick={confirmTypeRule}>Save Rule</button>
            <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={()=>setTypeRulePrompt(null)}>✕</button>
          </div>
        </div>
      )}

      {selectedTxns.size > 0 && (
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:210,
          background:"var(--bg-2)",border:"none",borderRadius:12,
          padding:"12px 18px",boxShadow:"0 8px 32px #00000090",
          display:"flex",alignItems:"center",gap:10,maxWidth:640,width:"92vw",flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:700,color:"var(--warn)",marginRight:4,flexShrink:0}}>
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
          zIndex:300,background:"var(--warn)",color:"#000",
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
              <button onClick={()=>setShowTrash(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-2)",fontSize:20,lineHeight:1}}>✕</button>
            </div>
            {deletedTransactions.length === 0 ? (
              <div style={{flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--ink-2)", fontSize:13}}>No deleted transactions</div>
            ) : (
              <>
                <div style={{fontSize:11, color:"var(--ink-2)", marginBottom:12, flexShrink:0}}>{deletedTransactions.length} deleted transaction{deletedTransactions.length!==1?"s":""}</div>
                <div style={{overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:2}}>
                  {deletedTransactions.map(t=>{
                    const cat = catMap[t.categoryId];
                    const acct = acctMap[t.accountId];
                    const deletedDate = t.deletedAt ? new Date(t.deletedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "Unknown";
                    return (
                      <div key={t.id} style={{display:"flex", alignItems:"center", gap:10, padding:"9px 10px", background:"var(--bg-1)", borderRadius:"var(--r-md)", flexShrink:0}}>
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{fontSize:13, color:"var(--ink-0)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                          <div style={{fontSize:11, color:"var(--ink-2)", marginTop:2}}>
                            {t.date} · {cat ? <span style={{color:cat.color}}>{cat.name}</span> : "Uncategorized"}
                            {acct && <span> · {acct.name}</span>}
                            <span style={{marginLeft:6, opacity:0.6}}>deleted {deletedDate}</span>
                          </div>
                        </div>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:t.amount<0?"var(--debt)":"var(--safe)",flexShrink:0}}>
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
          <div style={{background:"var(--bg-2)",borderRadius:16,padding:"24px",width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:14}}>
            <div style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:800,color:"var(--ink-0)"}}>ledgr.</div>
            {inviteStatus==="loading" && <div style={{fontSize:13,color:"var(--ink-2)"}}>Checking invite…</div>}
            {inviteStatus==="error"   && <div style={{fontSize:13,color:"var(--debt)"}}>This invite link is invalid or has expired.</div>}
            {(inviteStatus==="ready"||inviteStatus==="accepting") && (<>
              <div style={{background:"var(--bg-1)",borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--ink-0)",marginBottom:4}}>You've been invited to a Ledgr household</div>
                <div style={{fontSize:12,color:"var(--ink-2)"}}>Sign in or create an account to accept.</div>
              </div>
              <input style={S.input} placeholder="Email" type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/>
              <input style={S.input} placeholder="Password" type="password" value={invitePw} onChange={e=>setInvitePw(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&acceptInvite()}/>
              {inviteError && <div style={{fontSize:12,color:"var(--debt)"}}>{inviteError}</div>}
              <button style={{...S.btn("primary"),width:"100%"}} onClick={acceptInvite} disabled={inviteStatus==="accepting"}>
                {inviteStatus==="accepting"?"Please wait…":inviteIsNew?"Create account & Accept":"Sign in & Accept"}
              </button>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-2)",fontSize:12,textAlign:"center"}}
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
