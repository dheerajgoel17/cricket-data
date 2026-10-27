import { useSyncExternalStore } from "react";

// One shared 1 s ticker for every timer on the page. `useNow(step)` returns the time rounded down to `step` ms, so a component that only
// shows minutes re-renders once a minute while a seconds timer re-renders every second; the interval runs only while something listens.
const subs = new Set<() => void>();
let id: ReturnType<typeof setInterval> | undefined;
const subscribe = (cb: () => void) => {
  subs.add(cb);
  if (!id) id = setInterval(() => subs.forEach((f) => f()), 1000);
  return () => { subs.delete(cb); if (!subs.size && id) { clearInterval(id); id = undefined; } };
};
export const useNow = (step = 1000) => useSyncExternalStore(subscribe, () => Math.floor(Date.now() / step) * step, () => Math.floor(Date.now() / step) * step);

const p2 = (n: number) => String(n).padStart(2, "0");
/** Time until a kick-off: "2d 04h" when far off, "02:19:42" within a day, "19:42" within the hour. */
export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, sec = s % 60;
  if (d >= 1) return `${d}d ${p2(h)}h`;
  return s >= 3600 ? `${p2(h)}:${p2(m)}:${p2(sec)}` : `${p2(m)}:${p2(sec)}`;
}
/** Time since the start: "1:23:45". */
export function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}`;
}
