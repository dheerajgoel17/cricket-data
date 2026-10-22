// Tiny DOM helpers and shared components.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const odds = (x) => (x == null ? "–" : x.toFixed(2));
export const pc = (x) => (x == null ? "–" : `${(x * 100).toFixed(1)}%`);
export const num = (x) => (x == null ? "–" : Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100));

export function table(columns, rows, { cls = "" } = {}) {
  return h("div", { class: "scroll" }, h("table", { class: cls },
    h("thead", {}, h("tr", {}, columns.map((c) => h("th", {}, c)))),
    h("tbody", {}, rows.map((r) => h("tr", {}, r.map((c) => (c instanceof Node ? h("td", {}, c) : h("td", {}, c ?? "–"))))))));
}

export function chips(list) {
  return h("div", { class: "chips" }, list.map(([k, v]) => h("span", { class: "chip" }, k ? h("b", {}, `${k}: `) : null, String(v))));
}

export function stat(k, v, s) {
  return h("div", { class: "stat" }, h("div", { class: "k" }, k), h("div", { class: "v" }, v), s ? h("div", { class: "s" }, s) : null);
}

/** Last-N bars; bars at or above the line are highlighted. */
export function bars(values, line) {
  const max = Math.max(1, ...values);
  return h("div", { class: "bars", role: "img", "aria-label": "Recent values" }, values.map((v) =>
    h("i", { class: line != null && v > line ? "hit" : "", style: `height:${Math.max(4, (v / max) * 100)}%`, title: String(v) }, h("span", {}, String(v)))));
}

export function freshText(store) {
  const f = store.freshness();
  return [`Cricsheet data through `, h("b", {}, f.newestCricsheet), f.provisionalIncluded
    ? [` · includes `, h("b", {}, String(f.provisionalMatches)), ` provisional matches up to `, h("b", {}, f.newestProvisional || "?")]
    : " · no provisional matches included", ` · built ${f.builtAt}`];
}

/** Attach a suggestion dropdown to an input. `source(text)` returns [{label, sub, value}]. */
export function suggest(input, source, onPick) {
  const box = h("div", { class: "sugg", hidden: true });
  input.parentElement.classList.add("rel");
  input.after(box);
  let items = [], cur = -1;
  const close = () => { box.hidden = true; cur = -1; };
  const show = () => {
    items = source(input.value.trim());
    box.replaceChildren(...items.map((it, i) => h("div", { onmousedown: (e) => { e.preventDefault(); pick(i); } }, it.label, it.sub ? h("span", { class: "muted small" }, ` ${it.sub}`) : null)));
    box.hidden = !items.length;
  };
  const pick = (i) => { input.value = items[i].label; close(); onPick(items[i]); };
  input.addEventListener("input", show);
  input.addEventListener("focus", () => input.value && show());
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    const kids = [...box.children];
    if (e.key === "ArrowDown") { cur = Math.min(kids.length - 1, cur + 1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { cur = Math.max(0, cur - 1); e.preventDefault(); }
    else if (e.key === "Enter" && cur >= 0) { e.preventDefault(); pick(cur); return; }
    else if (e.key === "Escape") { close(); return; }
    else return;
    kids.forEach((k, i) => k.classList.toggle("on", i === cur));
  });
}
