import { useEffect, useRef, useState } from "react";

/** How long the up/down colour (and arrow) stay after a move — stock-ticker brief, not sticky. */
const HOLD_MS = 1000;

/**
 * Direction a number just moved: 1 up, -1 down, 0 still. Holds the flash for about a second, then returns to 0.
 */
export function useTick(value: number | null | undefined, holdMs: number = HOLD_MS) {
  const prev = useRef(value);
  const [dir, setDir] = useState< -1 | 0 | 1>(0);
  useEffect(() => {
    const cur = value;
    const was = prev.current;
    prev.current = cur;
    if (cur == null || was == null) { setDir(0); return; }
    if (cur === was) return;
    setDir(cur > was ? 1 : -1);
    const t = window.setTimeout(() => setDir(0), holdMs);
    return () => window.clearTimeout(t);
  }, [value, holdMs]);
  return dir;
}
