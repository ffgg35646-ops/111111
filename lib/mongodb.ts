import { MongoClient } from "mongodb";
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || "clinical_learning";
declare global { var clinicalMongoClientPromise: Promise<MongoClient> | undefined; }

export async function getClinicalDatabase() {
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  const localDevelopmentUri = /^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(uri);
  const tlsDisabled = process.env.MONGODB_TLS === "false";
  if (process.env.NODE_ENV === "production" && tlsDisabled) throw new Error("MONGODB_TLS cannot be disabled in production.");
  const useTls = !localDevelopmentUri && !tlsDisabled;
  let clientPromise = global.clinicalMongoClientPromise;
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      appName: "clinical-learning-platform",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
      tls: useTls,
    });
    clientPromise = client.connect();
    global.clinicalMongoClientPromise = clientPromise;
  }
  const client = await clientPromise;
  return client.db(databaseName);
}
