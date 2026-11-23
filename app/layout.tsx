import type { Metadata } from "next";
import "./globals.css";
import "./platform.css";
import "./etzan.css";

export const metadata: Metadata = {
  title: "اتزان | ETZAN",
  description: "من المعرفة إلى الممارسة — منصة مهنية للتعلم والتدريب والمحاكاة",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
