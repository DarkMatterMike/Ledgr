/**
 * LumenShell.jsx
 * Persistent app shell — sidebar rail (desktop) + bottom nav (mobile).
 * Renders once; all Lumen pages mount inside the content area.
 * The sidebar and bottom nav never unmount on navigation.
 *
 * Desktop layout: [72px sidebar rail] [scrollable content area]
 * Mobile layout:  [scrollable content] [fixed bottom nav]
 */
import { SidebarContent } from './Sidebar.jsx';
import { BottomNav } from './BottomNav.jsx';

export default function LumenShell({
  view,
  views,
  navigate,
  isMobile,
  isDemo,
  trialDaysLeft,
  onUpgrade,
  syncing,
  doSync,
  showToast,
  avatarColor,
  avatarLetter,
  moreOpen,
  setMoreOpen,
  currentUser,
  contentRef,
  navKey,
}) {
  const activeView = views[view] ?? views.dashboard;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Demo mode banner ───────────────────────────────────────── */}
      {isDemo && (
        <div style={{
          flexShrink: 0, zIndex: 50,
          background: 'linear-gradient(90deg,rgba(0,212,255,0.12),rgba(0,212,255,0.07))',
          borderBottom: '2px solid var(--warn)',
          padding: '0 20px', height: 45,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'var(--warn)', color: '#000', fontSize: 10, fontWeight: 800,
              padding: '2px 8px', borderRadius: 99, letterSpacing: '1px',
              textTransform: 'uppercase', flexShrink: 0,
            }}>
              Demo
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-1)' }}>
              Exploring with sample data — nothing is saved
            </span>
          </div>
          <a
            href="https://ledgr-eight-zeta.vercel.app"
            style={{
              background: 'var(--warn)', color: '#000', padding: '7px 18px',
              borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 700,
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            Get Started — It's Free ←
          </a>
        </div>
      )}

      {/* ── Trial countdown banner ─────────────────────────────────── */}
      {trialDaysLeft !== null && (
        <div style={{
          flexShrink: 0,
          background: trialDaysLeft <= 1 ? 'var(--debt-bg)' : '#fbbf2415',
          borderBottom: `1px solid ${trialDaysLeft <= 1 ? '#ff4d6d44' : '#fbbf2433'}`,
          padding: '8px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 10,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
            color: trialDaysLeft <= 1 ? 'var(--debt)' : 'var(--warn)',
          }}>
            <span style={{ fontSize: 14 }}>{trialDaysLeft <= 1 ? '⚠⚠' : '·'}</span>
            <span style={{ fontWeight: 600 }}>
              {trialDaysLeft === 0
                ? 'Your trial expires today'
                : trialDaysLeft === 1
                ? 'Your trial expires tomorrow'
                : `${trialDaysLeft} days left in your free trial`}
            </span>
          </div>
          <button
            onClick={onUpgrade}
            style={{
              background: trialDaysLeft <= 1 ? 'var(--debt)' : 'var(--warn)',
              color: '#000', border: 'none', borderRadius: 'var(--r-md)',
              padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            View plans
          </button>
        </div>
      )}

      {/* ── Main layout: sidebar + content ────────────────────────── */}
      <div
        ref={contentRef}
        className="lumen-content"
        style={{
          flex: 1, overflowY: 'auto', overscrollBehavior: 'none',
          background: 'var(--bg-0)', position: 'relative',
        }}
      >
        {isMobile ? (
          /* Mobile — full-width, no sidebar */
          <div key={navKey} className="ledgr-view-enter ledgr-slide-in">
            {activeView}
          </div>
        ) : (
          /* Desktop — sidebar rail (sticky) + content, max-width centered */
          <div style={{ display: 'flex', maxWidth: 1080, margin: '0 auto', minHeight: '100%' }}>
            <aside style={{
              width: 72, flexShrink: 0,
              position: 'sticky', top: 0, height: '100vh',
              overflow: 'visible', alignSelf: 'flex-start',
            }}>
              <SidebarContent
                onNav={navigate}
                view={view}
                syncing={syncing}
                doSync={doSync}
                showToast={showToast}
                avatarColor={avatarColor}
                avatarLetter={avatarLetter}
              />
            </aside>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <div key={navKey} className="ledgr-view-enter ledgr-slide-in" style={{ position: 'relative', zIndex: 1 }}>
                {activeView}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile: more sheet + bottom nav ───────────────────────── */}
      {isMobile && (
        <>
          {/* Backdrop to close the more sheet */}
          {moreOpen && (
            <div
              onClick={() => setMoreOpen(false)}
              style={{ position: 'fixed', inset: 0, bottom: 82, zIndex: 39 }}
            />
          )}

          {/* More sheet */}
          <div className={`mobile-more-sheet${moreOpen ? ' open' : ''}`}>
            <div className="mobile-sheet-handle" />
            <button className="mobile-sheet-item" onClick={() => { setMoreOpen(false); navigate('settings'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              Profile & Settings
            </button>
            <button className="mobile-sheet-item" onClick={() => { setMoreOpen(false); navigate('accounts'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
              Accounts
            </button>
            {currentUser?.role === 'owner' && (
              <>
                <div className="mobile-sheet-divider" />
                <button
                  className="mobile-sheet-item"
                  onClick={() => { setMoreOpen(false); navigate('admin'); }}
                  style={{ color: 'var(--warn)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Admin
                </button>
                <button
                  className="mobile-sheet-item"
                  onClick={() => { setMoreOpen(false); navigate('dani'); }}
                  style={{ color: '#f9a8d4' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  Dani
                </button>
              </>
            )}
          </div>

          <BottomNav
            view={view}
            navigate={navigate}
            moreOpen={moreOpen}
            setMoreOpen={setMoreOpen}
            currentUser={currentUser}
          />
        </>
      )}
    </div>
  );
}
