"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Activity, ArrowLeft, BookOpen, Brain, CheckCircle2, ClipboardCheck,
  ClipboardList, FileCheck2, GraduationCap, HeartHandshake, Lightbulb,
  Microscope, ShieldAlert, Sparkles, Stethoscope, Users, Workflow,
  type LucideIcon
} from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Section = "paths" | "case-study" | "scales" | "reasoning" | "support";
type ManagedTrack = {
  id: string; title: string; category: string; summary: string; outcomes: string[];
  units: string[]; practice: string; iconName?: string; isCustom?: boolean;
  isManaged?: boolean; skills?: string[]; accent?: string;
};
type DisplayTrack = {
  id: string; title: string; category: string; summary: string; icon: LucideIcon;
  outcomes: readonly string[]; units: readonly string[]; practice: string;
};
const trackIcons: Record<string, LucideIcon> = {
  users: Users, brain: Brain, "heart-handshake": HeartHandshake, workflow: Workflow,
  activity: Activity, microscope: Microscope, stethoscope: Stethoscope,
  "graduation-cap": GraduationCap, "book-open": BookOpen,
};

const tracks = [
  {
    id: "social-work",
    title: "مسار الخدمة الاجتماعية",
    category: "الممارسة المهنية",
    summary: "تطوير مهارات دراسة الحالة والتقدير الاجتماعي والعمل مع الأفراد والأسر والمؤسسات.",
    icon: Users,
    outcomes: ["بناء العلاقة والمقابلة المهنية", "التقدير الأسري والبيئي", "إدارة الحالة والموارد", "التدخل والإحالة والمتابعة"],
    units: ["أخلاقيات الممارسة وحقوق المستفيد", "المقابلة وجمع المعلومات", "التقدير البيئي وشبكة الدعم", "صياغة الحالة وخطة التدخل", "التوثيق والعمل متعدد التخصصات"],
    practice: "أنشئ خريطة بيئية لحالة افتراضية، وحدد الاحتياجات ونقاط القوة والموارد وخطوة متابعة قابلة للقياس.",
  },
  {
    id: "mental-health",
    title: "مسار علم النفس",
    category: "الفهم والتقدير النفسي",
    summary: "فهم السلوك والانفعال والعمليات المعرفية ومهارات المقابلة والتفكير النفسي العلمي.",
    icon: Brain,
    outcomes: ["استكشاف الخبرة النفسية", "وصف الأعراض والأثر الوظيفي", "فهم السياق والعوامل المصاحبة", "تمييز الوصف عن الاستنتاج"],
    units: ["مدخل إلى علم النفس", "السلوك والانفعال والإدراك", "المقابلة النفسية", "مبادئ التقدير والتفكير العلمي", "أخلاقيات الممارسة والإحالة"],
    practice: "حلل وصفاً نفسياً افتراضياً، وافصل بين ما يذكره الشخص وما يمكن ملاحظته وما يحتاج إلى تقييم.",
  },
  {
    id: "cbt",
    title: "مسار العلاج المعرفي السلوكي CBT",
    category: "التدخل تحت الإشراف",
    summary: "تطبيق نموذج CBT وصياغة الحالة والمهارات المعرفية والسلوكية في مواقف تدريبية آمنة.",
    icon: HeartHandshake,
    outcomes: ["بناء التحالف المهني", "تحليل الموقف والفكرة والانفعال والسلوك", "استخدام الأسئلة السقراطية", "التخطيط لتجارب سلوكية تدريجية"],
    units: ["أساسيات CBT وحدود الممارسة", "نموذج ABC", "الأفكار التلقائية", "إعادة التقييم المعرفي", "التجارب السلوكية والمتابعة"],
    practice: "طبّق سجل ABC على موقف افتراضي، ثم صغ سؤالاً تعاونياً وخطوة سلوكية تدريجية.",
  },
  {
    id: "family-guidance",
    title: "مسار الإرشاد والعلاج الأسري",
    category: "العلاقات والديناميات الأسرية",
    summary: "فهم أنماط التفاعل والتواصل، وإدارة المقابلات الأسرية وبناء أهداف مشتركة.",
    icon: Users,
    outcomes: ["إدارة الحوار متعدد الأطراف", "رسم خريطة العلاقات", "استكشاف أنماط التواصل", "رصد السلامة وحدود الجلسة المشتركة"],
    units: ["مدخل إلى الإرشاد الأسري", "المقابلة الأسرية والموافقة", "الديناميات والأنماط التفاعلية", "التواصل وإدارة الخلاف", "السلامة والإحالة والمتابعة"],
    practice: "حلل نمط تفاعل أسري افتراضي، وحدد ما يحتاج إلى استيضاح قبل صياغة هدف مشترك.",
  },
  {
    id: "developmental",
    title: "مسار الاضطرابات النمائية والسلوكية",
    category: "النمو والسلوك التكيفي",
    summary: "تقدير النمو والسلوك والمهارات اليومية، وفهم السياق والاحتياجات الفردية.",
    icon: Workflow,
    outcomes: ["جمع التاريخ النمائي", "الملاحظة الوظيفية", "استكشاف السلوك التكيفي", "تحديد الدعم والإحالة"],
    units: ["النمو عبر المراحل", "التاريخ النمائي والصحي والتعليمي", "التواصل واللغة والحركة", "السلوك التكيفي والسياق", "التخطيط والإحالة متعددة التخصصات"],
    practice: "أنشئ خطاً زمنياً للنمو، وحدد مصادر المعلومات الناقصة ومؤشرات استكمال التقييم.",
  },
  {
    id: "autism",
    title: "مسار طيف التوحد",
    category: "التواصل والدعم الفردي",
    summary: "فهم التنوع العصبي والتواصل والاحتياجات الحسية مع التركيز على نقاط القوة والمشاركة.",
    icon: Activity,
    outcomes: ["استكشاف التاريخ النمائي", "ملاحظة التواصل في سياقات متعددة", "فهم الاحتياجات الحسية", "التعاون مع الأسرة والفريق"],
    units: ["التنوع العصبي ومفاهيم الطيف", "التواصل والتفاعل الاجتماعي", "الاهتمامات والاحتياجات الحسية", "التقدير الوظيفي", "الدعم الفردي والشراكة مع الأسرة"],
    practice: "ابنِ ملف نقاط قوة واحتياجات لشخص افتراضي دون تحويل سمة واحدة إلى تشخيص.",
  },
  {
    id: "psychometrics",
    title: "مسار التقييم والقياس النفسي",
    category: "القياس والتفسير",
    summary: "اختيار أدوات القياس الملائمة ومراجعة خصائصها السيكومترية والتفسير المسؤول.",
    icon: Microscope,
    outcomes: ["صياغة سؤال التقييم", "اختيار أداة ملائمة", "فهم الصدق والثبات والمعايير", "كتابة تقرير يوضح القيود"],
    units: ["مبادئ القياس النفسي", "الصدق والثبات والخطأ المعياري", "العينات والمعايير", "ملاءمة اللغة والثقافة والعمر", "التفسير والتقرير وحدود الاستخدام"],
    practice: "قارن بين غرضين افتراضيين للتقييم وحدد المعلومات التي تحتاج إليها قبل اختيار أداة.",
  },
  {
    id: "clinical-practice",
    title: "مسار الممارسة الإكلينيكية",
    category: "المقابلة وصياغة الحالة",
    summary: "دمج مهارات الاستقبال والمقابلة والتقدير والسلامة والتوثيق والإحالة.",
    icon: Stethoscope,
    outcomes: ["الموافقة والإطار المهني", "المقابلة وجمع التاريخ", "صياغة الحالة والفرضيات", "خطة السلامة والمتابعة"],
    units: ["الاستقبال والموافقة المستنيرة", "المقابلة والتاريخ", "الملاحظة وصياغة الحالة", "تقدير السلامة وحدود الاختصاص", "التوثيق والإحالة والمتابعة"],
    practice: "أعد ملخصاً إكلينيكياً تدريبياً يميز المعلومات المؤكدة عن الفرضيات والبيانات الناقصة.",
  },
  {
    id: "professional-development",
    title: "مسارات مهنية قابلة للإضافة والتطوير",
    category: "تخصصات مستقبلية",
    summary: "إطار توسعي لإضافة تخصصات دقيقة وبرامج جديدة وفق احتياجات الميدان ومعايير الجودة.",
    icon: GraduationCap,
    outcomes: ["تحديد فجوات الممارسة", "تصميم نواتج تعلم قابلة للقياس", "ربط المحتوى بالكفاءات", "التطوير المستمر تحت الإشراف"],
    units: ["تحليل الاحتياج المهني", "تصميم مسار تخصصي", "تحديد الكفاءات والمخرجات", "بناء أدوات الممارسة", "مراجعة الجودة والتحديث"],
    practice: "اقترح مجالاً تخصصياً جديداً وحدد الفئة المستهدفة والكفاءات ونواتج التعلم المطلوبة لإضافته لاحقاً.",
  },
] as const;

const scaleTools = [
  {
    id: "screening",
    title: "أدوات التحري والكشف الأولي",
    purpose: "تنظيم رصد مؤشرات تستدعي استكمال التقييم أو الإحالة، لا إثبات التشخيص ولا نفيه.",
    examples: "استبيانات التحري النمائي أو السلوكي المناسبة للفئة والسياق.",
    workflow: ["حدد سبب التحري والفئة المستهدفة", "تحقق من اللغة والعمر وملاءمة الأداة", "اجمع المعلومات من مصدر مناسب", "فسّر النتيجة وفق الدليل وحدودها", "خطط للمتابعة أو الإحالة عند الحاجة"],
    caution: "النتيجة الإيجابية لا تثبت تشخيصاً، والنتيجة السلبية لا تستبعده. لا تُستخدم الأداة خارج الفئة أو الغرض المخصص لها.",
  },
  {
    id: "autism-assessment",
    title: "أدوات التقييم المتخصص للتوحد",
    purpose: "تنظيم معلومات التاريخ النمائي والمقابلة والملاحظة المنظمة والتواصل والسلوك في السياق.",
    examples: "من أمثلة الأدوات المتخصصة: ADOS-2 وADI-R؛ تتطلب التدريب والتأهيل والترخيص وشروط التطبيق المعتمدة.",
    workflow: ["اجمع وصف الأسرة ومصادر أخرى", "راجع التاريخ النمائي والصحي", "خطط للملاحظة والتفاعل المناسب", "افحص الفروق والظروف المصاحبة", "ادمج كل الأدلة مع الحكم المهني المخول"],
    caution: "لا يجوز نسخ بنود أو مواد أو بروتوكولات الأدوات المحمية داخل المنصة دون إذن. التدريب هنا على سير العمل وليس تقديم نسخة بديلة منها.",
  },
  {
    id: "adaptive",
    title: "مقاييس السلوك التكيفي",
    purpose: "فهم المهارات المفاهيمية والاجتماعية والعملية والأداء اليومي ومستوى الدعم المطلوب.",
    examples: "من أمثلة الأدوات المقننة Vineland-3 وABAS-3؛ تحقق من الدليل والإصدار والتأهيل المطلوب.",
    workflow: ["حدد البيئات اليومية المهمة", "اجمع أمثلة سلوكية من أكثر من مخبر", "وثق ما ينجزه الشخص باستقلال", "حدد أثر البيئة والتيسيرات", "حوّل النتائج إلى احتياجات دعم وظيفية"],
    caution: "لا تستنتج مستوى الإعاقة الذهنية من استبيان واحد أو درجة منفردة؛ التفسير يتطلب دمج الأداء الفكري والتكيفي والتاريخ النمائي بواسطة مختص مؤهل.",
  },
  {
    id: "cognitive",
    title: "التقييم المعرفي والتعليمي",
    purpose: "استكشاف التعلم والاستدلال والذاكرة واللغة والأداء الأكاديمي عند وجود سؤال تقييم محدد.",
    examples: "اختبارات القدرة المعرفية والتحصيل المقننة، مثل مقاييس Wechsler، وفق النسخة والفئة والترخيص.",
    workflow: ["حدد السؤال الذي سيجيب عنه التقييم", "تحقق من ملاءمة اللغة والثقافة والعمر", "راجع ظروف التطبيق والعوامل المؤثرة", "اتبع قواعد التصحيح والتفسير الرسمية", "اربط النتائج بالأداء اليومي ولا تعممها على كل القدرات"],
    caution: "هذه الأدوات ليست اختبارات ذاتية أو نماذج مجانية داخل المنصة. لا تعرض المنصة مواد الاختبار أو مفاتيح التصحيح أو معايير محمية.",
  },
  {
    id: "functioning",
    title: "مقاييس الأداء الوظيفي والمشاركة",
    purpose: "وصف أثر الحالة في النشاط والمشاركة والبيئة والعوائق والتيسيرات.",
    examples: "إطار منظمة الصحة العالمية ICF، وأدوات قياس الأداء الوظيفي المناسبة للسؤال المهني.",
    workflow: ["حدد الأنشطة التي تهم الشخص", "استكشف المشاركة في البيت والتعليم والمجتمع", "حدد العوامل البيئية الميسرة أو المعوقة", "وثق الاحتياج والدعم المتاح", "راجع التغير بعد تطبيق التيسيرات"],
    caution: "يجب أن تكون الأداة متوافقة مع الغرض، وألا تتحول الملاحظات الوظيفية إلى استنتاج طبي غير مخول.",
  },
] as const;

const initialCaseDraft = {
  question: "",
  history: "",
  observation: "",
  strengths: "",
  context: "",
  risk: "",
  hypothesis: "",
  nextSteps: "",
};

const differentialPractice = [
  {
    title:"حالة افتراضية: أعراض مزاجية وتأثر وظيفي",
    prompt:"يذكر بالغ انخفاض المزاج واضطراب النوم وتراجع الأداء منذ فترة، مع معلومات غير مكتملة عن الصحة الجسدية والأدوية والضغوط. ما الخطوة المهنية الأدق؟",
    options:[
      {id:"mood-diagnose",label:"تأكيد اضطراب اكتئابي من الوصف المختصر.",correct:false,feedback:"الأعراض وحدها لا تكفي؛ يلزم استكمال المدة والشدة والأثر والبدائل الطبية والسياقية بواسطة مختص مخول."},
      {id:"mood-assess",label:"استكمال التاريخ والأثر الوظيفي والسلامة والعوامل الطبية والدوائية، ثم إحالة التقييم التشخيصي للمختص المخول.",correct:true,feedback:"صحيح. يجمع هذا الخيار الأدلة ويستكشف البدائل ويحترم حدود الاختصاص."},
      {id:"mood-ignore",label:"اعتبارها ضغوطاً عابرة دون استيضاح.",correct:false,feedback:"لا يجوز التقليل من الأعراض أو تجاهل أثرها ومؤشرات السلامة."}
    ]
  },
  {
    title:"حالة افتراضية: اختلافات نمائية ومهارات تكيفية",
    prompt:"توجد ملاحظات عن تأخر بعض المهارات وصعوبة في الاستقلال اليومي، لكن الأداء يختلف بين المنزل والمدرسة. ما المعلومات اللازمة قبل أي استنتاج؟",
    options:[
      {id:"adaptive-score",label:"الاعتماد على استبيان واحد وتحديد مستوى الإعاقة مباشرة.",correct:false,feedback:"لا تكفي أداة واحدة ولا درجة منفردة لإثبات تشخيص أو تحديد مستوى الدعم."},
      {id:"adaptive-multi",label:"جمع التاريخ النمائي ومصادر متعددة وأمثلة عن الأداء التكيفي والسياق، مع تقييم فكري وتكيفي لدى فريق مؤهل عند الحاجة.",correct:true,feedback:"صحيح. يتطلب التقييم دمج الأداء التكيفي والوظائف الفكرية والتاريخ والسياق بواسطة مختصين مؤهلين."},
      {id:"adaptive-age",label:"مقارنة العمر الزمني بالعمر الدراسي فقط.",correct:false,feedback:"هذه المقارنة لا تمثل الأداء التكيفي أو القدرات في الحياة اليومية."}
    ]
  },
  {
    title:"حالة افتراضية: نتيجة تحرٍّ إيجابية",
    prompt:"أظهرت أداة تحرٍّ نمائية مؤشرات تستحق المتابعة، بينما لا توجد مقابلة شاملة أو ملاحظة متعددة السياقات. كيف تفسر النتيجة؟",
    options:[
      {id:"screen-positive",label:"اعتبار نتيجة التحري تشخيصاً نهائياً.",correct:false,feedback:"التحري يحدد الحاجة إلى استكمال التقييم ولا يثبت التشخيص."},
      {id:"screen-negative",label:"إلغاء النتيجة لأن التحري ليس تشخيصاً.",correct:false,feedback:"كونها غير تشخيصية لا يعني تجاهلها؛ ينبغي تفسيرها وفق دليل الأداة والسياق."},
      {id:"screen-follow",label:"شرح حدود التحري، واستكمال التاريخ والملاحظة والإحالة المناسبة دون تأخير غير مبرر.",correct:true,feedback:"صحيح. تُستخدم النتيجة كإشارة لمسار تقييم أوسع لا كحكم نهائي."}
    ]
  }
] as const;

const reasoningChoices = [
  { id: "single", label: "تأكيد اضطراب محدد اعتماداً على هذه المؤشرات وحدها.", correct: false },
  { id: "screen", label: "استخدام نتيجة أداة تحرٍّ باعتبارها تشخيصاً نهائياً.", correct: false },
  { id: "team", label: "استكمال التاريخ النمائي ومصادر المعلومات والملاحظة في سياقات متعددة، ثم مناقشة البدائل والإحالة إلى فريق مؤهل.", correct: true },
  { id: "wait", label: "تجاهل المؤشرات حتى تظهر صعوبات أشد.", correct: false },
] as const;

function sectionFromQuery(value: string | null): Section {
  if (value === "case-study") return "case-study";
  if (value === "scales") return "scales";
  if (value === "reasoning") return "reasoning";
  return "paths";
}

export default function SpecialistTrainingHub() {
  const params = useSearchParams();
  const requestedTrack = params.get("track");
  const [managedTracks, setManagedTracks] = useState<ManagedTrack[]>([]);
  const [tracksLoaded, setTracksLoaded] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState(requestedTrack || "social-work");
  const [section, setSection] = useState<Section>(() => sectionFromQuery(params.get("section")));

  useEffect(() => {
    let active = true;
    fetch("/api/specialist-tracks", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل المسارات.");
        if (active && Array.isArray(data.tracks)) {
          setManagedTracks(data.tracks as ManagedTrack[]);
          setTracksLoaded(true);
        }
      })
      .catch((error) => console.error("ETZAN specialist tracks unavailable", error));
    return () => { active = false; };
  }, []);

  const allTracks = useMemo<readonly DisplayTrack[]>(() => {
    if (!tracksLoaded) return tracks;
    const byId = new Map(managedTracks.map((track) => [track.id, track]));
    const builtIn = tracks
      .filter((track) => byId.has(track.id))
      .map((track) => {
        const managed = byId.get(track.id);
        if (!managed?.isManaged) return track as DisplayTrack;
        return {
          ...track,
          title: managed.title || track.title,
          category: managed.category || track.category,
          summary: managed.summary || track.summary,
          outcomes: managed.outcomes?.length ? managed.outcomes : track.outcomes,
          units: managed.units?.length ? managed.units : track.units,
          practice: managed.practice || track.practice,
          icon: trackIcons[managed.iconName || ""] || track.icon,
        };
      });
    const custom = managedTracks.filter((track) => track.isCustom).map((track): DisplayTrack => ({
      id: track.id,
      title: track.title,
      category: track.category || "تخصص مهني",
      summary: track.summary,
      outcomes: track.outcomes?.length ? track.outcomes : (track.skills || []),
      units: track.units?.length ? track.units : (track.skills || []),
      practice: track.practice || "طبّق المهارات المستهدفة على حالة تدريبية افتراضية، ثم راجع النتائج مع مشرف مؤهل.",
      icon: trackIcons[track.iconName || ""] || GraduationCap,
    }));
    return [...builtIn, ...custom];
  }, [managedTracks, tracksLoaded]);

  const activeTrackId = allTracks.some((track) => track.id === selectedTrackId)
    ? selectedTrackId
    : allTracks[0]?.id || "";
  const [caseDraft, setCaseDraft] = useState(initialCaseDraft);
  const [caseSummary, setCaseSummary] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState<string>(scaleTools[0].id);
  const [reasoningAnswer, setReasoningAnswer] = useState<string>("");
  const [differentialAnswers, setDifferentialAnswers] = useState<Record<number,string>>({});
  const activeTrack = allTracks.find((track) => track.id === activeTrackId) ?? allTracks[0] ?? tracks[0];
  const activeTool = scaleTools.find((tool) => tool.id === selectedToolId) ?? scaleTools[0];
  const TrackIcon = activeTrack.icon;
  const academyTrackId = activeTrackId;

  const updateDraft = (key: keyof typeof initialCaseDraft, value: string) => {
    setCaseDraft((current) => ({ ...current, [key]: value }));
    setCaseSummary(false);
  };

  const caseSummaryText = [
    "ملخص دراسة حالة تدريبية — بيانات افتراضية فقط",
    "سؤال الإحالة: " + (caseDraft.question || "لم يُحدد بعد"),
    "التاريخ والسياق: " + (caseDraft.history || "معلومات ناقصة"),
    "الملاحظات ومصدرها: " + (caseDraft.observation || "لم تُوثق ملاحظة بعد"),
    "نقاط القوة والاهتمامات: " + (caseDraft.strengths || "تحتاج إلى استكشاف"),
    "السياق الأسري والتعليمي والمجتمعي: " + (caseDraft.context || "يحتاج إلى استكمال"),
    "عوامل الخطورة والحماية: " + (caseDraft.risk || "تحتاج إلى تقييم"),
    "فرضية تعليمية أولية وبدائلها: " + (caseDraft.hypothesis || "لم تُصغ بعد"),
    "خطوات التقييم أو الإحالة أو الدعم: " + (caseDraft.nextSteps || "لم تُحدد بعد"),
    "",
    "تنبيه: هذه مسودة تعليمية غير محفوظة، وليست تقريراً سريرياً أو تشخيصاً.",
  ].join("\n");

  return (
    <PlatformLayout
      title="مركز التدريب التخصصي والاستشاري"
      eyebrow="الأكاديمية المهنية · الخدمة الاجتماعية · الصحة النفسية · النمو"
      description="مسارات تعلم وممارسة تطبيقية لتدريب المختصين على دراسة الحالة، واختيار المقاييس، وقراءة الأدلة، وبناء الفرضيات وخطط الدعم تحت الإشراف."
    >
      <div className="specialist-hub">
        <section className="specialist-hero">
          <div className="specialist-hero-copy">
            <span className="specialist-kicker"><Sparkles size={14} /> تعلم منهجي من المعرفة إلى الممارسة</span>
            <h2>من دراسة الحالة إلى صياغة مهنية قائمة على الأدلة</h2>
            <p>تعلم، طبّق، ناقش، ثم راجع عملك مع المشرف. كل حالة تدريبية افتراضية، وكل نتيجة مرتبطة بمصدرها وحدودها.</p>
            <div className="specialist-hero-actions">
              <button type="button" className="specialist-primary" onClick={() => setSection("case-study")}>ابدأ دراسة حالة <ArrowLeft size={16} /></button>
              <Link href="/simulation" className="specialist-secondary">ادخل قاعة VR <ArrowLeft size={15} /></Link>
            </div>
          </div>
          <div className="specialist-hero-mark">
            <div className="specialist-orbit orbit-one"></div>
            <div className="specialist-orbit orbit-two"></div>
            <div className="specialist-hero-icon"><Brain size={42} /></div>
            <span>التعلم بالممارسة والإشراف</span>
          </div>
        </section>

        <div className="specialist-principles">
          <div><ShieldAlert size={18} /><span><strong>حدود الدور</strong><small>التدريب لا يمنح صلاحية التشخيص أو العلاج</small></span></div>
          <div><Users size={18} /><span><strong>منظور متعدد التخصصات</strong><small>الشخص والأسرة والبيئة والفريق</small></span></div>
          <div><FileCheck2 size={18} /><span><strong>قرار موثق</strong><small>كل فرضية ترتبط بدليل ومعلومة ناقصة</small></span></div>
        </div>

        <nav className="specialist-tabs" aria-label="أقسام مركز التدريب">
          <button type="button" className={section === "paths" ? "active" : ""} onClick={() => setSection("paths")}><GraduationCap size={16} /> المسارات التخصصية</button>
          <button type="button" className={section === "case-study" ? "active" : ""} onClick={() => setSection("case-study")}><ClipboardList size={16} /> ورشة دراسة الحالة</button>
          <button type="button" className={section === "scales" ? "active" : ""} onClick={() => setSection("scales")}><Microscope size={16} /> المقاييس والتقييم</button>
          <button type="button" className={section === "reasoning" ? "active" : ""} onClick={() => setSection("reasoning")}><Brain size={16} /> التفكير التشخيصي</button>
          <button type="button" className={section === "support" ? "active" : ""} onClick={() => setSection("support")}><HeartHandshake size={16} /> التدخل والإشراف</button>
        </nav>

        {section === "paths" && (
          <section className="specialist-section">
            <div className="specialist-section-heading"><div><span>01 · المسارات التعليمية</span><h3>اختر المجال الذي تريد التخصص فيه</h3><p>كل مسار يضم موضوعات معرفية ومهارات وممارسة تطبيقية قابلة للتقييم.</p></div><BookOpen size={22} /></div>
            <div className="specialist-track-layout">
              <div className="specialist-track-list">
                {allTracks.map((track) => {
                  const Icon = track.icon;
                  return <button type="button" key={track.id} onClick={() => setSelectedTrackId(track.id)} className={activeTrackId === track.id ? "specialist-track-button selected" : "specialist-track-button"}>
                    <span><Icon size={18} /></span><span><strong>{track.title}</strong><small>{track.category}</small></span><ArrowLeft size={14} />
                  </button>;
                })}
              </div>
              {allTracks.length ? <article className="specialist-track-detail">
                <div className="specialist-track-detail-top"><span className="specialist-track-icon"><TrackIcon size={23} /></span><small>{activeTrack.category}</small></div>
                <h4>{activeTrack.title}</h4><p>{activeTrack.summary}</p>
                <div className="specialist-detail-columns">
                  <div><strong>المهارات المستهدفة</strong><ul>{activeTrack.outcomes.map((item) => <li key={item}>{item}</li>)}</ul></div>
                  <div><strong>الخطة التعليمية</strong><ol>{activeTrack.units.map((item) => <li key={item}>{item}</li>)}</ol></div>
                </div>
                <div className="specialist-practice-note"><Lightbulb size={17} /><span><strong>تطبيق عملي</strong>{activeTrack.practice}</span></div>
                <div className="specialist-detail-actions">
                  <Link href={"/academy?track=" + academyTrackId} className="specialist-primary">الدورات والبرامج <ArrowLeft size={15} /></Link>
                  <Link href="/cases" className="specialist-secondary">الحالات التدريبية <ArrowLeft size={15} /></Link>
                </div>
              </article> : <div className="specialist-callout"><ShieldAlert size={18}/><p>لا توجد مسارات نشطة حالياً. تواصل مع إدارة المنصة لإعادة تفعيل مسار مهني.</p></div>}
            </div>
          </section>
        )}

        {section === "case-study" && (
          <section className="specialist-section">
            <div className="specialist-section-heading"><div><span>02 · منهجية دراسة الحالة</span><h3>ورقة عمل تدريبية متكاملة</h3><p>اكتب ملاحظاتك مع التمييز بين ما أبلغ به المصدر، وما لاحظته، وما يزال افتراضاً يحتاج إلى تحقق.</p></div><ClipboardCheck size={22} /></div>
            <div className="specialist-callout"><ShieldAlert size={18} /><p>استخدم معلومات خيالية فقط. لا تكتب أسماء أشخاص حقيقيين أو بيانات تعريفية أو سجلات مرضى. تحفظ هذه المسودة في الشاشة الحالية فقط ولا تُرسل إلى قاعدة بيانات.</p></div>
            <form className="specialist-case-form" onSubmit={(event) => { event.preventDefault(); setCaseSummary(true); }}>
              <label><span>1. سؤال الإحالة والسبب الرئيسي لطلب المساعدة</span><textarea value={caseDraft.question} onChange={(event) => updateDraft("question", event.target.value)} placeholder="ما السؤال الذي نحتاج إلى فهمه؟ ومن الذي طلب التقييم؟" rows={3} /></label>
              <label><span>2. التاريخ النمائي أو النفسي أو الاجتماعي ذي الصلة</span><textarea value={caseDraft.history} onChange={(event) => updateDraft("history", event.target.value)} placeholder="متى بدأت الصعوبة؟ ما التغيرات السابقة؟ ما المعلومات الصحية والتعليمية والأسرية المتاحة؟" rows={3} /></label>
              <label><span>3. الملاحظات المباشرة ومصدر كل معلومة</span><textarea value={caseDraft.observation} onChange={(event) => updateDraft("observation", event.target.value)} placeholder="ماذا لاحظت بنفسك؟ وماذا ورد من الأسرة أو المدرسة أو الشخص؟ وفي أي سياق؟" rows={3} /></label>
              <label><span>4. نقاط القوة والاهتمامات والمهارات</span><textarea value={caseDraft.strengths} onChange={(event) => updateDraft("strengths", event.target.value)} placeholder="ما الذي ينجزه الشخص؟ ما اهتماماته؟ ما الظروف التي تساعده على المشاركة؟" rows={3} /></label>
              <label><span>5. السياق الأسري والتعليمي والاجتماعي والبيئي</span><textarea value={caseDraft.context} onChange={(event) => updateDraft("context", event.target.value)} placeholder="ما العوامل الثقافية واللغوية والبيئية؟ ما التيسيرات والعوائق وشبكات الدعم؟" rows={3} /></label>
              <label><span>6. عوامل الخطورة والحماية واحتياجات السلامة</span><textarea value={caseDraft.risk} onChange={(event) => updateDraft("risk", event.target.value)} placeholder="ما عوامل الخطر والحماية؟ هل توجد مؤشرات تستوجب إيقاف التدريب والإحالة العاجلة؟" rows={3} /></label>
              <label><span>7. الفرضية التعليمية والبدائل التي يجب فحصها</span><textarea value={caseDraft.hypothesis} onChange={(event) => updateDraft("hypothesis", event.target.value)} placeholder="ما التفسيرات المحتملة؟ ما الأدلة الداعمة والمعارضة؟ ما الذي لا نعرفه بعد؟" rows={3} /></label>
              <label><span>8. الخطوات التالية: معلومات أو مقاييس أو إحالة أو دعم</span><textarea value={caseDraft.nextSteps} onChange={(event) => updateDraft("nextSteps", event.target.value)} placeholder="ما المصدر أو الأداة المناسبة؟ من المختص المخول؟ وما هدف الدعم القابل للمتابعة؟" rows={3} /></label>
              <div className="specialist-form-actions"><button type="submit" className="specialist-primary">إنشاء ملخص تدريبي <FileCheck2 size={16} /></button><button type="button" className="specialist-secondary" onClick={() => { setCaseDraft(initialCaseDraft); setCaseSummary(false); }}>مسح ورقة العمل</button></div>
            </form>
            {caseSummary && <section className="specialist-summary"><div><CheckCircle2 size={18} /><strong>ملخص عملك التدريبي</strong></div><pre>{caseSummaryText}</pre></section>}
            <div className="specialist-link-row"><Link href="/cases">افتح مكتبة الحالات الافتراضية <ArrowLeft size={14} /></Link><Link href="/simulation">طبّق المقابلة داخل قاعة المحاكاة <ArrowLeft size={14} /></Link></div>
          </section>
        )}

        {section === "scales" && (
          <section className="specialist-section">
            <div className="specialist-section-heading"><div><span>03 · المقاييس وأدوات التقييم</span><h3>اختر الأداة بناءً على سؤال التقييم</h3><p>تعلم الفرق بين التحري والمقابلة والملاحظة والاختبار المقنن والتقدير الوظيفي.</p></div><Microscope size={22} /></div>
            <div className="specialist-scale-layout">
              <div className="specialist-scale-list">
                {scaleTools.map((tool) => <button type="button" key={tool.id} onClick={() => setSelectedToolId(tool.id)} className={selectedToolId === tool.id ? "selected" : ""}>{tool.title}<ArrowLeft size={14} /></button>)}
              </div>
              <article className="specialist-scale-detail">
                <span className="specialist-mini-label">الغرض: {activeTool.title}</span><h4>{activeTool.purpose}</h4>
                <p className="specialist-examples">{activeTool.examples}</p>
                <strong>خطوات الاستخدام المهني</strong>
                <ol>{activeTool.workflow.map((step) => <li key={step}>{step}</li>)}</ol>
                <div className="specialist-warning"><ShieldAlert size={17} /><span>{activeTool.caution}</span></div>
                <Link href="/assessments" className="specialist-primary">افتح مختبر المقاييس التطبيقي <ArrowLeft size={15} /></Link>
              </article>
            </div>
            <div className="specialist-callout"><ClipboardList size={18} /><p>قبل استخدام أي مقياس فعلي، راجع دليل الإصدار، والخصائص السيكومترية، والتقنين المحلي، والترجمة، والفئة المستهدفة، ومؤهلات التطبيق، وحقوق النشر والترخيص. لا تُدرج بنود أو مواد اختبار محمية دون تصريح.</p></div>
          </section>
        )}

        {section === "reasoning" && (
          <section className="specialist-section">
            <div className="specialist-section-heading"><div><span>04 · التفكير التشخيصي المنضبط</span><h3>تدرّب على بناء الفرضية لا القفز إلى التشخيص</h3><p>تعلّم ربط كل استنتاج بمصدر دليل، وتحديد التفسيرات البديلة والمعلومات الناقصة.</p></div><Stethoscope size={22} /></div>
            <div className="specialist-reasoning-case">
              <span className="specialist-mini-label">سيناريو افتراضي · طفل في سن ما قبل المدرسة</span>
              <h4>وردت ملاحظات عن اختلافات في التواصل الاجتماعي، والتمسك ببعض الروتينات، والانزعاج من أصوات معينة.</h4>
              <p>لا تتوفر بعد معلومات كافية عن التاريخ النمائي، واللغة والسمع، والأداء في المنزل والتعليم، أو أثر هذه الملاحظات في الحياة اليومية. ما الخطوة المهنية الأنسب؟</p>
              <div className="specialist-answer-list">
                {reasoningChoices.map((choice) => <button type="button" key={choice.id} className={reasoningAnswer === choice.id ? "selected" : ""} onClick={() => setReasoningAnswer(choice.id)}><span>{reasoningAnswer === choice.id ? "●" : "○"}</span>{choice.label}</button>)}
              </div>
              {reasoningAnswer && <div className={reasoningAnswer === "team" ? "specialist-feedback good" : "specialist-feedback"}>
                {reasoningAnswer === "team" ? <CheckCircle2 size={18} /> : <Lightbulb size={18} />}
                <p><strong>{reasoningAnswer === "team" ? "اختيار مهني مناسب" : "راجع منهج جمع الأدلة"}</strong>{reasoningAnswer === "team" ? "يجب استكمال التاريخ ومصادر المعلومات ومراجعة البدائل، ثم يقرر الفريق المؤهل نوع التقييم اللازم. لا تُعامل هذه الملاحظات بوصفها تشخيصاً." : "المؤشرات المفردة أو نتيجة التحري لا تكفي لتأكيد التشخيص أو نفيه. ابدأ باستكمال المعلومات والسياق واستكشاف التفسيرات الأخرى."}</p>
              </div>}
              <button type="button" className="specialist-secondary" onClick={() => setReasoningAnswer("")}>إعادة المحاولة</button>
            </div>
            <div className="specialist-diagnostic-flow">
              {["السؤال وسبب الإحالة", "مصادر الأدلة والتاريخ", "الفرضيات والبدائل", "المعلومات أو المقاييس الناقصة", "مراجعة مختص مخول", "خطة دعم ومتابعة"].map((item, index) => <div key={item}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span></div>)}
            </div>
            <div className="specialist-section-heading"><div><span>تمارين إضافية · تحليل الأدلة والبدائل</span><h3>تدريبات على التفكير التفريقي</h3><p>اختر الإجراء المهني الأكثر دقة في كل موقف، ثم راجع سبب الاختيار.</p></div><ClipboardList size={22}/></div>
            <div className="specialist-differential-grid">
              {differentialPractice.map((scenario,index)=>{
                const selected=scenario.options.find(option=>option.id===differentialAnswers[index]);
                return <article className="specialist-reasoning-case" key={scenario.title}>
                  <span className="specialist-mini-label">تمرين {String(index+1).padStart(2,"0")}</span>
                  <h4>{scenario.title}</h4><p>{scenario.prompt}</p>
                  <div className="specialist-answer-list">
                    {scenario.options.map(option=><button type="button" key={option.id} className={differentialAnswers[index]===option.id?"selected":""} onClick={()=>setDifferentialAnswers(current=>({...current,[index]:option.id}))}><span>{differentialAnswers[index]===option.id?"●":"○"}</span>{option.label}</button>)}
                  </div>
                  {selected&&<div className={selected.correct?"specialist-feedback good":"specialist-feedback"}><p><strong>{selected.correct?"تحليل مناسب":"راجع حدود الاستنتاج"}</strong>{selected.feedback}</p></div>}
                </article>;
              })}
            </div>
            <div className="specialist-callout"><InfoIcon /><p>التصنيف المرجعي للتدريب يكون بالرجوع إلى المراجع المهنية المعتمدة مثل متطلبات ICD-11، وبما يتوافق مع نظام بلد الممارسة وصلاحيات المهنة. الأداة لا تصدر تشخيصاً رسمياً ولا تحل محل التقييم السريري المتخصص.</p></div>
            <div className="specialist-link-row"><a href="https://www.who.int/publications-detail-redirect/9789240077263" target="_blank" rel="noreferrer">مرجع منظمة الصحة العالمية ICD-11 CDDR <ArrowLeft size={14} /></a><a href="https://www.nice.org.uk/guidance/cg128/chapter/Recommendations" target="_blank" rel="noreferrer">إرشادات NICE لتقييم التوحد لدى الأطفال <ArrowLeft size={14} /></a></div>
          </section>
        )}

        {section === "support" && (
          <section className="specialist-section">
            <div className="specialist-section-heading"><div><span>05 · التدخل المهني والإشراف</span><h3>من نتائج التقدير إلى خطة دعم قابلة للمتابعة</h3><p>خطة فردية مرتبطة بأولويات الشخص وموارده وبيئته، مع توضيح مسؤوليات الفريق.</p></div><HeartHandshake size={22} /></div>
            <div className="specialist-support-grid">
              <article><span>01</span><h4>تحديد الأولوية مع الشخص والأسرة</h4><p>ابدأ بما يهم الشخص في الحياة اليومية، مع تهيئة التواصل وتوفير خيارات مفهومة.</p></article>
              <article><span>02</span><h4>أهداف وظيفية واضحة</h4><p>اكتب هدفاً قابلاً للملاحظة في سياق محدد، وحدد خط الأساس ومؤشر المتابعة.</p></article>
              <article><span>03</span><h4>تيسيرات ودعم فردي</h4><p>اربط الخطة بالاحتياجات الحسية والتواصلية والتعليمية والاجتماعية والبيئية.</p></article>
              <article><span>04</span><h4>تنسيق متعدد التخصصات</h4><p>حدد ما يقع ضمن دورك وما يحتاج إلى طبيب أو أخصائي نفسي أو نطق أو تربية خاصة.</p></article>
              <article><span>05</span><h4>مراجعة الأثر</h4><p>تابع المشاركة وجودة الحياة والهدف المتفق عليه، لا مجرد عدد الجلسات أو الامتثال.</p></article>
              <article><span>06</span><h4>إشراف وتوثيق</h4><p>ناقش الأدلة والقرارات والمخاطر والتحيزات مع مشرف مؤهل، ووثق حدود الثقة.</p></article>
            </div>
            <div className="specialist-practice-links">
              <Link href="/competencies"><ChartIcon /> ملف الكفاءات وتقييم الأداء</Link>
              <Link href="/supervision"><Users size={17} /> غرف الإشراف المهني</Link>
              <Link href="/cases"><BookOpen size={17} /> مكتبة الحالات</Link>
              <Link href="/simulation"><Activity size={17} /> المحاكاة الواقعية VR</Link>
            </div>
          </section>
        )}

        <footer className="specialist-footer-note">
          <ShieldAlert size={16} />
          <p><strong>ضوابط الاستخدام:</strong> المنصة تعليمية وتدريبية. الحالات خيالية، ولا تقدم علاجاً فعلياً أو تشخيصاً رسمياً أو قرار أهلية. لا تدخل بيانات مرضى حقيقيين. تعامل مع أي خطر واقعي عبر بروتوكول المؤسسة والإحالة البشرية المختصة.</p>
        </footer>
      </div>
    </PlatformLayout>
  );
}

function InfoIcon() {
  return <ShieldAlert size={18} />;
}

function ChartIcon() {
  return <Activity size={17} />;
}
