import { mongoose } from "../lib/mongodb";

const smtpAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    host: { type: String, required: true },
    port: { type: Number, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    encryption: { type: String, enum: ["none", "ssl", "tls"], default: "tls" },
    isEnabled: { type: Boolean, default: true },
    priority: { type: Number, default: 1 },
    hourlyLimit: { type: Number, default: null },
    dailyLimit: { type: Number, default: null },
    sentToday: { type: Number, default: 0 },
    health: { type: String, enum: ["unknown", "healthy", "unhealthy"], default: "unknown" },
    imapHost: { type: String, default: null },
    imapPort: { type: Number, default: 993 },
    imapEncryption: { type: String, enum: ["none", "ssl", "tls"], default: "tls" },
    isImapEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SmtpAccount =
  mongoose.models.SmtpAccount || mongoose.model("SmtpAccount", smtpAccountSchema);
