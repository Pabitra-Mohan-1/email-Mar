import mongoose from "mongoose";
await mongoose.connect(process.env.MONGODB_URI);
const col = mongoose.connection.collection("incomingemails");
const leads = await col.find({ leadStatus: "interested" }).project({ fromAddress: 1, aiSummary: 1 }).toArray();
console.log("interested leads:", leads.length);
for (const l of leads) {
  const s = l.aiSummary || "(empty)";
  const words = s.split(/\s+/).length;
  console.log(`  [${words}w] ${l.fromAddress}`);
  console.log(`     ${s}`);
}
await mongoose.disconnect();
