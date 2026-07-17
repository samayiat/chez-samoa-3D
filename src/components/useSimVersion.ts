// ============================================================================
// Bridges the mutable sim and React: re-renders the host component whenever a
// caller-supplied "render signature" of the sim changes (entity spawns, state
// flips, coarse timer buckets for bars). Each host passes a NARROW selector so
// it only re-renders for the sim slices it actually draws — per-frame motion
// stays in useFrame refs.
// ============================================================================
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

export function useSimVersion(selector: () => string) {
  const [, setV] = useState(0);
  const sig = useRef<string | null>(null);
  useFrame(() => {
    const cur = selector();
    if (cur !== sig.current) {
      sig.current = cur;
      setV((v) => v + 1);
    }
  });
}
