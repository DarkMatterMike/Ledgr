/**
 * OnboardingWizard.jsx
 * First-time category setup — shown once when user has no categories.
 * Generates a tailored category set from lifestyle questions.
 */
import { useState } from "react";
import { CAT_COLORS } from "../constants.js";

const STORAGE_KEY = "ledgr_onboarding_done";

/* ── Category templates ──────────────────────────────────────────── */
function buildCategories(answers) {
  const cats = [];
  let ci = 0;
  const color = () => CAT_COLORS[ci++ % CAT_COLORS.length];

  const add = (name, limit) => cats.push({
    id: "c" + Date.now() + ci,
    name,
    limit,
    color: color(),
    completedMonths: [],
  });

  // Housing
  if (answers.housing === "mortgage")   { add("Mortgage", 2000); add("Home Insurance", 150); }
  if (answers.housing === "rent")       { add("Rent", 1500); }
  if (answers.housing === "family")     { add("Household", 200); }
  if (answers.housing === "own")        { add("Home Maintenance", 200); add("Home Insurance", 100); }

  // Transport
  if (answers.transport === "car")      { add("Gas", 150); add("Auto Insurance", 120); add("Car Maintenance", 80); }
  if (answers.transport === "transit")  { add("Public Transit", 100); }
  if (answers.transport === "multi")    { add("Transportation", 200); }

  // Universal essentials
  add("Groceries", 400);
  add("Dining Out", answers.dining === "frequently" ? 400 : answers.dining === "occasionally" ? 200 : 80);

  // Subscriptions
  if (answers.subscriptions === "many") { add("Subscriptions", 80); }
  if (answers.subscriptions === "few")  { add("Subscriptions", 40); }

  // Pets
  if (answers.pets) { add("Pets", 100); }

  // Goals → savings categories
  if (answers.goals.includes("emergency")) add("Emergency Fund", 200);
  if (answers.goals.includes("travel"))    add("Travel / Vacation", 150);
  if (answers.goals.includes("retirement")) add("Retirement", 300);
  if (answers.goals.includes("purchase"))  add("Major Purchase", 200);
  if (answers.goals.includes("savings"))   add("General Savings", 150);

  // Universal lifestyle
  add("Shopping", 200);
  add("Entertainment", 80);
  add("Healthcare", 60);
  add("Personal Care", 50);
  add("Cell Phone", 60);

  // Dedupe by name
  const seen = new Set();
  return cats.filter(c => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

/* ── Step configs ────────────────────────────────────────────────── */
const HOUSING_OPTIONS = [
  { id: "mortgage", icon: "🏦", label: "Paying a mortgage" },
  { id: "rent",     icon: "🔑", label: "Renting" },
  { id: "family",   icon: "👨‍👩‍👦", label: "Living with family" },
  { id: "own",      icon: "🏠", label: "Own home outright" },
];
const TRANSPORT_OPTIONS = [
  { id: "car",     icon: "🚗", label: "I own a car" },
  { id: "transit", icon: "🚌", label: "Public transit" },
  { id: "bike",    icon: "🚲", label: "Bike / Walk" },
  { id: "multi",   icon: "🔀", label: "Multiple methods" },
];
const DINING_OPTIONS = [
  { id: "frequently",   icon: "🍽️", label: "Frequently\n(2+/week)" },
  { id: "occasionally", icon: "🥡", label: "Occasionally" },
  { id: "rarely",       icon: "🥗", label: "Rarely" },
];
const SUB_OPTIONS = [
  { id: "many", icon: "📱", label: "Yes, many" },
  { id: "few",  icon: "💳", label: "A few" },
  { id: "none", icon: "🚫", label: "None" },
];
const GOAL_OPTIONS = [
  { id: "emergency",   icon: "🐷", label: "Emergency fund" },
  { id: "travel",      icon: "✈️", label: "Vacation / Travel" },
  { id: "retirement",  icon: "📈", label: "Retirement" },
  { id: "purchase",    icon: "🛍️", label: "Major purchase" },
  { id: "savings",     icon: "🎯", label: "General savings" },
];

/* ── Sub-components ──────────────────────────────────────────────── */
function OptionGrid({ options, value, onChange, multi = false }) {
  const isSelected = (id) => multi ? (value || []).includes(id) : value === id;
  const toggle = (id) => {
    if (multi) {
      const cur = value || [];
      onChange(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
    } else {
      onChange(id);
    }
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {options.map(o => (
        <button key={o.id} onClick={() => toggle(o.id)} style={{
          background: isSelected(o.id) ? "rgba(0,212,255,0.1)" : "var(--card-hi)",
          border: `1px solid ${isSelected(o.id) ? "var(--cyan)" : "var(--border)"}`,
          borderRadius: 12, padding: "14px 8px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          cursor: "pointer", transition: "all 0.15s",
          color: isSelected(o.id) ? "var(--cyan)" : "var(--t2)",
        }}>
          <span style={{ fontSize: 22 }}>{o.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 500, textAlign: "center", whiteSpace: "pre-line", lineHeight: 1.4 }}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function StepDots({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 8, height: 8, borderRadius: 99,
          background: i === current ? "var(--cyan)" : i < current ? "rgba(0,212,255,0.3)" : "var(--border)",
          transition: "all 0.25s cubic-bezier(0.22,1,0.36,1)",
        }} />
      ))}
    </div>
  );
}

function CategoryPreview({ categories }) {
  const groups = [
    { label: "Housing",    items: categories.filter(c => ["Mortgage","Rent","Home Insurance","Home Maintenance","Household"].includes(c.name)) },
    { label: "Transport",  items: categories.filter(c => ["Gas","Auto Insurance","Car Maintenance","Public Transit","Transportation"].includes(c.name)) },
    { label: "Essentials", items: categories.filter(c => ["Groceries","Dining Out","Healthcare","Personal Care","Cell Phone"].includes(c.name)) },
    { label: "Lifestyle",  items: categories.filter(c => ["Shopping","Entertainment","Subscriptions","Pets"].includes(c.name)) },
    { label: "Savings",    items: categories.filter(c => ["Emergency Fund","Travel / Vacation","Retirement","Major Purchase","General Savings"].includes(c.name)) },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map(g => (
        <div key={g.label}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>
            {g.label}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {g.items.map(c => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 5,
                background: c.color + "15", border: `1px solid ${c.color}30`,
                borderRadius: 99, padding: "4px 10px", fontSize: 12,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                <span style={{ color: "var(--t1)", fontWeight: 500 }}>{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */
export default function OnboardingWizard({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    housing: null,
    transport: null,
    pets: false,
    dining: null,
    subscriptions: null,
    goals: [],
  });

  const TOTAL_STEPS = 3;
  const preview = buildCategories(answers);

  const set = (key, val) => setAnswers(a => ({ ...a, [key]: val }));

  const canNext = [
    answers.housing && answers.transport,           // step 0
    answers.dining && answers.subscriptions,        // step 1
    true,                                           // step 2 (goals optional, preview)
  ][step];

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onComplete(buildCategories(answers));
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onSkip();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 900,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "24px 16px", overflowY: "auto",
    }}>
      <div style={{
        background: "var(--card)", borderRadius: 20, width: "100%", maxWidth: 480,
        padding: "24px 20px", border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }} className="ledgr-modal-anim">

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>◈</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-disp)", color: "var(--t1)", letterSpacing: "-0.3px" }}>
                Set up your budget
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                {step === 0 && "Tell us about your lifestyle"}
                {step === 1 && "A few more questions"}
                {step === 2 && "Here's what we'll create for you"}
              </div>
            </div>
          </div>
          <button onClick={handleSkip} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        <StepDots current={step} total={TOTAL_STEPS} />

        {/* ── Step 0: Housing + Transport ── */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="ledgr-panel-in">
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>What's your housing situation?</div>
              <OptionGrid options={HOUSING_OPTIONS} value={answers.housing} onChange={v => set("housing", v)} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>How do you usually get around?</div>
              <OptionGrid options={TRANSPORT_OPTIONS} value={answers.transport} onChange={v => set("transport", v)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--card-hi)", borderRadius: 12, padding: "14px 16px" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>Do you have pets?</div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>We'll add a pet care category</div>
              </div>
              <button onClick={() => set("pets", !answers.pets)} style={{
                width: 44, height: 26, borderRadius: 99, border: "none", cursor: "pointer",
                background: answers.pets ? "var(--cyan)" : "var(--card-hi)",
                position: "relative", transition: "background 0.2s", flexShrink: 0,
              }}>
                <div style={{
                  position: "absolute", top: 3, left: answers.pets ? 21 : 3,
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s cubic-bezier(0.22,1,0.36,1)",
                }} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Dining + Subscriptions + Goals ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="ledgr-panel-in">
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>How often do you eat out or order food?</div>
              <OptionGrid options={DINING_OPTIONS} value={answers.dining} onChange={v => set("dining", v)} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>Active subscriptions?</div>
              <OptionGrid options={SUB_OPTIONS} value={answers.subscriptions} onChange={v => set("subscriptions", v)} />
            </div>
          </div>
        )}

        {/* ── Step 2: Goals + Preview ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="ledgr-panel-in">
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 4 }}>Any savings goals? <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 400 }}>Optional</span></div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10 }}>Select all that apply</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {GOAL_OPTIONS.map(o => {
                  const sel = answers.goals.includes(o.id);
                  return (
                    <button key={o.id} onClick={() => {
                      const cur = answers.goals;
                      set("goals", sel ? cur.filter(x => x !== o.id) : [...cur, o.id]);
                    }} style={{
                      background: sel ? "rgba(0,212,255,0.1)" : "var(--card-hi)",
                      border: `1px solid ${sel ? "var(--cyan)" : "var(--border)"}`,
                      borderRadius: 12, padding: "14px 8px",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      cursor: "pointer", transition: "all 0.15s",
                      color: sel ? "var(--cyan)" : "var(--t2)",
                    }}>
                      <span style={{ fontSize: 22 }}>{o.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, textAlign: "center" }}>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
                {preview.length} categories ready to create
              </div>
              <CategoryPreview categories={preview} />
              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 12, textAlign: "center" }}>
                You can add, remove, or edit any of these after setup
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          {step < TOTAL_STEPS - 1 ? (
            <>
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext}
                style={{
                  background: canNext ? "var(--cyan)" : "var(--border)",
                  color: canNext ? "#000" : "var(--t3)",
                  border: "none", borderRadius: 12, padding: "14px",
                  fontSize: 14, fontWeight: 700, cursor: canNext ? "pointer" : "not-allowed",
                  transition: "all 0.15s", width: "100%",
                }}
                className="ledgr-btn-primary">
                Next →
              </button>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)} style={{
                  background: "var(--surface)", color: "var(--t2)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", width: "100%",
                }} className="ledgr-btn">
                  ← Back
                </button>
              )}
              <button onClick={handleSkip} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 13, padding: "8px" }}>
                Skip for now
              </button>
            </>
          ) : (
            <>
              <button onClick={handleComplete} style={{
                background: "var(--cyan)", color: "#000", border: "none",
                borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", width: "100%",
              }} className="ledgr-btn-primary">
                ✓ Create {preview.length} categories
              </button>
              <button onClick={() => setStep(s => s - 1)} style={{
                background: "var(--surface)", color: "var(--t2)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 600,
                cursor: "pointer", width: "100%",
              }} className="ledgr-btn">
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { STORAGE_KEY as ONBOARDING_STORAGE_KEY };
