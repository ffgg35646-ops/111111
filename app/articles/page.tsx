"use client";
import {useEffect,useMemo,useState} from "react";
import {BookOpen,Search,Newspaper,Share2,ArrowRight} from "lucide-react";
import {PlatformLayout} from "@/components/platform-layout";
type Article={articleId:string;title:string;summary:string;content:string;category:string;authorName:string;createdAt:string};
export default function ArticlesPage(){
 const [items,setItems]=useState<Article[]>([]),[selected,setSelected]=useState<Article|null>(null),[query,setQuery]=useState(""),[category,setCategory]=useState("الكل"),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 useEffect(()=>{let active=true;fetch("/api/content/articles",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.articles||[])}).catch(e=>{if(active)setError(e.message||"تعذر تحميل المقالات")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 const categories=useMemo(()=>["الكل",...Array.from(new Set(items.map(a=>a.category))).sort((a,b)=>a.localeCompare(b,"ar"))],[items]);
 // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize the selected article from the URL.
 useEffect(()=>{if(typeof window==="undefined"||items.length===0)return;const id=new URLSearchParams(window.location.search).get("article");if(id){const match=items.find(a=>a.articleId===id);if(match)setSelected(match)}},[items]);
 const filtered=items.filter(a=>(category==="الكل"||a.category===category)&&(a.title+" "+a.summary+" "+a.content+" "+a.category+" "+a.authorName).toLowerCase().includes(query.toLowerCase()));
 async function share(a:Article){const url=typeof window!=="undefined"?window.location.origin+"/articles?article="+encodeURIComponent(a.articleId):"";const data={title:a.title,text:a.summary,url};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(url);setNotice("تم نسخ رابط المقال لمشاركته.")}}catch(e){if(e instanceof Error&&e.name!=="AbortError")setNotice("تعذرت المشاركة من هذا المتصفح.")}}
 return <PlatformLayout title="مركز المقالات والمعرفة" description="معرفة علمية ومهنية موثوقة في الخدمة الاجتماعية وعلم النفس والإرشاد والتخصصات المرتبطة بها.">
 <div className="portal-card" style={{display:"grid",gap:12,marginBottom:16}}>
  <div style={{display:"flex",gap:10,alignItems:"center"}}><Search size={17}/><input aria-label="البحث في المقالات" value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث بعنوان المقال أو الكاتب أو داخل المحتوى..." style={{border:0,outline:0,flex:1,minWidth:0,padding:8}}/></div>
  <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{categories.map(c=><button key={c} className={category===c?"portal-button":"portal-button secondary"} onClick={()=>setCategory(c)}>{c}</button>)}</div>
 </div>
 {notice&&<p role="status" className="portal-callout">{notice}</p>}{loading&&<div className="portal-empty">جارٍ تحميل المقالات...</div>}{error&&<div className="portal-callout">{error}</div>}
 {!loading&&!error&&filtered.length===0&&<div className="portal-empty">لا توجد مقالات مطابقة. جرّب تغيير عبارة البحث أو التصنيف.</div>}
 <div className="portal-grid">{filtered.map(a=><article className="portal-card" key={a.articleId}><span className="portal-chip">{a.category}</span><h3>{a.title}</h3><p>{a.summary}</p><small style={{display:"block",color:"#9aa6ac",marginTop:12,fontSize:9}}>{a.authorName} · {new Date(a.createdAt).toLocaleDateString("ar-SA")}</small><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="portal-button secondary" onClick={()=>setSelected(a)}><BookOpen size={14}/> اقرأ المقال</button><button className="portal-button secondary" onClick={()=>void share(a)}><Share2 size={14}/> مشاركة</button></div></article>)}</div>
 {selected&&<section className="portal-card" style={{marginTop:18}}><div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><span className="portal-chip">{selected.category}</span><div style={{display:"flex",gap:7}}><button className="portal-button secondary" onClick={()=>void share(selected)}><Share2 size={14}/> مشاركة المقال</button><button className="portal-button secondary" onClick={()=>setSelected(null)}><ArrowRight size={14}/> إغلاق</button></div></div><h2>{selected.title}</h2><p>{selected.summary}</p><small style={{color:"#94a0a6"}}>{selected.authorName} · {new Date(selected.createdAt).toLocaleDateString("ar-SA")}</small><div style={{whiteSpace:"pre-wrap",lineHeight:2.1,fontSize:13,color:"#536a75",marginTop:18}}>{selected.content}</div></section>}
 <div className="portal-callout" style={{marginTop:18}}><Newspaper size={16}/> المقالات تثقيفية ومهنية، ولا تمثل تشخيصاً أو بديلاً عن التقييم المختص.</div>
 </PlatformLayout>;
}