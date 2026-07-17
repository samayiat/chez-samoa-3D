// ============================================================================
// Procedural Web-Audio SFX (same philosophy as the original: no audio files)
// ============================================================================

let actx: AudioContext | null = null;
let muted = false;
let musicNodes: { stop: () => void } | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!actx) {
    try { actx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { return null; }
  }
  if (actx.state === "suspended") actx.resume();
  return actx;
}

export function setMuted(m: boolean) { muted = m; if (m) stopMusic(); }
export function isMuted() { return muted; }

export function beep(freq: number, dur = 0.08, type: OscillatorType = "square", vol = 0.12, slide = 0) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + dur + 0.02);
}

export function noise(dur = 0.12, vol = 0.15, freq = 1200) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start();
}

export type SfxName =
  | "bell" | "order" | "serve" | "perfect" | "cash" | "error" | "burn" | "done"
  | "pickup" | "setdown" | "trash" | "shoo" | "cheer" | "punch" | "hit" | "hurt"
  | "ko" | "whiff" | "drink" | "smash" | "bottle" | "live" | "walkout" | "click";

export function sfx(name: SfxName) {
  if (muted) return;
  switch (name) {
    case "bell":    beep(880, 0.12, "sine", 0.15); setTimeout(() => beep(1174, 0.18, "sine", 0.13), 90); break;
    case "order":   beep(660, 0.06, "square", 0.10); setTimeout(() => beep(880, 0.08, "square", 0.10), 70); break;
    case "serve":   beep(520, 0.07, "triangle", 0.14); setTimeout(() => beep(780, 0.1, "triangle", 0.12), 60); break;
    case "perfect": [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12, "sine", 0.13), i * 70)); break;
    case "cash":    beep(1320, 0.05, "square", 0.08); setTimeout(() => beep(1760, 0.12, "square", 0.09), 50); break;
    case "error":   beep(220, 0.18, "sawtooth", 0.12, -80); break;
    case "burn":    beep(340, 0.1, "sawtooth", 0.12); setTimeout(() => beep(300, 0.14, "sawtooth", 0.12), 110); break;
    case "done":    beep(990, 0.09, "sine", 0.12); setTimeout(() => beep(1320, 0.1, "sine", 0.1), 80); break;
    case "pickup":  beep(500, 0.05, "square", 0.09); break;
    case "setdown": beep(430, 0.05, "square", 0.09); break;
    case "trash":   noise(0.15, 0.12, 500); beep(180, 0.1, "square", 0.08); break;
    case "shoo":    beep(700, 0.06, "square", 0.12); setTimeout(() => beep(500, 0.08, "square", 0.12), 80); setTimeout(() => beep(900, 0.12, "square", 0.12), 160); break;
    case "cheer":   noise(0.5, 0.10, 900); [660, 880, 990].forEach((f, i) => setTimeout(() => beep(f, 0.1, "triangle", 0.06), i * 60)); break;
    case "punch":   noise(0.08, 0.22, 700); beep(140, 0.08, "square", 0.18, -60); break;
    case "hit":     noise(0.1, 0.25, 400); beep(100, 0.12, "square", 0.2, -40); break;
    case "hurt":    beep(200, 0.15, "sawtooth", 0.16, -100); break;
    case "ko":      beep(160, 0.3, "square", 0.2, -120); noise(0.25, 0.2, 300); break;
    case "whiff":   noise(0.06, 0.08, 2400); break;
    case "drink":   beep(300, 0.1, "sine", 0.12, 200); setTimeout(() => beep(400, 0.1, "sine", 0.1, 200), 150); break;
    case "smash":   noise(0.3, 0.3, 800); beep(90, 0.25, "square", 0.22, -40); break;
    case "bottle":  beep(1180, 0.08, "sine", 0.12); setTimeout(() => beep(1560, 0.14, "sine", 0.1), 70); break;
    case "live":    [440, 554, 659, 880].forEach((f, i) => setTimeout(() => beep(f, 0.15, "sawtooth", 0.12), i * 90)); break;
    case "walkout": beep(300, 0.12, "sawtooth", 0.12, -60); setTimeout(() => beep(220, 0.2, "sawtooth", 0.1, -60), 120); break;
    case "click":   beep(600, 0.04, "square", 0.07); break;
  }
}

// ---------------------- tiny after-hours club loop -------------------------
export function startClubMusic() {
  if (muted) return;
  const c = ac(); if (!c || musicNodes) return;
  let step = 0;
  const bass = [55, 55, 65.4, 49];
  const timer = setInterval(() => {
    if (muted) return;
    const t = step % 8;
    // kick on quarters
    if (t % 2 === 0) { beep(120, 0.1, "sine", 0.22, -70); }
    // hats on offbeats
    noise(0.03, t % 2 ? 0.05 : 0.02, 6000);
    // bass line
    if (t % 2 === 0) beep(bass[(step >> 3) % 4] * (t === 6 ? 1.5 : 1), 0.18, "sawtooth", 0.05);
    // sparkle arp
    if (t === 3 || t === 7) beep(440 * [1, 1.25, 1.5, 2][step % 4], 0.09, "triangle", 0.035);
    step++;
  }, 240);
  musicNodes = { stop: () => clearInterval(timer) };
}
export function stopMusic() {
  if (musicNodes) { musicNodes.stop(); musicNodes = null; }
}
