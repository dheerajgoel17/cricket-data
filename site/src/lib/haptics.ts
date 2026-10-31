/** A short tick on supported phones (Android browsers; iOS Safari has no vibration API). Never required: a missing API or a user who prefers reduced motion gets nothing. */
export function tap(ms = 8) {
  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(ms);
  } catch { /* ignore */ }
}
