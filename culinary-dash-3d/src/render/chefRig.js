// The chef's rig, re-built on Short Order's length-locked two-bone IK
// (render/ik.js) instead of preview/chef.js's nested-rotation FK arms, per
// CLAUDE.md invariant 6: her established hairstyle/body/proportions stay
// exactly as preview/chef.js already built them -- ONLY how her arms move
// switches to IK. Legs/torso/head geometry below is copied verbatim from
// preview/chef.js's buildChef() (colors, proportions, primitives); only the
// arm section (originally nested shoulder->elbow->fist rotation groups) is
// replaced with two flat IK bones posed by a world-space hand target each
// frame, matching how Short Order's own arms work.
//
// Deliberately minimal first slice: idle guard stance + a punch/swing that
// lerps the throwing hand from the attack shape's windup point `s` to its
// strike point `e` (attackShapes.js) as attack.t approaches hitAt. Does NOT
// yet replicate poseChef's full fidelity (footwork, weight shift, lean,
// coil, follow-through/recovery curve, squash) -- later slices. Legs/torso/
// head are static; only arms move.
//
// Weapons: a weapon mesh (render/weaponMesh.js, ported from Short Order's
// makeWeaponMesh) always rides the right hand, per Short Order's own
// convention ("give a chef a weapon in the right hand", equip()). Bare-hand
// PUNCHES carry an explicit `hand` field (0=L/1=R) picking which fist
// throws; weapon SWINGS/FINISH shapes have no such field since the weapon is
// always right-handed -- poseChefRig forces the right hand to throw whenever
// the equipped weapon isn't fists, regardless of what shape.hand would say.
//
// GUARD_TARGET's numbers are this slice's own approximation (no equivalent
// "resting IK target" exists to port from her old FK rig, which posed idle
// arms via a fixed rotation angle instead).
//
// PUNCHES'/SWINGS' `s`/`e` values are tuned for Short Order's own rig
// (shoulder at y=1.54, 0.8 total arm reach) -- using them as absolute
// coordinates against her rig (shoulder y=1.16, 0.54 reach) was tried first
// and rendered wrong (checked with the verify script, not assumed): the
// target ends up well above her actual shoulder, so a "forward jab" curled
// her fist up near her chin instead of extending outward. retarget() below
// re-expresses each point relative to Short Order's own shoulder, scales it
// by the ratio of her arm reach to Short Order's, then re-anchors it to her
// shoulder -- preserving the punch's *geometric intent* (forward, roughly
// shoulder-height) rather than its raw numbers, which is what "port the
// numbers as-is" has to mean once the rig it was tuned for no longer matches.
//
// Not wired into the live game yet -- nothing in main.js uses this.

import * as THREE from 'three';
import { mat, box, put } from '../preview/util.js';
import { boneIK, orientFixed, solveTwoBone } from './ik.js';
import { makeWeaponMesh } from './weaponMesh.js';

// Short Order's grip offset for a held weapon, relative to the hand
// (equip(): "slight grip tilt; hand orients along the forearm").
const GRIP_OFFSET = new THREE.Vector3(0.02, 0, 0.04);
const GRIP_TILT_X = 0.15;

// Her exact palette (preview/chef.js) -- unchanged.
const TOP = 0xb56a92;
const SKIN = 0x7a4328;
const HAIR = 0x17110d;
const TROUSER = 0x2a1f18;
const HAT = 0xf1efe6;

const cyl = (rt, rb, h, material, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material); m.castShadow = true; return m; };
const ball = (r, material, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), material); m.scale.set(sx, sy, sz); m.castShadow = true; return m; };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Bone lengths match preview/chef.js's own upper-arm/forearm cylinder heights
// (0.28, 0.26) so the IK reach matches her actual built proportions.
const UPPER_LEN = 0.28, FORE_LEN = 0.26;
const SHOULDER = { L: new THREE.Vector3(-0.34, 1.16, 0), R: new THREE.Vector3(0.34, 1.16, 0) };
const ARM_REACH = UPPER_LEN + FORE_LEN;
// Directly below each shoulder, at exactly the arm's full reach: with the
// target this far away, solveTwoBone's `d >= L1+L2` branch draws the elbow
// on the dead-straight line from shoulder to target (no bend-direction
// offset), so the whole arm -- and whatever's in the hand -- hangs exactly
// vertical, perpendicular to the ground, rather than at a diagonal.
const GUARD_TARGET = {
  L: new THREE.Vector3(SHOULDER.L.x, SHOULDER.L.y - ARM_REACH, SHOULDER.L.z),
  R: new THREE.Vector3(SHOULDER.R.x, SHOULDER.R.y - ARM_REACH, SHOULDER.R.z),
};
const BEND_DIR = new THREE.Vector3(0, 0, 1); // elbow breaks forward
const FWD = new THREE.Vector3(0, 0, 1); // the hand's/weapon's own "business end" axis

// Short Order's own shoulder anchors (makeChef's `sh` values) and total arm
// reach, for retargeting its shape data onto her differently-proportioned
// rig -- see the header comment above.
const SO_SHOULDER = { 0: new THREE.Vector3(-0.4, 1.54, 0), 1: new THREE.Vector3(0.4, 1.54, 0) };
const SO_REACH = 0.4 + 0.4;
const REACH_SCALE = (UPPER_LEN + FORE_LEN) / SO_REACH;

function retarget([x, y, z], hand) {
  const from = SO_SHOULDER[hand];
  const to = hand === 0 ? SHOULDER.L : SHOULDER.R;
  return new THREE.Vector3(
    to.x + (x - from.x) * REACH_SCALE,
    to.y + (y - from.y) * REACH_SCALE,
    to.z + (z - from.z) * REACH_SCALE
  );
}

export function buildChefRig() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);

  // --- legs (verbatim from preview/chef.js; static in this slice) ---
  const trouser = mat(TROUSER, { flat: true, rough: 0.8 });
  const shoeMat = mat(0x1a1a20, { flat: true });
  function leg() {
    const hip = new THREE.Group();
    hip.add(put(ball(0.12, trouser, 1, 0.9, 1), 0, 0, 0));
    hip.add(put(cyl(0.12, 0.095, 0.28, trouser), 0, -0.15, 0));
    const knee = new THREE.Group(); knee.position.y = -0.29; hip.add(knee);
    knee.add(put(ball(0.09, trouser), 0, 0, 0));
    knee.add(put(cyl(0.09, 0.07, 0.26, trouser), 0, -0.14, 0));
    knee.add(put(box(0.15, 0.08, 0.24, shoeMat), 0, -0.29, 0.05));
    knee.add(put(ball(0.09, shoeMat, 1.0, 0.7, 1.15), 0, -0.29, 0.17));
    return hip;
  }
  const legL = leg(); legL.position.set(-0.16, 0.5, 0); body.add(legL);
  const legR = leg(); legR.position.set(0.16, 0.5, 0); body.add(legR);

  // --- torso (verbatim) ---
  const topMat = mat(TOP, { flat: true, rough: 0.7 });
  const torso = new THREE.Group(); torso.position.y = 0.9; body.add(torso);
  const core = cyl(0.3, 0.26, 0.72, topMat, 12); core.scale.z = 0.66; torso.add(put(core, 0, 0, 0));
  torso.add(put(ball(0.15, topMat, 1, 0.85, 0.9), -0.28, 0.3, 0));
  torso.add(put(ball(0.15, topMat, 1, 0.85, 0.9), 0.28, 0.3, 0));
  const apronMat = mat(0xf1ede2, { flat: true, rough: 0.8 });
  const apron = cyl(0.3, 0.35, 0.82, apronMat, 12); apron.scale.z = 0.66; apron.castShadow = true; torso.add(put(apron, 0, -0.2, 0));
  const tie = cyl(0.325, 0.325, 0.07, mat(0x6f4626, { flat: true }), 12); tie.scale.z = 0.66; torso.add(put(tie, 0, 0.09, 0));
  torso.add(put(cyl(0.1, 0.11, 0.14, mat(SKIN, { rough: 0.72 }), 10), 0, 0.44, 0.02));
  torso.add(put(cyl(0.17, 0.19, 0.1, topMat, 12), 0, 0.37, 0.02));

  // --- head (verbatim, "her" variant) ---
  const head = new THREE.Group(); head.position.y = 1.42; body.add(head);
  const hairMat = mat(HAIR, { flat: true, rough: 0.9 });
  const UP = new THREE.Vector3(0, 1, 0);
  head.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 12), mat(SKIN, { rough: 0.72 })), 0, 0, 0.06));
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.245, 14, 12), hairMat);
  base.castShadow = true; base.position.set(0, 0.0, -0.03); base.scale.set(1.12, 0.9, 1.05); head.add(base);
  const backfill = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.33, 0.52, 12), hairMat);
  backfill.castShadow = true; backfill.position.set(0, -0.2, -0.26); backfill.scale.set(1, 1, 0.22); head.add(backfill);
  const R = 0.24, FRONT_GAP = 0.95;
  const rings = [
    { phi: 1.40, n: 16, len: 0.42 },
    { phi: 1.52, n: 20, len: 0.54 },
    { phi: 1.62, n: 22, len: 0.62 },
  ];
  for (const ring of rings) {
    const hr = R * Math.sin(ring.phi), ry = R * Math.cos(ring.phi);
    for (let i = 0; i < ring.n; i++) {
      const th = (i / ring.n) * Math.PI * 2;
      const rx = hr * Math.sin(th), rz = hr * Math.cos(th);
      if (Math.abs(Math.atan2(rx, rz)) < FRONT_GAP) continue;
      const jit = Math.sin(i * 12.9 + ring.phi * 78.2);
      const len = ring.len * (0.9 + 0.16 * (jit * 0.5 + 0.5));
      const root = new THREE.Vector3(rx, ry + 0.02, rz - 0.02);
      const dir = new THREE.Vector3(rx * 0.4, 0, rz * 1.6 - 0.1).normalize()
        .multiplyScalar(0.62 + 0.12 * jit).add(new THREE.Vector3(0, -1, 0)).normalize();
      const loc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.033, len, 5), hairMat);
      loc.castShadow = true;
      loc.quaternion.setFromUnitVectors(UP, dir);
      loc.position.copy(root).add(dir.clone().multiplyScalar(len / 2));
      head.add(loc);
    }
  }
  const hatMat = mat(HAT, { flat: true, rough: 0.85 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.28, 0.24, 12), hatMat);
  band.castShadow = true; band.position.set(0, 0.2, -0.02); head.add(band);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.055, 8, 18), hatMat);
  cuff.castShadow = true; cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.09, -0.02); head.add(cuff);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.31, 10, 8), hatMat);
  puff.castShadow = true; puff.position.set(0, 0.36, -0.02); puff.scale.set(1.12, 0.82, 1.12); head.add(puff);
  head.add(put(box(0.05, 0.06, 0.03, mat(0x120a06)), -0.09, 0.02, 0.25));
  head.add(put(box(0.05, 0.06, 0.03, mat(0x120a06)), 0.09, 0.02, 0.25));

  // --- arms: NEW -- flat IK bones instead of nested rotation groups ---
  const skinMat = mat(SKIN, { flat: true, rough: 0.7 });
  function armBones() {
    const upper = boneIK(0.095, 0.075, topMat);
    const fore = boneIK(0.072, 0.058, skinMat);
    // `hand`: a small pivot at the wrist, oriented along the forearm each
    // frame (matches Short Order's own arm.hand) -- the fist and any held
    // weapon are its children, so they move/orient together.
    const hand = new THREE.Group();
    const fist = ball(0.09, skinMat, 1, 0.95, 1.05);
    hand.add(fist);
    const weapon = makeWeaponMesh('fists'); // empty group -- bare hand by default
    weapon.position.copy(GRIP_OFFSET);
    weapon.rotation.x = GRIP_TILT_X;
    hand.add(weapon);
    body.add(upper); body.add(fore); body.add(hand);
    return { upper, fore, hand, fist, weapon, weaponKey: 'fists' };
  }
  const armL = armBones(), armR = armBones();

  g.userData = { body, torso, head, legL, legR, armL, armR };
  return g;
}

/**
 * Poses the arms for one frame. `attack` is a sim attack envelope (from
 * startAttack.js/stepCombat.js/attackShapes.js) or null/idle. `weaponKey` is
 * the chef's currently equipped weapon (a WEAPONS key, default 'fists') --
 * independent of `attack`, since the weapon is held at rest too, not just
 * mid-swing. Whichever hand is throwing (the right hand whenever a weapon is
 * equipped; otherwise the shape's own `hand` field for bare-hand punches)
 * moves toward the attack target; the other arm holds guard.
 */
export function poseChefRig(rig, attack, weaponKey = 'fists') {
  const u = rig.userData;

  if (u.armR.weaponKey !== weaponKey) {
    u.armR.hand.remove(u.armR.weapon);
    const weapon = makeWeaponMesh(weaponKey);
    weapon.position.copy(GRIP_OFFSET);
    weapon.rotation.x = GRIP_TILT_X;
    u.armR.hand.add(weapon);
    u.armR.weapon = weapon;
    u.armR.weaponKey = weaponKey;
  }

  const throwingHand = attack && attack.shape
    ? (weaponKey !== 'fists' ? 1 : attack.shape.hand)
    : undefined;

  for (const [side, arm, handIdx] of [['L', u.armL, 0], ['R', u.armR, 1]]) {
    const shoulder = SHOULDER[side];
    let target = GUARD_TARGET[side];
    if (attack && attack.shape && throwingHand === handIdx) {
      const k = clamp01(attack.t / attack.hitAt);
      const s = retarget(attack.shape.s, handIdx);
      const e = retarget(attack.shape.e, handIdx);
      target = s.lerp(e, k);
    }
    const elbow = new THREE.Vector3();
    solveTwoBone(arm.upper, arm.fore, shoulder, target, UPPER_LEN, FORE_LEN, BEND_DIR, elbow);
    // Ported from Short Order's own hand posing (poseChef): the hand sits AT
    // the target directly (not at the forearm bone's true, possibly-short-of-
    // target endpoint), facing elbow->target. Its local +Z ("business end",
    // matching weaponMesh.js's own convention) aligns to that direction --
    // NOT a copy of the forearm bone's quaternion, which aligns local +Y and
    // leaves the roll around it undefined. Using the bone's quaternion here
    // was tried first and produced a twisted, "backhanded" grip once a
    // weapon mesh made the wrong roll visible; this is the actual fix.
    arm.hand.position.copy(target);
    const dir = target.clone().sub(elbow);
    if (dir.lengthSq() > 1e-6) {
      dir.normalize();
      arm.hand.quaternion.setFromUnitVectors(FWD, dir);
    }
  }
}
