"use client";

export type AppView = "registro" | "hoy" | "pendientes" | "buscar" | "personas" | "cargos" | "buscarSalidas" | "guias" | "rirm" | "admin";
export type GuiasSection = "registrar" | "historial" | "indicadores" | "sacos";
export type RirmSection = "pendientes" | "nueva-solicitud" | "mis-solicitudes" | "historial-buscar";
export type AdminSection = "panel" | "usuarios" | "registros" | "catalogos" | "auditoria";
export type ModuleName = "atencion" | "cargos" | "guias" | "rirm" | "admin";

type Props = {
  activeView: AppView; openModule: ModuleName | null; guiasSection: GuiasSection;
  rirmSection: RirmSection; adminSection: AdminSection; pendingCount: number; isAdmin: boolean;
  setOpenModule: (v: ModuleName | null) => void;
  nuevo: () => void; hoy: () => void; pendientes: () => void; buscar: () => void; clientes: () => void;
  registrarSalida: () => void; buscarSalidas: () => void; abrirGuias: (s: GuiasSection) => void;
  abrirRirm: (s: RirmSection) => void; abrirAdmin: (s: AdminSection) => void;
};

const Icon=({children,tone="blue"}:{children:string;tone?:string}) =>
  <span className={`nav-graphic tone-${tone}`} aria-hidden="true">{children}</span>;

export default function SidebarMenu(p: Props) {
  const toggle=(m:ModuleName)=>p.setOpenModule(p.openModule===m?null:m);
  return <nav className="ams-nav" aria-label="Navegación principal">
    <div className={`module-block${p.openModule==="atencion"?" expanded":""}`}>
      <button className="module-trigger" onClick={()=>toggle("atencion")}><Icon tone="cyan">👥</Icon><span>1. ATENCIÓN AL CLIENTE</span><b>{p.openModule==="atencion"?"⌃":"⌄"}</b></button>
      {p.openModule==="atencion" && <div className="module-children">
        <button className={p.activeView==="registro"?"nav-item active":"nav-item"} onClick={p.nuevo}><Icon>➕</Icon><span>Nuevo ingreso</span></button>
        <button className={p.activeView==="hoy"?"nav-item active":"nav-item"} onClick={p.hoy}><Icon tone="cyan">📊</Icon><span>Reporte diario</span></button>
        <button className={p.activeView==="pendientes"?"nav-item active":"nav-item"} onClick={p.pendientes}><Icon tone="orange">🕘</Icon><span>Por regularizar</span>{p.pendingCount>0&&<b className="nav-count">{p.pendingCount}</b>}</button>
        <button className={p.activeView==="buscar"?"nav-item active":"nav-item"} onClick={p.buscar}><Icon>🔎</Icon><span>Buscar</span></button>
        <button className={p.activeView==="personas"?"nav-item active":"nav-item"} onClick={p.clientes}><Icon tone="cyan">👥</Icon><span>BD Clientes</span></button>
      </div>}
    </div>

    <div className={`module-block${p.openModule==="cargos"?" expanded":""}`}>
      <button className="module-trigger" onClick={()=>toggle("cargos")}><Icon>📤</Icon><span>2. CARGOS Y SALIDAS</span><b>{p.openModule==="cargos"?"⌃":"⌄"}</b></button>
      {p.openModule==="cargos" && <div className="module-children">
        <button className={p.activeView==="cargos"?"nav-item active":"nav-item"} onClick={p.registrarSalida}><Icon>📤</Icon><span>Registrar salida</span></button>
        <button className={p.activeView==="buscarSalidas"?"nav-item active":"nav-item"} onClick={p.buscarSalidas}><Icon tone="cyan">🔎</Icon><span>Buscar salidas</span></button>
      </div>}
    </div>

    <div className={`module-block${p.openModule==="guias"?" expanded":""}`}>
      <button className="module-trigger" onClick={()=>toggle("guias")}><Icon tone="cyan">📋</Icon><span>3. REGISTRO DE GUÍAS</span><b>{p.openModule==="guias"?"⌃":"⌄"}</b></button>
      {p.openModule==="guias" && <div className="module-children">
        <button className={p.activeView==="guias"&&p.guiasSection==="registrar"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("registrar")}><Icon>📝</Icon><span>Registrar</span></button>
        <button className={p.activeView==="guias"&&p.guiasSection==="historial"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("historial")}><Icon tone="cyan">📋</Icon><span>Historial de registros</span></button>
        <button className={p.activeView==="guias"&&p.guiasSection==="indicadores"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("indicadores")}><Icon tone="orange">📊</Icon><span>Indicadores</span></button>
        <button className={p.activeView==="guias"&&p.guiasSection==="sacos"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("sacos")}><Icon tone="gold">📦</Icon><span>Registro de Sacos Mineros</span></button>
      </div>}
    </div>

    <div className={`module-block${p.openModule==="rirm"?" expanded":""}`}>
      <button className="module-trigger" onClick={()=>toggle("rirm")}><Icon tone="orange">⚗</Icon><span>4. REGISTRO RI-RM</span><b>{p.openModule==="rirm"?"⌃":"⌄"}</b></button>
      {p.openModule==="rirm" && <div className="module-children">
        <button className={p.activeView==="rirm"&&p.rirmSection==="pendientes"?"nav-item active":"nav-item"} onClick={()=>p.abrirRirm("pendientes")}><Icon tone="orange">🕘</Icon><span>Pendientes</span></button>
        <button className={p.activeView==="rirm"&&p.rirmSection==="nueva-solicitud"?"nav-item active":"nav-item"} onClick={()=>p.abrirRirm("nueva-solicitud")}><Icon>➕</Icon><span>Nueva solicitud</span></button>
        <button className={p.activeView==="rirm"&&p.rirmSection==="mis-solicitudes"?"nav-item active":"nav-item"} onClick={()=>p.abrirRirm("mis-solicitudes")}><Icon tone="cyan">📋</Icon><span>Mis solicitudes</span></button>
        <button className={p.activeView==="rirm"&&p.rirmSection==="historial-buscar"?"nav-item active":"nav-item"} onClick={()=>p.abrirRirm("historial-buscar")}><Icon>🔎</Icon><span>Historial / Buscar</span></button>
      </div>}
    </div>

    {p.isAdmin && <div className={`module-block${p.openModule==="admin"?" expanded":""}`}>
      <button className="module-trigger" onClick={()=>toggle("admin")}><Icon tone="gold">⚙</Icon><span>5. ADMINISTRADOR</span><b>{p.openModule==="admin"?"⌃":"⌄"}</b></button>
      {p.openModule==="admin" && <div className="module-children">
        <button className={p.activeView==="admin"&&p.adminSection==="panel"?"nav-item active":"nav-item"} onClick={()=>p.abrirAdmin("panel")}><Icon tone="cyan">📊</Icon><span>Panel general</span></button>
        <button className={p.activeView==="admin"&&p.adminSection==="usuarios"?"nav-item active":"nav-item"} onClick={()=>p.abrirAdmin("usuarios")}><Icon>👤</Icon><span>Usuarios y accesos</span></button>
        <button className={p.activeView==="admin"&&p.adminSection==="registros"?"nav-item active":"nav-item"} onClick={()=>p.abrirAdmin("registros")}><Icon tone="orange">✎</Icon><span>Modificar / Anular</span></button>
        <button className={p.activeView==="admin"&&p.adminSection==="catalogos"?"nav-item active":"nav-item"} onClick={()=>p.abrirAdmin("catalogos")}><Icon>⚙</Icon><span>Catálogos / Config.</span></button>
        <button className={p.activeView==="admin"&&p.adminSection==="auditoria"?"nav-item active":"nav-item"} onClick={()=>p.abrirAdmin("auditoria")}><Icon tone="cyan">🔎</Icon><span>Auditoría</span></button>
      </div>}
    </div>}
  </nav>;
}
