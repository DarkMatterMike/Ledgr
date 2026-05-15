import { useMemo, useState } from 'react';
import { S } from "../theme/index.js";
import { CategoryBadge } from "../components/ui/index.jsx";
import { DragCard, useDashboardColumns } from "../components/DragCard.jsx";

// All dashboard card definitions and computed analytics
// Returns { dashCols, dashMoveItem, dashMoveToCol, dashEditMode, setDashEditMode,
//           budgetAnalytics, onboardingSteps, onboardingComplete, onboardingProgress }
export function useDashboardCards({
  categories, spentByCat, totalSpent, totalBudget, selectedMonth,
  isMobile, fmt, catMap, transactions, recurringTxns, recurringItems,
  accounts, goals, today, insightsTodos, sortedCategories, setDrillCat,
  dashboardCardOrder, setDashboardCardOrder, scheduleSaveRef,
  navigate, plaidItems, staleItemIds,
  rules, theme, pendingDuplicates, newTxnNotifs, budgetBarsAnimated, pad,
}) {
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
        background: "var(--bg-2)",
        borderRadius: "var(--r-lg)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.2px",
          color: "var(--ink-2)",
          fontFamily: "var(--font-display)",
          marginBottom: 10,
        }}
      >
        Summary
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {[
          ["Budgeted", fmt(totalBudget), "var(--ink-0)"],
          ["Spent", fmt(totalSpent), "var(--ink-0)"],
          ["Left", fmt(totalBudget - totalSpent), totalBudget - totalSpent >= 0 ? "var(--safe)" : "var(--debt)"],
        ].map(([label, value, color]) => (
          <div key={label}>
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-2)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 4,
                fontFamily: "var(--font-display)",
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
    <div className="lumen-card" style={{ ...S.card, height:isMobile?"auto":"395px", boxSizing:"border-box", overflow:"hidden" }}>
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
                    fill="var(--ink-0)"
                    style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)" }}
                  >
                    {fmt(budgetAnalytics.totalSpentForBreakdown)}
                  </text>
                  <text x="50%" y="58%" textAnchor="middle" fill="var(--ink-2)" style={{ fontSize: "10px" }}>
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
                  <span style={{ color: "var(--ink-1)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat.name}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--ink-0)" }}>
                  {fmt(cat.spent)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ color: "var(--ink-2)", padding: "12px 0" }}>No spending data for this month.</div>
      )}
    </div>
  );


  /* ── AccountBalanceStrip ──────────────────────────────────── */
  const AccountBalanceStrip = accounts.length === 0 ? null : (
    <div className="lumen-card" style={{...S.card, padding:0, overflow:"hidden"}}>
      <div
        style={{display:"flex",overflowX:"auto",scrollbarWidth:"thin",scrollbarColor:"var(--line-2) transparent",alignItems:"center",WebkitOverflowScrolling:"touch"}}
        onWheel={e=>{e.currentTarget.scrollLeft+=e.deltaY;}}
      >
        {accounts.map((acct, i) => {
          const t = (acct.type||"").toLowerCase();
          const color = t.includes("credit") ? "var(--debt)" : t.includes("saving") ? "var(--safe)" : "var(--warn)";
          return (
            <div key={acct.id} onClick={()=>navigate("accounts")}
              style={{flexShrink:0,display:"flex",alignItems:"center",gap:6,padding:"9px 14px",
                borderRight:i<accounts.length-1?"1px solid var(--line-2)":"none",cursor:"pointer"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0}}/>
              <span style={{fontSize:11,color:"var(--ink-1)",whiteSpace:"nowrap"}}>{acct.name}</span>
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
    <div className="lumen-card" style={{ ...S.card }}>
      <div style={{ ...S.sectionHdr, marginBottom: 8 }}>
        <div style={S.cardTitle}>Cash Flow</div>
      </div>

      <div style={{ fontSize: 13, color: "var(--ink-1)", marginBottom: 14 }}>
        On average, spending{" "}
        <span style={{ color: budgetAnalytics.avgDelta > 0 ? "var(--debt)" : "var(--safe)", fontWeight: 700 }}>
          {fmt(Math.abs(budgetAnalytics.avgDelta))}/month
        </span>{" "}
        {budgetAnalytics.avgDelta > 0 ? "more than earning" : "less than earnings"}
      </div>

      {(() => {
        const maxVal = Math.max(1, ...budgetAnalytics.cashFlowSeries.flatMap((m) => [m.income, m.spending]));
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap:10, marginBottom: 10, fontSize: 12, color: "var(--ink-1)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--safe)" }} />
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
                borderTop: "1px solid var(--line)",
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
                      <div title={`Income: ${fmt(m.income)}`} style={{ width: 16, height: incomeH, borderRadius: "8px 8px 0 0", background: "var(--safe)" }} />
                      <div title={`Spending: ${fmt(m.spending)}`} style={{ width: 16, height: spendingH, borderRadius: "8px 8px 0 0", background: "#7c95ff" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", whiteSpace: "nowrap" }}>{m.label}</div>
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
    <div className="lumen-card" style={{ ...S.card }}>
      <div style={{ ...S.sectionHdr, marginBottom: 10 }}>
        <div style={S.cardTitle}>Overspending Highlights</div>
      </div>

      {budgetAnalytics.topOverspent.length === 0 ? (
        <div style={{ color: "var(--safe)", fontSize: 13 }}>No categories are over budget right now.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {budgetAnalytics.topOverspent.map((cat) => (
            <div key={cat.id} style={{ background: "var(--bg-1)", borderRadius: "var(--r-md)", padding: "12px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cat.name}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--debt)" }}>
                  +{fmt(cat.overBy)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-2)" }}>Spent <span className="ledgr-amt">{fmt(cat.spent)}</span> of <span className="ledgr-amt">{fmt(cat.limit)}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Exclude transactions already surfaced as individual "newtxn" notifications from the
  // aggregate "review" count — otherwise a brand-new unreviewed transaction creates two
  // notifications at once (one "New: Merchant" + one "N transactions need review").
  const newtxnIds = useMemo(
    () => new Set(newTxnNotifs.map(n => String(n.id).replace("txn-", ""))),
    [newTxnNotifs]
  );
  const reviewCount = transactions.filter(t => needsReview(t) && !newtxnIds.has(String(t.id))).length;

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
        <div className="lumen-card ledgr-budget-gradient" style={{...S.card, height:isMobile?"auto":"395px", boxSizing:"border-box", overflow:"hidden"}}>
          <div style={{...S.sectionHdr,marginBottom:8,paddingLeft:22}}>
            <div style={S.cardTitle}>Budget Progress</div>
            <button style={{...S.btn("ghost",true),color:"var(--warn)"}} className="ledgr-btn" onClick={()=>navigate("budgets")}>All →</button>
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
                  const barC=over?"var(--debt)":warn?"var(--warn)":(remaining===0||complete)?"var(--ink-2)":cat.color;
                  const valColor=(complete||remaining===0)?"var(--ink-2)":over?"var(--debt)":"var(--safe)";
                  const valLabel=complete?"✓":over?`-${fmt(Math.abs(remaining))}`:remaining===0?"Full":fmt(remaining);
                  return (
                    <Fragment key={cat.id}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block",justifySelf:"center"}}/>
                      <span style={{fontSize:12,fontWeight:500,color:"var(--ink-0)",whiteSpace:"nowrap",opacity:complete?0.6:1}}>{cat.name}</span>
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
        <div className="lumen-card" style={S.card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,paddingLeft:22}}>
            <div style={S.cardTitle}>Action Items</div>
            {insightsTodos.length > 0 && (
              <button onClick={()=>{ const next=[]; setInsightsTodos(next); scheduleSaveRef.current?.({insightsTodos:next}); }}
                style={{...S.btn("ghost",true),color:"var(--warn)"}}>Clear all</button>
            )}
          </div>
          {insightsTodos.length === 0 ? (
            <div style={{fontSize:12,color:"var(--ink-2)",textAlign:"center",padding:"20px 0",lineHeight:1.6}}>
              Go to <strong style={{color:"var(--ink-0)"}}>Analytics ← Insights</strong>, generate AI analysis, then tap <span style={{color:"var(--warn)"}}>+ Add to To-Do</span>.
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {insightsTodos.map(todo => (
                <div key={todo.id} style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <button
                    onClick={()=>{ const next=insightsTodos.filter(t=>t.id!==todo.id); setInsightsTodos(next); scheduleSaveRef.current?.({insightsTodos:next}); }}
                    style={{width:16,height:16,borderRadius:3,border:"1.5px solid var(--line-2)",background:"none",cursor:"pointer",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="var(--warn)";e.currentTarget.style.borderColor="var(--warn)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.borderColor="var(--line-2)";}}>
                    <span style={{fontSize:9,color:"var(--warn)",lineHeight:1}}>✓</span>
                  </button>
                  <span style={{fontSize:12,color:"var(--ink-1)",lineHeight:1.5,flex:1}}>{todo.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      goals: goals.length === 0 ? null : (
        <div className="lumen-card" style={S.card}>
          <div style={{...S.sectionHdr,marginBottom:8,paddingLeft:22}}>
            <div style={S.cardTitle}>Goals</div>
            <button style={{...S.btn("ghost",true),color:"var(--warn)"}} className="ledgr-btn" onClick={()=>{ setAnalyticsTab("goals"); navigate("analytics"); }}>All →</button>
          </div>
          {atRisk.length === 0 ? (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"var(--safe-bg)",border:"1px solid var(--safe)44",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span style={{fontSize:10,color:"var(--safe)"}}>✓</span>
              </div>
              <div style={{fontSize:12,color:"var(--ink-1)"}}>All goals on track</div>
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
                      <span style={{fontSize:12,fontWeight:600,color:"var(--ink-0)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,marginRight:8}}>{g.title}</span>
                      <span style={{fontSize:11,fontFamily:"var(--font-mono)",color:pct<50?"var(--debt)":"var(--warn)",flexShrink:0}}>{pct}%</span>
                    </div>
                    <div style={{height:3,background:"var(--line)",borderRadius:99,overflow:"hidden",marginBottom:2}}>
                      <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:pct<50?"var(--debt)":"var(--warn)",transition:"width 0.5s"}} className={budgetBarsAnimated.current?"ledgr-bar":"ledgr-bar ledgr-bar-anim"}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--ink-2)"}}>
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
        <div className="lumen-card ledgr-txn-gradient" style={S.card}>
          <div style={{...S.sectionHdr,marginBottom:8,paddingLeft:22}}>
            <div style={S.cardTitle}>Upcoming</div>
            <button style={{...S.btn("ghost",true),color:"var(--warn)"}} className="ledgr-btn" onClick={()=>navigate("transactions")}>All →</button>
          </div>
          {upcoming.length === 0
            ? <div style={{fontSize:12,color:"var(--ink-2)",padding:"4px 0 2px"}}>No upcoming transactions this month.</div>
            : <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {upcoming.map((t,i) => (
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<upcoming.length-1?"1px solid rgba(0,0,0,0.25)":"none"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:"var(--bg-1)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:10,fontFamily:"var(--font-mono)",color:"var(--ink-1)"}}>{t.recurringDay}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"var(--ink-0)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
                      <div style={{fontSize:10,color:"var(--ink-2)",marginTop:1}}>{catMap[t.categoryId]?.name||"Uncategorized"}</div>
                    </div>
                    <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:600,color:"var(--debt)",flexShrink:0}}>
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

  return {
    dashCols, dashMoveItem, dashMoveToCol, dashEditMode, setDashEditMode,
    budgetAnalytics, onboardingSteps, onboardingComplete, onboardingProgress,
    dashCardDefs,
  };
}
