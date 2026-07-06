import { Router, type IRouter } from "express";
import { EmailTemplate } from "../models/EmailTemplate";
import { CreateTemplateBody, UpdateTemplateBody } from "@workspace/api-zod";

const router: IRouter = Router();

function serializeTemplate(t: Record<string, unknown>) {
  return {
    id: String(t._id),
    name: t.name,
    subject: t.subject,
    htmlContent: t.htmlContent,
    textContent: t.textContent ?? null,
    previewText: t.previewText ?? null,
    status: t.status ?? "draft",
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
    updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : String(t.updatedAt),
  };
}

// List templates
router.get("/templates", async (_req, res): Promise<void> => {
  const templates = await EmailTemplate.find().sort({ createdAt: -1 }).lean();
  res.json(templates.map(serializeTemplate));
});

// Create template
router.post("/templates", async (req, res): Promise<void> => {
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const template = await EmailTemplate.create(parsed.data);
  res.status(201).json(serializeTemplate(template.toObject()));
});

// Get template
router.get("/templates/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const template = await EmailTemplate.findById(raw).lean();
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(serializeTemplate(template));
});

// Update template
router.patch("/templates/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const template = await EmailTemplate.findByIdAndUpdate(raw, parsed.data, { new: true }).lean();
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(serializeTemplate(template));
});

// Delete template
router.delete("/templates/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const template = await EmailTemplate.findByIdAndDelete(raw);
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.sendStatus(204);
});

// Duplicate template
router.post("/templates/:id/duplicate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const original = await EmailTemplate.findById(raw).lean();
  if (!original) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const copy = await EmailTemplate.create({
    name: `${original.name} (Copy)`,
    subject: original.subject,
    htmlContent: original.htmlContent,
    textContent: original.textContent,
    previewText: original.previewText,
    status: "draft",
  });
  res.status(201).json(serializeTemplate(copy.toObject()));
});

export default router;
