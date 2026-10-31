import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createStore } from "@cricket/engine/store.js";
import { Resolver } from "@cricket/engine/resolve.js";

const here = dirname(fileURLToPath(import.meta.url));
export const fixtureDir = join(here, "fixtures");

export async function loadFixture() {
  const base = join(fixtureDir, "data");
  const store = await createStore({ fetchJson: async (p) => JSON.parse(await readFile(join(base, p), "utf8")) });
  const exp = JSON.parse(await readFile(join(fixtureDir, "expectations.json"), "utf8"));
  const rz = new Resolver(store);
  const idx = (name) => store.P.nm.indexOf(name);
  return { store, rz, exp, idx };
}

export const sum = (a) => a.reduce((x, y) => x + y, 0);
