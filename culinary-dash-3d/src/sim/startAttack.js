// Ported from Short Order's startAttack() (../public/short-order/index.html) --
// the eligibility check and attack-envelope construction that runs when an actor
// throws a swing. Pure, no THREE.js: given an actor's current state, a weapon,
// and the swing's options, it returns either `null` (can't attack right now) or
// the envelope resolveHit's caller will later step through (wind-up -> active ->
// recovery) to know when the hit actually lands.
//
// Two of Short Order's branches were empty hooks with no effect on this function
// (`if(atk.heavy && ...){ /* not enough for heavy; allow but will break */ }` and
// `if(w.metal) {} // swing sound at hit`) -- both are omitted here rather than
// ported as literal no-ops, since porting a no-op adds nothing but confusion.
//
// Not wired into gameplay yet.

import { PUNCHES, SWINGS, FINISH, PUNCH_FINISH } from './attackShapes.js';

/**
 * @param {{attack:object|null, stagger:number, dead:boolean, dodge:boolean, comboStep:number}} actor
 * @param {object} weapon - a WEAPONS entry (reads key, wind, rec)
 * @param {{heavy?:boolean, target?:*}} [opts]
 * @returns {object|null} the attack envelope, or null if the actor can't swing right now.
 */
export function startAttack(actor, weapon, opts = {}) {
  if (actor.attack || actor.stagger > 0 || actor.dead || actor.dodge) return null;

  const heavy = !!opts.heavy;
  const wind = weapon.wind * (heavy ? 1.5 : 1);
  const active = 0.09;
  const rec = weapon.rec * (heavy ? 1.3 : 1);
  const comboStep = actor.comboStep || 0;

  const shape = weapon.key === 'fists'
    ? (heavy ? PUNCH_FINISH : PUNCHES[comboStep % PUNCHES.length])
    : (heavy ? FINISH : SWINGS[comboStep % SWINGS.length]);

  return {
    wpn: weapon.key,
    heavy,
    t: 0,
    wind, active, rec,
    dur: wind + active + rec,
    hitAt: wind,
    hit: false,
    side: (actor.comboStep % 2 === 0) ? 1 : -1,
    shape,
    target: opts.target || null,
  };
}
