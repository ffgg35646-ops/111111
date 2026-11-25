import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPasswordHash, requirePlatformRole, SITE_PAGE_PERMISSIONS } from "@/lib/platform-auth";
import { getClinicalDatabase } from "@/lib/mongodb";

export const runtime="nodejs";
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager"]);
 if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});
 try{const db=await getClinicalDatabase();const users=await db.collection("platform_users").find({role:"sub_admin"},{projection:{_id:0,userId:1,name:1,email:1,status:1,permissions:1,createdAt:1}}).sort({createdAt:-1}).limit(300).toArray();return NextResponse.json({users},{headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({error:"تعذر تحميل حسابات الأدمن الفرعي."},{status:503});}
}
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"مصدر الطلب غير صالح."},{status:403});
 const actor=await requirePlatformRole(request,["admin","platform_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الحساب مطلوبة."},{status:400});
 const data=body as Record<string,unknown>;const name=clean(data.name,100);const email=clean(data.email,180).toLowerCase();const password=typeof data.password==="string"?data.password:"";
 const permissions=Array.isArray(data.permissions)?[...new Set(data.permissions.filter((p):p is string=>typeof p==="string"&&(SITE_PAGE_PERMISSIONS as readonly string[]).includes(p)))] as string[]:[];
 if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||!permissions.length)return NextResponse.json({error:"أدخل الاسم والبريد وكلمة مرور 12 حرفاً على الأقل وحدد صلاحية واحدة على الأقل."},{status:400});
 try{
  const db=await getClinicalDatabase();const users=db.collection("platform_users");await users.createIndex({email:1},{unique:true});
  if(await users.findOne({email},{projection:{_id:1}}))return NextResponse.json({error:"البريد مسجل بالفعل."},{status:409});
  const hash=createPasswordHash(password).split("$");const user={userId:randomUUID(),name,email,role:"sub_admin",status:"active",permissions,passwordSalt:hash[1],passwordHash:hash[2],mustChangePassword:true,createdAt:new Date(),createdBy:actor.userId};
  await users.insertOne(user);await db.collection("platform_audit_logs").insertOne({action:"sub_admin_created",actorUserId:actor.userId,targetUserId:user.userId,permissions,createdAt:new Date()});
  return NextResponse.json({success:true,user:{userId:user.userId,name,email,role:user.role,status:user.status,permissions}},{status:201});
 }catch{return NextResponse.json({error:"تعذر إنشاء الأدمن الفرعي."},{status:503});}
}
export async function PATCH(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"بيانات غير صالحة."},{status:400});}
 const data=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const userId=clean(data.userId,80);const status=data.status==="active"||data.status==="disabled"?data.status:"";
 const permissions=Array.isArray(data.permissions)?[...new Set(data.permissions.filter((p):p is string=>typeof p==="string"&&(SITE_PAGE_PERMISSIONS as readonly string[]).includes(p)))]:null;
 if(!userId||(!status&&!permissions))return NextResponse.json({error:"حدد الحساب أو التعديل المطلوب."},{status:400});
 try{const db=await getClinicalDatabase();const update:Record<string,unknown>={updatedAt:new Date(),updatedBy:actor.userId};if(status)update.status=status;if(permissions)update.permissions=permissions;const result=await db.collection("platform_users").updateOne({userId,role:"sub_admin"},{$set:update});if(!result.matchedCount)return NextResponse.json({error:"الأدمن الفرعي غير موجود."},{status:404});if(status==="disabled")await db.collection("platform_sessions").updateMany({userId,status:"active"},{$set:{status:"revoked",closedAt:new Date(),closedReason:"sub_admin_disabled"}});await db.collection("platform_audit_logs").insertOne({action:"sub_admin_updated",actorUserId:actor.userId,targetUserId:userId,changes:update,createdAt:new Date()});return NextResponse.json({success:true});}catch{return NextResponse.json({error:"تعذر تحديث الأدمن الفرعي."},{status:503});}
}
