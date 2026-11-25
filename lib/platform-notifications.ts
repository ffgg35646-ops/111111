import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";

export type PlatformNotificationInput = {
  title: string;
  message: string;
  href: string;
  type: string;
  metadata?: Record<string, unknown>;
};

export async function notifyPlatformUsers(db: Db, userIds: string[], input: PlatformNotificationInput) {
  const recipients = [...new Set(userIds.map((value) => value.trim()).filter(Boolean))];
  if (!recipients.length) return;
  const createdAt = new Date();
  try {
    await db.collection("platform_notifications").insertMany(
      recipients.map((recipientUserId) => ({
        notificationId: randomUUID(),
        recipientUserId,
        title: input.title.slice(0, 140),
        message: input.message.slice(0, 500),
        href: input.href.startsWith("/") ? input.href.slice(0, 300) : "/notifications",
        type: input.type.slice(0, 50),
        metadata: input.metadata || {},
        createdAt,
        readAt: null,
      })),
      { ordered: false },
    );
  } catch (error) {
    console.warn("Unable to create platform notifications", error);
  }
}

export async function notifyPlatformRoles(
  db: Db,
  roles: string[],
  input: PlatformNotificationInput,
  excludedUserIds: string[] = [],
) {
  try {
    const rows = await db.collection("platform_users").find(
      { role: { $in: roles }, status: "active" },
      { projection: { _id: 0, userId: 1 } },
    ).toArray();
    const excluded = new Set(excludedUserIds);
    const userIds = rows.map((row) => String(row.userId || "")).filter((id) => id && !excluded.has(id));
    await notifyPlatformUsers(db, userIds, input);
  } catch (error) {
    console.warn("Unable to find platform notification recipients", error);
  }
}
