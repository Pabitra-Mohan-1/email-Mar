import mongoose from "mongoose";

const uri = "mongodb+srv://yt-auth-server:x9pe1GJsdNw9qoUo@yt-auth.gtycykm.mongodb.net/email_marketing?retryWrites=true&w=majority&appName=yt-auth";

const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333; line-height: 1.6;">
<p>Hello [[DOMAIN]] Team,</p>

<p>In today’s digital era, a strong online presence is essential for business growth. This is the right time to improve this. With our SEO, Local SEO, AEO, and GEO strategies, we can significantly boost the digital presence and growth of your [[DOMAIN]].</p>

<p><strong>SEO</strong> – Improve your website’s Ranking &amp; visibility on Google.<br>
<strong>Local SEO</strong> – Strengthen your local presence and increase enquiries.<br>
<strong>AEO</strong> – Enhance visibility on AI-powered search platforms.<br>
<strong>GEO</strong> – Build stronger brand authority within the Google ecosystem.</p>

<p>This powerful solution is designed to help you stay ahead in today’s fast-evolving search landscape. If you’d like to take advantage of this opportunity and boost your online growth.</p>

<p>Reply to this email or share your contact details to discuss further.</p>

<p>Best regards,<br>
NAME<br>
Marketing Consultant</p>
</div>`;

const textContent = `Hello [[DOMAIN]] Team,

In today’s digital era, a strong online presence is essential for business growth. This is the right time to improve this. With our SEO, Local SEO, AEO, and GEO strategies, we can significantly boost the digital presence and growth of your [[DOMAIN]].

SEO – Improve your website’s Ranking & visibility on Google.
Local SEO – Strengthen your local presence and increase enquiries.
AEO – Enhance visibility on AI-powered search platforms.
GEO – Build stronger brand authority within the Google ecosystem.

This powerful solution is designed to help you stay ahead in today’s fast-evolving search landscape. If you’d like to take advantage of this opportunity and boost your online growth.

Reply to this email or share your contact details to discuss further.

Best regards,
NAME
Marketing Consultant`;

async function createNewSEOTemplate() {
  await mongoose.connect(uri);
  const col = mongoose.connection.collection("emailtemplates");

  const doc = {
    name: "SEO, Local SEO, AEO & GEO Strategy",
    subject: "Digital Presence & SEO Growth for [[DOMAIN]]",
    htmlContent,
    textContent,
    previewText: "Boost digital presence & growth with SEO, Local SEO, AEO & GEO strategies for [[DOMAIN]]",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const res = await col.insertOne(doc);
  console.log("Created new template with ID:", res.insertedId);
  await mongoose.disconnect();
}

createNewSEOTemplate().catch(console.error);
