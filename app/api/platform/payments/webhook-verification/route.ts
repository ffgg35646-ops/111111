import {NextRequest,NextResponse} from "next/server";
import {getClinicalDatabase} from "@/lib/mongodb";
import {requirePlatformRole} from "@/lib/platform-auth";
export const runtime="nodejs";
export async function GET(request:NextRequest){const actor=await requirePlatformRole(request,["admin","platform_manager","accountant"]);if(!actor)return NextResponse.json({error:"غير مصرح."},{status:403});try{const db=await getClinicalDatabase(),record=await db.collection("platform_webhook_verifications").findOne({provider:"moyasar",expiresAt:{$gt:new Date()}},{projection:{_id:0,webhookId:1,verificationCode:1,receivedAt:1,expiresAt:1}});return NextResponse.json({verification:record||null},{headers:{"Cache-Control":"no-store"}})}catch(error){console.error("Webhook verification lookup",error);return NextResponse.json({error:"تعذر قراءة رمز التحقق."},{status:503})}}
