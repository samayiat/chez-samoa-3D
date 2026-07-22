import { describe, it, expect } from 'vitest';
import { resolveHit } from '../src/sim/resolveHit.js';
import { applyHitToTarget, applyDurability } from '../src/sim/applyHit.js';
import { WEAPONS } from '../src/sim/weapons.js';

const attacker = { pos: { x: 0, z: 0 }, facing: 0 };
const freshTarget = (extra = {}) => ({
  hp: 10, vel: { x: 0, z: 0 }, stagger: 0,
  pos: { x: 0, z: 0.5 }, r: 0.3, facing: 0, ...extra,
});

describe('applyHitToTarget (sim/applyHit.js)', () => {
  it('reduces hp, accumulates knockback into vel, and floors stagger on a landed hit', () => {
    const target = freshTarget();
    const result = resolveHit(attacker, target, WEAPONS.fists);
    const next = applyHitToTarget(target, result);

    expect(next.hp).toBeCloseTo(target.hp - WEAPONS.fists.light);
    expect(next.vel.x).toBeCloseTo(result.knockback.x);
    expect(next.vel.z).toBeCloseTo(result.knockback.z);
    expect(next.stagger).toBeCloseTo(result.stagger);
    // unrelated fields carried through untouched
    expect(next.pos).toEqual(target.pos);
    expect(next.facing).toBe(target.facing);
  });

  it('accumulates knockback onto existing velocity rather than overwriting it', () => {
    const target = freshTarget({ vel: { x: 1, z: -2 } });
    const result = resolveHit(attacker, target, WEAPONS.fists);
    const next = applyHitToTarget(target, result);
    expect(next.vel.x).toBeCloseTo(1 + result.knockback.x);
    expect(next.vel.z).toBeCloseTo(-2 + result.knockback.z);
  });

  it('stagger only rises, never drops below what was already pending', () => {
    const target = freshTarget({ stagger: 5 }); // already staggered harder than this hit would set
    const result = resolveHit(attacker, target, WEAPONS.fists);
    const next = applyHitToTarget(target, result);
    expect(next.stagger).toBe(5);
  });

  it('a miss is a no-op', () => {
    const target = freshTarget({ pos: { x: 0, z: 99 } }); // far out of reach
    const result = resolveHit(attacker, target, WEAPONS.fists);
    expect(result.landed).toBe(false);
    const next = applyHitToTarget(target, result);
    expect(next.hp).toBe(target.hp);
    expect(next.vel).toEqual(target.vel);
    expect(next.stagger).toBe(target.stagger);
  });

  it('an iframe-negated hit is a no-op despite landing', () => {
    const target = freshTarget({ iframe: 0.3 });
    const result = resolveHit(attacker, target, WEAPONS.castiron, { heavy: true });
    expect(result.landed).toBe(true);
    expect(result.negatedByIframe).toBe(true);
    const next = applyHitToTarget(target, result);
    expect(next.hp).toBe(target.hp);
    expect(next.vel).toEqual(target.vel);
    expect(next.stagger).toBe(target.stagger);
  });

  it('does not mutate the original target', () => {
    const target = freshTarget();
    const before = structuredClone(target);
    const result = resolveHit(attacker, target, WEAPONS.fists);
    applyHitToTarget(target, result);
    expect(target).toEqual(before);
  });
});

describe('applyDurability (sim/applyHit.js)', () => {
  it('fists (Infinity durability) never wear down', () => {
    expect(applyDurability(999, WEAPONS.fists, { landed: true, heavy: true })).toEqual({ dur: 999, broken: false });
  });

  it('a miss costs no durability', () => {
    expect(applyDurability(5, WEAPONS.castiron, { landed: false })).toEqual({ dur: 5, broken: false });
  });

  it('a landed light hit costs 1 durability', () => {
    expect(applyDurability(5, WEAPONS.spatula, { landed: true })).toEqual({ dur: 4, broken: false });
  });

  it('a landed heavy hit costs 2 durability', () => {
    expect(applyDurability(5, WEAPONS.spatula, { landed: true, heavy: true })).toEqual({ dur: 3, broken: false });
  });

  it('reports broken once durability hits zero', () => {
    expect(applyDurability(1, WEAPONS.spatula, { landed: true })).toEqual({ dur: 0, broken: true });
    expect(applyDurability(1, WEAPONS.spatula, { landed: true, heavy: true })).toEqual({ dur: -1, broken: true });
  });
});
