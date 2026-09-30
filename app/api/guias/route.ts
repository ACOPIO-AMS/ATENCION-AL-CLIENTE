// Registro de Guias - conexion API
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function pareceHtml(text: string) {
  const t = String(text || "").trim().toLowerCase();
  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    t.includes("<title>sign in")
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const url = process.env.GOOGLE_GUIAS_APPS_SCRIPT_URL;
  const apiKey = process.env.GOOGLE_GUIAS_APPS_SCRIPT_API_KEY;

  if (!url || !apiKey) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error:
          "La conexión con Registro de Guías todavía no está configurada.",
      },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",

      // Apps Script recibe el JSON como texto y Código.gs
      // continúa leyéndolo normalmente desde e.postData.contents.
      headers: {
        "content-type": "text/plain;charset=UTF-8",
      },

      body: JSON.stringify({
        action: body.action,
        payload: body.payload || {},
        apiKey,
      }),

      redirect: "follow",
      cache: "no-store",
    });

    const text = await upstream.text();
    const contentType =
      upstream.headers.get("content-type") || "";

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      const detail = pareceHtml(text)
        ? "Google Apps Script respondió con HTML en lugar de JSON."
        : "Google Apps Script respondió con un formato no JSON.";

      console.error("GUIAS_UPSTREAM_INVALID", {
        action: String(body.action || ""),
        status: upstream.status,
        contentType,
        finalUrl: upstream.url,
        preview: text.slice(0, 300),
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            "Registro de Guías devolvió una respuesta no válida.",
          detail,
          upstreamStatus: upstream.status,
          upstreamContentType: contentType,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data, {
      status: upstream.ok ? 200 : 502,
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo conectar con Registro de Guías.",
      },
      { status: 502 }
    );
  }
}

