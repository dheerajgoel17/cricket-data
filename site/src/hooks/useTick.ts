import { useEffect, useRef, useState } from "react";

const HOLD_MS = 1100;

/**
 * Direction a number just moved: 1 up, -1 down, 0 still. Holds the flash for a beat so a 15 s live poll is visible,
 * then returns to 0. Instant under reduced motion (the CSS animation is already off).
 */
export function useTick(value: number | null | undefined, holdMs: number | null = HOLD_MS) {
  const prev = useRef(value);
  const [dir, setDir] = useState< -1 | 0 | 1>(0);
  useEffect(() => {
    const cur = value;
    const was = prev.current;
    prev.current = cur;
    if (cur == null || was == null) { setDir(0); return; }
    if (cur === was) return;
    setDir(cur > was ? 1 : -1);
    if (holdMs == null) return;
    const t = window.setTimeout(() => setDir(0), holdMs);
    return () => window.clearTimeout(t);
  }, [value, holdMs]);
  return dir;
}
