export type ProfessionalToolField = { key: string; label: string };
export type ProfessionalToolTemplate = {
  id: string;
  title: string;
  group: string;
  description: string;
  fields: ProfessionalToolField[];
  allowedRoles: string[];
  allowDownload: boolean;
  allowPrint: boolean;
  status: "draft" | "published" | "archived";
  updatedAt?: string | Date;
};

const roles = ["admin", "platform_manager", "supervisor", "trainer", "trainee", "consultant", "quality_manager"];

function fields(entries: Array<[string, string]>): ProfessionalToolField[] {
  return entries.map(([key, label]) => ({ key, label }));
}

export const defaultProfessionalTemplates: ProfessionalToolTemplate[] = [
  { id: "case-study", title: "نموذج دراسة الحالة", group: "التوثيق ودراسة الحالة", description: "توثيق الحالة والسياق والاحتياجات والموارد والفرضيات المهنية.", allowedRoles: roles, allowDownload: true, allowPrint: true, status: "published", fields: fields([["code","رمز الحالة غير التعريفي"],["date","تاريخ الدراسة"],["source","مصدر الإحالة وسببها"],["problem","المشكلة كما يصفها المستفيد"],["history","تاريخ المشكلة والتطورات"],["family","السياق الأسري والاجتماعي"],["strengths","نقاط القوة والموارد"],["risks","عوامل الخطورة والحماية"],["needs","الاحتياجات والأولويات"],["formulation","الصياغة والفرضيات المهنية"],["recommendations","التوصيات والإجراءات المقترحة"]]) },
  { id: "social-assessment", title: "نموذج التقييم الاجتماعي", group: "التقييم والتقدير", description: "تقدير الظروف الاجتماعية والموارد والاحتياجات متعددة الأبعاد.", allowedRoles: roles, allowDownload: true, allowPrint: true, status: "published", fields: fields([["date","تاريخ التقييم"],["housing","ظروف السكن والمعيشة"],["family","التركيب الأسري وشبكة الدعم"],["education","التعليم والعمل والوضع الاقتصادي"],["services","الوصول إلى الخدمات"],["relations","العلاقات والتفاعل الاجتماعي"],["function","الأداء والمهام اليومية"],["strengths","الموارد ونقاط القوة"],["needs","الاحتياجات ذات الأولوية"],["barriers","العوائق والتحديات"],["summary","ملخص التقدير الاجتماعي"]]) },
  { id: "care-plan", title: "نموذج الخطة العلاجية والإرشادية", group: "التخطيط والتدخل", description: "خطة أهداف وتدخلات ومؤشرات متابعة قابلة للمراجعة والإشراف.", allowedRoles: roles, allowDownload: true, allowPrint: true, status: "published", fields: fields([["date","تاريخ إعداد الخطة"],["goal","الهدف العام"],["objectives","الأهداف المرحلية القابلة للقياس"],["interventions","التدخلات والأنشطة الإرشادية أو الداعمة"],["roles","المسؤوليات والأدوار"],["resources","الموارد والتيسيرات المطلوبة"],["timeline","الإطار الزمني"],["indicators","مؤشرات التقدم والنتائج المتوقعة"],["risks","التحديات وخطة التعامل معها"],["review","موعد مراجعة الخطة"]]) },
  { id: "interview", title: "نموذج المقابلات المهنية", group: "المقابلات والتواصل", description: "تسجيل هدف المقابلة والموافقة ومحاور الحوار والملاحظات.", allowedRoles: roles, allowDownload: true, allowPrint: true, status: "published", fields: fields([["date","تاريخ ووقت المقابلة"],["purpose","نوع المقابلة وهدفها"],["participants","المشاركون وصفاتهم المهنية"],["consent","الموافقة وحدود السرية الموضحة"],["questions","الأسئلة والمحاور الرئيسية"],["responses","ملخص الاستجابات والمعلومات"],["observations","الملاحظات المهنية المباشرة"],["strengths","نقاط القوة والموارد"],["summary","ملخص المقابلة"],["next","الإجراء التالي وموعده"]]) },
  { id: "follow-up", title: "نموذج المتابعة", group: "المتابعة والمراجعة", description: "متابعة تنفيذ الخطة ورصد التغير والعوائق والإجراءات التالية.", allowedRoles: roles, allowDownload: true, allowPrint: true, status: "published", fields: fields([["date","تاريخ المتابعة"],["goal","الهدف محل المتابعة"],["progress","التقدم والتغير الملحوظ"],["evidence","الشواهد والمعلومات الداعمة"],["barriers","العوائق والصعوبات"],["view","وجهة نظر المستفيد"],["support","الدعم أو التيسيرات المطلوبة"],["status","حالة التنفيذ والنتيجة"],["action","الإجراء التالي والمسؤول عنه"],["nextDate","موعد المتابعة القادمة"]]) },
  { id: "referral", title: "نموذج الإحالة", group: "الإحالات والتنسيق", description: "تنظيم الإحالة والجهة المستقبلة والموافقة ومتابعة الاستلام.", allowedRoles: roles, allowDownload: true, allowPrint: true, status: "published", fields: fields([["date","تاريخ الإحالة"],["entity","الجهة أو التخصص المحال إليه"],["reason","سبب الإحالة والهدف منها"],["urgency","درجة الأولوية والإطار الزمني"],["summary","ملخص مهني مختصر وغير معرّف"],["request","الخدمة أو الإجراء المطلوب"],["consent","الموافقة على الإحالة ومشاركة المعلومات"],["documents","المرفقات اللازمة"],["contact","بيانات التواصل المؤسسية"],["followup","تأكيد الاستلام والمتابعة"]]) },
  { id: "professional-assessment", title: "نموذج التقييم المهني", group: "التقييم والتطوير المهني", description: "مراجعة الكفاءات والسلوك المهني والأدلة وخطة التطوير والإشراف.", allowedRoles: roles, allowDownload: true, allowPrint: true, status: "published", fields: fields([["date","تاريخ التقييم وفترته"],["role","الدور أو الممارسة محل التقييم"],["competencies","الكفاءات والمعايير التي تمت مراجعتها"],["evidence","الأدلة والشواهد المهنية"],["strengths","نقاط القوة والإنجازات"],["development","جوانب تحتاج إلى تطوير"],["ethics","الالتزام بأخلاقيات المهنة والسرية"],["supervision","ملاحظات المشرف أو المراجع"],["plan","خطة التطوير والإجراءات المتفق عليها"],["review","موعد المراجعة القادمة"]]) }
];

export async function ensureDefaultProfessionalTemplates(db: import("mongodb").Db) {
  const collection = db.collection("etzan_tool_templates");
  await Promise.all(defaultProfessionalTemplates.map((template) => collection.updateOne(
    { templateId: template.id },
    { $setOnInsert: { ...template, templateId: template.id, createdAt: new Date(), updatedAt: new Date(), createdBy: "system-seed" } },
    { upsert: true },
  )));
}
