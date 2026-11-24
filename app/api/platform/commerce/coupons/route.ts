import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
export const runtime="nodejs";
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","accountant"]);
 if(!actor)return NextResponse.json({error:"غير مصرح بعرض الكوبونات."},{status:403});
 try{const db=await getClinicalDatabase(),coupons=await db.collection("etzan_coupons").find({},{projection:{_id:0,code:1,type:1,value:1,appliesTo:1,minimumAmount:1,maxUses:1,usedCount:1,startsAt:1,expiresAt:1,active:1,createdAt:1}}).sort({createdAt:-1}).limit(300).toArray();return NextResponse.json({coupons},{headers:{"Cache-Control":"no-store"}})}
 catch(error){console.error("ETZAN coupons GET",error);return NextResponse.json({error:"تعذر تحميل الكوبونات."},{status:503})}
}
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح بإدارة الكوبونات."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الكوبون غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الكوبون مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,code=clean(d.code,40).toUpperCase().replace(/[^A-Z0-9_-]/g,""),type=d.type==="percent"?"percent":"fixed",value=Number(d.value),appliesTo=["all","course","book","membership"].includes(String(d.appliesTo))?String(d.appliesTo):"all",minimumAmount=Number(d.minimumAmount||0),maxUses=d.maxUses===null||d.maxUses===""?null:Number(d.maxUses),expiresAt=d.expiresAt?new Date(String(d.expiresAt)):null;
 if(code.length<3||!Number.isFinite(value)||value<=0||(type==="percent"&&value>100)||!Number.isFinite(minimumAmount)||minimumAmount<0||(maxUses!==null&&(!Number.isInteger(maxUses)||maxUses<1))||(expiresAt&&(!Number.isFinite(expiresAt.getTime())||expiresAt<=new Date())))return NextResponse.json({error:"تحقق من الرمز ونوع الخصم وقيمته وحدود الاستخدام وتاريخ الانتهاء."},{status:400});
 try{const db=await getClinicalDatabase(),now=new Date();await db.collection("etzan_coupons").createIndex({code:1},{unique:true});await db.collection("etzan_coupons").insertOne({couponId:randomUUID(),code,type,value:Math.round(value*100)/100,appliesTo,minimumAmount,maxUses,usedCount:0,...(expiresAt?{expiresAt}:{}),active:d.active!==false,createdAt:now,createdBy:actor.userId});await db.collection("platform_audit_logs").insertOne({action:"commerce_coupon_created",actorUserId:actor.userId,couponCode:code,createdAt:now});return NextResponse.json({success:true,code},{status:201})}
 catch(error){if((error as {code?:number}).code===11000)return NextResponse.json({error:"رمز الكوبون مستخدم بالفعل."},{status:409});console.error("ETZAN coupon POST",error);return NextResponse.json({error:"تعذر حفظ الكوبون."},{status:503})}
}
export async function PATCH(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح بتعديل الكوبونات."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات التعديل غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات التعديل مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,code=clean(d.code,40).toUpperCase(),active=d.active;
 if(!code||typeof active!=="boolean")return NextResponse.json({error:"حدد رمز الكوبون وحالته."},{status:400});
 try{const db=await getClinicalDatabase(),result=await db.collection("etzan_coupons").updateOne({code},{$set:{active,updatedAt:new Date(),updatedBy:actor.userId}});if(!result.matchedCount)return NextResponse.json({error:"الكوبون غير موجود."},{status:404});return NextResponse.json({success:true})}
 catch(error){console.error("ETZAN coupon PATCH",error);return NextResponse.json({error:"تعذر تحديث الكوبون."},{status:503})}
}
