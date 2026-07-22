// The pure core of Short Order's resolveHit() (../public/short-order/index.html) --
// hit detection, damage, block, knockback, and the single `weight` that will drive
// all hit feedback once wired up (CLAUDE.md invariants 2 and 3: one weight drives
// all juice, damage has exactly one door). No THREE.js, no FX/audio, no state
// mutation -- given attacker/target/weapon state it returns what a swing does;
// nothing here decides what to do with that result.
//
// Short Order interleaves this math inline with particles/camera-shake/sound/
// weapon-durability/combo-counter/kill-check side effects. Those stay out of this
// module on purpose -- they belong to whatever applies the result to sim state and
// drives render-layer juice, once that exists (see CLAUDE.md's sequencing). This
// is only the decision.
//
// Generalized past Short Order's single-player `isPlayer` branching to plain
// attacker/target/weapon/opts, since the sim needs to support N independently-
// controlled chefs from the start (invariant 8) -- any chef or mob can be either
// side of a hit. `opts.reachBonus` and `opts.dmgMult`/`opts.comboWeight` replace
// what Short Order hardcoded as "is this the player" (reach pad, combo-streak
// damage buff, combo-streak weight buff); callers decide those per attacker.
//
// Not wired into gameplay yet.

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Wraps an angle difference to (-PI, PI], bit-for-bit as Short Order's `da`/`fa`
// computation -- kept as the exact ported formula, not a more robust rewrite.
function wrapPi(x) {
  return ((x + Math.PI) % TAU) - Math.PI;
}

const MISS = Object.freeze({
  landed: false, blocked: false, negatedByIframe: false,
  damage: 0, knockback: Object.freeze({ x: 0, z: 0 }), stagger: 0, weight: 0,
});

/**
 * @param {{pos:{x:number,z:number}, facing:number}} attacker
 * @param {{pos:{x:number,z:number}, r:number, facing:number, guard?:boolean, guardV?:number, iframe?:number}} target
 * @param {object} weapon - a WEAPONS entry (reach/light/heavy/thrust/gbreak/knock/stagger/heft)
 * @param {{heavy?:boolean, reachBonus?:number, dmgMult?:number, comboWeight?:number}} [opts]
 *   reachBonus: attacker-type reach pad (Short Order: 0.25 for the player, 0.1 for enemies).
 *   dmgMult: damage multiplier (Short Order: the player's 1+combo*0.03 streak buff, 1 otherwise).
 *   comboWeight: additive weight bonus (Short Order: the player's min(combo,10)*0.015).
 * @returns {{landed:boolean, blocked:boolean, negatedByIframe:boolean, damage:number,
 *   knockback:{x:number,z:number}, stagger:number, weight:number}}
 */
export function resolveHit(attacker, target, weapon, opts = {}) {
  const heavy = !!opts.heavy;
  const reach = weapon.reach + (opts.reachBonus || 0);

  const dx = target.pos.x - attacker.pos.x;
  const dz = target.pos.z - attacker.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > reach + target.r) return MISS;

  const ang = Math.atan2(dx, dz);
  const da = wrapPi(ang - attacker.facing);
  const arc = weapon.thrust ? 0.5 : 0.95;
  if (Math.abs(da) > arc) return MISS;

  // Landed: within reach and arc. This stays true even if the hit is fully
  // negated by target iframes below, matching Short Order (where `landed`
  // already latched before its iframe check runs).
  const dmg = (heavy ? weapon.heavy : weapon.light) * (opts.dmgMult == null ? 1 : opts.dmgMult);
  let taken = dmg;
  let blocked = false;
  if (target.guard && target.guardV > 0.5) {
    const toAttacker = Math.atan2(attacker.pos.x - target.pos.x, attacker.pos.z - target.pos.z);
    const fa = wrapPi(toAttacker - target.facing);
    if (Math.abs(fa) < 1.2) {
      blocked = true;
      taken *= weapon.gbreak ? 0.55 : 0.12;
    }
  }
  if (target.iframe > 0) {
    return { landed: true, blocked: false, negatedByIframe: true, damage: 0, knockback: { x: 0, z: 0 }, stagger: 0, weight: 0 };
  }

  const kb = (heavy ? 0.9 : 0.5) * (weapon.knock ? 1.7 : 1) * (blocked ? 0.3 : 1);
  const knockback = { x: Math.sin(ang) * kb * 6, z: Math.cos(ang) * kb * 6 };
  const stagger = blocked ? 0.15 : weapon.stagger * (heavy ? 1.2 : 0.8);

  const heft = weapon.heft == null ? 0.3 : weapon.heft;
  const weight = clamp(heft * (heavy ? 1.0 : 0.6) + (opts.comboWeight || 0), 0, 1.3);

  return { landed: true, blocked, negatedByIframe: false, damage: taken, knockback, stagger, weight };
}
