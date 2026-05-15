/**
 * AiChat.jsx — "The Dispatch"
 *
 * Redesign: no chat bubbles. Conversations render as flowing editorial
 * documents. User questions → Playfair italic pull-quotes. AI responses →
 * structured prose with auto-styled dollar amounts. Right column shows
 * live financial context + conversation history.
 */

import { useState, useEffect, useRef, useMemo } from "react";

/* ─── inline styles ─────────────────────────────────────────────── */
function injectCSS() {
  if (document.getElementById("dispatch-css")) return;
  const s = document.createElement("style");
  s.id = "dispatch-css";
  s.textContent = `
    .dispatch-response p   { margin: 0 0 10px; line-height: 1.75; color: rgba(232,221,208,0.75); font-size: 13px; }
    .dispatch-response p:last-child { margin-bottom: 0; }
    .dispatch-response strong { color: #e8ddd0; font-weight: 600; }
    .dispatch-response em    { font-style: italic; color: rgba(232,221,208,0.6); }
    .dispatch-response ul, .dispatch-response ol { margin: 6px 0 10px 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; }
    .dispatch-response li   { display: flex; gap: 8px; font-size: 13px; color: rgba(232,221,208,0.7); line-height: 1.55; }
    .dispatch-response li::before { content: '—'; color: rgba(201,149,106,0.5); flex-shrink: 0; }
    .dispatch-response h2, .dispatch-response h3 { font-family: 'Syne', sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: rgba(201,149,106,0.7); margin: 14px 0 6px; }
    .dispatch-response .amt { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #c9956a; }
    .dispatch-response .amt-red { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #e07070; }
    .dispatch-response .amt-green { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #6db88a; }
    .dispatch-response .pct { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: rgba(232,221,208,0.5); }
    .dispatch-exchange { border-bottom: 1px solid rgba(255,255,255,0.04); padding: 28px 0; }
    .dispatch-exchange:last-child { border-bottom: none; }
    .dispatch-input-field { background: transparent; border: none; outline: none; width: 100%;
      font-family: 'DM Sans', sans-serif; font-size: 14px; color: #e8ddd0;
      resize: none; line-height: 1.5; caret-color: #c9956a; }
    .dispatch-input-field::placeholder { color: rgba(232,221,208,0.25); font-style: italic; }
    .dispatch-input-field:disabled { opacity: 0.4; }
    .dispatch-spark { padding: 5px 11px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.03); color: rgba(232,221,208,0.5); font-size: 11px;
      cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .12s; white-space: nowrap; }
    .dispatch-spark:hover { background: rgba(201,149,106,0.1); border-color: rgba(201,149,106,0.25); color: #c9956a; }
    .dispatch-hist-item { padding: 9px 10px; border-radius: 7px; cursor: pointer; transition: background .1s; }
    .dispatch-hist-item:hover { background: rgba(255,255,255,0.04); }
    .dispatch-hist-item.active { background: rgba(201,149,106,0.08); border: 1px solid rgba(201,149,106,0.15); }
    .dispatch-ctx-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .dispatch-ctx-row:last-child { border-bottom: none; }
    .dispatch-dots span { animation: ledgr-breathe 1.2s ease-in-out infinite; display: inline-block; margin: 0 1px; }
    @keyframes ledgr-breathe { 0%,100%{opacity:.3} 50%{opacity:1} }
    .dispatch-scroll::-webkit-scrollbar { width: 4px; }
    .dispatch-scroll::-webkit-scrollbar-track { background: transparent; }
    .dispatch-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
  `;
  document.head.appendChild(s);
}

/* ─── prose renderer ─────────────────────────────────────────────── */
function renderProse(text) {
  if (!text) return null;

  // Highlight dollar amounts and percentages
  function styleLine(line) {
    // Split on $ amounts and % numbers
    const parts = [];
    let remaining = line;
    const re = /(\$[\d,]+(?:\.\d+)?(?:k|K)?|[-+]?\d+(?:\.\d+)?%)/g;
    let match;
    let last = 0;
    re.lastIndex = 0;
    while ((match = re.exec(remaining)) !== null) {
      if (match.index > last) parts.push(remaining.slice(last, match.index));
      const val = match[0];
      const isDollar = val.startsWith("$");
      const isPct    = val.endsWith("%");
      if (isDollar) parts.push(<span key={match.index} className="amt">{val}</span>);
      else          parts.push(<span key={match.index} className="pct">{val}</span>);
      last = match.index + val.length;
    }
    if (last < remaining.length) parts.push(remaining.slice(last));
    return parts;
  }

  const lines = text.split("\n");
  const elements = [];
  let listBuffer = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length) {
      elements.push(
        <ul key={key++}>
          {listBuffer.map((item, i) => <li key={i}>{styleLine(item)}</li>)}
        </ul>
      );
      listBuffer = [];
    }
  }

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(); return; }

    if (/^#{1,3}\s/.test(trimmed)) {
      flushList();
      const txt = trimmed.replace(/^#+\s/, "");
      elements.push(<h3 key={key++}>{txt}</h3>);
    } else if (/^\*\*(.+)\*\*$/.test(trimmed)) {
      flushList();
      elements.push(<h3 key={key++}>{trimmed.replace(/\*\*/g, "")}</h3>);
    } else if (/^[-•*]\s/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^[-•*]\s/, ""));
    } else if (/^\d+\.\s/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^\d+\.\s/, ""));
    } else {
      flushList();
      // Inline bold
      const boldParts = trimmed.split(/\*\*(.+?)\*\*/g).map((p, i) =>
        i % 2 === 1 ? <strong key={i}>{p}</strong> : styleLine(p)
      );
      elements.push(<p key={key++}>{boldParts}</p>);
    }
  });
  flushList();
  return elements;
}

/* ─── smart prompt sparks ────────────────────────────────────────── */
function buildSparks(transactions, categories, accounts) {
  const sparks = [];
  const now = new Date();
  const thisYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  // Unreviewed
  const unreviewed = transactions.filter(t => !t.categoryId && t.amount < 0).length;
  if (unreviewed > 3) sparks.push(`I have ${unreviewed} uncategorized transactions — what should I do?`);

  // Over-budget
  const overspent = categories.filter(c => {
    const spent = transactions.filter(t => t.date?.startsWith(thisYM) && t.categoryId === c.id && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return c.limit && spent > c.limit;
  });
  if (overspent.length) sparks.push(`I'm over budget in ${overspent.map(c => c.name).join(" and ")} — give me advice`);

  // Top category this month
  const catSpend = {};
  transactions.filter(t => t.date?.startsWith(thisYM) && t.amount < 0).forEach(t => {
    if (t.categoryId) catSpend[t.categoryId] = (catSpend[t.categoryId] || 0) + Math.abs(t.amount);
  });
  const topCatId = Object.entries(catSpend).sort((a,b) => b[1]-a[1])[0]?.[0];
  const topCat = categories.find(c => c.id === topCatId);
  if (topCat) sparks.push(`Why did I spend so much on ${topCat.name} this month?`);

  // Negative balance
  const negAcct = accounts.find(a => a.balance != null && a.balance < 0);
  if (negAcct) sparks.push(`${negAcct.name} has a negative balance — what should I prioritize?`);

  // Defaults
  sparks.push("How does this month compare to last month?");
  sparks.push("What are my biggest recurring expenses?");
  sparks.push("Am I on track with my budget overall?");
  sparks.push("Which purchases were unusual this month?");

  return [...new Set(sparks)].slice(0, 5);
}

/* ─── sub-components ─────────────────────────────────────────────── */
function Exchange({ msg, prevMsg, index }) {
  const isUser = msg.role === "user";
  const isAI   = msg.role === "assistant";
  const isThinking = isAI && !msg.content;

  if (isUser) return null; // user messages are rendered with their paired AI response

  // Find paired user message (previous message)
  const question = prevMsg?.role === "user" ? prevMsg.content : null;

  return (
    <div className="dispatch-exchange">
      {/* Question — Playfair italic pull-quote */}
      {question && (
        <div style={{ display:"flex", gap:14, marginBottom:20 }}>
          <div style={{ width:2, background:"rgba(201,149,106,0.3)", flexShrink:0, borderRadius:1, marginTop:4 }}/>
          <div style={{ fontFamily:"var(--font-display)", fontStyle:"italic", fontWeight:400, fontSize:18, lineHeight:1.5, color:"var(--ink-0)" }}>
            {question}
          </div>
        </div>
      )}

      {/* AI response */}
      <div style={{ display:"flex", gap:14 }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0 }}>
          <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(201,149,106,0.1)", border:"1px solid rgba(201,149,106,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"var(--warn)", fontFamily:"var(--font-display)" }}>ℓ</div>
          {!isThinking && <div style={{ flex:1, width:1, background:"rgba(255,255,255,0.04)", minHeight:20 }}/>}
        </div>
        <div style={{ flex:1, paddingBottom:4 }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:9, textTransform:"uppercase", letterSpacing:"1px", color:"rgba(201,149,106,0.4)", marginBottom:10 }}>
            ✦ Claude
          </div>
          {isThinking ? (
            <div className="dispatch-dots" style={{ color:"rgba(232,221,208,0.4)", fontSize:13 }}>
              <span style={{ animationDelay:"0s" }}>●</span>
              <span style={{ animationDelay:"0.2s" }}>●</span>
              <span style={{ animationDelay:"0.4s" }}>●</span>
            </div>
          ) : (
            <div className="dispatch-response">{renderProse(msg.content)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContextPanel({ transactions, categories, accounts }) {
  const now = new Date();
  const thisYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const fmt = n => n == null ? "—" : "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits:0, maximumFractionDigits:0 });

  const thisMonthExpenses = transactions
    .filter(t => t.date?.startsWith(thisYM) && t.amount < 0 && !["transfer","income","reimbursement"].includes(t.type))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalBalance = accounts.filter(a => a.balance != null).reduce((s, a) => s + a.balance, 0);
  const totalBudget  = categories.reduce((s, c) => s + (c.limit || 0), 0);
  const overBudget   = categories.filter(c => {
    const spent = transactions.filter(t => t.date?.startsWith(thisYM) && t.categoryId === c.id && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return c.limit && spent > c.limit;
  }).length;

  const rows = [
    { label:"Net worth",     val: fmt(totalBalance),          color: totalBalance >= 0 ? "var(--safe)" : "var(--debt)" },
    { label:"Spent this mo", val: fmt(thisMonthExpenses),     color: "var(--debt)" },
    { label:"Monthly budget",val: fmt(totalBudget),           color: "var(--ink-1)" },
    { label:"Over budget",   val: `${overBudget} categor${overBudget===1?"y":"ies"}`, color: overBudget > 0 ? "var(--warn)" : "var(--safe)" },
    { label:"Transactions",  val: String(transactions.length),color: "var(--ink-1)" },
  ];

  return (
    <div>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:9, textTransform:"uppercase", letterSpacing:"1.2px", color:"rgba(201,149,106,0.4)", marginBottom:10 }}>
        Context loaded
      </div>
      {rows.map(r => (
        <div key={r.label} className="dispatch-ctx-row">
          <span style={{ fontSize:11, color:"var(--ink-2)" }}>{r.label}</span>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:11, fontWeight:600, color:r.color }}>{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function HistItem({ conv, isActive, onSelect, onDelete }) {
  const date = new Date(conv.createdAt);
  const now  = new Date();
  const diff = now - date;
  const isToday = date.toDateString() === now.toDateString();
  const isYest  = new Date(now.setDate(now.getDate()-1)).toDateString() === date.toDateString();
  const label   = isToday ? date.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})
                : isYest  ? "Yesterday"
                : date.toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const question = conv.messages.find(m => m.role === "user")?.content || "Empty";
  const turns    = Math.ceil(conv.messages.length / 2);

  return (
    <div className={`dispatch-hist-item${isActive?" active":""}`} onClick={() => onSelect(conv.id)}
      style={{ position:"relative" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:6, marginBottom:3 }}>
        <div style={{ fontSize:11, fontWeight:600, color:isActive?"var(--warn)":"var(--ink-0)", flex:1,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {conv.title || question.slice(0,40)}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:9, color:"var(--ink-2)" }}>{label}</span>
          <button onClick={e=>{e.stopPropagation();onDelete(conv.id);}}
            style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-2)", fontSize:11,
              padding:"1px 2px", lineHeight:1, opacity:0, transition:"opacity .1s" }}
            onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.color="var(--debt)";}}
            onMouseLeave={e=>{e.currentTarget.style.opacity="0";e.currentTarget.style.color="var(--ink-2)";}}>✕</button>
        </div>
      </div>
      <div style={{ fontSize:10, color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {question.slice(0,55)}{question.length>55?"…":""}
      </div>
      <div style={{ fontSize:9, color:"rgba(232,221,208,0.2)", marginTop:2, fontFamily:"var(--font-mono)" }}>
        {turns} turn{turns!==1?"s":""}
      </div>
    </div>
  );
}

function ApiKeySetup({ onSave }) {
  const [keyVal, setKeyVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSave() {
    if (!keyVal.trim()) return;
    setSaving(true); setError(null);
    try { await onSave(keyVal.trim()); } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ maxWidth:520, margin:"0 auto", padding:"48px 28px" }}>
      {/* Ghost */}
      <div style={{ fontFamily:"var(--font-display)", fontStyle:"italic", fontSize:80,
        color:"rgba(201,149,106,0.05)", lineHeight:1, marginBottom:-24, userSelect:"none" }}>✦</div>
      <div style={{ fontFamily:"var(--font-display)", fontStyle:"italic", fontSize:26, color:"var(--ink-0)", marginBottom:8 }}>
        Set up your advisor
      </div>
      <div style={{ fontSize:13, color:"var(--ink-2)", lineHeight:1.7, marginBottom:28, maxWidth:400 }}>
        Ledgr uses Claude by Anthropic to give you a personalized financial advisor — one that actually knows your numbers.
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
        {[
          { n:"1", t:"Create an Anthropic account", b:"Go to console.anthropic.com and sign up for free.", link:"https://console.anthropic.com" },
          { n:"2", t:"Generate an API key",         b:"Under API Keys, click Create Key. Copy the sk-ant-… string." },
          { n:"3", t:"Paste it below",              b:"Your key is encrypted and only used for your conversations." },
        ].map(s => (
          <div key={s.n} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0, background:"rgba(201,149,106,0.12)",
              border:"1px solid rgba(201,149,106,0.25)", display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"var(--font-mono)", fontSize:10, fontWeight:700, color:"var(--warn)" }}>{s.n}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--ink-0)", marginBottom:2 }}>{s.t}</div>
              <div style={{ fontSize:12, color:"var(--ink-2)", lineHeight:1.5 }}>{s.b}</div>
              {s.link && <a href={s.link} target="_blank" rel="noreferrer"
                style={{ fontSize:11, color:"var(--warn)", marginTop:4, display:"inline-block" }}>
                Open Anthropic Console →</a>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8 }}>
        <input type="password" placeholder="sk-ant-api03-…" value={keyVal}
          onChange={e=>setKeyVal(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleSave()}
          autoFocus
          style={{ flex:1, background:"var(--bg-1)", border:"1px solid var(--line)",
            borderRadius:"var(--r-md)", padding:"9px 12px", fontSize:13, color:"var(--ink-0)",
            outline:"none", fontFamily:"var(--font-mono)", colorScheme:"dark" }} />
        <button onClick={handleSave} disabled={saving||!keyVal.trim()}
          style={{ padding:"9px 18px", borderRadius:"var(--r-md)", background:"var(--warn)",
            color:"#000", border:"none", fontWeight:700, fontSize:13, cursor:"pointer",
            opacity:saving||!keyVal.trim()?0.5:1 }}>
          {saving?"Saving…":"Connect"}
        </button>
      </div>
      {error && <div style={{ fontSize:12, color:"var(--debt)", marginTop:8 }}>{error}</div>}
      <div style={{ fontSize:11, color:"rgba(232,221,208,0.2)", marginTop:14, lineHeight:1.6 }}>
        $5 free credits on sign-up · Encrypted storage · Used only for your questions
      </div>
    </div>
  );
}

/* ─── main export ────────────────────────────────────────────────── */
const SUGGESTED_QUESTIONS = [
  "How much did I spend last month?",
  "What's my biggest spending category?",
  "Am I over budget anywhere?",
  "What are my recurring expenses?",
  "How does this month compare to last month?",
  "Which transactions should I review?",
];

export default function AiChat({
  messages, conversations, currentConvId,
  hasApiKey, keyChecked, loading, error,
  checkApiKey, saveApiKey, sendMessage,
  newConversation, selectConversation, deleteConversation,
  clearCurrentConversation, clearHistory,
  transactions, categories, accounts, catMap, acctMap,
  isMobile,
}) {
  useEffect(() => { injectCSS(); }, []);
  useEffect(() => { checkApiKey(); }, []);

  const [input,       setInput]       = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showCtx,     setShowCtx]     = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const scrollRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  const sparks = useMemo(() => buildSparks(transactions, categories, accounts), [transactions, categories, accounts]);
  const sortedConvs = [...(conversations || [])].sort((a, b) => b.createdAt - a.createdAt);
  const isEmpty = messages.length === 0;

  function buildContext() {
    const now = new Date();
    const thisMonth    = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const lastMonthD   = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const lastMonthStr = `${lastMonthD.getFullYear()}-${String(lastMonthD.getMonth()+1).padStart(2,"0")}`;
    const spentByCat = {};
    transactions.forEach(t => {
      if (t.amount < 0 && t.categoryId)
        spentByCat[t.categoryId] = (spentByCat[t.categoryId] || 0) + Math.abs(t.amount);
    });
    return {
      currentMonth: thisMonth,
      categories: categories.map(c => ({ id:c.id, name:c.name, limit:c.limit, spent:Math.round((spentByCat[c.id]||0)*100)/100 })),
      accounts: accounts.map(a => ({ name:a.name, type:a.type, balance:a.balance })),
      thisMonthTransactions: transactions.filter(t=>t.date?.startsWith(thisMonth)).slice(0,100).map(t=>({ date:t.date, merchant:t.name||t.merchant, amount:t.amount, category:catMap[t.categoryId]?.name||null, pending:t.pending||false })),
      lastMonthTransactions: transactions.filter(t=>t.date?.startsWith(lastMonthStr)).slice(0,50).map(t=>({ date:t.date, merchant:t.name||t.merchant, amount:t.amount, category:catMap[t.categoryId]?.name||null })),
      totalTransactions: transactions.length,
      recentTransactions: transactions.slice(0,20).map(t=>({ date:t.date, merchant:t.name||t.merchant, amount:t.amount, category:catMap[t.categoryId]?.name||null })),
    };
  }

  function handleSend(text) {
    const q = (text || input).trim();
    if (!q || loading || !hasApiKey) return;
    sendMessage(q, buildContext());
    setInput("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  /* ── Pair messages into exchanges ── */
  const exchanges = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "assistant") {
      exchanges.push({ question: messages[i-1], answer: messages[i] });
    } else if (i === messages.length - 1 && messages[i].role === "user") {
      exchanges.push({ question: messages[i], answer: null }); // pending
    }
  }

  /* ── Shared right panel ── */
  const RightPanel = (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:0 }}>
      {/* Header */}
      <div style={{ padding:"0 0 14px", borderBottom:"1px solid rgba(255,255,255,0.05)", marginBottom:14, flexShrink:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:9, textTransform:"uppercase",
            letterSpacing:"1.2px", color:"rgba(201,149,106,0.45)" }}>Conversations</div>
          <button onClick={()=>newConversation()}
            style={{ padding:"3px 9px", borderRadius:5, background:"rgba(201,149,106,0.1)",
              border:"1px solid rgba(201,149,106,0.2)", color:"var(--warn)", fontSize:10,
              fontWeight:600, cursor:"pointer" }}>+ New</button>
        </div>
      </div>
      {/* History list */}
      <div className="dispatch-scroll" style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:2 }}>
        {sortedConvs.length === 0 ? (
          <div style={{ fontSize:11, color:"var(--ink-2)", textAlign:"center", padding:"24px 0", lineHeight:1.6 }}>
            Your conversations<br/>will appear here
          </div>
        ) : sortedConvs.map(conv => (
          <HistItem key={conv.id} conv={conv} isActive={conv.id===currentConvId}
            onSelect={id=>{selectConversation(id);setShowHistory(false);}}
            onDelete={deleteConversation} />
        ))}
      </div>
      {/* Context */}
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:14, marginTop:14, flexShrink:0 }}>
        <ContextPanel transactions={transactions} categories={categories} accounts={accounts} />
      </div>
      {/* Key status */}
      {hasApiKey && keyChecked && (
        <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:6, paddingTop:12,
          borderTop:"1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--safe)" }}/>
          <span style={{ fontSize:10, color:"var(--ink-2)" }}>Claude API connected</span>
        </div>
      )}
    </div>
  );

  /* ── Main chat area ── */
  const ChatArea = (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>
      {/* Page header */}
      <div style={{ flexShrink:0, padding:"0 0 0", borderBottom:"1px solid rgba(0,0,0,0.3)",
        background:"radial-gradient(ellipse 55% 120% at 0% 50%,rgba(201,149,106,0.04) 0%,transparent 70%),var(--bg-0,#0b0a08)",
        position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:1,
          background:"linear-gradient(90deg,rgba(201,149,106,0.14),rgba(255,255,255,0.04) 35%,transparent 75%)" }}/>
        <div style={{ position:"absolute", fontFamily:"var(--font-display)", fontStyle:"italic",
          fontSize:64, fontWeight:500, color:"rgba(201,149,106,0.06)", top:"50%",
          transform:"translateY(-50%)", left:6, lineHeight:1, pointerEvents:"none", userSelect:"none" }}>III</div>
        <div style={{ padding:"14px 28px 0", position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:12, paddingBottom:12,
            borderBottom:"1px solid rgba(201,149,106,0.1)" }}>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600,
              color:"rgba(201,149,106,0.45)", letterSpacing:"1px" }}>III ·</span>
            <span style={{ fontFamily:"var(--font-display)", fontStyle:"italic",
              fontWeight:400, fontSize:20, color:"var(--ink-0)" }}>Ask Claude</span>
            <div style={{ flex:1, height:1, background:"linear-gradient(90deg,rgba(201,149,106,0.12),transparent)" }}/>
            {/* Mobile: toggle panels */}
            {isMobile && (
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>setShowCtx(p=>!p)}
                  style={{ fontSize:10, padding:"3px 8px", borderRadius:5, background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.07)", color:"var(--ink-2)", cursor:"pointer" }}>
                  {showCtx?"Hide ctx":"Context"}
                </button>
                <button onClick={()=>setShowHistory(true)}
                  style={{ fontSize:10, padding:"3px 8px", borderRadius:5, background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.07)", color:"var(--ink-2)", cursor:"pointer" }}>
                  History
                </button>
              </div>
            )}
          </div>
          <div style={{ fontFamily:"var(--font-mono)", fontSize:10, textTransform:"uppercase",
            letterSpacing:"0.7px", color:"var(--ink-2)", padding:"6px 0 14px", position:"relative", zIndex:1 }}>
            {!hasApiKey && keyChecked ? "Setup required" : `${transactions.length} transactions · ${categories.length} budgets · ${accounts.length} accounts in context`}
          </div>
        </div>
      </div>

      {/* If no API key — setup screen */}
      {!hasApiKey && keyChecked && (
        <div className="dispatch-scroll" style={{ flex:1, overflowY:"auto" }}>
          <ApiKeySetup onSave={saveApiKey} />
        </div>
      )}

      {/* Conversation area */}
      {(hasApiKey || !keyChecked) && (
        <div className="dispatch-scroll" ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"0 28px" }}>

          {/* Mobile context */}
          {isMobile && showCtx && (
            <div style={{ padding:"16px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", marginBottom:8 }}>
              <ContextPanel transactions={transactions} categories={categories} accounts={accounts} />
            </div>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div style={{ padding:"40px 0 20px" }}>
              <div style={{ fontFamily:"var(--font-display)", fontStyle:"italic",
                fontSize:14, color:"var(--ink-2)", marginBottom:24, lineHeight:1.7 }}>
                I have access to your transactions, budgets, and accounts.
                Ask me anything about your financial picture.
              </div>

              {/* Smart sparks */}
              <div style={{ marginBottom:32 }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:9, textTransform:"uppercase",
                  letterSpacing:"1px", color:"rgba(201,149,106,0.35)", marginBottom:10 }}>
                  {sparks.length > 3 ? "Based on your data" : "Suggested questions"}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {(sparks.length > 0 ? sparks : SUGGESTED_QUESTIONS).map(q => (
                    <button key={q} className="dispatch-spark" onClick={()=>handleSend(q)} disabled={loading}>{q}</button>
                  ))}
                </div>
              </div>

              {/* What I know */}
              <div style={{ borderLeft:"2px solid rgba(201,149,106,0.15)", paddingLeft:14 }}>
                <div style={{ fontFamily:"var(--font-mono)", fontSize:9, textTransform:"uppercase",
                  letterSpacing:"1px", color:"rgba(201,149,106,0.35)", marginBottom:8 }}>What I can see</div>
                {[
                  [`${transactions.length} transactions`, "including this month's activity"],
                  [`${categories.filter(c=>c.limit).length} budget categories`, "with limits and spending totals"],
                  [`${accounts.length} accounts`, "with current balances"],
                ].map(([val, label]) => (
                  <div key={val} style={{ display:"flex", gap:10, marginBottom:6, fontSize:12 }}>
                    <span style={{ fontFamily:"var(--font-mono)", fontSize:12, fontWeight:600, color:"var(--warn)", flexShrink:0 }}>{val}</span>
                    <span style={{ color:"var(--ink-2)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exchanges */}
          {exchanges.map(({ question, answer }, i) => {
            if (!answer) {
              // Pending — show just the question
              return (
                <div key={`q${i}`} className="dispatch-exchange">
                  <div style={{ display:"flex", gap:14, marginBottom:20 }}>
                    <div style={{ width:2, background:"rgba(201,149,106,0.3)", flexShrink:0, borderRadius:1, marginTop:4 }}/>
                    <div style={{ fontFamily:"var(--font-display)", fontStyle:"italic",
                      fontWeight:400, fontSize:18, lineHeight:1.5, color:"var(--ink-0)" }}>
                      {question?.content}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:14 }}>
                    <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(201,149,106,0.1)",
                        border:"1px solid rgba(201,149,106,0.25)", display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:10, fontWeight:800, color:"var(--warn)" }}>ℓ</div>
                    </div>
                    <div>
                      <div style={{ fontFamily:"var(--font-mono)", fontSize:9, textTransform:"uppercase",
                        letterSpacing:"1px", color:"rgba(201,149,106,0.4)", marginBottom:10 }}>✦ Claude</div>
                      <div className="dispatch-dots" style={{ color:"rgba(232,221,208,0.4)", fontSize:14 }}>
                        <span style={{ animationDelay:"0s" }}>●</span>
                        <span style={{ animationDelay:"0.2s" }}>●</span>
                        <span style={{ animationDelay:"0.4s" }}>●</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={`e${i}`} className="dispatch-exchange">
                {question && (
                  <div style={{ display:"flex", gap:14, marginBottom:20 }}>
                    <div style={{ width:2, background:"rgba(201,149,106,0.3)", flexShrink:0, borderRadius:1, marginTop:4 }}/>
                    <div style={{ fontFamily:"var(--font-display)", fontStyle:"italic",
                      fontWeight:400, fontSize:18, lineHeight:1.5, color:"var(--ink-0)" }}>
                      {question.content}
                    </div>
                  </div>
                )}
                <div style={{ display:"flex", gap:14 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0 }}>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(201,149,106,0.1)",
                      border:"1px solid rgba(201,149,106,0.25)", display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:10, fontWeight:800, color:"var(--warn)" }}>ℓ</div>
                    <div style={{ flex:1, width:1, background:"rgba(255,255,255,0.04)", minHeight:16 }}/>
                  </div>
                  <div style={{ flex:1, paddingBottom:4 }}>
                    <div style={{ fontFamily:"var(--font-mono)", fontSize:9, textTransform:"uppercase",
                      letterSpacing:"1px", color:"rgba(201,149,106,0.4)", marginBottom:10 }}>✦ Claude</div>
                    <div className="dispatch-response">{renderProse(answer.content)}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Error */}
          {error && (
            <div style={{ padding:"12px 14px", borderLeft:"2px solid var(--debt)",
              background:"rgba(224,112,112,0.06)", margin:"12px 0", fontSize:13, color:"var(--debt)" }}>
              {error.includes("invalid_api_key")||error.includes("401") ? "Invalid API key — please check your key."
               : error.includes("overloaded") ? "Claude is busy — try again in a moment."
               : error}
            </div>
          )}

          <div ref={bottomRef} style={{ height:8 }} />
        </div>
      )}

      {/* ── Composer ── */}
      {hasApiKey && (
        <div style={{ flexShrink:0, borderTop:"1px solid rgba(255,255,255,0.06)",
          background:"var(--bg-0,#0b0a08)", padding:"16px 28px 20px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:14, color:"rgba(201,149,106,0.4)",
              paddingTop:2, flexShrink:0 }}>✦</span>
            <textarea ref={inputRef} className="dispatch-input-field"
              value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || !hasApiKey}
              rows={1}
              placeholder="What would you like to know?"
              style={{ maxHeight:120, overflow:"auto", colorScheme:"dark" }} />
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              {messages.length > 0 && (
                <button onClick={()=>(clearCurrentConversation||clearHistory)?.()}
                  style={{ padding:"6px 10px", borderRadius:6, background:"none",
                    border:"1px solid rgba(255,255,255,0.07)", color:"var(--ink-2)",
                    fontSize:11, cursor:"pointer" }} title="Clear">✕</button>
              )}
              <button onClick={()=>handleSend()}
                disabled={!input.trim()||loading}
                style={{ padding:"6px 14px", borderRadius:6, background:"var(--warn)",
                  color:"#000", border:"none", fontWeight:700, fontSize:13, cursor:"pointer",
                  opacity:(!input.trim()||loading)?0.4:1, transition:"opacity .12s" }}>
                {loading?"…":"↑"}
              </button>
            </div>
          </div>
          {/* Spark chips when empty — show below input */}
          {isEmpty && !loading && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:12, paddingLeft:26 }}>
              {(sparks.length > 0 ? sparks : SUGGESTED_QUESTIONS).slice(0,4).map(q => (
                <button key={q} className="dispatch-spark"
                  onClick={()=>handleSend(q)} style={{ fontSize:10 }}>{q}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ── Layout ── */
  const height = isMobile ? "calc(100dvh - 120px)" : "calc(100dvh - 92px)";

  if (isMobile) {
    return (
      <div style={{ width:"100%", height, display:"flex", flexDirection:"column" }}>
        {ChatArea}
        {/* History drawer */}
        {showHistory && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200 }}
            onClick={e=>{if(e.target===e.currentTarget)setShowHistory(false);}}>
            <div style={{ position:"absolute", right:0, top:0, bottom:0, width:"82%", maxWidth:320,
              background:"var(--bg-2)", padding:"16px 14px", display:"flex", flexDirection:"column" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <span style={{ fontFamily:"var(--font-mono)", fontSize:10, textTransform:"uppercase",
                  letterSpacing:"1px", color:"rgba(201,149,106,0.45)" }}>Conversations</span>
                <button onClick={()=>setShowHistory(false)}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"var(--ink-2)", fontSize:16 }}>✕</button>
              </div>
              <div style={{ flex:1, overflowY:"auto" }}>{RightPanel}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width:"100%", height, display:"flex", gap:0, overflow:"hidden" }}>
      {/* Main */}
      <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {ChatArea}
      </div>
      {/* Right panel */}
      <div style={{ width:280, flexShrink:0, borderLeft:"1px solid rgba(255,255,255,0.05)",
        padding:"20px 16px", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {RightPanel}
      </div>
    </div>
  );
}
