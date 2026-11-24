import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastContainer } from "@/ui/toast";

export const metadata: Metadata = {
  title: "PULSEWATCH | Website & API Monitoring Platform",
  description: "Know When Your Services Stop. Before Your Users Do.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </main>
        <ToastContainer />
      </body>
    </html>
  );
}
