import { randomUUID } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","supervisor","trainer","trainee","consultant","accountant","support","content_manager","quality_manager"]);if(!actor)return NextResponse.json({error:"سجل الدخول أولاً."},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات البلاغ مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,postId=typeof d.postId==="string"?d.postId.trim().slice(0,80):"",reason=typeof d.reason==="string"?d.reason.trim().slice(0,500):"";
 if(!postId||reason.length<8)return NextResponse.json({error:"حدد المشاركة وسبب البلاغ."},{status:400});
 try{const db=await getClinicalDatabase();const post=await db.collection("etzan_community_posts").findOne({postId},{projection:{_id:1}});if(!post)return NextResponse.json({error:"المشاركة غير موجودة."},{status:404});const report={reportId:randomUUID(),postId,reporterId:actor.userId,reason,status:"open",createdAt:new Date()};await db.collection("etzan_community_reports").insertOne(report);return NextResponse.json({success:true,reportId:report.reportId},{status:201});}
 catch(error){console.error("community report",error);return NextResponse.json({error:"تعذر إرسال البلاغ."},{status:503});}
}
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","supervisor","quality_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});
 try{const db=await getClinicalDatabase();const reports=await db.collection("etzan_community_reports").find({status:"open"},{projection:{_id:0}}).sort({createdAt:-1}).limit(100).toArray();const enriched=await Promise.all(reports.map(async report=>{const post=await db.collection("etzan_community_posts").findOne({postId:report.postId},{projection:{_id:0,title:1,body:1,category:1,status:1,authorName:1}});return {...report,post}}));return NextResponse.json({reports:enriched},{headers:{"Cache-Control":"no-store"}});}
 catch(error){console.error("community reports GET",error);return NextResponse.json({error:"تعذر تحميل البلاغات."},{status:503});}
}
export async function PATCH(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","supervisor","quality_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات غير مكتملة."},{status:400});
 const d=body as Record<string,unknown>,reportId=typeof d.reportId==="string"?d.reportId.trim().slice(0,80):"",status=typeof d.status==="string"?d.status.trim():"";
 if(!reportId||!["resolved","dismissed"].includes(status))return NextResponse.json({error:"حالة البلاغ غير صالحة."},{status:400});
 try{const db=await getClinicalDatabase();const result=await db.collection("etzan_community_reports").updateOne({reportId,status:"open"},{$set:{status,reviewedAt:new Date(),reviewedBy:actor.userId}});if(!result.matchedCount)return NextResponse.json({error:"البلاغ غير موجود أو سبق التعامل معه."},{status:404});await db.collection("platform_audit_logs").insertOne({action:"community_report_reviewed",actorUserId:actor.userId,reportId,status,createdAt:new Date()});return NextResponse.json({success:true});}
 catch(error){console.error("community reports PATCH",error);return NextResponse.json({error:"تعذر تحديث البلاغ."},{status:503});}
}
