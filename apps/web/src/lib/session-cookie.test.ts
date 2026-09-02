import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { sessionCookieOptions } = await import("./session-cookie");

const session = { token: "opaque-token", expiresAt: "2026-10-02T10:00:00.000Z" };

describe("sessionCookieOptions", () => {
  it("keeps the token out of scripts and off cross-site requests", () => {
    expect(sessionCookieOptions(session, "development")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("expires with the Session", () => {
    expect(sessionCookieOptions(session, "development").expires).toEqual(new Date(session.expiresAt));
  });

  it("requires HTTPS only in production", () => {
    expect(sessionCookieOptions(session, "development").secure).toBe(false);
    expect(sessionCookieOptions(session, "test").secure).toBe(false);
    expect(sessionCookieOptions(session, "production").secure).toBe(true);
  });
});
