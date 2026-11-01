// One alert run: what is new since the last one, claimed in the table so it goes out once, posted to the channel. The message wording is alerts.js; this file only does the
// I/O in the right order, with every call injectable. Runtime-neutral (fetch only): run by the Cloudflare Worker once a minute.
import { clearedHits, fancyAlerts, MAX_FANCY, MAX_HITS, MAX_PROPS, messages, propAlerts } from "./alerts.js";
import { claimAlerts, releaseAlerts } from "./alert-claims.js";
import { CAPTION_MAX, sendMessage, sendPhoto, TelegramError } from "./telegram.js";

/** Messages posted per run: a backlog drips out over the next minutes instead of landing as one flood. */
export const MAX_MESSAGES = 4;

/**
 * One message, with its picture when it has one: as a photo with the text as caption when that fits, else as text with the picture above it. Telegram fetches the picture itself,
 * so if it cannot (a 400) the message goes out as plain text: a missing picture never loses an alert. Rate limits and other refusals are thrown.
 */
export async function deliver(telegram, msg, fetchImpl) {
  if (msg.image) {
    try {
      if (msg.text.length <= CAPTION_MAX) return await sendPhoto({ ...telegram, photo: msg.image, caption: msg.text, fetchImpl });
      return await sendMessage({ ...telegram, text: msg.text, image: msg.image, fetchImpl });
    } catch (e) { if (!(e instanceof TelegramError) || e.status !== 400) throw e; }
  }
  return sendMessage({ ...telegram, text: msg.text, fetchImpl });
}

/**
 * @param {object} o
 * @param {any[]} o.matches the live feed's matches (each with its settled `lines`)
 * @param {any} o.booksDoc the book lines file (`lines`, `fancy`)
 * @param {any} o.propsDoc the pipeline's `new_alerts.json`
 * @param {any} [o.fancyDoc] the fancy edge file, `fancy_alerts.json`
 * @param {{ token: string, chat: string }} o.telegram the bot token and the channel (`@username`)
 * @param {{ base: string, key: string, token: string }} o.db the claim table's address, public key and write token
 * @param {"post" | "preview"} [o.mode] preview builds the messages that would go out (what is new) and sends and marks nothing
 * @returns {Promise<{ candidates: number, fresh: number, sent: number, error?: string, messages?: { keys: string[], text: string }[] }>}
 */
export async function postAlerts({ matches, booksDoc, propsDoc, fancyDoc, telegram, db, siteUrl = "", now = Date.now(), fetchImpl = fetch, mode = "post", maxMessages = MAX_MESSAGES }) {
  const items = [...clearedHits(matches, booksDoc).slice(0, MAX_HITS), ...propAlerts(propsDoc, now, booksDoc).slice(0, MAX_PROPS), ...fancyAlerts(fancyDoc, now).slice(0, MAX_FANCY)];
  const out = { candidates: items.length, fresh: 0, sent: 0 };
  if (!items.length) return out;
  const keys = items.map((i) => i.key);
  let fresh;
  try { fresh = await claimAlerts({ keys, ...db, dry: mode === "preview", fetchImpl }); }
  catch (e) { return { ...out, error: `claim failed: ${String(e.message || e).slice(0, 100)}` }; } // nothing is posted without the table: it is what keeps a line from going out twice
  out.fresh = fresh.length;
  const batch = messages(items.filter((i) => fresh.includes(i.key)), { siteUrl });
  if (mode === "preview") return { ...out, messages: batch };
  const unsent = new Set(fresh);
  let error;
  for (const msg of batch.slice(0, maxMessages)) {
    try { await deliver(telegram, msg, fetchImpl); for (const k of msg.keys) unsent.delete(k); out.sent++; }
    catch (e) { error = e instanceof TelegramError ? e.message : "send failed"; break; } // 429 or any refusal: stop, the rest is tried again next run
  }
  if (unsent.size) await releaseAlerts({ keys: [...unsent], ...db, fetchImpl }).catch(() => { error = error || "release failed"; });
  return error ? { ...out, error } : out;
}
