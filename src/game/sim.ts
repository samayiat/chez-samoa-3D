// ============================================================================
// Chez Samoa 3D — simulation core. A plain mutable singleton (no React state)
// ticked from the render loop; HUD polls it, 3D components read it per frame.
// Faithfully adapted from the original Culinary Dash systems.
// ============================================================================
import {
  FLOOR, STATIONS, CRATE, BAR_GIN, BAR_MIX, BAR_WSK, PASS, PASS_SLOTS, TRASH,
  DOOR, TABLES, BENCH, PLANTS, DISHES, MENU, NOPE, CAST,
  DAY_LEN, HEARTS_MAX, PATIENCE_DRAIN, SPEED_TIP_MAX, SPEED_TIP_WINDOW,
  BAD_ORDER_WINDOW, COMBO_WINDOW, COOK_BURN_HOLD, CHEF_SPEED, CARRY_SLOW,
  BRAWL_TIME, CHEF_HP, ENEMY_HP, PUNCH_DMG, PUNCH_REACH, PUNCH_CD, ENEMY_SPEED,
  THIEF_SPEED, LUNGE_DMG, DRINK_PERMANENT_AT, WASTED_AT, WAVE_COUNT, NIGHT_TIME,
  priceMult, spawnMult, brawlChance, brawlSizeMult, nightBottlePrice,
} from "./constants";
import type { CastDef, CarryItem } from "./constants";
import { sfx, startClubMusic, stopMusic } from "./audio";

export type Phase = "title" | "day" | "brawl" | "night" | "results";

export interface Cust {
  id: number; cast: CastDef; x: number; z: number; dir: number;
  state: "walkin" | "bench" | "totable" | "thinking" | "waiting" | "badorder" | "eating" | "leaving" | "gone";
  table: number; bench: number;
  order: string | null; badItem: string | null;
  t: number; orderT: number; patience: number; // patience 0..1
  angry: boolean; servedDish: string | null; walkPh: number;
}

export type EnemyKind = "chaser" | "smasher" | "thief";
export interface Enemy {
  id: number; kind: EnemyKind; cast: CastDef;
  x: number; z: number; dir: number; hp: number;
  state: "walk" | "windup" | "lunge" | "raid" | "flee" | "hurt" | "ko";
  t: number; tx: number; tz: number; raidT: number; steal: CarryItem | null;
  buffed: boolean; koT: number; walkPh: number; station: string | null;
}

export interface StationRt { state: "idle" | "cooking" | "green" | "burnt" | "assembling" | "ready" | "broken"; t: number }
export interface NightGroup {
  id: number; size: number; table: number; x: number; z: number;
  state: "walkin" | "ordering" | "partying" | "leaving" | "gone";
  t: number; price: number; members: CastDef[]; walkPh: number;
}
export interface Flash { x: number; y: number; z: number; text: string; color: string; t: number; dur: number; big?: boolean }
export interface Burst { x: number; y: number; z: number; colors: string[]; n: number; sp: number; up: number; life: number; grav: number; size: number }

export interface Results {
  served: number; lost: number; shooed: number; dayMoney: number; tips: number;
  brawl: "none" | "win" | "lose"; beliDelta: number; nightMoney: number; bottles: number;
  total: number; beli: number; barDead: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist2 = (ax: number, az: number, bx: number, bz: number) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

class Sim {
  phase: Phase = "title";
  paused = false;
  time = 0;

  // chef
  chef = {
    x: 0, z: 2.5, dir: Math.PI, moving: false, walkPh: 0,
    carry: null as CarryItem | null,
    hp: CHEF_HP, drinks: 0, buffT: 0, wastedT: 0,
    punchT: 0, punchAnim: 0, comboStep: 0, comboT: 0, chugT: 0, hurtT: 0,
  };
  input = { x: 0, z: 0 };

  // room
  customers: Cust[] = [];
  tables = TABLES.map((t) => ({ ...t, cust: -1, plate: null as string | null }));
  bench = BENCH.map((b) => ({ ...b, cust: -1 }));
  stations: Record<string, StationRt & { broken: boolean }> = {};
  passSlots = PASS_SLOTS.map((s) => ({ ...s, item: null as CarryItem | null }));
  plants = PLANTS.map((p) => ({ ...p, broken: false, hp: 3.2 }));
  barBroken = false;
  barHp = 6;

  // day
  dayT = DAY_LEN; spawnT = 2; money = 0; tipsEarned = 0;
  served = 0; lost = 0; shooed = 0; badLedger = 0;
  combo = 0; comboT = 0;
  beli = 6.0;
  lastCall = false;

  // brawl
  enemies: Enemy[] = [];
  brawl = null as null | {
    t: number; wave: number; waveT: number; toSpawn: number; spawnT: number;
    live: boolean; liveT: number; liveDelay: number; over: boolean; result: "win" | "lose" | null;
    endT: number; beliDelta: number; criticHere: boolean;
  };
  spectators: { x: number; z: number; cast: CastDef; table: number }[] = [];

  // night
  night = null as null | { t: number; spawnT: number; sales: number; bottles: number };
  groups: NightGroup[] = [];

  // fx
  flashes: Flash[] = [];
  frameBursts: Burst[] = [];
  shake = 0; hitstop = 0; cheerT = 0; strobe = 0;

  results: Results | null = null;
  private nextId = 1;

  constructor() { this.resetStations(); }

  resetStations() {
    for (const s of STATIONS) this.stations[s.id] = { state: "idle", t: 0, broken: false };
  }

  // ------------------------------------------------------------- lifecycle
  startRun() {
    this.phase = "day";
    this.customers = []; this.enemies = []; this.groups = []; this.spectators = [];
    this.resetStations();
    for (const t of this.tables) { t.cust = -1; t.plate = null; }
    for (const b of this.bench) b.cust = -1;
    for (const s of this.passSlots) s.item = null;
    for (const p of this.plants) { p.broken = false; p.hp = 3.2; }
    this.barBroken = false; this.barHp = 6;
    this.dayT = DAY_LEN; this.spawnT = 1.5;
    this.money = 0; this.tipsEarned = 0; this.served = 0; this.lost = 0; this.shooed = 0; this.badLedger = 0;
    this.combo = 0; this.comboT = 0; this.lastCall = false;
    this.brawl = null; this.night = null; this.results = null;
    this.chef.x = 0; this.chef.z = 2.5; this.chef.carry = null; this.chef.hp = CHEF_HP;
    this.chef.drinks = 0; this.chef.buffT = 0; this.chef.wastedT = 0;
    this.flashes = []; this.shake = 0; this.hitstop = 0;
    sfx("click");
  }

  toTitle() { this.phase = "title"; this.results = null; this.enemies = []; this.groups = []; this.customers = []; }

  // ------------------------------------------------------------- helpers
  flash(x: number, y: number, z: number, text: string, color = "#fff", dur = 1.1, big = false) {
    this.flashes.push({ x, y, z, text, color, t: 0, dur, big });
    if (this.flashes.length > 24) this.flashes.shift();
  }
  burst(x: number, y: number, z: number, colors: string[], n = 10, sp = 3, up = 3, life = 0.6, grav = 6, size = 1) {
    this.frameBursts.push({ x, y, z, colors, n, sp, up, life, grav, size });
  }
  addShake(a: number) { this.shake = Math.min(1.2, this.shake + a); }

  custAt(table: number) { return this.customers.find((c) => c.table === table && c.state !== "leaving" && c.state !== "gone"); }

  // ------------------------------------------------------------- day logic
  spawnCustomer() {
    const freeTable = this.tables.findIndex((t) => t.cust === -1);
    const freeBench = this.bench.findIndex((b) => b.cust === -1);
    if (freeTable === -1 && freeBench === -1) return;
    const cast = CAST[Math.floor(Math.random() * CAST.length)];
    const c: Cust = {
      id: this.nextId++, cast, x: DOOR.x + 1.5, z: DOOR.z, dir: Math.PI / 2,
      state: "walkin", table: -1, bench: -1,
      order: null, badItem: null, t: 0, orderT: 0, patience: 1, angry: false,
      servedDish: null, walkPh: Math.random() * 6,
    };
    // seat directly if a table is free and nobody is queueing, else bench
    if (freeTable !== -1 && this.bench.every((b) => b.cust === -1)) {
      c.state = "totable"; c.table = freeTable; this.tables[freeTable].cust = c.id;
    } else if (freeBench !== -1) {
      c.state = "walkin"; c.bench = freeBench; this.bench[freeBench].cust = c.id;
    } else if (freeTable !== -1) {
      c.state = "totable"; c.table = freeTable; this.tables[freeTable].cust = c.id;
    } else return;
    this.customers.push(c);
    sfx("bell");
  }

  promoteBench() {
    for (const b of this.bench) {
      if (b.cust === -1) continue;
      const freeTable = this.tables.findIndex((t) => t.cust === -1);
      if (freeTable === -1) return;
      const c = this.customers.find((k) => k.id === b.cust);
      if (!c) { b.cust = -1; continue; }
      b.cust = -1; c.bench = -1; c.table = freeTable; c.state = "totable";
      this.tables[freeTable].cust = c.id;
    }
  }

  placeOrder(c: Cust) {
    c.orderT = 0; c.patience = 1;
    if (Math.random() < 0.30) {
      c.state = "badorder"; c.badItem = c.cast.bad; c.t = 0;
    } else {
      c.state = "waiting";
      c.order = MENU[Math.floor(Math.random() * MENU.length)];
    }
    sfx("order");
  }

  serveCustomer(c: Cust) {
    const item = this.chef.carry!;
    const d = DISHES[c.order!];
    const base = item.quality === "burnt" ? (d.burnt ?? d.perfect) : d.perfect;
    const speedMult = 1 + SPEED_TIP_MAX * Math.max(0, 1 - c.orderT / SPEED_TIP_WINDOW);
    const pay = Math.round(base * (1 + 0.35 * (this.combo)) * speedMult * priceMult(this.beli));
    const tip = Math.max(0, pay - Math.round(base * priceMult(this.beli)));
    this.money += pay; this.tipsEarned += tip; this.served++;
    this.combo = Math.min(9, this.combo + 1); this.comboT = COMBO_WINDOW;
    const perfect = item.quality !== "burnt";
    this.beli = clamp(this.beli + (perfect ? 0.06 : -0.05) * (c.cast.id === "critic" ? 3 : 1), 1, 10);
    this.tables[c.table].plate = c.order;
    c.state = "eating"; c.t = 0; c.servedDish = c.order;
    this.chef.carry = null;
    this.flash(c.x, 2.6, c.z, `+$${pay}${tip > 0 ? " 💰" : ""}`, perfect ? "#ffd86b" : "#c9b18a");
    if (perfect) {
      sfx("perfect");
      this.burst(c.x, 2.2, c.z, ["#ffd86b", "#fff3c4", "#8be27a"], 16, 3, 3.5, 0.7, 5, 1);
    } else {
      sfx("serve");
      this.burst(c.x, 2.2, c.z, ["#8be27a", "#e9d8b8"], 8, 2, 2.5, 0.5, 5, 1);
    }
    setTimeout(() => sfx("cash"), 200);
  }

  waveOff(c: Cust) {
    c.state = "leaving"; c.t = 0; c.angry = false;
    this.shooed++;
    const reward = 4 + this.combo * 2;
    this.money += reward;
    this.combo = Math.min(9, this.combo + 1); this.comboT = COMBO_WINDOW;
    this.beli = clamp(this.beli + 0.03, 1, 10);
    this.cheerT = 1.2;
    sfx("shoo"); setTimeout(() => sfx("cheer"), 150);
    this.burst(c.x, 2.4, c.z, ["#ffd86b", "#ff9de2", "#8be27a", "#7cc4ff"], 26, 4, 5, 1.0, 6, 1.2);
    this.flash(c.x, 2.8, c.z, `not on the menu! +$${reward}`, "#ff9de2");
    if (c.bench >= 0) this.bench[c.bench].cust = -1;
    if (c.table >= 0) this.tables[c.table].cust = -1;
  }

  custLeave(c: Cust, angry: boolean) {
    c.state = "leaving"; c.t = 0; c.angry = angry;
    if (c.bench >= 0) this.bench[c.bench].cust = -1;
    if (c.table >= 0) { this.tables[c.table].cust = -1; this.tables[c.table].plate = null; }
    if (angry) { this.lost++; sfx("walkout"); }
  }

  tickDay(dt: number) {
    if (this.dayT > 0) {
      this.dayT -= dt;
      if (this.dayT <= 0) { this.lastCall = true; this.flash(0, 3.9, 0, "LAST CALL", "#ffd86b", 2, true); sfx("bell"); }
    }
    // spawns
    if (!this.lastCall) {
      this.spawnT -= dt;
      const active = this.customers.filter((c) => c.state !== "leaving" && c.state !== "gone").length;
      if (this.spawnT <= 0 && active < 8) {
        this.spawnCustomer();
        this.spawnT = rand(4.5, 8) * spawnMult(this.beli);
      }
    }
    this.promoteBench();

    // customers
    for (const c of this.customers) {
      c.walkPh += dt * 8;
      switch (c.state) {
        case "walkin": {
          const b = this.bench[c.bench];
          if (this.walkTo(c, b.x, b.z + 0.6, dt, 2.4)) c.state = "bench";
          break;
        }
        case "bench": break; // waiting for promotion
        case "totable": {
          const t = this.tables[c.table];
          if (this.walkTo(c, t.x, t.z + 0.95, dt, 2.4)) { c.state = "thinking"; c.t = rand(1.2, 2.6); }
          break;
        }
        case "thinking":
          c.t -= dt; if (c.t <= 0) this.placeOrder(c);
          break;
        case "waiting": {
          c.orderT += dt;
          c.patience = Math.max(0, c.patience - PATIENCE_DRAIN * dt / HEARTS_MAX * HEARTS_MAX);
          c.patience = Math.max(0, 1 - c.orderT / (HEARTS_MAX / PATIENCE_DRAIN));
          if (c.patience <= 0) {
            this.beli = clamp(this.beli - 0.18 * (c.cast.id === "critic" ? 2.5 : 1), 1, 10);
            this.flash(c.x, 2.6, c.z, "walked out!", "#e86a5a");
            this.custLeave(c, true);
          }
          break;
        }
        case "badorder":
          c.t += dt; c.orderT += dt;
          if (c.t > BAD_ORDER_WINDOW) {
            this.badLedger++;
            this.beli = clamp(this.beli - 0.12, 1, 10);
            this.flash(c.x, 2.6, c.z, "stormed out!", "#e86a5a");
            this.custLeave(c, true);
          }
          break;
        case "eating":
          c.t += dt;
          if (c.t > 4) this.custLeave(c, false);
          break;
        case "leaving":
          if (this.walkTo(c, DOOR.x + 1.5, DOOR.z, dt, c.angry ? 3.4 : 2.6)) c.state = "gone";
          break;
      }
    }
    this.customers = this.customers.filter((c) => c.state !== "gone");

    // stations
    for (const id in this.stations) {
      const st = this.stations[id];
      const def = STATIONS.find((s) => s.id === id)!;
      if (st.state === "cooking") {
        st.t += dt;
        if (st.t >= (def.cook ?? 2)) { st.state = "green"; st.t = 0; sfx("done"); }
      } else if (st.state === "green") {
        st.t += dt;
        if (st.t >= (def.green ?? 1.5)) { st.state = "burnt"; st.t = 0; sfx("burn"); this.flash(def.x, 2.4, def.z, "burnt!", "#e86a5a"); }
      } else if (st.state === "burnt") {
        st.t += dt;
        if (st.t > COOK_BURN_HOLD) { st.state = "idle"; st.t = 0; }
      } else if (st.state === "assembling") {
        st.t += dt;
        if (st.t > 1.3) { st.state = "ready"; st.t = 0; sfx("done"); }
      }
    }

    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

    // end of day: timer done and room empty
    const active = this.customers.some((c) => c.state !== "leaving" && c.state !== "gone");
    if (this.lastCall && !active && this.customers.length === 0) this.endDay();
  }

  endDay() {
    // the mob? original: >4 unsellable orders, else a Beli-scaled chance
    if (this.badLedger > 4 || Math.random() < brawlChance(this.beli)) this.startBrawl();
    else this.startNight();
  }

  // ------------------------------------------------------------- brawl
  startBrawl() {
    this.phase = "brawl";
    this.customers = []; this.chef.carry = null;
    this.chef.hp = CHEF_HP; this.chef.drinks = 0; this.chef.buffT = 0; this.chef.wastedT = 0;
    this.chef.x = 0; this.chef.z = 1;
    // spectators stay — critics always stay
    const critic = CAST.find((c) => c.id === "critic")!;
    const others = CAST.filter((c) => c.id !== "critic").sort(() => Math.random() - 0.5).slice(0, 2);
    this.spectators = [critic, ...others].map((cast, i) => ({
      cast, table: i * 2, x: this.tables[i * 2].x, z: this.tables[i * 2].z + 0.95,
    }));
    const sizeMult = brawlSizeMult(this.beli);
    this.brawl = {
      t: BRAWL_TIME, wave: 0, waveT: 2.5, toSpawn: 0, spawnT: 0,
      live: false, liveT: 0, liveDelay: rand(18, 38), over: false, result: null,
      endT: 0, beliDelta: 0, criticHere: true,
    };
    this.brawl.toSpawn = Math.max(3, Math.round(7 * sizeMult));
    this.flash(0, 3.9, 0, "THE MOB IS BACK", "#e84a3a", 2.5, true);
    sfx("smash"); this.addShake(0.8);
  }

  spawnEnemy() {
    const B = this.brawl!;
    const smashers = this.enemies.filter((e) => e.kind === "smasher" && e.state !== "ko").length;
    let kind: EnemyKind = "chaser";
    const r = Math.random();
    if (r < 0.30) kind = "thief";
    else if (r < 0.55 && smashers < 3) kind = "smasher";
    const cast = CAST[Math.floor(Math.random() * CAST.length)];
    const e: Enemy = {
      id: this.nextId++, kind, cast,
      x: DOOR.x + 1.5 + rand(0, 1), z: DOOR.z + rand(-1, 1), dir: -Math.PI / 2,
      hp: ENEMY_HP, state: "walk", t: 0, tx: 0, tz: 0, raidT: 0,
      steal: null, buffed: false, koT: 0, walkPh: Math.random() * 6,
      station: null,
    };
    if (kind === "smasher") {
      const targets = STATIONS.filter((s) => !this.stations[s.id].broken && !(s.id === "bar" && this.barBroken));
      e.station = targets.length ? targets[Math.floor(Math.random() * targets.length)].id : null;
      if (!e.station) e.kind = "chaser";
    }
    this.enemies.push(e);
    B.toSpawn--;
  }

  punch() {
    if (this.phase !== "brawl" || this.paused) return;
    const ch = this.chef, B = this.brawl;
    if (!B || B.over) return;
    if (ch.punchT > 0 || ch.chugT > 0) return;
    ch.punchT = PUNCH_CD; ch.punchAnim = 0.22;
    if (ch.comboT <= 0) ch.comboStep = 0;
    const step = ch.comboStep;
    ch.comboStep = (ch.comboStep + 1) % 4; ch.comboT = 0.9;
    const dmgMult = [1, 1, 1.5, 2.4][step]
      * (ch.buffT > 0 ? 1.5 : 1) * (ch.wastedT > 0 ? 1.3 : 1);
    const reach = PUNCH_REACH, fx = Math.sin(ch.dir), fz = Math.cos(ch.dir);
    let hitAny = false, bodies = 0;
    for (const e of this.enemies) {
      if (e.state === "ko") continue;
      const dx = e.x - ch.x, dz = e.z - ch.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + 0.4) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.35) continue;
      hitAny = true; bodies++;
      e.hp -= PUNCH_DMG * dmgMult;
      const kb = 1.6 + step * 0.7;
      e.x += (dx / (d || 1)) * kb * 0.4; e.z += (dz / (d || 1)) * kb * 0.4;
      if (e.hp <= 0) {
        e.state = "ko"; e.koT = 0; sfx("ko");
        this.burst(e.x, 1.6, e.z, ["#ffd86b", "#fff"], 14, 4, 4, 0.7, 7, 1);
        this.flash(e.x, 2.6, e.z, "KO!", "#ffd86b");
      } else {
        e.state = "hurt"; e.t = 0.3;
        this.burst(e.x, 1.8, e.z, ["#ffe9a8", "#ff9d5c"], 8, 3.5, 2.5, 0.4, 6, 0.8);
      }
      this.flash(e.x, 2.4, e.z, step === 3 ? "HAYMAKER" : step === 2 ? "hook!" : "jab", "#fff");
    }
    if (hitAny) {
      sfx(step >= 2 ? "hit" : "punch");
      this.hitstop = 0.04 + step * 0.03 + Math.min(0.05, (bodies - 1) * 0.02);
      this.addShake(0.18 + step * 0.14);
      if (navigator.vibrate) navigator.vibrate(Math.min(200, 40 + step * 50));
    } else sfx("whiff");
  }

  drink() {
    const ch = this.chef;
    if (ch.chugT > 0 || this.barBroken) return;
    ch.chugT = 1.2;
    sfx("drink");
  }

  tickBrawl(dt: number) {
    const B = this.brawl!, ch = this.chef;
    if (B.over) {
      B.endT -= dt;
      if (B.endT <= 0) this.startNight();
      return;
    }
    B.t -= dt;
    // waves
    if (B.toSpawn > 0) {
      B.spawnT -= dt;
      const alive = this.enemies.filter((e) => e.state !== "ko").length;
      if (B.spawnT <= 0 && alive < 9) { this.spawnEnemy(); B.spawnT = rand(0.5, 1.2); }
    } else if (this.enemies.every((e) => e.state === "ko")) {
      if (B.wave >= WAVE_COUNT - 1) { this.endBrawl("win"); return; }
      B.waveT -= dt;
      if (B.waveT <= 0) {
        B.wave++;
        B.toSpawn = Math.max(3, Math.round((7 + B.wave * 2) * brawlSizeMult(this.beli)));
        B.waveT = 2.5;
        this.flash(0, 3.9, 0, `WAVE ${B.wave + 1}`, "#e84a3a", 1.8, true);
        sfx("smash");
      }
    }
    if (B.t <= 0) { this.endBrawl("win"); return; } // survived

    // GOING LIVE
    B.liveDelay -= dt;
    if (!B.live && B.liveDelay <= 0) {
      B.live = true; B.liveT = 8; this.strobe = 8;
      sfx("live");
      this.flash(0, 4.1, 0, "📡 GOING LIVE", "#ff4a6a", 2.5, true);
      for (const e of this.enemies) if (e.state !== "ko") { e.buffed = true; e.hp += 2; }
    }
    if (B.liveT > 0) { B.liveT -= dt; if (B.liveT <= 0) for (const e of this.enemies) e.buffed = false; }

    // chef timers
    if (ch.punchT > 0) ch.punchT -= dt;
    if (ch.punchAnim > 0) ch.punchAnim -= dt;
    if (ch.comboT > 0) ch.comboT -= dt;
    if (ch.buffT > 0 && ch.buffT < 1e8) ch.buffT -= dt;
    if (ch.wastedT > 0) ch.wastedT -= dt;
    if (ch.hurtT > 0) ch.hurtT -= dt;
    if (ch.chugT > 0) {
      ch.chugT -= dt;
      if (ch.chugT <= 0) {
        ch.drinks++;
        ch.hp = Math.min(CHEF_HP, ch.hp + 4);
        ch.buffT = ch.drinks >= DRINK_PERMANENT_AT ? 1e9 : 6 + 3 * ch.drinks;
        if (ch.drinks >= WASTED_AT) ch.wastedT = 12;
        this.flash(ch.x, 2.8, ch.z, ch.drinks >= WASTED_AT ? "WASTED" : "+4 HP 🥃", "#e0a83c");
        sfx("perfect");
      }
    }

    // enemies
    for (const e of this.enemies) {
      e.walkPh += dt * 7;
      switch (e.state) {
        case "ko":
          e.koT += dt;
          break;
        case "hurt":
          e.t -= dt; if (e.t <= 0) e.state = "walk";
          break;
        case "walk": {
          const sp = (e.kind === "thief" ? THIEF_SPEED : ENEMY_SPEED) * (e.buffed ? 1.25 : 1);
          let tx = ch.x, tz = ch.z;
          if (e.kind === "thief") {
            const slot = this.passSlots.find((s) => s.item);
            if (slot) { tx = slot.x; tz = slot.z + 0.9; }
            else if (e.t > 2.5) { tx = ch.x; tz = ch.z; }
          } else if (e.kind === "smasher" && e.station) {
            const def = STATIONS.find((s) => s.id === e.station)!;
            tx = def.x; tz = def.z + 1.3;
          }
          e.t += dt;
          if (this.walkToE(e, tx, tz, dt, sp)) {
            if (e.kind === "smasher" && e.station) { e.state = "raid"; e.raidT = 0; }
            else if (e.kind === "thief") {
              const slot = this.passSlots.find((s) => s.item);
              if (slot) {
                e.steal = slot.item; slot.item = null;
                e.state = "flee"; sfx("pickup");
                this.flash(e.x, 2.4, e.z, "yoink!", "#caa07a");
              } else { e.state = "windup"; e.t = 0.5; }
            } else { e.state = "windup"; e.t = 0.5; }
          }
          break;
        }
        case "windup":
          e.t -= dt;
          if (e.t <= 0) {
            e.state = "lunge"; e.t = 0.4;
            e.tx = ch.x; e.tz = ch.z;
          }
          break;
        case "lunge": {
          e.t -= dt;
          const dx = e.tx - e.x, dz = e.tz - e.z, d = Math.hypot(dx, dz);
          if (d > 0.1) { e.x += (dx / d) * 6.5 * dt; e.z += (dz / d) * 6.5 * dt; e.dir = Math.atan2(dx, dz); }
          if (dist2(e.x, e.z, ch.x, ch.z) < 1.1) {
            ch.hp -= LUNGE_DMG * (e.buffed ? 1.25 : 1);
            ch.hurtT = 0.4; sfx("hurt"); this.addShake(0.35);
            this.burst(ch.x, 1.8, ch.z, ["#e86a5a", "#fff"], 8, 3, 3, 0.5, 6, 0.9);
            e.state = "walk"; e.t = -1.0; // brief recovery (t must climb back)
            if (ch.hp <= 0) { this.endBrawl("lose"); return; }
          } else if (e.t <= 0) { e.state = "walk"; e.t = 0.6; }
          break;
        }
        case "raid": {
          e.raidT += dt;
          if (Math.random() < dt * 2.5) { sfx("smash"); this.addShake(0.15); this.burst(e.x, 1.5, e.z - 1, ["#c9c9c9", "#8a8a8a"], 6, 3, 2, 0.4, 6, 0.8); }
          if (e.raidT > 4.5) {
            if (e.station === "bar") { this.barBroken = true; this.flash(e.x, 3, e.z, "BAR WRECKED", "#e84a3a", 1.8, true); }
            else if (e.station) { this.stations[e.station].broken = true; this.stations[e.station].state = "broken"; this.flash(e.x, 3, e.z, `${e.station.toUpperCase()} WRECKED`, "#e84a3a", 1.5, true); }
            sfx("smash"); this.addShake(0.5);
            e.station = null; e.kind = "chaser"; e.state = "walk";
          }
          break;
        }
        case "flee":
          if (this.walkToE(e, DOOR.x + 1.5, DOOR.z, dt, THIEF_SPEED * 1.3)) e.state = "ko"; // escaped — reuse ko removal
          break;
      }
      // separation
      for (const o of this.enemies) {
        if (o === e || o.state === "ko") continue;
        const dx = e.x - o.x, dz = e.z - o.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.64 && d2 > 0.0001) { const d = Math.sqrt(d2); e.x += (dx / d) * (0.8 - d) * dt * 3; e.z += (dz / d) * (0.8 - d) * dt * 3; }
      }
      e.x = clamp(e.x, FLOOR.x0, FLOOR.x1); e.z = clamp(e.z, FLOOR.z0, FLOOR.z1);
    }
    this.enemies = this.enemies.filter((e) => !(e.state === "ko" && e.koT > 1.4));
  }

  endBrawl(result: "win" | "lose") {
    const B = this.brawl!;
    B.over = true; B.result = result; B.endT = 3;
    const criticMult = B.criticHere ? 2 : 1;
    if (result === "win") {
      B.beliDelta = 0.5 * criticMult;
      this.flash(0, 3.9, 0, "ROOM CLEARED!", "#ffd86b", 2.5, true);
      sfx("cheer");
    } else {
      B.beliDelta = -1.5 * criticMult;
      this.flash(0, 3.9, 0, "CHEF DOWN", "#e84a3a", 2.5, true);
      sfx("ko");
      // half the stations get wrecked
      const ids = STATIONS.map((s) => s.id).sort(() => Math.random() - 0.5).slice(0, 3);
      for (const id of ids) {
        if (id === "bar") this.barBroken = true;
        else { this.stations[id].broken = true; this.stations[id].state = "broken"; }
      }
    }
    this.beli = clamp(this.beli + B.beliDelta, 1, 10);
    this.strobe = 0;
  }

  // ------------------------------------------------------------- night
  startNight() {
    this.phase = "night";
    this.enemies = [];
    this.chef.carry = null; this.chef.hp = CHEF_HP;
    this.chef.x = 0; this.chef.z = 1;
    for (const t of this.tables) { t.cust = -1; t.plate = null; }
    this.night = { t: NIGHT_TIME, spawnT: 2, sales: 0, bottles: 0 };
    this.flash(0, 3.9, 0, "AFTER HOURS", "#ff9de2", 2.5, true);
    if (!this.barBroken) startClubMusic();
  }

  spawnGroup() {
    const freeTable = this.tables.findIndex((t) => t.cust === -1 && !this.groups.some((g) => g.table === freeTableGuard(t) && g.state !== "gone"));
    function freeTableGuard(t: any) { return TABLES.indexOf(t); }
    if (freeTable === -1) return;
    const size = 2 + Math.floor(Math.random() * 2);
    const members = [...CAST].sort(() => Math.random() - 0.5).slice(0, size);
    const g: NightGroup = {
      id: this.nextId++, size, table: freeTable,
      x: DOOR.x + 1.5, z: DOOR.z, state: "walkin", t: 0,
      price: nightBottlePrice(this.beli), members, walkPh: 0,
    };
    this.tables[freeTable].cust = -2; // reserved marker
    this.groups.push(g);
    sfx("bell");
  }

  tickNight(dt: number) {
    const N = this.night!;
    N.t -= dt;
    if (N.t > 0) {
      N.spawnT -= dt;
      if (N.spawnT <= 0) { this.spawnGroup(); N.spawnT = rand(7, 11); }
    }
    for (const g of this.groups) {
      g.walkPh += dt * 7;
      const t = this.tables[g.table];
      switch (g.state) {
        case "walkin": {
          const dx = t.x - g.x, dz = t.z + 0.9 - g.z, d = Math.hypot(dx, dz);
          if (d < 0.15) { g.state = "ordering"; g.t = 0; sfx("order"); }
          else { g.x += (dx / d) * 2.4 * dt; g.z += (dz / d) * 2.4 * dt; }
          break;
        }
        case "ordering":
          g.t += dt;
          if (g.t > 26) { // left thirsty
            g.state = "leaving";
            this.flash(t.x, 2.6, t.z, "left thirsty…", "#8a90a8");
          }
          break;
        case "partying":
          g.t += dt;
          if (g.t > 6) g.state = "leaving";
          break;
        case "leaving": {
          const dx = DOOR.x + 1.5 - g.x, dz = DOOR.z - g.z, d = Math.hypot(dx, dz);
          if (d < 0.3) { g.state = "gone"; this.tables[g.table].cust = -1; this.tables[g.table].plate = null; }
          else { g.x += (dx / d) * 2.8 * dt; g.z += (dz / d) * 2.8 * dt; }
          break;
        }
      }
    }
    this.groups = this.groups.filter((g) => g.state !== "gone");
    if (N.t <= 0 && this.groups.length === 0) this.endRun();
  }

  serveBottle(g: NightGroup) {
    const N = this.night!;
    N.sales += g.price; N.bottles++;
    this.chef.carry = null;
    g.state = "partying"; g.t = 0;
    this.tables[g.table].plate = "bottle";
    this.flash(g.x, 3, g.z, `+$${g.price} 🍾`, "#ff9de2");
    sfx("bottle"); setTimeout(() => sfx("cash"), 200);
    this.burst(g.x, 2.4, g.z, ["#ff9de2", "#ffd86b", "#fff"], 20, 4, 4, 0.9, 6, 1.1);
    this.beli = clamp(this.beli + 0.04, 1, 10);
  }

  endRun() {
    const dayMoney = this.money;
    const nightMoney = this.night?.sales ?? 0;
    this.results = {
      served: this.served, lost: this.lost, shooed: this.shooed,
      dayMoney, tips: this.tipsEarned,
      brawl: this.brawl ? (this.brawl.result ?? "none") : "none",
      beliDelta: this.brawl?.beliDelta ?? 0,
      nightMoney, bottles: this.night?.bottles ?? 0,
      total: dayMoney + nightMoney,
      beli: this.beli,
      barDead: this.barBroken,
    };
    stopMusic();
    this.phase = "results";
  }

  // ------------------------------------------------------------- movement
  walkTo(c: Cust, tx: number, tz: number, dt: number, sp: number): boolean {
    const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
    if (d < 0.12) return true;
    c.x += (dx / d) * sp * dt; c.z += (dz / d) * sp * dt;
    c.dir = Math.atan2(dx, dz);
    return false;
  }
  walkToE(e: Enemy, tx: number, tz: number, dt: number, sp: number): boolean {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d < 0.9) return true;
    e.x += (dx / d) * sp * dt; e.z += (dz / d) * sp * dt;
    e.dir = Math.atan2(dx, dz);
    return false;
  }

  moveChef(dt: number) {
    const ch = this.chef;
    let mx = this.input.x, mz = this.input.z;
    const m = Math.hypot(mx, mz);
    ch.moving = m > 0.01 && ch.chugT <= 0;
    if (!ch.moving) return;
    mx /= m; mz /= m;
    let sp = CHEF_SPEED * (ch.carry ? CARRY_SLOW : 1);
    if (this.phase === "brawl") {
      sp = 5.0 * (ch.wastedT > 0 ? 0.8 : 1);
      if (ch.wastedT > 0) { // drunk drift
        const w = Math.sin(this.time * 2.3) * 0.45;
        const nx = mx * Math.cos(w) - mz * Math.sin(w), nz = mx * Math.sin(w) + mz * Math.cos(w);
        mx = nx; mz = nz;
      }
    }
    ch.x += mx * sp * dt; ch.z += mz * sp * dt;
    ch.dir = Math.atan2(mx, mz);
    ch.walkPh += dt * 10;

    // walls
    ch.x = clamp(ch.x, FLOOR.x0, FLOOR.x1);
    ch.z = clamp(ch.z, -3.95, FLOOR.z1);
    // pass counter: solid segment with gaps at both ends
    if (ch.z > -1.75 && ch.z < -0.75 && ch.x > -6.0 && ch.x < 5.2) {
      ch.z = ch.z < -1.25 ? -1.75 : -0.75;
    }
    // tables & plants: solid circles (except mid-brawl — the chef barrels through)
    if (this.phase !== "brawl") {
      for (const t of this.tables) this.pushOut(ch, t.x, t.z, 1.0);
      for (const p of this.plants) if (!p.broken) this.pushOut(ch, p.x, p.z, 0.7);
    }
  }
  pushOut(o: { x: number; z: number }, cx: number, cz: number, r: number) {
    const dx = o.x - cx, dz = o.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      o.x = cx + (dx / d) * r; o.z = cz + (dz / d) * r;
    }
  }

  // ------------------------------------------------------------- interact
  getPrompt(): { x: number; z: number; y: number; label: string } | null {
    if (this.paused) return null;
    const ch = this.chef;
    const near = (x: number, z: number, r = 2.0) => dist2(ch.x, ch.z, x, z) < r * r;

    if (this.phase === "day") {
      // serving first
      if (ch.carry?.kind === "dish") {
        for (const c of this.customers) {
          if (c.state === "waiting" && c.order === ch.carry.id && near(c.x, c.z, 2.4))
            return { x: c.x, z: c.z, y: 2.6, label: `serve ${DISHES[c.order].label}` };
        }
      }
      for (const c of this.customers) {
        if (c.state === "badorder" && near(c.x, c.z, 2.4))
          return { x: c.x, z: c.z, y: 2.6, label: `wave off (we don't do ${NOPE[c.badItem!]})` };
      }
      // stations
      if (near(CRATE.x, CRATE.z) && !ch.carry && this.stations.fryer.state === "idle")
        return { x: CRATE.x, z: CRATE.z, y: 2.2, label: "grab chicken" };
      const fryer = this.stations.fryer;
      if (near(STATIONS[0].x, STATIONS[0].z)) {
        if (ch.carry?.kind === "ing" && ch.carry.id === "chicken" && fryer.state === "idle") return { x: STATIONS[0].x, z: STATIONS[0].z, y: 2.4, label: "start frying" };
        if (!ch.carry && fryer.state === "green") return { x: STATIONS[0].x, z: STATIONS[0].z, y: 2.4, label: "plate karaage (PERFECT)" };
        if (!ch.carry && fryer.state === "burnt") return { x: STATIONS[0].x, z: STATIONS[0].z, y: 2.4, label: "scrape it out (burnt)" };
      }
      const salad = this.stations.salad;
      if (near(STATIONS[1].x, STATIONS[1].z)) {
        if (!ch.carry && salad.state === "idle") return { x: STATIONS[1].x, z: STATIONS[1].z, y: 2.4, label: "toss a garden salad" };
        if (!ch.carry && salad.state === "ready") return { x: STATIONS[1].x, z: STATIONS[1].z, y: 2.4, label: "take the salad" };
      }
      if (near(STATIONS[2].x, STATIONS[2].z) && !ch.carry)
        return { x: STATIONS[2].x, z: STATIONS[2].z, y: 2.4, label: "fetch raw lobster" };
      const pot = this.stations.pot;
      if (near(STATIONS[3].x, STATIONS[3].z)) {
        if (ch.carry?.kind === "ing" && ch.carry.id === "rawlobster" && pot.state === "idle") return { x: STATIONS[3].x, z: STATIONS[3].z, y: 2.4, label: "boil the lobster" };
        if (!ch.carry && pot.state === "green") return { x: STATIONS[3].x, z: STATIONS[3].z, y: 2.4, label: "plate lobster (PERFECT)" };
        if (!ch.carry && pot.state === "burnt") return { x: STATIONS[3].x, z: STATIONS[3].z, y: 2.4, label: "scrape it out (burnt)" };
      }
      const bar = this.stations.bar;
      if (near(BAR_GIN.x, BAR_GIN.z, 1.6) && !ch.carry && bar.state === "idle") return { x: BAR_GIN.x, z: BAR_GIN.z, y: 2.4, label: "build a gin sour" };
      if (near(BAR_WSK.x, BAR_WSK.z, 1.6) && !ch.carry && bar.state === "idle") return { x: BAR_WSK.x, z: BAR_WSK.z, y: 2.4, label: "build a whiskey sour" };
      if (near(BAR_MIX.x, BAR_MIX.z, 1.9) && !ch.carry && bar.state === "ready") return { x: BAR_MIX.x, z: BAR_MIX.z, y: 2.4, label: "take the cocktail" };
      // pass
      if (near(PASS.x, PASS.z, 2.6)) {
        if (ch.carry?.kind === "dish" && this.passSlots.some((s) => !s.item))
          return { x: PASS.x, z: PASS.z, y: 2.2, label: "set down on the pass" };
        if (!ch.carry && this.passSlots.some((s) => s.item))
          return { x: PASS.x, z: PASS.z, y: 2.2, label: "pick up from the pass" };
      }
      if (ch.carry && near(TRASH.x, TRASH.z, 1.8))
        return { x: TRASH.x, z: TRASH.z, y: 2, label: "toss it" };
    } else if (this.phase === "brawl") {
      if (!this.barBroken && near(BAR_MIX.x, BAR_MIX.z, 2.2) && this.chef.chugT <= 0)
        return { x: BAR_MIX.x, z: BAR_MIX.z, y: 2.4, label: "chug a bottle (+HP, +dmg)" };
    } else if (this.phase === "night") {
      if (ch.carry?.kind === "bottle") {
        for (const g of this.groups) {
          if (g.state === "ordering") {
            const t = this.tables[g.table];
            if (near(t.x, t.z, 2.6)) return { x: t.x, z: t.z, y: 2.6, label: `serve bottle ($${g.price})` };
          }
        }
      }
      if (!this.barBroken && !ch.carry && near(BAR_MIX.x, BAR_MIX.z, 2.2))
        return { x: BAR_MIX.x, z: BAR_MIX.z, y: 2.4, label: "grab a bottle 🍾" };
    }
    return null;
  }

  interact() {
    if (this.paused) return;
    const p = this.getPrompt();
    if (!p) return;
    const ch = this.chef;
    const lab = p.label;

    if (lab.startsWith("serve ")) {
      if (this.phase === "day") {
        const c = this.customers.find((c) => c.state === "waiting" && ch.carry?.kind === "dish" && c.order === ch.carry.id && dist2(ch.x, ch.z, c.x, c.z) < 2.4 * 2.4);
        if (c) this.serveCustomer(c);
      } else if (this.phase === "night") {
        const g = this.groups.find((g) => g.state === "ordering" && dist2(ch.x, ch.z, this.tables[g.table].x, this.tables[g.table].z) < 2.6 * 2.6);
        if (g) this.serveBottle(g);
      }
      return;
    }
    if (lab.startsWith("wave off")) {
      const c = this.customers.find((c) => c.state === "badorder" && dist2(ch.x, ch.z, c.x, c.z) < 2.4 * 2.4);
      if (c) this.waveOff(c);
      return;
    }
    switch (lab) {
      case "grab chicken": ch.carry = { kind: "ing", id: "chicken" }; sfx("pickup"); break;
      case "start frying": ch.carry = null; this.stations.fryer.state = "cooking"; this.stations.fryer.t = 0; sfx("setdown"); break;
      case "plate karaage (PERFECT)": ch.carry = { kind: "dish", id: "karaage", quality: "perfect" }; this.stations.fryer.state = "idle"; sfx("pickup"); break;
      case "toss a garden salad": this.stations.salad.state = "assembling"; this.stations.salad.t = 0; sfx("setdown"); break;
      case "take the salad": ch.carry = { kind: "dish", id: "salad", quality: "perfect" }; this.stations.salad.state = "idle"; sfx("pickup"); break;
      case "fetch raw lobster": ch.carry = { kind: "ing", id: "rawlobster" }; sfx("pickup"); break;
      case "boil the lobster": ch.carry = null; this.stations.pot.state = "cooking"; this.stations.pot.t = 0; sfx("setdown"); break;
      case "plate lobster (PERFECT)": ch.carry = { kind: "dish", id: "lobster", quality: "perfect" }; this.stations.pot.state = "idle"; sfx("pickup"); break;
      case "scrape it out (burnt)": {
        const id = dist2(ch.x, ch.z, STATIONS[0].x, STATIONS[0].z) < dist2(ch.x, ch.z, STATIONS[3].x, STATIONS[3].z) ? "fryer" : "pot";
        ch.carry = { kind: "dish", id: this.stations[id] === this.stations.fryer ? "karaage" : "lobster", quality: "burnt" };
        this.stations[id].state = "idle"; sfx("trash"); break;
      }
      case "build a gin sour": this.stations.bar.state = "assembling"; this.stations.bar.t = 0; (this.stations.bar as any).drink = "gin-sour"; sfx("setdown"); break;
      case "build a whiskey sour": this.stations.bar.state = "assembling"; this.stations.bar.t = 0; (this.stations.bar as any).drink = "whiskey-sour"; sfx("setdown"); break;
      case "take the cocktail": ch.carry = { kind: "dish", id: (this.stations.bar as any).drink ?? "gin-sour", quality: "perfect" }; this.stations.bar.state = "idle"; sfx("pickup"); break;
      case "set down on the pass": {
        const s = this.passSlots.find((s) => !s.item);
        if (s) { s.item = ch.carry; ch.carry = null; sfx("setdown"); }
        break;
      }
      case "pick up from the pass": {
        const s = [...this.passSlots].reverse().find((s) => s.item);
        if (s) { ch.carry = s.item; s.item = null; sfx("pickup"); }
        break;
      }
      case "toss it": ch.carry = null; sfx("trash"); break;
      case "chug a bottle (+HP, +dmg)": this.drink(); break;
      case "grab a bottle 🍾": ch.carry = { kind: "bottle", id: "bottle" }; sfx("bottle"); break;
    }
  }

  // ------------------------------------------------------------- main tick
  tick(dt: number) {
    if (this.paused) return;
    this.time += dt;
    // fx decay always runs (render-side feel)
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    if (this.cheerT > 0) this.cheerT -= dt;
    if (this.strobe > 0) this.strobe -= dt;

    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    if (this.phase === "title" || this.phase === "results") return;

    this.moveChef(dt);
    if (this.phase === "day") this.tickDay(dt);
    else if (this.phase === "brawl") this.tickBrawl(dt);
    else if (this.phase === "night") this.tickNight(dt);
  }
}

export const sim = new Sim();
// exposed for debugging / automated playtests
(window as any).__sim = sim;
