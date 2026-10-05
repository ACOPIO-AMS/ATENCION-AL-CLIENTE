import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

export async function POST(request: NextRequest) {
  let body: { action?: string; payload?: Record<string, unknown> };

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, configured: true, error: "La solicitud enviada no es válida." },
      400,
    );
  }

  const action = String(body?.action || "").trim();
  if (!action) {
    return jsonResponse(
      { ok: false, configured: true, error: "Falta indicar la acción solicitada." },
      400,
    );
  }

  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  const apiKey = process.env.GOOGLE_APPS_SCRIPT_API_KEY;

  if (!url || !apiKey) {
    return jsonResponse(
      {
        ok: false,
        configured: false,
        error: "La conexión con Google Sheets todavía no está configurada.",
      },
      503,
    );
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "cache-control": "no-cache",
      },
      body: JSON.stringify({
        action,
        payload: body.payload || {},
        apiKey,
      }),
      redirect: "follow",
      cache: "no-store",
    });

    const text = await upstream.text();

    if (!text.trim()) {
      return jsonResponse(
        {
          ok: false,
          configured: true,
          error: "Google Apps Script respondió vacío. Reintenta la operación.",
        },
        502,
      );
    }

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      return jsonResponse(
        {
          ok: false,
          configured: true,
          error:
            "Google Apps Script devolvió una respuesta no válida. Reintenta; si continúa, verifica la implementación publicada.",
        },
        502,
      );
    }

    if (!data || typeof data !== "object") {
      return jsonResponse(
        {
          ok: false,
          configured: true,
          error: "Google Apps Script devolvió una respuesta incompleta.",
        },
        502,
      );
    }

    return jsonResponse(data, upstream.ok ? 200 : 502);
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        configured: true,
        error:
          error instanceof Error
            ? `No se pudo consultar Google Sheets: ${error.message}`
            : "No se pudo consultar Google Sheets.",
      },
      502,
    );
  }
}
