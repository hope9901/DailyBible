import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "생명의 삶 일일 QT & 묵상 캘린더 | DailyBible",
  description:
    "매일 00시 30분 자동 업데이트되는 생명의 삶 본문 말씀과 캘린더 QT 체크 및 은혜 나눔 기록 웹 서비스",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased break-keep selection:bg-amber-200 selection:text-slate-900">
        {children}
      </body>
    </html>
  );
}
