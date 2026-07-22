import { describe, it, expect } from 'vitest';
import { SWINGS, PUNCHES, FINISH, PUNCH_FINISH } from '../src/sim/attackShapes.js';

function expectShape(shape) {
  for (const key of ['s', 'e', 'bend']) {
    expect(Array.isArray(shape[key])).toBe(true);
    expect(shape[key]).toHaveLength(3);
    for (const n of shape[key]) expect(Number.isFinite(n)).toBe(true);
  }
  for (const key of ['coil', 'follow', 'lean']) {
    expect(Number.isFinite(shape[key])).toBe(true);
  }
  expect(typeof shape.name).toBe('string');
}

describe('ported attack shapes (sim/attackShapes.js)', () => {
  it('has the 3-swing weapon combo cycle, all well-formed', () => {
    expect(SWINGS).toHaveLength(3);
    expect(SWINGS.map((s) => s.name)).toEqual(['forehand', 'backhand', 'chop']);
    SWINGS.forEach(expectShape);
  });

  it('has the 4-punch bare-hand combo cycle, alternating hands', () => {
    expect(PUNCHES).toHaveLength(4);
    expect(PUNCHES.map((p) => p.name)).toEqual(['jab', 'jab', 'hook', 'upper']);
    expect(PUNCHES.map((p) => p.hand)).toEqual([0, 1, 0, 1]);
    PUNCHES.forEach(expectShape);
  });

  it('the weapon finisher is well-formed and distinct from the combo cycle', () => {
    expectShape(FINISH);
    expect(FINISH.name).toBe('smash');
    expect(SWINGS.some((s) => s.name === FINISH.name)).toBe(false);
  });

  it('the bare-hand finisher is the uppercut, by reference (matches Short Order)', () => {
    expect(PUNCH_FINISH).toBe(PUNCHES[3]);
    expect(PUNCH_FINISH.name).toBe('upper');
  });
});
