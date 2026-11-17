// The Fancy.cash brand on a canvas, exactly as the site header draws it (`BrandMark` + `Brand` in src/components/layout/Header.tsx): a dark rounded tile (the dark theme's) with the green-gradient F whose top arm ends in a ball, then "Fancy.cash" in Satoshi bold, one colour. Shared by the link card and the poster so the brand is drawn once.
export function drawBrandMark(g, x, y, size) {
  g.save(); g.translate(x, y); g.scale(size / 64, size / 64);
  g.fillStyle = "#1a1a1c"; g.beginPath(); g.roundRect(0, 0, 64, 64, 15); g.fill(); // the dark tile the header shows on the dark theme
  const fill = g.createLinearGradient(0, 0, 64, 64); fill.addColorStop(0, "#3cf0a6"); fill.addColorStop(1, "#1fb877");
  g.fillStyle = fill;
  for (const [bx, by, w, h] of [[17, 14, 10, 37], [17, 14, 25, 10], [17, 29.5, 18, 10]]) { g.beginPath(); g.roundRect(bx, by, w, h, 5); g.fill(); }
  g.beginPath(); g.arc(48.5, 19, 6, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** Mark + wordmark with the mark's top-left at (x, y). Returns the group's width. */
export function drawBrand(g, x, y, size, font) {
  drawBrandMark(g, x, y, size);
  const fs = Math.round(size * 0.62);
  g.font = `${fs}px ${font}`; g.fillStyle = "#ffffff"; g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.fillText("Fancy.cash", x + size + size * 0.28, y + size / 2 + fs * 0.34);
  return size + size * 0.28 + g.measureText("Fancy.cash").width;
}

/** Width of the group `drawBrand` would draw, so it can be right-aligned. */
export function brandWidth(g, size, font) {
  g.font = `${Math.round(size * 0.62)}px ${font}`;
  return size + size * 0.28 + g.measureText("Fancy.cash").width;
}

/** The visible part of a logo: source logos carry transparent padding, so a crest drawn "full size" is cropped to its non-transparent pixels first. Returns {sx, sy, sw, sh} in image pixels (the whole image when it cannot be read). */
export function visibleBounds(createCanvas, img) {
  const whole = { sx: 0, sy: 0, sw: img.width, sh: img.height };
  try {
    const k = Math.min(1, 400 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    const c = createCanvas(w, h), g = c.getContext("2d");
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0 || y1 < y0) return whole;
    return { sx: x0 / k, sy: y0 / k, sw: (x1 - x0 + 1) / k, sh: (y1 - y0 + 1) / k };
  } catch { return whole; }
}
