import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InventoryProvider } from "@/context/InventoryContext";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Home Inventory",
  description: "Mobile-first home inventory for stock counts, low stock, and restock lists.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
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
      <body className="font-sans antialiased">
        <InventoryProvider>
          <AppShell>{children}</AppShell>
        </InventoryProvider>
      </body>
    </html>
  );
}
