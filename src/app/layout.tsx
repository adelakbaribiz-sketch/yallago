import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YallaGo — Ride, Delivery & Cargo Platform",
  description: "A unified ride-hailing and logistics platform: car rides, motorcycle delivery, and cargo transport with real-time tracking and dispatch.",
  keywords: ["ride-hailing", "logistics", "delivery", "cargo", "transport", "YallaGo"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster />
        <Sonner />
      </body>
    </html>
  );
}
