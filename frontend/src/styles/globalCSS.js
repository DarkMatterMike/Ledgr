// Global utility CSS injected at app startup.
// Lumen design system — shared layout helpers and animation classes.
(function injectCSS() {
  if (document.getElementById("ledgr-css")) return;
  const el = document.createElement("style");
  el.id = "ledgr-css";
  el.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body { overscroll-behavior: none; }
    button {
      background: transparent; border: none; outline: none;
      box-shadow: none; -webkit-appearance: none; appearance: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* ─── LUMEN LAYOUT HELPERS ─────────────────────────────── */

    .lumen-content     { padding: 0; }
    .lumen-stat-grid   { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
    .lumen-dash-cards  { display: flex; flex-direction: column; gap: 12px; }
    .lumen-monthbar-meta { display: flex; align-items: center; gap: 16px; }

    @media (max-width: 768px) {
      .lumen-content { padding: 0 !important; }
      .lumen-monthbar-meta { flex-wrap: wrap !important; gap: 8px !important; justify-content: center !important; }
    }

    /* ── Sidebar nav ── */
    .lumen-nav {
      background: var(--bg-1);
      border-right: 1px solid var(--line);
    }
    .lumen-nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 20px; font-size: 13px; font-weight: 400;
      color: var(--ink-3);
      cursor: pointer;
      transition: color 0.18s ease, background 0.18s ease;
      background: transparent; border: none;
      width: 100%; text-align: left;
      font-family: var(--font-ui);
      box-sizing: border-box;
      border-radius: 0;
    }
    .lumen-nav-item:hover {
      color: var(--ink-1);
      background: rgba(255,255,255,0.03);
    }
    .lumen-nav-item.active {
      color: var(--ink-0);
      background: var(--safe-bg);
      font-weight: 500;
      border-radius: 0;
    }
    .lumen-nav-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--ink-3);
      transition: background 0.18s;
    }
    .lumen-nav-item.active .lumen-nav-dot {
      background: var(--safe);
      box-shadow: 0 0 8px var(--safe);
    }

    /* ── Dashboard card ── */
    .lumen-card {
      background: var(--bg-2);
      border-radius: var(--r-lg);
      border: 1px solid var(--line);
      padding: 14px;
      position: relative;
      overflow: hidden;
    }
    @media (max-width: 768px) {
      .lumen-card { border-radius: var(--r-md); }
    }
    .lumen-card::before { display: none !important; }

    /* ── Top bar ── */
    .lumen-topbar {
      background: var(--bg-1);
      border-bottom: 1px solid var(--line);
      padding: 0 20px;
      height: 52px;
      display: flex; align-items: center;
    }

    /* ── View enter animation ── */
    @keyframes lumen-view-in {
      from { opacity: 0; transform: translateY(3px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
    .ledgr-view-enter { animation: lumen-view-in 0.18s cubic-bezier(0.22,1,0.36,1) both; }

    /* ── Budget progress bar ── */
    .ledgr-bar { transition: width 0.6s cubic-bezier(0.22,1,0.36,1); }
    @keyframes ledgr-bar-fill {
      from { width: 0; }
    }
    .ledgr-bar-anim { animation: ledgr-bar-fill 0.7s cubic-bezier(0.22,1,0.36,1) both; }

    /* ── Chevron toggle ── */
    .ledgr-chevron { display:inline-block; transition: transform 0.18s; }
    .ledgr-chevron-open { transform: rotate(180deg); }

    /* ── Drag/drop card ── */
    .ledgr-drag-handle { cursor: grab; opacity: 0.4; transition: opacity 0.15s; }
    .ledgr-drag-handle:hover { opacity: 0.8; }

    /* ── Mobile bottom nav ── */
    .ledgr-bottom-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: var(--bg-1);
      border-top: 1px solid var(--line);
      display: flex; align-items: center;
      height: 64px; z-index: 50;
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    /* ── Mobile more sheet ── */
    .mobile-more-sheet {
      position: fixed; bottom: 64px; left: 0; right: 0; z-index: 49;
      background: var(--bg-1);
      border-top: 1px solid var(--line);
      border-radius: var(--r-xl) var(--r-xl) 0 0;
      padding: 12px 0 8px;
      transform: translateY(100%);
      transition: transform 0.28s cubic-bezier(0.22,1,0.36,1);
    }
    .mobile-more-sheet.open { transform: translateY(0); }
    .mobile-sheet-handle {
      width: 36px; height: 4px; border-radius: 2px;
      background: var(--ink-4); margin: 0 auto 12px;
    }
    .mobile-sheet-item {
      display: flex; align-items: center; gap: 12px;
      padding: 13px 24px; font-size: 14px;
      color: var(--ink-1); width: 100%;
      background: none; border: none; cursor: pointer;
      font-family: var(--font-ui);
    }
    .mobile-sheet-item svg { width: 20px; height: 20px; flex-shrink: 0; }
    .mobile-sheet-item:hover { background: rgba(255,255,255,0.04); }

    /* ── Loading animation ── */
    @keyframes ll-fade  { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
    @keyframes ll-fade2 { from { opacity:0; } to { opacity:0.45; } }
    @keyframes ll-bar   { from { left:-40px; } to { left:120px; } }
    @keyframes ll-orb   { 0%,100% { box-shadow:0 0 0 0 rgba(93,202,165,0.35); } 50% { box-shadow:0 0 0 10px rgba(93,202,165,0); } }
    .ll-fade  { opacity:0; animation: ll-fade  0.6s 0.1s cubic-bezier(0.22,1,0.36,1) both; }
    .ll-fade2 { opacity:0; animation: ll-fade2 0.6s 0.3s ease both; }
    .ll-bar   { animation: ll-bar 1.4s 0.5s ease-in-out infinite; }
    .ll-orb   { animation: ll-orb 2s ease-in-out infinite; }
  `;
  document.head.appendChild(el);
})();
