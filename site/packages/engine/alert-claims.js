// The table of alerts already sent (runtime-neutral: fetch only). Like the match-state writer, this holds only the project's PUBLIC key and the write token; the table can only be
// reached through claim_alerts / release_alerts (supabase/migrations), which check the token's hash. Claiming a key is atomic, so two overlapping runs can never both post it.

async function rpc(name, body, { base, key, fetchImpl }) {
  const res = await fetchImpl(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json", "User-Agent": "cricket-props-hub-alerts/0.2 (server)" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${name} -> HTTP ${res.status}`);
  return res.json().catch(() => null);
}

/**
 * Marks `keys` as sent and returns the ones that were NOT sent before (so only those are posted). With `dry` nothing is marked: it only says which are new.
 * Throws when the database refuses, and the caller then posts nothing (a missing table never turns into a flood).
 */
export async function claimAlerts({ keys, base, key, token, dry = false, fetchImpl = fetch }) {
  if (!keys.length) return [];
  const out = await rpc("claim_alerts", { token, keys, dry }, { base, key, fetchImpl });
  return Array.isArray(out) ? out.filter((k) => keys.includes(k)) : [];
}

/** Gives claimed keys back (a post that failed), so the next run tries them again. */
export async function releaseAlerts({ keys, base, key, token, fetchImpl = fetch }) {
  if (!keys.length) return;
  await rpc("release_alerts", { token, keys }, { base, key, fetchImpl });
}
