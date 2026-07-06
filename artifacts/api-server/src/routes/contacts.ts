import { Router, type IRouter } from "express";
import { Contact } from "../models/Contact";
import {
  CreateContactBody,
  UpdateContactBody,
  ListContactsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// List contacts
router.get("/contacts", async (req, res): Promise<void> => {
  const parsed = ListContactsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, groupId, page = 1, limit = 50 } = parsed.data;

  const filter: Record<string, unknown> = {};
  if (search) {
    filter["$or"] = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
    ];
  }
  if (groupId) {
    filter["groupIds"] = groupId;
  }

  const skip = (page - 1) * limit;
  const [contacts, total] = await Promise.all([
    Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Contact.countDocuments(filter),
  ]);

  res.json({
    contacts: contacts.map(serializeContact),
    total,
    page,
    limit,
  });
});

// Create contact
router.post("/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const contact = await Contact.create(parsed.data);
    res.status(201).json(serializeContact(contact.toObject()));
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: "A contact with this email address already exists" });
      return;
    }
    throw error;
  }
});

// Get contact
router.get("/contacts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const contact = await Contact.findById(raw).lean();
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.json(serializeContact(contact));
});

// Update contact
router.patch("/contacts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const contact = await Contact.findByIdAndUpdate(raw, parsed.data, { new: true }).lean();
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.json(serializeContact(contact));
});

// Delete ALL contacts — must be before /:id to avoid "all" being treated as an ObjectId
router.delete("/contacts/all", async (_req, res): Promise<void> => {
  const result = await Contact.deleteMany({});
  res.json({ deleted: result.deletedCount });
});

// Delete contact
router.delete("/contacts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const contact = await Contact.findByIdAndDelete(raw);
  if (!contact) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }
  res.sendStatus(204);
});

// Bulk delete contacts
router.post("/contacts/bulk-delete", async (req, res): Promise<void> => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids array is required" });
    return;
  }
  const result = await Contact.deleteMany({ _id: { $in: ids } });
  res.json({ deleted: result.deletedCount });
});

function serializeContact(c: Record<string, unknown>) {
  return {
    id: String(c._id),
    name: c.name ?? null,
    email: c.email,
    company: c.company ?? null,
    phone: c.phone ?? null,
    website: c.website ?? null,
    city: c.city ?? null,
    country: c.country ?? null,
    notes: c.notes ?? null,
    tags: c.tags ?? [],
    groupIds: Array.isArray(c.groupIds) ? c.groupIds.map(String) : [],
    isActive: c.isActive ?? true,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
  };
}

export default router;
