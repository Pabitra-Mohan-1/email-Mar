import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || "mongodb+srv://yt-auth-server:x9pe1GJsdNw9qoUo@yt-auth.gtycykm.mongodb.net/email_marketing?retryWrites=true&w=majority&appName=yt-auth";

async function checkCampaignsHtml() {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection("campaigns");
  const campaigns = await col.find({ status: { $in: ["draft", "running", "scheduled"] } }).toArray();
  console.log("Draft/Running/Scheduled campaigns:", campaigns.length);
  for (const c of campaigns) {
    console.log("ID:", c._id.toString(), "Name:", c.name, "Status:", c.status);
    console.log("SenderName:", c.senderName);
    console.log("customHtml length:", c.customHtml?.length);
    console.log("customHtml includes {{senderName}}:", c.customHtml?.includes("{{senderName}}"));
    console.log("customHtml snippet around Best regards:");
    const idx = c.customHtml?.indexOf("Best regards");
    if (idx !== -1 && idx !== undefined) {
      console.log(c.customHtml.substring(idx, idx + 100));
    } else {
      console.log("No Best regards found in customHtml");
    }
    console.log("-----------------------------------------");
  }
  await mongoose.disconnect();
}

checkCampaignsHtml().catch(console.error);
