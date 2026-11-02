import { useEffect, useState } from "react";

/** The current time, refreshed every `ms` (the cards' "Starts in 2h" counts down). */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
