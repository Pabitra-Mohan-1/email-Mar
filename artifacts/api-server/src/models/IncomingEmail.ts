import { mongoose } from "../lib/mongodb";

const incomingEmailSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "SmtpAccount", required: true },
    uid: { type: Number, required: true },
    messageId: { type: String, default: null },
    fromName: { type: String, default: null },
    fromAddress: { type: String, required: true, lowercase: true, trim: true },
    toAddress: { type: String, required: true, lowercase: true, trim: true },
    subject: { type: String, default: "(No Subject)" },
    text: { type: String, default: "" },
    html: { type: String, default: "" },
    date: { type: Date, required: true },
    isRead: { type: Boolean, default: false },
    category: { type: String, enum: ["reply", "bounce", "auto-reply"], default: "reply" },
    leadStatus: {
      type: String,
      enum: ["interested", "not_interested", "neutral", "unclassified"],
      default: "unclassified",
    },
    aiReason: { type: String, default: "" },
    aiDraft: { type: String, default: "" },
    aiSummary: { type: String, default: "" },
    keywordScore: { type: Number, default: 0 },
    actionStatus: {
      type: String,
      enum: ["pending", "replied", "ignored", "follow_up"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent duplicates per account by referencing the IMAP UID
incomingEmailSchema.index({ accountId: 1, uid: 1 }, { unique: true });
incomingEmailSchema.index({ accountId: 1, fromAddress: 1 });
incomingEmailSchema.index({ date: -1 });

export const IncomingEmail =
  mongoose.models.IncomingEmail || mongoose.model("IncomingEmail", incomingEmailSchema);
