import { Router, type IRouter } from "express";
import { Campaign } from "../models/Campaign";
import { Contact } from "../models/Contact";
import {
  CreateCampaignBody,
  UpdateCampaignBody,
  UpdateCampaignStatusBody,
  ListCampaignsQueryParams,
} from "@workspace/api-zod";
import { triggerCampaignProcessing } from "../lib/campaignRunner";

const router: IRouter = Router();

function serializeCampaign(c: Record<string, unknown>) {
  return {
    id: String(c._id),
    name: c.name,
    subject: c.subject,
    senderName: c.senderName,
    senderEmail: c.senderEmail,
    smtpAccountId: c.smtpAccountId ? String(c.smtpAccountId) : null,
    templateId: c.templateId ? String(c.templateId) : null,
    groupId: c.groupId ? String(c.groupId) : null,
    status: c.status ?? "draft",
    scheduledAt: c.scheduledAt
      ? c.scheduledAt instanceof Date
        ? c.scheduledAt.toISOString()
        : String(c.scheduledAt)
      : null,
    hourlyLimit: c.hourlyLimit ?? null,
    dailyLimit: c.dailyLimit ?? null,
    totalRecipients: c.totalRecipients ?? 0,
    sentCount: c.sentCount ?? 0,
    failedCount: c.failedCount ?? 0,
    mailsPerBatch: typeof c.mailsPerBatch === "number" ? c.mailsPerBatch : 10,
    intervalMinutes: typeof c.intervalMinutes === "number" ? c.intervalMinutes : 1,
    customHtml: typeof c.customHtml === "string" ? c.customHtml : null,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
  };
}

// List campaigns
router.get("/campaigns", async (req, res): Promise<void> => {
  const parsed = ListCampaignsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filter: Record<string, unknown> = {};
  if (parsed.data.status) {
    filter["status"] = parsed.data.status;
  }
  const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).lean();
  res.json(campaigns.map(serializeCampaign));
});

// Create campaign
router.post("/campaigns", async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Count recipients from the group
  let totalRecipients = 0;
  if (parsed.data.groupId) {
    totalRecipients = await Contact.countDocuments({ groupIds: parsed.data.groupId, isActive: true });
  }

  const campaign = await Campaign.create({ ...parsed.data, totalRecipients });
  res.status(201).json(serializeCampaign(campaign.toObject()));
});

// Get campaign
router.get("/campaigns/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const campaign = await Campaign.findById(raw).lean();
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(serializeCampaign(campaign));
});

// Update campaign
router.patch("/campaigns/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const campaign = await Campaign.findByIdAndUpdate(raw, parsed.data, { new: true }).lean();
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(serializeCampaign(campaign));
});

// Delete campaign
router.delete("/campaigns/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const campaign = await Campaign.findByIdAndDelete(raw);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.sendStatus(204);
});

// Update campaign status
router.patch("/campaigns/:id/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateCampaignStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const update: Record<string, unknown> = { status: parsed.data.status };
  // When (re)starting a campaign, clear the pacing checkpoint so the first batch
  // goes out immediately instead of waiting out the previous interval window.
  if (parsed.data.status === "running") {
    update.lastProcessedAt = null;
  }

  const campaign = await Campaign.findByIdAndUpdate(
    raw,
    update,
    { new: true },
  ).lean();
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  // Kick off processing right away so a manually-started campaign begins sending
  // without waiting for the next runner tick.
  if (parsed.data.status === "running") {
    triggerCampaignProcessing();
  }

  res.json(serializeCampaign(campaign));
});

export default router;
