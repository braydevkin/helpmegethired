import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProfileActions } from "./profile-actions";

const uploadHref = "/journey/resume";

describe("ProfileActions", () => {
  it("offers the way back to a new upload and confirms the Profile", async () => {
    const confirm = vi.fn().mockResolvedValue({ ok: true });

    render(<ProfileActions uploadHref={uploadHref} confirmed={false} confirm={confirm} />);

    expect(screen.getByRole("link", { name: "Re-upload PDF" })).toHaveAttribute("href", uploadHref);

    fireEvent.click(screen.getByRole("button", { name: "Confirm profile" }));

    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  });

  it("says what went wrong and keeps the button when the Profile could not be confirmed", async () => {
    const confirm = vi.fn().mockResolvedValue({ ok: false, message: "We couldn't confirm your Profile. Try again in a moment." });

    render(<ProfileActions uploadHref={uploadHref} confirmed={false} confirm={confirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm profile" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't confirm your Profile");
    expect(screen.getByRole("button", { name: "Confirm profile" })).toBeInTheDocument();
  });

  it("stops offering the confirmation once the Profile carries one", () => {
    render(<ProfileActions uploadHref={uploadHref} confirmed confirm={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Confirm profile" })).not.toBeInTheDocument();
    expect(screen.getByText("Profile confirmed · the LinkedIn step is next")).toBeInTheDocument();
  });
});
