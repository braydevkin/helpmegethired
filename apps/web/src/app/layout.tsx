import type { Metadata } from "next";
import type { ReactNode } from "react";

import { manrope } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Help Me Get Hired",
  description:
    "A community platform that helps candidates prepare for selection processes with AI-assisted analysis, keeping the reasoning behind each step visible and teachable.",
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
