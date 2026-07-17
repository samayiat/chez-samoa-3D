// ============================================================================
// Scene: canvas, camera rig (follow + shake + drunk sway), phase lighting,
// and the master game loop.
// ============================================================================
import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sim } from "../game/sim";
import { Restaurant } from "./Restaurant";
import { Characters } from "./Characters";
import { Effects } from "./Effects";

function GameLoop() {
  useFrame((_, dt) => {
    sim.tick(Math.min(dt, 0.05));
  });
  return null;
}

function CameraRig() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 2.5));
  const orbit = useRef(0);
  useFrame((state, dt) => {
    const ch = sim.chef;
    let tx = ch.x, tz = ch.z, ty = 0;
    if (sim.phase === "title") {
      orbit.current += dt * 0.12;
      const r = 12.5;
      camera.position.lerp(new THREE.Vector3(Math.sin(orbit.current) * r, 7.5, Math.cos(orbit.current) * r * 0.75 + 1), 1 - Math.exp(-2 * dt));
      camera.lookAt(0, 1.2, 0);
      return;
    }
    target.current.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.exp(-6 * dt));
    const t = target.current;
    // follow cam: behind & above, fixed yaw facing the kitchen (like the original)
    const off = new THREE.Vector3(0, 8.4, 9.2);
    const pos = t.clone().add(off);
    // shake
    const s = sim.shake;
    if (s > 0.001) {
      pos.x += (Math.random() - 0.5) * s * 0.5;
      pos.y += (Math.random() - 0.5) * s * 0.4;
      pos.z += (Math.random() - 0.5) * s * 0.5;
    }
    camera.position.lerp(pos, 1 - Math.exp(-8 * dt));
    const look = t.clone().add(new THREE.Vector3(0, 0.8, -1.2));
    // drunk sway
    if (sim.chef.wastedT > 0) {
      const w = state.clock.elapsedTime;
      look.x += Math.sin(w * 1.9) * 0.7;
      look.y += Math.cos(w * 1.4) * 0.3;
      camera.rotation.z += Math.sin(w * 1.6) * 0.03;
    }
    camera.lookAt(look);
  });
  return null;
}

function Lights() {
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const dir = useRef<THREE.DirectionalLight>(null);
  const passGlow = useRef<THREE.PointLight>(null);
  const barGlow = useRef<THREE.PointLight>(null);
  const rageGlow = useRef<THREE.PointLight>(null);
  const spot1 = useRef<THREE.SpotLight>(null);
  const spot2 = useRef<THREE.SpotLight>(null);
  const stro = useRef<THREE.PointLight>(null);
  const follow = useRef<THREE.PointLight>(null);
  const tmp = new THREE.Color();
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const night = sim.phase === "night";
    const brawl = sim.phase === "brawl";
    const k = 1 - Math.exp(-3 * dt); // smooth mood transitions
    // targets per phase
    const ambT = night ? 0.27 : brawl ? 0.42 : 0.6;
    const hemiT = night ? 0.14 : 0.35;
    const dirT = night ? 0.0 : brawl ? 0.85 : 1.25;
    if (amb.current) {
      amb.current.intensity += (ambT - amb.current.intensity) * k;
      amb.current.color.lerp(tmp.set(night ? "#8a7aff" : "#ffe8c8"), k);
    }
    if (hemi.current) {
      hemi.current.intensity += (hemiT - hemi.current.intensity) * k;
      hemi.current.color.lerp(tmp.set(night ? "#4a3a8a" : "#fff2dc"), k);
      hemi.current.groundColor.lerp(tmp.set(night ? "#1a1030" : "#8a6a4a"), k);
    }
    if (dir.current) {
      dir.current.intensity += (dirT - dir.current.intensity) * k;
      dir.current.color.lerp(tmp.set(brawl ? "#ffd0b0" : "#fff0d8"), k);
    }
    if (passGlow.current) passGlow.current.intensity += ((night ? 0.25 : 0.75) - passGlow.current.intensity) * k;
    if (barGlow.current) {
      barGlow.current.intensity += ((night ? 0.8 : 0.5) - barGlow.current.intensity) * k;
      barGlow.current.color.lerp(tmp.set(night ? "#ff4ad8" : "#ffc878"), k);
    }
    if (rageGlow.current) rageGlow.current.intensity = brawl ? (sim.brawl?.live ? 1.7 : 0.35) : 0;
    if (spot1.current) {
      spot1.current.visible = night;
      spot1.current.position.set(Math.sin(t * 0.9) * 6, 6.5, Math.cos(t * 0.6) * 3 + 1);
      spot1.current.target.position.set(Math.sin(t * 1.3) * 4, 0, Math.cos(t) * 3 + 2);
      spot1.current.target.updateMatrixWorld();
    }
    if (spot2.current) {
      spot2.current.visible = night;
      spot2.current.position.set(Math.cos(t * 0.7) * 7, 6.5, Math.sin(t * 0.8) * 3 + 1);
      spot2.current.target.position.set(Math.cos(t * 1.1) * 5, 0, Math.sin(t * 1.4) * 3 + 2);
      spot2.current.target.updateMatrixWorld();
    }
    if (stro.current) {
      stro.current.visible = sim.strobe > 0;
      if (sim.strobe > 0) stro.current.intensity = Math.sin(t * 30) > 0 ? 3.5 : 0;
    }
    if (follow.current) {
      const tgt = night ? 1.1 : 0;
      follow.current.intensity += (tgt - follow.current.intensity) * k;
      follow.current.position.set(sim.chef.x, 4.5, sim.chef.z + 1);
    }
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.6} color="#ffe8c8" />
      <hemisphereLight ref={hemi} intensity={0.35} color="#fff2dc" groundColor="#8a6a4a" />
      <directionalLight
        ref={dir} position={[6, 12, 7]} intensity={1.25} color="#fff0d8"
        castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={12} shadow-camera-bottom={-12}
      />
      <pointLight ref={rageGlow} position={[0, 5, 2]} intensity={0} color="#ff5040" distance={22} />
      {/* club beams */}
      <spotLight ref={spot1} color="#ff4ad8" intensity={14} distance={26} angle={0.5} penumbra={0.6} />
      <spotLight ref={spot2} color="#4a8aff" intensity={14} distance={26} angle={0.5} penumbra={0.6} />
      <pointLight ref={stro} position={[0, 6, 1]} color="#ffffff" distance={24} />
      <pointLight ref={follow} position={[0, 4.5, 1]} intensity={0} color="#ffe8d0" distance={7} />
      {/* warm pendant glow over the pass */}
      <pointLight ref={passGlow} position={[0, 4.2, -1.2]} intensity={0.75} color="#ffc878" distance={12} />
      <pointLight ref={barGlow} position={[8, 4.2, -4]} intensity={0.5} color="#ffc878" distance={10} />
    </>
  );
}

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 8.4, 11.7], fov: 50, near: 0.1, far: 120 }}
      gl={{ antialias: true }}
      style={{ background: "#181220" }}
    >
      <fog attach="fog" args={["#181220", 30, 70]} />
      <GameLoop />
      <CameraRig />
      <Lights />
      <Restaurant />
      <Characters />
      <Effects />
    </Canvas>
  );
}
