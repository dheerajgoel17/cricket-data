import { startTransition, useEffect, useState } from "react";

/**
 * False on the first render, then true by way of a transition. A page uses it to put its header and skeleton on screen in the first frame and mount the heavy part after: React
 * renders a transition in small slices and lets touches, scrolls and timers in between them, so the mount never shows up as one long freeze (a plain `setTimeout` then `setState`
 * only moves the freeze 50 ms later).
 */
export function useLater(when = true): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => { if (when && !on) startTransition(() => setOn(true)); }, [when, on]);
  return on;
}
