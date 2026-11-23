import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","accountant"]);if(!actor)return NextResponse.json({error:"غير مصرح بتنفيذ الاسترداد."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الاسترداد غير صالحة."},{status:400})}
 const paymentId=body&&typeof body==="object"&&!Array.isArray(body)&&typeof (body as Record<string,unknown>).paymentId==="string"?(body as Record<string,unknown>).paymentId as string:"";
 if(!/^[0-9a-f-]{36}$/i.test(paymentId))return NextResponse.json({error:"رقم عملية الدفع غير صالح."},{status:400});
 const secret=process.env.MOYASAR_SECRET_KEY;if(!secret)return NextResponse.json({error:"بوابة الدفع غير مهيأة."},{status:503});
 try{
  const db=await getClinicalDatabase(),payments=db.collection("platform_payments"),payment=await payments.findOne({providerPaymentId:paymentId});
  if(!payment)return NextResponse.json({error:"عملية الدفع غير موجودة."},{status:404});
  if(!["paid","captured"].includes(String(payment.status)))return NextResponse.json({error:"لا يمكن استرداد العملية في حالتها الحالية."},{status:409});
  const lock=await payments.updateOne({providerPaymentId:paymentId,status:payment.status},{$set:{status:"refund_processing",refundRequestedAt:new Date(),refundRequestedBy:actor.userId}});
  if(!lock.modifiedCount)return NextResponse.json({error:"توجد عملية أخرى تعمل على استرداد هذه الدفعة."},{status:409});
  let response:Response;
  try{response=await fetch("https://api.moyasar.com/v1/payments/"+paymentId+"/refund",{method:"POST",headers:{Authorization:"Basic "+Buffer.from(secret+":").toString("base64"),Accept:"application/json","Content-Type":"application/json"},body:"{}",cache:"no-store"})}
  catch(error){console.error("Moyasar refund network outcome is uncertain",error);return NextResponse.json({error:"لم يصل رد حاسم من مزود الدفع. تم تعليق العملية للمراجعة لتجنب تكرار الاسترداد."},{status:503})}
  const result=await response.json().catch(()=>({})) as {id?:string;status?:string;refunded?:number;amount?:number;currency?:string;message?:string};
  if(!response.ok||result.id!==paymentId){await payments.updateOne({providerPaymentId:paymentId,status:"refund_processing"},{$set:{status:payment.status},$unset:{refundRequestedAt:"",refundRequestedBy:""}});return NextResponse.json({error:"رفض مزود الدفع طلب الاسترداد. راجع سجل العملية لدى Moyasar."},{status:502})}
  const refundedAmount=Number(result.refunded)||0,full=refundedAmount>=Number(payment.amount);
  await payments.updateOne({providerPaymentId:paymentId,status:"refund_processing"},{$set:{status:full?"refunded":"partially_refunded",refundedAmount,refundedAt:new Date(),refundProcessedBy:actor.userId}});
  if(full){
   await db.collection("platform_requests").updateOne({requestId:payment.requestId,email:payment.email},{$set:{status:"refunded",paymentStatus:"refunded",refundedAt:new Date()}});
   await db.collection("platform_consultant_slots").updateOne({reservationId:payment.requestId,status:"booked"},{$set:{status:"cancelled",cancelledAt:new Date(),cancellationReason:"payment_refunded"}});
  }
  await db.collection("platform_audit_logs").insertOne({action:"moyasar_payment_refunded",actorUserId:actor.userId,paymentId,refundedAmount,createdAt:new Date()});
  return NextResponse.json({success:true,status:full?"refunded":"partially_refunded",refundedAmount,currency:result.currency||"SAR"});
 }catch(error){console.error("Moyasar refund failed",error);return NextResponse.json({error:"تعذر تنفيذ الاسترداد حالياً."},{status:503})}
}
