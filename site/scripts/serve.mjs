// Local dev server: static files from public/ plus /api/ask (same handler as Vercel). `node scripts/serve.mjs [port]`
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/ask.js";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const port = Number(process.argv[2] || process.env.PORT || 3000);

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/ask") {
    let raw = "";
    for await (const c of req) raw += c;
    req.body = raw;
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
    return handler(req, res);
  }
  let p = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!p.startsWith(root)) { res.statusCode = 403; return res.end(); }
  const cacheFor = (urlPath, file) => {
    if (urlPath.startsWith("/data/")) return "public, max-age=300, stale-while-revalidate=3300";
    if (urlPath.startsWith("/js/") || urlPath.startsWith("/css/")) return "public, max-age=300, stale-while-revalidate=86400";
    if (file.endsWith(".html")) return "public, max-age=0, must-revalidate";
    return "public, max-age=0, must-revalidate";
  };
  try {
    if ((await stat(p)).isDirectory()) p = join(p, "index.html");
    res.setHeader("content-type", types[extname(p)] || "application/octet-stream");
    res.setHeader("cache-control", cacheFor(url.pathname, p));
    res.end(await readFile(p));
  } catch {
    if (extname(p)) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("content-type", "text/html");
    res.setHeader("cache-control", "public, max-age=0, must-revalidate");
    res.end(await readFile(join(root, "index.html"))); // SPA fallback, like the vercel.json rewrite
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
