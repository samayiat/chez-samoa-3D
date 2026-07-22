import { describe, it, expect } from 'vitest';
import { tickAttack, canChainAttack } from '../src/sim/tickAttack.js';

// A representative envelope shape (as startAttack.js would produce it):
// wind 0.1, active 0.09, rec 0.14 -> hitAt 0.1, dur 0.33.
const envelope = (extra = {}) => ({
  wpn: 'spatula', heavy: false, t: 0, wind: 0.1, active: 0.09, rec: 0.14,
  dur: 0.33, hitAt: 0.1, hit: false, side: 1, shape: {}, target: null, ...extra,
});

describe('tickAttack (sim/tickAttack.js)', () => {
  it('a null attack stays null and never resolves', () => {
    expect(tickAttack(null, 0.05)).toEqual({ attack: null, shouldResolve: false });
  });

  it('advances time without resolving before hitAt', () => {
    const { attack, shouldResolve } = tickAttack(envelope(), 0.05);
    expect(shouldResolve).toBe(false);
    expect(attack.hit).toBe(false);
    expect(attack.t).toBeCloseTo(0.05);
  });

  it('resolves exactly on the tick that crosses hitAt, and marks hit', () => {
    const midway = tickAttack(envelope(), 0.06).attack; // t=0.06, still before hitAt=0.1
    const { attack, shouldResolve } = tickAttack(midway, 0.06); // t=0.12, crosses 0.1
    expect(shouldResolve).toBe(true);
    expect(attack.hit).toBe(true);
    expect(attack.t).toBeCloseTo(0.12);
  });

  it('never resolves twice for the same swing once hit is already true', () => {
    const afterHit = tickAttack(envelope({ t: 0.1, hit: true }), 0.05);
    expect(afterHit.shouldResolve).toBe(false);
    expect(afterHit.attack.hit).toBe(true);
  });

  it('clears the attack to null once its full duration has elapsed', () => {
    const { attack } = tickAttack(envelope({ t: 0.3, hit: true }), 0.05); // t=0.35 >= dur 0.33
    expect(attack).toBeNull();
  });

  it('still reports shouldResolve true if a single large dt crosses both hitAt and dur', () => {
    const { attack, shouldResolve } = tickAttack(envelope(), 1.0); // way past dur=0.33
    expect(shouldResolve).toBe(true);
    expect(attack).toBeNull();
  });

  it('does not mutate the envelope it is given', () => {
    const original = envelope();
    const before = structuredClone(original);
    tickAttack(original, 0.05);
    expect(original).toEqual(before);
  });
});

describe('canChainAttack (sim/tickAttack.js)', () => {
  it('allows starting fresh when idle', () => {
    expect(canChainAttack(null)).toBe(true);
  });

  it('refuses mid-swing, before the hit has landed', () => {
    expect(canChainAttack(envelope({ t: 0.05, hit: false }))).toBe(false);
  });

  it('refuses in the instant right after the hit, inside the 0.03s cancel window', () => {
    expect(canChainAttack(envelope({ t: 0.11, hit: true, hitAt: 0.1 }))).toBe(false);
  });

  it('allows chaining once the 0.03s recovery-cancel window has passed', () => {
    expect(canChainAttack(envelope({ t: 0.13, hit: true, hitAt: 0.1 }))).toBe(true);
  });
});
