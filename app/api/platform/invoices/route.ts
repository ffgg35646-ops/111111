import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
export const runtime="nodejs";
const managers=["admin","platform_manager","accountant"] as const;
export async function GET(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager","accountant","trainee","trainer","consultant","supervisor"]);
 if(!actor)return NextResponse.json({error:"سجّل الدخول لعرض الفواتير."},{status:401});
 const id=request.nextUrl.searchParams.get("id")||"",all=managers.includes(actor.role as typeof managers[number]);
 if(id&&!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"رقم الفاتورة غير صالح."},{status:400});
 try{const db=await getClinicalDatabase();if(id){const invoice=await db.collection("platform_invoices").findOne({invoiceId:id},{projection:{_id:0}});if(!invoice)return NextResponse.json({error:"الفاتورة غير موجودة."},{status:404});if(!all&&invoice.customerEmail!==actor.email)return NextResponse.json({error:"لا تملك صلاحية عرض هذه الفاتورة."},{status:403});return NextResponse.json({invoice},{headers:{"Cache-Control":"private, no-store"}})}
 if(!all)return NextResponse.json({error:"عرض كل الفواتير يتطلب صلاحية مالية."},{status:403});
 const invoices=await db.collection("platform_invoices").find({},{projection:{_id:0,tokenEncrypted:0}}).sort({issuedAt:-1}).limit(500).toArray();
 return NextResponse.json({invoices},{headers:{"Cache-Control":"no-store"}})}
 catch(error){console.error("ETZAN invoices GET",error);return NextResponse.json({error:"تعذر تحميل الفواتير."},{status:503})}
}
