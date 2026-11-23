import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, isSameOrigin } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getSession(request);
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  const { rows } = await db.query(
    "select id, prompt, status, tasks, result, created_at as \"createdAt\" from agent_runs where user_id = $1 order by created_at desc limit 100",
    [user.id],
  );
  return NextResponse.json({ runs: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getSession(request);
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  try {
    const run = await request.json();
    if (typeof run.id !== "string" || !/^[0-9a-f-]{36}$/i.test(run.id) ||
        typeof run.prompt !== "string" || run.prompt.length > 2000 ||
        typeof run.status !== "string" || !Array.isArray(run.tasks)) {
      return NextResponse.json({ error: "Ejecución no válida." }, { status: 400 });
    }
    await db.query(
      `insert into agent_runs (id, user_id, prompt, status, tasks, result)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       on conflict (id) do update set status = excluded.status, tasks = excluded.tasks, result = excluded.result
       where agent_runs.user_id = excluded.user_id`,
      [run.id, user.id, run.prompt, run.status, JSON.stringify(run.tasks), JSON.stringify(run.result ?? {})],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Run save failed:", error);
    return NextResponse.json({ error: "No se pudo guardar la ejecución." }, { status: 500 });
  }
}
