/** The link to share for a player or one of his props: a /share path, which link previews read as a card (photo, name, line, listed price) and people are sent on to the real page. */
export function sharePlayerUrl(origin: string, idx: number, stat?: string | null, line?: number | null): string {
  const base = `${origin.replace(/\/+$/, "")}/share/player/${idx}`;
  return stat && line != null && Number.isFinite(line) ? `${base}/${encodeURIComponent(stat)}/${line}` : base;
}
export const shareFixtureUrl = (origin: string, id: string) => `${origin.replace(/\/+$/, "")}/share/fixture/${encodeURIComponent(id)}`;
export const shareVenueUrl = (origin: string, idx: number) => `${origin.replace(/\/+$/, "")}/share/venue/${idx}`;

/** Opens the phone's share sheet with the text (the link is inside it, so every app keeps both); on a computer, copies it. */
export async function sendShare(text: string, title: string, copied: () => void): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ title, text });
    else { await navigator.clipboard.writeText(text); copied(); }
  } catch { /* cancelled */ }
}

/** Trigger a file download in the browser (desktop fallback when Files share is unavailable). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Share a snapshot image with the accompanying text. Prefers `navigator.share({ files, text })` when the
 * browser can share files; otherwise downloads the image and copies the text.
 */
export async function sendShareImage({
  file,
  text,
  title,
  filename,
  copied,
  saved,
}: {
  file: File | Blob;
  text: string;
  title: string;
  filename: string;
  copied: () => void;
  saved?: () => void;
}): Promise<"shared" | "downloaded" | "cancelled"> {
  const asFile = file instanceof File ? file : new File([file], filename, { type: file.type || "image/png" });
  try {
    const payload: ShareData = { title, text, files: [asFile] };
    if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare(payload) && navigator.share) {
      await navigator.share(payload);
      return "shared";
    }
  } catch (err) {
    // user cancelled the sheet — do not fall through to download
    if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError") return "cancelled";
  }
  try {
    downloadBlob(asFile, filename);
    saved?.();
    if (text) {
      try { await navigator.clipboard.writeText(text); copied(); } catch { /* no clipboard */ }
    }
    return "downloaded";
  } catch { /* ignore */ }
  return "cancelled";
}
