// Standalone preview entry for chef-rig-preview.html -- renders the new
// IK-rigged chef (render/chefRig.js) alone against a plain floor, for visual
// spot-checking during the rig's development. Not part of the main game.
import * as THREE from 'three';
import { buildChefRig, poseChefRig } from './render/chefRig.js';
import { PUNCHES, SWINGS, FINISH } from './sim/attackShapes.js';
import { WEAPONS } from './sim/weapons.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(900, 900);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x201828);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
camera.position.set(0, 1.3, 3.4);
camera.lookAt(0, 1.0, 0);

scene.add(new THREE.HemisphereLight(0xfff2d8, 0x201828, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(2, 3, 2);
scene.add(key);

const floor = new THREE.Mesh(new THREE.CircleGeometry(2, 24), new THREE.MeshStandardMaterial({ color: 0x2a2233 }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const rig = buildChefRig();
scene.add(rig);
poseChefRig(rig, null); // idle by default

function render() { renderer.render(scene, camera); }
render();

// Exposed for the Playwright verify script to drive.
window.__rigPreview = {
  rig,
  setIdle(weaponKey = 'fists') { poseChefRig(rig, null, weaponKey); render(); },
  setPunch(t, hand = 0) {
    poseChefRig(rig, { t, hitAt: 0.11, shape: PUNCHES[hand === 0 ? 0 : 1] }, 'fists');
    render();
  },
  // weaponKey: a WEAPONS key (e.g. 'castiron', 'knife'); heavy: use the
  // FINISH shape instead of cycling SWINGS; swingIdx picks which SWINGS
  // entry for a light swing. hitAt matches startAttack.js's own formula
  // (wind * 1.5 for heavy) so t=hitAt lines up with the real strike moment.
  setSwing(t, weaponKey, heavy = false, swingIdx = 0) {
    const shape = heavy ? FINISH : SWINGS[swingIdx % SWINGS.length];
    const hitAt = WEAPONS[weaponKey].wind * (heavy ? 1.5 : 1);
    poseChefRig(rig, { t, hitAt, shape }, weaponKey);
    render();
  },
  ready: true,
};
