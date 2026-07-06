import { logger } from "./logger";
import { sendEmail } from "./mailer";
import { Campaign } from "../models/Campaign";
import { Contact } from "../models/Contact";
import { EmailLog } from "../models/EmailLog";
import { SmtpAccount } from "../models/SmtpAccount";
import { EmailTemplate } from "../models/EmailTemplate";

const TICK_INTERVAL_MS = 60_000; // run every minute
const DEFAULT_HOURLY_LIMIT = 200;

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
  const mailsPerBatch = (campaign.mailsPerBatch as number) ?? 10;
  const limitCount = Math.min(mailsPerBatch, remaining);

  // Get contacts already emailed for this campaign (any status)
  const emailedRecipients = await EmailLog.distinct("recipient", { campaignId });

  // Get contacts from group
  const groupId = campaign.groupId;
  const filter: Record<string, unknown> = { isActive: true };
  if (groupId) {
    filter["groupIds"] = groupId;
  }

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
  let sentCount = 0;
  let failedCount = 0;

  const CONCURRENCY_LIMIT = 10;
  for (let i = 0; i < contacts.length; i += CONCURRENCY_LIMIT) {
    const chunk = contacts.slice(i, i + CONCURRENCY_LIMIT);
    const results = await Promise.all(
      chunk.map(async (contact) => {
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
      })
    );

    for (const success of results) {
      if (success) sentCount++;
      else failedCount++;
    }
  }

  await Campaign.findByIdAndUpdate(campaignId, {
    $inc: { sentCount, failedCount },
    $set: { lastProcessedAt: new Date() },
  });

  logger.info({ campaignId, sentCount, failedCount }, "Campaign batch sent");
}

export function startCampaignRunner() {
  logger.info("Campaign runner started");
  setInterval(tick, TICK_INTERVAL_MS);
  // Also fire immediately
  tick();
}
