"use client";

export type Cliente = {
  dni: string;
  name: string;
  phone: string;
  license?: string;
  category?: string;
  role?: string;
};

type BDClientesProps = {
  clients: Cliente[];
  busy: boolean;
  onActualizar: () => void;
};

export default function BDClientes({
  clients,
  busy,
  onActualizar,
}: BDClientesProps) {
  return (
    <section className="empty-view data-view">
      <div className="people-toolbar">
        <div>
          <h2>BD CLIENTES</h2>
          <p>Fuente maestra para autocompletar por DNI.</p>
        </div>

        <button
          type="button"
          onClick={onActualizar}
          disabled={busy}
        >
          {busy ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      <div className="people-table">
        <div className="table-head">
          <span>DNI</span>
          <span>Nombres y apellidos</span>
          <span>Celular</span>
          <span>Licencia</span>
          <span>Estado</span>
        </div>

        {clients.map((person)
