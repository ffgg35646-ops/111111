import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { expireStaleBookReservations } from "@/lib/book-orders";

export const runtime = "nodejs";

type Context = { params: Promise<{ bookId: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const { bookId } = await context.params;
  if (!bookId || bookId.length > 80) {
    return NextResponse.json({ error: "معرّف الكتاب غير صالح." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    await expireStaleBookReservations(db);
    const book = await db.collection("etzan_books").findOne(
      { bookId, published: true },
      { projection: { _id: 0, downloadUrl: 0, reserved: 0, sold: 0 } },
    );

    if (!book) {
      return NextResponse.json({ error: "الكتاب غير موجود أو لم يُنشر بعد." }, { status: 404 });
    }

    return NextResponse.json({ book }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Published book details GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل تفاصيل الكتاب." }, { status: 503 });
  }
}
