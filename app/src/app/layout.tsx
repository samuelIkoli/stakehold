import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stakehold — Survivor for your habits",
  description:
    "Put money on your habits. An AI referee checks your proof. The people who quit pay the people who don't — and Solana makes every step verifiable.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a11" },
  ],
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${code.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>
          <Nav />
          <main className="overflow-x-clip pb-24 md:pb-12">{children}</main>
          <footer className="mx-auto hidden max-w-6xl items-center justify-between px-4 py-8 text-xs text-muted md:flex">
            <span>Stakehold · MLH Solana Hackathon 2026 · Solana devnet only — no real money.</span>
            <span className="flex gap-4">
              <Link href="/profile" className="hover:text-ink">
                Profile
              </Link>
              <a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noreferrer" className="hover:text-ink">
                Explorer
              </a>
            </span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
