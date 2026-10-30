export const CARD_V = "4"; // bump when the drawing changes so Twitter/WhatsApp drop a stale cached picture

/** The card's address as a file path (some link-preview crawlers only trust an image URL that looks like a file): /card/player/12/runs/24.5.jpg, /card/fixture/<id>.jpg. */
export function cardPath(q) {
  const v = `?v=${CARD_V}`;
  if (q.p != null) return `/card/player/${q.p}${q.stat && q.line != null ? `/${encodeURIComponent(q.stat)}/${q.line}` : ""}.jpg${v}`;
  if (q.v != null) return `/card/venue/${q.v}.jpg${v}`;
  return q.f ? `/card/fixture/${encodeURIComponent(q.f)}.jpg${v}` : `/og.png${v}`;
}

/** The inverse: "player/12/runs/24.5.jpg" -> the query `cardFields` takes; {} for anything else. */
export function cardQuery(path) {
  const seg = String(path || "").replace(/\?.*$/, "").replace(/^\/?card\//, "").replace(/\.jpg$/i, "").split("/").filter(Boolean).map((x) => decodeURIComponent(x));
  if (seg[0] === "player" && /^\d+$/.test(seg[1] || "")) return seg[2] && seg[3] ? { p: seg[1], stat: seg[2], line: seg[3] } : { p: seg[1] };
  if (seg[0] === "venue" && /^\d+$/.test(seg[1] || "")) return { v: seg[1] };
  if (seg[0] === "fixture" && seg[1]) return { f: seg[1] };
  return {};
}
