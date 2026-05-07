/**
 * components/layout/Sidebar.jsx
 * Desktop sidebar navigation with sync and support buttons.
 */
import { useState } from 'react';
import { S } from '../../theme/index.js';
import * as api from '../../api.js';

function SidebarContent({ onNav, view, syncing, doSync, showToast, avatarColor, avatarLetter }) {
  const currentUser = api.getStoredUser();
  const VAPID = "BLvUSGg-ljPgLVTY-54gYJrJvPEEIIokB5C-QTCAnSYW9ghmpeYmKQeIfQMsHl_opqis_d5QeORvyjoS1pfXRnY";
  const [supportOpen,    setSupportOpen]    = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);

  async function submitSupport() {
    if (!supportMessage.trim()) return;
    setSupportSending(true);
    try {
      await api.sendSupport(supportSubject, supportMessage);
      showToast("Message sent — we'll get back to you soon ✓");
      setSupportOpen(false);
      setSupportSubject("");
      setSupportMessage("");
    } catch(e) {
      showToast("Failed to send — please try again");
    } finally {
      setSupportSending(false);
    }
  }
  return (
    <>
      <div style={{height:16,flexShrink:0}}/>
      <nav style={{flex:1,display:"flex",flexDirection:"column",overflowY:"auto"}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>onNav(n.id)}
            className={`obsidian-nav-item${view===n.id?" active":""}`}>
            <div className="obsidian-nav-dot"/>
            <span>{n.label}</span>
          </button>
        ))}
        {/* Owner-only nav items */}
        {currentUser?.role === "owner" && (
          <div style={{marginTop:8,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:8,display:"flex",flexDirection:"column"}}>
            <button onClick={()=>onNav("dani")}
              className={`obsidian-nav-item${view==="dani"?" active":""}`}
              style={view==="dani"?{borderRightColor:"#f9a8d4",background:"rgba(249,168,212,0.1)",color:"#f9a8d4"}:{}}>
              <div className="obsidian-nav-dot" style={view==="dani"?{background:"#f9a8d4",opacity:1,boxShadow:"0 0 8px #f9a8d4"}:{}}/>
              <span>Dani</span>
            </button>
            <button onClick={()=>onNav("admin")}
              className={`obsidian-nav-item${view==="admin"?" active":""}`}>
              <div className="obsidian-nav-dot"/>
              <span>Admin</span>
            </button>
          </div>
        )}
      </nav>
      <div style={{padding:"8px 8px",flexShrink:0,display:"flex",flexDirection:"column",gap:6}}>
        <button style={{...S.btn("ghost"),width:"100%",justifyContent:"center",fontSize:12,background:"var(--card-hi, #28231b)",color:"var(--t2)"}}
          onClick={()=>{ doSync(); onNav(view); }} disabled={syncing}>
          {syncing?"↻ Syncing…":"↻ Sync All"}
        </button>
        <button style={{...S.btn("ghost"),width:"100%",justifyContent:"center",fontSize:12,background:"var(--card-hi, #28231b)",color:"var(--t2)"}}
          onClick={()=>setSupportOpen(true)}>
          💬 Support
        </button>

        {/* Support modal */}
        {supportOpen && (
          <div style={{position:"fixed",inset:0,background:"#0009",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
            onClick={e=>{ if(e.target===e.currentTarget) setSupportOpen(false); }}>
            <div style={{background:"var(--card)",border:"none",borderRadius:"var(--radius-lg)",padding:20,width:"100%",maxWidth:400,display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontSize:14,fontWeight:700,color:"var(--t1)"}}>Contact Support</div>
                <button onClick={()=>setSupportOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--t3)",fontSize:18,lineHeight:1,padding:"0 2px"}}>✕</button>
              </div>
              <div style={{fontSize:12,color:"var(--t3)",lineHeight:1.5}}>
                Send a message and we'll get back to you via email.
              </div>
              <input
                style={{...S.input,fontSize:13}}
                placeholder="Subject (optional)"
                value={supportSubject}
                onChange={e=>setSupportSubject(e.target.value)}
              />
              <textarea
                style={{...S.input,fontSize:13,minHeight:100,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}
                placeholder="Describe your issue or question…"
                value={supportMessage}
                onChange={e=>setSupportMessage(e.target.value)}
              />
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button style={S.btn("ghost",true)} onClick={()=>setSupportOpen(false)}>Cancel</button>
                <button
                  style={S.btn("primary",true)}
                  onClick={submitSupport}
                  disabled={supportSending || !supportMessage.trim()}>
                  {supportSending ? "Sending…" : "Send Message"}
                </button>
              </div>
            </div>
          </div>
        )}
        {"Notification" in window && Notification.permission !== "granted" && (
          <button style={{...S.btn("ghost"),width:"100%",justifyContent:"center",fontSize:12}}
            onClick={async ()=>{
              try {
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                  const reg = await navigator.serviceWorker.ready;
                  const toUint8 = b64 => {
                    const pad = "=".repeat((4-b64.length%4)%4);
                    const raw = atob((b64+pad).replace(/-/g,"+").replace(/_/g,"/"));
                    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
                  };
                  const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: toUint8(VAPID),
                  });
                  await api.subscribePush(sub);
                  showToast("Notifications enabled!");
                }
              } catch(e) { console.warn("Notification setup:",e.message); }
              onNav(view);
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Enable Notifications
          </button>
        )}
        {/* User info + settings shortcut */}
        <div style={{borderTop:"1px solid var(--border)",paddingTop:8,marginTop:2}}>
          <button
            onClick={()=>onNav("settings")}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 6px",
              background:"transparent",border:"none",cursor:"pointer",borderRadius:"var(--radius)",
              textAlign:"left",transition:"background 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{
              width:28,height:28,borderRadius:"50%",flexShrink:0,
              background:avatarColor+"33",border:`1.5px solid ${avatarColor}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontFamily:"var(--font-disp)",fontSize:12,fontWeight:800,color:avatarColor,
            }}>
              {avatarLetter}
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {currentUser?.name || currentUser?.email}
              </div>
              {currentUser?.role==="owner"&&(
                <div style={{fontSize:9,color:"var(--cyan)",fontWeight:700,letterSpacing:"0.5px"}}>OWNER</div>
              )}
            </div>
            <span style={{fontSize:11,color:"var(--t3)",flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

export { SidebarContent };
