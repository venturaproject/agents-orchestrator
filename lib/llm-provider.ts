type Provider = "groq" | "nvidia";
type ProviderResponse = {
  error?: { message?: string };
  choices?: Array<{ finish_reason?: string; message?: { content?: string } }>;
};
type Circuit = { failures: number; openedUntil: number };

const circuits: Record<Provider, Circuit> = {
  groq: { failures: 0, openedUntil: 0 },
  nvidia: { failures: 0, openedUntil: 0 },
};
const failureThreshold = 2;
const openDurationMs = 60_000;

function providers(): Array<{ name: Provider; key: string; url: string; model: string }> {
  const available = [
    process.env.GROQ_API_KEY ? {
      name: "groq" as const,
      key: process.env.GROQ_API_KEY,
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    } : null,
    process.env.NVIDIA_API_KEY ? {
      name: "nvidia" as const,
      key: process.env.NVIDIA_API_KEY,
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      model: process.env.NVIDIA_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    } : null,
  ].filter((provider): provider is NonNullable<typeof provider> => Boolean(provider));

  if (!available.length) {
    throw new Error("Configura GROQ_API_KEY o NVIDIA_API_KEY para ejecutar los agentes.");
  }

  const groqOpen = circuits.groq.openedUntil > Date.now();
  if (groqOpen) {
    const fallback = available.filter((provider) => provider.name === "nvidia");
    if (fallback.length) return fallback;
  }
  return available;
}

function recordFailure(provider: Provider) {
  const circuit = circuits[provider];
  circuit.failures += 1;
  if (circuit.failures >= failureThreshold) {
    circuit.openedUntil = Date.now() + openDurationMs;
    console.warn(`[agents] Circuit breaker opened for ${provider} for ${openDurationMs / 1000}s.`);
  }
}

function recordSuccess(provider: Provider) {
  circuits[provider].failures = 0;
  circuits[provider].openedUntil = 0;
}

async function requestProvider(
  provider: { name: Provider; key: string; url: string; model: string },
  system: string,
  content: string,
  maxTokens: number,
) {
  const payload = JSON.stringify({
    model: provider.model,
    temperature: 0.15,
    max_tokens: maxTokens,
    ...(provider.name === "nvidia" ? { chat_template_kwargs: { enable_thinking: false } } : {}),
    messages: [{ role: "system", content: system }, { role: "user", content }],
  });
  let response: Response;
  let body: ProviderResponse;

  for (let attempt = 0; ; attempt++) {
    response = await fetch(provider.url, {
      method: "POST",
      headers: { authorization: `Bearer ${provider.key}`, "content-type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(60_000),
    });
    body = await response.json() as ProviderResponse;
    if (response.status !== 429 || attempt >= 2) break;
    const delay = Number(body.error?.message?.match(/try again in ([\d.]+)s/i)?.[1] || 2);
    await new Promise((resolve) => setTimeout(resolve, Math.min(Math.ceil(delay * 1000) + 250, 10_000)));
  }

  if (!response.ok) throw new Error(`${provider.name === "groq" ? "Groq" : "NVIDIA"} respondió ${response.status}: ${body.error?.message || "error del proveedor"}`);
  const text = body.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    const finishReason = body.choices?.[0]?.finish_reason || "sin motivo indicado";
    throw new Error(`${provider.name === "groq" ? "Groq" : "NVIDIA"} devolvió una respuesta vacía (${finishReason}).`);
  }
  return text;
}

export async function callLanguageModel(system: string, content: string, maxTokens: number) {
  const choices = providers();
  const errors: string[] = [];

  for (const provider of choices) {
    try {
      const response = await requestProvider(provider, system, content, maxTokens);
      recordSuccess(provider.name);
      if (errors.length) console.warn(`[agents] ${provider.name} answered after provider failover.`);
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : "error desconocido";
      errors.push(message);
      recordFailure(provider.name);
      console.warn(`[agents] ${provider.name} failed; ${choices.length > errors.length ? "trying fallback" : "no fallback available"}.`);
    }
  }

  throw new Error(`Fallaron los proveedores IA: ${errors.join(" | ")}`);
}
