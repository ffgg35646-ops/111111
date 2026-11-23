import { randomUUID } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
export const runtime="nodejs";
const roles=["admin","platform_manager","supervisor","trainer","trainee","consultant","accountant","support","content_manager","quality_manager"] as const;
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function GET(request:NextRequest){
 const moderation=request.nextUrl.searchParams.get("moderation")==="1";let actor=null;
 if(moderation){actor=await requirePlatformRole(request,["admin","platform_manager","supervisor","quality_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});}
 try{const db=await getClinicalDatabase();const posts=await db.collection("etzan_community_posts").find(moderation?{}:{status:"published"},{projection:{_id:0,postId:1,authorName:1,role:1,category:1,title:1,body:1,status:1,createdAt:1}}).sort({createdAt:-1}).limit(100).toArray();return NextResponse.json({posts},{headers:{"Cache-Control":"no-store"}});}
 catch(error){console.error("community GET",error);return NextResponse.json({error:"تعذر تحميل المجتمع المهني."},{status:503});}
}
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,[...roles]);if(!actor)return NextResponse.json({error:"سجل الدخول للمشاركة في المجتمع."},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات المشاركة مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,title=clean(d.title,160),text=clean(d.body,3000),category=clean(d.category,60);
 if(title.length<5||text.length<20||!["الخدمة الاجتماعية","علم النفس","الإرشاد الأسري","الاضطرابات النمائية","التدريب المهني"].includes(category))return NextResponse.json({error:"أدخل عنواناً ومحتوى وتصنيفاً صالحاً."},{status:400});
 const now=new Date(),post={postId:randomUUID(),authorId:actor.userId,authorName:actor.name,role:actor.role,title,body:text,category,status:"pending_review",createdAt:now,updatedAt:now};
 try{const db=await getClinicalDatabase();await db.collection("etzan_community_posts").insertOne(post);await db.collection("platform_audit_logs").insertOne({action:"community_post_submitted",actorUserId:actor.userId,postId:post.postId,createdAt:now});return NextResponse.json({success:true,postId:post.postId,status:post.status},{status:201});}
 catch(error){console.error("community POST",error);return NextResponse.json({error:"تعذر حفظ المشاركة."},{status:503});}
}
export async function PATCH(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","supervisor"]);if(!actor)return NextResponse.json({error:"إدارة المحتوى متاحة للمشرفين فقط."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات غير مكتملة."},{status:400});
 const d=body as Record<string,unknown>,postId=clean(d.postId,80),status=clean(d.status,20);
 if(!postId||!["published","rejected","hidden"].includes(status))return NextResponse.json({error:"الحالة غير صالحة."},{status:400});
 try{const db=await getClinicalDatabase();const result=await db.collection("etzan_community_posts").updateOne({postId},{$set:{status,moderatedBy:actor.userId,moderatedAt:new Date(),updatedAt:new Date()}});if(!result.matchedCount)return NextResponse.json({error:"المشاركة غير موجودة."},{status:404});await db.collection("platform_audit_logs").insertOne({action:"community_post_moderated",actorUserId:actor.userId,postId,status,createdAt:new Date()});return NextResponse.json({success:true});}
 catch(error){console.error("community PATCH",error);return NextResponse.json({error:"تعذر تحديث المشاركة."},{status:503});}
}