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

const Icon=({children}:{children:string})=><span className="nav-graphic" aria-hidden="true">{children}</span>;

export default function SidebarMenu(p: Props) {
  const toggle=(m:ModuleName)=>p.setOpenModule(p.openModule===m?null:m);
  const mc=(m:ModuleName)=>`module-block module-${m}${p.openModule===m?" expanded":""}`;
  return <nav className="ams-nav" aria-label="Navegación principal">
    <div className={mc("atencion")}>
      <button className="module-trigger" onClick={()=>toggle("atencion")}><Icon>▣</Icon><span>1. ATENCIÓN AL CLIENTE</span><b>{p.openModule==="atencion"?"⌃":"⌄"}</b></button>
      {p.openModule==="atencion" && <div className="module-children">
        <button className={p.activeView==="registro"?"nav-item active":"nav-item"} onClick={p.nuevo}><Icon>▣</Icon><span>Nuevo Ingreso</span></button>
        <button className={p.activeView==="hoy"?"nav-item active":"nav-item"} onClick={p.hoy}><Icon>▥</Icon><span>Reporte de Hoy</span></button>
        <button className={p.activeView==="pendientes"?"nav-item active":"nav-item"} onClick={p.pendientes}><Icon>✎</Icon><span>Regularizar</span>{p.pendingCount>0&&<b className="nav-count">{p.pendingCount}</b>}</button>
        <button className={p.activeView==="buscar"?"nav-item active":"nav-item"} onClick={p.buscar}><Icon>⌕</Icon><span>Buscar Registros</span></button>
        <button className={p.activeView==="personas"?"nav-item active":"nav-item"} onClick={p.clientes}><Icon>♟</Icon><span>BD Clientes</span></button>
      </div>}
    </div>
    <div className={mc("cargos")}>
      <button className="module-trigger" onClick={()=>toggle("cargos")}><Icon>▣</Icon><span>2. CARGOS Y SALIDAS</span><b>{p.openModule==="cargos"?"⌃":"⌄"}</b></button>
      {p.openModule==="cargos" && <div className="module-children">
        <button className={p.activeView==="cargos"?"nav-item active":"nav-item"} onClick={p.registrarSalida}><Icon>▣</Icon><span>Registrar salida</span></button>
        <button className={p.activeView==="buscarSalidas"?"nav-item active":"nav-item"} onClick={p.buscarSalidas}><Icon>⌕</Icon><span>Buscar salidas</span></button>
      </div>}
    </div>
    <div className={mc("guias")}>
      <button className="module-trigger" onClick={()=>toggle("guias")}><Icon>▤</Icon><span>3. REGISTRO DE GUÍAS</span><b>{p.openModule==="guias"?"⌃":"⌄"}</b></button>
      {p.openModule==="guias" && <div className="module-children">
        <button className={p.activeView==="guias"&&p.guiasSection==="registrar"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("registrar")}><Icon>▣</Icon><span>Registrar guía</span></button>
        <button className={p.activeView==="guias"&&p.guiasSection==="historial"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("historial")}><Icon>▤</Icon><span>Historial de registros</span></button>
        <button className={p.activeView==="guias"&&p.guiasSection==="indicadores"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("indicadores")}><Icon>▥</Icon><span>Indicadores</span></button>
        <button className={p.activeView==="guias"&&p.guiasSection==="sacos"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("sacos")}><Icon>▣</Icon><span>Registro de Sacos Mineros</span></button>
      </div>}
    </div>
    <div className={mc("rirm")}>
      <button className="module-trigger" onClick={()=>toggle("rirm")}><Icon>△</Icon><span>4. REGISTRO RI-RM</span><b>{p.openModule==="rirm"?"⌃":"⌄"}</b></button>
    </div>
  </nav>;
}
