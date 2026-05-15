/**
 * auth/SecurityBadges.jsx
 * Trust badges shown on the login screen.
 */

function SecurityBadges({ compact = false }) {
  const lockIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
  const shieldIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  const noIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
  const checkIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;

  const items = [
    { icon: lockIcon,   label: "256-bit AES encryption",  detail: "Bank tokens encrypted at rest" },
    { icon: shieldIcon, label: "Read-only bank access",    detail: "We never see your login" },
    { icon: noIcon,     label: "Zero data selling",        detail: "Never sold or shared" },
    { icon: checkIcon,  label: "Full data control",        detail: "Export or delete anytime" },
  ];

  if (compact) {
    return (
      <div style={{
        marginTop: 20,
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        padding: "12px 0",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
          <span style={{ color:"var(--warn)", display:"flex" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </span>
          <span style={{ fontSize:11, fontWeight:600, color:"var(--ink-1)", letterSpacing:"0.3px" }}>Security &amp; Privacy</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:7 }}>
              <span style={{ color:"var(--warn)", display:"flex", flexShrink:0 }}>{item.icon}</span>
              <span style={{ fontSize:11, color:"var(--ink-1)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: 360, maxWidth: "92vw",
      background: "var(--bg-2)",
      borderRadius: "var(--r-lg)",
      overflow: "hidden",
    }}>
      {/* Header bar */}
      <div style={{
        background: "var(--bg-1)",
        borderBottom: "1px solid var(--line)",
        padding: "11px 16px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ color:"var(--warn)", display:"flex", flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </span>
        <span style={{ fontSize:12, fontWeight:600, color:"var(--ink-0)", flex:1 }}>Your data is protected</span>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--safe)", flexShrink:0 }}/>
          <span style={{ fontSize:11, color:"var(--safe)", fontWeight:500 }}>Secured</span>
        </div>
      </div>

      {/* 2✕2 grid with divider lines */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}>
        {items.map((item, i) => (
          <div key={i} style={{
            padding: "13px 14px",
            borderRight:  i % 2 === 0 ? "1px solid var(--line)" : "none",
            borderBottom: i < 2       ? "1px solid var(--line)" : "none",
            display: "flex", gap: 10, alignItems: "flex-start",
          }}>
            <span style={{ color:"var(--warn)", display:"flex", flexShrink:0, marginTop:1 }}>{item.icon}</span>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--ink-0)", marginBottom:2, lineHeight:1.3 }}>
                {item.label}
              </div>
              <div style={{ fontSize:11, color:"var(--ink-2)", lineHeight:1.4 }}>
                {item.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        background: "var(--bg-1)",
        borderTop: "1px solid var(--line)",
        padding: "8px 16px",
        fontSize: 10, color: "var(--ink-2)",
        textAlign: "center", letterSpacing: "0.2px",
      }}>
        Powered by Plaid · Hosted on Railway · AES-256 encryption
      </div>
    </div>
  );
}

export { SecurityBadges };
