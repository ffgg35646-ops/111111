import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
export const runtime="nodejs";
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const roles=["admin","platform_manager","supervisor","content_manager"] as const;
export async function GET(request:NextRequest){
 try{const db=await getClinicalDatabase();const moderation=request.nextUrl.searchParams.get("moderation")==="1";let filter:Record<string,unknown>={status:"published"};
 if(moderation){const actor=await requirePlatformRole(request,[...roles]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});filter={};}
 const articles=await db.collection("etzan_articles").find(filter,{projection:{_id:0,createdBy:moderation?1:0,updatedBy:moderation?1:0}}).sort({updatedAt:-1,createdAt:-1}).limit(200).toArray();
 return NextResponse.json({articles},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("articles GET",error);return NextResponse.json({error:"تعذر تحميل المقالات. تحقق من إعداد قاعدة البيانات."},{status:503});}
}
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,[...roles]);if(!actor)return NextResponse.json({error:"إدارة المقالات متاحة لمسؤول المحتوى أو الإدارة."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات المقال مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,title=clean(d.title,180),summary=clean(d.summary,500),content=clean(d.content,12000),category=clean(d.category,80);
 if(title.length<5||summary.length<20||content.length<80||!category)return NextResponse.json({error:"أدخل عنواناً وملخصاً ومحتوى كافياً وتصنيفاً."},{status:400});
 const now=new Date(),article={articleId:randomUUID(),title,summary,content,category,authorName:clean(actor.name,100)||"فريق اتزان",status:d.publish===true?"published":"draft",createdBy:actor.userId,createdAt:now,updatedAt:now};
 try{const db=await getClinicalDatabase();await db.collection("etzan_articles").insertOne(article);await db.collection("platform_audit_logs").insertOne({action:"article_created",actorUserId:actor.userId,articleId:article.articleId,status:article.status,createdAt:now});return NextResponse.json({success:true,article},{status:201});}
 catch(error){console.error("articles POST",error);return NextResponse.json({error:"تعذر حفظ المقال."},{status:503});}
}
export async function PATCH(request:NextRequest){
 const actor=await requirePlatformRole(request,[...roles]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات غير مكتملة."},{status:400});
 const d=body as Record<string,unknown>,articleId=clean(d.articleId,80),status=clean(d.status,20);
 if(!articleId)return NextResponse.json({error:"معرّف المقال مطلوب."},{status:400});
 const set:Record<string,unknown>={updatedAt:new Date(),updatedBy:actor.userId};
 if(status){if(!["draft","published","archived"].includes(status))return NextResponse.json({error:"حالة المقال غير صالحة."},{status:400});set.status=status;}
 if(["title","summary","content","category"].some(k=>k in d)){
  const title=clean(d.title,180),summary=clean(d.summary,500),content=clean(d.content,12000),category=clean(d.category,80);
  if(title.length<5||summary.length<20||content.length<80||!category)return NextResponse.json({error:"أدخل عنواناً وملخصاً ومحتوى كافياً وتصنيفاً."},{status:400});
  Object.assign(set,{title,summary,content,category});
 }
 if(Object.keys(set).length===2)return NextResponse.json({error:"لا توجد تغييرات للحفظ."},{status:400});
 try{const db=await getClinicalDatabase();const result=await db.collection("etzan_articles").updateOne({articleId},{$set:set});if(!result.matchedCount)return NextResponse.json({error:"المقال غير موجود."},{status:404});await db.collection("platform_audit_logs").insertOne({action:"article_updated",actorUserId:actor.userId,articleId,status:status||"content_edited",createdAt:new Date()});return NextResponse.json({success:true});}
 catch(error){console.error("articles PATCH",error);return NextResponse.json({error:"تعذر تحديث المقال."},{status:503});}
}