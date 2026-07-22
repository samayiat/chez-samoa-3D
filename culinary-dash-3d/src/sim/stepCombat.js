// The per-frame combat loop wiring the pure decision layer (startAttack,
// tickAttack, resolveHit, applyHit) together over a real entity list -- chefs
// and mobs, N of either. First orchestration piece of the sim/render split
// (docs/coop-architecture-plan.md's Track A; culinary-dash-3d/CLAUDE.md).
//
// stepCombat() does NOT start attacks (driven by input for chefs, AI for
// mobs -- neither exists yet) or advance combo-streak counters (a separate
// per-frame timer concern, Short Order's GAME.combo/comboT -- deferred; when
// it lands, resolveHit's reachBonus/dmgMult/comboWeight opts are the hook to
// wire it through, not a change to this file). It only ticks attacks already
// in flight, resolves hits against opposing-team entities, applies the
// results, and wears down the attacker's weapon.
//
// Entities are mutated in place, matching this codebase's existing sim style
// (sim/combat.js's updateCombat does the same) -- resolveHit/applyHit/
// applyDurability themselves stay pure; this is just their caller.
//
// Target selection is deliberately the simplest possible thing (opposing
// `team`, alive, in resolveHit's own reach+arc check) -- a real mob roster
// (CLAUDE.md sequencing step 4) will likely want smarter selection; not
// designed prematurely.
//
// Position units: 3D world units (matching render/meshes.js's to3() output),
// per the "combat lives in 3D" call -- NOT the day-service loop's 2D pixel
// space. Converting a chef from service (px) into a combat entity (units) at
// the moment a brawl starts is the caller's job, not this module's.
//
// Death here is just the sim fact (`dead: true`, hp clamped to 0) -- ragdoll/
// kill FX/toast is render-layer and not this module's concern, matching how
// blocked/weight/etc. are reported as event data rather than acted on here.
//
// Not wired into gameplay yet -- nothing calls this from state.js/stepSim.

import { WEAPONS } from './weapons.js';
import { tickAttack } from './tickAttack.js';
import { resolveHit } from './resolveHit.js';
import { applyHitToTarget, applyDurability } from './applyHit.js';

/**
 * @param {object[]} entities - chefs + mobs. Each needs: id, team, pos:{x,z},
 *   facing, r, hp, vel:{x,z}, stagger, dead, attack (envelope or null), wpn,
 *   dur, and optionally guard/guardV/iframe (read by resolveHit as a target).
 * @param {number} dt
 * @returns {object[]} hit events emitted this tick, for a render-layer FX bus
 *   to drain -- {attackerId, targetId, blocked, damage, weight, pos} per
 *   landed (non-negated) hit. Mirrors sim/combat.js's existing convention:
 *   the sim only emits events, FX stays out of the sim.
 */
export function stepCombat(entities, dt) {
  const events = [];

  for (const attacker of entities) {
    const prevAttack = attacker.attack;
    const { attack, shouldResolve } = tickAttack(prevAttack, dt);
    attacker.attack = attack;
    if (!shouldResolve || attacker.dead) continue;

    const weapon = WEAPONS[prevAttack.wpn];
    let landedAny = false;

    for (const target of entities) {
      if (target === attacker || target.dead || target.team === attacker.team) continue;

      const result = resolveHit(attacker, target, weapon, { heavy: prevAttack.heavy });
      if (!result.landed) continue;
      landedAny = true;
      if (result.negatedByIframe) continue;

      Object.assign(target, applyHitToTarget(target, result));
      if (target.hp <= 0 && !target.dead) { target.hp = 0; target.dead = true; }

      events.push({
        attackerId: attacker.id, targetId: target.id,
        blocked: result.blocked, damage: result.damage, weight: result.weight,
        pos: { x: target.pos.x, z: target.pos.z },
      });
    }

    if (landedAny && attacker.wpn !== 'fists') {
      const { dur, broken } = applyDurability(attacker.dur, weapon, { landed: true, heavy: prevAttack.heavy });
      attacker.dur = dur;
      if (broken) { attacker.wpn = 'fists'; attacker.dur = Infinity; }
    }
  }

  return events;
}
