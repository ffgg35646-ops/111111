"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Library, ShoppingBag } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type OwnedBook = {
  bookId: string;
  title: string;
  author?: string;
  category?: string;
  format?: string;
  productType: "digital" | "physical";
  coverUrl?: string;
  quantity: number;
  purchasedAt?: string | null;
};

export default function MyBooksPage() {
  const [books, setBooks] = useState<OwnedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/books/mine", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل كتبك.");
        if (active) setBooks(Array.isArray(data.books) ? data.books : []);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل كتبك.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <PlatformLayout title="كتبي" description="الكتب التي تم تأكيد شرائها وإضافتها إلى مكتبتك الشخصية.">
      <div className="my-books-page">
        {error && <div className="portal-callout" role="alert">{error}</div>}
        {loading ? (
          <div className="portal-card my-books-message">جارٍ تحميل كتبك...</div>
        ) : books.length === 0 ? (
          <section className="portal-card my-books-empty">
            <span><Library size={31}/></span>
            <h2>لم تتم إضافة كتب إلى مكتبتك بعد</h2>
            <p>بعد إتمام شراء أي كتاب أو تفعيل كود يغطي قيمته بالكامل، سيظهر هنا تلقائياً.</p>
            <Link className="portal-button" href="/books"><ShoppingBag size={15}/> استعرض المكتبة</Link>
          </section>
        ) : (
          <div className="my-books-grid">
            {books.map((book) => (
              <article className="portal-card my-book-card" key={book.bookId}>
                <div className="my-book-cover">
                  {book.coverUrl
                    ? <img src={book.coverUrl} alt={"غلاف " + book.title}/>
                    : <BookOpen size={37}/>}
                </div>
                <div className="my-book-info">
                  <div className="my-book-tags">
                    {book.category && <span>{book.category}</span>}
                    <span>{book.productType === "digital" ? "كتاب إلكتروني" : "كتاب ورقي"}</span>
                  </div>
                  <h2>{book.title}</h2>
                  {book.author && <p className="my-book-author">تأليف: {book.author}</p>}
                  <div className="my-book-meta">
                    <span>{book.format || (book.productType === "digital" ? "كتاب إلكتروني" : "كتاب ورقي")}</span>
                    <span>الكمية: {book.quantity}</span>
                  </div>
                  <small>تاريخ الإضافة: {book.purchasedAt ? new Date(book.purchasedAt).toLocaleDateString("ar-EG") : "—"}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        .my-books-page{display:grid;gap:16px}
        .my-books-message{padding:22px}
        .my-books-empty{min-height:310px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:28px}
        .my-books-empty>span{width:68px;height:68px;border-radius:20px;display:grid;place-items:center;background:#eaf5f3;color:#16877e}
        .my-books-empty h2{font-size:18px;color:#263f45;margin:0}
        .my-books-empty p{max-width:480px;color:#75868b;font-size:12px;line-height:1.9;margin:0 0 8px}
        .my-books-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:15px}
        .my-book-card{display:grid;grid-template-columns:112px minmax(0,1fr);gap:15px;padding:15px;align-items:start}
        .my-book-cover{height:150px;border-radius:10px;background:#eef5f4;color:#568c86;display:grid;place-items:center;overflow:hidden}
        .my-book-cover img{width:100%;height:100%;object-fit:contain}
        .my-book-info{min-width:0}
        .my-book-tags{display:flex;flex-wrap:wrap;gap:5px}
        .my-book-tags span{font-size:9px;color:#63817e;background:#edf5f4;border-radius:16px;padding:5px 8px}
        .my-book-info h2{font-size:14px;line-height:1.8;color:#253e44;margin:9px 0 3px}
        .my-book-author{font-size:10px;color:#788b90;margin:0 0 10px}
        .my-book-meta{display:flex;flex-wrap:wrap;gap:7px;color:#6f8589;font-size:10px;margin:10px 0}
        .my-book-info>small{font-size:9px;color:#9aa6a8}
        @media(max-width:520px){.my-book-card{grid-template-columns:88px minmax(0,1fr);gap:11px;padding:12px}.my-book-cover{height:124px}}
      `}</style>
    </PlatformLayout>
  );
}
