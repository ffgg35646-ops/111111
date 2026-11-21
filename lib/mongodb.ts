import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || "clinical_learning";

declare global {
  var clinicalMongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getClinicalDatabase() {
  if (!uri) throw new Error("MONGODB_URI is not configured.");

  let clientPromise = global.clinicalMongoClientPromise;
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      appName: "clinical-learning-platform",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 8000,
    });
    clientPromise = client.connect();
    global.clinicalMongoClientPromise = clientPromise;
  }

  const client = await clientPromise;
  return client.db(databaseName);
}
