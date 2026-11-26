import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Social Studio",
  description: "Gestisci Instagram, Facebook e TikTok della tua attività, con l'aiuto dell'AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
          <aside className="border-b border-stone-200 bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r">
            <div className="px-4 py-3 md:sticky md:top-0 md:py-6">
              <div className="mb-3 px-3 text-lg font-semibold md:mb-6">
                <span className="text-brand-600">●</span> Social Studio
              </div>
              <Nav />
            </div>
          </aside>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
