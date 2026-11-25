import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformPermission, SITE_PAGE_PERMISSIONS } from "@/lib/platform-auth";

export const runtime = "nodejs";
const PAGE_PERMISSION: Record<string, typeof SITE_PAGE_PERMISSIONS[number]> = {
  home: "site_home", about: "site_about", privacy: "site_privacy",
};
const fields: Record<string, string[]> = {
  home: ["heroTitle","heroAccent","heroDescription","aboutTitle","aboutDescription","ownerTitle","ownerName","ownerBio","featuredCourseIds"],
  about: ["title","intro","mission","vision","goals","ownerTitle","ownerName","ownerBio","ownerCredentials"],
  privacy: ["title","intro","sections"],
};
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0,max) : "";

export async function GET(request: NextRequest) {
  const slug = clean(request.nextUrl.searchParams.get("slug"), 20);
  if (!(slug in PAGE_PERMISSION)) return NextResponse.json({error:"الصفحة غير معروفة."},{status:400});
  const actor = await requirePlatformPermission(request, PAGE_PERMISSION[slug]);
  if (!actor) return NextResponse.json({error:"ليس لديك صلاحية إدارة هذه الصفحة."},{status:403});
  try {
    const db=await getClinicalDatabase();
    const page=await db.collection("platform_site_pages").findOne({slug},{projection:{_id:0,slug:1,content:1,updatedAt:1}});
    return NextResponse.json({page:page||{slug,content:{},updatedAt:null}},{headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({error:"تعذر تحميل محتوى الصفحة."},{status:503}); }
}

export async function PUT(request: NextRequest) {
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"مصدر الطلب غير صالح."},{status:403});
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400});}
  if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الصفحة مطلوبة."},{status:400});
  const data=body as Record<string,unknown>;
  const slug=clean(data.slug,20);
  if(!(slug in PAGE_PERMISSION))return NextResponse.json({error:"الصفحة غير معروفة."},{status:400});
  const actor=await requirePlatformPermission(request,PAGE_PERMISSION[slug]);
  if(!actor)return NextResponse.json({error:"ليس لديك صلاحية تعديل هذه الصفحة."},{status:403});
  if(!data.content||typeof data.content!=="object"||Array.isArray(data.content))return NextResponse.json({error:"محتوى الصفحة غير صالح."},{status:400});
  const source=data.content as Record<string,unknown>;
  const content:Record<string,unknown>={};
  for(const field of fields[slug]){
    const value=source[field];
    if(field==="sections")content[field]=Array.isArray(value)?value.slice(0,20).map((item)=>{const row=item&&typeof item==="object"?item as Record<string,unknown>:{};return {heading:clean(row.heading,120),body:clean(row.body,5000)};}):[];
    else if(field==="featuredCourseIds")content[field]=clean(value,1000).split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
    else content[field]=clean(value,field==="ownerBio"||field==="goals"||field==="mission"||field==="vision"||field==="intro"?5000:field==="heroDescription"?1500:300);
  }
  try{
    const db=await getClinicalDatabase();const now=new Date();
    await db.collection("platform_site_pages").updateOne({slug},{$set:{slug,content,status:"published",updatedAt:now,updatedBy:actor.userId},$setOnInsert:{createdAt:now}},{upsert:true});
    await db.collection("platform_audit_logs").insertOne({action:"site_page_updated",actorUserId:actor.userId,pageSlug:slug,createdAt:now});
    return NextResponse.json({success:true,slug,updatedAt:now.toISOString()});
  }catch{return NextResponse.json({error:"تعذر حفظ الصفحة."},{status:503});}
}
