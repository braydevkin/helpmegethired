import { DIAL_CODES, type DialCode } from "@helpmegethired/shared";

import type { DialCodeOption } from "../../../components/molecules/phone-field/phone-field";

// The ISO country code stands in for the flag emoji of the design, which has no
// glyph on platforms without an emoji font (design open point 6).
const COUNTRY_BY_DIAL_CODE: Record<DialCode, string> = {
  "+351": "PT",
  "+55": "BR",
  "+1": "US",
  "+44": "GB",
  "+34": "ES",
  "+49": "DE",
  "+33": "FR",
  "+91": "IN",
};

export const dialCodeOptions: readonly DialCodeOption[] = DIAL_CODES.map((code) => ({
  value: code,
  label: `${COUNTRY_BY_DIAL_CODE[code]} ${code}`,
}));
