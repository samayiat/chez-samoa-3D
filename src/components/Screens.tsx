// ============================================================================
// Screens: title + end-of-run results. (In-world flashes handle phase intros.)
// ============================================================================
import { useEffect, useReducer } from "react";
import { sim } from "../game/sim";

function usePoll(ms = 150) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const i = setInterval(force, ms);
    return () => clearInterval(i);
  }, [ms]);
}

const overlay: React.CSSProperties = {
  position: "absolute", inset: 0, zIndex: 30, display: "flex",
  alignItems: "center", justifyContent: "center", fontFamily: "system-ui",
};

function TitleScreen() {
  return (
    <div style={{ ...overlay, background: "radial-gradient(ellipse at center, rgba(24,14,30,.25) 0%, rgba(12,8,18,.88) 100%)" }}>
      <div style={{ textAlign: "center", color: "#f2e8d8" }}>
        <div style={{ fontSize: 15, letterSpacing: 6, color: "#c9a878", marginBottom: 4 }}>a culinary dash story — in 3D</div>
        <div style={{
          fontSize: 72, fontWeight: 900, letterSpacing: 6, lineHeight: 1,
          background: "linear-gradient(180deg,#ffe9b8,#e0a83c)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          textShadow: "0 4px 24px rgba(224,168,60,.25)",
        }}>CHEZ SAMOA</div>
        <div style={{ fontSize: 14, color: "#b8a888", marginTop: 8, marginBottom: 26 }}>
          seat · order · cook · serve — and be ready when the day goes sideways 🥊
        </div>
        <button
          onClick={() => sim.startRun()}
          style={{
            fontSize: 20, fontWeight: 900, letterSpacing: 3, padding: "14px 46px",
            background: "linear-gradient(180deg,#d8604a,#b03828)", color: "#fff",
            border: "none", borderRadius: 12, cursor: "pointer",
            boxShadow: "0 6px 24px rgba(200,84,62,.45)",
          }}
        >START SHIFT</button>
        <div style={{
          marginTop: 28, display: "inline-block", textAlign: "left",
          background: "rgba(20,14,26,.7)", border: "1px solid rgba(255,220,160,.2)",
          borderRadius: 12, padding: "14px 22px", fontSize: 13, color: "#c9b99a", lineHeight: 1.9,
        }}>
          <div>🧑‍🍳 <b style={{ color: "#f2e8d8" }}>WASD / arrows</b> — walk the floor</div>
          <div>⚡ <b style={{ color: "#f2e8d8" }}>E</b> — grab, cook, plate, serve, wave off, chug</div>
          <div>🥊 <b style={{ color: "#f2e8d8" }}>J / click</b> — punch (when the mob shows up)</div>
          <div>💰 serve fast for the <b style={{ color: "#ffd86b" }}>+50% speed tip</b> · chain serves for combo cash</div>
          <div>🌙 survive close, then run <b style={{ color: "#ff9de2" }}>bottle service</b> after hours</div>
        </div>
        <div style={{ marginTop: 18, fontSize: 11, color: "#7a6a58", letterSpacing: 1 }}>
          a fan-made 3D remake of the HTML game “Culinary Dash” · best on desktop
        </div>
      </div>
    </div>
  );
}

function ResultsScreen() {
  const r = sim.results;
  if (!r) return null;
  const rows: [string, string][] = [
    ["Guests served", `${r.served}`],
    ["Walkouts", `${r.lost}`],
    ["Waved off (not on the menu)", `${r.shooed}`],
    ["Day takings", `$${r.dayMoney}`],
    ["…of which tips", `$${r.tips}`],
    [
      "Closing-time brawl",
      r.brawl === "none" ? "— quiet night —"
        : r.brawl === "win" ? `WON 🏆  (Beli +${r.beliDelta.toFixed(1)})`
        : `LOST 💀  (Beli ${r.beliDelta.toFixed(1)})`,
    ],
    ["After-hours bottles", r.barDead ? "BAR WRECKED — dead night" : `${r.bottles} × 🍾`],
    ["Bottle service", `$${r.nightMoney}`],
  ];
  return (
    <div style={{ ...overlay, background: "rgba(10,7,16,.82)" }}>
      <div style={{
        background: "rgba(28,20,36,.95)", border: "1px solid rgba(255,220,160,.25)",
        borderRadius: 16, padding: "30px 38px", minWidth: 380, color: "#f2e8d8",
        boxShadow: "0 12px 60px rgba(0,0,0,.6)",
      }}>
        <div style={{ fontSize: 13, letterSpacing: 5, color: "#c9a878", textAlign: "center" }}>END OF NIGHT</div>
        <div style={{ fontSize: 34, fontWeight: 900, textAlign: "center", color: "#ffd86b", margin: "4px 0 18px" }}>
          ${r.total}
        </div>
        {rows.map(([k, v], i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", gap: 30, padding: "6px 0",
            borderBottom: "1px dashed rgba(255,220,160,.12)", fontSize: 14,
          }}>
            <span style={{ color: "#b8a888" }}>{k}</span>
            <span style={{ fontWeight: 700 }}>{v}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 4px", fontSize: 16 }}>
          <span style={{ color: "#b8a888" }}>House Beli</span>
          <span style={{ fontWeight: 900, color: "#ffd86b" }}>⭐ {r.beli.toFixed(1)} / 10</span>
        </div>
        <button
          onClick={() => sim.startRun()}
          style={{
            width: "100%", marginTop: 18, fontSize: 17, fontWeight: 900, letterSpacing: 2,
            padding: "12px 0", background: "linear-gradient(180deg,#d8604a,#b03828)",
            color: "#fff", border: "none", borderRadius: 10, cursor: "pointer",
          }}
        >NEXT NIGHT →</button>
        <button
          onClick={() => sim.toTitle()}
          style={{
            width: "100%", marginTop: 8, fontSize: 13, letterSpacing: 2, padding: "9px 0",
            background: "transparent", color: "#b8a888", border: "1px solid rgba(255,220,160,.25)",
            borderRadius: 10, cursor: "pointer",
          }}
        >TITLE</button>
      </div>
    </div>
  );
}

export function Screens() {
  usePoll(150);
  return (
    <>
      {sim.phase === "title" && <TitleScreen />}
      {sim.phase === "results" && <ResultsScreen />}
    </>
  );
}
