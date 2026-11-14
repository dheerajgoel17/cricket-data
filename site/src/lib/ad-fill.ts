/** Session memory for AdSense empty outcomes: skip remounting a unit that just failed to fill. */

export const EMPTY_TTL_MS = 10 * 60_000;
const PREFIX = "ad-empty:";

type Entry = { t: number };

const keyOf = (slotId: string, unit: string) => `${PREFIX}${slotId}|${unit}`;

function store(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

/** True when this slot+unit was marked empty within EMPTY_TTL_MS. */
export function isAdEmptyCached(slotId: string, unit: string, now = Date.now()): boolean {
  const s = store();
  if (!s || !unit) return false;
  try {
    const raw = s.getItem(keyOf(slotId, unit));
    if (!raw) return false;
    const e = JSON.parse(raw) as Entry;
    if (!e || typeof e.t !== "number") return false;
    if (now - e.t > EMPTY_TTL_MS) {
      s.removeItem(keyOf(slotId, unit));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markAdEmpty(slotId: string, unit: string, now = Date.now()): void {
  const s = store();
  if (!s || !unit) return;
  try {
    s.setItem(keyOf(slotId, unit), JSON.stringify({ t: now } satisfies Entry));
  } catch { /* private mode / full */ }
}

export function clearAdEmpty(slotId: string, unit: string): void {
  const s = store();
  if (!s || !unit) return;
  try {
    s.removeItem(keyOf(slotId, unit));
  } catch { /* ignore */ }
}
