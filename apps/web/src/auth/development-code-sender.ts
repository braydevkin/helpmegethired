import { globalSingleton } from "../lib/global-singleton";
import type { CodeDelivery, CodeSender } from "./code-sender";

type CodesByEmail = Map<string, string>;

const lastCodes = () => globalSingleton<CodesByEmail>("verification-codes", () => new Map());

export class DevelopmentCodeSender implements CodeSender {
  constructor(
    private readonly log: (message: string) => void = console.log,
    private readonly codes: CodesByEmail = lastCodes(),
  ) {}

  send({ email, code }: CodeDelivery): Promise<void> {
    this.codes.set(email, code);
    this.log(`Verification code for ${email}: ${code}`);

    return Promise.resolve();
  }

  lastCodeFor(email: string): string | undefined {
    return this.codes.get(email);
  }
}
