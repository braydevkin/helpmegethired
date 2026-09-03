import { randomInt } from "node:crypto";
import { VERIFICATION_CODE_LENGTH } from "@helpmegethired/shared";

const CODE_SPACE = 10 ** VERIFICATION_CODE_LENGTH;

export function generateVerificationCode(): string {
  return randomInt(CODE_SPACE).toString().padStart(VERIFICATION_CODE_LENGTH, "0");
}
