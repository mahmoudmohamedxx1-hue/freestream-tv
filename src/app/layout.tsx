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
  title: "StreamDeck — M3U Playlist Player",
  description: "Host & play M3U / M3U8 IPTV playlists. Arabic, sports, news, movies, music, kids & 8000+ global channels.",
  keywords: ["M3U", "IPTV", "M3U8", "playlist", "HLS", "streaming", "live TV"],
  authors: [{ name: "StreamDeck" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "StreamDeck — M3U Playlist Player",
    description: "Host & play M3U / M3U8 IPTV playlists in your browser.",
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
