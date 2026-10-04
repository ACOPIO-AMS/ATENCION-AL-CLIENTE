"use client";

import { useEffect, useMemo, useState } from "react";

type ReporteFila = {
  id?: string;
  idAtencion?: string;
  placa?: string;
  razonSocialGrr?: string;
  razonSocialGrt?: string;
  grr?: string;
  grt?: string;
  tonelaje?: number | string;
  tipoGuia?: string;
  zona?: string;
  estado?: "PENDIENTE" | "RECEPCIÓN" | "FINALIZADO" | "ANULADO" | string;
  observacion?: string;
  fechaMs?: number;
  anulado?: boolean;
};

type Totales = {
  vehiculos: number;
  guias: number;
  grr: number;
  grt: number;
  tonelaje: number;
  pendiente: number;
  recepcion: number;
  finalizado: number;
  anulado: number;
};

type ReporteData = {
  ok?: boolean;
  fechaActual?: string;
  horaActual?: string;
  guardia?: string;
  guardiaDesde?: string;
  guardiaHasta?: string;
  totales?: Partial<Totales>;
  registros?: ReporteFila[];
  resumen?: string[];
  actualizadoMs?: number;
  mensaje?: string;
};

const VACIO_TOTALES: Totales = {
  vehiculos: 0,
  guias: 0,
  grr: 0,
  grt: 0,
  tonelaje: 0,
  pendiente: 0,
  recepcion: 0,
  finalizado: 0,
  anulado: 0,
};

async function apiGuias(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch("/api/guias", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || data?.mensaje || "No se pudo cargar el reporte de guías.");
  }

  return data as ReporteData;
}

function fechaHoraActual() {
  const now = new Date();
  return {
    fecha: new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(now),
    hora: new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now),
  };
}

function n(v: unknown) {
  const raw = String(v ?? "").trim().replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function formatTonelaje(v: unknown) {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n(v));
}

function texto(v: unknown) {
  return String(v ?? "").trim();
}

function estadoClase(estado?: string) {
  const e = texto(estado).toUpperCase();
  if (e === "FINALIZADO") return "rg-badge finalizado";
  if (e === "RECEPCIÓN" || e === "RECEPCION") return "rg-badge recepcion";
  if (e === "ANULADO") return "rg-badge anulado";
  return "rg-badge pendiente";
}

export default function ReporteGuias() {
  const [reporte, setReporte] = useState<ReporteData>({ registros: [], resumen: [], totales: VACIO_TOTALES });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [buscar, setBuscar] = useState("");
  const [reloj, setReloj] = useState(fechaHoraActual());

  async function actualizar() {
    setCargando(true);
    setError("");
    try {
      const data = await apiGuias("obtenerReporteGuiasGuardiaActual");
      setReporte({
        ...data,
        registros: Array.isArray(data?.registros) ? data.registros : [],
        resumen: Array.isArray(data?.resumen) ? data.resumen : [],
        totales: { ...VACIO_TOTALES, ...(data?.totales || {}) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el reporte de guías.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void actualizar();
    const timer = window.setInterval(() => setReloj(fechaHoraActual()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totales = { ...VACIO_TOTALES, ...(reporte.totales || {}) };
  const filas = Array.isArray(reporte.registros) ? reporte.registros : [];

  const filasFiltradas = useMemo(() => {
    const q = buscar.trim().toUpperCase();
    if (!q) return filas;
    return filas.filter((fila) =>
      [
        fila.placa,
        fila.razonSocialGrr,
        fila.razonSocialGrt,
        fila.grr,
        fila.grt,
        fila.zona,
        fila.estado,
        fila.observacion,
      ]
        .map((x) => texto(x).toUpperCase())
        .some((x) => x.includes(q))
    );
  }, [filas, buscar]);

  const guardiaTexto = [reporte.guardia, reporte.guardiaDesde && reporte.guardiaHasta ? `${reporte.guardiaDesde} – ${reporte.guardiaHasta}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rg-root">
      <style jsx global>{`
        .rg-root{padding:14px 16px 28px;background:#f5f8fc;color:#102a50;min-height:calc(100vh - 92px)}
        .rg-root *{box-sizing:border-box}
        .rg-header{display:grid;grid-template-columns:minmax(420px,1fr) auto auto auto;gap:0;background:linear-gradient(90deg,#073b70,#0d5a99);color:#fff;border-radius:10px 10px 0 0;overflow:hidden;box-shadow:0 2px 10px rgba(14,51,91,.12)}
        .rg-brand{display:flex;align-items:center;gap:14px;padding:14px 18px;min-width:0}
        .rg-logo{width:58px;height:58px;border-radius:9px;background:#ffbe0b;color:#111;display:grid;place-items:center;font-weight:950;font-size:18px;flex:0 0 auto}
        .rg-brand-copy{display:flex;align-items:center;gap:18px;min-width:0}
        .rg-company{padding-right:18px;border-right:1px solid rgba(255,255,255,.26)}
        .rg-company b{display:block;font-size:17px;letter-spacing:.01em}.rg-company small{font-size:11px;opacity:.9}
        .rg-title h1{margin:0;font-size:25px;line-height:1.05;letter-spacing:.01em}.rg-title p{margin:4px 0 0;font-size:11px;opacity:.9}
        .rg-head-meta{min-width:145px;padding:13px 18px;display:flex;align-items:center;gap:10px;border-left:1px solid rgba(255,255,255,.2)}
        .rg-head-meta span{font-size:24px}.rg-head-meta small{display:block;opacity:.85;font-size:10px}.rg-head-meta strong{display:block;margin-top:2px;font-size:14px}
        .rg-update-wrap{display:grid;place-items:center;padding:10px 16px;border-left:1px solid rgba(255,255,255,.2)}
        .rg-update{border:0;border-radius:7px;background:#0969f6;color:#fff;padding:12px 20px;font-weight:850;font-size:14px;cursor:pointer;min-width:132px;box-shadow:0 2px 6px rgba(0,0,0,.13)}
        .rg-update:disabled{opacity:.65;cursor:wait}
        .rg-error{margin-top:12px;background:#fff1f1;border:1px solid #ffc7c7;color:#a61b1b;border-radius:8px;padding:11px 13px;font-weight:700}
        .rg-top{display:grid;grid-template-columns:minmax(540px,1.45fr) minmax(330px,.8fr) minmax(260px,.62fr);gap:12px;margin-top:12px}
        .rg-card{background:#fff;border:1px solid #d8e4ef;border-radius:8px;overflow:hidden;box-shadow:0 1px 5px rgba(23,60,99,.04)}
        .rg-card-title{font-weight:850;font-size:14px;padding:9px 12px;background:#f4f8fc;border-bottom:1px solid #d8e4ef;color:#123e73}
        .rg-card-title.red{color:#d52323;background:#fff5f5}
        .rg-summary{display:grid;grid-template-columns:repeat(3,1fr);min-height:102px;align-items:center;padding:10px 4px}
        .rg-summary-item{text-align:center;padding:4px 14px;border-right:1px solid #b9cbe0}.rg-summary-item:last-child{border-right:0}
        .rg-summary-item small{display:block;font-size:11px;color:#334e72;text-transform:uppercase}.rg-summary-item strong{display:block;font-size:31px;line-height:1.1;margin-top:7px;color:#0a2f5c}.rg-summary-item em{display:block;font-size:10px;font-style:normal;color:#64748b;margin-top:4px}
        .rg-status-table{width:100%;border-collapse:collapse}.rg-status-table td{padding:8px 12px;border-bottom:1px solid #e2e9f0;font-size:12px}.rg-status-table tr:last-child td{border-bottom:0}.rg-status-table td:last-child{text-align:center;font-size:16px;font-weight:900;width:72px}
        .rg-anulados{min-height:102px;display:grid;place-items:center;text-align:center;background:#fffafa;padding:12px}.rg-anulados small{display:block;font-size:12px}.rg-anulados strong{display:block;color:#df2525;font-size:34px;margin-top:3px}
        .rg-list{margin-top:12px}
        .rg-list-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 12px;background:#f4f8fc;border-bottom:1px solid #d8e4ef;flex-wrap:wrap}
        .rg-list-title{font-weight:900;color:#0864df;font-size:15px}.rg-list-tools{display:flex;align-items:center;gap:12px;margin-left:auto}.rg-list-meta{font-size:11px;color:#445b77;white-space:nowrap}
        .rg-search{width:min(330px,38vw);min-width:220px;border:1px solid #c7d6e5;border-radius:7px;padding:8px 10px;font-size:12px;outline:none;background:#fff}.rg-search:focus{border-color:#5398ee;box-shadow:0 0 0 3px rgba(50,128,224,.08)}
        .rg-table-wrap{overflow:auto}.rg-table{width:100%;border-collapse:collapse;min-width:1180px;font-size:11px}.rg-table th{background:#eaf4fd;color:#173b68;padding:8px 7px;border:1px solid #d6e2ed;text-align:center;font-size:10px}.rg-table td{padding:8px 9px;border:1px solid #dfe7ef;vertical-align:middle}.rg-table td.center{text-align:center}.rg-table tbody tr:hover:not(.rg-row-anulado){background:#f9fbfd}.rg-row-anulado td{background:#fff0f0;color:#e11d1d}.rg-row-anulado:hover td{background:#ffe9e9}
        .rg-badge{display:inline-block;min-width:88px;text-align:center;border-radius:6px;padding:5px 9px;font-weight:900;font-size:10px}.rg-badge.finalizado{background:#d9f5e3;color:#087a35}.rg-badge.recepcion{background:#dcebfb;color:#0865cc}.rg-badge.pendiente{background:#fff0c7;color:#c77900}.rg-badge.anulado{background:#ffd7d7;color:#db1f1f}
        .rg-empty{text-align:center!important;padding:28px!important;color:#6a7f95!important;background:#fff!important}
        .rg-bottom{margin-top:12px}.rg-resumen{padding:10px 14px 14px}.rg-resumen p{margin:7px 0;font-size:12px;color:#213f64}.rg-resumen p::before{content:"•";margin-right:9px;color:#0b63ce;font-weight:900}.rg-loading{opacity:.55}
        @media(max-width:1180px){.rg-header{grid-template-columns:1fr auto auto}.rg-brand{grid-column:1/-1}.rg-top{grid-template-columns:1fr 1fr}.rg-top .rg-card:first-child{grid-column:1/-1}.rg-update-wrap{border-left:1px solid rgba(255,255,255,.2)}}
        @media(max-width:780px){.rg-root{padding:8px}.rg-header{display:flex;flex-wrap:wrap}.rg-brand{width:100%;padding:12px}.rg-brand-copy{align-items:flex-start;flex-direction:column;gap:7px}.rg-company{border-right:0;padding-right:0}.rg-head-meta{flex:1;min-width:145px}.rg-update-wrap{width:100%}.rg-update{width:100%}.rg-top{grid-template-columns:1fr}.rg-top .rg-card:first-child{grid-column:auto}.rg-summary{grid-template-columns:1fr}.rg-summary-item{border-right:0;border-bottom:1px solid #dfe7ef;padding:10px}.rg-summary-item:last-child{border-bottom:0}.rg-list-tools{width:100%;margin-left:0;align-items:stretch;flex-direction:column}.rg-search{width:100%;min-width:0}.rg-list-meta{white-space:normal}}
      `}</style>

      <div className="rg-header">
        <div className="rg-brand">
          <div className="rg-logo">AMS</div>
          <div className="rg-brand-copy">
            <div className="rg-company">
              <b>ANALYTICA</b>
              <small>MINERAL SERVICES S.A.C.</small>
            </div>
            <div className="rg-title">
              <h1>REPORTE DE GUÍAS</h1>
              <p>CONTROL DE PROCESOS - ACOPIO</p>
            </div>
          </div>
        </div>
        <div className="rg-head-meta">
          <span>▣</span>
          <div><small>Fecha actual:</small><strong>{reloj.fecha}</strong></div>
        </div>
        <div className="rg-head-meta">
          <span>◷</span>
          <div><small>Hora actual:</small><strong>{reloj.hora}</strong></div>
        </div>
        <div className="rg-update-wrap">
          <button className="rg-update" type="button" onClick={() => void actualizar()} disabled={cargando}>
            {cargando ? "Actualizando..." : "↻  Actualizar"}
          </button>
        </div>
      </div>

      {error && <div className="rg-error">{error}</div>}

      <div className={cargando ? "rg-top rg-loading" : "rg-top"}>
        <div className="rg-card">
          <div className="rg-card-title">▣ &nbsp;Resumen general (sin anulados)</div>
          <div className="rg-summary">
            <div className="rg-summary-item">
              <small>Total vehículos</small>
              <strong>{totales.vehiculos}</strong>
            </div>
            <div className="rg-summary-item">
              <small>Total guías</small>
              <strong>{totales.guias}</strong>
              <em>{totales.grr} GRR · {totales.grt} GRT</em>
            </div>
            <div className="rg-summary-item">
              <small>Total tonelaje (TM)</small>
              <strong>{formatTonelaje(totales.tonelaje)}</strong>
            </div>
          </div>
        </div>

        <div className="rg-card">
          <div className="rg-card-title">▤ &nbsp;Estado de guías (sin anulados)</div>
          <table className="rg-status-table"><tbody>
            <tr><td>Pendiente (por llegar)</td><td>{totales.pendiente}</td></tr>
            <tr><td>Recepción (llegó)</td><td>{totales.recepcion}</td></tr>
            <tr><td>Finalizado (revisado)</td><td>{totales.finalizado}</td></tr>
          </tbody></table>
        </div>

        <div className="rg-card">
          <div className="rg-card-title red">✚ &nbsp;Guías anuladas (solo de la guardia)</div>
          <div className="rg-anulados"><div><small>Total anuladas</small><strong>{totales.anulado}</strong></div></div>
        </div>
      </div>

      <div className={cargando ? "rg-card rg-list rg-loading" : "rg-card rg-list"}>
        <div className="rg-list-head">
          <div className="rg-list-title">▤ &nbsp;Listado de guías de la guardia</div>
          <div className="rg-list-tools">
            <div className="rg-list-meta">
              Total registros: <b>{filas.length}</b>{guardiaTexto ? ` · ${guardiaTexto}` : ""}
            </div>
            <input
              className="rg-search"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar por placa, razón social, GRR, GRT..."
            />
          </div>
        </div>
        <div className="rg-table-wrap">
          <table className="rg-table">
            <thead><tr>
              <th>#</th><th>PLACA</th><th>RAZÓN SOCIAL GRR</th><th>RAZÓN SOCIAL GRT</th><th>GRR</th><th>GRT</th><th>TONELAJE<br/>(TM)</th><th>TIPO DE GUÍA</th><th>ZONA</th><th>ESTADO</th><th>OBSERVACIÓN</th>
            </tr></thead>
            <tbody>
              {filasFiltradas.map((fila, index) => (
                <tr key={fila.id || `${fila.idAtencion || "fila"}-${index}`} className={fila.anulado || texto(fila.estado).toUpperCase() === "ANULADO" ? "rg-row-anulado" : ""}>
                  <td className="center">{index + 1}</td>
                  <td><b>{texto(fila.placa) || "-"}</b></td>
                  <td>{texto(fila.razonSocialGrr) || "-"}</td>
                  <td>{texto(fila.razonSocialGrt) || "-"}</td>
                  <td className="center">{texto(fila.grr) || "-"}</td>
                  <td className="center">{texto(fila.grt) || "-"}</td>
                  <td className="center">{texto(fila.tonelaje) ? formatTonelaje(fila.tonelaje) : "-"}</td>
                  <td className="center">{texto(fila.tipoGuia) || "-"}</td>
                  <td>{texto(fila.zona) || "-"}</td>
                  <td className="center"><span className={estadoClase(fila.estado)}>{texto(fila.estado) || "PENDIENTE"}</span></td>
                  <td>{texto(fila.observacion) || "-"}</td>
                </tr>
              ))}
              {!filasFiltradas.length && <tr><td className="rg-empty" colSpan={11}>{cargando ? "Actualizando reporte..." : "No hay registros para mostrar en la guardia actual."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rg-card rg-bottom">
        <div className="rg-card-title">▤ &nbsp;Resumen del día (sin anulados)</div>
        <div className="rg-resumen">
          {(reporte.resumen || []).length
            ? (reporte.resumen || []).map((linea, i) => <p key={`${linea}-${i}`}>{linea}</p>)
            : <p>No se registran movimientos de guías en la guardia actual.</p>}
        </div>
      </div>
    </section>
  );
}
