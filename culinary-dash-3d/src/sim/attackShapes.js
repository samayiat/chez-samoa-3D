// Attack pose data, ported verbatim from Short Order (../public/short-order/index.html,
// `const SWINGS`/`PUNCHES`/`FINISH`/`PUNCH_FINISH`). Pure data, no THREE.js — each shape
// is a windup point `s` and a strike point `e` in upper-local space (weapon hand), an
// elbow pole `bend`, body coil/follow twist, and a forward lean. Consumed by the ported
// IK (see CLAUDE.md invariant 1: bones are length-locked, never target-clamped) to pose
// the swing/punch; not wired into gameplay yet.
//
// `startAttack` selects a shape by `A.comboStep % shapes.length` (weapon swings) or by
// `hand`-alternating bare-hand punches; the heavy variant always uses the finisher.
// Kept as separate exports (not folded into WEAPONS) because they're keyed by combo
// position, not by weapon.

// Weapon-swing combo cycle: distinct swing shapes so a chain reads as
// forehand -> backhand -> chop, not the same swing on repeat.
export const SWINGS = [
  { name: 'forehand', s: [0.55, 1.62, -0.10], e: [-0.46, 1.36, 0.92], bend: [0.95, -0.55, 0.4],  coil: 0.50,  follow: -0.72, lean: 0.26 },
  { name: 'backhand', s: [-0.50, 1.54, -0.05], e: [0.56, 1.38, 0.92], bend: [-0.95, -0.55, 0.4], coil: -0.50, follow: 0.72,  lean: 0.26 },
  { name: 'chop',     s: [0.28, 2.05, -0.12], e: [-0.10, 1.04, 0.86], bend: [0.5, -1, 0.5],      coil: 0.32,  follow: -0.46, lean: 0.34 },
];

// Heavy-weapon finisher.
export const FINISH = { name: 'smash', s: [0.12, 2.20, -0.28], e: [0.00, 0.92, 0.96], bend: [0.35, -1, 0.5], coil: 0.42, follow: -0.86, lean: 0.44 };

// Bare-hands: a jab, jab, hook, uppercut cycle. `hand` = which fist throws
// (0 = left, 1 = right); the other stays up in guard. Straight punches fire
// out from the shoulder.
export const PUNCHES = [
  { name: 'jab',  hand: 0, s: [-0.22, 1.42, 0.28], e: [-0.05, 1.56, 1.02], bend: [-0.35, -0.45, 0.5], coil: 0.16,  follow: -0.22, lean: 0.18 },
  { name: 'jab',  hand: 1, s: [0.22, 1.42, 0.28],  e: [0.05, 1.56, 1.02],  bend: [0.35, -0.45, 0.5],  coil: -0.16, follow: 0.22,  lean: 0.18 },
  { name: 'hook', hand: 0, s: [-0.50, 1.52, 0.14], e: [0.26, 1.46, 0.86],  bend: [-0.95, -0.35, 0.3], coil: 0.5,   follow: -0.72, lean: 0.28 },
  { name: 'upper', hand: 1, s: [0.28, 1.04, 0.40], e: [0.12, 1.78, 0.72],  bend: [0.4, -0.9, 0.5],    coil: 0.42,  follow: -0.55, lean: 0.36 },
];

// Heavy bare-hand = the uppercut (same object, not a copy — matches Short Order).
export const PUNCH_FINISH = PUNCHES[3];
