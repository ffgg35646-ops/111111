"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {PlatformLayout} from "@/components/platform-layout";
type Plan={planId:string;name:string;description:string;monthlyPrice:number;annualPrice:number;features:string[]};
type Subscription={subscriptionId:string;planId:string;planName:string;status:string;billingPeriod:string;autoRenewEnabled:boolean;recurringStatus?:string;paidThrough?:string;nextBillingAt?:string;tokenLastFour?:string;createdAt:string};
export default function MembershipPage(){
 const [plans,setPlans]=useState<Plan[]>([]),[subscriptions,setSubscriptions]=useState<Subscription[]>([]),[selected,setSelected]=useState(""),[period,setPeriod]=useState<"monthly"|"annual">("monthly"),[coupon,setCoupon]=useState(""),[consent,setConsent]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function load(){
  setError("");
  const results=await Promise.all([fetch("/api/platform/commerce/plans",{cache:"no-store"}),fetch("/api/platform/subscriptions",{cache:"no-store"})]);
  const pd=await results[0].json(),sd=await results[1].json();
  if(!results[0].ok)throw new Error(pd.error||"تعذر تحميل الباقات");
  setPlans(pd.plans||[]);
  if(results[1].ok)setSubscriptions(sd.subscriptions||[]);
 }
 useEffect(()=>{let active=true;Promise.all([fetch("/api/platform/commerce/plans",{cache:"no-store"}),fetch("/api/platform/subscriptions",{cache:"no-store"})]).then(async ([pr,sr])=>{const pd=await pr.json(),sd=await sr.json();if(!pr.ok)throw new Error(pd.error||"تعذر تحميل الباقات");if(active){setPlans(pd.plans||[]);if(sr.ok)setSubscriptions(sd.subscriptions||[]);}}).catch(e=>{if(active)setError(e.message||"تعذر تحميل الاشتراكات")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 async function checkout(){
  if(!selected){setError("اختر الباقة المهنية أولاً.");return}
  if(!consent){setError("يلزم تأكيد الموافقة على التجديد التلقائي.");return}
  setBusy("checkout");setError("");setNotice("");
  try{const r=await fetch("/api/platform/commerce/subscriptions/checkout",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({planId:selected,billingPeriod:period,couponCode:coupon,recurringConsent:true})}),d=await r.json();if(!r.ok){if(r.status===401){window.location.href="/login?next=/membership";return}throw new Error(d.error||"تعذر بدء الاشتراك")}window.location.href=d.payUrl}
  catch(e){setError(e instanceof Error?e.message:"تعذر بدء الاشتراك");setBusy("")}
 }
 async function cancel(item:Subscription){
  if(!window.confirm("إيقاف التجديد التلقائي؟ ستبقى مزايا الفترة المدفوعة متاحة حتى تاريخ انتهائها."))return;
  setBusy(item.subscriptionId);setError("");setNotice("");
  try{const r=await fetch("/api/platform/subscriptions",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({subscriptionId:item.subscriptionId})}),d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر إيقاف التجديد");setNotice(d.message+(d.tokenRevocationPending?" تعذر حذف رمز البطاقة من مزود الدفع تلقائياً؛ لن ينفذ النظام خصومات إضافية.":""));await load()}
  catch(e){setError(e instanceof Error?e.message:"تعذر إيقاف التجديد")}finally{setBusy("")}
 }
 return <PlatformLayout title="العضويات والاشتراكات" description="اختر باقة شهرية أو سنوية، وراجع تاريخ التجديد وأوقف التجديد التلقائي في أي وقت.">
 <div className="portal-callout">تتم جميع المبالغ بالريال السعودي. لا تُفعّل العضوية إلا بعد تأكيد مزود الدفع. التجديد التلقائي يحتاج حفظ وسيلة دفع آمنة وموافقة صريحة منك؛ وإلا تُتاح إعادة التجديد يدويًا.</div>
 {error&&<p role="alert" style={{color:"#a33"}}>{error}</p>}{notice&&<p role="status" className="portal-callout">{notice}</p>}
 {loading?<div className="portal-empty">جارٍ تحميل الباقات والاشتراكات...</div>:plans.length===0?<div className="portal-card" style={{marginTop:14}}>لا توجد باقات منشورة للبيع حاليًا. ستظهر بعد تحديد الأسعار وتفعيلها من الإدارة.</div>:<div style={{marginTop:14}}>
 <div className="portal-filter-row"><button className={period==="monthly"?"portal-filter active":"portal-filter"} onClick={()=>setPeriod("monthly")}>شهري</button><button className={period==="annual"?"portal-filter active":"portal-filter"} onClick={()=>setPeriod("annual")}>سنوي</button></div>
 <div className="portal-grid">{plans.map(p=><article className="portal-card" key={p.planId} style={{border:selected===p.planId?"1px solid #2f9e93":undefined}}>
 <span className="portal-chip">{period==="monthly"?"عضوية شهرية":"عضوية سنوية"}</span><h3>{p.name}</h3><p>{p.description}</p><strong style={{fontSize:23,color:"#147f76"}}>{Number(period==="monthly"?p.monthlyPrice:p.annualPrice).toLocaleString("ar-SA")} <small>SAR</small></strong>
 <ul style={{paddingRight:18,color:"#6e818a",fontSize:11,lineHeight:2}}>{p.features.map(f=><li key={f}>{f}</li>)}</ul>
 <button className={selected===p.planId?"portal-button":"portal-button secondary"} onClick={()=>setSelected(p.planId)}>{selected===p.planId?"تم اختيار الباقة":"اختيار هذه الباقة"}</button>
 </article>)}</div>
 <section className="portal-card" style={{marginTop:14,display:"grid",gap:12}}>
 <strong>استكمال الاشتراك</strong>
 <label>كود خصم (اختياري)<input maxLength={40} value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,""))} placeholder="أدخل كود الخصم"/></label>
 <label style={{display:"flex",alignItems:"flex-start",gap:8,lineHeight:1.8}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} style={{marginTop:5}}/><span>أوافق صراحة على حفظ رمز وسيلة الدفع لدى مزود الدفع، وخصم قيمة الباقة ({period==="monthly"?"شهريًا":"سنويًا"}) عند موعد التجديد، وأعلم أنه يمكنني إيقاف التجديد من هذه الصفحة قبل موعد الخصم.</span></label>
 <button className="portal-button" disabled={busy==="checkout"||!selected||!consent} onClick={()=>void checkout()}>{busy==="checkout"?"جارٍ تجهيز الاشتراك...":"متابعة إلى الدفع الآمن"}</button>
 </section>
 </div>}
 <div className="portal-section-title"><div><h2>اشتراكاتي</h2><p>{subscriptions.length} اشتراك مسجل في الحساب</p></div><button className="portal-button secondary" onClick={()=>void load()}>تحديث</button></div>
 <div style={{display:"grid",gap:10}}>{subscriptions.map(s=><article className="portal-card" key={s.subscriptionId}>
 <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><strong>{s.planName}</strong><span className="portal-chip">{s.status==="active"?"نشط":s.status==="past_due"?"تعذر التجديد":s.status==="renewal_processing"?"جارٍ تأكيد التجديد":s.status==="cancelled"?"ملغي":s.status}</span></div>
 <p>{s.billingPeriod==="annual"?"سنوي":"شهري"} · {s.autoRenewEnabled?"التجديد التلقائي مفعّل":"التجديد التلقائي متوقف"}</p>
 {s.tokenLastFour&&<small>وسيلة الدفع المحفوظة: **** {s.tokenLastFour}</small>}
 {s.paidThrough&&<small>مدفوع حتى: {new Date(s.paidThrough).toLocaleDateString("ar-SA")}</small>}
 {s.nextBillingAt&&s.autoRenewEnabled&&<small>موعد التجديد التالي: {new Date(s.nextBillingAt).toLocaleDateString("ar-SA")}</small>}
 {s.autoRenewEnabled&&<button className="portal-button secondary" disabled={busy===s.subscriptionId} onClick={()=>void cancel(s)}>{busy===s.subscriptionId?"جارٍ الإلغاء...":"إيقاف التجديد التلقائي"}</button>}
 </article>)}</div>
 <div className="portal-callout" style={{marginTop:16}}>إذا لم يتم تفعيل حفظ البطاقات لدى حساب التاجر، ستعمل العضوية لفترة مدفوعة مع تجديد يدوي؛ لن يتم الادعاء بأن الخصم الدوري مفعل دون وجود توكن نشط والتحقق منه.</div>
 <p style={{fontSize:10,color:"#7c8b90"}}>الرسوم: لا تضيف اتزان رسوم معالجة منفصلة على العميل. عمولة بوابة الدفع تخضع لعقد التاجر، وتظهر في سجل العمليات عند إرجاع قيمتها من Moyasar. <Link href="/platform-admin/invoices">الفواتير</Link></p>
 </PlatformLayout>;
}