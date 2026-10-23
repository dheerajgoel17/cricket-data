// shadcn/ui-style components in plain JS: same anatomy, ARIA roles, keyboard behaviour and design tokens as shadcn's Accordion, Tabs,
// Badge, Skeleton, Switch, Toggle group and Sonner toast (the originals need React + Radix; this site has no build step).
import { h } from "./ui.js";

let uid = 0;
const next = (p) => `${p}-${++uid}`;

/** Accordion: items = [{ title, meta?, content, open? }]; type "single" closes the others. */
export function Accordion(items, { type = "multiple", cls = "" } = {}) {
  const root = h("div", { class: `ui-acc ${cls}` });
  const nodes = items.map((it) => {
    const tid = next("acc-t"), cid = next("acc-c");
    const trigger = h("button", { type: "button", class: "ui-acc-trigger", id: tid, "aria-expanded": String(!!it.open), "aria-controls": cid }, h("span", { class: "ui-acc-title" }, it.title),
      it.meta ? h("span", { class: "ui-acc-meta" }, it.meta) : null, h("span", { class: "ui-acc-chev", html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' }));
    const inner = h("div", { class: "ui-acc-inner" }, it.content);
    const content = h("div", { class: "ui-acc-content", id: cid, role: "region", "aria-labelledby": tid }, inner);
    const item = h("div", { class: "ui-acc-item", "data-state": it.open ? "open" : "closed" }, h("h3", { class: "ui-acc-h" }, trigger), content);
    inner.inert = !it.open;
    const setOpen = (open) => { item.dataset.state = open ? "open" : "closed"; trigger.setAttribute("aria-expanded", String(open)); inner.inert = !open; };
    trigger.addEventListener("click", () => {
      const open = item.dataset.state !== "open";
      if (type === "single" && open) nodes.forEach((n) => n !== entry && n.set(false));
      setOpen(open);
    });
    const entry = { item, trigger, set: setOpen };
    return entry;
  });
  nodes.forEach((n) => root.append(n.item));
  root.addEventListener("keydown", (e) => {
    const ts = nodes.map((n) => n.trigger), i = ts.indexOf(document.activeElement);
    if (i < 0) return;
    const to = e.key === "ArrowDown" ? (i + 1) % ts.length : e.key === "ArrowUp" ? (i - 1 + ts.length) % ts.length : e.key === "Home" ? 0 : e.key === "End" ? ts.length - 1 : null;
    if (to != null) { e.preventDefault(); ts[to].focus(); }
  });
  return root;
}

/** Tabs list (the content is switched by the caller): tabs = [[id, label]], value, onChange(id). Roving arrow-key focus like Radix. */
export function TabsList(tabs, value, onChange, cls = "") {
  const list = h("div", { class: `ui-tabs ${cls}`, role: "tablist" });
  const btns = tabs.map(([id, label]) => {
    const b = h("button", { type: "button", role: "tab", class: "ui-tab", "data-t": id, "aria-selected": String(id === value), tabindex: id === value ? "0" : "-1" }, label);
    b.addEventListener("click", () => onChange(id));
    return b;
  });
  btns.forEach((b) => list.append(b));
  list.addEventListener("keydown", (e) => {
    const i = btns.indexOf(document.activeElement);
    if (i < 0 || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const to = e.key === "ArrowRight" ? (i + 1) % btns.length : e.key === "ArrowLeft" ? (i - 1 + btns.length) % btns.length : e.key === "Home" ? 0 : btns.length - 1;
    btns[to].focus();
    btns[to].click();
  });
  list.select = (id) => btns.forEach((b) => { const on = b.dataset.t === id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  return list;
}

export const Badge = (text, variant = "secondary") => h("span", { class: `ui-badge ui-badge-${variant}` }, text);
export const Skeleton = (w = "100%", hgt = "16px", cls = "") => h("div", { class: `ui-skel ${cls}`, style: `width:${w};height:${hgt}`, "aria-hidden": "true" });

/** Page-shaped loading placeholder. */
export function PageSkeleton() {
  return h("div", { class: "ui-page-skel", role: "status", "aria-label": "Loading" }, Skeleton("40%", "34px"), Skeleton("70%", "16px"), h("div", { class: "ui-skel-row" }, Skeleton("100%", "88px"), Skeleton("100%", "88px"), Skeleton("100%", "88px")),
    Skeleton("100%", "220px"), Skeleton("100%", "120px"));
}

/** Switch (role=switch checkbox) with a label, like shadcn's Switch. */
export function Switch(name, label, checked = false) {
  const input = h("input", { type: "checkbox", role: "switch", name, checked, class: "ui-switch-input" });
  return h("label", { class: "ui-switch" }, input, h("span", { class: "ui-switch-track" }, h("span", { class: "ui-switch-thumb" })), h("span", { class: "ui-switch-label" }, label));
}

/** Toggle group (single select), like shadcn's ToggleGroup type="single". */
export function ToggleGroup(options, value, onChange) {
  const g = h("div", { class: "ui-toggle-group", role: "group" });
  const paint = (v) => g.querySelectorAll("button").forEach((b) => { const on = b.dataset.v === String(v); b.setAttribute("aria-pressed", String(on)); b.dataset.state = on ? "on" : "off"; });
  options.forEach(([v, l]) => g.append(h("button", { type: "button", "data-v": String(v), class: "ui-toggle", onclick: () => { paint(v); onChange(v); } }, l)));
  paint(value);
  return g;
}

/** Sonner-style toast: bottom-right, auto-dismiss, polite live region. */
export function toast(message, { ms = 2600 } = {}) {
  let box = document.getElementById("ui-toaster");
  if (!box) { box = h("div", { id: "ui-toaster", class: "ui-toaster", "aria-live": "polite" }); document.body.append(box); }
  const t = h("div", { class: "ui-toast", role: "status" }, message);
  box.append(t);
  requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 250); }, ms);
}
