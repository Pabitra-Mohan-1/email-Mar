import { mongoose } from "../lib/mongodb";

const contactGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
  },
  { timestamps: true }
);

export const ContactGroup =
  mongoose.models.ContactGroup || mongoose.model("ContactGroup", contactGroupSchema);
