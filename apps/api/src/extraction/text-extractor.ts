export interface ExtractedText {
  text: string;
  extractorVersion: string;
}

export abstract class TextExtractor {
  abstract extract(bytes: Buffer): Promise<ExtractedText>;
}
