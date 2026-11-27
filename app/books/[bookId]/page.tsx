"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, BookOpen, Eye, Library, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Book = {
  bookId: string;
  title: string;
  author?: string;
  category: string;
  description: string;
  format: string;
  productType: "digital" | "physical";
  price: number;
  currency: string;
  coverUrl?: string;
  previewUrl?: string;
  rightsNote?: string;
  stock?: number;
};

export default function BookDetailsPage() {
  const params = useParams<{ bookId: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [loadedBookId, setLoadedBookId] = useState("");
  const [error, setError] = useState("");
  const loading = loadedBookId !== params.bookId;

  useEffect(() => {
    let active = true;
    fetch("/api/books/" + encodeURIComponent(params.bookId), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل تفاصيل الكتاب.");
        return data.book as Book;
      })
      .then((item) => {
        if (active) {
          setBook(item);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) {
          setBook(null);
          setError(cause instanceof Error ? cause.message : "تعذر تحميل تفاصيل الكتاب.");
        }
      })
      .finally(() => { if (active) setLoadedBookId(params.bookId); });
    return () => { active = false; };
  }, [params.bookId]);

  return (
    <PlatformLayout
      title="تفاصيل الكتاب"
      description="بيانات الكتاب المنشورة من إدارة المكتبة العلمية في منصة اتزان."
    >
      <div className="book-details-page">
        <Link href="/books" className="portal-link-button secondary book-back-link">
          <ArrowRight size={15} /> العودة إلى المكتبة
        </Link>

        {loading && <div className="portal-card book-details-message">جارٍ تحميل تفاصيل الكتاب...</div>}
        {!loading && error && <div className="portal-card book-details-message" role="alert">{error}</div>}

        {!loading && book && (
          <section className="portal-card book-details-card">
            <div className="book-details-cover">
              {book.coverUrl ? (
                <Image
                  src={book.coverUrl}
                  alt={"غلاف كتاب " + book.title}
                  width={520}
                  height={680}
                  unoptimized
                />
              ) : (
                <div className="book-details-cover-placeholder"><BookOpen size={52} /><span>لا تتوفر صورة غلاف</span></div>
              )}
            </div>

            <div className="book-details-content">
              <div className="book-details-tags">
                <span className="portal-chip">{book.category}</span>
                <span className="portal-chip">{book.format}</span>
                <span className="portal-chip">{book.productType === "digital" ? "كتاب إلكتروني" : "كتاب ورقي"}</span>
              </div>
              <h2>{book.title}</h2>
              <p className="book-details-author">تأليف: {book.author || "مرجع اتزان"}</p>
              <p className="book-details-description">{book.description}</p>

              <div className="book-details-price">
                <span>السعر المنشور</span>
                <strong>{Number(book.price).toLocaleString("ar-SA")} {book.currency || "SAR"}</strong>
              </div>

              {book.productType === "physical" && (
                <div className="book-details-stock">
                  {Number(book.stock) > 0 ? "متاح بالمخزون: " + Number(book.stock) : "غير متوفر حالياً"}
                </div>
              )}

              {book.rightsNote && (
                <div className="book-details-rights"><ShieldCheck size={17} /><span>{book.rightsNote}</span></div>
              )}

              {book.previewUrl && (
                <a className="portal-button secondary book-preview-link" href={book.previewUrl} target="_blank" rel="noreferrer">
                  <Eye size={15} /> معاينة الكتاب
                </a>
              )}
              <div className="book-details-source"><Library size={15} /> البيانات والصورة والسعر من سجل الكتاب المنشور في الإدارة.</div>
            </div>
          </section>
        )}
      </div>

      <style jsx>{`
        .book-details-page{display:grid;gap:16px}
        .book-back-link{justify-self:start}
        .book-details-message{padding:22px}
        .book-details-card{display:grid;grid-template-columns:minmax(230px,340px) minmax(0,1fr);gap:28px;align-items:start;padding:26px}
        .book-details-cover{min-height:330px;display:grid;place-items:center;padding:15px;border-radius:14px;background:linear-gradient(145deg,#edf4f3,#e1ebea);overflow:hidden}
        .book-details-cover img{display:block;width:100%;height:auto;max-height:520px;object-fit:contain;border-radius:8px}
        .book-details-cover-placeholder{display:grid;justify-items:center;gap:12px;color:#6d8d8b;font-size:12px}
        .book-details-content{min-width:0}
        .book-details-tags{display:flex;flex-wrap:wrap;gap:7px}
        .book-details-content h2{margin:18px 0 5px;color:#213b45;font-size:clamp(22px,3vw,30px);line-height:1.6}
        .book-details-author{margin:0;color:#788b90;font-size:13px}
        .book-details-description{margin:18px 0;color:#536c72;font-size:14px;line-height:2.1;white-space:pre-wrap}
        .book-details-price{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:22px;padding:16px;border-radius:11px;background:#f2f7f6}
        .book-details-price span{color:#698087;font-size:12px}
        .book-details-price strong{color:#147f76;font-size:21px}
        .book-details-stock{margin-top:12px;color:#657c80;font-size:12px}
        .book-details-rights{display:flex;align-items:flex-start;gap:8px;margin-top:18px;padding:13px;border:1px solid #e5ece9;border-radius:10px;color:#71858a;font-size:11px;line-height:1.9}
        .book-details-rights svg{flex:none;color:#168b86}
        .book-preview-link{display:inline-flex;margin-top:18px}
        .book-details-source{display:flex;align-items:center;gap:7px;margin-top:20px;color:#92a0a3;font-size:10px}
        @media(max-width:700px){.book-details-card{grid-template-columns:1fr;padding:17px;gap:18px}.book-details-cover{min-height:230px}.book-details-cover img{max-height:360px}.book-details-price strong{font-size:17px}}
      `}</style>
    </PlatformLayout>
  );
}
