import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const learner = await requirePlatformRole(request, ["trainee"]);
  if (!learner) {
    return NextResponse.json({ error: "سجّل الدخول بحساب الطالب لعرض كتبك." }, { status: 401 });
  }

  try {
    const db = await getClinicalDatabase();
    const purchases = await db.collection("platform_requests").find(
      {
        kind: "book_order",
        status: "approved",
        paymentStatus: { $in: ["paid", "coupon_redeemed"] },
        $or: [
          { userId: learner.userId },
          { userId: { $exists: false }, email: learner.email.toLowerCase() },
        ],
      },
      {
        projection: {
          _id: 0, requestId: 1, items: 1, createdAt: 1, paidAt: 1,
          couponRedeemedAt: 1, paymentStatus: 1,
        },
      },
    ).sort({ createdAt: -1 }).limit(200).toArray();

    const bookIds = [...new Set(purchases.flatMap((order) =>
      Array.isArray(order.items)
        ? order.items.flatMap((item: unknown) => item && typeof item === "object" &&
          typeof (item as Record<string, unknown>).bookId === "string"
          ? [String((item as Record<string, unknown>).bookId)]
          : [])
        : [],
    ))];

    const storedBooks = bookIds.length
      ? await db.collection("etzan_books").find(
          { bookId: { $in: bookIds } },
          {
            projection: {
              _id: 0, bookId: 1, title: 1, author: 1, category: 1, description: 1,
              format: 1, productType: 1, price: 1, currency: 1, coverUrl: 1,
            },
          },
        ).toArray()
      : [];
    const bookById = new Map(storedBooks.map((book) => [String(book.bookId), book]));
    const owned = new Map<string, Record<string, unknown>>();

    for (const order of purchases) {
      if (!Array.isArray(order.items)) continue;
      for (const raw of order.items) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        const bookId = typeof item.bookId === "string" ? item.bookId : "";
        const quantity = Number(item.quantity);
        if (!bookId || !Number.isInteger(quantity) || quantity < 1) continue;

        const stored = bookById.get(bookId);
        const existing = owned.get(bookId);
        if (existing) {
          existing.quantity = Number(existing.quantity) + quantity;
          continue;
        }
        owned.set(bookId, {
          bookId,
          title: String(stored?.title || item.title || "كتاب"),
          author: String(stored?.author || ""),
          category: String(stored?.category || ""),
          description: String(stored?.description || ""),
          format: String(stored?.format || (item.productType === "digital" ? "كتاب إلكتروني" : "كتاب ورقي")),
          productType: String(stored?.productType || item.productType || "digital"),
          currency: String(stored?.currency || "SAR"),
          coverUrl: typeof stored?.coverUrl === "string" ? stored.coverUrl : "",
          quantity,
          purchasedAt: order.paidAt || order.couponRedeemedAt || order.createdAt || null,
          requestId: String(order.requestId || ""),
          paymentStatus: String(order.paymentStatus || ""),
        });
      }
    }

    return NextResponse.json(
      { books: [...owned.values()] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Student books GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل كتبك حالياً." }, { status: 503 });
  }
}
