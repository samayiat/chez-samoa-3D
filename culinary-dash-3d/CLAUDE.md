# CULINARY DASH 3D — working notes

A 3D browser-game reimagining of `../culinary-dash/` (the 2D canvas original): a restaurant
service loop that erupts into a beat-em-up brawl at night. Three.js, Vite, ES modules, `sim/`+
`render/`+`engine`+`fx` split, Vitest + Playwright coverage. See `README.md` for the existing
architecture/status; this file is about **what's changing** and why, per
`../docs/coop-architecture-plan.md` (the full planning doc — read that first for context on how
this project relates to Short Order and the eventual co-op goal).

**This file describes a plan, not yet-landed code.** No implementation has started as of this
writing — see the planning doc for sequencing. Update this file as pieces actually land.

---

## What's happening here

This project's own combat (`sim/combat.js`, `sim/movement.js`) is being **replaced outright** by a
port of Short Order's combat (`../public/short-order/index.html` — a single-file Three.js beat-em-up
with a materially better combat feel: full IK rig, weight-driven juice/impact spine, ragdoll, weapon
feel). This project keeps its restaurant layout, service loop, and boss roster; only combat itself
changes. The 2D original's drink/"wasted" mechanic gets ported in alongside. Bottle service and the
riot system stay deferred.

The eventual goal is real networked co-op (two separate devices, lockstep-style — inputs synced, not
state), which is why several decisions below are "built this way from day one" rather than deferred
polish.

## Hard invariants (carried over from Short Order, apply here now too)

These cost real time to learn once already — see Short Order's own `CLAUDE.md` for the full
originating context. They hold in this project exactly as they did there:

1. **Bones are length-locked**, never target-clamped, in the ported IK. Clamping the IK *target* is
   fragile; a bone is drawn at exactly its own length, always.
2. **One `weight` value drives all hit feedback** — shake, hitstop, rumble, impact-frames,
   particles, sound. Keep them coupled.
3. **Damage has exactly one door.** Short Order's `resolveHit` becomes the single path *all* damage
   flows through here — mobs, Vince, anything added later. This is a **hard, tested invariant**,
   not a guideline: there should be a test asserting nothing deals damage outside it, and that test
   should be mutation-tested (reintroduce a second damage path, confirm the test catches it).
4. **Two time bases**: `dt` (real time — FX, shake, post decay) vs sim time (zero during hitstop).
   Don't mix them. In this project specifically, sim time also has to stay wall-clock-free for
   determinism (see below) — no `performance.now()` in anything that affects gameplay outcome.
5. **No silent second combat system.** Once the port lands, `sim/combat.js`'s old implementation
   and its 33 existing tests get replaced, not kept running in parallel "just in case."

## New invariants, specific to this port

6. **The chef's visual identity is protected — this is the one hard line in the whole port.** The
   game is built as a gift where the default chef represents a specific real person ("her"). Her
   established hairstyle, body, and proportions in `src/preview/chef.js` stay exactly as they are,
   pixel-for-pixel. **Only her movement/animation/IK/ragdoll switches** to Short Order's rig — keep
   and re-rig the existing mesh-building code onto the new IK targets rather than rebuilding her
   model from scratch. This does not apply to the mob roster, which is being freely redesigned
   around Short Order's own archetypes — the chef is simply not part of that redesign.
7. **Determinism is load-bearing, not a nicety.** `sim/rng.js`'s seeded RNG is the only source of
   gameplay-affecting randomness — anything ported from Short Order that used raw `Math.random()`
   (e.g. its `pick()` helper) must be rerouted through it. The existing "two sims, same seed,
   byte-identical for 2400 frames" determinism test (`test/determinism.test.js`) must keep passing
   unmodified. This is what makes lockstep co-op possible later — a single unseeded random call
   silently breaks it with no visible symptom until two devices' games have quietly diverged.
8. **The sim assumes N chefs, not one.** Build state around independently-controlled chef entities
   (concretely 2, one per device) rather than a global `player` singleton, even though no networking
   exists yet. Camera and input stay per-device/local; only sim state is ever meant to be shared.
9. **Camera splits by context.** The existing fixed-perspective "diorama" camera stays for the day
   service loop; all combat (mob brawl and Vince alike) uses Short Order's free/lock-on camera
   instead.
10. **Numeric balance: Short Order's numbers win.** Chef HP, enemy HP, and weapon damage come over
    as Short Order already tuned them; this project's existing combat-adjacent numbers get adjusted
    to match, not the other way around.
11. **Reputation still scales mob size.** The 2D game's `brawlSizeMult` (worse rating → bigger,
    harder mobs) applies on top of the new wave-escalation numbers (see next point), not replaced.
12. **Wave escalation reuses Short Order's `waveSizes` model** — discrete numbered waves
    (`waveSizes`-chunked, e.g. `[3,4,5,6,7]`), a rest + toast + HUD readout between each, a wave only
    starting once the previous one is fully cleared. Replaces whatever wave logic exists here now.
13. **Weapon durability carries over** — kitchen implements break down with use, same as Short
    Order, forcing a switch back to bare hands. Not made unbreakable for this port.
14. **Vince's `grab` reuses Short Order's mash-to-escape grapple** rather than a bespoke
    implementation — his `BOSS_DEFS` entry already declares `grab: true`; they're the same idea.
15. **Juice carries over at full intensity.** Chromatic aberration, zoom punch, heavy shake, 2-tone
    impact frames — unreduced. The contrast between the warm, cozy kitchen and a brutal after-hours
    brawl is the point ("after hours, the patrons came back"), not a mismatch to soften.

## Explicitly out of scope for this pass

- Bottle service and the riot system (both exist in the 2D original; deferred, not part of this port)
- The Inspector and Bruno bosses — only Vince gets wired up initially; the other two stay on the
  roster architecture unused
- Audio (this project's existing audio code stays as-is; unifying with Short Order's procedural sfx
  is a separate later pass)
- Quality/performance scaling (`engine/quality.js`) for the new effects — get them correct first
- Actual network transport — the sim is built *ready* for it (see invariant 7 & 8), but no
  connection code is part of this work
- A broader character roster beyond the existing two (her + the male swap) — the friend-group co-op
  vision is bigger than 2, but that's not blocking this pass

## How the work is sequenced

Smaller, independently mergeable/testable pieces, each with its own tests written alongside it
(not backfilled after) — matching this project's existing Vitest house style and Short Order's own
"never trust a green test, mutation-test every new invariant" culture:

1. Fix the pre-existing build bug first: `src/render/meshes.js` imports a `PASS` constant that
   `sim/data.js` never exports. Small, isolated, and blocks a clean `vite build` regardless of
   anything else here (this project's own CI never caught it because `pages.yml` only builds the
   vince/kitchen singlefile targets, never plain `vite build`). **Done** — `PASS` now derives from
   `STATIONS`' own `pass` entry. Also had to pin an inline empty PostCSS config in `vite.config.js`/
   `vitest.config.js`: nested inside the consolidated repo, Vite was walking up to the parent's
   `postcss.config.js` (Tailwind, not installed here). `npm run build`/`npm test` are green;
   `npm run e2e` has 2 pre-existing, unrelated failures (customer-serve money, brawl knockouts) that
   never had a chance to run before this fix — flagged, not touched (mob/service combat, out of
   scope for this step).
2. The sim/render split infrastructure for the ported combat. **In progress.** Landed so far, all
   pure/tested, none of it wired into gameplay yet:
   - `src/sim/weapons.js` — Short Order's `WEAPONS` table, pure data.
   - `src/sim/attackShapes.js` — `SWINGS`/`PUNCHES`/`FINISH`/`PUNCH_FINISH` pose data.
   - `src/sim/resolveHit.js` — the pure damage-resolution core (hit detection, damage, block,
     knockback, the single `weight`). Generalized past Short Order's `isPlayer` branching to plain
     attacker/target, since invariant 8 needs N chefs from the start.
   - `src/sim/applyHit.js` — applies a `resolveHit` result to entity hp/vel/stagger, and to weapon
     durability.
   - `src/sim/startAttack.js` — eligibility check + attack-envelope construction (timing, combo-step
     shape selection).
   - `src/sim/tickAttack.js` — per-frame envelope advancement (`tickAttack`) + the recovery-cancel
     chain window (`canChainAttack`).
   - `src/sim/stepCombat.js` — the actual per-frame combat step wiring all of the above over a real
     entity list (chefs + mobs, N of either, **3D world units** — matches `render/meshes.js`'s
     `to3()` output, not the day-service loop's 2D pixel space). Emits hit events rather than
     touching FX, mirroring `sim/combat.js`'s existing "sim only emits events" convention.

   Still open: starting attacks (input for chefs / AI for mobs — neither exists), combo-streak
   tracking (Short Order's `GAME.combo`/`comboT`; `resolveHit`'s `reachBonus`/`dmgMult`/
   `comboWeight` opts are the hook for when it lands), a real mob roster/target selection, routing
   any gameplay-affecting randomness through `sim/rng.js` (hasn't been needed yet — nothing landed
   so far touches `Math.random()`), the chef rig/IK (step 3), and wiring any of this into
   `state.js`/`stepSim`.
3. The chef rig (re-rigging `chef.js`'s existing mesh onto the new IK).
4. Mob combat (redesigned roster, wave escalation, reputation scaling).
5. Vince, wired through the single damage door, with his grab reusing mash-to-escape.
6. The drink/wasted mechanic, ported with the 2D game's exact tuning.

## Where to look

- `../docs/coop-architecture-plan.md` — the full plan, both tracks (this one, and the separate
  standalone relay/matchmaking service), and the complete decision log this file summarizes.
- `../public/short-order/CLAUDE.md` — the combat being ported *from*; its invariants (1-5 above)
  originate there.
- `../culinary-dash/culinary-dash_src.html` — the 2D original; the drink mechanic
  (`chefDrink`/`wastedAmt`/the buff ladder) and reputation scaling (`brawlSizeMult`) live here.
- `../culinary-dash/docs/HANDOFF_CLAUDE_CODE.md` — the house rules this whole family of projects
  shares (mutation-test every invariant, extract pure decision functions, "look at it, tests won't
  catch everything that matters").
