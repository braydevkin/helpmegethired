import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { sessionCookieOptions } = await import("./session-cookie");

describe("sessionCookieOptions", () => {
  it("keeps the token out of scripts and off cross-site requests", () => {
    expect(sessionCookieOptions("development")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("requires HTTPS only in production", () => {
    expect(sessionCookieOptions("development").secure).toBe(false);
    expect(sessionCookieOptions("test").secure).toBe(false);
    expect(sessionCookieOptions("production").secure).toBe(true);
  });
});
