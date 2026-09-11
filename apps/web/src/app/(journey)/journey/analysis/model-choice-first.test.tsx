import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModelChoiceFirst } from "./model-choice-first";

describe("ModelChoiceFirst", () => {
  it("sends a confirmed Profile with no Curation to choose the AI first", () => {
    render(<ModelChoiceFirst modelChoiceHref="/journey/ai" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Choose your AI to start the analysis");
    expect(screen.getByRole("link", { name: "Choose your AI" })).toHaveAttribute("href", "/journey/ai");
    expect(screen.getByRole("button", { name: "Paste a job description" })).toHaveAttribute("aria-disabled", "true");
  });
});
