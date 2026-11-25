import { createHmac } from "node:crypto";
import type { Db } from "mongodb";

const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 7;
const ADDRESS_LIMIT = 35;

type RateLimitKey = { key: string; limit: number };

function hashLimitKey(scope: "email" | "address", value: string) {
  const secret = process.env.PLATFORM_SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("PLATFORM_SESSION_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(scope + ":" + value).digest("hex");
}

function buildKeys(address: string, email: string): RateLimitKey[] {
  const keys: RateLimitKey[] = [{ key: hashLimitKey("email", email), limit: EMAIL_LIMIT }];
  if (address && address !== "unknown") keys.push({ key: hashLimitKey("address", address), limit: ADDRESS_LIMIT });
  return keys;
}

async function rateLimitCollection(db: Db) {
  const collection = db.collection("platform_login_rate_limits");
  await Promise.all([
    collection.createIndex({ key: 1 }, { unique: true, name: "platform_login_rate_limit_key" }),
    collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "platform_login_rate_limit_expiry" }),
  ]);
  return collection;
}

export async function checkLoginAttemptLimit(db: Db, address: string, email: string) {
  const collection = await rateLimitCollection(db);
  const now = new Date();
  const keys = buildKeys(address, email);
  const records = await collection.find(
    { key: { $in: keys.map((item) => item.key) }, expiresAt: { $gt: now } },
    { projection: { _id: 0, key: 1, count: 1, expiresAt: 1 } },
  ).toArray();
  const byKey = new Map(records.map((item) => [String(item.key), item]));
  const blocked = keys
    .map((item) => ({ item, record: byKey.get(item.key) }))
    .filter(({ item, record }) => Number(record?.count || 0) >= item.limit);
  if (!blocked.length) return { blocked: false, retryAfterSeconds: 0 };
  const retryAfterSeconds = Math.max(...blocked.map(({ record }) => {
    const expiry = record?.expiresAt instanceof Date ? record.expiresAt.getTime() : now.getTime() + 1000;
    return Math.max(1, Math.ceil((expiry - now.getTime()) / 1000));
  }));
  return { blocked: true, retryAfterSeconds };
}

export async function recordFailedLoginAttempt(db: Db, address: string, email: string) {
  const collection = await rateLimitCollection(db);
  const now = new Date();
  const newExpiry = new Date(now.getTime() + WINDOW_MS);
  const keys = buildKeys(address, email);
  await Promise.all(keys.map(({ key }) => collection.updateOne(
    { key },
    [{
      $set: {
        count: {
          $cond: [{ $gt: ["$expiresAt", now] }, { $add: [{ $ifNull: ["$count", 0] }, 1] }, 1],
        },
        expiresAt: { $cond: [{ $gt: ["$expiresAt", now] }, "$expiresAt", newExpiry] },
        updatedAt: now,
      },
    }],
    { upsert: true },
  )));
}
