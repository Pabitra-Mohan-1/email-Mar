import mongoose from "mongoose";

const uri = "mongodb+srv://yt-auth-server:x9pe1GJsdNw9qoUo@yt-auth.gtycykm.mongodb.net/email_marketing?retryWrites=true&w=majority&appName=yt-auth";

async function cleanAllTemplates() {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection("emailtemplates");

  const templates = await col.find().toArray();
  for (const t of templates) {
    let html = t.htmlContent || "";
    let text = t.textContent || "";

    html = html.replace(/<p>Best regards,<br>\s*NAME<br>/gi, "<p>Best regards,<br>\n{{senderName}}<br>");
    html = html.replace(/\bNAME\b/g, "{{senderName}}");

    if (text) {
      text = text.replace(/Best regards,\s*NAME/gi, "Best regards,\n{{senderName}}");
      text = text.replace(/\bNAME\b/g, "{{senderName}}");
    }

    await col.updateOne(
      { _id: t._id },
      { $set: { htmlContent: html, textContent: text } }
    );
  }

  console.log("All templates updated cleanly.");
  await mongoose.disconnect();
}

cleanAllTemplates().catch(console.error);
