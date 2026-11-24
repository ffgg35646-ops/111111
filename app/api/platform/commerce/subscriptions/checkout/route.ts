import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
import {calculateCommercePrice} from "@/lib/platform-commerce";
import {defaultMembershipPlans} from "@/app/api/platform/commerce/plans/route";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,["trainee","trainer","consultant","supervisor","admin","platform_manager"]);if(!actor)return NextResponse.json({error:"سجّل الدخول إلى حساب اتزان قبل الاشتراك."},{status:401});
 const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"مصدر الطلب غير مسموح."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الاشتراك غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الاشتراك مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,planId=typeof d.planId==="string"?d.planId:"",period=d.billingPeriod==="annual"?"annual":"monthly",couponCode=typeof d.couponCode==="string"?d.couponCode.trim().toUpperCase():"";
 if(d.recurringConsent!==true)return NextResponse.json({error:"يلزم الموافقة الصريحة على التجديد التلقائي وقيمة الخصم وتاريخه."},{status:400});
 try{
  const db=await getClinicalDatabase(),saved=await db.collection("platform_membership_plans").findOne({planId,active:true}),plan=saved||defaultMembershipPlans.find(p=>p.planId===planId);
  if(!saved||saved.active!==true||!plan||Number(period==="annual"?plan.annualPrice:plan.monthlyPrice)<=0)return NextResponse.json({error:"لم تُفعّل الإدارة سعر هذه الباقة بعد."},{status:404});
  const existing=await db.collection("platform_subscriptions").findOne({userId:actor.userId,status:{$in:["active","pending_initial_payment","past_due"]}});
  if(existing)return NextResponse.json({error:"لديك عضوية قائمة بالفعل. راجع صفحة إدارة اشتراكك قبل إنشاء اشتراك جديد."},{status:409});
  const subtotal=Number(period==="annual"?plan.annualPrice:plan.monthlyPrice);
  const breakdown=await calculateCommercePrice(db,subtotal,"membership",couponCode);
  const requestId=randomUUID(),subscriptionId=randomUUID(),now=new Date();
  const order={requestId,kind:"membership",name:actor.name,email:actor.email,phone:"",status:"awaiting_payment",paymentStatus:"payment_due",quotedAmount:breakdown.totalAmount,subtotalAmount:breakdown.subtotalAmount,discountAmount:breakdown.discountAmount,taxAmount:breakdown.taxAmount,vatRateBps:breakdown.vatRateBps,pricesIncludeVat:breakdown.pricesIncludeVat,couponCode:breakdown.couponCode||"",planId,planName:plan.name,billingPeriod:period,recurringConsent:true,currency:"SAR",createdAt:now,source:"membership-checkout"};
  await db.collection("platform_requests").insertOne(order);
  await db.collection("platform_subscriptions").insertOne({subscriptionId,requestId,userId:actor.userId,email:actor.email,planId,planName:plan.name,billingPeriod:period,amount:Math.round(breakdown.totalAmount*100),currency:"SAR",subtotalAmount:breakdown.subtotalAmount,discountAmount:breakdown.discountAmount,taxAmount:breakdown.taxAmount,vatRateBps:breakdown.vatRateBps,pricesIncludeVat:breakdown.pricesIncludeVat,couponCode:breakdown.couponCode||"",name:actor.name,status:"pending_initial_payment",autoRenewEnabled:false,recurringConsent:true,createdAt:now,updatedAt:now});
  await db.collection("platform_audit_logs").insertOne({action:"membership_checkout_created",actorUserId:actor.userId,subscriptionId,requestId,planId,billingPeriod:period,amount:breakdown.totalAmount,createdAt:now});
  return NextResponse.json({success:true,requestId,email:actor.email,subscriptionId,amount:breakdown.totalAmount,currency:"SAR",breakdown,payUrl:"/pay-request?requestId="+encodeURIComponent(requestId)+"&email="+encodeURIComponent(actor.email)},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("ETZAN membership checkout",error);return NextResponse.json({error:error instanceof Error?error.message:"تعذر إنشاء الاشتراك."},{status:400})}
}
