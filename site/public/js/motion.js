// Motion (https://motion.dev, MIT): the animation engine of Framer Motion, framework-free build, so no React and no build step.
// Loaded from a CDN pinned to one exact version. If it cannot load (offline, blocked) or the viewer prefers reduced motion,
// every helper below is a no-op and the page simply appears without animation.
const URL = "https://cdn.jsdelivr.net/npm/motion@11.18.2/+esm";
let mod = null;
let loading = null;
const still = () => !mod || matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = [0.22, 1, 0.36, 1];

/** Starts loading Motion once; resolves the module, or null if that fails or takes too long. */
export function loadMotion(timeoutMs = 4000) {
  loading ??= Promise.race([import(/* @vite-ignore */ URL), new Promise((_, rej) => setTimeout(() => rej(new Error("motion timeout")), timeoutMs))])
    .then((m) => { mod = m; return m; }).catch(() => null);
  return loading;
}

/** Fade + rise, staggered: a page, a stat grid, a list of cards appearing. */
export function enter(nodes, { y = 12, gap = 0.04, duration = 0.35 } = {}) {
  const list = [...(nodes?.length != null ? nodes : [nodes])].filter(Boolean);
  if (still() || !list.length) return;
  mod.animate(list, { opacity: [0, 1], transform: [`translateY(${y}px)`, "translateY(0px)"] }, { duration, delay: mod.stagger(gap), ease: EASE });
}

/** Chart bars grow up from the baseline (they set transform-origin: bottom in CSS). */
export function growBars(bars, { gap = 0.012, duration = 0.5 } = {}) {
  const list = [...bars];
  if (still() || !list.length) return;
  mod.animate(list, { transform: ["scaleY(0)", "scaleY(1)"] }, { duration, delay: mod.stagger(Math.min(gap, 0.5 / list.length)), ease: EASE });
}

/** Spring-like press feedback (Framer's whileTap) for any element. */
export function press(el, scale = 0.94) {
  el.addEventListener("pointerdown", () => { if (!still()) mod.animate(el, { transform: `scale(${scale})` }, { duration: 0.12, ease: EASE }); });
  for (const t of ["pointerup", "pointerleave", "pointercancel"]) el.addEventListener(t, () => { if (!still()) mod.animate(el, { transform: "scale(1)" }, { duration: 0.2, ease: EASE }); });
  return el;
}
