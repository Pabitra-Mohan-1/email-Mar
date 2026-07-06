import { Router, type IRouter } from "express";
import { Contact } from "../models/Contact";
import { Campaign } from "../models/Campaign";
import { EmailLog } from "../models/EmailLog";
import { SmtpAccount } from "../models/SmtpAccount";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalContacts,
    totalCampaigns,
    emailsSentToday,
    totalEmailsSent,
    pendingQueue,
    failedEmails,
    smtpAccounts,
  ] = await Promise.all([
    Contact.countDocuments(),
    Campaign.countDocuments(),
    EmailLog.countDocuments({ status: "sent", createdAt: { $gte: today } }),
    EmailLog.countDocuments({ status: "sent" }),
    EmailLog.countDocuments({ status: "pending" }),
    EmailLog.countDocuments({ status: "failed" }),
    SmtpAccount.countDocuments(),
  ]);

  const totalFinished = totalEmailsSent + failedEmails;
  const successRate = totalFinished === 0 ? 0 : (totalEmailsSent / totalFinished) * 100;

  res.json({
    totalContacts,
    totalCampaigns,
    emailsSentToday,
    totalEmailsSent,
    pendingQueue,
    failedEmails,
    smtpAccounts,
    successRate: Math.round(successRate * 10) / 10,
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const logs = await EmailLog.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("campaignId", "name");

  const items = logs.map((log) => ({
    id: log._id.toString(),
    type: log.status,
    message:
      log.status === "sent"
        ? `Email sent to ${log.recipient}`
        : log.status === "failed"
          ? `Failed to send to ${log.recipient}`
          : `Pending email to ${log.recipient}`,
    campaignName: log.campaignName ?? null,
    createdAt: log.createdAt.toISOString(),
  }));

  res.json(items);
});

export default router;
