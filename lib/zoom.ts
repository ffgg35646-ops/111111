import { getClinicalDatabase } from "@/lib/mongodb";

type CreateZoomMeetingInput = {
  topic: string;
  startTime: Date;
  durationMinutes: number;
};

export async function createZoomMeeting(input: CreateZoomMeetingInput) {
  const hostUserId = process.env.ZOOM_HOST_USER_ID;
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!hostUserId || !accountId || !clientId || !clientSecret) {
    throw new Error("Zoom Server-to-Server OAuth credentials or host user are not configured.");
  }
  if (input.startTime.getTime() < Date.now() + 5 * 60 * 1000) {
    throw new Error("Zoom meetings must be scheduled at least five minutes in the future.");
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 480) {
    throw new Error("Zoom meeting duration must be between 15 and 480 minutes.");
  }

  const tokenUrl = new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", accountId);
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || typeof tokenPayload.access_token !== "string") {
    throw new Error(typeof tokenPayload.message === "string" ? tokenPayload.message : "Zoom OAuth token request failed.");
  }

  const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostUserId)}/meetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: input.topic.slice(0, 180),
      type: 2,
      start_time: input.startTime.toISOString(),
      duration: input.durationMinutes,
      timezone: process.env.ZOOM_TIMEZONE || "Africa/Cairo",
      settings: {
        join_before_host: false,
        waiting_room: true,
        participant_video: true,
        host_video: false,
      },
    }),
    cache: "no-store",
  });
  const meeting = await response.json().catch(() => ({}));
  if (!response.ok || meeting.id === undefined || typeof meeting.join_url !== "string") {
    throw new Error(typeof meeting.message === "string" ? meeting.message : "Zoom rejected the meeting request.");
  }

  const record = {
    provider: "zoom",
    meetingId: String(meeting.id),
    topic: input.topic.slice(0, 180),
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    timezone: process.env.ZOOM_TIMEZONE || "Africa/Cairo",
    joinUrl: meeting.join_url as string,
    hostStartUrl: typeof meeting.start_url === "string" ? meeting.start_url : "",
    createdAt: new Date(),
    createdBy: "platform-admin",
    status: "scheduled",
  };

  const db = await getClinicalDatabase();
  await db.collection("platform_zoom_meetings").insertOne(record);

  return {
    meetingId: record.meetingId,
    topic: record.topic,
    startTime: record.startTime,
    durationMinutes: record.durationMinutes,
    timezone: record.timezone,
    joinUrl: record.joinUrl,
  };
}
