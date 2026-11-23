import {timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
export const runtime="nodejs";
function safeEqual(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb)}
export async function POST(request:NextRequest){
 const secret=process.env.MOYASAR_WEBHOOK_SECRET;if(!secret)return NextResponse.json({error:"Webhook secret is not configured."},{status:503});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"Invalid event."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid event."},{status:400});
 const event=body as Record<string,unknown>,token=typeof event.secret_token==="string"?event.secret_token:request.headers.get("x-event-secret")||"";
 if(!safeEqual(token,secret))return NextResponse.json({error:"Unauthorized webhook."},{status:401});
 const eventId=typeof event.id==="string"?event.id:"",type=typeof event.type==="string"?event.type:"",data=event.data&&typeof event.data==="object"?event.data as Record<string,unknown>:{};
 if(type==="webhook_verification"){const verification=event.data&&typeof event.data==="object"?event.data as Record<string,unknown>:{};const code=typeof verification.verification_code==="string"?verification.verification_code:"";if(!/^\\d{6}$/.test(code))return NextResponse.json({error:"Webhook verification code is missing."},{status:400});try{const db=await getClinicalDatabase();await db.collection("platform_webhook_verifications").updateOne({provider:"moyasar"},{$set:{provider:"moyasar",webhookId:typeof verification.webhook_id==="string"?verification.webhook_id:"",verificationCode:code,receivedAt:new Date(),expiresAt:new Date(Date.now()+30*60*1000)}},{upsert:true});return NextResponse.json({received:true})}catch(error){console.error("Moyasar webhook verification event",error);return NextResponse.json({error:"Unable to save webhook verification code."},{status:503})}}
 const paymentId=typeof data.id==="string"?data.id:"";if(!eventId||!paymentId)return NextResponse.json({error:"Missing event/payment ID."},{status:400});
 const apiSecret=process.env.MOYASAR_SECRET_KEY;if(!apiSecret)return NextResponse.json({error:"Payment verification is not configured."},{status:503});
 try{
  const db=await getClinicalDatabase(),events=db.collection("platform_payment_events");await events.createIndex({eventId:1},{unique:true});
  const response=await fetch("https://api.moyasar.com/v1/payments/"+encodeURIComponent(paymentId),{headers:{Authorization:"Basic "+Buffer.from(apiSecret+":").toString("base64"),Accept:"application/json"},cache:"no-store"});
  const payment=await response.json().catch(()=>({})) as {id?:string;status?:string;amount?:number;currency?:string;description?:string};
  if(!response.ok||payment.id!==paymentId)return NextResponse.json({error:"Provider verification failed."},{status:502});
  const match=payment.description?.match(/^ETZAN Request ([0-9a-f-]{36})$/i);if(!match)return NextResponse.json({received:true,ignored:true});
  const requestId=match[1],intent=await db.collection("platform_payment_intents").findOne({requestId,intentId:{$exists:true}},{sort:{createdAt:-1}});
  if(!intent||payment.amount!==intent.amount||payment.currency!=="SAR")return NextResponse.json({error:"Payment does not match an approved intent."},{status:409});
  await db.collection("platform_payments").createIndex({providerPaymentId:1},{unique:true});
  await db.collection("platform_payments").updateOne({providerPaymentId:paymentId},{$set:{provider:"moyasar",providerPaymentId:paymentId,requestId,email:intent.email,amount:payment.amount,currency:payment.currency,status:payment.status,lastWebhookAt:new Date()},$setOnInsert:{createdAt:new Date()}},{upsert:true});
  if(type==="payment_paid"&&payment.status==="paid"){
   await db.collection("platform_payments").updateOne({providerPaymentId:paymentId},{$set:{status:"paid",paidAt:new Date()}},{upsert:true});
   await db.collection("platform_requests").updateOne({requestId,email:intent.email,paymentStatus:{$ne:"paid"}},{$set:{status:"approved",paymentStatus:"paid",paymentId,paidAt:new Date(),paymentProvider:"moyasar"}});
   await db.collection("platform_consultant_slots").updateOne({reservationId:requestId,status:"reserved"},{$set:{status:"booked",bookedAt:new Date(),paymentId}});
   await db.collection("platform_payment_intents").updateOne({intentId:intent.intentId},{$set:{status:"fulfilled",paymentId,paymentStatus:"paid"}});
  }else if(type==="payment_refunded"&&payment.status==="refunded"){
   await db.collection("platform_payments").updateOne({providerPaymentId:paymentId},{$set:{status:"refunded",refundedAt:new Date()}});
   await db.collection("platform_requests").updateOne({requestId,email:intent.email},{$set:{status:"refunded",paymentStatus:"refunded",refundedAt:new Date()}});
   await db.collection("platform_consultant_slots").updateOne({reservationId:requestId,status:"booked"},{$set:{status:"cancelled",cancelledAt:new Date(),cancellationReason:"payment_refunded"}});
  }else if((type==="payment_failed"||type==="payment_faild")&&payment.status==="failed"){
   await db.collection("platform_requests").updateOne({requestId,email:intent.email,paymentStatus:{$ne:"paid"}},{$set:{paymentStatus:"failed",paymentFailureAt:new Date()}});
   await db.collection("platform_payment_intents").updateOne({intentId:intent.intentId},{$set:{status:"failed",paymentStatus:"failed",paymentId}});
  }
  try{await events.insertOne({eventId,type,paymentId,receivedAt:new Date()})}catch(error){if((error as {code?:number}).code===11000)return NextResponse.json({received:true,duplicate:true});throw error}
  return NextResponse.json({received:true});
 }catch(error){console.error("Moyasar webhook processing failed",error);return NextResponse.json({error:"Webhook processing failed."},{status:503})}
}