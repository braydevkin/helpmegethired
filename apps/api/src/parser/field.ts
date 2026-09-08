import type { Field } from "@helpmegethired/shared";

export const field = <Value>(value: Value, confidence: Field<Value>["confidence"]): Field<Value> => ({ value, confidence });

export const medium = (value: string): Field<string> => field(value, "medium");
