# Movement feel research — why running/jumping/attacks read as janky

Working notes from a research pass on `index.html`'s player movement, camera, combat timing, and
gait animation, prompted by: "the running felt janky, the jump felt janky, the attacks are getting
there but still janky." No code changes yet — this is diagnosis only.

## Which build this is about

Jump only exists in Short Order (`public/short-order/index.html`, served at `/brawl/`) — no other
build in this repo (`/3d/`, `/vince/`, `/kitchen/`) has a vertical jump, only a dash. An earlier
patch to `culinary-dash-3d/src/sim/movement.js` (adding accel/decel easing) does **not** reach this
file — it's a separate, unrelated movement system. This research is scoped entirely to
`public/short-order/index.html`.

## Confirmed findings, roughly in order of how directly they explain the symptom

### 1. No render interpolation over a variable timestep
`tick()` (`index.html:3527-3530`):
```js
let dt = Math.min(0.05, now-last);
```
Whatever `dt` a frame actually took (however uneven) is fed straight into physics/pose and drawn
immediately — no fixed-step-plus-interpolation layer, unlike `culinary-dash-3d/src/engine/loop.js`
in this same repo, which already does this correctly. Most visible on the jump arc (`P.vy -= g*dt;
P.pos.y += P.vy*dt`, plain per-frame Euler with nothing smoothing over an uneven frame) and during
attacks, which stack the heaviest per-frame VFX cost (chromatic aberration, hitstop, impact frames,
shake) — exactly the moments most likely to spike real frame time.

### 2. Zero input buffering on attacks
```js
const canStart = !P.attack;
if(canStart){ ... startAttack(...) ... }
```
(`index.html:2143`) A light/heavy press while `P.attack` is active is dropped, not queued — by
explicit design ("UNCANCELLABLE: a swing is a full commitment"). Combined with `if(P.attack)
spd*=0.14` (near-total rooting mid-swing), mashing near the end of recovery does nothing until the
exact frame it clears. This is the textbook input-buffering gap: a press slightly early should
still register on the correct frame; here it just vanishes.

### 3. Camera position can hard-snap on a frame-time spike
```js
CAM.pos.lerp(want, Math.min(1, dt*(7+3*k)));
```
(`index.html:3634`) — the common but imprecise shorthand for exponential smoothing. At a large
enough `dt` (a real hitch), `dt*(7+3k) >= 1` and the camera **snaps instantly** to target instead of
easing, rather than using the correct `1-exp(-l*dt)` (`damp()`) already used everywhere else in this
file. Hit frames are the likeliest moment for both a frame-time spike and this snap to coincide.

### 4. The run/sprint pose blend saturates well under top speed
```js
const rk = clamp((spd-2.3)/3.4, 0, 1);   // hits 1.0 at spd=5.7
a._runK = rk*rk*(3-2*rk);
```
Base run speed is `spd=6.7`, so `_runK` — and everything downstream of it (`stepLen` caps at
`spd≈5.9`, arm-swing radius caps at `spd=5`, swing *angle* is a flat constant) — maxes out at ~85%
of top speed and never increases further, including through faster movement like grab-rush (7.2),
tackle (13), or dodge (15). One "run" gait shape gets reused for jogging-pace and sprinting alike;
nothing lengthens stride, deepens lean, or speeds the arm pump beyond that early cap.

### 5. Missing hip *roll* (frontal-plane weight-transfer drop)
Classic animation/biomechanics gait has three hip motions: rotation (yaw), tilt/roll (drop on the
swing side, rise on the stance side as weight transfers), and rise-and-fall (vertical). Grepped
every `u.hips` read/write in the file:
- Rotation: **present** (`u.hips.rotation.y = damp(..., -AN.twist*0.35, 12, dt)`)
- Roll/drop: **absent** — zero writes to `u.hips.rotation.x/z` anywhere
- Rise/fall: **partial** — exists only as a whole-body `bob`/`_stepDip`, not isolated to the hip joint

The motion that most directly reads as "weight transferring between legs" is simply not modeled at
the hip.

### 6. Hip rotation and foot placement are fully decoupled
`updateFeet`'s foot target:
```js
function toGround(a,lx,lz,out){ const c=Math.cos(a.facing), s=Math.sin(a.facing); ... }
toGround(a, st.x, st.z, _ideal);              // st = fixed STANCE[i] constant
if(spd>0.3){ _ideal.x += vx/vm*lead; _ideal.z += vz/vm*lead; }
```
Only reads `a.facing` (root yaw) — never `u.hips.rotation.y`. Biomechanically, pelvic rotation is
part of what extends stride (the hip socket swings forward with the pelvis, giving the leg reach it
didn't have to generate on its own — Whitcome et al. 2017 and others). Here, the hip visibly
rotates but that rotation has zero effect on where the foot IK actually reaches for. The velocity-led
`lead` term is the right idea (matches the inverted-pendulum/COM-predicted foot-placement model used
in animation and robotics locomotion controllers) — but it's missing the rotational contribution
entirely, so the hip's rotation is pure decoration.

### 7. Root cause underneath all of the above: no center of mass
Grepped for `centerOfMass`/`COM`/`comX` etc. — "COM" appears three times, only in comments about the
attack lunge, never as an actual tracked value. `P.pos` is a flat ground-plane point (feet-level).
Every system that should derive from a real center of mass instead independently approximates it:

| System | What it actually reads |
|---|---|
| Body lean (`b.rotation.x/z`) | a hand-rolled `af`/`al` acceleration estimate |
| Hip twist (`u.hips.rotation.y`) | gait phase (`AN.twist`), not anything physical |
| Vertical bob | a sum of sine terms + step-timed dip |
| Foot placement (`_ideal`) | `a.facing` + velocity lead — never the hip rotation above |
| Camera (`CAM.pos`) | `P.pos` directly — no body-weight concept |

No single mass point ties these together, so nothing forces them to agree with each other — which is
why the hip can rotate one way while the feet plant as if it hadn't, and why running/jumping/attacks
each have their own independent-but-related "off" quality rather than one obviously broken system.

## Sources (gait biomechanics / animation research)
- [Physio-pedia — Running Biomechanics](https://www.physio-pedia.com/Running_Biomechanics)
- [MoCap Online — Locomotion Animations: Walk, Run, Blend Trees](https://mocaponline.com/blogs/mocap-news/locomotion-animations-game-dev)
- [Frontiers — Kinematics of Maximal Speed Sprinting](https://www.frontiersin.org/articles/10.3389/fspor.2019.00037)
- [PMC — Kinematics of Maximal Speed Sprinting](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7739839/)
- [PMC — Biomechanical Parameters at Different Running Speeds](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9687194/)
- [Whitcome et al. 2017 — Pelvic Rotation Effect on Human Stride Length](https://anatomypubs.onlinelibrary.wiley.com/doi/10.1002/ar.23551)
- Classic animation "three hip movements" (rotation / tilt / rise-and-fall) — convergent across
  animator-education sources
- Inverted-pendulum / COM-driven foot placement — standard model across biped-controller and game
  locomotion research (SIGGRAPH "Generalized Biped Walking Control," "One Step at a Time: Animating
  Virtual Characters Based on Foot Placement")

## Further research: what a real fix looks like

### The formal precedent: SLIP (Spring-Loaded Inverted Pendulum)
The standard low-order model for running gait in both biomechanics and robotics/game-locomotion
research is SLIP: a **point-mass center of mass** plus a **massless spring leg** modeling ground
compliance during stance. It's the model literally built to capture "where the body's weight is and
how it bounces off the stance leg" — the exact concept missing from `index.html`. The bipedal
extension (double-SLIP/DSLIP) handles alternating legs. This isn't a suggestion to implement a full
physical SLIP simulation (overkill for a beat-'em-up) — it's confirmation that "track one mass point
and derive everything else from it" isn't a stylistic choice, it's how every serious model of running
gait is structured, game or biological.

### How a lightweight version would actually wire in here
The file already has the right *primitive* for this — `damp()`, frame-rate-correct exponential
smoothing — just not a mass point for it to smooth toward. A minimal version, not a rewrite:
- Track one `com` (or reuse a lagging copy of `P.pos`) that trails the actual root position with
  its own `damp()`, representing "where the body's weight actually is" vs. where the feet/input have
  already moved to.
- Derive lean (`b.rotation.x/z`) from `P.pos - com` instead of the current hand-rolled `af`/`al`
  acceleration estimate — same idea, one real source instead of a parallel approximation.
- Derive hip roll from *which foot is in stance* relative to `com`: when the stance leg is under/near
  `com`, that hip rises; the swing-side hip drops. This is the missing motion from finding #5, and a
  COM makes it a two-line addition instead of a new, independently-tuned wobble.
- Feed `com`'s lateral offset from `a.facing` forward into `_ideal` in `updateFeet` (alongside the
  existing velocity `lead`), so the hip's actual rotational displacement contributes to foot reach —
  closing the exact gap in finding #6.
- Camera (`CAM.pos`) could trail `com` instead of `P.pos` directly, so a hit's weight (which already
  displaces `com` more than a light tap would) reads in the camera too, not just in FX values layered
  on separately.

### Practical foot-IK precedent (hip-from-feet, the inverse direction)
Standard practice in IK-driven controllers (Unity/Opsive/ootii-style rigs) computes the hip's
*vertical* offset by averaging both feet's height deviation from their animated/expected position,
then applying a fraction (commonly 0.5–0.8, not the full amount — so feet can still individually
adapt) to the hip/root transform. That's the same "hip derives from a shared source, not each system
independently guessing" principle, applied to uneven-ground standing rather than running speed — a
useful cross-check that the fix direction here (systems reading from one shared point) is standard,
not novel.

Sources for this section:
[SLIP model overview (Springer)](https://link.springer.com/rwe/10.1007/978-94-007-7194-9_43-1),
[SLIP + wobbling mass stability (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0021929021003080),
[DSLIP bipedal extension / musculoskeletal robot (Frontiers)](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2024.1296706/full),
[SLIP two-cycle stance-phase dynamics (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6602329/).

## Not yet fixed
Nothing in this file has been changed. This is a diagnosis document; implementation is a separate
step.
