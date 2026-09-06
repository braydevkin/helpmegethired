import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MEGABYTE = 1024 * 1024;
const MAX_SIZE_BYTES = 5 * MEGABYTE;
const SCANNED_DETECTION_MIN_BYTES = 50 * 1024;

const here = dirname(fileURLToPath(import.meta.url));

interface PdfObject {
  dictionary: string;
  stream?: Buffer;
}

const latin1 = (text: string) => Buffer.from(text, "latin1");

function serialise(objects: readonly PdfObject[], trailerEntries: string): Buffer {
  const header = latin1("%PDF-1.7\n%âãÏÓ\n");
  const parts = [header];
  const offsets: number[] = [];
  let length = header.length;

  objects.forEach((object, index) => {
    offsets.push(length);

    const body = object.stream
      ? Buffer.concat([latin1("stream\n"), object.stream, latin1("\nendstream\n")])
      : Buffer.alloc(0);
    const chunk = Buffer.concat([latin1(`${index + 1} 0 obj\n${object.dictionary}\n`), body, latin1("endobj\n")]);

    parts.push(chunk);
    length += chunk.length;
  });

  const entries = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `);
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f ", ...entries].join("\n");
  const trailer = `trailer\n<< /Size ${objects.length + 1} ${trailerEntries} >>\nstartxref\n${length}\n%%EOF\n`;

  parts.push(latin1(`${xref}\n${trailer}`));

  return Buffer.concat(parts);
}

const streamObject = (entries: string, stream: Buffer): PdfObject => ({
  dictionary: `<< ${entries} /Length ${stream.length} >>`,
  stream,
});

interface PageOptions {
  resources?: string;
  catalogEntries?: string;
  extraObjects?: readonly PdfObject[];
}

function onePageDocument(content: Buffer, { resources = "", catalogEntries = "", extraObjects = [] }: PageOptions = {}) {
  return [
    { dictionary: `<< /Type /Catalog /Pages 2 0 R ${catalogEntries} >>` },
    { dictionary: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      dictionary: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << ${resources} >> >>`,
    },
    streamObject("", content),
    ...extraObjects,
  ];
}

const helvetica: PdfObject = { dictionary: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" };
const fontResources = "/Font << /F1 5 0 R >>";
const textContent = latin1("BT /F1 12 Tf 72 770 Td (Ada Lovelace - Senior Software Engineer) Tj ET");

const textDocument = (options: PageOptions = {}) =>
  onePageDocument(textContent, {
    resources: fontResources,
    catalogEntries: options.catalogEntries,
    extraObjects: [helvetica, ...(options.extraObjects ?? [])],
  });

function wrongMagicBytes(): Buffer {
  return latin1("<!doctype html>\n<title>Not a PDF</title>\n<p>A web page saved with a .pdf extension.</p>\n");
}

function malformedXref(): Buffer {
  const document = serialise(textDocument(), "/Root 1 0 R").toString("latin1");
  const withoutCatalog = document.replace("/Type /Catalog", "/Type /Catalo").slice(0, document.indexOf("xref"));
  const brokenTable = "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 6 >>\nstartxref\n999999\n%%EOF\n";

  return latin1(withoutCatalog + brokenTable);
}

function embeddedJavascript(): Buffer {
  const openAction = '/OpenAction << /S /JavaScript /JS (app.alert\\("hostile"\\);) >>';

  return serialise(textDocument({ catalogEntries: openAction }), "/Root 1 0 R");
}

function imageOnly(): Buffer {
  const width = 240;
  const height = 320;
  const pixels = Buffer.alloc(width * height);

  for (let index = 0; index < pixels.length; index += 1) {
    pixels[index] = (index * 7) & 0xff;
  }

  if (pixels.length < SCANNED_DETECTION_MIN_BYTES) {
    throw new Error("The image must push the file over the scanned detection threshold");
  }

  const image = streamObject(
    `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8`,
    pixels,
  );
  const content = latin1("q 480 0 0 640 57 100 cm /Im1 Do Q");

  return serialise(onePageDocument(content, { resources: "/XObject << /Im1 5 0 R >>", extraObjects: [image] }), "/Root 1 0 R");
}

export function oversized(): Buffer {
  const padding = streamObject("", Buffer.alloc(MAX_SIZE_BYTES + 1, 0x41));

  return serialise(textDocument({ extraObjects: [padding] }), "/Root 1 0 R");
}

const PASSWORD_PADDING = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);
const ALL_PERMISSIONS = Buffer.from("ffffffff", "hex");
const md5 = (...parts: Buffer[]) => createHash("md5").update(Buffer.concat(parts)).digest();
const padded = (password: string) => Buffer.concat([latin1(password), PASSWORD_PADDING]).subarray(0, 32);

function rc4(key: Buffer, data: Buffer): Buffer {
  const state = Array.from({ length: 256 }, (_, index) => index);

  for (let i = 0, j = 0; i < 256; i += 1) {
    j = (j + state[i] + key[i % key.length]) & 0xff;
    [state[i], state[j]] = [state[j], state[i]];
  }

  const output = Buffer.alloc(data.length);

  for (let k = 0, i = 0, j = 0; k < data.length; k += 1) {
    i = (i + 1) & 0xff;
    j = (j + state[i]) & 0xff;
    [state[i], state[j]] = [state[j], state[i]];
    output[k] = data[k] ^ state[(state[i] + state[j]) & 0xff];
  }

  return output;
}

export const ENCRYPTED_USER_PASSWORD = "candidate";

function encrypted(): Buffer {
  const documentId = md5(latin1("hostile-encrypted"));
  const ownerEntry = rc4(md5(padded("owner")).subarray(0, 5), padded(ENCRYPTED_USER_PASSWORD));
  const fileKey = md5(padded(ENCRYPTED_USER_PASSWORD), ownerEntry, ALL_PERMISSIONS, documentId).subarray(0, 5);
  const userEntry = rc4(fileKey, PASSWORD_PADDING);
  const objectKey = (number: number) =>
    md5(fileKey, Buffer.from([number & 0xff, (number >> 8) & 0xff, (number >> 16) & 0xff, 0, 0])).subarray(0, 10);

  const encryptDictionary: PdfObject = {
    dictionary:
      `<< /Filter /Standard /V 1 /R 2 /Length 40 /P -1 ` +
      `/O <${ownerEntry.toString("hex")}> /U <${userEntry.toString("hex")}> >>`,
  };
  const objects = textDocument({ extraObjects: [encryptDictionary] });
  const contentObjectNumber = 4;
  const content = objects[contentObjectNumber - 1];

  objects[contentObjectNumber - 1] = streamObject("", rc4(objectKey(contentObjectNumber), content.stream ?? Buffer.alloc(0)));

  const id = `<${documentId.toString("hex")}>`;

  return serialise(objects, `/Root 1 0 R /Encrypt 6 0 R /ID [${id} ${id}]`);
}

const committedFixtures = {
  "wrong-magic-bytes.pdf": wrongMagicBytes,
  "malformed-xref.pdf": malformedXref,
  "embedded-javascript.pdf": embeddedJavascript,
  "image-only.pdf": imageOnly,
  "encrypted.pdf": encrypted,
} as const;

const generatedFixtures = { "oversized.pdf": oversized } as const;

export const HOSTILE_FIXTURES = [...Object.keys(committedFixtures), ...Object.keys(generatedFixtures)] as const;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [fileName, build] of Object.entries({ ...committedFixtures, ...generatedFixtures })) {
    const bytes = build();

    writeFileSync(join(here, fileName), bytes);
    process.stdout.write(`${fileName}\t${bytes.length} bytes\n`);
  }
}
