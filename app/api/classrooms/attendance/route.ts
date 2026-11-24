import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
import {isTrainerCourseOwner} from "@/lib/platform-trainer";
export const runtime="nodejs";
const managers=["admin","platform_manager","supervisor","trainer"] as const;
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,[...managers]);if(!actor)return NextResponse.json({error:"إدارة الحضور متاحة للمدير أو المدرب أو المشرف."},{status:403});
 const sessionId=clean(request.nextUrl.searchParams.get("sessionId"),80);if(!sessionId)return NextResponse.json({error:"معرّف الجلسة مطلوب."},{status:400});
 try{
  const db=await getClinicalDatabase(),session=await db.collection("platform_classroom_sessions").findOne({sessionId},{projection:{_id:0,sessionId:1,courseId:1,courseTitle:1,topic:1,startTime:1,status:1}});
  if(!session)return NextResponse.json({error:"الجلسة غير موجودة."},{status:404});
  if(actor.role==="trainer"&&!(await isTrainerCourseOwner(db,String(session.courseId||""),actor.userId)))return NextResponse.json({error:"لا يمكنك عرض حضور دورة غير مسندة إلى حسابك."},{status:403});
  const registrations=await db.collection("platform_requests").find({kind:"classroom_registration",courseId:session.courseId,status:"approved",paymentStatus:"paid"},{projection:{_id:0,email:1,name:1,requestId:1}}).toArray();
  const emails=[...new Set(registrations.map(r=>String(r.email||"").toLowerCase()).filter(Boolean))];
  const users=emails.length?await db.collection("platform_users").find({email:{$in:emails},role:"trainee",status:"active"},{projection:{_id:0,userId:1,email:1,name:1}}).toArray():[];
  const attendance=await db.collection("platform_classroom_session_attendance").find({sessionId},{projection:{_id:0,userId:1,status:1,markedAt:1}}).toArray();
  const byEmail=new Map(users.map(u=>[String(u.email).toLowerCase(),u])),byUser=new Map(attendance.map(a=>[a.userId,a]));
  const roster=registrations.flatMap(r=>{const user=byEmail.get(String(r.email||"").toLowerCase());if(!user)return[];const entry=byUser.get(user.userId);return[{userId:user.userId,name:user.name||r.name,email:user.email,status:entry?.status||"unmarked",markedAt:entry?.markedAt||null}];});
  return NextResponse.json({session,roster},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("classroom attendance GET",error);return NextResponse.json({error:"تعذر تحميل كشف الحضور."},{status:503});}
}
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,[...managers]);if(!actor)return NextResponse.json({error:"إدارة الحضور متاحة للمدير أو المدرب أو المشرف."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الحضور غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الحضور مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,sessionId=clean(d.sessionId,80),userId=clean(d.userId,100),status=clean(d.status,20);
 if(!sessionId||!userId||!["attended","absent","late","excused"].includes(status))return NextResponse.json({error:"حدد الجلسة والمتدرب وحالة الحضور الصحيحة."},{status:400});
 try{
  const db=await getClinicalDatabase(),session=await db.collection("platform_classroom_sessions").findOne({sessionId,status:{$ne:"cancelled"}});
  if(!session)return NextResponse.json({error:"الجلسة غير موجودة أو ملغاة."},{status:404});
  if(actor.role==="trainer"&&!(await isTrainerCourseOwner(db,String(session.courseId||""),actor.userId)))return NextResponse.json({error:"لا يمكنك تسجيل حضور دورة غير مسندة إلى حسابك."},{status:403});
  const user=await db.collection("platform_users").findOne({userId,role:"trainee",status:"active"},{projection:{_id:0,userId:1,email:1,name:1}});
  if(!user)return NextResponse.json({error:"حساب المتدرب غير موجود أو غير نشط."},{status:404});
  const registration=await db.collection("platform_requests").findOne({kind:"classroom_registration",courseId:session.courseId,email:String(user.email).toLowerCase(),status:"approved",paymentStatus:"paid"});
  if(!registration)return NextResponse.json({error:"لا يوجد التحاق معتمد لهذا المتدرب بهذه الدورة."},{status:409});
  const now=new Date(),collection=db.collection("platform_classroom_session_attendance");
  await collection.createIndex({sessionId:1,userId:1},{unique:true});
  await collection.updateOne({sessionId,userId},{$set:{sessionId,userId,courseId:session.courseId,courseTitle:session.courseTitle,status,markedAt:now,markedBy:actor.userId,registrationId:registration.requestId},$setOnInsert:{createdAt:now}},{upsert:true});
  await db.collection("platform_audit_logs").insertOne({action:"classroom_session_attendance_marked",actorUserId:actor.userId,sessionId,userId,courseId:session.courseId,status,createdAt:now});
  return NextResponse.json({success:true,sessionId,userId,status,markedAt:now});
 }catch(error){console.error("classroom attendance POST",error);return NextResponse.json({error:"تعذر حفظ حالة الحضور."},{status:503});}
}
