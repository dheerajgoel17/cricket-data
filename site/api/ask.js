// POST /api/ask {question} -> {plan, model}. Turns a free-text question into a query plan with the Gemini free tier.
// The model never sees data and never supplies numbers; the browser runs the validated plan on the real rows.
// Provider: xAI Grok when XAI_API_KEY is set (OpenAI-compatible endpoint, model from XAI_MODEL), else Gemini when GEMINI_API_KEY is set.
// Without a key the site uses its built-in parser. Keys live only in Vercel environment variables.
import { buildPrompt } from "../public/js/engine/prompt.js";
import { sanitizePlan } from "../public/js/engine/plan.js";

const MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite,gemini-2.5-flash").split(",").map((s) => s.trim()).filter(Boolean);
const PER_MINUTE = Number(process.env.ASK_PER_MINUTE || 12);
const DAILY_CAP = Number(process.env.ASK_DAILY_CAP || 800);
const hits = new Map();
let day = { d: "", n: 0 };

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  const d = new Date().toISOString().slice(0, 10);
  if (day.d !== d) day = { d, n: 0 };
  day.n++;
  return arr.length > PER_MINUTE || day.n > DAILY_CAP;
}

async function askGrok(key, system, user) {
  const model = process.env.XAI_MODEL || "grok-4-fast-non-reasoning";
  const r = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 600, response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`model ${model}: HTTP ${r.status}`);
  const j = await r.json();
  return { model, text: j?.choices?.[0]?.message?.content || "" };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const xaiKey = process.env.XAI_API_KEY;
  const key = process.env.GEMINI_API_KEY;
  if (!key && !xaiKey) return res.status(503).json({ error: "AI parsing is not configured; using the built-in parser" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 300) : "";
  if (!question) return res.status(400).json({ error: "question required" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  if (limited(ip)) return res.status(429).json({ error: "rate limit; using the built-in parser" });

  const { system, user } = buildPrompt(question, new Date().toISOString().slice(0, 10));
  let lastErr = "unavailable";
  if (xaiKey) {
    try {
      const { model, text } = await askGrok(xaiKey, system, user);
      return res.status(200).json({ plan: sanitizePlan(JSON.parse(text.replace(/^```json|```$/g, ""))), model });
    } catch (e) {
      lastErr = e.name === "TimeoutError" ? "grok: timeout" : String(e.message || "grok: unusable reply").slice(0, 80);
      if (!key) return res.status(502).json({ error: lastErr });
    }
  }
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 600, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) { lastErr = `model ${model}: HTTP ${r.status}`; continue; }
      const j = await r.json();
      const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
      const plan = sanitizePlan(JSON.parse(text.replace(/^```json|```$/g, "")));
      return res.status(200).json({ plan, model });
    } catch (e) {
      lastErr = `model ${model}: ${e.name === "TimeoutError" ? "timeout" : "unparseable reply"}`;
    }
  }
  return res.status(502).json({ error: lastErr });
}
