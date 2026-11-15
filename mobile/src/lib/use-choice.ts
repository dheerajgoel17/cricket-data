import { startTransition, useCallback, useEffect, useState } from "react";

/**
 * A selection that answers the finger at once. The chosen chip / tab highlights in the same frame as the tap (urgent update), and the real change (a list re-filtered, a table rebuilt,
 * a screen re-rendered) runs as a transition: React renders it in small slices, keeps touches and scrolling live meanwhile, and drops it if another tap supersedes it. Every chip, tab
 * and segmented control goes through this, so no choice waits on its own consequences. `value` stays the source of truth: the shown choice follows it when it changes from outside.
 */
export function useChoice<T>(value: T, onChange: (v: T) => void) {
  const [shown, setShown] = useState(value);
  useEffect(() => { setShown(value); }, [value]);
  const choose = useCallback((v: T) => {
    setShown(v);
    startTransition(() => onChange(v));
  }, [onChange]);
  return [shown, choose] as const;
}
