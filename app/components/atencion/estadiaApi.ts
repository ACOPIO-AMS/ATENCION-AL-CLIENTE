"use client";

export type EstadiaPersona = {
  idIngreso: string;
  dni: string;
  nombre: string;
  rol: string;
  placa: string;
  proveedor: string;
  fechaIngreso: string;
  salidaPrevista?: string;
  fechaSalida?: string;
  habitacion?: string;
  estado: "PRESENTE" | "SALIO";
};

export type Habitacion = {
  numero: string;
  estado: "DISPONIBLE" | "OCUPADA" | "RESERVADA" | "POR LIMPIAR" | "FUERA DE SERVICIO";
  dni?: string;
  huesped?: string;
  placa?: string;
  proveedor?: string;
  fechaIngreso?: string;
  salidaPrevista?: string;
};

export async function estadiaApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("/api/sheets", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const json = await response.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor." }));
  if (!response.ok || !json.ok) throw new Error(json.error || "No se pudo completar la operación.");
  return json.data as T;
}

export function duracionDesde(value?: string, hasta?: string) {
  if (!value) return "-";
  const ini = new Date(value).getTime();
  const fin = hasta ? new Date(hasta).getTime() : Date.now();
  if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin < ini) return "-";
  const min = Math.floor((fin - ini) / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return `${d ? `${d}d ` : ""}${h}h ${m}m`;
}

export const panel: React.CSSProperties = { background:"#fff", border:"1px solid #dce6e4", borderRadius:14, padding:18, boxShadow:"0 3px 12px rgba(0,0,0,.05)" };
export const btn: React.CSSProperties = { border:0, borderRadius:9, padding:"10px 14px", fontWeight:800, cursor:"pointer", background:"#173f3b", color:"#fff" };
export const input: React.CSSProperties = { width:"100%", boxSizing:"border-box", border:"1px solid #cbd8d5", borderRadius:8, padding:"9px 10px", background:"#fff" };
