import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
export const runtime = "nodejs";
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function GET(request:NextRequest){
 const requestId=clean(request.nextUrl.searchParams.get("requestId"),60),bookId=clean(request.nextUrl.searchParams.get("bookId"),60);
 if(!/^[0-9a-f-]{36}$/i.test(requestId)||!/^[0-9a-f-]{36}$/i.test(bookId))return NextResponse.json({error:"رابط التنزيل غير صالح."},{status:400});
 try{
  const db=await getClinicalDatabase();
  const order=await db.collection("platform_requests").findOne({requestId,kind:"book_order",status:"approved",paymentStatus:"paid"});
  if(!order||!Array.isArray(order.items)||!order.items.some((item:Record<string,unknown>)=>item.bookId===bookId))return NextResponse.json({error:"التنزيل متاح فقط بعد تأكيد دفع طلب يحتوي على هذا الكتاب."},{status:403});
  const book=await db.collection("etzan_books").findOne({bookId,published:true,productType:"digital"});
  if(!book||typeof book.downloadUrl!=="string")return NextResponse.json({error:"ملف الكتاب غير متاح حالياً."},{status:404});
  const source=new URL(book.downloadUrl);
  if(source.protocol!=="https:")return NextResponse.json({error:"مصدر الملف غير آمن."},{status:502});
  const upstream=await fetch(source.toString(),{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(25000)});
  if(!upstream.ok||!upstream.body)return NextResponse.json({error:"تعذر جلب ملف الكتاب من التخزين."},{status:502});
  const filename=(String(book.title||"ETZAN-book").replace(/[^\u0600-\u06FF\w -]/g,"").trim().slice(0,100)||"ETZAN-book")+".pdf";
  return new Response(upstream.body,{status:200,headers:{"Content-Type":upstream.headers.get("content-type")||"application/pdf","Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(filename),"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
 }catch(error){console.error("ETZAN protected book download",error);return NextResponse.json({error:"تعذر تجهيز تنزيل الكتاب."},{status:503});}
}
