import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FreeStream TV — Free Live TV Streaming",
  description: "Watch free live TV from around the world. Pluto TV, Samsung TV Plus, LG Channels, Rakuten, Tubi, Roku, beIN XTRA, FIFA+ and more — no signup, no subscription.",
  keywords: ["FreeStream TV", "free TV", "IPTV", "M3U", "M3U8", "live TV", "Pluto TV", "Samsung TV Plus", "LG Channels", "Tubi", "Roku", "FAST"],
  authors: [{ name: "FreeStream TV" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "FreeStream TV — Free Live TV Streaming",
    description: "Watch free live TV from around the world. No signup, no subscription.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
