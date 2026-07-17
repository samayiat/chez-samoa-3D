// ============================================================================
// Bridges the mutable sim and React: re-renders the host component whenever
// a coarse "render signature" of the sim changes (entity spawns, state flips,
// coarse timer buckets for bars). Per-frame motion stays in useFrame refs.
// ============================================================================
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { sim } from "../game/sim";

export function useSimVersion() {
  const [, setV] = useState(0);
  const sig = useRef("");
  useFrame(() => {
    const s = sim;
    const cur = [
      s.phase,
      s.customers.map((c) => `${c.id}:${c.state}:${c.order}:${c.badItem}:${c.table}:${c.bench}:${Math.floor(c.orderT)}:${c.angry ? 1 : 0}`).join(","),
      s.enemies.map((e) => `${e.id}:${e.state}:${Math.ceil(e.hp)}:${e.buffed ? 1 : 0}:${e.steal?.id ?? ""}`).join(","),
      s.groups.map((g) => `${g.id}:${g.state}:${g.price}:${Math.floor(g.t / 2)}`).join(","),
      s.spectators.length,
      s.chef.carry ? `${s.chef.carry.kind}:${s.chef.carry.id}:${s.chef.carry.quality ?? ""}` : "",
      s.chef.wastedT > 0 ? 1 : 0,
      s.tables.map((t) => t.plate ?? "").join(","),
      s.passSlots.map((p) => (p.item ? p.item.id + (p.item.quality ?? "") : "")).join(","),
      Object.values(s.stations).map((x) => x.state).join(","),
      s.barBroken ? 1 : 0,
      s.plants.map((p) => (p.broken ? 1 : 0)).join(""),
      s.flashes.map((f) => `${f.x.toFixed(1)}:${f.text}:${f.t.toFixed(1)}`).join(","),
    ].join("|");
    if (cur !== sig.current) {
      sig.current = cur;
      setV((v) => v + 1);
    }
  });
}
