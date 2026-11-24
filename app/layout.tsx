import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./platform.css";
import "./etzan.css";

export const metadata: Metadata = {
  title: "اتزان | ETZAN",
  description: "من المعرفة إلى الممارسة — منصة مهنية للتعلم والتدريب والمحاكاة",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get("x-etzan-locale") === "en" ? "en" : "ar";
  return <html lang={locale} dir={locale === "en" ? "ltr" : "rtl"}><body>{children}</body></html>;
}
