import { useState, useEffect, useRef } from 'react';
import useIsMobile from '../hooks/useIsMobile.js';
import * as api from "../api.js";
import { S } from "../theme/index.js";

function AdminPanel() {
  const isMobile = useIsMobile();
  const [adminTab,     setAdminTab]     = useState("users");
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [editing,  setEditing]  = useState(null);
  const [editForm, setEditForm] = useState({ subscription_status:"", role:"" });
  const [saving,   setSaving]   = useState(false);
  const [confirm,  setConfirm]  = useState(null);
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 25;
  const [messages,   setMessages]   = useState([]);
  const [msgText,    setMsgText]    = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError,   setMsgError]   = useState("");

  async function loadMessages() {
    setMsgLoading(true);
    try { const d = await api.getStatusMessages(); setMessages(d.messages || []); }
    catch(e) { console.warn("Failed to load messages:", e.message); }
    finally { setMsgLoading(false); }
  }
  async function sendMessage() {
    if (!msgText.trim()) return;
    setMsgSending(true);
    setMsgError("");
    try {
      await api.sendStatusMessage(msgText.trim());
      setMsgText("");
      await loadMessages();
    } catch(e) {
      setMsgError(e.message || "Failed to send message");
    } finally {
      setMsgSending(false);
    }
  }
  async function deleteMessage(id) {
    try { await api.deleteStatusMessage(id); setMessages(p => p.filter(m => m.id !== id)); }
    catch(e) { alert("Failed to delete: " + e.message); }
  }
  useEffect(() => { if (adminTab === "messages") loadMessages(); }, [adminTab]);

  async function loadUsers() {
    setLoading(true); setError("");
    try { const d = await api.adminGetUsers(); setUsers(d.users); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadUsers(); }, []);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

  async function saveEdit(userId) {
    setSaving(true);
    try {
      const patch = {};
      if (editForm.subscription_status) patch.subscription_status = editForm.subscription_status;
      if (editForm.role) patch.role = editForm.role;
      await api.adminUpdateUser(userId, patch);
      setEditing(null);
      await loadUsers();
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function deleteUser(userId) {
    try {
      await api.adminDeleteUser(userId);
      setConfirm(null);
      await loadUsers();
    } catch(e) { setError(e.message); }
  }

  const stats = {
    total:    users.length,
    active:   users.filter(u => u.subscription_status === "active").length,
    trialing: users.filter(u => u.subscription_status === "trialing").length,
    canceled: users.filter(u => u.subscription_status === "canceled" || u.subscription_status === "past_due").length,
    mrr:      users.filter(u => u.subscription_status === "active" && u.role !== "owner" && u.role !== "free").length * 4.99,
  };

  const statusColor = s => s === "active" ? "var(--safe)" : s === "trialing" ? "var(--warn)" : s === "past_due" ? "var(--debt)" : "var(--ink-2)";
  const statusDot   = s => <span style={{width:7,height:7,borderRadius:"50%",background:statusColor(s),display:"inline-block",marginRight:6,flexShrink:0}}/>;
  const roleColor   = r => r === "owner" ? "var(--warn)" : r === "free" ? "var(--safe)" : "var(--ink-1)";

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase().trim()));
  const totalPages    = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedUsers    = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{width:"100%"}}>
      <div style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:800,marginBottom:14,letterSpacing:"-0.3px"}}>
        Admin Panel
      </div>

      {/* Tab switcher */}
      <div style={{display:"flex",gap:0,marginBottom:20,background:"var(--bg-1)",borderRadius:"var(--r-md)",padding:3,width:"fit-content"}}>
        {[["users","Users"],["messages","Messages"]].map(([id,label]) => (
          <button key={id} onClick={()=>setAdminTab(id)}
            style={{background:adminTab===id?"var(--bg-2)":"none",border:"none",color:adminTab===id?"var(--ink-0)":"var(--ink-2)",padding:"6px 16px",borderRadius:"var(--r-md)",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all 0.15s"}}>
            {label}
          </button>
        ))}
      </div>

      {/* Messages Tab */}
      {adminTab === "messages" && (
        <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:640}}>
          <div className="lumen-card" style={{...S.card,padding:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--ink-0)",marginBottom:8}}>Send Status Message</div>
            <div style={{fontSize:11,color:"var(--ink-2)",marginBottom:12,lineHeight:1.5}}>
              Appears as a modal to all users on next login. Expires after 24 hours. Users can dismiss with "Don't show again".
            </div>
            <textarea value={msgText} onChange={e=>{ setMsgText(e.target.value); setMsgError(""); }}
              placeholder="e.g. We're performing scheduled maintenance tonight from 11pm-1am EST..."
              style={{...S.input,minHeight:100,resize:"vertical",fontFamily:"inherit",lineHeight:1.6,fontSize:13,marginBottom:8}}/>
            {msgError && (
              <div style={{fontSize:12,color:"var(--debt)",marginBottom:8,padding:"6px 10px",background:"var(--debt-bg)",borderRadius:"var(--r-md)"}}>
                ✗ {msgError}
              </div>
            )}
            <button style={S.btn("primary",true)} onClick={sendMessage} disabled={msgSending||!msgText.trim()}>
              {msgSending?"Sending...":"Send Message"}
            </button>
          </div>
          <div className="lumen-card" style={{...S.card,padding:20}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--ink-0)",marginBottom:12}}>Message History</div>
            {msgLoading ? (
              <div style={{fontSize:13,color:"var(--ink-2)",textAlign:"center",padding:"20px 0"}}>Loading...</div>
            ) : messages.length === 0 ? (
              <div style={{fontSize:13,color:"var(--ink-2)",textAlign:"center",padding:"20px 0"}}>No messages sent yet</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {messages.map(m => {
                  const expired = Date.now() - m.created_at > 24*60*60*1000;
                  return (
                    <div key={m.id} style={{padding:"12px 14px",background:"var(--bg-1)",borderRadius:"var(--r-md)",border:`1px solid ${expired?"var(--line)":"rgba(0,212,255,0.3)"}`,opacity:expired?0.5:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6}}>
                        <div style={{fontSize:11,color:expired?"var(--ink-2)":"var(--warn)",fontWeight:600}}>
                          {expired?"EXPIRED":"ACTIVE"} · {new Date(m.created_at).toLocaleString()}
                        </div>
                        <button onClick={()=>deleteMessage(m.id)}
                          style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-2)",fontSize:14,padding:"0 2px",lineHeight:1,flexShrink:0}}>x</button>
                      </div>
                      <div style={{fontSize:13,color:"var(--ink-0)",lineHeight:1.6}}>{m.text}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {adminTab === "users" && (
      <div>

      {/* Stats -- 2x2 on mobile, 4 columns on desktop */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:24}}>
        {[
          { label:"Total Users", value:stats.total,                  color:"var(--ink-0)"    },
          { label:"Active",      value:stats.active,                  color:"var(--safe)" },
          { label:"Trialing",    value:stats.trialing,                color:"var(--warn)" },
          { label:"MRR",         value:`$${stats.mrr.toFixed(2)}`,   color:"var(--warn)"  },
        ].map(({label,value,color}) => (
          <div key={label} className="lumen-card" style={{...S.card,padding:"14px 16px"}}>
            <div style={{fontSize:10,color:"var(--ink-2)",textTransform:"uppercase",letterSpacing:"1px",fontWeight:600,marginBottom:4}}>{label}</div>
            <div style={{fontFamily:"var(--font-mono)",fontSize:isMobile?20:24,fontWeight:700,color}}>{value}</div>
          </div>
        ))}
      </div>

      {error && <div style={{color:"var(--debt)",fontSize:13,marginBottom:16,padding:"10px 14px",background:"#ff4d6d11",borderRadius:"var(--r-md)",border:"1px solid #ff4d6d33"}}>{error}</div>}

      {/* Users list */}
      <div className="lumen-card" style={{...S.card,padding:0,overflow:"hidden"}}>
        <div style={{padding:"10px 12px",borderBottom:"1px solid var(--line)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontFamily:"var(--font-display)",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px",color:"var(--ink-2)"}}>
              Users ({search ? `${filteredUsers.length} of ${users.length}` : users.length})
            </div>
            <button style={{...S.btn("ghost",true)}} className="ledgr-btn" onClick={loadUsers} disabled={loading}>
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
          <input
            style={{...S.input, fontSize:13}}
            placeholder="Search by email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={{padding:40,textAlign:"center",color:"var(--ink-2)",fontSize:13}}>Loading users…</div>
        ) : isMobile ? (
          /* -- Mobile: card-per-user -- */
          <div style={{display:"flex",flexDirection:"column"}}>
            {pagedUsers.map((user, i) => (
              <div key={user.id} style={{
                padding:"14px 16px",
                borderBottom: i < pagedUsers.length-1 ? "1px solid var(--line)" : "none",
                background: editing === user.id ? "var(--bg-1)" : "transparent",
              }}>
                {/* Email + ID */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--ink-0)"}}>{user.email}</div>
                    <div style={{fontSize:10,color:"var(--ink-2)",fontFamily:"var(--font-mono)",marginTop:2}}>{user.id.slice(0,8)}…</div>
                  </div>
                  {!editing && user.role !== "owner" && (
                    <button style={S.btn("danger",true)} onClick={() => setConfirm(user.id)}>✕</button>
                  )}
                </div>

                {/* Info row */}
                {editing !== user.id ? (
                  <>
                    <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:10}}>
                      <div>
                        <div style={{fontSize:10,color:"var(--ink-2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>Role</div>
                        <span style={{fontSize:12,color:roleColor(user.role),fontWeight:700}}>{user.role}</span>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"var(--ink-2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>Status</div>
                        <span style={{display:"inline-flex",alignItems:"center",fontSize:12}}>
                          {statusDot(user.subscription_status)}{user.subscription_status}
                        </span>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"var(--ink-2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>Joined</div>
                        <span style={{fontSize:12,color:"var(--ink-2)"}}>{new Date(Number(user.created_at)).toLocaleDateString("en-US")}</span>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"var(--ink-2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:2}}>Last Activity</div>
                        <span style={{fontSize:12,color:"var(--ink-2)"}}>{user.last_activity_at ? new Date(Number(user.last_activity_at)).toLocaleDateString("en-US") : "—"}</span>
                      </div>
                    </div>
                    <button style={{...S.btn("ghost",true),width:"100%",justifyContent:"center"}} className="ledgr-btn" onClick={() => {
                      setEditing(user.id);
                      setEditForm({ subscription_status: user.subscription_status, role: user.role });
                    }}>Edit</button>
                  </>
                ) : (
                  /* Edit mode */
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <div>
                        <div style={{fontSize:10,color:"var(--ink-2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4}}>Role</div>
                        <select style={{...S.select,width:"100%",fontSize:12}} value={editForm.role || user.role}
                          onChange={e => setEditForm(p => ({...p, role: e.target.value}))}>
                          <option value="subscriber">subscriber</option>
                          <option value="free">free</option>
                          <option value="owner">owner</option>
                        </select>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"var(--ink-2)",textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4}}>Status</div>
                        <select style={{...S.select,width:"100%",fontSize:12}} value={editForm.subscription_status || user.subscription_status}
                          onChange={e => setEditForm(p => ({...p, subscription_status: e.target.value}))}>
                          <option value="active">active</option>
                          <option value="pro">pro ($4.99)</option>
                          <option value="family">family ($9.99)</option>
                          <option value="trialing">trialing</option>
                          <option value="canceled">canceled</option>
                          <option value="past_due">past_due</option>
                          <option value="expired">expired</option>
                        </select>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button style={{...S.btn("primary",true),flex:1,justifyContent:"center"}} onClick={() => saveEdit(user.id)} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button style={{...S.btn("ghost",true),flex:1,justifyContent:"center"}} className="ledgr-btn" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* -- Desktop: table -- */
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  {["Email","Role","Status","Trial Ends","Last Activity","Joined","Actions"].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map(user => (
                  <tr key={user.id} style={{background: editing === user.id ? "var(--bg-1)" : "transparent"}}>
                    <td style={S.td}>
                      <div style={{fontSize:13,color:"var(--ink-0)",fontWeight:500}}>{user.email}</div>
                      <div style={{fontSize:11,color:"var(--ink-2)",fontFamily:"var(--font-mono)"}}>{user.id.slice(0,8)}…</div>
                    </td>
                    <td style={S.td}>
                      {editing === user.id ? (
                        <select style={{...S.select,fontSize:12}} value={editForm.role || user.role}
                          onChange={e => setEditForm(p => ({...p, role: e.target.value}))}>
                          <option value="subscriber">subscriber</option>
                          <option value="free">free</option>
                          <option value="owner">owner</option>
                        </select>
                      ) : (
                        <span style={{fontSize:12,color:roleColor(user.role),fontWeight: user.role !== "subscriber" ? 700 : 400}}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td style={S.td}>
                      {editing === user.id ? (
                        <select style={{...S.select,fontSize:12}} value={editForm.subscription_status || user.subscription_status}
                          onChange={e => setEditForm(p => ({...p, subscription_status: e.target.value}))}>
                          <option value="active">active</option>
                          <option value="pro">pro ($4.99)</option>
                          <option value="family">family ($9.99)</option>
                          <option value="trialing">trialing</option>
                          <option value="canceled">canceled</option>
                          <option value="past_due">past_due</option>
                          <option value="expired">expired</option>
                        </select>
                      ) : (
                        <span style={{display:"inline-flex",alignItems:"center",fontSize:12}}>
                          {statusDot(user.subscription_status)}{user.subscription_status}
                        </span>
                      )}
                    </td>
                    <td style={S.td}>
                      <span style={{fontSize:12,color:"var(--ink-2)",fontFamily:"var(--font-mono)"}}>
                        {user.trial_ends_at ? new Date(Number(user.trial_ends_at)).toLocaleDateString("en-US") : "—"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{fontSize:12,color:"var(--ink-2)",fontFamily:"var(--font-mono)"}}>
                        {user.last_activity_at ? new Date(Number(user.last_activity_at)).toLocaleDateString("en-US") : "—"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{fontSize:12,color:"var(--ink-2)",fontFamily:"var(--font-mono)"}}>
                        {new Date(Number(user.created_at)).toLocaleDateString("en-US")}
                      </span>
                    </td>
                    <td style={S.td}>
                      {editing === user.id ? (
                        <div style={{display:"flex",gap:6}}>
                          <button style={S.btn("primary",true)} onClick={() => saveEdit(user.id)} disabled={saving}>
                            {saving ? "…" : "Save"}
                          </button>
                          <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{display:"flex",gap:6}}>
                          <button style={S.btn("ghost",true)} className="ledgr-btn" onClick={() => {
                            setEditing(user.id);
                            setEditForm({ subscription_status: user.subscription_status, role: user.role });
                          }}>Edit</button>
                          {user.role !== "owner" && (
                            <button style={S.btn("danger",true)} onClick={() => setConfirm(user.id)}>✕</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:14,gap:8}}>
          <button
            style={{...S.btn("ghost",true)}} className="ledgr-btn"
            onClick={() => setPage(p => Math.max(1, p-1))}
            disabled={page === 1}>
            → Prev
          </button>
          <span style={{fontSize:13,color:"var(--ink-2)"}}>
            Page {page} of {totalPages}
          </span>
          <button
            style={{...S.btn("ghost",true)}} className="ledgr-btn"
            onClick={() => setPage(p => Math.min(totalPages, p+1))}
            disabled={page === totalPages}>
            Next ←
          </button>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirm && (
        <div style={S.overlay} className="ledgr-overlay-anim" onClick={() => setConfirm(null)}>
          <div style={{...S.modal,maxWidth:380}} className="ledgr-modal-anim" onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Delete User?</div>
            <div style={{fontSize:13,color:"var(--ink-1)",marginBottom:20}}>
              This will permanently delete the user and all their data. This cannot be undone.
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button style={S.btn("ghost")} className="ledgr-btn" onClick={() => setConfirm(null)}>Cancel</button>
              <button style={S.btn("danger")} className="ledgr-btn-danger" onClick={() => deleteUser(confirm)}>Delete User</button>
            </div>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  );
}

export default AdminPanel;
