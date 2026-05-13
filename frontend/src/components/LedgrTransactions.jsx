/**
 * LedgrTransactions.jsx
 * Full-screen transactions page matching the Briefing design system.
 * Place in: src/components/LedgrTransactions.jsx
 *
 * Props from AppInner (all already in scope):
 *   transactions, filteredTxns, categories, catMap, accounts, acctMap
 *   search, handleTxnSearchChange, filterCat, setFilterCat
 *   filterAcct, setFilterAcct, txnTypeFilter, setTxnTypeFilter
 *   txnSortCol, setTxnSortCol, txnSortDir, setTxnSortDir
 *   selectedTxns, setSelectedTxns
 *   needsReview, markReviewed, deleteTxn, openAddTxn, openEditTxn
 *   bulkCategorize, bulkDelete, bulkMarkReviewed, selectAllVisible, clearSelection
 *   txnLoading, loadMoreTransactions
 *   fmt, today, isMobile, navigate
 */

import { useState, useMemo, useRef } from "react";

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
    --goal:#a78bff;--goal-bg:rgba(167,139,255,0.08);
    --font-display:'Instrument Serif',Georgia,serif;
    --font-ui:'Geist',-apple-system,sans-serif;
    --font-mono:'JetBrains Mono',ui-monospace,monospace;
    --r-sm:6px;--r-md:10px;--r-lg:14px;--r-xl:20px;
    font-family:var(--font-ui);
    background:var(--bg-0);
    color:var(--ink-0);
    -webkit-font-smoothing:antialiased;
    min-height:100vh;
  }
  .lb-shell { display:flex;flex:1;min-height:100vh; }
  .lb-page       { background: var(--bg-0); min-height: 100vh; padding: 40px 48px 80px; }
  .lb-frame      { background: var(--bg-1); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; max-width: 1400px; margin: 0 auto; display: flex; flex-direction: column; box-shadow: 0 0 0 1px rgba(255,255,255,0.03) inset, 0 24px 80px rgba(0,0,0,0.4); }
  .lb-frame-bar  { height: 40px; background: var(--bg-2); border-bottom: 1px solid var(--line); display: flex; align-items: center; padding: 0 18px; gap: 8px; flex-shrink: 0; }
  .lb-frame-dot  { width: 9px; height: 9px; border-radius: 50%; background: var(--ink-4); }
  .lb-frame-url  { margin-left: 14px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); letter-spacing: 0.4px; }
  .lb-frame-live { margin-left: auto; display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }
  .lb-frame-live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--safe); box-shadow: 0 0 8px var(--safe); display: inline-block; }
  @media(max-width: 1000px) { .lb-page { padding: 20px 16px 60px; } }
  @media(max-width: 600px)  { .lb-page { padding: 0; } .lb-frame { border-radius: 0; border: none; } }
  .lb-sidenav { width:64px;border-right:1px solid var(--line);background:var(--bg-1);padding:24px 0;display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0; }
  .lb-logo { width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,var(--safe),#0f6e56 80%);margin-bottom:24px;flex-shrink:0; }
  .lb-nav-item { width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink-3);font-size:17px;cursor:pointer;transition:background .15s,color .15s;user-select:none; }
  .lb-nav-item:hover { color:var(--ink-1);background:var(--bg-2); }
  .lb-nav-item.active { color:var(--safe);background:var(--safe-bg); }
  .lb-nav-spacer { flex:1; }
  .lt-main { flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden; }
  .lt-topbar { height:60px;padding:0 52px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;flex-shrink:0; }
  .lt-topbar-left { display:flex;align-items:baseline;gap:16px; }
  .lt-label { font-family:var(--font-mono);font-size:11px;color:var(--ink-3); }
  .lt-title { font-family:var(--font-display);font-size:22px;letter-spacing:-0.3px; }
  .lt-div { width:1px;height:14px;background:var(--line-2); }
  .lt-sub { font-size:11px;color:var(--ink-3);letter-spacing:1.5px;text-transform:uppercase; }
  .lt-topbar-right { display:flex;align-items:center;gap:10px; }
  .lt-search { background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:7px 14px;font-size:12px;color:var(--ink-0);font-family:var(--font-mono);display:flex;align-items:center;gap:8px;min-width:220px; }
  .lt-search input { background:none;border:none;outline:none;color:var(--ink-0);font-family:var(--font-mono);font-size:12px;flex:1;width:100%; }
  .lt-search input::placeholder { color:var(--ink-3); }
  .lt-btn { background:transparent;border:1px solid var(--line);border-radius:8px;padding:5px 12px;font-size:11px;font-family:var(--font-mono);color:var(--ink-2);cursor:pointer;transition:all .15s;white-space:nowrap; }
  .lt-btn:hover { border-color:var(--line-3);color:var(--ink-0); }
  .lt-btn.active { background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe); }
  .lt-btn.primary { background:var(--safe-bg);border-color:rgba(93,202,165,0.4);color:var(--safe); }
  .lt-filter-bar { padding:16px 52px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex-shrink:0;background:var(--bg-1); }
  .lt-filter-select { background:var(--bg-2);border:1px solid var(--line);border-radius:8px;padding:5px 10px;font-size:11px;font-family:var(--font-mono);color:var(--ink-1);cursor:pointer;outline:none;-webkit-appearance:none;appearance:none; }
  .lt-summary-strip { display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--line);flex-shrink:0; }
  .lt-summary-cell { padding:14px 52px;border-right:1px solid var(--line); }
  .lt-summary-cell:last-child { border-right:none; }
  .lt-summary-label { font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px; }
  .lt-summary-val { font-family:var(--font-mono);font-size:20px;font-weight:500; }
  .lt-content { flex:1;overflow-y:auto; }
  .lt-table-wrap { padding:0; }
  .lt-table { width:100%;border-collapse:collapse; }
  .lt-th { font-family:var(--font-mono);font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--ink-3);padding:10px 20px 12px;text-align:left;border-bottom:1px solid var(--line);cursor:pointer;user-select:none;white-space:nowrap;transition:color .12s; }
  .lt-th:hover { color:var(--ink-1); }
  .lt-th.active { color:var(--safe); }
  .lt-row { border-bottom:1px solid var(--line);transition:background .1s;cursor:pointer; }
  .lt-row:hover { background:rgba(255,255,255,0.02); }
  .lt-row.selected { background:rgba(93,202,165,0.04);border-color:rgba(93,202,165,0.15); }
  .lt-td { padding:11px 20px;vertical-align:middle;font-size:13px; }
  .lt-empty { padding:80px 52px;text-align:center;color:var(--ink-3); }
  .lt-empty-icon { font-size:32px;margin-bottom:12px; }
  .lt-empty-title { font-family:var(--font-display);font-size:24px;color:var(--ink-2);margin-bottom:6px; }
  .lt-pill { display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:2px 8px;border-radius:99px;font-family:var(--font-mono);white-space:nowrap; }
  .lt-cat-dot { width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0; }
  .lt-bulk-bar { position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-3);border:1px solid var(--line-2);border-radius:var(--r-xl);padding:10px 20px;display:flex;align-items:center;gap:12px;z-index:50;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:var(--font-mono);font-size:12px; }
  .lt-load-more { padding:20px 52px;text-align:center; }
  @media(max-width:700px){
    .lb-sidenav{display:none;}
    .lt-topbar{padding:0 16px;}
    .lt-filter-bar{padding:12px 16px;}
    .lt-summary-strip{grid-template-columns:1fr 1fr;}
    .lt-summary-cell{padding:10px 16px;}
    .lt-td{padding:10px 12px;}
  }
`;

const NAV_ITEMS = [
  { icon: "◐", id: "dashboard" },
  { icon: "⇅", id: "transactions", active: true },
  { icon: "▣",  id: "accounts" },
  { icon: "▦",  id: "calendar" },
  { icon: "◆",  id: "goals" },
];

export default function LedgrTransactions({
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
  markReviewed,
  deleteTxn,
  openAddTxn,
  openEditTxn,
  bulkCategorize,
  bulkDelete,
  bulkMarkReviewed,
  selectAllVisible,
  clearSelection,
  txnLoading = false,
  loadMoreTransactions,
  fmt = n => `$${Math.abs(n).toFixed(2)}`,
  today = new Date(),
  isMobile = false,
  navigate = () => {},
}) {
  const [bulkCatOpen, setBulkCatOpen] = useState(false);

  // Sort
  const sortedTxns = useMemo(() => {
    const typeFiltered = txnTypeFilter === "all" ? filteredTxns
      : txnTypeFilter === "income" ? filteredTxns.filter(t => t.amount > 0)
      : filteredTxns.filter(t => t.amount < 0);
    return [...typeFiltered].sort((a, b) => {
      let av, bv;
      switch (txnSortCol) {
        case "date":     av = a.date || ""; bv = b.date || ""; break;
        case "merchant": av = (a.name||a.merchant||"").toLowerCase(); bv = (b.name||b.merchant||"").toLowerCase(); break;
        case "category": av = (catMap[a.categoryId]?.name||"").toLowerCase(); bv = (catMap[b.categoryId]?.name||"").toLowerCase(); break;
        case "account":  av = (acctMap[a.accountId]?.name||"").toLowerCase(); bv = (acctMap[b.accountId]?.name||"").toLowerCase(); break;
        case "amount":   av = Math.abs(a.amount); bv = Math.abs(b.amount); break;
        default:         av = a.date || ""; bv = b.date || "";
      }
      if (av < bv) return txnSortDir === "asc" ? -1 : 1;
      if (av > bv) return txnSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTxns, txnTypeFilter, txnSortCol, txnSortDir, catMap, acctMap]);

  function toggleSort(col) {
    if (txnSortCol === col) setTxnSortDir(d => d === "asc" ? "desc" : "asc");
    else { setTxnSortCol(col); setTxnSortDir(col === "amount" || col === "date" ? "desc" : "asc"); }
  }

  const totalSpent  = sortedTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome = sortedTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const netAmt      = totalIncome - totalSpent;
  const toReview    = transactions.filter(t => needsReview(t)).length;

  function toggleSelect(id) {
    setSelectedTxns(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const Th = ({ col, label, align = "left" }) => (
    <th className={`lt-th${txnSortCol === col ? " active" : ""}`}
        style={{ textAlign: align }}
        onClick={() => toggleSort(col)}>
      {label}{txnSortCol === col ? (txnSortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );

  const todayLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <style>{SHARED_CSS}</style>
      <div className="lb-page">
        <div className="lb-frame">
          <div className="lb-frame-bar">
            <div className="lb-frame-dot"/><div className="lb-frame-dot"/><div className="lb-frame-dot"/>
            <span className="lb-frame-url">app.ledgr.app / transactions</span>
            <span className="lb-frame-live">live · synced just now</span>
          </div>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse at 15% 0%,rgba(108,140,255,0.03),transparent 40%)" }} />

      <div className="lb-root" style={{ display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
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

          <div className="lt-main">
            {/* Topbar */}
            <div className="lt-topbar">
              <div className="lt-topbar-left">
                <span className="lt-label">ii ·</span>
                <span className="lt-title">Transactions</span>
                <span className="lt-div" />
                <span className="lt-sub">{todayLabel}</span>
              </div>
              <div className="lt-topbar-right">
                <button className="lt-btn primary" onClick={openAddTxn}>+ Add</button>
              </div>
            </div>

            {/* Summary strip */}
            <div className="lt-summary-strip">
              {[
                { label: "Spent",      val: fmt(totalSpent),  color: "var(--debt)" },
                { label: "Income",     val: fmt(totalIncome), color: "var(--safe)" },
                { label: "Net",        val: (netAmt >= 0 ? "+" : "−") + fmt(Math.abs(netAmt)), color: netAmt >= 0 ? "var(--safe)" : "var(--debt)" },
                { label: "To review",  val: String(toReview), color: toReview > 0 ? "var(--warn)" : "var(--ink-3)" },
              ].map(c => (
                <div key={c.label} className="lt-summary-cell">
                  <div className="lt-summary-label">{c.label}</div>
                  <div className="lt-summary-val" style={{ color: c.color }}>{c.val}</div>
                </div>
              ))}
            </div>

            {/* Filter bar */}
            <div className="lt-filter-bar">
              <div className="lt-search" style={{ minWidth: 200 }}>
                <span style={{ color: "var(--ink-3)" }}>⌕</span>
                <input
                  placeholder="Search transactions…"
                  value={search}
                  onChange={handleTxnSearchChange}
                />
              </div>

              <select className="lt-filter-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="all">All Categories</option>
                {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select className="lt-filter-select" value={filterAcct} onChange={e => setFilterAcct(e.target.value)}>
                <option value="all">All Accounts</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>

              <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
                {[["all", "All"], ["expense", "Expenses"], ["income", "Income"]].map(([v, label]) => (
                  <button key={v} className={`lt-btn${txnTypeFilter === v ? " active" : ""}`} onClick={() => setTxnTypeFilter(v)}>{label}</button>
                ))}
              </div>

              <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
                {sortedTxns.length} {sortedTxns.length === 1 ? "entry" : "entries"}
              </div>
            </div>

            {/* Table */}
            <div className="lt-content">
              {sortedTxns.length === 0 ? (
                <div className="lt-empty">
                  <div className="lt-empty-icon">⌕</div>
                  <div className="lt-empty-title">Nothing found</div>
                  <div>Try adjusting your filters or search</div>
                </div>
              ) : (
                <div className="lt-table-wrap">
                  <table className="lt-table">
                    <thead>
                      <tr style={{ background: "var(--bg-1)" }}>
                        <th className="lt-th" style={{ width: 32, paddingLeft: 20 }}>
                          <input type="checkbox"
                            style={{ accentColor: "var(--safe)", cursor: "pointer" }}
                            checked={selectedTxns.size === sortedTxns.length && sortedTxns.length > 0}
                            onChange={e => e.target.checked ? selectAllVisible() : clearSelection()} />
                        </th>
                        <Th col="date"     label="Date" />
                        <Th col="merchant" label="Merchant" />
                        <Th col="category" label="Category" />
                        <Th col="account"  label="Account" />
                        <Th col="amount"   label="Amount" align="right" />
                        <th className="lt-th" style={{ width: 60 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTxns.map(t => {
                        const cat    = catMap[t.categoryId];
                        const acct   = acctMap[t.accountId];
                        const isInc  = t.amount > 0;
                        const review = needsReview(t);
                        const sel    = selectedTxns.has(t.id);
                        return (
                          <tr key={t.id} className={`lt-row${sel ? " selected" : ""}`} onClick={() => openEditTxn && openEditTxn(t)}>
                            <td className="lt-td" style={{ paddingLeft: 20 }} onClick={e => { e.stopPropagation(); toggleSelect(t.id); }}>
                              <input type="checkbox" checked={sel} onChange={() => toggleSelect(t.id)}
                                style={{ accentColor: "var(--safe)", cursor: "pointer" }} onClick={e => e.stopPropagation()} />
                            </td>
                            <td className="lt-td">
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-2)" }}>{t.date}</div>
                              {review && <div style={{ marginTop: 2 }}><span className="lt-pill" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>review</span></div>}
                            </td>
                            <td className="lt-td">
                              <div style={{ fontSize: 13, color: "var(--ink-0)", fontWeight: 500 }}>{t.name || t.merchant}</div>
                              {t.recurring && <div style={{ marginTop: 2 }}><span className="lt-pill" style={{ background: "var(--calm-bg)", color: "var(--calm)" }}>↻ recurring</span></div>}
                            </td>
                            <td className="lt-td">
                              {cat ? (
                                <span className="lt-pill" style={{ background: cat.color + "18", color: cat.color, border: `1px solid ${cat.color}30` }}>
                                  <span className="lt-cat-dot" style={{ background: cat.color }} />
                                  {cat.name}
                                </span>
                              ) : (
                                <span style={{ color: "var(--ink-4)", fontSize: 12, fontFamily: "var(--font-mono)" }}>—</span>
                              )}
                            </td>
                            <td className="lt-td">
                              <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                                {acct?.name || "—"}
                              </span>
                            </td>
                            <td className="lt-td" style={{ textAlign: "right" }}>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: isInc ? "var(--safe)" : "var(--ink-0)" }}>
                                {isInc ? "+" : "−"}{fmt(Math.abs(t.amount))}
                              </span>
                            </td>
                            <td className="lt-td" onClick={e => e.stopPropagation()}>
                              <button className="lt-btn" style={{ fontSize: 10, padding: "3px 8px" }}
                                onClick={() => deleteTxn && deleteTxn(t.id)}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {loadMoreTransactions && (
                    <div className="lt-load-more">
                      <button className="lt-btn" onClick={loadMoreTransactions} disabled={txnLoading}
                        style={{ padding: "8px 20px", fontSize: 12 }}>
                        {txnLoading ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedTxns.size > 0 && (
        <div className="lt-bulk-bar">
          <span style={{ color: "var(--ink-2)" }}>{selectedTxns.size} selected</span>
          <span style={{ width: 1, height: 16, background: "var(--line-2)", display: "inline-block" }} />
          {bulkCategorize && (
            <div style={{ position: "relative" }}>
              <button className="lt-btn" onClick={() => setBulkCatOpen(p => !p)}>Categorize ▾</button>
              {bulkCatOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setBulkCatOpen(false)} />
                  <div style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 8, background: "var(--bg-3)", border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", minWidth: 200, maxHeight: 280, overflowY: "auto", zIndex: 50, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                    {categories.map(c => (
                      <button key={c.id} onClick={() => { bulkCategorize(c.id); setBulkCatOpen(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--ink-1)", textAlign: "left" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {bulkMarkReviewed && <button className="lt-btn" onClick={() => bulkMarkReviewed(true)}>Mark reviewed</button>}
          {bulkDelete && (
            <button className="lt-btn" style={{ color: "var(--debt)", borderColor: "rgba(232,115,99,0.3)" }}
              onClick={() => { if (window.confirm(`Delete ${selectedTxns.size} transactions?`)) { bulkDelete(); } }}>
              Delete
            </button>
          )}
          <button className="lt-btn" onClick={clearSelection}>✕ Clear</button>
        </div>
      )}
        </div>{/* /lb-frame */}
      </div>{/* /lb-page */}
    </>
  );
}
