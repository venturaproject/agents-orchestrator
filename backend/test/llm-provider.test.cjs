const { test } = require("node:test");
const assert = require("node:assert/strict");
const routerPath = require.resolve("../dist/infrastructure/providers/llm-provider");
function loadCallLanguageModel() {
  delete require.cache[routerPath];
  return require(routerPath).callLanguageModel;
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const modelResponse = { choices: [{ finish_reason: "stop", message: { content: "provider response" } }] };

function restoreEnvironment(snapshot) {
  for (const key of ["GROQ_API_KEY", "GROQ_MODEL", "NVIDIA_API_KEY", "NVIDIA_MODEL"]) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

test("provider router fails over from Groq to NVIDIA", async () => {
  const callLanguageModel = loadCallLanguageModel();
  const keys = ["GROQ_API_KEY", "GROQ_MODEL", "NVIDIA_API_KEY", "NVIDIA_MODEL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const oldFetch = globalThis.fetch;
  const warn = console.warn;
  process.env.GROQ_API_KEY = "test-groq-key";
  process.env.GROQ_MODEL = "test/groq-model";
  process.env.NVIDIA_API_KEY = "test-nvidia-key";
  process.env.NVIDIA_MODEL = "test/nvidia-model";
  console.warn = () => {};
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([url, init]);
    return calls.length === 1
      ? response({ error: { message: "unavailable" } }, 503)
      : response(modelResponse);
  };
  try {
    assert.equal(await callLanguageModel("system", "prompt", 300), "provider response");
    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(calls[1][0], "https://integrate.api.nvidia.com/v1/chat/completions");
    assert.deepEqual(JSON.parse(calls[1][1].body).chat_template_kwargs, { enable_thinking: false });
  } finally {
    globalThis.fetch = oldFetch;
    console.warn = warn;
    restoreEnvironment(previous);
  }
});

test("provider router opens the Groq circuit after repeated errors", async () => {
  const callLanguageModel = loadCallLanguageModel();
  const keys = ["GROQ_API_KEY", "GROQ_MODEL", "NVIDIA_API_KEY", "NVIDIA_MODEL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const oldFetch = globalThis.fetch;
  const warn = console.warn;
  process.env.GROQ_API_KEY = "test-groq-key";
  process.env.GROQ_MODEL = "test/groq-model";
  process.env.NVIDIA_API_KEY = "test-nvidia-key";
  process.env.NVIDIA_MODEL = "test/nvidia-model";
  console.warn = () => {};
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return url.includes("groq")
      ? response({ error: { message: "unavailable" } }, 503)
      : response(modelResponse);
  };
  try {
    await callLanguageModel("system", "first", 300);
    await callLanguageModel("system", "second", 300);
    await callLanguageModel("system", "third", 300);
    assert.equal(calls.filter((url) => url.includes("groq")).length, 2);
    assert.equal(calls.filter((url) => url.includes("nvidia")).length, 3);
  } finally {
    globalThis.fetch = oldFetch;
    console.warn = warn;
    restoreEnvironment(previous);
  }
});

test("provider router supports NVIDIA-only setup and rejects missing keys", async () => {
  const callLanguageModel = loadCallLanguageModel();
  const keys = ["GROQ_API_KEY", "GROQ_MODEL", "NVIDIA_API_KEY", "NVIDIA_MODEL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const oldFetch = globalThis.fetch;
  process.env.GROQ_API_KEY = "";
  process.env.NVIDIA_API_KEY = "test-nvidia-key";
  let requested;
  globalThis.fetch = async (url) => {
    requested = url;
    return response(modelResponse);
  };
  try {
    assert.equal(await callLanguageModel("system", "prompt", 300), "provider response");
    assert.equal(requested, "https://integrate.api.nvidia.com/v1/chat/completions");
    process.env.NVIDIA_API_KEY = "";
    await assert.rejects(callLanguageModel("system", "prompt", 300), {
      name: "AgentProviderUnavailableError",
    });
  } finally {
    globalThis.fetch = oldFetch;
    restoreEnvironment(previous);
  }
});
