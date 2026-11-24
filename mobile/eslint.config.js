// Lint gate for the app: Expo's config (React, hooks, import checks). Errors fail CI; warnings are the backlog (React Compiler rules the older code does not meet yet).
const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expo,
  { ignores: ["node_modules/**", "android/**", "ios/**", "dist/**", ".expo/**"] },
  {
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Reanimated shared values are written with `.value =` by design; the compiler rule reads that as a mutation of an immutable value.
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);
