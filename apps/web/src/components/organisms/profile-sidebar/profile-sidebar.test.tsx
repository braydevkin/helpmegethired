import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileSidebar } from "./profile-sidebar";

const completeness = { percentage: 86, hint: "Add your address and a summary line to reach 100% and unlock better role matching." };
const contact = [
  { label: "E-mail", value: "ada@example.com" },
  { label: "GitHub", value: "github.com/ada", href: "https://github.com/ada" },
  { label: "Address", value: "Not given yet", missing: true },
];

describe("ProfileSidebar", () => {
  it("shows the completeness, the contact, the languages, and the certifications", () => {
    render(
      <ProfileSidebar
        completeness={completeness}
        contact={contact}
        languages={[{ name: "Portuguese", level: "Native" }]}
        certifications={[{ name: "AWS Solutions Architect", meta: "Amazon Web Services · 2024" }]}
      />,
    );

    expect(screen.getByText("86%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Profile completeness" })).toHaveAttribute("aria-valuenow", "86");
    expect(screen.getByText(completeness.hint)).toBeInTheDocument();

    const card = screen.getByRole("region", { name: "Contact" });

    expect(within(card).getByRole("link", { name: "github.com/ada" })).toHaveAttribute("href", "https://github.com/ada");
    expect(within(card).getByText("Not given yet")).toBeInTheDocument();

    expect(within(screen.getByRole("region", { name: "Languages" })).getByText("Native")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Certifications" })).getByText("Amazon Web Services · 2024")).toBeInTheDocument();
  });

  it("leaves out a card the Ingestion found nothing for", () => {
    render(<ProfileSidebar completeness={completeness} contact={contact} languages={[]} certifications={[]} />);

    expect(screen.queryByRole("region", { name: "Languages" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Certifications" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Contact" })).toBeInTheDocument();
  });
});
