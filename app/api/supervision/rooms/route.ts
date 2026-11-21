import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AccessToken, LiveKitAPI } from "livekit-server-sdk";
import { issueSupervisorSession, supervisorCookieOptions, readSupervisorSession } from "@/lib/supervision-session";

export const runtime = "nodejs";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  const livekitUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!livekitUrl || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "خدمة الغرف الحية غير مهيأة. أضف إعدادات LiveKit أولاً." },
      { status: 503 },
    );
  }

  if (!process.env.SUPERVISION_TOKEN_SECRET || process.env.SUPERVISION_TOKEN_SECRET.length < 32) {
    return NextResponse.json(
      { error: "يلزم إعداد SUPERVISION_TOKEN_SECRET بطول 32 حرفاً على الأقل." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات إنشاء الغرفة غير صالحة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const supervisorName = cleanText(data.supervisorName, 80);
  const traineeName = cleanText(data.traineeName, 80);
  const traineeCode = cleanText(data.traineeCode, 40).toUpperCase();
  const scenarioTitle = cleanText(data.scenarioTitle, 160);

  if (!supervisorName || !traineeName || !scenarioTitle || !/^[A-Z0-9_-]{3,40}$/.test(traineeCode)) {
    return NextResponse.json(
      { error: "أدخل اسم المشرف والمتدرب والسيناريو، ورمز متدرب من 3 إلى 40 حرفاً أو رقماً." },
      { status: 400 },
    );
  }

  try {
    const roomName = `clinical-${randomUUID()}`;
    const url = new URL(livekitUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    const livekit = new LiveKitAPI({
      host: url.toString().replace(/\/$/, ""),
      apiKey,
      secret: apiSecret,
    });

    await livekit.room.createRoom({
      name: roomName,
      emptyTimeout: 600,
      maxParticipants: 2,
    });

    const createParticipantToken = async (role: "supervisor" | "trainee") => {
      const accessToken = new AccessToken(apiKey, apiSecret, {
        identity: `participant-${randomUUID()}`,
        name: role === "supervisor" ? "المشرف الأكاديمي" : "المتدرب",
        ttl: "2h",
        metadata: JSON.stringify({ role }),
      });
      accessToken.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true,
        roomAdmin: role === "supervisor",
      });
      return accessToken.toJwt();
    };

    const [supervisorToken, traineeInviteToken] = await Promise.all([
      createParticipantToken("supervisor"),
      createParticipantToken("trainee"),
    ]);

    let supervisorId = await readSupervisorSession(request);
    if (!supervisorId) supervisorId = randomUUID();

    const sessionCookie = await issueSupervisorSession(supervisorId);
    const response = NextResponse.json({
      roomName,
      serverUrl: livekitUrl,
      supervisorToken,
      traineeInviteToken,
      traineeCode,
      traineeName,
      scenarioTitle,
      supervisorName,
      supervisorProfileId: supervisorId,
    });
    response.cookies.set(sessionCookie.name, sessionCookie.value, supervisorCookieOptions(process.env.NODE_ENV === "production"));
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Unable to create clinical supervision room", error);
    return NextResponse.json({ error: "تعذر إنشاء الغرفة الحية. راجع إعدادات LiveKit وسجل الخادم." }, { status: 502 });
  }
}
