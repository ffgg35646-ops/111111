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
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Platform admin overview failed", error);
    return NextResponse.json({ error: "تعذر تحميل إحصائيات الإدارة من قاعدة البيانات." }, { status: 503 });
  }
}
