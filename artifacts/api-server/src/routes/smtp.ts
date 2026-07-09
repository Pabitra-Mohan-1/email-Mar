import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";
import { SmtpAccount } from "../models/SmtpAccount";
import { CreateSmtpAccountBody, UpdateSmtpAccountBody, ToggleSmtpAccountBody } from "@workspace/api-zod";
import { createTransport } from "../lib/mailer";

const router: IRouter = Router();

function serializeSmtp(s: Record<string, unknown>) {
  return {
    id: String(s._id),
    name: s.name,
    host: s.host,
    port: s.port,
    username: s.username,
    password: s.password,
    encryption: s.encryption ?? "tls",
    isEnabled: s.isEnabled ?? true,
    priority: s.priority ?? 1,
    hourlyLimit: s.hourlyLimit ?? null,
    dailyLimit: s.dailyLimit ?? null,
    sentToday: s.sentToday ?? 0,
    health: s.health ?? "unknown",
    isImapEnabled: s.isImapEnabled ?? true,
    imapHost: s.imapHost ?? null,
    imapPort: s.imapPort ?? 993,
    imapEncryption: s.imapEncryption ?? "tls",
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
  };
}

// List SMTP accounts
router.get("/smtp", async (_req, res): Promise<void> => {
  const accounts = await SmtpAccount.find().sort({ priority: 1 }).lean();
  res.json(accounts.map(serializeSmtp));
});

// Create SMTP account
router.post("/smtp", async (req, res): Promise<void> => {
  const parsed = CreateSmtpAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const account = await SmtpAccount.create(parsed.data);
  res.status(201).json(serializeSmtp(account.toObject()));
});

// Update SMTP account
router.patch("/smtp/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateSmtpAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const account = await SmtpAccount.findByIdAndUpdate(raw, parsed.data, { new: true }).lean();
  if (!account) {
    res.status(404).json({ error: "SMTP account not found" });
    return;
  }
  res.json(serializeSmtp(account));
});

// Delete SMTP account
router.delete("/smtp/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const account = await SmtpAccount.findByIdAndDelete(raw);
  if (!account) {
    res.status(404).json({ error: "SMTP account not found" });
    return;
  }
  res.sendStatus(204);
});

// Test SMTP connection
router.post("/smtp/:id/test", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const account = await SmtpAccount.findById(raw).lean();
  if (!account) {
    res.status(404).json({ error: "SMTP account not found" });
    return;
  }

  try {
    const transporter = createTransport({
      id: String(account._id),
      host: account.host as string,
      port: account.port as number,
      username: account.username as string,
      password: account.password as string,
      encryption: (account.encryption ?? "tls") as any,
    });

    await transporter.verify();

    // Mark as healthy
    await SmtpAccount.findByIdAndUpdate(raw, { health: "healthy" });

    res.json({ success: true, message: "SMTP connection successful" });
  } catch (err) {
    // Mark as unhealthy
    await SmtpAccount.findByIdAndUpdate(raw, { health: "unhealthy" });
    const message = err instanceof Error ? err.message : "Connection failed";
    res.json({ success: false, message });
  }
});

// Toggle SMTP account
router.patch("/smtp/:id/toggle", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = ToggleSmtpAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const account = await SmtpAccount.findByIdAndUpdate(
    raw,
    { isEnabled: parsed.data.isEnabled },
    { new: true },
  ).lean();
  if (!account) {
    res.status(404).json({ error: "SMTP account not found" });
    return;
  }
  res.json(serializeSmtp(account));
});

export default router;
