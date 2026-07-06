import { AiConfig } from "../models/AiConfig";

interface AiResponse {
  leadStatus: "interested" | "not_interested" | "neutral" | "unclassified";
  aiReason: string;
  aiDraft: string;
}

// System prompt to define classification rules and reply requirements
const SYSTEM_PROMPT = `You are an AI Email Assistant for a B2B and B2C email marketing platform.
Analyze the incoming email reply and perform two tasks:
1. Classify the lead status:
   - "interested": The sender shows interest, asks for pricing, wants a demo, requests a call, or asks clarifying questions about the offer.
   - "not_interested": The sender declines, asks to be removed, says "no thanks", or is hostile.
   - "neutral": General inquiries, out of office messages, or ambiguous replies.
2. Draft a professional response:
   - If "interested", write a warm, professional, and action-oriented follow-up to book a call or answer their query.
   - If "not_interested", write a polite, concise acknowledgment respecting their request (e.g. "Thank you for letting us know. We have removed you from our list.").
   - If "neutral", write a helpful, professional response to clarify their request.

You MUST respond ONLY with a valid JSON object in the following format. Do not include any markdown styling (like \`\`\`json) or extra text outside the JSON.
{
  "leadStatus": "interested" | "not_interested" | "neutral",
  "aiReason": "1 sentence explaining the classification",
  "aiDraft": "The drafted email response"
}`;

export async function runAiClassification(subject: string, body: string): Promise<AiResponse> {
  const defaultResponse: AiResponse = {
    leadStatus: "neutral",
    aiReason: "AI sync fallback",
    aiDraft: "Thank you for your reply.",
  };

  try {
    // Find active config
    const activeConfig = await AiConfig.findOne({ isActive: true });
    if (!activeConfig) {
      console.log("No active AI provider configured.");
      return defaultResponse;
    }

    const { provider, apiKey } = activeConfig;
    const prompt = `Email Subject: ${subject}\nEmail Body:\n${body}`;

    let jsonText = "";

    if (provider === "gemini") {
      // Gemini API
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Input:\n${prompt}` }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );
      if (!res.ok) throw new Error(`Gemini API returned status ${res.status}`);
      const data = (await res.json()) as any;
      jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } 
    else if (provider === "openai" || provider === "grok" || provider === "nvidia") {
      // OpenAI-compatible Chat Completions
      let url = "https://api.openai.com/v1/chat/completions";
      let model = "gpt-4o-mini";

      if (provider === "grok") {
        url = "https://api.x.ai/v1/chat/completions";
        model = "grok-2-1212";
      } else if (provider === "nvidia") {
        url = "https://integrate.api.nvidia.com/v1/chat/completions";
        model = "meta/llama-3.1-405b-instruct";
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`${provider} API returned status ${res.status}`);
      const data = (await res.json()) as any;
      jsonText = data.choices?.[0]?.message?.content || "";
    } 
    else if (provider === "claude") {
      // Anthropic Claude
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new Error(`Claude API returned status ${res.status}`);
      const data = (await res.json()) as any;
      jsonText = data.content?.[0]?.text || "";
    }

    if (!jsonText) return defaultResponse;

    // Parse JSON safely
    // Sometimes models wrap responses in ```json block even when instructed not to
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    const cleanedText = jsonMatch ? jsonMatch[0] : jsonText;
    
    const parsed = JSON.parse(cleanedText);
    
    return {
      leadStatus: parsed.leadStatus || "neutral",
      aiReason: parsed.aiReason || "AI Classified",
      aiDraft: parsed.aiDraft || "",
    };

  } catch (error) {
    console.error("AI classification error:", error);
    return defaultResponse;
  }
}
export async function testAiConnection(provider: string, apiKey: string): Promise<boolean> {
  try {
    const prompt = "Reply with 'success' if you receive this message.";
    let jsonText = "";

    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as any;
        jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    } 
    else if (provider === "openai" || provider === "grok" || provider === "nvidia") {
      let url = "https://api.openai.com/v1/chat/completions";
      let model = "gpt-4o-mini";
      if (provider === "grok") {
        url = "https://api.x.ai/v1/chat/completions";
        model = "grok-2-1212";
      } else if (provider === "nvidia") {
        url = "https://integrate.api.nvidia.com/v1/chat/completions";
        model = "meta/llama-3.1-405b-instruct";
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        jsonText = data.choices?.[0]?.message?.content || "";
      }
    } 
    else if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-latest",
          max_tokens: 100,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        jsonText = data.content?.[0]?.text || "";
      }
    }

    return jsonText.toLowerCase().includes("success");
  } catch (error) {
    console.error(`AI Connection test failed for ${provider}:`, error);
    return false;
  }
}
