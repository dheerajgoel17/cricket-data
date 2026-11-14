import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dirs = ["site/src/components/app", "site/src/components/ui", "site/src/components/layout", "site/src/pages", "mobile/src/ui", "mobile/src/components", "mobile/src/app"];

function files(dir) {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = dir + "/" + entry.name;
    if (entry.isDirectory()) return files(path);
    return path.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(path) ? [path] : [];
  });
}

const paths = dirs.flatMap(files).sort();
// Index named exports and direct imports. This inventory deliberately excludes inferred APIs.
function exportedComponents(source) {
  const names = [...source.matchAll(/^export (?:default )?(?:function|class|const) ([A-Z][a-zA-Z0-9]+)/gm)].map((m) => m[1]);
  for (const match of source.matchAll(/^export \{([^}]+)\}/gm)) {
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).at(-1);
      if (/^[A-Z][a-zA-Z0-9]+$/.test(name)) names.push(name);
    }
  }
  return [...new Set(names)].sort();
}

const modules = new Set(paths);
const inventory = paths.map((path) => {
  const source = readFileSync(resolve(root, path), "utf8");
  return {
  path,
  platform: path.startsWith("site/") ? "web" : path.endsWith(".ios.tsx") ? "ios" : path.endsWith(".android.tsx") ? "android" : "native",
  route: path.startsWith("mobile/src/app/") || path.startsWith("site/src/pages/"),
  exports: exportedComponents(source),
  dependencies: [...source.matchAll(/^import [\s\S]*? from ["']([^"']+)["']/gm)].flatMap(([, spec]) => {
      const base = spec.startsWith(".")
        ? relative(root, resolve(root, path, "..", spec))
        : spec.startsWith("@/") ? (path.startsWith("site/") ? "site/src/" : "mobile/src/") + spec.slice(2) : "";
      return modules.has(base + ".tsx") ? [base + ".tsx"] : [];
    }),
  };
});
const target = resolve(root, "site/src/components/design-system/inventory.generated.json");
const content = JSON.stringify(inventory, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== content) throw new Error("Design inventory is stale. Run npm run design:inventory.");
} else {
  writeFileSync(target, content);
  process.stdout.write(`Indexed ${inventory.length} UI modules.\n`);
}
