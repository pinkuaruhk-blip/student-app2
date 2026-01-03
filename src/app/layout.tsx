import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_TC, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/contexts/toast-context";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  weight: ["400", "500", "600", "700"],
  preload: false
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "600", "700"],
  preload: false
});

export const metadata: Metadata = {
  title: "FlowLane",
  description: "A lightweight workflow app",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html lang="en">
      <body
        className={`${notoSans.variable} ${notoSansTC.variable} ${notoSansSC.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
