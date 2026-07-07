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
  nvidia: "z-ai/glm-5.2",
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
3. Summarize the email: a neutral 2-3 sentence summary of what the sender wants and the current state of the conversation.

A lightweight keyword pre-classifier may provide a hint. Treat it as a signal, not a rule; your reading of the email content takes priority.

You MUST respond ONLY with a valid JSON object in the following format. Do not include any markdown styling (like \`\`\`json) or extra text outside the JSON.
{
  "leadStatus": "interested" | "not_interested" | "neutral",
  "aiReason": "1 sentence explaining the classification",
  "aiDraft": "The drafted email response",
  "aiSummary": "2-3 sentence neutral summary of the email"
}`;

const THREAD_SUMMARY_PROMPT = `You are an AI Email Assistant. You will receive a chronological transcript of an email conversation between our team and a prospect.
Write a concise, up-to-date 2-3 sentence summary of the conversation that reflects the LATEST context: what the prospect wants, what has been discussed, and the current state / next step.
Respond with ONLY the summary text. No preamble, no markdown, no JSON.`;

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
async function callProvider(
  ctx: ProviderContext,
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean
): Promise<string> {
  const { provider, apiKey, model } = ctx;

  if (provider === "gemini") {
    const res = await fetch(
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
    const res = await fetch(url, {
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
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${provider} API returned status ${res.status}`);
    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || "";
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
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

export async function runAiClassification(
  subject: string,
  body: string,
  keywordHint?: LeadHint
): Promise<AiResponse> {
  const defaultResponse: AiResponse = {
    leadStatus: "neutral",
    aiReason: "AI sync fallback",
    aiDraft: "Thank you for your reply.",
    aiSummary: "",
  };

  try {
    const ctx = await getActiveProvider();
    if (!ctx) return defaultResponse;

    const hintLine = keywordHint ? `Keyword pre-classifier hint: ${keywordHint}\n` : "";
    const prompt = `${hintLine}Email Subject: ${subject}\nEmail Body:\n${body}`;

    const jsonText = await callProvider(ctx, SYSTEM_PROMPT, prompt, true);
    if (!jsonText) return defaultResponse;

    // Sometimes models wrap responses in a ```json block even when instructed not to.
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    const cleanedText = jsonMatch ? jsonMatch[0] : jsonText;

    const parsed = JSON.parse(cleanedText);

    return {
      leadStatus: parsed.leadStatus || "neutral",
      aiReason: parsed.aiReason || "AI Classified",
      aiDraft: parsed.aiDraft || "",
      aiSummary: parsed.aiSummary || "",
    };
  } catch (error) {
    console.error("AI classification error:", error);
    return defaultResponse;
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
  try {
    if (!messages || messages.length === 0) return "";

    const ctx = await getActiveProvider();
    if (!ctx) return "";

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

    return (summary || "").trim();
  } catch (error) {
    console.error("Thread summary error:", error);
    return "";
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
