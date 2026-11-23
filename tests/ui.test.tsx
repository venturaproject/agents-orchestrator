import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../app/page";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Crew UI", () => {
  beforeEach(() => {
    localStorage.setItem("crew-locale", "en");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/session") return jsonResponse({ user: null });
      if (url === "/api/auth/login") return jsonResponse({ user: { id: "user-1", email: "demo@example.test" } });
      if (url === "/api/runs") return jsonResponse({ runs: [] });
      if (url === "/api/auth/logout") return jsonResponse({ ok: true });
      throw new Error(`Unexpected fetch: ${url} ${init?.method || "GET"}`);
    }));
  });

  it("provides accessible password visibility, remember-me, and locale controls", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await screen.findByRole("heading", { name: "Sign in to your workspace." });
    expect(screen.getByText("Account creation is disabled for this demo.")).toBeTruthy();

    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.type).toBe("text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.type).toBe("password");

    await user.click(screen.getByRole("button", { name: "ES" }));
    expect(await screen.findByRole("heading", { name: "Accede a tu espacio de trabajo." })).toBeTruthy();
    expect(document.documentElement.lang).toBe("es");
    expect(localStorage.getItem("crew-locale")).toBe("es");

    const remember = screen.getByRole("checkbox", { name: "Mantener sesión iniciada" });
    await user.click(remember);
    expect((remember as HTMLInputElement).checked).toBe(true);
  });

  it("submits the remember-me preference during login", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByRole("heading", { name: "Sign in to your workspace." });
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "demo@example.test");
    await user.type(screen.getByLabelText("Password"), "valid-password");
    await user.click(screen.getByRole("checkbox", { name: "Keep me signed in" }));
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { name: "Make work flow." });
    const loginCall = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/auth/login");
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({
      email: "demo@example.test",
      password: "valid-password",
      rememberMe: true,
    });
  });

  it("lets the signed-in user change appearance and language and sign out", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/session") return jsonResponse({ user: { id: "user-1", email: "demo@example.test" } });
      if (url === "/api/runs") return jsonResponse({ runs: [] });
      if (url === "/api/auth/logout") return jsonResponse({ ok: true });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByRole("heading", { name: "Make work flow." });

    const headerTrigger = screen.getByRole("button", { name: "demo@example.test" });
    expect(headerTrigger.classList.contains("account-avatar-trigger")).toBe(true);
    expect(headerTrigger.textContent?.trim()).toBe("DE");
    expect(headerTrigger.querySelector("svg")).toBeNull();
    await user.click(headerTrigger);
    expect(await screen.findByRole("menu")).toBeTruthy();
    await user.hover(screen.getByRole("menuitem", { name: "Appearance" }));
    const lightItem = await screen.findByRole("menuitem", { name: "Light" });
    fireEvent.click(lightItem);
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("light");
      expect(localStorage.getItem("crew-theme")).toBe("light");
    });

    if (!screen.queryByRole("menu")) {
      await user.click(headerTrigger);
    }
    await user.hover(screen.getByRole("menuitem", { name: "Language" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Español" }));
    expect(await screen.findByRole("heading", { name: "Haz que el trabajo fluya." })).toBeTruthy();
    expect(document.documentElement.lang).toBe("es");

    if (!screen.queryByRole("menu")) {
      await user.click(headerTrigger);
    }
    await user.click(await screen.findByRole("menuitem", { name: "Cerrar sesión" }));
    expect(await screen.findByRole("heading", { name: "Accede a tu espacio de trabajo." })).toBeTruthy();
  });

  it("opens the account popover from the sidebar and closes it on Escape", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/session") return jsonResponse({ user: { id: "user-1", email: "demo@example.test" } });
      if (url === "/api/runs") return jsonResponse({ runs: [] });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const user = userEvent.setup();
    const { container } = render(<Home />);
    await screen.findByRole("heading", { name: "Make work flow." });

    const sidebarTrigger = container.querySelector(".sidebar-account .account-trigger");
    expect(sidebarTrigger).toBeTruthy();
    await user.click(sidebarTrigger!);
    expect(await screen.findByRole("menu")).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});
