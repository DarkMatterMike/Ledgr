import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from "react-plaid-link";
import * as api from "../api.js";

function PlaidButton({ onSuccess, onExit, label="Connect a Bank", products=null, itemId=null, style={}, showToast }) {
  const [linkToken, setLinkToken] = useState(null);
  const [loading,   setLoading]   = useState(false);
  const fetchToken = useCallback(async () => {
    setLoading(true);
    try { const { link_token } = await api.createLinkToken(products, itemId); setLinkToken(link_token); }
    catch (e) {
      const msg = e.message || "Failed to create link token";
      if (showToast) showToast(msg);
      else console.error("[PlaidButton]", msg);
    } finally { setLoading(false); }
  }, [products, itemId, showToast]);
  const { open, ready } = usePlaidLink({ token:linkToken, onSuccess:(pt,meta)=>onSuccess(pt,meta?.institution?.name), onExit });
  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);
  return (
    <button
      style={{
        padding:"7px 14px", borderRadius:8,
        background:"var(--safe-bg)", border:"1px solid rgba(93,202,165,0.4)",
        color:"var(--safe)", fontSize:12, fontWeight:500, cursor:"pointer",
        fontFamily:"var(--font-ui)", transition:".15s", opacity: loading ? 0.6 : 1,
        ...style
      }}
      onClick={fetchToken}
      disabled={loading}
    >
      {loading ? "Opening…" : label}
    </button>
  );
}

export default PlaidButton;
