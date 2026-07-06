import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { IncomingEmail } from "../models/IncomingEmail";
import { runAiClassification } from "./aiService";
import { logger } from "./logger"; // Let's check if logger is in lib or models. We will write it or check first.

interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
  accountId: string;
}

function classifyEmail(sender: string, subject: string): "reply" | "bounce" | "auto-reply" {
  const email = sender.toLowerCase();
  const subj = subject.toLowerCase();

  // Bounces and delivery failures
  if (
    email.startsWith("mailer-daemon@") ||
    email.startsWith("postmaster@") ||
    subj.includes("delivery status notification") ||
    subj.includes("undelivered mail") ||
    subj.includes("returned to sender") ||
    subj.includes("delivery failed") ||
    subj.includes("failure notice") ||
    subj.includes("mail delivery failed")
  ) {
    return "bounce";
  }

  // Common auto-replies
  if (
    email.startsWith("noreply@") ||
    email.startsWith("no-reply@") ||
    subj.includes("out of office") ||
    subj.includes("auto reply") ||
    subj.includes("automatic reply")
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
      const startSeq = Math.max(1, totalMessages - 49);
      messages = client.fetch(`${startSeq}:*`, { envelope: true, source: true });
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
        const category = classifyEmail(fromAddress, subjectStr);

        let leadStatus = "unclassified";
        let aiReason = "";
        let aiDraft = "";

        if (category === "reply") {
          try {
            const aiRes = await runAiClassification(subjectStr, parsed.text || "");
            leadStatus = aiRes.leadStatus;
            aiReason = aiRes.aiReason;
            aiDraft = aiRes.aiDraft;
          } catch (aiErr) {
            console.error("AI classification failed during IMAP sync:", aiErr);
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
          actionStatus: "pending",
        });

        syncedCount++;
      } catch (err) {
        console.error(`Failed to parse email message UID ${message.uid}:`, err);
      }
    }
  } finally {
    // Release lock and close/log out
    lock.release();
    await client.logout();
  }

  return { syncedCount };
}
