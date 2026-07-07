import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { IncomingEmail } from "../models/IncomingEmail";
import { runAiClassification, summarizeThread, basicSummary, type ThreadMessage } from "./aiService";
import { scoreLead, NEGATIVE_THRESHOLD } from "./leadKeywords";
import { logger } from "./logger"; // Let's check if logger is in lib or models. We will write it or check first.

interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
  accountId: string;
}

export function classifyEmail(
  sender: string,
  subject: string,
  body = ""
): "reply" | "bounce" | "auto-reply" {
  const email = sender.toLowerCase();
  const subj = subject.toLowerCase();
  const text = body.toLowerCase();

  // Bounces and delivery failures — detected by sender, subject, or body.
  // System-generated delivery reports must never reach the lead pipeline.
  const bounceSenders = ["mailer-daemon@", "postmaster@"];
  const bounceSubjects = [
    "delivery status notification",
    "undelivered mail",
    "undeliverable",
    "returned to sender",
    "returned mail",
    "delivery failed",
    "delivery failure",
    "failure notice",
    "mail delivery failed",
    "mail delivery failure",
    "message not delivered",
    "delivery incomplete",
  ];
  const bounceBodies = [
    "this message was created automatically by mail delivery software",
    "delivery to the following recipient failed",
    "delivery to the following recipients failed",
    "your message could not be delivered",
    "could not be delivered to",
    "was not delivered to",
    "the following address(es) failed",
    "the following recipient(s) could not be reached",
    "diagnostic-code:",
    "550 5.1.1",
    "recipient address rejected",
  ];

  if (
    bounceSenders.some((s) => email.startsWith(s)) ||
    bounceSubjects.some((s) => subj.includes(s)) ||
    bounceBodies.some((s) => text.includes(s))
  ) {
    return "bounce";
  }

  // Common auto-replies
  if (
    email.startsWith("noreply@") ||
    email.startsWith("no-reply@") ||
    subj.includes("out of office") ||
    subj.includes("auto reply") ||
    subj.includes("automatic reply") ||
    subj.includes("autoreply")
  ) {
    return "auto-reply";
  }

  return "reply";
}

export async function syncImapEmails(config: ImapConfig): Promise<{ syncedCount: number }> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false, // Turn off noisy internal imapflow logging
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });

  await client.connect();

  let syncedCount = 0;
  // Track sender addresses that received new lead-relevant mail so we can
  // regenerate their conversation summaries after ingestion.
  const sendersToSummarize = new Set<string>();
  // Acquire a lock for the INBOX folder
  const lock = await client.getMailboxLock("INBOX");
  try {
    // Find the latest UID we already stored for this account
    const latestEmail = await IncomingEmail.findOne({ accountId: config.accountId })
      .sort({ uid: -1 })
      .select("uid");

    const lastUid = latestEmail ? latestEmail.uid : 0;
    
    let messages;
    if (lastUid > 0) {
      // Fetch only messages newer than our last saved message UID (UID-based query)
      messages = client.fetch({ uid: `${lastUid + 1}:*` }, { envelope: true, source: true }, { uid: true });
    } else {
      // First sync: to avoid fetching thousands of emails, we only fetch the last 50 (sequence-based query)
      const status = await client.status("INBOX", { messages: true });
      const totalMessages = status.messages || 0;
      // An empty mailbox has no valid message set — `FETCH 1:*` would be
      // rejected by the server as an "Invalid messageset". Skip fetching.
      if (totalMessages === 0) {
        messages = [];
      } else {
        const startSeq = Math.max(1, totalMessages - 49);
        messages = client.fetch(`${startSeq}:*`, { envelope: true, source: true });
      }
    }

    for await (const message of messages) {
      // Check if we already have this UID to prevent race conditions or duplicates
      const exists = await IncomingEmail.exists({ accountId: config.accountId, uid: message.uid });
      if (exists) continue;

      try {
        if (!message.source) {
          console.warn(`Skipping message UID ${message.uid} because it has no source content.`);
          continue;
        }
        const parsed = await simpleParser(message.source);
        
        // Parse "from" header
        let fromName = "";
        let fromAddress = "";
        if (parsed.from && parsed.from.value && parsed.from.value.length > 0) {
          const fromObj = parsed.from.value[0];
          fromName = fromObj.name || "";
          fromAddress = fromObj.address || "";
        } else if (message.envelope && message.envelope.from && message.envelope.from.length > 0) {
          const envFrom = message.envelope.from[0];
          fromName = envFrom.name || "";
          fromAddress = envFrom.address || "";
        }

        // Parse "to" header
        let toAddress = "";
        if (parsed.to) {
          const toObj = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
          if (toObj && toObj.value && toObj.value.length > 0) {
            toAddress = toObj.value[0].address || "";
          }
        }
        if (!toAddress && message.envelope && message.envelope.to && message.envelope.to.length > 0) {
          const envTo = message.envelope.to[0];
          toAddress = envTo.address || "";
        }

        // Fallbacks
        if (!fromAddress) continue; // We need a sender address to group by
        if (!toAddress) toAddress = config.username;

        const subjectStr = parsed.subject || message.envelope?.subject || "";
        const category = classifyEmail(fromAddress, subjectStr, parsed.text || "");

        let leadStatus = "unclassified";
        let aiReason = "";
        let aiDraft = "";
        let aiSummary = "";
        let keywordScore = 0;

        if (category === "reply") {
          // Cheap keyword pre-classifier decides whether to spend an LLM call.
          const scored = scoreLead(subjectStr, parsed.text || "");
          keywordScore = scored.score;

          if (scored.score <= NEGATIVE_THRESHOLD) {
            // Clear opt-out / disinterest — tag directly, skip the LLM.
            leadStatus = "not_interested";
            aiReason = `Keyword classifier: matched ${scored.hits.join(", ")}`;
            aiDraft = "Thank you for letting us know. We've noted your response and won't reach out further.";
            aiSummary = basicSummary(subjectStr, parsed.text || "");
          } else {
            try {
              const aiRes = await runAiClassification(
                subjectStr,
                parsed.text || "",
                scored.hint
              );
              leadStatus = aiRes.leadStatus;
              aiReason = aiRes.aiReason;
              aiDraft = aiRes.aiDraft;
              aiSummary = aiRes.aiSummary;
            } catch (aiErr) {
              console.error("AI classification failed during IMAP sync:", aiErr);
            }
          }
        }

        await IncomingEmail.create({
          accountId: config.accountId,
          uid: message.uid,
          messageId: parsed.messageId || null,
          fromName: fromName || null,
          fromAddress: fromAddress.toLowerCase(),
          toAddress: toAddress.toLowerCase(),
          subject: subjectStr || "(No Subject)",
          text: parsed.text || "",
          html: parsed.html || parsed.textAsHtml || "",
          date: parsed.date || message.envelope?.date || new Date(),
          isRead: false,
          category,
          leadStatus,
          aiReason,
          aiDraft,
          aiSummary,
          keywordScore,
          actionStatus: "pending",
        });

        syncedCount++;

        // Queue a conversation-summary refresh for this sender (only for genuine
        // replies — bounces/auto-replies are not conversations).
        if (category === "reply") {
          sendersToSummarize.add(fromAddress.toLowerCase());
        }
      } catch (err) {
        console.error(`Failed to parse email message UID ${message.uid}:`, err);
      }
    }
  } finally {
    // Release lock and close/log out
    lock.release();
    await client.logout();
  }

  // Regenerate conversation summaries for senders with new mail, so each lead's
  // aiSummary reflects the full latest context. This is best-effort: any failure
  // here must never break the sync (the emails are already persisted).
  for (const senderAddress of sendersToSummarize) {
    try {
      const thread = await IncomingEmail.find({
        accountId: config.accountId,
        fromAddress: senderAddress,
      }).sort({ date: 1 });

      if (thread.length === 0) continue;

      const messages: ThreadMessage[] = thread.map((m: any) => ({
        // Mail addressed to our own account is inbound (from the prospect);
        // we do not persist our outbound replies, so all stored mail is "them".
        fromMe: false,
        subject: m.subject || "",
        text: m.text || "",
        date: m.date,
      }));

      const summary = await summarizeThread(messages);
      if (!summary) continue;

      // Attach the running summary to the latest message in the thread — that is
      // the document surfaced in the Leads table.
      const latest = thread[thread.length - 1];
      latest.aiSummary = summary;
      await latest.save();
    } catch (summaryErr) {
      console.error(`Thread summary failed for ${senderAddress}:`, summaryErr);
    }
  }

  return { syncedCount };
}
