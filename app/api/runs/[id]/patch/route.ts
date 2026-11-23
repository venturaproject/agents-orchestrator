import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSession(request);
  if (!user) return NextResponse.json({ error: "Inicia sesión para descargar el parche." }, { status: 401 });
  const { id } = await context.params;
  const { rows } = await db.query<{ result: { diff?: string } }>(
    "select result from agent_runs where id = $1 and user_id = $2 limit 1", [id, user.id],
  );
  if (!rows[0]?.result?.diff) return NextResponse.json({ error: "Esta ejecución no contiene un parche." }, { status: 404 });
  return new NextResponse(rows[0].result.diff, {
    headers: {
      "content-type": "text/x-diff; charset=utf-8",
      "content-disposition": `attachment; filename="crew-${id}.patch"`,
      "cache-control": "private, no-store",
    },
  });
}
