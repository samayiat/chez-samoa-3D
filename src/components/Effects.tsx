// ============================================================================
// Effects: pooled instanced particles (fed by the sim's burst bus), the
// floating interact prompt marker, and world-anchored floating text flashes.
// ============================================================================
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { sim } from "../game/sim";
import { useSimVersion } from "./useSimVersion";

const MAX_P = 600;

interface P {
  alive: boolean; x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number; size: number; grav: number;
  r: number; g: number; b: number;
}

function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const pool = useMemo<P[]>(() =>
    Array.from({ length: MAX_P }, () => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 1, grav: 6, r: 1, g: 1, b: 1 })),
  []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    // drain the sim's burst queue
    for (const b of sim.frameBursts) {
      for (let i = 0; i < b.n; i++) {
        const p = pool.find((q) => !q.alive);
        if (!p) break;
        p.alive = true;
        p.x = b.x; p.y = b.y; p.z = b.z;
        const a = Math.random() * Math.PI * 2;
        const sp = b.sp * (0.4 + Math.random() * 0.8);
        p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp;
        p.vy = b.up * (0.5 + Math.random());
        p.maxLife = p.life = b.life * (0.7 + Math.random() * 0.6);
        p.size = b.size; p.grav = b.grav;
        tmpColor.set(b.colors[Math.floor(Math.random() * b.colors.length)]);
        p.r = tmpColor.r; p.g = tmpColor.g; p.b = tmpColor.b;
      }
    }
    sim.frameBursts.length = 0;

    const m = mesh.current!;
    let n = 0;
    for (const p of pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.04 && p.vy < 0) { p.y = 0.04; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      const k = p.life / p.maxLife;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(0.09 * p.size * (0.4 + k * 0.6));
      dummy.rotation.set(p.x * 3, p.y * 2, p.z * 3);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      m.setColorAt(n, tmpColor.setRGB(p.r, p.g, p.b));
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX_P]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function PromptMarker() {
  const g = useRef<THREE.Group>(null);
  const dia = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const p = sim.getPrompt();
    g.current!.visible = !!p;
    if (p) {
      g.current!.position.set(p.x, p.y + 0.35 + Math.sin(clock.elapsedTime * 4) * 0.1, p.z);
      dia.current!.rotation.y = clock.elapsedTime * 2.5;
    }
  });
  return (
    <group ref={g} visible={false}>
      <mesh ref={dia}>
        <octahedronGeometry args={[0.16]} />
        <meshStandardMaterial color="#ffd86b" emissive="#ffb830" emissiveIntensity={1.4} />
      </mesh>
      <Html position={[0, 0.32, 0]} center distanceFactor={12} zIndexRange={[6, 0]}>
        <div style={{
          background: "#ffd86b", color: "#3a2a10", fontWeight: 900, fontSize: 11,
          borderRadius: 5, padding: "2px 7px", fontFamily: "monospace",
          boxShadow: "0 1px 4px rgba(0,0,0,.4)", border: "1px solid #b89030",
        }}>E</div>
      </Html>
    </group>
  );
}

function Flashes() {
  return (
    <group>
      {sim.flashes.map((f, i) => {
        const k = f.t / f.dur;
        return (
          <Html key={i} position={[f.x, f.y + f.t * 1.3, f.z]} center distanceFactor={12} zIndexRange={[7, 0]}>
            <div style={{
              color: f.color, fontWeight: 900, fontFamily: "system-ui",
              fontSize: f.big ? 34 : 15, whiteSpace: "nowrap",
              textShadow: "0 2px 6px rgba(0,0,0,.7), 0 0 2px rgba(0,0,0,.9)",
              opacity: 1 - k * k,
              transform: `scale(${f.big ? 1 + Math.min(0.2, f.t) : 1})`,
              letterSpacing: f.big ? 4 : 0,
            }}>{f.text}</div>
          </Html>
        );
      })}
    </group>
  );
}

export function Effects() {
  useSimVersion(() => sim.flashes.map((f) => `${f.x.toFixed(1)}:${f.text}:${f.t.toFixed(1)}`).join(","));
  return (
    <group>
      <Particles />
      <PromptMarker />
      <Flashes />
    </group>
  );
}
