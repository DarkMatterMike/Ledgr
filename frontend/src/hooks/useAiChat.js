/**
 * useAiChat
 *
 * Manages AI chat with multiple saved conversation threads.
 * Each conversation has an id, auto-generated title, and message history.
 * Persisted server-side via scheduleSave.
 */

import { useState, useCallback, useRef } from "react";

const BASE = "https://ledgr-production-9e35.up.railway.app";

function authHeaders() {
  const token = localStorage.getItem("ledgr_token") || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function makeId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeTitle(text) {
  return text.trim().slice(0, 45) + (text.trim().length > 45 ? "…" : "");
}

export function useAiChat(scheduleSave) {
  const [conversations,   setConversations]   = useState([]);
  const [currentConvId,   setCurrentConvId]   = useState(null);
  const [hasApiKey,       setHasApiKey]       = useState(false);
  const [keyChecked,      setKeyChecked]      = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [streaming,       setStreaming]       = useState(false);

  // Stable ref so sendMessage closure always sees latest conversations
  const convsRef = useRef(conversations);
  convsRef.current = conversations;
  const currentConvIdRef = useRef(currentConvId);
  currentConvIdRef.current = currentConvId;

  // ── Derived ──────────────────────────────────────────────────────

  const currentConv = conversations.find(c => c.id === currentConvId) || null;
  const messages    = currentConv?.messages || [];

  // ── Load from server data ────────────────────────────────────────

  function loadFromData(data) {
    if (data.aiConversations?.length) {
      setConversations(data.aiConversations);
      const activeId = data.aiCurrentConvId || data.aiConversations[0]?.id || null;
      setCurrentConvId(activeId);
    } else if (data.aiMessages?.length) {
      // Migrate legacy single-thread to multi-conversation format
      const id    = makeId();
      const title = data.aiMessages.find(m => m.role === "user")?.content?.slice(0, 45) || "Previous conversation";
      const migrated = [{ id, title, createdAt: data.aiMessages[0]?.ts || Date.now(), messages: data.aiMessages }];
      setConversations(migrated);
      setCurrentConvId(id);
    }
    if (typeof data.hasAiKey === "boolean") {
      setHasApiKey(data.hasAiKey);
      setKeyChecked(true);
    }
  }

  // ── API key ──────────────────────────────────────────────────────

  async function checkApiKey() {
    if (keyChecked) return;
    try {
      const res  = await fetch(`${BASE}/api/ai/key`, { headers: authHeaders() });
      const data = await res.json();
      setHasApiKey(!!data.hasKey);
      setKeyChecked(true);
    } catch {
      setKeyChecked(true);
    }
  }

  async function saveApiKey(key) {
    const res = await fetch(`${BASE}/api/ai/key`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save key");
    }
    setHasApiKey(!!key);
    setKeyChecked(true);
  }

  // ── Conversation management ──────────────────────────────────────

  function newConversation() {
    const id   = makeId();
    const conv = { id, title: "New conversation", createdAt: Date.now(), messages: [] };
    const next = [conv, ...convsRef.current];
    setConversations(next);
    setCurrentConvId(id);
    scheduleSave({ aiConversations: next.slice(0, 30), aiCurrentConvId: id });
    setError(null);
    return id;
  }

  function selectConversation(id) {
    setCurrentConvId(id);
    setError(null);
    scheduleSave({ aiCurrentConvId: id });
  }

  function deleteConversation(id) {
    const next      = convsRef.current.filter(c => c.id !== id);
    const isActive  = currentConvIdRef.current === id;
    const newActive = isActive ? (next[0]?.id || null) : currentConvIdRef.current;
    setConversations(next);
    if (isActive) setCurrentConvId(newActive);
    scheduleSave({ aiConversations: next.slice(0, 30), ...(isActive ? { aiCurrentConvId: newActive } : {}) });
  }

  function clearCurrentConversation() {
    const convId = currentConvIdRef.current;
    if (!convId) return;
    const next = convsRef.current.map(c => c.id === convId ? { ...c, messages: [], title: "New conversation" } : c);
    setConversations(next);
    scheduleSave({ aiConversations: next.slice(0, 30) });
    setError(null);
  }

  // ── Send message ─────────────────────────────────────────────────

  const sendMessage = useCallback(async (text, contextData) => {
    if (!text.trim() || loading) return;
    setError(null);

    // Get or create active conversation
    let convId    = currentConvIdRef.current;
    let convList  = convsRef.current;

    if (!convId || !convList.find(c => c.id === convId)) {
      const id   = makeId();
      const conv = { id, title: makeTitle(text), createdAt: Date.now(), messages: [] };
      convList   = [conv, ...convList];
      setConversations(convList);
      setCurrentConvId(id);
      convId = id;
    }

    const conv         = convList.find(c => c.id === convId);
    const prevMessages = conv?.messages || [];
    const isFirstMsg   = prevMessages.filter(m => m.role === "user").length === 0;
    const title        = isFirstMsg ? makeTitle(text) : (conv?.title || makeTitle(text));

    const userMsg      = { role: "user",      content: text.trim(), ts: Date.now() };
    const placeholder  = { role: "assistant", content: "",          ts: Date.now() };
    const withUser     = [...prevMessages, userMsg];
    const withBoth     = [...withUser, placeholder];

    // Optimistic update
    const updateList = (msgs) =>
      convList.map(c => c.id === convId ? { ...c, title, messages: msgs } : c);

    setConversations(updateList(withBoth));
    setLoading(true);
    setStreaming(true);

    try {
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          message: text.trim(),
          history: prevMessages.slice(-20),
          context: contextData,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const delta  = parsed.delta || parsed.text || "";
              if (delta) {
                fullContent += delta;
                setConversations(prev => prev.map(c =>
                  c.id !== convId ? c : {
                    ...c, title,
                    messages: c.messages.map((m, i) =>
                      i === c.messages.length - 1 ? { ...m, content: fullContent } : m
                    ),
                  }
                ));
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      // Final save
      const finalMessages = [...withUser, { ...placeholder, content: fullContent }];
      const finalList     = convList.map(c =>
        c.id === convId ? { ...c, title, messages: finalMessages.slice(-60) } : c
      );
      setConversations(finalList);
      scheduleSave({ aiConversations: finalList.slice(0, 30), aiCurrentConvId: convId });

    } catch (e) {
      setError(e.message);
      setConversations(updateList(withUser)); // remove placeholder on error
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [loading, scheduleSave]);

  // Legacy clearHistory alias
  function clearHistory() { clearCurrentConversation(); }

  return {
    // Legacy single-thread compat
    messages,
    // Multi-conversation
    conversations,
    currentConvId,
    currentConv,
    newConversation,
    selectConversation,
    deleteConversation,
    clearCurrentConversation,
    // API key
    hasApiKey, keyChecked,
    // Chat state
    loading, streaming, error,
    // Actions
    checkApiKey, saveApiKey,
    sendMessage, clearHistory,
    loadFromData,
    // Setters (for onData restore)
    setConversations, setCurrentConvId,
  };
}
