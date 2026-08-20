import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  const apiKey = process.env.GOOGLE_APPS_SCRIPT_API_KEY;
  if (!url || !apiKey) return NextResponse.json({ ok: false, configured: false, error: "La conexión con Google Sheets todavía no está configurada." }, { status: 503 });
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: body.action, payload: body.payload || {}, apiKey }),
      redirect: "follow",
    });
    const text = await upstream.text();
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: upstream.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo consultar Google Sheets." }, { status: 502 });
  }
}
