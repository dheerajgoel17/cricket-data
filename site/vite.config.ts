import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv, type ProxyOptions } from "vite";
import { defineConfig, type Plugin } from "vitest/config";

/** Drop Secure so the production gate cookie is stored on http://localhost. */
function localhostCookies(proxy: { on: (ev: string, fn: (proxyRes: { headers: Record<string, string | string[] | undefined> }) => void) => void }) {
  proxy.on("proxyRes", (proxyRes) => {
    const sc = proxyRes.headers["set-cookie"];
    if (!sc) return;
    proxyRes.headers["set-cookie"] = (Array.isArray(sc) ? sc : [sc]).map((c) => c.replace(/;\s*Secure/gi, ""));
  });
}

function prodProxy(site: string): ProxyOptions {
  return { target: site, changeOrigin: true, cookieDomainRewrite: "localhost", configure: localhostCookies };
}

/** Dev only: serves /api/* with the same handlers Vercel runs, unless SITE_URL is set (then those routes come from production). */
function devApi(localLive: boolean): Plugin {
  return {
    name: "dev-api",
    configResolved(config) { for (const [k, v] of Object.entries(loadEnv(config.mode, config.root, ""))) process.env[k] ??= v; }, // site/.env.local feeds the handlers' process.env
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = /^\/api\/([a-z]+)$/.exec((req.url || "").split("?")[0] || "")?.[1];
        const load = name === "live" && localLive ? () => import("./api/live.js") : name === "gate" && localLive ? () => import("./api/gate.js") : null;
        if (!load) return next();
        const { default: handler } = await load();
        let raw = "";
        for await (const c of req) raw += c;
        (req as any).body = raw; // eslint-disable-line @typescript-eslint/no-explicit-any
        (res as any).status = (c: number) => { res.statusCode = c; return res; }; // eslint-disable-line @typescript-eslint/no-explicit-any
        (res as any).json = (o: unknown) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); }; // eslint-disable-line @typescript-eslint/no-explicit-any
        return handler(req, res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const site = String(env.SITE_URL || process.env.SITE_URL || "").replace(/\/$/, "");
  const useProd = !!site && mode !== "test";
  if (useProd) console.info(`[vite] ${site} for /data, /api/gate, /api/live`);
  const proxy = useProd ? { "/data": prodProxy(site), "/api/gate": prodProxy(site), "/api/live": prodProxy(site) } : undefined;
  return {
    plugins: [react(), tailwindcss(), devApi(!useProd)],
    resolve: { alias: [{ find: "@", replacement: path.resolve(import.meta.dirname, "src") }, { find: /^cn$/, replacement: path.resolve(import.meta.dirname, "src/lib/utils.ts") }] },
    server: { port: 4173, proxy },
    preview: { port: 4173, proxy },
    build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 600 },
    test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"], include: ["src/**/*.test.{ts,tsx}"] },
  };
});
