// Hold-to-charge attack input, for this port's chosen control scheme: a single
// attack button, tap for light, hold past a threshold for heavy -- rather than
// Short Order's original two separate light/heavy buttons. This project's
// existing input scheme (engine/input.js) only has one free action button
// (primary; secondary is already the dodge in the old combat), so a second
// dedicated heavy-attack binding would mean extending input.js's keymap; a
// charge mechanic needed no new bindings at all. Developer call, not a port.
//
// HEAVY_HOLD is a new tunable, not a ported Short Order number -- Short Order
// has no charge mechanic to port from. 0.35s was picked to land clearly past
// a quick tap without feeling laggy; revisit by feel once playable.
//
// Pure, no THREE.js. Wraps requestAttack.js: decides *when* to call it and
// with which `heavy` flag; requestAttack still owns all the actual
// eligibility gating (dodge/stagger/dead/recovery-cancel).
//
// Entities using this need one more field beyond requestAttack.js's own:
// `chargeT`, starting at 0.
//
// Known simplification: if the auto-fire attempt at the threshold crossing is
// refused by requestAttack (e.g. still recovering from a previous swing), it
// does not keep retrying every frame while held -- chargeT has already
// crossed HEAVY_HOLD, so the "crossing" condition below won't fire again
// until release + a fresh press. Retry-every-frame was deliberately not
// built; this edge case (holding through a swing that's still ineligible)
// is rare and undramatic (worst case: release and press again).
//
// Not wired into gameplay yet.

import { requestAttack } from './requestAttack.js';

export const HEAVY_HOLD = 0.35; // seconds held before a swing auto-upgrades to heavy

/**
 * @param {object} actor - anything requestAttack.js accepts, plus chargeT.
 * @param {object} weapon - a WEAPONS entry.
 * @param {boolean} held - is the attack button currently held down.
 * @param {number} dt
 * @param {{target?:*}} [opts]
 * @returns {{chargeT:number, attack?:object, comboStep?:number, chainT?:number}}
 *   Always includes the new chargeT. Only includes attack/comboStep/chainT
 *   when a swing actually started this tick -- merge them onto the actor
 *   when present, same contract as requestAttack.js's own return value.
 */
export function updateChargedAttack(actor, weapon, held, dt, opts = {}) {
  if (held) {
    const chargeT = actor.chargeT + dt;
    if (actor.chargeT < HEAVY_HOLD && chargeT >= HEAVY_HOLD) {
      const started = requestAttack(actor, weapon, { ...opts, heavy: true });
      if (started) return { ...started, chargeT: 0 };
    }
    return { chargeT };
  }

  if (actor.chargeT <= 0) return { chargeT: 0 };
  const heavy = actor.chargeT >= HEAVY_HOLD;
  const started = requestAttack(actor, weapon, { ...opts, heavy });
  return started ? { ...started, chargeT: 0 } : { chargeT: 0 };
}
