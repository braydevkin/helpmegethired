import { describe, expect, it } from "vitest";

import { extractCertifications } from "./certifications";

describe("extractCertifications", () => {
  it("reads name, issuer, and year in the dash, parenthesis, and year-first forms", () => {
    const certifications = extractCertifications([
      "AWS Solutions Architect Associate — Amazon Web Services, 2023",
      "CCNA (Cisco, 2022)",
      "2021 Databricks Certified Data Engineer Associate, Databricks",
    ]);

    expect(certifications).toEqual([
      { name: { value: "AWS Solutions Architect Associate", confidence: "medium" }, issuer: { value: "Amazon Web Services", confidence: "medium" }, year: { value: 2023, confidence: "medium" } },
      { name: { value: "CCNA", confidence: "medium" }, issuer: { value: "Cisco", confidence: "medium" }, year: { value: 2022, confidence: "medium" } },
      { name: { value: "Databricks Certified Data Engineer Associate", confidence: "medium" }, issuer: { value: "Databricks", confidence: "medium" }, year: { value: 2021, confidence: "medium" } },
    ]);
  });

  it("keeps a bare name, reads an issuer after by or por, and takes the start of a validity range", () => {
    expect(extractCertifications(["CCNA", "Scrum Master by Scrum.org", "Kubernetes Administrator, CNCF, 2022 – 2025"])).toEqual([
      { name: { value: "CCNA", confidence: "medium" }, issuer: null, year: null },
      { name: { value: "Scrum Master", confidence: "medium" }, issuer: { value: "Scrum.org", confidence: "medium" }, year: null },
      { name: { value: "Kubernetes Administrator", confidence: "medium" }, issuer: { value: "CNCF", confidence: "medium" }, year: { value: 2022, confidence: "medium" } },
    ]);
  });

  it("skips blank lines and prose", () => {
    expect(extractCertifications(["", "Over the years I have taken many courses on cloud, security, and data, most of them online."])).toEqual([]);
  });
});

describe("extractCertifications on a labelled line", () => {
  it("splits several certifications written on one line", () => {
    expect(extractCertifications(["CCNP Enterprise (Cisco, 2022); CCNA (Cisco, 2017)"]).map((c) => [c.name.value, c.issuer?.value, c.year?.value])).toEqual([
      ["CCNP Enterprise", "Cisco", 2022],
      ["CCNA", "Cisco", 2017],
    ]);
  });
});
