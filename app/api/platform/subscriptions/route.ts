import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
import {decryptPlatformSecret} from "@/lib/platform-crypto";
export const runtime="nodejs";
const managers=["admin","platform_manager","accountant"] as const;
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","accountant","trainee","trainer","consultant","supervisor"]);
 if(!actor)return NextResponse.json({error:"سجّل الدخول لعرض الاشتراكات."},{status:401});
 const isManager=managers.includes(actor.role as typeof managers[number]);
 try{const db=await getClinicalDatabase(),now=new Date();await db.collection("platform_subscriptions").updateMany({status:"active",autoRenewEnabled:false,paidThrough:{$lte:now}},{$set:{status:"cancelled",recurringStatus:"expired",expiredAt:now,updatedAt:now},$unset:{activeSubscriptionUserId:""}});const filter=isManager?{}:{userId:actor.userId};const subscriptions=await db.collection("platform_subscriptions").find(filter,{projection:{_id:0,tokenEncrypted:0}}).sort({createdAt:-1}).limit(isManager?500:30).toArray();return NextResponse.json({subscriptions},{headers:{"Cache-Control":"no-store"}})}
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
 try{
  const db=await getClinicalDatabase();
  const filter=actor.role==="admin"||actor.role==="platform_manager"?{subscriptionId}:{subscriptionId,userId:actor.userId};
  const subscription=await db.collection("platform_subscriptions").findOne({...filter,status:{$in:["active","past_due","pending_initial_payment","renewal_processing"]}});
  if(!subscription)return NextResponse.json({error:"الاشتراك غير موجود أو تم إيقافه مسبقاً."},{status:404});
  let providerToken="";
  if(typeof subscription.tokenEncrypted==="string"){
   try{providerToken=decryptPlatformSecret(subscription.tokenEncrypted)}catch(error){console.error("Unable to decrypt token for cancellation",error)}
  }
  const remainsActive=subscription.status==="active"&&subscription.paidThrough instanceof Date&&subscription.paidThrough>new Date();
  const status=remainsActive?"active":"cancelled";
  const update=await db.collection("platform_subscriptions").updateOne(
   {...filter,status:subscription.status,autoRenewEnabled:subscription.autoRenewEnabled},
   {$set:{autoRenewEnabled:false,status,recurringStatus:"cancelled",cancelledAt:new Date(),cancelledBy:actor.userId,updatedAt:new Date()},$unset:{renewalLockUntil:"",activeSubscriptionUserId:""}},
  );
  if(!update.modifiedCount)return NextResponse.json({error:"تغيرت حالة الاشتراك أثناء الإلغاء. حدّث الصفحة."},{status:409});
  let tokenRevoked=false,tokenRevocationPending=false;
  if(providerToken&&process.env.MOYASAR_SECRET_KEY){
   try{
    const response=await fetch("https://api.moyasar.com/v1/tokens/"+encodeURIComponent(providerToken),{method:"DELETE",headers:{Authorization:"Basic "+Buffer.from(process.env.MOYASAR_SECRET_KEY+":").toString("base64"),Accept:"application/json"},cache:"no-store"});
    tokenRevoked=response.status===204||response.ok;
    tokenRevocationPending=!tokenRevoked;
    if(tokenRevoked)await db.collection("platform_subscriptions").updateOne({subscriptionId},{$unset:{tokenEncrypted:""},$set:{tokenRevokedAt:new Date()}});
   }catch(error){console.error("Moyasar token revocation failed",error);tokenRevocationPending=true;}
  }
  await db.collection("platform_audit_logs").insertOne({action:"membership_auto_renew_cancelled",actorUserId:actor.userId,subscriptionId,tokenRevoked,createdAt:new Date()});
  return NextResponse.json({success:true,status,autoRenewEnabled:false,paidThrough:subscription.paidThrough||null,tokenRevoked,tokenRevocationPending,message:remainsActive?"تم إيقاف التجديد التلقائي، وتظل مزايا العضوية متاحة حتى نهاية الفترة المدفوعة.":"تم إيقاف الاشتراك والتجديد."},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("ETZAN subscription cancel",error);return NextResponse.json({error:"تعذر إيقاف التجديد."},{status:503})}
}
