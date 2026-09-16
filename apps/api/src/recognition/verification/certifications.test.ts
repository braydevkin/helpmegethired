import { describe, expect, it } from "vitest";

import { extractCertifications } from "../../parser";
import { verifyCertifications } from "./certifications";

const quoted = <Value>(value: Value, quote: string) => ({ value, quote });

describe("verifyCertifications", () => {
  const lines = ["AWS Solutions Architect Associate — Amazon Web Services, 2023", "Certified Kubernetes Administrator, issued 2021 by the CNCF"];
  const byRules = { certifications: extractCertifications(lines) };

  it("raises what both readings agree on and confirms a year written in its quote", () => {
    const [aws] = verifyCertifications(lines, byRules, {
      certifications: [
        {
          name: quoted("AWS Solutions Architect Associate", "AWS Solutions Architect Associate"),
          issuer: quoted("Amazon Web Services", "Amazon Web Services"),
          year: quoted(2023, "2023"),
        },
      ],
    }).certifications;

    expect(aws).toEqual({
      name: { value: "AWS Solutions Architect Associate", confidence: "high" },
      issuer: { value: "Amazon Web Services", confidence: "high" },
      year: { value: 2023, confidence: "high" },
    });
  });

  it("keeps the rules' year at low when the Model read another, takes the Model's issuer at low, and leaves out a certification it did not return", () => {
    const [kubernetes, ...others] = verifyCertifications(lines, byRules, {
      certifications: [
        {
          name: quoted("Certified Kubernetes Administrator", "Certified Kubernetes Administrator"),
          issuer: quoted("CNCF", "by the CNCF"),
          year: quoted(2022, "issued 2021"),
        },
      ],
    }).certifications;

    expect(byRules.certifications[1]?.year).toEqual({ value: 2021, confidence: "medium" });
    expect(kubernetes?.year).toEqual({ value: 2021, confidence: "low" });
    expect(kubernetes?.issuer).toEqual({ value: "CNCF", confidence: "low" });
    expect(others).toEqual([]);
  });

  it("pairs certifications listed on one line by name, whatever order the Model returns them in", () => {
    const oneLine = ["CCNP (Cisco, 2022); CCNA (Cisco, 2017)"];
    const rules = { certifications: extractCertifications(oneLine) };
    const { certifications } = verifyCertifications(oneLine, rules, {
      certifications: [
        { name: quoted("CCNA", "CCNA"), issuer: quoted("Cisco", "Cisco"), year: quoted(2017, "2017") },
        { name: quoted("CCNP", "CCNP"), issuer: quoted("Cisco", "Cisco"), year: quoted(2022, "2022") },
      ],
    });

    expect(certifications.map((certification) => [certification.name.value, certification.year?.value, certification.year?.confidence])).toEqual([
      ["CCNP", 2022, "high"],
      ["CCNA", 2017, "high"],
    ]);
  });

  it("keeps a year only the Model read at medium when its quote does not say it", () => {
    const withoutYear = ["Scrum Master — Scrum Alliance"];
    const rules = { certifications: extractCertifications(withoutYear) };
    const [scrum] = verifyCertifications(withoutYear, rules, {
      certifications: [{ name: quoted("Scrum Master", "Scrum Master"), issuer: null, year: quoted(2020, "Scrum Alliance") }],
    }).certifications;

    expect(scrum?.year).toEqual({ value: 2020, confidence: "medium" });
    expect(scrum?.issuer).toEqual(rules.certifications[0]?.issuer);
  });
});
