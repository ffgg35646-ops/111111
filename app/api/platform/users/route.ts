import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import {
  createPasswordHash,
  requirePlatformRole,
  PLATFORM_ROLES,
  type PlatformRole,
} from "@/lib/platform-auth";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function publicUser(user: Record<string, unknown>) {
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin","platform_manager"]);
  if (!actor) return NextResponse.json({ error: "إدارة الحسابات متاحة لمدير المنصة فقط." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const users = await db.collection("platform_users").find({}, {
      projection: { _id: 0, userId: 1, name: 1, email: 1, role: 1, status: 1, createdAt: 1, lastLoginAt: 1 },
    }).sort({ createdAt: -1 }).limit(500).toArray();
    return NextResponse.json({ users: users.map((user) => publicUser(user)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to list platform users", error);
    return NextResponse.json({ error: "تعذر تحميل الحسابات. تحقق من إعداد قاعدة البيانات." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin","platform_manager"]);
  if (!actor) return NextResponse.json({ error: "إنشاء الحسابات متاح لمدير المنصة فقط." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات الحساب غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "أدخل بيانات الحساب المطلوبة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const name = clean(data.name, 100);
  const email = clean(data.email, 180).toLowerCase();
  const password = typeof data.password === "string" ? data.password : "";
  const role = clean(data.role, 30) as PlatformRole;
  if (actor.role === "platform_manager" && role === "admin") return NextResponse.json({ error: "لا يملك مدير المنصة صلاحية إنشاء حساب مدير النظام." }, { status: 403 });
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || !PLATFORM_ROLES.includes(role)) {
    return NextResponse.json({ error: "تحقق من الاسم والبريد والدور، واجعل كلمة المرور 12 حرفاً على الأقل." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    await users.createIndex({ email: 1 }, { unique: true });
    const duplicate = await users.findOne({ email }, { projection: { _id: 1 } });
    if (duplicate) return NextResponse.json({ error: "يوجد حساب مسجل بهذا البريد الإلكتروني." }, { status: 409 });

    const passwordHash = createPasswordHash(password).split("$");
    const user = {
      userId: randomUUID(),
      name,
      email,
      role,
      status: "active",
      passwordSalt: passwordHash[1],
      passwordHash: passwordHash[2],
      createdAt: new Date(),
      createdBy: actor.userId,
      mustChangePassword: true,
    };
    await users.insertOne(user);
    await db.collection("platform_audit_logs").insertOne({
      action: "platform_user_created",
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetUserId: user.userId,
      targetEmail: user.email,
      targetRole: user.role,
      createdAt: new Date(),
    }).catch((error) => console.warn("Unable to write account audit event", error));

    return NextResponse.json({ success: true, user: publicUser(user) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to create platform user", error);
    return NextResponse.json({ error: "تعذر إنشاء الحساب. قد يكون البريد مسجلاً بالفعل." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin","platform_manager"]);
  if (!actor) return NextResponse.json({ error: "تعديل الحسابات متاح لمدير المنصة فقط." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات التعديل غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات التعديل غير مكتملة." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const userId = clean(data.userId, 80);
  const status = clean(data.status, 20);
  const role = clean(data.role, 30) as PlatformRole;
  if (!userId || (status && !["active", "disabled"].includes(status)) || (role && !PLATFORM_ROLES.includes(role))) {
    return NextResponse.json({ error: "معرّف الحساب أو الدور أو الحالة غير صالح." }, { status: 400 });
  }
  if (userId === actor.userId && status === "disabled") {
    return NextResponse.json({ error: "لا يمكنك تعطيل حسابك الحالي." }, { status: 409 });
  }

  try {
    const db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    const target = await users.findOne({ userId });
    if (!target) return NextResponse.json({ error: "الحساب غير موجود." }, { status: 404 });
    if (actor.role === "platform_manager" && (target.role === "admin" || role === "admin")) return NextResponse.json({ error: "لا يملك مدير المنصة صلاحية تعديل حساب مدير النظام أو منح صلاحية مدير النظام." }, { status: 403 });

    if (target.role === "admin" && target.status === "active" && (status === "disabled" || (role && role !== "admin"))) {
      const activeAdmins = await users.countDocuments({ role: "admin", status: "active" });
      if (activeAdmins <= 1) return NextResponse.json({ error: "يجب الاحتفاظ بمدير منصة نشط واحد على الأقل." }, { status: 409 });
    }

    const update: Record<string, unknown> = { updatedAt: new Date(), updatedBy: actor.userId };
    if (status) update.status = status;
    if (role) update.role = role;
    await users.updateOne({ userId }, { $set: update });
    await db.collection("platform_audit_logs").insertOne({
      action: "platform_user_updated",
      actorUserId: actor.userId,
      targetUserId: userId,
      changes: update,
      createdAt: new Date(),
    }).catch((error) => console.warn("Unable to write account audit event", error));

    const updated = await users.findOne({ userId }, {
      projection: { _id: 0, userId: 1, name: 1, email: 1, role: 1, status: 1, createdAt: 1, lastLoginAt: 1 },
    });
    return NextResponse.json({ success: true, user: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to update platform user", error);
    return NextResponse.json({ error: "تعذر تحديث الحساب." }, { status: 503 });
  }
}
