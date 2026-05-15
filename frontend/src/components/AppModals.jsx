import * as api from "../api.js";
import { S } from "../theme/index.js";
import { Modal, CustomSelect, CategoryBadge } from "../components/ui/index.jsx";
import { CAT_COLORS } from "../constants.js";

export default function AppModals({
  drillCat, setDrillCat, catTxns, spentByCat, budgetBarsAnimated,
  view, isMobile, selectedMonth, monthLabel,
  editTarget, setEditTarget, modal, setModal,
  toggleRecurring, showToast, recurringItems,
  recurringItemModal, setRecurringItemModal,
  categories, accounts, transactions, setTransactions,
  saveCat, saveAcct, deleteAcct,
  acctForm, setAcctForm, catForm, setCatForm,
  fmt,
  editingRecurringItem, setEditingRecurringItem,
  riForm, setRiForm,
  riSearch, setRiSearch,
  ruleForm, setRuleForm,
  txnForm, setTxnForm,
}) {
  /* -- Drill-down modal -- */
  const showDrillModal = drillCat && (view !== "budgets" || isMobile);
  const DrillDownModal = showDrillModal ? (
    <div style={S.overlay} className="ledgr-overlay-anim" onClick={e=>e.target===e.currentTarget&&setDrillCat(null)}>
      <div style={{...S.modal,width:620,maxHeight:"85vh",display:"flex",flexDirection:"column",padding:20}} className="ledgr-modal-anim">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{width:11,height:11,borderRadius:"50%",background:drillCat.color,display:"inline-block",flexShrink:0}}/>
            <div style={{fontSize:17,fontWeight:700,color:"var(--ink-0)"}}>{drillCat.name}</div>
          </div>
          <button onClick={()=>setDrillCat(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-2)",fontSize:20,padding:"4px 8px"}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12,flexShrink:0}}>
          {[
            {label:"Spent",value:fmt(spentByCat[drillCat.id]||0),color:drillCat.color},
            {label:"Budget",value:fmt(drillCat.limit),color:"var(--ink-1)"},
            {label:"Remaining",value:fmt(drillCat.limit-(spentByCat[drillCat.id]||0)),color:(spentByCat[drillCat.id]||0)<=drillCat.limit?"var(--safe)":"var(--debt)"},
            {label:"Transactions",value:catTxns.length,color:"var(--ink-0)"},
          ].map(s=>(
            <div key={s.label} style={{background:"var(--bg-1)",border:"none",borderRadius:"var(--r-md)",padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"var(--ink-2)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>{s.label}</div>
              <div style={{fontFamily:"var(--font-mono)",fontSize:15,fontWeight:600,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:14,flexShrink:0}}>
          <div style={{height:5,background:"var(--line)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,
              background:(spentByCat[drillCat.id]||0)>=drillCat.limit?"var(--debt)":(spentByCat[drillCat.id]||0)/drillCat.limit>=0.8?"var(--warn)":drillCat.color,
              width:`${Math.min(((spentByCat[drillCat.id]||0)/drillCat.limit)*100,100)}%`,transition:"width 0.5s"}} className={budgetBarsAnimated.current?"ledgr-bar":"ledgr-bar ledgr-bar-anim"}/>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {catTxns.length===0
            ? <div style={{textAlign:"center",padding:"40px 0",color:"var(--ink-2)"}}>No transactions in {monthLabel(selectedMonth)}</div>
            : catTxns.map((t,i)=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 4px",borderBottom:i<catTxns.length-1?"1px solid var(--line)":"none",flexWrap:"wrap"}}>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--ink-2)",whiteSpace:"nowrap",flexShrink:0}}>{t.date}</div>
                  <div style={{flex:1,minWidth:80,fontSize:13,fontWeight:500,color:"var(--ink-0)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                  <div style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:600,color:"var(--debt)",flexShrink:0,minWidth:70,textAlign:"right"}}>{fmt(Math.abs(t.amount))}</div>
                </div>
              ))
          }
        </div>
        <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--line)",display:"flex",justifyContent:"flex-end",flexShrink:0}}>
          <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>setDrillCat(null)}>Close</button>
        </div>
      </div>
    </div>
  ) : null;

  /* -----------------------------------------------------------------
     SCREENS
  ----------------------------------------------------------------- */

  const EditRecurringModal = editTarget && modal==="editRecurring" ? (
    <Modal title="Edit Recurring Transaction" onClose={()=>{setModal(null);setEditTarget(null);}}
      actions={<>
        <button style={{...S.btn("ghost"),color:"var(--ink-2)"}} onClick={()=>{
          toggleRecurring(editTarget.id);
          setModal(null);setEditTarget(null);showToast("Removed from recurring");
        }}>Remove Recurring</button>
        <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>{setModal(null);setEditTarget(null);}}>Cancel</button>
        <button style={S.btn("primary")} className="ledgr-btn-primary" onClick={()=>{
          const patch = { name: editTarget.name, recurringDay: editTarget.recurringDay, recurringFreq: editTarget.recurringFreq||"monthly", recurringStart: editTarget.recurringStart||null, categoryId: editTarget.categoryId||null, accountId: editTarget.accountId||null };
          setTransactions(p=>p.map(t=>t.id===editTarget.id?{...t,...patch}:t));
          api.updateTransaction(editTarget.id, patch).catch(console.error);
          setModal(null);setEditTarget(null);showToast("Updated");
        }}>Save</button>
      </>}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={{padding:"10px 14px",background:"var(--bg-1)",border:"none",borderRadius:"var(--r-md)",fontSize:12,color:"var(--ink-2)"}}>
          Original: <span style={{color:"var(--ink-0)",fontWeight:500}}>{editTarget.merchant}</span>
        </div>
        <div style={S.field}>
          <label style={S.label}>Display Name</label>
          <input style={S.input} placeholder={editTarget.merchant} value={editTarget.name||""} onChange={e=>setEditTarget(p=>({...p,name:e.target.value}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Frequency</label>
          <CustomSelect value={editTarget.recurringFreq||"monthly"} onChange={v=>setEditTarget(p=>({...p,recurringFreq:v}))} options={[{value:"weekly",label:"Weekly"},{value:"biweekly",label:"Bi-weekly"},{value:"monthly",label:"Monthly"},{value:"annual",label:"Annual"}]} style={{width:"100%",backgroundColor:"var(--bg-3)"}}/>
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
          <CustomSelect value={editTarget.categoryId||""} onChange={v=>setEditTarget(p=>({...p,categoryId:v||null}))} options={[{value:"",label:"— None —"},...[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({value:c.id,label:c.name}))]} style={{width:"100%",backgroundColor:"var(--bg-3)"}}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Bank Account</label>
          <CustomSelect value={editTarget.accountId||""} onChange={v=>setEditTarget(p=>({...p,accountId:v||null}))} options={[{value:"",label:"— None —"},...[...accounts].sort((a,b)=>a.name.localeCompare(b.name)).map(a=>({value:a.id,label:a.name}))]} style={{width:"100%",backgroundColor:"var(--bg-3)"}}/>
        </div>
      </div>
    </Modal>
  ) : null;

  const RecurringItemModal = recurringItemModal ? (
    <Modal
      title={editingRecurringItem ? "Edit Recurring" : "New Recurring"}
      onClose={()=>{ setRecurringItemModal(false); setEditingRecurringItem(null); }}
      actions={<>
        {editingRecurringItem && (
          <button style={{...S.btn("ghost"),color:"var(--ink-2)"}} onClick={()=>{
            deleteRecurringItem(editingRecurringItem.id);
            setRecurringItemModal(false); setEditingRecurringItem(null);
          }}>Delete</button>
        )}
        <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>{ setRecurringItemModal(false); setEditingRecurringItem(null); }}>Cancel</button>
        <button style={S.btn("primary")} className="ledgr-btn-primary" onClick={saveRecurringItemForm}>Save</button>
      </>}
    >
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Name */}
        <div style={S.field}>
          <label style={S.label}>Name</label>
          <input style={S.input} placeholder="e.g. Netflix" value={riForm.name} onChange={e=>setRiForm(p=>({...p,name:e.target.value}))}/>
        </div>
        {/* Type */}
        <div style={S.field}>
          <label style={S.label}>Type</label>
          <CustomSelect value={riForm.type||"expense"} onChange={v=>setRiForm(p=>({...p,type:v}))}
            options={[{value:"expense",label:"Expense"},{value:"income",label:"Income"},{value:"transfer",label:"Transfer"},{value:"reimbursement",label:"Reimbursement"}]}
            style={{width:"100%",backgroundColor:"var(--bg-3)"}}/>
        </div>
        {/* Frequency + Day */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={S.field}>
            <label style={S.label}>Frequency</label>
            <CustomSelect value={riForm.recurringFreq} onChange={v=>setRiForm(p=>({...p,recurringFreq:v}))} options={[{value:"weekly",label:"Weekly"},{value:"biweekly",label:"Bi-weekly"},{value:"monthly",label:"Monthly"},{value:"annual",label:"Annual"}]} style={{width:"100%",backgroundColor:"var(--bg-3)"}}/>
          </div>
          {(riForm.recurringFreq==="monthly"||!riForm.recurringFreq) && (
            <div style={S.field}>
              <label style={S.label}>Day of Month</label>
              <input style={S.input} type="number" min="1" max="31" placeholder="e.g. 15" value={riForm.recurringDay} onChange={e=>setRiForm(p=>({...p,recurringDay:e.target.value}))}/>
            </div>
          )}
        </div>
        {/* Expected amount — single field, auto-averaged from linked txns */}
        <div style={S.field}>
          <label style={S.label}>Expected Amount ($)</label>
          {(()=>{
            const liveItem = editingRecurringItem && (recurringItems.find(r=>r.id===editingRecurringItem.id) || editingRecurringItem);
            const linkedAmts = (liveItem?.linkedTxnIds||[])
              .map(id=>transactions.find(t=>t.id===id))
              .filter(Boolean)
              .map(t=>Math.abs(t.amount));
            const avg = linkedAmts.length > 0
              ? (linkedAmts.reduce((a,b)=>a+b,0)/linkedAmts.length).toFixed(2)
              : null;
            return (
              <input
                style={S.input}
                type="number"
                step="0.01"
                placeholder={avg ? `${avg}` : "e.g. 14.99"}
                value={riForm.amountMin}
                onChange={e=>setRiForm(p=>({...p, amountMin:e.target.value, amountMax:e.target.value}))}
              />
            );
          })()}
        </div>
        {/* Category + Account */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={S.field}>
            <label style={S.label}>Category</label>
            <CustomSelect value={riForm.categoryId} onChange={v=>setRiForm(p=>({...p,categoryId:v}))} options={[{value:"",label:"— None —"},...[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({value:c.id,label:c.name}))]} style={{width:"100%",backgroundColor:"var(--bg-3)"}}/>
          </div>
          <div style={S.field}>
            <label style={S.label}>Account</label>
            <CustomSelect value={riForm.accountId} onChange={v=>setRiForm(p=>({...p,accountId:v}))} options={[{value:"",label:"— None —"},...[...accounts].sort((a,b)=>a.name.localeCompare(b.name)).map(a=>({value:a.id,label:a.name}))]} style={{width:"100%",backgroundColor:"var(--bg-3)"}}/>
          </div>
        </div>
        {/* Start Date */}
        <div style={S.field}>
          <label style={S.label}>Start Date</label>
          <input style={S.input} type="date" value={riForm.recurringStart} onChange={e=>setRiForm(p=>({...p,recurringStart:e.target.value}))}/>
        </div>

        {/* Transaction search */}
        <div style={{borderTop:"1px solid var(--line)",paddingTop:12,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:12,fontWeight:600,color:"var(--ink-1)"}}>Link Transactions</div>
          {/* Always-visible linked transactions */}
          {(()=>{
            const liveItem = editingRecurringItem && (recurringItems.find(r=>r.id===editingRecurringItem.id) || editingRecurringItem);
            const liveLinked = liveItem ? (liveItem.linkedTxnIds||[]) : [];
            if (liveLinked.length === 0) return null;
            return (
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <div style={{fontSize:11,color:"var(--ink-2)",marginBottom:2}}>Linked ({liveLinked.length})</div>
                {liveLinked.map(txnId=>{
                  const t = transactions.find(x=>x.id===txnId);
                  return (
                    <div key={txnId} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"var(--bg-1)",borderRadius:"var(--r-md)"}}>
                      <div style={{flex:1,minWidth:0,fontSize:12,color:t?"var(--ink-0)":"var(--ink-2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {t ? (t.name||t.merchant) : <span style={{fontStyle:"italic"}}>Transaction not loaded — scroll transactions list to load more</span>}
                      </div>
                      {t&&<span style={{fontSize:11,color:"var(--ink-2)",flexShrink:0}}>{t.date}</span>}
                      {t&&<span style={{fontFamily:"var(--font-mono)",fontSize:12,color:t.amount<0?"var(--debt)":"var(--safe)",flexShrink:0}}>
                        {t.amount<0?"-":"+"}{fmt(Math.abs(t.amount))}
                      </span>}
                      <button style={{...S.btn("danger",true),fontSize:11,flexShrink:0}} onClick={()=>{
                        unlinkTxnFromRecurringItem(txnId, editingRecurringItem.id);
                        setEditingRecurringItem(prev=>({...prev, linkedTxnIds:(prev.linkedTxnIds||[]).filter(id=>id!==txnId)}));
                      }}>✕</button>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div style={{display:"flex",gap:8}}>
            <input
              style={{...S.input,flex:1}}
              placeholder="Search merchant name…"
              value={riSearch}
              onChange={e=>setRiSearch(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&searchTxnsForRI()}
            />
            <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={searchTxnsForRI} disabled={riSearchLoading}>
              {riSearchLoading?"…":"Search"}
            </button>
          </div>
          {riSearchResults.length > 0 && (
            <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
              {riSearchResults.map(t=>{
                const itemId = editingRecurringItem?.id || ("ri"+Date.now()+"_pending");
                const liveRI = editingRecurringItem && (recurringItems.find(r=>r.id===editingRecurringItem.id) || editingRecurringItem);
                const alreadyLinked = liveRI && (liveRI.linkedTxnIds||[]).includes(t.id);
                const cat = catMap[t.categoryId];
                return (
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"var(--bg-1)",borderRadius:"var(--r-md)",flexShrink:0}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:"var(--ink-0)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name||t.merchant}</div>
                      <div style={{fontSize:11,color:"var(--ink-2)"}}>{t.date}{cat&&<span style={{color:cat.color}}> · {cat.name}</span>}</div>
                    </div>
                    <span style={{fontFamily:"var(--font-mono)",fontSize:12,color:t.amount<0?"var(--debt)":"var(--safe)",flexShrink:0}}>
                      {t.amount<0?"-":"+"}{fmt(Math.abs(t.amount))}
                    </span>
                    {editingRecurringItem ? (
                      <button style={{...S.btn(alreadyLinked?"danger":"ghost",true),fontSize:11,flexShrink:0}} onClick={()=>{
                        alreadyLinked
                          ? unlinkTxnFromRecurringItem(t.id, editingRecurringItem.id)
                          : linkTxnToRecurringItem(t.id, editingRecurringItem.id);
                        setEditingRecurringItem(prev => ({
                          ...prev,
                          linkedTxnIds: alreadyLinked
                            ? (prev.linkedTxnIds||[]).filter(id=>id!==t.id)
                            : [...(prev.linkedTxnIds||[]),t.id]
                        }));
                      }}>{alreadyLinked?"Unlink":"Link"}</button>
                    ) : (
                      <span style={{fontSize:11,color:"var(--ink-2)"}}>Save first to link</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  ) : null;


  /* ── RuleModal ─────────────────────────────────── */
  const RuleModal = (
    <Modal title={modal==="addRule"?"New Rule":"Edit Rule"} onClose={()=>setModal(null)}
      actions={<>
        <button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>setModal(null)}>Cancel</button>
        <button style={S.btn("primary")} className="ledgr-btn-primary" onClick={()=>{
          if(!ruleForm.pattern.trim()||(!ruleForm.categoryId&&!ruleForm.typeOverride)) return;
          saveRule({id:modal==="editRule"?editTarget.id:"r"+Date.now(),...ruleForm,pattern:ruleForm.pattern.trim(),createdAt:modal==="editRule"?editTarget.createdAt:Date.now()});
          setModal(null);
        }}>Save</button>
      </>}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.field}>
          <label style={S.label}>Merchant Pattern</label>
          <input style={S.input} placeholder='e.g. "Netflix"' value={ruleForm.pattern} onChange={e=>setRuleForm(p=>({...p,pattern:e.target.value}))}/>
        </div>
        <div style={S.field}>
          <label style={S.label}>Match Type</label>
          <CustomSelect value={ruleForm.matchType} onChange={v=>setRuleForm(p=>({...p,matchType:v}))} options={[{value:"contains",label:"Contains"},{value:"starts",label:"Starts with"},{value:"exact",label:"Exact match"}]} style={{width:"100%"}}/>
        </div>
        {ruleForm.typeOverride || (editTarget?.typeOverride && !editTarget?.categoryId) ? (
          <div style={S.field}>
            <label style={S.label}>Assign Type</label>
            <CustomSelect value={ruleForm.typeOverride} onChange={v=>setRuleForm(p=>({...p,typeOverride:v,categoryId:""}))} options={[{value:"",label:"— Select —"},{value:"transfer",label:"Transfer"},{value:"income",label:"Income"},{value:"reimbursement",label:"Reimbursement"}]} style={{width:"100%"}}/>
          </div>
        ) : (
          <div style={S.field}>
            <label style={S.label}>Assign Category</label>
            <CustomSelect value={ruleForm.categoryId} onChange={v=>setRuleForm(p=>({...p,categoryId:v,typeOverride:""}))} options={[{value:"",label:"— Select —"},...[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({value:c.id,label:c.name}))]} style={{width:"100%"}}/>
          </div>
        )}
      </div>
    </Modal>
  );


  /* ── CatModal — lumen styled ──────────────────── */
  const CatModal = (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
      <div style={{background:"var(--bg-1)",border:"1px solid var(--line-2)",borderRadius:16,padding:24,width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:16,boxShadow:"0 24px 60px rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:"var(--font-mono)",fontSize:11,letterSpacing:"1.5px",textTransform:"uppercase",color:"var(--ink-3)"}}>
            {modal==="addCat"?"New Category":"Edit Category"}
          </span>
          <button onClick={()=>setModal(null)} style={{background:"none",border:"none",color:"var(--ink-3)",fontSize:18,cursor:"pointer",lineHeight:1,padding:"0 2px"}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:11,color:"var(--ink-3)",letterSpacing:"0.5px"}}>Name</label>
            <input style={{background:"var(--bg-2)",border:"1px solid var(--line)",borderRadius:8,padding:"8px 10px",fontSize:13,color:"var(--ink-0)",outline:"none",fontFamily:"var(--font-ui)",width:"100%"}}
              placeholder="Groceries" value={catForm.name} autoFocus
              onChange={e=>setCatForm(p=>({...p,name:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&saveCat()}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:11,color:"var(--ink-3)",letterSpacing:"0.5px"}}>Monthly budget ($)</label>
            <input style={{background:"var(--bg-2)",border:"1px solid var(--line)",borderRadius:8,padding:"8px 10px",fontSize:13,color:"var(--ink-0)",outline:"none",fontFamily:"var(--font-mono)",width:"100%"}}
              type="number" placeholder="500" value={catForm.limit}
              onChange={e=>setCatForm(p=>({...p,limit:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&saveCat()}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <label style={{fontSize:11,color:"var(--ink-3)",letterSpacing:"0.5px"}}>Color</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {CAT_COLORS.map(col=>(
                <div key={col} onClick={()=>setCatForm(p=>({...p,color:col}))}
                  style={{width:28,height:28,borderRadius:6,background:col,cursor:"pointer",
                    outline:catForm.color===col?`2px solid ${col}`:"2px solid transparent",
                    outlineOffset:2,transition:"transform .12s",transform:catForm.color===col?"scale(1.18)":"scale(1)"}}/>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>setModal(null)}
            style={{padding:"7px 14px",borderRadius:8,background:"var(--bg-2)",border:"1px solid var(--line)",color:"var(--ink-2)",fontSize:12,cursor:"pointer",fontFamily:"var(--font-ui)"}}>
            Cancel
          </button>
          <button onClick={saveCat}
            style={{padding:"7px 14px",borderRadius:8,background:"var(--safe)",border:"none",color:"#07090d",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"var(--font-ui)"}}>
            {modal==="addCat"?"Create":"Save"}
          </button>
        </div>
      </div>
    </div>
  );


  /* ── AcctModal ─────────────────────────────────── */
  const AcctModal = (
    <Modal title={modal==="addAcct"?"Add Account":"Edit Account"} onClose={()=>setModal(null)}
      actions={<><button style={S.btn("ghost")} className="ledgr-btn" onClick={()=>setModal(null)}>Cancel</button><button style={S.btn("primary")} className="ledgr-btn-primary" onClick={saveAcct}>Save</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div style={S.field}><label style={S.label}>Name</label><input style={S.input} placeholder="Chase Checking" value={acctForm.name} onChange={e=>setAcctForm(p=>({...p,name:e.target.value}))}/></div>
        <div style={S.field}><label style={S.label}>Type</label>
          <CustomSelect value={acctForm.type} onChange={v=>setAcctForm(p=>({...p,type:v}))} options={["Checking","Savings","Credit","Investment"].map(t=>({value:t,label:t}))} style={{width:"100%"}}/>
        </div>
        <div style={S.field}><label style={S.label}>Balance ($)</label><input style={S.input} type="number" placeholder="0.00" value={acctForm.balance} onChange={e=>setAcctForm(p=>({...p,balance:e.target.value}))}/></div>
      </div>
    </Modal>
  );


  /* ── TxnModal — Lumen themed ─────────────────── */
  const TxnModal = modal === "addTxn" ? (
    <>
      <style>{`
        .lm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;}
        .lm-modal{background:#0b0e14;border:1px solid rgba(255,255,255,0.08);border-radius:16px;width:100%;max-width:440px;box-shadow:0 32px 80px rgba(0,0,0,0.6);overflow:hidden;}
        .lm-mhead{padding:20px 22px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:baseline;justify-content:space-between;}
        .lm-mtitle{font-family:'Instrument Serif',Georgia,serif;font-size:22px;letter-spacing:-0.3px;color:#f4f4f1;}
        .lm-mclose{background:none;border:none;color:#4a5161;font-size:18px;cursor:pointer;line-height:1;padding:0;}
        .lm-mclose:hover{color:#f4f4f1;}
        .lm-mbody{padding:20px 22px;display:flex;flex-direction:column;gap:12px;}
        .lm-mfield{display:flex;flex-direction:column;gap:5px;}
        .lm-mlabel{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#4a5161;font-family:'JetBrains Mono',monospace;}
        .lm-minput{background:#161c26;border:1px solid rgba(255,255,255,0.10);border-radius:8px;padding:9px 12px;color:#f4f4f1;font-size:13px;width:100%;outline:none;box-sizing:border-box;}
        .lm-minput:focus{border-color:rgba(93,202,165,0.45);}
        .lm-mselect{background:#161c26;border:1px solid rgba(255,255,255,0.10);border-radius:8px;padding:9px 12px;color:#c8cdd6;font-size:12px;font-family:'JetBrains Mono',monospace;width:100%;outline:none;cursor:pointer;box-sizing:border-box;}
        .lm-mselect:focus{border-color:rgba(93,202,165,0.45);}
        .lm-mfoot{padding:14px 22px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;justify-content:flex-end;}
        .lm-mbtn{padding:8px 16px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid rgba(255,255,255,0.10);background:transparent;color:#7d8594;transition:.12s;}
        .lm-mbtn:hover{border-color:rgba(255,255,255,0.18);color:#f4f4f1;}
        .lm-mbtn-p{padding:8px 18px;border-radius:8px;font-size:12px;cursor:pointer;border:1px solid rgba(93,202,165,0.4);background:rgba(93,202,165,0.1);color:#5dcaa5;font-weight:500;transition:.12s;}
        .lm-mbtn-p:hover{background:rgba(93,202,165,0.18);}
        .lm-m2col{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      `}</style>
      <div className="lm-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
        <div className="lm-modal">
          <div className="lm-mhead">
            <span className="lm-mtitle">Add Transaction</span>
            <button className="lm-mclose" onClick={()=>setModal(null)}>✕</button>
          </div>
          <div className="lm-mbody">
            <div className="lm-mfield">
              <label className="lm-mlabel">Description</label>
              <input className="lm-minput" placeholder="Amazon, Paycheck…" value={txnForm.merchant} onChange={e=>setTxnForm(p=>({...p,merchant:e.target.value}))}/>
            </div>
            <div className="lm-m2col">
              <div className="lm-mfield">
                <label className="lm-mlabel">Type</label>
                <select className="lm-mselect" value={txnForm.sign} onChange={e=>setTxnForm(p=>({...p,sign:e.target.value}))}>
                  <option value="-1">Expense</option>
                  <option value="1">Income</option>
                </select>
              </div>
              <div className="lm-mfield">
                <label className="lm-mlabel">Amount ($)</label>
                <input className="lm-minput" type="number" placeholder="0.00" value={txnForm.amount} onChange={e=>setTxnForm(p=>({...p,amount:e.target.value}))}/>
              </div>
            </div>
            <div className="lm-mfield">
              <label className="lm-mlabel">Date</label>
              <input className="lm-minput" type="date" value={txnForm.date} onChange={e=>setTxnForm(p=>({...p,date:e.target.value}))}/>
            </div>
            <div className="lm-m2col">
              <div className="lm-mfield">
                <label className="lm-mlabel">Category</label>
                <select className="lm-mselect" value={txnForm.categoryId} onChange={e=>setTxnForm(p=>({...p,categoryId:e.target.value}))}>
                  <option value="">— None —</option>
                  {[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="lm-mfield">
                <label className="lm-mlabel">Account</label>
                <select className="lm-mselect" value={txnForm.accountId} onChange={e=>setTxnForm(p=>({...p,accountId:e.target.value}))}>
                  <option value="">— None —</option>
                  {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="lm-mfoot">
            <button className="lm-mbtn" onClick={()=>setModal(null)}>Cancel</button>
            <button className="lm-mbtn-p" onClick={saveManualTxn}>Save Transaction</button>
          </div>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      {DrillDownModal}
      {EditRecurringModal}
      {RecurringItemModal}
      {RuleModal}
      {CatModal}
      {AcctModal}
      {TxnModal}
    </>
  );
}
