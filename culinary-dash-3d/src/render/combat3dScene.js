// Renders sim/combat3d.js's `brawl3d` entities -- the chef's IK rig
// (render/chefRig.js) plus a placeholder mesh per mob. Kept separate from
// render/scene.js's syncScene, which still drives the OLD placeholder chef/
// enemies for the 'service'/'brawl' phases, completely untouched.
//
// The mob mesh is a plain placeholder (icosahedron + health bar, matching
// meshes.js's buildEnemy's visual weight) -- not a real mob roster (CLAUDE.md
// sequencing step 4, not designed yet), same spirit as combat3d.js's
// "punching bag" entity itself.
//
// Camera: still the existing fixed diorama camera (engine/camera.js).
// Splitting the camera by context (invariant 9) is separate, later work --
// not part of this slice.

import * as THREE from 'three';
import { buildChefRig, poseChefRig } from './chefRig.js';

const BAG_COLOR = 0x8a6a4a;

function buildBagMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: BAG_COLOR, roughness: 0.8, flatShading: true })
  );
  body.position.y = 0.9;
  body.scale.set(1, 1.3, 1);
  body.castShadow = true;
  g.add(body);
  g.userData.body = body;

  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.12, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x66ff88 })
  );
  bar.position.y = 1.9;
  g.add(bar);
  g.userData.bar = bar;
  return g;
}

export function buildCombat3DRefs(scene) {
  const rig = buildChefRig();
  rig.visible = false;
  scene.add(rig);
  return { rig, bagMeshes: new Map(), scene };
}

export function syncCombat3D(refs, state) {
  const active = state.phase === 'brawl3d' && !!state.combat3d;
  refs.rig.visible = active;
  if (!active) {
    for (const [, g] of refs.bagMeshes) g.visible = false;
    return;
  }

  const [chef, ...mobs] = state.combat3d.entities;
  refs.rig.position.set(chef.pos.x, 0, chef.pos.z);
  refs.rig.rotation.y = chef.facing;
  poseChefRig(refs.rig, chef.attack, chef.wpn);

  const live = new Set();
  for (const mob of mobs) {
    live.add(mob.id);
    let g = refs.bagMeshes.get(mob.id);
    if (!g) { g = buildBagMesh(); refs.bagMeshes.set(mob.id, g); refs.scene.add(g); }
    g.visible = !mob.dead;
    g.position.set(mob.pos.x, 0, mob.pos.z);
    g.rotation.y = mob.facing;
    const frac = Math.max(0, mob.hp) / mob.maxHp;
    g.userData.bar.scale.x = Math.max(0.001, frac);
    g.userData.bar.material.color.setHex(frac > 0.5 ? 0x66ff88 : frac > 0.2 ? 0xffcf4a : 0xff5566);
  }
  for (const [id, g] of refs.bagMeshes) {
    if (!live.has(id)) { refs.scene.remove(g); refs.bagMeshes.delete(id); }
  }
}
