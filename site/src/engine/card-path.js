export const CARD_V = "5"; // bump when the drawing changes so Twitter/WhatsApp drop a stale cached picture

/** The card's address as a file path. Version is in the path (not ?v=): X ignores query strings when it caches a failed picture. */
export function cardPath(q) {
  const prefix = `/card/v${CARD_V}`;
  if (q.p != null) return `${prefix}/player/${q.p}${q.stat && q.line != null ? `/${encodeURIComponent(q.stat)}/${q.line}` : ""}.jpg`;
  if (q.v != null) return `${prefix}/venue/${q.v}.jpg`;
  return q.f ? `${prefix}/fixture/${encodeURIComponent(q.f)}.jpg` : "/og.png";
}

/** The inverse: "v5/player/12/runs/24.5.jpg" or the older "player/12/runs/24.5.jpg" -> the query `cardFields` takes; {} for anything else. */
export function cardQuery(path) {
  const seg = String(path || "").replace(/\?.*$/, "").replace(/^\/?card\//, "").replace(/^v\d+\//, "").replace(/\.jpg$/i, "").split("/").filter(Boolean).map((x) => decodeURIComponent(x));
  if (seg[0] === "player" && /^\d+$/.test(seg[1] || "")) return seg[2] && seg[3] ? { p: seg[1], stat: seg[2], line: seg[3] } : { p: seg[1] };
  if (seg[0] === "venue" && /^\d+$/.test(seg[1] || "")) return { v: seg[1] };
  if (seg[0] === "fixture" && seg[1]) return { f: seg[1] };
  return {};
}
