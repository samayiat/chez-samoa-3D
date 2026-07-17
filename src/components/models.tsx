// ============================================================================
// Shared low-poly models: people (procedural, cast-driven), dishes, bottles.
// Chunky Habbo-ish proportions, all primitives — no external assets.
// ============================================================================
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DISHES } from "../game/constants";
import type { CastDef, CarryItem } from "../game/constants";

function Hair({ cast }: { cast: CastDef }) {
  const c = cast.hair;
  switch (cast.do) {
    case "flattop": return <mesh position={[0, 1.78, 0]} castShadow><boxGeometry args={[0.5, 0.16, 0.44]} /><meshStandardMaterial color={c} /></mesh>;
    case "long": return (<>
      <mesh position={[0, 1.74, 0]} castShadow><sphereGeometry args={[0.3, 12, 10]} /><meshStandardMaterial color={c} /></mesh>
      <mesh position={[0, 1.42, -0.2]} castShadow><boxGeometry args={[0.44, 0.55, 0.14]} /><meshStandardMaterial color={c} /></mesh>
    </>);
    case "slick": return <mesh position={[0, 1.72, -0.03]} scale={[1, 0.55, 1.05]} castShadow><sphereGeometry args={[0.29, 12, 10]} /><meshStandardMaterial color={c} /></mesh>;
    case "cap": return (<>
      <mesh position={[0, 1.76, 0]} castShadow><cylinderGeometry args={[0.3, 0.32, 0.18, 12]} /><meshStandardMaterial color={c} /></mesh>
      <mesh position={[0, 1.7, 0.28]} castShadow><boxGeometry args={[0.4, 0.05, 0.24]} /><meshStandardMaterial color={c} /></mesh>
    </>);
    case "combover": return <mesh position={[0.05, 1.73, 0]} scale={[0.9, 0.45, 1]} castShadow><sphereGeometry args={[0.29, 12, 10]} /><meshStandardMaterial color={c} /></mesh>;
    case "bun": return (<>
      <mesh position={[0, 1.72, 0]} scale={[1, 0.7, 1]} castShadow><sphereGeometry args={[0.29, 12, 10]} /><meshStandardMaterial color={c} /></mesh>
      <mesh position={[0, 1.9, -0.08]} castShadow><sphereGeometry args={[0.14, 10, 8]} /><meshStandardMaterial color={c} /></mesh>
    </>);
    case "afro": return <mesh position={[0, 1.82, -0.04]} castShadow><sphereGeometry args={[0.4, 14, 12]} /><meshStandardMaterial color={c} /></mesh>;
    case "sidepart": return <mesh position={[0, 1.74, 0]} scale={[1.02, 0.6, 1.02]} castShadow><sphereGeometry args={[0.29, 12, 10]} /><meshStandardMaterial color={c} /></mesh>;
  }
}

function Accessory({ cast }: { cast: CastDef }) {
  switch (cast.acc) {
    case "shades": return <mesh position={[0, 1.56, 0.24]}><boxGeometry args={[0.4, 0.1, 0.08]} /><meshStandardMaterial color="#181818" /></mesh>;
    case "bowtie": return (<group position={[0, 1.24, 0.26]}>
      <mesh rotation={[0, 0, 0.6]}><boxGeometry args={[0.14, 0.08, 0.05]} /><meshStandardMaterial color="#a02838" /></mesh>
      <mesh rotation={[0, 0, -0.6]}><boxGeometry args={[0.14, 0.08, 0.05]} /><meshStandardMaterial color="#a02838" /></mesh>
    </group>);
    case "notepad": return <mesh position={[0.42, 0.9, 0.3]} rotation={[0.4, 0, 0]}><boxGeometry args={[0.22, 0.3, 0.04]} /><meshStandardMaterial color="#e8e2d0" /></mesh>;
    case "monocle": return <mesh position={[0.12, 1.58, 0.25]}><torusGeometry args={[0.08, 0.015, 8, 16]} /><meshStandardMaterial color="#d8c878" metalness={0.7} roughness={0.3} /></mesh>;
    default: return null;
  }
}

export interface PersonProps {
  cast: CastDef;
  walkPh?: number;
  moving?: boolean;
  seated?: boolean;
  tint?: string | null;   // e.g. rage tint
  hurt?: boolean;
  scale?: number;
  chefWhites?: boolean;
}

export function Person({ cast, walkPh = 0, moving = false, seated = false, tint = null, hurt = false, scale = 1, chefWhites = false }: PersonProps) {
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = seated ? 0 : moving ? Math.sin(walkPh) * 0.55 : 0;
    if (legL.current) legL.current.rotation.x = seated ? -1.35 : s;
    if (legR.current) legR.current.rotation.x = seated ? -1.35 : -s;
    if (armL.current) armL.current.rotation.x = -s * 0.7;
    if (armR.current) armR.current.rotation.x = s * 0.7;
  });
  const outfit = chefWhites ? "#f2ede2" : cast.outfit;
  const flash = hurt && Math.floor(performance.now() / 90) % 2 === 0;
  return (
    <group scale={scale}>
      {/* legs */}
      <mesh ref={legL} position={[-0.14, 0.42, 0]} castShadow>
        <boxGeometry args={[0.18, 0.5, 0.2]} />
        <meshStandardMaterial color={chefWhites ? "#3a3a44" : "#2c2c34"} />
      </mesh>
      <mesh ref={legR} position={[0.14, 0.42, 0]} castShadow>
        <boxGeometry args={[0.18, 0.5, 0.2]} />
        <meshStandardMaterial color={chefWhites ? "#3a3a44" : "#2c2c34"} />
      </mesh>
      {/* body */}
      <mesh position={[0, seated ? 0.78 : 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.5, 6, 12]} />
        <meshStandardMaterial color={flash ? "#ffffff" : (tint ?? outfit)} />
      </mesh>
      {chefWhites && <mesh position={[0, 0.95, 0.3]} rotation={[0.1, 0, 0]}><boxGeometry args={[0.5, 0.55, 0.06]} /><meshStandardMaterial color="#ffffff" /></mesh>}
      {/* arms */}
      <mesh ref={armL} position={[-0.42, seated ? 0.95 : 1.05, 0]} rotation={[0, 0, 0.15]} castShadow>
        <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
        <meshStandardMaterial color={flash ? "#ffffff" : (tint ?? outfit)} />
      </mesh>
      <mesh ref={armR} position={[0.42, seated ? 0.95 : 1.05, 0]} rotation={[0, 0, -0.15]} castShadow>
        <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
        <meshStandardMaterial color={flash ? "#ffffff" : (tint ?? outfit)} />
      </mesh>
      {/* head */}
      <mesh position={[0, seated ? 1.38 : 1.5, 0]} castShadow>
        <sphereGeometry args={[0.27, 16, 14]} />
        <meshStandardMaterial color={cast.skin} />
      </mesh>
      {/* eyes */}
      <mesh position={[-0.1, seated ? 1.42 : 1.54, 0.23]}><sphereGeometry args={[0.035, 6, 6]} /><meshStandardMaterial color="#181818" /></mesh>
      <mesh position={[0.1, seated ? 1.42 : 1.54, 0.23]}><sphereGeometry args={[0.035, 6, 6]} /><meshStandardMaterial color="#181818" /></mesh>
      <group position={[0, seated ? -0.12 : 0, 0]}>
        <Hair cast={cast} />
        <Accessory cast={cast} />
      </group>
      {chefWhites && (
        <group>
          {/* chef hat */}
          <mesh position={[0, 1.86, 0]} castShadow><cylinderGeometry args={[0.24, 0.26, 0.22, 14]} /><meshStandardMaterial color="#ffffff" /></mesh>
          <mesh position={[0, 2.02, 0]} castShadow><cylinderGeometry args={[0.3, 0.24, 0.14, 14]} /><meshStandardMaterial color="#ffffff" /></mesh>
          {/* neckerchief */}
          <mesh position={[0, 1.26, 0.1]} rotation={[0.3, 0, 0]}><boxGeometry args={[0.24, 0.12, 0.06]} /><meshStandardMaterial color="#c03848" /></mesh>
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
export function DishModel({ item, scale = 1 }: { item: CarryItem; scale?: number }) {
  if (item.kind === "bottle") {
    return (
      <group scale={scale}>
        <mesh position={[0, 0.16, 0]} castShadow><cylinderGeometry args={[0.09, 0.1, 0.32, 10]} /><meshStandardMaterial color="#1d5a2a" /></mesh>
        <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.03, 0.05, 0.14, 8]} /><meshStandardMaterial color="#164a20" /></mesh>
        <mesh position={[0, 0.47, 0]}><cylinderGeometry args={[0.032, 0.032, 0.05, 8]} /><meshStandardMaterial color="#d8b25c" /></mesh>
      </group>
    );
  }
  if (item.kind === "ing") {
    const col = item.id === "chicken" ? "#e8c890" : item.id === "rawlobster" ? "#a06858" : "#7ec850";
    return (
      <group scale={scale}>
        <mesh castShadow><boxGeometry args={[0.26, 0.14, 0.2]} /><meshStandardMaterial color={col} /></mesh>
        {item.id === "rawlobster" && <mesh position={[0.16, 0, 0]}><boxGeometry args={[0.12, 0.06, 0.08]} /><meshStandardMaterial color="#8a5040" /></mesh>}
      </group>
    );
  }
  const d = DISHES[item.id];
  const burnt = item.quality === "burnt";
  return (
    <group scale={scale}>
      <mesh castShadow><cylinderGeometry args={[0.3, 0.24, 0.06, 16]} /><meshStandardMaterial color="#f4f0e8" /></mesh>
      <mesh position={[0, 0.07, 0]} castShadow>
        <sphereGeometry args={[0.17, 10, 8]} />
        <meshStandardMaterial color={burnt ? "#2c2018" : d?.color ?? "#ccc"} />
      </mesh>
      {burnt && <mesh position={[0, 0.16, 0]}><sphereGeometry args={[0.08, 6, 6]} /><meshStandardMaterial color="#120c08" /></mesh>}
    </group>
  );
}

export const DISH_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(DISHES).map(([k, v]) => [k, v.emoji])
);
