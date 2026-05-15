import { S } from "../theme/index.js";
import { Modal } from "../components/ui/index.jsx";
import { CategoryBadge } from "../components/ui/index.jsx";

export default function BudgetView({
  sortedCategories, spentByCat, totalSpent, totalBudget, selectedMonth,
  isMobile, fmt, catMap, monthTxns,
  budgetExpandedCatId, setBudgetExpandedCatId,
  budgetTxnSearch, setBudgetTxnSearch,
  saveCat, deleteCat, toggleCatComplete, showToast, categories,
  budgetKebabId, setBudgetKebabId,
  openEditCat, openAddCat,
  saveCatName, startEditLimit, saveLimit,
  editingCatNameId, setEditingCatNameId, editingCatName, setEditingCatName,
  editingLimitId, setEditingLimitId, editingLimitVal, setEditingLimitVal,
}) {

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
        <span style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontWeight:400,fontSize:isMobile?18:22,color:title==="Overspent"?"var(--debt)":title==="Completed"?"var(--safe)":"var(--ink-0)"}}>{title}</span>
        <div style={{flex:1,height:1,background:`linear-gradient(90deg,${ruleColor},transparent)`,alignSelf:"center"}}/>
        {count != null && <span style={{fontFamily:"var(--font-mono)",fontSize:10,color:"var(--ink-2)",flexShrink:0}}>{count} {count===1?"category":"categories"}</span>}
      </div>
      {sub && <div style={{fontFamily:"var(--font-mono)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.7px",color:"var(--ink-2)",marginTop:5}}>{sub}</div>}
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
    const barColor  = over ? "var(--debt)" : complete ? "rgba(255,255,255,0.1)" : warn ? "var(--warn)" : cat.color;
    const valColor  = over ? "var(--debt)" : complete ? "var(--ink-2)" : remaining === 0 ? "var(--ink-2)" : "var(--safe)";
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
          <div style={{width:7,height:7,borderRadius:"50%",flexShrink:0,background:barColor,boxShadow:over?"0 0 6px var(--debt)":warn?"0 0 5px rgba(201,149,106,0.5)":"none"}}/>
          {/* Name */}
          {editingCatNameId===cat.id ? (
            <div onClick={e=>e.stopPropagation()} style={{minWidth:0,width:isMobile?100:120,flexShrink:0}}>
              <input autoFocus style={{...S.input,fontSize:12,padding:"2px 6px",width:"100%"}} value={editingCatName} onChange={e=>setEditingCatName(e.target.value)} onBlur={()=>saveCatName(cat.id)} onKeyDown={e=>{if(e.key==="Enter")saveCatName(cat.id);if(e.key==="Escape")setEditingCatNameId(null);}}/>
            </div>
          ) : (
            <span style={{fontSize:13,color:complete?"var(--ink-2)":"var(--ink-1)",width:isMobile?100:120,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",opacity:complete?0.55:1}}>{cat.name}</span>
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
              <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--ink-2)",width:54,textAlign:"right",flexShrink:0}}>{fmt(spent)}</span>
              <span style={{color:"var(--ink-2)",fontSize:10,opacity:.4,flexShrink:0}}>/</span>
              <span style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--ink-2)",width:50,flexShrink:0}}>
                {editingLimitId===cat.id
                  ? <input type="number" autoFocus onClick={e=>e.stopPropagation()} style={{background:"none",border:"none",borderBottom:"1px solid var(--warn)",fontSize:11,color:"var(--ink-0)",outline:"none",width:50,fontFamily:"var(--font-mono)"}} value={editingLimitVal} onChange={e=>setEditingLimitVal(e.target.value)} onBlur={()=>saveLimit(cat.id)} onKeyDown={e=>{if(e.key==="Enter")saveLimit(cat.id);if(e.key==="Escape")setEditingLimitId(null);}}/>
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
                style={{color:"var(--ink-2)",fontSize:10,cursor:"pointer",padding:"4px 2px"}}>▼</span>
            )}
            <div style={{position:"relative"}}>
              <button onClick={e=>{e.stopPropagation();setBudgetKebabId(p=>p===cat.id?null:cat.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-2)",fontSize:16,padding:"4px 4px",lineHeight:1,borderRadius:"var(--r-md)"}}>⋯</button>
              {budgetKebabId===cat.id && (
                <>
                  <div style={{position:"fixed",inset:0,zIndex:39}} onClick={()=>setBudgetKebabId(null)}/>
                  <div style={{position:"absolute",right:0,top:"100%",zIndex:40,background:"var(--bg-2)",border:"none",borderRadius:"var(--r-md)",boxShadow:"0 4px 16px #00000055",minWidth:160,overflow:"hidden"}}>
                    <button onClick={()=>{toggleCatComplete(cat.id);setBudgetKebabId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--ink-0)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>{complete?"✓ Unmark Complete":"✓ Mark Complete"}</button>
                    <button onClick={e=>{e.stopPropagation();openEditCat(cat);setBudgetKebabId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--ink-0)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>Edit Category</button>
                    <button onClick={e=>{e.stopPropagation();deleteCat(cat.id);setBudgetKebabId(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--debt)"}}>Delete</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Expanded drill-down — Ledger Inline */}
        {expanded && (
          <div className="ledgr-expand" style={{margin:"0 0 4px 8px",padding:"14px 14px 14px 16px",background:"var(--bg-0)",borderRadius:0,borderLeft:`2px solid ${cat.color}`}} onClick={e=>e.stopPropagation()}>

            {/* Assigned transactions */}
            {(()=>{
              const catTxns = monthTxns.filter(t=>t.categoryId===cat.id&&t.amount<0).sort((a,b)=>b.date.localeCompare(a.date));
              return catTxns.length===0
                ? <div style={{fontSize:12,color:"var(--ink-2)",marginBottom:12}}>No transactions assigned in {monthLabel(selectedMonth)}.</div>
                : (
                  <div style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontFamily:"var(--font-mono)",fontSize:9,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--ink-2)",marginBottom:8}}>
                      <span>Assigned this month</span><span>{catTxns.length} transaction{catTxns.length!==1?"s":""}</span>
                    </div>
                    {catTxns.map(t=>(
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.03)"}}>
                        <div style={{width:2,height:24,borderRadius:1,flexShrink:0,background:"rgba(255,255,255,0.12)"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:"var(--ink-0)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                          <div style={{fontSize:10,color:"var(--ink-2)",marginTop:1}}>{t.date}</div>
                        </div>
                        <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:"var(--debt)",flexShrink:0}}>{fmt(Math.abs(t.amount))}</div>
                        <button title="Remove from this category" onClick={()=>{updateTxnCat(t.id,"");showToast("Removed from "+cat.name);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-2)",fontSize:14,padding:"2px 4px",lineHeight:1,flexShrink:0}}>✕</button>
                      </div>
                    ))}
                  </div>
                );
            })()}

            {/* Divider */}
            <div style={{height:1,background:"rgba(255,255,255,0.05)",margin:"10px 0"}}/>

            {/* Assign section */}
            <div style={{fontFamily:"var(--font-mono)",fontSize:9,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--ink-2)",marginBottom:8}}>Manually assign a transaction</div>
            <input placeholder="Search by name or merchant…" value={budgetExpandedCatId===cat.id?budgetTxnSearch:""} onChange={e=>setBudgetTxnSearch(e.target.value)} onClick={e=>e.stopPropagation()} style={{...S.input,width:"100%",fontSize:12,padding:"7px 10px",marginBottom:8,boxSizing:"border-box",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,background:"rgba(255,255,255,0.04)"}}/>
            {(()=>{
              const q=budgetTxnSearch.toLowerCase().trim();
              const candidates=monthTxns.filter(t=>t.amount<0&&t.categoryId!==cat.id).filter(t=>!q||(t.name||t.merchant||"").toLowerCase().includes(q)||(t.date||"").includes(q)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,q?20:2);
              if(!q&&candidates.length===0) return <div style={{fontSize:12,color:"var(--ink-2)"}}>All transactions in this month are already assigned here.</div>;
              return (
                <div style={{display:"flex",flexDirection:"column",gap:2,maxHeight:240,overflowY:"auto"}}>
                  {candidates.length===0&&q&&<div style={{fontSize:12,color:"var(--ink-2)"}}>No matching transactions found.</div>}
                  {candidates.map(t=>(
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",marginBottom:3,borderRadius:6,background:"rgba(255,255,255,0.04)"}}>
                      <div style={{width:2,height:24,borderRadius:1,flexShrink:0,background:"rgba(255,255,255,0.07)"}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:"var(--ink-0)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                        <div style={{fontSize:10,color:"var(--ink-2)",marginTop:1}}>{t.date}{t.categoryId&&catMap[t.categoryId]&&<span style={{marginLeft:6,color:catMap[t.categoryId].color}}>· {catMap[t.categoryId].name}</span>}{!t.categoryId&&<span style={{marginLeft:6,color:"var(--ink-2)"}}>· Uncategorized</span>}</div>
                      </div>
                      <div style={{fontFamily:"var(--font-mono)",fontSize:12,fontWeight:700,color:"var(--debt)",flexShrink:0,whiteSpace:"nowrap"}}>{fmt(Math.abs(t.amount))}</div>
                      <button onClick={()=>{updateTxnCat(t.id,cat.id);setBudgetTxnSearch("");showToast("Assigned to "+cat.name);}} style={{background:"rgba(201,149,106,0.1)",border:"1px solid rgba(201,149,106,0.25)",borderRadius:6,color:"var(--warn)",fontSize:11,fontWeight:600,cursor:"pointer",padding:"4px 10px",flexShrink:0,whiteSpace:"nowrap",fontFamily:"var(--fb)"}}>+ Assign</button>
                    </div>
                  ))}
                  {!q&&<div style={{fontSize:11,color:"var(--ink-2)",textAlign:"center",paddingTop:4}}>Showing 5 most recent · search to find more</div>}
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
      <div style={{padding:isMobile?"20px 16px 0":"28px 28px 0",borderBottom:"1px solid rgba(0,0,0,0.35)",position:"relative",overflow:"hidden",background:"radial-gradient(ellipse 55% 80% at 0% 40%, rgba(201,149,106,0.055) 0%, transparent 65%), var(--bg-0,#0b0a08)"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,rgba(201,149,106,0.14),rgba(255,255,255,0.04) 35%,transparent 75%)",pointerEvents:"none"}}/>
        {!isMobile && <div style={{position:"absolute",fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:96,fontWeight:500,color:"rgba(201,149,106,0.07)",pointerEvents:"none",userSelect:"none",top:"50%",transform:"translateY(-55%)",left:8,lineHeight:1}}>II</div>}
        <div style={{display:"flex",alignItems:"baseline",gap:12,paddingBottom:12,borderBottom:"1px solid rgba(201,149,106,0.12)",position:"relative",zIndex:1}}>
          <span style={{fontFamily:"var(--font-mono)",fontSize:10,fontWeight:600,color:"rgba(201,149,106,0.45)",letterSpacing:"1px"}}>II ·</span>
          <span style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontWeight:400,fontSize:isMobile?18:22,color:"var(--ink-0)"}}>Budget Categories</span>
          <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(201,149,106,0.15),transparent)",alignSelf:"center",marginLeft:4}}/>
        </div>
        <div style={{fontFamily:"var(--font-mono)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.7px",color:"var(--ink-2)",marginTop:6,paddingBottom:20,position:"relative",zIndex:1}}>
          {monthLabel(selectedMonth)} · {categories.length} categories · {fmt(totalBudget)} total
        </div>
      </div>

      <div style={{padding:"0 28px 28px",background:"radial-gradient(ellipse 55% 80% at 0% 40%, rgba(201,149,106,0.055) 0%, transparent 65%),var(--bg-0,#0b0a08)"}}>
      {/* ── Stat strip ──────────────────────────────── */}
      <div style={{display:"flex",gap:0,marginBottom:20,border:"1px solid rgba(255,255,255,0.08)",borderRadius:"var(--r-md)",overflow:"hidden"}}>
        {[
          {label:"Total budget", val:fmt(totalBudget),                    color:"var(--ink-0)"},
          {label:"Spent",        val:fmt(totalSpent),                     color:"var(--debt)"},
          {label:"Remaining",    val:fmt(totalBudget - totalSpent),       color:(totalBudget-totalSpent)>=0?"var(--safe)":"var(--debt)"},
          {label:"Used",         val:`${displayPct}%`,                    color:budgetOver?"var(--debt)":rawPct>=0.8?"var(--warn)":"var(--ink-0)"},
        ].map((c,i,arr)=>(
          <div key={c.label} style={{flex:1,padding:"9px 14px",borderRight:i<arr.length-1?"1px solid rgba(255,255,255,0.06)":"none"}}>
            <div style={{fontFamily:"var(--font-mono)",fontSize:9,textTransform:"uppercase",letterSpacing:"0.8px",color:"var(--ink-2)",marginBottom:3}}>{c.label}</div>
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
        <div style={{background:"var(--bg-2)",border:"1px solid rgba(201,149,106,0.25)",borderRadius:"var(--r-lg)",padding:16,marginBottom:24}} className="ledgr-card-anim">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"var(--ink-0)"}}>✦ AI Limit Suggestions</div>
              <div style={{fontSize:11,color:"var(--ink-2)",marginTop:2}}>Based on your last 3 months of spending. Accept or dismiss each.</div>
            </div>
            <button style={{...S.btn("ghost",true),fontSize:11}} className="ledgr-btn" onClick={()=>setLimitSuggestions([])}>Dismiss all</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {limitSuggestions.map(s=>{
              const cat=catMap[s.categoryId];
              if(!cat)return null;
              const diff=s.suggestedLimit-(cat.limit||0);
              const diffColor=diff>0?"var(--warn)":diff<0?"var(--safe)":"var(--ink-2)";
              return (
                <div key={s.categoryId} style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:"var(--bg-1)",borderRadius:"var(--r-md)",padding:"10px 14px",borderLeft:`3px solid ${cat.color}`}}>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:cat.color,flexShrink:0,display:"inline-block"}}/>
                      <span style={{fontSize:13,fontWeight:600,color:"var(--ink-0)"}}>{cat.name}</span>
                    </div>
                    <div style={{fontSize:11,color:"var(--ink-2)",lineHeight:1.5}}>{s.reasoning}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,color:"var(--ink-2)"}}>Current</div>
                      <div style={{fontSize:13,fontFamily:"var(--font-mono)",color:"var(--ink-1)"}}>{fmt(cat.limit||0)}</div>
                    </div>
                    <div style={{fontSize:13,color:"var(--ink-2)"}}>←</div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,color:"var(--ink-2)"}}>Suggested</div>
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
}
