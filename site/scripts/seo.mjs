// After `vite build`: gives the pages search engines should find their own HTML (title, description, canonical link, share tags, structured data and a short
// text body that the app replaces on load), so a crawler or a link preview sees the page without running the app. Static pages, the upcoming fixtures and the
// biggest players, teams and competitions of the sitemap. Every other path still gets the app's shell (dist/index.html), which sets its tags in the browser.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BRAND, DEFAULT_DESC, ROUTES, TAGLINE, fullTitle, pageMeta } from "../src/lib/seo.js";
import { cardPath } from "../src/engine/card.js";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const LIMITS = { player: 300, team: 150, league: 100 };

/** The head tags of one page. `url` is absolute when SITE_URL is known; without it there is no canonical link or absolute image. */
export function headTags({ title, description, url = "", image = "", type = "website", noindex = false, jsonld = [] }) {
  const t = fullTitle(title);
  return [
    `<title>${esc(t)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}" />`,
    url ? `<link rel="canonical" href="${esc(url)}" />` : "",
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:site_name" content="${BRAND}" />`,
    `<meta property="og:locale" content="en" />`,
    `<meta property="og:title" content="${esc(t)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    url ? `<meta property="og:url" content="${esc(url)}" />` : "",
    image ? `<meta property="og:image" content="${esc(image)}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />` : "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(t)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : "",
    ...jsonld.map(ld),
  ].filter(Boolean).join("\n    ");
}

const NAV = [["/", "Fixtures and hot props"], ["/players", "Players"], ["/teams", "Teams and venues"], ["/competitions", "Competitions"], ["/tools", "Free tools"], ["/glossary", "Stats explained"], ["/about", "Rules and data"]];

/** A short text body for crawlers; the app replaces it as soon as it starts. */
export function bodyHtml(h1, text) {
  return `<main style="max-width:44rem;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;color:#eee"><h1>${esc(h1)}</h1><p>${esc(text)}</p><nav aria-label="Main"><ul>${NAV.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join("")}</ul></nav></main>`;
}

export function render(template, page) {
  if (!template.includes("<!--seo-head-->") || !template.includes("<!--seo-body-->")) throw new Error("index.html lost its seo markers");
  return template.replace("<!--seo-head-->", headTags(page)).replace("<!--seo-body-->", bodyHtml(page.h1 || page.title, page.description));
}

const crumbs = (site, items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${site}${path}` })) });

/** Every page to write: [path (no leading slash), page options]. */
export function pages({ site, index, fixtures, sitemap }) {
  const abs = (p) => (site ? `${site}${p}` : "");
  const image = site ? `${site}/og.png` : "";
  const out = [];
  out.push(["", { title: ROUTES[""].title, description: ROUTES[""].description, url: "", image, // the app shell also serves unknown paths: no canonical here, the app sets it per path
     h1: `${BRAND}: ${TAGLINE}`,
    jsonld: [{ "@context": "https://schema.org", "@type": "WebSite", name: BRAND, url: abs("/") || undefined, description: DEFAULT_DESC, inLanguage: "en" },
      { "@context": "https://schema.org", "@type": "Organization", name: BRAND, url: abs("/") || undefined, logo: site ? `${site}/icon-512.png` : undefined }] }]);
  for (const [seg, r] of Object.entries(ROUTES)) {
    if (!seg) continue;
    out.push([seg, { title: r.title, description: r.description, url: abs(`/${seg}`), image, noindex: !!r.noindex, jsonld: site ? [crumbs(site, [[BRAND, "/"], [r.title, `/${seg}`]])] : [] }]);
  }
  for (const f of Array.isArray(fixtures) ? fixtures : []) {
    const name = `${f.a} v ${f.b}`, path = `/fixture/${f.id}`;
    const title = `${name}: player props, hit rates and book lines`;
    const when = f.start ? new Date(f.start).toUTCString().replace(/ GMT$/, " UTC") : "";
    const { description } = pageMeta(path, title);
    out.push([`fixture/${f.id}`, { title, description: `${description}${f.venue ? ` ${f.venue}.` : ""}${when ? ` ${when}.` : ""}`, url: abs(path), image: site ? `${site}${cardPath({ f: f.id })}` : "", h1: title,
      jsonld: [{ "@context": "https://schema.org", "@type": "SportsEvent", name, sport: "Cricket", startDate: f.start || undefined, url: abs(path) || undefined,
        location: f.venue ? { "@type": "Place", name: f.venue } : undefined, homeTeam: { "@type": "SportsTeam", name: f.a }, awayTeam: { "@type": "SportsTeam", name: f.b },
        eventStatus: f.status === "Completed" ? "https://schema.org/EventCompleted" : "https://schema.org/EventScheduled" }, ...(site ? [crumbs(site, [[BRAND, "/"], [name, path]])] : [])] }]);
  }
  const names = { player: index?.players?.nm || [], team: (index?.teams || []).map((t) => (t.g ? `${t.n} Women` : t.n)), league: index?.events || [] };
  const seen = { player: 0, team: 0, league: 0 };
  for (const p of sitemap) {
    const m = /^\/(player|team|league)\/(\d+)$/.exec(p);
    if (!m || seen[m[1]] >= LIMITS[m[1]]) continue;
    const name = names[m[1]][Number(m[2])];
    if (!name) continue;
    seen[m[1]]++;
    const title = { player: `${name}: stats, hit rates and form`, team: `${name}: stats and player grid`, league: `${name}: team tables, totals and top scores` }[m[1]];
    const ldType = { player: { "@type": "Person", jobTitle: "Cricketer" }, team: { "@type": "SportsTeam", sport: "Cricket" }, league: { "@type": "SportsOrganization", sport: "Cricket" } }[m[1]];
    out.push([`${m[1]}/${m[2]}`, { title, description: pageMeta(p, title).description, url: abs(p), image: m[1] === "player" && site ? `${site}${cardPath({ p: m[2] })}` : image, h1: title,
      jsonld: [{ "@context": "https://schema.org", ...ldType, name, url: abs(p) || undefined }, ...(site ? [crumbs(site, [[BRAND, "/"], [name, p]])] : [])] }]);
  }
  return out;
}

/** The site's address: SITE_URL when it is set in the build, else the one the data build wrote into the sitemap (it is built with SITE_URL), else none. */
export function siteOf(dist, env = process.env.SITE_URL) {
  const given = String(env || "").replace(/\/+$/, "");
  if (given) return given;
  const f = join(dist, "sitemap.xml");
  return existsSync(f) ? /<loc>(https?:\/\/[^/<]+)/.exec(readFileSync(f, "utf8"))?.[1] ?? "" : "";
}

/** Same XOR-SHA256 wrap as src/cricket_site/wrap.py / site/src/engine/wrap.js, sync so the Vite build can read wrapped fixtures.json. */
export function unwrapJson(doc, secret) {
  if (!doc || doc.v !== 1 || !doc.ct || !doc.iv || !secret) return doc;
  const key = createHash("sha256").update(secret, "utf8").digest();
  const iv = Buffer.from(doc.iv, "base64"), ct = Buffer.from(doc.ct, "base64");
  const ks = Buffer.alloc(ct.length);
  for (let i = 0, off = 0; off < ct.length; i++) {
    const ctr = Buffer.alloc(4); ctr.writeUInt32BE(i);
    const block = createHash("sha256").update(Buffer.concat([key, iv, ctr])).digest();
    const n = Math.min(32, ct.length - off);
    block.copy(ks, off, 0, n); off += n;
  }
  const raw = Buffer.alloc(ct.length);
  for (let i = 0; i < ct.length; i++) raw[i] = ct[i] ^ ks[i];
  return JSON.parse(raw.toString("utf8"));
}

export function build(dist, site = siteOf(dist), secret = process.env.DATA_WRAP_KEY) {
  const tpl = readFileSync(join(dist, "index.html"), "utf8");
  const read = (f, d) => {
    try {
      const doc = JSON.parse(readFileSync(join(dist, f), "utf8"));
      const out = unwrapJson(doc, secret);
      return (out && out.v === 1 && out.ct) ? d : out; // still wrapped (no key): skip rather than crash the deploy
    } catch { return d; }
  };
  const sm = existsSync(join(dist, "sitemap.xml")) ? [...readFileSync(join(dist, "sitemap.xml"), "utf8").matchAll(/<loc>[^<]*?(\/[^<]*)<\/loc>/g)].map((x) => x[1]) : [];
  const list = pages({ site, index: read("data/index.json", {}), fixtures: read("data/fixtures.json", []), sitemap: sm.map((p) => p.replace(/^https?:\/\/[^/]+/, "")) });
  for (const [path, page] of list) {
    const file = path ? join(dist, `${path}.html`) : join(dist, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, render(tpl, page), "utf8");
  }
  return list.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = fileURLToPath(new URL("../dist", import.meta.url));
  console.log(`seo: ${build(dist)} pages`);
}
