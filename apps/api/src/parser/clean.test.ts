import { describe, expect, it } from "vitest";

import { cleanText } from "./clean";

describe("cleanText", () => {
  it("normalises line endings and turns a page break into a blank line", () => {
    expect(cleanText("one\r\ntwo\rthree\fFour")).toBe("one\ntwo\nthree\nFour");
  });

  it("keeps at most one blank line in a row and none at the ends", () => {
    expect(cleanText("\n\nfirst\n\n\n\nsecond\n\n")).toBe("first\n\nsecond");
  });

  it.each(["3", "Page 2 of 4", "Página 3", "Pág. 2 de 3", "2 / 5"])("drops the page number line %s", (line) => {
    expect(cleanText(`before\n${line}\nafter`)).toBe("before\nafter");
  });

  it("keeps a line that only looks like a number when it is not one", () => {
    expect(cleanText("2019\n2021 - 2023")).toBe("2019\n2021 - 2023");
  });

  it("rejoins a word split by a hyphen at the line end", () => {
    expect(cleanText("desenvolvi-\nmento de software")).toBe("desenvolvimento de software");
    expect(cleanText("front-end\n- Node")).toBe("front-end\nNode");
  });

  it("keeps the hyphen of a URL or an e-mail broken at the line end", () => {
    expect(cleanText("www.linkedin.com/in/elena-\npetrova-example")).toBe("www.linkedin.com/in/elena-petrova-example");
    expect(cleanText("ana-\nclara@example.com")).toBe("ana-clara@example.com");
  });

  it("strips bullet glyphs from line starts and keeps hyphens inside words", () => {
    expect(cleanText("• Led the team\n- Shipped v2\n▪ Kept front-end tests green\n→ Done")).toBe(
      "Led the team\nShipped v2\nKept front-end tests green\nDone",
    );
  });

  it("collapses runs of spaces and trims the lines, as pdftotext -layout needs", () => {
    expect(cleanText("  Senior Engineer      Acme    2019 - 2021  \n\tSão Paulo")).toBe("Senior Engineer Acme 2019 - 2021\nSão Paulo");
  });
});
