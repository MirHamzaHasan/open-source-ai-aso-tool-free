import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Toaster } from "sonner";

import { LocaleProvider } from "@/context/LocaleContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DracoArts AI Based ASO | Advanced App Store Optimization Dashboard",
  description: "ASO research tools for Google Play and iOS by DracoArts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased bg-[#09090b] text-zinc-50 flex h-screen overflow-hidden`}>
        <LocaleProvider>
          <Toaster theme="dark" position="bottom-right" />
          <Sidebar />
          <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none -translate-y-1/2" />
            <Topbar />
            <main className="flex-1 overflow-y-auto z-10 p-8 scroll-smooth">
              {children}
            </main>
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
