"use client";

import { useEffect, useMemo, useState } from "react";

type AppUser = {
  user: string;
  name: string;
  role: string;
};

type Catalogos = {
  asistentes?: string[];
  conductores?: string[];
  asistentesComerciales?: string[];
  conductoresRutina?: string[];
};

type FilaCargo = {
  id: string;
  grrSerie: string;
  grrNumero: string;
  grtSerie: string;
  grtNumero: string;
  lotes: string;
  tickets: string;
  documentos: "OK" | "PENDIENTE";
  observacion: string;
  buscando?: boolean;
  error?: string;
};

type HistorialCargo = {
  numero?: string | number;
  numeroCargo?: string | number;
  fecha?: string;
  hora?: string;
  asistente?: string;
  asistenteComercial?: string;
  conductor?: string;
  estado?: string;
  items?: number;
};

const nuevaFila = (): FilaCargo => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  grrSerie: "",
  grrNumero: "",
  grtSerie: "",
  grtNumero: "",
  lotes: "",
  tickets: "",
  documentos: "OK",
  observacion: "",
});

async function api(action: string, payload: Record<string, unknown> = {}) {
  const r = await fetch("/api/sheets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.error || "No se pudo completar la operación.");
  return j.data;
}

function listaCatalogo(data: Catalogos | null, tipo: "asistente" | "conductor") {
  if (!data) return [];
  const raw =
    tipo === "asistente"
      ? data.asistentes || data.asistentesComerciales || []
      : data.conductores || data.conductoresRutina || [];
  return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
}

function valorNumero(h: HistorialCargo) {
  return h.numeroCargo ?? h.numero ?? "";
}

export default function CargoGuiasTickets({ user }: { user: AppUser }) {
  const [numero, setNumero] = useState<string>("");
  const [fechaHora, setFechaHora] = useState(new Date());
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [asistente, setAsistente] = useState(() => String(user?.name || "").trim());
  const [conductor, setConductor] = useState("");
  const [filas, setFilas] = useState<FilaCargo[]>([nuevaFila()]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [historial, setHistorial] = useState<HistorialCargo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tab, setTab] = useState<"nuevo" | "historial">("nuevo");

  const conductores = useMemo(() => listaCatalogo(catalogos, "conductor"), [catalogos]);

  async function cargarInicial() {
    setError("");
    try {
      const [n, c] = await Promise.all([
        api("cgtObtenerSiguienteNumero"),
        api("cgtObtenerCatalogos"),
      ]);
      setNumero(String(n?.numero ?? n?.siguiente ?? n ?? ""));
      setCatalogos(c || {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar Cargo - Guías y Tickets.");
    }
  }

  useEffect(() => {
    cargarInicial();
    const timer = window.setInterval(() => setFechaHora(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setAsistente(String(user?.name || "").trim());
  }, [user?.name]);

  function cambiarFila(id: string, campo: keyof FilaCargo, valor: string) {
    setFilas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [campo]: valor, error: "" } : f))
    );
  }

  async function buscarGuia(id: string) {
    const fila = filas.find((f) => f.id === id);
    if (!fila) return;

    const tieneGRR = fila.grrSerie.trim() && fila.grrNumero.trim();
    const tieneGRT = fila.grtSerie.trim() && fila.grtNumero.trim();
    if (!tieneGRR && !tieneGRT) return;

    setFilas((prev) =>
      prev.map((f) => (f.id === id ? { ...f, buscando: true, error: "" } : f))
    );

    try {
      const d = await api("cgtBuscarGuia", {
        grrSerie: fila.grrSerie.trim(),
        grrNumero: fila.grrNumero.trim(),
        grtSerie: fila.grtSerie.trim(),
        grtNumero: fila.grtNumero.trim(),
      });

      const lotes = String(d?.lotes ?? d?.lote ?? "");
      const tickets = String(d?.tickets ?? d?.ticket ?? d?.ticketPesaje ?? "");

      setFilas((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                lotes,
                tickets,
                buscando: false,
                error: !lotes && !tickets ? "No se encontraron coincidencias." : "",
              }
            : f
        )
      );
    } catch (e) {
      setFilas((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                buscando: false,
                lotes: "",
                tickets: "",
                error: e instanceof Error ? e.message : "Error al buscar la guía.",
              }
            : f
        )
      );
    }
  }

  function agregarFila() {
    setFilas((prev) => [...prev, nuevaFila()]);
  }

  function eliminarFila(id: string) {
    setFilas((prev) => (prev.length === 1 ? prev : prev.filter((f) => f.id !== id)));
  }

  function limpiar() {
    setAsistente(String(user?.name || "").trim());
    setConductor("");
    setFilas([nuevaFila()]);
    setMensaje("");
    setError("");
    cargarInicial();
  }

  async function guardar() {
    setMensaje("");
    setError("");

    if (!asistente) return setError("Selecciona Asistente Comercial 2.");
    if (!conductor) return setError("Selecciona Conductor de rutina.");

    const validas = filas.filter(
      (f) =>
        (f.grrSerie.trim() && f.grrNumero.trim()) ||
        (f.grtSerie.trim() && f.grtNumero.trim())
    );
    if (!validas.length) return setError("Registra por lo menos una GRR o GRT.");

    const incompleta = validas.find((f) => !f.lotes.trim() && !f.tickets.trim());
    if (incompleta) return setError("Hay una fila sin lote ni ticket identificado.");

    setGuardando(true);
    try {
      const data = await api("cgtGuardarCargo", {
        asistente,
        conductor,
        usuario: user?.name || user?.user || "",
        items: validas.map((f, i) => ({
          item: i + 1,
          grrSerie: f.grrSerie.trim(),
          grrNumero: f.grrNumero.trim(),
          grtSerie: f.grtSerie.trim(),
          grtNumero: f.grtNumero.trim(),
          lotes: f.lotes.trim(),
          tickets: f.tickets.trim(),
          documentos: f.documentos,
          observacion: f.observacion.trim(),
        })),
      });

      const guardado = String(data?.numero ?? data?.numeroCargo ?? numero);
      setNumero(guardado);
      setMensaje(`Cargo N.º ${guardado} guardado correctamente.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el cargo.");
    } finally {
      setGuardando(false);
    }
  }

  async function cargarHistorial() {
    setError("");
    try {
      const d = await api("cgtObtenerHistorial");
      setHistorial(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      setTab("historial");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el historial.");
    }
  }

  const historialFiltrado = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    if (!q) return historial;
    return historial.filter((h) => JSON.stringify(h).toUpperCase().includes(q));
  }, [historial, busqueda]);

  function imprimir() {
    window.print();
  }

  return (
    <section className="cgt">
      <style jsx global>{`
        .cgt{padding:4px 2px 28px;color:#152238}
        .cgt *{box-sizing:border-box}
        .cgt-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}
        .cgt-title h1{font-size:26px;margin:0 0 4px;font-weight:850;color:#12345b}
        .cgt-title p{margin:0;color:#667085}
        .cgt-actions{display:flex;gap:8px;flex-wrap:wrap}
        .cgt button{border:0;border-radius:10px;padding:10px 14px;font-weight:750;cursor:pointer}
        .cgt .primary{background:#155eef;color:white}
        .cgt .secondary{background:#eef4ff;color:#1849a9}
        .cgt .danger{background:#fff1f0;color:#b42318}
        .cgt .ghost{background:#f2f4f7;color:#344054}
        .cgt button:disabled{opacity:.55;cursor:not-allowed}
        .cgt-card{background:#fff;border:1px solid #e4e7ec;border-radius:16px;padding:18px;box-shadow:0 3px 12px rgba(16,24,40,.05);margin-bottom:16px}
        .cgt-headgrid{display:grid;grid-template-columns:160px 220px minmax(220px,1fr) minmax(220px,1fr);gap:12px}
        .cgt label{display:block;font-size:12px;font-weight:800;color:#475467;margin-bottom:6px}
        .cgt input,.cgt select,.cgt textarea{width:100%;border:1px solid #d0d5dd;border-radius:9px;padding:9px 10px;background:#fff;color:#101828;outline:none}
        .cgt input:focus,.cgt select:focus,.cgt textarea:focus{border-color:#84adff;box-shadow:0 0 0 3px #eff4ff}
        .cgt .readonly{background:#f8fafc;font-weight:700}
        .cgt-table-wrap{overflow:auto}
        .cgt table{width:100%;border-collapse:collapse;min-width:1180px}
        .cgt th{background:#f2f4f7;color:#344054;font-size:11px;text-transform:uppercase;letter-spacing:.02em;padding:9px 7px;border:1px solid #e4e7ec;text-align:center}
        .cgt td{padding:7px;border:1px solid #e4e7ec;vertical-align:top}
        .cgt td input,.cgt td select,.cgt td textarea{min-width:80px;padding:7px}
        .cgt .auto{background:#f8fafc;font-weight:750}
        .cgt .row-error{font-size:11px;color:#b42318;margin-top:4px;max-width:170px}
        .cgt .status{padding:10px 12px;border-radius:10px;margin:10px 0;font-weight:700}
        .cgt .status.ok{background:#ecfdf3;color:#027a48}
        .cgt .status.err{background:#fef3f2;color:#b42318}
        .cgt-docs{font-size:12px;color:#475467;line-height:1.55}
        .cgt-history{width:100%;border-collapse:collapse;min-width:700px}
        .cgt-history th,.cgt-history td{padding:10px;border-bottom:1px solid #eaecf0;text-align:left}
        .print-only{display:none}
        @media(max-width:950px){
          .cgt-headgrid{grid-template-columns:1fr 1fr}
          .cgt-top{flex-direction:column}
        }
        @media(max-width:600px){.cgt-headgrid{grid-template-columns:1fr}}
        @media print{
          body *{visibility:hidden!important}
          .cgt,.cgt *{visibility:visible!important}
          .cgt{position:absolute;left:0;top:0;width:100%;padding:0;color:#000}
          .no-print{display:none!important}
          .print-only{display:block!important}
          .cgt-card{box-shadow:none;border:0;padding:0}
          .cgt-title h1{text-align:center;font-size:22px;color:#000}
          .cgt-title p{text-align:center;color:#000}
          .cgt-headgrid{grid-template-columns:180px 1fr;margin:18px 0;gap:28px}
          .hide-on-print{display:none!important}
          .cgt input,.cgt select,.cgt textarea{border:0;padding:2px;background:white;appearance:none}
          .cgt table{min-width:0;font-size:9px}
          .cgt th,.cgt td{border:1px solid #000;padding:5px}
          .cgt .row-error{display:none}
          .signatures{display:grid!important;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-top:65px}
          .signature{border-top:1px solid #000;text-align:center;padding-top:8px;min-height:55px;font-size:11px}
        }
      `}</style>

      <div className="cgt-top no-print">
        <div className="cgt-title">
          <h1>Cargo - Guías y Tickets</h1>
          <p>Registro, control e impresión de guías y tickets de pesaje.</p>
        </div>
        <div className="cgt-actions">
          <button className={tab === "nuevo" ? "primary" : "secondary"} onClick={() => setTab("nuevo")}>Nuevo cargo</button>
          <button className={tab === "historial" ? "primary" : "secondary"} onClick={cargarHistorial}>Historial</button>
        </div>
      </div>

      {error && <div className="status err no-print">{error}</div>}
      {mensaje && <div className="status ok no-print">{mensaje}</div>}

      {tab === "nuevo" ? (
        <>
          <div className="cgt-card">
            <div className="cgt-title print-only">
              <h1>CARGO - GUÍAS Y TICKETS</h1>
              <p>ANALYTICA MINERAL SERVICES S.A.C.</p>
            </div>

            <div className="cgt-headgrid">
              <div className="print-head-cargo">
                <label>N.º CARGO</label>
                <input className="readonly" value={numero} readOnly />
              </div>
              <div className="print-head-date">
                <label>FECHA Y HORA</label>
                <input className="readonly" value={fechaHora.toLocaleString("es-PE")} readOnly />
              </div>
              <div className="hide-on-print">
                <label>ASISTENTE COMERCIAL 2</label>
                <input className="readonly" value={asistente} readOnly />
              </div>
              <div className="hide-on-print">
                <label>CONDUCTOR DE RUTINA</label>
                <select value={conductor} onChange={(e) => setConductor(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {conductores.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="cgt-card">
            <div className="cgt-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th rowSpan={2}>ITEM</th>
                    <th colSpan={2}>GRR</th>
                    <th colSpan={2}>GRT</th>
                    <th rowSpan={2}>LOTES</th>
                    <th rowSpan={2}>TICKET DE PESAJE</th>
                    <th rowSpan={2}>DOCUMENTOS ADJUNTOS</th>
                    <th rowSpan={2}>OBSERVACIÓN</th>
                    <th rowSpan={2} className="no-print">ACCIÓN</th>
                  </tr>
                  <tr>
                    <th>SERIE 1</th><th>N.º 1</th><th>SERIE 2</th><th>N.º 2</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={f.id}>
                      <td style={{textAlign:"center",fontWeight:800}}>{i + 1}</td>
                      <td><input value={f.grrSerie} onChange={(e)=>cambiarFila(f.id,"grrSerie",e.target.value.toUpperCase())} onBlur={()=>buscarGuia(f.id)} /></td>
                      <td><input value={f.grrNumero} onChange={(e)=>cambiarFila(f.id,"grrNumero",e.target.value)} onBlur={()=>buscarGuia(f.id)} /></td>
                      <td><input value={f.grtSerie} onChange={(e)=>cambiarFila(f.id,"grtSerie",e.target.value.toUpperCase())} onBlur={()=>buscarGuia(f.id)} /></td>
                      <td><input value={f.grtNumero} onChange={(e)=>cambiarFila(f.id,"grtNumero",e.target.value)} onBlur={()=>buscarGuia(f.id)} /></td>
                      <td>
                        <textarea className="auto" rows={2} value={f.buscando ? "Buscando..." : f.lotes} readOnly />
                        {f.error && <div className="row-error">{f.error}</div>}
                      </td>
                      <td><textarea className="auto" rows={2} value={f.buscando ? "Buscando..." : f.tickets} readOnly /></td>
                      <td>
                        <select value={f.documentos} onChange={(e)=>cambiarFila(f.id,"documentos",e.target.value)}>
                          <option value="OK">OK</option>
                          <option value="PENDIENTE">PENDIENTE</option>
                        </select>
                      </td>
                      <td><textarea rows={2} value={f.observacion} onChange={(e)=>cambiarFila(f.id,"observacion",e.target.value)} /></td>
                      <td className="no-print">
                        <button className="danger" disabled={filas.length===1} onClick={()=>eliminarFila(f.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="no-print" style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:14,flexWrap:"wrap"}}>
              <button className="secondary" onClick={agregarFila}>＋ Agregar fila</button>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="ghost" onClick={limpiar}>Limpiar</button>
                <button className="secondary" onClick={imprimir}>Imprimir cargo</button>
                <button className="primary" disabled={guardando} onClick={guardar}>{guardando ? "Guardando..." : "Guardar cargo"}</button>
              </div>
            </div>

            <div className="cgt-docs" style={{marginTop:18}}>
              <b>DOCUMENTOS:</b> SOAT, LICENCIA DE CONDUCIR, TARJETA DE PROPIEDAD, ACTA DE CONFORMIDAD, TICKET DE PESAJE, TICKET DE REVISIÓN, GRR Y GRT.
            </div>

            <div className="signatures print-only">
              <div className="signature"><b>OFICINA DE GUÍAS</b><br/>{asistente}</div>
              <div className="signature"><b>CONDUCTOR DE RUTINA</b><br/>{conductor}</div>
              <div className="signature"><b>OFICINA CHALA</b><br/><br/></div>
            </div>
          </div>
        </>
      ) : (
        <div className="cgt-card no-print">
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
            <div>
              <h2 style={{margin:0}}>Historial de cargos</h2>
              <small style={{color:"#667085"}}>{historial.length} registro(s)</small>
            </div>
            <input style={{maxWidth:340}} placeholder="Buscar cargo, asistente, conductor..." value={busqueda} onChange={(e)=>setBusqueda(e.target.value)} />
          </div>
          <div style={{overflow:"auto"}}>
            <table className="cgt-history">
              <thead><tr><th>N.º Cargo</th><th>Fecha</th><th>Asistente Comercial 2</th><th>Conductor</th><th>Ítems</th><th>Estado</th></tr></thead>
              <tbody>
                {historialFiltrado.map((h, i) => (
                  <tr key={`${valorNumero(h)}-${i}`}>
                    <td><b>{String(valorNumero(h))}</b></td>
                    <td>{[h.fecha,h.hora].filter(Boolean).join(" ")}</td>
                    <td>{h.asistenteComercial || h.asistente || ""}</td>
                    <td>{h.conductor || ""}</td>
                    <td>{h.items ?? ""}</td>
                    <td>{h.estado || ""}</td>
                  </tr>
                ))}
                {!historialFiltrado.length && <tr><td colSpan={6} style={{textAlign:"center",color:"#667085"}}>No hay registros para mostrar.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
