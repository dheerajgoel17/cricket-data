// GET /api/card?link=<player or Match Fancy link> -> the 4:5 poster PNG, for a bot (not for people: the page for people is /admin/card).
// Assistant user agents are refused on the rest of /api (middleware.js); this one route is let through and checks a shared key instead:
//   Authorization: Bearer <CARD_API_KEY>   (or ?key=, for a caller that can only fetch a URL; the header keeps it out of logs)
// Off (503) until CARD_API_KEY is set. The drawing is api/og.js's, unchanged: same numbers as the site, never a model's.
import { timingSafeEqual } from "node:crypto";
import { parseCardLink, posterPath } from "@cricket/engine/card-link.js";
import ogHandler from "./og.js";

export function keyOk(given, want) {
  const a = Buffer.from(String(given || "")), b = Buffer.from(String(want || ""));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

const fail = (res, code, msg) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify({ error: msg })); };

export default async function handler(req, res) {
  const want = (process.env.CARD_API_KEY || "").trim();
  if (!want) return fail(res, 503, "card api is off");
  const q = req.query || {};
  const bearer = /^Bearer\s+(.+)$/i.exec(String(req.headers?.authorization || ""))?.[1];
  if (!keyOk(bearer ?? q.key, want)) return fail(res, 401, "bad key");
  const link = parseCardLink(q.link);
  if (!link) return fail(res, 400, "link must be a player link (/player/<id>?stat=&line=) or a Match Fancy link (/fixture/<id>/fancy?fm=&sc=)");
  req.query = Object.fromEntries(new URL(posterPath(link), "https://x.invalid").searchParams); // what api/og reads
  return ogHandler(req, res);
}
