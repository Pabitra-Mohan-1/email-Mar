import { Router, type IRouter } from "express";
import { ContactGroup } from "../models/ContactGroup";
import { Contact } from "../models/Contact";
import { CreateGroupBody, UpdateGroupBody } from "@workspace/api-zod";

const router: IRouter = Router();

// List groups
router.get("/groups", async (_req, res): Promise<void> => {
  const groups = await ContactGroup.find().sort({ name: 1 }).lean();

  const withCounts = await Promise.all(
    groups.map(async (g) => {
      const contactCount = await Contact.countDocuments({ groupIds: g._id });
      return {
        id: String(g._id),
        name: g.name,
        description: g.description ?? null,
        contactCount,
        createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : String(g.createdAt),
      };
    }),
  );

  res.json(withCounts);
});

// Create group
router.post("/groups", async (req, res): Promise<void> => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const group = await ContactGroup.create(parsed.data);
  res.status(201).json({
    id: String(group._id),
    name: group.name,
    description: group.description ?? null,
    contactCount: 0,
    createdAt: group.createdAt.toISOString(),
  });
});

// Update group
router.patch("/groups/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const group = await ContactGroup.findByIdAndUpdate(raw, parsed.data, { new: true }).lean();
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const contactCount = await Contact.countDocuments({ groupIds: group._id });
  res.json({
    id: String(group._id),
    name: group.name,
    description: group.description ?? null,
    contactCount,
    createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : String(group.createdAt),
  });
});

// Delete group
router.delete("/groups/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const group = await ContactGroup.findByIdAndDelete(raw);
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  // Remove this group from all contacts
  await Contact.updateMany({ groupIds: raw }, { $pull: { groupIds: raw } });
  res.sendStatus(204);
});

export default router;
