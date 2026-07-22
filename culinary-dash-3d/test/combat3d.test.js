import { describe, it, expect } from 'vitest';
import { createState, stepSim } from '../src/sim/state.js';
import { startBrawl3D } from '../src/sim/combat3d.js';
import { to3 } from '../src/sim/data.js';
import { WEAPONS } from '../src/sim/weapons.js';

const STEP = 1 / 60;
const NO = { move: { x: 0, y: 0 }, primary: false, primaryDown: false, secondary: false, secondaryDown: false };
const HOLD = { ...NO, primary: true };

describe('startBrawl3D (sim/combat3d.js)', () => {
  it('sets phase and builds a chef entity + N punching bags', () => {
    const s = createState();
    startBrawl3D(s, 3);
    expect(s.phase).toBe('brawl3d');
    expect(s.combat3d.entities).toHaveLength(4);
    expect(s.combat3d.entities[0].team).toBe('chef');
    expect(s.combat3d.entities.slice(1).every((e) => e.team === 'mob')).toBe(true);
  });

  it('places the chef entity at the to3() conversion of the service-loop position', () => {
    const s = createState();
    s.chef.x = 200; s.chef.y = 150; s.chef.facing = 0;
    startBrawl3D(s, 1);
    const expected = to3(200, 150);
    expect(s.combat3d.entities[0].pos.x).toBeCloseTo(expected.x);
    expect(s.combat3d.entities[0].pos.z).toBeCloseTo(expected.z);
  });

  it('spawns the bag in front of the chef, within a bare-hand punch\'s reach', () => {
    const s = createState();
    startBrawl3D(s, 1);
    // If it weren't reachable, the "punch lands" test below would never pass;
    // this test isolates *that* geometry claim on its own.
    const [chef, bag] = s.combat3d.entities;
    const d = Math.hypot(bag.pos.x - chef.pos.x, bag.pos.z - chef.pos.z);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(WEAPONS.fists.reach + bag.r);
  });

  it('does not touch the old brawl system at all', () => {
    const s = createState();
    startBrawl3D(s, 1);
    expect(s.enemies).toBeUndefined();
    expect(s.customers).toEqual([]); // untouched service-loop field, still its init value
  });
});

describe('stepSim dispatches phase "brawl3d" to the new combat', () => {
  it('a held-then-released attack input lands a punch on the bag through stepSim', () => {
    const s = createState();
    startBrawl3D(s, 1);
    const bag = s.combat3d.entities[1];
    const startHp = bag.hp;

    // hold long enough to cross into "wind" then release before HEAVY_HOLD,
    // so a light attack starts, ticks through wind, and resolves the hit.
    stepSim(s, STEP, HOLD);
    stepSim(s, STEP, NO); // release -> light attack starts
    for (let i = 0; i < 30; i++) stepSim(s, STEP, NO); // let it wind up to hitAt

    expect(bag.hp).toBeLessThan(startHp);
    expect(s.combat3d.events.length === 0 || s.combat3d.events.some((e) => e.targetId === bag.id)).toBe(true);
  });

  it('a chef killed mid-combat stops attacking (no crash stepping further)', () => {
    const s = createState();
    startBrawl3D(s, 1);
    s.combat3d.entities[0].dead = true;
    expect(() => {
      for (let i = 0; i < 10; i++) stepSim(s, STEP, HOLD);
    }).not.toThrow();
  });

  it('does not throw across many frames with input toggling on and off', () => {
    const s = createState();
    startBrawl3D(s, 2);
    expect(() => {
      for (let i = 0; i < 300; i++) stepSim(s, STEP, i % 20 < 10 ? HOLD : NO);
    }).not.toThrow();
  });
});
