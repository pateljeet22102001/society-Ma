import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/components/providers/toast-provider";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "Modern society management for wings, flats, income, expenses, and maintenance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full`}>
      <body className="min-h-full bg-surface font-sans text-slate-900 antialiased">
        {children}
        <ToastProvider />
        <Analytics />
      </body>
    </html>
  );
}
