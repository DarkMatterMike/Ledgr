import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from "../api.js";
import { S, applyTheme } from "../theme/index.js";
import { Modal } from "../components/ui/index.jsx";
import { SecurityBadges } from "./SecurityBadges.jsx";
import { PrivacyPolicy, TermsOfService } from "./Legal.jsx";

function isAuthValid() {
  try {
    const token = api.getToken();
    if (!token || !api.getStoredUser()) return false;
    // Decode the JWT payload (base64url middle section) to check expiry
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.exp) return false;
    // exp is in seconds, Date.now() is in ms
    if (Date.now() >= payload.exp * 1000) {
      api.clearToken(); // clean up expired token
      return false;
    }
    return true;
  } catch { return false; }
}

function AuthGate({ onAuth, inviteToken = null }) {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const resetToken = new URLSearchParams(window.location.search).get("reset");

  // Invite flow state
  const [inviteStatus, setInviteStatus] = useState(inviteToken ? "loading" : "none");
  const [inviteEmail2, setInviteEmail2] = useState("");
  useEffect(() => {
    if (!inviteToken) return;
    api.checkHouseholdInvite(inviteToken)
      .then(d => {
        if (!d || d.error) { setInviteStatus("error"); return; }
        setInviteEmail2(d.email || "");
        setEmail(d.email || "");
        setInviteStatus("ready");
      })
      .catch(() => setInviteStatus("error"));
  }, [inviteToken]);

  async function acceptAfterAuth() {
    try {
      await api.acceptHouseholdInvite(inviteToken);
      window.history.replaceState({}, "", window.location.pathname);
    } catch(e) { console.error("Failed to accept invite:", e); }
  }

  // step: "email" | "password" | "register" | "forgot" | "reset"
  const [step,          setStep]          = useState(resetToken ? "reset" : "email");
  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [confirm,       setConfirm]       = useState("");
  const [error,         setError]         = useState("");
  const [success,       setSuccess]       = useState("");
  const [loading,       setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [shake,         setShake]         = useState(false);
  const [agreedTerms,   setAgreedTerms]   = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [legalModal,    setLegalModal]    = useState(null);
  const googleBtnRef = useRef(null);
  const googleCbRef  = useRef(null);

  function triggerShake(msg) {
    setError(msg); setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  async function handleGoogleCallback(response) {
    setGoogleLoading(true);
    setError("");
    try {
      await api.googleAuth(response.credential);
      onAuth();
    } catch(err) {
      triggerShake(err.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }
  googleCbRef.current = handleGoogleCallback;

  // Initialize Google Identity Services button
  useEffect(() => {
    if (!window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (r) => googleCbRef.current(r),
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: googleBtnRef.current?.offsetWidth || 300,
    });
  }, [step]);

  async function handleEmailContinue(e) {
    e.preventDefault();
    if (!email.trim()) return triggerShake("Email required");
    setLoading(true);
    setError("");
    try {
      // Check if account exists
      const { exists } = await api.checkEmail(email);
      setStep(exists ? "password" : "register");
    } catch {
      setStep("password");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (step === "forgot") {
      if (!email) return triggerShake("Email required");
      setLoading(true);
      try {
        await fetch((import.meta.env.VITE_API_URL || "") + "/api/auth/forgot-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        setSuccess("If that email is registered, you'll receive a reset link shortly.");
      } catch { setSuccess("Check your email for a reset link."); }
      finally { setLoading(false); }
      return;
    }

    if (step === "reset") {
      if (!password) return triggerShake("Password required");
      if (password.length < 8) return triggerShake("Password must be at least 8 characters");
      if (password !== confirm) return triggerShake("Passwords do not match");
      setLoading(true);
      try {
        const r = await fetch((import.meta.env.VITE_API_URL || "") + "/api/auth/reset-password", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, newPassword: password }),
        });
        const d = await r.json();
        if (!r.ok) return triggerShake(d.error || "Reset failed");
        window.history.replaceState({}, "", window.location.pathname);
        setSuccess("Password updated! You can now sign in.");
        setTimeout(() => setStep("email"), 1500);
      } catch { triggerShake("Reset failed. Please try again."); }
      finally { setLoading(false); }
      return;
    }

    if (step === "register") {
      if (password !== confirm) return triggerShake("Passwords do not match");
      if (password.length < 8) return triggerShake("Password must be at least 8 characters");
      if (!agreedTerms || !agreedPrivacy) return triggerShake("Please agree to the Terms of Service and Privacy Policy");
    }

    setLoading(true);
    try {
      if (step === "password") await api.login(email, password);
      else                     await api.register(email, password);
      if (inviteToken && inviteStatus === "ready") await acceptAfterAuth();
      onAuth();
    } catch(err) {
      triggerShake(err.message || "Something went wrong");
      setPassword(""); setConfirm("");
    } finally { setLoading(false); }
  }

  function inputStyle(hasError = false) {
    return {
      background: "var(--bg-1)",
      border: `1px solid ${hasError ? "var(--debt)" : "var(--line-2)"}`,
      borderRadius: "var(--r-md)", padding: "11px 14px",
      fontSize: 14, color: "var(--ink-0)", outline: "none", width: "100%",
      transition: "border-color 0.15s",
    };
  }

  const showEmailStep  = step === "email";
  const showPassStep   = step === "password" || step === "register";
  const showGoogleBtn  = step === "email" || step === "password" || step === "register";
  const isForgotReset  = step === "forgot" || step === "reset";

  const headingMap = {
    email:    ["Welcome", "back"],
    password: ["Welcome", "back"],
    register: ["Create your", "account"],
    forgot:   ["Forgot your", "password?"],
    reset:    ["Reset your", "password"],
  };
  const [h1, h2] = headingMap[step] || ["Welcome", "back"];

  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      height:"100vh", background:"var(--bg-0)", flexDirection:"column", gap:24,
      fontFamily:"var(--font-ui)",
    }}>
      {/* Logo */}
      <div>
        <div style={{fontFamily:"'Syne', sans-serif",fontSize:36,fontWeight:800,letterSpacing:"-1px",color:"var(--ink-0)",textAlign:"center"}}>
          ledgr<span style={{color:"var(--warn)"}}>.</span>
        </div>
        <div style={{fontSize:13,color:"var(--ink-2)",textAlign:"center",marginTop:4}}>personal finance</div>
      </div>

      {/* Card */}
      <div className={shake?"shake":""} style={{
        background:"var(--bg-2)", border:"none",
        borderRadius:"var(--r-lg)", padding:"32px 28px",
        width:360, maxWidth:"92vw",
        boxShadow:"0 8px 40px #00000060",
        display:"flex", flexDirection:"column", gap:0,
      }}>

        {/* Invite banner */}
        {inviteToken && inviteStatus === "ready" && (
          <div style={{background:"var(--warn-bg)",border:"1px solid var(--warn)33",borderRadius:8,padding:"10px 12px",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--warn)",marginBottom:2}}>Household Invite</div>
            <div style={{fontSize:12,color:"var(--ink-1)"}}>Sign in or create an account to join the household.</div>
          </div>
        )}
        {inviteToken && inviteStatus === "error" && (
          <div style={{background:"#ff4d6d11",border:"1px solid #ff4d6d33",borderRadius:8,padding:"10px 12px",marginBottom:16}}>
            <div style={{fontSize:12,color:"var(--debt)"}}>This invite link is invalid or has expired.</div>
          </div>
        )}

        {/* Tab switcher — email and password/register steps */}
        {!isForgotReset && (showEmailStep || showPassStep) && (
          <div style={{display:"flex",gap:0,marginBottom:24,background:"var(--bg-1)",borderRadius:"var(--r-md)",padding:3}}>
            {["Sign In","Create Account"].map((label, i) => {
              const isActive = i === 0 ? (step==="email"||step==="password") : step==="register";
              return (
                <button key={label} onClick={()=>{ if(i===0){setStep("email");}else{setStep("register");} setError(""); }} style={{
                  flex:1, padding:"7px 0", borderRadius:"var(--r-md)",
                  fontSize:13, fontWeight:600, cursor:"pointer", border:"none",
                  background: isActive ? "var(--warn)" : "transparent",
                  color: isActive ? "#000" : "var(--ink-2)",
                  boxShadow: isActive ? "0 1px 4px #00000030" : "none",
                  transition:"all 0.15s",
                }}>{label}</button>
              );
            })}
          </div>
        )}

        {/* Forgot/reset header */}
        {isForgotReset && (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:16,fontWeight:700,color:"var(--ink-0)",marginBottom:4}}>
              {step === "forgot" ? "Forgot password" : "Reset password"}
            </div>
            <div style={{fontSize:13,color:"var(--ink-2)"}}>
              {step === "forgot" ? "Enter your email and we'll send you a reset link." : "Enter your new password below."}
            </div>
          </div>
        )}

        {/* Google button — shown on all non-forgot/reset steps */}
        {showGoogleBtn && (
          <>
            <div ref={googleBtnRef} style={{width:"100%",marginBottom:4,minHeight:44,overflow:"hidden",borderRadius:"var(--r-md)"}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,margin:"16px 0"}}>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
              <span style={{fontSize:11,color:"var(--ink-2)",letterSpacing:"0.5px"}}>OR</span>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,0.08)"}}/>
            </div>
          </>
        )}

        {/* Email step */}
        {showEmailStep && (
          <form onSubmit={handleEmailContinue} style={{display:"flex",flexDirection:"column",gap:10}}>
            <input type="email" placeholder="Email address" value={email} autoFocus
              onChange={e=>{setEmail(e.target.value);setError("");}}
              style={inputStyle(!!error&&!password)}/>
            {error && <div style={{fontSize:12,color:"var(--debt)"}}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              marginTop:4, background:"var(--warn)", color:"#000", border:"none",
              borderRadius:"var(--r-md)", padding:"10px 16px",
              fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
              opacity:loading?0.7:1, transition:"opacity 0.15s",
            }}>
              {loading ? "…" : "Continue"}
            </button>
          </form>
        )}

        {/* Password step (sign in) */}
        {step === "password" && (
          <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontSize:12,color:"var(--ink-2)",marginBottom:2}}>
              Signing in as <span style={{color:"var(--warn)"}}>{email}</span>{" "}
              <button type="button" onClick={()=>{setStep("email");setError("");}}
                style={{background:"none",border:"none",color:"var(--ink-2)",cursor:"pointer",fontSize:12,textDecoration:"underline",padding:0}}>change</button>
            </div>
            <input type="password" placeholder="Password" value={password} autoFocus
              onChange={e=>{setPassword(e.target.value);setError("");}}
              style={inputStyle(!!error)}/>
            {error && <div style={{fontSize:12,color:"var(--debt)"}}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              marginTop:4, background:"var(--warn)", color:"#000", border:"none",
              borderRadius:"var(--r-md)", padding:"10px 16px",
              fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
              opacity:loading?0.7:1, transition:"opacity 0.15s",
            }}>
              {loading ? "…" : "Sign In"}
            </button>
            <button type="button" onClick={()=>{setStep("forgot");setError("");}}
              style={{fontSize:12,color:"var(--ink-2)",background:"none",border:"none",cursor:"pointer",textAlign:"center"}}>
              Forgot your password?
            </button>
          </form>
        )}

        {/* Register step */}
        {step === "register" && (
          <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:10}}>
            <input type="email" placeholder="Email address" value={email} autoFocus
              onChange={e=>{setEmail(e.target.value);setError("");}}
              style={inputStyle(!!error&&!password)}/>
            <input type="password" placeholder="Password" value={password}
              onChange={e=>{setPassword(e.target.value);setError("");}}
              style={inputStyle(!!error)}/>
            <input type="password" placeholder="Confirm password" value={confirm}
              onChange={e=>{setConfirm(e.target.value);setError("");}}
              style={inputStyle(!!error&&confirm!==password)}/>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:4}}>
              {[
                {checked:agreedTerms,   set:setAgreedTerms,   doc:"terms",   label:"Terms of Service"},
                {checked:agreedPrivacy, set:setAgreedPrivacy, doc:"privacy", label:"Privacy Policy"},
              ].map(({checked,set,doc,label})=>(
                <label key={doc} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:12,color:"var(--ink-1)"}}>
                  <input type="checkbox" checked={checked} onChange={e=>set(e.target.checked)}
                    style={{width:15,height:15,accentColor:"var(--warn)",flexShrink:0,cursor:"pointer"}}/>
                  I agree to the{" "}
                  <button type="button" onClick={()=>setLegalModal(doc)}
                    style={{background:"none",border:"none",padding:0,color:"var(--warn)",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>
                    {label}
                  </button>
                </label>
              ))}
            </div>
            {error   && <div style={{fontSize:12,color:"var(--debt)"}}>{error}</div>}
            {success && <div style={{fontSize:12,color:"var(--safe)"}}>{success}</div>}
            <button type="submit" disabled={loading} style={{
              marginTop:4, background:"var(--warn)", color:"#000", border:"none",
              borderRadius:"var(--r-md)", padding:"10px 16px",
              fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
              opacity:loading?0.7:1, transition:"opacity 0.15s",
            }}>
              {loading ? "…" : "Create Account"}
            </button>
          </form>
        )}

        {/* Forgot / Reset */}
        {isForgotReset && (
          <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:10}}>
            {step === "forgot" && (
              <input type="email" placeholder="Email address" value={email} autoFocus
                onChange={e=>{setEmail(e.target.value);setError("");}}
                style={inputStyle(!!error)}/>
            )}
            {step === "reset" && (<>
              <input type="password" placeholder="New password" value={password} autoFocus
                onChange={e=>{setPassword(e.target.value);setError("");}}
                style={inputStyle(!!error)}/>
              <input type="password" placeholder="Confirm password" value={confirm}
                onChange={e=>{setConfirm(e.target.value);setError("");}}
                style={inputStyle(!!error&&confirm!==password)}/>
            </>)}
            {error   && <div style={{fontSize:12,color:"var(--debt)"}}>{error}</div>}
            {success && <div style={{fontSize:12,color:"var(--safe)"}}>{success}</div>}
            <button type="submit" disabled={loading} style={{
              marginTop:4, background:"var(--warn)", color:"#000", border:"none",
              borderRadius:"var(--r-md)", padding:"10px 16px",
              fontSize:14, fontWeight:700, cursor:loading?"wait":"pointer",
              opacity:loading?0.7:1, transition:"opacity 0.15s",
            }}>
              {loading ? "…" : step==="forgot" ? "Send Reset Link" : "Reset Password"}
            </button>
            <button type="button" onClick={()=>{setStep("email");setError("");setSuccess("");}}
              style={{fontSize:12,color:"var(--ink-2)",background:"none",border:"none",cursor:"pointer",textAlign:"center"}}>
              → Back to sign in
            </button>
          </form>
        )}

        {/* Footer links */}
        <div style={{marginTop:20,textAlign:"center",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{display:"flex",justifyContent:"center",gap:16}}>
            <button onClick={()=>setLegalModal("privacy")}
              style={{fontSize:11,color:"var(--ink-2)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
              Privacy Policy
            </button>
            <button onClick={()=>setLegalModal("terms")}
              style={{fontSize:11,color:"var(--ink-2)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
              Terms of Service
            </button>
          </div>
        </div>
      </div>

      {step === "register" && <SecurityBadges />}

      {/* Legal modal */}
      {legalModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setLegalModal(null)}>
          <div style={{background:"var(--bg-2)",borderRadius:12,padding:"28px 24px",width:640,maxWidth:"92vw",maxHeight:"82vh",display:"flex",flexDirection:"column"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexShrink:0}}>
              <div style={{fontSize:18,fontWeight:700,color:"var(--ink-0)"}}>
                {legalModal === "privacy" ? "Privacy Policy" : "Terms of Service"}
              </div>
              <button onClick={()=>setLegalModal(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ink-2)",fontSize:20}}>✕</button>
            </div>
            <div style={{overflowY:"auto",flex:1,fontSize:13,color:"var(--ink-1)",lineHeight:1.7}}>
              {legalModal === "privacy" ? <PrivacyPolicy /> : <TermsOfService />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { isAuthValid, AuthGate };
export default AuthGate;
