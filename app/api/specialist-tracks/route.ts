import { NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { buildSpecialistTracks } from "@/lib/specialist-tracks";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getClinicalDatabase();
    const records = await db.collection("platform_specialist_tracks").find(
      {}, { projection: { _id: 0 } },
    ).limit(200).toArray();
    return NextResponse.json({ tracks: buildSpecialistTracks(records) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Specialist tracks GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل المسارات المهنية حالياً." }, { status: 503 });
  }
}
