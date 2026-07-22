# Culinary Dash — Combat Port & Co-op Architecture Plan

## Context

This started as "look at the `chez-samoa1` repo" and turned into discovering that it holds the
*real* origin of everything built today: `culinary-dash` (a mature, single-file 2D canvas
restaurant-brawler, built as a personal gift, 623+ tests) and `culinary-dash-3d` (a from-scratch
Three.js reimagining of it — real kitchen layout, a 3-boss roster, proper `sim/`+`render`/`engine`
module split, Vitest + Playwright coverage, and a CI pipeline that already ships multiple preview
builds). Both now live in this repo (`culinary-dash/`, `culinary-dash-3d/`, consolidated here
rather than in a separate repo, per direction).

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
which is why several decisions below are "build it this way from the start" rather than "nice to
have," even though the actual networking is a later phase.

This document is a planning/reference doc. **No implementation has started yet** — the interview
below locked in scope and decisions for when work actually begins.

## Decisions locked in (from the follow-up interview)

- **Sequencing:** Track A (combat port) goes first. Track B (relay/matchmaking) doesn't depend on
  it and can start independently whenever.
- **Boss scope:** Vince only, first. He's the one with a dedicated preview build and screenshots
  already, suggesting he's the most battle-tested of the three. The Inspector and Bruno stay on the
  roster architecture for later, not part of the initial port.
- **The pre-existing `PASS` build bug** (below) gets fixed as part of this work, not left parked —
  it'll be in the way once combat-port work starts touching `render/meshes.js` anyway.
- **Relay hosting:** Cloudflare Durable Objects — one object instance per room, holding just that
  room's sockets, spinning down when empty. Fits the small/bursty usage pattern (10-15 friends,
  2-3 rooms) without paying for an always-on box.
- **N-chef shape:** build the sim to support N independently-controlled chef entities *now*, not
  as a deferred follow-up pass. Avoids a second structural rewrite later; the cost is mostly
  "don't assume a singleton `player`," not extra feature work.
- **Drink mechanic tuning:** port the 2D game's exact numbers first (3 drinks = permanent buzz, 5 =
  WASTED with wild-punch chance, healing that decays per drink). They're already playtested;
  retuning for 3D pacing/combat speed happens later, once it's actually playable, not preemptively.
- **Input parity:** keep keyboard + gamepad + touch, matching what Short Order already had. Touch
  matters here specifically because a co-op friend group is likely to include phones.

## The two tracks

### Track A — Combat port into `culinary-dash-3d` (do this first)

**Goal:** `culinary-dash-3d` keeps its restaurant layout, service loop, and boss roster, but its
combat/rig/camera/juice is replaced by Short Order's, and the drink/wasted mechanic is ported in
from the 2D original. Built deterministic and N-chef-shaped from the start.

**Reference material (all now in this repo):**
- `culinary-dash-3d/src/preview/kitchen-room.js` — the restaurant layout (stations, tables, doors,
  windows, the tropical outside-world backdrop). Built at `sim/data.js`'s real station/table
  positions via `rpos()` — reusable close to as-is.
- `culinary-dash-3d/src/preview/boss.js` + `main-vince.js` — the boss roster (Vince the landlord,
  the Health Inspector, Chef Bruno), a clean `createBoss(scene, bossId)` factory with HP-phase-gated
  attack rotations (`telegraph → strike → recover`). Currently deals damage through its own
  `resolveStrike`/`onGroundStrike` in `main-vince.js` — needs rewiring to go through the ported
  combat's single damage door instead. **Only `vince` needs wiring up for the initial port** — the
  other two roster entries can stay as-is architecturally.
- `culinary-dash/culinary-dash_src.html` (the 2D original — NOT `culinary-dash.html`, the built
  file with embedded art blobs; see its own docs warning about never reading those) — the drink
  mechanic: `chefDrink()`, `wastedAmt()`, `drinkDmgMult/drinkSpeedMult/drinkDrift`, the hold-to-chug
  chain, the 3-drinks-permanent / 5-drinks-WASTED ladder. Port these numbers as-is first. The
  bottle-service night-mode code in the same file (`startNight`/`spawnGroup`/`startRiot`) stays
  deferred.
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
3. Build the sim around N independently-controlled chef entities from the start (concretely 2, for
   two devices) — not a global `player` singleton. Each device only ever renders/controls its own
   camera locally; only sim state needs to be shared/synced later.
4. Rewire Vince's damage through the ported single damage door so mobs and the boss share one hit-
   resolution path.
5. Port the drink ladder into the new sim layer as new pure functions in the same house style as
   `culinary-dash-3d`'s existing `sim/combat.js`/`sim/movement.js` (see `HANDOFF_CLAUDE_CODE.md`'s
   rules: extract pure decision functions, mutation-test every new invariant).
6. Keep keyboard + gamepad + touch input parity through the port.

**Explicitly out of scope for this track (for now):** bottle service, the riot system, the
Inspector/Bruno bosses, any actual network transport.

**First concrete step when implementation starts:** fix the pre-existing build bug —
`culinary-dash-3d/src/render/meshes.js` imports a `PASS` constant that `sim/data.js` never exports.
Its own CI never catches this because `pages.yml` only builds the vince/kitchen singlefile targets,
never plain `vite build`. Small, isolated, and it'll be in the way once combat-port work starts
touching that file regardless.

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

**Hosting:** Cloudflare Durable Objects — one instance per room, holding exactly that room's
sockets, spinning down when empty. Decided over a conventional always-on process (Fly.io/Railway/
Render) because it fits the small, bursty usage pattern without paying for constant uptime.

**Persistence:** none, by design. Game progress/saves live client-side only (`localStorage`/
IndexedDB per device), never touch the relay.

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
