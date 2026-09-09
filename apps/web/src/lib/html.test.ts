import { describe, expect, it } from "vitest";

import { html } from "./html";

describe("html", () => {
  it("escapes interpolated values", () => {
    expect(html`<p>${'<b class="x">&</b>'}</p>`.toString()).toBe("<p>&lt;b class=&quot;x&quot;&gt;&amp;&lt;/b&gt;</p>");
  });

  it("keeps markup built by another html template as it is", () => {
    const inner = html`<strong>${"1 < 2"}</strong>`;

    expect(html`<p>${inner}</p>`.toString()).toBe("<p><strong>1 &lt; 2</strong></p>");
  });

  it("renders missing values as nothing", () => {
    expect(html`<p>${undefined}${null}</p>`.toString()).toBe("<p></p>");
  });
});
