import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
export const runtime="nodejs";
export async function GET(request:NextRequest){const actor=await requirePlatformRole(request,["admin","platform_manager","accountant"]);if(!actor)return NextResponse.json({error:"غير مصرح بعرض سجل المدفوعات."},{status:403});try{const db=await getClinicalDatabase();const payments=await db.collection("platform_payments").find({},{projection:{_id:0,providerPaymentId:1,requestId:1,subscriptionId:1,invoiceId:1,email:1,amount:1,currency:1,status:1,fee:1,paymentMethod:1,paidAt:1,refundedAmount:1,refundedAt:1,createdAt:1}}).sort({createdAt:-1}).limit(500).toArray();return NextResponse.json({payments},{headers:{"Cache-Control":"no-store"}})}catch(error){console.error("payments ledger GET",error);return NextResponse.json({error:"تعذر تحميل سجل المدفوعات."},{status:503})}}
