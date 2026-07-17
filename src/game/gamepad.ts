// ============================================================================
// Gamepad support (Xbox / standard mapping).
//
// Polls the Gamepad API every animation frame and drives the same sim actions
// the keyboard does. Movement is only written to sim.input while the pad is
// actively pushed (and zeroed once on release), so it never fights the keyboard
// when the stick is centered.
// ============================================================================
import { sim } from "./sim";
import { isMuted, setMuted } from "./audio";

// Standard-gamepad button indices (W3C mapping — what Chrome reports for Xbox pads)
const BTN = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  BACK: 8, START: 9,
  L3: 10, R3: 11,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
};

const DEADZONE = 0.28; // left-stick radial deadzone
const PUNCH_BUTTONS = [BTN.X, BTN.RB, BTN.RT]; // brawler feels better with a few

function applyDeadzone(x: number, y: number): [number, number] {
  const mag = Math.hypot(x, y);
  if (mag < DEADZONE) return [0, 0];
  // Rescale so motion ramps from 0 at the deadzone edge (avoids a jump to full).
  const scaled = (mag - DEADZONE) / (1 - DEADZONE);
  const k = Math.min(1, scaled) / mag;
  return [x * k, y * k];
}

export function startGamepad(): () => void {
  let raf = 0;
  let prevButtons: boolean[] = [];
  let prevMoving = false;

  const pressedThisFrame = (gp: Gamepad, i: number) => {
    const now = !!gp.buttons[i]?.pressed;
    const was = prevButtons[i] ?? false;
    return now && !was;
  };

  const poll = () => {
    // getGamepads() must be re-read each frame — the snapshot is not live.
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads).find((p): p is Gamepad => !!p && p.connected);

    if (gp) {
      // ---- Movement: left stick, with D-pad as a digital fallback ----
      let [mx, mz] = applyDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
      if (gp.buttons[BTN.DPAD_LEFT]?.pressed) mx = -1;
      if (gp.buttons[BTN.DPAD_RIGHT]?.pressed) mx = 1;
      if (gp.buttons[BTN.DPAD_UP]?.pressed) mz = -1;
      if (gp.buttons[BTN.DPAD_DOWN]?.pressed) mz = 1;

      const moving = mx !== 0 || mz !== 0;
      if (moving) {
        // Stick up (axes[1] negative) → forward (−z), matching the keyboard.
        sim.input.x = mx;
        sim.input.z = mz;
      } else if (prevMoving) {
        sim.input.x = 0;
        sim.input.z = 0;
      }
      prevMoving = moving;

      // ---- Buttons (edge-triggered), routed by phase ----
      const phase = sim.phase;
      if (phase === "title") {
        if (pressedThisFrame(gp, BTN.A)) sim.startRun();
      } else if (phase === "results") {
        if (pressedThisFrame(gp, BTN.A)) sim.startRun();
        if (pressedThisFrame(gp, BTN.B)) sim.toTitle();
      } else {
        // in-game: day / brawl / night
        if (pressedThisFrame(gp, BTN.A)) sim.interact();
        if (PUNCH_BUTTONS.some((b) => pressedThisFrame(gp, b))) sim.punch();
        if (pressedThisFrame(gp, BTN.START)) sim.paused = !sim.paused;
        if (pressedThisFrame(gp, BTN.BACK)) setMuted(!isMuted());
      }

      prevButtons = gp.buttons.map((b) => b.pressed);
    } else if (prevButtons.length) {
      // Pad disconnected — release any movement it owned.
      if (prevMoving) { sim.input.x = 0; sim.input.z = 0; prevMoving = false; }
      prevButtons = [];
    }

    raf = requestAnimationFrame(poll);
  };

  raf = requestAnimationFrame(poll);
  return () => cancelAnimationFrame(raf);
}
