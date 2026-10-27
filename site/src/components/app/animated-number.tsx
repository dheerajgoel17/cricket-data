import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";

/** A number that counts from its previous value to the new one (instant under reduced motion). `format` turns the raw value into text; null shows a dash. */
export function AnimatedNumber({ value, format = (n: number) => String(n), className }: { value: number | null | undefined; format?: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value == null || !Number.isFinite(value)) { el.textContent = "–"; prev.current = null; return; }
    if (reduce || prev.current == null) { el.textContent = format(value); prev.current = value; return; }
    const c = animate(prev.current, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => { el.textContent = format(v); } });
    prev.current = value;
    return () => c.stop();
  }, [value, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className={className}>{value == null || !Number.isFinite(value) ? "–" : format(value)}</span>;
}
