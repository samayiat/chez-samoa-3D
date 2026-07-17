// ============================================================================
// Chez Samoa 3D — constants, faithfully adapted from the original Culinary Dash
// (320x180 logical layout mapped onto a 3D floor plan)
// ============================================================================

export const SX = 0.09; // logical px -> world units (x)
export const SZ = 0.11; // logical px -> world units (z)
export const wx = (lx: number) => (lx - 160) * SX;
export const wz = (lz: number) => (lz - 95) * SZ;

// Walkable floor bounds (original FLOOR = {x0:14,x1:306,y0:46,y1:150})
export const FLOOR = {
  x0: wx(20), x1: wx(300),
  z0: wz(50), z1: wz(146),
};

// ----------------------------- dishes (verbatim data) ----------------------
export interface DishDef {
  label: string; make: "timing" | "assemble"; station: string;
  perfect: number; burnt?: number; emoji: string; color: string;
}
export const DISHES: Record<string, DishDef> = {
  salad:          { label: "garden salad", make: "assemble", station: "salad", perfect: 12, emoji: "🥗", color: "#7ec850" },
  karaage:        { label: "karaage",      make: "timing",   station: "fryer", perfect: 20, burnt: 8,  emoji: "🍗", color: "#d98a3a" },
  lobster:        { label: "lobster",      make: "timing",   station: "pot",   perfect: 24, burnt: 10, emoji: "🦞", color: "#d94a3a" },
  "whiskey-sour": { label: "whiskey sour", make: "assemble", station: "bar",   perfect: 16, emoji: "🥃", color: "#e0a83c" },
  "gin-sour":     { label: "gin sour",     make: "assemble", station: "bar",   perfect: 16, emoji: "🍸", color: "#cfe8d8" },
};
export const MENU = Object.keys(DISHES);

// things we do NOT serve -> wave-off
export const NOPE: Record<string, string> = {
  "bean-salad": "bean salad",
  truffles: "truffles",
  grits: "grits",
  hotdog: "a hotdog",
};

// ----------------------------- customer cast -------------------------------
export interface CastDef {
  id: string; name: string; outfit: string; skin: string; hair: string;
  do: "flattop" | "long" | "slick" | "cap" | "combover" | "bun" | "afro" | "sidepart";
  acc: "shades" | "bowtie" | "cap" | "notepad" | "monocle" | null;
  bad: keyof typeof NOPE;
}
export const CAST: CastDef[] = [
  { id: "reggie",   name: "Reggie",     outfit: "#4a6ea0", skin: "#c98a5a", hair: "#241a12", do: "flattop",  acc: null,      bad: "grits" },
  { id: "marisol",  name: "Marisol",    outfit: "#c4789a", skin: "#b6926a", hair: "#5a3a20", do: "long",     acc: "shades",  bad: "truffles" },
  { id: "sinclair", name: "Sinclair",   outfit: "#3c4256", skin: "#d9b48c", hair: "#5a3c22", do: "slick",    acc: "bowtie",  bad: "truffles" },
  { id: "val",      name: "Val",        outfit: "#607c54", skin: "#8a5a3a", hair: "#241a12", do: "cap",      acc: "cap",     bad: "hotdog" },
  { id: "critic",   name: "The Critic", outfit: "#4a4256", skin: "#c69a72", hair: "#b6b2ba", do: "combover", acc: "notepad", bad: "grits" },
  { id: "nana",     name: "Nana",       outfit: "#9a6ea0", skin: "#e0c0a0", hair: "#e6e2ea", do: "bun",      acc: null,      bad: "bean-salad" },
  { id: "deja",     name: "Deja",       outfit: "#d2964a", skin: "#7a4a2a", hair: "#1d150f", do: "afro",     acc: null,      bad: "hotdog" },
  { id: "monty",    name: "Monty",      outfit: "#7a5040", skin: "#e0c0a0", hair: "#b6b2ba", do: "sidepart", acc: "monocle", bad: "truffles" },
];

// ----------------------------- world layout --------------------------------
// The kitchen line hugs the north wall (wall face at z = -5.6).
export const KITCHEN_Z = -5.05;
export interface StationDef {
  id: string; x: number; z: number; label: string; kind: "timing" | "assemble" | "source";
  cook?: number; green?: number; dish?: string; verb?: string;
}
export const STATIONS: StationDef[] = [
  { id: "fryer",  x: wx(48),  z: KITCHEN_Z, label: "FRYER",    kind: "timing",   dish: "karaage", verb: "fry",  cook: 2.6, green: 1.6 },
  { id: "salad",  x: wx(123), z: KITCHEN_Z, label: "SALAD BAR",kind: "assemble", dish: "salad" },
  { id: "icebox", x: wx(170), z: KITCHEN_Z, label: "ICE BOX",  kind: "source" },
  { id: "pot",    x: wx(210), z: KITCHEN_Z, label: "POT",      kind: "timing",   dish: "lobster", verb: "boil", cook: 3.4, green: 1.9 },
  { id: "bar",    x: wx(260), z: KITCHEN_Z, label: "BAR",      kind: "assemble" },
];
// sub-spots
export const CRATE   = { x: wx(74),  z: KITCHEN_Z };  // chicken crate by the fryer
export const BAR_GIN = { x: wx(238), z: KITCHEN_Z };
export const BAR_MIX = { x: wx(260), z: KITCHEN_Z };
export const BAR_WSK = { x: wx(283), z: KITCHEN_Z };
export const PASS    = { x: wx(158), z: wz(86), name: "pass" };
export const PASS_SLOTS = [96, 136, 176, 216].map((lx) => ({ x: wx(lx), z: wz(83), item: null as null | CarryItem }));
export const PLATES  = { x: wx(74), z: wz(83) };
export const TRASH   = { x: wx(24), z: KITCHEN_Z };
export const DOOR    = { x: wx(302), z: wz(132) };

export interface TableDef { x: number; z: number }
export const TABLES: TableDef[] = [90, 128, 166, 204, 242].map((lx) => ({ x: wx(lx), z: wz(131) }));
export const BENCH  = [266, 282, 298].map((lx) => ({ x: wx(lx), z: wz(148) }));
export const PLANTS = [
  { x: wx(22),  z: wz(143) },
  { x: wx(300), z: wz(110) },
];

// ----------------------------- tuning --------------------------------------
export const DAY_LEN = 90;
export const HEARTS_MAX = 3;
export const PATIENCE_DRAIN = 0.10;          // 30s ticket life
export const SPEED_TIP_MAX = 0.5;
export const SPEED_TIP_WINDOW = 12;          // +50% tip decays over 12s
export const BAD_ORDER_WINDOW = 13;          // wave-off window
export const COMBO_WINDOW = 2.2;
export const COOK_BURN_HOLD = 3;
export const CHEF_SPEED = 5.4;
export const CARRY_SLOW = 0.92;

// brawl (original: BRAWL_TIME=90, CHEF_HP=20, ENEMY_HP=5, PUNCH_DMG=1.25)
export const BRAWL_TIME = 90;
export const CHEF_HP = 20;
export const ENEMY_HP = 5;
export const PUNCH_DMG = 1.25;
export const PUNCH_REACH = 1.9;
export const PUNCH_CD = 0.34;
export const ENEMY_SPEED = 1.9;
export const THIEF_SPEED = 3.0;
export const LUNGE_DMG = 1;
export const DRINK_PERMANENT_AT = 3;
export const WASTED_AT = 5;
export const WAVE_COUNT = 3;

// night (original: NIGHT_TIME=75, BOTTLE_PRICE=750)
export const NIGHT_TIME = 75;
export const BOTTLE_PRICE = 750;
export const DRINK_LINGER = 6;

export interface CarryItem {
  kind: "ing" | "dish" | "bottle";
  id: string;                 // ingredient id, dish id, or "bottle"
  quality?: "perfect" | "burnt";
  price?: number;             // bottles carry their locked price
}

export function priceMult(beli: number): number {
  return Math.max(0.35, Math.min(1.4, 0.40 + 0.12 * (beli - 2)));
}
export function spawnMult(beli: number): number {
  return Math.max(0.55, Math.min(1.35, 1.35 - 0.085 * beli));
}
export function brawlChance(beli: number): number {
  return beli < 4 ? 0.8 : beli < 6 ? 0.5 : beli < 8 ? 0.22 : 0.1;
}
export function brawlSizeMult(beli: number): number {
  return beli < 5 ? 1.25 : beli < 7 ? 1.0 : beli < 8.5 ? 0.65 : 0.45;
}
export function nightBottlePrice(beli: number): number {
  let mult: number;
  if (beli >= 6) mult = 1 + 0.025 * (beli - 6);
  else if (beli >= 4) mult = 0.55 + 0.225 * (beli - 4);
  else mult = 0.15 + 0.075 * (beli - 1);
  return Math.max(120, Math.round((BOTTLE_PRICE * mult) / 10) * 10);
}
