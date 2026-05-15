/**
 * Sidebar.jsx — Ink bleed rail nav (desktop)
 * Replaces the old 220px sidebar with a 72px rail + ink-bleed overlay panel.
 */
import { useState, useRef, useEffect } from 'react';
import { S } from '../../theme/index.js';
import * as api from '../../api.js';
import { NAV } from '../../App.jsx';

/* ── Ink bleed nav CSS injected once ─────────────────────── */
const INK_CSS = `
/* ── Rail ─────────────────────────────────────────────── */
.ink-rail {
  position: sticky; top: 0;
  height: 100vh;
  width: 72px; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center;
  padding: 28px 0 24px;
  overflow: visible;
  z-index: 10;
}
@media (max-width: 768px), (hover: none) and (pointer: coarse) {
  .ink-rail { display: none !important; }
  .ink-panel { display: none !important; }
}
.ink-rail::after {
  content: '';
  position: absolute; top: 0; right: 0; bottom: 0;
  width: 1px;
  background: rgba(255,255,255,0.07);
  z-index: 700;
  pointer-events: none;
}

/* ── Gem ───────────────────────────────────────────────── */
.ink-gem-wrap {
  display: flex; align-items: center;
  flex-direction: row-reverse; justify-content: flex-end;
  gap: 8px; cursor: pointer; flex-shrink: 0;
  margin-bottom: 2px; position: relative;
  z-index: 600;
  margin-left: -9px; width: calc(100% + 9px);
}
.ink-gem {
  width: 20px; height: 20px; border-radius: 50%;
  flex-shrink: 0; cursor: pointer; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.ink-gem::before {
  content: '';
  position: absolute; width: 7px; height: 7px; border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 10px rgba(201,149,106,0.8), 0 0 24px rgba(201,149,106,0.3);
  transition: box-shadow .25s, transform .25s; z-index: 2;
}
@keyframes ink-gem-ripple {
  0%   { transform: scale(0.4); opacity: 0.7; }
  100% { transform: scale(3.2); opacity: 0; }
}
.ink-gem::after {
  content: ''; position: absolute;
  width: 7px; height: 7px; border-radius: 50%;
  border: 1px solid rgba(201,149,106,0.6);
  animation: ink-gem-ripple 2s cubic-bezier(0,0.6,0.4,1) infinite;
  z-index: 1;
}
.ink-gem-ring {
  position: absolute; border-radius: 50%;
  width: 7px; height: 7px;
  border: 1px solid rgba(201,149,106,0.45);
  animation: ink-gem-ripple 2s cubic-bezier(0,0.6,0.4,1) infinite;
}
.ink-gem-ring1 { animation-delay: 0.65s; }
.ink-gem-ring2 { animation-delay: 1.3s; }
.ink-gem-wrap:hover .ink-gem::before { box-shadow: 0 0 14px rgba(201,149,106,1), 0 0 32px rgba(201,149,106,0.5); transform: scale(1.2); }
body.ink-open .ink-gem::before { background: var(--cyan); box-shadow: 0 0 16px rgba(201,149,106,1), 0 0 36px rgba(201,149,106,0.5); transform: scale(1.1); }
body.ink-open .ink-gem::after, body.ink-open .ink-gem-ring { animation: none; opacity: 0; }
.ink-gem-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: .7px;
  color: var(--t3); font-family: var(--font-mono);
  transition: color .2s; user-select: none;
}
.ink-gem-wrap:hover .ink-gem-label { color: var(--cyan); }
body.ink-open .ink-gem-label { color: var(--cyan); }

/* ── Band / tick ───────────────────────────────────────── */
.ink-rb {
  width: 3px; border-radius: 1px; flex-shrink: 0;
  position: relative; z-index: 600;
}
.ink-rb1 { flex: 1.15; background: linear-gradient(180deg, rgba(201,149,106,0.9) 0%, rgba(201,149,106,0.45) 100%); }
.ink-rb2 { flex: 1.05; background: linear-gradient(180deg, rgba(180,112,58,0.42) 0%, rgba(160,95,45,0.28) 100%); }
.ink-rb3 { flex: 1;    background: linear-gradient(180deg, rgba(150,88,42,0.28) 0%, rgba(130,72,34,0.18) 100%); }
.ink-rb4 { flex: 1;    background: linear-gradient(180deg, rgba(120,62,30,0.18) 0%, rgba(100,52,24,0.08) 100%); }
.ink-rtick {
  width: 10px; height: 1px;
  background: rgba(201,149,106,0.18);
  flex-shrink: 0; margin: 1px 0;
  position: relative; z-index: 600;
}

/* ── Ink panel ─────────────────────────────────────────── */
.ink-panel {
  position: absolute; right: 0; top: 0;
  height: 100%; width: 220px;
  z-index: 400;
  background: rgba(7,6,5,0.98);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(201,149,106,0.12);
  display: flex; flex-direction: column;
  clip-path: circle(0% at 100% 36px);
  transition: clip-path .55s cubic-bezier(.16,1,.3,1), right .55s cubic-bezier(.16,1,.3,1);
  pointer-events: none; overflow: hidden;
}
body.ink-open .ink-panel {
  clip-path: circle(150% at 100% 36px);
  right: 38px;
  pointer-events: all;
}

/* ── Panel close btn ───────────────────────────────────── */
.ink-close {
  width: 22px; height: 22px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background .15s; flex-shrink: 0;
}
.ink-close:hover { background: rgba(255,255,255,0.06); }
.ink-close svg { width: 9px; height: 9px; stroke: var(--t3); stroke-width: 2.5; fill: none; }

/* ── Nav items ─────────────────────────────────────────── */
.ink-nav-section {
  display: block;
  font-family: var(--font-mono); font-size: 8px;
  font-weight: 600; text-transform: uppercase;
  letter-spacing: 2px; color: rgba(201,149,106,0.22);
  padding: 0 20px; margin: 18px 0 4px;
}
.ink-nav-section:first-child { margin-top: 4px; }
.ink-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 20px; cursor: pointer;
  background: none; border: none; width: 100%;
  text-align: left; position: relative;
  transition: background .12s;
}
.ink-nav-item:hover { background: rgba(255,255,255,0.025); }
.ink-nav-item.active { background: rgba(201,149,106,0.08); }
.ink-nav-item::before {
  content: ''; position: absolute; left: 0; top: 25%; bottom: 25%;
  width: 0; border-radius: 0 1px 1px 0;
  background: var(--cyan);
  box-shadow: 1px 0 6px rgba(201,149,106,0.5);
  transition: width .18s;
}
.ink-nav-item:hover::before, .ink-nav-item.active::before { width: 2px; }
.ink-nav-tick {
  width: 12px; height: 1px;
  background: rgba(232,221,208,0.18); flex-shrink: 0;
  border-radius: 1px; transition: width .2s, background .15s;
}
.ink-nav-item:hover .ink-nav-tick { width: 20px; background: rgba(201,149,106,0.6); }
.ink-nav-item.active .ink-nav-tick { width: 20px; background: var(--cyan); box-shadow: 0 0 6px rgba(201,149,106,0.4); }
.ink-nav-label {
  font-family: var(--font-body); font-size: 12px;
  color: var(--t2); flex: 1; white-space: nowrap;
  transition: color .15s;
}
.ink-nav-item:hover .ink-nav-label, .ink-nav-item.active .ink-nav-label { color: var(--t1); }
.ink-nav-item.active .ink-nav-label { color: var(--cyan); font-weight: 500; }

/* ── Item stagger reveal ───────────────────────────────── */
.ink-nav-items .ink-nav-item,
.ink-nav-items .ink-nav-section {
  opacity: 0; transform: translateX(-6px);
  transition: opacity .2s, transform .3s cubic-bezier(.16,1,.3,1);
}
body.ink-open .ink-nav-items .ink-nav-item,
body.ink-open .ink-nav-items .ink-nav-section { opacity: 1; transform: translateX(0); }
body.ink-open .ink-nav-items > *:nth-child(1)  { transition-delay: .05s; }
body.ink-open .ink-nav-items > *:nth-child(2)  { transition-delay: .08s; }
body.ink-open .ink-nav-items > *:nth-child(3)  { transition-delay: .11s; }
body.ink-open .ink-nav-items > *:nth-child(4)  { transition-delay: .14s; }
body.ink-open .ink-nav-items > *:nth-child(5)  { transition-delay: .17s; }
body.ink-open .ink-nav-items > *:nth-child(6)  { transition-delay: .20s; }
body.ink-open .ink-nav-items > *:nth-child(7)  { transition-delay: .23s; }
body.ink-open .ink-nav-items > *:nth-child(8)  { transition-delay: .26s; }
body.ink-open .ink-nav-items > *:nth-child(9)  { transition-delay: .29s; }
body.ink-open .ink-nav-items > *:nth-child(10) { transition-delay: .32s; }
body.ink-open .ink-nav-items > *:nth-child(11) { transition-delay: .35s; }
body.ink-open .ink-nav-items > *:nth-child(12) { transition-delay: .38s; }
body.ink-open .ink-nav-items > *:nth-child(13) { transition-delay: .41s; }
body.ink-open .ink-nav-items > *:nth-child(14) { transition-delay: .44s; }

/* ── Panel footer ──────────────────────────────────────── */
.ink-nav-footer {
  flex-shrink: 0; padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex; flex-direction: column; gap: 6px;
}
`;

let inkCssInjected = false;

function injectInkCss() {
  if (inkCssInjected) return;
  inkCssInjected = true;
  const style = document.createElement('style');
  style.textContent = INK_CSS;
  document.head.appendChild(style);
}

/* ── Main component ───────────────────────────────────── */
function SidebarContent({ onNav, view, syncing, doSync, showToast, avatarColor, avatarLetter }) {
  const currentUser = api.getStoredUser();
  const [inkOpen, setInkOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSending, setSupportSending] = useState(false);

  useEffect(() => {
    injectInkCss();
  }, []);

  // Sync body class for CSS targeting
  useEffect(() => {
    if (inkOpen) document.body.classList.add('ink-open');
    else document.body.classList.remove('ink-open');
    return () => document.body.classList.remove('ink-open');
  }, [inkOpen]);

  const toggle = () => setInkOpen(p => !p);
  const close  = () => setInkOpen(false);

  function handleNavClick(id) {
    onNav(id);
    close();
  }

  async function submitSupport() {
    if (!supportMessage.trim()) return;
    setSupportSending(true);
    try {
      await api.sendSupport(supportSubject, supportMessage);
      showToast('Message sent — we\'ll get back to you soon ✓');
      setSupportOpen(false);
      setSupportSubject('');
      setSupportMessage('');
    } catch {
      showToast('Failed to send — please try again');
    } finally {
      setSupportSending(false);
    }
  }

  const sections = [
    { label: 'Overview', items: [
      { id: 'dashboard',    label: 'Dashboard' },
      { id: 'transactions', label: 'Transactions' },
      { id: 'budgets',      label: 'Budgets' },
      { id: 'accounts',     label: 'Accounts' },
    ]},
    { label: 'Automate', items: [
      { id: 'rules',    label: 'Rules' },
      { id: 'calendar', label: 'Calendar' },
    ]},
    { label: 'Insights', items: [
      { id: 'ai',        label: 'Ask AI' },
      { id: 'analytics', label: 'Analytics' },
    ]},
    { label: 'System', items: [
      { id: 'settings', label: 'Settings' },
    ]},
  ];

  if (currentUser?.role === 'owner') {
    sections.push({ label: 'Owner', items: [
      { id: 'dani',  label: 'Dani' },
      { id: 'admin', label: 'Admin' },
    ]});
  }

  return (
    <div className="ink-rail">
      {/* Gem + "Menu" label */}
      <div className="ink-gem-wrap" onClick={toggle}>
        <div className="ink-gem">
          <span className="ink-gem-ring ink-gem-ring1" />
          <span className="ink-gem-ring ink-gem-ring2" />
        </div>
        <span className="ink-gem-label">Menu</span>
      </div>

      {/* Geological bands */}
      <div className="ink-rb ink-rb1" />
      <div className="ink-rtick" />
      <div className="ink-rb ink-rb2" />
      <div className="ink-rtick" />
      <div className="ink-rb ink-rb3" />
      <div className="ink-rtick" />
      <div className="ink-rb ink-rb4" />

      {/* Ink bleed panel */}
      <nav className="ink-panel">


        {/* Nav items */}
        <div className="ink-nav-items" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 0 16px' }}>
          {sections.map(sec => (
            <div key={sec.label}>
              <span className="ink-nav-section">{sec.label}</span>
              {sec.items.map(item => (
                <button
                  key={item.id}
                  className={`ink-nav-item${view === item.id ? ' active' : ''}`}
                  onClick={() => handleNavClick(item.id)}>
                  <div className="ink-nav-tick" />
                  <span className="ink-nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer: sync, support, user */}
        <div className="ink-nav-footer">
          <button
            style={{ ...S.btn('ghost'), width: '100%', justifyContent: 'center', fontSize: 11 }}
            onClick={() => { doSync(); close(); }}
            disabled={syncing}>
            {syncing ? '↻ Syncing…' : '↻ Sync All'}
          </button>
          <button
            style={{ ...S.btn('ghost'), width: '100%', justifyContent: 'center', fontSize: 11 }}
            onClick={() => setSupportOpen(true)}>
            💬 Support
          </button>
          {/* User row */}
          <button
            onClick={() => handleNavClick('settings')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 4px', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius)', marginTop: 2 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: avatarColor + '33', border: `1.5px solid ${avatarColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-disp)', fontSize: 10, fontWeight: 800, color: avatarColor }}>
              {avatarLetter}
            </div>
            <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser?.name || currentUser?.email}
              </div>
              {currentUser?.role === 'owner' && (
                <div style={{ fontSize: 8, color: 'var(--cyan)', fontWeight: 700, letterSpacing: '0.5px' }}>OWNER</div>
              )}
            </div>
          </button>
        </div>
      </nav>

      {/* Support modal */}
      {supportOpen && (
        <div style={{ position: 'fixed', inset: 0, background: '#0009', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSupportOpen(false); }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: 20, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Contact Support</div>
              <button onClick={() => setSupportOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>Send a message and we'll get back to you via email.</div>
            <input style={{ ...S.input, fontSize: 13 }} placeholder="Subject (optional)" value={supportSubject} onChange={e => setSupportSubject(e.target.value)} />
            <textarea style={{ ...S.input, fontSize: 13, minHeight: 100, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} placeholder="Describe your issue…" value={supportMessage} onChange={e => setSupportMessage(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={S.btn('ghost', true)} onClick={() => setSupportOpen(false)}>Cancel</button>
              <button style={S.btn('primary', true)} onClick={submitSupport} disabled={supportSending || !supportMessage.trim()}>
                {supportSending ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { SidebarContent };
