// Extends app.json with what must not be written in a tracked file: the update server's URL comes from the build environment.
// Over-the-air updates (expo-updates): a JavaScript / asset-only change can reach installed apps without a new APK; anything native
// (a dependency, a plugin, a font, app.json) changes the runtime version (fingerprint) and needs a new build. See docs/OPERATIONS.md "App updates".
module.exports = ({ config }) => {
  const url = process.env.EXPO_UPDATES_URL; // set for release builds; without it the app never looks for updates
  return {
    ...config,
    runtimeVersion: { policy: "fingerprint" },
    updates: url
      ? { url, enabled: true, checkAutomatically: "NEVER", fallbackToCacheTimeout: 0 }
      : { enabled: false },
  };
};
