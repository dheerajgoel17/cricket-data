export const CARD_V = "17"; // bump when the drawing changes so Twitter/WhatsApp drop a stale cached picture

/** over | under from a query value; anything else is over (the default share). */
export const cardSide = (s) => (String(s || "").toLowerCase() === "under" ? "under" : "over");

/** The card's address as a file path. Version is in the path (not ?v=): X ignores query strings when it caches a failed picture. */
export function cardPath(q) {
  const prefix = `/card/v${CARD_V}`;
  const side = cardSide(q.side) === "under" ? "/under" : ""; // over stays unsuffixed so old over links keep working
  if (q.pid != null) return `${prefix}/pid/${encodeURIComponent(q.pid)}${q.stat && q.line != null ? `/${encodeURIComponent(q.stat)}/${q.line}${side}` : ""}.jpg`; // by player id (what the alerts know), not by index
  if (q.p != null) return `${prefix}/player/${q.p}${q.stat && q.line != null ? `/${encodeURIComponent(q.stat)}/${q.line}${side}` : ""}.jpg`;
  if (q.v != null) return `${prefix}/venue/${q.v}.jpg`;
  if (q.f && q.fm) return `${prefix}/fixture/${encodeURIComponent(q.f)}/fancy/${encodeURIComponent(q.fm)}/${Number.isFinite(Number(q.sc)) ? Number(q.sc) : -1}.jpg`; // one Match Fancy market of a fixture
  return q.f ? `${prefix}/fixture/${encodeURIComponent(q.f)}.jpg` : "/og.png";
}

/** The inverse: "v5/player/12/runs/24.5.jpg" or "…/24.5/under.jpg" -> the query `cardFields` takes; {} for anything else. */
export function cardQuery(path) {
  const seg = String(path || "").replace(/\?.*$/, "").replace(/^\/?card\//, "").replace(/^v\d+\//, "").replace(/\.jpg$/i, "").split("/").filter(Boolean).map((x) => decodeURIComponent(x));
  const sideAt = (i) => (seg[i] === "under" || seg[i] === "over" ? { side: seg[i] } : {});
  if (seg[0] === "pid" && /^[0-9a-f]{8}$/.test(seg[1] || "")) {
    if (seg[2] && seg[3]) return { pid: seg[1], stat: seg[2], line: seg[3], ...sideAt(4) };
    return { pid: seg[1] };
  }
  if (seg[0] === "player" && /^\d+$/.test(seg[1] || "")) {
    if (seg[2] && seg[3]) return { p: seg[1], stat: seg[2], line: seg[3], ...sideAt(4) };
    return { p: seg[1] };
  }
  if (seg[0] === "venue" && /^\d+$/.test(seg[1] || "")) return { v: seg[1] };
  if (seg[0] === "fixture" && seg[1] && seg[2] === "fancy" && seg[3]) return { f: seg[1], fm: seg[3], sc: seg[4] ?? "-1" };
  if (seg[0] === "fixture" && seg[1]) return { f: seg[1] };
  return {};
}
