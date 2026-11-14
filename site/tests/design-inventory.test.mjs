import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("the design system registry matches web and native UI sources", () => {
  execFileSync(process.execPath, [fileURLToPath(new URL("../scripts/design-inventory.mjs", import.meta.url)), "--check"]);
});
