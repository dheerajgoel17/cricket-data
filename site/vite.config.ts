import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vitest/config";

/** Dev only: serves /api/ask with the same handler Vercel runs, so the Ask page works locally. */
function devApi(): Plugin {
  return {
    name: "dev-api-ask",
    configureServer(server) {
      server.middlewares.use("/api/ask", async (req, res) => {
        const { default: handler } = await import("./api/ask.js");
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
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  server: { port: 4173 },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 600 },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"], include: ["src/**/*.test.{ts,tsx}"] },
});
