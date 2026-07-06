import { Router, type IRouter } from "express";
import { Campaign } from "../models/Campaign";
import { SmtpAccount } from "../models/SmtpAccount";
import { EmailLog } from "../models/EmailLog";

const router: IRouter = Router();

// Campaign performance reports
router.get("/reports/campaigns", async (_req, res): Promise<void> => {
  const campaigns = await Campaign.find().sort({ createdAt: -1 }).lean();

  const reports = campaigns.map((c) => {
    const total = (c.sentCount ?? 0) + (c.failedCount ?? 0);
    const successRate = total === 0 ? 0 : Math.round(((c.sentCount ?? 0) / total) * 1000) / 10;
    return {
      campaignId: String(c._id),
      campaignName: c.name,
      totalRecipients: c.totalRecipients ?? 0,
      sentCount: c.sentCount ?? 0,
      failedCount: c.failedCount ?? 0,
      successRate,
      status: c.status,
    };
  });

  res.json(reports);
});

// SMTP performance reports
router.get("/reports/smtp", async (_req, res): Promise<void> => {
  const accounts = await SmtpAccount.find().lean();

  const reports = await Promise.all(
    accounts.map(async (s) => {
      const [totalSent, totalFailed] = await Promise.all([
        EmailLog.countDocuments({ smtpAccountId: s._id, status: "sent" }),
        EmailLog.countDocuments({ smtpAccountId: s._id, status: "failed" }),
      ]);
      const total = totalSent + totalFailed;
      const successRate = total === 0 ? 0 : Math.round((totalSent / total) * 1000) / 10;
      return {
        smtpId: String(s._id),
        smtpName: s.name,
        totalSent,
        totalFailed,
        successRate,
        health: s.health,
      };
    }),
  );

  res.json(reports);
});

// Daily email volume (last 30 days)
router.get("/reports/daily", async (_req, res): Promise<void> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const agg = await EmailLog.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        sent: {
          $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] },
        },
        failed: {
          $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill in missing days with zeros
  const result: Array<{ date: string; sent: number; failed: number }> = [];
  const aggMap = new Map(agg.map((a: { _id: string; sent: number; failed: number }) => [a._id, a]));

  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const entry = aggMap.get(key) as { _id: string; sent: number; failed: number } | undefined;
    result.push({ date: key, sent: entry?.sent ?? 0, failed: entry?.failed ?? 0 });
  }

  res.json(result);
});

export default router;
