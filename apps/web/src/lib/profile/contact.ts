import type { Account, BasicProfile, Phone } from "@helpmegethired/shared";

export interface ContactRow {
  label: string;
  value: string;
  href?: string;
  missing?: boolean;
}

const NOT_IN_PDF = "Not found in your PDF";
const NOT_GIVEN = "Not given yet";

const linkTextOf = (url: string): string => url.replace(/^https?:\/\//u, "").replace(/\/$/u, "");

const phoneTextOf = (phone: Phone | null): string | null => (phone ? `${phone.countryCode} ${phone.number}` : null);

// Account Information the Candidate typed: what is missing was never given, not lost.
const account = (label: string, value: string | null): ContactRow => (value ? { label, value } : { label, value: NOT_GIVEN, missing: true });

const extracted = (label: string, url: string | null): ContactRow =>
  url ? { label, value: linkTextOf(url), href: url } : { label, value: NOT_IN_PDF, missing: true };

// E-mail, phone, and address belong to the Account; only the two URLs come from the PDF.
export const contactRowsOf = (information: Account, basicProfile: BasicProfile): ContactRow[] => [
  { label: "E-mail", value: information.email },
  account("Phone", phoneTextOf(information.phone)),
  extracted("GitHub", basicProfile.githubUrl),
  extracted("LinkedIn", basicProfile.linkedinUrl),
  account("Address", information.address),
];
