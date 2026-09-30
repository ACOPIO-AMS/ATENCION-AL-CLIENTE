"use client";

import { useEffect, useMemo, useState } from "react";

export type AdminSection =
  | "panel"
  | "usuarios"
  | "registros"
  | "catalogos"
  | "auditoria";

type AnyRow = Record<string, any>;

async function adminApi(action: string, payload: AnyRow = {}) {
  const response = await fetch("/api/sheets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      action,
      payload,
    }),
  });

  const result = await response.json().catch(() => ({
    ok: false,
    error: "Respuesta inválida del servidor.",
  }));

  if (!response.ok || !result.ok) {
    throw new Error(
      result.error || "No se pudo completar la consulta."
    );
  }

  return result.data;
}

function texto(valor: any) {
  return String(valor ?? "").trim();
}

function obtener(obj: AnyRow, ...claves: string[]) {
  for (const clave of claves) {
    if (
      obj[clave] !== undefined &&
      obj[clave] !== null &&
      texto(obj[clave]) !== ""
    ) {
      return obj[clave];
    }
  }

  const buscadas = claves.map((x) => x.toUpperCase());

  for (const [clave, valor] of Object.entries(obj)) {
    if (
      buscadas.includes(clave.toUpperCase()) &&
      texto(valor) !== ""
    ) {
      return valor;
    }
  }

  return "";
}

function esSi(valor: any) {
  if (valor === true) return true;

  return [
    "SI",
    "SÍ",
    "TRUE",
    "1",
    "ACTIVO",
  ].includes(texto(valor).toUpperCase());
}

export default function AdminPanel({
  section,
}: {
  section: AdminSection;
}) {
  const [usuarios, setUsuarios] = useState<AnyRow[]>([]);
  const [permisos, setPermisos] = useState<string[]>([]);
  const [auditoria, setAuditoria] = useState<AnyRow[]>([]);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [buscar, setBuscar] = useState("");

  // ==========================================================
  // USUARIOS
  // ==========================================================

  async function cargarUsuarios() {
    setCargando(true);
    setError("");

    try {
      const data = await adminApi("adminUsuarios");

      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.usuarios)
        ? data.usuarios
        : Array.isArray(data?.users)
        ? data.users
        : [];

      const listaPermisos = Array.isArray(data?.permisos)
        ? data.permisos
            .map((x: any) =>
              typeof x === "string" ? x : texto(x?.key)
            )
            .filter(Boolean)
        : [];

      setUsuarios(lista);
      setPermisos(listaPermisos);
    } catch (err: any) {
      setError(
        err?.message ||
          "No se pudieron cargar los usuarios."
      );
    } finally {
      setCargando(false);
    }
  }

  // ==========================================================
  // AUDITORIA
  // ==========================================================

  async function cargarAuditoria() {
    setCargando(true);
    setError("");

    try {
      const data = await adminApi("adminAuditoria", {
        limite: 200,
      });

      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.registros)
        ? data.registros
        : Array.isArray(data?.auditoria)
        ? data.auditoria
        : [];

      setAuditoria(lista);
    } catch (err: any) {
      setError(
        err?.message ||
          "No se pudo cargar la auditoría."
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (section === "usuarios" || section === "panel") {
      cargarUsuarios();
    }

    if (section === "auditoria") {
      cargarAuditoria();
    }
  }, [section]);

  // ==========================================================
  // FILTRO
  // ==========================================================

  const usuariosFiltrados = useMemo(() => {
    const q = buscar.trim().toUpperCase();

    if (!q) return usuarios;

    return usuarios.filter((usuario) =>
      Object.values(usuario).some((valor) =>
        texto(valor).toUpperCase().includes(q)
      )
    );
  }, [usuarios, buscar]);

  const usuariosActivos = usuarios.filter((u) =>
    esSi(obtener(u, "activo", "ACTIVO"))
  ).length;

  const administradores = usuarios.filter((u) => {
    const rol = texto(
      obtener(u, "rol", "ROL", "role")
    ).toUpperCase();

    return rol === "ADMIN" || rol === "ADMINISTRADOR";
  }).length;

  // ==========================================================
  // PANEL GENERAL
  // ==========================================================

  if (section === "panel") {
    return (
      <section style={{ padding: "0 24px 28px" }}>
        <div className="form-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 5px" }}>
                Control general
              </h2>

              <p style={{ margin: 0 }}>
                Administración central del sistema.
              </p>
            </div>

            <button
              type="button"
              className="secondary-action"
              onClick={cargarUsuarios}
              disabled={cargando}
            >
              {cargando ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop: 15,
                padding: 12,
                border: "1px solid #e5aaaa",
                borderRadius: 9,
                background: "#fff3f3",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(170px,1fr))",
              gap: 12,
              marginTop: 18,
            }}
          >
            {[
              ["Usuarios", usuarios.length],
              ["Usuarios activos", usuariosActivos],
              ["Administradores", administradores],
              ["Módulos operativos", 4],
            ].map(([titulo, valor]) => (
              <div
                key={String(titulo)}
                style={{
                  border: "1px solid #dce7e4",
                  borderRadius: 12,
                  padding: 16,
                  background: "#fff",
                }}
              >
                <small
                  style={{
                    fontWeight: 800,
                    color: "#60746f",
                  }}
                >
                  {titulo}
                </small>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    marginTop: 5,
                  }}
                >
                  {valor}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(190px,1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            {[
              "ATENCIÓN AL CLIENTE",
              "CARGOS Y SALIDAS",
              "REGISTRO DE GUÍAS",
              "REGISTRO RI-RM",
            ].map((nombre, i) => (
              <div
                key={nombre}
                style={{
                  border: "1px solid #dce7e4",
                  borderRadius: 12,
                  padding: 15,
                }}
              >
                <b>
                  {i + 1}. {nombre}
                </b>

                <p
                  style={{
                    fontSize: 12,
                    marginBottom: 0,
                  }}
                >
                  Módulo integrado
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ==========================================================
  // USUARIOS Y ACCESOS
  // ==========================================================

  if (section === "usuarios") {
    return (
      <section style={{ padding: "0 24px 28px" }}>
        <div className="form-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 5px" }}>
                Usuarios y accesos
              </h2>

              <p style={{ margin: 0 }}>
                Usuarios registrados y permisos del sistema.
              </p>
            </div>

            <button
              type="button"
              className="secondary-action"
              onClick={cargarUsuarios}
              disabled={cargando}
            >
              {cargando ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              margin: "18px 0 12px",
              flexWrap: "wrap",
            }}
          >
            <input
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar usuario, nombre o rol"
              style={{
                minHeight: 42,
                flex: "1 1 260px",
                border: "1px solid #cbd9d6",
                borderRadius: 8,
                padding: "8px 11px",
              }}
            />

            <div
              style={{
                padding: "10px 13px",
                borderRadius: 8,
                background: "#eef7f5",
                fontWeight: 800,
              }}
            >
              {usuariosFiltrados.length} usuario(s)
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                border: "1px solid #e5aaaa",
                borderRadius: 9,
                background: "#fff3f3",
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              overflowX: "auto",
              border: "1px solid #d9e4e1",
              borderRadius: 12,
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: 900,
                borderCollapse: "collapse",
                background: "#fff",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#eef7f5",
                    textAlign: "left",
                  }}
                >
                  {[
                    "USUARIO",
                    "NOMBRE COMPLETO",
                    "ROL",
                    "ESTADO",
                    "ÚLTIMO ACCESO",
                    "PERMISOS",
                  ].map((titulo) => (
                    <th
                      key={titulo}
                      style={{
                        padding: 11,
                        borderBottom:
                          "1px solid #d9e4e1",
                        fontSize: 12,
                      }}
                    >
                      {titulo}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {usuariosFiltrados.map((u, i) => {
                  const claves =
                    permisos.length > 0
                      ? permisos
                      : Object.keys(u).filter(
                          (key) =>
                            ![
                              "USUARIO",
                              "NOMBRE COMPLETO",
                              "ROL",
                              "ACTIVO",
                              "ULTIMO ACCESO",
                              "ÚLTIMO ACCESO",
                              "PIN",
                              "user",
                              "name",
                              "role",
                              "activo",
                            ].includes(key)
                        );

                  const habilitados = claves.filter((key) =>
                    esSi(u[key])
                  );

                  return (
                    <tr
                      key={
                        texto(
                          obtener(
                            u,
                            "usuario",
                            "USUARIO",
                            "user"
                          )
                        ) || String(i)
                      }
                    >
                      <td
                        style={{
                          padding: 10,
                          borderBottom:
                            "1px solid #edf2f0",
                          fontWeight: 900,
                        }}
                      >
                        {texto(
                          obtener(
                            u,
                            "usuario",
                            "USUARIO",
                            "user"
                          )
                        ) || "—"}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          borderBottom:
                            "1px solid #edf2f0",
                        }}
                      >
                        {texto(
                          obtener(
                            u,
                            "nombreCompleto",
                            "NOMBRE COMPLETO",
                            "nombre",
                            "name"
                          )
                        ) || "—"}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          borderBottom:
                            "1px solid #edf2f0",
                        }}
                      >
                        {texto(
                          obtener(u, "rol", "ROL", "role")
                        ) || "—"}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          borderBottom:
                            "1px solid #edf2f0",
                        }}
                      >
                        <b>
                          {esSi(
                            obtener(u, "activo", "ACTIVO")
                          )
                            ? "ACTIVO"
                            : "INACTIVO"}
                        </b>
                      </td>

                      <td
                        style={{
                          padding: 10,
                          borderBottom:
                            "1px solid #edf2f0",
                        }}
                      >
                        {texto(
                          obtener(
                            u,
                            "ultimoAcceso",
                            "ULTIMO ACCESO",
                            "ÚLTIMO ACCESO"
                          )
                        ) || "—"}
                      </td>

                      <td
                        style={{
                          padding: 10,
                          borderBottom:
                            "1px solid #edf2f0",
                          maxWidth: 340,
                        }}
                      >
                        <small>
                          {habilitados.length
                            ? habilitados.join(" · ")
                            : "Sin permisos habilitados"}
                        </small>
                      </td>
                    </tr>
                  );
                })}

                {!usuariosFiltrados.length &&
                  !cargando && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: 24,
                          textAlign: "center",
                        }}
                      >
                        No se encontraron usuarios.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  // ==========================================================
  // AUDITORIA
  // ==========================================================

  if (section === "auditoria") {
    return (
      <section style={{ padding: "0 24px 28px" }}>
        <div className="form-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 5px" }}>
                Auditoría
              </h2>

              <p style={{ margin: 0 }}>
                Últimos movimientos administrativos.
              </p>
            </div>

            <button
              type="button"
              className="secondary-action"
              onClick={cargarAuditoria}
              disabled={cargando}
            >
              {cargando ? "Cargando..." : "Actualizar"}
            </button>
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                border: "1px solid #e5aaaa",
                borderRadius: 9,
                background: "#fff3f3",
                marginTop: 15,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              overflowX: "auto",
              border: "1px solid #d9e4e1",
              borderRadius: 12,
              marginTop: 18,
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: 950,
                borderCollapse: "collapse",
                background: "#fff",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "#eef7f5",
                    textAlign: "left",
                  }}
                >
                  {[
                    "FECHA / HORA",
                    "USUARIO",
                    "ACCIÓN",
                    "REGISTRO",
                    "VALOR ANTERIOR",
                    "VALOR NUEVO",
                    "MOTIVO",
                  ].map((titulo) => (
                    <th
                      key={titulo}
                      style={{
                        padding: 11,
                        fontSize: 12,
                      }}
                    >
                      {titulo}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {auditoria.map((r, i) => {
                  const columnas = [
                    obtener(
                      r,
                      "fechaHora",
                      "FECHA HORA",
                      "FECHA Y HORA",
                      "fecha"
                    ),
                    obtener(
                      r,
                      "usuario",
                      "USUARIO",
                      "actor"
                    ),
                    obtener(
                      r,
                      "accion",
                      "ACCIÓN",
                      "ACCION"
                    ),
                    obtener(
                      r,
                      "registro",
                      "REGISTRO",
                      "objetivo"
                    ),
                    obtener(
                      r,
                      "valorAnterior",
                      "VALOR ANTERIOR"
                    ),
                    obtener(
                      r,
                      "valorNuevo",
                      "VALOR NUEVO"
                    ),
                    obtener(r, "motivo", "MOTIVO"),
                  ];

                  return (
                    <tr key={i}>
                      {columnas.map((valor, j) => (
                        <td
                          key={j}
                          style={{
                            padding: 10,
                            borderTop:
                              "1px solid #edf2f0",
                            fontSize: 12,
                          }}
                        >
                          {texto(valor) || "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {!auditoria.length && !cargando && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: 24,
                        textAlign: "center",
                      }}
                    >
                      Aún no hay movimientos administrativos
                      registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  // ==========================================================
  // PROXIMAS FUNCIONES
  // ==========================================================

  return (
    <section style={{ padding: "0 24px 28px" }}>
      <div className="form-card">
        <h2 style={{ marginTop: 0 }}>
          {section === "registros"
            ? "Modificar / Anular registros"
            : "Catálogos / configuración"}
        </h2>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 10,
            background: "#fff8e1",
            border: "1px solid #f1d78b",
          }}
        >
          <b>
            {section === "registros"
              ? "Configuración administrativa pendiente."
              : "Configuración de catálogos pendiente."}
          </b>
        </div>
      </div>
    </section>
  );
}
