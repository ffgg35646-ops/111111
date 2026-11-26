import { NextResponse } from "next/server";
import { getSitePage } from "@/lib/site-pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const page = await getSitePage("home");
  const content = page?.content || {};
  const theme = ["blue-light","emerald-dark","teal-light","purple-hybrid"].includes(String(content.theme)) ? String(content.theme) : "blue-light";
  return NextResponse.json({
    clinicName: typeof content.clinicName === "string" ? content.clinicName : "اتزان",
    logoName: typeof content.logoName === "string" ? content.logoName : "ETZAN",
    logoImage: typeof content.logoImage === "string" ? content.logoImage : "/etzan-symbol.svg",
    heroSlides: Array.isArray(content.heroSlides) ? content.heroSlides.slice(0,10).filter((item): item is string => typeof item === "string") : [],
    theme,
  }, { headers: { "Cache-Control": "no-store" } });
}
