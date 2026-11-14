/** CSS length → device pixels (16 px rem). Handles `Nrem`, `Npx`, and `clamp(min, …, max)` (uses max). */
export function remPx(value, base = 16) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value).trim();
  const clamp = /^clamp\(([^,]+),[^,]+,([^)]+)\)$/i.exec(s);
  if (clamp) return remPx(clamp[2].trim(), base);
  const rem = /^([\d.]+)rem$/i.exec(s);
  if (rem) return Math.round(parseFloat(rem[1]) * base);
  const px = /^([\d.]+)px$/i.exec(s);
  if (px) return Math.round(parseFloat(px[1]));
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
