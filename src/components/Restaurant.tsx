// ============================================================================
// The restaurant: floor, walls, windows, kitchen line, pass, bar, tables,
// bench, plants, door — plus per-station live state visuals (steam, bubbles,
// ready lights, wreckage) driven straight from the sim.
// ============================================================================
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard, Html } from "@react-three/drei";
import { sim } from "../game/sim";
import { STATIONS, CRATE, BAR_GIN, BAR_MIX, BAR_WSK, TRASH, DOOR, TABLES, BENCH, PLATES, PLANTS } from "../game/constants";
import { DishModel } from "./models";
import { useSimVersion } from "./useSimVersion";

const WALL_H = 4.4;
const WALL_COL = "#e8d9be";

// window glass that dims to night-blue after hours
function WindowGlass() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    if (!mat.current) return;
    const night = sim.phase === "night";
    const k = 1 - Math.exp(-3 * dt);
    mat.current.emissiveIntensity += ((night ? 0.15 : 0.9) - mat.current.emissiveIntensity) * k;
    mat.current.emissive.lerp(tmp.set(night ? "#3a4a8a" : "#ffbf70"), k);
    mat.current.color.lerp(tmp.set(night ? "#4a5a8a" : "#ffd9a0"), k);
  });
  return (
    <mesh position={[0, 2.7, -0.02]}>
      <planeGeometry args={[3.3, 2.2]} />
      <meshStandardMaterial ref={mat} color="#ffd9a0" emissive="#ffbf70" emissiveIntensity={0.9} />
    </mesh>
  );
}

function Walls() {
  // north wall (windows + liquor cabinet), west wall, east wall (door hole)
  return (
    <group>
      {/* north wall segments around 3 windows (x centers -9.5,-4,1.5 ; w 3.4 ; sill 1.7..3.7) */}
      {[0, 1, 2, 3].map((i) => {
        const segs = [[-13.4, -11.2], [-7.8, -5.7], [-2.3, -0.2], [3.2, 6.4]];
        const [a, b] = segs[i];
        return (
          <mesh key={i} position={[(a + b) / 2, WALL_H / 2, -5.75]} receiveShadow>
            <boxGeometry args={[b - a, WALL_H, 0.3]} />
            <meshStandardMaterial color={WALL_COL} />
          </mesh>
        );
      })}
      {/* window top + sill strips */}
      {[-9.5, -4, 1.5].map((x, i) => (
        <group key={i} position={[x, 0, -5.75]}>
          <mesh position={[0, 0.85, 0]}><boxGeometry args={[3.6, 1.7, 0.3]} /><meshStandardMaterial color={WALL_COL} /></mesh>
          <mesh position={[0, 4.05, 0]}><boxGeometry args={[3.6, 0.7, 0.3]} /><meshStandardMaterial color={WALL_COL} /></mesh>
          {/* glass + frame + warm pool */}
          <WindowGlass />
          <mesh position={[0, 2.7, 0.06]}><boxGeometry args={[0.08, 2.3, 0.1]} /><meshStandardMaterial color="#6a4a32" /></mesh>
          <mesh position={[0, 2.7, 0.06]}><boxGeometry args={[3.4, 0.08, 0.1]} /><meshStandardMaterial color="#6a4a32" /></mesh>
          <mesh position={[0, 1.66, 0.1]}><boxGeometry args={[3.7, 0.12, 0.42]} /><meshStandardMaterial color="#6a4a32" /></mesh>
        </group>
      ))}
      {/* liquor cabinet behind the bar (x 6.6..13) */}
      <group position={[9.8, 0, -5.72]}>
        <mesh position={[0, 2.4, 0]}><boxGeometry args={[6.6, 4, 0.34]} /><meshStandardMaterial color="#5a3a26" /></mesh>
        {[1.4, 2.3, 3.2].map((y, si) => (
          <group key={si}>
            <mesh position={[0, y, 0.24]}><boxGeometry args={[6.2, 0.08, 0.5]} /><meshStandardMaterial color="#7a5236" /></mesh>
            {Array.from({ length: 9 }).map((_, bi) => (
              <mesh key={bi} position={[-2.7 + bi * 0.68, y + 0.28, 0.24]} visible={!sim.barBroken}>
                <cylinderGeometry args={[0.09, 0.11, 0.44, 8]} />
                <meshStandardMaterial color={["#7a2a3a", "#2a5a3a", "#b0782a", "#3a4a7a", "#6a2a5a"][(bi + si) % 5]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* west wall */}
      <mesh position={[-13.35, WALL_H / 2, 0.4]} receiveShadow>
        <boxGeometry args={[0.3, WALL_H, 12.8]} />
        <meshStandardMaterial color={WALL_COL} />
      </mesh>
      {/* office door decor on west wall */}
      <mesh position={[-13.18, 1.1, 1.8]}><boxGeometry args={[0.1, 2.2, 1.2]} /><meshStandardMaterial color="#6a4a32" /></mesh>
      {/* east wall with door opening (z 3.2..5.0) */}
      <mesh position={[13.35, WALL_H / 2, -1.2]} receiveShadow>
        <boxGeometry args={[0.3, WALL_H, 9.4]} />
        <meshStandardMaterial color={WALL_COL} />
      </mesh>
      <mesh position={[13.35, WALL_H / 2, 5.85]} receiveShadow>
        <boxGeometry args={[0.3, WALL_H, 2.3]} />
        <meshStandardMaterial color={WALL_COL} />
      </mesh>
      <mesh position={[13.35, 3.85, 4.1]}>
        <boxGeometry args={[0.3, 1.1, 2.1]} />
        <meshStandardMaterial color={WALL_COL} />
      </mesh>
      {/* doorway dark + exit sign + mat */}
      <mesh position={[13.3, 1.65, 4.1]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.9, 3.3]} />
        <meshStandardMaterial color="#120e18" />
      </mesh>
      <mesh position={[13.1, 3.5, 4.1]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.1, 0.4]} />
        <meshStandardMaterial color="#2a1a14" emissive="#ff6040" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[12.2, 0.02, 4.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 1.6]} />
        <meshStandardMaterial color="#7a3a30" />
      </mesh>
    </group>
  );
}

function Floor() {
  const planks = useMemo(() => {
    const arr: { x: number; z: number; c: string }[] = [];
    const cols = ["#a5764e", "#9a6c46", "#b0825a"];
    let k = 0;
    for (let x = -13.2; x < 13.4; x += 1.1) {
      for (let z = -5.6; z < 6.9; z += 2.6) {
        arr.push({ x: x + ((Math.round(z * 10) % 2) ? 0.3 : 0), z, c: cols[k++ % 3] });
      }
    }
    return arr;
  }, []);
  return (
    <group>
      <mesh position={[0, -0.06, 0.6]} receiveShadow>
        <boxGeometry args={[27.4, 0.12, 13.4]} />
        <meshStandardMaterial color="#8a5f42" />
      </mesh>
      {planks.map((p, i) => (
        <mesh key={i} position={[p.x, 0.005, p.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1.06, 2.56]} />
          <meshStandardMaterial color={p.c} roughness={0.85} />
        </mesh>
      ))}
      {/* warm light pools under windows */}
      {[-9.5, -4, 1.5].map((x, i) => (
        <mesh key={i} position={[x, 0.015, -3.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.2, 3.6]} />
          <meshBasicMaterial color="#ffca80" transparent opacity={0.10} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- stations
function StationBase({ x, z, w = 2.1, color = "#9aa2ac", children }: any) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 1.1, 1.15]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <boxGeometry args={[w + 0.08, 0.07, 1.22]} />
        <meshStandardMaterial color="#d7dce2" metalness={0.6} roughness={0.3} />
      </mesh>
      {children}
    </group>
  );
}

function ReadyLight({ x, z }: { x: number; z: number }) {
  const m = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const st = sim.stations;
    let col = "#000000", pulse = 0;
    for (const id in st) {
      const def = STATIONS.find((s) => s.id === id)!;
      if (Math.abs(def.x - x) > 0.5) continue;
      if (st[id].state === "green" || st[id].state === "ready") { col = "#4aff7a"; pulse = 1; }
      else if (st[id].state === "burnt") { col = "#ff4a3a"; pulse = 1; }
      else if (st[id].state === "cooking" || st[id].state === "assembling") { col = "#ffc84a"; pulse = 0.4; }
    }
    const mat = m.current!.material as THREE.MeshStandardMaterial;
    mat.emissive = new THREE.Color(col);
    mat.emissiveIntensity = pulse ? 1.2 + Math.sin(clock.elapsedTime * 8) * 0.8 : 0;
  });
  return (
    <mesh ref={m} position={[x, 2.6, z]}>
      <sphereGeometry args={[0.11, 10, 8]} />
      <meshStandardMaterial color="#222" />
    </mesh>
  );
}

function CookBar({ id, x, z, total }: { id: string; x: number; z: number; total: number }) {
  const bar = useRef<THREE.Mesh>(null);
  const grp = useRef<THREE.Group>(null);
  useFrame(() => {
    const st = sim.stations[id];
    const active = st.state === "cooking" || st.state === "assembling";
    grp.current!.visible = active;
    if (active) {
      const p = Math.min(1, st.t / total);
      bar.current!.scale.x = Math.max(0.02, p);
      (bar.current!.material as THREE.MeshStandardMaterial).color.set(p > 0.8 ? "#4aff7a" : "#ffc84a");
    }
  });
  return (
    <Billboard ref={grp} position={[x, 2.95, z]} visible={false}>
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[1.3, 0.16]} />
        <meshBasicMaterial color="#00000088" transparent opacity={0.7} />
      </mesh>
      <mesh ref={bar} position={[0, 0, 0]}>
        <planeGeometry args={[1.26, 0.11]} />
        <meshBasicMaterial color="#ffc84a" />
      </mesh>
    </Billboard>
  );
}

function StationFX() {
  // ambient life: steam, bubbles, smoke — emitted into the shared fx bus
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.12) return;
    acc.current = 0;
    const fryer = sim.stations.fryer, pot = sim.stations.pot, bar = sim.stations.bar;
    if (fryer.state === "cooking") sim.burst(STATIONS[0].x, 1.5, STATIONS[0].z, ["#ffe9b0", "#ffd070"], 1, 0.4, 1.6, 0.5, -1, 0.7);
    if (fryer.state === "burnt") sim.burst(STATIONS[0].x, 1.6, STATIONS[0].z, ["#3a3430", "#241f1c"], 2, 0.5, 1.8, 0.9, -0.5, 1.1);
    if (pot.state === "cooking") sim.burst(STATIONS[3].x, 1.7, STATIONS[3].z, ["#ffffff", "#e8f0ff"], 1, 0.4, 1.8, 0.6, -1, 0.8);
    if (pot.state === "burnt") sim.burst(STATIONS[3].x, 1.7, STATIONS[3].z, ["#3a3430", "#241f1c"], 2, 0.5, 1.8, 0.9, -0.5, 1.1);
    if (pot.state === "idle" && !pot.broken && Math.random() < 0.3) sim.burst(STATIONS[3].x, 1.6, STATIONS[3].z, ["#ffffffcc"], 1, 0.2, 1.0, 0.8, -1, 0.6);
    if (bar.state === "assembling") sim.burst(BAR_MIX.x, 1.6, BAR_MIX.z, ["#ffffff", "#ffe9b0"], 1, 0.8, 1.2, 0.3, 2, 0.5);
    for (const id in sim.stations) {
      const st = sim.stations[id];
      if (st.broken && Math.random() < 0.25) {
        const def = STATIONS.find((s) => s.id === id)!;
        sim.burst(def.x, 1.3, def.z, ["#4a4440", "#333"], 1, 0.3, 1.0, 1.0, -0.5, 0.9);
      }
    }
  });
  return null;
}

function Stations() {
  const fryerX = STATIONS[0].x, potX = STATIONS[3].x;
  return (
    <group>
      {/* FRYER */}
      <StationBase x={fryerX} z={STATIONS[0].z} color="#8a929c">
        <mesh position={[0, 1.3, -0.1]}><boxGeometry args={[1.2, 0.28, 0.7]} /><meshStandardMaterial color="#3a3f46" /></mesh>
        <mesh position={[0, 1.42, -0.1]}><boxGeometry args={[1.0, 0.06, 0.55]} /><meshStandardMaterial color="#d88a2a" emissive="#8a4a10" emissiveIntensity={0.5} /></mesh>
        <mesh position={[0.6, 1.6, -0.35]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.5, 0.04, 0.4]} /><meshStandardMaterial color="#c9cfd6" metalness={0.7} roughness={0.3} /></mesh>
      </StationBase>
      {/* chicken crate */}
      <group position={[CRATE.x, 0, CRATE.z + 0.15]}>
        <mesh position={[0, 0.25, 0]} castShadow><boxGeometry args={[1.0, 0.5, 0.8]} /><meshStandardMaterial color="#a5764e" /></mesh>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.9, 0.14, 0.7]} /><meshStandardMaterial color="#e8c890" /></mesh>
        <mesh position={[0, 0.36, 0.41]}><planeGeometry args={[0.8, 0.3]} /><meshStandardMaterial color="#7a5236" /></mesh>
      </group>
      {/* SALAD BAR */}
      <StationBase x={STATIONS[1].x} z={STATIONS[1].z} color="#7a9a6a">
        {[-0.5, 0, 0.5].map((dx, i) => (
          <mesh key={i} position={[dx, 1.25, -0.1]}>
            <cylinderGeometry args={[0.28, 0.22, 0.2, 12]} />
            <meshStandardMaterial color={["#7ec850", "#d84a3a", "#f2e8c8"][i]} />
          </mesh>
        ))}
      </StationBase>
      {/* ICE BOX */}
      <StationBase x={STATIONS[2].x} z={STATIONS[2].z} color="#c8d4dc">
        <mesh position={[0, 1.25, 0]}><boxGeometry args={[1.7, 0.14, 0.9]} /><meshStandardMaterial color="#e8f0f6" /></mesh>
        <mesh position={[0, 1.36, -0.2]} rotation={[-0.5, 0, 0]}><boxGeometry args={[1.5, 0.06, 0.6]} /><meshStandardMaterial color="#b8c8d4" /></mesh>
        <mesh position={[0.3, 1.42, 0.1]}><boxGeometry args={[0.4, 0.12, 0.25]} /><meshStandardMaterial color="#a06858" /></mesh>
      </StationBase>
      {/* POT */}
      <StationBase x={potX} z={STATIONS[3].z} color="#8a929c">
        <mesh position={[0, 1.35, -0.05]} castShadow><cylinderGeometry args={[0.5, 0.45, 0.45, 16]} /><meshStandardMaterial color="#5a6068" metalness={0.6} roughness={0.35} /></mesh>
        <mesh position={[0, 1.58, -0.05]}><cylinderGeometry args={[0.44, 0.44, 0.04, 16]} /><meshStandardMaterial color="#4a8ac8" emissive="#1a4a7a" emissiveIntensity={0.4} /></mesh>
        {[-0.55, 0.55].map((dx, i) => <mesh key={i} position={[dx, 1.42, -0.05]}><torusGeometry args={[0.09, 0.03, 8, 12, Math.PI]} /><meshStandardMaterial color="#3a3f46" /></mesh>)}
      </StationBase>
      {/* BAR */}
      <StationBase x={STATIONS[4].x} z={STATIONS[4].z} w={3.6} color="#6a4a32">
        <mesh position={[0, 1.16, 0]}><boxGeometry args={[3.7, 0.08, 1.3]} /><meshStandardMaterial color="#8a5f42" /></mesh>
        {/* taps: gin / sour mix / whiskey */}
        {[[BAR_GIN.x, "#cfe8d8", "GIN"], [BAR_MIX.x, "#f2e8c8", "SOUR"], [BAR_WSK.x, "#e0a83c", "WSK"]].map(([bx, col], i) => (
          <group key={i} position={[(bx as number) - STATIONS[4].x, 0, 0]}>
            <mesh position={[0, 1.45, -0.25]}><cylinderGeometry args={[0.09, 0.12, 0.5, 10]} /><meshStandardMaterial color={col as string} /></mesh>
            <mesh position={[0, 1.75, -0.25]}><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial color={col as string} /></mesh>
          </group>
        ))}
        {/* shaker */}
        <mesh position={[0, 1.35, 0.25]}><cylinderGeometry args={[0.11, 0.14, 0.3, 10]} /><meshStandardMaterial color="#c9cfd6" metalness={0.8} roughness={0.2} /></mesh>
      </StationBase>
      {/* ready lights + progress bars */}
      {STATIONS.filter((s) => s.kind !== "source").map((s) => (
        <group key={s.id}>
          <ReadyLight x={s.x} z={s.z} />
          {(s.kind === "timing" || s.id === "bar" || s.id === "salad") && (
            <CookBar id={s.id} x={s.x} z={s.z} total={s.cook ?? 1.3} />
          )}
        </group>
      ))}
      <ReadyLight x={STATIONS[2].x} z={STATIONS[2].z} />
      {/* labels */}
      {STATIONS.map((s) => (
        <Html key={s.id} position={[s.x, 3.35, s.z]} center distanceFactor={14} zIndexRange={[5, 0]}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: "#e9d8b8", opacity: 0.65, fontFamily: "monospace", whiteSpace: "nowrap" }}>{s.label}</div>
        </Html>
      ))}
      <StationFX />
    </group>
  );
}

function Pass() {
  return (
    <group>
      {/* counter */}
      <mesh position={[-0.3, 0.5, -1.25]} castShadow receiveShadow>
        <boxGeometry args={[11.6, 1.0, 0.72]} />
        <meshStandardMaterial color="#7a5236" />
      </mesh>
      <mesh position={[-0.3, 1.03, -1.25]}>
        <boxGeometry args={[11.8, 0.07, 0.85]} />
        <meshStandardMaterial color="#d7dce2" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* heat lamps */}
      {[-4, -1, 2].map((x, i) => (
        <group key={i} position={[x, 2.1, -1.25]}>
          <mesh><coneGeometry args={[0.3, 0.35, 12, 1, true]} /><meshStandardMaterial color="#c04838" side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, -0.18, 0]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#ffd070" emissive="#ffb040" emissiveIntensity={2} /></mesh>
          {/* heat-lamp point lights removed (GPU trim) — emissive bulbs kept */}
        </group>
      ))}
      {/* slots with items */}
      {sim.passSlots.map((s, i) => (
        <group key={i} position={[s.x, 1.1, s.z]}>
          <mesh receiveShadow><cylinderGeometry args={[0.32, 0.32, 0.025, 16]} /><meshStandardMaterial color="#e8e2d4" /></mesh>
          {s.item && <group position={[0, 0.05, 0]}><DishModel item={s.item} scale={0.9} /></group>}
        </group>
      ))}
      {/* clean plate stack */}
      <group position={[PLATES.x, 1.1, PLATES.z]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, i * 0.045, 0]}><cylinderGeometry args={[0.28, 0.28, 0.035, 16]} /><meshStandardMaterial color="#f4f0e8" /></mesh>
        ))}
      </group>
      {/* trash */}
      <group position={[TRASH.x, 0, TRASH.z + 0.3]}>
        <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.42, 0.34, 1.0, 12]} /><meshStandardMaterial color="#4a4f56" metalness={0.5} roughness={0.5} /></mesh>
        <mesh position={[0, 1.02, 0]}><cylinderGeometry args={[0.44, 0.44, 0.06, 12]} /><meshStandardMaterial color="#3a3f46" /></mesh>
      </group>
    </group>
  );
}

function Candle({ x, z, ph }: { x: number; z: number; ph: number }) {
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 9 + ph;
    const s = 0.85 + Math.sin(t) * 0.15 + Math.sin(t * 2.7) * 0.08;
    flame.current!.scale.set(s, s * (1 + Math.sin(t * 1.3) * 0.1), s);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.93, 0]}><cylinderGeometry args={[0.045, 0.05, 0.16, 8]} /><meshStandardMaterial color="#f2e8d0" /></mesh>
      <mesh ref={flame} position={[0, 1.06, 0]}>
        <coneGeometry args={[0.035, 0.12, 8]} />
        <meshBasicMaterial color="#ffb840" />
      </mesh>
      <mesh position={[0, 1.05, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color="#ff9838" transparent opacity={0.25} /></mesh>
    </group>
  );
}

function Tables() {
  return (
    <group>
      {TABLES.map((t, i) => {
        const st = sim.tables[i];
        return (
          <group key={i} position={[t.x, 0, t.z]}>
            {/* table */}
            <mesh position={[0, 0.42, 0]} castShadow><cylinderGeometry args={[0.09, 0.13, 0.84, 10]} /><meshStandardMaterial color="#6a4a32" /></mesh>
            <mesh position={[0, 0.86, 0]} castShadow receiveShadow><cylinderGeometry args={[0.78, 0.78, 0.06, 20]} /><meshStandardMaterial color="#f0e6d2" /></mesh>
            <mesh position={[0, 0.83, 0]}><cylinderGeometry args={[0.82, 0.85, 0.05, 20]} /><meshStandardMaterial color="#c8543e" /></mesh>
            {/* stool on the near side */}
            <group position={[0, 0, 0.95]}>
              <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.06, 0.08, 0.5, 8]} /><meshStandardMaterial color="#5a3a26" /></mesh>
              <mesh position={[0, 0.53, 0]} castShadow><cylinderGeometry args={[0.3, 0.3, 0.08, 14]} /><meshStandardMaterial color="#8a2a3a" /></mesh>
            </group>
            <Candle x={0.35} z={-0.25} ph={i * 1.7} />
            {/* served plate */}
            {st.plate && st.plate !== "bottle" && (
              <group position={[-0.15, 0.9, 0.1]}><DishModel item={{ kind: "dish", id: st.plate, quality: "perfect" }} scale={0.9} /></group>
            )}
            {st.plate === "bottle" && (
              <group position={[-0.15, 0.9, 0.1]}><DishModel item={{ kind: "bottle", id: "bottle" }} /></group>
            )}
          </group>
        );
      })}
      {/* waiting bench */}
      <group position={[11, 0, 5.8]}>
        <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[4.6, 0.14, 0.7]} /><meshStandardMaterial color="#7a5236" /></mesh>
        {[-1.9, 1.9].map((dx, i) => <mesh key={i} position={[dx, 0.14, 0]}><boxGeometry args={[0.14, 0.3, 0.6]} /><meshStandardMaterial color="#5a3a26" /></mesh>)}
        {BENCH.map((b, i) => (
          <mesh key={i} position={[b.x - 11, 0.42, 0]}><cylinderGeometry args={[0.26, 0.26, 0.1, 12]} /><meshStandardMaterial color="#3a5a8a" /></mesh>
        ))}
      </group>
      {/* plants */}
      {PLANTS.map((p, i) => {
        const broken = sim.plants[i]?.broken;
        return (
          <group key={i} position={[p.x, 0, p.z]} rotation={[broken ? 0.9 : 0, 0, broken ? 0.6 : 0]}>
            <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.32, 0.24, 0.6, 10]} /><meshStandardMaterial color={broken ? "#6a5040" : "#a85838"} /></mesh>
            {[0.75, 1.05, 1.3].map((y, j) => (
              <mesh key={j} position={[Math.sin(j * 2.1 + i) * 0.14, y, Math.cos(j * 2.1 + i) * 0.14]} castShadow>
                <sphereGeometry args={[0.34 - j * 0.06, 10, 8]} />
                <meshStandardMaterial color={broken ? "#4a5a30" : ["#3e7a3a", "#4f9a45", "#5fb84f"][j]} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* pendant lamps over tables */}
      {TABLES.filter((_, i) => i % 2 === 0).map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, 3.3, 0]}><cylinderGeometry args={[0.015, 0.015, 1.6, 6]} /><meshStandardMaterial color="#333" /></mesh>
          <mesh position={[0, 2.5, 0]}><coneGeometry args={[0.4, 0.4, 14, 1, true]} /><meshStandardMaterial color="#2c4a3a" side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, 2.34, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshStandardMaterial color="#ffd070" emissive="#ffb040" emissiveIntensity={2.2} /></mesh>
        </group>
      ))}
      {/* door sign */}
      <Html position={[DOOR.x - 0.6, 3.2, DOOR.z]} center distanceFactor={16} zIndexRange={[5, 0]}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#ffd8b8", fontFamily: "monospace", opacity: 0.8 }}>ENTRANCE</div>
      </Html>
    </group>
  );
}

export function Restaurant() {
  // Only the wreck/plating slices are drawn in JSX here; live station state
  // (ready lights, cook bars, steam) is handled in useFrame refs, so it's
  // deliberately excluded from this signature.
  useSimVersion(() =>
    (sim.barBroken ? "1" : "0") + "|" +
    sim.plants.map((p) => (p.broken ? 1 : 0)).join("") + "|" +
    sim.tables.map((t) => t.plate ?? "").join(",") + "|" +
    sim.passSlots.map((p) => (p.item ? p.item.id + (p.item.quality ?? "") : "")).join(",")
  );
  return (
    <group>
      <Floor />
      <Walls />
      <Stations />
      <Pass />
      <Tables />
    </group>
  );
}
