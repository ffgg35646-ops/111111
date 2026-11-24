import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {decryptPlatformSecret} from "@/lib/platform-crypto";
import {createElectronicInvoice,settleRecurringPayment} from "@/lib/platform-commerce";
export const runtime="nodejs";
export async function GET(request:NextRequest){return POST(request)}
export async function POST(request:NextRequest){
 const cronSecret=process.env.CRON_SECRET,authorization=request.headers.get("authorization")||"";
 if(!cronSecret||authorization!=="Bearer "+cronSecret)return NextResponse.json({error:"غير مصرح."},{status:401});
 const secret=process.env.MOYASAR_SECRET_KEY,publishable=process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY;
 if(!secret||!publishable)return NextResponse.json({error:"إعدادات Moyasar غير مكتملة."},{status:503});
 try{
  const db=await getClinicalDatabase(),now=new Date(),rows=await db.collection("platform_subscriptions").find({status:{$in:["active","past_due"]},autoRenewEnabled:true,nextBillingAt:{$lte:now},tokenEncrypted:{$type:"string"},$or:[{renewalLockUntil:{$exists:false}},{renewalLockUntil:{$lt:now}}]}).sort({nextBillingAt:1}).limit(25).toArray();
  const results:Record<string,string>[]=[];
  for(const subscription of rows){
   const subscriptionId=String(subscription.subscriptionId||"");if(!subscriptionId)continue;
   const chargeId=randomUUID(),lockUntil=new Date(Date.now()+45*60*1000);
   const claim=await db.collection("platform_subscriptions").updateOne({subscriptionId,status:{$in:["active","past_due"]},autoRenewEnabled:true,nextBillingAt:{$lte:now},$or:[{renewalLockUntil:{$exists:false}},{renewalLockUntil:{$lt:now}}]},{$set:{renewalLockUntil:lockUntil,currentChargeId:chargeId,updatedAt:new Date()}});
   if(!claim.modifiedCount)continue;
   try{
    const token=decryptPlatformSecret(String(subscription.tokenEncrypted));
    const tokenResponse=await fetch("https://api.moyasar.com/v1/tokens/"+encodeURIComponent(token),{headers:{Authorization:"Basic "+Buffer.from(secret+":").toString("base64"),Accept:"application/json"},cache:"no-store"});
    const tokenInfo=await tokenResponse.json().catch(()=>({})) as {status?:string};
    if(!tokenResponse.ok||tokenInfo.status!=="active")throw new Error("saved_token_inactive");
    const callback=new URL("/membership",process.env.NEXT_PUBLIC_APP_URL||request.nextUrl.origin);callback.searchParams.set("renewal",subscriptionId);
    const amount=Number(subscription.amount);if(!Number.isInteger(amount)||amount<100)throw new Error("invalid_subscription_amount");
    const response=await fetch("https://api.moyasar.com/v1/payments",{method:"POST",headers:{Authorization:"Basic "+Buffer.from(publishable+":").toString("base64"),"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({given_id:chargeId,amount,currency:"SAR",description:"ETZAN Subscription "+subscriptionId+" "+chargeId,callback_url:callback.toString(),source:{type:"token",token}}),cache:"no-store"});
    const payment=await response.json().catch(()=>({})) as {id?:string;status?:string;amount?:number;currency?:string;fee?:number;source?:{company?:string;type?:string};description?:string};
    if(!response.ok||!payment.id||payment.amount!==amount||payment.currency!=="SAR"||payment.description!=="ETZAN Subscription "+subscriptionId+" "+chargeId)throw new Error("moyasar_charge_failed_or_mismatched");
    await db.collection("platform_payments").updateOne({providerPaymentId:payment.id},{$set:{provider:"moyasar",providerPaymentId:payment.id,subscriptionId,requestId:String(subscription.requestId||""),email:String(subscription.email||""),amount:payment.amount,currency:payment.currency,status:payment.status,fee:payment.fee??null,paymentMethod:payment.source?.company||payment.source?.type||"saved_card",lastVerifiedAt:new Date()},$setOnInsert:{createdAt:new Date()}},{upsert:true});
    if(payment.status==="paid"){
     await settleRecurringPayment(db,{...payment,id:payment.id,status:payment.status,amount:Number(payment.amount),currency:String(payment.currency),fee:payment.fee,description:payment.description});
     await db.collection("platform_payments").updateOne({providerPaymentId:payment.id},{$set:{status:"paid",paidAt:new Date()}});
     const invoiceId=await createElectronicInvoice(db,{requestId:subscription.requestId,name:subscription.name||"",email:subscription.email||"",planName:subscription.planName||"عضوية اتزان",billingPeriod:subscription.billingPeriod,subtotalAmount:subscription.subtotalAmount??amount/100,discountAmount:subscription.discountAmount||0,taxAmount:subscription.taxAmount||0,vatRateBps:subscription.vatRateBps||0,quotedAmount:amount/100,kind:"membership"},{providerPaymentId:payment.id,amount:payment.amount,currency:payment.currency,fee:payment.fee,paymentMethod:payment.source?.company||payment.source?.type||"saved_card",paidAt:new Date()});
     await db.collection("platform_payments").updateOne({providerPaymentId:payment.id},{$set:{invoiceId}});
    }else if(payment.status==="failed"){
     await settleRecurringPayment(db,{...payment,id:payment.id,status:payment.status,amount:Number(payment.amount),currency:String(payment.currency),fee:payment.fee,description:payment.description});
     await db.collection("platform_payments").updateOne({providerPaymentId:payment.id},{$set:{status:"failed"}});
    }else{
     await db.collection("platform_subscriptions").updateOne({subscriptionId,currentChargeId:chargeId},{$set:{status:"renewal_processing",recurringStatus:"awaiting_provider_confirmation",renewalPaymentId:payment.id,renewalLockUntil:new Date(Date.now()+60*60*1000)}});
    }
    results.push({subscriptionId,status:String(payment.status||"unknown")});
   }catch(error){
    console.error("ETZAN recurring charge attempt failed",subscriptionId,error);
    const attempts=Number(subscription.renewalAttempts||0)+1;
    await db.collection("platform_subscriptions").updateOne({subscriptionId,currentChargeId:chargeId},{$set:{status:"past_due",renewalAttempts:attempts,lastFailureAt:new Date(),nextBillingAt:new Date(Date.now()+(attempts>=3?7:1)*24*60*60*1000),autoRenewEnabled:attempts<3,recurringStatus:attempts>=3?"retry_limit_reached":"payment_failed"},$unset:{renewalLockUntil:""}});
    results.push({subscriptionId,status:"past_due"});
   }
  }
  return NextResponse.json({processed:results.length,results},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("ETZAN subscriptions cron",error);return NextResponse.json({error:"تعذر معالجة التجديدات."},{status:503})}
}
