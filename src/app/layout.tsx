import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/contexts/toast-context";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const notoSansSC = Noto_Sans_SC({
  weight: ['400', '500', '700'],
  preload: false
});

const notoSansTC = Noto_Sans_TC({
  weight: ['400', '500', '700'],
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
        className="antialiased"
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
