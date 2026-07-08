import { AiConfig } from "../models/AiConfig";
import type { LeadHint } from "./leadKeywords";

interface AiResponse {
  leadStatus: "interested" | "not_interested" | "neutral" | "unclassified";
  aiReason: string;
  aiDraft: string;
  aiSummary: string;
}

// Default model per provider (used when no model is configured in AiConfig).
const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  grok: "grok-2-1212",
  nvidia: "meta/llama-3.3-70b-instruct",
  gemini: "gemini-2.5-flash",
  claude: "claude-3-5-sonnet-latest",
};

const OPENAI_COMPATIBLE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  grok: "https://api.x.ai/v1/chat/completions",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
};

// System prompt to define classification rules and reply requirements
const SYSTEM_PROMPT = `You are an AI Email Assistant for a B2B and B2C email marketing platform.
Analyze the incoming email reply and perform three tasks:
1. Classify the lead status:
   - "interested": The sender shows interest, asks for pricing, wants a demo, requests a call, or asks clarifying questions about the offer.
   - "not_interested": The sender declines, asks to be removed, says "no thanks", or is hostile.
   - "neutral": General inquiries, out of office messages, or ambiguous replies.
2. Draft a professional response:
   - If "interested", write a warm, professional, and action-oriented follow-up to book a call or answer their query.
   - If "not_interested", write a polite, concise acknowledgment respecting their request (e.g. "Thank you for letting us know. We have removed you from our list.").
   - If "neutral", write a helpful, professional response to clarify their request.
3. Summarize the email: ONE short line (max ~25 words, one or two sentences) capturing what the sender wants, so an admin instantly gets the context. Be concise and factual — no filler.

A lightweight keyword pre-classifier may provide a hint. Treat it as a signal, not a rule; your reading of the email content takes priority.

You MUST respond ONLY with a valid JSON object in the following format. Do not include any markdown styling (like \`\`\`json) or extra text outside the JSON.
{
  "leadStatus": "interested" | "not_interested" | "neutral",
  "aiReason": "1 sentence explaining the classification",
  "aiDraft": "The drafted email response",
  "aiSummary": "one short line (max ~25 words) summarizing the email"
}`;

const THREAD_SUMMARY_PROMPT = `You are an AI Email Assistant. You will receive a chronological transcript of an email conversation between our team and a prospect.
Write a ONE-LINE summary (STRICTLY 25 words or fewer, a single sentence) reflecting the LATEST context: what the prospect wants and the next step. This is a quick-glance line for an admin scanning a table.
Do NOT write multiple sentences. Do NOT exceed 25 words.
Respond with ONLY the summary sentence. No preamble, no markdown, no JSON, no line breaks.`;

interface ProviderContext {
  provider: string;
  apiKey: string;
  model: string;
}

async function getActiveProvider(): Promise<ProviderContext | null> {
  const activeConfig = await AiConfig.findOne({ isActive: true });
  if (!activeConfig) {
    console.log("No active AI provider configured.");
    return null;
  }
  const provider = activeConfig.provider as string;
  return {
    provider,
    apiKey: activeConfig.apiKey as string,
    model: (activeConfig.model as string) || DEFAULT_MODELS[provider] || "",
  };
}

/**
 * Dispatch a single-turn chat request to the active provider and return the raw
 * text of the model's reply. `jsonMode` requests structured JSON output where
 * the provider supports it.
 */
// Max time to wait for a provider response. Large reasoning models (e.g.
// z-ai/glm-5.2 on NVIDIA) can take a couple of minutes to respond on a cold
// start; without an explicit signal the request hangs on undici's default
// header timeout. 180s covers cold starts while still failing cleanly.
const AI_TIMEOUT_MS = 180000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fetch with a timeout and automatic retry on rate-limit / transient errors
// (429 Too Many Requests, 503 Service Unavailable). Free-tier LLMs (e.g. the
// Gemini free tier at ~15 req/min) return 429 under bursts; backing off and
// retrying keeps bulk classification/summarization reliable.
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const maxAttempts = 4;
  let lastRes: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if ((res.status === 429 || res.status === 503) && attempt < maxAttempts) {
        lastRes = res;
        // Exponential backoff: 4s, 8s, 16s.
        await sleep(4000 * 2 ** (attempt - 1));
        continue;
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  return lastRes as Response;
}

async function callProvider(
  ctx: ProviderContext,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean
): Promise<string> {
  const { provider, apiKey, model } = ctx;

  if (provider === "gemini") {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nUser Input:\n${userPrompt}` }] }],
          ...(jsonMode
            ? { generationConfig: { responseMimeType: "application/json" } }
            : {}),
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini API returned status ${res.status}`);
    const data = (await res.json()) as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "openai" || provider === "grok" || provider === "nvidia") {
    const url = OPENAI_COMPATIBLE_URLS[provider];
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        // Cap output so slow reasoning models (e.g. z-ai/glm-5.2) finish quickly —
        // classification/summary responses are small, they don't need thousands
        // of tokens, and a low cap keeps non-streaming latency well under timeout.
        max_tokens: 700,
        temperature: 0.2,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${provider} API returned status ${res.status}`);
    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || "";
  }

  if (provider === "claude") {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API returned status ${res.status}`);
    const data = (await res.json()) as any;
    return data.content?.[0]?.text || "";
  }

  return "";
}

// Guarantee a summary is a single short line for the leads table, regardless of
// what the model returned. Keeps the first sentence and caps at ~28 words.
export function enforceOneLine(summary: string): string {
  const flat = (summary || "").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const firstSentence = flat.split(/(?<=[.!?])\s+/)[0] || flat;
  const words = firstSentence.split(" ");
  const capped = words.length > 28 ? `${words.slice(0, 28).join(" ")}…` : firstSentence;
  return capped;
}

// Produce a readable, non-AI summary from raw email text: strip quoted reply
// history, signatures and boilerplate, then take the first meaningful sentences.
// Used as a fallback so the summary column is never empty when the LLM is down.
export function basicSummary(subject: string, body: string): string {
  // Cut off everything from the start of quoted history: "On <date> X wrote:",
  // "-----Original Message-----", or the first quoted line. This handles inline
  // quotes that aren't on their own line.
  let head = body || "";
  const cutMarkers = [
    /On [\s\S]{0,120}?wrote:/i, // "On <date> <name> wrote:" (may span lines)
    /-----\s*Original Message\s*-----/i,
    /_{5,}/,
    /From:[\s\S]*?Sent:/i,
  ];
  for (const marker of cutMarkers) {
    const idx = head.search(marker);
    if (idx > 0) head = head.slice(0, idx);
  }

  const cleaned = head
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;
      if (l.startsWith(">")) return false; // quoted reply
      if (/^(from|sent|to|subject|cc|date):/i.test(l)) return false; // quoted headers
      if (/^-{2,}|^_{2,}/.test(l)) return false; // signature / separators
      if (/^##.*please type your reply/i.test(l)) return false; // ticketing boilerplate
      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const source = cleaned || subject || "";
  if (!source) return "";

  // One short line for quick admin context.
  return enforceOneLine(source);
}

// When the LLM is unavailable (no provider, error, or timeout), fall back to the
// lightweight keyword classifier so leads still populate. This keeps "sync ->
// AI leads" working even when the configured provider is down or rate-limited.
// `subject`/`body` are used to still produce a basic (non-AI) summary.
function keywordFallback(keywordHint?: LeadHint, subject = "", body = ""): AiResponse {
  let leadStatus: AiResponse["leadStatus"] = "neutral";
  if (keywordHint === "likely_interested") leadStatus = "interested";
  else if (keywordHint === "likely_negative") leadStatus = "not_interested";

  // Holding reply used when the AI cannot draft a tailored response. Sending a
  // prompt acknowledgement keeps the prospect engaged until a human follows up.
  const fallbackDraft =
    leadStatus === "not_interested"
      ? "Thank you for letting us know. We've noted your response and won't reach out further."
      : "Thank you for your message. We are currently reviewing your request and will get back to you shortly.";

  return {
    leadStatus,
    aiReason:
      leadStatus === "neutral"
        ? "Classified by keyword heuristic (AI unavailable)."
        : `Classified as ${leadStatus} by keyword heuristic (AI unavailable).`,
    aiDraft: fallbackDraft,
    aiSummary: basicSummary(subject, body),
  };
}

export async function runAiClassification(
  subject: string,
  body: string,
  keywordHint?: LeadHint
): Promise<AiResponse> {
  try {
    const ctx = await getActiveProvider();
    if (!ctx) return keywordFallback(keywordHint, subject, body);

    const hintLine = keywordHint ? `Keyword pre-classifier hint: ${keywordHint}\n` : "";
    const prompt = `${hintLine}Email Subject: ${subject}\nEmail Body:\n${body}`;

    const jsonText = await callProvider(ctx, SYSTEM_PROMPT, prompt, true);
    if (!jsonText) return keywordFallback(keywordHint, subject, body);

    // Sometimes models wrap responses in a ```json block even when instructed not to.
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    const cleanedText = jsonMatch ? jsonMatch[0] : jsonText;

    const parsed = JSON.parse(cleanedText);

    return {
      leadStatus: parsed.leadStatus || "neutral",
      aiReason: parsed.aiReason || "AI Classified",
      aiDraft: parsed.aiDraft || "",
      aiSummary: enforceOneLine(parsed.aiSummary || ""),
    };
  } catch (error) {
    console.error("AI classification error:", error);
    return keywordFallback(keywordHint, subject, body);
  }
}

export interface ThreadMessage {
  fromMe: boolean;
  subject: string;
  text: string;
  date: Date | string;
}

/**
 * Produce an up-to-date running summary of an email conversation, reflecting the
 * latest context. Returns an empty string on any failure so callers can fall
 * back to an existing summary without breaking sync.
 */
export async function summarizeThread(messages: ThreadMessage[]): Promise<string> {
  if (!messages || messages.length === 0) return "";

  // Non-AI fallback: summarize the most recent message in the thread.
  const latest = messages[messages.length - 1];
  const fallback = basicSummary(latest.subject, latest.text);

  try {
    const ctx = await getActiveProvider();
    if (!ctx) return fallback;

    const transcript = messages
      .map((m) => {
        const who = m.fromMe ? "US" : "PROSPECT";
        const when =
          m.date instanceof Date ? m.date.toISOString() : String(m.date);
        return `[${who}] (${when}) ${m.subject}\n${m.text}`;
      })
      .join("\n\n---\n\n");

    const summary = await callProvider(
      ctx,
      THREAD_SUMMARY_PROMPT,
      `Conversation transcript (oldest first):\n\n${transcript}`,
      false
    );

    return enforceOneLine(summary) || fallback;
  } catch (error) {
    console.error("Thread summary error:", error);
    return fallback;
  }
}

export async function testAiConnection(provider: string, apiKey: string): Promise<boolean> {
  try {
    const model = DEFAULT_MODELS[provider] || "";
    const jsonText = await callProvider(
      { provider, apiKey, model },
      "You are a connection test assistant.",
      "Reply with 'success' if you receive this message.",
      false
    );
    return jsonText.toLowerCase().includes("success");
  } catch (error) {
    console.error(`AI Connection test failed for ${provider}:`, error);
    return false;
  }
}
