"use client";

export type AppView = "registro" | "hoy" | "pendientes" | "buscar" | "personas" | "cargos" | "buscarSalidas" | "guias";
export type GuiasSection = "registrar" | "historial" | "indicadores" | "sacos";
export type ModuleName = "atencion" | "cargos" | "guias" | "rirm";

type Props = {
  activeView: AppView; openModule: ModuleName | null; guiasSection: GuiasSection; pendingCount: number;
  setOpenModule: (v: ModuleName | null) => void;
  nuevo: () => void; hoy: () => void; pendientes: () => void; buscar: () => void; clientes: () => void;
  registrarSalida: () => void; buscarSalidas: () => void; abrirGuias: (s: GuiasSection) => void;
};

export default function SidebarMenu(p: Props) {
  const toggle=(m:ModuleName)=>p.setOpenModule(p.openModule===m?null:m);
  return <nav aria-label="Navegación principal">
    <button className="nav-item" onClick={()=>toggle("atencion")}><span>{p.openModule==="atencion"?"▾":"▸"}</span> 1. ATENCIÓN AL CLIENTE</button>
    {p.openModule==="atencion" && <div style={{paddingLeft:12}}>
      <button className={p.activeView==="registro"?"nav-item active":"nav-item"} onClick={p.nuevo}><span>➕</span> Nuevo ingreso</button>
      <button className={p.activeView==="hoy"?"nav-item active":"nav-item"} onClick={p.hoy}><span>📊</span> Reporte diario</button>
      <button className={p.activeView==="pendientes"?"nav-item active":"nav-item"} onClick={p.pendientes}><span>🕘</span> Por regularizar {p.pendingCount>0&&<b>{p.pendingCount}</b>}</button>
      <button className={p.activeView==="buscar"?"nav-item active":"nav-item"} onClick={p.buscar}><span>🔎</span> Buscar</button>
      <button className={p.activeView==="personas"?"nav-item active":"nav-item"} onClick={p.clientes}><span>👥</span> BD Clientes</button>
    </div>}
    <button className="nav-item" onClick={()=>toggle("cargos")}><span>{p.openModule==="cargos"?"▾":"▸"}</span> 2. CARGOS Y SALIDAS</button>
    {p.openModule==="cargos" && <div style={{paddingLeft:12}}>
      <button className={p.activeView==="cargos"?"nav-item active":"nav-item"} onClick={p.registrarSalida}><span>📤</span> Registrar salida</button>
      <button className={p.activeView==="buscarSalidas"?"nav-item active":"nav-item"} onClick={p.buscarSalidas}><span>🔎</span> Buscar salidas</button>
    </div>}
    <button className="nav-item" onClick={()=>toggle("guias")}><span>{p.openModule==="guias"?"▾":"▸"}</span> 3. REGISTRO DE GUÍAS</button>
    {p.openModule==="guias" && <div style={{paddingLeft:12}}>
      <button className={p.activeView==="guias"&&p.guiasSection==="registrar"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("registrar")}><span>📝</span> Registrar</button>
      <button className={p.activeView==="guias"&&p.guiasSection==="historial"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("historial")}><span>📋</span> Historial de registros</button>
      <button className={p.activeView==="guias"&&p.guiasSection==="indicadores"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("indicadores")}><span>📊</span> Indicadores</button>
      <button className={p.activeView==="guias"&&p.guiasSection==="sacos"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("sacos")}><span>📦</span> Registro de Sacos Mineros</button>
    </div>}
    <button className="nav-item" onClick={()=>toggle("rirm")}><span>{p.openModule==="rirm"?"▾":"▸"}</span> 4. REGISTRO RI-RM</button>
  </nav>;
}
