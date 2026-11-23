import { jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";

export type AppUser = { id: string; email: string };
const cookieName = "crew_session";
const sessionLifetime = 60 * 60 * 12;
const rememberedLifetime = 60 * 60 * 24 * 30;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  return new TextEncoder().encode(value);
}

export async function createSession(user: AppUser, rememberMe = false) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${rememberMe ? rememberedLifetime : sessionLifetime}s`)
    .sign(secret());
}

export async function getSession(request: NextRequest): Promise<AppUser | null> {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function setSessionCookie(headers: Headers, token: string, rememberMe = false) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = rememberMe ? `; Max-Age=${rememberedLifetime}` : "";
  headers.append("Set-Cookie", `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/${maxAge}${secure}`);
}

export function clearSessionCookie(headers: Headers) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  headers.append("Set-Cookie", `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
      ?? new URL(request.url).protocol.slice(0, -1);
    return source.host === host && source.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
