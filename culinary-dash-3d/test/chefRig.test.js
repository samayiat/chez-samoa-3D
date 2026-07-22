import { describe, it, expect } from 'vitest';
import { buildChefRig, poseChefRig } from '../src/render/chefRig.js';
import { PUNCHES } from '../src/sim/attackShapes.js';

// Mechanical checks only -- this can't judge whether the pose *looks* right
// (see verify-chef-rig.mjs + the screenshots for that). What it can confirm:
// the rig builds without throwing, posing never produces NaN, arm bones stay
// exactly their built length (CLAUDE.md invariant 1) no matter the target,
// and the correct hand (per the shape's `hand` field) is the one that moves.

function armLengths(rig) {
  const u = rig.userData;
  return {
    L: { upper: u.armL.upper.scale.y, fore: u.armL.fore.scale.y },
    R: { upper: u.armR.upper.scale.y, fore: u.armR.fore.scale.y },
  };
}

describe('buildChefRig / poseChefRig (src/render/chefRig.js)', () => {
  it('builds without throwing and exposes the expected parts', () => {
    const rig = buildChefRig();
    const u = rig.userData;
    expect(u.body && u.torso && u.head && u.legL && u.legR && u.armL && u.armR).toBeTruthy();
  });

  it('idle pose (no attack) produces finite transforms for both arms', () => {
    const rig = buildChefRig();
    poseChefRig(rig, null);
    for (const arm of [rig.userData.armL, rig.userData.armR]) {
      for (const part of [arm.upper, arm.fore, arm.fist]) {
        expect(Number.isFinite(part.position.x) && Number.isFinite(part.position.y) && Number.isFinite(part.position.z)).toBe(true);
      }
    }
  });

  it('arm bones stay exactly their built length in idle, no matter how many times posed', () => {
    const rig = buildChefRig();
    poseChefRig(rig, null);
    const first = armLengths(rig);
    poseChefRig(rig, null);
    poseChefRig(rig, null);
    expect(armLengths(rig)).toEqual(first);
  });

  it('a bare-hand punch moves only the throwing hand (per shape.hand), the other stays at guard', () => {
    const rig = buildChefRig();
    poseChefRig(rig, null);
    const idleR = rig.userData.armR.fist.position.clone();

    poseChefRig(rig, { t: 0.1, hitAt: 0.11, shape: PUNCHES[0] }); // hand: 0 (left)
    const afterR = rig.userData.armR.fist.position.clone();
    const movedL = rig.userData.armL.fist.position.clone();

    expect(afterR.distanceTo(idleR)).toBeLessThan(1e-6); // right (off) hand unchanged
    // left (throwing) hand should have moved from its own idle position
    const idleRig = buildChefRig();
    poseChefRig(idleRig, null);
    expect(movedL.distanceTo(idleRig.userData.armL.fist.position)).toBeGreaterThan(0.01);
  });

  it('bone lengths stay locked through a full punch sweep (t from 0 to hitAt)', () => {
    const rig = buildChefRig();
    poseChefRig(rig, null);
    const before = armLengths(rig);
    for (let t = 0; t <= 0.11; t += 0.01) {
      poseChefRig(rig, { t, hitAt: 0.11, shape: PUNCHES[1] });
      expect(armLengths(rig)).toEqual(before);
    }
  });

  it('never produces NaN across a full punch sweep for every ported shape', () => {
    const rig = buildChefRig();
    for (const shape of PUNCHES) {
      for (let t = 0; t <= 0.11; t += 0.02) {
        poseChefRig(rig, { t, hitAt: 0.11, shape });
        for (const arm of [rig.userData.armL, rig.userData.armR]) {
          expect(Number.isFinite(arm.fist.position.x)).toBe(true);
          expect(Number.isFinite(arm.upper.quaternion.w)).toBe(true);
        }
      }
    }
  });
});
