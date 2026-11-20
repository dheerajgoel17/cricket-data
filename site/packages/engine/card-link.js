// Turns a pasted link into what the poster endpoint takes (pure; shared by the card tool page and its tests).
//   player: /player/<idx>?stat=runs&line=24.5 · /share/player/<idx>/<stat>/<line> · /card/vN/player|pid/<..>/<stat>/<line>.jpg
//   fancy:  /fixture/<id>/fancy?fm=match_sixes&sc=-1 (sc = team index, absent = the whole match)
// Returns { kind: "player", p | pid, stat, line } | { kind: "fancy", f, fm, sc } | null. A player link with no stat/line has `stat` and `line` null (the endpoint then uses his booked prop).
const num = (s) => (s != null && s !== "" && Number.isFinite(Number(s)) ? Number(s) : null);

export function parseCardLink(input) {
  let url;
  try { url = new URL(String(input || "").trim(), "https://x.invalid"); } catch { return null; }
  const seg = url.pathname.replace(/\.jpg$/i, "").split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  while (seg[0] === "card" || seg[0] === "share" || /^v\d+$/.test(seg[0] || "")) seg.shift();
  const sp = url.searchParams;
  if (seg[0] === "fixture" && seg[1] && seg[2] === "fancy") {
    const fm = sp.get("fm");
    return fm ? { kind: "fancy", f: seg[1], fm, sc: num(sp.get("sc")) ?? -1 } : null;
  }
  if (seg[0] === "player" || seg[0] === "pid") {
    const id = seg[1] || "";
    const who = /^\d+$/.test(id) && seg[0] === "player" ? { p: Number(id) } : /^[0-9a-f]{8}$/.test(id) ? { pid: id } : null;
    if (!who) return null;
    const stat = seg[2] || sp.get("stat") || null, line = num(seg[3] ?? sp.get("line"));
    const priced = stat && line != null;
    return { kind: "player", ...who, stat: priced ? stat : null, line: priced ? line : null };
  }
  return null;
}

/** The poster endpoint's address for a parsed link (relative to the site). */
export function posterPath(link) {
  if (!link) return null;
  const q = new URLSearchParams();
  if (link.kind === "fancy") { q.set("f", link.f); q.set("fm", link.fm); q.set("sc", String(link.sc)); }
  else {
    if (link.pid != null) q.set("pid", link.pid); else q.set("p", String(link.p));
    if (link.stat) { q.set("stat", link.stat); q.set("line", String(link.line)); }
  }
  q.set("poster", "1");
  return `/api/og?${q}`;
}
