/** Heat steps for a value versus a line: +2 comfortably over, +1 over, 0 on the line, −1 under, −2 well under. */
export function heatStep(value: number, line: number): -2 | -1 | 0 | 1 | 2 {
  if (value === line) return 0;
  const ratio = (value - line) / Math.max(line, 0.5);
  if (ratio >= 0.5) return 2;
  if (ratio > 0) return 1;
  if (ratio > -0.5) return -1;
  return -2;
}

/** Tailwind classes for a heat step. Tokens only (primary / miss / amber). */
export function heatClass(step: -2 | -1 | 0 | 1 | 2): string {
  if (step === 2) return "bg-primary/45 text-primary";
  if (step === 1) return "bg-primary/20 text-primary";
  if (step === 0) return "bg-amber/25 text-amber";
  if (step === -1) return "bg-miss/20 text-miss";
  return "bg-miss/45 text-miss";
}

/** Hit-rate (0–1) as the same five-step scale. Null is muted. */
export function rateStep(p: number | null): -2 | -1 | 0 | 1 | 2 | null {
  if (p == null) return null;
  if (p >= 0.7) return 2;
  if (p >= 0.55) return 1;
  if (p >= 0.45) return 0;
  if (p >= 0.3) return -1;
  return -2;
}

export function rateClass(p: number | null): string {
  const s = rateStep(p);
  return s == null ? "bg-muted text-muted-foreground" : heatClass(s);
}
