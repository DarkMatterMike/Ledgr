/**
 * DashboardNew.jsx
 * Exports:
 *   default DashboardNew     — original full dashboard (kept for compatibility)
 *   DashboardHero            — T1 only (persistent shell header)
 *   DashboardContent         — T2+T3+T4 (home page content)
 */

import { useState, useMemo, useRef, useEffect } from "react";

/* ── Shared computed values hook ───────────────────────────── */
function useSharedData({
  categories, spentByCat, monthTxns, recurringItems,
  totalSpent, totalBudget, today,
}) {
  const catHealth = useMemo(() => {
    let over = 0, atRisk = 0, onTrack = 0;
    categories.forEach(c => {
      const spent = spentByCat[c.id] || 0;
      const pct   = c.limit > 0 ? spent / c.limit : 0;
      if (spent > c.limit) over++;
      else if (pct >= 0.8) atRisk++;
      else onTrack++;
    });
    return { over, atRisk, onTrack };
  }, [categories, spentByCat]);

  const dayOfMonth   = today.getDate();
  const daysInMo     = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft     = daysInMo - dayOfMonth;
  const dailyBurn    = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
  const burnPct      = Math.min((totalSpent / (totalBudget || 1)) * 100, 100);
  const budgetRemaining = totalBudget - totalSpent;
  const daysUntilOut = dailyBurn > 0 ? Math.floor(budgetRemaining / dailyBurn) : null;

  const recentTxns = useMemo(() =>
    [...monthTxns].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6),
  [monthTxns]);

  const [curY, curM] = [today.getFullYear(), today.getMonth() + 1];
  const upcomingItems = useMemo(() =>
    [...recurringItems]
      .filter(item => {
        if (!item.recurringDay || item.recurringFreq !== "monthly") return false;
        const posted = (item.linkedTxnIds || []).some(id => {
          const t = monthTxns.find(x => x.id === id);
          if (!t || !t.date) return false;
          const [ty, tm] = t.date.split("-").map(Number);
          return ty === curY && tm === curM;
        });
        return !posted;
      })
      .sort((a, b) => (parseInt(a.recurringDay) || 0) - (parseInt(b.recurringDay) || 0))
      .slice(0, 6),
  [recurringItems, monthTxns, curY, curM]);

  return { catHealth, dayOfMonth, daysInMo, daysLeft, dailyBurn, burnPct, budgetRemaining, daysUntilOut, recentTxns, upcomingItems };
}

/* ── Shared style helpers ──────────────────────────────────── */
function sharedStyles(isMobile) {
  const tier = {
    padding: isMobile ? "24px 16px 28px" : "48px 52px 52px 36px",
    borderBottom: "1px solid rgba(0,0,0,0.35)",
    position: "relative", overflow: "hidden",
    background: "radial-gradient(ellipse 55% 80% at 0% 40%, rgba(201,149,106,0.055) 0%, transparent 65%), #0b0a08",
  };
  const label = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--t3)", fontFamily: "var(--font-mono)" };
  const chip  = (bg, border) => ({ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 99, fontSize: 11, background: bg, border: `1px solid ${border}` });
  const chipN = (color) => ({ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color });
  return { tier, label, chip, chipN };
}

function SectionHdr({ ord, title, sub, isMobile }) {
  const { label } = sharedStyles(isMobile);
  return (
    <div style={{ marginBottom: 24, position: "relative" }}>
      {!isMobile && (
        <div style={{ position: "absolute", top: "50%", transform: "translateY(-60%)", left: 4, fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 96, fontWeight: 500, color: "rgba(201,149,106,0.07)", pointerEvents: "none", userSelect: "none", lineHeight: 1 }}>{ord}</div>
      )}
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "baseline", gap: 12, paddingBottom: 12, borderBottom: "1px solid rgba(201,149,106,0.12)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "rgba(201,149,106,0.45)", letterSpacing: "1px" }}>{ord} ·</span>
        <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 400, fontSize: isMobile ? 18 : 22, color: "var(--t1)", letterSpacing: "-0.2px" }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(201,149,106,0.15), transparent)" }} />
      </div>
      {sub && <div style={{ ...label, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Sig({ status, color }) {
  const bg = status === "over" ? "var(--red)" : status === "warn" ? "var(--amber)" : status === "done" ? "rgba(255,255,255,0.15)" : (color || "var(--green)");
  return <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: bg, boxShadow: status === "over" ? "0 0 0 0 rgba(224,112,112,0.5)" : "none", animation: status === "over" ? "sigpulse 2s infinite" : "none" }} />;
}

function txnIcon(txn) {
  const name = (txn.merchant || txn.name || "").toLowerCase();
  if (txn.amount > 0) return "💰";
  if (/grocery|food|whole|kroger|safe/i.test(name)) return "🛒";
  if (/pet|vet|animal/i.test(name)) return "🐾";
  if (/coffee|starbucks|dunkin/i.test(name)) return "☕";
  if (/phone|mobile|t-mobile|verizon/i.test(name)) return "📱";
  if (/amazon|shop|target|walmart/i.test(name)) return "🛍️";
  if (/gym|fitness|sport/i.test(name)) return "🏋️";
  if (/netflix|spotify|hulu|sub/i.test(name)) return "📺";
  if (/gas|shell|bp|exxon/i.test(name)) return "⛽";
  if (/insurance/i.test(name)) return "🛡️";
  if (/restaurant|dining|pizza/i.test(name)) return "🍽️";
  return "💳";
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD HERO — T1 only, always visible in the shell
═══════════════════════════════════════════════════════════ */
export function DashboardHero({
  isMobile,
  selectedMonth, isCurrentMonth, prevMonth, nextMonth, monthLabel,
  totalSpent, totalIncome, totalBudget,
  spentByCat, categories, monthTxns, recurringItems,
  fmt, today,
}) {
  const [heroMode, setHeroMode] = useState("budget");
  const budgetRemaining  = totalBudget - totalSpent;
  const unbudgetedIncome = Math.max(totalIncome - totalBudget, 0);
  const heroValue  = heroMode === "budget" ? budgetRemaining : unbudgetedIncome;
  const heroValFmt = fmt(Math.abs(heroValue));

  const { catHealth, dailyBurn, burnPct, daysLeft, daysUntilOut } = useSharedData({
    categories, spentByCat, monthTxns, recurringItems, totalSpent, totalBudget, today,
  });
  const { tier, label, chip, chipN } = sharedStyles(isMobile);

  return (
    <div style={{ ...tier, borderBottom: "1px solid rgba(0,0,0,0.35)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, rgba(201,149,106,0.14) 0%, rgba(255,255,255,0.05) 35%, transparent 75%)", pointerEvents: "none" }} />

      {/* Month selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={prevMonth} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: "var(--t2)", cursor: "pointer", padding: "5px 10px", fontSize: 16, lineHeight: 1 }}>‹</button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-disp)", fontWeight: 700, fontSize: isMobile ? 14 : 15, color: "var(--t1)" }}>{monthLabel(selectedMonth)}</span>
          {isCurrentMonth && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--cyan)", background: "rgba(201,149,106,0.1)", padding: "2px 8px", borderRadius: 99 }}>current</span>}
        </div>
        <button onClick={nextMonth} disabled={isCurrentMonth} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: isCurrentMonth ? "var(--border2)" : "var(--t2)", cursor: isCurrentMonth ? "default" : "pointer", padding: "5px 10px", fontSize: 16, lineHeight: 1, opacity: isCurrentMonth ? 0.3 : 1 }}>›</button>
      </div>

      <SectionHdr ord="I" title="How much can I spend?" isMobile={isMobile} />

      {/* Hero number */}
      <div onClick={() => setHeroMode(m => m === "budget" ? "free" : "budget")} style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: isMobile ? 52 : 80, letterSpacing: -4, lineHeight: 0.9, background: "linear-gradient(135deg, #e8ddd0 12%, #d4a882 55%, #c9956a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 28px rgba(201,149,106,0.2))", cursor: "pointer", userSelect: "none" }}>
        {heroValFmt}
      </div>
      <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 8, lineHeight: 1.5 }}>
        {heroMode === "budget"
          ? `remaining of ${fmt(totalBudget)} budget · ${monthLabel(selectedMonth)} · ${daysLeft} days left`
          : `unbudgeted income · ${fmt(totalIncome)} income − ${fmt(totalBudget)} budgeted · ${monthLabel(selectedMonth)}`}
      </div>

      {/* Status chips row 1 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
        <div style={chip("rgba(224,112,112,0.07)", "rgba(224,112,112,0.2)")}><span style={chipN("var(--red)")}>{catHealth.over}</span><span style={{ color: "var(--t3)" }}>overspent</span></div>
        <div style={chip("rgba(201,149,106,0.07)", "rgba(201,149,106,0.2)")}><span style={chipN("var(--amber)")}>{catHealth.atRisk}</span><span style={{ color: "var(--t3)" }}>at risk</span></div>
        <div style={chip("rgba(109,184,138,0.07)", "rgba(109,184,138,0.2)")}><span style={chipN("var(--green)")}>{catHealth.onTrack}</span><span style={{ color: "var(--t3)" }}>on track</span></div>
      </div>
      {/* Status chips row 2 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        <div style={chip("rgba(255,255,255,0.04)", "rgba(255,255,255,0.08)")}><span style={chipN("var(--t1)")}>{fmt(totalSpent)}</span><span style={{ color: "var(--t3)" }}>spent</span></div>
        <div onClick={() => setHeroMode(m => m === "budget" ? "free" : "budget")} style={{ ...chip(heroMode === "budget" ? "rgba(109,184,138,0.07)" : "rgba(201,149,106,0.07)", heroMode === "budget" ? "rgba(109,184,138,0.2)" : "rgba(201,149,106,0.2)"), cursor: "pointer" }}>
          <span style={chipN(heroMode === "budget" ? "var(--green)" : "var(--amber)")}>{heroMode === "budget" ? `${fmt(unbudgetedIncome)} free` : `${fmt(budgetRemaining)} left`}</span>
          <span style={{ color: "var(--t3)" }}>{heroMode === "budget" ? "unbudgeted" : "in budget"}</span>
        </div>
      </div>

      {/* Burn bar */}
      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 18, marginTop: 20, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={label}>Daily burn rate</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--cyan)" }}>{fmt(dailyBurn)} / day</div>
        </div>
        <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${burnPct}%`, borderRadius: 99, background: "linear-gradient(90deg, var(--green), var(--cyan) 55%, var(--red))" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, textAlign: "right" }}>
          <div style={label}>Budget runs out in</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--cyan)" }}>{daysUntilOut != null ? `~ ${daysUntilOut} days` : "—"}</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD CONTENT — T2 + T3 + T4
═══════════════════════════════════════════════════════════ */
export function DashboardContent({
  isMobile,
  spentByCat, sortedCategories, categories, catMap,
  monthTxns, recurringItems,
  navigate, fmt, today,
  selectedMonth, monthLabel,
}) {
  const budgetBarsAnimated = useRef(false);
  useEffect(() => {
    if (!budgetBarsAnimated.current) {
      const t = setTimeout(() => { budgetBarsAnimated.current = true; }, 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const { recentTxns, upcomingItems } = useSharedData({
    categories, spentByCat, monthTxns, recurringItems,
    totalSpent: 0, totalBudget: 0, today,
  });

  const { tier } = sharedStyles(isMobile);
  const [curY, curM] = [today.getFullYear(), today.getMonth() + 1];

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>

      {/* ── TIER 2: BUDGET PROGRESS ──────────────────────── */}
      <div style={tier}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, rgba(201,149,106,0.1) 0%, rgba(255,255,255,0.04) 35%, transparent 75%)", pointerEvents: "none" }} />
        <SectionHdr ord="II" title="Where I'm at" sub="Current budget progress" isMobile={isMobile} />
        {categories.length === 0 ? (
          <div className="ledgr-empty"><div className="ledgr-empty-icon">🏷️</div><div className="ledgr-empty-title">No categories yet</div><div>Add a category to start tracking budgets</div></div>
        ) : (
          <div>
            {(isMobile ? sortedCategories.slice(0, 6) : sortedCategories.slice(0, 14)).map(cat => {
              const spent     = spentByCat[cat.id] || 0;
              const remaining = cat.limit - spent;
              const pct       = Math.min((spent / (cat.limit || 1)) * 100, 100);
              const over      = remaining < 0;
              const warn      = pct >= 80 && !over && remaining !== 0;
              const complete  = !over && (cat.completedMonths || []).includes(selectedMonth);
              const barColor  = over ? "var(--red)" : warn ? "var(--amber)" : complete ? "rgba(255,255,255,0.12)" : cat.color;
              const valColor  = over ? "var(--red)" : (complete || remaining === 0) ? "var(--t3)" : "var(--green)";
              const valLabel  = complete ? "✓" : over ? `-${fmt(Math.abs(remaining))}` : remaining === 0 ? "Full" : fmt(remaining);
              const sigStatus = over ? "over" : warn ? "warn" : complete ? "done" : "ok";
              return (
                <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer" }}>
                  <Sig status={sigStatus} color={cat.color} />
                  <span style={{ fontSize: 12, color: "var(--t2)", flexShrink: 0, width: isMobile ? 100 : 120, opacity: complete ? 0.5 : 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</span>
                  <div style={{ flex: 1.5, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${complete ? 100 : pct}%`, background: barColor }} className={budgetBarsAnimated.current ? "ledgr-bar" : "ledgr-bar ledgr-bar-anim"} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: valColor, width: 70, textAlign: "right", flexShrink: 0 }}>{valLabel}</span>
                </div>
              );
            })}
            {sortedCategories.length > (isMobile ? 6 : 14) && (
              <button onClick={() => navigate("budgets")} style={{ marginTop: 10, background: "none", border: "none", color: "var(--t3)", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                + {sortedCategories.length - (isMobile ? 6 : 14)} more → All budgets
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── TIER 3: RECENT TRANSACTIONS ─────────────────── */}
      <div style={tier}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, rgba(201,149,106,0.08) 0%, rgba(255,255,255,0.03) 35%, transparent 75%)", pointerEvents: "none" }} />
        <SectionHdr ord="III" title="What's happened" sub="Recent transactions" isMobile={isMobile} />
        {monthTxns.length === 0 ? (
          <div className="ledgr-empty"><div className="ledgr-empty-icon">🔍</div><div className="ledgr-empty-title">No transactions yet</div><div>Sync your accounts or add transactions manually</div></div>
        ) : isMobile ? (
          <div>
            {recentTxns.map(txn => (
              <div key={txn.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.032)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{txnIcon(txn)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txn.merchant || txn.name}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{catMap[txn.categoryId]?.name || "Uncategorized"} · {txn.date?.slice(5)}</div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: txn.amount < 0 ? "var(--red)" : "var(--green)", flexShrink: 0 }}>{txn.amount < 0 ? "−" : "+"}{fmt(Math.abs(txn.amount))}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            {[recentTxns.slice(0, 3), recentTxns.slice(3, 6)].map((group, gi) => (
              <div key={gi}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12, color: "var(--t3)", marginBottom: 10, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{gi === 0 ? "This week" : "Earlier this month"}</div>
                {group.map(txn => (
                  <div key={txn.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.032)" }}>
                    <div style={{ width: 2, height: 28, borderRadius: 1, background: catMap[txn.categoryId]?.color || (txn.amount < 0 ? "var(--red)" : "var(--green)"), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txn.merchant || txn.name}</div>
                      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{catMap[txn.categoryId]?.name || "Uncategorized"} · {txn.date?.slice(5)}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: txn.amount < 0 ? "var(--red)" : "var(--green)", flexShrink: 0 }}>{txn.amount < 0 ? "−" : "+"}{fmt(Math.abs(txn.amount))}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <button onClick={() => navigate("transactions")} style={{ marginTop: 14, background: "none", border: "none", color: "var(--t3)", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-mono)" }}>All transactions →</button>
      </div>

      {/* ── TIER 4: UPCOMING ─────────────────────────────── */}
      <div style={{ ...tier, borderBottom: "none" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, rgba(201,149,106,0.06) 0%, rgba(255,255,255,0.02) 35%, transparent 75%)", pointerEvents: "none" }} />
        <SectionHdr ord="IV" title="What's coming up" sub="Upcoming transactions" isMobile={isMobile} />
        {upcomingItems.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--t3)", padding: "4px 0 2px" }}>No upcoming transactions this month.</div>
        ) : isMobile ? (
          <div>
            {upcomingItems.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.032)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, overflow: "hidden", background: item.type === "income" ? "rgba(109,184,138,0.07)" : "rgba(255,255,255,0.04)", border: `1px solid ${item.type === "income" ? "rgba(109,184,138,0.2)" : "rgba(255,255,255,0.07)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 7, fontWeight: 700, textTransform: "uppercase", color: item.type === "income" ? "var(--green)" : "var(--t3)", background: item.type === "income" ? "rgba(109,184,138,0.12)" : "rgba(255,255,255,0.04)", width: "100%", textAlign: "center" }}>MAY</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: item.type === "income" ? "var(--green)" : "var(--t2)" }}>{item.recurringDay}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: item.type === "income" ? "var(--green)" : "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{catMap[item.categoryId]?.name || ""}</div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: item.type === "income" ? "var(--green)" : "var(--red)", flexShrink: 0 }}>{item.type === "income" ? "+" : "−"}{item.amountMin != null ? fmt(item.amountMin) : "—"}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12, color: "var(--t3)", marginBottom: 10, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>Bills due</div>
              {upcomingItems.filter(i => i.type !== "income").map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.032)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 600, color: "var(--t3)", width: 26, lineHeight: 1, flexShrink: 0 }}>{item.recurringDay}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--t2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{catMap[item.categoryId]?.name || ""}</div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--red)", flexShrink: 0 }}>{item.amountMin != null ? `−${fmt(item.amountMin)}` : "—"}</div>
                </div>
              ))}
              {upcomingItems.filter(i => i.type !== "income").length === 0 && <div style={{ fontSize: 12, color: "var(--t3)" }}>No bills due</div>}
            </div>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 12, color: "var(--t3)", marginBottom: 10, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>Incoming</div>
              {upcomingItems.filter(i => i.type === "income").map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.032)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 600, color: "var(--green)", width: 26, lineHeight: 1, flexShrink: 0 }}>{item.recurringDay}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--green)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{catMap[item.categoryId]?.name || ""}</div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--green)", flexShrink: 0 }}>{item.amountMin != null ? `+${fmt(item.amountMin)}` : "—"}</div>
                </div>
              ))}
              {upcomingItems.filter(i => i.type === "income").length === 0 && <div style={{ fontSize: 12, color: "var(--t3)" }}>No income due this month</div>}
            </div>
          </div>
        )}
        <button onClick={() => navigate("calendar")} style={{ marginTop: 14, background: "none", border: "none", color: "var(--t3)", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-mono)" }}>Full calendar →</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DEFAULT EXPORT — full dashboard (Hero + Content combined)
   kept for backward compatibility
═══════════════════════════════════════════════════════════ */
export default function DashboardNew(props) {
  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <DashboardHero {...props} />
      <DashboardContent {...props} />
    </div>
  );
}
