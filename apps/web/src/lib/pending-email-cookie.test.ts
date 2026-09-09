import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
const cookieStore = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  set: vi.fn((name: string, value: string) => {
    jar.set(name, value);
  }),
  delete: (name: string) => {
    jar.delete(name);
  },
};

vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(cookieStore) }));

const { forgetPendingEmail, pendingEmailCookieOptions, readPendingEmail, rememberPendingEmail } = await import(
  "./pending-email-cookie"
);

describe("pending email cookie", () => {
  beforeEach(() => {
    jar.clear();
    cookieStore.set.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("remembers the email with the time the code was sent and reads it back", async () => {
    const pending = await rememberPendingEmail("ada@example.com");

    expect(pending).toEqual({ email: "ada@example.com", sentAt: Date.now() });
    expect(await readPendingEmail()).toEqual(pending);
  });

  it("lives only as long as the code, out of scripts and off cross-site requests", () => {
    expect(pendingEmailCookieOptions("production")).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 600,
    });
    expect(pendingEmailCookieOptions("development").secure).toBe(false);
  });

  it("ignores a cookie that is not a pending email", async () => {
    jar.set("pending-email", "not json");
    expect(await readPendingEmail()).toBeUndefined();

    jar.set("pending-email", JSON.stringify({ email: "not-an-email", sentAt: 1 }));
    expect(await readPendingEmail()).toBeUndefined();
  });

  it("forgets the email once the code is verified", async () => {
    await rememberPendingEmail("ada@example.com");
    await forgetPendingEmail();

    expect(await readPendingEmail()).toBeUndefined();
  });
});
