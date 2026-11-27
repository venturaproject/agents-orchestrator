export const sessionCookieName = "crew_session";

export function readSessionCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== sessionCookieName) continue;

    const value = cookie.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value) || null;
    } catch {
      return null;
    }
  }

  return null;
}

export function buildSessionCookie(token: string, rememberMe: boolean): string {
  const attributes = [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
  ];
  if (rememberMe) attributes.push("Max-Age=2592000");
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  const domain = process.env.SESSION_COOKIE_DOMAIN?.trim();
  if (domain) attributes.push(`Domain=${domain}`);
  return attributes.join("; ");
}

export function buildClearedSessionCookie(): string {
  const attributes = [
    `${sessionCookieName}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  const domain = process.env.SESSION_COOKIE_DOMAIN?.trim();
  if (domain) attributes.push(`Domain=${domain}`);
  return attributes.join("; ");
}

export function isTrustedOrigin(originHeader?: string): boolean {
  const origin = originHeader?.trim();
  if (!origin) return false;
  try {
    const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin);
    return allowedOrigins.includes(new URL(origin).origin);
  } catch {
    return false;
  }
}
