import { describe, it, expect } from 'vitest';
import { updateChargedAttack, HEAVY_HOLD } from '../src/sim/chargedAttack.js';
import { WEAPONS } from '../src/sim/weapons.js';

const idleActor = (extra = {}) => ({
  attack: null, stagger: 0, dead: false, dodge: false, tackle: false,
  comboStep: 0, chainT: 0, chargeT: 0, ...extra,
});

describe('updateChargedAttack (sim/chargedAttack.js)', () => {
  it('accumulates chargeT while held, without starting an attack before the threshold', () => {
    const r = updateChargedAttack(idleActor(), WEAPONS.fists, true, 0.1);
    expect(r.chargeT).toBeCloseTo(0.1);
    expect(r.attack).toBeUndefined();
  });

  it('a quick tap-and-release below the threshold fires a light attack', () => {
    const held = updateChargedAttack(idleActor(), WEAPONS.fists, true, 0.1);
    const actor = idleActor({ chargeT: held.chargeT });
    const released = updateChargedAttack(actor, WEAPONS.fists, false, 0);
    expect(released.attack.heavy).toBe(false);
    expect(released.chargeT).toBe(0);
  });

  it('releasing after holding past the threshold fires a heavy attack', () => {
    const actor = idleActor({ chargeT: HEAVY_HOLD + 0.05 });
    const r = updateChargedAttack(actor, WEAPONS.fists, false, 0);
    expect(r.attack.heavy).toBe(true);
    expect(r.chargeT).toBe(0);
  });

  it('auto-fires heavy the instant the hold crosses the threshold, without waiting for release', () => {
    const actor = idleActor({ chargeT: HEAVY_HOLD - 0.02 });
    const r = updateChargedAttack(actor, WEAPONS.fists, true, 0.05); // crosses mid-tick
    expect(r.attack).toBeDefined();
    expect(r.attack.heavy).toBe(true);
    expect(r.chargeT).toBe(0);
  });

  it('does not re-fire every frame once already past the threshold while still held', () => {
    const actor = idleActor({ chargeT: HEAVY_HOLD + 0.1 }); // already past, no fresh crossing
    const r = updateChargedAttack(actor, WEAPONS.fists, true, 0.02);
    expect(r.attack).toBeUndefined();
    expect(r.chargeT).toBeCloseTo(HEAVY_HOLD + 0.12);
  });

  it('releasing with no charge in progress is a no-op', () => {
    const r = updateChargedAttack(idleActor(), WEAPONS.fists, false, 0.02);
    expect(r).toEqual({ chargeT: 0 });
  });

  it("a release that requestAttack refuses (e.g. staggered) still resets chargeT, starts nothing", () => {
    const actor = idleActor({ chargeT: 0.2, stagger: 0.5 });
    const r = updateChargedAttack(actor, WEAPONS.fists, false, 0);
    expect(r).toEqual({ chargeT: 0 });
  });

  it('does not mutate the actor or weapon', () => {
    const actor = idleActor({ chargeT: 0.1 });
    const weapon = WEAPONS.fists;
    const [actorBefore, weaponBefore] = [structuredClone(actor), structuredClone(weapon)];
    updateChargedAttack(actor, weapon, true, 0.05);
    expect(actor).toEqual(actorBefore);
    expect(weapon).toEqual(weaponBefore);
  });
});
