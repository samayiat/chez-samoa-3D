// Weapon table, ported verbatim from Short Order (../public/short-order/index.html,
// `const WEAPONS`). Pure data, no THREE.js — matches this project's sim/data.js
// house style. Numbers are kept exactly as Short Order tuned them (the "Short
// Order's numbers win" balance decision in CLAUDE.md); this file only exists so
// `sim/` has them available in this project's own layout.
//
// Not wired into gameplay yet — see culinary-dash-3d/CLAUDE.md's sequencing.
// This project's existing (unrelated, 2D-derived) `WEAPONS` export in data.js
// belongs to the old combat system being replaced; it is untouched by this file.
//
// Field meaning (from Short Order): reach/light/heavy/wind/rec/stagger are combat
// tuning; gbreak = can break an enemy's guard; knock = knocks enemies down; dur =
// durability in hits before breaking (Infinity for fists); shake = screen-shake
// weight; heft = the single "weight" value driving impact feedback (see CLAUDE.md
// invariant 2); metal = clangs/sparks on block; thrust/shield = weapon-specific
// stance flags; tint = base mesh color.
export const WEAPONS = {
  fists:    { key: 'fists',    name: 'Bare Hands',   cls: 'light',  reach: 1.05, light: 5,  heavy: 9,  wind: 0.11, rec: 0.15, stagger: 0.30, gbreak: false, knock: false, dur: Infinity, shake: 0.20, heft: 0.12, metal: false, tint: 0xd8b38a },
  spatula:  { key: 'spatula',  name: 'Spatula',      cls: 'light',  reach: 1.65, light: 6,  heavy: 11, wind: 0.10, rec: 0.14, stagger: 0.35, gbreak: false, knock: false, dur: 24,       shake: 0.24, heft: 0.20, metal: true,  tint: 0xd7d2c4 },
  nonstick: { key: 'nonstick', name: 'Nonstick Pan', cls: 'medium', reach: 1.6,  light: 9,  heavy: 18, wind: 0.17, rec: 0.24, stagger: 0.65, gbreak: false, knock: false, dur: 18,       shake: 0.5,  heft: 0.58, metal: true,  tint: 0x2b2b2f },
  castiron: { key: 'castiron', name: 'Cast Iron',    cls: 'heavy',  reach: 1.7,  light: 16, heavy: 32, wind: 0.34, rec: 0.44, stagger: 1.25, gbreak: true,  knock: true,  dur: 12,       shake: 1.0,  heft: 1.0,  metal: true,  tint: 0x1a1a1c },
  knife:    { key: 'knife',    name: "Chef's Knife", cls: 'light',  reach: 1.85, light: 8,  heavy: 15, wind: 0.10, rec: 0.13, stagger: 0.30, gbreak: false, knock: false, dur: 14,       shake: 0.28, heft: 0.24, metal: true,  thrust: true, tint: 0xdfe6ea },
  potlid:   { key: 'potlid',   name: 'Pot Lid',      cls: 'shield', reach: 1.1,  light: 4,  heavy: 7,  wind: 0.15, rec: 0.20, stagger: 0.30, gbreak: false, knock: false, dur: 30,       shake: 0.20, heft: 0.30, metal: true,  shield: true, tint: 0xb9c4cc },
};
