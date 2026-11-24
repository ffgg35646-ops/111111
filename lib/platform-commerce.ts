import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { decryptPlatformSecret } from "@/lib/platform-crypto";

export type CommerceScope = "course" | "book" | "membership";

export type PriceBreakdown = {
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  vatRateBps: number;
  pricesIncludeVat: boolean;
  couponCode?: string;
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const normalizedCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);

export async function calculateCommercePrice(
  db: Db,
  subtotalInput: number,
  scope: CommerceScope,
  couponInput = "",
): Promise<PriceBreakdown> {
  const subtotalAmount = money(subtotalInput);
  if (!Number.isFinite(subtotalAmount) || subtotalAmount <= 0 || subtotalAmount > 10000000) {
    throw new Error("قيمة المنتجات غير صالحة.");
  }

  const couponCode = normalizedCode(couponInput);
  let discountAmount = 0;
  if (couponCode) {
    const now = new Date();
    const coupon = await db.collection("etzan_coupons").findOne({
      code: couponCode,
      active: true,
      $and: [
        { $or: [{ startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
        { $or: [{ maxUses: { $exists: false } }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] },
        { $or: [{ appliesTo: "all" }, { appliesTo: scope }] },
      ],
    });
    if (!coupon) throw new Error("كود الخصم غير صالح أو منتهي أو غير متاح لهذا المنتج.");
    const minimum = Number(coupon.minimumAmount) || 0;
    if (subtotalAmount < minimum) throw new Error("الطلب لا يصل إلى الحد الأدنى لاستخدام كود الخصم.");
    if (coupon.type === "percent") {
      const percent = Number(coupon.value);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) throw new Error("إعداد كود الخصم غير صالح.");
      discountAmount = money(subtotalAmount * percent / 100);
    } else {
      const fixed = Number(coupon.value);
      if (!Number.isFinite(fixed) || fixed <= 0) throw new Error("إعداد كود الخصم غير صالح.");
      discountAmount = money(Math.min(fixed, subtotalAmount));
    }
  }

  const taxable = money(Math.max(0, subtotalAmount - discountAmount));
  const vatRegistered = process.env.ETZAN_VAT_REGISTERED === "true";
  const sellerVatNumber = (process.env.ETZAN_MERCHANT_VAT_NUMBER || "").replace(/\s/g, "");
  if (vatRegistered && (!/^3\d{14}3$/.test(sellerVatNumber) || !process.env.ETZAN_MERCHANT_LEGAL_NAME?.trim())) {
    throw new Error("بيانات التسجيل الضريبي واسم المنشأة مطلوبة قبل احتساب ضريبة القيمة المضافة.");
  }
  const configuredRate = Number(process.env.ETZAN_VAT_RATE_BPS || "1500");
  const vatRateBps = vatRegistered && Number.isInteger(configuredRate) && configuredRate >= 0 && configuredRate <= 10000 ? configuredRate : 0;
  const pricesIncludeVat = process.env.ETZAN_PRICES_INCLUDE_VAT !== "false";
  const taxAmount = vatRateBps > 0
    ? money(pricesIncludeVat ? taxable * vatRateBps / (10000 + vatRateBps) : taxable * vatRateBps / 10000)
    : 0;
  const totalAmount = money(pricesIncludeVat ? taxable : taxable + taxAmount);
  if (totalAmount < 1) throw new Error("يجب ألا يقل إجمالي الطلب بعد الخصم والضريبة عن ريال واحد.");
  return {
    subtotalAmount,
    discountAmount,
    taxAmount,
    totalAmount,
    vatRateBps,
    pricesIncludeVat,
    ...(couponCode ? { couponCode } : {}),
  };
}

export async function consumeOrderCoupon(db: Db, requestId: string) {
  const orders = db.collection("platform_requests");
  const order = await orders.findOne({ requestId }, { projection: { couponCode: 1, couponConsumedAt: 1 } });
  if (!order || typeof order.couponCode !== "string" || order.couponConsumedAt) return;
  const claim = await orders.updateOne(
    { requestId, couponCode: order.couponCode, couponConsumedAt: { $exists: false } },
    { $set: { couponConsumedAt: new Date() } },
  );
  if (claim.modifiedCount) {
    await db.collection("etzan_coupons").updateOne({ code: order.couponCode }, { $inc: { usedCount: 1 } });
  }
}

export async function createElectronicInvoice(
  db: Db,
  order: Record<string, unknown>,
  payment: Record<string, unknown>,
) {
  const paymentId = typeof payment.providerPaymentId === "string" ? payment.providerPaymentId : "";
  if (!paymentId) return null;
  const invoices = db.collection("platform_invoices");
  await invoices.createIndex({ providerPaymentId: 1 }, { unique: true });
  const existing = await invoices.findOne({ providerPaymentId: paymentId }, { projection: { _id: 0, invoiceId: 1 } });
  if (existing) return existing.invoiceId;

  const now = new Date();
  const invoiceId = randomUUID();
  const invoiceNumber = "ETZAN-" + now.toISOString().slice(0, 10).replace(/-/g, "") + "-" + invoiceId.slice(0, 8).toUpperCase();
  const totalAmount = Number(payment.amount || 0) / 100;
  const subtotalAmount = Number(order.subtotalAmount ?? order.quotedAmount ?? totalAmount);
  const discountAmount = Number(order.discountAmount || 0);
  const taxAmount = Number(order.taxAmount || 0);
  const vatRateBps = Number(order.vatRateBps || 0);
  const vatNumber = (process.env.ETZAN_MERCHANT_VAT_NUMBER || "").replace(/\s/g, "");
  const legalName = process.env.ETZAN_MERCHANT_LEGAL_NAME || "اتزان";
  const isVatInvoice = process.env.ETZAN_VAT_REGISTERED === "true" && /^3\d{14}3$/.test(vatNumber);

  const lines: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }> = [];
  if (Array.isArray(order.items)) {
    for (const raw of order.items) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.unitPrice || 0);
      if (quantity > 0 && unitPrice >= 0) lines.push({
        description: String(item.title || "منتج رقمي"),
        quantity,
        unitPrice: money(unitPrice),
        lineTotal: money(quantity * unitPrice),
      });
    }
  }
  if (!lines.length) {
    lines.push({
      description: String(order.courseTitle || order.planName || order.kind || "خدمات اتزان"),
      quantity: 1,
      unitPrice: subtotalAmount,
      lineTotal: subtotalAmount,
    });
  }

  await invoices.insertOne({
    invoiceId,
    invoiceNumber,
    providerPaymentId: paymentId,
    requestId: String(order.requestId || ""),
    customerName: String(order.name || ""),
    customerEmail: String(order.email || ""),
    customerPhone: String(order.phone || ""),
    sellerName: legalName,
    sellerVatNumber: isVatInvoice ? vatNumber : "",
    sellerVatRegistered: isVatInvoice,
    qrCodeBase64: isVatInvoice ? buildZatcaQrPayload({ sellerName: legalName, sellerVatNumber: vatNumber, issuedAt: now, totalAmount, taxAmount }) : "",
    sellerAddress: process.env.ETZAN_MERCHANT_ADDRESS || "",
    sellerCommercialRegistration: process.env.ETZAN_MERCHANT_CR || "",
    currency: String(payment.currency || "SAR"),
    subtotalAmount: money(subtotalAmount),
    discountAmount: money(discountAmount),
    taxAmount: money(taxAmount),
    vatRateBps,
    pricesIncludeVat: order.pricesIncludeVat === true,
    totalAmount: money(totalAmount),
    providerFee: typeof payment.fee === "number" ? payment.fee / 100 : null,
    paymentMethod: String(payment.paymentMethod || "Moyasar"),
    lines,
    invoiceType: isVatInvoice ? "tax_invoice" : "sales_receipt",
    zatcaPhase2Integrated: false,
    issuedAt: now,
    paidAt: payment.paidAt instanceof Date ? payment.paidAt : now,
    createdAt: now,
  });
  return invoiceId;
}


export function buildZatcaQrPayload(invoice: {
  sellerName: string;
  sellerVatNumber: string;
  issuedAt: Date | string;
  totalAmount: number;
  taxAmount: number;
}) {
  const fields: Array<[number, string]> = [
    [1, invoice.sellerName],
    [2, invoice.sellerVatNumber],
    [3, (invoice.issuedAt instanceof Date ? invoice.issuedAt : new Date(invoice.issuedAt)).toISOString()],
    [4, money(invoice.totalAmount).toFixed(2)],
    [5, money(invoice.taxAmount).toFixed(2)],
  ];
  const chunks = fields.map(([tag, value]) => {
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
  });
  return Buffer.concat(chunks).toString("base64");
}

export function addBillingPeriod(date: Date, period: "monthly" | "annual") {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + (period === "annual" ? 12 : 1));
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

export async function activatePaidMembership(db: Db, order: Record<string, unknown>, paymentId: string) {
  const requestId = String(order.requestId || "");
  const subscription = await db.collection("platform_subscriptions").findOne({ requestId });
  if (!subscription || (subscription.status === "active" && subscription.lastPaymentId === paymentId)) return;
  const now = new Date();
  let recurringReady = false;
  if (typeof subscription.tokenEncrypted === "string" && process.env.MOYASAR_SECRET_KEY) {
    try {
      const token = decryptPlatformSecret(subscription.tokenEncrypted);
      const tokenResponse = await fetch("https://api.moyasar.com/v1/tokens/" + encodeURIComponent(token), {
        headers: { Authorization: "Basic " + Buffer.from(process.env.MOYASAR_SECRET_KEY + ":").toString("base64"), Accept: "application/json" },
        cache: "no-store",
      });
      const tokenData = await tokenResponse.json().catch(() => ({})) as { status?: string; last_four?: string; brand?: string };
      recurringReady = tokenResponse.ok && tokenData.status === "active";
      await db.collection("platform_subscriptions").updateOne({ requestId }, {
        $set: {
          ...(recurringReady ? { tokenLastFour: tokenData.last_four || "", tokenBrand: tokenData.brand || "" } : {}),
          tokenVerifiedAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Membership token verification failed", error);
    }
  }
  const period = order.billingPeriod === "annual" ? "annual" : "monthly";
  const paidThrough = addBillingPeriod(now, period);
  await db.collection("platform_subscriptions").updateOne(
    { requestId, status: { $in: ["pending_initial_payment", "awaiting_card_token"] }, lastPaymentId: { $ne: paymentId } },
    { $set: {
      status: "active",
      autoRenewEnabled: recurringReady && order.recurringConsent === true,
      nextBillingAt: paidThrough,
      paidThrough,
      lastPaymentId: paymentId,
      lastPaidAt: now,
      recurringStatus: recurringReady && order.recurringConsent === true ? "enabled" : "manual_renewal",
      updatedAt: now,
    } },
  );
}

export async function settleRecurringPayment(db: Db, payment: {
  id: string; status: string; amount: number; currency: string; fee?: number; description?: string; source?: { company?: string; type?: string };
}) {
  const match = payment.description?.match(/^ETZAN Subscription ([0-9a-f-]{36}) ([0-9a-f-]{36})$/i);
  if (!match) return false;
  const subscriptionId = match[1];
  const chargeId = match[2];
  const subscriptions = db.collection("platform_subscriptions");
  const subscription = await subscriptions.findOne({ subscriptionId });
  if (!subscription) return true;
  const charges = db.collection("platform_subscription_charges");
  await charges.createIndex({ chargeId: 1 }, { unique: true });
  await charges.updateOne({ chargeId }, { $set: {
    chargeId, subscriptionId, providerPaymentId: payment.id, amount: payment.amount, currency: payment.currency,
    status: payment.status, fee: payment.fee ?? null, updatedAt: new Date(),
  }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });

  if (payment.status === "paid") {
    const wasApplied = await charges.updateOne({ chargeId, renewalApplied: { $ne: true } }, { $set: { renewalApplied: true, paidAt: new Date() } });
    if (wasApplied.modifiedCount) {
      const now = new Date();
      const period = subscription.billingPeriod === "annual" ? "annual" : "monthly";
      const paidThrough = addBillingPeriod(subscription.paidThrough instanceof Date && subscription.paidThrough > now ? subscription.paidThrough : now, period);
      await subscriptions.updateOne({ subscriptionId, lastPaymentId: { $ne: payment.id } }, { $set: {
        status: "active", recurringStatus: subscription.autoRenewEnabled === true ? "enabled" : "cancelled", paidThrough,
        nextBillingAt: paidThrough, lastPaymentId: payment.id, lastPaidAt: now, renewalAttempts: 0, updatedAt: now,
      }, $unset: { renewalLockUntil: "", renewalPaymentId: "", currentChargeId: "" } });
    }
  } else if (payment.status === "failed") {
    const attempts = Number(subscription.renewalAttempts || 0) + 1;
    const now = new Date();
    await subscriptions.updateOne({ subscriptionId, lastPaymentId: { $ne: payment.id }, autoRenewEnabled: true }, { $set: {
      status: "past_due", recurringStatus: attempts >= 3 ? "retry_limit_reached" : "payment_failed",
      renewalAttempts: attempts, autoRenewEnabled: attempts < 3,
      nextBillingAt: new Date(now.getTime() + (attempts >= 3 ? 7 : 1) * 24 * 60 * 60 * 1000),
      lastFailureAt: now, updatedAt: now,
    }, $unset: { renewalLockUntil: "", renewalPaymentId: "", currentChargeId: "" } });
  }
  return true;
}
