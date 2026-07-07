// Lightweight, dependency-free lead-intent scorer.
//
// This is a transparent weighted-lexicon classifier (Naive-Bayes-style): each
// matched keyword/phrase contributes its weight to a running score. It is fast,
// deterministic, and runs on every synced email to decide whether an expensive
// LLM classification call is warranted.
//
// - score >= STRONG_THRESHOLD  -> strong lead candidate (send to LLM)
// - score <= NEGATIVE_THRESHOLD -> clearly not interested (skip LLM, tag directly)
// - otherwise                   -> unclear, still send to LLM with the hint

export const STRONG_THRESHOLD = 3;
export const NEGATIVE_THRESHOLD = -3;

export type LeadHint = "likely_interested" | "likely_negative" | "unclear";

export interface LeadScore {
  score: number;
  hits: string[];
  hint: LeadHint;
}

interface WeightedTerm {
  term: string;
  weight: number;
}

// Strong buying-intent signals (weight 3)
const STRONG_INTEREST: string[] = [
  "interested",
  "quotation",
  "quote",
  "pricing",
  "price",
  "cost",
  "proposal",
  "demo",
  "trial",
  "book a call",
  "schedule a call",
  "set up a meeting",
  "setup a meeting",
  "send me details",
  "more information",
  "more info",
  "how much",
  "get started",
  "sign up",
  "purchase",
  "buy",
  "order",
  "invoice",
  "contract",
  "onboard",
  "next steps",
  "sample",
  "catalog",
  "catalogue",
  "availability",
  "discount",
  "budget",
];

// Softer interest / engagement signals (weight 1)
const SOFT_INTEREST: string[] = [
  "let me know",
  "follow up",
  "follow-up",
  "call me",
  "reach out",
  "question",
  "clarify",
  "tell me more",
  "looking for",
  "need",
];

// Disinterest / opt-out signals (weight -3)
const NEGATIVE: string[] = [
  "unsubscribe",
  "remove me",
  "not interested",
  "no thanks",
  "no thank you",
  "stop emailing",
  "stop sending",
  "opt out",
  "opt-out",
  "do not contact",
  "don't contact",
  "spam",
];

const LEXICON: WeightedTerm[] = [
  ...STRONG_INTEREST.map((term) => ({ term, weight: 3 })),
  ...SOFT_INTEREST.map((term) => ({ term, weight: 1 })),
  ...NEGATIVE.map((term) => ({ term, weight: -3 })),
];

// Escape regex metacharacters so phrases like "opt-out" match literally.
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pre-compile word-boundary matchers once at module load.
const MATCHERS: { re: RegExp; term: string; weight: number }[] = LEXICON.map(
  ({ term, weight }) => ({
    re: new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"),
    term,
    weight,
  })
);

/**
 * Score an email's subject + body for lead intent.
 * Each distinct matched term contributes its weight once.
 */
export function scoreLead(subject: string, body: string): LeadScore {
  const haystack = `${subject || ""}\n${body || ""}`.toLowerCase();

  let score = 0;
  const hits: string[] = [];

  for (const { re, term, weight } of MATCHERS) {
    if (re.test(haystack)) {
      score += weight;
      hits.push(term);
    }
  }

  let hint: LeadHint = "unclear";
  if (score >= STRONG_THRESHOLD) hint = "likely_interested";
  else if (score <= NEGATIVE_THRESHOLD) hint = "likely_negative";

  return { score, hits, hint };
}
