"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight, BookOpen, CheckCircle2, CreditCard, LoaderCircle,
  Minus, Plus, ShoppingBag, Tag, Truck,
} from "lucide-react";
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
  stock?: number;
};

type Learner = { name: string; email: string; role: string };

type CreatedOrder = {
  requestId: string;
  status: string;
  paymentStatus: string;
  quotedAmount: number;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  currency: string;
  couponCode?: string;
};

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " " + (currency || "SAR");

export default function BookPurchasePage() {
  const params = useParams<{ bookId: string }>();
  const router = useRouter();
  const bookId = params.bookId;
  const [book, setBook] = useState<Book | null>(null);
  const [learner, setLearner] = useState<Learner | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<CreatedOrder | null>(null);

  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let active = true;
    const checkoutPath = "/books/" + encodeURIComponent(bookId) + "/purchase";

    async function load() {
      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        const session = await sessionResponse.json().catch(() => ({}));
        if (!sessionResponse.ok || session.authenticated !== true) {
          router.replace("/login?next=" + encodeURIComponent(checkoutPath));
          return;
        }
        const account = session.user as Learner | undefined;
        if (!account || account.role !== "trainee") {
          if (active) setError("إتمام شراء الكتب متاح من حساب الطالب فقط.");
          return;
        }
        if (active) {
          setLearner(account);
          setRecipientName(account.name || "");
        }

        const bookResponse = await fetch("/api/books/" + encodeURIComponent(bookId), { cache: "no-store" });
        const data = await bookResponse.json();
        if (!bookResponse.ok) throw new Error(data.error || "تعذر تحميل بيانات الكتاب.");
        if (active) setBook(data.book as Book);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل صفحة الشراء.");
      } finally {
        if (active) setPageLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [bookId, router]);

  const isPhysical = book?.productType === "physical";
  const maxQuantity = isPhysical ? Math.max(1, Math.min(10, Number(book?.stock) || 0)) : 1;
  const safeQuantity = Math.min(quantity, maxQuantity);
  const subtotalPreview = useMemo(
    () => book ? Number(book.price) * safeQuantity : 0,
    [book, safeQuantity],
  );

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!book || !learner || order) return;
    setSubmitting(true);
    setError("");

    const cleanCoupon = couponCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    try {
      const response = await fetch("/api/platform/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          kind: "book_order",
          name: learner.name,
          email: learner.email,
          phone: isPhysical ? phone : "",
          couponCode: cleanCoupon,
          items: [{ bookId: book.bookId, quantity: safeQuantity }],
          recipientName: isPhysical ? recipientName : "",
          deliveryPhone: isPhysical ? phone : "",
          governorate: isPhysical ? governorate : "",
          city: isPhysical ? city : "",
          deliveryAddress: isPhysical ? address : "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء طلب شراء الكتاب.");
      setOrder({
        requestId: String(data.requestId),
        status: String(data.status || ""),
        paymentStatus: String(data.paymentStatus || ""),
        quotedAmount: Number(data.quotedAmount || 0),
        subtotalAmount: Number(data.subtotalAmount || 0),
        discountAmount: Number(data.discountAmount || 0),
        taxAmount: Number(data.taxAmount || 0),
        currency: String(data.currency || book.currency || "SAR"),
        couponCode: typeof data.couponCode === "string" ? data.couponCode : "",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء الطلب.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PlatformLayout
      title="إتمام شراء الكتاب"
      description="راجع بيانات الكتاب، وأدخل بيانات التوصيل عند شراء نسخة ورقية، ثم أكمل طلبك."
    >
      <div className="book-checkout-page">
        <Link href={"/books/" + encodeURIComponent(bookId)} className="portal-link-button secondary checkout-back">
          <ArrowRight size={15}/> العودة إلى تفاصيل الكتاب
        </Link>

        {pageLoading && <div className="portal-card checkout-message">جارٍ تجهيز بيانات الشراء...</div>}
        {!pageLoading && error && !book && <div className="portal-card checkout-message" role="alert">{error}</div>}
        {!pageLoading && book && !order && (
          <form className="book-checkout-grid" onSubmit={submitOrder}>
            <section className="portal-card checkout-summary">
              <h2><ShoppingBag size={18}/> ملخص الطلب (1)</h2>
              <div className="checkout-book">
                <div className="checkout-book-cover">
                  {book.coverUrl ? <img src={book.coverUrl} alt={"غلاف " + book.title}/> : <BookOpen size={40}/>}
                </div>
                <div className="checkout-book-info">
                  <h3>{book.title}</h3>
                  {book.author && <p>تأليف: {book.author}</p>}
                  <div className="checkout-book-meta">
                    <span><BookOpen size={12}/> {book.format || (isPhysical ? "كتاب ورقي" : "كتاب إلكتروني")}</span>
                    <strong>{money(Number(book.price), book.currency)}</strong>
                  </div>
                  {book.category && <small>{book.category}</small>}
                </div>
              </div>

              <div className="checkout-price-row"><span>سعر النسخة</span><b>{money(Number(book.price), book.currency)}</b></div>
              {isPhysical && (
                <div className="checkout-quantity">
                  <span>الكمية</span>
                  <div className="checkout-quantity-control" dir="ltr">
                    <button type="button" aria-label="زيادة الكمية" disabled={safeQuantity >= maxQuantity} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}><Plus size={14}/></button>
                    <b>{safeQuantity}</b>
                    <button type="button" aria-label="تقليل الكمية" disabled={safeQuantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={14}/></button>
                  </div>
                </div>
              )}
              <div className="checkout-price-row"><span>المجموع قبل الخصم</span><b>{money(subtotalPreview, book.currency)}</b></div>
              <p className="checkout-price-note">سيظهر الإجمالي النهائي بعد التحقق من كود الخصم واحتساب الضريبة عند إنشاء الطلب.</p>
            </section>

            <section className="portal-card checkout-payment">
              {isPhysical && (
                <>
                  <h2><Truck size={18}/> بيانات الشحن</h2>
                  <div className="checkout-fields">
                    <label>اسم المستلم<input required minLength={2} maxLength={100} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="اسم الشخص المستلم"/></label>
                    <label>الهاتف<input required type="tel" minLength={7} maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="رقم التواصل"/></label>
                    <label>المحافظة<input required minLength={2} maxLength={80} value={governorate} onChange={(event) => setGovernorate(event.target.value)} placeholder="المحافظة"/></label>
                    <label>المدينة<input required minLength={2} maxLength={80} value={city} onChange={(event) => setCity(event.target.value)} placeholder="المدينة"/></label>
                    <label className="checkout-field-wide">العنوان بالتفصيل<textarea required minLength={6} maxLength={250} rows={3} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="الشارع والمنطقة ورقم المبنى وأي علامة مميزة"/></label>
                  </div>
                </>
              )}

              {!isPhysical && (
                <div className="checkout-digital-note">
                  <BookOpen size={23}/>
                  <div><strong>كتاب إلكتروني</strong><p>لا يحتاج هذا الكتاب إلى بيانات شحن. سيضاف إلى «كتبي» بعد تأكيد الدفع أو تفعيل كود يغطي قيمته بالكامل.</p></div>
                </div>
              )}

              <h2 className="checkout-section-title"><CreditCard size={18}/> طريقة الدفع</h2>
              <div className="checkout-method">
                <span><CreditCard size={20}/></span>
                <div><strong>الدفع الإلكتروني الآمن</strong><small>تنتقل إلى بوابة الدفع المعتمدة بعد إنشاء الطلب، عند وجود مبلغ مستحق.</small></div>
              </div>

              <div className="checkout-coupon">
                <h3><Tag size={15}/> هل لديك كود خصم أو كود سنتر؟</h3>
                <input
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                  maxLength={40}
                  placeholder="أدخل كود الخصم هنا"
                  aria-label="كود الخصم"
                />
                <small>سيتم التحقق من الكود وصلاحيته للكتب عند إرسال الطلب.</small>
              </div>

              <div className="checkout-account">
                <span>حساب الطالب</span>
                <strong>{learner?.name}</strong>
                <small>{learner?.email}</small>
              </div>

              {error && <p className="checkout-error" role="alert">{error}</p>}
              <button className="checkout-submit" type="submit" disabled={submitting || (isPhysical && (Number(book.stock) < safeQuantity || Number(book.stock) < 1))}>
                {submitting ? <><LoaderCircle size={16} className="checkout-spin"/> جارٍ التحقق وإتمام الطلب...</> : <><ShoppingBag size={16}/> تأكيد طلب الشراء</>}
              </button>
              {isPhysical && Number(book.stock) < 1 && <p className="checkout-error">الكتاب غير متوفر بالمخزون حالياً.</p>}
              <p className="checkout-terms">يتم اعتماد الطلب بعد تأكيد الدفع، أو بعد قبول كود خصم يغطي كامل قيمة الطلب.</p>
            </section>
          </form>
        )}

        {order && (
          <section className="portal-card checkout-result">
            <span className="checkout-result-icon"><CheckCircle2 size={30}/></span>
            <h2>{order.paymentStatus === "coupon_redeemed" ? "تم اعتماد الطلب وإضافة الكتاب إلى كتبي" : "تم إنشاء طلب شراء الكتاب"}</h2>
            <p>رقم الطلب: <b dir="ltr">{order.requestId}</b></p>
            <div className="checkout-result-breakdown">
              <div><span>المجموع الفرعي</span><b>{money(order.subtotalAmount, order.currency)}</b></div>
              <div><span>الخصم</span><b>{money(order.discountAmount, order.currency)}</b></div>
              <div><span>الضريبة</span><b>{money(order.taxAmount, order.currency)}</b></div>
              <div className="checkout-result-total"><span>الإجمالي المستحق</span><b>{money(order.quotedAmount, order.currency)}</b></div>
            </div>
            {order.paymentStatus === "coupon_redeemed" ? (
              <p className="checkout-result-note">تم التحقق من الكود وتغطية قيمة الكتاب بالكامل. أصبح الكتاب ظاهرًا الآن في مكتبتك الشخصية.</p>
            ) : (
              <>
                <p className="checkout-result-note">تم حفظ الطلب. يلزم إتمام الدفع لتأكيد الشراء وإضافة الكتاب إلى «كتبي».</p>
                <Link className="portal-button checkout-pay-link" href={"/pay-request?requestId=" + encodeURIComponent(order.requestId) + "&email=" + encodeURIComponent(learner?.email || "")}>
                  الانتقال إلى الدفع الآمن
                </Link>
              </>
            )}
            <Link className="portal-link-button secondary checkout-my-books" href="/my-books">الانتقال إلى كتبي</Link>
          </section>
        )}
      </div>

      <style jsx>{`
        .book-checkout-page{display:grid;gap:16px}
        .checkout-back{justify-self:start}
        .checkout-message{padding:22px}
        .book-checkout-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);gap:20px;align-items:start}
        .checkout-summary,.checkout-payment{padding:22px;min-width:0}
        .checkout-summary h2,.checkout-payment h2{display:flex;align-items:center;gap:9px;font-size:15px;color:#263e44;margin:0 0 18px}
        .checkout-summary h2 svg,.checkout-payment h2 svg{color:#168b86}
        .checkout-book{display:flex;gap:15px;background:#f7faf9;border-radius:11px;padding:14px}
        .checkout-book-cover{width:135px;height:156px;flex:none;border-radius:8px;background:#eaf2f0;color:#67928b;display:grid;place-items:center;overflow:hidden}
        .checkout-book-cover img{width:100%;height:100%;object-fit:contain}
        .checkout-book-info{min-width:0;flex:1}
        .checkout-book-info h3{font-size:14px;line-height:1.8;margin:2px 0 5px;color:#253d43}
        .checkout-book-info p{font-size:11px;color:#78898d;margin:0 0 12px}
        .checkout-book-meta{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
        .checkout-book-meta span{display:flex;align-items:center;gap:5px;font-size:10px;color:#71858a}
        .checkout-book-meta strong{font-size:12px;color:#148176}
        .checkout-book-info>small{display:block;color:#8b9a9d;font-size:10px;margin-top:10px}
        .checkout-price-row{display:flex;justify-content:space-between;gap:12px;padding:17px 0;border-bottom:1px solid #e9eeee;color:#64777d;font-size:12px}
        .checkout-price-row b{color:#243d43;direction:ltr}
        .checkout-quantity{display:flex;justify-content:space-between;align-items:center;padding:17px 0;border-bottom:1px solid #e9eeee;color:#64777d;font-size:12px}
        .checkout-quantity-control{display:flex;align-items:center;border:1px solid #dce6e5;border-radius:7px;overflow:hidden}
        .checkout-quantity-control button{display:grid;place-items:center;width:30px;height:29px;border:0;background:#f1f6f5;color:#315e59;cursor:pointer}
        .checkout-quantity-control button:disabled{opacity:.4;cursor:not-allowed}
        .checkout-quantity-control b{width:36px;text-align:center;font-size:12px;color:#293f44}
        .checkout-price-note{font-size:10px;line-height:1.8;color:#8b999c;margin:13px 0 0}
        .checkout-fields{display:grid;grid-template-columns:1fr 1fr;gap:11px}
        .checkout-fields label{display:grid;gap:6px;font-size:11px;color:#51686e}
        .checkout-fields input,.checkout-fields textarea,.checkout-coupon input{width:100%;border:1px solid #dce6e5;border-radius:7px;padding:10px 11px;background:#fff;color:#293f44;font:inherit;font-size:11px;outline:none}
        .checkout-fields input:focus,.checkout-fields textarea:focus,.checkout-coupon input:focus{border-color:#39a69b;box-shadow:0 0 0 3px #39a69b18}
        .checkout-fields textarea{resize:vertical}
        .checkout-field-wide{grid-column:1/-1}
        .checkout-digital-note{display:flex;gap:13px;padding:15px;border-radius:10px;background:#f2f8f7;color:#16877e;margin-bottom:20px}
        .checkout-digital-note svg{flex:none}
        .checkout-digital-note strong{font-size:12px;color:#315b57}
        .checkout-digital-note p{font-size:10px;line-height:1.8;color:#71858a;margin:5px 0 0}
        .checkout-payment .checkout-section-title{margin-top:22px;margin-bottom:12px}
        .checkout-method{display:flex;align-items:center;gap:12px;border:1px solid #dbe6e4;background:#f7faf9;border-radius:9px;padding:12px;margin-bottom:18px}
        .checkout-method>span{width:39px;height:39px;border-radius:8px;background:#209a90;color:#fff;display:grid;place-items:center;flex:none}
        .checkout-method strong{display:block;color:#344f54;font-size:11px}
        .checkout-method small{display:block;color:#829296;font-size:9px;line-height:1.7;margin-top:4px}
        .checkout-coupon{border:1px dashed #cad9d6;border-radius:10px;background:#fafcfb;padding:14px;margin-bottom:17px}
        .checkout-coupon h3{display:flex;align-items:center;gap:7px;font-size:11px;color:#405c60;margin:0 0 10px}
        .checkout-coupon h3 svg{color:#168b86}
        .checkout-coupon small{display:block;color:#8a989b;font-size:9px;margin-top:7px}
        .checkout-account{display:grid;gap:4px;border-top:1px solid #edf1f0;padding:12px 0;color:#73858a;font-size:10px}
        .checkout-account strong{color:#3a555a;font-size:11px}
        .checkout-account small{color:#8a989b}
        .checkout-submit{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:9px;background:linear-gradient(135deg,#10a88d,#07866e);color:#fff;padding:13px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px #0b927322}
        .checkout-submit:disabled{opacity:.55;cursor:not-allowed}
        .checkout-terms{font-size:9px;color:#8b999c;line-height:1.8;text-align:center;margin:10px 0 0}
        .checkout-error{font-size:11px;color:#b44343;line-height:1.7;margin:10px 0}
        .checkout-spin{animation:checkout-spin 1s linear infinite}
        @keyframes checkout-spin{to{transform:rotate(360deg)}}
        .checkout-result{max-width:650px;width:100%;margin:20px auto;padding:28px;display:grid;justify-items:center;text-align:center;gap:12px}
        .checkout-result-icon{width:66px;height:66px;border-radius:50%;display:grid;place-items:center;color:#11977f;background:#e8f7f2}
        .checkout-result h2{font-size:19px;color:#2b494e;margin:0}
        .checkout-result>p{font-size:11px;color:#75878b;margin:0;line-height:1.8}
        .checkout-result>p b{color:#364e54}
        .checkout-result-breakdown{width:100%;margin:8px 0;padding:0 5px}
        .checkout-result-breakdown>div{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #edf1f0;color:#718489;font-size:11px}
        .checkout-result-breakdown b{color:#354e53}
        .checkout-result-breakdown .checkout-result-total{font-weight:800;color:#243e43;border:0;font-size:13px}
        .checkout-result-total b{color:#108779;font-size:15px}
        .checkout-result-note{max-width:490px}
        .checkout-pay-link{justify-content:center;min-width:220px}
        .checkout-my-books{margin-top:2px}
        @media(max-width:820px){.book-checkout-grid{grid-template-columns:1fr}.checkout-payment{order:1}.checkout-summary{order:2}}
        @media(max-width:520px){.checkout-summary,.checkout-payment{padding:15px}.checkout-book{gap:10px;padding:10px}.checkout-book-cover{width:96px;height:125px}.checkout-fields{grid-template-columns:1fr}.checkout-field-wide{grid-column:auto}.checkout-result{padding:20px 15px}}
      `}</style>
    </PlatformLayout>
  );
}
