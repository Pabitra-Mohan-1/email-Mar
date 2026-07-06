import { mongoose } from "../lib/mongodb";

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    senderName: { type: String, required: true },
    senderEmail: { type: String, required: true },
    smtpAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "SmtpAccount", default: null },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "EmailTemplate", default: null },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "ContactGroup", default: null },
    status: {
      type: String,
      enum: ["draft", "scheduled", "running", "paused", "completed", "cancelled"],
      default: "draft",
    },
    scheduledAt: { type: Date, default: null },
    hourlyLimit: { type: Number, default: null },
    dailyLimit: { type: Number, default: null },
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    mailsPerBatch: { type: Number, default: 10 },
    intervalMinutes: { type: Number, default: 1 },
    lastProcessedAt: { type: Date, default: null },
    customHtml: { type: String, default: null },
  },
  { timestamps: true }
);

campaignSchema.index({ status: 1 });

export const Campaign =
  mongoose.models.Campaign || mongoose.model("Campaign", campaignSchema);
