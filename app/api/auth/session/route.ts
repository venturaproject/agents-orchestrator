import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json({ user: await getSession(request) }, { headers: { "Cache-Control": "no-store" } });
}
