// Applies a resolveHit() result to entity/weapon state. Pure, no THREE.js -- the
// second half of the "one damage door" (CLAUDE.md invariant 3): resolveHit decides
// what a swing does, this decides what that does to the world. Kept as a separate
// module from resolveHit.js because "compute the hit" and "apply the hit" are
// different concerns with different callers (e.g. a dry-run/preview would call
// resolveHit without ever calling this).
//
// Combat lives in the same 3D world-unit space as the rendered scene (render/
// meshes.js's to3() output), not the day-service loop's 2D pixel space -- entity
// `pos`/`vel` here need no conversion to be placed in the restaurant floor.
//
// Not wired into gameplay yet.

/**
 * Applies a resolveHit() result to a target entity's combat-relevant fields.
 * A miss or an iframe-negated hit is a safe no-op: resolveHit already reports
 * damage 0 / knockback {0,0} / stagger 0 for those, so applying it changes
 * nothing. Every other field on `target` is carried through unchanged.
 *
 * @param {{hp:number, vel:{x:number,z:number}, stagger:number}} target
 * @param {ReturnType<import('./resolveHit.js').resolveHit>} result
 * @returns {object} a new target object; `target` itself is not mutated.
 */
export function applyHitToTarget(target, result) {
  return {
    ...target,
    hp: target.hp - result.damage,
    vel: { x: target.vel.x + result.knockback.x, z: target.vel.z + result.knockback.z },
    stagger: Math.max(target.stagger, result.stagger),
  };
}

/**
 * Applies weapon wear from a landed hit, ported from Short Order's durability
 * check in resolveHit() (`A.dur -= heavy?2:1; if(A.dur<=0) breakWeapon(A)`).
 * Weapons with `dur === Infinity` (fists) never wear down. A miss costs nothing.
 * Generalized past Short Order's `isPlayer`-only durability tracking -- any
 * attacker wielding a wearable weapon can call this, not just the player.
 *
 * @param {number} dur - the attacker's current durability for this weapon.
 * @param {object} weapon - a WEAPONS entry (only `dur` is read).
 * @param {{landed:boolean, heavy?:boolean}} hit
 * @returns {{dur:number, broken:boolean}}
 */
export function applyDurability(dur, weapon, hit) {
  if (!hit.landed || weapon.dur === Infinity) return { dur, broken: false };
  const next = dur - (hit.heavy ? 2 : 1);
  return { dur: next, broken: next <= 0 };
}
