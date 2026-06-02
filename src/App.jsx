import { useState, useEffect, useCallback, useReducer, useRef, createContext, useContext } from "react";

// ── theme ─────────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);
const useTheme = () => useContext(ThemeContext);

const makeTheme = (dark) => dark ? {
  bg:       "#0F0F0F",
  surface:  "#1A1A1A",
  card:     "#222222",
  border:   "#2E2E2E",
  muted:    "#3A3A3A",
  textPri:  "#F0EDE8",
  textSec:  "#8A8580",
  textTer:  "#4E4B47",
  pain:     "#E8714A",
  painBg:   "#2A1A14",
  sleep:    "#9B8FE8",
  sleepBg:  "#1E1A2E",
  alc:      "#D4A847",
  alcBg:    "#2A2210",
  food:     "#7ABF4E",
  foodBg:   "#1A2410",
  screen:   "#5BA3E8",
  screenBg: "#12202E",
  ex:       "#4ECFA8",
  exBg:     "#0E2520",
  custom:   "#C878D4",
  customBg: "#221428",
  good:     "#4ECFA8",
  warn:     "#D4A847",
  danger:   "#E85A5A",
} : {
  bg:       "#F2F0EB",
  surface:  "#E8E5DF",
  card:     "#FFFFFF",
  border:   "#D4D0C8",
  muted:    "#C4C0B8",
  textPri:  "#1A1916",
  textSec:  "#6B6860",
  textTer:  "#9A9790",
  pain:     "#C8521A",
  painBg:   "#FDE8DE",
  sleep:    "#6B5FD4",
  sleepBg:  "#EAE7F8",
  alc:      "#A07810",
  alcBg:    "#FBF0D0",
  food:     "#4A8F20",
  foodBg:   "#E4F2D8",
  screen:   "#2B7EC8",
  screenBg: "#DCEcF8",
  ex:       "#1A9F78",
  exBg:     "#D4F2E8",
  custom:   "#9848B4",
  customBg: "#F0E0F8",
  good:     "#1A9F78",
  warn:     "#A07810",
  danger:   "#C83030",
};

// Legacy: components use C directly — we keep C as a module-level ref
// updated by the ThemeProvider before each render
let C = makeTheme(true);

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const STORAGE_KEY = "cc_data_v5";
const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } };
const save = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));

// ── pain-specific constants ──────────────────────────────────────────────────
const PAIN_LEVELS = [
  { id: "mild",     label: "Sore but can be stretched away",       short: "Mild",     score: 1 },
  { id: "annoying", label: "Sore and annoying",                    short: "Annoying", score: 2 },
  { id: "moderate", label: "Sore and getting worse with movement", short: "Moderate", score: 3 },
  { id: "severe",   label: "Can barely move",                      short: "Severe",   score: 4 },
];
const PAIN_LEVEL_COLOR = { mild: C.alc, annoying: "#E8A84A", moderate: C.pain, severe: "#C0392B" };

const PAIN_AREA_LOCATIONS = {
  back: [
    "Neck / cervical", "Upper back", "Mid back", "Lower back",
    "Left shoulder", "Right shoulder", "Hip flexors", "Glutes", "Other",
  ],
  head: [
    "Forehead", "Right temple", "Left temple", "Back of head",
    "Behind the eyes", "Jaw / TMJ", "Neck base", "Other",
  ],
  arms: [
    "Right shoulder", "Left shoulder", "Right elbow", "Left elbow",
    "Right wrist", "Left wrist", "Right hand", "Left hand", "Other",
  ],
  legs: [
    "Right hip", "Left hip", "Right knee", "Left knee",
    "Right ankle", "Left ankle", "Right foot", "Left foot",
    "Right shin / calf", "Left shin / calf", "Other",
  ],
  torso: [
    "Upper chest", "Lower chest", "Left ribs", "Right ribs",
    "Upper abdomen", "Lower abdomen", "Left side", "Right side", "Other",
  ],
  pelvic: [
    "Upper abdomen", "Lower abdomen", "Left side", "Right side",
    "Pelvic floor", "Lower back / kidney area", "Bladder",
    "Ovaries / uterus", "Bowel / digestive", "Radiating to legs", "Other",
  ],
};
const getPainLocations = (area) => PAIN_AREA_LOCATIONS[area] || PAIN_AREA_LOCATIONS.back;

// ── default trackers ─────────────────────────────────────────────────────────
const DEFAULT_TRACKERS = [
  {
    id: "back_pain", label: "Back pain", icon: "🫀", color: C.pain, bg: C.painBg,
    frequency: "3x", times: ["Morning", "Afternoon", "Evening"],
    type: "pain_special",
    metrics: [],
  },
  {
    id: "sleep", label: "Sleep", icon: "🌙", color: C.sleep, bg: C.sleepBg,
    frequency: "1x",
    metrics: [
      { id: "duration",    label: "Duration (hrs)",      type: "number", min: 0, max: 16, step: 0.5 },
      { id: "fall_asleep", label: "Time to fall asleep", type: "select",
        options: ["< 15 min", "15 min", "30 min", "45 min", "1 hour", "2+ hours"] },
      { id: "stay_asleep", label: "Times woken up",      type: "wakeup_count" },
    ],
  },
  {
    id: "exercise", label: "Exercise", icon: "🏃", color: C.ex, bg: C.exBg,
    frequency: "eod",
    metrics: [
      { id: "type",      label: "Type",           type: "select",
        options: ["Pilates", "Running", "Walking", "Stretching", "Cycling", "Strength training", "Yoga", "Sports", "Other"] },
      { id: "intensity", label: "Intensity",      type: "select",
        options: ["Light", "Moderate", "Hard", "Max effort"] },
      { id: "duration",  label: "Duration (hrs)", type: "number", min: 0, max: 8, step: 0.5 },
    ],
  },
  {
    id: "alcohol", label: "Alcohol", icon: "🍷", color: C.alc, bg: C.alcBg,
    frequency: "eod",
    metrics: [
      { id: "units", label: "Units consumed", type: "number", min: 0, max: 30, step: 0.5 },
    ],
  },
  {
    id: "food", label: "Food quality", icon: "🥗", color: C.food, bg: C.foodBg,
    frequency: "eod",
    metrics: [
      { id: "calories", label: "Calorie intake", type: "hml" },
      { id: "sugar",    label: "Sugar / carbs",  type: "hml" },
    ],
  },
  {
    id: "screen", label: "Screen time", icon: "📱", color: C.screen, bg: C.screenBg,
    frequency: "eod",
    metrics: [
      { id: "phone",  label: "Phone (hrs)",  type: "number", min: 0, max: 24, step: 0.5 },
      { id: "laptop", label: "Laptop (hrs)", type: "number", min: 0, max: 24, step: 0.5 },
    ],
  },
  {
    id: "pain_relief", label: "Pain alleviation", icon: "💊", color: "#A78BDD", bg: "#1E1830",
    frequency: "1x",
    metrics: [
      { id: "medication_doses", label: "Medication (doses today)", type: "number", min: 0, max: 20, step: 1 },
      { id: "treatments", label: "Treatment used", type: "multiselect",
        options: ["Ibuprofen", "Paracetamol", "Melatonin", "Magnesium",
                  "Heat pack", "Ice pack", "Massage", "Qui massage", "Physiotherapy", "Chiropractor",
                  "Stretching / yoga", "Other"] },
    ],
  },
];

// ── shared micro-components ──────────────────────────────────────────────────
const Badge = ({ children, color, bg }) => (
  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: bg, color, fontWeight: 600, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
    {children}
  </span>
);

const Toggle = ({ on, onToggle }) => (
  <div onClick={onToggle} style={{ width: 38, height: 22, borderRadius: 11, background: on ? C.good : C.muted, position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
    <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 3, left: on ? 19 : 3, transition: "left 0.2s" }} />
  </div>
);

const HMLInput = ({ value, onChange, color }) => (
  <div style={{ display: "flex", gap: 6 }}>
    {["Low", "Medium", "High"].map(v => (
      <button key={v} onClick={() => onChange(value === v ? null : v)}
        style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1.5px solid ${value === v ? color : C.border}`, background: value === v ? color : C.card, color: value === v ? "#fff" : C.textSec, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
        {v}
      </button>
    ))}
  </div>
);

const NoteField = ({ value, onChange }) => (
  <textarea value={value || ""} onChange={e => onChange(e.target.value)}
    placeholder="Anything worth remembering…"
    style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textSec, fontSize: 12, padding: "8px 10px", resize: "none", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" }}
    rows={2} />
);

const MetricInput = ({ metric, value, onChange, color }) => {
  if (metric.type === "scale") {
    const min = metric.min !== undefined ? metric.min : 1;
    const max = metric.max !== undefined ? metric.max : 10;
    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
          <button key={n} onClick={() => onChange(value === n ? null : n)}
            style={{ minWidth: 34, height: 34, borderRadius: 7, border: `1.5px solid ${value === n ? color : C.border}`, background: value === n ? color : C.card, color: value === n ? "#fff" : C.textSec, fontSize: 13, fontWeight: value === n ? 700 : 400, cursor: "pointer", flex: "1 0 auto", maxWidth: 44 }}>
            {n}
          </button>
        ))}
      </div>
    );
  }
  if (metric.type === "hml") return <HMLInput value={value} onChange={onChange} color={color} />;
  if (metric.type === "select") return (
    <select value={value || ""} onChange={e => onChange(e.target.value || null)}
      style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: value ? C.textPri : C.textSec, fontSize: 13, padding: "9px 10px" }}>
      <option value="">Select…</option>
      {metric.options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (metric.type === "number") return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={() => onChange(Math.max(metric.min !== undefined ? metric.min : 0, (value || 0) - (metric.step || 1)))}
        style={{ width: 38, height: 38, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textSec, fontSize: 22, cursor: "pointer" }}>−</button>
      <span style={{ flex: 1, textAlign: "center", fontSize: 24, fontWeight: 700, color: C.textPri }}>{value !== undefined && value !== null ? value : "—"}</span>
      <button onClick={() => onChange(Math.min(metric.max !== undefined ? metric.max : 100, (value || 0) + (metric.step || 1)))}
        style={{ width: 38, height: 38, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textSec, fontSize: 22, cursor: "pointer" }}>+</button>
    </div>
  );
  if (metric.type === "wakeup_count") {
    const opts = ["0", "1", "2", "3", "4", "5", "6+"];
    return (
      <div style={{ display: "flex", gap: 6 }}>
        {opts.map(n => (
          <button key={n} onClick={() => onChange(value === n ? null : n)}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1.5px solid ${value === n ? color : C.border}`, background: value === n ? color : C.card, color: value === n ? "#fff" : C.textSec, fontSize: 13, fontWeight: value === n ? 700 : 400, cursor: "pointer" }}>
            {n}
          </button>
        ))}
      </div>
    );
  }
  if (metric.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (opt) => {
      const next = selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt];
      onChange(next.length ? next : null);
    };
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {metric.options.map(opt => (
          <button key={opt} onClick={() => toggle(opt)}
            style={{ padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${selected.includes(opt) ? color : C.border}`, background: selected.includes(opt) ? color + "33" : C.card, color: selected.includes(opt) ? color : C.textSec, fontSize: 12, fontWeight: selected.includes(opt) ? 700 : 400, cursor: "pointer" }}>
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (metric.type === "text") return (
    <textarea value={value || ""} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textPri, fontSize: 13, padding: "8px 10px", resize: "none", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box" }}
      rows={3} />
  );
  return null;
};

// ── PAIN MODAL (special multi-location) ─────────────────────────────────────
const PainModal = ({ slot, existing, onSave, onClose, painArea }) => {
  const PAIN_LOCATIONS = getPainLocations(painArea || "back");
  // entries = array of { location, level }
  const [entries, setEntries] = useState(existing?.painEntries || []);
  const [note, setNote] = useState(existing?.note || "");
  const [addingLoc, setAddingLoc] = useState(null); // location string being rated
  const [pickedLevel, setPickedLevel] = useState(null);

  const usedLocs = entries.map(e => e.location);

  const confirmAdd = () => {
    if (!addingLoc || !pickedLevel) return;
    setEntries(prev => {
      const idx = prev.findIndex(e => e.location === addingLoc);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = { location: addingLoc, level: pickedLevel }; return next;
      }
      return [...prev, { location: addingLoc, level: pickedLevel }];
    });
    setAddingLoc(null); setPickedLevel(null);
  };

  const removeEntry = (loc) => setEntries(prev => prev.filter(e => e.location !== loc));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.card, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.6)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🫀</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>Back pain</div>
              <div style={{ fontSize: 11, color: C.textSec }}>{slot}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: C.muted, border: "none", color: C.textSec, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>

        {/* existing entries */}
        {entries.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Logged areas</div>
            {entries.map(e => (
              <div key={e.location} style={{ display: "flex", alignItems: "center", gap: 8, background: C.painBg, border: `1px solid ${C.pain}44`, borderRadius: 10, padding: "8px 12px", marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>{e.location}</div>
                  <div style={{ fontSize: 11, color: PAIN_LEVEL_COLOR[e.level] || C.pain, marginTop: 2 }}>
                    {PAIN_LEVELS.find(p => p.id === e.level)?.label}
                  </div>
                </div>
                <button onClick={() => { setAddingLoc(e.location); setPickedLevel(e.level); }}
                  style={{ background: C.muted, border: "none", color: C.textSec, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>edit</button>
                <button onClick={() => removeEntry(e.location)}
                  style={{ background: C.painBg, border: `1px solid ${C.pain}55`, color: C.pain, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* add location */}
        {!addingLoc ? (
          <div>
            <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              {entries.length === 0 ? "Where does it hurt?" : "Add another area"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {PAIN_LOCATIONS.filter(l => !usedLocs.includes(l)).map(loc => (
                <button key={loc} onClick={() => { setAddingLoc(loc); setPickedLevel(null); }}
                  style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.textSec, fontSize: 13, textAlign: "left", cursor: "pointer" }}>
                  {loc}
                </button>
              ))}
              {PAIN_LOCATIONS.filter(l => !usedLocs.includes(l)).length === 0 && (
                <div style={{ fontSize: 12, color: C.textTer }}>All areas logged.</div>
              )}
            </div>

            {entries.length > 0 && (
              <>
                <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>Note (optional)</div>
                  <NoteField value={note} onChange={setNote} />
                </div>
                <button onClick={() => onSave({ painEntries: entries, note })}
                  style={{ width: "100%", padding: 13, borderRadius: 12, background: C.pain, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 12 }}>
                  Save check-in
                </button>
              </>
            )}

            {entries.length === 0 && (
              <button onClick={() => onSave({ painEntries: [], note: "", noPain: true })}
                style={{ width: "100%", padding: 12, borderRadius: 12, background: C.exBg, border: `1px solid ${C.good}44`, color: C.good, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 14 }}>
                ✓ No pain right now
              </button>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Rate: {addingLoc}
            </div>
            {PAIN_LEVELS.map(pl => (
              <button key={pl.id} onClick={() => setPickedLevel(pl.id)}
                style={{ display: "block", width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${pickedLevel === pl.id ? PAIN_LEVEL_COLOR[pl.id] : C.border}`, background: pickedLevel === pl.id ? PAIN_LEVEL_COLOR[pl.id] + "22" : C.surface, color: pickedLevel === pl.id ? PAIN_LEVEL_COLOR[pl.id] : C.textSec, fontSize: 13, textAlign: "left", cursor: "pointer", marginBottom: 6, fontWeight: pickedLevel === pl.id ? 600 : 400 }}>
                {pl.label}
              </button>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={confirmAdd} disabled={!pickedLevel}
                style={{ flex: 1, padding: 12, borderRadius: 10, background: pickedLevel ? C.pain : C.muted, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: pickedLevel ? "pointer" : "default" }}>
                Confirm
              </button>
              <button onClick={() => { setAddingLoc(null); setPickedLevel(null); }}
                style={{ padding: "12px 16px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 13, cursor: "pointer" }}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── generic log modal ────────────────────────────────────────────────────────
const LogModal = ({ tracker, slot, existing, onSave, onClose }) => {
  const [vals, setVals] = useState(existing?.metrics || {});
  const [note, setNote] = useState(existing?.note || "");
  const set = (id, v) => setVals(p => ({ ...p, [id]: v }));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.card, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{tracker.icon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>{tracker.label}</div>
              {slot && <div style={{ fontSize: 11, color: C.textSec }}>{slot}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: C.muted, border: "none", color: C.textSec, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
        {tracker.metrics.map(m => (
          <div key={m.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: C.textSec, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</div>
            <MetricInput metric={m} value={vals[m.id]} onChange={v => set(m.id, v)} color={tracker.color} />
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>Note (optional)</div>
          <NoteField value={note} onChange={setNote} />
        </div>
        <button onClick={() => onSave({ metrics: vals, note })}
          style={{ width: "100%", padding: 13, borderRadius: 12, background: tracker.color, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 12 }}>
          Save
        </button>
      </div>
    </div>
  );
};

// ── PAIN CARD ────────────────────────────────────────────────────────────────
const PainCard = ({ tracker, dayData, onLog }) => {
  const entries = dayData?.[tracker.id] || {};
  const slots = tracker.times;

  const slotDone = (slot) => {
    const e = entries[slot];
    return e && (e.noPain || (e.painEntries && e.painEntries.length > 0));
  };
  const doneCount = slots.filter(slotDone).length;
  const allDone = doneCount === slots.length;
  const anyDone = doneCount > 0;

  const slotSummary = (slot) => {
    const e = entries[slot];
    if (!e) return null;
    if (e.noPain) return { label: "None", color: C.good };
    if (!e.painEntries?.length) return null;
    const worst = e.painEntries.reduce((a, b) => {
      const ai = PAIN_LEVELS.findIndex(p => p.id === a.level);
      const bi = PAIN_LEVELS.findIndex(p => p.id === b.level);
      return bi > ai ? b : a;
    });
    return { label: PAIN_LEVELS.find(p => p.id === worst.level)?.short || worst.level, color: PAIN_LEVEL_COLOR[worst.level] || C.pain, count: e.painEntries.length };
  };

  return (
    <div onClick={() => onLog(tracker, null, null, "pain_picker")}
      style={{ background: C.card, borderRadius: 14, border: `1px solid ${anyDone ? C.pain + "55" : C.border}`, padding: "14px 14px", cursor: "pointer", transition: "border-color 0.15s" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🫀</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textPri }}>{tracker.label}</span>
        </div>
        <Badge color={allDone ? C.good : anyDone ? C.screen : C.warn} bg={allDone ? C.exBg : anyDone ? C.screenBg : C.alcBg}>
          {doneCount} / {slots.length}
        </Badge>
      </div>

      {/* slots */}
      <div style={{ display: "flex", gap: 6 }}>
        {slots.map(slot => {
          const done = slotDone(slot);
          const summary = slotSummary(slot);
          return (
            <div key={slot}
              onClick={e => { e.stopPropagation(); onLog(tracker, slot, entries[slot], "pain"); }}
              style={{ flex: 1, borderRadius: 10, padding: "9px 6px", background: done ? C.painBg : C.surface, border: `1px solid ${done ? C.pain + "55" : C.border}`, textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 9, color: C.textTer, marginBottom: 4 }}>{slot}</div>
              {done && summary
                ? <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: summary.color }}>{summary.label}</div>
                    {summary.count > 1 && <div style={{ fontSize: 9, color: C.textTer, marginTop: 2 }}>{summary.count} areas</div>}
                  </>
                : done
                ? <div style={{ fontSize: 12, color: C.good, fontWeight: 600 }}>✓</div>
                : <div style={{ fontSize: 20, color: C.textTer }}>+</div>
              }
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: C.textTer, marginTop: 8 }}>Tap a slot to log · tap card to see summary</div>
    </div>
  );
};

// ── GENERIC TRACKER CARD ─────────────────────────────────────────────────────
const TrackerCard = ({ tracker, dayData, onLog }) => {
  const color = tracker.color;
  const entries = dayData?.[tracker.id] || {};
  const entry = entries.main;
  const done = entry && tracker.metrics.some(m => entry.metrics?.[m.id] != null && entry.metrics[m.id] !== "");

  const hmlColor = (v) => v === "Low" ? C.food : v === "High" ? C.pain : C.alc;

  return (
    <div onClick={() => onLog(tracker, null, entry)}
      style={{ background: C.card, borderRadius: 14, border: `1px solid ${done ? color + "55" : C.border}`, padding: "14px 14px", cursor: "pointer", transition: "border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: done ? 10 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{tracker.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textPri }}>{tracker.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {entry?.note && <span title={entry.note} style={{ fontSize: 12, opacity: 0.4 }}>✏️</span>}
          {done
            ? <Badge color={C.good} bg={C.exBg}>Done</Badge>
            : <Badge color={C.warn} bg={C.alcBg}>Log</Badge>
          }
        </div>
      </div>

      {done && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tracker.metrics.map(m => {
            const v = entry?.metrics?.[m.id];
            if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
            const isText = m.type === "text";
            const isMulti = m.type === "multiselect";
            const display = isMulti
              ? (Array.isArray(v) ? v.join(", ") : String(v))
              : isText
              ? (String(v).length > 28 ? String(v).slice(0, 28) + "…" : String(v))
              : String(v);
            const wide = isText || isMulti;
            return (
              <div key={m.id} style={{ background: C.surface, borderRadius: 8, padding: "5px 10px", maxWidth: wide ? "100%" : undefined, flex: wide ? "1 1 100%" : undefined }}>
                <div style={{ fontSize: wide ? 11 : 12, fontWeight: wide ? 400 : 600, color: wide ? C.textSec : m.type === "hml" ? hmlColor(v) : color }}>{display}</div>
                <div style={{ fontSize: 9, color: C.textTer, marginTop: 1 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── EXERCISE MODAL (multi-session) ───────────────────────────────────────────
const ExerciseModal = ({ existing, onSave, onClose }) => {
  const [sessions, setSessions] = useState(existing?.sessions || []);
  const [adding, setAdding]     = useState(sessions.length === 0); // open form immediately if no sessions yet
  const [draft, setDraft]       = useState({ type: "", intensity: "", duration: null, note: "" });

  const TYPE_OPTS      = ["Pilates", "Running", "Walking", "Stretching", "Cycling", "HIIT", "Sports", "Other"];
  const INTENSITY_OPTS = ["Light", "Moderate", "Hard", "Max effort"];

  const confirmAdd = () => {
    if (!draft.type) return;
    setSessions(s => [...s, { ...draft, id: "s_" + Date.now() }]);
    setDraft({ type: "", intensity: "", duration: null, note: "" });
    setAdding(false);
  };

  const removeSession = (id) => setSessions(s => s.filter(x => x.id !== id));

  const summaryLine = (s) => [s.type, s.intensity, s.duration ? `${s.duration} min` : null].filter(Boolean).join(" · ");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.card, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.6)" }}>

        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏃</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>Exercise</div>
              <div style={{ fontSize: 11, color: C.textSec }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""} logged</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: C.muted, border: "none", color: C.textSec, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>

        {/* logged sessions */}
        {sessions.map((s) => (
          <div key={s.id} style={{ background: C.exBg, border: `1px solid ${C.ex}44`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ex }}>{summaryLine(s)}</div>
              {s.note ? <div style={{ fontSize: 11, color: C.textSec, marginTop: 3 }}>{s.note}</div> : null}
            </div>
            <button onClick={() => removeSession(s.id)}
              style={{ background: "transparent", border: "none", color: C.textTer, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}>✕</button>
          </div>
        ))}

        {/* add session form */}
        {adding ? (
          <div style={{ background: C.surface, borderRadius: 12, padding: 14, border: `1px solid ${C.ex}55`, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Type</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {TYPE_OPTS.map(o => (
                <button key={o} onClick={() => setDraft(d => ({ ...d, type: o }))}
                  style={{ padding: "7px 12px", borderRadius: 8, border: `1.5px solid ${draft.type === o ? C.ex : C.border}`, background: draft.type === o ? C.ex + "33" : C.card, color: draft.type === o ? C.ex : C.textSec, fontSize: 12, fontWeight: draft.type === o ? 700 : 400, cursor: "pointer" }}>
                  {o}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Intensity</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {INTENSITY_OPTS.map(o => (
                <button key={o} onClick={() => setDraft(d => ({ ...d, intensity: o }))}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1.5px solid ${draft.intensity === o ? C.ex : C.border}`, background: draft.intensity === o ? C.ex + "33" : C.card, color: draft.intensity === o ? C.ex : C.textSec, fontSize: 11, fontWeight: draft.intensity === o ? 700 : 400, cursor: "pointer" }}>
                  {o}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Duration (hrs)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <button onClick={() => setDraft(d => ({ ...d, duration: Math.max(0, Math.round(((d.duration || 0) - 0.5) * 10) / 10) }))}
                style={{ width: 38, height: 38, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textSec, fontSize: 22, cursor: "pointer" }}>−</button>
              <span style={{ flex: 1, textAlign: "center", fontSize: 24, fontWeight: 700, color: C.textPri }}>{draft.duration !== null && draft.duration !== undefined ? draft.duration + "h" : "—"}</span>
              <button onClick={() => setDraft(d => ({ ...d, duration: Math.round(((d.duration || 0) + 0.5) * 10) / 10 }))}
                style={{ width: 38, height: 38, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.textSec, fontSize: 22, cursor: "pointer" }}>+</button>
            </div>

            <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Note (optional)</div>
            <textarea value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
              placeholder="How did it feel?"
              style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textSec, fontSize: 12, padding: "8px 10px", resize: "none", fontFamily: "DM Sans, sans-serif", boxSizing: "border-box", marginBottom: 12 }}
              rows={2} />

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmAdd} disabled={!draft.type}
                style={{ flex: 1, padding: 11, borderRadius: 10, background: draft.type ? C.ex : C.muted, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: draft.type ? "pointer" : "default" }}>
                ✓ Add session
              </button>
              <button onClick={() => { setAdding(false); setDraft({ type: "", intensity: "", duration: null, note: "" }); }}
                style={{ padding: "11px 14px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px dashed ${C.ex}77`, background: "transparent", color: C.ex, fontSize: 13, cursor: "pointer", marginBottom: 12 }}>
            + Add another session
          </button>
        )}

        {sessions.length > 0 && !adding && (
          <button onClick={() => onSave({ sessions })}
            style={{ width: "100%", padding: 13, borderRadius: 12, background: C.ex, border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
            Save
          </button>
        )}
      </div>
    </div>
  );
};

// ── EXERCISE CARD ─────────────────────────────────────────────────────────────
const ExerciseCard = ({ tracker, dayData, onLog }) => {
  const entry    = dayData?.[tracker.id];
  const sessions = entry?.sessions || [];
  const done     = sessions.length > 0;

  const summaryLine = (s) => [s.type, s.intensity, s.duration ? `${s.duration}h` : null].filter(Boolean).join(" · ");

  return (
    <div onClick={() => onLog(tracker, null, entry, "exercise")}
      style={{ background: C.card, borderRadius: 14, border: `1px solid ${done ? C.ex + "55" : C.border}`, padding: "14px 14px", cursor: "pointer", transition: "border-color 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: done ? 10 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>🏃</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.textPri }}>Exercise</span>
        </div>
        {done
          ? <Badge color={C.good} bg={C.exBg}>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</Badge>
          : <Badge color={C.warn} bg={C.alcBg}>Log</Badge>
        }
      </div>
      {done && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {sessions.map((s, i) => (
            <div key={s.id || i} style={{ background: C.exBg, borderRadius: 8, padding: "6px 10px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.ex }}>{summaryLine(s)}</div>
              {s.note && <div style={{ fontSize: 10, color: C.textTer, marginTop: 2 }}>{s.note.length > 40 ? s.note.slice(0, 40) + "…" : s.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const PainSummaryModal = ({ tracker, dayData, onLogSlot, onClose }) => {
  const entries = dayData?.[tracker.id] || {};
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.card, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🫀</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>Back pain — today</span>
          </div>
          <button onClick={onClose} style={{ background: C.muted, border: "none", color: C.textSec, borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
        {tracker.times.map(slot => {
          const e = entries[slot];
          const done = e && (e.noPain || e.painEntries?.length > 0);
          return (
            <div key={slot} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.textTer, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{slot}</div>
              {done ? (
                <div style={{ background: C.painBg, borderRadius: 10, padding: 12, border: `1px solid ${C.pain}33` }}>
                  {e.noPain
                    ? <div style={{ fontSize: 13, color: C.good }}>✓ No pain</div>
                    : e.painEntries.map(pe => (
                        <div key={pe.location} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: C.textSec }}>{pe.location}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: PAIN_LEVEL_COLOR[pe.level] || C.pain }}>
                            {PAIN_LEVELS.find(p => p.id === pe.level)?.short}
                          </span>
                        </div>
                      ))
                  }
                  {e.note && <div style={{ fontSize: 11, color: C.textTer, marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>{e.note}</div>}
                  <button onClick={() => onLogSlot(slot, e)}
                    style={{ marginTop: 8, width: "100%", padding: "7px 0", borderRadius: 8, background: C.muted, border: "none", color: C.textSec, fontSize: 12, cursor: "pointer" }}>
                    Edit
                  </button>
                </div>
              ) : (
                <button onClick={() => onLogSlot(slot, null)}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: `1px dashed ${C.border}`, background: "transparent", color: C.textSec, fontSize: 13, cursor: "pointer" }}>
                  + Log {slot.toLowerCase()} check-in
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── TODAY PAGE ───────────────────────────────────────────────────────────────
const TodayPage = ({ data, trackers, onLog, date, setDate, userName }) => {
  const dayData = data[date] || {};
  const active = trackers.filter(t => t.active !== false);
  const isToday = date === today();

  const isDone = (t) => {
    const entries = dayData[t.id] || {};
    if (t.type === "pain_special") {
      return t.times.every(s => {
        const e = entries[s];
        return e && (e.noPain || e.painEntries && e.painEntries.length > 0);
      });
    }
    if (t.id === "exercise") return (entries.sessions && entries.sessions.length > 0);
    const e = entries.main;
    return e && t.metrics.some(m => e.metrics && e.metrics[m.id] != null && e.metrics[m.id] !== "");
  };

  const doneCount = active.filter(isDone).length;
  const total = active.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const greeting = isToday ? getGreeting(userName, data, trackers) : null;

  return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
      <div style={{ padding: "14px 16px 12px", background: C.surface, borderBottom: "1px solid " + C.border }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: greeting ? 8 : 10 }}>
          <div>
            <div style={{ fontSize: 10, color: C.textTer, marginBottom: 3, fontFamily: "DM Mono, monospace", letterSpacing: "0.1em" }}>CHRONICALLY CURIOUS</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.textPri, lineHeight: 1 }}>
              {isToday ? "Today" : fmt(date)}
            </div>
            {isToday && <div style={{ fontSize: 11, color: C.textTer, marginTop: 3 }}>{fmt(date)}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)); }}
              style={{ width: 32, height: 32, borderRadius: 8, background: C.card, border: "1px solid " + C.border, color: C.textSec, cursor: "pointer", fontSize: 14 }}>←</button>
            {!isToday && (
              <button onClick={() => setDate(today())}
                style={{ padding: "0 10px", height: 32, borderRadius: 8, background: C.card, border: "1px solid " + C.screen + "55", color: C.screen, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Now</button>
            )}
            <button onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); if (d.toISOString().slice(0,10) <= today()) setDate(d.toISOString().slice(0,10)); }}
              style={{ width: 32, height: 32, borderRadius: 8, background: C.card, border: "1px solid " + C.border, color: isToday ? C.muted : C.textSec, cursor: isToday ? "default" : "pointer", fontSize: 14 }}>→</button>
          </div>
        </div>

        {greeting && (
          <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.5, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid " + C.border }}>
            {greeting}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 5, background: C.muted, borderRadius: 3 }}>
            <div style={{ width: pct + "%", height: 5, borderRadius: 3, background: pct === 100 ? C.good : C.screen, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ fontSize: 11, color: C.textSec, minWidth: 55, textAlign: "right" }}>{doneCount}/{total} done</div>
        </div>
      </div>

      <div style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {isToday && <WeeklyReflection data={data} />}
        {active.map(t =>
          t.type === "pain_special"
            ? <PainCard     key={t.id} tracker={t} dayData={dayData} onLog={onLog} />
            : t.id === "exercise"
            ? <ExerciseCard key={t.id} tracker={t} dayData={dayData} onLog={onLog} />
            : <TrackerCard  key={t.id} tracker={t} dayData={dayData} onLog={onLog} />
        )}
      </div>
    </div>
  );
};

// ── TRENDS PAGE ──────────────────────────────────────────────────────────────
const TrendsPage = ({ data, trackers }) => {
  const [range, setRange]   = useState(30);
  const [corrTab, setCorrTab] = useState("pain"); // "pain" | "sleep"
  const [overlay, setOverlay] = useState(["back_pain", "sleep", "alcohol"]);

  const dates = Array.from({ length: range }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (range - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  // ── series builders ──────────────────────────────────────────────────────
  const painSeries = dates.map(d => {
    const entry = data[d] && data[d].back_pain;
    if (!entry) return null;
    const allPain = ["Morning","Afternoon","Evening"].flatMap(s => (entry[s] && entry[s].painEntries) || []);
    if (!allPain.length) return null;
    const scores = allPain.map(pe => PAIN_LEVELS.findIndex(p => p.id === pe.level));
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  });

  const getMetric = (trackerId, metricId) => dates.map(d => {
    const entry = data[d] && data[d][trackerId] && data[d][trackerId].main;
    return (entry && entry.metrics && entry.metrics[metricId] !== undefined) ? entry.metrics[metricId] : null;
  });

  // Sleep: encode fall_asleep as number (0=<15min, 5=2h+) and wakeups as number
  const sleepDelaySeries = getMetric("sleep", "fall_asleep").map(v => {
    if (v == null) return null;
    return ["< 15 min","15 min","30 min","45 min","1 hour","2+ hours"].indexOf(v);
  });
  const sleepWakeupSeries = getMetric("sleep", "stay_asleep").map(v => {
    if (v == null) return null;
    return ["0","1","2","3","4","5","6+"].indexOf(v);
  });
  const sleepDurationSeries = getMetric("sleep", "duration");

  const alcSeries    = getMetric("alcohol", "units");
  const screenPhoneSeries  = getMetric("screen", "phone");
  const screenLaptopSeries = getMetric("screen", "laptop");
  const foodCalSeries  = getMetric("food", "calories").map(v => v == null ? null : ["Low","Medium","High"].indexOf(v));
  const foodSugSeries  = getMetric("food", "sugar").map(v => v == null ? null : ["Low","Medium","High"].indexOf(v));
  const medSeries    = getMetric("pain_relief", "medication_doses");

  const exSeries = dates.map(d => {
    const entry = data[d] && data[d].exercise;
    if (!entry || !entry.sessions || !entry.sessions.length) return null;
    return entry.sessions.reduce((sum, s) => sum + (s.duration || 0), 0) || null;
  });

  // combined screen time
  const screenTotalSeries = dates.map((_, i) => {
    const p = screenPhoneSeries[i], l = screenLaptopSeries[i];
    if (p == null && l == null) return null;
    return (p || 0) + (l || 0);
  });

  // ── correlation engine ───────────────────────────────────────────────────
  const correlation = (a, b) => {
    const pairs = a.map((v, i) => [v, b[i]]).filter(([x, y]) => x != null && y != null);
    if (pairs.length < 5) return null;
    const mx = pairs.reduce((s, [x]) => s + x, 0) / pairs.length;
    const my = pairs.reduce((s, [, y]) => s + y, 0) / pairs.length;
    const num = pairs.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
    const den = Math.sqrt(
      pairs.reduce((s, [x]) => s + (x - mx) * (x - mx), 0) *
      pairs.reduce((s, [, y]) => s + (y - my) * (y - my), 0)
    );
    return den === 0 ? 0 : clamp(num / den, -1, 1);
  };
  const lag1 = s => [null, ...s.slice(0, -1)];

  // ── pain correlations (next-day lag where relevant) ──────────────────────
  const painCorrs = [
    { label: "Poor sleep (delay)",  val: correlation(lag1(sleepDelaySeries),   painSeries), inv: false, note: "next day" },
    { label: "Waking up at night",  val: correlation(lag1(sleepWakeupSeries),  painSeries), inv: false, note: "next day" },
    { label: "Alcohol",             val: correlation(lag1(alcSeries),           painSeries), inv: false, note: "next day" },
    { label: "Exercise",            val: correlation(lag1(exSeries),            painSeries), inv: true,  note: "next day" },
    { label: "Screen time (total)", val: correlation(screenTotalSeries,         painSeries), inv: false, note: "same day" },
    { label: "Calorie intake",      val: correlation(lag1(foodCalSeries),       painSeries), inv: false, note: "next day" },
    { label: "Sugar / carbs",       val: correlation(lag1(foodSugSeries),       painSeries), inv: false, note: "next day" },
    { label: "Medication doses",    val: correlation(medSeries,                 painSeries), inv: false, note: "same day" },
  ];

  // ── sleep correlations ───────────────────────────────────────────────────
  // Target: sleep delay (higher = worse). Lag: same night effect + next-night
  const sleepCorrs = [
    { label: "Pain (same day)",     val: correlation(painSeries,               sleepDelaySeries), inv: false, note: "same night" },
    { label: "Alcohol",             val: correlation(alcSeries,                sleepDelaySeries), inv: false, note: "same night" },
    { label: "Exercise",            val: correlation(exSeries,                 sleepDelaySeries), inv: true,  note: "same day"  },
    { label: "Screen time (total)", val: correlation(screenTotalSeries,        sleepDelaySeries), inv: false, note: "same night" },
    { label: "Calorie intake",      val: correlation(foodCalSeries,            sleepDelaySeries), inv: false, note: "same night" },
    { label: "Sugar / carbs",       val: correlation(foodSugSeries,            sleepDelaySeries), inv: false, note: "same night" },
    { label: "Medication doses",    val: correlation(medSeries,                sleepDelaySeries), inv: false, note: "same night" },
    // also check wakeups separately
    { label: "Pain → waking up",    val: correlation(painSeries,               sleepWakeupSeries), inv: false, note: "same night" },
    { label: "Alcohol → waking up", val: correlation(alcSeries,                sleepWakeupSeries), inv: false, note: "same night" },
  ];

  const corrFmt = v => v == null ? "n/a" : (v >= 0 ? "+" : "") + v.toFixed(2);
  const corrColor = (v, inv) => {
    if (v == null) return C.textTer;
    if (Math.abs(v) < 0.2) return C.textTer;
    return (inv ? v < 0 : v > 0) ? C.pain : C.good;
  };

  // ── chart helpers ────────────────────────────────────────────────────────
  const normalize = series => {
    const vals = series.filter(v => v != null);
    if (!vals.length) return series.map(() => null);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    if (mx === mn) return series.map(v => v != null ? 0.5 : null);
    return series.map(v => v != null ? (v - mn) / (mx - mn) : null);
  };
  const sparkPath = (series, w, h, invert = false) => {
    const norm = normalize(series);
    const pts = norm.map((v, i) => v != null ? [i / Math.max(norm.length - 1, 1) * w, (invert ? v : 1 - v) * h * 0.8 + h * 0.1] : null).filter(Boolean);
    if (pts.length < 2) return "";
    return "M" + pts.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join("L");
  };
  const areaPath = (series, w, h) => {
    const norm = normalize(series);
    const pts = norm.map((v, i) => v != null ? [i / Math.max(norm.length - 1, 1) * w, (1 - v) * h * 0.8 + h * 0.1] : null).filter(Boolean);
    if (pts.length < 2) return "";
    return "M" + pts[0][0] + "," + h + "L" + pts.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join("L") + "L" + pts[pts.length - 1][0] + "," + h + "Z";
  };

  const avgChange = s => {
    const vals = s.filter(v => v != null);
    if (vals.length < 4) return null;
    const half = Math.floor(vals.length / 2);
    const early = vals.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const late  = vals.slice(half).reduce((a, b) => a + b, 0) / (vals.length - half);
    return (late - early).toFixed(2);
  };
  const painChange  = avgChange(painSeries);
  const sleepChange = avgChange(sleepDelaySeries);

  const W = 280, H = 90;

  const overlayItems = [
    { id: "back_pain",  label: "Pain",       series: painSeries,        color: C.pain,   invert: false },
    { id: "sleep",      label: "Sleep delay", series: sleepDelaySeries,  color: C.sleep,  invert: false },
    { id: "alcohol",    label: "Alcohol",     series: alcSeries,         color: C.alc,    invert: false },
    { id: "exercise",   label: "Exercise",    series: exSeries,          color: C.ex,     invert: false },
    { id: "screen",     label: "Screen",      series: screenTotalSeries, color: C.screen, invert: false },
  ];

  // ── insights ─────────────────────────────────────────────────────────────
  const insights = [];
  const pc = painCorrs.find(c => c.label === "Poor sleep (delay)");
  if (pc && pc.val != null && pc.val > 0.4) insights.push({ t: "warn", msg: "Poor sleep strongly precedes higher pain the next day (" + corrFmt(pc.val) + "). Prioritising sleep may be your biggest lever." });
  const ac = painCorrs.find(c => c.label === "Alcohol");
  if (ac && ac.val != null && ac.val > 0.35) insights.push({ t: "warn", msg: "Alcohol correlates with next-day pain (" + corrFmt(ac.val) + ")." });
  const ec = painCorrs.find(c => c.label === "Exercise");
  if (ec && ec.val != null && ec.val < -0.3) insights.push({ t: "good", msg: "Exercise is associated with lower pain the next day (" + corrFmt(ec.val) + "). Movement is helping." });
  const sc = sleepCorrs.find(c => c.label === "Pain (same day)");
  if (sc && sc.val != null && sc.val > 0.4) insights.push({ t: "warn", msg: "Pain and sleep difficulty move together the same night (" + corrFmt(sc.val) + "). Managing pain before bed may help." });
  const alcs = sleepCorrs.find(c => c.label === "Alcohol");
  if (alcs && alcs.val != null && alcs.val > 0.35) insights.push({ t: "warn", msg: "Alcohol correlates with difficulty falling asleep (" + corrFmt(alcs.val) + ")." });
  const exs = sleepCorrs.find(c => c.label === "Exercise");
  if (exs && exs.val != null && exs.val < -0.3) insights.push({ t: "good", msg: "Exercise days tend to come with better sleep (" + corrFmt(exs.val) + ")." });
  if (painChange != null && parseFloat(painChange) < -0.3) insights.push({ t: "good", msg: "Your pain severity is trending down over this period." });
  if (sleepChange != null && parseFloat(sleepChange) < -0.3) insights.push({ t: "good", msg: "Your time to fall asleep is trending shorter over this period." });
  if (!insights.length) insights.push({ t: "info", msg: "Keep logging daily — patterns emerge after ~14 days of consistent data." });

  return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
      <div style={{ padding: "14px 16px 12px", background: C.surface, borderBottom: "1px solid " + C.border }}>
        <div style={{ fontSize: 10, color: C.textTer, marginBottom: 3, fontFamily: "DM Mono, monospace", letterSpacing: "0.1em" }}>CHRONICALLY CURIOUS</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.textPri, marginBottom: 10 }}>Trends</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 14, 30, 90].map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{ flex: 1, padding: "5px 0", borderRadius: 8, border: "1px solid " + (range === r ? C.screen : C.border), background: range === r ? C.screenBg : C.card, color: range === r ? C.screen : C.textSec, fontSize: 12, cursor: "pointer", fontWeight: range === r ? 700 : 400 }}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* pain sparkline */}
        <div style={{ background: C.card, borderRadius: 14, padding: 14, border: "1px solid " + C.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span>🫀</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>Back pain — {range}d</span>
          </div>
          <svg width="100%" viewBox={"0 0 " + W + " " + H}>
            <path d={areaPath(painSeries, W, H)} fill={C.pain} opacity={0.08} />
            <path d={sparkPath(painSeries, W, H)} fill="none" stroke={C.pain} strokeWidth={1.5} />
          </svg>
          {painChange != null && (
            <div style={{ fontSize: 11, color: parseFloat(painChange) <= 0 ? C.good : C.warn, marginTop: 4 }}>
              {parseFloat(painChange) <= 0 ? "↓ Trending better" : "↑ Trending higher"} vs start of period
            </div>
          )}
        </div>

        {/* sleep sparkline */}
        <div style={{ background: C.card, borderRadius: 14, padding: 14, border: "1px solid " + C.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span>🌙</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>Sleep (time to fall asleep) — {range}d</span>
          </div>
          <svg width="100%" viewBox={"0 0 " + W + " " + H}>
            <path d={areaPath(sleepDelaySeries, W, H)} fill={C.sleep} opacity={0.08} />
            <path d={sparkPath(sleepDelaySeries, W, H)} fill="none" stroke={C.sleep} strokeWidth={1.5} />
          </svg>
          {sleepChange != null && (
            <div style={{ fontSize: 11, color: parseFloat(sleepChange) <= 0 ? C.good : C.warn, marginTop: 4 }}>
              {parseFloat(sleepChange) <= 0 ? "↓ Falling asleep faster" : "↑ Taking longer to fall asleep"} vs start of period
            </div>
          )}
        </div>

        {/* overlay */}
        <div style={{ background: C.card, borderRadius: 14, padding: 14, border: "1px solid " + C.border }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 8 }}>Overlay comparison</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {overlayItems.map(item => (
              <button key={item.id} onClick={() => setOverlay(o => o.includes(item.id) ? o.filter(x => x !== item.id) : [...o, item.id])}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "1px solid " + (overlay.includes(item.id) ? item.color : C.border), background: overlay.includes(item.id) ? item.color + "22" : C.surface, cursor: "pointer" }}>
                <div style={{ width: 10, height: 2, background: item.color, borderRadius: 1 }} />
                <span style={{ fontSize: 10, color: overlay.includes(item.id) ? item.color : C.textTer }}>{item.label}</span>
              </button>
            ))}
          </div>
          <svg width="100%" viewBox={"0 0 " + W + " " + H}>
            {overlayItems.filter(i => overlay.includes(i.id)).map(item => (
              <path key={item.id} d={sparkPath(item.series, W, H, item.invert)} fill="none" stroke={item.color} strokeWidth={1.5} opacity={0.85} />
            ))}
          </svg>
          <div style={{ fontSize: 10, color: C.textTer, marginTop: 4 }}>All normalised 0–1 for comparison. Higher = more of that thing.</div>
        </div>

        {/* correlations — tabbed */}
        <div style={{ background: C.card, borderRadius: 14, padding: 14, border: "1px solid " + C.border }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri, marginBottom: 10 }}>Correlations</div>

          {/* tab switcher */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {[{ id: "pain", label: "🫀 With pain", color: C.pain, bg: C.painBg },
              { id: "sleep", label: "🌙 With sleep", color: C.sleep, bg: C.sleepBg }].map(tab => (
              <button key={tab.id} onClick={() => setCorrTab(tab.id)}
                style={{ flex: 1, padding: "7px 0", borderRadius: 9, border: "1.5px solid " + (corrTab === tab.id ? tab.color : C.border), background: corrTab === tab.id ? tab.bg : C.surface, color: corrTab === tab.id ? tab.color : C.textSec, fontSize: 12, fontWeight: corrTab === tab.id ? 700 : 400, cursor: "pointer" }}>
                {tab.label}
              </button>
            ))}
          </div>

          {corrTab === "pain" && (
            <>
              <div style={{ fontSize: 10, color: C.textTer, marginBottom: 10, lineHeight: 1.5 }}>
                How each factor relates to your pain. Lagged factors use the previous day's value. Needs 5+ paired data points to show a result.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {painCorrs.map(({ label, val, inv, note }) => (
                  <div key={label} style={{ background: C.surface, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: C.textTer, lineHeight: 1.5, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 9, color: C.textTer, marginBottom: 4, fontStyle: "italic" }}>{note}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: corrColor(val, inv) }}>{corrFmt(val)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {corrTab === "sleep" && (
            <>
              <div style={{ fontSize: 10, color: C.textTer, marginBottom: 10, lineHeight: 1.5 }}>
                How each factor relates to sleep quality (time to fall asleep + wake-ups). Higher score = worse sleep.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {sleepCorrs.map(({ label, val, inv, note }) => (
                  <div key={label} style={{ background: C.surface, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: C.textTer, lineHeight: 1.5, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 9, color: C.textTer, marginBottom: 4, fontStyle: "italic" }}>{note}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: corrColor(val, inv) }}>{corrFmt(val)}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ fontSize: 9, color: C.textTer, marginTop: 10 }}>+1 = move together · −1 = opposite · 0 = no link · grey = not enough data</div>
        </div>

        {/* insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ borderRadius: 10, padding: "10px 12px", background: ins.t === "good" ? C.exBg : ins.t === "warn" ? C.alcBg : C.screenBg, border: "1px solid " + (ins.t === "good" ? C.good + "44" : ins.t === "warn" ? C.alc + "44" : C.screen + "44") }}>
              <div style={{ fontSize: 12, color: ins.t === "good" ? C.good : ins.t === "warn" ? C.alc : C.screen }}>
                {ins.t === "good" ? "↓ " : ins.t === "warn" ? "⚠ " : "💡 "}{ins.msg}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

// ── HISTORY PAGE ─────────────────────────────────────────────────────────────
const HistoryPage = ({ data, trackers }) => {
  const allDates = Object.keys(data).sort((a, b) => b.localeCompare(a));
  const active = trackers.filter(t => t.active !== false);

  const isDone = (t, dayData) => {
    const entries = dayData[t.id] || {};
    if (t.type === "pain_special") return t.times.some(s => { const e = entries[s]; return e && (e.noPain || e.painEntries?.length > 0); });
    if (t.id === "exercise") return (entries.sessions?.length > 0);
    const e = entries.main;
    return e && t.metrics.some(m => e.metrics?.[m.id] != null);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
      <div style={{ padding: "14px 16px 12px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.textTer, marginBottom: 3, fontFamily: "DM Mono, monospace", letterSpacing: "0.1em" }}>CHRONICALLY CURIOUS</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.textPri }}>History</div>
      </div>
      <div style={{ padding: "14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!allDates.length && <div style={{ fontSize: 13, color: C.textTer, textAlign: "center", marginTop: 50 }}>No entries yet — start on the Today tab!</div>}
        {allDates.map(d => {
          const dayData = data[d] || {};
          const doneTs = active.filter(t => isDone(t, dayData));
          return (
            <div key={d} style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "10px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>{fmt(d)}</div>
                <div style={{ fontSize: 11, color: doneTs.length === active.length ? C.good : C.textSec }}>{doneTs.length}/{active.length}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {active.map(t => {
                  const done = isDone(t, dayData);
                  return (
                    <div key={t.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: done ? t.bg : C.surface, color: done ? t.color : C.textTer, border: `1px solid ${done ? t.color + "44" : C.border}` }}>
                      {t.icon}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── REMINDERS TAB ────────────────────────────────────────────────────────────
const REMINDER_DEFS = [
  { id: "morning",   label: "Morning check-in",  sub: "Back pain · all 3× trackers", defaultTime: "08:00" },
  { id: "afternoon", label: "Afternoon check-in", sub: "Back pain mid-day",           defaultTime: "13:00" },
  { id: "evening",   label: "Evening wrap-up",    sub: "All trackers",                defaultTime: "21:00" },
  { id: "nudge",     label: "Gentle nudge",       sub: "If nothing logged yet today", defaultTime: "22:00" },
];

const RemindersTab = ({ reminders, setReminders }) => {
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unavailable"
  );
  const [editingTime, setEditingTime] = useState(null); // reminder id being time-edited

  const getTime = (id) => reminders[id + "_time"] || REMINDER_DEFS.find(r => r.id === id)?.defaultTime || "09:00";
  const isOn    = (id) => reminders[id] !== false;

  const scheduleNotification = async (id, time, label) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const [h, m] = time.split(":").map(Number);
    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(h, m, 0, 0);
    if (scheduled <= now) scheduled.setDate(scheduled.getDate() + 1);
    const delay = scheduled - now;
    setTimeout(() => {
      new Notification("Chronically Curious", {
        body: label + " — time to log!",
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='28' font-size='28'>🫀</text></svg>",
      });
    }, delay);
  };

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPerm(result);
    if (result === "granted") {
      REMINDER_DEFS.forEach(r => {
        if (isOn(r.id)) scheduleNotification(r.id, getTime(r.id), r.label);
      });
    }
  };

  const handleToggle = (id) => {
    const wasOn = isOn(id);
    setReminders(p => ({ ...p, [id]: wasOn ? false : true }));
    if (!wasOn && notifPerm === "granted") {
      const def = REMINDER_DEFS.find(r => r.id === id);
      scheduleNotification(id, getTime(id), def.label);
    }
  };

  const handleTimeChange = (id, time) => {
    setReminders(p => ({ ...p, [id + "_time"]: time }));
    const def = REMINDER_DEFS.find(r => r.id === id);
    if (isOn(id) && notifPerm === "granted") scheduleNotification(id, time, def.label);
    setEditingTime(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* permission banner */}
      {notifPerm !== "granted" && notifPerm !== "unavailable" && (
        <div style={{ background: C.screenBg, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.screen}44`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.screen }}>Enable notifications</div>
            <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>Allow browser notifications to receive reminders</div>
          </div>
          <button onClick={requestPermission}
            style={{ background: C.screen, border: "none", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            Allow
          </button>
        </div>
      )}
      {notifPerm === "granted" && (
        <div style={{ background: C.exBg, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.good}33`, fontSize: 11, color: C.good }}>
          ✓ Notifications enabled — reminders will fire once daily at the set time
        </div>
      )}
      {notifPerm === "denied" && (
        <div style={{ background: C.painBg, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.pain}33`, fontSize: 11, color: C.pain }}>
          Notifications blocked — enable them in your browser / OS settings, then reload
        </div>
      )}

      {/* reminder rows */}
      <div style={{ background: C.card, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {REMINDER_DEFS.map((r, i) => (
          <div key={r.id}>
            <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: i < REMINDER_DEFS.length - 1 && editingTime !== r.id ? `1px solid ${C.border}` : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: isOn(r.id) ? C.textPri : C.textSec }}>{r.label}</div>
                <div style={{ fontSize: 10, color: C.textTer, marginTop: 2 }}>{r.sub}</div>
              </div>
              {/* time badge — tappable */}
              <button onClick={() => isOn(r.id) && setEditingTime(editingTime === r.id ? null : r.id)}
                style={{ fontSize: 12, color: isOn(r.id) ? C.screen : C.textTer, background: isOn(r.id) ? C.screenBg : C.muted, border: "none", padding: "4px 10px", borderRadius: 7, marginRight: 10, cursor: isOn(r.id) ? "pointer" : "default", fontWeight: 600, fontFamily: "DM Mono, monospace" }}>
                {getTime(r.id)}
              </button>
              <Toggle on={isOn(r.id)} onToggle={() => handleToggle(r.id)} />
            </div>
            {/* inline time picker */}
            {editingTime === r.id && isOn(r.id) && (
              <div style={{ padding: "0 14px 14px", borderBottom: i < REMINDER_DEFS.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ fontSize: 11, color: C.textTer, marginBottom: 8 }}>Set time for "{r.label}"</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="time" defaultValue={getTime(r.id)}
                    id={`time_input_${r.id}`}
                    style={{ flex: 1, background: C.surface, border: `1px solid ${C.screen}`, borderRadius: 8, color: C.textPri, fontSize: 16, padding: "9px 12px", fontFamily: "DM Mono, monospace" }} />
                  <button onClick={() => {
                    const val = document.getElementById(`time_input_${r.id}`)?.value;
                    if (val) handleTimeChange(r.id, val);
                  }}
                    style={{ padding: "9px 16px", borderRadius: 8, background: C.screen, border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                    Set
                  </button>
                  <button onClick={() => setEditingTime(null)}
                    style={{ padding: "9px 12px", borderRadius: 8, background: C.card, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 13, cursor: "pointer" }}>
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.textTer, lineHeight: 1.5 }}>
        Tap the time badge to change it. Notifications fire once per day and repeat the next day. For reliable daily reminders on mobile, save this page to your home screen.
      </div>
    </div>
  );
};

// ── TRACKER EDITOR constants ──────────────────────────────────────────────────
const METRIC_TYPES = [
  { id: "scale",       label: "Scale 1–10" },
  { id: "hml",         label: "Low/Med/High" },
  { id: "number",      label: "Number" },
  { id: "select",      label: "Single choice" },
  { id: "multiselect", label: "Multi-select" },
  { id: "text",        label: "Free text" },
];
const FREQ_OPTIONS = [
  { id: "3x",  label: "3× daily" },
  { id: "1x",  label: "Once/day" },
  { id: "eod", label: "End of day" },
];
const COLORS = [C.pain, C.sleep, C.alc, C.food, C.screen, C.ex, C.custom, "#E87AB0", "#E8C44A", "#A78BDD"];
const BG_MAP  = {
  [C.pain]:    C.painBg,
  [C.sleep]:   C.sleepBg,
  [C.alc]:     C.alcBg,
  [C.food]:    C.foodBg,
  [C.screen]:  C.screenBg,
  [C.ex]:      C.exBg,
  [C.custom]:  C.customBg,
  "#A78BDD":   "#1E1830",
};

// ── TRACKER EDITOR (isolated state, no stale closure) ────────────────────────
const TrackerEditor = ({ initial, isNew, onSave, onBack, onToggleActive }) => {
  // Single atomic state object - no stale closure possible
  const [state, dispatch] = useReducer((s, action) => {
    switch (action.type) {
      case "SET_LABEL":     return { ...s, draft: { ...s.draft, label: action.value } };
      case "SET_ICON":      return { ...s, draft: { ...s.draft, icon: action.value } };
      case "SET_COLOR":     return { ...s, draft: { ...s.draft, color: action.color, bg: action.bg } };
      case "SET_FREQ":      return { ...s, draft: { ...s.draft, frequency: action.id, times: action.id === "3x" ? ["Morning","Afternoon","Evening"] : undefined } };
      case "ADD_METRIC": {
        const m = { id: "m_" + Date.now(), label: s.newLabel, type: s.newType };
        if (s.newType === "scale")  { m.min = 1; m.max = 10; }
        if (s.newType === "number") { m.min = 0; m.max = 100; m.step = 1; }
        if (s.newType === "select" || s.newType === "multiselect") {
          m.options = s.newOptions.split(",").map(x => x.trim()).filter(Boolean);
        }
        return { ...s, draft: { ...s.draft, metrics: [...s.draft.metrics, m] }, adding: false, newLabel: "", newType: "scale", newOptions: "" };
      }
      case "REMOVE_METRIC": return { ...s, draft: { ...s.draft, metrics: s.draft.metrics.filter((_, i) => i !== action.idx) } };
      case "SET_ADDING":    return { ...s, adding: action.value, newLabel: "", newType: "scale", newOptions: "" };
      case "SET_NEW_LABEL": return { ...s, newLabel: action.value };
      case "SET_NEW_TYPE":  return { ...s, newType: action.value, newOptions: "" };
      case "SET_NEW_OPTS":  return { ...s, newOptions: action.value };
      default: return s;
    }
  }, {
    draft: { ...initial, metrics: (initial.metrics || []).map(m => ({ ...m })) },
    adding: false,
    newLabel: "",
    newType: "scale",
    newOptions: "",
  });

  const { draft, adding, newLabel, newType, newOptions } = state;
  const canAdd = newLabel.trim().length > 0;
  const canSave = draft.label.trim().length > 0;

  const removeMetric = (idx) => dispatch({ type: "REMOVE_METRIC", idx });

  return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
      <div style={{ padding: "14px 16px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: C.textSec, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>← Back</button>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri }}>{isNew ? "New tracker" : "Edit: " + draft.label}</div>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>

        <div>
          <div style={{ fontSize: 11, color: C.textTer, marginBottom: 5 }}>NAME</div>
          <input value={draft.label} onChange={e => dispatch({ type: "SET_LABEL", value: e.target.value })} placeholder="Tracker name"
            style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textPri, fontSize: 14, padding: "10px 12px", boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.textTer, marginBottom: 5 }}>ICON</div>
            <input value={draft.icon} onChange={e => dispatch({ type: "SET_ICON", value: e.target.value })} maxLength={2}
              style={{ width: 54, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.textPri, fontSize: 22, padding: "5px 8px", textAlign: "center" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.textTer, marginBottom: 8 }}>COLOUR</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {COLORS.map(col => (
                <div key={col} onClick={() => dispatch({ type: "SET_COLOR", color: col, bg: BG_MAP[col] || C.customBg })}
                  style={{ width: 26, height: 26, borderRadius: "50%", background: col, cursor: "pointer", outline: draft.color === col ? "3px solid " + C.textPri : "none", outlineOffset: 2 }} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: C.textTer, marginBottom: 8 }}>FREQUENCY</div>
          <div style={{ display: "flex", gap: 6 }}>
            {FREQ_OPTIONS.map(f => (
              <button key={f.id} onClick={() => dispatch({ type: "SET_FREQ", id: f.id })}
                style={{ flex: 1, padding: 9, borderRadius: 8, border: "1px solid " + (draft.frequency === f.id ? draft.color : C.border), background: draft.frequency === f.id ? draft.color + "22" : C.card, color: draft.frequency === f.id ? draft.color : C.textSec, fontSize: 11, cursor: "pointer", fontWeight: draft.frequency === f.id ? 700 : 400 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: C.textTer, marginBottom: 8 }}>METRICS ({draft.metrics.length})</div>
          {draft.metrics.length === 0 && !adding && (
            <div style={{ fontSize: 12, color: C.textTer, padding: "8px 0" }}>No metrics yet — add one below.</div>
          )}
          {draft.metrics.map((m, i) => (
            <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, borderRadius: 8, padding: "10px 12px", marginBottom: 6, border: "1px solid " + C.border }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: C.textPri, fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: 10, color: C.textTer, marginTop: 2 }}>
                  {m.type === "scale" ? "Scale " + m.min + "-" + m.max : m.type === "hml" ? "Low / Med / High" : m.type === "number" ? "Number" : m.type === "select" || m.type === "multiselect" ? "Options: " + (m.options || []).join(", ") : m.type}
                </div>
              </div>
              <button onClick={() => removeMetric(i)}
                style={{ background: C.painBg, border: "1px solid " + C.pain + "44", color: C.pain, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>remove</button>
            </div>
          ))}

          {adding ? (
            <div style={{ background: C.surface, borderRadius: 10, padding: 12, border: "1px solid " + draft.color + "55", marginTop: 4 }}>
              <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>METRIC NAME</div>
              <input value={newLabel} onChange={e => dispatch({ type: "SET_NEW_LABEL", value: e.target.value })}
                placeholder="e.g. Intensity, Amount, Quality"
                style={{ width: "100%", background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.textPri, fontSize: 13, padding: "9px 10px", marginBottom: 10, boxSizing: "border-box" }} />
              <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>INPUT TYPE</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
                {METRIC_TYPES.map(mt => (
                  <button key={mt.id} onClick={() => dispatch({ type: "SET_NEW_TYPE", value: mt.id })}
                    style={{ padding: "6px 10px", borderRadius: 7, border: "1.5px solid " + (newType === mt.id ? draft.color : C.border), background: newType === mt.id ? draft.color + "33" : C.card, color: newType === mt.id ? draft.color : C.textSec, fontSize: 11, cursor: "pointer", fontWeight: newType === mt.id ? 700 : 400 }}>
                    {mt.label}
                  </button>
                ))}
              </div>
              {(newType === "select" || newType === "multiselect") && (
                <div>
                  <div style={{ fontSize: 11, color: C.textTer, marginBottom: 6 }}>OPTIONS (comma separated)</div>
                  <input value={newOptions} onChange={e => dispatch({ type: "SET_NEW_OPTS", value: e.target.value })}
                    placeholder="e.g. Light, Medium, Strong"
                    style={{ width: "100%", background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.textPri, fontSize: 12, padding: "8px 10px", marginBottom: 10, boxSizing: "border-box" }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => dispatch({ type: "ADD_METRIC" })} disabled={!canAdd}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: canAdd ? draft.color : C.muted, border: "none", color: "#fff", fontSize: 13, cursor: canAdd ? "pointer" : "default", fontWeight: 700 }}>
                  + Add metric
                </button>
                <button onClick={() => dispatch({ type: "SET_ADDING", value: false })}
                  style={{ padding: "10px 14px", borderRadius: 8, background: C.card, border: "1px solid " + C.border, color: C.textSec, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => dispatch({ type: "SET_ADDING", value: true })}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px dashed " + draft.color + "77", background: "transparent", color: draft.color, fontSize: 12, cursor: "pointer", marginTop: 2 }}>
              + Add metric
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (canSave) onSave(draft); }}
            style={{ flex: 1, padding: 13, borderRadius: 12, background: canSave ? draft.color : C.muted, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
            Save tracker
          </button>
          {!isNew && (
            <button onClick={() => onToggleActive(draft.id)}
              style={{ padding: "13px 16px", borderRadius: 12, background: C.card, border: "1px solid " + C.border, color: C.textSec, fontSize: 13, cursor: "pointer" }}>
              {initial.active === false ? "Enable" : "Disable"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


// ── SETTINGS PAGE ─────────────────────────────────────────────────────────────
const NEW_TRACKER_TEMPLATE = () => ({
  id: "custom_" + Date.now(),
  label: "", icon: "✨", color: COLORS[6], bg: C.customBg,
  frequency: "eod", metrics: [], active: true,
});

const SettingsPage = ({ trackers, setTrackers, onExport, onClear, reminders, setReminders, darkMode, setDarkMode }) => {
  const [tab, setTab]             = useState("trackers");
  const [editingTracker, setEditingTracker] = useState(null);  // null | tracker object (for new: has isNew:true flag)

  const startNew = () => setEditingTracker({ ...NEW_TRACKER_TEMPLATE(), isNew: true });
  const startEdit = (t) => setEditingTracker(t);

  const handleSave = (saved) => {
    if (saved.isNew) {
      const { isNew: _, ...clean } = saved;
      setTrackers(ts => [...ts, clean]);
    } else {
      setTrackers(ts => ts.map(t => t.id === saved.id ? saved : t));
    }
    setEditingTracker(null);
  };

  const handleToggleActive = (id) => {
    setTrackers(ts => ts.map(t => t.id === id ? { ...t, active: t.active === false ? true : false } : t));
    setEditingTracker(null);
  };

  if (editingTracker) return (
    <TrackerEditor
      initial={editingTracker}
      isNew={!!editingTracker.isNew}
      onSave={handleSave}
      onBack={() => setEditingTracker(null)}
      onToggleActive={handleToggleActive}
    />
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>
      <div style={{ padding: "14px 16px 12px", background: C.surface, borderBottom: "1px solid " + C.border }}>
        <div style={{ fontSize: 10, color: C.textTer, marginBottom: 3, fontFamily: "DM Mono, monospace", letterSpacing: "0.1em" }}>CHRONICALLY CURIOUS</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.textPri, marginBottom: 10 }}>Settings</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["trackers","reminders","data"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "1px solid " + (tab === t ? C.screen : C.border), background: tab === t ? C.screenBg : C.card, color: tab === t ? C.screen : C.textSec, fontSize: 11, cursor: "pointer", fontWeight: tab === t ? 700 : 400, textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "14px 14px" }}>
        {tab === "display" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "14px 16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.textPri }}>
                    {darkMode ? "🌙 Dark mode" : "☀️ Light mode"}
                  </div>
                  <div style={{ fontSize: 11, color: C.textTer, marginTop: 3 }}>
                    {darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  </div>
                </div>
                <Toggle on={darkMode} onToggle={() => setDarkMode(d => !d)} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textTer }}>
              Your preference is saved and will be remembered next time you open the app.
            </div>
          </div>
        )}
        {tab === "trackers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trackers.map(t => (
              <div key={t.id} onClick={() => startEdit(t)}
                style={{ background: C.card, borderRadius: 12, padding: "11px 14px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", opacity: t.active === false ? 0.4 : 1 }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: C.textTer }}>{(t.metrics || []).length} metrics · {t.frequency}{t.active === false ? " · disabled" : ""}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color }} />
                <span style={{ fontSize: 16, color: C.textTer }}>›</span>
              </div>
            ))}
            <button onClick={startNew}
              style={{ padding: 12, borderRadius: 12, border: `1px dashed ${C.border}`, background: "transparent", color: C.screen, fontSize: 13, cursor: "pointer" }}>
              + Add new tracker
            </button>
          </div>
        )}
        {tab === "reminders" && (
          <RemindersTab reminders={reminders} setReminders={setReminders} />
        )}
        {tab === "data" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.textPri }}>{darkMode ? "🌙 Dark mode" : "☀️ Light mode"}</div>
                  <div style={{ fontSize: 10, color: C.textTer, marginTop: 2 }}>Tap to switch</div>
                </div>
                <Toggle on={darkMode} onToggle={() => setDarkMode(d => !d)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: C.textPri }}>Export data</div><div style={{ fontSize: 10, color: C.textTer }}>Download entries as JSON</div></div>
                <button onClick={onExport} style={{ background: C.screenBg, border: `1px solid ${C.screen}44`, color: C.screen, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Export</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", padding: "12px 14px" }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: C.textPri }}>Storage</div><div style={{ fontSize: 10, color: C.textTer }}>Stored locally on this device</div></div>
                <span style={{ fontSize: 12, color: C.textSec }}>{Math.round(JSON.stringify(load()).length / 1024 * 10) / 10} KB</span>
              </div>
            </div>
            <div style={{ background: C.painBg, borderRadius: 12, border: `1px solid ${C.pain}44` }}>
              <button onClick={onClear} style={{ width: "100%", padding: "13px 14px", background: "transparent", border: "none", color: C.pain, fontSize: 13, cursor: "pointer", textAlign: "left", fontWeight: 600 }}>
                🗑 Delete all data…
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── PAIN BODY AREAS for onboarding ───────────────────────────────────────────
const BODY_AREAS = [
  { id: "back",   label: "Back",               icon: "🫀", desc: "Spine, shoulders, neck, hips" },
  { id: "head",   label: "Head",               icon: "🧠", desc: "Headaches, migraines, jaw" },
  { id: "arms",   label: "Arms",               icon: "💪", desc: "Shoulders, elbows, wrists, hands" },
  { id: "legs",   label: "Legs",               icon: "🦵", desc: "Hips, knees, ankles, feet" },
  { id: "torso",  label: "Torso",              icon: "🫁", desc: "Chest, abdomen, ribs, sides" },
  { id: "pelvic", label: "Pelvic & abdominal", icon: "🩺", desc: "Digestive, reproductive, urinary, kidney" },
];

const PAIN_AREA_LABELS = {
  back:   "Back pain",
  head:   "Head pain",
  arms:   "Arm pain",
  legs:   "Leg pain",
  torso:  "Torso pain",
  pelvic: "Pelvic & abdominal pain",
};

// ── ONBOARDING SCREEN ────────────────────────────────────────────────────────
const OnboardingScreen = ({ onComplete }) => {
  const [step, setStep]         = useState(0); // 0=welcome, 1=name, 2=area
  const [name, setName]         = useState("");
  const [selectedArea, setArea] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, maxWidth: 480, margin: "0 auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap" rel="stylesheet" />

      {step === 0 && (
        <div style={{ textAlign: "center", animation: "fadeIn 0.4s ease" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🫀</div>
          <div style={{ fontSize: 10, color: C.textTer, letterSpacing: "0.15em", fontFamily: "DM Mono, monospace", marginBottom: 12 }}>CHRONICALLY CURIOUS</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.textPri, lineHeight: 1.2, marginBottom: 14 }}>
            Your body is telling<br />you something.
          </div>
          <div style={{ fontSize: 15, color: C.textSec, lineHeight: 1.6, marginBottom: 36 }}>
            This app helps you listen — tracking the patterns between your pain, sleep, and daily habits so you can understand yourself better.
          </div>
          <button onClick={() => setStep(1)}
            style={{ width: "100%", padding: 16, borderRadius: 14, background: C.pain, border: "none", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Let's get started
          </button>
        </div>
      )}

      {step === 1 && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.textPri, marginBottom: 8 }}>What should we call you?</div>
          <div style={{ fontSize: 14, color: C.textSec, marginBottom: 28, lineHeight: 1.5 }}>
            We'll use this to make the app feel a little more personal.
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            style={{ width: "100%", background: C.card, border: "1.5px solid " + C.border, borderRadius: 12, color: C.textPri, fontSize: 18, padding: "14px 16px", marginBottom: 16, boxSizing: "border-box", fontFamily: "DM Sans, sans-serif" }}
          />
          <button onClick={() => { if (name.trim()) setStep(2); }}
            style={{ width: "100%", padding: 16, borderRadius: 14, background: name.trim() ? C.pain : C.muted, border: "none", color: "#fff", fontSize: 16, fontWeight: 700, cursor: name.trim() ? "pointer" : "default" }}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.textPri, marginBottom: 8 }}>
            Hi {name.trim()} 👋
          </div>
          <div style={{ fontSize: 14, color: C.textSec, marginBottom: 24, lineHeight: 1.6 }}>
            Where would you like to track pain? You can always add more areas later from Settings.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {BODY_AREAS.map(area => (
              <button key={area.id} onClick={() => setArea(area.id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, border: "1.5px solid " + (selectedArea === area.id ? C.pain : C.border), background: selectedArea === area.id ? C.painBg : C.card, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: 26 }}>{area.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: selectedArea === area.id ? C.pain : C.textPri }}>{area.label}</div>
                  <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>{area.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => { if (selectedArea) onComplete(name.trim(), selectedArea); }}
            style={{ width: "100%", padding: 16, borderRadius: 14, background: selectedArea ? C.pain : C.muted, border: "none", color: "#fff", fontSize: 16, fontWeight: 700, cursor: selectedArea ? "pointer" : "default" }}>
            Start tracking
          </button>
        </div>
      )}
    </div>
  );
};

// ── GREETING HELPERS ─────────────────────────────────────────────────────────
const getGreeting = (name, data, trackers) => {
  const hour = new Date().getHours();
  const timeGreet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yd = yesterday.toISOString().slice(0, 10);
  const ydData = data[yd];

  // Check yesterday's sleep
  const sleep = ydData && ydData.sleep && ydData.sleep.main;
  const sleepDuration = sleep && sleep.metrics && sleep.metrics.duration;
  const wakeups = sleep && sleep.metrics && sleep.metrics.stay_asleep;

  // Check yesterday's pain
  const painEntry = ydData && ydData.back_pain;
  const painSlots = painEntry ? ["Morning","Afternoon","Evening"].flatMap(s => (painEntry[s] && painEntry[s].painEntries) || []) : [];
  const hadPain = painSlots.length > 0;
  const worstPain = hadPain ? painSlots.reduce((a, b) => {
    const ai = PAIN_LEVELS.findIndex(p => p.id === a.level);
    const bi = PAIN_LEVELS.findIndex(p => p.id === b.level);
    return bi > ai ? b : a;
  }) : null;

  // Compose message
  let msg = timeGreet + (name ? ", " + name : "") + ".";

  if (sleepDuration && parseFloat(sleepDuration) >= 7.5) {
    msg += " Hope you're feeling well-rested this morning 🌿";
  } else if (sleepDuration && parseFloat(sleepDuration) < 6) {
    msg += " You logged a shorter night — be gentle with yourself today.";
  } else if (wakeups && ["Three times","Four times","Five times","Six+ times"].includes(wakeups)) {
    msg += " Looks like it was a broken night. Take it easy.";
  } else if (worstPain && (worstPain.level === "severe" || worstPain.level === "moderate")) {
    msg += " Yesterday was a tough one. Hope today's kinder to you.";
  } else if (!ydData) {
    msg += " Ready to start tracking your day?";
  } else {
    const encouragements = [
      " Every entry helps you understand yourself better.",
      " You're building something valuable — keep going.",
      " Small data, big insights over time. 📈",
      " Showing up for yourself today — that counts.",
    ];
    msg += encouragements[new Date().getDate() % encouragements.length];
  }
  return msg;
};

// ── WEEKLY REFLECTION ─────────────────────────────────────────────────────────
const WeeklyReflection = ({ data }) => {
  const [dismissed, setDismissed] = useState(false);

  // Only show on Sundays (day 0) or if less than 7 days of data
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek !== 0 || dismissed) return null;

  // Build last 7 days of stats
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  const exerciseDays = last7.filter(d => data[d] && data[d].exercise && data[d].exercise.sessions && data[d].exercise.sessions.length > 0).length;

  const painScores = last7.flatMap(d => {
    const entry = data[d] && data[d].back_pain;
    if (!entry) return [];
    return ["Morning","Afternoon","Evening"].flatMap(s => ((entry[s] && entry[s].painEntries) || []).map(pe => PAIN_LEVELS.findIndex(p => p.id === pe.level)));
  });
  const avgPain = painScores.length ? (painScores.reduce((a,b) => a+b,0) / painScores.length).toFixed(1) : null;

  const prevWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const prevPainScores = prevWeek.flatMap(d => {
    const entry = data[d] && data[d].back_pain;
    if (!entry) return [];
    return ["Morning","Afternoon","Evening"].flatMap(s => ((entry[s] && entry[s].painEntries) || []).map(pe => PAIN_LEVELS.findIndex(p => p.id === pe.level)));
  });
  const prevAvgPain = prevPainScores.length ? prevPainScores.reduce((a,b) => a+b,0) / prevPainScores.length : null;

  const loggingDays = last7.filter(d => data[d] && Object.keys(data[d]).length > 0).length;
  if (loggingDays < 3) return null; // not enough data for a meaningful reflection

  const painTrend = avgPain && prevAvgPain ? parseFloat(avgPain) - prevAvgPain : null;

  return (
    <div style={{ background: C.sleepBg, border: "1px solid " + C.sleep + "44", borderRadius: 14, padding: "14px 16px", margin: "0 0 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.sleep }}>✨ Your week in review</div>
        <button onClick={() => setDismissed(true)} style={{ background: "transparent", border: "none", color: C.textTer, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {avgPain !== null && (
          <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>
            {painTrend !== null
              ? painTrend < -0.3
                ? "📉 Your average pain was lower than last week. Something's working — worth thinking about what changed."
                : painTrend > 0.3
                ? "📈 Pain was a little higher this week than last. Nothing to worry about, but maybe worth reflecting on."
                : "〰 Your pain levels were pretty consistent week on week."
              : "Average pain score this week: " + avgPain + " / 3."
            }
          </div>
        )}
        {exerciseDays > 0 && (
          <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>
            🏃 You moved your body {exerciseDays} day{exerciseDays !== 1 ? "s" : ""} this week. {exerciseDays >= 4 ? "That's a solid week." : exerciseDays >= 2 ? "Every bit counts." : "A little goes a long way — even a walk."}
          </div>
        )}
        <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>
          📋 You logged {loggingDays} out of 7 days. {loggingDays === 7 ? "Perfect week — your data is really building up. 🌱" : loggingDays >= 5 ? "Great consistency." : "Even partial data helps — keep going."}
        </div>
      </div>
    </div>
  );
};

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const stored  = load();
  const [data,      setData]      = useState(stored.entries   || {});
  const [trackers,  setTrackers]  = useState(() => {
    if (!stored.trackers) return DEFAULT_TRACKERS;
    const storedById = Object.fromEntries(stored.trackers.map(t => [t.id, t]));
    const merged = DEFAULT_TRACKERS.map(def => {
      const s = storedById[def.id];
      if (!s) return def;
      return { ...def, label: s.label, icon: s.icon, color: s.color, bg: s.bg || def.bg, active: s.active, frequency: s.frequency, times: s.times || def.times };
    });
    const customTrackers = stored.trackers.filter(t => !DEFAULT_TRACKERS.find(d => d.id === t.id));
    return [...merged, ...customTrackers];
  });
  const [reminders, setReminders] = useState(stored.reminders || {});
  const [darkMode,  setDarkMode]  = useState(stored.darkMode !== false);
  const [userName,  setUserName]  = useState(stored.userName  || "");
  const [painArea,  setPainArea]  = useState(stored.painArea  || "");
  const [onboarded, setOnboarded] = useState(!!stored.onboarded);
  const [tab,       setTab]       = useState("today");
  const [dateView,  setDateView]  = useState(today());
  const [modal,     setModal]     = useState(null);
  const [clearConf, setClearConf] = useState(false);

  C = makeTheme(darkMode);

  useEffect(() => {
    save({ entries: data, trackers, reminders, darkMode, userName, painArea, onboarded });
  }, [data, trackers, reminders, darkMode, userName, painArea, onboarded]);

  const handleOnboardingComplete = useCallback((name, area) => {
    setUserName(name);
    setPainArea(area);
    setOnboarded(true);
    // Update the pain tracker label and painArea
    setTrackers(ts => ts.map(t =>
      t.type === "pain_special"
        ? { ...t, label: PAIN_AREA_LABELS[area] || "Pain", painArea: area }
        : t
    ));
  }, []);

  const handleLog = useCallback((tracker, slot, existing, forceType) => {
    if (tracker.type === "pain_special" || forceType === "pain_summary") {
      if (forceType === "pain_summary") { setModal({ type: "pain_summary", tracker }); return; }
      setModal({ type: "pain", tracker, slot: slot || "Morning", existing, painArea: tracker.painArea || "back" });
    } else if (tracker.id === "exercise" || forceType === "exercise") {
      setModal({ type: "exercise", tracker, existing });
    } else {
      setModal({ type: "generic", tracker, slot, existing });
    }
  }, []);

  const handleSavePain = useCallback((saved) => {
    const slot = modal.slot;
    setData(prev => ({
      ...prev,
      [dateView]: {
        ...(prev[dateView] || {}),
        [modal.tracker.id]: {
          ...((prev[dateView] || {})[modal.tracker.id] || {}),
          [slot]: { ...saved, ts: Date.now() },
        },
      },
    }));
    setModal(null);
  }, [modal, dateView]);

  const handleSaveGeneric = useCallback(({ metrics, note }) => {
    setData(prev => ({
      ...prev,
      [dateView]: {
        ...(prev[dateView] || {}),
        [modal.tracker.id]: {
          ...((prev[dateView] || {})[modal.tracker.id] || {}),
          main: { metrics, note, ts: Date.now() },
        },
      },
    }));
    setModal(null);
  }, [modal, dateView]);

  const handleSaveExercise = useCallback(({ sessions }) => {
    setData(prev => ({
      ...prev,
      [dateView]: {
        ...(prev[dateView] || {}),
        exercise: { sessions, ts: Date.now() },
      },
    }));
    setModal(null);
  }, [modal, dateView]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ entries: data, trackers }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "chronically_curious.json"; a.click();
  };

  const handleClear = () => {
    if (clearConf) { setData({}); setClearConf(false); }
    else setClearConf(true);
  };

  const TABS = [
    { id: "today",    label: "Today",   icon: "📋" },
    { id: "trends",   label: "Trends",  icon: "📈" },
    { id: "history",  label: "History", icon: "🗂" },
    { id: "settings", label: "Settings",icon: "⚙️" },
  ];

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", transition: "background 0.3s" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono&display=swap" rel="stylesheet" />

      {!onboarded ? (
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      ) : (
        <>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", overflowX: "hidden" }}>
          {tab === "today"    && <TodayPage    data={data} trackers={trackers} onLog={handleLog} date={dateView} setDate={setDateView} userName={userName} />}
          {tab === "trends"   && <TrendsPage   data={data} trackers={trackers} />}
          {tab === "history"  && <HistoryPage  data={data} trackers={trackers} />}
          {tab === "settings" && <SettingsPage trackers={trackers} setTrackers={setTrackers} onExport={handleExport} onClear={handleClear} reminders={reminders} setReminders={setReminders} darkMode={darkMode} setDarkMode={setDarkMode} />}
        </div>

        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: "1px solid " + C.border, display: "flex", zIndex: 50 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: "10px 0 14px", background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 10, color: tab === t.id ? C.screen : C.textTer, fontWeight: tab === t.id ? 700 : 400 }}>{t.label}</span>
              {tab === t.id && <div style={{ width: 20, height: 2, borderRadius: 1, background: C.screen }} />}
            </button>
          ))}
        </div>

        {modal && modal.type === "exercise" && (
          <ExerciseModal existing={modal.existing} onSave={handleSaveExercise} onClose={() => setModal(null)} />
        )}
        {modal && modal.type === "pain" && (
          <PainModal slot={modal.slot} existing={modal.existing} painArea={modal.painArea} onSave={handleSavePain} onClose={() => setModal(null)} />
        )}
        {modal && modal.type === "pain_summary" && (
          <PainSummaryModal tracker={modal.tracker} dayData={data[dateView] || {}}
            onLogSlot={(slot, existing) => setModal({ type: "pain", tracker: modal.tracker, slot, existing, painArea: modal.tracker.painArea || "back" })}
            onClose={() => setModal(null)} />
        )}
        {modal && modal.type === "generic" && (
          <LogModal tracker={modal.tracker} slot={modal.slot} existing={modal.existing} onSave={handleSaveGeneric} onClose={() => setModal(null)} />
        )}

        {clearConf && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: C.card, borderRadius: 16, padding: 24, maxWidth: 320, width: "100%" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.textPri, marginBottom: 8 }}>Delete all data?</div>
              <div style={{ fontSize: 13, color: C.textSec, marginBottom: 20 }}>This permanently erases all logged entries. Cannot be undone.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleClear} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.danger, border: "none", color: "#fff", fontSize: 14, cursor: "pointer", fontWeight: 700 }}>Delete everything</button>
                <button onClick={() => setClearConf(false)} style={{ flex: 1, padding: 12, borderRadius: 10, background: C.card, border: "1px solid " + C.border, color: C.textSec, fontSize: 14, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
    </div>
    </ThemeContext.Provider>
  );
}
