# Hostile PDF fixtures

The files the extraction tests (#75) feed the worker to prove the requirements in `docs/security.md`, "Resume PDF upload". None of them holds a real person's data. `generate.ts` builds every file deterministically: run `node generate.ts` from this directory to regenerate them after a change to the script.

| File | What it exercises | Expected outcome |
| --- | --- | --- |
| `wrong-magic-bytes.pdf` | An HTML page saved with a `.pdf` name; the bytes do not start with `%PDF-` | `failed`, `not_pdf` |
| `malformed-xref.pdf` | A PDF whose cross-reference table points nowhere, whose trailer has no root, and whose catalog is unreadable, so the reader cannot rebuild it | `failed`, `corrupt_pdf` |
| `encrypted.pdf` | A PDF protected with the user password `candidate` (RC4 40-bit, the standard security handler) | `failed`, `encrypted_pdf` |
| `image-only.pdf` | One page holding a single image and no text, over the 50 KB scanned-detection threshold | `failed`, `scanned_pdf` |
| `embedded-javascript.pdf` | A text PDF whose catalog opens with a JavaScript action | Extracts normally; the action never runs, because the extractor renders nothing |
| `oversized.pdf` | A text PDF padded one byte past 5 MB | `failed`, `too_large` |

`oversized.pdf` is not committed: it is ignored by git and produced by `node generate.ts`, or in a test through the exported `oversized()` function. The encrypted file's password is exported as `ENCRYPTED_USER_PASSWORD` so a test can prove the file opens with it and is refused without it.

To add a case, add a builder to `generate.ts`, run it, describe the file in the table above, and reference the file from the test that exercises it.
