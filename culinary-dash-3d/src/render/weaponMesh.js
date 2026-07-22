// Weapon meshes, ported from Short Order's makeWeaponMesh() (../../public/
// short-order/index.html). Business end points +Z out of the hand; the
// caller orients the returned group along the wielding forearm. `fists`
// returns an empty group (bare hands need no mesh).
//
// Crude, readable silhouettes -- Short Order's own CLAUDE.md already flags
// "no art pass" as a known gap there; this is the same tier, not a step down.
//
// Not wired into gameplay yet.

import * as THREE from 'three';
import { WEAPONS } from '../sim/weapons.js';

const TAU = Math.PI * 2;
const M = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, flatShading: true });

function handle(group, len, rad, col) {
  const h = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.9, len, 8), M(col || 0x5a3a1c, 0.6, 0.1));
  h.rotation.x = Math.PI / 2;
  h.position.z = len / 2;
  h.castShadow = true;
  group.add(h);
  return h;
}

export function makeWeaponMesh(key) {
  const g = new THREE.Group();
  if (key === 'fists') return g;
  const w = WEAPONS[key];

  if (key === 'spatula') {
    handle(g, 0.42, 0.045, 0x6a4a22);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.22), M(0xb8bcc2, 0.4, 0.7));
    neck.position.z = 0.55; g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.34), M(w.tint, 0.4, 0.6));
    head.position.z = 0.82; head.castShadow = true;
    for (let i = -1; i < 2; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.34), M(0x2a2a2a, 0.6, 0.3));
      s.position.set(i * 0.08, 0, 0.82); g.add(s);
    }
    g.add(head);
  } else if (key === 'nonstick' || key === 'castiron') {
    handle(g, 0.5, 0.05, key === 'castiron' ? 0x141416 : 0x24140a);
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.12, 20), M(w.tint, 0.3, key === 'castiron' ? 0.35 : 0.5));
    pan.position.z = 0.86; pan.castShadow = true; g.add(pan);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.02, 20), M(key === 'castiron' ? 0x0f0f10 : 0x3a3a40, 0.5, 0.3));
    inner.position.set(0, 0.06, 0.86); g.add(inner);
  } else if (key === 'knife') {
    handle(g, 0.24, 0.045, 0x1c1c22);
    const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.06), M(0x9aa0a6, 0.3, 0.8));
    bolster.position.z = 0.32; g.add(bolster);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.5), M(w.tint, 0.15, 0.9));
    blade.position.z = 0.62; blade.castShadow = true; g.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 4), M(w.tint, 0.15, 0.9));
    tip.rotation.x = Math.PI / 2; tip.position.z = 0.94; g.add(tip);
  } else if (key === 'potlid') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 10, 0, TAU, 0, Math.PI / 2.4), M(w.tint, 0.28, 0.65));
    dome.rotation.x = Math.PI / 2; dome.position.z = 0.35; dome.castShadow = true; g.add(dome);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M(0x2a2a2a, 0.5, 0.3));
    knob.position.z = 0.5; g.add(knob);
  }
  return g;
}
