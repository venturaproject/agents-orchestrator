// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import { clearSessionCookie, createSession, getSession, setSessionCookie } from "../lib/session";

const user = { id: "f6285ec7-f45e-4cb4-a8ad-7283717e41b2", email: "crew@example.test" };

describe("session behavior", () => {
  it("issues a short-lived session cookie when remember-me is off", async () => {
    vi.stubEnv("AUTH_SECRET", "test-session-secret-with-at-least-32-characters");
    const token = await createSession(user, false);
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    expect(payload.exp! - payload.iat!).toBe(12 * 60 * 60);

    const headers = new Headers();
    setSessionCookie(headers, token, false);
    const cookie = headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Max-Age=");
  });

  it("issues a 30-day JWT and persistent cookie when remember-me is on", async () => {
    vi.stubEnv("AUTH_SECRET", "test-session-secret-with-at-least-32-characters");
    const token = await createSession(user, true);
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    expect(payload.exp! - payload.iat!).toBe(30 * 24 * 60 * 60);

    const headers = new Headers();
    setSessionCookie(headers, token, true);
    expect(headers.get("set-cookie")).toContain("Max-Age=2592000");
  });

  it("reads a valid signed session and rejects a tampered token", async () => {
    vi.stubEnv("AUTH_SECRET", "test-session-secret-with-at-least-32-characters");
    const token = await createSession(user, false);
    const request = (value: string) => ({
      cookies: { get: () => ({ value }) },
    }) as never;

    await expect(getSession(request(token))).resolves.toEqual(user);
    await expect(getSession(request(`${token}tampered`))).resolves.toBeNull();
  });

  it("clears the session cookie on logout", () => {
    const headers = new Headers();
    clearSessionCookie(headers);
    expect(headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
