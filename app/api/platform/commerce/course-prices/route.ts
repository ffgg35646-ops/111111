import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
import {courses} from "@/lib/platform-catalog";
export const runtime="nodejs";
export async function GET(request:NextRequest){
 const manage=request.nextUrl.searchParams.get("manage")==="1";
 if(manage&&!(await requirePlatformRole(request,["admin","platform_manager","accountant"])))return NextResponse.json({error:"غير مصرح."},{status:403});
 try{const db=await getClinicalDatabase(),rows=await db.collection("etzan_course_prices").find({},{projection:{_id:0}}).toArray();
 return NextResponse.json({courses:courses.map(course=>{const price=rows.find((row)=>row.courseId===course.id);return {courseId:course.id,title:course.title,mode:course.mode,price:typeof price?.price==="number"?price.price:null,currency:"SAR",active:price?.active===true,updatedAt:price?.updatedAt||null}})},{headers:{"Cache-Control":"no-store"}})}
 catch(error){console.error("ETZAN course prices GET",error);return NextResponse.json({error:"تعذر تحميل أسعار الدورات."},{status:503})}
}
export async function PUT(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح بتعديل الأسعار."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات السعر غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات السعر مطلوبة."},{status:400});
 const data=body as Record<string,unknown>,courseId=typeof data.courseId==="string"?data.courseId.trim():"",course=courses.find(item=>item.id===courseId),price=Number(data.price);
 if(!course)return NextResponse.json({error:"الدورة غير موجودة."},{status:404});
 if(!Number.isFinite(price)||price<1||price>1000000)return NextResponse.json({error:"أدخل سعراً صحيحاً بين 1 و1,000,000 ريال."},{status:400});
 try{const db=await getClinicalDatabase(),now=new Date();await db.collection("etzan_course_prices").updateOne({courseId},{$set:{courseId,title:course.title,price:Math.round(price*100)/100,currency:"SAR",active:data.active===true,updatedAt:now,updatedBy:actor.userId},$setOnInsert:{createdAt:now}},{upsert:true});await db.collection("platform_audit_logs").insertOne({action:"course_price_updated",actorUserId:actor.userId,courseId,price,active:data.active===true,createdAt:now});return NextResponse.json({success:true})}
 catch(error){console.error("ETZAN course price PUT",error);return NextResponse.json({error:"تعذر حفظ سعر الدورة."},{status:503})}
}
