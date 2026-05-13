/**
 * LedgrAccounts.jsx
 * Full-screen accounts page matching the Briefing design system.
 * Place in: src/components/LedgrAccounts.jsx
 *
 * Props from AppInner:
 *   accounts, plaidItems, staleItemIds, spentByAcct, monthTxns
 *   openAddAcct, openEditAcct, deleteAcct, disconnectItem, doSync, syncing
 *   reconnectingItemId, setReconnectingItemId, handlePlaidSuccess
 *   PlaidButton, fmt, today, isMobile, navigate
 */

import { useMemo } from "react";

const SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600&family=Geist:wght@300;400;500;600&display=swap');
  .lb-root {
    --bg-0:#07090d;--bg-1:#0b0e14;--bg-2:#11151d;--bg-3:#161c26;--bg-4:#1c2330;
    --line:rgba(255,255,255,0.06);--line-2:rgba(255,255,255,0.10);--line-3:rgba(255,255,255,0.18);
    --ink-0:#f4f4f1;--ink-1:#c8cdd6;--ink-2:#7d8594;--ink-3:#4a5161;--ink-4:#2e3340;
    --safe:#5dcaa5;--safe-bg:rgba(93,202,165,0.08);
    --warn:#f0b04c;--warn-bg:rgba(240,176,76,0.08);
    --debt:#e87363;--debt-bg:rgba(232,115,99,0.08);
    --calm:#6c8cff;--calm-bg:rgba(108,140,255,0.08);
    --font-display:'Instrument Serif',Georgia,serif;
    --font-ui:'Geist',-apple-system,sans-serif;
    --font-mono:'JetBrains Mono',ui-monospace,monospace;
    --r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;
    font-family:var(--font-ui);background:var(--bg-0);color:var(--ink-0);
    -webkit-font-smoothing:antialiased;min-height:100vh;
  }
  .lb-shell { display:flex;min-height:100vh; }
  .lb-sidenav { width:64px;border-right:1px solid var(--line);background:var(--bg-1);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0; }
  .lb-logo { width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),#0f6e56 80%);margin-bottom:24px;flex-shrink:0; }
  .lb-nav-item { width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:17px;cursor:pointer;transition:background .15s,color .15s;user-select:none; }
  .lb-nav-item:hover { color:var(--ink-1);background:var(--bg-2); }
  .lb-nav-item.active { color:var(--safe);background:var(--safe-bg); }
  .lb-nav-spacer { flex:1; }
  .la-main { flex:1;overflow-y:auto;min-width:0; }
  .la-topbar { height:60px;padding:0 52px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg-0);z-index:10; }
  .la-topbar-left { display:flex;align-items:baseline;gap:16px; }
  .la-label { font-family:var(--font-mono);font-size:11px;color:var(--ink-3); }
  .la-title { font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px; }
  .la-div { width:1px;height:14px;background:var(--line-2); }
  .la-sub { font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase; }
  .la-topbar-right { display:flex;align-items:center;gap:10px; }
  .la-btn { background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 14px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:all .15s;white-space:nowrap; }
  .la-btn:hover { border-color:var(--line-3);color:var(--ink-0); }
  .la-btn.primary { background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe); }
  .la-btn.danger { background:var(--debt-bg);border-color:rgba(232,115,99,0.3);color:var(--debt); }
  .la-btn.warn { background:var(--warn-bg);border-color:rgba(240,176,76,0.3);color:var(--warn); }
  .la-content { padding:40px 52px; }
  .la-hero { margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid var(--line); }
  .la-hero-eyebrow { font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px; }
  .la-hero-number { font-family:var(--font-display);font-size:72px;line-height:0.9;letter-spacing:-2px;color:var(--ink-0);margin-bottom:12px; }
  .la-hero-number .currency { font-size:36px;vertical-align:top;margin-top:12px;color:var(--ink-2);margin-right:2px; }
  .la-hero-sub { font-size:14px;color:var(--ink-2);line-height:1.6; }
  .la-hero-sub .safe { color:var(--safe);font-family:var(--font-mono); }
  .la-hero-sub .debt { color:var(--debt);font-family:var(--font-mono); }
  .la-action-bar { display:flex;gap:8px;margin-bottom:32px;flex-wrap:wrap; }
  .la-groups { display:flex;flex-direction:column;gap:16px; }
  .la-group { border:1px solid var(--line);border-radius:var(--r-xl);overflow:hidden; }
  .la-group-seam { height:2px; }
  .la-group-header { display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:rgba(255,255,255,0.02);border-bottom:1px solid var(--line); }
  .la-group-name { display:flex;align-items:center;gap:10px; }
  .la-group-institution { font-size:14px;font-weight:600;color:var(--ink-0); }
  .la-group-count { font-family:var(--font-mono);font-size:10px;color:var(--ink-3); }
  .la-group-right { display:flex;align-items:center;gap:10px; }
  .la-group-total { font-family:var(--font-mono);font-size:16px;font-weight:500;color:var(--ink-1); }
  .la-stale-bar { padding:10px 20px;background:rgba(232,115,99,0.05);border-bottom:1px solid rgba(232,115,99,0.1);font-size:12px;color:var(--ink-3);line-height:1.5; }
  .la-accounts-grid { display:grid; }
  .la-account-card { padding:20px 24px;border-bottom:1px solid var(--line); }
  .la-account-card:last-child { border-bottom:none; }
  .la-account-header { display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;gap:8px; }
  .la-account-name { font-size:13px;color:var(--ink-2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .la-account-actions { display:flex;gap:6px;flex-shrink:0; }
  .la-balance { font-family:var(--font-display);font-size:40px;line-height:1;letter-spacing:-1px;color:var(--ink-0);margin-bottom:6px; }
  .la-balance.negative { color:var(--debt); }
  .la-account-type { font-family:var(--font-mono);font-size:10px;color:var(--ink-3);margin-bottom:12px;letter-spacing:0.5px; }
  .la-pills { display:flex;gap:6px;flex-wrap:wrap; }
  .la-pill { display:inline-flex;align-items:center;font-size:10px;padding:3px 10px;border-radius:99px;font-family:var(--font-mono);white-space:nowrap; }
  .la-empty { padding:80px 40px;text-align:center;color:var(--ink-3); }
  .la-empty-icon { font-size:32px;margin-bottom:12px; }
  .la-empty-title { font-family:var(--font-display);font-size:28px;color:var(--ink-2);margin-bottom:6px; }
  @media(max-width:700px){
    .lb-sidenav{display:none;}
    .la-topbar,.la-content{padding-left:16px;padding-right:16px;}
    .la-hero-number{font-size:48px;letter-spacing:-1px;}
    .la-balance{font-size:28px;}
    .la-accounts-grid{grid-template-columns:1fr!important;}
  }
`;

const NAV_ITEMS = [
  { icon: "◐", id: "dashboard" },
  { icon: "⇅", id: "transactions" },
  { icon: "▣",  id: "accounts", active: true },
  { icon: "▦",  id: "calendar" },
  { icon: "◆",  id: "goals" },
];

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

export default function LedgrAccounts({
  accounts = [],
  plaidItems = [],
  staleItemIds = new Set(),
  spentByAcct = {},
  monthTxns = [],
  openAddAcct,
  openEditAcct,
  deleteAcct,
  disconnectItem,
  doSync,
  syncing = false,
  reconnectingItemId = null,
  setReconnectingItemId,
  handlePlaidSuccess,
  PlaidButton,
  fmt = n => `$${Math.abs(n).toFixed(2)}`,
  today = new Date(),
  isMobile = false,
  navigate = () => {},
}) {
  const totalBalance   = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const totalSpentAcct = accounts.reduce((s, a) => s + (spentByAcct[a.id] || 0), 0);
  const totalIncome    = monthTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const groups = useMemo(() => {
    const g = {};
    accounts.forEach(acct => {
      const key = acct.plaidItemId || "__manual__";
      if (!g[key]) {
        const item = plaidItems.find(i => i.item_id === acct.plaidItemId);
        g[key] = { label: item?.institution || acct.institution || "Manual", accts: [] };
      }
      g[key].accts.push(acct);
    });
    return Object.entries(g).sort(([ka], [kb]) => {
      if (ka === "__manual__") return 1;
      if (kb === "__manual__") return -1;
      return g[ka].label.localeCompare(g[kb].label);
    });
  }, [accounts, plaidItems]);

  const todayLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <style>{SHARED_CSS}</style>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse at 85% 100%,rgba(93,202,165,0.025),transparent 50%)" }} />

      <div className="lb-root" style={{ position: "relative", zIndex: 1 }}>
        <div className="lb-shell">
          {/* Sidenav */}
          <nav className="lb-sidenav">
            <div className="lb-logo" />
            {NAV_ITEMS.map(n => (
              <div key={n.id} className={`lb-nav-item${n.active ? " active" : ""}`} onClick={() => navigate(n.id)} title={n.id}>{n.icon}</div>
            ))}
            <div className="lb-nav-spacer" />
            <div className="lb-nav-item" onClick={() => navigate("settings")}>⚙</div>
          </nav>

          <main className="la-main">
            {/* Topbar */}
            <div className="la-topbar">
              <div className="la-topbar-left">
                <span className="la-label">iii ·</span>
                <span className="la-title">Accounts</span>
                <span className="la-div" />
                <span className="la-sub">{todayLabel}</span>
              </div>
              <div className="la-topbar-right">
                {PlaidButton && <PlaidButton onSuccess={handlePlaidSuccess} onExit={() => {}} label="Link Bank" style={{}} />}
                <button className="la-btn" onClick={openAddAcct}>+ Manual</button>
              </div>
            </div>

            <div className="la-content">
              {/* Hero */}
              <div className="la-hero">
                <div className="la-hero-eyebrow">Total balance across all accounts</div>
                <div className="la-hero-number">
                  <span className="currency">$</span>
                  {Math.abs(totalBalance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="la-hero-sub">
                  {accounts.length} account{accounts.length !== 1 ? "s" : ""} ·{" "}
                  <span className="debt">−{fmt(totalSpentAcct)}</span> spent ·{" "}
                  <span className="safe">+{fmt(totalIncome)}</span> income this month
                </div>
              </div>

              {/* Accounts */}
              {accounts.length === 0 ? (
                <div className="la-empty">
                  <div className="la-empty-icon">▣</div>
                  <div className="la-empty-title">No accounts yet</div>
                  <div>Link a bank or add a manual account to get started</div>
                </div>
              ) : (
                <div className="la-groups">
                  {groups.map(([key, { label: institution, accts }]) => {
                    const groupTotal = accts.reduce((s, a) => s + (a.balance || 0), 0);
                    const plaidItem  = plaidItems.find(i => i.item_id === key);
                    const isStale    = plaidItem && staleItemIds.has(plaidItem.item_id);
                    const isManual   = key === "__manual__";
                    const seamColor  = isManual
                      ? "linear-gradient(90deg,rgba(255,255,255,0.1),transparent)"
                      : isStale
                        ? "linear-gradient(90deg,rgba(232,115,99,0.5),transparent)"
                        : "linear-gradient(90deg,rgba(93,202,165,0.5),transparent)";

                    return (
                      <div key={key} className="la-group">
                        <div className="la-group-seam" style={{ background: seamColor }} />

                        <div className="la-group-header">
                          <div className="la-group-name">
                            {isStale && <span style={{ color: "var(--warn)", fontSize: 14 }}>⚠</span>}
                            <span className="la-group-institution" style={{ color: isStale ? "var(--warn)" : "var(--ink-0)" }}>
                              {institution}
                            </span>
                            <span className="la-group-count">{accts.length} account{accts.length !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="la-group-right">
                            <span className="la-group-total">{fmt(groupTotal)}</span>
                            {!isManual && plaidItem && (
                              isStale ? (
                                <>
                                  {PlaidButton && (
                                    <PlaidButton
                                      itemId={plaidItem.item_id}
                                      onSuccess={async (publicToken, inst) => {
                                        await handlePlaidSuccess(publicToken, inst || institution);
                                        setReconnectingItemId && setReconnectingItemId(null);
                                      }}
                                      onExit={() => setReconnectingItemId && setReconnectingItemId(null)}
                                      label={reconnectingItemId === plaidItem.item_id ? "Opening…" : "Reconnect"}
                                      style={{ fontSize: 11, padding: "4px 10px" }}
                                    />
                                  )}
                                  <button className="la-btn danger" style={{ fontSize: 11 }} onClick={() => disconnectItem(plaidItem.item_id)}>Remove</button>
                                </>
                              ) : (
                                <>
                                  <button className="la-btn" style={{ fontSize: 11 }} onClick={() => doSync(plaidItem.item_id)} disabled={syncing}>{syncing ? "…" : "↻ Sync"}</button>
                                  <button className="la-btn danger" style={{ fontSize: 11 }} onClick={() => disconnectItem(plaidItem.item_id)}>Disconnect</button>
                                </>
                              )
                            )}
                          </div>
                        </div>

                        {isStale && (
                          <div className="la-stale-bar">
                            Connection expired — reconnect to restore syncing. Your existing data won't be affected.
                          </div>
                        )}

                        <div className="la-accounts-grid" style={{ gridTemplateColumns: !isMobile && accts.length > 1 ? "1fr 1fr" : "1fr" }}>
                          {accts.map((acct, i) => {
                            const spent  = spentByAcct[acct.id] || 0;
                            const income = monthTxns.filter(t => t.amount > 0 && t.accountId === acct.id).reduce((s, t) => s + t.amount, 0);
                            const daily  = today.getDate() > 0 ? spent / today.getDate() : 0;
                            const proj   = daily * daysInMonth(today.getFullYear(), today.getMonth() + 1);
                            const isNeg  = (acct.balance || 0) < 0;
                            const showBorder = !isMobile && accts.length > 1 && i % 2 === 0 && i < accts.length - 1;

                            return (
                              <div key={acct.id} className="la-account-card"
                                style={{ borderRight: showBorder ? "1px solid var(--line)" : "none" }}>
                                <div className="la-account-header">
                                  <span className="la-account-name">{acct.name}</span>
                                  <div className="la-account-actions">
                                    <button className="la-btn" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => openEditAcct(acct)}>Edit</button>
                                    <button className="la-btn" style={{ fontSize: 10, padding: "2px 8px", borderColor: "transparent" }} onClick={() => deleteAcct(acct.id)}>✕</button>
                                  </div>
                                </div>

                                <div className={`la-balance${isNeg ? " negative" : ""}`}>
                                  {isNeg ? "−" : ""}{fmt(Math.abs(acct.balance || 0))}
                                </div>

                                <div className="la-account-type">
                                  {acct.type}{acct.mask ? " ····" + acct.mask : ""}
                                  {acct.available != null ? ` · Available ${fmt(acct.available)}` : ""}
                                </div>

                                <div className="la-pills">
                                  {spent > 0 && (
                                    <span className="la-pill" style={{ background: "var(--debt-bg)", color: "var(--debt)", border: "1px solid rgba(232,115,99,0.2)" }}>
                                      −{fmt(spent)} spent
                                    </span>
                                  )}
                                  {income > 0 && (
                                    <span className="la-pill" style={{ background: "var(--safe-bg)", color: "var(--safe)", border: "1px solid rgba(93,202,165,0.2)" }}>
                                      +{fmt(income)} income
                                    </span>
                                  )}
                                  {!isMobile && daily > 0 && (
                                    <span className="la-pill" style={{ background: "rgba(255,255,255,0.03)", color: "var(--ink-3)", border: "1px solid var(--line)" }}>
                                      ~{fmt(proj)} projected
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
