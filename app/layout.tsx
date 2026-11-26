import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./platform.css";
import "./etzan.css";
import "./support.css";
import "./site-themes.css";
import "./etzan-unified.css";
import { getSitePage } from "@/lib/site-pages";

export async function generateMetadata(): Promise<Metadata> {
  const home = await getSitePage("home");
  const clinicName = typeof home?.content?.clinicName === "string" && home.content.clinicName.trim() ? home.content.clinicName : "اتزان";
  const logoName = typeof home?.content?.logoName === "string" && home.content.logoName.trim() ? home.content.logoName : "ETZAN";
  return { title: `${clinicName} | ${logoName}`, description: "من المعرفة إلى الممارسة — منصة مهنية للتعلم والتدريب والمحاكاة" };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get("x-etzan-locale") === "en" ? "en" : "ar";
  const home = await getSitePage("home");
  const selectedTheme = String(home?.content?.theme || "blue-light");
  const theme = ["blue-light","emerald-dark","teal-light","purple-hybrid"].includes(selectedTheme) ? selectedTheme : "blue-light";
  return <html lang={locale} dir={locale === "en" ? "ltr" : "rtl"} data-theme={theme}><body>{children}</body></html>;
}
