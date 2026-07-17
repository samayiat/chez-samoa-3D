import { useEffect } from "react";
import { Routes, Route } from "react-router";
import { Scene } from "./components/Scene";
import { HUD } from "./components/HUD";
import { Screens } from "./components/Screens";
import { sim } from "./game/sim";
import { isMuted, setMuted } from "./game/audio";
import { startGamepad } from "./game/gamepad";

const keys = new Set<string>();

function applyInput() {
  let x = 0, z = 0;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("w") || keys.has("arrowup")) z -= 1;
  if (keys.has("s") || keys.has("arrowdown")) z += 1;
  sim.input.x = x; sim.input.z = z;
}

function useGameInput() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (e.repeat) return;
      keys.add(k);
      applyInput();
      if (k === "e" || k === " ") sim.interact();
      if (k === "j") sim.punch();
      if (k === "m") setMuted(!isMuted());
      if (k === "escape" && ["day", "brawl", "night"].includes(sim.phase)) sim.paused = !sim.paused;
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      applyInput();
    };
    const blur = () => { keys.clear(); applyInput(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}

function Game() {
  useGameInput();
  useEffect(() => startGamepad(), []);
  return (
    <div
      style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#181220" }}
      onPointerDown={(e) => {
        // click-to-punch only lands on the 3D canvas itself, not HUD buttons
        if ((e.target as HTMLElement).tagName === "CANVAS") sim.punch();
      }}
    >
      <Scene />
      <HUD />
      <Screens />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Game />} />
    </Routes>
  );
}
