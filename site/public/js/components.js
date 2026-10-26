// Reusable page components on top of the shadcn-style helpers (shadcn.js) and the design tokens (css/ui.css, --pc-*).
// Pages compose these instead of hand-written markup + per-page CSS: Card, PillRail, IconButton, Stat/StatGrid, Gauge, Hero.
import { h } from "./ui.js";
import { TabsList } from "./shadcn.js";
import { press } from "./motion.js";

/** shadcn Card: optional title row with a hairline under it, then the body. `flat` drops the padding for tables / lists. */
export const Card = ({ title = null, flat = false, cls = "" } = {}, ...body) =>
  h("section", { class: `ui-card ${flat ? "flat" : ""} ${cls}`.trim() }, title ? h("h3", { class: "ui-card-title" }, title) : null, ...body);

/** Pill rail: shadcn Tabs list in the props.cash pill style (40px pills, selected #2F2F2F). Same API as TabsList. */
export const PillRail = (tabs, value, onChange, cls = "") => TabsList(tabs, value, onChange, `ui-pill-rail ${cls}`.trim());

/** Round 44px icon button (back, share, star wrapper...) with a press animation. */
export const IconButton = (label, html, onclick, cls = "") => press(h("button", { type: "button", class: `ui-icon-btn ${cls}`.trim(), "aria-label": label, html, onclick }));

/** One labelled figure: label in small condensed caps, value below. `tone` colours it up / down / hit / etc. */
export const Stat = (label, value, tone = "") => h("div", { class: `ui-stat ${tone}`.trim() }, h("span", { class: "k" }, label), h("b", { class: "v" }, value));
export const StatGrid = (...stats) => h("div", { class: "ui-stat-grid" }, ...stats);

/** Ring gauge (0..1) with the value in the middle and a caption underneath. Colours come from the tokens. */
export function Gauge(p, caption) {
  const arc = p == null ? 0 : Math.max(0, Math.min(1, p));
  const tone = arc >= 0.6 ? "--pc-accent" : arc >= 0.4 ? "--pc-amber" : "--pc-red";
  const ring = (stroke, dash) => `<circle cx="24" cy="24" r="19" fill="none" style="stroke:var(${stroke})" stroke-width="4" stroke-dasharray="${dash}" stroke-linecap="round" transform="rotate(135 24 24)"/>`;
  return h("div", { class: "ui-gauge" }, h("div", { html: `<svg viewBox="0 0 48 48" width="52" height="52">${ring("--pc-line", "89.6 29.9")}${ring(tone, `${(89.6 * arc).toFixed(1)} 200`)}<text x="24" y="28" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">${p == null ? "–" : `${Math.round(arc * 100)}%`}</text></svg>` }), h("span", {}, caption));
}

/**
 * Entity hero (player / team): photo, name, sub lines, round action buttons, and a stats block (grid + gauge).
 * Layout is responsive in CSS only: phone = name left / photo right / stats below; >= 1024 = photo | name | stats in one row.
 */
export const Hero = ({ photo, name, lines = [], actions = [], stats = null }) =>
  h("section", { class: "ui-hero" },
    h("div", { class: "ui-hero-photo" }, photo),
    h("div", { class: "ui-hero-id" }, h("h1", {}, name), ...lines.map((l) => h("div", { class: "ui-hero-sub" }, l)), actions.length ? h("div", { class: "ui-hero-actions" }, ...actions) : null),
    stats ? h("div", { class: "ui-hero-stats" }, stats) : null);
