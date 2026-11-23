import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {getClinicalDatabase} from "@/lib/mongodb";
export const runtime="nodejs";
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"مصدر الطلب غير مسموح."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الدفع غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الدفع مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,requestId=clean(d.requestId,60),email=clean(d.email,180).toLowerCase();
 if(!/^[0-9a-f-]{36}$/i.test(requestId)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:"رقم الطلب أو البريد الإلكتروني غير صالح."},{status:400});
 const secret=process.env.MOYASAR_SECRET_KEY,publishable=process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY;
 if(!secret||!publishable)return NextResponse.json({error:"بوابة الدفع غير مهيأة. أضف مفاتيح Moyasar الاختبارية إلى إعدادات الخادم أولاً."},{status:503});
 try{
  const db=await getClinicalDatabase(),order=await db.collection("platform_requests").findOne({requestId,email});
  if(!order)return NextResponse.json({error:"الطلب غير موجود."},{status:404});
  if(order.paymentStatus==="paid")return NextResponse.json({error:"تم دفع هذا الطلب بالفعل."},{status:409});
  if(order.status!=="awaiting_payment"||!["payment_due","payment_initiated"].includes(String(order.paymentStatus))||order.currency!=="SAR"||typeof order.quotedAmount!=="number")return NextResponse.json({error:"الطلب لم يعتمد بعد أو لا يحتوي على سعر قابل للدفع."},{status:409});
  const amount=Math.round(order.quotedAmount*100);if(amount<100||amount>100000000)return NextResponse.json({error:"قيمة الطلب خارج حدود الدفع."},{status:400});
  const intents=db.collection("platform_payment_intents");
  const existing=await intents.findOne({requestId,email,status:"created",expiresAt:{$gt:new Date()}},{sort:{createdAt:-1}});
  if(existing&&typeof existing.clientSecret==="string")return NextResponse.json({id:existing.intentId,clientSecret:existing.clientSecret,amount,currency:"SAR",description:existing.description,publishableApiKey:publishable,callbackUrl:existing.callbackUrl});
  const description="ETZAN Request "+requestId;
  const callback=new URL("/payment-result",request.nextUrl.origin);callback.searchParams.set("requestId",requestId);
  const response=await fetch("https://api.moyasar.com/v1/payment_intents",{method:"POST",headers:{Authorization:"Basic "+Buffer.from(secret+":").toString("base64"),"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({amount,currency:"SAR",description,callback_url:callback.toString()}),cache:"no-store"});
  const payload=await response.json().catch(()=>({})) as {id?:string;client_secret?:string;expires_at?:string;message?:string};
  if(!response.ok||!payload.id||!payload.client_secret){console.error("Moyasar intent creation failed",response.status,payload.message||"unknown");return NextResponse.json({error:"تعذر إنشاء عملية الدفع. تحقق من مفاتيح Moyasar وحالة حساب التاجر."},{status:502})}
  const expiresAt=payload.expires_at?new Date(payload.expires_at):new Date(Date.now()+60*60*1000);
  await intents.insertOne({intentId:payload.id,clientSecret:payload.client_secret,requestId,email,amount,currency:"SAR",description,callbackUrl:callback.toString(),status:"created",expiresAt,createdAt:new Date()});
  await db.collection("platform_requests").updateOne({requestId,email,status:"awaiting_payment",paymentStatus:"payment_due"},{$set:{paymentStatus:"payment_initiated",paymentIntentId:payload.id,paymentInitiatedAt:new Date()}});
  return NextResponse.json({id:payload.id,clientSecret:payload.client_secret,amount,currency:"SAR",description,publishableApiKey:publishable,callbackUrl:callback.toString()},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Moyasar payment intent error",error);return NextResponse.json({error:"تعذر تجهيز الدفع حالياً."},{status:503})}
}