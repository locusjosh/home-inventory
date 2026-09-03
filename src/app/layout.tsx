import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InventoryProvider } from "@/context/InventoryContext";
import { AppShell } from "@/components/AppShell";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Home Inventory",
  description: "Mobile-first home inventory for stock counts, low stock, and restock lists.",
  applicationName: "Home Inventory",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Home Inventory",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563eb" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/home-inventory/apple-touch-icon.png" />
      </head>
      <body className="font-sans antialiased">
        <InventoryProvider>
          <AppShell>{children}</AppShell>
          <PwaRegister />
        </InventoryProvider>
      </body>
    </html>
  );
}
