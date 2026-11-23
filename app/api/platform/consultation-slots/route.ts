import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
export const runtime="nodejs";
const services=new Set(["social-consultation","professional-consultation","family-guidance","cbt-consultation"]);
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function GET(request:NextRequest){
 const serviceId=clean(request.nextUrl.searchParams.get("serviceId"),80),manage=request.nextUrl.searchParams.get("manage")==="1";
 if(!services.has(serviceId)&&!manage)return NextResponse.json({error:"حدد مجال الاستشارة."},{status:400});
 try{const db=await getClinicalDatabase(),now=new Date();if(manage){const actor=await requirePlatformRole(request,["admin","platform_manager","consultant"]);if(!actor)return NextResponse.json({error:"غير مصرح بإدارة المواعيد."},{status:403});const filter=actor.role==="consultant"?{providerUserId:actor.userId}:{};const slots=await db.collection("platform_consultant_slots").find(filter,{projection:{_id:0,slotId:1,providerUserId:1,providerName:1,serviceIds:1,startsAt:1,durationMinutes:1,status:1,reservedUntil:1}}).sort({startsAt:1}).limit(200).toArray();return NextResponse.json({slots},{headers:{"Cache-Control":"no-store"}})}
 const slots=await db.collection("platform_consultant_slots").find({serviceIds:serviceId,startsAt:{$gt:now},$or:[{status:"open"},{status:"reserved",reservedUntil:{$lt:now}}]},{projection:{_id:0,slotId:1,providerName:1,startsAt:1,durationMinutes:1}}).sort({startsAt:1}).limit(60).toArray();return NextResponse.json({slots},{headers:{"Cache-Control":"no-store"}})
 }catch(error){console.error("consultant slots GET",error);return NextResponse.json({error:"تعذر تحميل المواعيد المتاحة."},{status:503})}
}
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","consultant"]);if(!actor)return NextResponse.json({error:"سجل الدخول بصلاحية مقدم استشارة أو مدير."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الموعد غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الموعد مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,startsAt=new Date(typeof d.startsAt==="string"?d.startsAt:""),durationMinutes=Number(d.durationMinutes||50),serviceIds=Array.isArray(d.serviceIds)?[...new Set(d.serviceIds.filter((x):x is string=>typeof x==="string"&&services.has(x)))]:[];
 if(!Number.isFinite(startsAt.getTime())||startsAt.getTime()<Date.now()+30*60*1000||!Number.isInteger(durationMinutes)||durationMinutes<30||durationMinutes>120||!serviceIds.length)return NextResponse.json({error:"حدد موعداً بعد 30 دقيقة على الأقل، ومدة بين 30 و120 دقيقة، ومجال استشارة واحداً على الأقل."},{status:400});
 try{const db=await getClinicalDatabase();let providerUserId=actor.userId,providerName=actor.name;if(actor.role!=="consultant"&&typeof d.providerUserId==="string"){const provider=await db.collection("platform_users").findOne({userId:clean(d.providerUserId,100),role:"consultant",status:"active"},{projection:{_id:0,userId:1,name:1}});if(!provider)return NextResponse.json({error:"حساب مقدم الاستشارة غير موجود أو غير نشط."},{status:404});providerUserId=provider.userId;providerName=provider.name}await db.collection("platform_consultant_slots").createIndex({slotId:1},{unique:true});const slot={slotId:randomUUID(),providerUserId,providerName,serviceIds,startsAt,durationMinutes,status:"open",createdBy:actor.userId,createdAt:new Date()};await db.collection("platform_consultant_slots").insertOne(slot);await db.collection("platform_audit_logs").insertOne({action:"consultation_slot_created",actorUserId:actor.userId,slotId:slot.slotId,providerUserId,startsAt,createdAt:new Date()});return NextResponse.json({success:true,slot:{slotId:slot.slotId,providerName,serviceIds,startsAt,durationMinutes,status:"open"}},{status:201})}catch(error){console.error("consultant slot create",error);return NextResponse.json({error:"تعذر حفظ الموعد."},{status:503})}
}
export async function DELETE(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","consultant"]);if(!actor)return NextResponse.json({error:"غير مصرح بإدارة المواعيد."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الإلغاء غير صالحة."},{status:400})}
 const slotId=body&&typeof body==="object"&&!Array.isArray(body)?clean((body as Record<string,unknown>).slotId,80):"";
 if(!slotId)return NextResponse.json({error:"رقم الموعد مطلوب."},{status:400});
 try{const db=await getClinicalDatabase(),filter:Record<string,unknown>={slotId,status:"open"};if(actor.role==="consultant")filter.providerUserId=actor.userId;const result=await db.collection("platform_consultant_slots").updateOne(filter,{$set:{status:"cancelled",cancelledAt:new Date(),cancelledBy:actor.userId}});if(!result.matchedCount)return NextResponse.json({error:"الموعد غير موجود أو تم حجزه بالفعل."},{status:409});return NextResponse.json({success:true})}catch(error){console.error("consultant slot cancel",error);return NextResponse.json({error:"تعذر إلغاء الموعد."},{status:503})}
}