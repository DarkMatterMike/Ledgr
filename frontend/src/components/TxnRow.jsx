/**
 * components/TxnRow.jsx
 * Transaction list row — collapsed summary + expanded detail panel.
 * Receives all data via props from AppInner.
 */
import { useState } from 'react';
import { S } from '../theme/index.js';
import MerchantIcon from './MerchantIcon.jsx';
import { CategoryBadge, CustomSelect } from './ui/index.jsx';

export default function TxnRow({ t, expandedTxnId, setExpandedTxnId, ellipsisId, setEllipsisId,
  editingId, editingName, setEditingName, setEditingId,
  catMap, acctMap, categories, accounts,
  needsReview, markReviewed, startRename, deleteTxn,
  updateTxnType, updateTxnCat, updateTxnAcct, updateTxnNotes,
  openAddCat, toggleRecurring, updateRecurringDay, saveRename, isMobile,
  isSelected, onToggleSelect, selectionActive,
  goals, assignTxnToGoal }) {

  const expanded   = expandedTxnId === t.id;
  const reviewed   = !needsReview(t);
  const typeVal    = t.type||(t.amount<0?"expense":"income");
  const noCategory = ["income","transfer","reimbursement"].includes(typeVal);
  const cat        = catMap[t.categoryId];
  const acct       = acctMap[t.accountId];

  return (
    <div style={{borderBottom:"1px solid rgba(0,0,0,0.3)"}}>
      <div
        onClick={()=>{ if(selectionActive){ onToggleSelect(t.id); } else { setExpandedTxnId(expanded?null:t.id); } }}
        style={{padding:"7px 0",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
          borderLeft:t.recurring?"3px solid var(--recurring-color, #fbbf24)":needsReview(t)?"3px solid var(--review-color, var(--cyan))":"3px solid transparent",
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
        <MerchantIcon name={t.merchant||t.name} size={24}/>
        <span style={{fontSize:13,fontWeight:400,color:noCategory?"var(--t3)":"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,minWidth:0}}>
          {t.name||t.merchant}
          {t.recurringItemId && <span style={{fontSize:10,color:"var(--amber)",marginLeft:5,fontWeight:600}}>↻</span>}
          {t.notes && <span style={{fontSize:11,color:"var(--t3)",marginLeft:6,fontStyle:"italic"}}>· {t.notes}</span>}
        </span>
        {/* Inline category selector in collapsed row */}
        <div onClick={e=>e.stopPropagation()} style={{flexShrink:0,width:120,overflow:"hidden"}}>
          {(!noCategory) ? (
            <div style={{transform:"scale(0.8125)",transformOrigin:"left center",width:"123%"}}>
            <select
              value={t.categoryId||""}
              onChange={e=>{ const v=e.target.value; if(v==="__new__"){openAddCat();}else{updateTxnCat(t.id,v);} }}
              style={{
                backgroundColor:"var(--surface)", border:"none", outline:"none",
                fontSize:16, color:cat?cat.color:"var(--t3)",
                fontWeight:400, cursor:"pointer", width:"100%",
                appearance:"none", WebkitAppearance:"none",
                fontFamily:"var(--font-body)", padding:"2px 6px 2px 6px",
                borderRadius:20, colorScheme:"dark",
              }}>
              <option value="">— None —</option>
              {[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>(
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ New category</option>
            </select>
            </div>
          ) : (
            <span style={{fontSize:11,color:"var(--t3)",whiteSpace:"nowrap",textTransform:"capitalize"}}>{typeVal}</span>
          )}
        </div>
        <span style={{fontFamily:"var(--font-mono)",fontSize:13,fontWeight:700,color:t.amount<0?"var(--red)":"var(--green)",flexShrink:0,minWidth:80,textAlign:"right"}}>
          {t.amount<0?"-":"+"}{fmt(Math.abs(t.amount))}
        </span>
        <div style={{position:"relative",flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setEllipsisId(ellipsisId===t.id?null:t.id)}
            style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:16,padding:"2px 4px",lineHeight:1}}>⋯</button>
          {ellipsisId===t.id&&(
            <>
              <div style={{position:"fixed",inset:0,zIndex:29}} onClick={()=>setEllipsisId(null)}/>
              <div style={{position:"absolute",right:0,top:"100%",zIndex:30,background:"var(--card)",
                border:"none",borderRadius:"var(--radius)",
                boxShadow:"0 4px 16px #00000060",minWidth:150,overflow:"hidden"}}>
              <button onClick={()=>{markReviewed(t.id);setEllipsisId(null);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:reviewed?"var(--t3)":"var(--green)"}}>
                {reviewed?"Mark Unreviewed":"✓ Mark Reviewed"}
              </button>
              <button onClick={()=>{startRename(t);setEllipsisId(null);setExpandedTxnId(t.id);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t1)"}}>Rename</button>
              {goals && goals.length > 0 && (
                <div style={{borderTop:"1px solid var(--border)",paddingTop:4,paddingBottom:4}}>
                  <div style={{padding:"6px 14px 4px",fontSize:10,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.8px"}}>Add to goal</div>
                  {goals.map(g => {
                    const isAssigned = (g.assignedTxnIds||[]).includes(t.id);
                    return (
                      <button key={g.id} onClick={()=>{assignTxnToGoal(t.id, g.id);setEllipsisId(null);}}
                        style={{display:"block",width:"100%",textAlign:"left",padding:"8px 14px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:isAssigned?"var(--cyan)":"var(--t2)"}}>
                        {isAssigned?"✓ ":""}{g.title}
                      </button>
                    );
                  })}
                </div>
              )}
              <button onClick={()=>{deleteTxn(t.id);setEllipsisId(null);}}
                style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",background:"none",border:"none",cursor:"pointer",fontSize:13,color:"var(--t2)"}}>Delete</button>
            </div>
          </>
          )}
        </div>
      </div>

      {expanded&&(
        <div className="ledgr-expand" style={{background:"var(--surface)",borderRadius:"var(--radius)",padding:"12px",marginBottom:10,display:"flex",flexDirection:"column",gap:10}}>
          {/* Full transaction name when expanded */}
          {editingId!==t.id && (t.name||t.merchant) && (
            <div style={{fontSize:13,fontWeight:600,color:"var(--t1)",wordBreak:"break-word",lineHeight:1.4}}>
              {t.name||t.merchant}
              {t.pending && <span style={{fontSize:10,color:"var(--amber)",marginLeft:8,fontWeight:700,letterSpacing:"0.5px"}}>PENDING</span>}
            </div>
          )}

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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <CustomSelect value={typeVal} onChange={v=>updateTxnType(t.id,v)} options={[{value:"expense",label:"Expense"},{value:"income",label:"Income"},{value:"transfer",label:"Transfer"},{value:"reimbursement",label:"Reimbursement"}]} style={{width:"100%",backgroundColor:"var(--card-hi)"}} compact/>
                {noCategory ? (
                  <div style={{...S.select,padding:"7px 8px",fontSize:12,color:"var(--t3)"}}>No category</div>
                ) : (
                  <CustomSelect value={t.categoryId||""} onChange={v=>{ if(v==="__new__"){openAddCat();}else{updateTxnCat(t.id,v);} }} options={[{value:"",label:"— None —"},{value:"__new__",label:"+ New category"},...[...categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>({value:c.id,label:c.name}))]} style={{width:"100%",backgroundColor:"var(--card-hi)"}} compact/>
                )}
              </div>
              <CustomSelect value={t.accountId||""} onChange={v=>updateTxnAcct(t.id,v)} options={[{value:"",label:"— Account —"},...accounts.map(a=>({value:a.id,label:a.name}))]} style={{width:"100%",backgroundColor:"var(--card-hi)"}} compact/>
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
            <button onClick={()=>setExpandedTxnId(null)} style={{...S.btn("ghost",true),marginLeft:"auto"}}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
