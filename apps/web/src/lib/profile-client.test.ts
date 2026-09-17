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
  corrections: { basicProfile: false, entryIds: [] },
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

  it("corrects the Basic Profile with a PUT carrying the four fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, profile));

    await new ProfileClient("http://api.test", fetchMock).correctBasicProfile(token, profile.basicProfile);

    const sent = fetchMock.mock.calls[0]?.[1];

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.test/profile/parts/basic-profile");
    expect(sent).toMatchObject({ method: "PUT", body: JSON.stringify(profile.basicProfile) });
    expect(sent.headers).toMatchObject({ "content-type": "application/json" });
  });

  it("adds, corrects and removes an entry on the part's own path", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json(200, profile)));
    const client = new ProfileClient("http://api.test", fetchMock);
    const entryId = "2f5c3b7d-0e4a-4f9b-8c6d-3a7b9e2d4f6c";
    const entry = { name: "Portuguese", level: "Native" };

    await client.addEntry(token, "languages", entry);
    await client.correctEntry(token, "languages", entryId, entry);
    await client.removeEntry(token, "languages", entryId);

    expect(fetchMock.mock.calls.map(([url, sent]) => `${sent.method} ${url}`)).toEqual([
      "POST http://api.test/profile/parts/languages",
      `PUT http://api.test/profile/parts/languages/${entryId}`,
      `DELETE http://api.test/profile/parts/languages/${entryId}`,
    ]);
  });

  it("keeps the issues of a correction the API refused, by field", async () => {
    const refusal = { statusCode: 400, message: "Validation failed", error: "Bad Request", issues: [{ path: "role", message: "Too small" }] };
    const fetchMock = vi.fn().mockResolvedValue(json(400, refusal));

    const refused = { role: "", company: null, period: null, description: null, skills: [] };

    await expect(new ProfileClient("http://api.test", fetchMock).addEntry(token, "experiences", refused)).rejects.toMatchObject({
      name: "ProfileCorrectionRejectedError",
      issues: { role: "Too small" },
    });
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
