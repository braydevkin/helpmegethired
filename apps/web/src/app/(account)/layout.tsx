import type { ReactNode } from "react";

import { AccountTemplate } from "../../components/templates/account-template/account-template";

type AccountLayoutProps = Readonly<{ children: ReactNode }>;

export default function AccountLayout({ children }: AccountLayoutProps) {
  return <AccountTemplate>{children}</AccountTemplate>;
}
