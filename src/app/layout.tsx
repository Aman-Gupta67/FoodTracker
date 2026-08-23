import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/register-sw";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: "Food Tracker",
  description: "Log Indian food, track calories and macros against a target.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Food Tracker",
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
      {/* suppressHydrationWarning: browser extensions (Grammarly, etc.)
          inject attributes onto <body> before React hydrates */}
      <body className="antialiased" suppressHydrationWarning>
        <QueryProvider>
          {children}
          <RegisterServiceWorker />
        </QueryProvider>
      </body>
    </html>
  );
}
