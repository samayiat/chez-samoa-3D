# Culinary Dash — Combat Port & Co-op Architecture Plan

## Context

This session started as "look at the `chez-samoa1` repo" and turned into discovering that it holds
the *real* origin of everything built today: `culinary-dash` (a mature, single-file 2D canvas
restaurant-brawler, built as a personal gift, 623+ tests) and `culinary-dash-3d` (a from-scratch
Three.js reimagining of it — real kitchen layout, a 3-boss roster, proper `sim/`+`render`/`engine`
module split, Vitest + Playwright coverage, and a CI pipeline that already ships multiple preview
builds).

Meanwhile, *this* repo independently built **Short Order** (`public/short-order/`), a single-file
Three.js beat-em-up with a materially better combat feel than either — full IK rig, weight-driven
"juice"/impact spine, ragdoll, weapon feel — but no restaurant, no boss, no drink mechanic, and no
persistence layer beyond one file.

The direction that came out of brainstorming: `culinary-dash-3d` is the chassis (day service →
night brawl → bottle service → occasional riot). Short Order's combat becomes *its* combat system,
replacing `culinary-dash-3d`'s current simpler combat. The 2D original's drink/"wasted" mechanic
gets ported in alongside. Bottle service and the riot system are explicitly deferred to later.
The eventual goal is real networked co-op (two separate devices) for a small friend group (~10-15
people, 2-3 concurrent game sessions), reusable across whichever games this group plays together —
which reframes several architecture decisions below from "nice to have" to "must build this way
from the start," even though the actual networking is a later phase.

This document is a planning/reference doc, not itself an implementation — it exists so the shape of
this multi-phase effort is written down somewhere durable before work starts, in the spirit of
`chez-samoa1`'s own docs-driven house style (`ROADMAP.md`/`DECISIONS.md`/`SYSTEMS.md`).

## The two tracks

These are independent and can proceed in either order or in parallel — Track B needs nothing from
Track A to exist, and single-player work on Track A doesn't need Track B until real networking is
wired in.

### Track A — Combat port into `culinary-dash-3d`

**Goal:** `culinary-dash-3d` keeps its restaurant layout, service loop, and boss roster, but its
combat/rig/camera/juice is replaced by Short Order's (materially better feel), and the drink/wasted
mechanic is ported in from the 2D original. Built deterministic and multi-chef-shaped from the
start, since co-op is the eventual goal — even though no networking is being built in this pass.

**Reference material (all currently only accessible via an uploaded `chez-samoa1` zip — real repo
access was denied once already this session and should be retried before real work starts):**
- `culinary-dash-3d/src/preview/kitchen-room.js` — the restaurant layout (stations, tables, doors,
  windows, the tropical outside-world backdrop). Built at `sim/data.js`'s real station/table
  positions via `rpos()` — reusable close to as-is.
- `culinary-dash-3d/src/preview/boss.js` + `main-vince.js` — the boss roster (Vince the landlord,
  the Health Inspector, Chef Bruno), a clean `createBoss(scene, bossId)` factory with HP-phase-gated
  attack rotations (`telegraph → strike → recover`). Currently deals damage through its own
  `resolveStrike`/`onGroundStrike` in `main-vince.js` — needs rewiring to go through the ported
  combat's single damage door instead.
- `culinary-dash/culinary-dash_src.html` (the 2D original, NOT the built file with embedded art —
  see its own docs warning about never reading the built file's art blobs) — the drink mechanic:
  `chefDrink()`, `wastedAmt()`, `drinkDmgMult/drinkSpeedMult/drinkDrift`, the hold-to-chug chain,
  the 3-drinks-permanent / 5-drinks-WASTED ladder. This is the mechanic to port; the bottle-service
  night-mode code in the same file (`startNight`/`spawnGroup`/`startRiot`) is explicitly deferred.
- `public/short-order/index.html` (this repo) — the combat to extract: `COMBAT`
  (`startAttack`/`resolveHit`), `WEAPONS` table, `POSE`/IK, Verlet ragdoll, `FX`/juice/impact spine,
  `CAMERA` lock-on. `CLAUDE.md` in the same folder documents its hard invariants (length-locked
  bones, one damage door, one `weight` driving all feedback) — these should survive the port, not
  get relitigated.

**Key structural changes required:**
1. Split Short Order's combat out of its single-file sim+render tangle into `culinary-dash-3d`'s
   existing `sim/` (pure state/logic, no THREE.js) vs `render/` (meshes reflecting sim state)
   layers — mirrors what `culinary-dash-3d` already does and what Short Order's own `harness.js`
   was awkwardly working around (it fakes an entire THREE.js just to test combat math headlessly).
2. Make it deterministic: route all gameplay-affecting randomness through `culinary-dash-3d`'s
   existing seeded RNG (`src/sim/rng.js`) instead of Short Order's raw `Math.random()`
   (e.g. `pick()`), and make sure ported timing logic uses the sim's own fixed-step tick, not
   `performance.now()`. Preserves the existing "two sims, same seed, byte-identical for 2400
   frames" determinism test — this is load-bearing for co-op, not just a test nicety.
3. Genericize the single global `player`/camera/input into N independently-controlled chef entities
   (concretely 2, for two devices) — each device only ever renders/controls its own camera locally;
   only sim state needs to be shared/synced later.
4. Rewire boss damage through the ported single damage door so mobs and bosses share one hit-
   resolution path.
5. Port the drink ladder into the new sim layer as new pure functions in the same house style as
   `culinary-dash-3d`'s existing `sim/combat.js`/`sim/movement.js` (see `HANDOFF_CLAUDE_CODE.md`'s
   rules: extract pure decision functions, mutation-test every new invariant).

**Explicitly out of scope for this track (for now):** bottle service, the riot system, any actual
network transport.

### Track B — standalone relay + matchmaking service

**Goal:** a small, fully game-agnostic multiplayer service any of this friend group's games can be a
client of. Own repo, own deploy. Sized for ~10-15 people, 2-3 concurrent rooms.

**Model:** dumb relay, not an authoritative server. Each device runs the full deterministic sim
locally (this is exactly why Track A's determinism work matters); the service only forwards each
player's per-tick input packets to the other player(s) in their room. It never simulates, never
holds authoritative game state, and therefore never validates anything — an accepted tradeoff for a
trusted-friends context (explicitly confirmed: local, unvalidated saves are fine, "if they cheat
then so be it").

**Matchmaking:** shareable room code/link, no accounts, no persistent identity. Whoever starts a
session gets a code; sending it to friends (however they already coordinate) is the entire
"matchmaking" flow.

**Hosting shape (not yet decided, flag for a follow-up decision):** needs something that keeps a
persistent connection alive — not compatible with static hosting or spin-down serverless. Leading
candidates from the brainstorm: Cloudflare Durable Objects (one instance per room, holds exactly the
sockets in that room, spins down when empty — a strong fit for this exact pattern), or a small
always-on process on Fly.io/Railway/Render. Both are viable; pick when this track actually starts.

**Persistence:** none, by design. Game progress/saves live client-side only (`localStorage`/
IndexedDB per device), never touch the relay.

## Immediate next steps (before either track's real work starts)

1. **Get real git access to `chez-samoa1`.** Everything referenced above was read out of an
   uploaded zip in scratch space, not a live clone — `add_repo` was denied once already this
   session. Re-attempt (or ask the user to approve it) before doing real Track A work, since editing
   off a stale scratch copy risks working from outdated source.
2. Decide where Track A's work actually lives — presumably a proper clone/fork of `culinary-dash-3d`
   once access exists, not `chez-samoa-3D` (this repo is the React/R3F "Chez Samoa" spinoff, a
   different and less-developed codebase than `culinary-dash-3d`).
3. Track B can start independently at any point — it needs no game code, just a design pass on the
   room/message protocol and a hosting decision.

## Verification

- Track A: `culinary-dash-3d` already has real test infrastructure to build on — `npm test` (20
  Vitest sim tests: service/combat/determinism) and `npm run e2e` (3 Playwright WebGL checks). Any
  ported combat code should get equivalent sim-level tests in the same style, plus the existing
  determinism test must keep passing unmodified (same-seed lockstep-identical over 2400 frames) —
  that test is the concrete signal that the port didn't introduce non-determinism.
- Short Order's own `harness.js` scenarios (soak + weapon lifecycle) are a useful reference for what
  invariants matter (no exceptions, no NaN, IK finiteness, camera-in-arena, token bounds) — worth
  porting the intent of these checks into the new Vitest suite rather than carrying the harness's
  THREE.js-faking approach forward, since the sim/render split removes the need for it.
- Track B: no game-specific verification needed yet — once built, verify with two real browser
  clients (two devices or two browser profiles) completing a full room-join → synced-session →
  disconnect cycle.
