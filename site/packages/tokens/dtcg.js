import { remPx } from "./rem.js";

const px = (v) => `${remPx(v)}px`;
const group = (obj, type, f = (v) => v) => Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [k, { $type: type, $value: f(v) }]));

/**
 * tokens.json -> the W3C Design Tokens format (`$type` / `$value`), which Figma variable importers (Tokens Studio, the Variables import plugins) read, so the design file and the code share one source.
 * Pure; `site/scripts/tokens.mjs` writes it to `packages/tokens/tokens.dtcg.json` and a test fails when the committed file is stale. Chart colours that reference other tokens are skipped.
 */
export function tokensDtcg(tokens) {
  const t = tokens;
  const dim = (o) => group(o, "dimension", (v) => (typeof v === "string" && /(rem|px)$/.test(v) ? px(v) : String(v)));
  return {
    color: group(Object.fromEntries(Object.entries(t.color).filter(([k, v]) => /^(#|rgba?\()/.test(v) && k !== "body-size")), "color"),
    space: dim(t.space),
    size: dim(Object.fromEntries(Object.entries(t.size).filter(([, v]) => /(rem|px)$/.test(v)))),
    fontSize: dim(Object.fromEntries(Object.entries(t.type).filter(([k]) => /^fs-[a-z]+$/.test(k)).map(([k, v]) => [k.slice(3), v]))),
    fontWeight: group(t.weight, "fontWeight"),
    duration: group(Object.fromEntries(Object.entries(t.motion).filter(([k]) => k.startsWith("duration-")).map(([k, v]) => [k.slice(9), v])), "duration"),
    cubicBezier: group(Object.fromEntries(Object.entries(t.motion).filter(([k]) => k.startsWith("ease-")).map(([k, v]) => [k.slice(5), v.replace("cubic-bezier(", "").replace(")", "").split(",").map(Number)])), "cubicBezier"),
    icon: dim(t.icon),
    opacity: group(t.state, "number"),
    breakpoint: dim(t.breakpoint),
  };
}
