import { describe, it, expect } from 'vitest';
import { startAttack } from '../src/sim/startAttack.js';
import { WEAPONS } from '../src/sim/weapons.js';
import { PUNCHES, SWINGS, FINISH, PUNCH_FINISH } from '../src/sim/attackShapes.js';

const freshActor = (extra = {}) => ({ attack: null, stagger: 0, dead: false, dodge: false, comboStep: 0, ...extra });

describe('startAttack (sim/startAttack.js)', () => {
  it('refuses when already mid-attack, staggered, dead, or dodging', () => {
    expect(startAttack(freshActor({ attack: { t: 0 } }), WEAPONS.fists)).toBeNull();
    expect(startAttack(freshActor({ stagger: 0.2 }), WEAPONS.fists)).toBeNull();
    expect(startAttack(freshActor({ dead: true }), WEAPONS.fists)).toBeNull();
    expect(startAttack(freshActor({ dodge: true }), WEAPONS.fists)).toBeNull();
  });

  it('builds a light-attack envelope with weapon timing and hitAt == wind', () => {
    const env = startAttack(freshActor(), WEAPONS.spatula);
    expect(env.wpn).toBe('spatula');
    expect(env.heavy).toBe(false);
    expect(env.t).toBe(0);
    expect(env.wind).toBeCloseTo(WEAPONS.spatula.wind);
    expect(env.active).toBeCloseTo(0.09);
    expect(env.rec).toBeCloseTo(WEAPONS.spatula.rec);
    expect(env.dur).toBeCloseTo(WEAPONS.spatula.wind + 0.09 + WEAPONS.spatula.rec);
    expect(env.hitAt).toBe(env.wind);
    expect(env.hit).toBe(false);
  });

  it('a heavy attack scales wind by 1.5x and recovery by 1.3x', () => {
    const env = startAttack(freshActor(), WEAPONS.spatula, { heavy: true });
    expect(env.wind).toBeCloseTo(WEAPONS.spatula.wind * 1.5);
    expect(env.rec).toBeCloseTo(WEAPONS.spatula.rec * 1.3);
    expect(env.active).toBeCloseTo(0.09); // active window is not heavy-scaled
  });

  it('side alternates strictly on comboStep parity (undefined comboStep => side -1)', () => {
    expect(startAttack(freshActor({ comboStep: 0 }), WEAPONS.fists).side).toBe(1);
    expect(startAttack(freshActor({ comboStep: 1 }), WEAPONS.fists).side).toBe(-1);
    expect(startAttack(freshActor({ comboStep: 2 }), WEAPONS.fists).side).toBe(1);
    expect(startAttack(freshActor({ comboStep: undefined }), WEAPONS.fists).side).toBe(-1);
  });

  it('bare-hand light attacks cycle PUNCHES by comboStep', () => {
    expect(startAttack(freshActor({ comboStep: 0 }), WEAPONS.fists).shape).toBe(PUNCHES[0]);
    expect(startAttack(freshActor({ comboStep: 1 }), WEAPONS.fists).shape).toBe(PUNCHES[1]);
    expect(startAttack(freshActor({ comboStep: PUNCHES.length }), WEAPONS.fists).shape).toBe(PUNCHES[0]); // wraps
  });

  it('bare-hand heavy attacks always use PUNCH_FINISH', () => {
    expect(startAttack(freshActor({ comboStep: 2 }), WEAPONS.fists, { heavy: true }).shape).toBe(PUNCH_FINISH);
  });

  it('weapon light attacks cycle SWINGS by comboStep', () => {
    expect(startAttack(freshActor({ comboStep: 0 }), WEAPONS.castiron).shape).toBe(SWINGS[0]);
    expect(startAttack(freshActor({ comboStep: SWINGS.length }), WEAPONS.castiron).shape).toBe(SWINGS[0]); // wraps
  });

  it('weapon heavy attacks always use FINISH', () => {
    expect(startAttack(freshActor(), WEAPONS.castiron, { heavy: true }).shape).toBe(FINISH);
  });

  it('target defaults to null and is otherwise passed through', () => {
    expect(startAttack(freshActor(), WEAPONS.fists).target).toBeNull();
    const t = { id: 'enemy-1' };
    expect(startAttack(freshActor(), WEAPONS.fists, { target: t }).target).toBe(t);
  });

  it('does not mutate the actor or weapon', () => {
    const actor = freshActor({ comboStep: 3 });
    const weapon = WEAPONS.spatula;
    const [actorBefore, weaponBefore] = [structuredClone(actor), structuredClone(weapon)];
    startAttack(actor, weapon, { heavy: true, target: { id: 'x' } });
    expect(actor).toEqual(actorBefore);
    expect(weapon).toEqual(weaponBefore);
  });
});
