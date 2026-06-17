import type { Metadata } from "next";
import { Playfair_Display, Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SideNav } from "@/components/shared/SideNav";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kasalan — Philippine Wedding Planner",
  description: "Plan your perfect Filipino wedding",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kasalan",
  },
};

export const viewport = {
  themeColor: "#c9956a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${montserrat.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <SideNav />
        <div className="lg:pl-56">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}
