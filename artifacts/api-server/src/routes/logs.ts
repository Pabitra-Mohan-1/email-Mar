import { Router, type IRouter } from "express";
import { EmailLog } from "../models/EmailLog";
import { ListEmailLogsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/logs", async (req, res): Promise<void> => {
  const parsed = ListEmailLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { campaignId, status, page = 1, limit = 50 } = parsed.data;

  const filter: Record<string, unknown> = {};
  if (campaignId) filter["campaignId"] = campaignId;
  if (status) filter["status"] = status;

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    EmailLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    EmailLog.countDocuments(filter),
  ]);

  res.json({
    logs: logs.map((l) => ({
      id: String(l._id),
      recipient: l.recipient,
      campaignId: String(l.campaignId),
      campaignName: l.campaignName ?? null,
      smtpAccountId: l.smtpAccountId ? String(l.smtpAccountId) : null,
      status: l.status,
      retryCount: l.retryCount ?? 0,
      smtpResponse: l.smtpResponse ?? null,
      error: l.error ?? null,
      createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
    })),
    total,
    page,
    limit,
  });
});

router.delete("/logs", async (req, res): Promise<void> => {
  await EmailLog.deleteMany({});
  res.status(204).end();
});

router.delete("/logs/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const log = await EmailLog.findByIdAndDelete(id);
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  res.status(204).end();
});

export default router;
