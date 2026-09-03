import Link from "next/link";
import type { ReactNode } from "react";

import { readSessionToken } from "../../lib/session-cookie";
import { JOURNEY_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "../paths";

type SiteLayoutProps = Readonly<{ children: ReactNode }>;

export default async function SiteLayout({ children }: SiteLayoutProps) {
  const hasSession = Boolean(await readSessionToken());

  return (
    <>
      <header className="site-header">
        <Link href="/" className="site-brand">
          Help Me Get Hired
        </Link>
        <nav aria-label="Account" className="site-nav">
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
      <main className="site-main">{children}</main>
    </>
  );
}
