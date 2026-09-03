import { DialCodeSchema, type Account, type Phone } from "@helpmegethired/shared";

import type { AccountRow } from "../database/database.schema";

export const accountColumns = [
  "id",
  "email",
  "name",
  "last_name",
  "phone_country_code",
  "phone_number",
  "address",
  "created_at",
] as const;

export type AccountColumns = Pick<AccountRow, (typeof accountColumns)[number]>;

function toPhone(row: AccountColumns): Phone | null {
  return row.phone_country_code && row.phone_number
    ? { countryCode: DialCodeSchema.parse(row.phone_country_code), number: row.phone_number }
    : null;
}

export function toAccount(row: AccountColumns): Account {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    lastName: row.last_name,
    phone: toPhone(row),
    address: row.address,
    createdAt: row.created_at.toISOString(),
  };
}
