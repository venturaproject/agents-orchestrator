import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentSession } from "../features/auth/services/session-client";

describe("fetchCurrentSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the same-origin API proxy when no backend URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCurrentSession();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
      headers: expect.any(Headers),
      cache: "no-store",
      credentials: "include",
    });
  });

  it("sends cookies to the configured Nest backend", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "http://localhost:3001/");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCurrentSession();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/auth/session", {
      headers: expect.any(Headers),
      cache: "no-store",
      credentials: "include",
    });
  });
});
