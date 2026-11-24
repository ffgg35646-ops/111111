import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {finalizePaidBookInventory} from "@/lib/book-orders";
import {sendConsultationNotice} from "@/lib/consultation-notifications";
export const runtime="nodejs";
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function GET(request:NextRequest){
 const paymentId=clean(request.nextUrl.searchParams.get("id"),80),requestId=clean(request.nextUrl.searchParams.get("requestId"),60);
 if(!/^[0-9a-f-]{36}$/i.test(paymentId)||!/^[0-9a-f-]{36}$/i.test(requestId))return NextResponse.json({error:"بيانات التحقق غير مكتملة."},{status:400});
 const secret=process.env.MOYASAR_SECRET_KEY;if(!secret)return NextResponse.json({error:"التحقق من الدفع غير مهيأ."},{status:503});
 try{
  const db=await getClinicalDatabase(),order=await db.collection("platform_requests").findOne({requestId});
  if(!order)return NextResponse.json({error:"الطلب غير موجود."},{status:404});
  if(order.paymentStatus==="paid"){if(order.paymentId!==paymentId)return NextResponse.json({error:"الطلب مدفوع بالفعل، لكن رقم العملية لا يطابق السجل."},{status:409});if(order.kind==="book_order")await finalizePaidBookInventory(db,requestId);return NextResponse.json({success:true,paid:true,status:order.status,requestId,kind:order.kind,items:order.kind==="book_order"?order.items:undefined,zoomMeeting:order.kind==="consultation"?order.zoomMeeting:undefined});}
  const intent=await db.collection("platform_payment_intents").findOne({requestId, ...(typeof order.email==="string"?{email:order.email}:{})},{sort:{createdAt:-1}});
  if(!intent)return NextResponse.json({error:"لا توجد عملية دفع صادرة لهذا الطلب."},{status:404});
  const response=await fetch("https://api.moyasar.com/v1/payments/"+encodeURIComponent(paymentId),{headers:{Authorization:"Basic "+Buffer.from(secret+":").toString("base64"),Accept:"application/json"},cache:"no-store"});
  const payment=await response.json().catch(()=>({})) as {id?:string;status?:string;amount?:number;currency?:string;description?:string;fee?:number;source?:{company?:string;type?:string;number?:string}};
  if(!response.ok||payment.id!==paymentId)return NextResponse.json({error:"لم يمكن التحقق من العملية لدى مزود الدفع."},{status:502});
  if(payment.description!==intent.description||payment.amount!==intent.amount||payment.currency!=="SAR")return NextResponse.json({error:"بيانات العملية لا تطابق قيمة الطلب المعتمدة."},{status:409});
  await db.collection("platform_payment_intents").updateOne({intentId:intent.intentId},{$set:{paymentId,paymentStatus:payment.status,status:payment.status==="failed"?"failed":"fulfilled",verifiedAt:new Date()},$unset:{clientSecretEncrypted:""}});
  await db.collection("platform_payments").createIndex({providerPaymentId:1},{unique:true});
  await db.collection("platform_payments").updateOne({providerPaymentId:paymentId},{$set:{provider:"moyasar",providerPaymentId:paymentId,requestId,email:intent.email,amount:payment.amount,currency:payment.currency,status:payment.status,fee:payment.fee??null,paymentMethod:payment.source?.company||payment.source?.type||"unknown",lastVerifiedAt:new Date()},$setOnInsert:{createdAt:new Date()}},{upsert:true});
  if(payment.status!=="paid"){if(payment.status==="failed")await db.collection("platform_requests").updateOne({requestId,email:intent.email,paymentStatus:{$ne:"paid"}},{$set:{paymentStatus:"failed",paymentFailureAt:new Date()}});return NextResponse.json({success:true,paid:false,paymentStatus:payment.status,message:payment.status==="initiated"?"العملية تنتظر إكمال التحقق البنكي.":"لم يتم تأكيد الدفع."});}
  await db.collection("platform_payments").updateOne({providerPaymentId:paymentId},{$set:{status:"paid",paidAt:new Date()} });
  await db.collection("platform_requests").updateOne({requestId,email:intent.email,paymentStatus:{$ne:"paid"}},{$set:{status:"approved",paymentStatus:"paid",paymentId,paidAt:new Date(),paymentProvider:"moyasar"}});
  await db.collection("platform_consultant_slots").updateOne({reservationId:requestId,status:"reserved"},{$set:{status:"booked",bookedAt:new Date(),paymentId}});
  await db.collection("platform_payment_intents").updateOne({intentId:intent.intentId},{$set:{status:"fulfilled"}});
  if(order.kind==="book_order") await finalizePaidBookInventory(db,requestId);
  if(order.kind==="consultation") {
   const meetingUrl=typeof order.zoomMeeting?.joinUrl==="string"?order.zoomMeeting.joinUrl:"";
   await sendConsultationNotice(db,{
    requestId,email:intent.email,recipientName:String(order.name||"عميل اتزان"),
    subject:"تم تأكيد حجز الاستشارة والدفع - اتزان",
    message:"تم تأكيد الدفع المسبق وحجز موعدك المرئي بتاريخ "+(order.preferredAt instanceof Date?order.preferredAt.toLocaleString("ar-SA"):"الموعد المحدد")+". "+(meetingUrl?"رابط الدخول إلى الجلسة: "+meetingUrl:"سيظهر رابط الجلسة في صفحة متابعة الموعد بعد استكمال إعداد الاجتماع.")+" رقم الطلب: "+requestId,
    actionUrl:new URL("/my-consultations?requestId="+encodeURIComponent(requestId)+"&email="+encodeURIComponent(intent.email),request.nextUrl.origin).toString(),
   });
  }
  await db.collection("platform_audit_logs").insertOne({action:"moyasar_payment_verified",requestId,paymentId,amount:payment.amount,currency:payment.currency,createdAt:new Date()});
  return NextResponse.json({success:true,paid:true,status:"approved",requestId,kind:order.kind,items:order.kind==="book_order"?order.items:undefined,zoomMeeting:order.kind==="consultation"?order.zoomMeeting:undefined},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("Moyasar payment verification failed",error);return NextResponse.json({error:"تعذر إكمال التحقق من الدفع."},{status:503})}
}