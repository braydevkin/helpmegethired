// pgvector reads and writes a vector in its text form.
export const toVectorLiteral = (vector: readonly number[]): string => `[${vector.join(",")}]`;
