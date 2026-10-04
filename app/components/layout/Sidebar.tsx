"use client";

export type AppView =
  | "registro"
  | "hoy"
  | "pendientes"
  | "buscar"
  | "personas"
  | "estadia"
  | "salidaProveedores"
  | "habitaciones"
  | "resumenGuardia"
  | "cargos"
  | "buscarSalidas"
  | "recepcionCargos"
  | "guias"
  | "rirm"
  | "admin";

export type GuiasSection =
  | "registrar"
  | "historial"
  | "indicadores"
  | "sacos"
  | "cargo-guias"
  | "reporte-guias";

export type RirmSection =
  | "pendientes"
  | "nueva-solicitud"
  | "mis-solicitudes"
  | "historial-buscar";

export type AdminSection =
  | "panel"
  | "usuarios"
  | "registros"
  | "catalogos"
  | "auditoria";

export type ModuleName =
  | "atencion"
  | "cargos"
  | "guias"
  | "rirm"
  | "admin";

type Props = {
  activeView: AppView;
  openModule: ModuleName | null;
  guiasSection: GuiasSection;
  rirmSection: RirmSection;
  adminSection: AdminSection;
  pendingCount: number;
  isAdmin: boolean;

  // Acepta booleanos y también SI/NO enviados por el backend
  permissions?: Record<string, boolean | string | number>;

  setOpenModule: (v: ModuleName | null) => void;

  nuevo: () => void;
  hoy: () => void;
  pendientes: () => void;
  buscar: () => void;
  clientes: () => void;
  estadia: () => void;
  salidaProveedores: () => void;
  habitaciones: () => void;
  resumenGuardia: () => void;

  registrarSalida: () => void;
  buscarSalidas: () => void;
  recepcionCargos: () => void;

  abrirGuias: (s: GuiasSection) => void;
  abrirRirm: (s: RirmSection) => void;
  abrirAdmin: (s: AdminSection) => void;
};

const Icon = ({
  children,
  tone = "blue",
}: {
  children: string;
  tone?: string;
}) => (
  <span
    className={`nav-graphic tone-${tone}`}
    aria-hidden="true"
  >
    {children}
  </span>
);

// ======================================================
// NORMALIZAR NOMBRE DEL PERMISO
// ======================================================

function norm(v: string) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ======================================================
// INTERPRETAR VALOR DEL PERMISO
// ======================================================

function permissionValue(value: unknown): boolean {
  if (value === true) return true;

  if (
    value === false ||
    value === null ||
    value === undefined
  ) {
    return false;
  }

  const text = String(value)
    .trim()
    .toUpperCase();

  return (
    text === "SI" ||
    text === "SÍ" ||
    text === "TRUE" ||
    text === "1" ||
    text === "X"
  );
}

// ======================================================
// SIDEBAR
// ======================================================

export default function SidebarMenu(p: Props) {

  const toggle = (m: ModuleName) =>
    p.setOpenModule(
      p.openModule === m ? null : m
    );

  // ====================================================
  // NORMALIZAR TODOS LOS PERMISOS UNA SOLA VEZ
  // ====================================================

  const perms = p.permissions || {};

  const normalized: Record<string, boolean> = {};

  Object.entries(perms).forEach(([key, value]) => {
    normalized[norm(key)] = permissionValue(value);
  });

  const can = (...keys: string[]) => {

    // Administrador ve todo
    if (p.isAdmin) return true;

    return keys.some(
      (key) =>
        normalized[norm(key)] === true
    );
  };

  // ====================================================
  // 1. ATENCIÓN AL CLIENTE
  // ====================================================

  const aNuevo = can(
    "Nuevo ingreso"
  );

  const aReporte = can(
    "Reporte diario"
  );

  const aRegularizar = can(
    "Por regularizar"
  );

  const aBuscar = can(
    "Buscar"
  );

  const aClientes = can(
    "B CLIENTES",
    "BD CLIENTES",
    "BD Clientes"
  );

  const aEstadia = can(
    "Estadía, Servicios y Consumos",
    "Estadia, Servicios y Consumos"
  );

  const aSalidaProveedores = can(
    "Salida de Proveedores"
  );

  const aHabitaciones = can(
    "Control de Habitaciones"
  );

  const aResumenGuardia = can(
    "Resumen diario / guardia",
    "Resumen diario/guardia"
  );

  const mAtencion = can(
    "ATENCION AL CLIENTE",
    "ATENCIÓN AL CLIENTE"
  );

  /*
   * IMPORTANTE:
   * Ya no exigimos:
   *
   * permiso módulo Y permiso hijo
   *
   * El módulo aparece si tiene permiso
   * padre O por lo menos un permiso hijo.
   */

  const showAtencion =
    mAtencion ||
    aNuevo ||
    aReporte ||
    aRegularizar ||
    aBuscar ||
    aClientes ||
    aEstadia ||
    aSalidaProveedores ||
    aHabitaciones ||
    aResumenGuardia;

  // ====================================================
  // 2. CARGOS Y SALIDAS
  // ====================================================

  const sRegistrar = can(
    "Registrar salida"
  );

  const sBuscar = can(
    "Buscar salidas"
  );

  const sRecepcion = can("CARGOS_RECEPCION") || can("Pendientes de recepción");

  const mCargos = can(
    "CARGOS Y SALIDAS"
  );

  const showCargos =
    mCargos ||
    sRegistrar ||
    sBuscar ||
    sRecepcion;

  // ====================================================
  // 3. REGISTRO DE GUÍAS
  // ====================================================

  const gRegistrar = can(
    "Registrar"
  );

  const gHistorial = can(
    "Historial de registros"
  );

  const gIndicadores = can(
    "Indicadores"
  );

  const gSacos = can(
    "Registro de Sacos Mineros"
  );

  const gCargoGuias = can(
    "Cargo - Guías y Tickets",
    "Cargo - Guias y Tickets"
  );

  const gReporteGuias = can(
    "Reporte de guías",
    "Reporte de guias"
  );

  const mGuias = can(
    "REGISTRO DE GUIAS",
    "REGISTRO DE GUÍAS"
  );

  const showGuias =
    mGuias ||
    gRegistrar ||
    gHistorial ||
    gIndicadores ||
    gSacos ||
    gCargoGuias ||
    gReporteGuias;

  // ====================================================
  // 4. REGISTRO RI-RM
  // ====================================================

  const rPendientes = can(
    "Pendientes"
  );

  const rNueva = can(
    "Nueva solicitud"
  );

  const rHistorial = can(
    "Historial / Buscar",
    "Historial/Buscar",
    "Mis solicitudes"
  );

  const rModulo = can(
    "REGISTRO RI-RM"
  );

  const showRirm =
    rModulo ||
    rPendientes ||
    rNueva ||
    rMis ||
    rHistorial;

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <nav
      className="ams-nav"
      aria-label="Navegación principal"
    >

      {/* =================================================
          1. ATENCIÓN AL CLIENTE
      ================================================= */}

      {showAtencion && (
        <div
          className={`module-block${
            p.openModule === "atencion"
              ? " expanded"
              : ""
          }`}
        >
          <button
            className="module-trigger"
            onClick={() => toggle("atencion")}
          >
            <Icon tone="cyan">👥</Icon>

            <span>
              1. ATENCIÓN AL CLIENTE
            </span>

            <b>
              {p.openModule === "atencion"
                ? "⌃"
                : "⌄"}
            </b>
          </button>

          {p.openModule === "atencion" && (
            <div className="module-children">

              {aNuevo && (
                <button
                  className={
                    p.activeView === "registro"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.nuevo}
                >
                  <Icon>➕</Icon>
                  <span>Nuevo ingreso</span>
                </button>
              )}

              {aReporte && (
                <button
                  className={
                    p.activeView === "hoy"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.hoy}
                >
                  <Icon tone="cyan">📊</Icon>
                  <span>Reporte diario</span>
                </button>
              )}

              {aRegularizar && (
                <button
                  className={
                    p.activeView === "pendientes"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.pendientes}
                >
                  <Icon tone="orange">🕘</Icon>

                  <span>
                    Por regularizar
                  </span>

                  {p.pendingCount > 0 && (
                    <b className="nav-count">
                      {p.pendingCount}
                    </b>
                  )}
                </button>
              )}

              {aBuscar && (
                <button
                  className={
                    p.activeView === "buscar"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.buscar}
                >
                  <Icon>🔎</Icon>
                  <span>Buscar</span>
                </button>
              )}

              {aClientes && (
                <button
                  className={
                    p.activeView === "personas"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.clientes}
                >
                  <Icon tone="cyan">👥</Icon>
                  <span>BD Clientes</span>
                </button>
              )}

              {aEstadia && (
                <button
                  className={
                    p.activeView === "estadia"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.estadia}
                >
                  <Icon tone="cyan">🧾</Icon>
                  <span>Estadía, Servicios y Consumos</span>
                </button>
              )}

              {aSalidaProveedores && (
                <button
                  className={
                    p.activeView === "salidaProveedores"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.salidaProveedores}
                >
                  <Icon tone="orange">🚪</Icon>
                  <span>Salida de Proveedores</span>
                </button>
              )}

              {aHabitaciones && (
                <button
                  className={
                    p.activeView === "habitaciones"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.habitaciones}
                >
                  <Icon tone="cyan">🛏</Icon>
                  <span>Control de Habitaciones</span>
                </button>
              )}

              {aResumenGuardia && (
                <button
                  className={
                    p.activeView === "resumenGuardia"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.resumenGuardia}
                >
                  <Icon tone="gold">📊</Icon>
                  <span>Resumen diario / guardia</span>
                </button>
              )}

            </div>
          )}
        </div>
      )}

      {/* =================================================
          2. CARGOS Y SALIDAS
      ================================================= */}

      {showCargos && (
        <div
          className={`module-block${
            p.openModule === "cargos"
              ? " expanded"
              : ""
          }`}
        >
          <button
            className="module-trigger"
            onClick={() => toggle("cargos")}
          >
            <Icon>📤</Icon>

            <span>
              2. CARGOS Y SALIDAS
            </span>

            <b>
              {p.openModule === "cargos"
                ? "⌃"
                : "⌄"}
            </b>
          </button>

          {p.openModule === "cargos" && (
            <div className="module-children">

              {sRegistrar && (
                <button
                  className={
                    p.activeView === "cargos"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.registrarSalida}
                >
                  <Icon>📤</Icon>
                  <span>Registrar salida</span>
                </button>
              )}

              {sBuscar && (
                <button
                  className={
                    p.activeView === "buscarSalidas"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={p.buscarSalidas}
                >
                  <Icon tone="cyan">🔎</Icon>
                  <span>Buscar salidas</span>
                </button>
              )}

              {sRecepcion && (
                <button className={p.activeView === "recepcionCargos" ? "nav-item active" : "nav-item"} onClick={p.recepcionCargos}>
                  <Icon tone="green">✓</Icon><span>Pendientes de recepción</span>
                </button>
              )}

            </div>
          )}
        </div>
      )}

      {/* =================================================
          3. REGISTRO DE GUÍAS
      ================================================= */}

      {showGuias && (
        <div
          className={`module-block${
            p.openModule === "guias"
              ? " expanded"
              : ""
          }`}
        >
          <button
            className="module-trigger"
            onClick={() => toggle("guias")}
          >
            <Icon tone="cyan">📋</Icon>

            <span>
              3. REGISTRO DE GUÍAS
            </span>

            <b>
              {p.openModule === "guias"
                ? "⌃"
                : "⌄"}
            </b>
          </button>

          {p.openModule === "guias" && (
            <div className="module-children">

              {gRegistrar && (
                <button
                  className={
                    p.activeView === "guias" &&
                    p.guiasSection === "registrar"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    p.abrirGuias("registrar")
                  }
                >
                  <Icon>📝</Icon>
                  <span>Registrar</span>
                </button>
              )}

              {gHistorial && (
                <button
                  className={
                    p.activeView === "guias" &&
                    p.guiasSection === "historial"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    p.abrirGuias("historial")
                  }
                >
                  <Icon tone="cyan">📋</Icon>
                  <span>
                    Historial de registros
                  </span>
                </button>
              )}

              {gIndicadores && (
                <button
                  className={
                    p.activeView === "guias" &&
                    p.guiasSection === "indicadores"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    p.abrirGuias("indicadores")
                  }
                >
                  <Icon tone="orange">📊</Icon>
                  <span>Indicadores</span>
                </button>
              )}

              {gSacos && (
                <button
                  className={
                    p.activeView === "guias" &&
                    p.guiasSection === "sacos"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    p.abrirGuias("sacos")
                  }
                >
                  <Icon tone="gold">📦</Icon>
                  <span>
                    Registro de Sacos Mineros
                  </span>
                </button>
              )}

              {gCargoGuias && (
                <button
                  className={
                    p.activeView === "guias" &&
                    p.guiasSection === "cargo-guias"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    p.abrirGuias("cargo-guias")
                  }
                >
                  <Icon tone="cyan">🧾</Icon>
                  <span>Cargo - Guías y Tickets</span>
                </button>
              )}

              {gReporteGuias && (
                <button
                  className={
                    p.activeView === "guias" &&
                    p.guiasSection === "reporte-guias"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    p.abrirGuias("reporte-guias")
                  }
                >
                  <Icon tone="cyan">📊</Icon>
                  <span>Reporte de guías</span>
                </button>
              )}

            </div>
          )}
        </div>
      )}

      {/* =================================================
          4. REGISTRO RI-RM
      ================================================= */}

      {showRirm && (
        <div
          className={`module-block${
            p.openModule === "rirm"
              ? " expanded"
              : ""
          }`}
        >
          <button
            className="module-trigger"
            onClick={() => toggle("rirm")}
          >
            <Icon tone="orange">⚗</Icon>

            <span>
              4. REGISTRO RI-RM
            </span>

            <b>
              {p.openModule === "rirm"
                ? "⌃"
                : "⌄"}
            </b>
          </button>

          {p.openModule === "rirm" && (
            <div className="module-children">

              {rPendientes && (
                <button
                  className={
                    p.activeView === "rirm" &&
                    p.rirmSection === "pendientes"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    p.abrirRirm("pendientes")
                  }
                >
                  <Icon tone="orange">🕘</Icon>
                  <span>Pendientes</span>
                </button>
              )}

              {rNueva && (
                <button
                  className={
                    p.activeView === "rirm" &&
                    p.rirmSection === "nueva-solicitud"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    p.abrirRirm("nueva-solicitud")
                  }
                >
                  <Icon>➕</Icon>
                  <span>Nueva solicitud</span>
                </button>
              )}

              {rHistorial && (
                <button
                  className={
                    p.activeView === "rirm" &&
                    p.rirmSection === "historial-buscar"
                      ? "nav-item active"
                      : "nav-item"
                  }
                  onClick={() =>
                    p.abrirRirm("historial-buscar")
                  }
                >
                  <Icon>🔎</Icon>
                  <span>
                    Historial / Buscar
                  </span>
                </button>
              )}

            </div>
          )}
        </div>
      )}

      {/* =================================================
          5. ADMINISTRADOR
      ================================================= */}

      {p.isAdmin && (
        <div
          className={`module-block${
            p.openModule === "admin"
              ? " expanded"
              : ""
          }`}
        >
          <button
            className="module-trigger"
            onClick={() => toggle("admin")}
          >
            <Icon tone="gold">⚙</Icon>

            <span>
              5. ADMINISTRADOR
            </span>

            <b>
              {p.openModule === "admin"
                ? "⌃"
                : "⌄"}
            </b>
          </button>

          {p.openModule === "admin" && (
            <div className="module-children">

              <button
                className={
                  p.activeView === "admin" &&
                  p.adminSection === "panel"
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  p.abrirAdmin("panel")
                }
              >
                <Icon tone="cyan">📊</Icon>
                <span>Panel general</span>
              </button>

              <button
                className={
                  p.activeView === "admin" &&
                  p.adminSection === "usuarios"
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  p.abrirAdmin("usuarios")
                }
              >
                <Icon>👤</Icon>
                <span>Usuarios y accesos</span>
              </button>

              <button
                className={
                  p.activeView === "admin" &&
                  p.adminSection === "registros"
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  p.abrirAdmin("registros")
                }
              >
                <Icon tone="orange">✎</Icon>
                <span>Modificar / Anular</span>
              </button>

              <button
                className={
                  p.activeView === "admin" &&
                  p.adminSection === "catalogos"
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  p.abrirAdmin("catalogos")
                }
              >
                <Icon>⚙</Icon>
                <span>Catálogos / Config.</span>
              </button>

              <button
                className={
                  p.activeView === "admin" &&
                  p.adminSection === "auditoria"
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  p.abrirAdmin("auditoria")
                }
              >
                <Icon tone="cyan">🔎</Icon>
                <span>Auditoría</span>
              </button>

            </div>
          )}
        </div>
      )}

    </nav>
  );
}
