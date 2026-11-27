export function backendApiUrl(path: string): string {
  const endpoint = `/api/${path.replace(/^\/+/, "")}`;
  const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (!backendBaseUrl) return endpoint;
  return new URL(endpoint, backendBaseUrl).toString();
}

export function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("accept-language")) {
    const savedLocale = typeof window !== "undefined" ? localStorage.getItem("crew-locale") : null;
    const browserLocale = typeof navigator !== "undefined" ? navigator.language : "en";
    headers.set("accept-language", savedLocale || browserLocale);
  }
  return fetch(backendApiUrl(path), {
    ...init,
    headers,
    cache: "no-store",
    credentials: "include",
  });
}
