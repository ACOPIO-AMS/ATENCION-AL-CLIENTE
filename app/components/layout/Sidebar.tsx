"use client";

export type AppView =
  | "registro"
  | "hoy"
  | "pendientes"
  | "buscar"
  | "personas"
  | "cargos"
  | "buscarSalidas"
  | "guias";

type SidebarProps = {
  activeView: AppView;
  pendingCount: number;
  onNuevoIngreso: () => void;
  onReporteDiario: () => void;
  onPorRegularizar: () => void;
  onBuscar: () => void;
  onBDClientes: () => void;
  onCargos: () => void;
  onBuscarSalidas: () => void;
  onGuias: () => void;
};

export default function Sidebar({
  activeView,
  pendingCount,
  onNuevoIngreso,
  onReporteDiario,
  onPorRegularizar,
  onBuscar,
  onBDClientes,
  onCargos,
  onBuscarSalidas,
  onGuias,
}: SidebarProps) {
  return (
    <nav aria-label="Navegación principal">
      <button
        className={activeView === "registro" ? "nav-item active" : "nav-item"}
        onClick={onNuevoIngreso}
      >
        <span>＋</span> Nuevo ingreso
      </button>

      <button
        className={activeView === "hoy" ? "nav-item active" : "nav-item"}
        onClick={onReporteDiario}
      >
        <span>▦</span> Reporte diario
      </button>

      <button
        className={
          activeView === "pendientes" ? "nav-item active" : "nav-item"
        }
        onClick={onPorRegularizar}
      >
        <span>◷</span> Por regularizar
        {pendingCount > 0 && <b>{pendingCount}</b>}
      </button>

      <button
        className={activeView === "buscar" ? "nav-item active" : "nav-item"}
        onClick={onBuscar}
      >
        <span>⌕</span> Buscar
      </button>

      <button
        className={activeView === "personas" ? "nav-item active" : "nav-item"}
        onClick={onBDClientes}
      >
        <span>◎</span> BD Clientes
      </button>

      <button
        className={activeView === "cargos" ? "nav-item active" : "nav-item"}
        onClick={onCargos}
      >
        <span>▤</span> Cargos y Salidas
      </button>

      <button
        className={
          activeView === "buscarSalidas" ? "nav-item active" : "nav-item"
        }
        onClick={onBuscarSalidas}
      >
        <span>⌕</span> Buscar salidas
      </button>

      <button
        className={activeView === "guias" ? "nav-item active" : "nav-item"}
        onClick={onGuias}
      >
        <span>▣</span> Registro de Guías
      </button>
    </nav>
  );
}
