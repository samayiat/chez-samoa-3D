import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { boneIK, orientFixed, solveTwoBone } from '../src/render/ik.js';

function mat() { return new THREE.MeshBasicMaterial(); }

describe('orientFixed (src/render/ik.js)', () => {
  it('always scales the bone to exactly L, regardless of how far apart a/b are', () => {
    const m = boneIK(0.1, 0.08, mat());
    orientFixed(m, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0), 0.4);
    expect(m.scale.y).toBeCloseTo(0.4);
    orientFixed(m, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -100, 0), 0.4); // way over-reach
    expect(m.scale.y).toBeCloseTo(0.4); // still exactly 0.4, not stretched to 100
  });

  it('positions the bone at the midpoint between a and its own endpoint (not b)', () => {
    const m = boneIK(0.1, 0.08, mat());
    orientFixed(m, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0), 0.5);
    // endpoint is 0.5 along -Y from a=(0,0,0) -> (0,-0.5,0); midpoint -> (0,-0.25,0)
    expect(m.position.y).toBeCloseTo(-0.25);
  });

  it('falls back to a default direction when a and b coincide (no NaN)', () => {
    const m = boneIK(0.1, 0.08, mat());
    orientFixed(m, new THREE.Vector3(1, 2, 3), new THREE.Vector3(1, 2, 3), 0.3);
    expect(Number.isFinite(m.position.x) && Number.isFinite(m.position.y) && Number.isFinite(m.position.z)).toBe(true);
    expect(Number.isFinite(m.quaternion.x)).toBe(true);
  });
});

describe('solveTwoBone (src/render/ik.js)', () => {
  it('reaches an in-range target exactly (tip lands on the target)', () => {
    const b1 = boneIK(0.1, 0.09, mat()), b2 = boneIK(0.09, 0.07, mat());
    const root = new THREE.Vector3(0, 1, 0);
    const tip = new THREE.Vector3(0, 0.4, 0.3); // within L1+L2 = 0.8
    const bend = new THREE.Vector3(0, 0, 1);
    solveTwoBone(b1, b2, root, tip, 0.4, 0.4, bend);

    // reconstruct where b2's far end actually landed: position + facing*scale.y*0.5*2
    const dir = new THREE.Vector3().copy(new THREE.Vector3(0, 1, 0)).applyQuaternion(b2.quaternion);
    const end = b2.position.clone().addScaledVector(dir, b2.scale.y * 0.5);
    expect(end.x).toBeCloseTo(tip.x, 3);
    expect(end.y).toBeCloseTo(tip.y, 3);
    expect(end.z).toBeCloseTo(tip.z, 3);
  });

  it('an out-of-reach target leaves the limb short, not stretched (bones stay length-locked)', () => {
    const b1 = boneIK(0.1, 0.09, mat()), b2 = boneIK(0.09, 0.07, mat());
    const root = new THREE.Vector3(0, 0, 0);
    const tip = new THREE.Vector3(0, -5, 0); // way beyond L1+L2 = 0.8
    solveTwoBone(b1, b2, root, tip, 0.4, 0.4, new THREE.Vector3(0, 0, 1));
    expect(b1.scale.y).toBeCloseTo(0.4);
    expect(b2.scale.y).toBeCloseTo(0.4);
    // fully extended straight at the (unreachable) target -> total reach 0.8 along -Y
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(b2.quaternion);
    const end = b2.position.clone().addScaledVector(dir, b2.scale.y * 0.5);
    expect(end.y).toBeCloseTo(-0.8, 2);
  });

  it('writes the solved joint position when outJoint is provided', () => {
    const b1 = boneIK(0.1, 0.09, mat()), b2 = boneIK(0.09, 0.07, mat());
    const root = new THREE.Vector3(0, 0, 0);
    const tip = new THREE.Vector3(0, -0.6, 0);
    const outJoint = new THREE.Vector3();
    solveTwoBone(b1, b2, root, tip, 0.4, 0.4, new THREE.Vector3(0, 0, 1), outJoint);
    expect(outJoint.length()).toBeGreaterThan(0);
    expect(Number.isFinite(outJoint.y)).toBe(true);
  });

  it('never produces NaN when root and tip coincide (degenerate case)', () => {
    const b1 = boneIK(0.1, 0.09, mat()), b2 = boneIK(0.09, 0.07, mat());
    const p = new THREE.Vector3(1, 1, 1);
    solveTwoBone(b1, b2, p, p.clone(), 0.4, 0.4, new THREE.Vector3(0, 0, 1));
    expect(Number.isFinite(b1.position.x)).toBe(true);
    expect(Number.isFinite(b2.quaternion.w)).toBe(true);
  });
});
