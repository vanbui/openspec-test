import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";

import { AppShell } from "@/components/shell/app-shell";
import { routeDefinitions } from "@/config/routes";
import {
  developmentFixtureCookieName,
  resolveDevelopmentIdentity,
} from "@/lib/fixtures/resolve-identity";

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
  const cookieStore = await cookies();
  const identity = resolveDevelopmentIdentity({
    cookieValue: cookieStore.get(developmentFixtureCookieName)?.value,
  });

  return (
    <html lang="en">
      <body className={inter.variable}>
        <AppShell identity={identity ?? null} routes={routeDefinitions}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
