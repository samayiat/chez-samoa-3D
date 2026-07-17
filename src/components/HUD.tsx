// ============================================================================
// HUD: DOM overlay that polls the sim at 10Hz — clock, money, Beli, the
// ticket rail (every open order, most urgent first), combo, brawl bars,
// night sales, carry chip, and the context prompt.
// ============================================================================
import { useEffect, useReducer } from "react";
import { sim } from "../game/sim";
import { DISHES, SPEED_TIP_WINDOW, DAY_LEN, CHEF_HP, BRAWL_TIME, NIGHT_TIME, WAVE_COUNT, DISHES as D } from "../game/constants";
import { DISH_EMOJI } from "./models";
import { isMuted, setMuted } from "../game/audio";

function usePoll(ms = 100) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const i = setInterval(force, ms);
    return () => clearInterval(i);
  }, [ms]);
}

const chip: React.CSSProperties = {
  background: "rgba(20,14,26,.72)", border: "1px solid rgba(255,220,160,.25)",
  borderRadius: 10, padding: "6px 12px", color: "#f2e8d8",
  fontFamily: "system-ui", backdropFilter: "blur(4px)",
};

function TicketRail() {
  const tickets = sim.customers
    .filter((c) => (c.state === "waiting" || c.state === "badorder"))
    .sort((a, b) => b.orderT - a.orderT);
  if (!tickets.length) return null;
  // plated-on-pass dishes get a green tick (one-for-one cover)
  const passItems = [...sim.passSlots.map((s) => s.item), sim.chef.carry].filter(Boolean) as { id: string }[];
  const covered = new Set<string>();
  return (
    <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, marginTop: 44 }}>
      {tickets.map((c) => {
        const life = c.state === "badorder" ? Math.max(0, 1 - c.t / 13) : c.patience;
        const tipHeat = c.state === "waiting" ? Math.max(0, 1 - c.orderT / SPEED_TIP_WINDOW) : 0;
        const emoji = c.state === "badorder" ? "❓" : DISH_EMOJI[c.order!];
        const ready = c.state === "waiting" && passItems.some((it) => it.id === c.order && !covered.has(c.order!) && (covered.add(c.order!), true));
        return (
          <div key={c.id} style={{
            ...chip, padding: "5px 9px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            border: ready ? "1px solid #6ae08a" : "1px solid rgba(255,220,160,.25)",
            boxShadow: ready ? "0 0 10px rgba(106,224,138,.4)" : undefined,
          }}>
            <div style={{ fontSize: 18, lineHeight: 1 }}>{emoji}{ready && <span style={{ fontSize: 11 }}> ✅</span>}</div>
            <div style={{ width: 46, height: 4, background: "rgba(255,255,255,.15)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                width: `${life * 100}%`, height: "100%",
                background: c.state === "badorder" ? "#e07ab8" : life > 0.4 ? `hsl(${40 + tipHeat * 20},80%,60%)` : "#e86a5a",
                transition: "width 100ms linear",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HUD() {
  usePoll(100);
  const ph = sim.phase;
  if (ph === "title" || ph === "results") return null;
  const prompt = sim.getPrompt();
  const muted = isMuted();

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 20, fontFamily: "system-ui" }}>
      {/* top-left: mute + phase */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => { setMuted(!muted); }}
          style={{ ...chip, pointerEvents: "auto", cursor: "pointer", fontSize: 16, border: "1px solid rgba(255,220,160,.25)" }}
        >{muted ? "🔇" : "🔊"}</button>
        <div style={{ ...chip, fontSize: 12, letterSpacing: 2, color: ph === "night" ? "#ff9de2" : "#ffd8a8" }}>
          {ph === "day" ? "🍽 DAY SHIFT" : ph === "brawl" ? "🥊 CLOSING-TIME BRAWL" : "🌙 AFTER HOURS"}
        </div>
      </div>

      {/* top-right: money + beli */}
      <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8 }}>
        {ph === "night"
          ? <div style={{ ...chip, fontSize: 18, fontWeight: 800, color: "#ff9de2" }}>🍾 ${sim.night?.sales ?? 0}</div>
          : <div style={{ ...chip, fontSize: 18, fontWeight: 800, color: "#ffd86b" }}>${sim.money}</div>}
        <div style={{ ...chip, fontSize: 14 }} title="Beli — your house rating">
          ⭐ {sim.beli.toFixed(1)}
        </div>
      </div>

      {/* day clock */}
      {ph === "day" && (
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 220 }}>
          <div style={{ ...chip, padding: "6px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#c9b99a", marginBottom: 3 }}>
              <span>{sim.lastCall ? "LAST CALL — serve the room" : "open"}</span>
              <span>{Math.max(0, Math.ceil(sim.dayT))}s</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,.12)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, sim.dayT / DAY_LEN) * 100}%`, height: "100%", background: "#ffd86b", transition: "width 120ms linear" }} />
            </div>
          </div>
        </div>
      )}
      <TicketRail />

      {/* combo */}
      {sim.combo > 1 && (
        <div style={{
          position: "absolute", top: 118, left: "50%", transform: "translateX(-50%)",
          fontSize: 20, fontWeight: 900, letterSpacing: 2,
          color: sim.comboT < 0.7 ? "#e86a5a" : "#ffd86b", textShadow: "0 2px 8px rgba(0,0,0,.6)",
        }}>CHAIN ×{sim.combo}</div>
      )}

      {/* brawl bars */}
      {ph === "brawl" && sim.brawl && (
        <>
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 260 }}>
            <div style={{ ...chip, padding: "6px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 13, letterSpacing: 2, color: "#ff9a8a", marginBottom: 3 }}>
                WAVE {Math.min(sim.brawl.wave + 1, WAVE_COUNT)}/{WAVE_COUNT} · {Math.max(0, Math.ceil(sim.brawl.t))}s
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,.12)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(sim.brawl.t / BRAWL_TIME) * 100}%`, height: "100%", background: "#e84a3a", transition: "width 120ms linear" }} />
              </div>
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 16, left: 16, ...chip }}>
            <div style={{ fontSize: 16 }}>{"❤️".repeat(Math.max(0, Math.ceil((sim.chef.hp / CHEF_HP) * 5)))}{"🖤".repeat(Math.max(0, 5 - Math.ceil((sim.chef.hp / CHEF_HP) * 5)))}</div>
            <div style={{ fontSize: 11, color: "#e0a83c", marginTop: 2 }}>
              🥃 {sim.chef.drinks}{sim.chef.buffT > 0 ? " · BUFFED" : ""}{sim.chef.wastedT > 0 ? " · WASTED 🥴" : ""}
              {sim.barBroken ? " · BAR WRECKED" : ""}
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 16, right: 16, ...chip, fontSize: 13, color: "#e9d8b8" }}>
            <b>J</b> / <b>click</b> — punch · <b>E</b> — chug at the bar
          </div>
        </>
      )}

      {/* night clock */}
      {ph === "night" && sim.night && (
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: 220 }}>
          <div style={{ ...chip, padding: "6px 10px", border: "1px solid rgba(224,122,184,.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#d8a8d0", marginBottom: 3 }}>
              <span>after hours</span><span>{Math.max(0, Math.ceil(sim.night.t))}s</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,.12)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, sim.night.t / NIGHT_TIME) * 100}%`, height: "100%", background: "#e07ab8", transition: "width 120ms linear" }} />
            </div>
          </div>
        </div>
      )}

      {/* carry chip */}
      {sim.chef.carry && ph !== "brawl" && (
        <div style={{ position: "absolute", bottom: 16, left: 16, ...chip, fontSize: 15 }}>
          carrying: {sim.chef.carry.kind === "bottle" ? "🍾 bottle"
            : sim.chef.carry.kind === "ing" ? (sim.chef.carry.id === "chicken" ? "🍗 raw chicken" : "🦞 raw lobster")
            : `${DISH_EMOJI[sim.chef.carry.id]} ${D[sim.chef.carry.id]?.label}${sim.chef.carry.quality === "burnt" ? " (burnt)" : ""}`}
        </div>
      )}

      {/* context prompt */}
      {prompt && !sim.paused && (
        <div style={{
          position: "absolute", bottom: 64, left: "50%", transform: "translateX(-50%)",
          ...chip, fontSize: 15, padding: "8px 16px",
        }}>
          <span style={{ background: "#ffd86b", color: "#3a2a10", fontWeight: 900, borderRadius: 5, padding: "1px 8px", marginRight: 8, fontFamily: "monospace" }}>E</span>
          {prompt.label}
        </div>
      )}

      {/* controls hint (day) */}
      {ph === "day" && (
        <div style={{ position: "absolute", bottom: 16, right: 16, ...chip, fontSize: 12, color: "#b8a888" }}>
          <b>WASD</b> move · <b>E</b> interact · <b>Esc</b> pause
        </div>
      )}

      {/* paused */}
      {sim.paused && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,6,14,.7)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto" }}>
          <div style={{ ...chip, padding: 28, textAlign: "center", minWidth: 260 }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 4, color: "#ffd86b", marginBottom: 16 }}>PAUSED</div>
            <button onClick={() => (sim.paused = false)} style={btnStyle}>RESUME</button>
            <button onClick={() => { sim.paused = false; sim.toTitle(); }} style={{ ...btnStyle, background: "#4a3a52", marginTop: 8 }}>QUIT TO TITLE</button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "10px 0", fontSize: 15, fontWeight: 800,
  letterSpacing: 2, background: "#c8543e", color: "#fff", border: "none", borderRadius: 8,
  cursor: "pointer", fontFamily: "system-ui",
};

export { DISHES };
