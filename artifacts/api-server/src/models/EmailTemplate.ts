import { mongoose } from "../lib/mongodb";

const emailTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true },
    htmlContent: { type: String, required: true },
    textContent: { type: String, default: null },
    previewText: { type: String, default: null },
    status: { type: String, enum: ["draft", "active"], default: "draft" },
  },
  { timestamps: true }
);

export const EmailTemplate =
  mongoose.models.EmailTemplate || mongoose.model("EmailTemplate", emailTemplateSchema);
