import { describe, it, expect } from 'vitest';
import { resolveHit } from '../src/sim/resolveHit.js';
import { WEAPONS } from '../src/sim/weapons.js';

// attacker at the origin, facing +z (ang 0 = straight ahead).
const attacker = (facing = 0) => ({ pos: { x: 0, z: 0 }, facing });
const targetAt = (x, z, extra = {}) => ({ pos: { x, z }, r: 0, facing: 0, ...extra });

describe('resolveHit (ported core, sim/resolveHit.js)', () => {
  it('misses when the target is out of reach', () => {
    const r = resolveHit(attacker(), targetAt(0, 2), WEAPONS.fists);
    expect(r.landed).toBe(false);
    expect(r.damage).toBe(0);
  });

  it('misses when the target is outside the swing arc, even in reach', () => {
    // directly behind the attacker: da = PI, arc caps at 0.95
    const r = resolveHit(attacker(), targetAt(0, -0.5), WEAPONS.fists);
    expect(r.landed).toBe(false);
  });

  it('a landed light hit deals weapon.light damage and computes knockback/stagger/weight', () => {
    const r = resolveHit(attacker(), targetAt(0, 0.5, { r: 0.3 }), WEAPONS.fists);
    expect(r.landed).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.damage).toBeCloseTo(WEAPONS.fists.light);
    // straight ahead (+z): knockback pushes purely along +z
    expect(r.knockback.x).toBeCloseTo(0);
    expect(r.knockback.z).toBeCloseTo(0.5 * 6);
    expect(r.stagger).toBeCloseTo(WEAPONS.fists.stagger * 0.8);
    expect(r.weight).toBeCloseTo(WEAPONS.fists.heft * 0.6);
  });

  it('a heavy hit uses weapon.heavy and the heavy multipliers', () => {
    const r = resolveHit(attacker(), targetAt(0, 1), WEAPONS.castiron, { heavy: true });
    expect(r.damage).toBeCloseTo(WEAPONS.castiron.heavy);
    expect(r.stagger).toBeCloseTo(WEAPONS.castiron.stagger * 1.2);
    expect(r.weight).toBeCloseTo(WEAPONS.castiron.heft * 1.0);
    // castiron knocks: kb = 0.9 * 1.7 * 1 (unblocked)
    expect(r.knockback.z).toBeCloseTo(0.9 * 1.7 * 6);
  });

  it('a guarding target facing the attacker blocks and reduces damage', () => {
    // target above the attacker, facing back down at it (toAttacker == PI == its facing)
    const target = targetAt(0, 1, { facing: Math.PI, guard: true, guardV: 1 });
    const soft = resolveHit(attacker(), target, WEAPONS.fists);
    expect(soft.blocked).toBe(true);
    expect(soft.damage).toBeCloseTo(WEAPONS.fists.light * 0.12);

    const gbreaking = resolveHit(attacker(), target, WEAPONS.castiron);
    expect(gbreaking.blocked).toBe(true);
    expect(gbreaking.damage).toBeCloseTo(WEAPONS.castiron.light * 0.55);
  });

  it('guard does not block if the target is not facing the attacker', () => {
    const target = targetAt(0, 1, { facing: 0, guard: true, guardV: 1 }); // facing away
    const r = resolveHit(attacker(), target, WEAPONS.fists);
    expect(r.blocked).toBe(false);
    expect(r.damage).toBeCloseTo(WEAPONS.fists.light);
  });

  it('target iframes fully negate the hit but it still counts as landed', () => {
    const target = targetAt(0, 1, { iframe: 0.2, guard: true, guardV: 1, facing: Math.PI });
    const r = resolveHit(attacker(), target, WEAPONS.castiron, { heavy: true });
    expect(r.landed).toBe(true);
    expect(r.negatedByIframe).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.damage).toBe(0);
    expect(r.knockback).toEqual({ x: 0, z: 0 });
    expect(r.stagger).toBe(0);
  });

  it("a thrust weapon's narrower arc misses where a wide-arc weapon still lands", () => {
    const ang = 0.6; // between knife's 0.5 arc and fists'/nonstick's 0.95
    const target = targetAt(Math.sin(ang), Math.cos(ang));
    expect(resolveHit(attacker(), target, WEAPONS.fists).landed).toBe(true);
    expect(resolveHit(attacker(), target, WEAPONS.knife).landed).toBe(false);
  });

  it('reachBonus, dmgMult, and comboWeight are caller-supplied (no hardcoded "isPlayer")', () => {
    const far = targetAt(0, WEAPONS.fists.reach + 0.3);
    expect(resolveHit(attacker(), far, WEAPONS.fists).landed).toBe(false);
    expect(resolveHit(attacker(), far, WEAPONS.fists, { reachBonus: 0.3 }).landed).toBe(true);

    const near = targetAt(0, 0.5);
    const base = resolveHit(attacker(), near, WEAPONS.fists);
    const buffed = resolveHit(attacker(), near, WEAPONS.fists, { dmgMult: 2, comboWeight: 0.1 });
    expect(buffed.damage).toBeCloseTo(base.damage * 2);
    expect(buffed.weight).toBeCloseTo(base.weight + 0.1);
  });

  it('never mutates the attacker, target, or weapon it is given', () => {
    const a = attacker();
    const t = targetAt(0, 0.5, { guard: true, guardV: 1, facing: Math.PI });
    const w = WEAPONS.castiron;
    const [aBefore, tBefore, wBefore] = [structuredClone(a), structuredClone(t), structuredClone(w)];
    resolveHit(a, t, w, { heavy: true, dmgMult: 1.5, comboWeight: 0.05 });
    expect(a).toEqual(aBefore);
    expect(t).toEqual(tBefore);
    expect(w).toEqual(wBefore);
  });
});
