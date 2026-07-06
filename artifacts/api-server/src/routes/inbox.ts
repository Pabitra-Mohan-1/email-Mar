import { Router, type IRouter } from "express";
import { SmtpAccount } from "../models/SmtpAccount";
import { IncomingEmail } from "../models/IncomingEmail";
import { syncImapEmails } from "../lib/imapService";
import { sendEmail } from "../lib/mailer";

const router: IRouter = Router();

// Helper to derive IMAP host from SMTP host
function deriveImapHost(smtpHost: string): string {
  // e.g. "smtp.ionetweb.com:465" -> strip port first
  const cleanHost = smtpHost.split(":")[0];
  if (cleanHost.toLowerCase().startsWith("smtp.")) {
    return "imap." + cleanHost.substring(5);
  }
  return cleanHost;
}

// 1. Sync Inbox emails from IMAP
router.get("/inbox/sync", async (req, res): Promise<void> => {
  try {
    const accounts = await SmtpAccount.find({
      isEnabled: true,
      $or: [{ isImapEnabled: true }, { isImapEnabled: { $exists: false } }, { isImapEnabled: null }]
    });
    
    if (accounts.length === 0) {
      res.json({ message: "No active IMAP accounts configured", syncedCount: 0 });
      return;
    }

    let totalSynced = 0;
    const results = [];

    for (const account of accounts) {
      const imapHost = account.imapHost || deriveImapHost(account.host);
      const isSecure = account.imapEncryption === "ssl" || account.imapEncryption === "tls" || account.imapPort === 993;

      try {
        const { syncedCount } = await syncImapEmails({
          host: imapHost,
          port: account.imapPort || 993,
          username: account.username,
          password: account.password,
          secure: isSecure,
          accountId: account._id.toString(),
        });
        
        totalSynced += syncedCount;
        results.push({
          accountId: account._id,
          email: account.username,
          status: "success",
          syncedCount,
        });
      } catch (err: any) {
        console.error(`Error syncing emails for ${account.username}:`, err);
        results.push({
          accountId: account._id,
          email: account.username,
          status: "failed",
          error: err.message || "Unknown error",
        });
      }
    }

    res.json({
      message: `Sync completed. Fetched ${totalSynced} new emails.`,
      syncedCount: totalSynced,
      details: results,
    });
  } catch (error: any) {
    console.error("Inbox sync failed:", error);
    res.status(500).json({ error: error.message || "Failed to sync inbox" });
  }
});

// Helper to convert to Mongoose ObjectId safely
import { mongoose } from "../lib/mongodb";

// 2. Fetch grouped list of senders
router.get("/inbox/senders", async (req, res): Promise<void> => {
  try {
    const { accountId, category } = req.query;
    const matchStage: any = {};
    
    if (accountId) {
      matchStage.accountId = new mongoose.Types.ObjectId(String(accountId));
    }

    if (category) {
      if (category === "reply") {
        matchStage.$or = [{ category: "reply" }, { category: { $exists: false } }, { category: null }];
      } else {
        matchStage.category = category;
      }
    }

    // We group by fromAddress, finding the latest message details,
    // total message count, and total unread message count.
    const pipeline: any[] = [];
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }
    
    pipeline.push(
      {
        $sort: { date: -1 } // Sort by date descending
      },
      {
        $group: {
          _id: "$fromAddress",
          fromName: { $first: "$fromName" },
          fromAddress: { $first: "$fromAddress" },
          latestSubject: { $first: "$subject" },
          latestText: { $first: "$text" },
          latestDate: { $first: "$date" },
          totalCount: { $sum: 1 },
          unreadCount: {
            $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] }
          }
        }
      },
      {
        $sort: { latestDate: -1 } // Sort groups by latest email date
      }
    );

    const senders = await IncomingEmail.aggregate(pipeline);
    res.json(senders);
  } catch (error: any) {
    console.error("Failed to fetch senders:", error);
    res.status(500).json({ error: error.message || "Failed to fetch senders" });
  }
});

// 3. Fetch all messages from a specific sender
router.get("/inbox/messages", async (req, res): Promise<void> => {
  try {
    const { email, accountId, category } = req.query;
    if (!email) {
      res.status(400).json({ error: "Email query parameter is required" });
      return;
    }

    const query: any = { fromAddress: String(email).toLowerCase() };
    if (accountId) {
      query.accountId = accountId;
    }
    if (category) {
      if (category === "reply") {
        query.$or = [{ category: "reply" }, { category: { $exists: false } }, { category: null }];
      } else {
        query.category = category;
      }
    }

    const messages = await IncomingEmail.find(query).sort({ date: -1 });
    res.json(messages);
  } catch (error: any) {
    console.error("Failed to fetch messages:", error);
    res.status(500).json({ error: error.message || "Failed to fetch messages" });
  }
});

// 4. Mark specific email as read
router.patch("/inbox/messages/:id/read", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    const updated = await IncomingEmail.findByIdAndUpdate(
      id,
      { isRead: isRead ?? true },
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ error: "Email not found" });
      return;
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Failed to mark email as read:", error);
    res.status(500).json({ error: error.message || "Failed to update email status" });
  }
});

// 6. Mark all emails as read
router.post("/inbox/read-all", async (req, res): Promise<void> => {
  try {
    const { accountId } = req.body;
    const query: any = {};
    if (accountId) {
      query.accountId = accountId;
    }
    
    await IncomingEmail.updateMany(query, { isRead: true });
    res.json({ success: true, message: "All emails marked as read" });
  } catch (error: any) {
    console.error("Failed to mark all as read:", error);
    res.status(500).json({ error: error.message || "Failed to update emails" });
  }
});

// 5. Reply to an email
router.post("/inbox/reply", async (req, res): Promise<void> => {
  try {
    const { accountId, to, subject, body } = req.body;
    if (!accountId || !to || !subject || !body) {
      res.status(400).json({ error: "Missing required fields (accountId, to, subject, body)" });
      return;
    }

    const account = await SmtpAccount.findById(accountId);
    if (!account) {
      res.status(404).json({ error: "Smtp account not found" });
      return;
    }

    const result = await sendEmail(
      {
        id: account._id.toString(),
        host: account.host,
        port: account.port,
        username: account.username,
        password: account.password,
        encryption: (account.encryption ?? "tls") as any,
      },
      {
        from: `"${account.name}" <${account.username}>`,
        to,
        subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
        html: body.replace(/\n/g, "<br>"), // Simple text-to-HTML conversion
      }
    );

    if (!result.success) {
      res.status(500).json({ error: result.error || "Failed to send email" });
      return;
    }

    res.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error("Failed to send reply:", error);
    res.status(500).json({ error: error.message || "Failed to send reply" });
  }
});

export default router;
