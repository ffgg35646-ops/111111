export type SimulationRubricCriterion = {
  key: string;
  label: string;
  description: string;
  weight: number;
  maxScore: number;
};

export type SimulationRubric = {
  rubricId: string;
  title: string;
  trackId: string;
  description: string;
  criteria: SimulationRubricCriterion[];
  status?: "active" | "inactive";
  version?: number;
};

export const DEFAULT_SIMULATION_RUBRIC: SimulationRubric = {
  rubricId: "default-clinical-rubric",
  title: "المعيار المهني العام للمحاكاة",
  trackId: "all",
  description: "معيار أساسي قابل للتخصيص وفق طبيعة المسار والحالة.",
  status: "active",
  version: 1,
  criteria: [
    { key: "communication", label: "التواصل وبناء العلاقة", description: "الافتتاح المهني والاحترام والوضوح.", weight: 15, maxScore: 5 },
    { key: "activeListening", label: "الإنصات وجمع المعلومات", description: "الأسئلة المفتوحة والاستيضاح وتلخيص المعلومات.", weight: 20, maxScore: 5 },
    { key: "evidenceReasoning", label: "الاستدلال وربط الفرضيات بالأدلة", description: "الفصل بين الوقائع والملاحظات والفرضيات والبدائل.", weight: 20, maxScore: 5 },
    { key: "assessmentSelection", label: "اختيار الأداة وحدود استخدامها", description: "ملاءمة الأداة والغرض ومراعاة حدود القياس.", weight: 10, maxScore: 5 },
    { key: "strengthsBasedPractice", label: "مراعاة نقاط القوة ووجهة نظر الحالة", description: "النهج المرتكز على الشخص والموارد والتفضيلات.", weight: 10, maxScore: 5 },
    { key: "planningAndReferral", label: "خطة الدعم والإحالة والمتابعة", description: "خطوات قابلة للقياس وتحديد مسؤوليات المتابعة.", weight: 15, maxScore: 5 },
    { key: "professionalBoundaries", label: "السلامة وحدود الاختصاص والخصوصية", description: "الموافقة والسرية والسلامة والإحالة عند الحاجة.", weight: 10, maxScore: 5 },
  ],
};
