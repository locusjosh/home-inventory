import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InventoryProvider } from "@/context/InventoryContext";
import { AppShell } from "@/components/AppShell";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Home Inventory",
  description: "Track household stock, restock what's low, and log what you paid.",
  applicationName: "Home Inventory",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Inventory",
  },
  icons: {
    apple: "/home-inventory/apple-touch-icon.png",
    icon: [
      { url: "/home-inventory/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/home-inventory/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/home-inventory/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceef3" },
    { media: "(prefers-color-scheme: dark)", color: "#07080c" },
  ],
};

/** Apply appearance before paint: stored override, else follow the system. */
const themeScript = `(function(){try{var k='home-inventory-theme';var s=localStorage.getItem(k);var m=window.matchMedia('(prefers-color-scheme: dark)');var apply=function(){var v=localStorage.getItem(k);var d=v==='dark'||(v!=='light'&&m.matches);document.documentElement.classList.toggle('dark',d);};apply();m.addEventListener&&m.addEventListener('change',apply);window.__applyTheme=apply;document.documentElement.classList.toggle('solid',localStorage.getItem('home-inventory-solid-surfaces')==='1');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
