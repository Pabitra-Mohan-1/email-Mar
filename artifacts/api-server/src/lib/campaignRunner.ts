import { logger } from "./logger";
import { sendEmail } from "./mailer";
import { Campaign } from "../models/Campaign";
import { Contact } from "../models/Contact";
import { EmailLog } from "../models/EmailLog";
import { SmtpAccount } from "../models/SmtpAccount";
import { EmailTemplate } from "../models/EmailTemplate";

const TICK_INTERVAL_MS = 15_000; // run every 15s so batches flow responsively
const DEFAULT_HOURLY_LIMIT = 5000;

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await processRunningCampaigns();
    await processScheduledCampaigns();
  } catch (err) {
    logger.error({ err }, "Campaign runner tick error");
  } finally {
    running = false;
  }
}

/**
 * Kick off a processing pass immediately (e.g. right after a campaign is started
 * manually) so the first batch goes out without waiting for the next tick.
 * Runs in the background; safe to call repeatedly (the `running` guard prevents
 * overlap with the interval tick).
 */
export function triggerCampaignProcessing(): void {
  void tick();
}

async function processScheduledCampaigns() {
  const now = new Date();
  const due = await Campaign.find({
    status: "scheduled",
    scheduledAt: { $lte: now },
  }).lean();

  for (const c of due) {
    await Campaign.findByIdAndUpdate(c._id, { status: "running" });
    logger.info({ campaignId: c._id }, "Campaign promoted to running");
  }
}

async function processRunningCampaigns() {
  const campaigns = await Campaign.find({ status: "running" }).lean();

  for (const campaign of campaigns) {
    try {
      await processCampaign(campaign);
    } catch (err) {
      logger.error({ err, campaignId: campaign._id }, "Error processing campaign");
    }
  }
}

async function processCampaign(campaign: Record<string, unknown>) {
  const campaignId = campaign._id as string;
  
  // 1. Check if interval duration has elapsed since last run
  const lastProcessed = campaign.lastProcessedAt ? new Date(campaign.lastProcessedAt as string) : null;
  const intervalMinutes = (campaign.intervalMinutes as number) ?? 1;

  if (lastProcessed) {
    const elapsedMinutes = (Date.now() - lastProcessed.getTime()) / (60 * 1000);
    // If not enough minutes have passed, skip this tick
    if (elapsedMinutes < intervalMinutes) {
      return;
    }
  }

  const hourlyLimit = (campaign.hourlyLimit as number | null) ?? DEFAULT_HOURLY_LIMIT;

  // Count emails sent for this campaign in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentLastHour = await EmailLog.countDocuments({
    campaignId,
    createdAt: { $gte: oneHourAgo },
    status: { $in: ["sent", "failed"] },
  });

  const remaining = hourlyLimit - sentLastHour;
  if (remaining <= 0) {
    logger.info({ campaignId, sentLastHour, hourlyLimit }, "Hourly limit reached, skipping");
    return;
  }

  // 2. Limit the query to the smaller of hourly remaining space or mailsPerBatch configuration
  const mailsPerBatch = (campaign.mailsPerBatch as number) ?? 500;
  const limitCount = Math.min(mailsPerBatch, remaining);

  // Get contacts already emailed for this campaign (any status)
  const emailedRecipients = await EmailLog.distinct("recipient", { campaignId });

  // Get contacts from group. A campaign MUST target a group — without one we
  // would email every active contact, which is almost never intended. Guard
  // against that (e.g. legacy campaigns or direct API calls) by pausing instead.
  const groupId = campaign.groupId;
  if (!groupId) {
    await Campaign.findByIdAndUpdate(campaignId, { status: "paused" });
    logger.warn({ campaignId }, "Campaign has no target group — pausing to avoid sending to all contacts");
    return;
  }
  const filter: Record<string, unknown> = { isActive: true, groupIds: groupId };

  const contacts = await Contact.find({
    ...filter,
    email: { $nin: emailedRecipients },
  })
    .limit(limitCount)
    .lean();

  if (contacts.length === 0) {
    // All contacts have been emailed — mark complete
    await Campaign.findByIdAndUpdate(campaignId, { 
      status: "completed",
      lastProcessedAt: new Date()
    });
    logger.info({ campaignId }, "Campaign completed");
    return;
  }

  // Load SMTP account
  const smtpDoc = campaign.smtpAccountId
    ? await SmtpAccount.findById(campaign.smtpAccountId).lean()
    : await SmtpAccount.findOne({ isEnabled: true }).sort({ priority: 1 }).lean();

  if (!smtpDoc) {
    logger.warn({ campaignId }, "No enabled SMTP account found for campaign");
    return;
  }

  // Load template HTML
  let html = "<p>{{name}},</p><p>This is an automated email.</p>";
  if (campaign.customHtml) {
    html = campaign.customHtml as string;
  } else if (campaign.templateId) {
    const tpl = await EmailTemplate.findById(campaign.templateId).lean() as Record<string, unknown> | null;
    if (tpl && tpl.htmlContent) html = tpl.htmlContent as string;
  }

  const smtpCfg = {
    id: String(smtpDoc._id),
    host: smtpDoc.host as string,
    port: smtpDoc.port as number,
    username: smtpDoc.username as string,
    password: smtpDoc.password as string,
    encryption: smtpDoc.encryption as "none" | "ssl" | "tls",
  };

  const from = `${campaign.senderName} <${campaign.senderEmail}>`;
  let totalSentInBatch = 0;
  let totalFailedInBatch = 0;

  const CONCURRENCY_LIMIT = 10;
  for (let i = 0; i < contacts.length; i += CONCURRENCY_LIMIT) {
    const chunk = contacts.slice(i, i + CONCURRENCY_LIMIT);
    let chunkSentCount = 0;
    let chunkFailedCount = 0;

    const results = await Promise.all(
      chunk.map(async (contact) => {
        try {
          const contactRecord = contact as Record<string, unknown>;
          const name = (contactRecord.name as string | null) ?? (contactRecord.email as string);
          const companyStr = (contactRecord.company as string) ?? "";
          
          const personalizedSubject = (campaign.subject as string)
            .replace(/\{\{name\}\}/gi, name)
            .replace(/\{\{email\}\}/gi, contactRecord.email as string)
            .replace(/\{\{company\}\}/gi, companyStr);

          const personalizedHtml = html
            .replace(/\{\{name\}\}/gi, name)
            .replace(/\{\{email\}\}/gi, contactRecord.email as string)
            .replace(/\{\{company\}\}/gi, companyStr);

          const result = await sendEmail(smtpCfg, {
            to: contactRecord.email as string,
            subject: personalizedSubject,
            html: personalizedHtml,
            from,
          });

          await EmailLog.create({
            recipient: contactRecord.email,
            campaignId,
            campaignName: campaign.name,
            smtpAccountId: smtpDoc._id,
            status: result.success ? "sent" : "failed",
            smtpResponse: result.messageId ?? null,
            error: result.error ?? null,
          });

          return result.success;
        } catch (innerErr) {
          logger.error({ innerErr, recipient: (contact as any).email }, "Failed to process recipient in batch");
          return false;
        }
      })
    );

    for (const success of results) {
      if (success) {
        chunkSentCount++;
        totalSentInBatch++;
      } else {
        chunkFailedCount++;
        totalFailedInBatch++;
      }
    }

    // Update progress incrementally in database after each chunk so the UI updates live
    if (chunkSentCount > 0 || chunkFailedCount > 0) {
      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { 
          sentCount: chunkSentCount, 
          failedCount: chunkFailedCount 
        },
        $set: { lastProcessedAt: new Date() },
      });
    }
  }

  logger.info({ campaignId, sentCount: totalSentInBatch, failedCount: totalFailedInBatch }, "Campaign batch sent");

  // If every contact in the group has now been emailed, mark the campaign
  // completed in this same pass. Otherwise it would stay "running" until a later
  // tick — which the interval gate can delay by up to intervalMinutes.
  const justEmailed = contacts.map((c) => (c as Record<string, unknown>).email);
  const remainingContacts = await Contact.countDocuments({
    ...filter,
    email: { $nin: [...emailedRecipients, ...justEmailed] },
  });

  if (remainingContacts === 0) {
    await Campaign.findByIdAndUpdate(campaignId, { status: "completed" });
    logger.info({ campaignId }, "Campaign completed");
  }
}

export function startCampaignRunner() {
  logger.info("Campaign runner started");
  setInterval(tick, TICK_INTERVAL_MS);
  // Also fire immediately
  tick();
}
