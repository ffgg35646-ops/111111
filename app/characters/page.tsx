"use client";

import "./avatar-studio.css";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileUp,
  HeartPulse,
  MessageCircle,
  PersonStanding,
  RotateCcw,
  ScanFace,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Video,
} from "lucide-react";
import AvatarStage from "@/components/avatar-stage";
import { DEFAULT_DOCTOR_AVATAR_MODEL_URL } from "@/lib/doctor-avatar";

const DOCTOR_MODEL_URL = process.env.NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL?.trim() || DEFAULT_DOCTOR_AVATAR_MODEL_URL;
const EXPRESSIONS = ["محايد", "اهتمام", "ابتسامة", "تأمل", "قلق مهني", "استغراب"];

export default function CharactersPage() {
  const [uploadedModelUrl, setUploadedModelUrl] = useState<string | null>(null);
  const [modelName, setModelName] = useState("");
  const [expression, setExpression] = useState("محايد");
  const [motion, setMotion] = useState("idle");
  const [showSpecs, setShowSpecs] = useState(false);
  const modelUrl = uploadedModelUrl ?? DOCTOR_MODEL_URL;

  useEffect(() => () => {
    if (uploadedModelUrl) URL.revokeObjectURL(uploadedModelUrl);
  }, [uploadedModelUrl]);

  const onModel = (file?: File) => {
    if (!file) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      alert("ارفع موديل الطبيب بصيغة GLB أو GLTF فقط.");
      return;
    }
    if (file.size > 120 * 1024 * 1024) {
      alert("حجم ملف الموديل يتجاوز 120 ميجابايت. استخدم نسخة محسّنة للويب والنظارة.");
      return;
    }
    setUploadedModelUrl(URL.createObjectURL(file));
    setModelName(file.name);
  };

  const removeUploadedModel = () => {
    setUploadedModelUrl(null);
    setModelName("");
  };

  return (
    <main className="avatar-workspace" dir="rtl">
      <header className="avatar-topbar">
        <Link href="/" className="back-link"><ArrowRight size={17} /> العودة للوحة التحكم</Link>
        <div className="avatar-top-actions">
          <span><span className="live-dot" /> هوية واحدة ثابتة</span>
          <Link href="/voice" className="avatar-quiet-button"><MessageCircle size={16} /> محادثة الطبيب</Link>
          <Link href="/supervision" className="avatar-quiet-button"><Video size={16} /> غرفة الإشراف</Link>
          <button className="avatar-quiet-button" onClick={() => setShowSpecs((value) => !value)}><Settings2 size={16} /> مواصفات الموديل</button>
        </div>
      </header>

      <div className="avatar-content">
        <div className="avatar-heading">
          <div>
            <div className="avatar-eyebrow"><HeartPulse size={15} /> استوديو الطبيب الافتراضي</div>
            <h1>الطبيب النفسي الافتراضي السعودي</h1>
            <p>شخصية رقمية بشرية واحدة وثابتة، تتحدث مع المتدرب وتشرح له مهارات المقابلة ودراسة الحالة والتقييم.</p>
          </div>
          <div className="asset-status">
            <span className={modelUrl ? "live-dot" : "status-dot"} />
            {modelUrl ? "المجسم البشري محمّل" : "ملف الموديل غير متاح"}
          </div>
        </div>

        <section className="doctor-identity-strip">
          <div className="doctor-identity-icon"><PersonStanding size={24} /></div>
          <div>
            <strong>د. الطبيب الافتراضي السعودي</strong>
            <p>رجل سعودي بالغ، مظهر طبي مهني، ثوب سعودي أنيق مع معطف طبي أبيض، تعبير هادئ وواثق. نفس الوجه والصوت والهوية في جميع المسارات والحالات.</p>
          </div>
          <span>شخصية واحدة · جميع التخصصات</span>
        </section>

        <div className="avatar-layout">
          <section className="avatar-stage-card">
            <div className="stage-toolbar">
              <div><span className="stage-kicker">معاينة الموديل البشري</span><strong>الطبيب النفسي السعودي</strong></div>
              <span className="stage-mode"><span className={modelUrl ? "live-dot" : "status-dot"} /> {modelUrl ? "المجسم يعمل" : "بانتظار الموديل"}</span>
            </div>
            <div className="avatar-canvas">
              <AvatarStage modelUrl={modelUrl} expression={expression} motion={motion} />
              {!modelUrl && (
                <div className="model-empty-overlay">
                  <div className="empty-model-icon"><PersonStanding size={30} /></div>
                  <strong>اربط موديل الطبيب السعودي البشري</strong>
                  <p>لن نعرض شخصية كرتونية أو رأساً وجسماً بدائيين. اربط ملف GLB/GLTF بشرياً واقعياً ومجهزاً بالهيكل العظمي وتعبيرات الوجه ومزامنة الشفاه.</p>
                  <label className="upload-model-button">
                    <FileUp size={17} /> تحميل موديل الطبيب للمعاينة
                    <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={(event) => onModel(event.target.files?.[0])} />
                  </label>
                  <small>الرفع هنا للمعاينة المحلية فقط؛ لا يصبح ملفاً مشتركاً بين المستخدمين.</small>
                </div>
              )}
              <div className="stage-bottom-hint">
                <span>اسحب للتدوير</span><span>عجلة الماوس للتقريب</span>
                <button onClick={() => { setExpression("محايد"); setMotion("idle"); }}><RotateCcw size={14} /> إعادة ضبط</button>
              </div>
            </div>
            <div className="stage-footer">
              <div><span className="file-indicator" /><span>{modelName || (process.env.NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL?.trim() ? "موديل الطبيب المعتمد من إعدادات المنصة" : "النموذج البشري الأساسي المربوط للمعاينة")}</span></div>
              <button disabled={!uploadedModelUrl} onClick={removeUploadedModel}>إزالة المعاينة المحلية</button>
            </div>
          </section>

          <aside className="avatar-controls">
            <section className="control-card">
              <div className="control-title"><ScanFace size={18} /><div><strong>تعبيرات وجه الطبيب</strong><small>تعمل فقط عند توفر Morph Targets مناسبة في ملف الموديل</small></div></div>
              <div className="expression-grid">
                {EXPRESSIONS.map((item) => <button key={item} className={expression === item ? "active" : ""} onClick={() => setExpression(item)}>{item}</button>)}
              </div>
            </section>
            <section className="control-card">
              <div className="control-title"><PersonStanding size={18} /><div><strong>حركة الطبيب</strong><small>حركات أساسية إذا كانت موجودة في ملف الشخصية</small></div></div>
              <div className="motion-list">
                {[
                  ["idle", "جلوس ووقوف طبيعي"],
                  ["talk", "التحدث والإيماءات"],
                  ["listen", "الاستماع والانتباه"],
                  ["nod", "إيماءة الرأس"],
                ].map(([id, label]) => (
                  <button key={id} className={motion === id ? "active" : ""} onClick={() => setMotion(id)}>{label}{motion === id && <ShieldCheck size={15} />}</button>
                ))}
              </div>
            </section>
            <section className="control-card member-details">
              <div className="control-title"><HeartPulse size={18} /><div><strong>هوية الشخصية</strong><small>ثابتة ولا تتبدل باختلاف الحالة</small></div></div>
              <dl>
                <div><dt>الدور</dt><dd>طبيب نفسي افتراضي ومدرب سريري</dd></div>
                <div><dt>الهوية</dt><dd>رجل سعودي بالغ</dd></div>
                <div><dt>اللباس</dt><dd>زي سعودي مهني ومعطف طبي</dd></div>
                <div><dt>مجالات التدريب</dt><dd>الصحة النفسية، CBT، النماء، التوحد، الخدمة الاجتماعية</dd></div>
              </dl>
              <p>الطبيب يشرح ويدرّب المتعلم؛ لا يتقمص دور الحالة، ولا يصدر تشخيصاً رسمياً أو يقدم علاجاً فعلياً.</p>
            </section>
          </aside>
        </div>

        {showSpecs && (
          <section className="asset-spec-panel">
            <div className="control-title"><ShieldCheck size={18} /><div><strong>معايير قبول موديل الطبيب السعودي الواقعي</strong><small>لا يعتمد الموديل لمجرد أنه ملف ثلاثي الأبعاد</small></div></div>
            <div className="spec-grid">
              <span>وجه سعودي بشري فوتوريالي</span><span>جسم كامل بهيكل Humanoid Rig</span>
              <span>Facial Rig / Blend Shapes</span><span>Arabic Visemes لمزامنة الشفاه</span>
              <span>جلد وملابس بخامات PBR</span><span>Idle / Talk / Listen / Gesture</span>
              <span>نسخة Unreal أصلية للشخصية</span><span>نسخة GLB محسّنة للويب</span>
              <span>LOD مناسب لنظارات Standalone</span><span>ترخيص تجاري موثق</span>
            </div>
            <p>الأصل الرئيسي المقترح هو MetaHuman داخل Unreal Engine، مع نسخة ويب GLB متوافقة للمعاينة. يجب اعتماد حركة الوجه والصوت على الجهاز المستهدف قبل اعتبار المزامنة واقعية.</p>
          </section>
        )}

<section className="avatar-reference-gallery" aria-label="مراجع هوية الطبيب السعودي">
          <div className="avatar-reference-heading"><div><span>SAUDI DOCTOR IDENTITY</span><h2>مراجع الشخصية المعتمدة</h2><p>الصور الثلاث المرفوعة للمشروع: الجسم الكامل من الأمام، الظهر، والوجه. تُستخدم للحفاظ على هوية واحدة عند تجهيز المجسم البشري النهائي.</p></div><span className="avatar-reference-count">3 مراجع أصلية</span></div>
          <div className="avatar-reference-grid">
            <figure><img src="/clinic/doctor-front.jpg" alt="الطبيب السعودي بالزي الرسمي من الأمام بكامل الجسم" /><figcaption><strong>المنظور الأمامي</strong><small>الجسم الكامل والزي السعودي والمعطف الطبي</small></figcaption></figure>
            <figure><img src="/clinic/doctor-back.jpg" alt="الطبيب السعودي من الخلف" /><figcaption><strong>المنظور الخلفي</strong><small>تفاصيل الثوب والشماغ والهيئة الخلفية</small></figcaption></figure>
            <figure><img src="/clinic/doctor-face.jpg" alt="لقطة قريبة لوجه الطبيب السعودي" /><figcaption><strong>مرجع الوجه</strong><small>ملامح الوجه والهوية البصرية للشخصية</small></figcaption></figure>
          </div>
        </section>

                <section className="avatar-next-steps">
          <div><Sparkles size={18} /><div><strong>ربط الطبيب بالمحاكاة</strong><p>يُستخدم ملف الطبيب نفسه في غرفة المتصفح وعميل Unreal VR، بينما تتغير الحالة والمادة العلمية فقط.</p></div></div>
          <button onClick={() => setShowSpecs(true)}><SlidersHorizontal size={16} /> مواصفات الموديل</button>
        </section>
        <footer className="avatar-footer">منصة التدريب والمحاكاة السريرية <span>•</span> الطبيب النفسي الافتراضي السعودي</footer>
      </div>
    </main>
  );
}
