// Extends app.json with what must not be written in a tracked file: the update server's URL comes from the build environment.
// Over-the-air updates (expo-updates): a JavaScript / asset-only change can reach installed apps without a new APK; anything native
// (a dependency, a plugin, a font, app.json) needs a new build AND a new `version` in app.json, which is the runtime an update must match. See docs/OPERATIONS.md "App updates".
module.exports = ({ config }) => {
  const url = process.env.EXPO_UPDATES_URL; // set for release builds; without it the app never looks for updates
  return {
    ...config,
    runtimeVersion: { policy: "appVersion" }, // the app version: deterministic on every machine (a fingerprint also reads the generated android/ folder, which a CI runner does not have)
    updates: url
      ? { url, enabled: true, checkAutomatically: "NEVER", fallbackToCacheTimeout: 0, requestHeaders: { "expo-channel-name": "production" } } // a locally built APK names its channel itself
      : { enabled: false },
  };
};
