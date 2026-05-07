/**
 * theme/index.js
 * Design token styles (S), theme application helpers.
 * CSS custom properties are defined in index.css.
 */

/** Shared style object — used throughout the app via S.card, S.btn(), etc. */
export const S = {
  shell:        { display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", fontFamily:"var(--font-body)", color:"var(--t1)", background:"var(--bg)" },
  card:         { background:"linear-gradient(var(--grad-angle, 315deg), var(--card, #181511) 0%, var(--card-hi, #1e1b17) 100%)", borderRadius:12, padding:"12px 14px", position:"relative" },
  cardTitle:    { fontFamily:"var(--font-disp)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"1.5px", color:"var(--t3)", marginBottom:10 },
  grid2:        { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 },
  grid4:        { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 },
  stat:         { background:"linear-gradient(var(--grad-angle, 315deg), var(--card, #181511) 0%, var(--card-hi, #1e1b17) 100%)", borderRadius:12, padding:"12px 14px", position:"relative", overflow:"hidden" },
  statLabel:    { fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", marginBottom:6 },
  statValue:    { fontFamily:"var(--font-mono)", fontSize:22, fontWeight:500 },
  statSub:      { fontSize:11, color:"var(--t2)", marginTop:3 },
  btn: (variant="ghost", sm=false) => {
    const base = { display:"inline-flex", alignItems:"center", gap:5, padding:sm?"3px 8px":"5px 11px", borderRadius:"var(--radius)", fontSize:12, fontWeight:500, cursor:"pointer", border:"1px solid transparent", transition:"all 0.15s", userSelect:"none", lineHeight:"1.4", whiteSpace:"nowrap" };
    if (variant==="primary") return { ...base, background:"var(--cyan)", color:"#000", borderColor:"var(--cyan)" };
    if (variant==="danger")  return { ...base, background:"var(--red-dim)", color:"var(--red)", borderColor:"rgba(224,112,112,0.3)" };
    if (variant==="amber")   return { ...base, background:"var(--amber-dim)", color:"var(--amber)", borderColor:"rgba(201,149,106,0.3)" };
    return { ...base, background:"var(--card-hi, #2b251d)", color:"var(--t2)" };
  },
  input:        { background:"var(--card-hi, #2b251d)", border:"none", borderRadius:"var(--radius)", padding:"7px 10px", fontSize:12, color:"var(--t1)", outline:"none", width:"100%" },
  select:       { background:"var(--card-hi, #2b251d)", border:"none", borderRadius:"var(--radius)", padding:"5px 8px", fontSize:11, color:"var(--t1)", outline:"none" },
  field:        { display:"flex", flexDirection:"column", gap:4 },
  label:        { fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"1px", fontWeight:600 },
  overlay:      { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" },
  modal:        { background:"var(--surface)", borderRadius:14, padding:20, width:480, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto" },
  modalTitle:   { fontFamily:"var(--font-disp)", fontSize:15, fontWeight:800, marginBottom:14, letterSpacing:"-0.3px" },
  badge:        (color) => ({ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:99, fontSize:11, fontWeight:600, fontFamily:"var(--font-disp)", background:color+"22", color, border:`1px solid ${color}33`, whiteSpace:"nowrap" }),
  toast:        { position:"fixed", bottom:16, right:12, zIndex:999, background:"var(--surface)", borderRadius:12, padding:"10px 16px", fontSize:12, color:"var(--t1)" },
  monthBar:     { background:"linear-gradient(var(--grad-angle, 315deg), var(--card, #181511) 0%, var(--card-hi, #1e1b17) 100%)", borderRadius:12, padding:"10px 14px", display:"flex", alignItems:"center", gap:10, fontSize:11, color:"var(--t2)", marginBottom:12, flexWrap:"wrap" },
  sectionHdr:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 },
  sectionTitle: { fontFamily:"var(--font-disp)", fontSize:14, fontWeight:700, letterSpacing:"-0.2px" },
  th:           { fontSize:10, textTransform:"uppercase", letterSpacing:"1.2px", color:"var(--t3)", fontWeight:700, padding:"6px 10px", textAlign:"left", whiteSpace:"nowrap", fontFamily:"var(--font-disp)", position:"sticky", top:0, background:"var(--surface)", zIndex:2 },
  td:           { padding:"8px 10px", fontSize:12, color:"var(--t2)", verticalAlign:"middle" },
  filterRow:    { display:"flex", gap:8, flexWrap:"wrap", marginBottom:10, alignItems:"center" },
};

/* --- Constants --------------------------------------------------- */

/**
 * Converts a percentage opacity to hex alpha and applies it to
 * surface/card CSS variables only — leaves text and bg image untouched.
 */
export function applyGlobalOpacity(pct, theme) {
  const a = Math.round((pct / 100) * 255).toString(16).padStart(2,'0');
  const root = document.documentElement;

  // Parse a hex color and append alpha
  function withAlpha(hex, alpha) {
    if (!hex || !hex.startsWith('#')) return hex;
    const base = hex.slice(0,7); // strip existing alpha
    return base + alpha;
  }

  const bg      = theme?.bg      || '#0f0e0d';
  const surface = theme?.surface || '#1a1612';
  const card    = theme?.card    || '#181511';

  root.style.setProperty('--surface',       withAlpha(surface, a));
  root.style.setProperty('--surface-solid', withAlpha(surface, a));
  root.style.setProperty('--card',          withAlpha(card, a));
  root.style.setProperty('--card-glass',    withAlpha(card, a));
  // card-hi: same alpha, slightly lighter base
  const cardHi = theme?.cardHi || card;
  root.style.setProperty('--card-hi', withAlpha(cardHi, a));
}

/**
 * Applies a full theme object to CSS custom properties on :root.
 * Called on login, theme change, and initial page load.
 */
export function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;

  // Helper: parse "#rrggbb" → [r, g, b]
  const hex2rgb = h => {
    const v = h.replace('#','');
    return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
  };
  // Helper: [r,g,b] → "#rrggbb"
  const rgb2hex = ([r,g,b]) =>
    '#'+[r,g,b].map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('');
  // Helper: bump each channel by delta (positive = lighter)
  const shift = (hex, d) => rgb2hex(hex2rgb(hex).map(n => n + d));
  // Helper: mix two hex colors (t=0 → a, t=1 → b)
  const mix = (a, b, t) => {
    const [ar,ag,ab] = hex2rgb(a), [br,bg,bb] = hex2rgb(b);
    return rgb2hex([ar+(br-ar)*t, ag+(bg-ag)*t, ab+(bb-ab)*t]);
  };

  // Core palette
  const vars = [
    ["--bg",       theme.bg],
    ["--surface",  theme.surface],
    ["--card",     theme.card],
    ["--border",   "transparent"],
    ["--border2",  "rgba(255,255,255,0.06)"],
    ["--cyan",     theme.accent],
    ["--cyan-dim", theme.accent ? theme.accent + "20" : null],
    ["--amber",    theme.accent],
    ["--amber-dim",theme.accent ? theme.accent + "18" : null],
    ["--t1",       theme.t1],
    ["--t2",       theme.t2],
    ["--t3",       theme.t3],
  ];
  vars.forEach(([k, v]) => { if (v) root.style.setProperty(k, v); });

  // Derive card-hi: steps lighter than card base
  if (theme.card) {
    const steps = theme.gradSteps ?? 6;
    const cardHi = shift(theme.card, steps);
    root.style.setProperty("--card-hi", cardHi);
    root.style.setProperty("--card-glass", theme.card);
  }
  // Gradient angle
  root.style.setProperty("--grad-angle", (theme.gradAngle ?? 315) + "deg");

  // Transaction stripe colors
  if (theme.reviewColor)    root.style.setProperty("--review-color",    theme.reviewColor);
  if (theme.recurringColor) root.style.setProperty("--recurring-color", theme.recurringColor);
  root.style.setProperty("--card-border", "transparent");
  root.style.setProperty("--surface-solid", theme.surface || "#161412");

  // Global opacity — affects surface/card/nav backgrounds only, not text or bg image
  // Must run after card-hi is derived above
  if (theme.card) {
    const hi = shift(theme.card, theme.gradSteps ?? 6);
    applyGlobalOpacity(theme.globalOpacity ?? 100, { ...theme, cardHi: hi });
  } else {
    applyGlobalOpacity(theme.globalOpacity ?? 100, theme);
  }
  root.style.setProperty("--bg-solid",      theme.bg      || "#0f0e0d");

  // Font
  if (theme.fontDisp) root.style.setProperty("--font-disp", theme.fontDisp);

  // Accent gradient vars
  if (theme.accent) {
    root.style.setProperty("--grad-a", theme.accent);
    root.style.setProperty("--grad-b", theme.t1 || "#e8ddd0");
    root.style.setProperty("--grad-c", theme.accent);
    root.style.setProperty("--glow-color", theme.accent + "18");
    root.style.setProperty("--accent-rgb",
      hex2rgb(theme.accent).join(','));
  }

  // Body background: radial gradient derived from theme
  // Bleed color = mix of surface and accent, ~40 steps above bg
  if (theme.bgImage) {
    const bg = theme.bg || "#0f0e0d";
    root.style.setProperty("--bg",      bg + "cc");
    root.style.setProperty("--surface", (theme.surface || "#161412") + "dd");
    root.style.setProperty("--card",    (theme.card    || "#161412") + "ee");
    document.body.style.background = "transparent";
    document.documentElement.classList.add("ledgr-has-bgimage");
  } else {
    document.body.style.backgroundImage = "";
    if (theme.bg && theme.surface) {
      // Bleed = mix of surface and accent at 30%, then push up ~20 steps
      const bleedBase = theme.accent ? mix(theme.surface, theme.accent, 0.3) : theme.surface;
      const bleed1 = shift(bleedBase, 20);  // top-right corner
      const bleed2 = shift(bleedBase, 10);  // bottom-left corner (slightly dimmer)
      document.body.style.background = [
        `radial-gradient(ellipse 70% 50% at 100% 0%,   ${bleed1} 0%, transparent 55%)`,
        `radial-gradient(ellipse 55% 45% at 0%   100%, ${bleed2} 0%, transparent 50%)`,
        theme.bg,
      ].join(', ');
    }
    document.documentElement.classList.remove("ledgr-has-bgimage");
  }
}

/** Apply stored theme immediately on module load to prevent flash. */
// Apply stored theme immediately on page load to prevent flash
try {
  const stored = localStorage.getItem("ledgr_theme");
  if (stored) applyTheme(JSON.parse(stored));
} catch { /* ignore — theme will use defaults */ }