import { useEffect, useRef, useState } from "react";

const HOLD_MS = 1100;

/**
 * Direction a number just moved: 1 up, -1 down, 0 still. Holds the flash for a beat so a 15 s live poll is visible,
 * then returns to 0. Instant under reduced motion (the CSS animation is already off).
 */
export function useTick(value: number | null | undefined) {
  const prev = useRef(value);
  const [dir, setDir] = useState< -1 | 0 | 1>(0);
  useEffect(() => {
    const cur = value;
    const was = prev.current;
    prev.current = cur;
    if (cur == null || was == null || cur === was) return;
    setDir(cur > was ? 1 : -1);
    const t = window.setTimeout(() => setDir(0), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [value]);
  return dir;
}
