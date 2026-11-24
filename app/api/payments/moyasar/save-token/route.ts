import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {encryptPlatformSecret} from "@/lib/platform-crypto";
export const runtime="nodejs";
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"مصدر الطلب غير مسموح."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات البطاقة المحفوظة غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات البطاقة مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,requestId=clean(d.requestId,60),paymentId=clean(d.paymentId,80),token=clean(d.token,250);
 if(!/^[0-9a-f-]{36}$/i.test(requestId)||!/^[0-9a-f-]{36}$/i.test(paymentId)||!/^token_[A-Za-z0-9]+$/.test(token))return NextResponse.json({error:"معرّفات عملية الدفع أو البطاقة غير صحيحة."},{status:400});
 const secret=process.env.MOYASAR_SECRET_KEY;if(!secret)return NextResponse.json({error:"التحقق من البطاقة غير مهيأ."},{status:503});
 try{
  const db=await getClinicalDatabase(),order=await db.collection("platform_requests").findOne({requestId,kind:"membership",recurringConsent:true,email:actor.email});
  if(!order)return NextResponse.json({error:"لا يوجد طلب عضوية يوافق على حفظ وسيلة الدفع لهذا الحساب."},{status:404});
  const response=await fetch("https://api.moyasar.com/v1/payments/"+encodeURIComponent(paymentId),{headers:{Authorization:"Basic "+Buffer.from(secret+":").toString("base64"),Accept:"application/json"},cache:"no-store"});
  const payment=await response.json().catch(()=>({})) as {id?:string;amount?:number;currency?:string;description?:string;source?:{token?:string;last_four?:string;company?:string};status?:string};
  const intent=payment.description?await db.collection("platform_payment_intents").findOne({requestId,description:payment.description}):null;
  if(!intent||!response.ok||payment.id!==paymentId||payment.amount!==intent.amount||payment.currency!=="SAR"||payment.source?.token!==token)return NextResponse.json({error:"لم تتطابق البطاقة مع عملية الدفع المسجلة لدى المزود."},{status:409});
  const saved=await db.collection("platform_subscriptions").updateOne({requestId,status:"pending_initial_payment",userId:actor.userId},{$set:{tokenEncrypted:encryptPlatformSecret(token),tokenLastFour:payment.source.last_four||"",tokenBrand:payment.source.company||"",tokenSavedAt:new Date(),tokenPaymentId:paymentId,updatedAt:new Date()}});
  if(!saved.matchedCount)return NextResponse.json({error:"الاشتراك لا يتبع حسابك أو تم تأكيده بالفعل."},{status:409});
  return NextResponse.json({success:true,saved:true},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("ETZAN membership token storage failed",error);return NextResponse.json({error:"تعذر حفظ وسيلة الدفع الآمنة."},{status:503})}
}
