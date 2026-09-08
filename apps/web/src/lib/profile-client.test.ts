import { describe, expect, it, vi } from "vitest";

import { ProfileClient } from "./profile-client";

const token = "session-token";
const profile = {
  accountId: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  basicProfile: { headline: "Backend engineer", summary: null, linkedinUrl: null, githubUrl: null },
  experiences: [],
  education: [],
  projects: [],
  skills: [],
  languages: [],
  certifications: [],
  yearsOfExperience: 7,
  reviewFlags: [],
  source: null,
  confirmedAt: null,
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("ProfileClient", () => {
  it("reads the Profile with the Session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, profile));

    expect(await new ProfileClient("http://api.test", fetchMock).get(token)).toEqual(profile);
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/profile", expect.objectContaining({ method: "GET" }));
    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({ authorization: `Bearer ${token}` });
  });

  it("confirms with a POST and answers the Profile without its review flags", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, profile));

    expect((await new ProfileClient("http://api.test", fetchMock).confirm(token)).reviewFlags).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/profile/confirm", expect.objectContaining({ method: "POST" }));
  });

  it("raises what the API answered when it refuses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(401, { statusCode: 401, message: "Unauthorized", error: "Unauthorized" }));

    await expect(new ProfileClient("http://api.test", fetchMock).get(token)).rejects.toMatchObject({ name: "ProfileUnavailableError", status: 401 });
  });

  it("raises rather than answering a body that is not a Profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<html>proxy</html>", { status: 200 }));

    await expect(new ProfileClient("http://api.test", fetchMock).get(token)).rejects.toThrow();
  });
});
