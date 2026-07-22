import { describe, it, expect } from 'vitest';
import { WEAPONS } from '../src/sim/weapons.js';

const REQUIRED_FIELDS = [
  'key', 'name', 'cls', 'reach', 'light', 'heavy', 'wind', 'rec',
  'stagger', 'gbreak', 'knock', 'dur', 'shake', 'heft', 'metal', 'tint',
];

describe('ported weapon table (sim/weapons.js)', () => {
  it('has every weapon Short Order defines', () => {
    expect(Object.keys(WEAPONS).sort()).toEqual(
      ['castiron', 'fists', 'knife', 'nonstick', 'potlid', 'spatula'].sort()
    );
  });

  it('every entry carries the fields combat code will need, self-keyed', () => {
    for (const [id, w] of Object.entries(WEAPONS)) {
      expect(w.key).toBe(id);
      for (const field of REQUIRED_FIELDS) {
        expect(w).toHaveProperty(field);
      }
    }
  });

  it('heft ordering matches intent: fists lightest, cast iron heaviest', () => {
    const byHeft = Object.values(WEAPONS).map((w) => w.heft);
    expect(WEAPONS.fists.heft).toBe(Math.min(...byHeft));
    expect(WEAPONS.castiron.heft).toBe(Math.max(...byHeft));
  });

  it('fists never break (Short Order numbers preserved as-is)', () => {
    expect(WEAPONS.fists.dur).toBe(Infinity);
  });

  it('only cast iron can break guard and knock down, matching Short Order', () => {
    for (const [id, w] of Object.entries(WEAPONS)) {
      expect(w.gbreak).toBe(id === 'castiron');
      expect(w.knock).toBe(id === 'castiron');
    }
  });

  it('heavy damage exceeds light damage for every weapon', () => {
    for (const w of Object.values(WEAPONS)) {
      expect(w.heavy).toBeGreaterThan(w.light);
    }
  });
});
