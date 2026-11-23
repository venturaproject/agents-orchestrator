import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const modelResponse = {
  choices: [{ finish_reason: "stop", message: { content: "provider response" } }],
};

describe("LLM provider failover and circuit breaker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    vi.stubEnv("GROQ_MODEL", "test/groq-model");
    vi.stubEnv("NVIDIA_API_KEY", "test-nvidia-key");
    vi.stubEnv("NVIDIA_MODEL", "test/nvidia-model");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to NVIDIA after a Groq provider error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "unavailable" } }, 503))
      .mockResolvedValueOnce(jsonResponse(modelResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { callLanguageModel } = await import("../lib/llm-provider");
    await expect(callLanguageModel("system", "user prompt", 300)).resolves.toBe("provider response");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(fetchMock.mock.calls[1][0]).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    const nvidiaPayload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(nvidiaPayload.chat_template_kwargs).toEqual({ enable_thinking: false });
  });

  it("opens Groq's circuit after two failures and routes the next call to NVIDIA", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "unavailable" } }, 503))
      .mockResolvedValueOnce(jsonResponse(modelResponse))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "unavailable" } }, 503))
      .mockResolvedValueOnce(jsonResponse(modelResponse))
      .mockResolvedValueOnce(jsonResponse(modelResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { callLanguageModel } = await import("../lib/llm-provider");
    await callLanguageModel("system", "first", 300);
    await callLanguageModel("system", "second", 300);
    await callLanguageModel("system", "third", 300);

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls.filter((url) => url === "https://api.groq.com/openai/v1/chat/completions")).toHaveLength(2);
    expect(urls.filter((url) => url === "https://integrate.api.nvidia.com/v1/chat/completions")).toHaveLength(3);
  });

  it("supports NVIDIA-only configuration", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(modelResponse));
    vi.stubGlobal("fetch", fetchMock);

    const { callLanguageModel } = await import("../lib/llm-provider");
    await expect(callLanguageModel("system", "prompt", 300)).resolves.toBe("provider response");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
  });

  it("fails clearly if no provider key is configured", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("NVIDIA_API_KEY", "");
    const { callLanguageModel } = await import("../lib/llm-provider");
    await expect(callLanguageModel("system", "prompt", 300)).rejects.toThrow(/GROQ_API_KEY o NVIDIA_API_KEY/);
  });
});
