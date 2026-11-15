import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { liveQuery } from "@/lib/queries";

/** Android: delay the first /api/live network poll so unwrap does not fight seed paint; kept MMKV live still shows. */
export const ANDROID_LIVE_DEFER_MS = 4_000;

type LiveResult = ReturnType<typeof useQuery<any>> & { gateOpen: boolean }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * The 15 s live scores doc. Pass `defer` on Android Home paths (rail, hot, lines-live) so the first
 * network unwrap waits a few seconds. Kept `initialData` still paints scores immediately.
 * Fixture / Player / Fancy tab call without `defer` and fetch at once.
 *
 * `gateOpen` is false until the defer ends — `useLinesLive` uses it so in-play merge does not run early.
 */
export function useLive(opts?: { defer?: boolean }): LiveResult {
  const wantDefer = !!(opts?.defer && Platform.OS === "android");
  const [gateOpen, setGateOpen] = useState(!wantDefer);
  useEffect(() => {
    if (!wantDefer) { setGateOpen(true); return; }
    const t = setTimeout(() => setGateOpen(true), ANDROID_LIVE_DEFER_MS);
    return () => clearTimeout(t);
  }, [wantDefer]);
  // Keep initialData visible while deferred: only the network fetch waits on gateOpen.
  const q = useQuery({ ...liveQuery, enabled: !wantDefer || gateOpen });
  return { ...q, gateOpen };
}
