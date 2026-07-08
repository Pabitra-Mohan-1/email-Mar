import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { Contact } from "../models/Contact";
import { ContactGroup } from "../models/ContactGroup";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel (.xlsx, .xls) and CSV files are allowed"));
    }
  },
});

const COL_ALIASES: Record<string, string[]> = {
  name:    ["name", "full name", "fullname", "contact name", "person", "first name", "firstname", "contact"],
  email:   ["email", "email address", "mail", "e-mail", "emailaddress"],
  company: ["company", "company name", "organization", "organisation", "firm", "business"],
  phone:   ["phone", "mobile", "mobile no", "mobile number", "phone number", "contact no", "cell", "telephone"],
};

function detectColumn(headers: string[], field: string): number {
  const aliases = COL_ALIASES[field] ?? [field];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (aliases.some((a) => h.includes(a))) return i;
  }
  return -1;
}

interface ImportJob {
  imported: number;
  skipped: number;
  errors: string[];
  total: number;
  status: "processing" | "completed" | "failed";
  error?: string;
}

const importJobs = new Map<string, ImportJob>();

router.post("/contacts/import", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const body = req.body as Record<string, string>;
  const groupId = body.groupId || null;
  const autoSplit = body.autoSplit === "true";

  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];

    if (rows.length < 2) {
      res.status(400).json({ error: "File has no data rows" });
      return;
    }

    const headers: string[] = rows[0].map((h) => String(h ?? ""));
    const nameCol    = detectColumn(headers, "name");
    const emailCol   = detectColumn(headers, "email");
    const companyCol = detectColumn(headers, "company");
    const phoneCol   = detectColumn(headers, "phone");

    if (emailCol === -1) {
      res.status(400).json({
        error: "Could not find an Email column. Expected a header like: Email, Mail, Email Address",
        headers,
      });
      return;
    }

    const jobId = Math.random().toString(36).substring(2, 15);
    const totalContacts = rows.length - 1;

    importJobs.set(jobId, {
      imported: 0,
      skipped: 0,
      errors: [],
      total: totalContacts,
      status: "processing",
    });

    res.json({ jobId });

    // Background processing
    (async () => {
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      try {
        const baseName = req.file!.originalname ? req.file!.originalname.replace(/\.[^/.]+$/, "") : "Import";
        let currentGroupId = groupId;
        let groupIndex = 1;
        let successCountInCurrentGroup = 0;

        const getOrCreateGroupForBatch = async (index: number) => {
          const groupName = `${baseName} - Part ${index}`;
          let group = await ContactGroup.findOne({ name: groupName });
          if (!group) {
            group = await ContactGroup.create({
              name: groupName,
              description: `Automatically created during import of ${req.file?.originalname}`,
            });
          }
          return group._id;
        };

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const email = String(row[emailCol] ?? "").trim().toLowerCase();
          if (!email || !email.includes("@")) {
            if (email) errors.push(`Row ${i + 1}: invalid email "${email}"`);
            skipped++;
            
            const job = importJobs.get(jobId);
            if (job) {
              job.skipped = skipped;
              job.errors = errors;
            }
            continue;
          }

          try {
            const contactData: Record<string, unknown> = { email };
            if (nameCol !== -1 && row[nameCol]) contactData.name = String(row[nameCol]).trim();
            if (companyCol !== -1 && row[companyCol]) contactData.company = String(row[companyCol]).trim();
            if (phoneCol !== -1 && row[phoneCol]) contactData.phone = String(row[phoneCol]).trim();

            if (autoSplit) {
              if (!currentGroupId || successCountInCurrentGroup >= 500) {
                if (successCountInCurrentGroup >= 500) {
                  groupIndex++;
                  successCountInCurrentGroup = 0;
                }
                const newGroupId = await getOrCreateGroupForBatch(groupIndex);
                currentGroupId = String(newGroupId);
              }
            }

            if (currentGroupId) {
              contactData.groupIds = [currentGroupId];
            }

            await Contact.findOneAndUpdate(
              { email },
              { $set: contactData, $setOnInsert: { isActive: true } },
              { upsert: true, new: true },
            );
            imported++;
            if (autoSplit) {
              successCountInCurrentGroup++;
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Row ${i + 1} (${email}): ${msg}`);
            skipped++;
          }

          const job = importJobs.get(jobId);
          if (job) {
            job.imported = imported;
            job.skipped = skipped;
            job.errors = errors;
          }
        }

        const job = importJobs.get(jobId);
        if (job) {
          job.status = "completed";
        }
        logger.info({ jobId, imported, skipped, errors: errors.length }, "Contact background import completed");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ jobId, err }, "Background import failed");
        const job = importJobs.get(jobId);
        if (job) {
          job.status = "failed";
          job.error = msg;
        }
      }
    })();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Import failed initial parsing");
    res.status(500).json({ error: `Import failed: ${msg}` });
  }
});

router.get("/contacts/import/status/:jobId", (req, res): void => {
  const { jobId } = req.params;
  const job = importJobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Import job not found" });
    return;
  }
  res.json(job);
});

export default router;
