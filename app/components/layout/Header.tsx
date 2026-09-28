"use client";

import type { AppView } from "./Sidebar";

type ConnectionState =
  | "online"
  | "offline"
  | "outdated"
  | "unconfigured"
  | string;

type HeaderProps = {
  activeView: AppView;
  regularizingId?: string;
  connection: ConnectionState;
  connectionLabel: string;
};

export default function Header({
  activeView,
  regularizingId,
  connection,
  connectionLabel,
}: HeaderProps) {
  const title =
    activeView === "registro"
      ? regularizingId
        ? `Regularizar ${regularizingId}`
        : "Registrar ingreso"
      : activeView === "hoy"
        ? "Reporte diario"
        : activeView === "pendientes"
          ? "Eventos por regularizar"
          : activeView === "buscar"
            ? "Buscar registros"
            : activeView === "personas"
              ? "BD Clientes"
              : activeView === "buscarSalidas"
                ? "Buscar salidas"
                : activeView === "guias"
                  ? "Registro de Guías"
                  : "Cargos y Salidas";

  return (
    <header className="topbar">
      <div>
        <p>REGISTRO DE PROVEEDORES ATENCIÓN AL CLIENTE - AMS - v001crq.</p>
        <h1>{title}</h1>
      </div>

      <div className="header-actions">
        <span className={`online connection-pill-${connection}`}>
          ● {connectionLabel}
        </span>
      </div>
    </header>
  );
}
