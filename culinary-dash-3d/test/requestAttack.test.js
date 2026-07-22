import { describe, it, expect } from 'vitest';
import { requestAttack } from '../src/sim/requestAttack.js';
import { WEAPONS } from '../src/sim/weapons.js';
import { PUNCHES } from '../src/sim/attackShapes.js';

const idleActor = (extra = {}) => ({
  attack: null, stagger: 0, dead: false, dodge: false, tackle: false,
  comboStep: 0, chainT: 0, ...extra,
});

describe('requestAttack (sim/requestAttack.js)', () => {
  it('refuses when dodging, tackling, staggered, or dead', () => {
    expect(requestAttack(idleActor({ dodge: true }), WEAPONS.fists)).toBeNull();
    expect(requestAttack(idleActor({ tackle: true }), WEAPONS.fists)).toBeNull();
    expect(requestAttack(idleActor({ stagger: 0.1 }), WEAPONS.fists)).toBeNull();
    expect(requestAttack(idleActor({ dead: true }), WEAPONS.fists)).toBeNull();
  });

  it('refuses mid-swing before the hit has landed', () => {
    const actor = idleActor({ attack: { t: 0.02, hit: false, hitAt: 0.1 } });
    expect(requestAttack(actor, WEAPONS.fists)).toBeNull();
  });

  it('refuses inside the 0.03s post-hit cancel window', () => {
    const actor = idleActor({ attack: { t: 0.11, hit: true, hitAt: 0.1 } });
    expect(requestAttack(actor, WEAPONS.fists)).toBeNull();
  });

  it('starts fresh (comboStep 0) when idle with no active chain', () => {
    const result = requestAttack(idleActor(), WEAPONS.fists);
    expect(result.comboStep).toBe(0);
    expect(result.attack.shape).toBe(PUNCHES[0]);
  });

  it('cycles the combo step while inside the chain window, cancelling recovery', () => {
    const actor = idleActor({
      attack: { t: 0.15, hit: true, hitAt: 0.1 }, // past hitAt + the 0.03 cancel window
      comboStep: 1, chainT: 0.4, // still chaining from the previous swing
    });
    const result = requestAttack(actor, WEAPONS.fists);
    expect(result.comboStep).toBe(2);
    expect(result.attack.shape).toBe(PUNCHES[2]);
  });

  it('resets to comboStep 0 once the chain window has expired, even mid-recovery', () => {
    const actor = idleActor({
      attack: { t: 0.15, hit: true, hitAt: 0.1 },
      comboStep: 2, chainT: 0, // chain window lapsed
    });
    const result = requestAttack(actor, WEAPONS.fists);
    expect(result.comboStep).toBe(0);
  });

  it('sets the new chainT to the fresh attack duration plus 0.4', () => {
    const result = requestAttack(idleActor(), WEAPONS.spatula);
    expect(result.chainT).toBeCloseTo(result.attack.dur + 0.4);
  });

  it('passes heavy and target through to the built envelope', () => {
    const target = { id: 'enemy-1' };
    const result = requestAttack(idleActor(), WEAPONS.castiron, { heavy: true, target });
    expect(result.attack.heavy).toBe(true);
    expect(result.attack.target).toBe(target);
  });

  it('does not mutate the actor or weapon', () => {
    const actor = idleActor({ comboStep: 1, chainT: 0.2 });
    const weapon = WEAPONS.fists;
    const [actorBefore, weaponBefore] = [structuredClone(actor), structuredClone(weapon)];
    requestAttack(actor, weapon, { heavy: true });
    expect(actor).toEqual(actorBefore);
    expect(weapon).toEqual(weaponBefore);
  });
});
