// Manual debug probe for the new combat (brawl3d), in the spirit of Short
// Order's own ad-hoc harness.js probes -- a plain Node script that drives real
// sim frames and prints live state, for poking at things by hand between
// automated test runs.
//
// Unlike Short Order's probes, this needs no THREE.js/DOM stubbing: sim/ here
// has never depended on THREE.js (that's the whole point of the sim/render
// split), so a Node script can just import and drive it directly.
//
// Usage:
//   node probe-brawl3d.mjs                 # default scenario: 3 charged swings at a bag
//   node probe-brawl3d.mjs --heavy         # hold long enough to fire heavy swings instead
//   node probe-brawl3d.mjs --bags 3        # spawn more punching bags
//
// Exits 0 and prints "PROBE: PASS" if the bag's hp actually dropped and
// nothing threw; exits 1 and prints "PROBE: FAIL" otherwise -- a quick
// pass/fail signal, same spirit as harness.js's own PASS convention, without
// pretending this replaces the real Vitest suite.

import { createState, stepSim } from './src/sim/state.js';
import { startBrawl3D } from './src/sim/combat3d.js';
import { HEAVY_HOLD } from './src/sim/chargedAttack.js';

const args = process.argv.slice(2);
const heavy = args.includes('--heavy');
const bagsIdx = args.indexOf('--bags');
const bagCount = bagsIdx >= 0 ? Number(args[bagsIdx + 1]) || 1 : 1;

const STEP = 1 / 60;
const NO = { move: { x: 0, y: 0 }, primary: false, primaryDown: false, secondary: false, secondaryDown: false };
const HOLD = { ...NO, primary: true };

function logEntity(tag, e) {
  console.log(
    `[${tag}] ${e.id.padEnd(6)} pos=(${e.pos.x.toFixed(2)},${e.pos.z.toFixed(2)}) ` +
    `hp=${e.hp.toFixed(1)}/${e.maxHp} dead=${e.dead} attack=${e.attack ? `${e.attack.wpn}${e.attack.heavy ? '(heavy)' : ''} t=${e.attack.t.toFixed(3)}/${e.attack.dur.toFixed(3)}` : 'none'}`
  );
}

const state = createState();
startBrawl3D(state, bagCount);
const [chef, ...bags] = state.combat3d.entities;

console.log(`--- probe-brawl3d.mjs: ${bagCount} bag(s), ${heavy ? 'heavy' : 'light'} swings ---`);
logEntity('start', chef);
bags.forEach((b) => logEntity('start', b));

const startHp = bags.map((b) => b.hp);
const holdFrames = heavy ? Math.ceil((HEAVY_HOLD + 0.05) / STEP) : 3;
let crashed = null;

try {
  for (let swing = 0; swing < 3; swing++) {
    for (let i = 0; i < holdFrames; i++) stepSim(state, STEP, HOLD);
    stepSim(state, STEP, NO); // release -> starts the swing
    // let it wind up, land, and recover before the next swing
    for (let i = 0; i < 40; i++) {
      stepSim(state, STEP, NO);
      if (state.combat3d.events.length) {
        for (const ev of state.combat3d.events) {
          console.log(`  hit: ${ev.attackerId} -> ${ev.targetId}  dmg=${ev.damage.toFixed(2)} weight=${ev.weight.toFixed(2)} blocked=${ev.blocked}`);
        }
      }
    }
    logEntity(`after swing ${swing + 1}`, chef);
    bags.forEach((b) => logEntity(`after swing ${swing + 1}`, b));
  }
} catch (err) {
  crashed = err;
}

const anyDamage = bags.some((b, i) => b.hp < startHp[i]);
const ok = !crashed && anyDamage;

console.log('---');
if (crashed) console.log('CRASHED:', crashed.stack);
console.log(`damage dealt: ${anyDamage}`);
console.log(ok ? 'PROBE: PASS' : 'PROBE: FAIL');
process.exit(ok ? 0 : 1);
