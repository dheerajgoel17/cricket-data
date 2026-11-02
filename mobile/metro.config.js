const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");
const withSiteProxy = require("./dev-proxy");

const site = path.resolve(__dirname, "../site");
const config = getDefaultConfig(__dirname);

// The engine, storage and token packages and a few pure helpers (src/lib/priority.ts, home-phase.ts, assets.ts) live in ../site and are shared, never copied.
config.watchFolders = [...config.watchFolders, path.join(site, "packages"), path.join(site, "src/lib")];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@cricket/engine": path.join(site, "packages/engine"),
  "@cricket/storage": path.join(site, "packages/storage"),
  "@cricket/tokens": path.join(site, "packages/tokens"),
};

// The browser preview reads the site through Metro (dev-proxy.js).
config.server = { ...config.server, enhanceMiddleware: (middleware) => withSiteProxy(middleware) };

module.exports = config;
