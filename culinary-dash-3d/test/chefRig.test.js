import { describe, it, expect } from 'vitest';
import { buildChefRig, poseChefRig } from '../src/render/chefRig.js';
import { PUNCHES, SWINGS, FINISH } from '../src/sim/attackShapes.js';

// Mechanical checks only -- this can't judge whether the pose *looks* right
// (see verify-chef-rig.mjs + the screenshots for that). What it can confirm:
// the rig builds without throwing, posing never produces NaN, arm bones stay
// exactly their built length (CLAUDE.md invariant 1) no matter the target,
// the correct hand throws (shape.hand for bare punches; always the right
// hand once a weapon is equipped), and the weapon mesh actually swaps.

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
      for (const part of [arm.upper, arm.fore, arm.hand]) {
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
    const idleR = rig.userData.armR.hand.position.clone();

    poseChefRig(rig, { t: 0.1, hitAt: 0.11, shape: PUNCHES[0] }); // hand: 0 (left)
    const afterR = rig.userData.armR.hand.position.clone();
    const movedL = rig.userData.armL.hand.position.clone();

    expect(afterR.distanceTo(idleR)).toBeLessThan(1e-6); // right (off) hand unchanged
    const idleRig = buildChefRig();
    poseChefRig(idleRig, null);
    expect(movedL.distanceTo(idleRig.userData.armL.hand.position)).toBeGreaterThan(0.01);
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
          expect(Number.isFinite(arm.hand.position.x)).toBe(true);
          expect(Number.isFinite(arm.upper.quaternion.w)).toBe(true);
        }
      }
    }
  });

  it('defaults to an empty (fists) weapon mesh with no children', () => {
    const rig = buildChefRig();
    expect(rig.userData.armR.weaponKey).toBe('fists');
    expect(rig.userData.armR.weapon.children.length).toBe(0);
  });

  it('equipping a weapon swaps in a non-empty mesh on the right hand', () => {
    const rig = buildChefRig();
    poseChefRig(rig, null, 'castiron');
    expect(rig.userData.armR.weaponKey).toBe('castiron');
    expect(rig.userData.armR.weapon.children.length).toBeGreaterThan(0);
    expect(rig.userData.armL.weaponKey).toBe('fists'); // never on the left
  });

  it('re-equipping fists clears the weapon mesh back to empty', () => {
    const rig = buildChefRig();
    poseChefRig(rig, null, 'knife');
    poseChefRig(rig, null, 'fists');
    expect(rig.userData.armR.weaponKey).toBe('fists');
    expect(rig.userData.armR.weapon.children.length).toBe(0);
  });

  it('a weapon swing always throws with the right hand, regardless of shape (no shape.hand field)', () => {
    const rig = buildChefRig();
    poseChefRig(rig, null, 'castiron');
    const idleL = rig.userData.armL.hand.position.clone();

    poseChefRig(rig, { t: 0.1, hitAt: 0.34, shape: SWINGS[0] }, 'castiron');
    expect(rig.userData.armL.hand.position.distanceTo(idleL)).toBeLessThan(1e-6); // left untouched

    const idleRig = buildChefRig();
    poseChefRig(idleRig, null, 'castiron');
    expect(rig.userData.armR.hand.position.distanceTo(idleRig.userData.armR.hand.position)).toBeGreaterThan(0.01);
  });

  it('bone lengths stay locked and no NaN appears through a full FINISH (heavy) swing sweep', () => {
    const rig = buildChefRig();
    poseChefRig(rig, null, 'castiron');
    const before = armLengths(rig);
    for (let t = 0; t <= 0.34; t += 0.03) {
      poseChefRig(rig, { t, hitAt: 0.34, shape: FINISH }, 'castiron');
      expect(armLengths(rig)).toEqual(before);
      expect(Number.isFinite(rig.userData.armR.hand.position.x)).toBe(true);
    }
  });
});
