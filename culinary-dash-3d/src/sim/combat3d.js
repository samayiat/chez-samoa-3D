// The first real integration point for the ported combat: a new `brawl3d`
// sim phase, wired in alongside (not instead of) the old `brawl` phase.
//
// `sim/combat.js`'s own `startBrawl`/`updateCombat`/`phase==='brawl'` are left
// completely untouched -- test/determinism.test.js and test/combat.test.js
// call them directly and must keep passing unmodified (CLAUDE.md invariant 7).
// What changes is what *real play* triggers: service.js's badOrders threshold
// and main.js's dev "press B" shortcut now call startBrawl3D() instead, so a
// person playing the game never reaches the old combat again, while the old
// module/tests stay intact and reachable exactly as before for anyone calling
// them directly. This is how "replace the old brawl phase in play now" and
// "the determinism test keeps passing unmodified" both hold at once.
//
// The mob here is a placeholder: one stationary "punching bag" with an
// arbitrary hp/r, no AI, no movement. It exists to prove the loop end to end
// (press attack -> hit lands -> hp drops) ahead of the real mob roster
// (CLAUDE.md sequencing step 4, not designed yet) -- its numbers are not a
// balance decision.
//
// The chef entity does not move during brawl3d yet -- movement.js is 2D-pixel
// space and porting chef movement into the new 3D-unit combat is separate,
// unrequested work. Only attack input (chargedAttack.js) is wired here.
//
// Hit events (stepCombat's output) are stored on state.combat3d.events but
// not drained into any FX bus -- that bus only understands the old system's
// event shape ({x,y in px, w=weight}; see main.js's `impact(bus, h.w, ...)`
// drain of state.hits). Wiring the new events into FX is a separate, later
// step, not part of proving the swing-to-damage loop.

import { CHEF, to3, len2 } from './data.js';
import { WEAPONS } from './weapons.js';
import { stepCombat } from './stepCombat.js';
import { updateChargedAttack } from './chargedAttack.js';

const CHEF_HP = 100; // Short Order's own player hp/hpMax (invariant 10: its numbers win)
const BAG_HP = 20;   // placeholder -- not a tuned mob-roster number, see header
const BAG_R = 0.5;   // placeholder
// Kept comfortably inside WEAPONS.fists's 1.05 reach (+ BAG_R) so a bare-hand
// punch can actually land -- WEAPONS' widest reach (knife, 1.85) still clears
// this; a much larger spacing would put a fists swing forever out of range.
const BAG_SPAWN_DIST = 0.9;
const BAG_SPACING = 0.5;

function makeChefEntity(chef) {
  const pos = to3(chef.x, chef.y);
  return {
    id: 'chef', team: 'chef',
    pos, facing: chef.facing, r: len2(CHEF.r),
    hp: CHEF_HP, maxHp: CHEF_HP, vel: { x: 0, z: 0 }, stagger: 0, dead: false,
    attack: null, wpn: 'fists', dur: Infinity,
    comboStep: 0, chainT: 0, chargeT: 0,
  };
}

function makePunchingBag(id, chefPos, facing, distance) {
  return {
    id, team: 'mob',
    pos: { x: chefPos.x + Math.sin(facing) * distance, z: chefPos.z + Math.cos(facing) * distance },
    facing: facing + Math.PI, r: BAG_R,
    hp: BAG_HP, maxHp: BAG_HP, vel: { x: 0, z: 0 }, stagger: 0, dead: false,
    attack: null, wpn: 'fists', dur: Infinity,
  };
}

/**
 * Starts the new combat, converting the chef's day-service position (2D px)
 * into a 3D-unit combat entity once, at this boundary -- day service itself
 * is untouched and stays in px. Spawns `count` stationary punching bags lined
 * up in front of the chef's current facing.
 */
export function startBrawl3D(state, count = 1) {
  state.phase = 'brawl3d';
  const chefEntity = makeChefEntity(state.chef);
  const mobs = [];
  for (let i = 0; i < count; i++) {
    mobs.push(makePunchingBag(`bag-${i}`, chefEntity.pos, chefEntity.facing, BAG_SPAWN_DIST + i * BAG_SPACING));
  }
  state.combat3d = { entities: [chefEntity, ...mobs], events: [] };
}

/** stepSim's per-frame call for phase === 'brawl3d'. */
export function stepBrawl3D(state, dt, input) {
  const c = state.combat3d;
  const chef = c.entities[0];
  if (!chef.dead) {
    Object.assign(chef, updateChargedAttack(chef, WEAPONS[chef.wpn], !!input.primary, dt));
  }
  c.events = stepCombat(c.entities, dt);
}
