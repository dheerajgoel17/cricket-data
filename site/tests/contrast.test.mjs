import test from "node:test";
import assert from "node:assert/strict";
import tokens from "../packages/tokens/tokens.json" with { type: "json" };

const C = tokens.color;
const rgb = (hex) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and UI glyphs. Every text colour on every surface it is drawn on.
const SURFACES = ["background", "card", "secondary"];
const TEXT = ["foreground", "muted-foreground", "primary"];
test("body text colours reach 4.5:1 on every dark surface", () => {
  for (const s of SURFACES) for (const t of TEXT) {
    const r = contrast(C[t], C[s]);
    assert.ok(r >= 4.5, `${t} on ${s} is ${r.toFixed(2)}:1`);
  }
});
test("text on the accent fill reaches 4.5:1", () => {
  const r = contrast(C["primary-foreground"], C.primary);
  assert.ok(r >= 4.5, `primary-foreground on primary is ${r.toFixed(2)}:1`);
});
test("status colours reach 3:1 against the page (glyphs and large figures)", () => {
  for (const k of ["hit", "miss", "amber", "destructive"]) {
    const r = contrast(C[k], C.background);
    assert.ok(r >= 3, `${k} on background is ${r.toFixed(2)}:1`);
  }
});

test("form control borders reach 3:1 on the page and on cards (WCAG 1.4.11 non-text contrast)", () => {
  for (const surface of ["background", "card"]) {
    const r = contrast(C.input, C[surface]);
    assert.ok(r >= 3, `input border on ${surface} is ${r.toFixed(2)}:1`);
  }
});
