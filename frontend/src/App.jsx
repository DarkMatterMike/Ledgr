/**
 * src/App.jsx — Ledgr personal finance app
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePlaidLink } from "react-plaid-link";
import * as api from "./api.js";
import { useAppData } from "./hooks/useAppData.js";
import { useDuplicateScan } from "./hooks/useDuplicateScan.js";
import { usePortfolio } from "./hooks/usePortfolio.js";
import { useAiChat } from "./hooks/useAiChat.js";
import PortfolioView from "./PortfolioView.jsx";
import AiChat from "./AiChat.jsx";
import Analytics from "./Analytics.jsx";

/* ─── Mobile detection ──────────────────────────────────────────── */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

/* ─── Global CSS ─────────────────────────────────────────────────── */
(function injectCSS() {
  if (document.getElementById("ledgr-css")) return;
  const s = document.createElement("style");
  s.id = "ledgr-css";
  s.textContent = `
    * { box-sizing: border-box; }
button {
  background: transparent;
  border: none;
  outline: none;
  box-shadow: none;
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}
    .ledgr-content   { padding: 28px; }
    .ledgr-stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
    .ledgr-dash-cards { display: flex; flex-direction: column; gap: 16px; }
    .ledgr-acct-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .ledgr-budget-grid { display: grid; grid-template-columns: 1fr; gap: 0; }
    .ledgr-cal-cell  { min-height: 80px; padding: 8px; }

    /* ── Animations ───────────────────────────────────────────── */

    /* Sidebar logo — pulsing cyan glow */
    @keyframes ledgr-pulse-glow {
      0%, 100% { text-shadow: 0 0 8px #00d4ff44, 0 0 24px #00d4ff22; opacity: 1; }
      50%       { text-shadow: 0 0 24px #00d4ffcc, 0 0 48px #00d4ff66, 0 0 72px #00d4ff33; opacity: 0.85; }
    }
    .ledgr-logo-pulse { animation: ledgr-pulse-glow 2s ease-in-out infinite; }
    /* Loading screen — bounce */
    @keyframes ledgr-bounce {
      0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.33,0,0.66,0); }
      50%       { transform: translateY(-22px); animation-timing-function: cubic-bezier(0.33,1,0.66,1); }
    }
    .ledgr-logo-bounce { animation: ledgr-bounce 0.9s infinite; text-shadow: 0 0 24px #00d4ffcc, 0 0 48px #00d4ff66; }

    /* Loading text — subtle fade in/out */
    @keyframes ledgr-breathe {
      0%, 100% { opacity: 0.4; }
      50%       { opacity: 0.9; }
    }
    .ledgr-loading-text { animation: ledgr-breathe 2s ease-in-out infinite; }

    /* Page content — fade in when view changes (opacity only — no transform to avoid breaking position:fixed) */
    @keyframes ledgr-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .ledgr-view-enter { animation: ledgr-fade-in 0.18s ease-out both; }

    /* Cards — staggered fade in */
    @keyframes ledgr-card-up {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .ledgr-card-anim { animation: ledgr-card-up 0.25s ease-out both; }
    .ledgr-card-anim:nth-child(1) { animation-delay: 0ms; }
    .ledgr-card-anim:nth-child(2) { animation-delay: 50ms; }
    .ledgr-card-anim:nth-child(3) { animation-delay: 100ms; }
    .ledgr-card-anim:nth-child(4) { animation-delay: 150ms; }
    .ledgr-card-anim:nth-child(5) { animation-delay: 200ms; }
    .ledgr-card-anim:nth-child(n+6) { animation-delay: 250ms; }

    /* Modal — scale + fade in */
    @keyframes ledgr-modal-in {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .ledgr-modal-anim { animation: ledgr-modal-in 0.18s ease-out both; }

    /* Overlay — fade in */
    @keyframes ledgr-overlay-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .ledgr-overlay-anim { animation: ledgr-overlay-in 0.15s ease-out both; }

    /* Toast — slide up from bottom */
    @keyframes ledgr-toast-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ledgr-toast-anim { animation: ledgr-toast-in 0.2s ease-out both; }

    /* Auth gate shake (already exists, keeping consistent) */
    @keyframes shake {
      0%,100%{transform:translateX(0)}
      20%{transform:translateX(-8px)}
      40%{transform:translateX(8px)}
      60%{transform:translateX(-6px)}
      80%{transform:translateX(4px)}
    }
    .shake { animation: shake 0.5s ease; }

    /* Chevron rotation for expand/collapse */
    .ledgr-chevron { transition: transform 0.2s ease; display: inline-block; }
    .ledgr-chevron-open { transform: rotate(180deg); }

    /* Expand panel — fade + clip down */
    @keyframes ledgr-expand {
      from { opacity: 0; max-height: 0; }
      to   { opacity: 1; max-height: 800px; }
    }
    .ledgr-expand {
      animation: ledgr-expand 0.22s ease-out both;
      overflow: hidden;
    }

    /* Install prompt slide-up */
    @keyframes ledgr-slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .ledgr-slide-up { animation: ledgr-slide-up 0.3s ease-out both; }

    /* Nav item active indicator */
    @keyframes ledgr-nav-active {
      from { opacity: 0; transform: scaleX(0); }
      to   { opacity: 1; transform: scaleX(1); }
    }

    @media (max-width: 767px) {
      .ledgr-content   { padding: 16px !important; }
      .ledgr-stat-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
      .ledgr-filter-row { flex-direction: column !important; }
      .ledgr-filter-row > * { width: 100% !important; }
      .ledgr-txn-actions { flex-wrap: wrap !important; gap: 6px !important; }
      .ledgr-acct-grid  { grid-template-columns: 1fr !important; }
      .ledgr-monthbar   { flex-direction: column !important; gap: 10px !important; align-items: center !important; }
      .ledgr-monthbar-meta { flex-wrap: wrap !important; gap: 10px !important; justify-content: center !important; }
      .ledgr-cal-cell  { min-height: 54px !important; padding: 4px !important; }
    }
    @media (min-width: 768px) {
      .ledgr-dash-cards { flex-direction: row !important; align-items: flex-start; }
      .ledgr-dash-cards > * { flex: 1; min-width: 0; }
    }
  `;
  document.head.appendChild(s);
})();

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = {
  shell:        { display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", fontFamily:"var(--font-body)", color:"var(--t1)", background:"var(--bg)" },
  card:         { background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:20 },
  cardTitle:    { fontFamily:"var(--font-disp)", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"1.5px", color:"var(--t3)", marginBottom:16 },
  grid2:        { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  grid4:        { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 },
  stat:         { background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"20px 22px" },
  statLabel:    { fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 },
  statValue:    { fontFamily:"var(--font-mono)", fontSize:26, fontWeight:600 },
  statSub:      { fontSize:12, color:"var(--t2)", marginTop:4 },
  btn: (variant="ghost", sm=false) => {
    const base = { display:"inline-flex", alignItems:"center", gap:6, padding:sm?"5px 12px":"8px 16px", borderRadius:"var(--radius)", fontSize:13, fontWeight:500, cursor:"pointer", border:"1px solid transparent", transition:"all 0.15s", userSelect:"none", lineHeight:"1.4", whiteSpace:"nowrap" };
    if (variant==="primary") return { ...base, background:"var(--cyan)", color:"#000", borderColor:"var(--cyan)" };
    if (variant==="danger")  return { ...base, background:"var(--red-dim)", color:"var(--red)", borderColor:"#ff4d6d44" };
    if (variant==="amber")   return { ...base, background:"#fbbf2422", color:"var(--amber)", borderColor:"#fbbf2444" };
    return { ...base, background:"transparent", color:"var(--t2)", borderColor:"var(--border2)" };
  },
  input:        { background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"9px 12px", fontSize:13, color:"var(--t1)", outline:"none", width:"100%" },
  select:       { background:"var(--surface)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"6px 10px", fontSize:12, color:"var(--t1)", outline:"none" },
  field:        { display:"flex", flexDirection:"column", gap:6 },
  label:        { fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600 },
  overlay:      { position:"fixed", inset:0, background:"#00000088", backdropFilter:"blur(4px)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" },
  modal:        { background:"var(--card)", border:"1px solid var(--border2)", borderRadius:"var(--radius-lg)", padding:28, width:500, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto" },
  modalTitle:   { fontFamily:"var(--font-disp)", fontSize:18, fontWeight:800, marginBottom:20, letterSpacing:"-0.3px" },
  badge:        (color) => ({ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:99, fontSize:11, fontWeight:600, fontFamily:"var(--font-disp)", background:color+"22", color, border:`1px solid ${color}33`, whiteSpace:"nowrap" }),
  toast:        { position:"fixed", bottom:24, right:16, zIndex:999, background:"var(--card)", border:"1px solid var(--border2)", borderRadius:"var(--radius)", padding:"12px 18px", fontSize:13, color:"var(--t1)", boxShadow:"0 8px 32px #00000060" },
  monthBar:     { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"10px 16px", display:"flex", alignItems:"center", gap:16, fontSize:12, color:"var(--t2)", marginBottom:20, flexWrap:"wrap" },
  sectionHdr:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 },
  sectionTitle: { fontFamily:"var(--font-disp)", fontSize:16, fontWeight:700, letterSpacing:"-0.2px" },
  th:           { fontSize:10, textTransform:"uppercase", letterSpacing:"1.2px", color:"var(--t3)", fontWeight:700, padding:"10px 12px", textAlign:"left", whiteSpace:"nowrap", fontFamily:"var(--font-disp)", borderBottom:"1px solid var(--border)", position:"sticky", top:0, background:"var(--card)", zIndex:2 },
  td:           { padding:"12px 12px", fontSize:13, color:"var(--t2)", borderBottom:"1px solid var(--border)", verticalAlign:"middle" },
  filterRow:    { display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" },
};

/* ─── Constants ─────────────────────────────────────────────────── */
const CAT_COLORS   = ["#00d4ff","#00e676","#ff4d6d","#fbbf24","#a78bfa","#f97316","#06b6d4","#84cc16","#ec4899","#14b8a6","#8b5cf6","#ef4444","#22c55e","#3b82f6","#f59e0b"];
const DAYS_OF_WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const today        = new Date();
const pad          = n => String(n).padStart(2,"0");
const fmt          = n => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const cap          = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : "";
const currentMonth = `${today.getFullYear()}-${pad(today.getMonth()+1)}`;
const NAV = [
  { id:"dashboard",    icon:"◈", label:"Dashboard"    },
  { id:"transactions", icon:"⇅", label:"Transactions" },
  { id:"budgets",      icon:"◉", label:"Budgets"      },
  { id:"accounts",     icon:"▣", label:"Accounts"     },
  { id:"rules",        icon:"◎", label:"Rules"        },
  { id:"calendar",     icon:"▦", label:"Calendar"     },
  { id:"ai",           icon:"✦", label:"Ask AI"       },
];
function daysInMonth(y,m) { return new Date(y,m,0).getDate(); }
function daysLeft()        { return daysInMonth(today.getFullYear(), today.getMonth()+1) - today.getDate(); }

/* ─── Sub-components ─────────────────────────────────────────────── */
function CategoryBadge({ cat }) {
  if (!cat) return <span style={{color:"var(--t3)",fontSize:11}}>—</span>;
  return <span style={S.badge(cat.color)}><span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>{cat.name}</span>;
}
function Modal({ title, onClose, children, actions }) {
  return (
    <div style={S.overlay} className="ledgr-overlay-anim" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal} className="ledgr-modal-anim">
        <div style={S.modalTitle}>{title}</div>
        {children}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:24}}>{actions}</div>
      </div>
    </div>
  );
}
function Toast({ msg }) { return msg ? <div style={S.toast} className="ledgr-toast-anim">✓ {msg}</div> : null; }
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
      <button style={{...S.btn("primary"), ...style}} onClick={fetchToken} disabled={loading}>{loading?"…":"🏦 "+label}</button>
      {error && <div style={{marginTop:8,fontSize:12,color:"var(--red)"}}>{error}</div>}
    </div>
  );
}


const PAGE_RIGHT_COL_W = 340;
const PAGE_COL_GAP = 16;
const SHARED_LEFT_WIDTH = `calc(100% - ${PAGE_RIGHT_COL_W + PAGE_COL_GAP}px)`;

function PageLayout({ left, right = null, isMobile = false }) {
  if (isMobile) {
    return (
      <div style={{ width: "100%" }}>
        {left}
        {right ? <div style={{ marginTop: 16 }}>{right}</div> : null}
      </div>
    );
  }

  if (right) {
    return (
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: `minmax(0, 1fr) ${PAGE_RIGHT_COL_W}px`,
          gap: PAGE_COL_GAP,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>{left}</div>
        <div style={{ minWidth: 0 }}>{right}</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: SHARED_LEFT_WIDTH, minWidth: 0 }}>
      {left}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AUTH GATE  (email + password, multi-user)
═══════════════════════════════════════════════════════════════════ */
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

function LegalHeading({ children }) {
  return <div style={{ fontWeight:700, color:"var(--t1)", fontSize:14, marginTop:20, marginBottom:6 }}>{children}</div>;
}
function LegalP({ children }) {
  return <p style={{ margin:"0 0 10px", color:"var(--t2)" }}>{children}</p>;
}

function PrivacyPolicy() {
  return (
    <div>
      <LegalP>This Privacy Policy describes how Ledgr ("we", "us", or "our") collects, uses, and protects your information when you use ledgrfinance.app.</LegalP>

      <LegalHeading>1. Information We Collect</LegalHeading>
      <LegalP><strong>Account information:</strong> When you register, we collect your email address and a hashed version of your password. We never store your password in plain text.</LegalP>
      <LegalP><strong>Financial data:</strong> If you connect a bank account, we use Plaid to retrieve transaction history and account balances. This data is stored in our database and associated with your account. We do not sell or share your financial data with third parties.</LegalP>
      <LegalP><strong>Manually entered data:</strong> Transactions, accounts, categories, budgets, and rules you create manually are stored in our database.</LegalP>
      <LegalP><strong>Payment information:</strong> Payments are processed by Stripe. We do not store your full card number or payment details — only a Stripe customer ID used to manage your subscription.</LegalP>
      <LegalP><strong>Usage data:</strong> We may collect basic server logs (IP address, request timestamps) for security and debugging purposes. We do not use third-party analytics trackers.</LegalP>

      <LegalHeading>2. How We Use Your Information</LegalHeading>
      <LegalP>We use your information to provide and improve the ledgr service, process payments, send transactional emails (welcome, trial expiry, password reset, subscription confirmations), and respond to support requests. We do not use your financial data for advertising.</LegalP>

      <LegalHeading>3. Bank Connection (Plaid)</LegalHeading>
      <LegalP>Bank connections are powered by Plaid Technologies, Inc. When you connect a bank account, you are also subject to Plaid's Privacy Policy (plaid.com/legal). We store your Plaid access token in encrypted form. You can disconnect a bank account at any time from the Accounts page, which removes the connection and associated data.</LegalP>

      <LegalHeading>4. Data Storage and Security</LegalHeading>
      <LegalP>Your data is stored in a PostgreSQL database hosted on Neon. Plaid access tokens are encrypted at rest using AES-256. We use HTTPS for all data in transit. We take reasonable steps to protect your data but cannot guarantee absolute security.</LegalP>

      <LegalHeading>5. Data Retention and Deletion</LegalHeading>
      <LegalP>Your data is retained for as long as your account is active. You can delete all your data at any time from Settings → Your Data → Clear All Data. You can also delete your account by contacting us at support@ledgrfinance.app, which will permanently remove all your data within 30 days.</LegalP>

      <LegalHeading>6. Emails</LegalHeading>
      <LegalP>We send transactional emails only (welcome, password reset, subscription events, trial expiry warnings). We do not send marketing emails without your consent. You can opt out of non-essential emails by contacting support@ledgrfinance.app.</LegalP>

      <LegalHeading>7. Third-Party Services</LegalHeading>
      <LegalP>We use the following third-party services: Plaid (bank connectivity), Stripe (payment processing), Resend (transactional email), Neon (database hosting), Railway (backend hosting), and Vercel (frontend hosting). Each has their own privacy policy.</LegalP>

      <LegalHeading>8. Children's Privacy</LegalHeading>
      <LegalP>Ledgr is not intended for users under the age of 18. We do not knowingly collect information from minors.</LegalP>

      <LegalHeading>9. Changes to This Policy</LegalHeading>
      <LegalP>We may update this Privacy Policy from time to time. We will notify you of significant changes via email. Continued use of the service after changes constitutes acceptance of the updated policy.</LegalP>

      <LegalHeading>10. Contact</LegalHeading>
      <LegalP>If you have questions about this Privacy Policy, contact us at support@ledgrfinance.app.</LegalP>
    </div>
  );
}

function TermsOfService() {
  return (
    <div>
      <LegalP>These Terms of Service ("Terms") govern your use of ledgrfinance.app, operated by Ledgr ("we", "us", or "our"). By using Ledgr, you agree to these Terms.</LegalP>

      <LegalHeading>1. Eligibility</LegalHeading>
      <LegalP>You must be at least 18 years old to use Ledgr. By creating an account, you represent that you meet this requirement and that the information you provide is accurate.</LegalP>

      <LegalHeading>2. Your Account</LegalHeading>
      <LegalP>You are responsible for maintaining the security of your account password and for all activity that occurs under your account. Notify us immediately at support@ledgrfinance.app if you suspect unauthorized access.</LegalP>

      <LegalHeading>3. Subscription and Billing</LegalHeading>
      <LegalP>Ledgr is offered on a subscription basis at $4.99 per month following a 7-day free trial. Subscriptions automatically renew each month unless canceled. You may cancel at any time from Settings → Subscription → Manage Subscription. Cancellation takes effect at the end of the current billing period — no partial refunds are provided for unused time.</LegalP>
      <LegalP>Payments are processed by Stripe. By subscribing, you authorize us to charge your payment method on a recurring basis.</LegalP>

      <LegalHeading>4. Free Trial</LegalHeading>
      <LegalP>New accounts receive a 7-day free trial with full access to all features. At the end of the trial, a subscription is required to continue using write features and bank connections. Your data remains accessible in read-only mode without a subscription.</LegalP>

      <LegalHeading>5. Acceptable Use</LegalHeading>
      <LegalP>You agree not to use Ledgr to: violate any laws or regulations, attempt to gain unauthorized access to our systems, reverse engineer or scrape the service, or use the service for any purpose other than personal financial tracking.</LegalP>

      <LegalHeading>6. Financial Data Disclaimer</LegalHeading>
      <LegalP>Ledgr is a personal finance tracking tool. It does not provide financial advice, investment recommendations, or tax guidance. Transaction data imported from banks may contain errors or delays. Always verify important financial information with your financial institution directly.</LegalP>

      <LegalHeading>7. Bank Connections</LegalHeading>
      <LegalP>Bank connectivity is provided by Plaid Technologies, Inc. By connecting a bank account, you agree to Plaid's End User Privacy Policy. We are not responsible for errors, outages, or data discrepancies caused by Plaid or your financial institution.</LegalP>

      <LegalHeading>8. Data and Privacy</LegalHeading>
      <LegalP>Your use of Ledgr is also governed by our Privacy Policy. We take reasonable steps to protect your data but cannot guarantee absolute security. You are responsible for maintaining the confidentiality of your account credentials.</LegalP>

      <LegalHeading>9. Service Availability</LegalHeading>
      <LegalP>We strive to maintain high availability but do not guarantee uninterrupted access to the service. We may perform maintenance, updates, or experience outages that temporarily affect availability. We are not liable for any losses resulting from service interruptions.</LegalP>

      <LegalHeading>10. Termination</LegalHeading>
      <LegalP>You may close your account at any time by contacting support@ledgrfinance.app. We reserve the right to suspend or terminate accounts that violate these Terms. Upon termination, your data will be deleted within 30 days.</LegalP>

      <LegalHeading>11. Limitation of Liability</LegalHeading>
      <LegalP>To the maximum extent permitted by law, Ledgr shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service, including but not limited to loss of data, financial losses, or interruption of service.</LegalP>

      <LegalHeading>12. Disclaimer of Warranties</LegalHeading>
      <LegalP>Ledgr is provided "as is" without warranties of any kind, express or implied. We do not warrant that the service will be error-free, secure, or continuously available.</LegalP>

      <LegalHeading>13. Governing Law</LegalHeading>
      <LegalP>These Terms are governed by the laws of the State of Minnesota, United States, without regard to its conflict of law provisions.</LegalP>

      <LegalHeading>14. Changes to Terms</LegalHeading>
      <LegalP>We may update these Terms from time to time. We will notify you of material changes via email. Continued use of the service after changes constitutes acceptance of the updated Terms.</LegalP>

      <LegalHeading>15. Contact</LegalHeading>
      <LegalP>Questions about these Terms? Contact us at support@ledgrfinance.app.</LegalP>
    </div>
  );
}
function SecurityBadges({ compact = false }) {
  const lockIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
  const shieldIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  const noIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
  const checkIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;

  const items = [
    { icon: lockIcon,   label: "256-bit AES encryption",  detail: "Bank tokens encrypted at rest" },
    { icon: shieldIcon, label: "Read-only bank access",    detail: "We never see your login" },
    { icon: noIcon,     label: "Zero data selling",        detail: "Never sold or shared" },
    { icon: checkIcon,  label: "Full data control",        detail: "Export or delete anytime" },
  ];

  if (compact) {
    return (
      <div style={{
        marginTop: 20,
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 0",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
          <span style={{ color:"var(--cyan)", display:"flex" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </span>
          <span style={{ fontSize:11, fontWeight:600, color:"var(--t2)", letterSpacing:"0.3px" }}>Security &amp; Privacy</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ color:"var(--cyan)", display:"flex", flexShrink:0 }}>{item.icon}</span>
              <span style={{ fontSize:11, color:"var(--t2)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: 360, maxWidth: "92vw",
      background: "var(--card)",
      border: "1px solid var(--border2)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
    }}>
      {/* Header bar */}
      <div style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "11px 16px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ color:"var(--cyan)", display:"flex", flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </span>
        <span style={{ fontSize:12, fontWeight:600, color:"var(--t1)", flex:1 }}>Your data is protected</span>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--green)", flexShrink:0 }}/>
          <span style={{ fontSize:11, color:"var(--green)", fontWeight:500 }}>Secured</span>
        </div>
      </div>

      {/* 2×2 grid with divider lines */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
        {items.map((item, i) => (
          <div key={i} style={{
            padding: "13px 14px",
            borderRight:  i % 2 === 0 ? "1px solid var(--border)" : "none",
            borderBottom: i < 2       ? "1px solid var(--border)" : "none",
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <span style={{ color:"var(--cyan)", display:"flex", flexShrink:0, marginTop:1 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--t1)", marginBottom:2, lineHeight:1.3 }}>
                {item.label}
              </div>
              <div style={{ fontSize:11, color:"var(--t3)", lineHeight:1.4 }}>
                {item.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        padding: "8px 16px",
        fontSize: 10, color: "var(--t3)",
        textAlign: "center", letterSpacing: "0.2px",
      }}>
        Powered by Plaid · Hosted on Railway · AES-256 encryption
      </div>
    </div>
  );
}

function AuthGate({ onAuth }) {
  // Check for reset token in URL
  const resetToken = new URLSearchParams(window.location.search).get("reset");
  const [mode,          setMode]          = useState(resetToken ? "reset" : "login");
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [confirm,       setConfirm]       = useState("");
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState("");
  const [loading,       setLoading]       = useState(false);
  const [shake,         setShake]         = useState(false);
  const [agreedTerms,   setAgreedTerms]   = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [legalModal,    setLegalModal]    = useState(null); // "privacy" | "terms" | null

  function triggerShake(msg) {
    setError(msg); setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (mode === "forgot") {
      if (!email) return triggerShake("Email required");
      setLoading(true);
      try {
        await fetch(`https://ledgr-production-9e35.up.railway.app/api/auth/forgot-password`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setSuccess("If that email is registered, you'll receive a reset link shortly.");
      } catch { setSuccess("Check your email for a reset link."); }
      finally { setLoading(false); }
      return;
    }

    if (mode === "reset") {
      if (!password) return triggerShake("Password required");
      if (password.length < 8) return triggerShake("Password must be at least 8 characters");
      if (password !== confirm) return triggerShake("Passwords do not match");
      setLoading(true);
      try {
        const r = await fetch(`https://ledgr-production-9e35.up.railway.app/api/auth/reset-password`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, newPassword: password }),
        });
        const d = await r.json();
        if (!r.ok) return triggerShake(d.error || "Reset failed");
        window.history.replaceState({}, "", window.location.pathname);
        setSuccess("Password updated! You can now sign in.");
        setTimeout(() => switchMode("login"), 1500);
      } catch { triggerShake("Reset failed. Please try again."); }
      finally { setLoading(false); }
      return;
    }

    if (mode === "register" && password !== confirm) return triggerShake("Passwords do not match");
    if (mode === "register" && password.length < 8)  return triggerShake("Password must be at least 8 characters");
    if (mode === "register" && (!agreedTerms || !agreedPrivacy)) return triggerShake("Please agree to the Terms of Service and Privacy Policy");

    setLoading(true);
    try {
      if (mode === "login") await api.login(email, password);
      else                  await api.register(email, password);
      onAuth();
    } catch (err) {
      triggerShake(err.message || "Something went wrong");
      setPassword(""); setConfirm("");
    } finally { setLoading(false); }
  }

  function switchMode(m) {
    setMode(m); setError(""); setSuccess("");
    setPassword(""); setConfirm("");
  }

  function inputStyle(hasError) {
    return {
      background: "var(--surface)",
      border: `1px solid ${hasError ? "var(--red)" : "var(--border2)"}`,
      borderRadius: "var(--radius)", padding: "11px 14px",
      fontSize: 14, color: "var(--t1)", outline: "none", width: "100%",
      transition: "border-color 0.15s",
    };
  }

  const isForgotOrReset = mode === "forgot" || mode === "reset";

  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      height:"100vh", background:"var(--bg)", flexDirection:"column", gap:24,
      fontFamily:"var(--font-body)",
    }}>

      <div>
        <div style={{fontFamily:"var(--font-disp)",fontSize:36,fontWeight:800,letterSpacing:"-1px",color:"var(--t1)",textAlign:"center"}}>
          ledgr<span style={{color:"var(--cyan)"}}>.</span>
        </div>
        <div style={{fontSize:13,color:"var(--t3)",textAlign:"center",marginTop:4}}>personal finance</div>
      </div>

      <div className={shake?"shake":""} style={{
        background:"var(--card)", border:"1px solid var(--border2)",
        borderRadius:"var(--radius-lg)", padding:"32px 28px",
        width:360, maxWidth:"92vw",
        boxShadow:"0 8px 40px #00000060",
      }}>
        {/* Tab switcher — only for login/register */}
        {!isForgotOrReset && (
          <div style={{display:"flex",gap:0,marginBottom:24,background:"var(--surface)",borderRadius:"var(--radius)",padding:3}}>
            {["login","register"].map(m => (
              <button key={m} onClick={()=>switchMode(m)} style={{
                flex:1, padding:"7px 0", borderRadius:"var(--radius)",
                fontSize:13, fontWeight:600, cursor:"pointer", border:"none",
                background: mode===m ? "var(--card)" : "transparent",
                color: mode===m ? "var(--t1)" : "var(--t3)",
                boxShadow: mode===m ? "0 1px 4px #00000030" : "none",
                transition:"all 0.15s",
              }}>
                {m === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
        )}

        {/* Forgot/reset header */}
        {isForgotOrReset && (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:16,fontWeight:700,color:"var(--t1)",marginBottom:4}}>
              {mode === "forgot" ? "Forgot password" : "Reset password"}
            </div>
            <div style={{fontSize:13,color:"var(--t3)"}}>
              {mode === "forgot"
                ? "Enter your email and we'll send you a reset link."
                : "Enter your new password below."}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Email field — login, register, forgot */}
          {mode !== "reset" && (
            <input type="email" placeholder="Email address" value={email} autoFocus
              onChange={e=>{ setEmail(e.target.value); setError(""); }}
              style={inputStyle(!!error && !password)} />
          )}

          {/* Password field — login, register, reset */}
          {mode !== "forgot" && (
            <input type="password" placeholder={mode === "reset" ? "New password" : "Password"}
              value={password} autoFocus={mode === "reset"}
              onChange={e=>{ setPassword(e.target.value); setError(""); }}
              style={inputStyle(!!error)} />
          )}

          {/* Confirm password — register, reset */}
          {(mode === "register" || mode === "reset") && (
            <input type="password" placeholder="Confirm password" value={confirm}
              onChange={e=>{ setConfirm(e.target.value); setError(""); }}
              style={inputStyle(!!error && confirm !== password)} />
          )}

          {/* Terms checkboxes — register only */}
          {mode === "register" && (
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
              {[
                { checked: agreedTerms,   setChecked: setAgreedTerms,   doc:"terms",   label:"Terms of Service" },
                { checked: agreedPrivacy, setChecked: setAgreedPrivacy, doc:"privacy", label:"Privacy Policy"   },
              ].map(({ checked, setChecked, doc, label }) => (
                <label key={doc} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:12,color:"var(--t2)"}}>
                  <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}
                    style={{width:15,height:15,accentColor:"var(--cyan)",flexShrink:0,cursor:"pointer"}}/>
                  I agree to the{" "}
                  <button type="button" onClick={()=>setLegalModal(doc)}
                    style={{background:"none",border:"none",padding:0,color:"var(--cyan)",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>
                    {label}
                  </button>
                </label>
              ))}
            </div>
          )}

          {error   && <div style={{fontSize:12,color:"var(--red)"}}>{error}</div>}
          {success && <div style={{fontSize:12,color:"var(--green)"}}>{success}</div>}

          <button type="submit" disabled={loading} style={{
            marginTop:4,
            background:"var(--cyan)", color:"#000", border:"none",
            borderRadius:"var(--radius)", padding:"10px 16px",
            fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
            opacity:loading?0.7:1, transition:"opacity 0.15s",
          }}>
            {loading ? "…"
              : mode === "login"    ? "Sign In"
              : mode === "register" ? "Create Account"
              : mode === "forgot"   ? "Send Reset Link"
              : "Reset Password"}
          </button>
        </form>

        {/* Footer links */}
        <div style={{marginTop:16,textAlign:"center",display:"flex",flexDirection:"column",gap:8}}>
          {mode === "login" && (
            <button onClick={()=>switchMode("forgot")}
              style={{fontSize:12,color:"var(--t3)",background:"none",border:"none",cursor:"pointer"}}>
              Forgot your password?
            </button>
          )}
          {isForgotOrReset && (
            <button onClick={()=>switchMode("login")}
              style={{fontSize:12,color:"var(--t3)",background:"none",border:"none",cursor:"pointer"}}>
              ← Back to sign in
            </button>
          )}
        </div>
      </div>

      {/* Security badges — shown on register tab */}
      {mode === "register" && <SecurityBadges />}

      {/* Legal modal */}
      {legalModal && (
        <div style={S.overlay} className="ledgr-overlay-anim" onClick={()=>setLegalModal(null)}>
          <div style={{...S.modal,width:640,maxHeight:"82vh",display:"flex",flexDirection:"column"}} className="ledgr-modal-anim"
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexShrink:0}}>
              <div style={S.modalTitle}>
                {legalModal === "privacy" ? "Privacy Policy" : "Terms of Service"}
              </div>
              <button onClick={()=>setLegalModal(null)}
                style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:20,lineHeight:1}}>✕</button>
            </div>
            <div style={{overflowY:"auto",flex:1,fontSize:13,color:"var(--t2)",lineHeight:1.7}}>
              {legalModal === "privacy" ? <PrivacyPolicy /> : <TermsOfService />}
            </div>
            <div style={{marginTop:16,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:11,color:"var(--t3)"}}>Last updated: {new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
              <button onClick={()=>setLegalModal(null)} style={S.btn("primary",true)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => isAuthValid());

  // Periodically check if token has expired mid-session
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAuthValid()) setAuthed(false);
    }, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, []);

  if (!authed) return <AuthGate onAuth={()=>setAuthed(true)}/>;

  return <AppInner/>;
}

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS VIEW
═══════════════════════════════════════════════════════════════════ */
function SidebarContent({ onNav, view, syncing, doSync, showToast, avatarColor, avatarLetter }) {
  const currentUser = api.getStoredUser();
  const VAPID = "BLvUSGg-ljPgLVTY-54gYJrJvPEEIIokB5C-QTCAnSYW9ghmpeYmKQeIfQMsHl_opqis_d5QeORvyjoS1pfXRnY";
  return (
    <>
      <div style={{padding:"20px 20px 16px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontFamily:"var(--font-script)",fontSize:28,fontWeight:700,color:"var(--cyan)",lineHeight:1,marginTop:2}} className="ledgr-logo-pulse">ℓ</span>
          <div style={{fontFamily:"var(--font-disp)",fontSize:17,fontWeight:700,letterSpacing:"-0.5px",color:"var(--t1)",lineHeight:1}}>
            ledgr<span style={{color:"var(--cyan)"}}>.</span>
          </div>
        </div>
        <div style={{fontSize:11,color:"var(--t3)",marginTop:6,paddingLeft:1}}>personal finance</div>
      </div>
      <nav style={{flex:1,padding:"12px 10px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>onNav(n.id)}
            style={{
              display:"flex",alignItems:"center",gap:13,padding:"11px 14px",
              borderRadius:"var(--radius)",fontSize:14,fontWeight:500,cursor:"pointer",
              border:`1px solid ${view===n.id?"#00d4ff33":"transparent"}`,
              background:view===n.id?"var(--cyan-dim)":"transparent",
              color:view===n.id?"var(--cyan)":"var(--t2)",
              width:"100%",textAlign:"left",transition:"all 0.15s",
            }}>
            <span style={{fontSize:18,width:22,textAlign:"center",flexShrink:0}}>{n.icon}</span>
            <span>{n.label}</span>
            {view===n.id&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:"var(--cyan)",display:"inline-block"}}/>}
          </button>
        ))}
        {/* Owner-only nav items */}
        {currentUser?.role === "owner" && (
          <div style={{ marginTop:8, borderTop:"1px solid var(--border)", paddingTop:8, display:"flex", flexDirection:"column", gap:2 }}>
            <button onClick={()=>onNav("analytics")}
              style={{
                display:"flex",alignItems:"center",gap:13,padding:"11px 14px",
                borderRadius:"var(--radius)",fontSize:14,fontWeight:500,cursor:"pointer",
                border:`1px solid ${view==="analytics"?"#00d4ff33":"transparent"}`,
                background:view==="analytics"?"var(--cyan-dim)":"transparent",
                color:view==="analytics"?"var(--cyan)":"var(--t2)",
                width:"100%",textAlign:"left",transition:"all 0.15s",
              }}>
              <span style={{fontSize:18,width:22,textAlign:"center",flexShrink:0}}>◎</span>
              <span>Analytics</span>
              {view==="analytics"&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:"var(--cyan)",display:"inline-block"}}/>}
            </button>
            <button onClick={()=>onNav("admin")}
              style={{
                display:"flex",alignItems:"center",gap:13,padding:"11px 14px",
                borderRadius:"var(--radius)",fontSize:14,fontWeight:500,cursor:"pointer",
                border:`1px solid ${view==="admin"?"#00d4ff33":"transparent"}`,
                background:view==="admin"?"var(--cyan-dim)":"transparent",
                color:view==="admin"?"var(--cyan)":"var(--t2)",
                width:"100%",textAlign:"left",transition:"all 0.15s",
              }}>
              <span style={{fontSize:18,width:22,textAlign:"center",flexShrink:0}}>⬡</span>
              <span>Admin</span>
              {view==="admin"&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:"var(--cyan)",display:"inline-block"}}/>}
            </button>
          </div>
        )}
      </nav>
      <div style={{padding:"12px 10px",borderTop:"1px solid var(--border)",flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
        <button style={{...S.btn("ghost"),width:"100%",justifyContent:"center",fontSize:12}}
          onClick={()=>{ doSync(); onNav(view); }} disabled={syncing}>
          {syncing?"⟳ Syncing…":"⟳ Sync All"}
        </button>
        {"Notification" in window && Notification.permission !== "granted" && (
          <button style={{...S.btn("ghost"),width:"100%",justifyContent:"center",fontSize:12}}
            onClick={async ()=>{
              try {
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                  const reg = await navigator.serviceWorker.ready;
                  const toUint8 = b64 => {
                    const pad = "=".repeat((4-b64.length%4)%4);
                    const raw = atob((b64+pad).replace(/-/g,"+").replace(/_/g,"/"));
                    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
                  };
                  const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: toUint8(VAPID),
                  });
                  await api.subscribePush(sub);
                  showToast("Notifications enabled!");
                }
              } catch(e) { console.warn("Notification setup:",e.message); }
              onNav(view);
            }}>
            🔔 Enable Notifications
          </button>
        )}
        {/* User info + settings shortcut */}
        <div style={{borderTop:"1px solid var(--border)",paddingTop:8,marginTop:2}}>
          <button
            onClick={()=>onNav("settings")}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 6px",
              background:"transparent",border:"none",cursor:"pointer",borderRadius:"var(--radius)",
              textAlign:"left",transition:"background 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{
              width:28,height:28,borderRadius:"50%",flexShrink:0,
              background:avatarColor+"33",border:`1.5px solid ${avatarColor}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontFamily:"var(--font-disp)",fontSize:12,fontWeight:800,color:avatarColor,
            }}>
              {avatarLetter}
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {currentUser?.name || currentUser?.email}
              </div>
              {currentUser?.role==="owner"&&(
                <div style={{fontSize:9,color:"var(--cyan)",fontWeight:700,letterSpacing:"0.5px"}}>OWNER</div>
              )}
            </div>
            <span style={{fontSize:11,color:"var(--t3)",flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

function TxnRow({ t, expandedTxnId, setExpandedTxnId, ellipsisId, setEllipsisId,
  editingId, editingName, setEditingName, setEditingId,
  catMap, acctMap, categories, accounts,
  needsReview, markReviewed, startRename, deleteTxn,
  updateTxnType, updateTxnCat, updateTxnAcct, updateTxnNotes,
  openAddCat, toggleRecurring, updateRecurringDay, saveRename, isMobile,
  isSelected, onToggleSelect, selectionActive }) {

  const expanded   = expandedTxnId === t.id;
  const reviewed   = !needsReview(t);
  const typeVal    = t.type||(t.amount<0?"expense":"income");
  const noCategory = ["income","transfer","reimbursement"].includes(typeVal);
  const cat        = catMap[t.categoryId];
  const acct       = acctMap[t.accountId];

  return (
    <div style={{borderBottom:"1px solid var(--border)"}}>
      <div
        onClick={()=>{ if(selectionActive){ onToggleSelect(t.id); } else { setExpandedTxnId(expanded?null:t.id); } }}
        style={{padding:"10px 0",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
          borderLeft:t.recurring?"3px solid var(--amber)":needsReview(t)?"3px solid var(--cyan)":"3px solid transparent",
          paddingLeft:t.recurring||needsReview(t)?10:0,
          background: isSelected ? "var(--cyan-dim)" : "transparent",
          transition:"background 0.1s"}}>
        {/* Checkbox — always visible when selection active, hover otherwise */}
        <div onClick={e=>{e.stopPropagation();onToggleSelect(t.id);}}
          style={{width:16,height:16,borderRadius:3,flexShrink:0,cursor:"pointer",
            border:`1.5px solid ${isSelected?"var(--cyan)":"var(--border2)"}`,
            background:isSelected?"var(--cyan)":"transparent",
            display:"flex",alignItems:"center",justifyContent:"center",
            opacity: selectionActive ? 1 : 0.3,
            transition:"all 0.12s",
            marginLeft: t.recurring||needsReview(t) ? 0 : 0,
          }}>
          {isSelected && <span style={{fontSize:10,color:"#000",lineHeight:1,fontWeight:800}}>✓</span>}
        </div>
        {(t.recurring||!reviewed)&&<span style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:t.recurring?"var(--amber)":"var(--cyan)"}}/>}
        <span style={{fontSize:13,fontWeight:500,color:noCategory?"var(--t3)":"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>
          {t.name||t.merchant}
          {t.notes && <span style={{fontSize:11,color:"var(--t3)",marginLeft:6,fontStyle:"italic"}}>· {t.notes}</span>}
        </span>        {(!noCategory && cat) ? (
          <span style={{fontSize:11,color:cat.color,whiteSpace:"nowrap",flexShrink:0,maxWidth:"25%",overflow:"hidden",textOverflow:"ellipsis"}}>{cat.name}</span>
        ) : (
          <span style={{fontSize:11,color:"var(--t3)",whiteSpace:"nowrap",flexShrink:0,textTransform:"capitalize"}}>{typeVal}</span>
        )}
        <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0}}>
          {t.amount<0?"-":"+"}{fmt(Math.abs(t.amount))}
        </span>
        <div style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setEllipsisId(ellipsisId===t.id?null:t.id)}
            style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:16,padding:"2px 4px",lineHeight:1}}>⋯</button>
          {ellipsisId===t.id&&(
            <div style={{position:"absolute",right:0,top:"100%",zIndex:30,background:"var(--card)",
              border:"1px solid var(--border2)",borderRadius:"var(--radius)",
              boxShadow:"0 4px 16px #00000060",minWidth:150,overflow:"hidden"}}>
              <button onClick={()=>{markReviewed(t.id);setEllipsisId(null);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:reviewed?"var(--t3)":"var(--green)"}}>
                {reviewed?"Mark Unreviewed":"✓ Mark Reviewed"}
              </button>
              <button onClick={()=>{startRename(t);setEllipsisId(null);setExpandedTxnId(t.id);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t1)"}}>Rename</button>
              <button onClick={()=>{deleteTxn(t.id);setEllipsisId(null);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t2)"}}>Delete</button>
            </div>
          )}
        </div>
      </div>

      {expanded&&(
        <div className="ledgr-expand" style={{background:"var(--surface)",borderRadius:"var(--radius)",padding:"12px",marginBottom:10,display:"flex",flexDirection:"column",gap:10}}>
          {editingId===t.id&&(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input style={{...S.input,flex:1,fontSize:13}}
                value={editingName} onChange={e=>setEditingName(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")saveRename(t.id);if(e.key==="Escape")setEditingId(null);}} autoFocus/>
              <button style={S.btn("primary",true)} onClick={()=>saveRename(t.id)}>✓</button>
              <button style={S.btn("ghost",true)} onClick={()=>setEditingId(null)}>✕</button>
            </div>
          )}

          {/* Desktop: dropdowns left, notes right. Mobile: stacked */}
          <div style={{display:"flex", flexDirection: isMobile ? "column" : "row", gap:8}}>
            {/* Left: dropdowns */}
            <div style={{display:"flex", flexDirection:"column", gap:8, flex:1}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <select style={{...S.select,width:"100%",padding:"7px 8px",fontSize:12}}
                  value={typeVal} onChange={e=>updateTxnType(t.id,e.target.value)}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="refund">Refund</option>
                  <option value="reimbursement">Reimbursement</option>
                  <option value="transfer">Transfer</option>
                </select>
                {noCategory ? (
                  <div style={{...S.select,padding:"7px 8px",fontSize:12,color:"var(--t3)"}}>No category</div>
                ) : (
                  <select style={{...S.select,width:"100%",padding:"7px 8px",fontSize:12}}
                    value={t.categoryId||""}
                    onChange={e=>{ if(e.target.value==="__new__"){openAddCat();}else{updateTxnCat(t.id,e.target.value);} }}>
                    <option value="">— Category —</option>
                    {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value="__new__">＋ New…</option>
                  </select>
                )}
              </div>
              <select style={{...S.select,width:"100%",padding:"7px 8px",fontSize:12}}
                value={t.accountId||""} onChange={e=>updateTxnAcct(t.id,e.target.value)}>
                <option value="">— Account —</option>
                {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Right: notes textarea */}
            <textarea
              placeholder="Add a note…"
              value={t.notes||""}
              onChange={e=>updateTxnNotes(t.id,e.target.value)}
              rows={2}
              style={{
                ...S.input,
                flex: isMobile ? undefined : "0 0 38%",
                width: isMobile ? "100%" : undefined,
                resize:"none", fontSize:12,
                padding:"7px 10px", lineHeight:1.5,
                fontFamily:"var(--font-body)",
              }}
            />
          </div>

          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>toggleRecurring(t.id)} style={{...S.btn(t.recurring?"amber":"ghost",true)}}>
              {t.recurring?"↻ Recurring":"↻ Mark Recurring"}
            </button>
            {t.recurring&&(
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--t2)"}}>
                Day: <input type="number" min="1" max="31"
                  style={{...S.input,width:52}}
                  value={t.recurringDay||""} onChange={e=>updateRecurringDay(t.id,e.target.value)}/>
              </div>
            )}
            <button onClick={()=>setExpandedTxnId(null)} style={{...S.btn("ghost",true),marginLeft:"auto"}}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

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
      <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
      <div style={{ fontFamily:"var(--font-disp)", fontSize:24, fontWeight:800, color:"var(--t1)", marginBottom:8 }}>
        {trialEnded ? "Your trial has ended" : "Upgrade to continue"}
      </div>
      <div style={{ fontSize:14, color:"var(--t3)", maxWidth:360, marginBottom:32, lineHeight:1.6 }}>
        {trialEnded
          ? "Your 7-day free trial has ended. Subscribe to continue tracking your finances and connecting bank accounts."
          : "Subscribe to unlock full access — add transactions, connect banks, and sync automatically."}
      </div>

      <div style={{
        background:"var(--card)", border:"1px solid var(--border2)",
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
        onClick={() => { api.clearToken(); window.location.reload(); }}
        style={{ fontSize:12, color:"var(--t3)", background:"none", border:"none", cursor:"pointer" }}>
        Sign out
      </button>
    </div>
  );
}


function SettingsSection({ title, children }) {
  return (
    <div style={{ ...S.card, marginBottom:16 }}>
      <div style={S.cardTitle}>{title}</div>
      {children}
    </div>
  );
}

function SettingsView({ transactions, accounts, categories, catMap, acctMap, avatarColor, avatarLetter, showToast, setTransactions, setAccounts, setCategories, setRules, setPlaidItems, plaidItems, access, userProfile, onSaveProfile }) {
  const user = api.getStoredUser();
  const [name,       setName]       = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [currPw,     setCurrPw]     = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [pwError,    setPwError]    = useState("");
  const [pwSuccess,  setPwSuccess]  = useState(false);
  const [savingPw,   setSavingPw]   = useState(false);
  const [legalDoc,   setLegalDoc]   = useState(null); // "privacy" | "terms" | null

  // Financial profile local state
  const [profileForm, setProfileForm] = useState(null); // null = not editing

  async function saveName() {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await api.updateProfile(name.trim());
      api.setStoredUser({ ...user, name: name.trim() });
      showToast("Name saved");
    } catch { showToast("Failed to save name"); }
    finally { setSavingName(false); }
  }

  async function changePassword() {
    setPwError(""); setPwSuccess(false);
    if (!currPw || !newPw)   return setPwError("All fields required");
    if (newPw.length < 8)    return setPwError("New password must be at least 8 characters");
    if (newPw !== confirmPw) return setPwError("Passwords do not match");
    setSavingPw(true);
    try {
      await api.changePassword(currPw, newPw);
      setPwSuccess(true);
      setCurrPw(""); setNewPw(""); setConfirmPw("");
      showToast("Password updated");
    } catch (e) { setPwError(e.message || "Failed to update password"); }
    finally { setSavingPw(false); }
  }

  function exportCSV() {
    const headers = ["Date","Name","Merchant","Amount","Type","Category","Account","Recurring"];
    const rows = transactions.map(t => [
      t.date || "", t.name || "", t.merchant || "",
      t.amount ?? "", t.type || "",
      catMap[t.categoryId]?.name || "",
      acctMap[t.accountId]?.name || "",
      t.recurring ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `ledgr-export-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export downloaded");
  }

  function deleteAllTransactions() {
    if (!transactions.length) { showToast("No transactions to delete"); return; }
    const confirmed = window.confirm(`Delete all ${transactions.length} transactions? This cannot be undone.`);
    if (!confirmed) return;
    setTransactions([]);
    showToast("All transactions deleted");
  }

  async function clearAllData() {
    const confirmed = window.confirm(
      "Clear ALL data? This will delete all transactions, accounts, categories, rules, and bank connections. This cannot be undone."
    );
    if (!confirmed) return;
    // Disconnect all Plaid items from the server first
    for (const item of plaidItems || []) {
      try { await api.deleteItem(item.item_id); } catch {}
    }
    // Clear state
    setTransactions([]);
    setAccounts([]);
    setCategories([]);
    setRules([]);
    setPlaidItems([]);
    // Explicitly save empty arrays to DB so they don't get restored on next load
    await api.saveData({ transactions: [], accounts: [], categories: [], rules: [], plaidItems: [] });
    showToast("All data cleared");
  }

  const inputSt = { ...S.input, marginBottom:0 };

  return (
    <>
    <div style={{ maxWidth:560 }}>

      {/* Profile */}
      <SettingsSection title="Profile">
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20 }}>
          <div style={{
            width:56, height:56, borderRadius:"50%", flexShrink:0,
            background:avatarColor+"33", border:`2px solid ${avatarColor}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"var(--font-disp)", fontSize:22, fontWeight:800, color:avatarColor,
          }}>
            {avatarLetter}
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)" }}>{user?.name || user?.email}</div>
            <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>{user?.email}</div>
            {user?.role === "owner" && (
              <div style={{ marginTop:4, display:"inline-flex", alignItems:"center", gap:5,
                background:"#00d4ff22", border:"1px solid #00d4ff44",
                borderRadius:99, padding:"2px 10px", fontSize:10, fontWeight:700, color:"var(--cyan)", letterSpacing:"0.5px" }}>
                ⚡ OWNER
              </div>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input style={{ ...inputSt, flex:1 }} placeholder="Display name"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveName()} />
          <button style={S.btn("primary",true)} onClick={saveName} disabled={savingName}>
            {savingName ? "…" : "Save"}
          </button>
        </div>
      </SettingsSection>

      {/* Subscription */}
      <SettingsSection title="Subscription">
        {user?.role === "owner" ? (
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--green)", flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)" }}>Owner — Lifetime Access</div>
              <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>No subscription required</div>
            </div>
          </div>
        ) : user?.subscription_status === "active" ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--green)", flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)" }}>Active — $4.99/month</div>
                <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>Your subscription is active</div>
              </div>
            </div>
            <button onClick={async () => { try { await api.openBillingPortal(); } catch(e) { showToast("Failed to open portal"); } }}
              style={{ ...S.btn("ghost"), justifyContent:"center" }}>
              Manage Subscription →
            </button>
          </div>
        ) : user?.subscription_status === "trialing" ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--amber)", flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)" }}>Free Trial</div>
                {user?.trial_ends_at && (
                  <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>
                    {Math.max(0, Math.ceil((user.trial_ends_at - Date.now()) / (1000*60*60*24)))} days remaining in trial
                  </div>
                )}
              </div>
            </div>
            <button onClick={async () => { try { await api.startCheckout(); } catch(e) { showToast("Failed to start checkout"); } }}
              style={{ ...S.btn("primary"), justifyContent:"center" }}>
              Subscribe — $4.99/mo
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--red)", flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", textTransform:"capitalize" }}>
                  {user?.subscription_status || "Inactive"}
                </div>
              </div>
            </div>
            <button onClick={async () => { try { await api.startCheckout(); } catch(e) { showToast("Failed to start checkout"); } }}
              style={{ ...S.btn("primary"), justifyContent:"center" }}>
              Subscribe — $4.99/mo
            </button>
          </div>
        )}
      </SettingsSection>

      {/* Security */}
      <SettingsSection title="Security">
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={S.field}>
            <label style={S.label}>Current Password</label>
            <input style={inputSt} type="password" placeholder="••••••••"
              value={currPw} onChange={e => { setCurrPw(e.target.value); setPwError(""); setPwSuccess(false); }} />
          </div>
          <div style={S.field}>
            <label style={S.label}>New Password</label>
            <input style={inputSt} type="password" placeholder="Min. 8 characters"
              value={newPw} onChange={e => { setNewPw(e.target.value); setPwError(""); setPwSuccess(false); }} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Confirm New Password</label>
            <input style={inputSt} type="password" placeholder="••••••••"
              value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwError(""); setPwSuccess(false); }} />
          </div>
          {pwError   && <div style={{ fontSize:12, color:"var(--red)" }}>{pwError}</div>}
          {pwSuccess && <div style={{ fontSize:12, color:"var(--green)" }}>Password updated successfully</div>}
          <button style={{ ...S.btn("primary"), alignSelf:"flex-start" }} onClick={changePassword} disabled={savingPw}>
            {savingPw ? "Updating…" : "Update Password"}
          </button>
        </div>
      </SettingsSection>

      {/* Financial Profile */}
      <SettingsSection title="Financial Profile">
        <div style={{ fontSize:13, color:"var(--t2)", marginBottom:14, lineHeight:1.6 }}>
          Set your income and financial targets to power the Analytics page — savings rate, net worth projections, and retirement estimates.
        </div>
        {profileForm ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

            {/* Income */}
            <div>
              <div style={{ fontSize:11, color:"var(--t3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:6 }}>Monthly Income (after tax)</div>
              <input type="number" style={S.input} placeholder="0"
                value={profileForm.monthlyIncome || ""}
                onChange={e => setProfileForm(p => ({ ...p, monthlyIncome: parseFloat(e.target.value) || 0 }))} />
            </div>

            {/* Targets */}
            <div>
              <div style={{ fontSize:11, color:"var(--t3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>Targets</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { key:"savingsGoal",            label:"Monthly savings goal" },
                  { key:"emergencyFund",           label:"Emergency fund target" },
                  { key:"netWorthTarget",          label:"Net worth target" },
                  { key:"retirementTargetAmount",  label:"Retirement nest egg" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>{label}</div>
                    <input type="number" style={{ ...S.input, fontSize:13 }} placeholder="0"
                      value={profileForm.targets?.[key] || ""}
                      onChange={e => setProfileForm(p => ({ ...p, targets: { ...p.targets, [key]: parseFloat(e.target.value) || 0 } }))} />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>Retirement age</div>
                  <input type="number" style={{ ...S.input, fontSize:13 }} placeholder="65"
                    value={profileForm.targets?.retirementAge || ""}
                    onChange={e => setProfileForm(p => ({ ...p, targets: { ...p.targets, retirementAge: parseInt(e.target.value) || 65 } }))} />
                </div>
              </div>
            </div>

            {/* Manual Assets */}
            <div>
              <div style={{ fontSize:11, color:"var(--t3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>Manual Assets</div>
              {(profileForm.manualAssets || []).map((a, i) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                  <input style={{ ...S.input, flex:2, fontSize:13 }} placeholder="Name (e.g. Home, Car)"
                    value={a.name} onChange={e => setProfileForm(p => {
                      const assets = [...p.manualAssets]; assets[i] = { ...assets[i], name: e.target.value }; return { ...p, manualAssets: assets };
                    })} />
                  <input type="number" style={{ ...S.input, flex:1, fontSize:13 }} placeholder="Value"
                    value={a.value || ""} onChange={e => setProfileForm(p => {
                      const assets = [...p.manualAssets]; assets[i] = { ...assets[i], value: parseFloat(e.target.value) || 0 }; return { ...p, manualAssets: assets };
                    })} />
                  <button style={{ ...S.btn("ghost",true), flexShrink:0 }} onClick={() => setProfileForm(p => ({ ...p, manualAssets: p.manualAssets.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
              <button style={{ ...S.btn("ghost",true), width:"100%" }}
                onClick={() => setProfileForm(p => ({ ...p, manualAssets: [...(p.manualAssets||[]), { name:"", value:0 }] }))}>
                + Add Asset
              </button>
            </div>

            {/* Manual Liabilities */}
            <div>
              <div style={{ fontSize:11, color:"var(--t3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:8 }}>Manual Liabilities</div>
              {(profileForm.manualLiabilities || []).map((l, i) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:6 }}>
                  <input style={{ ...S.input, flex:2, fontSize:13 }} placeholder="Name (e.g. Mortgage, Loan)"
                    value={l.name} onChange={e => setProfileForm(p => {
                      const liabs = [...p.manualLiabilities]; liabs[i] = { ...liabs[i], name: e.target.value }; return { ...p, manualLiabilities: liabs };
                    })} />
                  <input type="number" style={{ ...S.input, flex:1, fontSize:13 }} placeholder="Amount"
                    value={l.value || ""} onChange={e => setProfileForm(p => {
                      const liabs = [...p.manualLiabilities]; liabs[i] = { ...liabs[i], value: parseFloat(e.target.value) || 0 }; return { ...p, manualLiabilities: liabs };
                    })} />
                  <button style={{ ...S.btn("ghost",true), flexShrink:0 }} onClick={() => setProfileForm(p => ({ ...p, manualLiabilities: p.manualLiabilities.filter((_, j) => j !== i) }))}>✕</button>
                </div>
              ))}
              <button style={{ ...S.btn("ghost",true), width:"100%" }}
                onClick={() => setProfileForm(p => ({ ...p, manualLiabilities: [...(p.manualLiabilities||[]), { name:"", value:0 }] }))}>
                + Add Liability
              </button>
            </div>

            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button style={S.btn("ghost")} onClick={() => setProfileForm(null)}>Cancel</button>
              <button style={S.btn("primary")} onClick={() => { onSaveProfile(profileForm); setProfileForm(null); showToast("Profile saved"); }}>Save Profile</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
              {[
                { label:"Monthly income", value: userProfile?.monthlyIncome ? `$${(userProfile.monthlyIncome).toLocaleString()}` : "Not set" },
                { label:"Retirement age", value: userProfile?.targets?.retirementAge || "Not set" },
                { label:"Net worth target", value: userProfile?.targets?.netWorthTarget ? `$${(userProfile.targets.netWorthTarget).toLocaleString()}` : "Not set" },
                { label:"Retirement target", value: userProfile?.targets?.retirementTargetAmount ? `$${(userProfile.targets.retirementTargetAmount).toLocaleString()}` : "Not set" },
              ].map(({ label, value }) => (
                <div key={label} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"10px 12px" }}>
                  <div style={{ fontSize:11, color:"var(--t3)", marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", fontFamily:"var(--font-mono)" }}>{value}</div>
                </div>
              ))}
            </div>
            <button style={{ ...S.btn("ghost"), width:"100%" }} onClick={() => setProfileForm({ ...userProfile })}>Edit Profile</button>
          </div>
        )}
      </SettingsSection>

      {/* Data export */}
      <SettingsSection title="Your Data">
        <div style={{ fontSize:13, color:"var(--t2)", marginBottom:14 }}>
          Export all your transactions as a CSV file you can open in Excel or Google Sheets.
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:10 }}>
          <div style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <div style={{ fontSize:12, color:"var(--t3)" }}>
              {transactions.length} transactions · {accounts.length} accounts · {categories.length} categories
            </div>
            <button style={S.btn("ghost",true)} onClick={exportCSV}>↓ Export CSV</button>
          </div>
          <button style={S.btn("danger",true)} onClick={deleteAllTransactions}>
            Delete All Transactions
          </button>
          <button style={S.btn("danger",true)} onClick={clearAllData}>
            Clear All Data
          </button>
        </div>
      </SettingsSection>

      {/* Legal */}
      <SettingsSection title="Legal">
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[["Privacy Policy","privacy"],["Terms of Service","terms"]].map(([label, doc]) => (
            <button key={doc} onClick={() => setLegalDoc(doc)}
              style={{ fontSize:13, color:"var(--t2)", textDecoration:"none",
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"10px 12px", background:"var(--surface)", cursor:"pointer",
                borderRadius:"var(--radius)", border:"1px solid var(--border)",
                width:"100%", textAlign:"left" }}>
              {label} <span style={{ color:"var(--t3)" }}>→</span>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Sign out */}
      <SettingsSection title="Account">
        <button style={{ ...S.btn("danger"), width:"100%" }}
          onClick={() => { api.clearToken(); window.location.reload(); }}>
          Sign Out
        </button>
      </SettingsSection>

    </div>

    {/* Legal document modal */}
    {legalDoc && (
      <div style={S.overlay} className="ledgr-overlay-anim" onClick={() => setLegalDoc(null)}>
        <div className="ledgr-modal-anim" style={{
          ...S.modal,
          width: 640, maxHeight: "82vh", display: "flex", flexDirection: "column",
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexShrink:0 }}>
            <div style={S.modalTitle}>
              {legalDoc === "privacy" ? "Privacy Policy" : "Terms of Service"}
            </div>
            <button onClick={() => setLegalDoc(null)}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t3)", fontSize:20, lineHeight:1 }}>✕</button>
          </div>
          <div style={{ overflowY:"auto", flex:1, fontSize:13, color:"var(--t2)", lineHeight:1.7 }}>
            {legalDoc === "privacy" ? <PrivacyPolicy /> : <TermsOfService />}
          </div>
          <div style={{ marginTop:20, flexShrink:0, textAlign:"right" }}>
            <div style={{ fontSize:11, color:"var(--t3)" }}>Last updated: {new Date().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" })}</div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
function AdminPanel() {
  const isMobile = useIsMobile();
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
      <div style={{fontFamily:"var(--font-disp)",fontSize:22,fontWeight:800,marginBottom:24,letterSpacing:"-0.3px"}}>
        Admin Panel
      </div>

      {/* Stats — 2x2 on mobile, 4 columns on desktop */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[
          { label:"Total Users", value:stats.total,                  color:"var(--t1)"    },
          { label:"Active",      value:stats.active,                  color:"var(--green)" },
          { label:"Trialing",    value:stats.trialing,                color:"var(--amber)" },
          { label:"MRR",         value:`$${stats.mrr.toFixed(2)}`,   color:"var(--cyan)"  },
        ].map(({label,value,color}) => (
          <div key={label} style={{...S.card,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"1px",fontWeight:600,marginBottom:4}}>{label}</div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:isMobile?20:24,fontWeight:700,color}}>{value}</div>
          </div>
        ))}
      </div>

      {error && <div style={{color:"var(--red)",fontSize:13,marginBottom:16,padding:"10px 14px",background:"#ff4d6d11",borderRadius:"var(--radius)",border:"1px solid #ff4d6d33"}}>{error}</div>}

      {/* Users list */}
      <div style={{...S.card,padding:0,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontFamily:"var(--font-disp)",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"var(--t3)"}}>
              Users ({search ? `${filteredUsers.length} of ${users.length}` : users.length})
            </div>
            <button style={{...S.btn("ghost",true)}} onClick={loadUsers} disabled={loading}>
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
          /* ── Mobile: card-per-user ── */
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
                    <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:10}}>
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
                        <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>Last Login</div>
                        <span style={{fontSize:12,color:"var(--t3)"}}>{user.last_login_at ? new Date(Number(user.last_login_at)).toLocaleDateString("en-US") : "—"}</span>
                      </div>
                    </div>
                    <button style={{...S.btn("ghost",true),width:"100%",justifyContent:"center"}} onClick={() => {
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
                      <button style={{...S.btn("ghost",true),flex:1,justifyContent:"center"}} onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* ── Desktop: table ── */
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  {["Email","Role","Status","Trial Ends","Last Login","Joined","Actions"].map(h => (
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
                        {user.last_login_at ? new Date(Number(user.last_login_at)).toLocaleDateString("en-US") : "—"}
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
                          <button style={S.btn("ghost",true)} onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{display:"flex",gap:6}}>
                          <button style={S.btn("ghost",true)} onClick={() => {
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
            style={{...S.btn("ghost",true)}}
            onClick={() => setPage(p => Math.max(1, p-1))}
            disabled={page === 1}>
            ← Prev
          </button>
          <span style={{fontSize:13,color:"var(--t3)"}}>
            Page {page} of {totalPages}
          </span>
          <button
            style={{...S.btn("ghost",true)}}
            onClick={() => setPage(p => Math.min(totalPages, p+1))}
            disabled={page === totalPages}>
            Next →
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
              <button style={S.btn("ghost")} onClick={() => setConfirm(null)}>Cancel</button>
              <button style={S.btn("danger")} onClick={() => deleteUser(confirm)}>Delete User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INSTALL_KEY = "ledgr_install_prompt_dismissed";

function getInstallPlatform() {
  // Already installed as PWA
  if (window.matchMedia("(display-mode: standalone)").matches) return null;
  if (window.navigator.standalone === true) return null;
  // Already dismissed
  if (localStorage.getItem(INSTALL_KEY)) return null;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState(null);

  useEffect(() => {
    const p = getInstallPlatform();
    if (!p) return;
    setPlatform(p);
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(INSTALL_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  const iosSteps = [
    { icon: "1", text: "Tap the Share button", detail: "at the bottom of Safari" },
    { icon: "2", text: "Scroll down and tap", detail: "\"Add to Home Screen\"" },
    { icon: "3", text: "Tap Add", detail: "in the top-right corner" },
  ];

  const androidSteps = [
    { icon: "1", text: "Tap the menu button", detail: "(⋮) in the top-right of Chrome" },
    { icon: "2", text: "Tap", detail: "\"Add to Home screen\"" },
    { icon: "3", text: "Tap Install", detail: "or Add to confirm" },
  ];

  const steps = platform === "ios" ? iosSteps : androidSteps;
  const browserName = platform === "ios" ? "Safari" : "Chrome";

  return (
    <div style={{
      position:"fixed", inset:0, background:"#00000099", backdropFilter:"blur(6px)",
      zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center",
      padding:16,
    }}>
      <div className="ledgr-slide-up" style={{
        background:"var(--card)", border:"1px solid var(--border2)",
        borderRadius:"var(--radius-lg)", padding:"24px 22px",
        width:"100%", maxWidth:440, maxHeight:"85vh", overflowY:"auto",
      }}>

        <div style={{
          fontSize:28, textAlign:"center", marginBottom:6,
          color:"var(--cyan)", fontFamily:"var(--font-disp)", fontWeight:800,
        }}>
          ℓ
        </div>
        <div style={{
          fontSize:18, fontWeight:700, textAlign:"center",
          color:"var(--t1)", marginBottom:6, fontFamily:"var(--font-disp)",
        }}>
          Install Ledgr
        </div>
        <div style={{
          fontSize:13, color:"var(--t2)", textAlign:"center", marginBottom:20, lineHeight:1.5,
        }}>
          Add Ledgr to your home screen for a faster, app-like experience — no browser bar, instant launch.
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:12, marginBottom:20}}>
          {steps.map((s, i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap:12}}>
              <div style={{
                flexShrink:0, width:28, height:28, borderRadius:"50%",
                background:"var(--cyan)", color:"#000",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:700, fontFamily:"var(--font-mono)",
              }}>{s.icon}</div>
              <div style={{flex:1, fontSize:13, color:"var(--t1)"}}>
                {s.text} <span style={{color:"var(--t2)"}}>{s.detail}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background:"var(--surface)", borderRadius:"var(--radius)",
          padding:"10px 12px", fontSize:11, color:"var(--t3)",
          textAlign:"center", marginBottom:16, lineHeight:1.5,
        }}>
          Make sure you're using <strong style={{color:"var(--t2)"}}>{browserName}</strong> for this to work.
        </div>

        <button
          style={{...S.btn("primary"), width:"100%", justifyContent:"center", padding:"12px"}}
          onClick={dismiss}
        >
          Got it — don't show again
        </button>
      </div>
    </div>
  );
}

function AppInner() {
  const isMobile = useIsMobile();

  /* ── State ── */
  const [view,          setView]          = useState("dashboard");
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [accounts,      setAccounts]      = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [transactions,  setTransactions]  = useState([]);
  const [plaidItems,    setPlaidItems]    = useState([]);
  const [staleItemIds,  setStaleItemIds]  = useState(new Set()); // items that returned 0 accounts on last sync
  const [reconnectingItemId, setReconnectingItemId] = useState(null);
  const [rules,         setRules]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState(null);
  const [editTarget,    setEditTarget]    = useState(null);
  const [toast,         setToast]         = useState("");
  const [newTxnCount,   setNewTxnCount]   = useState(0);
  const [undoAction,    setUndoAction]    = useState(null); // {label, fn}
  const undoTimer = useRef(null);
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
  const [calendarAcctPopup,setCalendarAcctPopup]= useState(null);
  const [selectedMonth,    setSelectedMonth]    = useState(currentMonth);
  const [calendarMonth,    setCalendarMonth]    = useState(currentMonth);
  const [calendarAccounts, setCalendarAccounts] = useState(null);
  const [editingCalAccts,  setEditingCalAccts]  = useState(false);
  const [search,        setSearch]        = useState("");
  const txnSearchInputRef = useRef(null);
  const txnSearchHadFocusRef = useRef(false);
  const txnSearchCaretRef = useRef({ start: null, end: null });
  const [filterCat,     setFilterCat]     = useState("all");
  const [filterAcct,    setFilterAcct]    = useState("all");
  const [filterReview,  setFilterReview]  = useState(false);
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

  /* ── Stable save ref (allows portfolio hook to be defined before useAppData) ── */
  const scheduleSaveRef = useRef(null);

  /* ── Portfolio (via hook) ── */
  const portfolio = usePortfolio((patch) => scheduleSaveRef.current?.(patch));

  /* ── AI Chat (via hook) ── */
  const aiChat = useAiChat((patch) => scheduleSaveRef.current?.(patch));

  /* ── AI categorization examples (memory) ── */
  const [aiCatExamples, setAiCatExamples] = useState([]);
  const [autoCatRunning, setAutoCatRunning] = useState(false);

  /* ── User profile (income, assets, targets) ── */
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

  /* ── Analytics AI insights — persisted across tab/view switches ── */
  const [analyticsInsights, setAnalyticsInsights] = useState(null);

  /* ── Insights to-do list ── */
  const [insightsTodos, setInsightsTodos] = useState([]);

  /* ── Load + Save (via hook) ── */
  const { initialized, scheduleSave } = useAppData({
    accounts, categories, transactions, plaidItems, rules, calendarAccounts,
    setAccounts, setCategories, setTransactions, setPlaidItems, setRules,
    setCalendarAccounts, setAccess, setLoading, applyRules,
    onData: (data) => {
      portfolio.loadFromData(data);
      aiChat.loadFromData(data);
      if (data.aiCatExamples)      setAiCatExamples(data.aiCatExamples);
      if (data.userProfile)        setUserProfile(p => ({ ...p, ...data.userProfile }));
      if (data.insightsTodos)      setInsightsTodos(data.insightsTodos);
      if (data.analyticsInsights)  setAnalyticsInsights(data.analyticsInsights);
      if (data.dismissedPairs)     setDismissedPairs(data.dismissedPairs);
      if (data.scanMemory)         setScanMemory(data.scanMemory);
    },
  });

  // Wire the ref once scheduleSave is available
  scheduleSaveRef.current = scheduleSave;

  /* ── Poll for new transactions every 30 minutes ── */
  const knownTxnIds = useRef(null);
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
        const data = await api.loadData();
        const incoming = data.transactions || [];
        const known = knownTxnIds.current || new Set();
        const brandNew = incoming.filter(t => !known.has(t.id));
        if (brandNew.length > 0) {
          // Merge new transactions into state without overwriting user edits
          setTransactions(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const toAdd = applyRules(
              brandNew.filter(t => !existingIds.has(t.id)),
              rules,
              { onlyUncategorized: true }
            );
            if (toAdd.length === 0) return prev;
            return [...toAdd, ...prev];
          });
          brandNew.forEach(t => knownTxnIds.current.add(t.id));
          setNewTxnCount(brandNew.length);
        }
      } catch (e) {
        console.warn("Poll error:", e.message);
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  /* ── Swipe gesture to open/close drawer on mobile ── */
  useEffect(() => {
    if (!isMobile) return;
    let startX = 0, startY = 0;
    const MIN_SWIPE    = 50;  // minimum horizontal distance to count as swipe
    const MAX_VERTICAL = 60;  // max vertical drift before ignoring

    function onTouchStart(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
    function onTouchEnd(e) {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (dy > MAX_VERTICAL) return; // too vertical — scroll, not swipe
      if (dx > MIN_SWIPE && !drawerOpen) {
        setDrawerOpen(true);  // swipe right from anywhere to open
      } else if (dx < -MIN_SWIPE && drawerOpen) {
        setDrawerOpen(false); // swipe left to close
      }
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [isMobile, drawerOpen]);

  /* ── Service worker + push notification subscription ── */
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const VAPID_PUBLIC = "BLvUSGg-ljPgLVTY-54gYJrJvPEEIIokB5C-QTCAnSYW9ghmpeYmKQeIfQMsHl_opqis_d5QeORvyjoS1pfXRnY";
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
        if (!sub) {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
          });
        }
        await api.subscribePush(sub);
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
  const navigate  = id  => { setView(id); setDrawerOpen(false); contentRef.current?.scrollTo({ top: 0 }); };

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
  function markReviewed(id) { setTransactions(p=>p.map(t=>t.id===id?{...t,reviewed:!t.reviewed}:t)); }

  /* ── Computed ── */
  const monthTxns = useMemo(() =>
    transactions.filter(t => t.date?.startsWith(selectedMonth)),
  [transactions, selectedMonth]);

  const isCurrentMonth = selectedMonth === currentMonth;

  const spentByCat = useMemo(() => {
    const m = {};
    monthTxns.forEach(t => { if (t.amount<0 && t.categoryId && t.type!=="transfer" && t.type!=="income" && t.type!=="reimbursement") m[t.categoryId]=(m[t.categoryId]||0)+Math.abs(t.amount); });
    return m;
  }, [monthTxns]);

  const spentByAcct = useMemo(() => {
    const m = {};
    monthTxns.forEach(t => { if (t.amount<0 && t.accountId) m[t.accountId]=(m[t.accountId]||0)+Math.abs(t.amount); });
    return m;
  }, [monthTxns]);

  const totalSpent  = Object.values(spentByCat).reduce((a,b)=>a+b,0);
  const totalBudget = categories.reduce((a,c)=>a+c.limit,0);
  const totalIncome = monthTxns.filter(t=>t.amount>0&&(t.type==="income"||!t.type)).reduce((a,t)=>a+t.amount,0);
  const catMap      = useMemo(()=>Object.fromEntries(categories.map(c=>[c.id,c])), [categories]);
  const acctMap     = useMemo(()=>Object.fromEntries(accounts.map(a=>[a.id,a])),   [accounts]);

  /* ── Duplicate scan (via hook) ── */
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
    pickRemove, isPreauth,
  } = useDuplicateScan(transactions, showToast, setTransactions);

  // Persist dismissed pairs + scan memory whenever they change
  useEffect(() => {
    if (dismissedPairs.length > 0) scheduleSaveRef.current?.({ dismissedPairs });
  }, [dismissedPairs]);
  useEffect(() => {
    const hasData = Object.keys(scanMemory?.confirmed||{}).length > 0 || Object.keys(scanMemory?.dismissed||{}).length > 0;
    if (hasData) scheduleSaveRef.current?.({ scanMemory });
  }, [scanMemory]);

  const filteredTxns = useMemo(() =>
    transactions.filter(t => {
      const label = (t.name||t.merchant||"").toLowerCase();
      if (!showDuplicates && pendingPairs.some(p=>p.pending.id===t.id)) return false;
      if (search && !label.includes(search.toLowerCase())) return false;
      if (filterCat    !== "all" && t.categoryId !== filterCat)  return false;
      if (filterAcct   !== "all" && t.accountId  !== filterAcct) return false;
      if (filterReview && !needsReview(t)) return false;
      return true;
    }).sort((a,b) => b.date?.localeCompare(a.date)),
  [transactions, search, filterCat, filterAcct, filterReview, showDuplicates, pendingPairs]);

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

    recurringTxns.forEach(t => {
      const freq  = t.recurringFreq || "monthly";
      const start = t.recurringStart ? new Date(t.recurringStart + "T12:00:00") : null;

      function addDay(d) {
        if (d < 1 || d > daysInCalMonth) return;
        if (!map[d]) map[d] = [];
        map[d].push(t);
      }

      if (freq === "monthly") {
        if (t.recurringDay) addDay(parseInt(t.recurringDay));

      } else if (freq === "annual") {
        // Show only if start date month matches calendar month
        if (start && start.getMonth()+1 === calM) {
          addDay(start.getDate());
        }

      } else if (freq === "weekly" || freq === "biweekly") {
        // Need a start date to calculate weekly/biweekly occurrences
        if (!start) {
          // Fallback: use recurringDay as day-of-month if no start date
          if (t.recurringDay) addDay(parseInt(t.recurringDay));
          return;
        }
        const intervalDays = freq === "weekly" ? 7 : 14;
        // Walk from start date forward, finding all occurrences in this calendar month
        let current = new Date(start);
        // Move start back if needed to find earliest occurrence before the month
        while (current > new Date(calY, calM-1, 1)) {
          current = new Date(current.getTime() - intervalDays*24*60*60*1000);
        }
        // Now walk forward through the month
        for (let i = 0; i < 60; i++) {
          if (current.getFullYear() === calY && current.getMonth()+1 === calM) {
            addDay(current.getDate());
          }
          if (current.getFullYear() > calY || (current.getFullYear() === calY && current.getMonth()+1 > calM)) break;
          current = new Date(current.getTime() + intervalDays*24*60*60*1000);
        }
      }
    });
    return map;
  }, [recurringTxns, calendarMonth]);

  function prevMonth() {
    const [y,m]=selectedMonth.split("-").map(Number);
    const d=new Date(y,m-2,1);
    setSelectedMonth(`${d.getFullYear()}-${pad(d.getMonth()+1)}`);
  }
  function nextMonth() {
    const [y,m]=selectedMonth.split("-").map(Number);
    const d=new Date(y,m,1);
    const next=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    if(next<=currentMonth) setSelectedMonth(next);
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

  /* ── Rules ── */
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
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, categoryId:catId||null, reviewed: catId ? true : t.reviewed, userCategorized: !!catId} : t));
    showToast(`Updated ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""}`);
    clearSelection();
  }
  function bulkSetType(type) {
    const autoReviewed = ["income","transfer","reimbursement"].includes(type);
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, type, reviewed: autoReviewed ? true : t.reviewed} : t));
    showToast(`Updated ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""}`);
    clearSelection();
  }
  function bulkMarkReviewed(reviewed) {
    setTransactions(p => p.map(t => selectedTxns.has(t.id) ? {...t, reviewed} : t));
    showToast(`Marked ${selectedTxns.size} transaction${selectedTxns.size!==1?"s":""} ${reviewed?"reviewed":"unreviewed"}`);
    clearSelection();
  }
  function bulkDelete() {
    const removed = transactions.filter(t => selectedTxns.has(t.id));
    setTransactions(p => p.filter(t => !selectedTxns.has(t.id)));
    showUndoToast(`Deleted ${removed.length} transaction${removed.length!==1?"s":""}`, () => setTransactions(p => [...p, ...removed]));
    clearSelection();
  }
  function promptSaveRule(txn, categoryId) {
    const mer=(txn.merchant||txn.name||"").toLowerCase().trim();
    if (!rules.some(r=>r.pattern.toLowerCase().trim()===mer)&&mer&&categoryId)
      setRulePrompt({txnId:txn.id,merchant:txn.merchant||txn.name,categoryId});
  }
  function confirmSaveRule() {
    if (!rulePrompt) return;
    setRules(p=>[...p,{id:"r"+Date.now(),pattern:rulePrompt.merchant,matchType:"contains",categoryId:rulePrompt.categoryId,enabled:true,createdAt:Date.now()}]);
    setRulePrompt(null); showToast("Rule saved");
  }
  function confirmTypeRule() {
    if (!typeRulePrompt) return;
    const { merchant, type } = typeRulePrompt;
    // Add a rule that sets typeOverride for this merchant pattern
    setRules(p => {
      const pattern = merchant.toLowerCase();
      // Replace existing type rule for this merchant if any
      const filtered = p.filter(r => !(r.pattern.toLowerCase() === pattern && r.typeOverride));
      return [...filtered, { id:"r"+Date.now(), pattern:merchant, matchType:"contains", typeOverride:type, categoryId:null, enabled:true, createdAt:Date.now() }];
    });
    setTypeRulePrompt(null);
    showToast(`Rule saved — "${merchant}" will always be ${type}`);
  }
  function saveRule(rule)  { setRules(p=>[...p.filter(r=>r.id!==rule.id),rule]); showToast("Rule saved"); }
  function deleteRule(id)  {
    const rule = rules.find(r=>r.id===id);
    setRules(p=>p.filter(r=>r.id!==id));
    showUndoToast("Rule deleted", ()=>setRules(p=>[...p,rule]));
  }
  function toggleRule(id)  { setRules(p=>p.map(r=>r.id===id?{...r,enabled:!r.enabled}:r)); }

  useEffect(() => {
    if (!initialized.current || !rules.length) return;
    setTransactions(prev => applyRules(prev, rules, { onlyUncategorized: true }));
  }, [rules]);

  useEffect(() => {
    if (!budgetKebabId) return;
    const close = () => setBudgetKebabId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [budgetKebabId]);

  /* ── Plaid ── */
  const doSync = useCallback(async (itemId) => {
    setSyncing(true);
    try {
      const {added,modified,removed} = await api.syncTransactions(itemId);
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
        return [...applyRules(rawNew, rules, { onlyUncategorized: true }),...next];
      });
      const {accounts:plaidAccts} = await api.getAccounts();

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
        // Keep manually-added accounts (no plaidId) as-is
        const manual = prev.filter(a => !a.plaidId);
        // Build a map of existing Plaid accounts by plaidId to preserve custom names
        const byPlaidId = Object.fromEntries(prev.filter(a => a.plaidId).map(a => [a.plaidId, a]));
        // Merge: update balances for existing, add new ones, deduplicate by plaidId
        const seen = new Set();
        const plaidUpdated = plaidAccts
          .filter(pa => { const dup = seen.has(pa.account_id); seen.add(pa.account_id); return !dup; })
          .map(pa => ({
            // Preserve existing record (custom name, id) or create fresh
            ...(byPlaidId[pa.account_id] || { id: "a" + pa.account_id }),
            plaidId: pa.account_id,
            plaidItemId: pa.item_id,
            name: byPlaidId[pa.account_id]?.name || pa.name,
            balance: pa.balance,
            available: pa.available,
            type: cap(pa.subtype || pa.type),
            institution: pa.institution,
          }));
        const updated = [...manual, ...plaidUpdated];
        api.saveData({ accounts: updated });
        return updated;
      });
      setTransactions(prev=>{
        const map={};
        plaidAccts.forEach(pa=>{map[pa.account_id]="a"+pa.account_id;});
        return prev.map(t=>t.plaidAccountId?{...t,accountId:map[t.plaidAccountId]||t.accountId}:t);
      });
      showToast(`Synced: +${added.length} transactions`);
      // Auto-categorize new uncategorized transactions if user has AI key
      if (added.length > 0) {
        const count = await runAutoCategorize();
        if (count > 0) showToast(`✦ Auto-categorized ${count} transaction${count === 1 ? "" : "s"}`);
      }
    } catch(e) { showToast("Sync error: "+e.message); }
    finally { setSyncing(false); }
  }, [catMap, rules]);

  const handlePlaidSuccess = useCallback(async (publicToken, institutionName) => {
    try {
      const {item_id} = await api.exchangePublicToken(publicToken, institutionName);
      setPlaidItems(p=>[...p.filter(i=>i.item_id!==item_id),{item_id,institution:institutionName}]);
      showToast(`${institutionName} connected! Syncing…`);
      await doSync(item_id);
    } catch(e) { showToast("Connection failed: "+e.message); }
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
    try {
      // Best-effort server delete — ignore 404 (item may not be in DB)
      try { await api.deleteItem(itemId); } catch(e) {
        if (!e.message?.includes("404") && !e.message?.includes("not found")) throw e;
      }
      const cleanAccounts     = accounts.filter(a => a.plaidItemId !== itemId);
      const cleanTransactions = transactions.filter(t => t.plaidItemId !== itemId);
      const cleanPlaidItems   = plaidItems.filter(i => i.item_id !== itemId);
      setAccounts(cleanAccounts);
      setTransactions(cleanTransactions);
      setPlaidItems(cleanPlaidItems);
      await api.saveData({ accounts: cleanAccounts, transactions: cleanTransactions, plaidItems: cleanPlaidItems });
      showToast("Bank disconnected");
    } catch(e) { showToast("Error: " + e.message); }
  }

  /* ── Category CRUD ── */
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
    showUndoToast("Category deleted", ()=>{
      setCategories(p=>[...p,cat]);
      setTransactions(p=>p.map(t=>affected.find(a=>a.id===t.id)?{...t,categoryId:id}:t));
    });
  }

  /* ── Account CRUD ── */
  function openAddAcct()   { setAcctForm({name:"",balance:"",type:"Checking"}); setModal("addAcct"); }
  function openEditAcct(a) { setAcctForm({name:a.name,balance:String(a.balance),type:a.type}); setEditTarget(a); setModal("editAcct"); }
  function saveAcct() {
    if (!acctForm.name.trim()) return;
    if (modal==="addAcct") setAccounts(p=>[...p,{id:"a"+Date.now(),name:acctForm.name.trim(),balance:parseFloat(acctForm.balance)||0,type:acctForm.type}]);
    else setAccounts(p=>p.map(a=>a.id===editTarget.id?{...a,...acctForm,balance:parseFloat(acctForm.balance)||0}:a));
    setModal(null); showToast("Account saved");
  }
  function deleteAcct(id) {
    const acct = accounts.find(a=>a.id===id);
    setAccounts(p=>p.filter(a=>a.id!==id));
    showUndoToast("Account deleted", ()=>setAccounts(p=>[...p,acct]));
  }

  /* ── Transaction CRUD ── */
  function startRename(t) { setEditingId(t.id); setEditingName(t.name||t.merchant); }
  function saveRename(id) {
    setTransactions(p=>p.map(t=>t.id===id?{...t,name:editingName.trim()||t.merchant}:t));
    setEditingId(null); showToast("Name updated");
  }
  function updateTxnType(id,val) {
    const clearCat = ["income","transfer","reimbursement"].includes(val);
    setTransactions(p=>p.map(t=>{
      if (t.id!==id) return t;
      const autoReviewed = val==="income"||val==="transfer"||val==="reimbursement";
      return {...t, type:val, reviewed: autoReviewed ? true : t.reviewed, categoryId: clearCat ? null : t.categoryId, userCategorized: clearCat ? false : t.userCategorized};
    }));
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
      api.saveData({ transactions: next });
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
  }
  async function runAutoCategorize(txnsToCheck) {
    if (!categories.length) return 0;
    const uncategorized = (txnsToCheck || transactions).filter(t =>
      !t.categoryId && (t.type === "expense" || t.type === "refund" || !t.type) && t.amount < 0
    );
    if (!uncategorized.length) return 0;

    // Build examples from existing rules for the prompt
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
      if (count === 0) return 0;

      // Build new AI rules from assignments — one rule per unique merchant
      // Never overwrite an existing manual rule
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

        // Skip if a manual rule already exists for this merchant
        if (manualPatterns.has(pattern)) continue;

        // Check if AI rule already exists — update it, don't duplicate
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

      // Apply assignments to current uncategorized transactions
      setTransactions(prev => prev.map(t =>
        assignments[t.id] && !t.categoryId
          ? { ...t, categoryId: assignments[t.id], reviewed: true }
          : t
      ));

      // Add new AI rules (manual rules come first thanks to applyRules ordering)
      if (newRules.length > 0) {
        setRules(prev => [...prev, ...newRules]);
      }

      return count;
    } catch (e) {
      if (!e.message?.includes("no_api_key")) {
        console.warn("Auto-categorize failed:", e.message);
      }
      return 0;
    } finally {
      setAutoCatRunning(false);
    }
  }

  function updateTxnAcct(id,val) { setTransactions(p=>p.map(t=>t.id===id?{...t,accountId:val||null}:t)); }
  function updateTxnNotes(id,val) { setTransactions(p=>p.map(t=>t.id===id?{...t,notes:val}:t)); }
  function deleteTxn(id) {
    const txn = transactions.find(t=>t.id===id);
    setTransactions(p=>p.filter(t=>t.id!==id));
    showUndoToast("Transaction deleted", ()=>setTransactions(p=>[txn,...p]));
  }
  function toggleRecurring(id) {
    setTransactions(p=>p.map(t=>{
      if(t.id!==id) return t;
      const on=!t.recurring;
      const autoDay=t.date?parseInt(t.date.split("-")[2]):null;
      return {...t, recurring:on, recurringDay:on?(t.recurringDay||autoDay):null,
        recurringFreq: on?(t.recurringFreq||"monthly"):null,
        recurringStart: on?(t.recurringStart||t.date||null):null};
    }));
  }
  function updateRecurringDay(id,day) { setTransactions(p=>p.map(t=>t.id===id?{...t,recurringDay:parseInt(day)||null}:t)); }
  function openAddTxn() {
    setTxnForm({merchant:"",amount:"",date:today.toISOString().slice(0,10),categoryId:"",accountId:"",sign:"-1"});
    setModal("addTxn");
  }
  function saveManualTxn() {
    if(!txnForm.merchant.trim()||!txnForm.amount) return;
    setTransactions(p=>[{id:"m"+Date.now(),date:txnForm.date,merchant:txnForm.merchant.trim(),name:"",
      amount:parseFloat(txnForm.amount)*parseInt(txnForm.sign),categoryId:txnForm.categoryId||null,
      accountId:txnForm.accountId||null,recurring:false,recurringDay:null,
      type:txnForm.sign==="-1"?"expense":"income"},...p]);
    setModal(null); showToast("Transaction added");
  }

  /* ── Drill-down modal ── */
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12,flexShrink:0}}>
          {[
            {label:"Spent",value:fmt(spentByCat[drillCat.id]||0),color:drillCat.color},
            {label:"Budget",value:fmt(drillCat.limit),color:"var(--t2)"},
            {label:"Remaining",value:fmt(drillCat.limit-(spentByCat[drillCat.id]||0)),color:(spentByCat[drillCat.id]||0)<=drillCat.limit?"var(--green)":"var(--red)"},
            {label:"Transactions",value:catTxns.length,color:"var(--t1)"},
          ].map(s=>(
            <div key={s.label} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>{s.label}</div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:600,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:14,flexShrink:0}}>
          <div style={{height:5,background:"var(--border)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,
              background:(spentByCat[drillCat.id]||0)>=drillCat.limit?"var(--red)":(spentByCat[drillCat.id]||0)/drillCat.limit>=0.8?"var(--amber)":drillCat.color,
              width:`${Math.min(((spentByCat[drillCat.id]||0)/drillCat.limit)*100,100)}%`,transition:"width 0.5s"}}/>
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
          <button style={S.btn("ghost")} onClick={()=>setDrillCat(null)}>Close</button>
        </div>
      </div>
    </div>
  ) : null;

  /* ─────────────────────────────────────────────────────────────────
     SCREENS
  ───────────────────────────────────────────────────────────────── */

  /* ── Dashboard ── */
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
    const topBreakdownCats = spentCats.slice(0, 5);

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
      totalSpentForBreakdown,
      cashFlowSeries,
      avgDelta,
      topOverspent,
    };
  }, [categories, spentByCat, transactions, selectedMonth]);

  const BudgetSummaryCard = (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
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

  const SpendingBreakdownCard = (
    <div style={{ ...S.card, padding: 18 }}>
      <div style={{ ...S.sectionHdr, marginBottom: 8 }}>
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
                  {budgetAnalytics.topBreakdownCats.map((cat) => {
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

  const CashFlowCard = (
    <div style={{ ...S.card, padding: 18 }}>
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
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginBottom: 10, fontSize: 12, color: "var(--t2)" }}>
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
                gap: 12,
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

  const OverspendingHighlightsCard = (
    <div style={{ ...S.card, padding: 18 }}>
      <div style={{ ...S.sectionHdr, marginBottom: 10 }}>
        <div style={S.cardTitle}>Overspending Highlights</div>
      </div>

      {budgetAnalytics.topOverspent.length === 0 ? (
        <div style={{ color: "var(--green)", fontSize: 13 }}>No categories are over budget right now.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {budgetAnalytics.topOverspent.map((cat) => (
            <div key={cat.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 12px" }}>
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
              <div style={{ fontSize: 12, color: "var(--t3)" }}>Spent {fmt(cat.spent)} of {fmt(cat.limit)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const reviewCount = transactions.filter(t => needsReview(t)).length;
  const isNewUser = transactions.length === 0 && plaidItems.length === 0 && accounts.length === 0;

  // Onboarding steps — checked off as user completes them
  const onboardingSteps = [
    {
      id: "bank",
      done: plaidItems.length > 0 || accounts.length > 0,
      icon: "🏦",
      title: "Connect your bank",
      desc: "Link a bank account to automatically import transactions.",
      action: () => navigate("accounts"),
      cta: "Go to Accounts →",
    },
    {
      id: "categories",
      done: categories.length > 0,
      icon: "◉",
      title: "Create budget categories",
      desc: "Set up spending categories with limits to track your budget.",
      action: () => navigate("budgets"),
      cta: "Go to Budgets →",
    },
    {
      id: "rules",
      done: rules.length > 0 || transactions.some(t => t.categoryId),
      icon: "◎",
      title: "Categorize a transaction",
      desc: "Review your transactions and assign categories. Set up rules to auto-categorize going forward.",
      action: () => navigate("transactions"),
      cta: "Go to Transactions →",
    },
  ];
  const onboardingComplete = onboardingSteps.every(s => s.done);
  const onboardingProgress = onboardingSteps.filter(s => s.done).length;

  const Dashboard = (
    <div>
      <div className="ledgr-monthbar" style={{...S.monthBar,justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center",width:"100%"}}>
          <button onClick={prevMonth} style={{background:"none",border:"1px solid var(--border2)",borderRadius:"var(--radius)",color:"var(--t2)",cursor:"pointer",padding:"6px 12px",fontSize:16,lineHeight:"1"}}>‹</button>
          <span style={{fontFamily:"var(--font-disp)",fontWeight:700,fontSize:15,color:"var(--t1)",minWidth:isMobile?90:180,textAlign:"center"}}>
            📅 {monthLabel(selectedMonth)}
            {isCurrentMonth&&<span style={{marginLeft:6,fontSize:10,color:"var(--cyan)",fontFamily:"var(--font-body)"}}>current</span>}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth} style={{background:"none",border:"1px solid var(--border2)",borderRadius:"var(--radius)",color:isCurrentMonth?"var(--border2)":"var(--t2)",cursor:isCurrentMonth?"default":"pointer",padding:"6px 12px",fontSize:16,lineHeight:"1"}}>›</button>
        </div>
        <div className="ledgr-monthbar-meta" style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:12,color:"var(--t2)",justifyContent:"center",width:"100%"}}>
          {isCurrentMonth&&<span><span style={{fontFamily:"var(--font-mono)",color:"var(--t1)"}}>{daysLeft()}</span> days left</span>}
          <span>Spent: <span style={{fontFamily:"var(--font-mono)",color:"var(--t1)"}}>{fmt(totalSpent)}</span></span>
          <span>Income: <span style={{fontFamily:"var(--font-mono)",color:"var(--green)"}}>{fmt(totalIncome)}</span></span>
          <span>Net: <span style={{fontFamily:"var(--font-mono)",color:totalIncome-totalSpent>=0?"var(--green)":"var(--red)"}}>{fmt(totalIncome-totalSpent)}</span></span>
        </div>
      </div>
{/* Onboarding — show until all steps done */}
{!onboardingComplete && (
  <div style={{
    background:"var(--card)", border:"1px solid var(--border)",
    borderRadius:"var(--radius-lg)", padding:"20px", marginBottom:16,
  }}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
      <div>
        <div style={{fontFamily:"var(--font-disp)",fontSize:15,fontWeight:800,color:"var(--t1)"}}>
          Get started with ledgr.
        </div>
        <div style={{fontSize:12,color:"var(--t3)",marginTop:3}}>
          {onboardingProgress} of {onboardingSteps.length} steps complete
        </div>
      </div>
      <div style={{display:"flex",gap:6}}>
        {onboardingSteps.map(s => (
          <div key={s.id} style={{
            width:8, height:8, borderRadius:"50%",
            background: s.done ? "var(--cyan)" : "var(--border2)",
            transition:"background 0.3s",
          }}/>
        ))}
      </div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {onboardingSteps.map(s => (
        <div key={s.id} style={{
          padding:"12px 14px", borderRadius:"var(--radius)",
          background: s.done ? "transparent" : "var(--surface)",
          border:`1px solid ${s.done ? "transparent" : "var(--border)"}`,
          opacity: s.done ? 0.5 : 1,
          transition:"all 0.2s",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {/* Check / icon */}
            <div style={{
              width:32, height:32, borderRadius:"50%", flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              background: s.done ? "#00d4ff22" : "var(--card)",
              border:`1.5px solid ${s.done ? "var(--cyan)" : "var(--border2)"}`,
              fontSize:15,
            }}>
              {s.done ? <span style={{color:"var(--cyan)",fontWeight:800,fontSize:14}}>✓</span> : s.icon}
            </div>
            {/* Text */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",textDecoration:s.done?"line-through":"none"}}>
                {s.title}
              </div>
              {!s.done && (
                <div style={{fontSize:12,color:"var(--t3)",marginTop:2,lineHeight:1.4}}>{s.desc}</div>
              )}
            </div>
            {/* CTA — inline on desktop, below on mobile */}
            {!s.done && !isMobile && (
              <button onClick={s.action} style={{
                ...S.btn("ghost",true), flexShrink:0, whiteSpace:"nowrap",
                borderColor:"var(--cyan)", color:"var(--cyan)",
              }}>
                {s.cta}
              </button>
            )}
          </div>
          {/* CTA below on mobile */}
          {!s.done && isMobile && (
            <button onClick={s.action} style={{
              ...S.btn("ghost",true), marginTop:10, width:"100%",
              justifyContent:"center", borderColor:"var(--cyan)", color:"var(--cyan)",
            }}>
              {s.cta}
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
)}

{reviewCount > 0 && (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "var(--cyan-dim)",
      borderLeft: "3px solid var(--cyan)",
      borderRadius: "var(--radius)",
      padding: "10px 14px",
      marginBottom: 16,
    }}
  >
    <span style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>
      <span style={{ color: "var(--cyan)", fontWeight: 700 }}>
        {reviewCount}
      </span>{" "}
      transactions need review
    </span>

    <button
      onClick={() => {
        setView("transactions");
        setFilterReview(true);
        setSearch("");
        setFilterCat("all");
        setFilterAcct("all");
      }}
      style={{
        background: "none",
        color: "var(--cyan)",
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      Review ›
    </button>
  </div>
)}
      <div className="ledgr-stat-grid" style={{marginBottom:20}}>
        {[
          {label:"Budget",      value:fmt(totalBudget),sub:`${categories.length} categories`,         color:"var(--t1)"   },
          {label:"Spent",       value:fmt(totalSpent), sub:`${fmt(totalBudget-totalSpent)} left`,      color:"var(--red)"  },
          {label:"Income",      value:fmt(totalIncome),sub:`Net ${fmt(totalIncome-totalSpent)}`,       color:"var(--green)"},
          {label:"Transactions",value:monthTxns.length,sub:monthLabel(selectedMonth),                 color:"var(--t1)"   },
        ].map(s=>(
          <div key={s.label} style={S.stat} className="ledgr-card-anim">
            <div style={S.statLabel}>{s.label}</div>
            <div style={{...S.statValue,color:s.color,fontSize:isMobile?17:26}}>{s.value}</div>
            <div style={{...S.statSub,fontSize:isMobile?10:12}}>{s.sub}</div>
          </div>
        ))}
      </div>

      {isMobile ? (
        <div className="ledgr-dash-cards">
          <div style={S.card} className="ledgr-card-anim">
            <div style={{...S.sectionHdr,marginBottom:12}}>
              <div style={S.cardTitle}>Budget Progress</div>
              <button style={S.btn("ghost",true)} onClick={()=>navigate("budgets")}>All →</button>
            </div>
            {categories.length===0
              ? <div style={{textAlign:"center",padding:"24px 0",color:"var(--t3)"}}>No categories yet</div>
              : sortedCategories.slice(0,6).map(cat=>{
                  const spent=spentByCat[cat.id]||0,remaining=cat.limit-spent;
                  const pct=Math.min((spent/cat.limit)*100,100),over=remaining<0,warn=pct>=80&&!over&&remaining!==0;
                  const complete=!over&&(cat.completedMonths||[]).includes(selectedMonth);
                  return (
                    <div key={cat.id} style={{marginBottom:16,cursor:"pointer",opacity:complete?0.7:1}} onClick={()=>setDrillCat(cat)}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0,flex:1}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:complete?"var(--green)":cat.color,display:"inline-block",flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</span>
                        </div>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:13,color:complete?"var(--green)":over?"var(--red)":remaining===0?"var(--t3)":"var(--green)",flexShrink:0,marginLeft:8,fontWeight:600}}>
                          {complete?"✓ Done":over?`−${fmt(Math.abs(remaining))} over`:remaining===0?"Fully spent":fmt(remaining)+" left"}
                        </span>
                      </div>
                      <div style={{height:4,background:"var(--border)",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                        <div style={{height:"100%",borderRadius:99,width:`${complete?100:pct}%`,transition:"width 0.5s",background:complete?"var(--green)":over?"var(--red)":warn?"var(--amber)":remaining===0?"var(--t3)":cat.color}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t3)"}}>
                        <span>{fmt(spent)} spent</span><span>{fmt(cat.limit)} budget</span>
                      </div>
                    </div>
                  );
                })
            }
          </div>

          <div style={S.card}>
            <div style={{...S.sectionHdr,marginBottom:12}}>
              <div style={S.cardTitle}>Recent Transactions</div>
              <button style={S.btn("ghost",true)} onClick={()=>navigate("transactions")}>All →</button>
            </div>
            {filteredTxns.slice(0,8).map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:10,marginBottom:10,borderBottom:"1px solid var(--border)"}}>
                <div style={{flex:1,minWidth:0,marginRight:10}}>
                  <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {t.recurring&&<span style={{color:"var(--amber)",marginRight:4,fontSize:11}}>↻</span>}
                    {t.name||t.merchant}
                  </div>
                  <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{t.date} · <CategoryBadge cat={catMap[t.categoryId]}/></div>
                </div>
                <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0}}>
                  {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
                </span>
              </div>
            ))}
            {filteredTxns.length===0&&<div style={{textAlign:"center",color:"var(--t3)",padding:32}}>No transactions yet</div>}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {BudgetSummaryCard}
          </div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1fr) minmax(0, 1fr) 340px",gap:16,alignItems:"start"}}>
          {/* Col 1 — Budget Progress */}
          <div style={S.card} className="ledgr-card-anim">
            <div style={{...S.sectionHdr,marginBottom:12}}>
              <div style={S.cardTitle}>Budget Progress</div>
              <button style={S.btn("ghost",true)} onClick={()=>navigate("budgets")}>All →</button>
            </div>
            {categories.length===0
              ? <div style={{textAlign:"center",padding:"24px 0",color:"var(--t3)"}}>No categories yet</div>
              : sortedCategories.slice(0,8).map(cat=>{
                  const spent=spentByCat[cat.id]||0,remaining=cat.limit-spent;
                  const pct=Math.min((spent/cat.limit)*100,100),over=remaining<0,warn=pct>=80&&!over&&remaining!==0;
                  const complete=!over&&(cat.completedMonths||[]).includes(selectedMonth);
                  return (
                    <div key={cat.id} style={{marginBottom:14,cursor:"pointer",opacity:complete?0.7:1}} onClick={()=>setDrillCat(cat)}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0,flex:1}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:complete?"var(--green)":cat.color,display:"inline-block",flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</span>
                        </div>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:13,color:complete?"var(--green)":over?"var(--red)":remaining===0?"var(--t3)":"var(--green)",flexShrink:0,marginLeft:8,fontWeight:600}}>
                          {complete?"✓ Done":over?`−${fmt(Math.abs(remaining))} over`:remaining===0?"Fully spent":fmt(remaining)+" left"}
                        </span>
                      </div>
                      <div style={{height:4,background:"var(--border)",borderRadius:99,overflow:"hidden",marginBottom:3}}>
                        <div style={{height:"100%",borderRadius:99,width:`${complete?100:pct}%`,transition:"width 0.5s",background:complete?"var(--green)":over?"var(--red)":warn?"var(--amber)":remaining===0?"var(--t3)":cat.color}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t3)"}}>
                        <span>{fmt(spent)} spent</span><span>{fmt(cat.limit)} budget</span>
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {/* Col 2 — Recent Transactions */}
          <div style={S.card}>
            <div style={{...S.sectionHdr,marginBottom:12}}>
              <div style={S.cardTitle}>Recent Transactions</div>
              <button style={S.btn("ghost",true)} onClick={()=>navigate("transactions")}>All →</button>
            </div>
            {filteredTxns.slice(0,10).map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:10,marginBottom:10,borderBottom:"1px solid var(--border)"}}>
                <div style={{flex:1,minWidth:0,marginRight:10}}>
                  <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {t.recurring&&<span style={{color:"var(--amber)",marginRight:4,fontSize:11}}>↻</span>}
                    {t.name||t.merchant}
                  </div>
                  <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{t.date} · <CategoryBadge cat={catMap[t.categoryId]}/></div>
                </div>
                <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0}}>
                  {t.amount<0?"−":"+"}{fmt(Math.abs(t.amount))}
                </span>
              </div>
            ))}
            {filteredTxns.length===0&&<div style={{textAlign:"center",color:"var(--t3)",padding:32}}>No transactions yet</div>}
          </div>

          {/* Col 3 — Analytics sidebar */}
          <div style={{display:"flex",flexDirection:"column",gap:16,minWidth:0}}>
            {SpendingBreakdownCard}
            {CashFlowCard}
            {OverspendingHighlightsCard}
            {(()=>{
              const largest = [...filteredTxns].filter(t => t.amount < 0).sort((a,b) => a.amount - b.amount).slice(0,5);
              if (!largest.length) return null;
              return (
                <div style={{...S.card, padding:18}}>
                  <div style={{...S.sectionHdr, marginBottom:10}}>
                    <div style={S.cardTitle}>Largest Transactions</div>
                  </div>
                  {largest.map((t,i) => {
                    const cat = catMap[t.categoryId];
                    return (
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<largest.length-1?"1px solid var(--border)":"none"}}>
                        <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)",flexShrink:0,width:68}}>{t.date}</div>
                        <div style={{flex:1,minWidth:0,fontSize:13,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                        {cat && <span style={{fontSize:11,color:cat.color,flexShrink:0,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.name}</span>}
                        <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:"var(--red)",flexShrink:0}}>{fmt(Math.abs(t.amount))}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {DrillDownModal}
    </div>
  );

  /* ── Transactions ── */
  const Transactions = (()=>{
    // Group filtered transactions by date
    const grouped = filteredTxns.reduce((acc, t) => {
      const d = t.date || "Unknown";
      if (!acc[d]) acc[d] = [];
      acc[d].push(t);
      return acc;
    }, {});
    const dates = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

    const toReview = transactions.filter(t=>needsReview(t)).length;
    const totalBalance = accounts.reduce((a,b)=>a+(b.balance||0),0);

    return (
      <PageLayout
        isMobile={isMobile}
        left={(
          <div>
        {/* Header */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
          <div style={S.sectionTitle}>All Transactions</div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"var(--font-mono)",fontSize:18,fontWeight:700,color:"var(--green)"}}>{fmt(totalBalance)}</div>
            <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>Total Balance</div>
          </div>
        </div>

        {/* Review banner */}
        {toReview>0&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            background:"var(--cyan-dim)",borderLeft:"3px solid var(--cyan)",
            borderRadius:"var(--radius)",padding:"10px 14px",marginBottom:8}}>
            <span style={{fontSize:13,color:"var(--t1)",fontWeight:500}}>
              <span style={{color:"var(--cyan)",fontWeight:700}}>{toReview}</span> transactions need review
            </span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {filterReview && (
                <button onClick={()=>{
                  setTransactions(p => p.map(t => needsReview(t) ? {...t, reviewed:true} : t));
                  setFilterReview(false);
                  showToast("All transactions marked as reviewed");
                }}
                  style={{background:"none",color:"var(--cyan)",border:"1px solid var(--cyan)",borderRadius:"var(--radius)",cursor:"pointer",fontSize:12,fontWeight:600,padding:"3px 10px"}}>
                  ✓ Mark All Reviewed
                </button>
              )}
              <button onClick={()=>{ setFilterReview(p=>!p); setSearch(""); setFilterCat("all"); }}
                style={{background:filterReview?"var(--cyan)":"none",color:filterReview?"#000":"var(--cyan)",border:"none",borderRadius:"var(--radius)",cursor:"pointer",fontSize:13,fontWeight:600,padding:filterReview?"3px 10px":"0"}}>
                {filterReview?"✕ Clear":"Review ›"}
              </button>
            </div>
          </div>
        )}

        {/* Pending reconciliation banner */}
        {(activeDuplicatePairs.length>0)&&(
          <div style={{background:"#fbbf2412",borderLeft:"3px solid var(--amber)",
            borderRadius:"var(--radius)",padding:"10px 14px",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:13,color:"var(--t1)",fontWeight:500}}>
                <span style={{color:"var(--amber)",fontWeight:700}}>{activeDuplicatePairs.length}</span> possible duplicate transaction{activeDuplicatePairs.length!==1?"s":""} found
              </span>
              <button onClick={()=>{
                if (showReconcile && duplicateScanActive) setDuplicateScanActive(false);
                setShowReconcile(p=>!p);
              }}
                style={{background:showReconcile?"var(--amber)":"none",color:showReconcile?"#000":"var(--amber)",border:"none",borderRadius:"var(--radius)",cursor:"pointer",fontSize:13,fontWeight:600,padding:showReconcile?"3px 10px":"0"}}>
                {showReconcile?"✕ Close":"Review ›"}
              </button>
            </div>
            {showReconcile&&(
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
{activeDuplicatePairs.map(({pending:p, posted:po, wasConfirmed})=>{
                  const isScannedDuplicate = duplicateScanActive;
                  const pCat = catMap[p.categoryId];
                  const removeCandidate = (p && po) ? pickRemove(p, po) : p;
                  const removeLabel = removeCandidate?.pending ? "pending" : isPreauth(removeCandidate) ? "preauth" : "earlier";
                  return (
                    <div key={p.id} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"12px 14px"}}>
                      {/* Pending row */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:"var(--amber)",fontWeight:600,marginBottom:2}}>{isScannedDuplicate ? (p.pending ? "PENDING / CANDIDATE" : "CANDIDATE A") : "PENDING"}</div>
                          <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name||p.merchant}</div>
                          <div style={{fontSize:11,color:"var(--t3)"}}>{p.date}{pCat&&<span style={{color:pCat.color}}> · {pCat.name}</span>}{p.recurring&&<span style={{color:"var(--amber)"}}> · ↻</span>}</div>
                        </div>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:13,color:"var(--t3)",flexShrink:0,marginLeft:10}}>{fmt(Math.abs(p.amount))}</span>
                      </div>
                      {/* Arrow */}
                      <div style={{fontSize:11,color:"var(--t3)",textAlign:"center",margin:"4px 0"}}>{isScannedDuplicate ? "↓ possible duplicate match" : "↓ matches posted transaction"}</div>
                      {/* Posted row */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:"var(--green)",fontWeight:600,marginBottom:2}}>{isScannedDuplicate ? (po.pending ? "PENDING / CANDIDATE" : "CANDIDATE B") : "POSTED"}</div>
                          <div style={{fontSize:13,fontWeight:500,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{po.name||po.merchant}</div>
                          <div style={{fontSize:11,color:"var(--t3)"}}>{po.date}</div>
                        </div>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:po.amount<0?"var(--red)":"var(--green)",flexShrink:0,marginLeft:10}}>{po.amount<0?"-":"+"}{fmt(Math.abs(po.amount))}</span>
                      </div>
                      {/* Actions */}
                      <div style={{display:"flex",gap:8,justifyContent:"flex-end",alignItems:"center"}}>
                        {wasConfirmed && (
                          <span style={{fontSize:11,color:"var(--cyan)",marginRight:"auto"}}>✦ previously confirmed</span>
                        )}
                        <button style={{...S.btn("ghost",true),fontSize:12}} onClick={()=>{
                          if (isScannedDuplicate) {
                            dismissDuplicatePair(p.id, po.id);
                          } else {
                            dismissPair(p.id);
                          }
                        }}>
                          Not a match
                        </button>
                        <button style={{...S.btn("primary",true),fontSize:12}}
                          onClick={()=>{
                            if (isScannedDuplicate) {
                              const remove = removeCandidate;
                              const keep   = remove.id === p.id ? po : p;
                              confirmDuplicateRemoval(remove.id, keep.id);
                              const remaining = duplicatePairs.filter(pair => !(
                                (pair.pending.id===p.id && pair.posted.id===po.id) ||
                                (pair.pending.id===po.id && pair.posted.id===p.id)
                              ));
                              if (remaining.length === 0) setDuplicateScanActive(false);
                              setShowReconcile(remaining.length > 0);
                            } else {
                              confirmPair(p.id, po.id);
                              setShowReconcile(pendingPairs.length>1);
                            }
                          }}>
                          ✓ Confirm & remove {removeLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
          <button style={S.btn("primary",true)} onClick={openAddTxn}>+ Add</button>
          <button style={S.btn("ghost",true)} onClick={scanForDuplicates}>Scan Duplicates</button>
          {plaidItems.length>0&&<button style={S.btn("ghost",true)} onClick={()=>doSync()} disabled={syncing}>{syncing?"⟳ Syncing…":"⟳ Sync"}</button>}
          {aiChat.hasApiKey&&(
            <button style={S.btn("ghost",true)} disabled={autoCatRunning}
              onClick={async()=>{
                const count = await runAutoCategorize();
                showToast(count>0?`✦ Auto-categorized ${count} transaction${count===1?"":"s"}`:"Nothing new to categorize");
              }}>
              {autoCatRunning?"✦ Categorizing…":"✦ Auto-categorize"}
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="ledgr-filter-row" style={{...S.filterRow,marginBottom:14}}>
          <div style={{position:"relative",flex:1,minWidth:140}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--t3)",fontSize:13}}>🔍</span>
            <input ref={txnSearchInputRef} onFocus={()=>{txnSearchHadFocusRef.current=true;}} onBlur={()=>{txnSearchHadFocusRef.current=false;}} style={{...S.input,paddingLeft:32,fontSize:13}} placeholder="Search…" value={search} onChange={handleTxnSearchChange}/>
          </div>
          <select style={{...S.select,padding:"8px 10px"}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="">Uncategorized</option>
          </select>
          <select style={{...S.select,padding:"8px 10px"}} value={filterAcct} onChange={e=>setFilterAcct(e.target.value)}>
            <option value="all">All Accounts</option>
            {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {/* Bulk select toggle */}
          <button style={{...S.btn("ghost",true),fontSize:12,padding:"7px 12px",flexShrink:0}}
            onClick={()=>{ selectedTxns.size > 0 ? clearSelection() : selectAllVisible(); }}>
            {selectedTxns.size > 0 ? `✕ ${selectedTxns.size} selected` : "Select"}
          </button>
        </div>

        {/* Grouped transaction list */}
        {filteredTxns.length===0 ? (
          <div style={{textAlign:"center",padding:"48px 0",color:"var(--t3)"}}>No transactions found</div>
        ) : (
          <div style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:"var(--radius)",overflow:"hidden"}}>
            {dates.map((date,di)=>{
              const txns    = grouped[date];
              const dayTotal = txns.reduce((a,t)=>a+t.amount,0);
              return (
                <div key={date}>
                  {/* Date header */}
                  <div style={{
                    display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"8px 16px",
                    background:"var(--surface)",
                    borderTop: di>0?"1px solid var(--border)":"none",
                  }}>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--t3)",fontFamily:"var(--font-disp)",textTransform:"uppercase",letterSpacing:"0.8px"}}>
                      {new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
                    </span>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:dayTotal>=0?"var(--green)":"var(--t3)"}}>
                      {dayTotal>=0?"+":""}{fmt(dayTotal)}
                    </span>
                  </div>
                  {/* Transactions for this date */}
                  <div style={{padding:"0 16px"}}>
                    {txns.map(t=><TxnRow key={t.id} t={t}
                      expandedTxnId={expandedTxnId} setExpandedTxnId={setExpandedTxnId}
                      ellipsisId={ellipsisId} setEllipsisId={setEllipsisId}
                      editingId={editingId} editingName={editingName}
                      setEditingName={setEditingName} setEditingId={setEditingId}
                      catMap={catMap} acctMap={acctMap}
                      categories={categories} accounts={accounts}
                      needsReview={needsReview} markReviewed={markReviewed}
                      startRename={startRename} deleteTxn={deleteTxn}
                      updateTxnType={updateTxnType} updateTxnCat={updateTxnCat}
                      updateTxnAcct={updateTxnAcct} updateTxnNotes={updateTxnNotes}
                      openAddCat={openAddCat}
                      toggleRecurring={toggleRecurring} updateRecurringDay={updateRecurringDay}
                      saveRename={saveRename} isMobile={isMobile}
                      isSelected={selectedTxns.has(t.id)}
                      onToggleSelect={toggleSelectTxn}
                      selectionActive={selectedTxns.size > 0}
                    />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </div>
        )}
      />
    );
  })();


  /* ── Budgets ── */

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
      // Build last 3 months of spending per category
      const months = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const byCategory = {};
        transactions.forEach(t => {
          if (t.date?.startsWith(ym) && t.amount < 0 && t.categoryId) {
            byCategory[t.categoryId] = (byCategory[t.categoryId] || 0) + Math.abs(t.amount);
          }
        });
        months.push({ month: ym, byCategory });
      }

      // Compute avg monthly income
      const incomeMonths = months.map(m => {
        let inc = 0;
        transactions.forEach(t => {
          if (t.date?.startsWith(m.month) && t.amount > 0 && (t.type === "income" || !t.type)) inc += t.amount;
        });
        return inc;
      });
      const avgIncome = incomeMonths.reduce((a, b) => a + b, 0) / incomeMonths.length;

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

  const Budgets = (
    <div>
      {/* ── Budget Gauge ─────────────────────────────────────── */}
      {categories.length > 0 && totalBudget > 0 && (() => {
        const rawPct = totalBudget > 0 ? totalSpent / totalBudget : 0;
        const clampedPct = Math.min(rawPct, 1);
        const displayPct = Math.round(rawPct * 100);
        const over = rawPct > 1;
        const onBudget = rawPct >= 0.9 && rawPct <= 1;
        const gaugeColor = over ? "var(--red)" : onBudget ? "var(--green)" : "var(--cyan)";
        const trackColor = "rgba(255,255,255,0.08)";

        // Semicircle: arc from left (180°) counterclockwise to right (0°)
        // cx=100 cy=80 r=58 stroke=12 → top of arc = 80-58=22, bottom = 80
        // viewBox = "0 8 200 80" clips neatly to just the arc
        const cx = 100, cy = 80, r = 58, sw = 12;
        const startAngle = Math.PI;
        const sweepAngle = Math.PI * clampedPct;
        const endAngle   = startAngle - sweepAngle;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy - r * Math.sin(0);   // = cy (left tip, y=80)
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = sweepAngle > Math.PI ? 1 : 0;

        // Arc tip coords: SVG y-axis is inverted so sin is negated
        const lx = cx - r;                              // left tip  x
        const ly = cy;                                   // left tip  y  (sin(π)=0)
        const rx = cx + r;                              // right tip x
        const ry = cy;                                   // right tip y
        const ex = cx + r * Math.cos(endAngle);         // filled arc end x
        const ey = cy - r * Math.sin(endAngle);          // filled arc end y (negate for SVG)

        return (
          <div style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"16px 16px 14px", marginBottom:20 }}>
            {/* Title */}
            <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"1.5px", color:"var(--t3)", fontFamily:"var(--font-disp)", textAlign:"center", marginBottom:10 }}>
              Budget Progress
            </div>
            {/* SVG gauge — contained, no overflow */}
            <div style={{ display:"flex", justifyContent:"center" }}>
              <svg width={180} height={96} viewBox="10 22 180 58" style={{ display:"block", overflow:"hidden" }}>
                {/* Track */}
                <path
                  d={`M ${lx} ${ly} A ${r} ${r} 0 0 1 ${rx} ${ry}`}
                  fill="none" stroke={trackColor} strokeWidth={sw} strokeLinecap="round"
                />
                {/* Fill */}
                {clampedPct > 0.015 && (
                  <path
                    d={`M ${lx} ${ly} A ${r} ${r} 0 ${largeArc} 0 ${ex} ${ey}`}
                    fill="none" stroke={gaugeColor} strokeWidth={sw} strokeLinecap="round"
                    style={{ filter:`drop-shadow(0 0 5px ${gaugeColor}88)` }}
                  />
                )}
              </svg>
            </div>
            {/* Text below arc */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1, marginTop:6 }}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:12, color:gaugeColor, fontWeight:700 }}>
                {displayPct}%{over ? " over budget" : onBudget ? " on budget" : " of budget"}
              </div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:22, fontWeight:700, color:"var(--t1)", lineHeight:1.1 }}>
                {fmt(totalSpent)}
              </div>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>
                of {fmt(totalBudget)} budgeted
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ ...S.sectionHdr, marginBottom: 16 }}>
        <div style={S.sectionTitle}>Budget Categories</div>
        <div style={{ display:"flex", gap:8 }}>
          {aiChat.hasApiKey && (
            <button style={S.btn("ghost", true)} disabled={suggestingLimits}
              onClick={runSuggestLimits}>
              {suggestingLimits ? "✦ Analyzing…" : "✦ Optimize Limits"}
            </button>
          )}
          <button style={S.btn("primary", true)} onClick={openAddCat}>+ New Category</button>
        </div>
      </div>

      {/* AI Limit Suggestions panel */}
      {limitSuggestions.length > 0 && (
        <div style={{ background:"var(--card)", border:"1px solid var(--cyan)44",
                      borderRadius:"var(--radius-lg)", padding:16, marginBottom:20 }}
             className="ledgr-card-anim">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)" }}>
                ✦ AI Limit Suggestions
              </div>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>
                Based on your last 3 months of spending. Accept or dismiss each suggestion.
              </div>
            </div>
            <button style={{ ...S.btn("ghost",true), fontSize:11 }}
              onClick={() => setLimitSuggestions([])}>Dismiss all</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {limitSuggestions.map(s => {
              const cat = catMap[s.categoryId];
              if (!cat) return null;
              const diff = s.suggestedLimit - (cat.limit || 0);
              const diffColor = diff > 0 ? "var(--amber)" : diff < 0 ? "var(--green)" : "var(--t3)";
              return (
                <div key={s.categoryId} style={{
                  display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
                  background:"var(--surface)", borderRadius:"var(--radius)", padding:"10px 14px",
                  borderLeft:`3px solid ${cat.color}`,
                }}>
                  <div style={{ flex:1, minWidth:160 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:cat.color, flexShrink:0 }}/>
                      <span style={{ fontSize:13, fontWeight:600, color:"var(--t1)" }}>{cat.name}</span>
                    </div>
                    <div style={{ fontSize:11, color:"var(--t3)", lineHeight:1.5 }}>{s.reasoning}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:11, color:"var(--t3)" }}>Current</div>
                      <div style={{ fontSize:13, fontFamily:"var(--font-mono)", color:"var(--t2)" }}>
                        {fmt(cat.limit || 0)}
                      </div>
                    </div>
                    <div style={{ fontSize:13, color:"var(--t3)" }}>→</div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:11, color:"var(--t3)" }}>Suggested</div>
                      <div style={{ fontSize:14, fontFamily:"var(--font-mono)", fontWeight:700, color:cat.color }}>
                        {fmt(s.suggestedLimit)}
                      </div>
                      {diff !== 0 && (
                        <div style={{ fontSize:10, color:diffColor, fontFamily:"var(--font-mono)" }}>
                          {diff > 0 ? "+" : ""}{fmt(diff)}
                        </div>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={{ ...S.btn("primary", true), fontSize:12 }}
                        onClick={() => {
                          setCategories(p => p.map(c => c.id === s.categoryId ? { ...c, limit: s.suggestedLimit } : c));
                          setLimitSuggestions(p => p.filter(x => x.categoryId !== s.categoryId));
                          showToast(`${cat.name} limit updated to ${fmt(s.suggestedLimit)}`);
                        }}>
                        Accept
                      </button>
                      <button style={{ ...S.btn("ghost", true), fontSize:12 }}
                        onClick={() => setLimitSuggestions(p => p.filter(x => x.categoryId !== s.categoryId))}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 48, color: "var(--t3)" }}>No categories yet.</div>
      ) : (
        <>
          {isMobile ? (
            <>
              {(() => {
                const sections = [
                  { key: "over", label: "Overspent", cats: sortedCategories.filter(c => !c.completedMonths?.includes(selectedMonth) && (c.limit - (spentByCat[c.id] || 0)) < 0) },
                  { key: "progress", label: "In Progress", cats: sortedCategories.filter(c => { const r = c.limit - (spentByCat[c.id] || 0); return !c.completedMonths?.includes(selectedMonth) && r > 0; }) },
                  { key: "done", label: "Fully Spent", cats: sortedCategories.filter(c => c.completedMonths?.includes(selectedMonth) || (c.limit - (spentByCat[c.id] || 0)) === 0) },
                ].filter(s => s.cats.length > 0);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    {sections.map((section) => (
                      <div key={section.key} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: section.key === "over" ? "var(--red)" : section.key === "done" ? "var(--t3)" : "var(--t2)", fontFamily: "var(--font-disp)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{section.label}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t3)" }}>{section.cats.length} {section.cats.length === 1 ? "category" : "categories"}</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, padding: 6 }}>
                          {section.cats.map((cat) => {
                            const spent = spentByCat[cat.id] || 0;
                            const pct = Math.min((spent / cat.limit) * 100, 100);
                            const remaining = cat.limit - spent;
                            const over = remaining < 0;
                            const warn = pct >= 80 && !over && remaining !== 0;
                            const zero = remaining === 0 && !over;
                            const complete = !over && (cat.completedMonths || []).includes(selectedMonth);
                            const barC = over ? "var(--red)" : warn ? "var(--amber)" : (zero || complete) ? "var(--t3)" : cat.color;
                            const remColor = complete ? "var(--green)" : over ? "var(--red)" : zero ? "var(--t3)" : "var(--green)";
                            const remBg = complete ? "var(--green-dim)" : over ? "var(--red-dim)" : zero ? "var(--surface)" : "var(--green-dim)";
                            const displayPct = complete ? 100 : pct;
                            return (
                              <div key={cat.id} onClick={() => { setBudgetExpandedCatId(prev => prev === cat.id ? null : cat.id); setBudgetTxnSearch(""); }} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", cursor: "pointer" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0, display: "inline-block" }} />
                                  {editingCatNameId === cat.id ? (
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }} onClick={(e) => e.stopPropagation()}>
                                      <input autoFocus style={{ ...S.input, fontSize: 14, fontWeight: 600, padding: "3px 8px", flex: 1 }} value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} onBlur={() => saveCatName(cat.id)} onKeyDown={(e) => { if (e.key === "Enter") saveCatName(cat.id); if (e.key === "Escape") setEditingCatNameId(null); }} />
                                    </div>
                                  ) : (
                                    <span onClick={(e) => { e.stopPropagation(); setEditingCatNameId(cat.id); setEditingCatName(cat.name); }} title="Tap to rename" style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text" }}>{cat.name}</span>
                                  )}
                                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: remColor, background: remBg, border: `1px solid ${remColor}33`, borderRadius: 6, padding: "2px 7px", flexShrink: 0 }}>{over ? `-${fmt(Math.abs(remaining))}` : fmt(remaining)}</span>
                                  <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setBudgetKebabId(p => p === cat.id ? null : cat.id); }}
                                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 18, padding: "2px 6px", lineHeight: 1, borderRadius: "var(--radius)" }}
                                    >⋯</button>
                                    {budgetKebabId === cat.id && (
                                      <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 40, background: "var(--card)", border: "1px solid var(--border2)", borderRadius: "var(--radius)", boxShadow: "0 4px 16px #00000055", minWidth: 160, overflow: "hidden" }}>
                                        <button onClick={() => { toggleCatComplete(cat.id); setBudgetKebabId(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: complete ? "var(--green)" : "var(--t1)", borderBottom: "1px solid var(--border)" }}>
                                          {complete ? "✓ Unmark Complete" : "✓ Mark Complete"}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); openEditCat(cat); setBudgetKebabId(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--t1)", borderBottom: "1px solid var(--border)" }}>
                                          Edit Category
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteCat(cat.id); setBudgetKebabId(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--red)" }}>
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
                                  <div style={{ height: "100%", borderRadius: 99, background: barC, width: `${displayPct}%`, transition: "width 0.5s" }} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <span style={{ fontSize: 12, color: over ? "var(--red)" : warn ? "var(--amber)" : "var(--t3)" }}>
                                    {complete && <span style={{ fontWeight: 600, marginRight: 4, color: "var(--green)" }}>✓ Complete ·</span>}
                                    {!complete && over && <span style={{ fontWeight: 600, marginRight: 4 }}>Overspent ·</span>}
                                    {!complete && zero && <span style={{ marginRight: 4 }}>Fully spent ·</span>}
                                    Spent {fmt(spent)} /{" "}
                                    {editingLimitId === cat.id ? (
                                      <input type="number" autoFocus style={{ background: "none", border: "none", borderBottom: "1px solid var(--cyan)", fontSize: 12, color: "var(--t1)", outline: "none", width: 70, fontFamily: "var(--font-mono)" }} value={editingLimitVal} onChange={(e) => setEditingLimitVal(e.target.value)} onBlur={() => saveLimit(cat.id)} onKeyDown={(e) => { if (e.key === "Enter") saveLimit(cat.id); if (e.key === "Escape") setEditingLimitId(null); }} onClick={(e) => e.stopPropagation()} />
                                    ) : (
                                      <span onClick={(e) => startEditLimit(cat, e)} style={{ cursor: "text", color: "var(--t3)", textDecoration: "underline dotted", textUnderlineOffset: 2 }}>{fmt(cat.limit)}</span>
                                    )}
                                  </span>
                                  <span className={`ledgr-chevron${budgetExpandedCatId === cat.id ? " ledgr-chevron-open" : ""}`} style={{ color: "var(--t3)", fontSize: 12 }}>▼</span>
                                </div>

                                {budgetExpandedCatId === cat.id && (
                                  <div className="ledgr-expand" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>

                                    {/* Assigned transactions */}
                                    {monthTxns.filter(t => t.categoryId === cat.id && t.amount < 0).sort((a,b)=>b.date.localeCompare(a.date)).length === 0 ? (
                                      <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 12 }}>No transactions assigned to this category in {monthLabel(selectedMonth)}.</div>
                                    ) : (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                                        {monthTxns.filter(t => t.categoryId === cat.id && t.amount < 0).sort((a,b)=>b.date.localeCompare(a.date)).map((t) => (
                                          <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px" }}>
                                            <div style={{ minWidth: 0 }}>
                                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || t.merchant}</div>
                                              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 1 }}>{t.date}</div>
                                            </div>
                                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--red)", whiteSpace: "nowrap" }}>{fmt(Math.abs(t.amount))}</div>
                                            <button
                                              title="Remove from this category"
                                              onClick={() => { updateTxnCat(t.id, ""); showToast("Removed from " + cat.name); }}
                                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 16, padding: "2px 4px", lineHeight: 1 }}>✕</button>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Manual assignment — search all month transactions */}
                                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
                                        Manually assign a transaction
                                      </div>
                                      <input
                                        placeholder="Search by name or merchant…"
                                        value={budgetExpandedCatId === cat.id ? budgetTxnSearch : ""}
                                        onChange={e => setBudgetTxnSearch(e.target.value)}
                                        onClick={e => e.stopPropagation()}
                                        style={{ ...S.input, width: "100%", fontSize: 12, padding: "7px 10px", marginBottom: 8, boxSizing: "border-box" }}
                                      />
                                      {(() => {
                                        const q = budgetTxnSearch.toLowerCase().trim();
                                        const candidates = monthTxns
                                          .filter(t => t.amount < 0 && t.categoryId !== cat.id)
                                          .filter(t => !q || (t.name || t.merchant || "").toLowerCase().includes(q) || (t.date || "").includes(q))
                                          .sort((a, b) => b.date.localeCompare(a.date))
                                          .slice(0, q ? 20 : 5);
                                        if (!q && candidates.length === 0) return (
                                          <div style={{ fontSize: 12, color: "var(--t3)" }}>All transactions in this month are already assigned here.</div>
                                        );
                                        return (
                                          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                                            {candidates.length === 0 && q && (
                                              <div style={{ fontSize: 12, color: "var(--t3)" }}>No matching transactions found.</div>
                                            )}
                                            {candidates.map(t => (
                                              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px" }}>
                                                <div style={{ minWidth: 0 }}>
                                                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || t.merchant}</div>
                                                  <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 1 }}>
                                                    {t.date}
                                                    {t.categoryId && catMap[t.categoryId] && (
                                                      <span style={{ marginLeft: 6, color: catMap[t.categoryId].color }}>· {catMap[t.categoryId].name}</span>
                                                    )}
                                                    {!t.categoryId && <span style={{ marginLeft: 6, color: "var(--t3)" }}>· Uncategorized</span>}
                                                  </div>
                                                </div>
                                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--red)", whiteSpace: "nowrap" }}>{fmt(Math.abs(t.amount))}</div>
                                                <button
                                                  onClick={() => { updateTxnCat(t.id, cat.id); setBudgetTxnSearch(""); showToast("Assigned to " + cat.name); }}
                                                  style={{ ...S.btn("primary", true), padding: "4px 10px", fontSize: 11 }}>
                                                  + Assign
                                                </button>
                                              </div>
                                            ))}
                                            {!q && <div style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", paddingTop: 4 }}>Showing 5 most recent · search to find more</div>}
                                          </div>
                                        );
                                      })()}
                                    </div>

                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

            </>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 16, alignItems: "start" }}>
              <div style={{ minWidth: 0 }}>
                {(() => {
                  const sections = [
                    { key: "over", label: "Overspent", cats: sortedCategories.filter(c => !c.completedMonths?.includes(selectedMonth) && (c.limit - (spentByCat[c.id] || 0)) < 0) },
                    { key: "progress", label: "In Progress", cats: sortedCategories.filter(c => { const r = c.limit - (spentByCat[c.id] || 0); return !c.completedMonths?.includes(selectedMonth) && r > 0; }) },
                    { key: "done", label: "Fully Spent", cats: sortedCategories.filter(c => c.completedMonths?.includes(selectedMonth) || (c.limit - (spentByCat[c.id] || 0)) === 0) },
                  ].filter(s => s.cats.length > 0);

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {sections.map((section) => (
                        <div key={section.key} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: section.key === "over" ? "var(--red)" : section.key === "done" ? "var(--t3)" : "var(--t2)", fontFamily: "var(--font-disp)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{section.label}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--t3)" }}>{section.cats.length} {section.cats.length === 1 ? "category" : "categories"}</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: 6 }}>
                            {section.cats.map((cat) => {
                              const spent = spentByCat[cat.id] || 0;
                              const pct = Math.min((spent / cat.limit) * 100, 100);
                              const remaining = cat.limit - spent;
                              const over = remaining < 0;
                              const warn = pct >= 80 && !over && remaining !== 0;
                              const zero = remaining === 0 && !over;
                              const complete = !over && (cat.completedMonths || []).includes(selectedMonth);
                              const barC = over ? "var(--red)" : warn ? "var(--amber)" : (zero || complete) ? "var(--t3)" : cat.color;
                              const remColor = complete ? "var(--green)" : over ? "var(--red)" : zero ? "var(--t3)" : "var(--green)";
                              const remBg = complete ? "var(--green-dim)" : over ? "var(--red-dim)" : zero ? "var(--surface)" : "var(--green-dim)";
                              const displayPct = complete ? 100 : pct;
                              return (
                                <div key={cat.id} onClick={() => setBudgetDrillCat(cat)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", cursor: "pointer", transition: "background 0.12s" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--card)")}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0, display: "inline-block" }} />
                                    {editingCatNameId === cat.id ? (
                                      <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }} onClick={(e) => e.stopPropagation()}>
                                        <input autoFocus style={{ ...S.input, fontSize: 14, fontWeight: 600, padding: "3px 8px", flex: 1 }} value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} onBlur={() => saveCatName(cat.id)} onKeyDown={(e) => { if (e.key === "Enter") saveCatName(cat.id); if (e.key === "Escape") setEditingCatNameId(null); }} />
                                      </div>
                                    ) : (
                                      <span onClick={(e) => { e.stopPropagation(); setEditingCatNameId(cat.id); setEditingCatName(cat.name); }} title="Click to rename" style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text" }}>{cat.name}</span>
                                    )}
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: remColor, background: remBg, border: `1px solid ${remColor}33`, borderRadius: 6, padding: "2px 7px", flexShrink: 0 }}>{over ? `-${fmt(Math.abs(remaining))}` : fmt(remaining)}</span>
                                    <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setBudgetKebabId(p => p === cat.id ? null : cat.id); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", fontSize: 18, padding: "2px 6px", lineHeight: 1, borderRadius: "var(--radius)" }}
                                      >⋯</button>
                                      {budgetKebabId === cat.id && (
                                        <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 40, background: "var(--card)", border: "1px solid var(--border2)", borderRadius: "var(--radius)", boxShadow: "0 4px 16px #00000055", minWidth: 160, overflow: "hidden" }}>
                                          <button onClick={() => { toggleCatComplete(cat.id); setBudgetKebabId(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: complete ? "var(--green)" : "var(--t1)", borderBottom: "1px solid var(--border)" }}>
                                            {complete ? "✓ Unmark Complete" : "✓ Mark Complete"}
                                          </button>
                                          <button onClick={(e) => { e.stopPropagation(); openEditCat(cat); setBudgetKebabId(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--t1)", borderBottom: "1px solid var(--border)" }}>
                                            Edit Category
                                          </button>
                                          <button onClick={(e) => { e.stopPropagation(); deleteCat(cat.id); setBudgetKebabId(null); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--red)" }}>
                                            Delete
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
                                    <div style={{ height: "100%", borderRadius: 99, background: barC, width: `${displayPct}%`, transition: "width 0.5s" }} />
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 12, color: over ? "var(--red)" : warn ? "var(--amber)" : "var(--t3)" }}>
                                      {complete && <span style={{ fontWeight: 600, marginRight: 4, color: "var(--green)" }}>✓ Complete ·</span>}
                                      {!complete && over && <span style={{ fontWeight: 600, marginRight: 4 }}>Overspent ·</span>}
                                      {!complete && zero && <span style={{ marginRight: 4 }}>Fully spent ·</span>}
                                      Spent {fmt(spent)} /{" "}
                                      {editingLimitId === cat.id ? (
                                        <input type="number" autoFocus style={{ background: "none", border: "none", borderBottom: "1px solid var(--cyan)", fontSize: 12, color: "var(--t1)", outline: "none", width: 70, fontFamily: "var(--font-mono)" }} value={editingLimitVal} onChange={(e) => setEditingLimitVal(e.target.value)} onBlur={() => saveLimit(cat.id)} onKeyDown={(e) => { if (e.key === "Enter") saveLimit(cat.id); if (e.key === "Escape") setEditingLimitId(null); }} onClick={(e) => e.stopPropagation()} />
                                      ) : (
                                        <span onClick={(e) => startEditLimit(cat, e)} style={{ cursor: "text", color: "var(--t3)", textDecoration: "underline dotted", textUnderlineOffset: 2 }}>{fmt(cat.limit)}</span>
                                      )}
                                    </span>

                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                <div style={{ ...S.card, padding: 18 }}>
                  <div style={{ ...S.sectionHdr, marginBottom: 8 }}>
                    <div style={S.sectionTitle}>{budgetDrillCat ? `${budgetDrillCat.name} Transactions` : 'Category Transactions'}</div>
                  </div>
                  {budgetDrillCat ? (
                    <>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,paddingBottom:12,borderBottom:"1px solid var(--border)"}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                            <span style={{width:9,height:9,borderRadius:"50%",background:budgetDrillCat.color,display:"inline-block"}} />
                            <span style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>{budgetDrillCat.name}</span>
                          </div>
                          <div style={{fontSize:12,color:"var(--t3)"}}>{budgetCatTxns.length} transaction{budgetCatTxns.length!==1?"s":""} this month</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:"var(--font-mono)",fontSize:16,fontWeight:800,color:(spentByCat[budgetDrillCat.id]||0)>budgetDrillCat.limit?"var(--red)":"var(--t1)"}}>{fmt(spentByCat[budgetDrillCat.id]||0)}</div>
                          <div style={{fontSize:11,color:"var(--t3)"}}>of {fmt(budgetDrillCat.limit)}</div>
                        </div>
                      </div>
                      {budgetCatTxns.length === 0 ? (
                        <div style={{ color: "var(--t3)", padding: "24px 0", textAlign:"center" }}>No transactions assigned this month.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "70vh", overflowY: "auto", paddingRight: 2 }}>
                          {budgetCatTxns.map((t) => (
                            <div key={t.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 12px", display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name || t.merchant}</div>
                                <div style={{ fontSize: 12, color: "var(--t3)" }}>{t.date}</div>
                                <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{acctMap[t.accountId]?.name || 'No account'}</div>
                                <div style={{ marginTop: 8 }}>
                                  <select
                                    style={{ ...S.select, width: "100%", padding: "7px 10px", fontSize: 12 }}
                                    value={t.categoryId || ""}
                                    onChange={(e) => updateTxnCat(t.id, e.target.value)}
                                  >
                                    <option value="">— Uncategorized —</option>
                                    {categories.map((c) => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800, color: t.amount < 0 ? "var(--red)" : "var(--green)", whiteSpace: "nowrap" }}>{t.amount < 0 ? "-" : "+"}{fmt(Math.abs(t.amount))}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{border:"1px dashed var(--border2)",borderRadius:"var(--radius)",padding:24,color:"var(--t3)",textAlign:"center",fontSize:13}}>Click a budget category to view its transactions here.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* DrillDownModal intentionally omitted — budgets page handles expansion inline */}
    </div>
  );
  /* ── Accounts ── */
  const Accounts = (
    <PageLayout
      isMobile={isMobile}
      left={
        <div>
          <div style={{...S.sectionHdr,marginBottom:8}}>
            <div style={S.sectionTitle}>Accounts</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <PlaidButton onSuccess={handlePlaidSuccess} onExit={()=>{}} label="Link Bank"/>
              <button style={S.btn("ghost",true)} onClick={openAddAcct}>+ Manual</button>
            </div>
          </div>
          <div style={{fontSize:13,color:"var(--t2)",marginBottom:16}}>Projections based on your daily spend rate through end of {today.toLocaleString("default",{month:"long"})}.</div>
          {plaidItems.length>0&&(
            <div style={{...S.card,marginBottom:16}}>
              <div style={S.cardTitle}>Connected Banks</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {plaidItems.map(item=>{
                  const isStale = staleItemIds.has(item.item_id);
                  return (
                    <div key={item.item_id} style={{
                      background:"var(--surface)",
                      border:`1px solid ${isStale?"var(--amber)44":"var(--border2)"}`,
                      borderRadius:"var(--radius)",
                      padding:"12px 14px",
                    }}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            🏦 {item.institution}
                          </div>
                          {isStale&&(
                            <div style={{fontSize:11,color:"var(--amber)",marginTop:3,display:"flex",alignItems:"center",gap:4}}>
                              ⚠ Connection issue — no accounts found
                            </div>
                          )}
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                          {!isStale&&(
                            <button style={{...S.btn("ghost",true),fontSize:12,padding:"4px 10px"}}
                              onClick={()=>doSync(item.item_id)} disabled={syncing}>
                              {syncing?"…":"⟳ Sync"}
                            </button>
                          )}
                          <button style={{...S.btn("danger",true),fontSize:12,padding:"4px 10px"}}
                            onClick={()=>disconnectItem(item.item_id)}>
                            Disconnect
                          </button>
                        </div>
                      </div>
                      {isStale&&(
                        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}}>
                          <div style={{fontSize:12,color:"var(--t2)",marginBottom:10,lineHeight:1.5}}>
                            This connection has expired. Reconnect to restore your accounts — your existing transactions and rules won't be affected.
                          </div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            <PlaidButton
                              itemId={item.item_id}
                              onSuccess={async (publicToken, institution) => {
                                // Update mode: same item_id is preserved server-side
                                // Just exchange the new public token — no disconnect needed
                                await handlePlaidSuccess(publicToken, institution || item.institution);
                                setStaleItemIds(prev => { const n = new Set(prev); n.delete(item.item_id); return n; });
                                setReconnectingItemId(null);
                              }}
                              onExit={() => setReconnectingItemId(null)}
                              label={reconnectingItemId === item.item_id ? "Opening Plaid…" : "Reconnect"}
                              style={{flex:isMobile?1:0, justifyContent:"center"}}
                            />
                            <button style={{...S.btn("danger",true),flex:isMobile?1:0}}
                              onClick={()=>disconnectItem(item.item_id)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {accounts.length===0
            ? <div style={{...S.card,textAlign:"center",padding:48,color:"var(--t3)"}}>No accounts yet.</div>
            : <div style={{...S.card,padding:0,overflow:"hidden"}}>
                {isMobile ? (
                  /* Mobile: flat list inside the card, same as Connected Banks */
                  accounts.map((acct,idx) => {
                    const spent=spentByAcct[acct.id]||0;
                    const income=monthTxns.filter(t=>t.amount>0&&t.accountId===acct.id&&(t.type==="income"||!t.type)).reduce((a,t)=>a+t.amount,0);
                    const daily=today.getDate()>0?spent/today.getDate():0;
                    const typeIcon=acct.type==="Credit"?"💳":acct.type==="Savings"?"🏦":"🏧";
                    return (
                      <div key={acct.id} style={{padding:"12px 14px",borderTop:idx>0?"1px solid var(--border)":"none"}}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:4}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:700,fontFamily:"var(--font-disp)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{typeIcon} {acct.name}</div>
                            {acct.institution&&<div style={{fontSize:11,color:"var(--t3)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acct.institution}</div>}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                            <span style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:700,color:"var(--cyan)"}}>{fmt(acct.balance)}</span>
                            <button style={{background:"none",border:"1px solid var(--border2)",cursor:"pointer",color:"var(--t3)",fontSize:12,padding:"2px 8px",borderRadius:"var(--radius)"}} onClick={()=>openEditAcct(acct)}>Edit</button>
                            <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:14,padding:"2px 4px"}} onClick={()=>deleteAcct(acct.id)}>✕</button>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",rowGap:2}}>
                          <span style={{fontSize:11,color:"var(--t3)"}}>{acct.type}</span>
                          {acct.available!=null&&<span style={{fontSize:11,color:"var(--t3)"}}>· Avail {fmt(acct.available)}</span>}
                          <span style={{fontSize:11,color:"var(--t3)"}}>· Spent {fmt(spent)}</span>
                          {income>0&&<span style={{fontSize:11,color:"var(--green)"}}>· +{fmt(income)}</span>}
                          <span style={{fontSize:11,color:"var(--t3)"}}>· ~{fmt(daily)}/day</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* Desktop: 2-column grid */
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:12}}>
                    {accounts.map(acct=>{
                      const spent=spentByAcct[acct.id]||0;
                      const income=monthTxns.filter(t=>t.amount>0&&t.accountId===acct.id&&(t.type==="income"||!t.type)).reduce((a,t)=>a+t.amount,0);
                      const daily=today.getDate()>0?spent/today.getDate():0;
                      const typeIcon=acct.type==="Credit"?"💳":acct.type==="Savings"?"🏦":"🏧";
                      return (
                        <div key={acct.id} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"12px 14px"}}>
                          <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:4}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:14,fontWeight:700,fontFamily:"var(--font-disp)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{typeIcon} {acct.name}</div>
                              {acct.institution&&<div style={{fontSize:11,color:"var(--t3)",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{acct.institution}</div>}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                              <span style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:700,color:"var(--cyan)"}}>{fmt(acct.balance)}</span>
                              <button style={{background:"none",border:"1px solid var(--border2)",cursor:"pointer",color:"var(--t3)",fontSize:12,padding:"2px 8px",borderRadius:"var(--radius)"}} onClick={()=>openEditAcct(acct)}>Edit</button>
                              <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:14,padding:"2px 4px"}} onClick={()=>deleteAcct(acct.id)}>✕</button>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",rowGap:2}}>
                            <span style={{fontSize:11,color:"var(--t3)"}}>{acct.type}</span>
                            {acct.available!=null&&<span style={{fontSize:11,color:"var(--t3)"}}>· Avail {fmt(acct.available)}</span>}
                            <span style={{fontSize:11,color:"var(--t3)"}}>· Spent {fmt(spent)}</span>
                            {income>0&&<span style={{fontSize:11,color:"var(--green)"}}>· +{fmt(income)}</span>}
                            <span style={{fontSize:11,color:"var(--t3)"}}>· ~{fmt(daily)}/day · proj {fmt(daily*daysInMonth(today.getFullYear(),today.getMonth()+1))}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
          }
          <SecurityBadges compact />
        </div>
      }
    />
  );

  /* ── Rules ── */
  const Rules = (
    <PageLayout
      isMobile={isMobile}
      left={
        <div>
          <div style={{...S.sectionHdr,marginBottom:6}}>
            <div style={S.sectionTitle}>Auto-Categorization Rules</div>
            <button style={S.btn("primary",true)} onClick={()=>{setRuleForm({pattern:"",matchType:"contains",categoryId:"",enabled:true});setModal("addRule");}}>+ New Rule</button>
          </div>
          <p style={{fontSize:12,color:"var(--t3)",marginBottom:4,lineHeight:1.6}}>Automatically assign categories to new transactions when they sync. Manual rules always take priority over AI rules.</p>
          {rules.length > 0 && (
            <div style={{fontSize:11,color:"var(--t3)",marginBottom:16,display:"flex",gap:12}}>
              <span>{rules.filter(r=>r.source!=="ai").length} manual</span>
              <span style={{color:"var(--cyan)"}}>{rules.filter(r=>r.source==="ai").length} AI-learned</span>
            </div>
          )}

          {rules.length===0 ? (
            <div style={{...S.card,textAlign:"center",padding:48}}>
              <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◎</div>
              <div style={{fontSize:14,fontWeight:600,color:"var(--t1)",marginBottom:6}}>No rules yet</div>
              <div style={{fontSize:13,color:"var(--t3)"}}>Categorize a transaction and you'll be prompted to save it as a rule.</div>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8}}>
              {rules.map((rule)=>{
                const cat = catMap[rule.categoryId];
                const isAi = rule.source === "ai";
                return (
                  <div key={rule.id}
                    style={{
                      background:"var(--card)",border:"1px solid var(--border)",
                      borderRadius:"var(--radius)",padding:"9px 14px",
                      borderLeft:rule.enabled
                        ? `3px solid ${cat?.color||rule.typeOverride?"var(--amber)":"var(--cyan)"}`
                        : "3px solid var(--border2)",
                      opacity:rule.enabled?1:0.45,
                    }}>
                    <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:0}}>
                      {/* Line 1: pattern → destination + meta */}
                      <div style={{display:"flex",alignItems:"center",gap:5,minWidth:0,overflow:"hidden"}}>
                        <span style={{fontFamily:"var(--font-mono)",fontSize:12,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0,flex:1}}>"{rule.pattern}"</span>
                        <span style={{fontSize:11,color:"var(--t3)",flexShrink:0}}>→</span>
                        {rule.typeOverride
                          ? <span style={{fontSize:11,color:"var(--amber)",textTransform:"capitalize",flexShrink:0,whiteSpace:"nowrap"}}>{rule.typeOverride}</span>
                          : cat ? <span style={{fontSize:11,color:cat.color,flexShrink:0,whiteSpace:"nowrap",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis"}}>{cat.name}</span>
                          : <span style={{fontSize:11,color:"var(--t3)",flexShrink:0}}>No category</span>}
                      </div>
                      {/* Line 2: match type + AI badge + actions */}
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:10,color:"var(--t3)",flex:1}}>{rule.matchType==="exact"?"Exact":rule.matchType==="starts"?"Starts with":"Contains"}{isAi?" · ✦ AI":""}</span>
                        <button style={{background:"none",border:"1px solid var(--border2)",cursor:"pointer",color:rule.enabled?"var(--t2)":"var(--t3)",fontSize:10,padding:"2px 6px",borderRadius:"var(--radius)"}} onClick={()=>toggleRule(rule.id)}>{rule.enabled?"On":"Off"}</button>
                        <button style={{background:"none",border:"1px solid var(--border2)",cursor:"pointer",color:"var(--t2)",fontSize:10,padding:"2px 6px",borderRadius:"var(--radius)"}} onClick={()=>{setRuleForm({pattern:rule.pattern,matchType:rule.matchType,categoryId:rule.categoryId||"",typeOverride:rule.typeOverride||"",enabled:rule.enabled});setEditTarget(rule);setModal("editRule");}}>Edit</button>
                        <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:13,padding:"2px 4px"}} onClick={()=>deleteRule(rule.id)}>✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      }
    />
  );


  /* ── Calendar ── */
  const calYear=parseInt(calendarMonth.split("-")[0]);
  const calMonthN=parseInt(calendarMonth.split("-")[1]);
  const firstDow=new Date(calYear,calMonthN-1,1).getDay();
  const daysInCal=daysInMonth(calYear,calMonthN);
  const totalCells=Math.ceil((firstDow+daysInCal)/7)*7;

  const Calendar = (()=>{
    const isCurrentCalMonth = calYear===today.getFullYear()&&calMonthN===today.getMonth()+1;
    const isPastCalMonth    = calYear<today.getFullYear()||(calYear===today.getFullYear()&&calMonthN<today.getMonth()+1);
    const relevantTxns = recurringTxns.filter(t=>{
      if (isPastCalMonth) return false;
      if (isCurrentCalMonth) return (t.recurringDay||0)>=today.getDate();
      return true;
    });

    const shownIds = calendarAccounts || accounts.map(a=>a.id);
    const byAccount = {};
    shownIds.forEach(id=>{ const a=acctMap[id]; if(a) byAccount[id]={id,name:a.name,total:0,count:0,txns:[]}; });
    relevantTxns.forEach(t=>{
      if (!t.accountId||!byAccount[t.accountId]) return;
      if (t.amount>=0) return;
      byAccount[t.accountId].total+=Math.abs(t.amount);
      byAccount[t.accountId].count+=1;
      byAccount[t.accountId].txns.push(t);
    });
    const acctEntries = Object.values(byAccount).sort((a,b)=>b.total-a.total);
    const acctTotal   = acctEntries.reduce((a,e)=>a+e.total,0);
    const acctLabel   = isPastCalMonth?`Charged in ${monthLabel(calendarMonth)}`:isCurrentCalMonth?`Remaining in ${monthLabel(calendarMonth)}`:`Charges in ${monthLabel(calendarMonth)}`;

    const selectedDayTxns = calendarDay?.day && calendarTxnsByDay[calendarDay.day]
      ? calendarTxnsByDay[calendarDay.day]
      : [];

    const selectedDayDateLabel = calendarDay?.day
      ? new Date(calYear, calMonthN - 1, calendarDay.day).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "No day selected";

    const selectedDayTotal = selectedDayTxns.reduce(
      (sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0),
      0
    );

    const selectedCatBreakdown = Object.values(
      selectedDayTxns.reduce((acc, t) => {
        const cat = catMap[t.categoryId];
        const key = t.categoryId || "__uncategorized__";
        if (!acc[key]) {
          acc[key] = {
            id: key,
            name: cat?.name || "Uncategorized",
            color: cat?.color || "var(--t3)",
            total: 0,
            count: 0,
          };
        }
        acc[key].total += Math.abs(t.amount || 0);
        acc[key].count += 1;
        return acc;
      }, {})
    ).sort((a, b) => b.total - a.total);

    const MobileCalendarView = (
      <div>
        <div style={{ ...S.sectionHdr, marginBottom: 16 }}>
          <div style={S.sectionTitle}>Recurring Calendar</div>
          <div style={{ fontSize: 13, color: "var(--t2)" }}>{recurringTxns.length} recurring</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button
            onClick={prevCalMonth}
            style={{
              background: "none",
              border: "1px solid var(--border2)",
              borderRadius: "var(--radius)",
              color: "var(--t2)",
              cursor: "pointer",
              padding: "6px 12px",
              fontSize: 16,
              lineHeight: "1",
            }}
          >
            ‹
          </button>

          <div style={{ fontFamily: "var(--font-disp)", fontSize: 17, fontWeight: 700 }}>
            {monthLabel(calendarMonth)}
          </div>

          <button
            onClick={nextCalMonth}
            style={{
              background: "none",
              border: "1px solid var(--border2)",
              borderRadius: "var(--radius)",
              color: "var(--t2)",
              cursor: "pointer",
              padding: "6px 12px",
              fontSize: 16,
              lineHeight: "1",
            }}
          >
            ›
          </button>
        </div>

        <div style={{ ...S.card, padding: 0, overflow: "hidden", marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,minmax(0,1fr))",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {DAYS_OF_WEEK.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: "center",
                  padding: "8px 4px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--t3)",
                  fontFamily: "var(--font-disp)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                {d[0]}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,minmax(0,1fr))",
              gap: 1,
              background: "var(--border)",
            }}
          >
            {Array.from({ length: totalCells }).map((_, i) => {
              const day = i - firstDow + 1;
              const isValid = day >= 1 && day <= daysInCal;
              const isToday =
                isValid &&
                calYear === today.getFullYear() &&
                calMonthN === today.getMonth() + 1 &&
                day === today.getDate();
              const dayTxns = isValid ? calendarTxnsByDay[day] || [] : [];
              const isSelected = calendarDay?.day === day;

              return (
                <div
                  key={i}
                  onClick={() => {
                    if (isValid) setCalendarDay(dayTxns.length > 0 ? { day, txns: dayTxns } : null);
                  }}
                  style={{
                    background: isSelected
                      ? "var(--cyan-dim)"
                      : isToday
                      ? "var(--surface)"
                      : "var(--card)",
                    border: isSelected ? "1px solid var(--cyan)44" : "1px solid transparent",
                    minHeight: 54,
                    padding: 4,
                    cursor: isValid ? "pointer" : "default",
                    opacity: isValid ? 1 : 0.25,
                    transition: "background 0.1s",
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: isToday || isSelected ? 700 : 400,
                      color: isSelected ? "var(--cyan)" : isToday ? "var(--cyan)" : "var(--t2)",
                      marginBottom: 3,
                      ...(isToday
                        ? {
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: "var(--cyan)",
                            color: "#000",
                            fontSize: 10,
                          }
                        : {}),
                    }}
                  >
                    {isValid ? day : ""}
                  </div>

                  {dayTxns.slice(0, 1).map((t) => {
                    const cat = catMap[t.categoryId];
                    return (
                      <div
                        key={t.id}
                        style={{
                          fontSize: 9,
                          color: "var(--bg)",
                          background: cat?.color || "var(--cyan)",
                          borderRadius: 3,
                          padding: "1px 4px",
                          marginBottom: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                          display: "block",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        {t.name || t.merchant}
                      </div>
                    );
                  })}

                  {dayTxns.length > 1 && (
                    <div style={{ fontSize: 8, color: "var(--t3)" }}>
                      +{dayTxns.length - 1} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {acctEntries.length > 0 && (
          <div style={{ ...S.card, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  color: "var(--t3)",
                  fontFamily: "var(--font-disp)",
                }}
              >
                {acctLabel}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--red)",
                }}
              >
                {fmt(acctTotal)}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {acctEntries.slice(0, 3).map((acct) => (
                <button
                  key={acct.id}
                  type="button"
                  onClick={() => setCalendarAcctPopup(acct)}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    appearance: "none",
                    WebkitAppearance: "none",
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--t1)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {acct.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>
                      {acct.count} charges
                    </div>
                  </div>

                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--red)",
                      flexShrink: 0,
                    }}
                  >
                    {fmt(acct.total)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {calendarDay?.day && selectedDayTxns.length > 0 && (
          <div style={{ ...S.card, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>
                {selectedDayDateLabel}
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 3 }}>
                {selectedDayTxns.length} charges · {fmt(selectedDayTotal)}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedDayTxns.map((t) => {
                const acct = acctMap[t.accountId];
                const cat = catMap[t.categoryId];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setEditTarget(t);
                      setModal("editRecurring");
                    }}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "10px 12px",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      appearance: "none",
                      WebkitAppearance: "none",
                      touchAction: "manipulation",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--t1)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.name || t.merchant}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                        {acct?.name || "No account"}
                      </div>
                      <div style={{ fontSize: 11, color: cat?.color || "var(--t3)", marginTop: 2 }}>
                        {cat?.name || "Uncategorized"}
                      </div>
                    </div>

                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 14,
                        fontWeight: 700,
                        color: t.amount < 0 ? "var(--red)" : "var(--green)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.amount < 0 ? "-" : "+"}
                      {fmt(Math.abs(t.amount))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1.2px",
              color: "var(--t3)",
              fontFamily: "var(--font-disp)",
            }}
          >
            All Recurring Transactions
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {recurringTxns.length === 0 ? (
              <div style={{ padding: 20, color: "var(--t3)", textAlign: "center" }}>
                No recurring transactions yet
              </div>
            ) : (
              recurringTxns
                .slice()
                .sort((a, b) => (a.recurringDay || 0) - (b.recurringDay || 0))
                .map((t, idx) => {
                  const cat = catMap[t.categoryId];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setEditTarget(t);
                        setModal("editRecurring");
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "32px 1fr auto",
                        gap: 10,
                        alignItems: "center",
                        padding: "12px 16px",
                        borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        background: "transparent",
                        appearance: "none",
                        WebkitAppearance: "none",
                        touchAction: "manipulation",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: "1px solid var(--border2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "var(--cyan)",
                          background: "var(--surface)",
                        }}
                      >
                        {t.recurringDay || "—"}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--t1)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.name || t.merchant}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                          {t.recurringFreq || "monthly"}
                          {cat ? <span style={{ color: cat.color }}> · {cat.name}</span> : null}
                        </div>
                      </div>

                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 13,
                          fontWeight: 700,
                          color: t.amount < 0 ? "var(--red)" : "var(--green)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.amount < 0 ? "-" : "+"}
                        {fmt(Math.abs(t.amount))}
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </div>
    );

    const DesktopCalendarView = (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--t1)" }}>
              Recurring Calendar
            </div>
            <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>
              {recurringTxns.length} recurring transactions
            </div>
          </div>

          <div style={{ fontSize: 12, color: "var(--t3)" }}>
            {acctLabel}{" "}
            <span style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              {fmt(acctTotal)}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 340px",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN: calendar + recurring list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {/* Calendar card */}
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr 48px",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))",
                }}
              >
                <button
                  onClick={prevCalMonth}
                  style={{
                    ...S.btn("ghost", true),
                    width: 36,
                    height: 36,
                    padding: 0,
                    justifyContent: "center",
                    justifySelf: "start",
                  }}
                >
                  ‹
                </button>

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-disp)",
                      fontSize: 28,
                      fontWeight: 800,
                      color: "var(--t1)",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    {monthLabel(calendarMonth)}
                  </div>
                </div>

                <button
                  onClick={nextCalMonth}
                  style={{
                    ...S.btn("ghost", true),
                    width: 36,
                    height: 36,
                    padding: 0,
                    justifyContent: "center",
                    justifySelf: "end",
                  }}
                >
                  ›
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                {DAYS_OF_WEEK.map((d) => (
                  <div
                    key={d}
                    style={{
                      textAlign: "center",
                      padding: "12px 6px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--t3)",
                      fontFamily: "var(--font-disp)",
                      textTransform: "uppercase",
                      letterSpacing: "1.2px",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                  background: "var(--border)",
                  gap: 1,
                }}
              >
                {Array.from({ length: totalCells }).map((_, i) => {
                  const day = i - firstDow + 1;
                  const isValid = day >= 1 && day <= daysInCal;
                  const isToday =
                    isValid &&
                    calYear === today.getFullYear() &&
                    calMonthN === today.getMonth() + 1 &&
                    day === today.getDate();

                  const dayTxns = isValid ? calendarTxnsByDay[day] || [] : [];
                  const isSelected = calendarDay?.day === day;

                  const dayTotal = dayTxns.reduce(
                    (sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0),
                    0
                  );

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (!isValid) return;
                        setCalendarDay({ day, txns: dayTxns });
                      }}
                      style={{
                        minHeight: 154,
                        background: !isValid
                          ? "rgba(255,255,255,0.015)"
                          : isSelected
                          ? "rgba(59,130,246,0.10)"
                          : "var(--card)",
                        padding: 10,
                        cursor: isValid ? "pointer" : "default",
                        opacity: isValid ? 1 : 0.45,
                        border: isSelected
                          ? "1px solid rgba(96,165,250,0.45)"
                          : "1px solid transparent",
                        overflow: "hidden",
                      }}
                    >
                      {isValid && (
                        <>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: isToday ? "#08111f" : "var(--t1)",
                                background: isToday ? "var(--cyan)" : "transparent",
                                borderRadius: 999,
                                minWidth: isToday ? 26 : "auto",
                                height: isToday ? 26 : "auto",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: isToday ? "0 8px" : 0,
                              }}
                            >
                              {day}
                            </div>

                            {dayTotal > 0 && (
                              <div
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "var(--red)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                -{fmt(dayTotal).replace("$", "")}
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {dayTxns.slice(0, 4).map((t) => {
                              const cat = catMap[t.categoryId];
                              return (
                                <div
                                  key={t.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    minWidth: 0,
                                    fontSize: 11,
                                    lineHeight: 1.2,
                                    color: "var(--t1)",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: 999,
                                      background: cat?.color || "var(--cyan)",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      color: "var(--t1)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {t.name || t.merchant}
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: "auto",
                                      fontFamily: "var(--font-mono)",
                                      color: t.amount < 0 ? "var(--red)" : "var(--green)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {t.amount < 0 ? "-" : "+"}
                                    {fmt(Math.abs(t.amount)).replace("$", "")}
                                  </span>
                                </div>
                              );
                            })}

                            {dayTxns.length > 4 && (
                              <div
                                style={{
                                  marginTop: 2,
                                  fontSize: 11,
                                  color: "var(--t3)",
                                  fontWeight: 600,
                                }}
                              >
                                +{dayTxns.length - 4} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recurring list card now matches calendar width */}
            {recurringTxns.length > 0 && (
              <div style={{ ...S.card, minWidth: 0 }}>
                <div style={S.cardTitle}>All Recurring Transactions</div>

                {[...recurringTxns]
                  .sort((a, b) => {
                    const freqOrder = { weekly: 0, biweekly: 1, monthly: 2, annual: 3 };
                    const fa = freqOrder[a.recurringFreq || "monthly"] ?? 2;
                    const fb = freqOrder[b.recurringFreq || "monthly"] ?? 2;
                    if (fa !== fb) return fa - fb;
                    return (a.recurringDay || 0) - (b.recurringDay || 0);
                  })
                  .map((t) => {
                    const cat = catMap[t.categoryId];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setEditTarget(t);
                          setModal("editRecurring");
                        }}
                        onTouchEnd={isMobile ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditTarget(t);
                          setModal("editRecurring");
                        } : undefined}
                        onKeyDown={isMobile ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setEditTarget(t);
                            setModal("editRecurring");
                          }
                        } : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 8px",
                          margin: "0 -8px 2px",
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          boxShadow: "none",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          cursor: "pointer",
                          borderRadius: 6,
                          transition: "background 0.12s",
                          WebkitTapHighlightColor: "transparent",
                          touchAction: isMobile ? "manipulation" : undefined,
                          width: "calc(100% + 16px)",
                          textAlign: "left",
                          appearance: "none",
                          WebkitAppearance: "none",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: "var(--surface)",
                              border: "1px solid var(--border2)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--cyan)",
                              flexShrink: 0,
                            }}
                          >
                            {t.recurringDay || "?"}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "var(--t1)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t.name || t.merchant}
                            </div>

                            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                              {t.recurringFreq === "weekly"
                                ? "Weekly"
                                : t.recurringFreq === "biweekly"
                                ? "Bi-weekly"
                                : t.recurringFreq === "annual"
                                ? "Annual"
                                : `Day ${t.recurringDay || "?"} of month`}
                              {t.recurringStart && <span style={{ marginLeft: 6 }}>· from {t.recurringStart}</span>}
                              {cat && (
                                <>
                                  {" "}· <span style={{ color: cat.color }}>{cat.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: 10 }}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 14,
                              fontWeight: 700,
                              color: t.amount < 0 ? "var(--red)" : "var(--green)",
                            }}
                          >
                            {t.amount < 0 ? "−" : "+"}
                            {fmt(Math.abs(t.amount))}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--t3)" }}>⋯</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1.2px",
                      color: "var(--t3)",
                      fontFamily: "var(--font-disp)",
                      marginBottom: 6,
                    }}
                  >
                    {acctLabel}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 24,
                      fontWeight: 800,
                      color: "var(--red)",
                    }}
                  >
                    {fmt(acctTotal)}
                  </div>
                </div>

                <button onClick={openAddTxn} style={S.btn("ghost", true)}>
                  Add
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {acctEntries.slice(0, 4).map((acct) => (
                  <div
                    key={acct.id}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "12px 12px",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--t1)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {acct.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                        {acct.count} charge{acct.count !== 1 ? "s" : ""}
                      </div>
                    </div>

                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 18,
                        fontWeight: 800,
                        color: "var(--red)",
                        alignSelf: "center",
                      }}
                    >
                      {fmt(acct.total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 16,
                minHeight: 420,
              }}
            >
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "var(--t1)",
                    letterSpacing: "-0.4px",
                  }}
                >
                  {calendarDay?.day ? selectedDayDateLabel : "No day selected"}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: "var(--t3)",
                    marginTop: 4,
                  }}
                >
                  {calendarDay?.day
                    ? `${selectedDayTxns.length} recurring item${selectedDayTxns.length !== 1 ? "s" : ""} · ${fmt(selectedDayTotal)}`
                    : "Click a calendar day to see details"}
                </div>
              </div>

              {calendarDay?.day && selectedDayTxns.length > 0 ? (
                <>
                  <div style={{ marginBottom: 16 }}>
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
                      Category Breakdown
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selectedCatBreakdown.map((cat) => {
                        const pct =
                          selectedDayTotal > 0 ? Math.round((cat.total / selectedDayTotal) * 100) : 0;

                        return (
                          <div
                            key={cat.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto auto",
                              gap: 10,
                              alignItems: "center",
                              fontSize: 13,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: 999,
                                  background: cat.color,
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  color: "var(--t2)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {cat.name}
                              </span>
                            </div>

                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--t1)",
                                fontWeight: 700,
                              }}
                            >
                              {fmt(cat.total)}
                            </span>

                            <span style={{ color: "var(--t3)", fontSize: 12 }}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
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
                      Transactions
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedDayTxns.map((t) => {
                        const acct = acctMap[t.accountId];
                        const cat = catMap[t.categoryId];

                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setEditTarget(t);
                              setModal("editRecurring");
                            }}
                            onTouchEnd={isMobile ? (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditTarget(t);
                              setModal("editRecurring");
                            } : undefined}
                            style={{
                              background: "rgba(255,255,255,0.02)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius)",
                              padding: "12px 12px",
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 8,
                              alignItems: "start",
                              cursor: "pointer",
                              transition: "background 0.12s",
                              appearance: "none",
                              WebkitAppearance: "none",
                              width: "100%",
                              textAlign: "left",
                              touchAction: isMobile ? "manipulation" : undefined,
                              WebkitTapHighlightColor: "transparent",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--surface)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  color: "var(--t1)",
                                  marginBottom: 4,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {t.name || t.merchant}
                              </div>

                              <div style={{ fontSize: 12, color: "var(--t3)" }}>
                                {acct?.name || "No account"}
                              </div>

                              <div
                                style={{
                                  fontSize: 12,
                                  color: cat?.color || "var(--t3)",
                                  marginTop: 2,
                                }}
                              >
                                {cat?.name || "Uncategorized"}
                              </div>
                            </div>

                            <div
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 20,
                                fontWeight: 800,
                                color: t.amount < 0 ? "var(--red)" : "var(--green)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {t.amount < 0 ? "-" : "+"}
                              {fmt(Math.abs(t.amount))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    border: "1px dashed var(--border2)",
                    borderRadius: "var(--radius)",
                    padding: 24,
                    color: "var(--t3)",
                    textAlign: "center",
                    fontSize: 13,
                  }}
                >
                  Choose a day on the calendar to show its recurring charges.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <>
        {isMobile ? MobileCalendarView : DesktopCalendarView}

        {/* Account charges popup (mobile + desktop) */}
        {calendarAcctPopup&&(
          <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setCalendarAcctPopup(null)}>
            <div style={{...S.modal,width:480}} className="ledgr-modal-anim">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <div style={S.modalTitle}>{calendarAcctPopup.name}</div>
                  <div style={{fontSize:12,color:"var(--t3)",marginTop:-14}}>{calendarAcctPopup.count} charge{calendarAcctPopup.count!==1?"s":""} · {fmt(calendarAcctPopup.total)} total</div>
                </div>
                <button onClick={()=>setCalendarAcctPopup(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:20,padding:"4px 8px"}}>✕</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[...calendarAcctPopup.txns].sort((a,b)=>(a.recurringDay||0)-(b.recurringDay||0)).map(t=>{
                  const cat=catMap[t.categoryId];
                  const freq=t.recurringFreq||"monthly";
                  const freqLabel=freq==="biweekly"?"Bi-weekly":freq==="weekly"?"Weekly":freq==="annual"?"Annual":`Day ${t.recurringDay||"?"} of month`;
                  return (
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",borderLeft:`2px solid ${cat?.color||"var(--cyan)"}`}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                        <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>{freqLabel}{cat&&<span style={{color:cat.color}}> · {cat.name}</span>}</div>
                      </div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:700,color:"var(--red)",flexShrink:0}}>{fmt(Math.abs(t.amount))}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:20,display:"flex",justifyContent:"flex-end"}}>
                <button style={S.btn("ghost")} onClick={()=>setCalendarAcctPopup(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  })();
  /* ─────────────────────────────────────────────────────────────────
     MODALS
  ───────────────────────────────────────────────────────────────── */
  const EditRecurringModal = editTarget && modal==="editRecurring" ? (
    <Modal title="Edit Recurring Transaction" onClose={()=>{setModal(null);setEditTarget(null);}}
      actions={<>
        <button style={{...S.btn("ghost"),color:"var(--t3)"}} onClick={()=>{
          toggleRecurring(editTarget.id);
          setModal(null);setEditTarget(null);showToast("Removed from recurring");
        }}>Remove Recurring</button>
        <button style={S.btn("ghost")} onClick={()=>{setModal(null);setEditTarget(null);}}>Cancel</button>
        <button style={S.btn("primary")} onClick={()=>{
          setTransactions(p=>p.map(t=>t.id===editTarget.id?{
            ...t,
            name:           editTarget.name,
            recurringDay:   editTarget.recurringDay,
            recurringFreq:  editTarget.recurringFreq||"monthly",
            recurringStart: editTarget.recurringStart||null,
            categoryId:     editTarget.categoryId||null,
          }:t));
          setModal(null);setEditTarget(null);showToast("Updated");
        }}>Save</button>
      </>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{padding:"10px 14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:12,color:"var(--t3)"}}>
          Original: <span style={{color:"var(--t1)",fontWeight:500}}>{editTarget.merchant}</span>
        </div>
        <div style={S.field}>
          <label style={S.label}>Display Name</label>
          <input style={S.input} placeholder={editTarget.merchant} value={editTarget.name||""} onChange={e=>setEditTarget(p=>({...p,name:e.target.value}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Frequency</label>
          <select style={{...S.input,padding:"9px 12px"}} value={editTarget.recurringFreq||"monthly"} onChange={e=>setEditTarget(p=>({...p,recurringFreq:e.target.value}))}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
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
          <select style={{...S.input,padding:"9px 12px"}} value={editTarget.categoryId||""} onChange={e=>setEditTarget(p=>({...p,categoryId:e.target.value||null}))}>
            <option value="">— None —</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  ) : null;

  const RuleModal = (
    <Modal title={modal==="addRule"?"New Rule":"Edit Rule"} onClose={()=>setModal(null)}
      actions={<>
        <button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button>
        <button style={S.btn("primary")} onClick={()=>{
          if(!ruleForm.pattern.trim()||(!ruleForm.categoryId&&!ruleForm.typeOverride)) return;
          saveRule({id:modal==="editRule"?editTarget.id:"r"+Date.now(),...ruleForm,pattern:ruleForm.pattern.trim(),createdAt:modal==="editRule"?editTarget.createdAt:Date.now()});
          setModal(null);
        }}>Save</button>
      </>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={S.field}>
          <label style={S.label}>Merchant Pattern</label>
          <input style={S.input} placeholder='e.g. "Netflix"' value={ruleForm.pattern} onChange={e=>setRuleForm(p=>({...p,pattern:e.target.value}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Match Type</label>
          <select style={{...S.input,padding:"9px 12px"}} value={ruleForm.matchType} onChange={e=>setRuleForm(p=>({...p,matchType:e.target.value}))}>
            <option value="contains">Contains</option>
            <option value="starts">Starts with</option>
            <option value="exact">Exact match</option>
          </select>
        </div>
        {ruleForm.typeOverride || (editTarget?.typeOverride && !editTarget?.categoryId) ? (
          <div style={S.field}>
            <label style={S.label}>Assign Type</label>
            <select style={{...S.input,padding:"9px 12px"}} value={ruleForm.typeOverride} onChange={e=>setRuleForm(p=>({...p,typeOverride:e.target.value,categoryId:""}))}>
              <option value="">— Select —</option>
              <option value="transfer">Transfer</option>
              <option value="income">Income</option>
              <option value="reimbursement">Reimbursement</option>
            </select>
          </div>
        ) : (
          <div style={S.field}>
            <label style={S.label}>Assign Category</label>
            <select style={{...S.input,padding:"9px 12px"}} value={ruleForm.categoryId} onChange={e=>setRuleForm(p=>({...p,categoryId:e.target.value,typeOverride:""}))}>
              <option value="">— Select —</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );

  const CatModal = (
    <Modal title={modal==="addCat"?"New Category":"Edit Category"} onClose={()=>setModal(null)}
      actions={<><button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button><button style={S.btn("primary")} onClick={saveCat}>Save</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
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

  const AcctModal = (
    <Modal title={modal==="addAcct"?"Add Account":"Edit Account"} onClose={()=>setModal(null)}
      actions={<><button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button><button style={S.btn("primary")} onClick={saveAcct}>Save</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={S.field}><label style={S.label}>Name</label><input style={S.input} placeholder="Chase Checking" value={acctForm.name} onChange={e=>setAcctForm(p=>({...p,name:e.target.value}))}/></div>
        <div style={S.field}><label style={S.label}>Type</label>
          <select style={{...S.input,padding:"9px 12px"}} value={acctForm.type} onChange={e=>setAcctForm(p=>({...p,type:e.target.value}))}>
            {["Checking","Savings","Credit","Investment"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div style={S.field}><label style={S.label}>Balance ($)</label><input style={S.input} type="number" placeholder="0.00" value={acctForm.balance} onChange={e=>setAcctForm(p=>({...p,balance:e.target.value}))}/></div>
      </div>
    </Modal>
  );

  const TxnModal = (
    <Modal title="Add Transaction" onClose={()=>setModal(null)}
      actions={<><button style={S.btn("ghost")} onClick={()=>setModal(null)}>Cancel</button><button style={S.btn("primary")} onClick={saveManualTxn}>Save</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={S.field}><label style={S.label}>Description</label><input style={S.input} placeholder="Amazon" value={txnForm.merchant} onChange={e=>setTxnForm(p=>({...p,merchant:e.target.value}))}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div style={S.field}><label style={S.label}>Type</label>
            <select style={{...S.input,padding:"9px 12px"}} value={txnForm.sign} onChange={e=>setTxnForm(p=>({...p,sign:e.target.value}))}>
              <option value="-1">Expense (−)</option><option value="1">Income (+)</option>
            </select>
          </div>
          <div style={S.field}><label style={S.label}>Amount ($)</label><input style={S.input} type="number" placeholder="0.00" value={txnForm.amount} onChange={e=>setTxnForm(p=>({...p,amount:e.target.value}))}/></div>
        </div>
        <div style={S.field}><label style={S.label}>Date</label><input style={S.input} type="date" value={txnForm.date} onChange={e=>setTxnForm(p=>({...p,date:e.target.value}))}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div style={S.field}><label style={S.label}>Category</label>
            <select style={{...S.input,padding:"9px 12px"}} value={txnForm.categoryId} onChange={e=>setTxnForm(p=>({...p,categoryId:e.target.value}))}>
              <option value="">None</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={S.field}><label style={S.label}>Account</label>
            <select style={{...S.input,padding:"9px 12px"}} value={txnForm.accountId} onChange={e=>setTxnForm(p=>({...p,accountId:e.target.value}))}>
              <option value="">None</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );

  /* ─────────────────────────────────────────────────────────────────
     NAV + RENDER
  ───────────────────────────────────────────────────────────────── */

  /* ── Shared sidebar ── */
  const currentUser  = api.getStoredUser();
  const PREMIUM_PRICE_ID = import.meta.env.VITE_PREMIUM_PRICE_ID || "";
  const isPremium = currentUser?.role === "owner" ||
    (currentUser?.isPremium === true) ||
    (PREMIUM_PRICE_ID && currentUser?.stripe_price_id === PREMIUM_PRICE_ID);
  const _avatarColors = ["#00d4ff","#00e676","#a78bfa","#f97316","#ec4899","#fbbf24","#14b8a6"];
  const avatarColor  = _avatarColors[(currentUser?.email || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % _avatarColors.length];
  const avatarLetter = (currentUser?.name || currentUser?.email || "?")[0].toUpperCase();

  const SettingsPage = (
    <SettingsView
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
    />
  );

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

  const AnalyticsPage = (
    <Analytics
      transactions={transactions}
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
    />
  );

  const VIEWS = access === "full"
    ? { dashboard:Dashboard, transactions:Transactions, budgets:Budgets, accounts:Accounts, portfolio:PortfolioPage, rules:Rules, calendar:Calendar, ai:AiChatPage, analytics:AnalyticsPage, settings:SettingsPage, admin:AdminPage }
    : { dashboard:Dashboard, transactions:paywallView, budgets:paywallView, accounts:paywallView, portfolio:paywallView, rules:paywallView, calendar:paywallView, ai:AiChatPage, analytics:AnalyticsPage, settings:SettingsPage, admin:AdminPage };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"var(--bg)",flexDirection:"column",gap:16}}>
      <div style={{fontFamily:"var(--font-script)",fontSize:52,fontWeight:700,color:"var(--cyan)",lineHeight:1}} className="ledgr-logo-bounce">ℓ</div>
      <div style={{fontFamily:"var(--font-disp)",fontSize:20,fontWeight:700,color:"var(--t1)",letterSpacing:"-0.5px"}}>ledgr<span style={{color:"var(--cyan)"}}>.</span></div>
      <div style={{fontSize:12,color:"var(--t3)",marginTop:4}} className="ledgr-loading-text">Loading your data…</div>
    </div>
  );

  const _trialUser = api.getStoredUser();
  const trialDaysLeft = (_trialUser && _trialUser.role !== "owner" && _trialUser.role !== "free" && _trialUser.subscription_status === "trialing")
    ? Math.max(0, Math.ceil((_trialUser.trial_ends_at - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div style={S.shell}>
    <InstallPrompt />
    {/* Trial countdown banner */}
    {trialDaysLeft !== null && (
      <div style={{
        flexShrink:0, background: trialDaysLeft <= 1 ? "var(--red-dim)" : "#fbbf2415",
        borderBottom:`1px solid ${trialDaysLeft <= 1 ? "#ff4d6d44" : "#fbbf2433"}`,
        padding:"8px 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", gap:12,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color: trialDaysLeft <= 1 ? "var(--red)" : "var(--amber)"}}>
          <span style={{fontSize:14}}>{trialDaysLeft <= 1 ? "⚠️" : "⏳"}</span>
          <span style={{fontWeight:600}}>
            {trialDaysLeft === 0
              ? "Your trial expires today"
              : trialDaysLeft === 1
              ? "Your trial expires tomorrow"
              : `${trialDaysLeft} days left in your free trial`}
          </span>
        </div>
        <button
          onClick={async () => { try { await api.startCheckout(); } catch {} }}
          style={{
            background: trialDaysLeft <= 1 ? "var(--red)" : "var(--amber)",
            color:"#000", border:"none", borderRadius:"var(--radius)",
            padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer",
            flexShrink:0, whiteSpace:"nowrap",
          }}>
          Subscribe — $4.99/mo
        </button>
      </div>
    )}
    {isMobile ? (
      /* ════════════════════════════════════
         MOBILE — hamburger + overlay drawer
         ════════════════════════════════════ */
      <>
        {/* Mobile top bar */}
        <div style={{height:52,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",background:"var(--surface)",borderBottom:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>setDrawerOpen(p=>!p)}
              style={{background:"none",border:"none",cursor:"pointer",padding:"6px 4px",color:"var(--t2)",display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
              <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:1}}/>
              <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:1}}/>
              <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:1}}/>
            </button>
            <span style={{fontFamily:"var(--font-script)",fontSize:28,fontWeight:700,color:"var(--cyan)",lineHeight:1,marginTop:2}} className="ledgr-logo-pulse">ℓ</span>
            <div style={{fontFamily:"var(--font-disp)",fontSize:17,fontWeight:700,letterSpacing:"-0.5px",color:"var(--t1)",lineHeight:1}}>
              ledgr<span style={{color:"var(--cyan)"}}>.</span>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {syncing&&<span style={{fontSize:12,color:"var(--cyan)"}}>⟳</span>}
            <div style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--t3)"}}>{daysLeft()}d left</div>
          </div>
        </div>

        {/* Mobile body */}
        <div style={{flex:1,position:"relative",overflow:"visible"}}>
          {/* Backdrop */}
          {drawerOpen&&(
            <div onClick={()=>setDrawerOpen(false)}
              style={{position:"fixed",inset:0,background:"#00000055",zIndex:40}}/>
          )}
          {/* Overlay drawer */}
          <div style={{
            position:"fixed",top:0,left:0,bottom:0,width:240,
            background:"var(--surface)",borderRight:"1px solid var(--border)",
            display:"flex",flexDirection:"column",
            transform:drawerOpen?"translateX(0)":"translateX(-100%)",
            transition:"transform 0.22s cubic-bezier(.4,0,.2,1)",
            zIndex:50,boxShadow:drawerOpen?"6px 0 24px #00000044":"none",
          }}>
            <SidebarContent onNav={id=>{ setView(id); setDrawerOpen(false); contentRef.current?.scrollTo({ top: 0 }); }} view={view} syncing={syncing} doSync={doSync} showToast={showToast} avatarColor={avatarColor} avatarLetter={avatarLetter} />
          </div>
          {/* Content */}
          <div ref={contentRef} style={{position:"absolute",inset:0,overflowY:"auto"}} className="ledgr-content">
            <div key={view} className="ledgr-view-enter">{VIEWS[view]}</div>
          </div>
        </div>
      </>
    ) : (
      /* ════════════════════════════════════
         DESKTOP — persistent sidebar
         ════════════════════════════════════ */
      <>
        {/* Desktop top bar */}
        <div style={{height:56,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",background:"var(--surface)",borderBottom:"1px solid var(--border)"}}>
          <div style={{fontFamily:"var(--font-disp)",fontSize:15,fontWeight:700,color:"var(--t3)",letterSpacing:"-0.2px"}}>
            {NAV.find(n=>n.id===view)?.label}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {syncing&&<span style={{fontSize:12,color:"var(--cyan)"}}>⟳ Syncing…</span>}
            <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--t3)"}}>
              {today.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} · {daysLeft()}d left
            </div>
          </div>
        </div>

        {/* Desktop body */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>
          {/* Persistent sidebar */}
          <aside style={{width:220,flexShrink:0,background:"var(--surface)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column"}}>
            <SidebarContent onNav={id=>{ setView(id); contentRef.current?.scrollTo({ top: 0 }); }} view={view} syncing={syncing} doSync={doSync} showToast={showToast} avatarColor={avatarColor} avatarLetter={avatarLetter} />
          </aside>
          {/* Content */}
          <div ref={contentRef} style={{flex:1,overflowY:"auto"}} className="ledgr-content">
            <div key={view} className="ledgr-view-enter">{VIEWS[view]}</div>
          </div>
        </div>
      </>
    )}

      {/* ── Modals ── */}
      {(modal==="addCat"||modal==="editCat")   && CatModal}
      {(modal==="addAcct"||modal==="editAcct") && AcctModal}
      {modal==="addTxn"                        && TxnModal}
      {(modal==="addRule"||modal==="editRule") && RuleModal}
      {EditRecurringModal}

      {rulePrompt&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:200,background:"var(--card)",border:"1px solid var(--cyan)44",borderRadius:12,padding:"14px 20px",boxShadow:"0 8px 32px #00000080",display:"flex",alignItems:"center",gap:14,maxWidth:420,width:"90vw"}}>
          <div style={{flex:1,fontSize:13}}>
            <div style={{fontWeight:600,color:"var(--t1)",marginBottom:2}}>Save as a rule?</div>
            <div style={{fontSize:12,color:"var(--t2)"}}>&quot;{rulePrompt.merchant}&quot; → <strong>{catMap[rulePrompt.categoryId]?.name}</strong></div>
          </div>
          <button style={S.btn("primary",true)} onClick={confirmSaveRule}>Save Rule</button>
          <button style={S.btn("ghost",true)} onClick={()=>setRulePrompt(null)}>✕</button>
        </div>
      )}

      {typeRulePrompt&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:200,background:"var(--card)",border:"1px solid var(--amber)44",borderRadius:12,padding:"14px 20px",boxShadow:"0 8px 32px #00000080",display:"flex",alignItems:"center",gap:14,maxWidth:440,width:"90vw"}}>
          <div style={{flex:1,fontSize:13}}>
            <div style={{fontWeight:600,color:"var(--t1)",marginBottom:2}}>Create a type rule?</div>
            <div style={{fontSize:12,color:"var(--t2)"}}>Always mark &quot;{typeRulePrompt.merchant}&quot; as <strong style={{textTransform:"capitalize"}}>{typeRulePrompt.type}</strong></div>
          </div>
          <button style={{...S.btn("primary",true),background:"var(--amber)",borderColor:"var(--amber)"}} onClick={confirmTypeRule}>Save Rule</button>
          <button style={S.btn("ghost",true)} onClick={()=>setTypeRulePrompt(null)}>✕</button>
        </div>
      )}

      {selectedTxns.size > 0 && (
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:210,
          background:"var(--card)",border:"1px solid var(--border2)",borderRadius:12,
          padding:"12px 18px",boxShadow:"0 8px 32px #00000090",
          display:"flex",alignItems:"center",gap:10,maxWidth:640,width:"92vw",flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:700,color:"var(--cyan)",marginRight:4,flexShrink:0}}>
            {selectedTxns.size} selected
          </span>
          {/* Category */}
          <select style={{...S.select,padding:"6px 8px",fontSize:12,flex:1,minWidth:130}}
            defaultValue=""
            onChange={e=>{ if(e.target.value) bulkSetCategory(e.target.value); e.target.value=""; }}>
            <option value="" disabled>Set category…</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__clear__">Clear category</option>
          </select>
          {/* Type */}
          <select style={{...S.select,padding:"6px 8px",fontSize:12,flex:1,minWidth:120}}
            defaultValue=""
            onChange={e=>{ if(e.target.value) bulkSetType(e.target.value); e.target.value=""; }}>
            <option value="" disabled>Set type…</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
            <option value="reimbursement">Reimbursement</option>
            <option value="refund">Refund</option>
          </select>
          <button style={{...S.btn("ghost",true),fontSize:12}} onClick={()=>bulkMarkReviewed(true)}>✓ Reviewed</button>
          <button style={{...S.btn("danger",true),fontSize:12}} onClick={bulkDelete}>Delete</button>
          <button style={{...S.btn("ghost",true),fontSize:12,marginLeft:"auto"}} onClick={clearSelection}>✕</button>
        </div>
      )}

      {newTxnCount>0&&(
        <div style={{
          position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
          zIndex:300,background:"var(--cyan)",color:"#000",
          borderRadius:12,padding:"12px 20px",
          boxShadow:"0 8px 32px #00000080",
          display:"flex",alignItems:"center",gap:14,
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

      {undoAction&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:500,
          background:"var(--card)",border:"1px solid var(--border2)",borderRadius:12,
          padding:"12px 16px",boxShadow:"0 8px 32px #00000080",
          display:"flex",alignItems:"center",gap:14,maxWidth:380,width:"90vw"}}>
          <span style={{fontSize:13,color:"var(--t1)",flex:1}}>{undoAction.label}</span>
          <button onClick={()=>{ undoAction.fn(); setUndoAction(null); clearTimeout(undoTimer.current); }}
            style={{...S.btn("primary",true),flexShrink:0}}>
            Undo
          </button>
          <button onClick={()=>setUndoAction(null)}
            style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:16,padding:"2px 4px"}}>✕</button>
        </div>
      )}

      <Toast msg={toast}/>
    </div>
  );
}
