/**
 * theme/index.js
 * Lumen design token styles (S), theme application helpers.
 * CSS custom properties are defined in index.css.
 */

/** Shared style object — used throughout the app via S.card, S.btn(), etc. */
export const S = {
  shell:        { display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", fontFamily:"var(--font-ui)", color:"var(--ink-0)", background:"transparent" },
  card:         { background:"var(--bg-2)", borderRadius:"var(--r-lg)", padding:"12px 14px", position:"relative", border:"1px solid var(--line)" },
  cardTitle:    { fontFamily:"var(--font-display)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"1.5px", color:"var(--ink-2)", marginBottom:10 },
  grid2:        { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 },
  grid4:        { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 },
  stat:         { background:"var(--bg-2)", borderRadius:"var(--r-lg)", padding:"12px 14px", position:"relative", overflow:"hidden", border:"1px solid var(--line)" },
  statLabel:    { fontSize:10, color:"var(--ink-2)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:6 },
  statValue:    { fontFamily:"var(--font-mono)", fontSize:22, fontWeight:500 },
  statSub:      { fontSize:11, color:"var(--ink-1)", marginTop:3 },
  btn: (variant="ghost", sm=false) => {
    const base = { display:"inline-flex", alignItems:"center", gap:5, padding:sm?"3px 8px":"5px 11px", borderRadius:"var(--r-md)", fontSize:12, fontWeight:500, cursor:"pointer", border:"1px solid var(--line-2)", transition:"all 0.15s", userSelect:"none", lineHeight:"1.4", whiteSpace:"nowrap" };
    if (variant==="primary") return { ...base, background:"var(--safe-bg)", color:"var(--safe)", borderColor:"rgba(93,202,165,0.35)" };
    if (variant==="danger")  return { ...base, background:"var(--debt-bg)", color:"var(--debt)", borderColor:"rgba(232,115,99,0.3)" };
    if (variant==="amber")   return { ...base, background:"var(--warn-bg)", color:"var(--warn)", borderColor:"rgba(240,176,76,0.3)" };
    return { ...base, background:"var(--bg-3)", color:"var(--ink-1)", borderColor:"var(--line)" };
  },
  input:        { background:"var(--bg-3)", border:"1px solid var(--line)", borderRadius:"var(--r-md)", padding:"7px 10px", fontSize:12, color:"var(--ink-0)", outline:"none", width:"100%" },
  select:       { background:"var(--bg-3)", border:"1px solid var(--line)", borderRadius:"var(--r-md)", padding:"5px 8px", fontSize:11, color:"var(--ink-0)", outline:"none" },
  field:        { display:"flex", flexDirection:"column", gap:4 },
  label:        { fontSize:11, color:"var(--ink-2)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600 },
  overlay:      { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" },
  modal:        { background:"var(--bg-1)", borderRadius:"var(--r-xl)", padding:24, width:480, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto", border:"1px solid var(--line-2)", boxShadow:"0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)" },
  modalTitle:   { fontFamily:"var(--font-display)", fontSize:15, fontWeight:800, marginBottom:14, letterSpacing:"-0.3px" },
  badge:        (color) => ({ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 9px", borderRadius:99, fontSize:11, fontWeight:600, fontFamily:"var(--font-display)", background:color+"1a", color, border:`1px solid ${color}2e`, whiteSpace:"nowrap" }),
  toast:        { position:"fixed", bottom:88, left:"50%", transform:"translateX(-50%)", zIndex:999, background:"var(--bg-3)", borderRadius:"var(--r-lg)", padding:"14px 18px", fontSize:14, fontWeight:600, color:"var(--ink-0)", display:"flex", alignItems:"center", gap:12, width:"calc(100% - 32px)", maxWidth:480, boxShadow:"0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px var(--line-2)" },
  monthBar:     { background:"var(--bg-2)", borderRadius:"var(--r-lg)", padding:"10px 14px", display:"flex", alignItems:"center", gap:10, fontSize:11, color:"var(--ink-1)", marginBottom:12, flexWrap:"wrap", border:"1px solid var(--line)" },
  sectionHdr:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 },
  sectionTitle: { fontFamily:"var(--font-display)", fontSize:14, fontWeight:700, letterSpacing:"-0.2px" },
  th:           { fontSize:10, textTransform:"uppercase", letterSpacing:"1.2px", color:"var(--ink-2)", fontWeight:700, padding:"6px 10px", textAlign:"left", whiteSpace:"nowrap", fontFamily:"var(--font-display)", position:"sticky", top:0, background:"var(--bg-1)", zIndex:2 },
  td:           { padding:"8px 10px", fontSize:12, color:"var(--ink-1)", verticalAlign:"middle" },
  filterRow:    { display:"flex", gap:8, flexWrap:"wrap", marginBottom:10, alignItems:"center" },
};

/**
 * Converts a percentage opacity to hex alpha and applies it to
 * surface/card CSS variables only — leaves text and bg image untouched.
 */
export function applyGlobalOpacity(pct, theme) {
  const a = Math.round((pct / 100) * 255).toString(16).padStart(2,'0');
  const root = document.documentElement;

  function withAlpha(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return hex;
    return hex.slice(0,7) + alpha;
  }

  const bg1 = theme?.surface || theme?.bg1 || '#0b0e14';
  const bg2 = theme?.card    || theme?.bg2 || '#11151d';
  const bg3 = theme?.cardHi  || theme?.bg3 || '#161c26';

  root.style.setProperty('--bg-1', withAlpha(bg1, a));
  root.style.setProperty('--bg-2', withAlpha(bg2, a));
  root.style.setProperty('--bg-3', withAlpha(bg3, a));
  // Keep backward-compat aliases
  root.style.setProperty('--surface',       withAlpha(bg1, a));
  root.style.setProperty('--surface-solid', withAlpha(bg1, a));
  root.style.setProperty('--card',          withAlpha(bg2, a));
  root.style.setProperty('--card-hi',       withAlpha(bg3, a));
}

/**
 * Applies a full theme object to CSS custom properties on :root.
 * Called on login, theme change, and initial page load.
 */
export function applyTheme(theme) {
  if (!theme) return;
  // Migrate Obsidian legacy bg values
  if (theme.bg === "#0f0e0d" || theme.bg === "#0F0E0D" || theme.bg === "#0b0a08") {
    theme = { ...theme, bg: "#07090d", surface: theme.surface || "#0b0e14", card: theme.card || "#11151d" };
  }
  const root = document.documentElement;

  const hex2rgb = h => {
    const v = h.replace('#','');
    return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
  };
  const rgb2hex = ([r,g,b]) =>
    '#'+[r,g,b].map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('');
  const shift = (hex, d) => rgb2hex(hex2rgb(hex).map(n => n + d));

  // Derive the full --bg-0 through --bg-4 scale from theme.bg
  if (theme.bg) {
    const [br, bg2, bb] = hex2rgb(theme.bg);
    const bgScale = [
      rgb2hex([Math.max(0,br-4), Math.max(0,bg2-4), Math.max(0,bb-6)]),
      rgb2hex([br+4,  bg2+5,  bb+8]),
      rgb2hex([br+12, bg2+14, bb+20]),
      rgb2hex([br+20, bg2+23, bb+32]),
      rgb2hex([br+28, bg2+32, bb+44]),
    ];
    bgScale.forEach((v,i) => root.style.setProperty(`--bg-${i}`, v));
    // Keep compat aliases
    root.style.setProperty('--bg',      bgScale[0]);
    root.style.setProperty('--surface', bgScale[1]);
    root.style.setProperty('--card',    bgScale[2]);
    root.style.setProperty('--card-hi', bgScale[3]);
  }

  // Derive ink scale from theme.t1 or default
  if (theme.t1) {
    const t1 = theme.t1;
    const rgb = t1.startsWith('#') ? hex2rgb(t1) : t1.match(/[\d.]+/g).slice(0,3).map(Number);
    const [r,g,b] = rgb;
    root.style.setProperty('--ink-0', t1);
    root.style.setProperty('--ink-1', `rgba(${r},${g},${b},0.82)`);
    root.style.setProperty('--ink-2', `rgba(${r},${g},${b},0.50)`);
    root.style.setProperty('--ink-3', `rgba(${r},${g},${b},0.30)`);
    root.style.setProperty('--ink-4', `rgba(${r},${g},${b},0.18)`);
    // Compat aliases
    root.style.setProperty('--t1', t1);
    root.style.setProperty('--t2', `rgba(${r},${g},${b},0.55)`);
    root.style.setProperty('--t3', `rgba(${r},${g},${b},0.30)`);
  }

  // Accent color → maps to --warn (amber/warm tone)
  if (theme.accent) {
    root.style.setProperty('--warn',     theme.accent);
    root.style.setProperty('--warn-bg',  theme.accent + '18');
    // Compat aliases
    root.style.setProperty('--cyan',     theme.accent);
    root.style.setProperty('--cyan-dim', theme.accent + '20');
    root.style.setProperty('--amber',    theme.accent);
    root.style.setProperty('--grad-a',   theme.accent);
    root.style.setProperty('--glow-color', theme.accent + '18');
    root.style.setProperty('--accent-rgb', hex2rgb(theme.accent).join(','));
    if (theme.t1) root.style.setProperty('--grad-b', theme.t1);
  }

  // Gradient angle
  root.style.setProperty('--grad-angle', (theme.gradAngle ?? 315) + 'deg');

  // fontDisp is legacy — only sets --font-disp (Obsidian nav/label token).
  // --font-display (Instrument Serif) is NEVER overridden by theme.
  // Migrate: old default was Syne — treat as unset so Instrument Serif shows through.
  const effectiveFontDisp = (theme.fontDisp === "'Syne', sans-serif") ? null : theme.fontDisp;
  if (effectiveFontDisp) {
    root.style.setProperty('--font-disp', effectiveFontDisp);
  }

  // Line/border tokens stay fixed
  root.style.setProperty('--line',   'rgba(255,255,255,0.06)');
  root.style.setProperty('--line-2', 'rgba(255,255,255,0.10)');
  root.style.setProperty('--line-3', 'rgba(255,255,255,0.18)');
  root.style.setProperty('--border',  'transparent');
  root.style.setProperty('--border2', 'rgba(255,255,255,0.06)');

  // Transaction stripe colors
  if (theme.reviewColor)    root.style.setProperty('--review-color',    theme.reviewColor);
  if (theme.recurringColor) root.style.setProperty('--recurring-color', theme.recurringColor);

  // Global opacity
  if (theme.bg) {
    const steps = theme.gradSteps ?? 6;
    const bg1 = theme.surface || shift(theme.bg, 4);
    const bg2 = theme.card    || shift(theme.bg, 12);
    const bg3 = theme.cardHi  || shift(bg2, steps);
    applyGlobalOpacity(theme.globalOpacity ?? 100, { bg1, bg2, bg3 });
  }

  // Body background
  if (theme.bgImage) {
    root.style.setProperty('--bg-0', (theme.bg || '#07090d') + 'cc');
    document.body.style.background = 'transparent';
    document.documentElement.classList.add('ledgr-has-bgimage');
  } else {
    document.body.style.backgroundImage = '';
    if (theme.bg) {
      document.body.style.background = [
        'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'300\' height=\'300\' filter=\'url(%23n)\' opacity=\'0.022\'/%3E%3C/svg%3E")',
        theme.bg,
      ].join(', ');
    }
    document.documentElement.classList.remove('ledgr-has-bgimage');
  }
}

/** Apply stored theme immediately on module load to prevent flash. */
try {
  const stored = localStorage.getItem('ledgr_theme');
  if (stored) {
    const t = JSON.parse(stored);
    applyTheme(t);
  }
} catch { /* ignore */ }
