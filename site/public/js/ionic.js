// Ionic web components (https://ionicframework.com, MIT) for app-style behaviour: segmented controls with a sliding
// indicator, and bottom sheets with drag-to-resize. They are plain custom elements, so no framework or build step.
// Loaded from a CDN, pinned to one exact version. If it cannot load (offline, blocked) every helper below falls back to
// a plain button group / dialog, so the page works either way.
import { h } from "./ui.js";

const VERSION = "8.8.0";
const BASE = `https://cdn.jsdelivr.net/npm/@ionic/core@${VERSION}/dist/ionic/`;
let loading = null;

/** Starts loading Ionic once; resolves true when its elements are defined, false if that fails or takes too long. */
export function loadIonic(timeoutMs = 4000) {
  loading ??= (async () => {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("ionic timeout")), timeoutMs));
    await Promise.race([import(/* @vite-ignore */ `${BASE}ionic.esm.js`), timeout]);
    await Promise.race([customElements.whenDefined("ion-segment"), timeout]);
    document.documentElement.classList.add("has-ionic");
    return true;
  })().catch(() => false);
  return loading;
}
export const hasIonic = () => document.documentElement.classList.contains("has-ionic");

/**
 * Segmented control. items: [[value, labelNodeOrText], ...]. Calls onChange(value) only when the user picks a new value.
 * `scrollable` lets a long list scroll sideways (the stat rail); otherwise buttons share the width.
 */
export function segment(items, value, onChange, { scrollable = false, cls = "", label = "" } = {}) {
  if (hasIonic()) {
    const seg = document.createElement("ion-segment");
    seg.className = `seg ${cls}`;
    seg.setAttribute("value", String(value));
    seg.setAttribute("mode", "ios"); // iOS style: the selected option is a raised pill
    if (scrollable) seg.setAttribute("scrollable", "true");
    if (label) seg.setAttribute("aria-label", label);
    for (const [v, text] of items) {
      const b = document.createElement("ion-segment-button");
      b.setAttribute("value", String(v));
      b.setAttribute("layout", "icon-hide");
      const l = document.createElement("ion-label");
      l.append(text instanceof Node ? text : document.createTextNode(String(text)));
      b.append(l);
      seg.append(b);
    }
    seg.addEventListener("ionChange", (e) => { const v = e.detail?.value; if (v != null && String(v) !== String(value)) { value = v; onChange(v); } });
    return seg;
  }
  const wrap = h("div", { class: `seg seg-plain ${scrollable ? "scrollable" : ""} ${cls}`, role: "tablist", "aria-label": label || null });
  for (const [v, text] of items) {
    wrap.append(h("button", { type: "button", role: "tab", class: String(v) === String(value) ? "on" : "", "aria-selected": String(v) === String(value),
      onclick: () => { if (String(v) === String(value)) return; value = v; for (const b of wrap.children) b.classList.toggle("on", b === wrap.children[items.findIndex(([x]) => String(x) === String(v))]); onChange(v); } }, text));
  }
  return wrap;
}

/** Bottom sheet that opens at `initial` of the screen height and can be dragged taller or dismissed. `content` is any DOM node. */
export async function sheet(content, { title = "", initial = 0.6, breakpoints = [0, 0.6, 0.95] } = {}) {
  const body = h("div", { class: "sheet-body" }, h("div", { class: "sheet-head" }, h("b", {}, title)), content);
  if (hasIonic()) {
    const m = document.createElement("ion-modal");
    m.className = "sheet";
    m.initialBreakpoint = initial;
    m.breakpoints = breakpoints;
    m.handle = true;
    m.append(body);
    document.body.append(m);
    m.addEventListener("didDismiss", () => m.remove());
    await m.present();
    return () => m.dismiss();
  }
  const d = h("dialog", { class: "sheet-plain" }, body, h("button", { type: "button", class: "ghost sheet-x", onclick: () => d.close() }, "Close"));
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
  return () => d.close();
}
