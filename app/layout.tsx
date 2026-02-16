import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Integra Status",
  description: "Real-time infrastructure status for Integra Layer",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${GeistMono.variable}`}>
      <body className="bg-surface font-sans text-text antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-brand focus:text-white focus:rounded"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
