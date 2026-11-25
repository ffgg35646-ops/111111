"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, FilePlus2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import type { ProfessionalToolTemplate } from "@/lib/platform-professional-templates";

const roleOptions = [
  ["admin","مدير النظام"],["platform_manager","مدير المنصة"],["supervisor","المشرف"],
  ["trainer","المدرب"],["trainee","المتدرب"],["consultant","مقدم الاستشارة"],
  ["accountant","المحاسب"],["support","الدعم"],["content_manager","مسؤول المحتوى"],["quality_manager","مسؤول الجودة"],
] as const;

const blank: ProfessionalToolTemplate = {
  id: "", title: "", group: "النماذج المهنية", description: "",
  fields: [], allowedRoles: ["admin","platform_manager","supervisor","trainer","trainee","consultant"],
  allowDownload: true, allowPrint: true, status: "draft",
};

export default function PlatformAdminToolsPage() {
  const [templates,setTemplates]=useState<ProfessionalToolTemplate[]>([]);
  const [form,setForm]=useState<ProfessionalToolTemplate>(blank);
  const [fieldsText,setFieldsText]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load() {
    setLoading(true);setError("");
    try {
      const response=await fetch("/api/platform/tool-templates",{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر تحميل القوالب.");
      setTemplates(Array.isArray(data.templates)?data.templates:[]);
    } catch(cause) {setError(cause instanceof Error?cause.message:"تعذر تحميل القوالب.");}
    finally {setLoading(false);}
  }

  useEffect(()=>{let active=true;fetch("/api/platform/tool-templates",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);if(active)setTemplates(Array.isArray(data.templates)?data.templates:[]);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"تعذر تحميل القوالب.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);

  const editing=useMemo(()=>templates.some(item=>item.id===form.id),[templates,form.id]);
  function choose(item:ProfessionalToolTemplate) {
    setForm({...item,allowedRoles:[...item.allowedRoles],fields:[...item.fields]});
    setFieldsText(item.fields.map(field=>field.key+" | "+field.label).join("\n"));
    setError("");setNotice("");
  }
  function newTemplate() {
    setForm({...blank,id:""});
    setFieldsText("");
    setError("");setNotice("");
  }
  function toggleRole(role:string,checked:boolean) {
    setForm(current=>({...current,allowedRoles:checked?[...new Set([...current.allowedRoles,role])]:current.allowedRoles.filter(item=>item!==role)}));
  }
  async function save() {
    setSaving(true);setError("");setNotice("");
    const fields=fieldsText.split("\n").map(line=>line.trim()).filter(Boolean).map(line=>{
      const [key,...label]=line.split("|");
      return {key:key.trim(),label:label.join("|").trim()};
    });
    const id=form.id.trim().toLowerCase();
    if(!id||!form.title.trim()||!form.group.trim()||!form.description.trim()||!fields.length||!form.allowedRoles.length) {
      setSaving(false);setError("أكمل المعرف والعنوان والتصنيف والوصف والحقول والأدوار المسموح لها.");return;
    }
    try {
      const response=await fetch("/api/platform/tool-templates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,id,fields})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر حفظ القالب.");
      setNotice("تم حفظ تعريف النموذج وصلاحياته.");
      await load();
      if(data.template)choose({...data.template,id:data.template.templateId||id});
    } catch(cause) {setError(cause instanceof Error?cause.message:"تعذر حفظ القالب.");}
    finally {setSaving(false);}
  }
  async function archive() {
    if(!form.id)return;
    setSaving(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/platform/tool-templates?id="+encodeURIComponent(form.id),{method:"DELETE"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر أرشفة النموذج.");
      setNotice("تمت أرشفة النموذج وإخفاؤه عن مكتبة المستخدمين.");
      newTemplate();await load();
    } catch(cause) {setError(cause instanceof Error?cause.message:"تعذر أرشفة النموذج.");}
    finally {setSaving(false);}
  }

  return <PlatformLayout title="إدارة مكتبة الأدوات والنماذج" description="إضافة وتحرير القوالب المهنية وتحديد من يستطيع استخدامها وتنزيلها وطباعتها.">
    <div className="portal-callout"><ShieldCheck size={16}/> لا تحفظ القوالب بيانات المستفيدين نفسها. تُحفظ النماذج التي يعبئها المستخدمون في ملفات منفصلة، ويظل الوصول إليها مقيداً بصاحب الملف والأدوار الإشرافية المخولة.</div>
    <div className="portal-grid" style={{marginTop:16,alignItems:"start"}}>
      <section className="portal-card" style={{minWidth:0}}>
        <div className="portal-section-title"><div><h2>القوالب المنشورة والمسودات</h2><p>{templates.length} تعريف نموذج</p></div><button className="portal-button secondary" onClick={()=>void load()}><RefreshCw size={14}/> تحديث</button></div>
        <button className="portal-button" onClick={newTemplate}><FilePlus2 size={15}/> قالب جديد</button>
        <div style={{display:"grid",gap:8,marginTop:12}}>
          {loading?<div className="portal-empty">جارٍ تحميل القوالب...</div>:templates.map(item=><button type="button" key={item.id} onClick={()=>choose(item)} className="portal-card" style={{textAlign:"right",border:form.id===item.id?"1px solid #26988d":"1px solid #e5ecee",padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><strong>{item.title}</strong><span className="portal-chip">{item.status==="published"?"منشور":item.status==="archived"?"مؤرشف":"مسودة"}</span></div>
            <small style={{display:"block",color:"#82939b",marginTop:4}}>{item.group} · {item.allowedRoles.length} أدوار · {item.fields.length} حقول</small>
          </button>)}
        </div>
      </section>
      <section className="portal-card" style={{minWidth:0}}>
        <div className="portal-section-title"><div><h2>{editing?"تحرير تعريف النموذج":"إضافة نموذج جديد"}</h2><p>المعرف يستخدم كرابط داخلي ثابت</p></div></div>
        <div style={{display:"grid",gap:11}}>
          <label className="portal-field">المعرف التقني<input value={form.id} disabled={editing} onChange={e=>setForm(v=>({...v,id:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-")}))} placeholder="example-template"/></label>
          <label className="portal-field">عنوان النموذج<input value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
          <label className="portal-field">التصنيف<input value={form.group} onChange={e=>setForm(v=>({...v,group:e.target.value}))}/></label>
          <label className="portal-field">الوصف<textarea rows={2} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
          <label className="portal-field">حقول النموذج (سطر لكل حقل: key | التسمية)<textarea rows={9} value={fieldsText} onChange={e=>setFieldsText(e.target.value)} placeholder={"date | تاريخ النموذج\nsummary | الملخص المهني"}/></label>
          <div><strong style={{fontSize:12}}>الأدوار التي يمكنها فتح النموذج وحفظه</strong><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:8}}>{roleOptions.map(([id,label])=><label key={id} style={{display:"flex",gap:7,alignItems:"center",fontSize:11}}><input type="checkbox" checked={form.allowedRoles.includes(id)} onChange={e=>toggleRole(id,e.target.checked)}/>{label}</label>)}</div></div>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}><label><input type="checkbox" checked={form.allowDownload} onChange={e=>setForm(v=>({...v,allowDownload:e.target.checked}))}/> السماح بالتنزيل</label><label><input type="checkbox" checked={form.allowPrint} onChange={e=>setForm(v=>({...v,allowPrint:e.target.checked}))}/> السماح بالطباعة</label></div>
          <label className="portal-field">حالة النشر<select value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value as ProfessionalToolTemplate["status"]}))}><option value="draft">مسودة</option><option value="published">منشور للمستخدمين</option></select></label>
          {error&&<p role="alert" style={{color:"#aa443d",fontSize:12}}>{error}</p>}
          {notice&&<p role="status" style={{color:"#218067",fontSize:12}}>{notice}</p>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="portal-button" disabled={saving} onClick={()=>void save()}><Save size={14}/>{saving?"جارٍ الحفظ...":"حفظ القالب"}</button>{editing&&form.status!=="archived"&&<button className="portal-button secondary" disabled={saving} onClick={()=>void archive()}><Archive size={14}/> أرشفة القالب</button>}</div>
        </div>
      </section>
    </div>
  </PlatformLayout>;
}
