import { jwtVerify } from "jose";

export async function verifyLiveKitSupervisorToken(token: string) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("LiveKit credentials are not configured.");

  const { payload } = await jwtVerify(token, new TextEncoder().encode(apiSecret), {
    algorithms: ["HS256"],
    issuer: apiKey,
  });

  const video = payload.video as Record<string, unknown> | undefined;
  const metadata = typeof payload.metadata === "string" ? JSON.parse(payload.metadata) as Record<string, unknown> : {};

  if (
    !video ||
    video.roomAdmin !== true ||
    typeof video.room !== "string" ||
    metadata.role !== "supervisor"
  ) {
    return null;
  }

  return { roomName: video.room, identity: payload.sub ?? "supervisor" };
}
