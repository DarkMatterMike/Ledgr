/**
 * AiChat.jsx
 *
 * AI assistant page — chat with Claude about your financial data.
 * Includes API key management at the top of the page.
 */

import { useState, useEffect, useRef } from "react";

const S = {
  btn: (v = "ghost", sm = false) => {
    const base = {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      gap: 6, padding: sm ? "6px 14px" : "10px 18px", borderRadius: "var(--radius)",
      fontSize: 13, fontWeight: 500, cursor: "pointer", border: "1px solid transparent",
      transition: "all 0.15s", userSelect: "none", whiteSpace: "nowrap",
      WebkitTapHighlightColor: "transparent",
    };
    if (v === "primary") return { ...base, background: "var(--cyan)", color: "#000", borderColor: "var(--cyan)" };
    if (v === "danger")  return { ...base, background: "var(--red-dim)", color: "var(--red)", borderColor: "#ff4d6d44" };
    return { ...base, background: "transparent", color: "var(--t2)", borderColor: "var(--border2)" };
  },
  input: {
    background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: "var(--radius)",
    padding: "10px 12px", fontSize: 14, color: "var(--t1)", outline: "none", width: "100%",
  },
  card: {
    background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: 16,
  },
};

function ApiKeySection({ hasApiKey, keyChecked, onSave, isMobile }) {
  const [editing, setEditing]   = useState(false);
  const [keyVal,  setKeyVal]    = useState("");
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState(null);
  const [saved,   setSaved]     = useState(false);

  // Once the key check resolves, show input only if no key exists
  useEffect(() => {
    if (keyChecked) setEditing(!hasApiKey);
  }, [keyChecked, hasApiKey]);

  async function handleSave() {
    if (!keyVal.trim()) return;
    setSaving(true); setError(null);
    try {
      await onSave(keyVal.trim());
      setSaved(true);
      setKeyVal("");
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!keyChecked) return null;

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: hasApiKey ? "var(--green)" : "var(--t3)",
          }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
              Claude API Key
            </div>
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
          <input
            style={{ ...S.input, flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}
            type="password"
            placeholder="sk-ant-api03-..."
            value={keyVal}
            onChange={e => setKeyVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            autoFocus
          />
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {hasApiKey && (
              <button style={S.btn("ghost", true)} onClick={() => { setEditing(false); setKeyVal(""); }}>
                Cancel
              </button>
            )}
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
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
            style={{ color: "var(--cyan)" }}>console.anthropic.com</a>.
          Your key is encrypted and stored securely — it's never exposed to the browser after saving.
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          background: "var(--cyan-dim)", border: "1.5px solid var(--cyan)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, color: "var(--cyan)",
          fontFamily: "var(--font-disp)", marginRight: 8, marginTop: 2,
        }}>
          ℓ
        </div>
      )}
      <div style={{
        maxWidth: "80%",
        background: isUser ? "var(--cyan)" : "var(--card)",
        color: isUser ? "#000" : "var(--t1)",
        border: isUser ? "none" : "1px solid var(--border)",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "10px 14px",
        fontSize: 14,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {msg.content || (
          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ animation: "ledgr-breathe 1s ease-in-out infinite", display: "inline-block" }}>●</span>
            <span style={{ animation: "ledgr-breathe 1s ease-in-out 0.2s infinite", display: "inline-block" }}>●</span>
            <span style={{ animation: "ledgr-breathe 1s ease-in-out 0.4s infinite", display: "inline-block" }}>●</span>
          </span>
        )}
      </div>
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
  messages, hasApiKey, keyChecked, loading, error,
  checkApiKey, saveApiKey, sendMessage, clearHistory,
  transactions, categories, accounts, catMap, acctMap,
  isMobile,
}) {
  const [input, setInput] = useState("");
  const bottomRef         = useRef(null);
  const inputRef          = useRef(null);

  useEffect(() => { checkApiKey(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function buildContext() {
    // Send a summary of user data — not the full dataset to save tokens
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

    const thisMonthTxns = transactions.filter(t => t.date?.startsWith(thisMonth));
    const lastMonthTxns = transactions.filter(t => t.date?.startsWith(lastMonthStr));

    const spentByCat = {};
    transactions.forEach(t => {
      if (t.amount < 0 && t.categoryId) {
        spentByCat[t.categoryId] = (spentByCat[t.categoryId] || 0) + Math.abs(t.amount);
      }
    });

    return {
      currentMonth: thisMonth,
      categories: categories.map(c => ({
        id: c.id, name: c.name, limit: c.limit,
        spent: Math.round((spentByCat[c.id] || 0) * 100) / 100,
      })),
      accounts: accounts.map(a => ({ name: a.name, type: a.type, balance: a.balance })),
      thisMonthTransactions: thisMonthTxns.slice(0, 100).map(t => ({
        date: t.date,
        merchant: t.name || t.merchant,
        amount: t.amount,
        category: catMap[t.categoryId]?.name || null,
        pending: t.pending || false,
      })),
      lastMonthTransactions: lastMonthTxns.slice(0, 50).map(t => ({
        date: t.date,
        merchant: t.name || t.merchant,
        amount: t.amount,
        category: catMap[t.categoryId]?.name || null,
      })),
      totalTransactions: transactions.length,
      recentTransactions: transactions.slice(0, 20).map(t => ({
        date: t.date,
        merchant: t.name || t.merchant,
        amount: t.amount,
        category: catMap[t.categoryId]?.name || null,
      })),
    };
  }

  function handleSend() {
    if (!input.trim() || loading || !hasApiKey) return;
    sendMessage(input.trim(), buildContext());
    setInput("");
  }

  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxHeight: isMobile ? "calc(100vh - 120px)" : "calc(100vh - 80px)" }}>

      {/* API Key section */}
      <ApiKeySection
        hasApiKey={hasApiKey}
        keyChecked={keyChecked}
        onSave={saveApiKey}
        isMobile={isMobile}
      />

      {/* Chat area */}
      <div style={{ ...S.card, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {isEmpty && hasApiKey && (
            <div style={{ textAlign: "center", padding: "32px 16px" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
              <div style={{ fontFamily: "var(--font-disp)", fontSize: 16, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>
                Ask me anything about your finances
              </div>
              <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 24, lineHeight: 1.6 }}>
                I have access to your transactions, budgets, and accounts for this conversation.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {SUGGESTED_QUESTIONS.map(q => (
                  <button key={q}
                    style={{
                      ...S.btn("ghost", true),
                      fontSize: 12, textAlign: "left", whiteSpace: "normal",
                      maxWidth: isMobile ? "100%" : 220,
                    }}
                    onClick={() => { sendMessage(q, buildContext()); }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isEmpty && !hasApiKey && keyChecked && (
            <div style={{ padding: "24px 8px", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>✦</div>
                <div style={{ fontFamily: "var(--font-disp)", fontSize: 17, fontWeight: 800, color: "var(--t1)", marginBottom: 6 }}>
                  Set up your AI assistant
                </div>
                <div style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.6 }}>
                  Ledgr uses Claude by Anthropic to answer questions about your financial data.
                  You'll need a free API key to get started — it takes about 2 minutes.
                </div>
              </div>

              {/* Steps */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {[
                  {
                    step: "1",
                    title: "Create an Anthropic account",
                    body: "Go to console.anthropic.com and sign up for a free account.",
                    link: { label: "Open Anthropic Console →", url: "https://console.anthropic.com" },
                  },
                  {
                    step: "2",
                    title: "Generate an API key",
                    body: "Once logged in, go to API Keys in the left sidebar and click \"Create Key\". Give it any name you like.",
                  },
                  {
                    step: "3",
                    title: "Paste it above",
                    body: "Copy your key — it starts with sk-ant-api03- — and paste it into the field above, then click Save Key.",
                  },
                ].map(s => (
                  <div key={s.step} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    background: "var(--surface)", borderRadius: "var(--radius)", padding: "12px 14px",
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                      background: "var(--cyan)", color: "#000",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 800, fontFamily: "var(--font-mono)",
                    }}>{s.step}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>{s.body}</div>
                      {s.link && (
                        <a href={s.link.url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: "var(--cyan)", marginTop: 6, display: "inline-block" }}>
                          {s.link.label}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pricing note */}
              <div style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "12px 14px",
                fontSize: 12, color: "var(--t3)", lineHeight: 1.6,
              }}>
                <span style={{ color: "var(--t2)", fontWeight: 600 }}>What does it cost?</span>{" "}
                Anthropic offers $5 in free credits when you sign up — enough for thousands of questions.
                After that, usage is pay-as-you-go and very inexpensive. A typical conversation costs less than a fraction of a cent.
                Your key is stored encrypted on our servers and never shared.
              </div>
            </div>
          )}

          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

          {error && (
            <div style={{
              background: "var(--red-dim)", border: "1px solid #ff4d6d44",
              borderRadius: "var(--radius)", padding: "10px 14px",
              fontSize: 13, color: "var(--red)", marginBottom: 12,
            }}>
              {error.includes("invalid_api_key") || error.includes("401")
                ? "Invalid API key — please check your key and try again."
                : error.includes("overloaded")
                ? "Claude is busy right now — try again in a moment."
                : error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", flexShrink: 0 }} />

        {/* Input */}
        <div style={{ padding: "12px 16px", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={hasApiKey ? "Ask about your spending, budgets, or transactions…" : "Add your API key above to start chatting"}
            disabled={!hasApiKey || loading}
            rows={1}
            style={{
              ...S.input,
              flex: 1, resize: "none", lineHeight: 1.5,
              fontFamily: "var(--font-body)", fontSize: 14,
              maxHeight: 120, overflow: "auto",
              opacity: hasApiKey ? 1 : 0.5,
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <button
              style={{ ...S.btn("primary", true), padding: "10px 14px" }}
              onClick={handleSend}
              disabled={!hasApiKey || !input.trim() || loading}>
              {loading ? "…" : "↑"}
            </button>
            {messages.length > 0 && (
              <button
                style={{ ...S.btn("ghost", true), padding: "6px 10px", fontSize: 11 }}
                onClick={clearHistory}
                title="Clear conversation">
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
