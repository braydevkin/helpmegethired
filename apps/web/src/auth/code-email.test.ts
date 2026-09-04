import { describe, expect, it } from "vitest";

import { renderCodeEmail } from "./code-email";

const code = "482913";

describe("renderCodeEmail", () => {
  const email = renderCodeEmail(code);

  it("puts the code in the subject so it is readable from a notification", () => {
    expect(email.subject).toBe("482913 is your Help Me Get Hired code");
  });

  it("writes a plain text version with the code and the expiry", () => {
    expect(email.text).toContain("Your Help Me Get Hired code");
    expect(email.text).toContain(`\n${code}\n`);
    expect(email.text).toContain("It expires in 10 minutes.");
    expect(email.text).toContain("No passwords. We send a one-time code every time.");
    expect(email.text).not.toMatch(/<[a-z]+[\s>]/);
  });

  it("writes an HTML version with the code and the expiry", () => {
    expect(email.html).toContain("<!doctype html>");
    expect(email.html).toContain(">" + code + "</td>");
    expect(email.html).toContain("It expires in 10 minutes.");
    expect(email.html).toContain("Help Me Get Hired");
  });

  it("escapes what it interpolates into the HTML", () => {
    expect(renderCodeEmail("<b>").html).not.toContain("<b>");
    expect(renderCodeEmail("<b>").html).toContain("&lt;b&gt;");
  });

  it("styles the HTML with the design tokens and a system font fallback", () => {
    expect(email.html).toContain("#0E7C4A");
    expect(email.html).toContain("#0F1A14");
    expect(email.html).toContain("#2ECC71");
    expect(email.html).toContain("font-family: Manrope, ui-sans-serif, system-ui");
    expect(email.html).not.toMatch(/@font-face|fonts\.googleapis|<link/);
  });
});
