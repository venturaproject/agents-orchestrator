import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, isSameOrigin } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response.headers);
  return response;
}
