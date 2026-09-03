import { EmailSchema } from "@helpmegethired/shared";
import { NextResponse, type NextRequest } from "next/server";

import { DevelopmentCodeSender } from "../../../auth/development-code-sender";

const notFound = () => new NextResponse(null, { status: 404 });

export function GET(request: NextRequest): NextResponse {
  if (process.env.NODE_ENV === "production") {
    return notFound();
  }

  const email = EmailSchema.safeParse(request.nextUrl.searchParams.get("email"));
  const code = email.success ? new DevelopmentCodeSender().lastCodeFor(email.data) : undefined;

  return code ? NextResponse.json({ code }) : notFound();
}
