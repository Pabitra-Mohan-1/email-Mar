import { Router, type IRouter } from "express";
import { AiConfig } from "../models/AiConfig";
import { IncomingEmail } from "../models/IncomingEmail";
import { testAiConnection } from "../lib/aiService";
import { reclassifyStoredEmails } from "../lib/reclassify";

const router: IRouter = Router();

// 1. Get all AI configurations (with masked keys)
router.get("/ai/config", async (req, res): Promise<void> => {
  try {
    const configs = await AiConfig.find().lean();
    
    // Mask keys for security
    const masked = configs.map((c) => ({
      provider: c.provider,
      apiKey: c.apiKey ? `${c.apiKey.slice(0, 6)}...${c.apiKey.slice(-4)}` : "",
      model: c.model || "",
      isActive: c.isActive,
    }));

    res.json(masked);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch AI configs" });
  }
});

// 2. Save/Update API Key
router.post("/ai/config", async (req, res): Promise<void> => {
  try {
    const { provider, apiKey, model } = req.body;
    if (!provider) {
      res.status(400).json({ error: "Provider is required" });
      return;
    }

    const existing = await AiConfig.findOne({ provider });

    // apiKey is required only when no key has been saved yet — this lets users
    // update just the model on an already-configured provider.
    if (!apiKey && !existing?.apiKey) {
      res.status(400).json({ error: "apiKey is required" });
      return;
    }

    const update: Record<string, unknown> = {};
    if (apiKey) update.apiKey = apiKey;
    if (typeof model === "string") update.model = model.trim();

    const updated = await AiConfig.findOneAndUpdate(
      { provider },
      update,
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      provider: updated.provider,
      model: updated.model || "",
      isActive: updated.isActive,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save AI config" });
  }
});

// 3. Set Active Provider
router.post("/ai/config/activate", async (req, res): Promise<void> => {
  try {
    const { provider } = req.body;
    if (!provider) {
      res.status(400).json({ error: "Provider is required" });
      return;
    }

    // Verify key exists first
    const config = await AiConfig.findOne({ provider });
    if (!config) {
      res.status(404).json({ error: `Please configure an API key for ${provider} first.` });
      return;
    }

    // Deactivate all
    await AiConfig.updateMany({}, { isActive: false });
    
    // Activate selected
    config.isActive = true;
    await config.save();

    res.json({ success: true, activeProvider: provider });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to activate AI provider" });
  }
});

// 4. Test connection
router.post("/ai/config/test", async (req, res): Promise<void> => {
  try {
    const { provider, apiKey } = req.body;
    if (!provider) {
      res.status(400).json({ error: "Provider is required" });
      return;
    }

    let keyToTest = apiKey;
    if (!keyToTest) {
      const saved = await AiConfig.findOne({ provider });
      if (!saved) {
        res.status(400).json({ error: "No API Key provided or saved" });
        return;
      }
      keyToTest = saved.apiKey;
    }

    const isConnected = await testAiConnection(provider, keyToTest);
    res.json({ success: isConnected });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Test connection failed" });
  }
});

// 5. Fetch all leads (where leadStatus is "interested")
router.get("/inbox/leads", async (req, res): Promise<void> => {
  try {
    const leads = await IncomingEmail.find({ leadStatus: "interested" })
      .sort({ date: -1 })
      .populate("accountId", "name username");

    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch leads" });
  }
});

// 6. Update actionStatus (Pending, Replied, Ignored, Follow-up)
router.patch("/inbox/leads/:id/status", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { actionStatus, leadStatus } = req.body;
    
    const updateData: any = {};
    if (actionStatus) updateData.actionStatus = actionStatus;
    if (leadStatus) updateData.leadStatus = leadStatus;

    const updated = await IncomingEmail.findByIdAndUpdate(id, updateData, { new: true })
      .populate("accountId", "name username");

    if (!updated) {
      res.status(404).json({ error: "Lead message not found" });
      return;
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update lead status" });
  }
});

// 7. Reclassify already-stored replies (backfill AI leads/summaries).
// Body: { all?: boolean } — when all=true, re-run on every reply, not just
// those still unclassified.
router.post("/inbox/leads/reclassify", async (req, res): Promise<void> => {
  try {
    // No active-provider guard: when AI is unconfigured/unavailable the pipeline
    // falls back to the lightweight keyword classifier, so leads still populate.
    const onlyUnprocessed = req.body?.all !== true;

    // Bulk AI classification can take a long time (many emails, slow providers),
    // so run it in the background and return immediately. Progress is persisted
    // per-email, so the Leads table fills in as it goes (refresh to see updates).
    reclassifyStoredEmails(onlyUnprocessed)
      .then((r) =>
        console.log(
          `Reclassify done: ${r.processed} processed, ${r.interested} interested, ${r.summarized} summaries.`
        )
      )
      .catch((err) => console.error("Background reclassify failed:", err));

    res.json({
      success: true,
      message: "AI classification started in the background. Refresh Leads shortly to see results.",
    });
  } catch (error: any) {
    console.error("Reclassify failed:", error);
    res.status(500).json({ error: error.message || "Failed to reclassify emails" });
  }
});

// 8. Delete a lead
router.delete("/inbox/leads/:id", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await IncomingEmail.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.sendStatus(204);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete lead" });
  }
});

export default router;
