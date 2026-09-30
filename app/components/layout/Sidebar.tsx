por que no aparece los accesos 
Código pegado: js(20260930-214306)
Archivo
ATENCION-AL-CLIENTE-main.zip
Archivo zip
asi?

Sí, ya revisé la rama correcta refactor-estructura-app directamente en GitHub, y encontré el motivo de por qué siguen sin aparecer los accesos.

El problema ya no está en page.tsx. Ahí sí existe la lógica para trabajar con permisos.

El problema está en:

app/components/layout/Sidebar.tsx

Ese archivo está buscando claves que no existen en tu hoja USUARIOS.

Por ejemplo, ahora busca:

ATENCION_NUEVO
ATENCION_REPORTE
ATENCION_REGULARIZAR
ATENCION_BUSCAR
ATENCION_CLIENTES

SALIDA_REGISTRAR
SALIDA_BUSCAR

GUIA_REGISTRAR
GUIA_HISTORIAL
GUIA_INDICADORES
GUIA_SACOS

Pero tu hoja tiene:

Nuevo ingreso
Reporte diario
Por regularizar
Buscar
B CLIENTES

Registrar salida
Buscar salidas

Registrar
Historial de registros
Indicadores
Registro de Sacos Mineros

Por eso Sidebar.tsx evalúa todo como false y no muestra el menú.

La corrección correcta

Hay que modificar también:

app/components/layout/Sidebar.tsx

para que use exactamente tus encabezados reales de USUARIOS.

Y hay un segundo ajuste: para RI-RM está buscando:

RI_RM
RI RM
RIRM

pero tu encabezado real es:

REGISTRO RI-RM

Así que también falla ese módulo.

Entonces ahora sí

Los archivos que deben quedar corregidos en la rama:

refactor-estructura-app

son:

app/page.tsx
app/components/layout/Sidebar.tsx

El page.tsx que ya subiste está bien; falta corregir Sidebar.tsx.

Si quieres, te preparo ahora mismo el Sidebar.tsx corregido exacto para tu hoja USUARIOS, y solo reemplazas ese archivo.

"use client";

export type AppView = "registro" | "hoy" | "pendientes" | "buscar" | "personas" | "cargos" | "buscarSalidas" | "guias" | "rirm" | "admin";
export type GuiasSection = "registrar" | "historial" | "indicadores" | "sacos";
export type RirmSection = "pendientes" | "nueva-solicitud" | "mis-solicitudes" | "historial-buscar";
export type AdminSection = "panel" | "usuarios" | "registros" | "catalogos" | "auditoria";
export type ModuleName = "atencion" | "cargos" | "guias" | "rirm" | "admin";

type Props = {
  activeView: AppView; openModule: ModuleName | null; guiasSection: GuiasSection;
  rirmSection: RirmSection; adminSection: AdminSection; pendingCount: number; isAdmin: boolean;
  permissions?: Record<string, boolean>;
  setOpenModule: (v: ModuleName | null) => void;
  nuevo: () => void; hoy: () => void; pendientes: () => void; buscar: () => void; clientes: () => void;
  registrarSalida: () => void; buscarSalidas: () => void; abrirGuias: (s: GuiasSection) => void;
  abrirRirm: (s: RirmSection) => void; abrirAdmin: (s: AdminSection) => void;
};

const Icon=({children,tone="blue"}:{children:string;tone?:string}) =>
  <span className={nav-graphic tone-${tone}} aria-hidden="true">{children}</span>;

function norm(v:string){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"_").replace(/^_+|_+$/g,"");
}

export default function SidebarMenu(p: Props) {
  const toggle=(m:ModuleName)=>p.setOpenModule(p.openModule===m?null:m);
  const perms=p.permissions||{};
  const can=(...keys:string[])=>{
    if(p.isAdmin) return true;
    const normalized:Record<string,boolean>={};
    Object.entries(perms).forEach(([k,v])=>{ normalized[norm(k)]=Boolean(v); });
    return keys.some(k=>normalized[norm(k)]===true);
  };

  const aNuevo=can("ATENCION_NUEVO");
  const aReporte=can("ATENCION_REPORTE");
  const aRegularizar=can("ATENCION_REGULARIZAR");
  const aBuscar=can("ATENCION_BUSCAR");
  const aClientes=can("ATENCION_CLIENTES");
  const mAtencion=can("ATENCIÓN AL CLIENTE","ATENCION AL CLIENTE");
  const showAtencion=mAtencion&&(aNuevo||aReporte||aRegularizar||aBuscar||aClientes);

  const sRegistrar=can("SALIDA_REGISTRAR");
  const sBuscar=can("SALIDA_BUSCAR");
  const mCargos=can("CARGOS Y SALIDAS");
  const showCargos=mCargos&&(sRegistrar||sBuscar);

  const gRegistrar=can("GUIA_REGISTRAR");
  const gHistorial=can("GUIA_HISTORIAL");
  const gIndicadores=can("GUIA_INDICADORES");
  const gSacos=can("GUIA_SACOS");
  const mGuias=can("REGISTRO DE GUÍAS","REGISTRO DE GUIAS");
  const showGuias=mGuias&&(gRegistrar||gHistorial||gIndicadores||gSacos);

  const rModulo=can("RI_RM","RI RM","RIRM");
  const rPendientes=can("PENDIENTES","RI_RM_PENDIENTES");
  const rNueva=can("NUEVA SOLICITUD","NUEVA_SOLICITUD","RI_RM_NUEVA_SOLICITUD");
  const rMis=can("MIS SOLICITUDES","MIS_SOLICITUDES","RI_RM_MIS_SOLICITUDES");
  const rHistorial=can("HISTORIAL / BUSCAR","HISTORIAL_BUSCAR","RI_RM_HISTORIAL_BUSCAR");
  const showRirm=rModulo&&(rPendientes||rNueva||rMis||rHistorial);

  return <nav className="ams-nav" aria-label="Navegación principal">
    {showAtencion && <div className={module-block${p.openModule==="atencion"?" expanded":""}}>
      <button className="module-trigger" onClick={()=>toggle("atencion")}><Icon tone="cyan">👥</Icon><span>1. ATENCIÓN AL CLIENTE</span><b>{p.openModule==="atencion"?"⌃":"⌄"}</b></button>
      {p.openModule==="atencion" && <div className="module-children">
        {aNuevo && <button className={p.activeView==="registro"?"nav-item active":"nav-item"} onClick={p.nuevo}><Icon>➕</Icon><span>Nuevo ingreso</span></button>}
        {aReporte && <button className={p.activeView==="hoy"?"nav-item active":"nav-item"} onClick={p.hoy}><Icon tone="cyan">📊</Icon><span>Reporte diario</span></button>}
        {aRegularizar && <button className={p.activeView==="pendientes"?"nav-item active":"nav-item"} onClick={p.pendientes}><Icon tone="orange">🕘</Icon><span>Por regularizar</span>{p.pendingCount>0&&<b className="nav-count">{p.pendingCount}</b>}</button>}
        {aBuscar && <button className={p.activeView==="buscar"?"nav-item active":"nav-item"} onClick={p.buscar}><Icon>🔎</Icon><span>Buscar</span></button>}
        {aClientes && <button className={p.activeView==="personas"?"nav-item active":"nav-item"} onClick={p.clientes}><Icon tone="cyan">👥</Icon><span>BD Clientes</span></button>}
      </div>}
    </div>}

    {showCargos && <div className={module-block${p.openModule==="cargos"?" expanded":""}}>
      <button className="module-trigger" onClick={()=>toggle("cargos")}><Icon>📤</Icon><span>2. CARGOS Y SALIDAS</span><b>{p.openModule==="cargos"?"⌃":"⌄"}</b></button>
      {p.openModule==="cargos" && <div className="module-children">
        {sRegistrar && <button className={p.activeView==="cargos"?"nav-item active":"nav-item"} onClick={p.registrarSalida}><Icon>📤</Icon><span>Registrar salida</span></button>}
        {sBuscar && <button className={p.activeView==="buscarSalidas"?"nav-item active":"nav-item"} onClick={p.buscarSalidas}><Icon tone="cyan">🔎</Icon><span>Buscar salidas</span></button>}
      </div>}
    </div>}

    {showGuias && <div className={module-block${p.openModule==="guias"?" expanded":""}}>
      <button className="module-trigger" onClick={()=>toggle("guias")}><Icon tone="cyan">📋</Icon><span>3. REGISTRO DE GUÍAS</span><b>{p.openModule==="guias"?"⌃":"⌄"}</b></button>
      {p.openModule==="guias" && <div className="module-children">
        {gRegistrar && <button className={p.activeView==="guias"&&p.guiasSection==="registrar"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("registrar")}><Icon>📝</Icon><span>Registrar</span></button>}
        {gHistorial && <button className={p.activeView==="guias"&&p.guiasSection==="historial"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("historial")}><Icon tone="cyan">📋</Icon><span>Historial de registros</span></button>}
        {gIndicadores && <button className={p.activeView==="guias"&&p.guiasSection==="indicadores"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("indicadores")}><Icon tone="orange">📊</Icon><span>Indicadores</span></button>}
        {gSacos && <button className={p.activeView==="guias"&&p.guiasSection==="sacos"?"nav-item active":"nav-item"} onClick={()=>p.abrirGuias("sacos")}><Icon tone="gold">📦</Icon><span>Registro de Sacos Mineros</span></button>}
      </div>}
    </div>}

    {showRirm && <div className={module-block${p.openModule==="rirm"?" expanded":""}}>
      <button className="module-trigger" onClick={()=>toggle("rirm")}><Icon tone="orange">⚗</Icon><span>4. REGISTRO RI-RM</span><b>{p.openModule==="rirm"?"⌃":"⌄"}</b></button>
      {p.openModule==="rirm" && <div className="module-children">
        {rPendientes && <button className={p.activeView==="rirm"&&p.rirmSection==="pendientes"?"nav-item active":"nav-item"} onClick={()=>p.abrirRirm("pendientes")}><Icon tone="orange">🕘</Icon><span>Pendientes</span></button>}
        {rNueva && <button className={p.activeView==="rirm"&&p.rirmSection==="nueva-solicitud"?"nav-item active":"nav-item"} onClick={()=>p.abrirRirm("nueva-solicitud")}><Icon>➕</Icon><span>Nueva solicitud</span></button>}
        {rMis && <button className={p.activeView==="rirm"&&p.rirmSection==="mis-solicitudes"?"nav-item active":"nav-item"} onClick={()=>p.abrirRirm("mis-solicitudes")}><Icon tone="cyan">📋</Icon><span>Mis solicitudes</span></button>}
        {rHistorial && <button className={p.activeView==="rirm"&&p.rirmSection==="historial-buscar"?"nav-item active":"nav-item"} onClick={()=>p.abrirRirm("historial-buscar")}><Icon>🔎</Icon><span>Historial / Buscar</span></button>}
      </div>}
    </div>}

    {p.isAdmin && <div className={module-block${p.openModule==="admin"?" expanded":""}}>
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

Ya tengo el Sidebar.tsx corregido, pero no pude escribirlo directamente en GitHub porque la integración tiene acceso de lectura y GitHub devolvió 403: sin permiso para modificar el repositorio.

La corrección exacta es reemplazar estas claves actuales:

const aNuevo=can("ATENCION_NUEVO");
const aReporte=can("ATENCION_REPORTE");
const aRegularizar=can("ATENCION_REGULARIZAR");
const aBuscar=can("ATENCION_BUSCAR");
const aClientes=can("ATENCION_CLIENTES");

const sRegistrar=can("SALIDA_REGISTRAR");
const sBuscar=can("SALIDA_BUSCAR");

const gRegistrar=can("GUIA_REGISTRAR");
const gHistorial=can("GUIA_HISTORIAL");
const gIndicadores=can("GUIA_INDICADORES");
const gSacos=can("GUIA_SACOS");

const rModulo=can("RI_RM","RI RM","RIRM");

por estas:

const aNuevo=can("Nuevo ingreso");
const aReporte=can("Reporte diario");
const aRegularizar=can("Por regularizar");
const aBuscar=can("Buscar");
const aClientes=can("B CLIENTES","BD Clientes");
const mAtencion=can("ATENCION AL CLIENTE","ATENCIÓN AL CLIENTE");

const sRegistrar=can("Registrar salida");
const sBuscar=can("Buscar salidas");
const mCargos=can("CARGOS Y SALIDAS");

const gRegistrar=can("Registrar");
const gHistorial=can("Historial de registros");
const gIndicadores=can("Indicadores");
const gSacos=can("Registro de Sacos Mineros");
const mGuias=can("REGISTRO DE GUIAS","REGISTRO DE GUÍAS");

const rModulo=can("REGISTRO RI-RM");
const rPendientes=can("Pendientes");
const rNueva=can("Nueva solicitud");
const rMis=can("Mis solicitudes");
const rHistorial=can("Historial / Buscar");

El archivo que debes editar es:

app/components/layout/Sidebar.tsx

en la rama:

refactor-estructura-app

Después haz commit y Cloudflare debería recompilar solo.
Luego cierra sesión y vuelve a entrar con CESAR para que tome los permisos nuevos.

ya te di mi codigo corrigelo tu

Sí. Ya te lo corregí completo sobre tu mismo código.

Descarga este archivo y reemplaza el actual:

Descargar Sidebar.tsx corregido

Ruta donde debes reemplazarlo en GitHub:

app/components/layout/Sidebar.tsx

En la rama:

refactor-estructura-app

Este archivo ya usa los nombres reales de tu hoja USUARIOS, por ejemplo:

Nuevo ingreso
Reporte diario
Buscar
B CLIENTES
CARGOS Y SALIDAS
Registrar salida
Buscar salidas
REGISTRO DE GUIAS
Registrar
Historial de registros
REGISTRO RI-RM
Pendientes
Nueva solicitud
Mis solicitudes
Historial / Buscar

Después de subirlo, espera que Cloudflare compile y luego cierra sesión y vuelve a entrar. 

Sidebar.tsx
Código

Biblioteca
/
Sidebar.tsx
999
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
"use client";


export type AppView = "registro" | "hoy" | "pendientes" | "buscar" | "personas" | "cargos" | "buscarSalidas" | "guias" | "rirm" | "admin";
export type GuiasSection = "registrar" | "historial" | "indicadores" | "sacos";
export type RirmSection = "pendientes" | "nueva-solicitud" | "mis-solicitudes" | "historial-buscar";
export type AdminSection = "panel" | "usuarios" | "registros" | "catalogos" | "auditoria";
export type ModuleName = "atencion" | "cargos" | "guias" | "rirm" | "admin";


type Props = {
  activeView: AppView; openModule: ModuleName | null; guiasSection: GuiasSection;
  rirmSection: RirmSection; adminSection: AdminSection; pendingCount: number; isAdmin: boolean;
  permissions?: Record<string, boolean>;
  setOpenModule: (v: ModuleName | null) => void;
  nuevo: () => void; hoy: () => void; pendientes: () => void; buscar: () => void; clientes: () => void;
  registrarSalida: () => void; buscarSalidas: () => void; abrirGuias: (s: GuiasSection) => void;
  abrirRirm: (s: RirmSection) => void; abrirAdmin: (s: AdminSection) => void;
};


const Icon=({children,tone="blue"}:{children:string;tone?:string}) =>
  <span className={`nav-graphic tone-${tone}`} aria-hidden="true">{children}</span>;


function norm(v:string){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"_").replace(/^_+|_+$/g,"");
}


export default function SidebarMenu(p: Props) {
  const toggle=(m:ModuleName)=>p.setOpenModule(p.openModule===m?null:m);
  const perms=p.permissions||{};
  const can=(...keys:string[])=>{
    if(p.isAdmin) return true;
    const normalized:Record<string,boolean>={};
    Object.entries(perms).forEach(([k,v])=>{ normalized[norm(k)]=Boolean(v); });
    return keys.some(k=>normalized[norm(k)]===true);
  };


  // Encabezados reales de la hoja USUARIOS
  const aNuevo=can("Nuevo ingreso");
  const aReporte=can("Reporte diario");
  const aRegularizar=can("Por regularizar");
  const aBuscar=can("Buscar");
  const aClientes=can("B CLIENTES","BD Clientes");
  const mAtencion=can("ATENCION AL CLIENTE","ATENCIÓN AL CLIENTE");
  const showAtencion=mAtencion&&(aNuevo||aReporte||aRegularizar||aBuscar||aClientes);


  const sRegistrar=can("Registrar salida");
  const sBuscar=can("Buscar salidas");
  const mCargos=can("CARGOS Y SALIDAS");
  const showCargos=mCargos&&(sRegistrar||sBuscar);


  const gRegistrar=can("Registrar");
  const gHistorial=can("Historial de registros");
  const gIndicadores=can("Indicadores");
  const gSacos=can("Registro de Sacos Mineros");
  const mGuias=can("REGISTRO DE GUIAS","REGISTRO DE GUÍAS");
  const showGuias=mGuias&&(gRegistrar||gHistorial||gIndicadores||gSacos);


  const rModulo=can("REGISTRO RI-RM");
  const rPendientes=can("Pendientes");
  const rNueva=can("Nueva solicitud");
  const rMis=can("Mis solicitudes");
  const rHistorial=can("Historial / Buscar");
  const showRirm=rModulo&&(rPendientes||rNueva||rMis||rHistorial);


  return <nav className="ams-nav" aria-label="Navegación principal">
    {showAtencion && <div className={`module-block${p.openModule==="atencion"?" expanded":""}`}>
      <button className="module-trigger" onClick={()=>toggle("atencion")}><Icon tone="cyan">👥</Icon><span>1. ATENCIÓN AL CLIENTE</span><b>{p.openModule==="atencion"?"⌃":"⌄"}</b></button>
