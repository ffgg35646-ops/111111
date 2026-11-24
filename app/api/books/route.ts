import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";
const editors = ["admin", "platform_manager", "content_manager"] as const;
const categories = ["الخدمة الاجتماعية","علم النفس","الإرشاد الأسري","العلاج المعرفي السلوكي CBT","التوحد","الاضطرابات النمائية","القياس والتقييم","التدريب المهني","الصحة النفسية","مراجع عامة"];
const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0,max) : "";
const safeUrl = (v: unknown) => {
  const value = clean(v, 1500);
  if (!value) return "";
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? value : ""; }
  catch { return ""; }
};
function publicBook(book: Record<string, unknown>) {
  const { downloadUrl, ...visible } = book;
  return visible;
}
export async function GET(request: NextRequest) {
  const manage = request.nextUrl.searchParams.get("manage") === "1";
  if (manage && !(await requirePlatformRole(request, [...editors]))) return NextResponse.json({error:"لا تملك صلاحية إدارة المكتبة العلمية."},{status:403});
  try {
    const db = await getClinicalDatabase();
    const filter = manage ? {} : {published:true};
    const books = await db.collection("etzan_books").find(filter,{projection:{_id:0,...(manage?{}:{downloadUrl:0})}}).sort({updatedAt:-1}).limit(300).toArray();
    return NextResponse.json({books},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    console.error("ETZAN books catalog GET",error);
    return NextResponse.json({error:"تعذر تحميل المكتبة العلمية."},{status:503});
  }
}
export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request,[...editors]);
  if (!actor) return NextResponse.json({error:"لا تملك صلاحية إضافة الكتب."},{status:403});
  let body: unknown; try { body=await request.json(); } catch { return NextResponse.json({error:"بيانات الكتاب غير صالحة."},{status:400}); }
  if (!body || typeof body!=="object" || Array.isArray(body)) return NextResponse.json({error:"بيانات الكتاب مطلوبة."},{status:400});
  const d=body as Record<string,unknown>;
  const title=clean(d.title,180), author=clean(d.author,120), category=clean(d.category,80), description=clean(d.description,2000);
  const productType=d.productType==="physical"?"physical":"digital";
  const price=Number(d.price), stock=Number(d.stock??0);
  const coverUrl=safeUrl(d.coverUrl), previewUrl=safeUrl(d.previewUrl), downloadUrl=safeUrl(d.downloadUrl);
  if(title.length<3||description.length<20||!categories.includes(category)||!Number.isFinite(price)||price<0||price>1000000) return NextResponse.json({error:"تحقق من العنوان والوصف والتصنيف والسعر."},{status:400});
  if(productType==="physical"&&(!Number.isInteger(stock)||stock<0||stock>1000000)) return NextResponse.json({error:"كمية المخزون يجب أن تكون رقماً صحيحاً غير سالب."},{status:400});
  if((d.coverUrl&&!coverUrl)||(d.previewUrl&&!previewUrl)||(d.downloadUrl&&!downloadUrl)) return NextResponse.json({error:"روابط الملفات والصور يجب أن تكون HTTPS صحيحة."},{status:400});
  if(productType==="digital"&&!downloadUrl) return NextResponse.json({error:"أضف رابط ملف الكتاب الرقمي من مساحة تخزين موثوقة."},{status:400});
  const now=new Date();
  const book={bookId:randomUUID(),title,author,category,description,productType,format:clean(d.format,60)|| (productType==="digital"?"كتاب إلكتروني":"كتاب ورقي"),price,currency:"SAR",coverUrl,previewUrl,downloadUrl,rightsNote:clean(d.rightsNote,500)||"يُسمح بالاستخدام الشخصي وفق ترخيص الناشر، ولا يسمح بإعادة التوزيع.",stock:productType==="physical"?stock:0,reserved:0,sold:0,published:d.published===true,createdAt:now,updatedAt:now,createdBy:actor.userId};
  try {
    const db=await getClinicalDatabase();
    await db.collection("etzan_books").insertOne(book);
    await db.collection("platform_audit_logs").insertOne({action:"book_created",actorUserId:actor.userId,bookId:book.bookId,createdAt:now});
    return NextResponse.json({success:true,book:publicBook(book)},{status:201});
  } catch(error) { console.error("ETZAN book create",error); return NextResponse.json({error:"تعذر حفظ الكتاب."},{status:503}); }
}
export async function PATCH(request: NextRequest) {
  const actor=await requirePlatformRole(request,[...editors]);
  if(!actor)return NextResponse.json({error:"لا تملك صلاحية تعديل الكتب."},{status:403});
  let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات التعديل غير صالحة."},{status:400})}
  if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات التعديل مطلوبة."},{status:400});
  const d=body as Record<string,unknown>,bookId=clean(d.bookId,60);
  if(!bookId)return NextResponse.json({error:"معرّف الكتاب مطلوب."},{status:400});
  const set:Record<string,unknown>={updatedAt:new Date(),updatedBy:actor.userId};
  for(const key of ["title","author","description","format","rightsNote"] as const)if(typeof d[key]==="string")set[key]=clean(d[key],key==="description"?2000: key==="rightsNote"?500:180);
  if(typeof d.category==="string"){if(!categories.includes(d.category))return NextResponse.json({error:"التصنيف غير صالح."},{status:400});set.category=d.category;}
  if(d.productType==="digital"||d.productType==="physical")set.productType=d.productType;
  if(d.published!==undefined)set.published=d.published===true;
  if(d.price!==undefined){const price=Number(d.price);if(!Number.isFinite(price)||price<0||price>1000000)return NextResponse.json({error:"السعر غير صالح."},{status:400});set.price=price;}
  for(const key of ["coverUrl","previewUrl","downloadUrl"] as const)if(d[key]!==undefined){const url=safeUrl(d[key]);if(d[key]&&!url)return NextResponse.json({error:"الرابط يجب أن يكون HTTPS صحيحاً."},{status:400});set[key]=url;}
  if(d.stock!==undefined){const stock=Number(d.stock);if(!Number.isInteger(stock)||stock<0||stock>1000000)return NextResponse.json({error:"المخزون يجب أن يكون عدداً صحيحاً غير سالب."},{status:400});set.stock=stock;}
  try{
    const db=await getClinicalDatabase(),books=db.collection("etzan_books");
    const existing=await books.findOne({bookId});
    if(!existing)return NextResponse.json({error:"الكتاب غير موجود."},{status:404});
    if(existing.productType==="physical"&&typeof set.stock==="number"&&set.stock<(Number(existing.reserved)||0))return NextResponse.json({error:"لا يمكن جعل المخزون أقل من الكمية المحجوزة للطلبات غير المكتملة."},{status:409});
    if(set.productType==="digital"&&!existing.downloadUrl&&!set.downloadUrl)return NextResponse.json({error:"الكتاب الرقمي يحتاج رابط تنزيل."},{status:400});
    await books.updateOne({bookId},{$set:set});
    const updated=await books.findOne({bookId},{projection:{_id:0,downloadUrl:0}});
    return NextResponse.json({success:true,book:updated});
  }catch(error){console.error("ETZAN book update",error);return NextResponse.json({error:"تعذر تحديث الكتاب."},{status:503});}
}
