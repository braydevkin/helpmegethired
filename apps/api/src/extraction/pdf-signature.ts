const PDF_SIGNATURE = Buffer.from("%PDF-", "latin1");

export const hasPdfSignature = (bytes: Buffer): boolean =>
  bytes.length >= PDF_SIGNATURE.length && bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
