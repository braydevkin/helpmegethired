import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileCorrectionRejectedError, ProfileUnavailableError, profileClient } from "../../../../lib/profile-client";
import { readSessionToken } from "../../../../lib/session-cookie";
import { confirmProfileAction, correctBasicProfileAction, removeExperienceAction, saveExperienceAction } from "./actions";

vi.mock("../../../../lib/profile-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/profile-client")>()),
  profileClient: { get: vi.fn(), confirm: vi.fn(), correctBasicProfile: vi.fn(), addEntry: vi.fn(), correctEntry: vi.fn(), removeEntry: vi.fn() },
}));
vi.mock("../../../../lib/session-cookie", () => ({ readSessionToken: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSessionToken).mockResolvedValue("session-token");
});

describe("confirmProfileAction", () => {
  it("confirms with the Session and moves on to the analysis", async () => {
    vi.mocked(profileClient.confirm).mockResolvedValue({} as never);

    await expect(confirmProfileAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(profileClient.confirm).toHaveBeenCalledWith("session-token");
    expect(redirect).toHaveBeenCalledWith("/journey/analysis");
  });

  it("asks to sign in again without a Session, and never calls the API", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);

    expect(await confirmProfileAction()).toEqual({ ok: false, message: "Your session has expired. Sign in again to confirm your Profile." });
    expect(profileClient.confirm).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("says the Profile could not be confirmed when the API refuses, and stays on the page", async () => {
    vi.mocked(profileClient.confirm).mockRejectedValue(new ProfileUnavailableError(404));

    expect(await confirmProfileAction()).toEqual({ ok: false, message: "We couldn't confirm your Profile. Try again in a moment." });
    expect(redirect).not.toHaveBeenCalled();
  });
});

const ENTRY_ID = "2f5c3b7d-0e4a-4f9b-8c6d-3a7b9e2d4f6c";

const formOf = (fields: Record<string, string>): FormData => {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }

  return form;
};

const experienceForm = (fields: Record<string, string> = {}) =>
  formOf({ role: "Staff Backend Engineer", company: "", periodStart: "2022-03", periodEnd: "", description: "", skills: "Node.js", ...fields });

const correctedExperience = { role: "Staff Backend Engineer", company: null, period: { start: "2022-03", end: null }, description: null, skills: ["Node.js"] };

describe("saveExperienceAction", () => {
  it("corrects the role the form names, and re-renders the step from the API", async () => {
    vi.mocked(profileClient.correctEntry).mockResolvedValue({} as never);

    expect(await saveExperienceAction(null, experienceForm({ id: ENTRY_ID }))).toEqual({ ok: true });
    expect(profileClient.correctEntry).toHaveBeenCalledWith("session-token", "experiences", ENTRY_ID, correctedExperience);
    expect(profileClient.addEntry).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/journey", "layout");
  });

  it("adds a role when the form names none", async () => {
    vi.mocked(profileClient.addEntry).mockResolvedValue({} as never);

    expect(await saveExperienceAction(null, experienceForm())).toEqual({ ok: true });
    expect(profileClient.addEntry).toHaveBeenCalledWith("session-token", "experiences", correctedExperience);
    expect(profileClient.correctEntry).not.toHaveBeenCalled();
  });

  it("answers the fields a form breaks with, and sends nothing", async () => {
    expect(await saveExperienceAction(null, experienceForm({ role: "" }))).toEqual({
      ok: false,
      message: "Some fields need a change before this can be saved.",
      issues: { role: "Name the role this experience was for." },
    });
    expect(profileClient.addEntry).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("puts the fields the API refused on the form", async () => {
    vi.mocked(profileClient.addEntry).mockRejectedValue(new ProfileCorrectionRejectedError({ role: "Too small" }));

    expect(await saveExperienceAction(null, experienceForm())).toEqual({
      ok: false,
      message: "Some fields need a change before this can be saved.",
      issues: { role: "Too small" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    [409, "Your Profile is confirmed, so it takes no more corrections."],
    [401, "Your session has expired. Sign in again to continue."],
    [503, "We couldn't save your correction. Try again in a moment."],
  ])("answers a %i from the API with its own words", async (status, message) => {
    vi.mocked(profileClient.addEntry).mockRejectedValue(new ProfileUnavailableError(status));

    expect(await saveExperienceAction(null, experienceForm())).toEqual({ ok: false, message });
  });

  it("asks to sign in again without a Session, and never calls the API", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);

    expect(await saveExperienceAction(null, experienceForm())).toEqual({ ok: false, message: "Your session has expired. Sign in again to continue." });
    expect(profileClient.addEntry).not.toHaveBeenCalled();
  });
});

describe("correctBasicProfileAction", () => {
  it("sends the four fields and re-renders the step", async () => {
    vi.mocked(profileClient.correctBasicProfile).mockResolvedValue({} as never);

    const form = formOf({ headline: "Distributed systems engineer", summary: "", linkedinUrl: "", githubUrl: "https://github.com/ada" });

    expect(await correctBasicProfileAction(null, form)).toEqual({ ok: true });
    expect(profileClient.correctBasicProfile).toHaveBeenCalledWith("session-token", {
      headline: "Distributed systems engineer",
      summary: null,
      linkedinUrl: null,
      githubUrl: "https://github.com/ada",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/journey", "layout");
  });
});

describe("removeExperienceAction", () => {
  it("removes the role and re-renders the step", async () => {
    vi.mocked(profileClient.removeEntry).mockResolvedValue({} as never);

    expect(await removeExperienceAction(ENTRY_ID)).toEqual({ ok: true });
    expect(profileClient.removeEntry).toHaveBeenCalledWith("session-token", "experiences", ENTRY_ID);
    expect(revalidatePath).toHaveBeenCalledWith("/journey", "layout");
  });

  it("says a confirmed Profile takes no more corrections", async () => {
    vi.mocked(profileClient.removeEntry).mockRejectedValue(new ProfileUnavailableError(409));

    expect(await removeExperienceAction(ENTRY_ID)).toEqual({ ok: false, message: "Your Profile is confirmed, so it takes no more corrections." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
