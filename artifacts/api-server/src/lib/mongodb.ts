import mongoose from "mongoose";
import { logger } from "./logger";

let isConnected = false;

export async function connectMongo(): Promise<void> {
  if (isConnected) return;

  let uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }
  // Strip accidental "KEY=value" format if the secret was stored incorrectly
  const eqIdx = uri.indexOf("=");
  if (eqIdx !== -1 && !uri.startsWith("mongodb")) {
    uri = uri.slice(eqIdx + 1);
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  isConnected = true;
  logger.info("Connected to MongoDB");
}

export async function connectMongoWithRetry(maxAttempts = 5): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await connectMongo();
      return;
    } catch (err) {
      logger.error({ err, attempt }, "MongoDB connection attempt failed");
      if (attempt < maxAttempts) {
        const delay = Math.min(1000 * 2 ** attempt, 30000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  logger.warn("Could not connect to MongoDB after all attempts — starting anyway");
}

export { mongoose };
