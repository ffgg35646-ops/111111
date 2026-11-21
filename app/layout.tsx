import type { Metadata } from "next";
import "./globals.css";
import "./platform.css";

export const metadata: Metadata = {
  title: "منصة التدريب والمحاكاة السريرية",
  description: "منصة تعليمية وتدريبية واستشارية مع محاكاة سريرية تفاعلية",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
