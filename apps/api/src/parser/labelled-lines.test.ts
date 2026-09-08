import { describe, expect, it } from "vitest";

import { labelKindOf, linesOfKind, ownLinesOf, partitionLabelled } from "./labelled-lines";

describe("labelled lines", () => {
  it("reads the kind of a label and ignores any other prefix", () => {
    expect(labelKindOf("Idiomas: Português (nativo), Inglês (fluente)")).toBe("languages");
    expect(labelKindOf("Certificações: CCNA")).toBe("certifications");
    expect(labelKindOf("Note: none")).toBeUndefined();
  });

  it("takes a labelled paragraph of another kind out of a section, wrapped lines included", () => {
    const { own, labelled } = partitionLabelled(
      ["Engineer at Acme", "Shipped it.", "Certifications: CKA (CNCF, 2022); CKAD (CNCF,", "2023)", "", "Languages: English"],
      "experience",
    );

    expect(own).toEqual(["Engineer at Acme", "Shipped it.", ""]);
    expect(labelled).toEqual([
      { kind: "certifications", text: "CKA (CNCF, 2022); CKAD (CNCF, 2023)" },
      { kind: "languages", text: "English" },
    ]);
  });

  it("ends a labelled paragraph at the next labelled line", () => {
    const { labelled } = partitionLabelled(["Idiomas: Português (nativo)", "Certificações: CCNA (Cisco, 2017)"], "summary");

    expect(labelled).toEqual([
      { kind: "languages", text: "Português (nativo)" },
      { kind: "certifications", text: "CCNA (Cisco, 2017)" },
    ]);
  });

  it("collects the section's own lines and the labelled paragraphs found elsewhere", () => {
    const sections = [
      { kind: "experience" as const, heading: "Experience", lines: ["Engineer at Acme", "Certifications: CKA (CNCF, 2022)"] },
      { kind: "certifications" as const, heading: "Certifications", lines: ["Certifications: AWS SAA", "CCNA"] },
    ];

    expect(linesOfKind(sections, "certifications")).toEqual(["CKA (CNCF, 2022)", "AWS SAA", "CCNA"]);
    expect(ownLinesOf(sections, "experience")).toEqual(["Engineer at Acme"]);
  });
});
