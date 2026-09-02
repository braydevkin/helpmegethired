import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { readSessionToken } from "../lib/session-cookie";
import { JOURNEY_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "./paths";
import "./globals.css";

export const metadata: Metadata = {
  title: "Help Me Get Hired",
  description:
    "A community platform that helps candidates prepare for selection processes with AI-assisted analysis, keeping the reasoning behind each step visible and teachable.",
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const hasSession = Boolean(await readSessionToken());

  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">Help Me Get Hired</Link>
          <nav aria-label="Account">
            {hasSession ? (
              <Link href={JOURNEY_PATH}>Your journey</Link>
            ) : (
              <>
                <Link href={SIGN_IN_PATH}>Sign in</Link>
                <Link href={SIGN_UP_PATH}>Sign up</Link>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
