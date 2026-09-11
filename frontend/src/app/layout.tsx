import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zplorer — Shielded Insight Explorer",
  description: "Live Zcash block explorer tracking shielded vs transparent transaction activity. See what % of network activity uses Zcash's privacy features.",
  keywords: ["Zcash", "blockchain explorer", "shielded transactions", "privacy", "Sapling", "Orchard"],
  authors: [{ name: "Zplorer" }],
  openGraph: {
    title: "Zplorer — Shielded Insight Explorer",
    description: "Live Zcash block explorer with shielded transaction tracking",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
