import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { createZoomMeeting, deleteZoomMeeting, getZoomMeetingRecording } from "@/lib/zoom";
import { isTrainerCourseOwner } from "@/lib/platform-trainer";
export const runtime="nodejs";
const managers=["admin","platform_manager","supervisor","trainer"] as const;
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const canManage=(role:string)=>managers.includes(role as typeof managers[number]);
function sameOrigin(request:NextRequest){const origin=request.headers.get("origin");return !origin||origin===request.nextUrl.origin;}

export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,[...managers,"trainee"]);
 if(!actor)return NextResponse.json({error:"سجّل الدخول بحساب المنصة لعرض جلسات التدريب."},{status:401});
 try{
  const db=await getClinicalDatabase();
  const filter:Record<string,unknown>={status:{$ne:"cancelled"}};
  if(actor.role==="trainer") filter.createdBy=actor.userId;
  if(actor.role==="trainee"){
   const registrations=await db.collection("platform_requests").find(
    {email:actor.email.toLowerCase(),kind:"classroom_registration",status:"approved"},
    {projection:{_id:0,courseId:1}},
   ).toArray();
   const courseIds=[...new Set(registrations.map(r=>String(r.courseId||"")).filter(Boolean))];
   if(!courseIds.length)return NextResponse.json({sessions:[],canManage:false},{headers:{"Cache-Control":"no-store"}});
   filter.courseId={$in:courseIds};
  }
  const rows=await db.collection("platform_classroom_sessions").find(filter,{
   projection:{_id:0,sessionId:1,courseId:1,courseTitle:1,topic:1,startTime:1,durationMinutes:1,timezone:1,meetingId:1,joinUrl:1,hostStartUrl:1,recordingAllowed:1,recordingStatus:1,recordingUrl:1,status:1,createdAt:1},
  }).sort({startTime:1}).limit(150).toArray();
  const sessions=rows.map(row=>({
   sessionId:row.sessionId,courseId:row.courseId,courseTitle:row.courseTitle,topic:row.topic,
   startTime:row.startTime,durationMinutes:row.durationMinutes,timezone:row.timezone||"Africa/Cairo",
   status:row.status,recordingAllowed:row.recordingAllowed===true,joinUrl:row.joinUrl,
   ...(canManage(actor.role)?{hostStartUrl:row.hostStartUrl,recordingStatus:row.recordingStatus}:{}),
   ...(row.recordingAllowed===true&&row.recordingStatus==="published"&&typeof row.recordingUrl==="string"?{recordingUrl:row.recordingUrl}:{}),
  }));
  return NextResponse.json({sessions,canManage:canManage(actor.role)},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("classroom sessions GET",error);return NextResponse.json({error:"تعذر تحميل جلسات التدريب المباشر."},{status:503});}
}

export async function POST(request:NextRequest){
 if(!sameOrigin(request))return NextResponse.json({error:"مصدر الطلب غير صالح."},{status:403});
 const actor=await requirePlatformRole(request,[...managers]);
 if(!actor)return NextResponse.json({error:"جدولة الجلسات متاحة للإدارة والمدرب والمشرف فقط."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الجلسة غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الجلسة مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,courseId=clean(d.courseId,80),course=courses.find(item=>item.id===courseId);
 const topic=clean(d.topic,180)||(course?.title||"");
 const startTime=typeof d.startTime==="string"?new Date(d.startTime):new Date("");
 const durationMinutes=Number(d.durationMinutes),recordingAllowed=d.recordingAllowed===true;
 if(!course||course.mode==="recorded")return NextResponse.json({error:"اختر دورة مباشرة أو هجينة."},{status:400});
 if(!topic||!Number.isFinite(startTime.getTime())||startTime.getTime()<Date.now()+5*60*1000||!Number.isInteger(durationMinutes)||durationMinutes<15||durationMinutes>480)
  return NextResponse.json({error:"حدد عنوان الجلسة وموعداً بعد خمس دقائق على الأقل ومدة من 15 إلى 480 دقيقة."},{status:400});
 if(recordingAllowed&&d.recordingConsentConfirmed!==true)return NextResponse.json({error:"يلزم تأكيد إبلاغ المشاركين والحصول على موافقتهم قبل تفعيل التسجيل."},{status:400});
 try{
  const db=await getClinicalDatabase();
  if(actor.role==="trainer"&&!(await isTrainerCourseOwner(db,course.id,actor.userId)))return NextResponse.json({error:"لا يمكنك جدولة جلسة لدورة غير مسندة إلى حسابك."},{status:403});
  const meeting=await createZoomMeeting({topic,startTime,durationMinutes,recordingAllowed});
  const now=new Date(),session={
   sessionId:randomUUID(),provider:"zoom",meetingId:meeting.meetingId,courseId:course.id,courseTitle:course.title,topic,
   startTime,durationMinutes,timezone:process.env.ZOOM_TIMEZONE||"Africa/Cairo",joinUrl:meeting.joinUrl,hostStartUrl:meeting.hostStartUrl,
   recordingAllowed,recordingStatus:recordingAllowed?"awaiting_recording":"disabled",
   ...(recordingAllowed?{recordingConsentConfirmedAt:now,recordingConsentConfirmedBy:actor.userId}:{}),
   status:"scheduled",createdBy:actor.userId,createdAt:now,updatedAt:now,
  };
  await db.collection("platform_classroom_sessions").createIndex({sessionId:1},{unique:true});
  try{await db.collection("platform_classroom_sessions").insertOne(session);}
  catch(error){await deleteZoomMeeting(meeting.meetingId).catch(()=>{});throw error;}
  await db.collection("platform_audit_logs").insertOne({action:"classroom_session_created",actorUserId:actor.userId,sessionId:session.sessionId,courseId:course.id,recordingAllowed,createdAt:now});
  return NextResponse.json({success:true,session:{sessionId:session.sessionId,courseId:course.id,courseTitle:course.title,topic,startTime,durationMinutes,timezone:session.timezone,joinUrl:meeting.joinUrl,hostStartUrl:meeting.hostStartUrl,recordingAllowed,status:session.status}},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("classroom session creation failed",error);return NextResponse.json({error:"تعذر إنشاء جلسة Zoom. تحقق من إعدادات OAuth وصلاحية التسجيل السحابي وقاعدة البيانات."},{status:502});}
}

export async function PATCH(request:NextRequest){
 if(!sameOrigin(request))return NextResponse.json({error:"مصدر الطلب غير صالح."},{status:403});
 const actor=await requirePlatformRole(request,[...managers]);
 if(!actor)return NextResponse.json({error:"إدارة الجلسات متاحة للإدارة والمدرب والمشرف فقط."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات التحديث غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات التحديث مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,sessionId=clean(d.sessionId,80),action=clean(d.action,40);
 if(!sessionId||!["cancel","publish_recording"].includes(action))return NextResponse.json({error:"الجلسة أو الإجراء غير صالح."},{status:400});
 try{
  const db=await getClinicalDatabase(),collection=db.collection("platform_classroom_sessions"),session=await collection.findOne({sessionId});
  if(!session)return NextResponse.json({error:"الجلسة غير موجودة."},{status:404});
  if(actor.role==="trainer"&&session.createdBy!==actor.userId)return NextResponse.json({error:"لا يمكنك تعديل جلسة أنشأها مدرب آخر."},{status:403});
  if(action==="cancel"){
   if(session.status==="cancelled")return NextResponse.json({success:true,status:"cancelled"});
   try{await deleteZoomMeeting(String(session.meetingId||""));}
   catch(error){console.error("Zoom meeting cancellation failed",error);return NextResponse.json({error:"تعذر إلغاء اجتماع Zoom. لم تتغير حالة الجلسة."},{status:502});}
   await collection.updateOne({sessionId},{$set:{status:"cancelled",cancelledAt:new Date(),cancelledBy:actor.userId,updatedAt:new Date()}});
   await db.collection("platform_audit_logs").insertOne({action:"classroom_session_cancelled",actorUserId:actor.userId,sessionId,createdAt:new Date()});
   return NextResponse.json({success:true,status:"cancelled"});
  }
  if(session.recordingAllowed!==true)return NextResponse.json({error:"لم يتم السماح بتسجيل هذه المحاضرة عند إنشائها."},{status:403});
  const endsAt=new Date(session.startTime).getTime()+Number(session.durationMinutes||0)*60*1000;
  if(!Number.isFinite(endsAt)||Date.now()<endsAt+2*60*1000)return NextResponse.json({error:"يمكن جلب التسجيل بعد انتهاء المحاضرة ومعالجة Zoom للتسجيل."},{status:409});
  let recording:{recordingUrl:string};
  try{recording=await getZoomMeetingRecording(String(session.meetingId||""));}
  catch(error){console.error("Zoom recording retrieval failed",error);return NextResponse.json({error:"لم يتوفر تسجيل Zoom بعد. تحقق من تفعيل Cloud Recording وصلاحية recording:read ثم أعد المحاولة."},{status:502});}
  const now=new Date();
  await collection.updateOne({sessionId},{$set:{recordingUrl:recording.recordingUrl,recordingStatus:"published",recordingPublishedAt:now,recordingPublishedBy:actor.userId,status:"completed",updatedAt:now}});
  await db.collection("platform_audit_logs").insertOne({action:"classroom_recording_published",actorUserId:actor.userId,sessionId,createdAt:now});
  return NextResponse.json({success:true,recordingUrl:recording.recordingUrl,status:"published"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("classroom session PATCH",error);return NextResponse.json({error:"تعذر تحديث الجلسة."},{status:503});}
}
