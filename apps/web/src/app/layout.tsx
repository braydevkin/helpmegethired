import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Help Me Get Hired",
  description:
    "A community platform that helps candidates prepare for selection processes with AI-assisted analysis, keeping the reasoning behind each step visible and teachable.",
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">Help Me Get Hired</Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
