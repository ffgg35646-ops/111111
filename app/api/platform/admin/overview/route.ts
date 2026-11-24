import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses, practiceScales } from "@/lib/platform-catalog";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بعرض مؤشرات لوحة الإدارة." }, { status: 403 });

  try {
    const db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    const requests = db.collection("platform_requests");
    const payments = db.collection("platform_payments");
    const certificates = db.collection("platform_certificates");
    const articles = db.collection("etzan_articles");
    const books = db.collection("etzan_books");
    const reports = db.collection("etzan_community_reports");
    const posts = db.collection("etzan_community_posts");

    const [
      usersTotal, usersActive, trainees, consultants,
      pendingRequests, consultationRequests, paidConsultations,
      paidPayments, paymentTotal, issuedCertificates, revokedCertificates,
      articlesTotal, publishedArticles, booksTotal, publishedBooks,
      openCommunityReports, pendingCommunityPosts, simulationReports,
      professionalForms, attendanceRecords, scheduledSessions, openConsultantSlots,
    ] = await Promise.all([
      users.countDocuments({}),
      users.countDocuments({ status: "active" }),
      users.countDocuments({ role: "trainee", status: "active" }),
      users.countDocuments({ role: "consultant", status: "active" }),
      requests.countDocuments({ status: "pending_review" }),
      requests.countDocuments({ kind: "consultation" }),
      requests.countDocuments({ kind: "consultation", status: "approved", paymentStatus: "paid" }),
      payments.countDocuments({ status: { $in: ["paid", "captured"] } }),
      payments.countDocuments({}),
      certificates.countDocuments({ status: "issued" }),
      certificates.countDocuments({ status: "revoked" }),
      articles.countDocuments({}),
      articles.countDocuments({ status: "published" }),
      books.countDocuments({}),
      books.countDocuments({ published: true }),
      reports.countDocuments({ status: "open" }),
      posts.countDocuments({ status: "pending_review" }),
      db.collection("platform_learning_activities").countDocuments({}),
      db.collection("etzan_professional_forms").countDocuments({}),
      db.collection("platform_classroom_attendance").countDocuments({}),
      db.collection("platform_classroom_sessions").countDocuments({ status: { $in: ["scheduled", "completed"] } }),
      db.collection("platform_consultant_slots").countDocuments({ status: "open", startsAt: { $gt: new Date() } }),
    ]);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totals: {
        usersTotal, usersActive, trainees, consultants,
        courses: courses.length,
        practiceScales: practiceScales.length,
        pendingRequests, consultationRequests, paidConsultations,
        paidPayments, paymentTotal,
        issuedCertificates, revokedCertificates,
        articlesTotal, publishedArticles, booksTotal, publishedBooks,
        openCommunityReports, pendingCommunityPosts, simulationReports,
        professionalForms, attendanceRecords, scheduledSessions, openConsultantSlots,
      },
      capability: {
        courseAssignment: true,
        courseCatalogEditing: false,
        licensedScaleEditing: false,
        recurringSubscriptions: false,
        electronicInvoicing: false,
        paymentsProvider: "Moyasar integration code is present; live processing depends on merchant credentials and acceptance testing.",
      },
      integrations: {
        database: { label: "قاعدة البيانات", configured: true, state: "connected", detail: "نجح الاتصال وقراءة مؤشرات التشغيل." },
        aiText: { label: "الذكاء الاصطناعي النصي", configured: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL === "1"), state: "configuration", detail: "يتطلب AI Gateway أو اتصال Vercel AI Gateway وإتاحة النموذج المحدد." },
        knowledgeSearch: { label: "بحث المعرفة الدلالي", configured: Boolean((process.env.AI_GATEWAY_API_KEY || process.env.VERCEL === "1") && process.env.ETZAN_AI_VECTOR_SEARCH_ENABLED === "true"), state: "configuration", detail: "يتطلب تفعيل البحث الدلالي وفهرس Atlas Vector Search مكتمل الفهرسة؛ البحث النصي البديل يظل متاحًا." },
        realtimeVoice: { label: "المحادثة الصوتية", configured: Boolean(process.env.OPENAI_API_KEY), state: "configuration", detail: "يتطلب OPENAI_API_KEY واعتماد النموذج الصوتي." },
        zoom: { label: "Zoom", configured: Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET && process.env.ZOOM_HOST_USER_ID), state: "configuration", detail: "وجود بيانات OAuth لا يغني عن اختبار إنشاء الاجتماع ورابط الدخول." },
        livekit: { label: "غرف LiveKit", configured: Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET), state: "configuration", detail: "يتطلب إعداد الخادم ومفاتيح LiveKit واختبار الانضمام." },
        moyasar: { label: "بوابة الدفع Moyasar", configured: Boolean(process.env.MOYASAR_SECRET_KEY && process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY && process.env.MOYASAR_WEBHOOK_SECRET), state: "configuration", detail: "وجود المفاتيح لا يثبت تفعيل الحساب التجاري أو نجاح عملية دفع فعلية." },
        avatar: { label: "نموذج الشخصية ثلاثية الأبعاد", configured: Boolean(process.env.NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL), state: "configuration", detail: "يتطلب رابط أصل GLB مرخصًا واختبار ظهوره على الأجهزة المستهدفة." },
      },
      operationalGaps: [
        "إدارة محتوى الدورات من لوحة الإدارة غير متاحة؛ المتاح حاليًا هو إسناد المدربين فقط.",
        "مصفوفة صلاحيات قابلة للتخصيص لكل عملية (عرض/إضافة/تعديل/حذف/اعتماد) غير منفذة.",
        "الكتب تدعم طلبًا مدفوعًا وتنزيلًا رقميًا محميًا وحجز/تسوية مخزون مادي؛ ما ينقص هو التكامل اللوجستي والشحن وتتبع التسليم وإدارة الإرجاع.",
        "لا توجد منظومة إشعارات داخلية موحدة؛ إشعارات بعض مسارات الاستشارات تعتمد البريد وإعداد مزود الإرسال.",
        "العميل يستطيع طلب الإلغاء وإعادة جدولة الموعد المدفوع؛ طلب الإلغاء المدفوع يبقى قيد مراجعة الاسترداد، بينما تذكيرات المواعيد ومزامنة Google/Outlook غير منفذة.",
        "إخراج الشهادة بصيغة PDF وحدود حضور قابلة للتخصيص لكل دورة غير مكتملين.",
        "تكامل الفوترة الإلكترونية للمرحلة الثانية مع ZATCA والتوقيع والإرسال غير منفذ.",
        "حقوق التوزيع والتطبيق الرقمي للمقاييس النفسية المرخصة يجب توفيرها والتحقق منها قبل تفعيلها.",
        "الواقع الافتراضي الحالي يعتمد WebXR داخل المتصفح؛ لا يوجد عميل أصلي Unreal/OpenXR تم تسليمه والتحقق منه.",
        "النسخ الاحتياطي التشغيلي، سياسة الاحتفاظ، والاستجابة للحوادث تحتاج اعتمادًا واختبارات في بيئة الإنتاج.",
        "اختبارات CI الحالية تتحقق من TypeScript وESLint ونجاح البناء فقط؛ اختبارات E2E وتكاملات فعلية للدفع والحجز وZoom وLiveKit غير مضافة إلى خط CI."
      ],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Platform admin overview failed", error);
    return NextResponse.json({ error: "تعذر تحميل إحصائيات الإدارة من قاعدة البيانات." }, { status: 503 });
  }
}
