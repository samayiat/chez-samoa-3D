# HANDOFF → whoever picks up Track A

**Read this whole file before touching anything. Then do Task 0 and Task 1 only, and stop.**

---

## Where this came from

This project (`culinary-dash-3d`) and its 2D original (`../culinary-dash/`) were built across long
sessions on Mac/claude.ai, as a restaurant-service-sim-that-erupts-into-a-brawl, built as a gift —
throughout `culinary-dash/docs/`, **"her"** means the recipient, who is also the default player
character.

Separately, in a different line of work in this same repo, **Short Order**
(`../public/short-order/index.html`) was built — a single-file Three.js beat-em-up with a
materially better combat feel (full IK rig, weight-driven juice/impact spine, ragdoll, weapon feel).

A long planning conversation (see `../docs/coop-architecture-plan.md` — read that in full; this
file summarizes the parts relevant to your first task) landed on: **`culinary-dash-3d` keeps its
restaurant layout, service loop, and boss roster, but its combat is replaced by a port of Short
Order's**, with the 2D original's drink/"wasted" mechanic added in alongside. The eventual goal is
real networked co-op (two separate devices, lockstep — inputs synced, not state), which is why the
sim needs to be deterministic and shaped for N chefs from the very first piece of this work, not as
a later retrofit.

**No implementation exists yet.** You are the first session actually touching code for this.

---

## 1. How this project is laid out

| File/dir | What it is |
|---|---|
| `src/sim/` | Pure state/logic — no THREE.js. `data.js`, `combat.js` (being replaced), `movement.js`, `rng.js` (the seeded RNG — see rule below), `service.js`, `state.js`. |
| `src/render/` | Reads sim state, drives THREE.js meshes. `scene.js`, `meshes.js`, `sparks.js`. |
| `src/preview/` | `kitchen-room.js` (the restaurant — reusable near as-is), `boss.js` + `main-vince.js` (the boss roster; currently deals damage through its own `resolveStrike`, needs rewiring), `chef.js` (her mesh-building code — **keep this, re-rig it, do not rebuild her from scratch**). |
| `test/` | Vitest suite — `npm test`, expect all green. `determinism.test.js` is the one that matters most (see rule below). |
| `e2e/` | Playwright WebGL checks — `npm run e2e`. |
| `CLAUDE.md` (this directory) | The full invariant list for this port. **Read it now if you haven't** — this handoff only restates the pieces relevant to Task 0/1. |
| `../docs/coop-architecture-plan.md` | The complete plan, both tracks, full decision log. |
| `../public/short-order/index.html` + its own `CLAUDE.md` | The combat being ported *from*. |
| `../culinary-dash/culinary-dash_src.html` | The 2D original — the drink mechanic and reputation scaling (`brawlSizeMult`) live here. **Never read `culinary-dash.html`** (the built file) — it has ~800KB of embedded art blobs that will blow up your context. |

---

## 2. Rules that matter here, flagged during planning (not yet-discovered bugs — be the reason they never happen)

Since no code exists yet, these aren't war stories the way the original 2D game's handoff had —
they're risks identified *before* writing anything, specifically so you don't have to discover them
the hard way:

- **A single unseeded `Math.random()` call silently breaks co-op.** `sim/rng.js` is the only source
  of gameplay-affecting randomness. Short Order's `pick()` and anything like it must route through
  it. The failure mode isn't a crash — it's two devices' games quietly diverging with no visible
  symptom until much later. The determinism test (`test/determinism.test.js`, "two sims, same seed,
  byte-identical for 2400 frames") is the concrete tripwire — if you change something and it still
  passes, that's a hard signal, not a coincidence to double check.
- **Her look is not part of any redesign happening here.** The mob roster is being freely rebuilt;
  she is not. If a task ever seems to require adjusting her hair/body/proportions in `chef.js` to
  make something else work — stop and surface it, don't quietly make the trade.
- **Damage has to have exactly one door**, from the first piece of combat code you write. Retrofitting
  this after mob combat and Vince both exist independently is much more painful than building it
  in from the start.

---

## 3. Tooling you have that isn't obvious

- `npm test` (Vitest — service/combat/determinism) and `npm run e2e` (Playwright) already exist and
  pass on the current code. Any new sim logic should get equivalent tests in the same style,
  written alongside it, not backfilled after.
- `../culinary-dash/work_handoff/*shot.js` (e.g. `roomshot.js`) is the existing pattern for
  rendering a real scene to a PNG headlessly, from the 2D game. `e2e/` here already does the
  Playwright-based equivalent for this 3D project. **Definition of done for anything visual is a
  PNG and a URL, not "tests pass"** — see the working agreement below.
- `../culinary-dash/docs/HANDOFF_CLAUDE_CODE.md` is the original handoff doc this one is modeled on
  — worth a read for the house culture (mutation-test every invariant, "look at it, tests won't
  catch everything that matters," extract pure decision functions).

---

## 4. Your working agreement with the developer

**This is the part he cares about most.**

### You are doing ONE task. Stop when it's done.
Section 5 below (the rest of the sequencing) is context so you understand where this fits — not a
queue. Don't start the next piece because this one finished. Finish Task 0 and Task 1, report, stop.
He will hand you the next one.

### Definition of done for anything visual: a PNG and a URL.
Not "tests pass." This environment (and possibly yours) can't interactively play a Three.js scene —
render it, screenshot it, and say plainly what you verified mechanically (tests, no exceptions/NaN)
versus what's still unverified visually and needs his eyes. Every time, not just when something
seems risky.

### Stop and surface immediately — mid-task — if:
- **It already exists.** Don't quietly redesign around something that's already there.
- **A change to combat code makes the determinism test pass without you expecting it to** —
  suspicious by default.
- **A task seems to require touching her established look** in any way.
- **You're about to touch anything outside the current task** (mob combat, Vince, the drink
  mechanic — all explicitly not part of Task 0/1).

### Don't improve things you weren't asked to.
`CLAUDE.md` in this directory is dense with decisions that look arbitrary but were deliberated —
numeric balance direction, camera-by-context, weapon durability, juice intensity. If something looks
like it could be done differently, say so; don't just change it.

---

## 5. TASK 0 — fix the pre-existing build bug (blocking, do first)

`src/render/meshes.js` imports a `PASS` constant from `src/sim/data.js` that doesn't exist there:

```js
import { STATIONS, TABLES, PASS, WORLD, to3, len2 } from '../sim/data.js';
```

`sim/data.js` has no `PASS` export — only `TILL` and `DOOR` as similar "spot" constants. This is why
`npm run build` (plain Vite build) currently fails, even though `npm test` and the vince/kitchen
singlefile builds succeed — this project's own CI (`.github/workflows/culinary-dash-pages.yml`,
carried over as reference, not yet active) only ever builds the vince/kitchen targets, never plain
`vite build`, so it was never caught.

Fix it so `npm run build` succeeds. Figure out what `PASS` was actually supposed to be (likely the
pass-counter concept from the 2D game/Short Order both have — check whether `meshes.js` even uses it
meaningfully, or whether the import is simply dead) before deciding whether to add the export or
remove the unused import. Confirm with `npm run build`, `npm test`, and `npm run e2e` all green
after.

## 6. TASK 1 — first slice of the sim/render split: port Short Order's weapon table as pure data

Small and deliberately low-risk — it's where you learn this project's conventions on something that
can't break the currently-running game, because nothing wires it up yet.

Port Short Order's `WEAPONS` table (`../public/short-order/index.html`, search for `const WEAPONS`)
into a new `src/sim/weapons.js` in this project — pure data, no THREE.js, matching the existing
style of `src/sim/data.js`'s `DISHES`/`STATIONS` tables. Keep the numbers exactly as Short Order has
them (per the "Short Order's numbers win" balance decision in `CLAUDE.md`). Write a Vitest test
(`test/weapons.test.js`) asserting the shape and key values — e.g. that `heft` ordering matches
intent (fists lightest, cast iron heaviest), that every entry has the fields combat code will need.

**Do not wire this into gameplay yet** — no rendering, no pickups, no combat resolution touching it.
That's later tasks (see below). This task is purely: get the data into this project's `sim/` layer,
tested, in this project's house style, nothing else moving yet.

Confirm with `npm test` (new test green, all existing tests still green) and `npm run build`
(still succeeds, per Task 0).

**Then stop.** Report what you found/did for both tasks, flag anything from the working agreement's
"stop and surface" list if it came up, and say plainly what's mechanically verified vs. needs eyes
on it (Task 1 has no visual component, so this should be straightforward — Task 0's fix might, if it
touches anything rendered).

---

## 7. The rest of the plan — CONTEXT ONLY. DO NOT IMPLEMENT.

Full detail lives in `CLAUDE.md`'s "How the work is sequenced" and `../docs/coop-architecture-plan.md`.
In order, after Task 0/1: the rest of the sim/render split for combat resolution and IK, then the
chef rig (re-rig `chef.js`'s existing mesh onto Short Order's IK — her look does not change), then
mob combat (redesigned roster around Short Order's archetypes, `waveSizes`-chunked escalation,
`brawlSizeMult` reputation scaling still applies), then Vince (wired through the single damage door,
his `grab` reusing Short Order's mash-to-escape), then the drink/wasted mechanic (2D game's exact
tuning: 3 drinks = permanent buzz, 5 = WASTED). Bottle service, the riot system, the Inspector/Bruno
bosses, audio, quality-scaling integration, and any actual network code are all explicitly out of
scope until later phases named in the plan doc.
