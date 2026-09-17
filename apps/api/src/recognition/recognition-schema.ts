import { SEGMENT_RECOGNITION_SCHEMAS, type SegmentRecognition, type SegmentRecognitionKind } from "@helpmegethired/shared";
import type { z } from "zod";

// TypeScript cannot relate a generic index into the schema record to the output inferred for the
// same kind, so the one widening cast lives here instead of at every caller.
export const recognitionSchemaOf = <Kind extends SegmentRecognitionKind>(kind: Kind): z.ZodType<SegmentRecognition<Kind>> =>
  SEGMENT_RECOGNITION_SCHEMAS[kind] as unknown as z.ZodType<SegmentRecognition<Kind>>;
