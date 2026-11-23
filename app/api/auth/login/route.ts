import { scryptSync, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, isSameOrigin, setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const rememberMe = body.rememberMe === true;
    const { rows } = await db.query<{ id: string; email: string; password_hash: string }>(
      "select id, email, password_hash from app_users where email = $1 limit 1",
      [email],
    );
    const user = rows[0];
    if (!user || password.length > 200) return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    const [salt, expected] = user.password_hash.split(":");
    const actual = scryptSync(password, salt, 64);
    if (!timingSafeEqual(actual, Buffer.from(expected, "hex"))) {
      return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    }
    const token = await createSession({ id: user.id, email: user.email }, rememberMe);
    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    setSessionCookie(response.headers, token, rememberMe);
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
