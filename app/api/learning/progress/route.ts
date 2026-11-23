import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
import {courses} from "@/lib/platform-catalog";
export const runtime="nodejs";
const allowed=["admin","platform_manager","supervisor","trainer","trainee"] as const;
function clean(v:unknown,n:number){return typeof v==="string"?v.trim().slice(0,n):"";}
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,[...allowed]);if(!actor)return NextResponse.json({error:"سجل الدخول لحفظ تقدم التعلم."},{status:401});
 const courseId=clean(request.nextUrl.searchParams.get("courseId"),80);if(!courses.some(c=>c.id===courseId))return NextResponse.json({error:"الدورة غير موجودة."},{status:404});
 try{const db=await getClinicalDatabase();const record=await db.collection("platform_course_progress").findOne({userId:actor.userId,courseId},{projection:{_id:0,completedLessons:1,reflection:1,quizAnswers:1,quizChecked:1,updatedAt:1}});return NextResponse.json(record||{completedLessons:[],reflection:"",quizAnswers:{},quizChecked:false},{headers:{"Cache-Control":"no-store"}});}
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
 try{const db=await getClinicalDatabase();await db.collection("platform_course_progress").updateOne({userId:actor.userId,courseId},{$set:{userId:actor.userId,courseId,courseTitle:course.title,completedLessons:completed,reflection,quizAnswers,quizChecked,updatedAt:now},$setOnInsert:{createdAt:now}},{upsert:true});return NextResponse.json({success:true,completedCount:completed.length,totalLessons:course.lessons.length,updatedAt:now});}
 catch(error){console.error("course progress POST",error);return NextResponse.json({error:"تعذر حفظ تقدم التعلم."},{status:503});}
}