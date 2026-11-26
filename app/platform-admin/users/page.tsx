"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, UserPlus, Users, ShieldCheck, UserX, UserCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type UserRecord = {
  userId: string; name: string; email: string; role: string; status: string;
  createdAt?: string; lastLoginAt?: string;
};

const roles = [
  ["admin", "مدير النظام"],
  ["platform_manager", "مدير المنصة"],
  ["supervisor", "المشرف"],
  ["trainer", "المدرب"],
  ["trainee", "المتدرب"],
  ["consultant", "مقدم الاستشارة"],
  ["accountant", "المحاسب"],
  ["support", "فريق الدعم"],
  ["content_manager", "مسؤول المحتوى"],
  ["quality_manager", "مسؤول الجودة"],
] as const;

export default function PlatformUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [roleReady, setRoleReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [savingRole, setSavingRole] = useState("");
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/platform/users", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        router.replace("/login?next=/platform-admin/users");
        return;
      }
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الحسابات.");
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل الحسابات.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null).then((data) => {
      if (!active) return;
      const currentRole = data?.authenticated ? data.user?.role : null;
      const systemAdmin = currentRole === "admin";
      setIsSystemAdmin(systemAdmin);
      setRole(systemAdmin ? "admin" : currentRole === "platform_manager" ? "platform_manager" : "trainee");
      setRoleReady(true);
    }).catch(() => { if (active) { setRole("trainee"); setRoleReady(true); } });
    fetch("/api/platform/users", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        if (response.status === 401 || response.status === 403) {
          router.replace("/login?next=/platform-admin/users");
          return;
        }
        if (!response.ok) throw new Error(data.error || "تعذر تحميل الحسابات.");
        setUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل الحسابات.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [router]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/platform/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء الحساب.");
      setSuccess("تم إنشاء حساب " + (roles.find(([value]) => value === role)?.[1] || role) + ". سلّم بيانات الدخول لصاحبه عبر قناة آمنة.");
      setName(""); setEmail(""); setPassword("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء الحساب.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: UserRecord) {
    const nextStatus = user.status === "active" ? "disabled" : "active";
    if (!window.confirm(nextStatus === "disabled" ? "تعطيل هذا الحساب؟" : "إعادة تفعيل هذا الحساب؟")) return;
    setError(""); setSuccess("");
    try {
      const response = await fetch("/api/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userId, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحديث الحساب.");
      setSuccess("تم تحديث حالة الحساب.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث الحساب.");
    }
  }

  async function updateRole(user: UserRecord) {
    const nextRole = selectedRoles[user.userId] || user.role;
    if (nextRole === user.role) return;
    if (!window.confirm("تأكيد تغيير صلاحية هذا الحساب؟")) return;
    setSavingRole(user.userId); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.userId, role: nextRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تغيير الصلاحية.");
      setSuccess("تم تحديث صلاحية الحساب.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تغيير الصلاحية.");
    } finally {
      setSavingRole("");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <PlatformLayout title="إدارة حسابات المنصة" description="إنشاء حسابات الإدارة الكاملة وباقي أدوار المنصة، وتحديد الصلاحيات وإيقاف الوصول عند الحاجة. جميع تغييرات الحسابات تسجل في سجل تدقيق إداري.">
      <section className="portal-card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}><ShieldCheck size={19}/><strong>إدارة حسابات المنصة</strong></div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="portal-button secondary" type="button" onClick={() => { setLoading(true); setError(""); void load(); }} disabled={loading}><RefreshCw size={14}/> تحديث</button>
            <button className="portal-button secondary" type="button" onClick={() => void logout()}>تسجيل الخروج</button>
          </div>
        </div>
        <form onSubmit={createUser} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginTop: 18 }}>
          <label style={{ display: "grid", gap: 5, fontSize: 11 }}>الاسم الكامل<input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} style={{ padding: 10, border: "1px solid #dce5e9", borderRadius: 8 }}/></label>
          <label style={{ display: "grid", gap: 5, fontSize: 11 }}>البريد الإلكتروني<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ padding: 10, border: "1px solid #dce5e9", borderRadius: 8 }}/></label>
          <label style={{ display: "grid", gap: 5, fontSize: 11 }}>كلمة مرور مؤقتة<input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ padding: 10, border: "1px solid #dce5e9", borderRadius: 8 }}/></label>
          <label style={{ display: "grid", gap: 5, fontSize: 11 }}>الدور<select value={role} disabled={!roleReady} onChange={(event) => setRole(event.target.value)} style={{ padding: 10, border: "1px solid #dce5e9", borderRadius: 8, background: "#fff" }}>{roles.filter(([value]) => value !== "admin" || isSystemAdmin).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <button className="portal-button" type="submit" disabled={saving || !roleReady} style={{ alignSelf: "end", justifyContent: "center" }}><UserPlus size={15}/>{!roleReady ? "جارٍ التحقق من الصلاحية..." : saving ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button>
        </form>
        <p style={{ margin: "10px 0 0", color: "#8a98a4", fontSize: 11, lineHeight: 1.7 }}>تُنشأ الحسابات بكلمة مرور مؤقتة، ويُطلب من صاحب الحساب تغييرها فور تسجيل الدخول الأول. شارك بيانات الدخول عبر قناة آمنة؛ لا يرسل النظام كلمات المرور بالبريد.</p>
        {error && <p role="alert" style={{ color: "#b64b48", fontSize: 12 }}>{error}</p>}
        {success && <p role="status" style={{ color: "#287b61", fontSize: 12 }}>{success}</p>}
      </section>
      <div className="portal-section-title"><div><h2><Users size={17} style={{ verticalAlign: "middle" }}/> حسابات المنصة</h2><p>{users.length} حساباً</p></div></div>
      {loading && <div className="portal-card">جارٍ تحميل الحسابات...</div>}
      {!loading && users.length === 0 && <div className="portal-card">لا توجد حسابات بعد. أنشئ أول حساب من النموذج أعلاه.</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {users.map((user) => <article className="portal-card" key={user.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div><strong>{user.name}</strong><div style={{ color: "#71808d", fontSize: 12, marginTop: 4 }}>{user.email}</div><small style={{ color: "#8a98a4" }}>{roles.find(([value]) => value === user.role)?.[1] || user.role} · آخر دخول: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ar-EG") : "لم يسجل الدخول بعد"}</small></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="portal-chip">{user.status === "active" ? "نشط" : "معطل"}</span>
            <select aria-label={"صلاحية "+user.name} value={selectedRoles[user.userId] ?? user.role} onChange={(event) => setSelectedRoles((current) => ({ ...current, [user.userId]: event.target.value }))} style={{ padding: 8, border: "1px solid #dce5e9", borderRadius: 8, background: "#fff", fontSize: 11 }}>
              {roles.map(([value,label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <button className="portal-button secondary" type="button" disabled={savingRole===user.userId || (selectedRoles[user.userId] ?? user.role)===user.role} onClick={() => void updateRole(user)}>{savingRole===user.userId ? "جارٍ الحفظ..." : "حفظ الصلاحية"}</button>
            <button className="portal-button secondary" type="button" onClick={() => void toggleStatus(user)}>{user.status === "active" ? <UserX size={14}/> : <UserCheck size={14}/>} {user.status === "active" ? "تعطيل" : "تفعيل"}</button>
          </div>
        </article>)}
      </div>
    </PlatformLayout>
  );
}
