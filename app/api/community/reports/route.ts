import { randomUUID } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","supervisor","trainer","trainee","consultant"]);if(!actor)return NextResponse.json({error:"سجل الدخول أولاً."},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات البلاغ مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,postId=typeof d.postId==="string"?d.postId.trim().slice(0,80):"",reason=typeof d.reason==="string"?d.reason.trim().slice(0,500):"";
 if(!postId||reason.length<8)return NextResponse.json({error:"حدد المشاركة وسبب البلاغ."},{status:400});
 try{const db=await getClinicalDatabase();const post=await db.collection("etzan_community_posts").findOne({postId},{projection:{_id:1}});if(!post)return NextResponse.json({error:"المشاركة غير موجودة."},{status:404});const report={reportId:randomUUID(),postId,reporterId:actor.userId,reason,status:"open",createdAt:new Date()};await db.collection("etzan_community_reports").insertOne(report);return NextResponse.json({success:true,reportId:report.reportId},{status:201});}
 catch(error){console.error("community report",error);return NextResponse.json({error:"تعذر إرسال البلاغ."},{status:503});}
}