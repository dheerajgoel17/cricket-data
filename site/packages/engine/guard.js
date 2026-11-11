// The "is this request from our own page" check the data gate uses. A browser tells the server where a request came from (Sec-Fetch-Site); a plain script usually does not.
// Modern Chrome, Edge and Firefox always send it, so one of those without it is a script wearing a browser's User-Agent. Safari older than 16.4 and other odd clients never send it and are let through.
// Plain ESM, no Node APIs: used by the Edge middleware and the /api/gate function.

/** `get(name)` returns a header value or null/undefined (a Headers.get, or a lookup on Node's lowercase header object). */
export function fromOurPage(get) {
  const site = String(get("sec-fetch-site") || "").toLowerCase();
  if (site) return site === "same-origin" || site === "same-site";
  return !/\b(Chrome|Chromium|Edg|Firefox|FxiOS|CriOS)\//.test(String(get("user-agent") || ""));
}

/** Scripts, SEO tools and AI training crawlers that name themselves: refused on /api and /data. Honest names only; a spoofed User-Agent is the rate limit's job (docs/OPERATIONS.md). */
export const BOT_UA = /curl|wget|python-requests|scrapy|httpx|aiohttp|go-http-client|libwww|okhttp|java\/|node-fetch|axios|undici|postmanruntime|selenium|puppeteer|playwright|phantomjs|headlesschrome|bytespider|gptbot|ccbot|claudebot|claude-web|anthropic-ai|amazonbot|meta-externalagent|facebookbot|diffbot|imagesiftbot|omgili|timpibot|cohere-ai|semrush|ahrefs|mj12bot|dotbot|dataforseo|petalbot|petalsearch|ia_archiver|megaindex/i;

/**
 * AI assistants and AI search that fetch a page for a person's question (not training crawlers): welcome on the pages people share, never on /api or /data.
 * They get the share HTML (title, summary, card) the link-preview bots get, so the answer can name and link the page without a copy of the data.
 */
export const ASSISTANT_UA = /chatgpt-user|oai-searchbot|claude-user|claude-searchbot|perplexitybot|perplexity-user|duckassistbot|mistralai-user|meta-externalfetcher/i;
