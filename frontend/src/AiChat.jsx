/**
 * AiChat.jsx
 *
 * AI assistant page — chat with Claude about your financial data.
 * Desktop: two-column layout (chat left, conversation history right).
 * Mobile: single column with a history drawer.
 */

import { useState, useEffect, useRef } from "react";

const S = {
  btn: (v = "ghost", sm = false) => {
    const base = {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      gap: 5, padding: sm ? "3px 8px" : "5px 11px", borderRadius: "var(--radius)",
      fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid transparent",
      transition: "all 0.15s", userSelect: "none", whiteSpace: "nowrap",
      WebkitTapHighlightColor: "transparent",
    };
    if (v === "primary") return { ...base, background: "var(--cyan)",    color: "#000",        borderColor: "var(--cyan)" };
    if (v === "danger")  return { ...base, background: "var(--red-dim)", color: "var(--red)",  borderColor: "#ff4d6d44" };
    return { ...base, background: "transparent", color: "var(--t2)", borderColor: "var(--border2)" };
  },
  input: {
    background: "var(--surface)", borderRadius: "var(--radius)",
    padding: "7px 10px", fontSize: 12, color: "var(--t1)", outline: "none", width: "100%",
  },
  card: {
    background:"var(--card)",
    borderRadius: "var(--radius)", padding: "10px 14px",
  },
};

function ApiKeySection({ hasApiKey, keyChecked, onSave, isMobile }) {
  const [editing, setEditing] = useState(false);
  const [keyVal,  setKeyVal]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => { if (keyChecked) setEditing(!hasApiKey); }, [keyChecked, hasApiKey]);

  async function handleSave() {
    if (!keyVal.trim()) return;
    setSaving(true); setError(null);
    try {
      await onSave(keyVal.trim());
      setSaved(true); setKeyVal(""); setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally { setSaving(false); }
  }

  if (!keyChecked) return null;
  return (
    <div className="obsidian-card" style={{ ...S.card, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: hasApiKey ? "var(--green)" : "var(--t3)" }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Claude API Key</div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 1 }}>
              {hasApiKey ? "Key saved — your data stays private" : "Required to use the AI assistant"}
            </div>
          </div>
        </div>
        {hasApiKey && !editing && (
          <button style={S.btn("ghost", true)} onClick={() => setEditing(true)}>
            {saved ? "✓ Saved" : "Replace Key"}
          </button>
        )}
      </div>
      {editing && (
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8 }}>
          <input style={{ ...S.input, flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
            type="password" placeholder="sk-ant-api03-…"
            value={keyVal} onChange={e => setKeyVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()} autoFocus />
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {hasApiKey && <button style={S.btn("ghost", true)} onClick={() => { setEditing(false); setKeyVal(""); }}>Cancel</button>}
            <button style={S.btn("primary", true)} onClick={handleSave} disabled={saving || !keyVal.trim()}>
              {saving ? "Saving…" : "Save Key"}
            </button>
          </div>
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 8 }}>{error}</div>}
      {!hasApiKey && !editing && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--t3)", lineHeight: 1.6 }}>
          Get your API key at{" "}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
            console.anthropic.com
          </a>. Your key is encrypted and stored securely.
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          background: "var(--cyan-dim)", border: "1.5px solid var(--cyan)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "var(--cyan)",
          fontFamily: "var(--font-disp)", marginRight: 8, marginTop: 2,
        }}>ℓ</div>
      )}
      <div style={{
        maxWidth: "80%",
        background: isUser ? "var(--cyan)" : "var(--card)",
        color: isUser ? "#000" : "var(--t1)",
        border: isUser ? "none" : "1px solid var(--border)",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "8px 12px", fontSize: 13, lineHeight: 1.55,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {msg.content || (
          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[0, 0.2, 0.4].map((d, i) => (
              <span key={i} style={{ animation: `ledgr-breathe 1s ease-in-out ${d}s infinite`, display: "inline-block" }}>●</span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function ConversationItem({ conv, isActive, onSelect, onDelete }) {
  const preview = conv.messages.find(m => m.role === "user")?.content || "Empty conversation";
  const date    = new Date(conv.createdAt);
  const now     = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const dateStr = isToday
    ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div
      onClick={() => onSelect(conv.id)}
      style={{
        padding: "7px 10px",
        borderRadius: "var(--radius)",
        background: isActive ? "var(--cyan-dim)" : "transparent",
        border: `1px solid ${isActive ? "var(--cyan)33" : "transparent"}`,
        cursor: "pointer",
        transition: "background 0.12s",
        position: "relative",
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--surface)"; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
        <div style={{
          fontSize: 12, fontWeight: 600,
          color: isActive ? "var(--cyan)" : "var(--t1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
        }}>
          {conv.title || "Untitled"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "var(--t3)", whiteSpace: "nowrap" }}>{dateStr}</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--t3)", fontSize: 12, padding: "1px 3px", lineHeight: 1,
              opacity: 0, transition: "opacity 0.1s",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--red)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "0"; e.currentTarget.style.color = "var(--t3)"; }}>
            ✕
          </button>
        </div>
      </div>
      <div style={{
        fontSize: 11, color: "var(--t3)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {preview.slice(0, 60)}{preview.length > 60 ? "…" : ""}
      </div>
      {conv.messages.length > 0 && (
        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
          {Math.ceil(conv.messages.length / 2)} message{Math.ceil(conv.messages.length / 2) !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

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
  newConversation, selectConversation, deleteConversation, clearCurrentConversation,
  clearHistory,
  transactions, categories, accounts, catMap, acctMap,
  isMobile,
}) {
  const [input,       setInput]       = useState("");
  const [showHistory, setShowHistory] = useState(false); // mobile history drawer
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { checkApiKey(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function buildContext() {
    const now          = new Date();
    const thisMonth    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthD   = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthD.getFullYear()}-${String(lastMonthD.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthTxns = transactions.filter(t => t.date?.startsWith(thisMonth));
    const lastMonthTxns = transactions.filter(t => t.date?.startsWith(lastMonthStr));
    const spentByCat = {};
    transactions.forEach(t => {
      if (t.amount < 0 && t.categoryId)
        spentByCat[t.categoryId] = (spentByCat[t.categoryId] || 0) + Math.abs(t.amount);
    });
    return {
      currentMonth: thisMonth,
      categories: categories.map(c => ({ id: c.id, name: c.name, limit: c.limit, spent: Math.round((spentByCat[c.id] || 0) * 100) / 100 })),
      accounts: accounts.map(a => ({ name: a.name, type: a.type, balance: a.balance })),
      thisMonthTransactions: thisMonthTxns.slice(0, 100).map(t => ({ date: t.date, merchant: t.name || t.merchant, amount: t.amount, category: catMap[t.categoryId]?.name || null, pending: t.pending || false })),
      lastMonthTransactions: lastMonthTxns.slice(0, 50).map(t => ({ date: t.date, merchant: t.name || t.merchant, amount: t.amount, category: catMap[t.categoryId]?.name || null })),
      totalTransactions: transactions.length,
      recentTransactions: transactions.slice(0, 20).map(t => ({ date: t.date, merchant: t.name || t.merchant, amount: t.amount, category: catMap[t.categoryId]?.name || null })),
    };
  }

  function handleSend() {
    if (!input.trim() || loading || !hasApiKey) return;
    sendMessage(input.trim(), buildContext());
    setInput("");
  }

  const isEmpty = messages.length === 0;
  const sortedConvs = [...(conversations || [])].sort((a, b) => b.createdAt - a.createdAt);

  // ── History panel (used in both mobile drawer and desktop right column) ──
  const HistoryPanel = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "0 0 12px", borderBottom: "1px solid var(--border)", marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "2px" }}>
            Conversations
          </div>
          <button
            style={{ ...S.btn("primary", true), fontSize: 12, padding: "5px 12px" }}
            onClick={() => { newConversation(); setShowHistory(false); }}>
            + New
          </button>
        </div>
      </div>
      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {sortedConvs.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--t3)", textAlign: "center", padding: "24px 8px" }}>
            No conversations yet
          </div>
        ) : sortedConvs.map(conv => (
          <ConversationItem
            key={conv.id}
            conv={conv}
            isActive={conv.id === currentConvId}
            onSelect={id => { selectConversation(id); setShowHistory(false); }}
            onDelete={deleteConversation}
          />
        ))}
      </div>
    </div>
  );

  // ── Chat panel ──────────────────────────────────────────────────
  const ChatPanel = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* API Key */}
      <ApiKeySection hasApiKey={hasApiKey} keyChecked={keyChecked} onSave={saveApiKey} isMobile={isMobile} />

      {/* Chat area */}
      <div className="obsidian-card" style={{ ...S.card, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {isEmpty && hasApiKey && (
            <div style={{ textAlign: "center", padding: "32px 16px" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✦</div>
              <div style={{ fontFamily: "var(--font-disp)", fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 4 }}>
                Ask me anything about your finances
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14, lineHeight: 1.5 }}>
                I have access to your transactions, budgets, and accounts for this conversation.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q}
                    style={{ ...S.btn("ghost", true), fontSize: 12, textAlign: "left", whiteSpace: "normal", maxWidth: isMobile ? "100%" : 220 }}
                    onClick={() => sendMessage(q, buildContext())}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEmpty && !hasApiKey && keyChecked && (
            <div style={{ padding: "24px 8px", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>✦</div>
                <div style={{ fontFamily: "var(--font-disp)", fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 4 }}>
                  Set up your AI assistant
                </div>
                <div style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.6 }}>
                  Ledgr uses Claude by Anthropic to answer questions about your financial data.
                  You'll need a free API key to get started.
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {[
                  { step: "1", title: "Create an Anthropic account", body: "Go to console.anthropic.com and sign up for a free account.", link: { label: "Open Anthropic Console →", url: "https://console.anthropic.com" } },
                  { step: "2", title: "Generate an API key",         body: "Once logged in, go to API Keys and click \"Create Key\"." },
                  { step: "3", title: "Paste it above",              body: "Copy your key (starts with sk-ant-api03-) and paste it into the field above." },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--surface)", borderRadius: "var(--radius)", padding: "8px 12px" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "var(--cyan)", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, fontFamily: "var(--font-mono)" }}>{s.step}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>{s.body}</div>
                      {s.link && <a href={s.link.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--cyan)", marginTop: 6, display: "inline-block" }}>{s.link.label}</a>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background:"var(--card)", borderRadius: "var(--radius)", padding: "12px 14px", fontSize: 12, color: "var(--t3)", lineHeight: 1.6 }}>
                <span style={{ color: "var(--t2)", fontWeight: 600 }}>What does it cost?</span>{" "}
                Anthropic offers $5 in free credits when you sign up — enough for thousands of questions. Your key is encrypted on our servers.
              </div>
            </div>
          )}

          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

          {error && (
            <div style={{ background: "var(--red-dim)", border: "1px solid #ff4d6d44", borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, color: "var(--red)", marginBottom: 12 }}>
              {error.includes("invalid_api_key") || error.includes("401") ? "Invalid API key — please check your key and try again."
                : error.includes("overloaded") ? "Claude is busy right now — try again in a moment."
                : error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", flexShrink: 0 }} />

        {/* Input */}
        <div style={{ padding: "8px 12px", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
          {/* Mobile: history button */}
          {isMobile && (
            <button style={{ ...S.btn("ghost", true), padding: "7px 10px", flexShrink: 0 }} onClick={() => setShowHistory(true)}>
              ☰
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={hasApiKey ? "Ask about your spending, budgets, or transactions…" : "Add your API key above to start chatting"}
            disabled={!hasApiKey || loading}
            rows={1}
            style={{ ...S.input, flex: 1, resize: "none", lineHeight: 1.5, fontFamily: "var(--font-body)", fontSize: 13, maxHeight: 120, overflow: "auto", opacity: hasApiKey ? 1 : 0.5 }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <button style={{ ...S.btn("primary", true), padding: "6px 12px" }} onClick={handleSend} disabled={!hasApiKey || !input.trim() || loading}>
              {loading ? "…" : "↑"}
            </button>
            {messages.length > 0 && (
              <button style={{ ...S.btn("ghost", true), padding: "6px 10px", fontSize: 11 }}
                onClick={() => clearCurrentConversation?.() || clearHistory?.()}
                title="Clear conversation">✕</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", height: isMobile ? "calc(100vh - 120px)" : "calc(100vh - 92px)", display: "flex", flexDirection: "column" }}>
      {isMobile ? (
        <>
          {ChatPanel}
          {/* Mobile history drawer */}
          {showHistory && (
            <div style={{ position: "fixed", inset: 0, background: "#00000080", zIndex: 200, display: "flex" }}
              onClick={e => { if (e.target === e.currentTarget) setShowHistory(false); }}>
              <div style={{ width: "80%", maxWidth: 300, background:"var(--card)", height: "100%", padding: "10px 14px", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, color: "var(--t1)" }}>Conversations</span>
                  <button style={{ ...S.btn("ghost", true), padding: "4px 8px" }} onClick={() => setShowHistory(false)}>✕</button>
                </div>
                {HistoryPanel}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Desktop: two-column layout */
        <div style={{ display: "flex", gap: 16, height: "100%", alignItems: "stretch" }}>
          {/* Left: chat */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {ChatPanel}
          </div>
          {/* Right: conversation history */}
          <div style={{ width: 280, flexShrink: 0, background:"var(--card)", borderRadius: "var(--radius)", padding: "10px 14px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {HistoryPanel}
          </div>
        </div>
      )}
    </div>
  );
}
