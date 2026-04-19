/**
 * useAiChat
 *
 * Manages AI chat conversation history and API key state.
 * Conversation history persists server-side via scheduleSave.
 * API key is stored encrypted server-side — client only knows if one exists.
 */

import { useState, useCallback } from "react";

const BASE = "https://ledgr-production-9e35.up.railway.app";

function authHeaders() {
  const token = localStorage.getItem("ledgr_token") || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function useAiChat(scheduleSave) {
  const [messages,    setMessages]    = useState([]);
  const [hasApiKey,   setHasApiKey]   = useState(false);
  const [keyChecked,  setKeyChecked]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [streaming,   setStreaming]   = useState(false);

  // ── Load from server data ────────────────────────────────────────

  function loadFromData(data) {
    if (data.aiMessages) setMessages(data.aiMessages);
    if (typeof data.hasAiKey === "boolean") {
      setHasApiKey(data.hasAiKey);
      setKeyChecked(true);
    }
  }

  // ── Check if key exists on mount ────────────────────────────────

  async function checkApiKey() {
    if (keyChecked) return;
    try {
      const res = await fetch(`${BASE}/api/ai/key`, { headers: authHeaders() });
      const data = await res.json();
      setHasApiKey(!!data.hasKey);
      setKeyChecked(true);
    } catch (e) {
      setKeyChecked(true);
    }
  }

  // ── Save API key ─────────────────────────────────────────────────

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

  // ── Send message ─────────────────────────────────────────────────

  const sendMessage = useCallback(async (text, contextData) => {
    if (!text.trim() || loading) return;
    setError(null);

    const userMsg = { role: "user", content: text.trim(), ts: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    // Placeholder assistant message for streaming
    const assistantMsg = { role: "assistant", content: "", ts: Date.now() };
    setMessages([...nextMessages, assistantMsg]);
    setLoading(true);
    setStreaming(true);

    try {
      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-20), // last 20 messages for context window
          context: contextData,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }

      // Stream the response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE chunks
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.delta || parsed.text || "";
              if (delta) {
                fullContent += delta;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                  };
                  return updated;
                });
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      }

      // Persist final conversation
      const finalMessages = [...nextMessages, { ...assistantMsg, content: fullContent }];
      setMessages(finalMessages);
      // Save last 50 messages to avoid unbounded growth
      scheduleSave({ aiMessages: finalMessages.slice(-50) });

    } catch (e) {
      setError(e.message);
      // Remove placeholder
      setMessages(nextMessages);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [messages, loading, scheduleSave]);

  // ── Clear history ────────────────────────────────────────────────

  function clearHistory() {
    setMessages([]);
    scheduleSave({ aiMessages: [] });
  }

  return {
    messages, setMessages,
    hasApiKey, keyChecked,
    loading, streaming, error,
    checkApiKey, saveApiKey,
    sendMessage, clearHistory,
    loadFromData,
  };
}
