/**
 * components/layout/InstallPrompt.jsx
 * PWA install prompt for iOS and Android.
 */
import { useState, useEffect } from 'react';
import { S } from '../../theme/index.js';

const INSTALL_KEY = "ledgr_install_prompt_dismissed";


function getInstallPlatform() {
  // Already installed as PWA
  if (window.matchMedia("(display-mode: standalone)").matches) return null;
  if (window.navigator.standalone === true) return null;
  // Already dismissed
  if (localStorage.getItem(INSTALL_KEY)) return null;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState(null);

  useEffect(() => {
    const p = getInstallPlatform();
    if (!p) return;
    setPlatform(p);
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    localStorage.setItem(INSTALL_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  const iosSteps = [
    { icon: "1", text: "Tap the Share button", detail: "at the bottom of Safari" },
    { icon: "2", text: "Scroll down and tap", detail: "\"Add to Home Screen\"" },
    { icon: "3", text: "Tap Add", detail: "in the top-right corner" },
  ];

  const androidSteps = [
    { icon: "1", text: "Tap the menu button", detail: "(») in the top-right of Chrome" },
    { icon: "2", text: "Tap", detail: "\"Add to Home screen\"" },
    { icon: "3", text: "Tap Install", detail: "or Add to confirm" },
  ];

  const steps = platform === "ios" ? iosSteps : androidSteps;
  const browserName = platform === "ios" ? "Safari" : "Chrome";

  return (
    <div style={{
      position:"fixed", inset:0, background:"#00000099", backdropFilter:"blur(6px)",
      zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center",
      padding:16,
    }}>
      <div className="ledgr-slide-up" style={{
        background:"var(--bg-2)", border:"none",
        borderRadius:"var(--r-lg)", padding:"24px 22px",
        width:"100%", maxWidth:440, maxHeight:"85vh", overflowY:"auto",
      }}>

        <div style={{
          fontSize:28, textAlign:"center", marginBottom:6,
          color:"var(--warn)", fontFamily:"var(--font-display)", fontWeight:800,
        }}>
          ℓ
        </div>
        <div style={{
          fontSize:18, fontWeight:700, textAlign:"center",
          color:"var(--ink-0)", marginBottom:6, fontFamily:"var(--font-display)",
        }}>
          Install Ledgr
        </div>
        <div style={{
          fontSize:13, color:"var(--ink-1)", textAlign:"center", marginBottom:20, lineHeight:1.5,
        }}>
          Add Ledgr to your home screen for a faster, app-like experience — no browser bar, instant launch.
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:10, marginBottom:20}}>
          {steps.map((s, i) => (
            <div key={i} style={{display:"flex", alignItems:"center", gap:10}}>
              <div style={{
                flexShrink:0, width:28, height:28, borderRadius:"50%",
                background:"var(--warn)", color:"#000",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:700, fontFamily:"var(--font-mono)",
              }}>{s.icon}</div>
              <div style={{flex:1, fontSize:13, color:"var(--ink-0)"}}>
                {s.text} <span style={{color:"var(--ink-1)"}}>{s.detail}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background:"var(--bg-1)", borderRadius:"var(--r-md)",
          padding:"10px 12px", fontSize:11, color:"var(--ink-2)",
          textAlign:"center", marginBottom:16, lineHeight:1.5,
        }}>
          Make sure you're using <strong style={{color:"var(--ink-1)"}}>{browserName}</strong> for this to work.
        </div>

        <button
          style={{...S.btn("primary"), width:"100%", justifyContent:"center", padding:"12px"}}
          onClick={dismiss}
        >
          Got it — don't show again
        </button>
      </div>
    </div>
  );
}

/* --- BottomNav — mobile bottom navigation bar ---------------------- */

export { InstallPrompt, getInstallPlatform };
