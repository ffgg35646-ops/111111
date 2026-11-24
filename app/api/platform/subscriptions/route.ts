import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
export const runtime="nodejs";
const managers=["admin","platform_manager","accountant"] as const;
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","accountant","trainee","trainer","consultant","supervisor"]);
 if(!actor)return NextResponse.json({error:"سجّل الدخول لعرض الاشتراكات."},{status:401});
 const isManager=managers.includes(actor.role as typeof managers[number]);
 try{const db=await getClinicalDatabase(),filter=isManager?{}:{userId:actor.userId};const subscriptions=await db.collection("platform_subscriptions").find(filter,{projection:{_id:0,tokenEncrypted:0}}).sort({createdAt:-1}).limit(isManager?500:30).toArray();return NextResponse.json({subscriptions},{headers:{"Cache-Control":"no-store"}})}
 catch(error){console.error("ETZAN subscriptions GET",error);return NextResponse.json({error:"تعذر تحميل الاشتراكات."},{status:503})}
}
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","trainee","trainer","consultant","supervisor"]);
 if(!actor)return NextResponse.json({error:"غير مصرح."},{status:401});
 const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"مصدر الطلب غير مسموح."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الإلغاء غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"معرّف الاشتراك مطلوب."},{status:400});
 const subscriptionId=typeof (body as Record<string,unknown>).subscriptionId==="string"?(body as Record<string,unknown>).subscriptionId as string:"";
 if(!/^[0-9a-f-]{36}$/i.test(subscriptionId))return NextResponse.json({error:"معرّف الاشتراك غير صالح."},{status:400});
 try{const db=await getClinicalDatabase(),filter=actor.role==="admin"||actor.role==="platform_manager"?{subscriptionId}:{subscriptionId,userId:actor.userId};const result=await db.collection("platform_subscriptions").updateOne({...filter,status:{$in:["active","past_due","pending_initial_payment"]}},{$set:{autoRenewEnabled:false,status:"cancelled",cancelledAt:new Date(),cancelledBy:actor.userId,updatedAt:new Date(),recurringStatus:"cancelled"}});
 if(!result.modifiedCount)return NextResponse.json({error:"الاشتراك غير موجود أو تم إيقافه مسبقاً."},{status:404});
 await db.collection("platform_audit_logs").insertOne({action:"membership_auto_renew_cancelled",actorUserId:actor.userId,subscriptionId,createdAt:new Date()});return NextResponse.json({success:true,status:"cancelled",message:"تم إيقاف التجديد التلقائي. تظل المزايا المدفوعة متاحة حتى تاريخ انتهاء الفترة الحالية."})}
 catch(error){console.error("ETZAN subscription cancel",error);return NextResponse.json({error:"تعذر إيقاف التجديد."},{status:503})}
}
