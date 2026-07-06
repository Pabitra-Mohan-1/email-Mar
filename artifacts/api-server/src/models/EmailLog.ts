import { mongoose } from "../lib/mongodb";

const emailLogSchema = new mongoose.Schema(
  {
    recipient: { type: String, required: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    campaignName: { type: String, default: null },
    smtpAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "SmtpAccount", default: null },
    status: { type: String, enum: ["sent", "failed", "pending"], default: "pending" },
    retryCount: { type: Number, default: 0 },
    smtpResponse: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

emailLogSchema.index({ campaignId: 1 });
emailLogSchema.index({ status: 1 });
emailLogSchema.index({ createdAt: -1 });

export const EmailLog =
  mongoose.models.EmailLog || mongoose.model("EmailLog", emailLogSchema);
