import type { Metadata } from "next";
import { Sidebar } from "@/components/ui/Sidebar";
import { AuthInitializer } from "@/components/AuthInitializer";
import "./globals.css";

export const metadata: Metadata = {
  title: "企智 QiZhi — AI 工作流平台",
  description: "基于 OpenClaw + Hermes 的 AI 工作流编排平台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased h-screen flex">
        <AuthInitializer>
          <Sidebar />
          <main className="flex-1 overflow-hidden">{children}</main>
        </AuthInitializer>
      </body>
    </html>
  );
}
