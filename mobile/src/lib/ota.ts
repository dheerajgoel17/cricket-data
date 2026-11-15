import * as Updates from "expo-updates";

/**
 * Over-the-air updates, quietly: once per launch, after the first screen is up, ask the update server whether a newer JavaScript bundle exists for this build's runtime, download it in the
 * background, and let it take over on the next launch (never reload under the user's finger). Does nothing in development, on the web, or in a build made without an update URL.
 * A change that touched native code has another runtime version and is never offered to this build (it needs a new APK).
 */
export async function checkForUpdate() {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const r = await Updates.checkForUpdateAsync();
    if (r.isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // offline or the server is down: the app keeps the bundle it has
  }
}
