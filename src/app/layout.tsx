import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-sw";
import { QueryProvider } from "@/components/query-provider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "Food Tracker",
  description: "Log Indian food, track calories and macros against a target.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Food Tracker",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#fc8c2f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Manual <head> tags, not the Metadata API: on dynamically-rendered
          routes (any page reading cookies/searchParams, i.e. most of this
          app) Next.js streams Metadata-API tags into the end of <body> and
          only relocates icon links into <head> — apple-mobile-web-app-capable
          and the manifest link get stranded where iOS Safari won't see them. */}
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly, etc.)
          inject attributes onto <body> before React hydrates */}
      <body
        className={`${plusJakartaSans.variable} antialiased`}
        suppressHydrationWarning
      >
        <QueryProvider>
          {children}
          <RegisterServiceWorker />
        </QueryProvider>
        <div className="landscape-lock" aria-hidden>
          <p className="text-3xl">📱</p>
          <p className="text-sm font-bold">Please rotate your device back to portrait</p>
          <p className="text-xs text-stone-500">Food Tracker is designed for portrait use only.</p>
        </div>
      </body>
    </html>
  );
}
