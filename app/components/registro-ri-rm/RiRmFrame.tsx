"use client";

import { useEffect, useMemo, useRef } from "react";
import { RIRM_HTML_INTEGRADO } from "../../lib/rirm-html";

export type RirmSection =
  | "pendientes"
  | "nueva-solicitud"
  | "mis-solicitudes"
  | "historial-buscar";

type AppUser = {
  user: string;
  name: string;
  role: string;
};

export default function RiRmFrame({
  section,
  user,
}: {
  section: RirmSection;
  user: AppUser;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  // ============================================================
  // NORMALIZAR USUARIO PARA RI-RM
  // ============================================================
  const rirmUser = useMemo(() => {
    const nombre = String(user?.name || user?.user || "")
      .trim()
      .toUpperCase();

    const rolOriginal = String(user?.role || "")
      .trim()
      .toUpperCase();

    let perfil = rolOriginal;

    // Administrador = acceso total
    if (
      rolOriginal === "ADMINISTRADOR" ||
      rolOriginal === "ADMIN"
    ) {
      perfil = "ADMIN";
    }

    // Oficina Chala 1, 2, 3... = CHALA
    if (
      rolOriginal === "CHALA" ||
      rolOriginal.startsWith("OFICINA CHALA") ||
      nombre.startsWith("OFICINA CHALA")
    ) {
      perfil = "CHALA";
    }

    // Compatibilidad con otros perfiles
    if (rolOriginal === "LABORATORIO") {
      perfil = "ASISTENTE A4";
    }

    return {
      // Formato usado por la aplicación principal
      user: user?.user || "",
      name: nombre,
      role: perfil,

      // Formato esperado por RI-RM
      usuario: user?.user || "",
      nombre: nombre,
      nombreCuenta: nombre,
      responsableSesion: nombre,
      perfil: perfil,
    };
  }, [user]);

  useEffect(() => {
    const fn = async (ev: MessageEvent) => {
      if (ev.source !== ref.current?.contentWindow) return;

      const d = ev.data || {};

      if (d.type === "AMS_RIRM_READY") {
        ref.current?.contentWindow?.postMessage(
          {
            type: "AMS_RIRM_INIT",
            user: rirmUser,
            section,
          },
          "*"
        );
        return;
      }

      if (d.type !== "AMS_RIRM_API") return;

      try {
        const r = await fetch("/api/registro-ri-rm", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            method: d.method,
            args: d.args || [],
          }),
        });

        const j = await r.json();

        ref.current?.contentWindow?.postMessage(
          {
            type: "AMS_RIRM_API_RESULT",
            id: d.id,
            ok: Boolean(r.ok && j.ok),
            data: j.data,
            error: j.error,
          },
          "*"
        );
      } catch (e) {
        ref.current?.contentWindow?.postMessage(
          {
            type: "AMS_RIRM_API_RESULT",
            id: d.id,
            ok: false,
            error:
              e instanceof Error
                ? e.message
                : "Error RI-RM",
          },
          "*"
        );
      }
    };

    window.addEventListener("message", fn);

    return () => {
      window.removeEventListener("message", fn);
    };
  }, [rirmUser, section]);

  useEffect(() => {
    ref.current?.contentWindow?.postMessage(
      {
        type: "AMS_RIRM_SECTION",
        section,
      },
      "*"
    );
  }, [section]);

  return (
    <iframe
      ref={ref}
      title="Registro RI-RM"
      srcDoc={RIRM_HTML_INTEGRADO}
      style={{
        width: "100%",
        height: "calc(100vh - 150px)",
        minHeight: 680,
        border: 0,
        display: "block",
        background: "#f7f9fc",
      }}
      sandbox="allow-scripts allow-forms allow-downloads allow-modals"
    />
  );
}
