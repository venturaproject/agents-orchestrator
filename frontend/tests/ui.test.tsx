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
      if (url.endsWith("/api/auth/session")) return jsonResponse({ user: null });
      if (url.endsWith("/api/auth/login")) return jsonResponse({ user: { id: "user-1", email: "demo@example.test" } });
      if (url.endsWith("/api/runs")) return jsonResponse({ runs: [] });
      if (url.endsWith("/api/auth/logout")) return jsonResponse({ ok: true });
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
    const loginCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/api/auth/login"));
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({
      email: "demo@example.test",
      password: "valid-password",
      rememberMe: true,
    });
  });

  it("lets the signed-in user change appearance and language and sign out", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) return jsonResponse({ user: { id: "user-1", email: "demo@example.test" } });
      if (url.endsWith("/api/runs")) return jsonResponse({ runs: [] });
      if (url.endsWith("/api/auth/logout")) return jsonResponse({ ok: true });
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
      if (url.endsWith("/api/auth/session")) return jsonResponse({ user: { id: "user-1", email: "demo@example.test" } });
      if (url.endsWith("/api/runs")) return jsonResponse({ runs: [] });
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

  it("opens the executions view from the sidebar and returns to a selected run", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) {
        return jsonResponse({ user: { id: "user-1", email: "demo@example.test" } });
      }
      if (url.endsWith("/api/runs")) {
        return jsonResponse({
          runs: [{
            id: "run-1",
            prompt: "Fix sidebar navigation",
            createdAt: "2026-11-27T10:00:00.000Z",
            status: "Completed",
            tasks: [{ id: "task-1", title: "Fix navigation", agent: "Develop", status: "done", detail: "", time: "" }],
            result: {},
          }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const user = userEvent.setup();
    const { container } = render(<Home />);
    await screen.findByRole("heading", { name: "Make work flow." });

    await user.click(screen.getByRole("button", { name: "Agent runs" }));
    expect(await screen.findByRole("heading", { name: "Agent runs" })).toBeTruthy();
    const runCard = container.querySelector<HTMLButtonElement>(".run-card");
    if (!runCard) throw new Error("Expected a run card in the executions view.");
    await user.click(runCard);
    await screen.findByRole("heading", { name: "Agent workflow" });
    expect(screen.queryByRole("heading", { name: "Agent runs" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Activity/ }).getAttribute("aria-current")).toBe("page");
    expect(container.querySelector(".history-item.selected")?.textContent).toContain("Fix sidebar navigation");
  });

  it("searches and filters the saved executions by status", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/session")) return jsonResponse({ user: { id: "user-1", email: "demo@example.test" } });
      if (url.endsWith("/api/runs")) return jsonResponse({
        runs: [
          { id: "run-ok", prompt: "Add account settings", createdAt: "2026-11-27T10:00:00.000Z", status: "Completed", tasks: [], result: { summary: "Settings page" } },
          { id: "run-failed", prompt: "Fix the payment flow", createdAt: "2026-11-26T10:00:00.000Z", status: "Failed", tasks: [], result: { summary: "Provider output was invalid" } },
        ],
      });
      throw new Error(`Unexpected fetch: ${url}`);
    });
    const user = userEvent.setup();
    const { container } = render(<Home />);
    await screen.findByRole("heading", { name: "Make work flow." });
    await user.click(screen.getByRole("button", { name: "Agent runs" }));

    expect(screen.getByText("2 of 2 runs")).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "completed");
    expect(container.querySelector(".run-card")?.textContent).toContain("Add account settings");
    expect(container.querySelectorAll(".run-card")).toHaveLength(1);

    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "all");
    await user.type(screen.getByRole("searchbox", { name: "Search runs" }), "payment");
    expect(container.querySelectorAll(".run-card")).toHaveLength(1);
    expect(container.querySelector(".run-card")?.textContent).toContain("Fix the payment flow");

    await user.clear(screen.getByRole("searchbox", { name: "Search runs" }));
    await user.type(screen.getByRole("searchbox", { name: "Search runs" }), "does-not-exist");
    expect(screen.getByText("No runs match these filters.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(container.querySelectorAll(".run-card")).toHaveLength(2);
  });
});
