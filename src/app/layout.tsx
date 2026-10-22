import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "FOUR PRO | 展示周遊クエスト", template: "%s | FOUR PRO" }, description: "4学科の展示をめぐって、仲間を集める。4学科合同プロジェクトの展示周遊Webゲーム。", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ja"><body>{children}</body></html>; }
