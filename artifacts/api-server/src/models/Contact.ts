import { mongoose } from "../lib/mongodb";

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, default: null },
    email: { type: String, required: true, lowercase: true, trim: true },
    company: { type: String, default: null },
    phone: { type: String, default: null },
    website: { type: String, default: null },
    city: { type: String, default: null },
    country: { type: String, default: null },
    notes: { type: String, default: null },
    tags: { type: [String], default: [] },
    groupIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

contactSchema.index({ email: 1 }, { unique: true });
contactSchema.index({ groupIds: 1 });

export const Contact = mongoose.models.Contact || mongoose.model("Contact", contactSchema);
