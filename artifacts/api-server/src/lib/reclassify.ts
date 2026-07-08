import { IncomingEmail } from "../models/IncomingEmail";
import { runAiClassification, summarizeThread, basicSummary, type ThreadMessage } from "./aiService";
import { scoreLead, NEGATIVE_THRESHOLD } from "./leadKeywords";
import { classifyEmail } from "./imapService";

interface ReclassifyResult {
  processed: number;
  interested: number;
  summarized: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Re-run keyword + AI classification and conversation summaries on already-stored
 * reply emails. This is used to backfill mail that was synced before an AI
 * provider was configured/active (or before the classification pipeline existed),
 * and to let the user re-trigger AI analysis on demand.
 *
 * @param onlyUnprocessed  When true (default), only touch replies that have not
 *                         yet been classified (leadStatus unclassified/empty).
 *                         When false, reclassify every reply.
 */
export async function reclassifyStoredEmails(
  onlyUnprocessed = true
): Promise<ReclassifyResult> {
  // Legacy records may have category null (ingested before the field existed) —
  // treat those as replies too so they get classified.
  const query: Record<string, unknown> = {
    $or: [{ category: "reply" }, { category: { $exists: false } }, { category: null }],
  };

  if (onlyUnprocessed) {
    query.$and = [
      {
        $or: [
          { leadStatus: "unclassified" },
          { leadStatus: { $exists: false } },
          { leadStatus: null },
        ],
      },
    ];
  }

  const emails = await IncomingEmail.find(query).sort({ date: 1 });

  let interested = 0;
  const sendersToSummarize = new Map<string, string>(); // fromAddress -> accountId

  for (const email of emails) {
    try {
      const subject = email.subject || "";
      const body = email.text || "";

      // Re-derive the category (sender/subject/body) so system-generated mail —
      // bounces, delivery reports, auto-replies — is corrected and excluded from
      // the lead pipeline, even if it was previously mis-tagged as a reply.
      const category = classifyEmail(email.fromAddress || "", subject, body);
      if (category !== "reply") {
        email.category = category;
        email.leadStatus = "unclassified";
        email.aiReason = "";
        email.aiDraft = "";
        email.aiSummary = "";
        await email.save();
        continue;
      }
      email.category = "reply";

      const scored = scoreLead(subject, body);
      email.keywordScore = scored.score;

      if (scored.score <= NEGATIVE_THRESHOLD) {
        email.leadStatus = "not_interested";
        email.aiReason = `Keyword classifier: matched ${scored.hits.join(", ")}`;
        email.aiDraft = "Thank you for letting us know. We've noted your response and won't reach out further.";
        email.aiSummary = basicSummary(subject, body);
      } else {
        const aiRes = await runAiClassification(subject, body, scored.hint);
        email.leadStatus = aiRes.leadStatus;
        email.aiReason = aiRes.aiReason;
        email.aiDraft = aiRes.aiDraft;
        email.aiSummary = aiRes.aiSummary;
      }

      if (email.leadStatus === "interested") interested++;
      await email.save();

      if (email.fromAddress && email.accountId) {
        sendersToSummarize.set(email.fromAddress, email.accountId.toString());
      }

      // Pace calls to stay under free-tier rate limits (only after an LLM call).
      if (scored.score > NEGATIVE_THRESHOLD) await sleep(1500);
    } catch (err) {
      console.error(`Reclassify failed for email ${email._id}:`, err);
    }
  }

  // Regenerate conversation summaries per sender from the full thread.
  let summarized = 0;
  for (const [fromAddress, accountId] of sendersToSummarize) {
    try {
      const thread = await IncomingEmail.find({ accountId, fromAddress }).sort({ date: 1 });
      if (thread.length === 0) continue;

      const messages: ThreadMessage[] = thread.map((m: any) => ({
        fromMe: false,
        subject: m.subject || "",
        text: m.text || "",
        date: m.date,
      }));

      const summary = await summarizeThread(messages);
      if (!summary) continue;

      const latest = thread[thread.length - 1];
      latest.aiSummary = summary;
      await latest.save();
      summarized++;
      await sleep(1500);
    } catch (err) {
      console.error(`Reclassify thread summary failed for ${fromAddress}:`, err);
    }
  }

  return { processed: emails.length, interested, summarized };
}
