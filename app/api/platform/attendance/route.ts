import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
import {courses} from "@/lib/platform-catalog";
export const runtime="nodejs";
const managers=["admin","platform_manager","supervisor","trainer"] as const;
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,[...managers]);if(!actor)return NextResponse.json({error:"غير مصرح بإدارة الحضور."},{status:403});
 const courseId=clean(request.nextUrl.searchParams.get("courseId"),80),course=courses.find(c=>c.id===courseId);
 if(!course||course.mode==="recorded")return NextResponse.json({error:"اختر دورة مباشرة أو هجينة."},{status:400});
 try{const db=await getClinicalDatabase();const requests=await db.collection("platform_requests").find({kind:"classroom_registration",courseId,status:"approved"},{projection:{_id:0,email:1,name:1,requestId:1}}).toArray();const users=await db.collection("platform_users").find({email:{$in:requests.map(r=>r.email)}},{projection:{_id:0,userId:1,email:1,name:1}}).toArray();const attendance=await db.collection("platform_classroom_attendance").find({courseId},{projection:{_id:0,userId:1,status:1}}).toArray();const byEmail=new Map(users.map(u=>[u.email,u]));const byUser=new Map(attendance.map(a=>[a.userId,a]));const roster=requests.flatMap(r=>{const u=byEmail.get(r.email);return u?[{userId:u.userId,name:u.name||r.name,email:u.email,status:byUser.get(u.userId)?.status||"unmarked"}]:[]});return NextResponse.json({course:{id:course.id,title:course.title},roster},{headers:{"Cache-Control":"no-store"}})}catch(error){console.error("attendance roster",error);return NextResponse.json({error:"تعذر تحميل سجل الحضور."},{status:503})}
}
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,[...managers]);if(!actor)return NextResponse.json({error:"غير مصرح بإدارة الحضور."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الحضور غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الحضور مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,courseId=clean(d.courseId,80),userId=clean(d.userId,100),status=clean(d.status,20),course=courses.find(c=>c.id===courseId);
 if(!course||course.mode==="recorded"||!userId||!["attended","absent"].includes(status))return NextResponse.json({error:"الدورة أو المتدرب أو حالة الحضور غير صالحة."},{status:400});
 try{const db=await getClinicalDatabase();const user=await db.collection("platform_users").findOne({userId,status:"active"},{projection:{_id:0,userId:1,email:1,name:1}});if(!user)return NextResponse.json({error:"حساب المتدرب غير موجود أو غير نشط."},{status:404});const registration=await db.collection("platform_requests").findOne({kind:"classroom_registration",courseId,email:user.email,status:"approved"});if(!registration)return NextResponse.json({error:"لا يوجد طلب التحاق معتمد لهذا المتدرب في الدورة."},{status:409});const now=new Date();await db.collection("platform_classroom_attendance").createIndex({userId:1,courseId:1},{unique:true});await db.collection("platform_classroom_attendance").updateOne({userId,courseId},{$set:{userId,courseId,courseTitle:course.title,status,markedAt:now,markedBy:actor.userId,registrationId:registration.requestId},$setOnInsert:{createdAt:now}},{upsert:true});await db.collection("platform_audit_logs").insertOne({action:"classroom_attendance_marked",actorUserId:actor.userId,userId,courseId,status,createdAt:now});return NextResponse.json({success:true,userId,courseId,status,markedAt:now})}catch(error){console.error("attendance mark",error);return NextResponse.json({error:"تعذر حفظ الحضور."},{status:503})}
}