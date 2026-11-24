export const defaultMembershipPlans = [
  {
    planId: "learner",
    name: "عضوية المتعلم",
    description: "مسار تعلّم منظم ومتابعة التقدم والشهادات.",
    monthlyPrice: 0,
    annualPrice: 0,
    features: ["الوصول إلى البرامج المتاحة حسب الاشتراك", "متابعة تقدم التعلم", "سجل الشهادات والإنجازات"],
  },
  {
    planId: "professional",
    name: "العضوية المهنية",
    description: "مزايا تعليمية ومجتمع مهني ومواد إضافية.",
    monthlyPrice: 0,
    annualPrice: 0,
    features: ["مزايا تعليمية مهنية", "المشاركة في المجتمع المهني", "مواد وأدوات إضافية مرخصة"],
  },
  {
    planId: "practitioner",
    name: "عضوية الممارس",
    description: "مسارات تخصصية متقدمة ومزايا تطوير مهني.",
    monthlyPrice: 0,
    annualPrice: 0,
    features: ["مسارات تخصصية متقدمة", "تقارير كفاءات وتطوير مهني", "مزايا إشراف حسب التعاقد"],
  },
] as const;
