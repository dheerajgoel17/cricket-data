// Posting to a Telegram channel (runtime-neutral: fetch only). The bot token is part of the request address, so no error ever carries the address: only the status and Telegram's own description.

export class TelegramError extends Error {
  /** @param {string} message @param {{ status?: number, retryAfter?: number }} [info] `retryAfter`: seconds Telegram asks us to wait after a 429 */
  constructor(message, { status = 0, retryAfter = 0 } = {}) { super(message); this.name = "TelegramError"; this.status = status; this.retryAfter = retryAfter; }
}

async function call(method, token, body, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parse_mode: "HTML", ...body }) });
  } catch { throw new TelegramError("Telegram unreachable"); }
  if (res.ok) return true;
  const err = await res.json().catch(() => ({}));
  throw new TelegramError(`Telegram HTTP ${res.status}: ${String(err?.description || "").slice(0, 120)}`, { status: res.status, retryAfter: Number(err?.parameters?.retry_after) || 0 });
}

/** Longest caption Telegram accepts on a photo. */
export const CAPTION_MAX = 1024;

/**
 * Sends one HTML-formatted message to `chat` (a channel's `@username` or its numeric id). Without `image` there is no link preview. With an `image` address the picture shows
 * above the text (Telegram fetches it itself, so it must be public). Throws TelegramError when Telegram refuses.
 */
export const sendMessage = ({ token, chat, text, image = "", fetchImpl = fetch }) =>
  call("sendMessage", token, { chat_id: chat, text, ...(image ? { link_preview_options: { url: image, show_above_text: true, prefer_large_media: true } } : { disable_web_page_preview: true }) }, fetchImpl);

/** Sends a picture (an address Telegram can fetch) with `caption` (at most CAPTION_MAX characters). Throws TelegramError when Telegram refuses or cannot fetch the picture. */
export const sendPhoto = ({ token, chat, photo, caption, fetchImpl = fetch }) => call("sendPhoto", token, { chat_id: chat, photo, caption }, fetchImpl);
