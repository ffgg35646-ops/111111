import { getClinicalDatabase } from "@/lib/mongodb";

type CreateZoomMeetingInput = {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  recordingAllowed?: boolean;
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
        auto_recording: input.recordingAllowed === true ? "cloud" : "none",
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
    recordingAllowed: input.recordingAllowed === true,
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
    hostStartUrl: record.hostStartUrl,
  };
}


export async function rescheduleZoomMeeting(input: { meetingId: string; startTime: Date; durationMinutes: number }) {
  const hostUserId = process.env.ZOOM_HOST_USER_ID;
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!hostUserId || !accountId || !clientId || !clientSecret) throw new Error("Zoom Server-to-Server OAuth credentials are not configured.");
  if (!input.meetingId || !Number.isFinite(input.startTime.getTime()) || input.startTime.getTime() < Date.now() + 5 * 60 * 1000) {
    throw new Error("The new Zoom meeting time must be at least five minutes in the future.");
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 480) {
    throw new Error("Zoom meeting duration must be between 15 and 480 minutes.");
  }
  const tokenUrl = new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", accountId);
  const basic = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({})) as { access_token?: string; message?: string };
  if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error(tokenPayload.message || "Zoom OAuth token request failed.");
  const response = await fetch("https://api.zoom.us/v2/meetings/" + encodeURIComponent(input.meetingId), {
    method: "PATCH",
    headers: { Authorization: "Bearer " + tokenPayload.access_token, "Content-Type": "application/json" },
    body: JSON.stringify({
      start_time: input.startTime.toISOString(),
      duration: input.durationMinutes,
      timezone: process.env.ZOOM_TIMEZONE || "Africa/Cairo",
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(payload.message || "Zoom rejected the meeting reschedule.");
  }
  const db = await getClinicalDatabase();
  await db.collection("platform_zoom_meetings").updateOne(
    { meetingId: input.meetingId },
    { $set: { startTime: input.startTime, durationMinutes: input.durationMinutes, updatedAt: new Date(), status: "rescheduled" } },
  );
  return { meetingId: input.meetingId, startTime: input.startTime, durationMinutes: input.durationMinutes };
}


async function getZoomServerToken() {
  const accountId=process.env.ZOOM_ACCOUNT_ID,clientId=process.env.ZOOM_CLIENT_ID,clientSecret=process.env.ZOOM_CLIENT_SECRET;
  if(!accountId||!clientId||!clientSecret)throw new Error("Zoom Server-to-Server OAuth credentials are not configured.");
  const tokenUrl=new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type","account_credentials");
  tokenUrl.searchParams.set("account_id",accountId);
  const response=await fetch(tokenUrl,{method:"POST",headers:{Authorization:"Basic "+Buffer.from(clientId+":"+clientSecret).toString("base64"),"Content-Type":"application/x-www-form-urlencoded"},cache:"no-store"});
  const payload=await response.json().catch(()=>({})) as {access_token?:string;message?:string};
  if(!response.ok||!payload.access_token)throw new Error(payload.message||"Zoom OAuth token request failed.");
  return payload.access_token;
}

function trustedZoomUrl(value:unknown) {
  if(typeof value!=="string")return "";
  try {
    const url=new URL(value);
    if(url.protocol!=="https:"||!(url.hostname==="zoom.us"||url.hostname.endsWith(".zoom.us")||url.hostname==="zoomgov.com"||url.hostname.endsWith(".zoomgov.com")))return "";
    return url.toString();
  } catch { return ""; }
}

export async function getZoomMeetingRecording(meetingId:string) {
  if(!meetingId)throw new Error("Zoom meeting ID is required.");
  const token=await getZoomServerToken();
  const response=await fetch("https://api.zoom.us/v2/meetings/"+encodeURIComponent(meetingId)+"/recordings",{
    headers:{Authorization:"Bearer "+token},cache:"no-store",
  });
  const payload=await response.json().catch(()=>({})) as {
    share_url?:string;
    recording_files?:Array<{play_url?:string;recording_play_passcode?:string}>;
    message?:string;
  };
  if(!response.ok)throw new Error(payload.message||"Zoom cloud recording is not available yet. Check recording permissions and try again.");
  const first=payload.recording_files?.find(file=>typeof file.play_url==="string");
  let target=trustedZoomUrl(payload.share_url)||trustedZoomUrl(first?.play_url);
  if(!target)throw new Error("Zoom did not return a valid cloud recording link.");
  const passcode=first?.recording_play_passcode;
  if(passcode){
    const url=new URL(target);
    if(!url.searchParams.has("pwd"))url.searchParams.set("pwd",passcode);
    target=url.toString();
  }
  return {recordingUrl:target};
}

export async function deleteZoomMeeting(meetingId:string) {
  if(!meetingId)throw new Error("Zoom meeting ID is required.");
  const token=await getZoomServerToken();
  const response=await fetch("https://api.zoom.us/v2/meetings/"+encodeURIComponent(meetingId),{
    method:"DELETE",headers:{Authorization:"Bearer "+token},cache:"no-store",
  });
  if(!response.ok&&response.status!==404){
    const payload=await response.json().catch(()=>({})) as {message?:string};
    throw new Error(payload.message||"Zoom could not cancel this meeting.");
  }
  return true;
}
