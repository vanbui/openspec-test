import type { Metadata } from "next";
import localFont from "next/font/local";

import { RuntimeShell } from "@/components/shell/runtime-shell";

import "./globals.css";

const inter = localFont({
  src: "./fonts/Inter-Variable.ttf",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "IdamBox CSRM",
  description: "IdamBox Cyber Risk Manager workspace.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <RuntimeShell>{children}</RuntimeShell>
      </body>
    </html>
  );
}
