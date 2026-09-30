// Registro de Guias - conexion API V2
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function pareceHtml(text: string) {
  const t = String(text || "").trim().toLowerCase();

  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    t.includes("<title>sign in") ||
    t.includes("<title>iniciar sesión")
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

      headers: {
        "content-type": "text/plain;charset=UTF-8",
        accept: "application/json,text/plain,*/*",
      },

      body: JSON.stringify({
        action: String(body.action || "").trim(),
        payload: body.payload || {},
        apiKey,
      }),

      redirect: "follow",
      cache: "no-store",
    });

    const text = await upstream.text();

    const contentType =
      upstream.headers.get("content-type") || "";

    let respuesta: any;

    try {
      respuesta = JSON.parse(text);
    } catch {
      const esHtml = pareceHtml(text);

      console.error("GUIAS_UPSTREAM_INVALID", {
        action: String(body.action || ""),
        status: upstream.status,
        contentType,
        finalUrl: upstream.url,
        esHtml,
        preview: text.slice(0, 300),
      });

      return NextResponse.json(
        {
          ok: false,

          error:
            "Registro de Guías devolvió una respuesta no válida.",

          detail: esHtml
            ? "Google Apps Script respondió con HTML en lugar de JSON."
            : "Google Apps Script respondió con un formato no JSON.",

          upstreamStatus: upstream.status,
          upstreamContentType: contentType,
          upstreamFinalUrl: upstream.url,
        },
        {
          status: 502,
          headers: {
            "cache-control": "no-store",
          },
        }
      );
    }

    // =====================================================
    // IMPORTANTE
    //
    // Código.gs V2 responde:
    //
    // {
    //   ok: true,
    //   data: resultado
    // }
    //
    // Pero el Index.html original espera directamente:
    //
    // resultado
    //
    // Por eso aquí quitamos solamente el envoltorio de la API.
    // =====================================================

    if (
      respuesta &&
      respuesta.ok === true &&
      Object.prototype.hasOwnProperty.call(respuesta, "data")
    ) {
      return NextResponse.json(respuesta.data, {
        status: 200,

        headers: {
          "cache-control": "no-store",
        },
      });
    }

    // =====================================================
    // ERROR REAL DEVUELTO POR APPS SCRIPT
    // =====================================================

    if (respuesta && respuesta.ok === false) {
      console.error("GUIAS_BACKEND_ERROR", {
        action: String(body.action || ""),
        error: respuesta.error || respuesta.mensaje || "",
      });

      return NextResponse.json(
        {
          ok: false,
          error:
            respuesta.error ||
            respuesta.mensaje ||
            "Error en Registro de Guías.",
        },
        {
          status: 502,

          headers: {
            "cache-control": "no-store",
          },
        }
      );
    }

    // =====================================================
    // COMPATIBILIDAD
    // Si alguna función devuelve JSON directamente.
    // =====================================================

    return NextResponse.json(respuesta, {
      status: upstream.ok ? 200 : 502,

      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("GUIAS_CONNECTION_ERROR", {
      action: String(body.action || ""),

      error:
        error instanceof Error
          ? error.message
          : String(error),
    });

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "No se pudo conectar con Registro de Guías.",
      },
      {
        status: 502,

        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }
}
