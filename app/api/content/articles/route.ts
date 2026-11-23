import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
export const runtime="nodejs";
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function GET(request:NextRequest){
 try{
  const db=await getClinicalDatabase();const moderation=request.nextUrl.searchParams.get("moderation")==="1";
  let filter:Record<string,unknown>={status:"published"};
  if(moderation){const actor=await requirePlatformRole(request,["admin","platform_manager","supervisor","content_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});filter={};}
  const articles=await db.collection("etzan_articles").find(filter,{projection:{_id:0}}).sort({updatedAt:-1,createdAt:-1}).limit(100).toArray();
  return NextResponse.json({articles},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("articles GET",error);return NextResponse.json({error:"تعذر تحميل المقالات. تحقق من إعداد قاعدة البيانات."},{status:503});}
}
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","supervisor","content_manager"]);if(!actor)return NextResponse.json({error:"إدارة المقالات متاحة لمسؤول المحتوى أو الإدارة."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات المقال مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,title=clean(d.title,180),summary=clean(d.summary,500),content=clean(d.content,12000),category=clean(d.category,80);
 if(title.length<5||summary.length<20||content.length<80||!category)return NextResponse.json({error:"أدخل عنواناً وملخصاً ومحتوى كافياً وتصنيفاً."},{status:400});
 const now=new Date(),article={articleId:randomUUID(),title,summary,content,category,authorName:actor.name,status:d.publish===true?"published":"draft",createdBy:actor.userId,createdAt:now,updatedAt:now};
 try{const db=await getClinicalDatabase();await db.collection("etzan_articles").insertOne(article);await db.collection("platform_audit_logs").insertOne({action:"article_created",actorUserId:actor.userId,articleId:article.articleId,status:article.status,createdAt:now});return NextResponse.json({success:true,article},{status:201});}
 catch(error){console.error("articles POST",error);return NextResponse.json({error:"تعذر حفظ المقال."},{status:503});}
}
export async function PATCH(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","supervisor","content_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات غير مكتملة."},{status:400});
 const d=body as Record<string,unknown>,articleId=clean(d.articleId,80),status=clean(d.status,20);
 if(!articleId||!["draft","published","archived"].includes(status))return NextResponse.json({error:"حالة المقال غير صالحة."},{status:400});
 try{const db=await getClinicalDatabase();const result=await db.collection("etzan_articles").updateOne({articleId},{$set:{status,updatedAt:new Date(),updatedBy:actor.userId}});if(!result.matchedCount)return NextResponse.json({error:"المقال غير موجود."},{status:404});await db.collection("platform_audit_logs").insertOne({action:"article_status_changed",actorUserId:actor.userId,articleId,status,createdAt:new Date()});return NextResponse.json({success:true});}
 catch(error){console.error("articles PATCH",error);return NextResponse.json({error:"تعذر تحديث المقال."},{status:503});}
}