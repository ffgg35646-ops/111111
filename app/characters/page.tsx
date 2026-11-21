"use client";

import "./avatar-studio.css";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Baby, Check, FileUp, HeartPulse, MessageCircle, PersonStanding, RotateCcw, ScanFace, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Users, Video } from "lucide-react";
import AvatarStage from "@/components/avatar-stage";

type FamilyMember = {
  id: string; name: string; role: string; age: string; outfit: string; description: string;
  icon: typeof Users; expressions: string[];
};

const family: FamilyMember[] = [
  { id:"father",name:"الأب السعودي",role:"ولي أمر / مرافق",age:"38 سنة",outfit:"ثوب أبيض وشماغ أحمر وأبيض",description:"شخصية رجل سعودي بالزي التقليدي، ملامح بشرية واقعية، وحركات طبيعية أثناء الحوار.",icon:PersonStanding,expressions:["محايد","قلق","حزن","غضب","ابتسامة","استغراب"] },
  { id:"mother",name:"الأم السعودية",role:"ولية أمر / مرافقة",age:"34 سنة",outfit:"عباءة سوداء وحجاب",description:"شخصية امرأة سعودية بعباءة وحجاب، مع تعبيرات وجه وحركة رأس ويدين واقعية.",icon:Users,expressions:["محايد","قلق","حزن","بكاء تمثيلي","ارتياح","استغراب"] },
  { id:"child",name:"الطفل السعودي",role:"طفل / مراجع",age:"8 سنوات",outfit:"ملابس أطفال سعودية محتشمة",description:"شخصية طفل ثلاثية الأبعاد بمقاسات عمرية صحيحة وحركات مناسبة للسن.",icon:Baby,expressions:["خجل","خوف","حزن","فضول","ابتسامة","تردد"] },
  { id:"teen",name:"المراهق السعودي",role:"مراجع",age:"15 سنة",outfit:"ملابس سعودية مناسبة للعمر",description:"شخصية مراهق مستقلة بملامح عمرية وسلوك حواري مناسب.",icon:PersonStanding,expressions:["محايد","توتر","انزعاج","حزن","ارتياح","اهتمام"] }
];

export default function CharactersPage() {
  const [selected,setSelected] = useState("father");
  const [modelUrl,setModelUrl] = useState<string | null>(null);
  const [modelName,setModelName] = useState("");
  const [expression,setExpression] = useState("محايد");
  const [motion,setMotion] = useState("idle");
  const [showSpecs,setShowSpecs] = useState(false);
  const active = useMemo(()=>family.find(x=>x.id===selected) ?? family[0],[selected]);
  const onModel = (file?: File) => {
    if (!file) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) { alert("ارفع ملف موديل ثلاثي الأبعاد بصيغة GLB أو GLTF فقط."); return; }
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    setModelUrl(URL.createObjectURL(file)); setModelName(file.name);
  };
  return <main className="avatar-workspace" dir="rtl">
    <header className="avatar-topbar">
      <Link href="/" className="back-link"><ArrowRight size={17}/> العودة للوحة التحكم</Link>
      <div className="avatar-top-actions"><span><span className="live-dot"/> وضع تجهيز الشخصيات</span><Link href="/voice" className="avatar-quiet-button"><MessageCircle size={16}/> بدء محادثة صوتية</Link><Link href="/supervision" className="avatar-quiet-button"><Video size={16}/> غرفة إشراف مشتركة</Link><button className="avatar-quiet-button" onClick={()=>setShowSpecs(v=>!v)}><Settings2 size={16}/> مواصفات الموديل</button></div>
    </header>
    <div className="avatar-content">
      <div className="avatar-heading">
        <div><div className="avatar-eyebrow"><Users size={15}/> استوديو الشخصيات السريرية</div><h1>الأسرة السعودية الافتراضية</h1><p>شخصيات بشرية ثلاثية الأبعاد بملابس وملامح سعودية، جاهزة للربط بالمحاكاة السريرية.</p></div>
        <div className="asset-status"><span className="status-dot"/> ملفات النماذج: تُضاف من مكتبة الأصول</div>
      </div>
      <div className="family-tabs">
        {family.map(member=>{const Icon=member.icon;return <button key={member.id} className={selected===member.id?"selected":""} onClick={()=>{setSelected(member.id);setExpression("محايد");setMotion("idle");}}><span className="family-tab-icon"><Icon size={19}/></span><span><strong>{member.name}</strong><small>{member.role} · {member.age}</small></span>{selected===member.id&&<Check size={17}/>}</button>})}
      </div>
      <div className="avatar-layout">
        <section className="avatar-stage-card">
          <div className="stage-toolbar"><div><span className="stage-kicker">معاينة ثلاثية الأبعاد</span><strong>{active.name}</strong></div><span className="stage-mode"><span className="live-dot"/> عارض 3D</span></div>
          <div className="avatar-canvas">
            <AvatarStage modelUrl={modelUrl} expression={expression} motion={motion}/>
            {!modelUrl&&<div className="model-empty-overlay"><div className="empty-model-icon"><Users size={30}/></div><strong>أضف موديل الشخصية الحقيقي</strong><p>ارفع ملف GLB أو GLTF للشخصية السعودية لعرضه وتحريكه داخل المشهد.</p><label className="upload-model-button"><FileUp size={17}/> رفع موديل ثلاثي الأبعاد<input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={e=>onModel(e.target.files?.[0])}/></label><small>لا نعرض مجسماً كرتونياً بديلاً عن الموديل الحقيقي.</small></div>}
            <div className="stage-bottom-hint"><span>اسحب للتدوير</span><span>عجلة الماوس للتقريب</span><button onClick={()=>{setExpression("محايد");setMotion("idle");}}><RotateCcw size={14}/> إعادة ضبط</button></div>
          </div>
          <div className="stage-footer"><div><span className="file-indicator"/><span>{modelName||"لم يتم تحميل ملف موديل بعد"}</span></div><button disabled={!modelUrl} onClick={()=>{if(modelUrl)URL.revokeObjectURL(modelUrl);setModelUrl(null);setModelName("");}}>إزالة الموديل</button></div>
        </section>
        <aside className="avatar-controls">
          <section className="control-card"><div className="control-title"><ScanFace size={18}/><div><strong>تعبيرات الوجه</strong><small>اختيار التعبير التمثيلي للموديل</small></div></div><div className="expression-grid">{active.expressions.map(item=><button key={item} className={expression===item?"active":""} onClick={()=>setExpression(item)}>{item}</button>)}</div></section>
          <section className="control-card"><div className="control-title"><PersonStanding size={18}/><div><strong>حركة الجسم</strong><small>تجربة حركات الشخصية</small></div></div><div className="motion-list">{[["idle","وقوف / جلوس طبيعي"],["talk","التحدث وحركة اليدين"],["listen","الاستماع والانتباه"],["nod","إيماءة الرأس"],["concern","حركة القلق"]].map(([id,label])=><button key={id} className={motion===id?"active":""} onClick={()=>setMotion(id)}>{label}{motion===id&&<Check size={15}/>}</button>)}</div></section>
          <section className="control-card member-details"><div className="control-title"><HeartPulse size={18}/><div><strong>ملف الشخصية</strong><small>الهوية البصرية والتمثيلية</small></div></div><dl><div><dt>الدور</dt><dd>{active.role}</dd></div><div><dt>العمر</dt><dd>{active.age}</dd></div><div><dt>الملابس</dt><dd>{active.outfit}</dd></div></dl><p>{active.description}</p></section>
        </aside>
      </div>
      {showSpecs&&<section className="asset-spec-panel"><div className="control-title"><ShieldCheck size={18}/><div><strong>معايير قبول موديلات الأسرة السعودية</strong><small>المواصفات المطلوبة لكل أصل ثلاثي الأبعاد</small></div></div><div className="spec-grid"><span>Human proportions واقعية</span><span>Rig كامل للجسم والوجه</span><span>Facial Blend Shapes</span><span>Visemes لمزامنة الشفاه العربية</span><span>ملابس سعودية بخامات PBR</span><span>Idle / Talk / Listen animations</span><span>Skeleton موحد قدر الإمكان</span><span>ترخيص استخدام تجاري موثق</span></div><p>يفضل GLB / glTF للمعاينة داخل الويب، مع الاحتفاظ بالأصل FBX أو Unreal للمسار المتقدم. لا تعتبر التعبيرات والحركات فعالة فعلياً إلا إذا كان ملف الشخصية يحتوي على Morph Targets وAnimation Clips مناسبة.</p></section>}
      <section className="avatar-next-steps"><div><Sparkles size={18}/><div><strong>الخطوة التالية في خط الإنتاج</strong><p>إضافة أصول الأب والأم والأطفال المعتمدة، ثم ربط الـ Rig والتعبيرات والصوت بمحرك الشخصية السريرية.</p></div></div><button onClick={()=>setShowSpecs(true)}><SlidersHorizontal size={16}/> عرض متطلبات الأصول</button></section>
      <footer className="avatar-footer">منصة التدريب والمحاكاة السريرية <span>•</span> استوديو الشخصيات ثلاثية الأبعاد</footer>
    </div>
  </main>;
}
