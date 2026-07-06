import { mongoose } from "../lib/mongodb";

const aiConfigSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["gemini", "openai", "claude", "nvidia", "grok"],
      required: true,
      unique: true,
    },
    apiKey: { type: String, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const AiConfig =
  mongoose.models.AiConfig || mongoose.model("AiConfig", aiConfigSchema);
