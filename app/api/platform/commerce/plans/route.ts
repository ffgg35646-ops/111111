import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
export const runtime="nodejs";
export const defaultMembershipPlans=[
 {planId:"learner",name:"عضوية المتعلم",description:"مسار تعلّم منظم ومتابعة التقدم والشهادات.",monthlyPrice:99,annualPrice:990,features:["الوصول إلى البرامج المتاحة حسب الاشتراك","متابعة تقدم التعلم","سجل الشهادات والإنجازات"]},
 {planId:"professional",name:"العضوية المهنية",description:"مزايا تعليمية ومجتمع مهني ومواد إضافية.",monthlyPrice:149,annualPrice:1490,features:["مزايا تعليمية مهنية","المشاركة في المجتمع المهني","مواد وأدوات إضافية مرخصة"]},
 {planId:"practitioner",name:"عضوية الممارس",description:"مسارات تخصصية متقدمة ومزايا تطوير مهني.",monthlyPrice:249,annualPrice:2490,features:["مسارات تخصصية متقدمة","تقارير كفاءات وتطوير مهني","مزايا إشراف حسب التعاقد"]},
];
export async function GET(request:NextRequest){
 const manage=request.nextUrl.searchParams.get("manage")==="1";
 if(manage&&!(await requirePlatformRole(request,["admin","platform_manager","accountant"])))return NextResponse.json({error:"غير مصرح."},{status:403});
 try{const db=await getClinicalDatabase(),saved=await db.collection("platform_membership_plans").find({},{projection:{_id:0}}).toArray();const plans=defaultMembershipPlans.map(base=>{const item=saved.find(row=>row.planId===base.planId);return item?{...base,...item}:base});return NextResponse.json({plans:manage?plans:plans.filter(p=>p.active!==false)},{headers:{"Cache-Control":"no-store"}})}
 catch(error){console.error("ETZAN plans GET",error);return NextResponse.json({error:"تعذر تحميل باقات العضوية."},{status:503})}
}
export async function PUT(request:NextRequest){
 const actor=await requirePlatformRole(request,["admin","platform_manager"]);if(!actor)return NextResponse.json({error:"غير مصرح بتعديل الباقات."},{status:403});
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"بيانات الباقة غير صالحة."},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"بيانات الباقة مطلوبة."},{status:400});
 const d=body as Record<string,unknown>,planId=typeof d.planId==="string"?d.planId:"",base=defaultMembershipPlans.find(p=>p.planId===planId),monthlyPrice=Number(d.monthlyPrice),annualPrice=Number(d.annualPrice),name=typeof d.name==="string"?d.name.trim().slice(0,100):"";
 if(!base||name.length<3||!Number.isFinite(monthlyPrice)||monthlyPrice<1||monthlyPrice>1000000||!Number.isFinite(annualPrice)||annualPrice<1||annualPrice>10000000)return NextResponse.json({error:"تحقق من اسم الباقة وأسعارها الشهرية والسنوية."},{status:400});
 const features=Array.isArray(d.features)?d.features.filter(x=>typeof x==="string").slice(0,8).map(x=>String(x).trim().slice(0,160)).filter(Boolean):base.features;
 try{const db=await getClinicalDatabase(),now=new Date();await db.collection("platform_membership_plans").updateOne({planId},{$set:{planId,name,description:typeof d.description==="string"?d.description.trim().slice(0,400):base.description,monthlyPrice:Math.round(monthlyPrice*100)/100,annualPrice:Math.round(annualPrice*100)/100,features,active:d.active===true,updatedAt:now,updatedBy:actor.userId},$setOnInsert:{createdAt:now}},{upsert:true});await db.collection("platform_audit_logs").insertOne({action:"membership_plan_updated",actorUserId:actor.userId,planId,createdAt:now});return NextResponse.json({success:true})}
 catch(error){console.error("ETZAN plan PUT",error);return NextResponse.json({error:"تعذر حفظ الباقة."},{status:503})}
}
