"use client";

import { useEffect, useMemo, useState } from "react";

export type AdminSection =
  | "panel"
  | "usuarios"
  | "registros"
  | "catalogos"
  | "auditoria";

type AnyRow = Record<string, any>;

type PermisoConfig = {
  key: string;
  columna?: number;
};

async function adminApi(
  action: string,
  payload: AnyRow = {}
) {
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
      result.error ||
        result.message ||
        "No se pudo completar la consulta."
    );
  }

  return result.data;
}

function texto(valor: any) {
  return String(valor ?? "").trim();
}

function obtener(
  obj: AnyRow,
  ...claves: string[]
) {
  if (!obj) return "";

  for (const clave of claves) {
    if (
      obj[clave] !== undefined &&
      obj[clave] !== null &&
      texto(obj[clave]) !== ""
    ) {
      return obj[clave];
    }
  }

  const buscadas =
    claves.map((x) => x.toUpperCase());

  for (const [clave, valor] of Object.entries(obj)) {
    if (
      buscadas.includes(
        clave.toUpperCase()
      ) &&
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
  ].includes(
    texto(valor).toUpperCase()
  );
}

function etiquetaPermiso(key: string) {
  const mapa: Record<string, string> = {
    ATENCION_NUEVO: "Nuevo ingreso",
    ATENCION_REPORTE: "Reporte diario",
    ATENCION_REGULARIZAR: "Por regularizar",
    ATENCION_BUSCAR: "Buscar",
    ATENCION_CLIENTES: "BD Clientes",

    CARGOS_REGISTRAR: "Registrar salida",
    CARGOS_BUSCAR: "Buscar salidas",

    GUIAS_REGISTRAR: "Registrar",
    GUIAS_HISTORIAL: "Historial de registros",
    GUIAS_INDICADORES: "Indicadores",
    GUIAS_SACOS: "Registro de Sacos Mineros",

    RI_RM: "Acceso Registro RI-RM",

    PENDIENTES: "Pendientes",
    "NUEVA SOLICITUD": "Nueva solicitud",
    "MIS SOLICITUDES": "Mis solicitudes",
    "HISTORIAL / BUSCAR": "Historial / Buscar",
  };

  const normalizada =
    texto(key).toUpperCase();

  if (mapa[normalizada]) {
    return mapa[normalizada];
  }

  return texto(key)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) =>
      c.toUpperCase()
    );
}

function grupoPermiso(key: string) {
  const k =
    texto(key).toUpperCase();

  if (
    k.startsWith("ATENCION")
  ) {
    return "1. ATENCIÓN AL CLIENTE";
  }

  if (
    k.startsWith("CARGO") ||
    k.startsWith("SALIDA")
  ) {
    return "2. CARGOS Y SALIDAS";
  }

  if (
    k.startsWith("GUIA")
  ) {
    return "3. REGISTRO DE GUÍAS";
  }

  if (
    k.startsWith("RI") ||
    k.includes("PENDIENT") ||
    k.includes("SOLICITUD") ||
    k.includes("HISTORIAL / BUSCAR")
  ) {
    return "4. REGISTRO RI-RM";
  }

  return "OTROS PERMISOS";
}

export default function AdminPanel({
  section,
}: {
  section: AdminSection;
}) {
  const [usuarios, setUsuarios] =
    useState<AnyRow[]>([]);

  const [
    permisosConfig,
    setPermisosConfig,
  ] = useState<PermisoConfig[]>([]);

  const [roles, setRoles] =
    useState<string[]>([]);

  const [auditoria, setAuditoria] =
    useState<AnyRow[]>([]);

  const [cargando, setCargando] =
    useState(false);

  const [guardando, setGuardando] =
    useState(false);

  const [error, setError] =
    useState("");

  const [buscar, setBuscar] =
    useState("");

  const [
    usuarioEditando,
    setUsuarioEditando,
  ] = useState<AnyRow | null>(null);

  const [editNombre, setEditNombre] =
    useState("");

  const [editRol, setEditRol] =
    useState("");

  const [editActivo, setEditActivo] =
    useState(true);

  const [
    editPermisos,
    setEditPermisos,
  ] = useState<Record<string, boolean>>(
    {}
  );

  const [motivo, setMotivo] =
    useState("");

  const [
    mensajeModal,
    setMensajeModal,
  ] = useState("");

  // ==========================================================
  // USUARIO ADMINISTRADOR ACTUAL
  // ==========================================================

  function obtenerAdminActual() {
    if (typeof window === "undefined") {
      return "";
    }

    const posibles = [
      "usuario",
      "user",
      "ams_usuario",
      "usuarioActual",
      "currentUser",
    ];

    for (const clave of posibles) {
      const valor =
        localStorage.getItem(clave);

      if (valor) {
        try {
          const parsed =
            JSON.parse(valor);

          if (
            typeof parsed === "object" &&
            parsed
          ) {
            const encontrado =
              texto(
                parsed.usuario ||
                  parsed.user ||
                  parsed.username ||
                  parsed.USUARIO
              );

            if (encontrado) {
              return encontrado.toUpperCase();
            }
          }
        } catch {
          if (texto(valor)) {
            return texto(
              valor
            ).toUpperCase();
          }
        }
      }
    }

    /*
     * Compatibilidad:
     * si la sesión actual no está almacenada con
     * una de las claves anteriores, el backend
     * rechazará la operación y mostrará el error.
     */
    return "";
  }

  // ==========================================================
  // CARGAR USUARIOS
  // ==========================================================

  async function cargarUsuarios() {
    setCargando(true);
    setError("");

    try {
      const data =
        await adminApi(
          "adminUsuarios"
        );

      const lista =
        Array.isArray(data)
          ? data
          : Array.isArray(
              data?.usuarios
            )
          ? data.usuarios
          : [];

      const permisosRaw =
        Array.isArray(
          data?.permisos
        )
          ? data.permisos
          : [];

      const configuracion:
        PermisoConfig[] =
        permisosRaw
          .map((x: any) => {
            if (
              typeof x === "string"
            ) {
              return {
                key: x,
              };
            }

            return {
              key: texto(
                x?.key
              ),
              columna:
                Number(
                  x?.columna
                ) || undefined,
            };
          })
          .filter(
            (x: PermisoConfig) =>
              Boolean(x.key)
          );

      const listaRoles =
        Array.isArray(data?.roles)
          ? data.roles
              .map((x: any) =>
                texto(x)
              )
              .filter(Boolean)
          : [];

      setUsuarios(lista);
      setPermisosConfig(
        configuracion
      );
      setRoles(listaRoles);
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
  // CARGAR AUDITORÍA
  // ==========================================================

  async function cargarAuditoria() {
    setCargando(true);
    setError("");

    try {
      const data =
        await adminApi(
          "adminAuditoria",
          {
            limite: 200,
          }
        );

      const lista =
        Array.isArray(data)
          ? data
          : Array.isArray(
              data?.registros
            )
          ? data.registros
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
    if (
      section === "usuarios" ||
      section === "panel"
    ) {
      cargarUsuarios();
    }

    if (
      section === "auditoria"
    ) {
      cargarAuditoria();
    }
  }, [section]);

  // ==========================================================
  // FILTRAR USUARIOS
  // ==========================================================

  const usuariosFiltrados =
    useMemo(() => {
      const q =
        buscar
          .trim()
          .toUpperCase();

      if (!q) {
        return usuarios;
      }

      return usuarios.filter(
        (usuario) => {
          const campos = [
            usuario.usuario,
            usuario.nombre,
            usuario.rol,
            usuario.activo,
          ];

          return campos.some(
            (valor) =>
              texto(valor)
                .toUpperCase()
                .includes(q)
          );
        }
      );
    }, [usuarios, buscar]);

  const usuariosActivos =
    usuarios.filter((u) =>
      esSi(
        obtener(
          u,
          "activo",
          "ACTIVO"
        )
      )
    ).length;

  const administradores =
    usuarios.filter((u) => {
      const rol =
        texto(
          obtener(
            u,
            "rol",
            "ROL",
            "role"
          )
        ).toUpperCase();

      return (
        rol === "ADMIN" ||
        rol === "ADMINISTRADOR"
      );
    }).length;

  // ==========================================================
  // PERMISOS AGRUPADOS
  // ==========================================================

  const permisosAgrupados =
    useMemo(() => {
      const grupos:
        Record<
          string,
          PermisoConfig[]
        > = {};

      permisosConfig.forEach(
        (permiso) => {
          const grupo =
            grupoPermiso(
              permiso.key
            );

          if (!grupos[grupo]) {
            grupos[grupo] = [];
          }

          grupos[grupo].push(
            permiso
          );
        }
      );

      return grupos;
    }, [permisosConfig]);

  // ==========================================================
  // ABRIR EDITOR
  // ==========================================================

  function abrirEditor(
    usuario: AnyRow
  ) {
    const permisosUsuario =
      usuario?.permisos &&
      typeof usuario.permisos ===
        "object"
        ? usuario.permisos
        : {};

    const estadoPermisos:
      Record<string, boolean> =
      {};

    permisosConfig.forEach(
      (p) => {
        estadoPermisos[p.key] =
          esSi(
            permisosUsuario[
              p.key
            ]
          );
      }
    );

    setUsuarioEditando(
      usuario
    );

    setEditNombre(
      texto(
        obtener(
          usuario,
          "nombre",
          "nombreCompleto",
          "NOMBRE COMPLETO"
        )
      )
    );

    setEditRol(
      texto(
        obtener(
          usuario,
          "rol",
          "ROL"
        )
      )
    );

    setEditActivo(
      esSi(
        obtener(
          usuario,
          "activo",
          "ACTIVO"
        )
      )
    );

    setEditPermisos(
      estadoPermisos
    );

    setMotivo("");
    setMensajeModal("");
  }

  function cerrarEditor() {
    if (guardando) return;

    setUsuarioEditando(
      null
    );
    setMensajeModal("");
    setMotivo("");
  }

  function cambiarPermiso(
    key: string
  ) {
    setEditPermisos(
      (prev) => ({
        ...prev,
        [key]:
          !prev[key],
      })
    );
  }

  function cambiarGrupo(
    permisos:
      PermisoConfig[],
    valor: boolean
  ) {
    setEditPermisos(
      (prev) => {
        const copia = {
          ...prev,
        };

        permisos.forEach(
          (p) => {
            copia[p.key] =
              valor;
          }
        );

        return copia;
      }
    );
  }

  // ==========================================================
  // GUARDAR ACCESOS
  // ==========================================================

  async function guardarAccesos() {
    if (!usuarioEditando) {
      return;
    }

    const usuario =
      texto(
        obtener(
          usuarioEditando,
          "usuario",
          "USUARIO"
        )
      );

    if (!usuario) {
      setMensajeModal(
        "No se pudo identificar el usuario."
      );
      return;
    }

    if (!editNombre.trim()) {
      setMensajeModal(
        "El nombre completo es obligatorio."
      );
      return;
    }

    if (!editRol.trim()) {
      setMensajeModal(
        "Debe seleccionar un rol."
      );
      return;
    }

    if (!motivo.trim()) {
      setMensajeModal(
        "Indique el motivo del cambio."
      );
      return;
    }

    const permisosEnviar:
      Record<string, string> =
      {};

    permisosConfig.forEach(
      (p) => {
        permisosEnviar[p.key] =
          editPermisos[p.key]
            ? "SI"
            : "NO";
      }
    );

    const adminActual =
      obtenerAdminActual();

    if (!adminActual) {
      setMensajeModal(
        "No se pudo identificar la sesión del administrador."
      );
      return;
    }

    setGuardando(true);
    setMensajeModal("");

    try {
      const respuesta =
        await adminApi(
          "adminGuardarUsuario",
          {
            accion:
              "EDITAR",

            usuario,

            adminUsuario:
              adminActual,

            cambios: {
              nombre:
                editNombre.trim(),

              rol:
                editRol.trim(),

              activo:
                editActivo
                  ? "SI"
                  : "NO",

              permisos:
                permisosEnviar,

              motivo:
                motivo.trim(),
            },
          }
        );

      setMensajeModal(
        texto(
          respuesta?.message
        ) ||
          "Cambios guardados correctamente."
      );

      await cargarUsuarios();

      setTimeout(() => {
        setUsuarioEditando(
          null
        );
        setMensajeModal("");
      }, 700);
    } catch (err: any) {
      setMensajeModal(
        err?.message ||
          "No se pudieron guardar los cambios."
      );
    } finally {
      setGuardando(false);
    }
  }

  // ==========================================================
  // PANEL GENERAL
  // ==========================================================

  if (
    section === "panel"
  ) {
    return (
      <section
        style={{
          padding:
            "0 24px 28px",
        }}
      >
        <div className="form-card">
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 12,
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    "0 0 5px",
                }}
              >
                Control general
              </h2>

              <p
                style={{
                  margin: 0,
                }}
              >
                Administración
                central del
                sistema.
              </p>
            </div>

            <button
              type="button"
              className="secondary-action"
              onClick={
                cargarUsuarios
              }
              disabled={
                cargando
              }
            >
              {cargando
                ? "Actualizando..."
                : "Actualizar"}
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop: 15,
                padding: 12,
                border:
                  "1px solid #e5aaaa",
                borderRadius: 9,
                background:
                  "#fff3f3",
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
              [
                "Usuarios",
                usuarios.length,
              ],
              [
                "Usuarios activos",
                usuariosActivos,
              ],
              [
                "Administradores",
                administradores,
              ],
              [
                "Módulos operativos",
                4,
              ],
            ].map(
              ([
                titulo,
                valor,
              ]) => (
                <div
                  key={String(
                    titulo
                  )}
                  style={{
                    border:
                      "1px solid #dce7e4",
                    borderRadius: 12,
                    padding: 16,
                    background:
                      "#fff",
                  }}
                >
                  <small
                    style={{
                      fontWeight: 800,
                      color:
                        "#60746f",
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
              )
            )}
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
            ].map(
              (nombre, i) => (
                <div
                  key={nombre}
                  style={{
                    border:
                      "1px solid #dce7e4",
                    borderRadius: 12,
                    padding: 15,
                  }}
                >
                  <b>
                    {i + 1}.{" "}
                    {nombre}
                  </b>

                  <p
                    style={{
                      fontSize: 12,
                      marginBottom: 0,
                    }}
                  >
                    Módulo
                    integrado
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      </section>
    );
  }

  // ==========================================================
  // USUARIOS Y ACCESOS
  // ==========================================================

  if (
    section === "usuarios"
  ) {
    return (
      <>
        <section
          style={{
            padding:
              "0 24px 28px",
          }}
        >
          <div className="form-card">
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 12,
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    margin:
                      "0 0 5px",
                  }}
                >
                  Usuarios y
                  accesos
                </h2>

                <p
                  style={{
                    margin: 0,
                  }}
                >
                  Administra
                  usuarios,
                  perfiles y
                  permisos por
                  módulo.
                </p>
              </div>

              <button
                type="button"
                className="secondary-action"
                onClick={
                  cargarUsuarios
                }
                disabled={
                  cargando
                }
              >
                {cargando
                  ? "Cargando..."
                  : "Actualizar"}
              </button>
            </div>

            <div
              style={{
                display:
                  "flex",
                gap: 10,
                margin:
                  "18px 0 12px",
                flexWrap:
                  "wrap",
              }}
            >
              <input
                value={buscar}
                onChange={(e) =>
                  setBuscar(
                    e.target
                      .value
                  )
                }
                placeholder="Buscar usuario, nombre o rol"
                style={{
                  minHeight: 42,
                  flex:
                    "1 1 260px",
                  border:
                    "1px solid #cbd9d6",
                  borderRadius: 8,
                  padding:
                    "8px 11px",
                }}
              />

              <div
                style={{
                  padding:
                    "10px 13px",
                  borderRadius: 8,
                  background:
                    "#eef7f5",
                  fontWeight: 800,
                }}
              >
                {
                  usuariosFiltrados.length
                }{" "}
                usuario(s)
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: 12,
                  border:
                    "1px solid #e5aaaa",
                  borderRadius: 9,
                  background:
                    "#fff3f3",
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                overflowX:
                  "auto",
                border:
                  "1px solid #d9e4e1",
                borderRadius: 12,
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: 1050,
                  borderCollapse:
                    "collapse",
                  background:
                    "#fff",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#eef7f5",
                      textAlign:
                        "left",
                    }}
                  >
                    {[
                      "USUARIO",
                      "NOMBRE COMPLETO",
                      "ROL",
                      "ESTADO",
                      "ÚLTIMO ACCESO",
                      "PERMISOS",
                      "ACCIÓN",
                    ].map(
                      (titulo) => (
                        <th
                          key={
                            titulo
                          }
                          style={{
                            padding: 11,
                            borderBottom:
                              "1px solid #d9e4e1",
                            fontSize: 12,
                          }}
                        >
                          {
                            titulo
                          }
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {usuariosFiltrados.map(
                    (u, i) => {
                      const permisosUsuario =
                        u?.permisos &&
                        typeof u.permisos ===
                          "object"
                          ? u.permisos
                          : {};

                      const habilitados =
                        permisosConfig.filter(
                          (p) =>
                            esSi(
                              permisosUsuario[
                                p.key
                              ]
                            )
                        );

                      return (
                        <tr
                          key={
                            texto(
                              obtener(
                                u,
                                "usuario",
                                "USUARIO"
                              )
                            ) ||
                            String(
                              i
                            )
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
                                "USUARIO"
                              )
                            ) ||
                              "—"}
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
                                "nombre",
                                "nombreCompleto",
                                "NOMBRE COMPLETO"
                              )
                            ) ||
                              "—"}
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
                                "rol",
                                "ROL"
                              )
                            ) ||
                              "—"}
                          </td>

                          <td
                            style={{
                              padding: 10,
                              borderBottom:
                                "1px solid #edf2f0",
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-block",
                                padding:
                                  "5px 9px",
                                borderRadius: 20,
                                fontSize: 11,
                                fontWeight: 900,
                                background:
                                  esSi(
                                    u.activo
                                  )
                                    ? "#e7f6ee"
                                    : "#f8e8e8",
                              }}
                            >
                              {esSi(
                                u.activo
                              )
                                ? "ACTIVO"
                                : "INACTIVO"}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: 10,
                              borderBottom:
                                "1px solid #edf2f0",
                            }}
                          >
                            {texto(
                              u.ultimoAcceso
                            ) ||
                              "—"}
                          </td>

                          <td
                            style={{
                              padding: 10,
                              borderBottom:
                                "1px solid #edf2f0",
                              maxWidth: 330,
                            }}
                          >
                            <small>
                              {habilitados.length
                                ? habilitados
                                    .map(
                                      (
                                        p
                                      ) =>
                                        etiquetaPermiso(
                                          p.key
                                        )
                                    )
                                    .join(
                                      " · "
                                    )
                                : "Sin permisos habilitados"}
                            </small>
                          </td>

                          <td
                            style={{
                              padding: 10,
                              borderBottom:
                                "1px solid #edf2f0",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() =>
                                abrirEditor(
                                  u
                                )
                              }
                            >
                              Editar
                              accesos
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {!usuariosFiltrados.length &&
                    !cargando && (
                      <tr>
                        <td
                          colSpan={
                            7
                          }
                          style={{
                            padding: 24,
                            textAlign:
                              "center",
                          }}
                        >
                          No se
                          encontraron
                          usuarios.
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ====================================================
            MODAL EDITAR ACCESOS
        ==================================================== */}

        {usuarioEditando && (
          <div
            style={{
              position:
                "fixed",
              inset: 0,
              zIndex: 9999,
              background:
                "rgba(12,30,27,.58)",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding: 18,
            }}
          >
            <div
              style={{
                width:
                  "min(760px, 96vw)",
                maxHeight:
                  "90vh",
                overflowY:
                  "auto",
                background:
                  "#fff",
                borderRadius: 16,
                boxShadow:
                  "0 20px 55px rgba(0,0,0,.28)",
              }}
            >
              <div
                style={{
                  padding:
                    "18px 20px",
                  borderBottom:
                    "1px solid #dce7e4",
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: 12,
                  position:
                    "sticky",
                  top: 0,
                  background:
                    "#fff",
                  zIndex: 2,
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                    }}
                  >
                    Editar accesos
                  </h2>

                  <small>
                    Usuario:{" "}
                    <b>
                      {texto(
                        usuarioEditando.usuario
                      )}
                    </b>
                  </small>
                </div>

                <button
                  type="button"
                  onClick={
                    cerrarEditor
                  }
                  disabled={
                    guardando
                  }
                  style={{
                    border:
                      "none",
                    background:
                      "transparent",
                    fontSize: 24,
                    cursor:
                      "pointer",
                  }}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(210px,1fr))",
                    gap: 14,
                  }}
                >
                  <label>
                    <b>
                      Nombre
                      completo
                    </b>

                    <input
                      value={
                        editNombre
                      }
                      onChange={(
                        e
                      ) =>
                        setEditNombre(
                          e
                            .target
                            .value
                        )
                      }
                      style={{
                        width:
                          "100%",
                        minHeight: 42,
                        marginTop: 6,
                        border:
                          "1px solid #cbd9d6",
                        borderRadius: 8,
                        padding:
                          "8px 10px",
                      }}
                    />
                  </label>

                  <label>
                    <b>Rol</b>

                    <select
                      value={
                        editRol
                      }
                      onChange={(
                        e
                      ) =>
                        setEditRol(
                          e
                            .target
                            .value
                        )
                      }
                      style={{
                        width:
                          "100%",
                        minHeight: 42,
                        marginTop: 6,
                        border:
                          "1px solid #cbd9d6",
                        borderRadius: 8,
                        padding:
                          "8px 10px",
                        background:
                          "#fff",
                      }}
                    >
                      {!roles.includes(
                        editRol
                      ) &&
                        editRol && (
                          <option
                            value={
                              editRol
                            }
                          >
                            {
                              editRol
                            }
                          </option>
                        )}

                      {roles.map(
                        (rol) => (
                          <option
                            key={
                              rol
                            }
                            value={
                              rol
                            }
                          >
                            {
                              rol
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>

                <div
                  style={{
                    marginTop: 15,
                    padding: 13,
                    border:
                      "1px solid #dce7e4",
                    borderRadius: 10,
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap: 15,
                  }}
                >
                  <div>
                    <b>
                      Estado del
                      usuario
                    </b>

                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 3,
                      }}
                    >
                      {editActivo
                        ? "Puede iniciar sesión."
                        : "Usuario bloqueado."}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setEditActivo(
                        !editActivo
                      )
                    }
                    style={{
                      minWidth: 105,
                      border: 0,
                      borderRadius: 20,
                      padding:
                        "8px 12px",
                      fontWeight: 900,
                      cursor:
                        "pointer",
                      background:
                        editActivo
                          ? "#dff3e8"
                          : "#f5dddd",
                    }}
                  >
                    {editActivo
                      ? "ACTIVO"
                      : "INACTIVO"}
                  </button>
                </div>

                <h3
                  style={{
                    margin:
                      "22px 0 10px",
                  }}
                >
                  Permisos por
                  módulo
                </h3>

                {Object.entries(
                  permisosAgrupados
                ).map(
                  ([
                    grupo,
                    lista,
                  ]) => {
                    const todos =
                      lista.length >
                        0 &&
                      lista.every(
                        (p) =>
                          editPermisos[
                            p.key
                          ]
                      );

                    return (
                      <div
                        key={
                          grupo
                        }
                        style={{
                          border:
                            "1px solid #dce7e4",
                          borderRadius: 12,
                          marginBottom: 12,
                          overflow:
                            "hidden",
                        }}
                      >
                        <div
                          style={{
                            background:
                              "#eef7f5",
                            padding:
                              "11px 13px",
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "center",
                            gap: 10,
                          }}
                        >
                          <b>
                            {
                              grupo
                            }
                          </b>

                          <button
                            type="button"
                            onClick={() =>
                              cambiarGrupo(
                                lista,
                                !todos
                              )
                            }
                            style={{
                              border:
                                "1px solid #bdd3ce",
                              borderRadius: 7,
                              background:
                                "#fff",
                              padding:
                                "5px 9px",
                              cursor:
                                "pointer",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {todos
                              ? "Quitar todos"
                              : "Dar todos"}
                          </button>
                        </div>

                        <div
                          style={{
                            padding:
                              "6px 13px",
                          }}
                        >
                          {lista.map(
                            (
                              p
                            ) => (
                              <label
                                key={
                                  p.key
                                }
                                style={{
                                  minHeight: 42,
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  justifyContent:
                                    "space-between",
                                  gap: 12,
                                  borderBottom:
                                    "1px solid #edf2f0",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                <span>
                                  {etiquetaPermiso(
                                    p.key
                                  )}
                                </span>

                                <input
                                  type="checkbox"
                                  checked={
                                    !!editPermisos[
                                      p
                                        .key
                                    ]
                                  }
                                  onChange={() =>
                                    cambiarPermiso(
                                      p.key
                                    )
                                  }
                                  style={{
                                    width: 19,
                                    height: 19,
                                  }}
                                />
                              </label>
                            )
                          )}
                        </div>
                      </div>
                    );
                  }
                )}

                {!permisosConfig.length && (
                  <div
                    style={{
                      padding: 14,
                      background:
                        "#fff8e1",
                      border:
                        "1px solid #f1d78b",
                      borderRadius: 9,
                    }}
                  >
                    No se
                    recibieron
                    permisos
                    configurados
                    desde
                    USUARIOS.
                  </div>
                )}

                <label
                  style={{
                    display:
                      "block",
                    marginTop: 16,
                  }}
                >
                  <b>
                    Motivo del
                    cambio
                  </b>

                  <textarea
                    value={
                      motivo
                    }
                    onChange={(
                      e
                    ) =>
                      setMotivo(
                        e
                          .target
                          .value
                      )
                    }
                    placeholder="Ej.: Cambio de funciones / acceso autorizado por..."
                    rows={3}
                    style={{
                      width:
                        "100%",
                      marginTop: 6,
                      border:
                        "1px solid #cbd9d6",
                      borderRadius: 8,
                      padding:
                        "9px 10px",
                      resize:
                        "vertical",
                    }}
                  />
                </label>

                {mensajeModal && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 9,
                      background:
                        mensajeModal
                          .toLowerCase()
                          .includes(
                            "correct"
                          )
                          ? "#e8f6ee"
                          : "#fff3f3",
                      border:
                        "1px solid #d7e2df",
                    }}
                  >
                    {
                      mensajeModal
                    }
                  </div>
                )}

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "flex-end",
                    gap: 10,
                    marginTop: 20,
                  }}
                >
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={
                      cerrarEditor
                    }
                    disabled={
                      guardando
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="primary-action"
                    onClick={
                      guardarAccesos
                    }
                    disabled={
                      guardando
                    }
                  >
                    {guardando
                      ? "Guardando..."
                      : "Guardar cambios"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ==========================================================
  // AUDITORÍA
  // ==========================================================

  if (
    section === "auditoria"
  ) {
    return (
      <section
        style={{
          padding:
            "0 24px 28px",
        }}
      >
        <div className="form-card">
          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 12,
              flexWrap:
                "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin:
                    "0 0 5px",
                }}
              >
                Auditoría
              </h2>

              <p
                style={{
                  margin: 0,
                }}
              >
                Historial de
                modificaciones
                administrativas.
              </p>
            </div>

            <button
              type="button"
              className="secondary-action"
              onClick={
                cargarAuditoria
              }
              disabled={
                cargando
              }
            >
              {cargando
                ? "Cargando..."
                : "Actualizar"}
            </button>
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                border:
                  "1px solid #e5aaaa",
                borderRadius: 9,
                background:
                  "#fff3f3",
                marginTop: 15,
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              overflowX:
                "auto",
              border:
                "1px solid #d9e4e1",
              borderRadius: 12,
              marginTop: 18,
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: 1100,
                borderCollapse:
                  "collapse",
                background:
                  "#fff",
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      "#eef7f5",
                    textAlign:
                      "left",
                  }}
                >
                  {[
                    "FECHA / HORA",
                    "USUARIO ADMIN",
                    "MÓDULO",
                    "REGISTRO",
                    "ACCIÓN",
                    "CAMPO",
                    "VALOR ANTERIOR",
                    "VALOR NUEVO",
                    "MOTIVO",
                  ].map(
                    (titulo) => (
                      <th
                        key={
                          titulo
                        }
                        style={{
                          padding: 11,
                          fontSize: 12,
                        }}
                      >
                        {
                          titulo
                        }
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {auditoria.map(
                  (r, i) => {
                    const columnas =
                      [
                        r.fechaHora,
                        r.usuarioAdmin,
                        r.modulo,
                        r.registro,
                        r.accion,
                        r.campo,
                        r.anterior,
                        r.nuevo,
                        r.motivo,
                      ];

                    return (
                      <tr
                        key={
                          i
                        }
                      >
                        {columnas.map(
                          (
                            valor,
                            j
                          ) => (
                            <td
                              key={
                                j
                              }
                              style={{
                                padding: 10,
                                borderTop:
                                  "1px solid #edf2f0",
                                fontSize: 12,
                              }}
                            >
                              {texto(
                                valor
                              ) ||
                                "—"}
                            </td>
                          )
                        )}
                      </tr>
                    );
                  }
                )}

                {!auditoria.length &&
                  !cargando && (
                    <tr>
                      <td
                        colSpan={
                          9
                        }
                        style={{
                          padding: 24,
                          textAlign:
                            "center",
                        }}
                      >
                        Aún no hay
                        movimientos
                        administrativos
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
  // MODIFICAR / ANULAR
  // ==========================================================

  if (
    section === "registros"
  ) {
    return (
      <section
        style={{
          padding:
            "0 24px 28px",
        }}
      >
        <div className="form-card">
          <h2
            style={{
              marginTop: 0,
            }}
          >
            Modificar / Anular
            registros
          </h2>

          <p>
            Administración de
            registros de los
            módulos 1 al 4.
          </p>

          <div
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 10,
              background:
                "#fff8e1",
              border:
                "1px solid #f1d78b",
            }}
          >
            La interfaz ya está
            reservada. Esta
            sección se conectará
            con las estructuras
            reales de cada módulo
            para modificar o
            anular sin eliminar
            físicamente los
            registros.
          </div>
        </div>
      </section>
    );
  }

  // ==========================================================
  // CATÁLOGOS
  // ==========================================================

  return (
    <section
      style={{
        padding:
          "0 24px 28px",
      }}
    >
      <div className="form-card">
        <h2
          style={{
            marginTop: 0,
          }}
        >
          Catálogos /
          configuración
        </h2>

        <p>
          Administración de
          parámetros utilizados
          por los módulos del
          sistema.
        </p>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 10,
            background:
              "#fff8e1",
            border:
              "1px solid #f1d78b",
          }}
        >
          La interfaz de
          catálogos se conectará
          con las listas reales
          utilizadas actualmente
          por los módulos 1–4.
        </div>
      </div>
    </section>
  );
}
