// Ported from Short Order's per-frame attack integration (../public/short-order/
// index.html, the "----- integrate attack -----" block and the `canStart` line
// just above it). Pure, no THREE.js: advances an attack envelope's clock and
// reports when the hit moment arrives and when the swing is over.
//
// Not wired into gameplay yet -- there's no combo-step advancement, entity list,
// or actual resolveHit()/applyHit() invocation driving this. That orchestration
// (a per-frame combat step over N chefs + mobs) is the next layer up.

/**
 * Advances an in-progress attack envelope (from startAttack.js) by `dt`.
 *
 * @param {object|null} attack - an envelope from startAttack(), or null if idle.
 * @param {number} dt - sim seconds this tick.
 * @returns {{attack:object|null, shouldResolve:boolean}}
 *   `shouldResolve` is true exactly on the tick the swing crosses `hitAt` --
 *   the caller should invoke resolveHit()/applyHit() for this attack right then,
 *   matching Short Order's `if(!A.hit && A.t>=A.hitAt){ A.hit=true; ...resolveHit(); }`.
 *   `attack` is the advanced envelope, or null once its full duration has elapsed
 *   (recovery complete -- matches `if(A.t>=A.dur){ P.attack=null; }`).
 */
export function tickAttack(attack, dt) {
  if (!attack) return { attack: null, shouldResolve: false };

  const t = attack.t + dt;
  const shouldResolve = !attack.hit && t >= attack.hitAt;
  const hit = attack.hit || shouldResolve;

  if (t >= attack.dur) return { attack: null, shouldResolve };
  return { attack: { ...attack, t, hit }, shouldResolve };
}

/**
 * Whether a new attack input is allowed to cancel the current one and start
 * fresh -- Short Order's recovery-cancel chaining: once a swing has connected,
 * a short 0.03s window later lets the next input interrupt its recovery instead
 * of waiting it out. Ported from the `canStart` line verbatim (including the
 * bare 0.03 constant).
 *
 * @param {object|null} attack - the actor's current attack envelope, or null.
 * @returns {boolean}
 */
export function canChainAttack(attack) {
  return !attack || (attack.hit && attack.t >= attack.hitAt + 0.03);
}
