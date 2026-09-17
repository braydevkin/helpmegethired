import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModelChoiceBeforeUpload, UPLOAD_LOCK_REASON } from "./model-choice-before-upload";

describe("ModelChoiceBeforeUpload", () => {
  it("leads to Choose your AI and keeps the upload locked, saying why", () => {
    render(<ModelChoiceBeforeUpload modelChoiceHref="/journey/ai" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Choose your AI before you upload");
    expect(screen.getByRole("link", { name: "Choose your AI" })).toHaveAttribute("href", "/journey/ai");

    const upload = screen.getByRole("button", { name: "Upload your résumé" });

    expect(upload).toHaveAttribute("aria-disabled", "true");
    expect(upload).toHaveAccessibleDescription(UPLOAD_LOCK_REASON);
  });
});
