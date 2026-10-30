import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vitest/config";

/** Dev only: serves /api/* with the same handlers Vercel runs (ask, live). */
function devApi(): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = /^\/api\/([a-z]+)$/.exec((req.url || "").split("?")[0] || "")?.[1];
        const load = name === "ask" ? () => import("./api/ask.js") : name === "live" ? () => import("./api/live.js") : name === "gate" ? () => import("./api/gate.js") : null;
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

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  resolve: { alias: [{ find: "@", replacement: path.resolve(import.meta.dirname, "src") }, { find: /^cn$/, replacement: path.resolve(import.meta.dirname, "src/lib/utils.ts") }] },
  server: { port: 4173 },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 600 },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"], include: ["src/**/*.test.{ts,tsx}"] },
});
