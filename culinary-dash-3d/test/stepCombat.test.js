import { describe, it, expect } from 'vitest';
import { stepCombat } from '../src/sim/stepCombat.js';
import { startAttack } from '../src/sim/startAttack.js';
import { WEAPONS } from '../src/sim/weapons.js';

function makeEntity(team, x, z, extra = {}) {
  return {
    id: extra.id || `${team}-${x}-${z}`, team, pos: { x, z }, facing: 0, r: 0.3,
    hp: 10, maxHp: 10, vel: { x: 0, z: 0 }, stagger: 0, dead: false,
    attack: null, wpn: 'fists', dur: Infinity, ...extra,
  };
}

// Advances a fists attack's clock right up to (but not past) hitAt, so the
// next stepCombat call is the one that crosses it.
function primeToHitAt(entity) {
  entity.attack.t = entity.attack.hitAt - 0.01;
}

describe('stepCombat (sim/stepCombat.js)', () => {
  it('resolves a landed hit on the tick that crosses hitAt: damages, emits an event', () => {
    const attacker = makeEntity('chef', 0, 0);
    const target = makeEntity('mob', 0, 0.5);
    attacker.attack = startAttack(attacker, WEAPONS.fists);
    primeToHitAt(attacker);

    const events = stepCombat([attacker, target], 0.02);

    expect(target.hp).toBeCloseTo(10 - WEAPONS.fists.light);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ attackerId: attacker.id, targetId: target.id, blocked: false });
  });

  it('does not resolve before hitAt is crossed', () => {
    const attacker = makeEntity('chef', 0, 0);
    const target = makeEntity('mob', 0, 0.5);
    attacker.attack = startAttack(attacker, WEAPONS.fists);

    const events = stepCombat([attacker, target], 0.02); // wind is 0.11, well short
    expect(events).toHaveLength(0);
    expect(target.hp).toBe(10);
    expect(attacker.attack).not.toBeNull(); // still winding up
  });

  it('clears attacker.attack to null once the full envelope has elapsed', () => {
    const attacker = makeEntity('chef', 0, 0);
    attacker.attack = startAttack(attacker, WEAPONS.fists);
    stepCombat([attacker], 5); // way past dur
    expect(attacker.attack).toBeNull();
  });

  it('never hits a same-team entity (no friendly fire)', () => {
    const attacker = makeEntity('chef', 0, 0);
    const ally = makeEntity('chef', 0, 0.5);
    attacker.attack = startAttack(attacker, WEAPONS.fists);
    primeToHitAt(attacker);

    const events = stepCombat([attacker, ally], 0.02);
    expect(events).toHaveLength(0);
    expect(ally.hp).toBe(10);
  });

  it('skips dead attackers and dead targets', () => {
    const deadAttacker = makeEntity('chef', 0, 0);
    const target = makeEntity('mob', 0, 0.5);
    deadAttacker.attack = startAttack(deadAttacker, WEAPONS.fists);
    primeToHitAt(deadAttacker);
    deadAttacker.dead = true; // died mid-swing (e.g. a simultaneous hit) -- must not still resolve
    expect(stepCombat([deadAttacker, target], 0.02)).toHaveLength(0);

    const attacker = makeEntity('chef', 0, 0);
    const deadTarget = makeEntity('mob', 0, 0.5, { dead: true });
    attacker.attack = startAttack(attacker, WEAPONS.fists);
    primeToHitAt(attacker);
    expect(stepCombat([attacker, deadTarget], 0.02)).toHaveLength(0);
  });

  it('kills the target and clamps hp to 0 when a hit brings it to or below zero', () => {
    const attacker = makeEntity('chef', 0, 0);
    const target = makeEntity('mob', 0, 0.5, { hp: 2 }); // fists.light (5) will overkill
    attacker.attack = startAttack(attacker, WEAPONS.castiron, { heavy: true });
    primeToHitAt(attacker);

    stepCombat([attacker, target], 0.02);
    expect(target.dead).toBe(true);
    expect(target.hp).toBe(0);
  });

  it('a miss costs no weapon durability', () => {
    const attacker = makeEntity('chef', 0, 0, { wpn: 'spatula', dur: 5 });
    const farTarget = makeEntity('mob', 0, 99);
    attacker.attack = startAttack(attacker, WEAPONS.spatula);
    primeToHitAt(attacker);

    stepCombat([attacker, farTarget], 0.02);
    expect(attacker.dur).toBe(5);
  });

  it('a landed hit costs 1 durability (light) or 2 (heavy), once per swing even with multiple targets', () => {
    const attacker = makeEntity('chef', 0, 0, { wpn: 'castiron', dur: 5 });
    const t1 = makeEntity('mob', 0, 0.6, { id: 't1' });
    const t2 = makeEntity('mob', 0.3, 0.6, { id: 't2' }); // both within castiron's wide reach/arc
    attacker.attack = startAttack(attacker, WEAPONS.castiron, { heavy: true });
    primeToHitAt(attacker);

    const events = stepCombat([attacker, t1, t2], 0.02);
    expect(events).toHaveLength(2); // cleave hit both
    expect(attacker.dur).toBe(3); // heavy costs 2, charged once for the swing
  });

  it('breaks the weapon and switches to fists when durability reaches zero', () => {
    const attacker = makeEntity('chef', 0, 0, { wpn: 'spatula', dur: 1 });
    const target = makeEntity('mob', 0, 0.5);
    attacker.attack = startAttack(attacker, WEAPONS.spatula);
    primeToHitAt(attacker);

    stepCombat([attacker, target], 0.02);
    expect(attacker.wpn).toBe('fists');
    expect(attacker.dur).toBe(Infinity);
  });

  it('fists never cost durability', () => {
    const attacker = makeEntity('chef', 0, 0); // fists, Infinity dur by default
    const target = makeEntity('mob', 0, 0.5);
    attacker.attack = startAttack(attacker, WEAPONS.fists);
    primeToHitAt(attacker);

    stepCombat([attacker, target], 0.02);
    expect(attacker.dur).toBe(Infinity);
  });

  it("an iframe-negated hit still costs durability but deals no damage and emits no event", () => {
    const attacker = makeEntity('chef', 0, 0, { wpn: 'spatula', dur: 5 });
    const target = makeEntity('mob', 0, 0.5, { iframe: 0.2 });
    attacker.attack = startAttack(attacker, WEAPONS.spatula);
    primeToHitAt(attacker);

    const events = stepCombat([attacker, target], 0.02);
    expect(events).toHaveLength(0);
    expect(target.hp).toBe(10);
    expect(attacker.dur).toBe(4);
  });
});
