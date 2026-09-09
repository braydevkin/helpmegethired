import { z } from "zod";

import { IdSchema, TimestampSchema } from "./primitives.js";

export const DIAL_CODES = ["+351", "+55", "+1", "+44", "+34", "+49", "+33", "+91"] as const;

export const DialCodeSchema = z.enum(DIAL_CODES, { error: "Choose a country code" });

export type DialCode = z.infer<typeof DialCodeSchema>;

export const DEFAULT_DIAL_CODE: DialCode = "+351";

const PHONE_NUMBER_MIN_DIGITS = 6;
const PHONE_NUMBER_MAX_DIGITS = 15;
const phoneNumberPattern = new RegExp(`^\\d{${PHONE_NUMBER_MIN_DIGITS},${PHONE_NUMBER_MAX_DIGITS}}$`);

export const PhoneNumberSchema = z
  .string({ error: "Phone number is required" })
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(phoneNumberPattern, { error: "Enter a phone number we can reach you on" }));

export const PhoneSchema = z.object({
  countryCode: DialCodeSchema,
  number: PhoneNumberSchema,
});

export type Phone = z.infer<typeof PhoneSchema>;

const NAME_MAX_LENGTH = 100;
const ADDRESS_MAX_LENGTH = 200;

const personName = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(NAME_MAX_LENGTH, { error: `${label} must have at most ${NAME_MAX_LENGTH} characters` });

export const AddressSchema = z
  .string()
  .trim()
  .max(ADDRESS_MAX_LENGTH, { error: `Address must have at most ${ADDRESS_MAX_LENGTH} characters` })
  .nullish()
  .transform((value) => value || null);

export const AccountInformationSchema = z.object({
  name: personName("Name"),
  lastName: personName("Last name"),
  phone: PhoneSchema,
  address: AddressSchema,
});

export type AccountInformation = z.infer<typeof AccountInformationSchema>;

export const AccountSchema = z.object({
  id: IdSchema,
  email: z.email(),
  name: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: PhoneSchema.nullable(),
  address: z.string().nullable(),
  createdAt: TimestampSchema,
});

export type Account = z.infer<typeof AccountSchema>;
