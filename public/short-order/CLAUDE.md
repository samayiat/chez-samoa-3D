# SHORT ORDER — working notes

A single-file 3D kitchen beat-em-up. You're a chef; after hours, the patrons come
back and want a word. Three.js r128, no build step, no dependencies beyond a CDN
script tag.

**`index.html` is the source of truth.** Everything — markup, CSS, and ~1,800
lines of game code — lives in it. `game.js` is a throwaway extraction the test
harness regenerates; never edit it.

---

## Run it

Open `index.html` in a browser. That's it. (It needs network access for the
three.js CDN tag.)

Target device is a retro handheld: controller-primary, touchscreen secondary,
forced landscape.

## Test it

```bash
node harness.js                    # 3000-frame soak: exceptions + NaN
SCENARIO=weapon node harness.js    # weapon pickup / durability / break path
node --check game.js               # syntax (harness writes game.js as a side effect)
```

`harness.js` is a **headless simulator**, not a renderer: it stubs THREE, the
DOM, WebAudio and gamepads with real vector math, then drives actual game frames.
It catches crashes, NaN propagation, stuck states and IK blowups. It cannot tell
you whether anything *looks* right.

Both scenarios must print `PASS` before shipping. Assertions live at the bottom
of `harness.js` (position finiteness, IK finiteness, camera-in-arena, attack-token
bounds). The soak force-kills an enemy every 350 frames so the ragdoll path is
always exercised.

### Ad-hoc probes

For anything the standard scenarios don't cover, slice the harness and drive the
game directly. This pattern is how most bugs here got diagnosed:

```bash
node --input-type=commonjs -e '
const fs=require("fs");let code=fs.readFileSync("harness.js","utf8");
code=code.slice(0, code.indexOf("/* ---------- run ---------- */"));
code+=`const TT=globalThis.__t; const P=TT.player;
function run(n){ for(let i=0;i<n;i++){ NOWMS+=16; TT.tick(); } }
TT.startNight(TT.SLICE,()=>{}); run(20);
const e=TT.spawnEnemy("tough");
run(60);
console.log("enemy state:", e.state, "dist:", Math.hypot(e.pos.x-P.pos.x, e.pos.z-P.pos.z).toFixed(2));
`;
(0,eval)(code);'
```

`globalThis.__t` exposes: `player, enemies, GAME, FX, tokensUsed, PICKUPS,
nearPickup, ROT, STAGE, CAM, layout, clientToStage, tryPickup, spawnEnemy,
startNight, tick, killChef, updateEnemy, buildRagdoll, equipEnemy, WEAPONS, SLICE`.

**Timers don't fire in the sync harness.** `setTimeout` callbacks never run, so
wave spawns won't happen on their own — call `__t.spawnEnemy(kind)` yourself. To
test timer-dependent flow (like the win condition), stub `globalThis.setTimeout`
to either fire immediately or queue against a manual clock.

**Simulating key presses:** input is edge-detected, so a press and release in the
same frame is invisible. Press, tick, then release.

---

## Layout of `index.html`

Sections are marked with `/* ===== NAME */` banners:

| Section | What's there |
|---|---|
| ARENA | floor, walls, props, lighting |
| WEAPONS | the `WEAPONS` table — **`heft` drives all game feel** |
| CHEFS | `makeChef()` rig builder, `equip()`, squish/dent shader |
| FX | particles, rings, `shake()`, `hitstop()`, post-processing stack |
| AUDIO | procedural sfx, pink-noise kitchen room tone, `haptic()` |
| INPUT | keyboard, mouse, gamepad (radial deadzone) |
| FORCED-LANDSCAPE STAGE | CSS-rotation trick + touch controls |
| CAMERA | follow rig, trauma shake, over-the-shoulder lock-on |
| COMBAT | `startAttack()`, `resolveHit()`, swing/punch shape tables |
| PLAYER | input handling, movement, dash, tackle |
| ENEMY AI | strafe / press / recover state machine, fetch, grab |
| POSE | `poseChef()`, IK solvers, footwork, run/idle blends |
| Verlet ragdoll | death physics |
| WAVES / NIGHT | spawning and the `startNight()` seam |
| LOOP | the frame |

---

## Invariants — don't undo these

Each of these was a real bug that cost real time. They're all commented in place.

1. **Bones are length-locked** (`orientFixed`). Never "fix" limb stretching by
   clamping the IK target — that's fragile and it regressed twice. A bone is
   drawn at exactly its own length, always. Over-reach leaves the foot short,
   which is invisible in play.

2. **One `weight` value drives all hit feedback.** Shake, hitstop, rumble,
   impact-frames, particles and sound all scale off the weapon's `heft`
   (fists 0.12 → cast iron 1.0). Keep them coupled or heavy weapons stop feeling
   heavy. See the JUICE block in `resolveHit`.

3. **Damage has exactly one door**, the impact frame inside `resolveHit()`.
   Nothing deals damage without a live swing.

4. **Two time bases.** `dt` is real time (FX, shake, post decay, hitstop
   countdown); `sdt` is sim time (zero during hitstop). Don't mix them.

5. **Impact frames are counted in RENDERED frames**, not seconds, so they survive
   hitstop and slow-mo like a hand-drawn frame would.

6. **No `vw`/`vh` units inside the rotated stage.** When the stage is CSS-rotated
   to landscape those units still measure the real (portrait) screen. Use `%` or
   the `--u` custom unit.

7. **Win check runs every frame** in the loop, not at kill time, and wave spawning
   tracks `WAVE.pending` so timers can't over-spawn past the queue. Both halves
   of the "round never ends" bug.

8. **Staggered enemies reset to `engage`.** A hit used to clear the attack but
   leave `state='attacking'`, which has no exit — enemies froze permanently after
   one hit.

9. **Ragdoll rest pose is captured at build time** and restored by
   `resetRagPose()`. The ragdoll writes torso/head/hips transforms directly, so
   without this you stand back up crumpled.

10. **Enemies are customers, not chefs.** Hair, street clothes, no toque.

---

## Current state

Works: movement + full-body run, weapon and bare-hand combo cycles with
recovery-cancel chaining, weight-scaled juice, postprocessing (aberration, zoom
punch, flash, shockwave, glitch, vignette, 2-tone impact frames), head squish,
Verlet ragdoll deaths, enemy AI that strafes/presses/fetches utensils/grabs you,
mash-to-escape grapples, player tackle-charge, pickups + durability, **numbered
waves** (`cfg.waveSizes`, e.g. `[3,4,5,6,7]` — a wave only starts once the
previous one is fully spawned and cleared, with a rest + `WAVE n / total`
toast + HUD readout between each), the `startNight()` seam, procedural audio +
room tone, haptics, touch controls, over-the-shoulder lock-on.

### Known gaps

- **No PWA layer.** A manifest + service worker would give true offline play and
  an OS-level landscape lock (currently a CSS-rotation fallback). Deliberately
  skipped because it breaks the single-file property — needs separate files
  served over http.
- **Weapon meshes are crude.** Readable silhouettes, no art pass.
- **No daytime cooking-sim loop.** The long-term design is a restaurant day that
  feeds into the night fight. `startNight(cfg, onEnd)` is the seam: it takes a
  config (larder contents, wave list, starting weapon) and reports
  `{survived, kills, maxCombo, wpn}`. Build that layer separately and wire it here.
- **No parry/counter.** Guard exists; a timed-parry window would add depth.
- **Verlet ragdoll has a fallback** to a spring-topple if a build goes non-finite.
  If deaths ever look stiff, that fallback is firing.

### Godot port (parked)

`godot-port/` holds a validated Godot 4 scaffold — a vertical slice with the rig,
IK, juice system, AI and camera ported to GDScript. All files pass `gdparse` and
are `gdlint`-clean but have **never been run in Godot**. Parked in favour of
continuing here; pick it up if the HTML build hits a wall.

---

## Tuning dials

Visual/feel values that most often need nudging, since they can only be judged by
eye:

| What | Where |
|---|---|
| Wave count / pacing | `waveSizes` in `SLICE`; rest length `2200`ms in `startNextWave` |
| Weapon feel | `heft` in the `WEAPONS` table |
| Shake amount | `weight*1.4` in `resolveHit`; camera multipliers in `updateCamera` |
| Hitstop length | `weight*0.17` in `resolveHit` |
| Rumble | `weight*280` ms in `resolveHit` |
| Dent depth | `SQUISH.headMax` |
| Ragdoll | `RAG` (gravity, damp, iters, friction) |
| Gait | `stepLen`, `lead`, `stepDur` in `updateFeet` |
| Run blend | `(spd-2.3)/3.4` in `poseChef` |
| Enemy aggression | `commit`, `standoff`, `ATTACK_TOKENS`, strafe scale `0.42` |
| Lock-on framing | shoulder offset `0.95`, zoom `0.34`, FOV `-7` in `updateCamera` |
| Grab difficulty | `need` (5 weak / 8 tough), slam timer `max` 2.6s |

---

## Working style

- Small, verified changes. Run both harness scenarios before declaring anything done.
- Prefer robust fixes to patches — the length-lock over target-clamping is the
  canonical example.
- Nobody can see the render from the terminal. State plainly what was verified
  mechanically versus what still needs eyes on it, and don't claim a visual result
  you can't check.
- Reference build: the project began as a study of a boxing game called Glass Jaw.
  Its lasting contributions here are the impact-frame postprocessing, the squish
  shader, the Verlet ragdoll with a fixed-timestep accumulator, pink-noise room
  tone, and the "archetypes as data blocks over one AI" pattern.
