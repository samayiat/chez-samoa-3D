// ============================================================================
// Characters: the chef (WASD), day customers + order bubbles, brawl enemies,
// spectators, and after-hours bottle-service groups.
// ============================================================================
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { sim } from "../game/sim";
import { useSimVersion } from "./useSimVersion";
import type { Cust, Enemy, NightGroup } from "../game/sim";
import { Person, DishModel } from "./models";
import { DISHES, NOPE, SPEED_TIP_WINDOW, ENEMY_HP, CHEF_HP } from "../game/constants";

const CHEF_CAST = { id: "chef", name: "Chef", outfit: "#f2ede2", skin: "#c98a5a", hair: "#241a12", do: "slick" as const, acc: null, bad: "grits" as const };

// ------------------------------------------------------------------ chef
function Chef() {
  const g = useRef<THREE.Group>(null);
  const fist = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const ch = sim.chef;
    g.current!.position.set(ch.x, ch.moving ? Math.abs(Math.sin(ch.walkPh)) * 0.07 : 0, ch.z);
    g.current!.rotation.y = ch.dir;
    if (fist.current) {
      const p = ch.punchAnim > 0 ? ch.punchAnim / 0.22 : 0;
      fist.current.position.set(0.35, 1.25, 0.5 + p * 0.9);
      fist.current.visible = sim.phase === "brawl" && ch.punchAnim > 0;
    }
  });
  const ch = sim.chef;
  return (
    <group ref={g}>
      <Person cast={CHEF_CAST} chefWhites walkPh={ch.walkPh} moving={ch.moving} hurt={ch.hurtT > 0} />
      {/* carried item floats in front */}
      {ch.carry && (
        <group position={[0, 1.32, 0.62]}>
          <DishModel item={ch.carry} />
        </group>
      )}
      {/* punch fist */}
      <mesh ref={fist} visible={false}>
        <boxGeometry args={[0.22, 0.2, 0.3]} />
        <meshStandardMaterial color="#c98a5a" />
      </mesh>
      {/* drunk bubbles */}
      {ch.wastedT > 0 && (
        <Html position={[0, 2.6, 0]} center distanceFactor={12} zIndexRange={[5, 0]}>
          <div style={{ fontSize: 16 }}>🥴💫</div>
        </Html>
      )}
    </group>
  );
}

// ------------------------------------------------------------- order bubble
function OrderBubble({ c }: { c: Cust }) {
  if (c.state === "thinking") {
    return <div style={bubbleStyle}><span style={{ fontSize: 15, letterSpacing: 2 }}>💭</span></div>;
  }
  if (c.state === "waiting" && c.order) {
    const d = DISHES[c.order];
    const tipHeat = Math.max(0, 1 - c.orderT / SPEED_TIP_WINDOW);
    const hearts = Math.ceil(c.patience * 3);
    const tipCol = tipHeat > 0.5 ? "#ffd86b" : tipHeat > 0.2 ? "#c9b18a" : "#e86a5a";
    return (
      <div style={bubbleStyle}>
        <div style={{ fontSize: 20, lineHeight: 1 }}>{d.emoji}</div>
        <div style={{ fontSize: 10, color: "#5a4a3a", fontWeight: 700, whiteSpace: "nowrap" }}>{d.label}</div>
        <div style={{ width: 52, height: 4, background: "#e0d8c8", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${tipHeat * 100}%`, height: "100%", background: tipCol, transition: "width 100ms linear" }} />
        </div>
        <div style={{ fontSize: 9, letterSpacing: 1 }}>{"❤️".repeat(hearts)}{"🖤".repeat(3 - hearts)}</div>
      </div>
    );
  }
  if (c.state === "badorder" && c.badItem) {
    const left = Math.max(0, 1 - c.t / 13);
    return (
      <div style={{ ...bubbleStyle, background: "#fde8f4", border: "2px solid #e07ab8" }}>
        <div style={{ fontSize: 15 }}>❓</div>
        <div style={{ fontSize: 10, color: "#a04a80", fontWeight: 700, whiteSpace: "nowrap" }}>{NOPE[c.badItem]}??</div>
        <div style={{ width: 52, height: 4, background: "#f0d0e4", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${left * 100}%`, height: "100%", background: "#e07ab8", transition: "width 100ms linear" }} />
        </div>
        <div style={{ fontSize: 9, color: "#a04a80" }}>E: wave off</div>
      </div>
    );
  }
  if (c.state === "eating") {
    return <div style={bubbleStyle}><span style={{ fontSize: 16 }}>😋</span></div>;
  }
  return null;
}
const bubbleStyle: React.CSSProperties = {
  background: "#fffdf4", borderRadius: 10, padding: "5px 8px", display: "flex",
  flexDirection: "column", alignItems: "center", gap: 2,
  boxShadow: "0 2px 8px rgba(0,0,0,.35)", border: "2px solid #d8c8a8",
  fontFamily: "system-ui", transform: "translateY(-8px)",
};

function Customers() {
  return (
    <group>
      {sim.customers.map((c) => {
        const seated = ["thinking", "waiting", "badorder", "eating"].includes(c.state);
        const angry = c.angry;
        return (
          <group key={c.id} position={[c.x, seated ? 0.12 : 0, c.z]} rotation={[0, seated ? Math.PI : c.dir, 0]}>
            <Person cast={c.cast} walkPh={c.walkPh} moving={!seated && c.state !== "bench"} seated={seated || c.state === "bench"} tint={angry ? "#e86a5a" : null} />
            <Html position={[0, 2.35, 0]} center distanceFactor={11} zIndexRange={[6, 0]}>
              <OrderBubble c={c} />
            </Html>
            {angry && (
              <Html position={[0, 2.9, 0]} center distanceFactor={11} zIndexRange={[6, 0]}>
                <div style={{ fontSize: 18 }}>💢</div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------- enemies
function Enemies() {
  return (
    <group>
      {sim.enemies.map((e) => (
        <EnemyView key={e.id} e={e} />
      ))}
    </group>
  );
}
function EnemyView({ e }: { e: Enemy }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const gr = g.current!;
    gr.position.set(e.x, 0, e.z);
    if (e.state === "ko") {
      const k = Math.min(1, e.koT * 3.5);
      gr.rotation.x = -Math.PI / 2 * k;
      gr.position.y = 0.25 * k;
      gr.rotation.y = e.dir;
    } else {
      gr.rotation.x = 0;
      gr.rotation.y = e.dir;
      gr.position.y = e.state === "walk" ? Math.abs(Math.sin(e.walkPh)) * 0.06 : 0;
    }
  });
  const pips = Math.max(0, Math.ceil(e.hp));
  const maxPips = ENEMY_HP + (e.buffed ? 2 : 0);
  return (
    <group ref={g}>
      <Person
        cast={e.cast}
        walkPh={e.walkPh}
        moving={e.state === "walk" || e.state === "flee"}
        tint={e.buffed ? "#c03830" : e.kind === "thief" ? "#3a3440" : e.kind === "smasher" ? "#6a3a30" : null}
        hurt={e.state === "hurt"}
      />
      {e.kind === "smasher" && <mesh position={[0, 1.72, 0.2]}><boxGeometry args={[0.5, 0.08, 0.06]} /><meshStandardMaterial color="#c03830" /></mesh>}
      {e.kind === "thief" && <mesh position={[0, 1.62, 0.24]}><boxGeometry args={[0.42, 0.1, 0.06]} /><meshStandardMaterial color="#181818" /></mesh>}
      {e.steal && <group position={[0, 1.35, 0.5]}><DishModel item={e.steal} /></group>}
      {e.state !== "ko" && (
        <Html position={[0, 2.4, 0]} center distanceFactor={11} zIndexRange={[6, 0]}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            {e.state === "windup" && <div style={{ fontSize: 16, fontWeight: 900, color: "#ff5040", textShadow: "0 0 6px #000" }}>!</div>}
            <div style={{ fontSize: 8, letterSpacing: 1, whiteSpace: "nowrap" }}>
              {"🟠".repeat(pips)}{"⚫".repeat(Math.max(0, maxPips - pips))}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ------------------------------------------------------------- spectators
function Spectators() {
  const flashAcc = useRef(0);
  useFrame((_, dt) => {
    flashAcc.current += dt;
    if (flashAcc.current > 0.5 && sim.phase === "brawl" && sim.spectators.length) {
      flashAcc.current = 0;
      const s = sim.spectators[Math.floor(Math.random() * sim.spectators.length)];
      sim.burst(s.x, 1.9, s.z - 0.5, ["#ffffff"], 1, 0.2, 0.5, 0.15, 0, 1.6);
    }
  });
  if (sim.phase !== "brawl") return null;
  return (
    <group>
      {sim.spectators.map((s, i) => (
        <group key={i} position={[s.x, 0.12, s.z]} rotation={[0, Math.PI, 0]}>
          <Person cast={s.cast} seated />
          {/* phone in the air, recording */}
          <mesh position={[0.35, 1.9, 0.2]} rotation={[0.2, 0, -0.3]}>
            <boxGeometry args={[0.12, 0.22, 0.03]} />
            <meshStandardMaterial color="#222" emissive="#aaccff" emissiveIntensity={0.8} />
          </mesh>
          <Html position={[0, 2.5, 0]} center distanceFactor={11} zIndexRange={[6, 0]}>
            <div style={{ fontSize: 14 }}>{s.cast.id === "critic" ? "📝" : "📱"}</div>
          </Html>
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------- night groups
function Groups() {
  if (sim.phase !== "night") return null;
  return (
    <group>
      {sim.groups.map((g) => <GroupView key={g.id} g={g} />)}
    </group>
  );
}
function GroupView({ g }: { g: NightGroup }) {
  const seated = g.state === "ordering" || g.state === "partying";
  const t = sim.tables[g.table];
  const left = g.state === "ordering" ? Math.max(0, 1 - g.t / 26) : 0;
  return (
    <group>
      {g.members.map((cast, i) => {
        const ang = (i / g.size) * Math.PI * 1.2 + Math.PI * 0.9;
        const ox = seated ? t.x + Math.sin(ang) * 1.05 : g.x + (i - (g.size - 1) / 2) * 0.7;
        const oz = seated ? t.z + Math.cos(ang) * 1.05 : g.z + (i % 2) * 0.4;
        return (
          <group key={i} position={[ox, seated ? 0.12 : 0, oz]} rotation={[0, seated ? ang + Math.PI : 0, 0]}>
            <Person cast={cast} seated={seated} walkPh={g.walkPh} moving={!seated} />
          </group>
        );
      })}
      {g.state === "ordering" && (
        <Html position={[t.x, 2.7, t.z]} center distanceFactor={11} zIndexRange={[6, 0]}>
          <div style={{ ...bubbleStyle, background: "#2a1430", border: "2px solid #e07ab8" }}>
            <div style={{ fontSize: 18 }}>🍾</div>
            <div style={{ fontSize: 11, color: "#ff9de2", fontWeight: 800 }}>${g.price}</div>
            <div style={{ width: 52, height: 4, background: "#4a2a50", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${left * 100}%`, height: "100%", background: "#e07ab8", transition: "width 100ms linear" }} />
            </div>
          </div>
        </Html>
      )}
      {g.state === "partying" && (
        <Html position={[t.x, 2.7, t.z]} center distanceFactor={11} zIndexRange={[6, 0]}>
          <div style={{ fontSize: 18 }}>🥂✨</div>
        </Html>
      )}
    </group>
  );
}

export function Characters() {
  // State flips drive structural re-renders; the Math.floor(time*10) term keeps
  // JSX-positioned movers and countdown bars ticking at 10Hz (Characters-only now).
  useSimVersion(() =>
    sim.phase + "|" +
    sim.customers.map((c) => `${c.id}:${c.state}:${c.order}:${c.badItem}:${c.table}:${c.bench}:${c.angry ? 1 : 0}`).join(",") + "|" +
    sim.enemies.map((e) => `${e.id}:${e.state}:${Math.ceil(e.hp)}:${e.buffed ? 1 : 0}:${e.steal?.id ?? ""}`).join(",") + "|" +
    sim.groups.map((g) => `${g.id}:${g.state}:${g.price}`).join(",") + "|" +
    sim.spectators.length + "|" +
    (sim.chef.carry ? `${sim.chef.carry.kind}:${sim.chef.carry.id}:${sim.chef.carry.quality ?? ""}` : "") + "|" +
    (sim.chef.wastedT > 0 ? 1 : 0) + "|" +
    Math.floor(sim.time * 10)
  );
  const ch = sim.chef;
  return (
    <group>
      <Chef />
      <Customers />
      <Enemies />
      <Spectators />
      <Groups />
      {/* chef HP hearts during brawl are in the HUD; carried dish shown above */}
      {sim.phase === "brawl" && (
        <Html position={[ch.x, 2.9, ch.z]} center distanceFactor={11} zIndexRange={[6, 0]}>
          <div style={{ fontSize: 10, whiteSpace: "nowrap", textShadow: "0 0 4px #000" }}>
            {"❤️".repeat(Math.max(0, Math.ceil((ch.hp / CHEF_HP) * 5)))}
          </div>
        </Html>
      )}
    </group>
  );
}
