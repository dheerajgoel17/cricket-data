/** Free Open-Meteo (no key): geocode a venue city, then current temp + weather code and the ground's local clock. */

export type VenueWx = {
  temp: number;
  label: string;
  /** Local wall-clock at the ground, e.g. "1:17 PM". */
  localTime: string;
  /** IANA zone from the forecast, for ticking the clock. */
  timeZone: string;
  city: string;
};

/** WMO weather interpretation codes → short label. */
export function wxLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95) return "Storm";
  return "—";
}

function queryOf(venue: string) {
  const parts = String(venue || "").split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
}

function formatLocal(iso: string, timeZone: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone, ...(/Asia\/(Kolkata|Calcutta)/.test(timeZone) ? { hour12: true } : {}) });
}

/** Geocode the venue's city, then fetch current conditions. Returns null when the place cannot be located. */
export async function fetchVenueWx(venue: string): Promise<VenueWx | null> {
  const q = queryOf(venue);
  if (q.length < 2) return null;
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: q, count: "1" })}`).then((r) => r.json());
  const hit = geo?.results?.[0];
  if (!hit || hit.latitude == null || hit.longitude == null) return null;
  const wx = await fetch(
    `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
      latitude: String(hit.latitude),
      longitude: String(hit.longitude),
      current: "temperature_2m,weather_code",
      timezone: "auto",
    })}`,
  ).then((r) => r.json());
  const cur = wx?.current;
  if (!cur || cur.temperature_2m == null) return null;
  const timeZone = String(wx.timezone || "UTC");
  return {
    temp: Math.round(Number(cur.temperature_2m)),
    label: wxLabel(Number(cur.weather_code) || 0),
    localTime: formatLocal(String(cur.time || ""), timeZone),
    timeZone,
    city: String(hit.name || q),
  };
}

/** Tick the ground's local clock from its IANA zone (viewer-independent). */
export function groundClock(timeZone: string, now = Date.now()) {
  try {
    return new Date(now).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return "";
  }
}
