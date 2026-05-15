/**
 * LedgrAccounts.jsx — Concept 1 "Ledger Rows"
 * Dense table layout: every account is one row, grouped by institution.
 */
import { useMemo } from "react";
import PageNav from "./PageNav.jsx";

const CSS = `
  .la-wrap { font-family: var(--font-ui); color: var(--ink-0); background: var(--bg-0); min-height: 100vh; padding: 40px 48px 80px; }
  .la-frame { background: var(--bg-1); border: 1px solid var(--line); border-radius: var(--r-xl); overflow: hidden; max-width: 1400px; margin: 0 auto; box-shadow: 0 24px 80px rgba(0,0,0,0.5); }
  @media(max-width:600px){ .la-wrap{ padding:0; } .la-frame{ border-radius:0; border:none; } }

  /* chrome bar */
  .la-bar { height: 36px; background: var(--bg-2); border-bottom: 1px solid var(--line); display: flex; align-items: center; padding: 0 14px; gap: 6px; flex-shrink: 0; }
  .la-bar-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-4); }
  .la-bar-url { margin-left: 12px; font-family: var(--font-mono); font-size: 10px; color: var(--ink-3); }
  .la-bar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 10px; color: var(--ink-3); }
  .la-bar-sync { background: none; border: 1px solid var(--line-2); border-radius: 5px; padding: 2px 8px; font-size: 9px; font-family: var(--font-mono); color: var(--ink-3); cursor: pointer; transition: .15s; }
  .la-bar-sync:hover { border-color: var(--line-3); color: var(--ink-1); }
  @keyframes la-spin { to { transform: rotate(360deg); } }
  .la-bar-sync.spinning svg { animation: la-spin .7s linear infinite; }

  /* layout */
  .la-inner { display: flex; }
  .la-main { flex: 1; min-width: 0; }

  /* topbar */
  .la-topbar { height: 50px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: var(--bg-1); position: sticky; top: 0; z-index: 10; }
  .la-title { font-family: var(--font-display); font-size: 18px; display: flex; align-items: baseline; gap: 10px; }
  .la-title-sub { font-size: 11px; color: var(--ink-3); font-family: var(--font-mono); }
  .la-actions { display: flex; gap: 8px; }
  .la-btn { background: transparent; border: 1px solid var(--line-2); border-radius: 6px; padding: 4px 12px; font-size: 10px; font-family: var(--font-mono); color: var(--ink-2); cursor: pointer; transition: .15s; letter-spacing: 0.3px; }
  .la-btn:hover { border-color: var(--line-3); color: var(--ink-0); }
  .la-btn.primary { border-color: rgba(93,202,165,0.35); color: var(--safe); }
  .la-btn.danger { border-color: rgba(232,115,99,0.3); color: var(--debt); }

  /* summary strip */
  .la-strip { display: grid; grid-template-columns: repeat(4,1fr); border-bottom: 1px solid var(--line); }
  .la-stat { padding: 12px 24px; border-right: 1px solid var(--line); }
  .la-stat:last-child { border-right: none; }
  .la-stat-lbl { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--ink-3); margin-bottom: 4px; font-family: var(--font-mono); }
  .la-stat-val { font-family: var(--font-mono); font-size: 15px; font-weight: 500; color: var(--ink-0); }
  @media(max-width:700px){ .la-strip{ grid-template-columns:1fr 1fr; } .la-stat{ padding:10px 16px; } }

  /* table */
  .la-table { width: 100%; }
  .la-thead { display: grid; grid-template-columns: 28px 1fr 90px 110px 110px 90px 100px; padding: 0 24px; height: 30px; align-items: center; border-bottom: 1px solid var(--line); background: var(--bg-2); }
  .la-th { font-family: var(--font-mono); font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--ink-3); }
  .la-th.r { text-align: right; }

  /* group header row */
  .la-group-row { display: flex; align-items: center; padding: 0 24px; height: 28px; background: rgba(255,255,255,0.015); border-bottom: 1px solid var(--line); gap: 8px; }
  .la-group-pip { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .la-group-name { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-3); font-family: var(--font-mono); }
  .la-group-count { font-family: var(--font-mono); font-size: 9px; color: var(--ink-4); margin-left: 4px; }
  .la-group-total { margin-left: auto; font-family: var(--font-mono); font-size: 11px; color: var(--ink-2); }
  .la-group-actions { display: flex; gap: 4px; margin-left: 12px; }
  .la-stale-bar { padding: 6px 24px; background: rgba(232,115,99,0.05); border-bottom: 1px solid rgba(232,115,99,0.1); font-size: 11px; color: var(--ink-3); font-family: var(--font-mono); }

  /* account row */
  .la-row { display: grid; grid-template-columns: 28px 1fr 90px 110px 110px 90px 100px; padding: 0 24px; height: 42px; align-items: center; border-bottom: 1px solid var(--line); transition: background .1s; }
  .la-row:hover { background: rgba(255,255,255,0.02); }
  .la-row:last-child { border-bottom: none; }
  .la-row:hover .la-row-actions { opacity: 1; }
  .la-icon { width: 20px; height: 20px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; font-family: var(--font-mono); flex-shrink: 0; }
  .la-acct-name { font-size: 12px; color: var(--ink-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 12px; }
  .la-acct-type { font-size: 9px; color: var(--ink-3); font-family: var(--font-mono); letter-spacing: 0.5px; margin-top: 1px; }
  .la-cell { font-family: var(--font-mono); font-size: 12px; color: var(--ink-1); text-align: right; }
  .la-cell.dim { color: var(--ink-3); font-size: 11px; }
  .la-cell.safe { color: var(--safe); }
  .la-cell.debt { color: var(--debt); }
  .la-cell.goal { color: var(--goal); }
  .la-row-actions { display: flex; justify-content: flex-end; gap: 4px; opacity: 0; transition: opacity .15s; }
  .la-act-btn { background: var(--bg-3); border: 1px solid var(--line-2); border-radius: 4px; padding: 2px 7px; font-size: 9px; font-family: var(--font-mono); color: var(--ink-2); cursor: pointer; transition: .12s; }
  .la-act-btn:hover { color: var(--ink-0); }
  .la-act-btn.danger { border-color: rgba(232,115,99,0.2); color: var(--debt); }

  /* empty */
  .la-empty { padding: 80px; text-align: center; color: var(--ink-3); }
  .la-empty-title { font-family: var(--font-display); font-size: 28px; color: var(--ink-2); margin-bottom: 8px; }

  /* mobile */
  @media(max-width:700px){
    .la-thead { display: none; }
    .la-row { grid-template-columns: 28px 1fr auto; height: auto; padding: 10px 16px; gap: 8px; }
    .la-cell { display: none; }
    .la-cell.bal { display: block; font-size: 13px; }
    .la-group-row { padding: 0 16px; }
    .la-topbar { padding: 0 16px; }
    .la-strip { grid-template-columns: 1fr 1fr; }
    .la-stat { padding: 10px 16px; }
    .la-row-actions { display: none; }
  }
`;

const INSTITUTION_COLORS = [
  'var(--calm)', 'var(--warn)', 'var(--goal)', 'var(--safe)', 'var(--debt)',
];

const DN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function LedgrAccounts({
  accounts=[], plaidItems=[], staleItemIds=new Set(), spentByAcct={}, monthTxns=[],
  openAddAcct, openEditAcct, deleteAcct, disconnectItem, doSync, syncing=false,
  reconnectingItemId=null, setReconnectingItemId, handlePlaidSuccess, PlaidButton,
  showToast=()=>{},
  fmt=n=>`$${Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`,
  today=new Date(), isMobile=false, navigate=()=>{},
  notifs=[], onDismissNotif=()=>{}, onFilterReview=()=>{},
}) {
  const totalBalance = accounts.reduce((s,a)=>s+(a.balance||0), 0);
  const totalSpent   = accounts.reduce((s,a)=>s+(spentByAcct[a.id]||0), 0);
  const totalIncome  = monthTxns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount, 0);
  const timeLabel    = `${DN[today.getDay()]}, ${MN[today.getMonth()]} ${today.getDate()}`;

  const groups = useMemo(()=>{
    const g = {};
    accounts.forEach(a=>{
      const key = a.plaidItemId||"__manual__";
      if (!g[key]) {
        const item = plaidItems.find(i=>i.item_id===a.plaidItemId);
        g[key] = { label: item?.institution||a.institution||"Manual", accts: [] };
      }
      g[key].accts.push(a);
    });
    return Object.entries(g).sort(([ka],[kb])=>{
      if (ka==="__manual__") return 1;
      if (kb==="__manual__") return -1;
      return g[ka].label.localeCompare(g[kb].label);
    });
  }, [accounts, plaidItems]);

  // Assign a color per institution
  const groupColors = {};
  groups.forEach(([key,{label}], i) => {
    groupColors[key] = label==="Manual"
      ? "var(--ink-3)"
      : INSTITUTION_COLORS[i % INSTITUTION_COLORS.length];
  });

  function acctInitials(a) {
    return (a.institution||a.name||"??").slice(0,2).toUpperCase();
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="la-wrap">
        <div className="la-frame">
          {/* chrome bar */}
          <div className="la-bar">
            <div className="la-bar-dot"/><div className="la-bar-dot"/><div className="la-bar-dot"/>
            <span className="la-bar-url">app.ledgr.app / accounts</span>
            <div className="la-bar-right">
              live · synced just now
              {doSync && (
                <button className={`la-bar-sync${syncing?" spinning":""}`} onClick={()=>!syncing&&doSync()} title="Sync all">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                </button>
              )}
            </div>
          </div>

          <div className="la-inner">
            {!isMobile && (
              <PageNav activeId="accounts" navigate={navigate} notifs={notifs} onDismissNotif={onDismissNotif} onFilterReview={onFilterReview}/>
            )}

            <div className="la-main">
              {/* topbar */}
              <div className="la-topbar">
                <div className="la-title">
                  Accounts
                  <span className="la-title-sub">{timeLabel}</span>
                </div>
                <div className="la-actions">
                  {doSync && (
                    <button className="la-btn" onClick={()=>doSync()} disabled={syncing}>
                      {syncing?"Syncing…":"↻ Sync"}
                    </button>
                  )}
                  <button className="la-btn" onClick={openAddAcct}>+ Manual</button>
                  {PlaidButton && (
                    <PlaidButton onSuccess={handlePlaidSuccess} onExit={()=>{}} label="+ Link Bank" showToast={showToast} style={{}} />
                  )}
                </div>
              </div>

              {/* summary strip */}
              <div className="la-strip">
                <div className="la-stat">
                  <div className="la-stat-lbl">Net Worth</div>
                  <div className="la-stat-val" style={{color: totalBalance>=0?"var(--safe)":"var(--debt)"}}>
                    {totalBalance<0?"−":""}{fmt(Math.abs(totalBalance))}
                  </div>
                </div>
                <div className="la-stat">
                  <div className="la-stat-lbl">Accounts</div>
                  <div className="la-stat-val">{accounts.length}</div>
                </div>
                <div className="la-stat">
                  <div className="la-stat-lbl">Spent MTD</div>
                  <div className="la-stat-val" style={{color:"var(--debt)"}}>
                    {totalSpent>0?`−${fmt(totalSpent)}`:"—"}
                  </div>
                </div>
                <div className="la-stat">
                  <div className="la-stat-lbl">Income MTD</div>
                  <div className="la-stat-val" style={{color:"var(--safe)"}}>
                    {totalIncome>0?`+${fmt(totalIncome)}`:"—"}
                  </div>
                </div>
              </div>

              {/* table */}
              {accounts.length===0 ? (
                <div className="la-empty">
                  <div className="la-empty-title">No accounts yet</div>
                  <div style={{fontSize:13,marginTop:8}}>Link a bank or add a manual account to get started</div>
                </div>
              ) : (
                <div className="la-table">
                  {/* thead */}
                  <div className="la-thead">
                    <div className="la-th"/>
                    <div className="la-th">Account</div>
                    <div className="la-th r">Type</div>
                    <div className="la-th r">Spent MTD</div>
                    <div className="la-th r">Income MTD</div>
                    <div className="la-th r">Proj.</div>
                    <div className="la-th r">Balance</div>
                  </div>

                  {groups.map(([key,{label,accts}], gi)=>{
                    const plaidItem = plaidItems.find(i=>i.item_id===key);
                    const isStale   = plaidItem && staleItemIds.has(plaidItem.item_id);
                    const isManual  = key==="__manual__";
                    const color     = groupColors[key];
                    const groupBal  = accts.reduce((s,a)=>s+(a.balance||0),0);

                    return (
                      <div key={key}>
                        {/* group row */}
                        <div className="la-group-row">
                          <div className="la-group-pip" style={{background:color}}/>
                          <span className="la-group-name">{label}</span>
                          <span className="la-group-count">{accts.length} acct{accts.length!==1?"s":""}</span>
                          <span className="la-group-total">{groupBal<0?"−":""}{fmt(Math.abs(groupBal))}</span>
                          <div className="la-group-actions">
                            {isStale && PlaidButton && (
                              <PlaidButton
                                itemId={plaidItem.item_id}
                                onSuccess={async(pt,inst)=>{ await handlePlaidSuccess(pt,inst||label); setReconnectingItemId&&setReconnectingItemId(null); }}
                                onExit={()=>setReconnectingItemId&&setReconnectingItemId(null)}
                                label={reconnectingItemId===plaidItem.item_id?"Opening…":"Reconnect"}
                                showToast={showToast} style={{}}
                              />
                            )}
                            {!isManual && plaidItem && !isStale && (
                              <button className="la-btn" style={{fontSize:9,padding:"1px 7px"}} onClick={()=>doSync(plaidItem.item_id)} disabled={syncing}>
                                ↻ Sync
                              </button>
                            )}
                            {!isManual && plaidItem && (
                              <button className="la-btn danger" style={{fontSize:9,padding:"1px 7px"}} onClick={()=>disconnectItem(plaidItem.item_id)}>
                                {isStale?"Remove":"Disconnect"}
                              </button>
                            )}
                          </div>
                        </div>

                        {isStale && (
                          <div className="la-stale-bar">
                            ⚠ Connection expired — reconnect to restore syncing
                          </div>
                        )}

                        {/* account rows */}
                        {accts.map(acct=>{
                          const spent  = spentByAcct[acct.id]||0;
                          const income = monthTxns.filter(t=>t.amount>0&&t.accountId===acct.id).reduce((s,t)=>s+t.amount,0);
                          const daily  = today.getDate()>0 ? spent/today.getDate() : 0;
                          const daysInMo = new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
                          const proj   = daily*daysInMo;
                          const isNeg  = (acct.balance||0)<0;
                          const isInvestment = /invest|401|ira|brokerage|roth/i.test(acct.type||"");
                          const iconBg = isManual?"var(--bg-3)": `rgba(${color.includes("calm")?"108,140,255":color.includes("warn")?"240,176,76":color.includes("goal")?"167,139,255":color.includes("safe")?"93,202,165":"232,115,99"},0.12)`;

                          return (
                            <div key={acct.id} className="la-row">
                              <div className="la-icon" style={{background:iconBg,color}}>
                                {acctInitials(acct)}
                              </div>
                              <div>
                                <div className="la-acct-name">{acct.name}{acct.mask?` ··${acct.mask}`:""}</div>
                              </div>
                              <div className="la-cell dim" style={{textAlign:"right"}}>{(acct.type||"").toLowerCase()}</div>
                              <div className={`la-cell${spent>0?" debt":""}`}>{spent>0?`−${fmt(spent)}`:"—"}</div>
                              <div className={`la-cell${income>0?" safe":""}`}>{income>0?`+${fmt(income)}`:"—"}</div>
                              <div className="la-cell dim">{proj>0?fmt(proj):"—"}</div>
                              <div className={`la-cell bal${isNeg?" debt":isInvestment?" goal":""}`}>
                                {isNeg?"−":""}{fmt(Math.abs(acct.balance||0))}
                              </div>
                              <div className="la-row-actions" style={{display:"flex",gridColumn:"span 0",position:"absolute",right:24}}>
                                <button className="la-act-btn" onClick={()=>openEditAcct(acct)}>Edit</button>
                                <button className="la-act-btn danger" onClick={()=>deleteAcct(acct.id)}>✕</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
