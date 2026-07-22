// Ported from Short Order's attack-input handling (../public/short-order/
// index.html, the "----- attacks (Cross light / Square heavy / touch) -----"
// block) -- the glue between "an attack was requested" and startAttack(): the
// recovery-cancel gate, and combo-step advancement while chaining.
//
// Deliberately NOT this module's job (left to whatever calls it, once it
// exists): reading actual input devices, deciding *whether* light/heavy was
// requested, and target/lock-on selection (Short Order's `nearestEnemy`) --
// this takes `heavy`/`target` as already-decided, exactly like startAttack.js
// does. That keeps this a thin, pure wrapper rather than pulling input and AI
// concerns in prematurely.
//
// Entities using this need two fields beyond what startAttack.js already
// requires: `comboStep` and `chainT`, both starting at 0 (Short Order's own
// entity init: `attack:null, combo:0, comboStep:0, chainT:0`). Decaying
// `chainT` every frame (`chainT = Math.max(0, chainT - dt)`) is the caller's
// job, same as it will be for other not-yet-modeled cooldowns (dodge/tackle).
//
// Not wired into gameplay yet.

import { startAttack } from './startAttack.js';
import { canChainAttack } from './tickAttack.js';

/**
 * @param {{attack:object|null, stagger:number, dead:boolean, dodge:boolean,
 *   tackle?:boolean, comboStep:number, chainT:number}} actor
 * @param {object} weapon - a WEAPONS entry.
 * @param {{heavy?:boolean, target?:*}} [opts]
 * @returns {{attack:object, comboStep:number, chainT:number}|null}
 *   null if the request is refused (not eligible, or still mid-swing and
 *   outside the recovery-cancel window). On success, `chainT` is the new
 *   chain-window deadline (`attack.dur + 0.4`, ported verbatim) and
 *   `comboStep` is what actually got used to pick the pose -- both need
 *   writing back onto the actor by the caller, same as `attack`.
 */
export function requestAttack(actor, weapon, opts = {}) {
  if (actor.dodge || actor.tackle || actor.stagger > 0 || actor.dead) return null;
  if (!canChainAttack(actor.attack)) return null;

  // Cycle the swing shape while still inside the chain window; otherwise
  // restart the combo at the opener. Uses actor.comboStep directly (not
  // defaulted), matching startAttack.js's own side-calculation quirk --
  // entities are expected to initialize comboStep to 0, not leave it unset.
  const comboStep = actor.chainT > 0 ? actor.comboStep + 1 : 0;

  const attack = startAttack({ ...actor, attack: null, comboStep }, weapon, {
    heavy: opts.heavy, target: opts.target,
  });
  if (!attack) return null;

  return { attack, comboStep, chainT: attack.dur + 0.4 };
}
