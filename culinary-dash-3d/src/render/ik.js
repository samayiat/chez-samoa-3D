// Two-bone IK, ported verbatim from Short Order (../../public/short-order/
// index.html: orientFixed, solveTwoBone, boneIK). This is CLAUDE.md invariant 1
// in code form: bones are LENGTH-LOCKED, never target-clamped. A bone mesh is
// always drawn at exactly its own length; if the target is out of reach, the
// limb simply falls short instead of stretching. Do not "fix" limb stretching
// by clamping the IK target instead -- that regressed twice in Short Order and
// is exactly what this file exists to avoid re-learning.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// Scratch vectors, reused across calls (matches Short Order's own pattern) --
// solveTwoBone runs per limb per frame, so avoiding per-call allocation here
// is a deliberate, proven perf choice, not an oversight.
const _tb = new THREE.Vector3(), _dirN = new THREE.Vector3(), _bnd = new THREE.Vector3(),
  _jnt = new THREE.Vector3(), _om = new THREE.Vector3(), _kt = new THREE.Vector3(), _knee = new THREE.Vector3();

/** A plain unit-height cylinder mesh, meant to be posed by orientFixed(). */
export function boneIK(r1, r2, material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 1, 8), material);
  m.castShadow = true;
  return m;
}

/**
 * Draws `mesh` as a bone of exactly length `L`, anchored at `a` and pointing
 * at `b`. Never stretches: if `a`/`b` are farther apart than `L`, the mesh
 * still ends exactly `L` from `a`, short of `b`.
 */
export function orientFixed(mesh, a, b, L) {
  _om.subVectors(b, a);
  const d = _om.length();
  if (d < 1e-5) _om.set(0, -1, 0); else _om.divideScalar(d);
  mesh.position.copy(a).addScaledVector(_om, L * 0.5);
  mesh.scale.set(1, L, 1);
  mesh.quaternion.setFromUnitVectors(UP, _om);
}

/**
 * Solves a two-bone chain (upper + lower segment) from `root` reaching for
 * `tip`, with lengths L1/L2 and a preferred bend direction. Draws both bone
 * meshes via orientFixed and, if given, writes the solved joint (elbow/knee)
 * position into `outJoint`.
 */
export function solveTwoBone(b1, b2, root, tip, L1, L2, bendDir, outJoint) {
  _tb.subVectors(tip, root);
  let d = _tb.length();
  if (d < 1e-4) { _tb.set(0, -1, 0); d = 1e-4; }
  _dirN.copy(_tb).divideScalar(d);

  if (d >= L1 + L2) {
    _jnt.copy(root).addScaledVector(_dirN, d * (L1 / (L1 + L2)));
  } else {
    _bnd.copy(bendDir);
    _bnd.addScaledVector(_dirN, -_bnd.dot(_dirN));
    if (_bnd.lengthSq() < 1e-5) { _bnd.set(0, -1, 0).addScaledVector(_dirN, _dirN.y); }
    _bnd.normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    _jnt.copy(root).addScaledVector(_dirN, a).addScaledVector(_bnd, h);
  }

  _kt.subVectors(_jnt, root);
  const kl = _kt.length();
  if (kl > 1e-5) _kt.divideScalar(kl); else _kt.set(0, -1, 0);
  _knee.copy(root).addScaledVector(_kt, L1);

  orientFixed(b1, root, _knee, L1);
  orientFixed(b2, _knee, tip, L2);
  if (outJoint) outJoint.copy(_knee);
}
