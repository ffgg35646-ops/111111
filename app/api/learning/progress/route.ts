import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
import {courses} from "@/lib/platform-catalog";
export const runtime="nodejs";
const allowed=["admin","platform_manager","supervisor","trainer","trainee"] as const;
function clean(v:unknown,n:number){return typeof v==="string"?v.trim().slice(0,n):"";}
async function hasCourseAccess(db:Awaited<ReturnType<typeof getClinicalDatabase>>,actor:Awaited<ReturnType<typeof requirePlatformRole>> extends infer T?NonNullable<T>:never,courseId:string){if(actor.role!=="trainee")return true;const enrollment=await db.collection("platform_requests").findOne({kind:"course_enrollment",courseId,email:actor.email,status:"approved",paymentStatus:"paid"},{projection:{_id:1}});return Boolean(enrollment)}
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,[...allowed]);if(!actor)return NextResponse.json({error:"سجل الدخول لحفظ تقدم التعلم."},{status:401});
 const courseId=clean(request.nextUrl.searchParams.get("courseId"),80);if(!courses.some(c=>c.id===courseId))return NextResponse.json({error:"الدورة غير موجودة."},{status:404});
 try{const db=await getClinicalDatabase();if(!(await hasCourseAccess(db,actor,courseId)))return NextResponse.json({error:"يلزم اعتماد الالتحاق وسداد رسوم الدورة قبل فتح محتواها.",code:"payment_required"},{status:402});const record=await db.collection("platform_course_progress").findOne({userId:actor.userId,courseId},{projection:{_id:0,completedLessons:1,reflection:1,quizAnswers:1,quizChecked:1,updatedAt:1}});return NextResponse.json(record||{completedLessons:[],reflection:"",quizAnswers:{},quizChecked:false},{headers:{"Cache-Control":"no-store"}});}
 catch(error){console.error("course progress GET",error);return NextResponse.json({error:"تعذر تحميل تقدم التعلم."},{status:503});}
}
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,[...allowed]);if(!actor)return NextResponse.json({error:"سجل الدخول لحفظ تقدم التعلم."},{status:401});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات التقدم غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات التقدم مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,courseId=clean(d.courseId,80),course=courses.find(c=>c.id===courseId);
 if(!course)return NextResponse.json({error:"الدورة غير موجودة."},{status:404});
 const completed=Array.isArray(d.completedLessons)?[...new Set(d.completedLessons.filter((n):n is number=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<course.lessons.length))]:[];
 const reflection=clean(d.reflection,3000);
 const rawAnswers=d.quizAnswers&&typeof d.quizAnswers==="object"&&!Array.isArray(d.quizAnswers)?d.quizAnswers as Record<string,unknown>:{};
 const quizAnswers=Object.fromEntries(Object.entries(rawAnswers).filter(([key,value])=>/^\d{1,2}$/.test(key)&&Number.isInteger(value)&&Number(value)>=0&&Number(value)<=5).slice(0,20));
 const quizChecked=d.quizChecked===true;
 const now=new Date();
 try{
 const db=await getClinicalDatabase();
 if(!(await hasCourseAccess(db,actor,courseId)))return NextResponse.json({error:"يلزم اعتماد الالتحاق وسداد رسوم الدورة قبل حفظ تقدمها.",code:"payment_required"},{status:402});
 await db.collection("platform_course_progress").updateOne({userId:actor.userId,courseId},{$set:{userId:actor.userId,courseId,courseTitle:course.title,completedLessons:completed,reflection,quizAnswers,quizChecked,updatedAt:now},$setOnInsert:{createdAt:now}},{upsert:true});
 const correctByTrack:Record<string,number[]>={"social-work":[1,0,1],"cbt":[0,1,1],"autism":[1,0,1],"developmental":[1,0,0],"mental-health":[0,1,1]};
 const correct=correctByTrack[course.trackId]||correctByTrack["mental-health"];
 const score=correct.reduce((total,answer,index)=>total+(quizAnswers[String(index)]===answer?1:0),0);
 const quizPassed=quizChecked&&score>=2;
 let attendanceVerified=course.mode==="recorded";
 if(actor.role==="trainee"&&completed.length===course.lessons.length&&quizPassed&&course.mode!=="recorded"){
  const attendance=await db.collection("platform_classroom_attendance").findOne({userId:actor.userId,courseId,status:"attended"});
  attendanceVerified=Boolean(attendance);
 }
 let certificate:Record<string,unknown>|null=null;
 if(actor.role==="trainee"&&completed.length===course.lessons.length&&quizPassed&&attendanceVerified){
  const serial=randomUUID().toUpperCase(),certificates=db.collection("platform_certificates");
  await certificates.createIndex({userId:1,courseId:1},{unique:true,partialFilterExpression:{userId:{$type:"string"},courseId:{$type:"string"}}});
  await certificates.updateOne({userId:actor.userId,courseId},{$setOnInsert:{serial,userId:actor.userId,learnerName:actor.name,courseId,courseTitle:course.title,certificateType:"completion",issuedAt:now,status:"issued",issuedBy:"system-course-completion",completionVerified:true,quizScore:score,quizTotal:correct.length,attendanceVerified,createdAt:now}},{upsert:true});
  certificate=await certificates.findOne({userId:actor.userId,courseId},{projection:{_id:0,serial:1,courseTitle:1,issuedAt:1,status:1}});
 }
 return NextResponse.json({success:true,completedCount:completed.length,totalLessons:course.lessons.length,quizScore:score,quizTotal:correct.length,quizPassed,attendanceVerified,certificate,updatedAt:now});
}
 catch(error){console.error("course progress POST",error);return NextResponse.json({error:"تعذر حفظ تقدم التعلم."},{status:503});}
}