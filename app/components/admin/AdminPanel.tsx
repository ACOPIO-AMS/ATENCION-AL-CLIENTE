"use client";

import { useEffect, useMemo, useState } from "react";

export type AdminSection = "panel" | "usuarios" | "registros" | "catalogos" | "auditoria";
type AnyRow = Record<string, any>;
type PermisoConfig = { key: string; columna?: number };

async function adminApi(action: string, payload: AnyRow = {}) {
  const response = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor." }));
  if (!response.ok || !result.ok) throw new Error(result.error || result.message || "No se pudo completar la consulta.");
  return result.data;
}

const texto = (v:any) => String(v ?? "").trim();
function obtener(o:AnyRow,...ks:string[]) {
  for (const k of ks) if (o?.[k] !== undefined && texto(o[k]) !== "") return o[k];
  const up=ks.map(k=>k.toUpperCase());
  for (const [k,v] of Object.entries(o||{})) if(up.includes(k.toUpperCase())&&texto(v)!=="") return v;
  return "";
}
const esSi=(v:any)=>v===true||["SI","SÍ","TRUE","1","ACTIVO"].includes(texto(v).toUpperCase());

function normalizarPermiso(v: string) {
  return texto(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function etiquetaPermiso(key: string) {
  const k = normalizarPermiso(key);

  const etiquetas: Record<string, string> = {
    // ATENCIÓN AL CLIENTE
    "ATENCION AL CLIENTE": "Acceso al módulo",
    "ATENCION NUEVO": "Nuevo ingreso",
    "NUEVO INGRESO": "Nuevo ingreso",
    "ATENCION REPORTE": "Reporte diario",
    "REPORTE DIARIO": "Reporte diario",
    "ATENCION REGULARIZAR": "Por regularizar",
    "POR REGULARIZAR": "Por regularizar",
    "ATENCION BUSCAR": "Buscar",
    "BUSCAR": "Buscar",
    "ATENCION CLIENTES": "BD Clientes",
    "B CLIENTES": "BD Clientes",
    "BD CLIENTES": "BD Clientes",
    "ATENCION ESTADIA": "Estadía, Servicios y Consumos",
    "ESTADIA SERVICIOS Y CONSUMOS": "Estadía, Servicios y Consumos",
    "ATENCION SALIDA PROVEEDORES": "Salida de Proveedores",
    "SALIDA DE PROVEEDORES": "Salida de Proveedores",
    "ATENCION HABITACIONES": "Control de Habitaciones",
    "CONTROL DE HABITACIONES": "Control de Habitaciones",
    "ATENCION RESUMEN GUARDIA": "Resumen diario / guardia",
    "RESUMEN DIARIO / GUARDIA": "Resumen diario / guardia",

    // CARGOS Y SALIDAS
    "CARGOS Y SALIDAS": "Acceso al módulo",
    "CARGOS REGISTRAR": "Registrar salida",
    "SALIDA REGISTRAR": "Registrar salida",
    "REGISTRAR SALIDA": "Registrar salida",
    "CARGOS BUSCAR": "Buscar salidas",
    "SALIDA BUSCAR": "Buscar salidas",
    "BUSCAR SALIDAS": "Buscar salidas",
    "CARGOS RECEPCION": "Pendientes de recepción",
    "PENDIENTES DE RECEPCION": "Pendientes de recepción",

    // REGISTRO DE GUÍAS
    "REGISTRO DE GUIAS": "Acceso al módulo",
    "GUIAS REGISTRAR": "Registrar",
    "GUIA REGISTRAR": "Registrar",
    "REGISTRAR": "Registrar",
    "GUIAS HISTORIAL": "Historial de registros",
    "GUIA HISTORIAL": "Historial de registros",
    "HISTORIAL DE REGISTROS": "Historial de registros",
    "GUIAS INDICADORES": "Indicadores",
    "GUIA INDICADORES": "Indicadores",
    "INDICADORES": "Indicadores",
    "GUIAS SACOS": "Registro de Sacos Mineros",
    "GUIA SACOS": "Registro de Sacos Mineros",
    "REGISTRO DE SACOS MINEROS": "Registro de Sacos Mineros",
    "GUIAS CARGO": "Cargo - Guías y Tickets",
    "GUIA CARGO": "Cargo - Guías y Tickets",
    "CARGO GUIAS Y TICKETS": "Cargo - Guías y Tickets",

    // RI-RM
    "REGISTRO RI RM": "Acceso al módulo",
    "RI RM": "Acceso al módulo",
    "PENDIENTES": "Pendientes",
    "NUEVA SOLICITUD": "Nueva solicitud",
    "MIS SOLICITUDES": "Mis solicitudes",
    "HISTORIAL / BUSCAR": "Historial / Buscar",

    // ADMINISTRADOR
    "ADMINISTRADOR": "Acceso al módulo",
    "PANEL GENERAL": "Panel general",
    "USUARIOS / ACCESOS": "Usuarios / accesos",
    "MODIFICAR / ANULAR": "Modificar / Anular",
    "CATALOGOS / CONFIG.": "Catálogos / Config.",
    "CATALOGOS / CONFIG": "Catálogos / Config.",
    "AUDITORIA": "Auditoría",
  };

  return etiquetas[k] || texto(key);
}

function grupoPermiso(key: string) {
  const k = normalizarPermiso(key);

  // 1. ATENCIÓN AL CLIENTE
  if (
    k === "ATENCION AL CLIENTE" ||
    k.startsWith("ATENCION ") ||
    [
      "NUEVO INGRESO",
      "REPORTE DIARIO",
      "POR REGULARIZAR",
      "BUSCAR",
      "B CLIENTES",
      "BD CLIENTES",
      "ESTADIA SERVICIOS Y CONSUMOS",
      "SALIDA DE PROVEEDORES",
      "CONTROL DE HABITACIONES",
      "RESUMEN DIARIO / GUARDIA",
    ].includes(k)
  ) {
    return "1. ATENCIÓN AL CLIENTE";
  }

  // 2. CARGOS Y SALIDAS
  if (
    k === "CARGOS Y SALIDAS" ||
    k.startsWith("CARGOS ") ||
    k.startsWith("SALIDA ") ||
    [
      "REGISTRAR SALIDA",
      "BUSCAR SALIDAS",
      "PENDIENTES DE RECEPCION",
    ].includes(k)
  ) {
    return "2. CARGOS Y SALIDAS";
  }

  // 3. REGISTRO DE GUÍAS
  if (
    k === "REGISTRO DE GUIAS" ||
    k.startsWith("GUIAS ") ||
    k.startsWith("GUIA ") ||
    [
      "REGISTRAR",
      "HISTORIAL DE REGISTROS",
      "INDICADORES",
      "REGISTRO DE SACOS MINEROS",
      "CARGO GUIAS Y TICKETS",
    ].includes(k)
  ) {
    return "3. REGISTRO DE GUÍAS";
  }

  // 4. REGISTRO RI-RM
  if (
    k === "REGISTRO RI RM" ||
    k === "RI RM" ||
    k.startsWith("RI RM ") ||
    [
      "PENDIENTES",
      "NUEVA SOLICITUD",
      "MIS SOLICITUDES",
      "HISTORIAL / BUSCAR",
    ].includes(k)
  ) {
    return "4. REGISTRO RI-RM";
  }

  // 5. ADMINISTRADOR
  if (
    k === "ADMINISTRADOR" ||
    [
      "PANEL GENERAL",
      "USUARIOS / ACCESOS",
      "MODIFICAR / ANULAR",
      "CATALOGOS / CONFIG.",
      "CATALOGOS / CONFIG",
      "AUDITORIA",
    ].includes(k)
  ) {
    return "5. ADMINISTRADOR";
  }

  return "OTROS PERMISOS";
}

/**
 * Catálogo maestro de módulos y submódulos.
 * La UI ya no depende exclusivamente de lo que devuelva el backend:
 * - Si un permiso existe en backend, conserva su key/columna.
 * - Si falta en backend, igual se muestra con su key canónica.
 * - Cualquier permiso adicional del backend se conserva en "OTROS PERMISOS"
 *   o en el grupo que corresponda.
 */
const CATALOGO_MODULOS: Array<{ grupo: string; permisos: string[] }> = [
  {
    grupo: "1. ATENCIÓN AL CLIENTE",
    permisos: [
      "ATENCIÓN AL CLIENTE",
      "Nuevo ingreso",
      "Reporte diario",
      "Por regularizar",
      "Buscar",
      "BD Clientes",
      "Estadía, Servicios y Consumos",
      "Salida de Proveedores",
      "Control de Habitaciones",
      "Resumen diario / guardia",
    ],
  },
  {
    grupo: "2. CARGOS Y SALIDAS",
    permisos: [
      "CARGOS Y SALIDAS",
      "Registrar salida",
      "Buscar salidas",
      "Pendientes de recepción",
    ],
  },
  {
    grupo: "3. REGISTRO DE GUÍAS",
    permisos: [
      "REGISTRO DE GUÍAS",
      "Registrar",
      "Historial de registros",
      "Indicadores",
      "Registro de Sacos Mineros",
      "Cargo - Guías y Tickets",
    ],
  },
  {
    grupo: "4. REGISTRO RI-RM",
    permisos: [
      "REGISTRO RI-RM",
      "Pendientes",
      "Nueva solicitud",
      "Mis solicitudes",
      "Historial / Buscar",
    ],
  },
  {
    grupo: "5. ADMINISTRADOR",
    permisos: [
      "ADMINISTRADOR",
      "Panel general",
      "Usuarios / accesos",
      "Modificar / Anular",
      "Catálogos / Config.",
      "Auditoría",
    ],
  },
];
function construirPermisosConfig(permisosBackend: PermisoConfig[]) {
  const salida: PermisoConfig[] = [];
  const usados = new Set<number>();

  CATALOGO_MODULOS.forEach(({ grupo, permisos }) => {
    permisos.forEach((keyCanonica) => {
      const etiquetaCanonica = etiquetaPermiso(keyCanonica);
      const indice = permisosBackend.findIndex((p, i) => {
        if (usados.has(i)) return false;
        return (
          normalizarPermiso(p.key) === normalizarPermiso(keyCanonica) ||
          (grupoPermiso(p.key) === grupo && etiquetaPermiso(p.key) === etiquetaCanonica)
        );
      });

      if (indice >= 0) {
        usados.add(indice);
        salida.push(permisosBackend[indice]);
      } else {
        salida.push({ key: keyCanonica });
      }
    });
  });

  permisosBackend.forEach((p, i) => {
    if (!usados.has(i)) salida.push(p);
  });

  return salida;
}

function filtrarGrupos(
  grupos: Record<string, PermisoConfig[]>,
  busqueda: string
): Array<[string, PermisoConfig[]]> {
  const q = normalizarPermiso(busqueda);
  if (!q) return Object.entries(grupos);

  return Object.entries(grupos)
    .map(([grupo, lista]) => [
      grupo,
      lista.filter(
        (p) =>
          normalizarPermiso(etiquetaPermiso(p.key)).includes(q) ||
          normalizarPermiso(p.key).includes(q) ||
          normalizarPermiso(grupo).includes(q)
      ),
    ] as [string, PermisoConfig[]])
    .filter(([, lista]) => lista.length > 0);
}

export default function AdminPanel({section}:{section:AdminSection}) {
  const [usuarios,setUsuarios]=useState<AnyRow[]>([]);
  const [permisosBackend,setPermisosBackend]=useState<PermisoConfig[]>([]);
  const [gruposAbiertos,setGruposAbiertos]=useState<Record<string,boolean>>({"3. REGISTRO DE GUÍAS":true});
  const [buscarPermiso,setBuscarPermiso]=useState("");
  const [buscarPermisoNuevo,setBuscarPermisoNuevo]=useState("");
  const [roles,setRoles]=useState<string[]>([]);
  const [auditoria,setAuditoria]=useState<AnyRow[]>([]);
  const [cargando,setCargando]=useState(false);
  const [guardando,setGuardando]=useState(false);
  const [error,setError]=useState("");
  const [buscar,setBuscar]=useState("");
  const [usuarioEditando,setUsuarioEditando]=useState<AnyRow|null>(null);
  const [editNombre,setEditNombre]=useState("");
  const [editRol,setEditRol]=useState("");
  const [editActivo,setEditActivo]=useState(true);
  const [editPermisos,setEditPermisos]=useState<Record<string,boolean>>({});
  const [motivo,setMotivo]=useState("");
  const [mensajeModal,setMensajeModal]=useState("");
  const [nuevoAbierto,setNuevoAbierto]=useState(false);
  const [nuevoUsuario,setNuevoUsuario]=useState("");const [nuevoNombre,setNuevoNombre]=useState("");const [nuevoRol,setNuevoRol]=useState("");const [nuevoPin,setNuevoPin]=useState("");const [nuevoPermisos,setNuevoPermisos]=useState<Record<string,boolean>>({});

  // MODIFICAR / ANULAR REGISTROS
  const [moduloRegistro,setModuloRegistro]=useState<"atencion"|"cargos"|"guias"|"rirm">("atencion");
  const [busquedaRegistro,setBusquedaRegistro]=useState("");
  const [resultadosRegistro,setResultadosRegistro]=useState<AnyRow[]>([]);
  const [registroEditando,setRegistroEditando]=useState<AnyRow|null>(null);
  const [registroForm,setRegistroForm]=useState<AnyRow>({});
  const [motivoRegistro,setMotivoRegistro]=useState("");
  const [mensajeRegistro,setMensajeRegistro]=useState("");
  const [buscandoRegistro,setBuscandoRegistro]=useState(false);

  function obtenerAdminActual(){
    if(typeof window==="undefined") return "";
    for(const clave of ["usuario","user","ams_usuario","usuarioActual","currentUser"]){
      const valor=localStorage.getItem(clave); if(!valor) continue;
      try{
        const p=JSON.parse(valor);
        if(typeof p==="object"&&p){const u=texto(p.usuario||p.user||p.username||p.USUARIO);if(u)return u.toUpperCase();}
      }catch{if(texto(valor))return texto(valor).toUpperCase();}
    }
    return "";
  }

  async function cargarUsuarios(){
    setCargando(true);setError("");
    try{
      const d=await adminApi("adminUsuarios");
      setUsuarios(Array.isArray(d)?d:Array.isArray(d?.usuarios)?d.usuarios:[]);
      setPermisosBackend((Array.isArray(d?.permisos)?d.permisos:[]).map((x:any)=>typeof x==="string"?{key:x}:{key:texto(x?.key),columna:Number(x?.columna)||undefined}).filter((x:PermisoConfig)=>!!x.key));
      setRoles((Array.isArray(d?.roles)?d.roles:[]).map((x:any)=>texto(x)).filter(Boolean));
    }catch(e:any){setError(e?.message||"No se pudieron cargar los usuarios.");}finally{setCargando(false);}
  }
  async function cargarAuditoria(){
    setCargando(true);setError("");
    try{const d=await adminApi("adminAuditoria",{limite:200});setAuditoria(Array.isArray(d)?d:Array.isArray(d?.registros)?d.registros:[]);}
    catch(e:any){setError(e?.message||"No se pudo cargar la auditoría.");}finally{setCargando(false);}
  }
  useEffect(()=>{if(section==="usuarios"||section==="panel")cargarUsuarios();if(section==="auditoria")cargarAuditoria();},[section]);

  const filtrados=useMemo(()=>{const q=buscar.trim().toUpperCase();return !q?usuarios:usuarios.filter(u=>[u.usuario,u.nombre,u.rol,u.activo].some(v=>texto(v).toUpperCase().includes(q)));},[usuarios,buscar]);
  const activos=usuarios.filter(u=>esSi(u.activo)).length;
  const admins=usuarios.filter(u=>["ADMIN","ADMINISTRADOR"].includes(texto(u.rol).toUpperCase())).length;
  const permisosConfig=useMemo(()=>construirPermisosConfig(permisosBackend),[permisosBackend]);
  const grupos=useMemo(()=>{
    const g:Record<string,PermisoConfig[]>={};
    permisosConfig.forEach(p=>(g[grupoPermiso(p.key)]??=[]).push(p));
    return g;
  },[permisosConfig]);
  const gruposEditor=useMemo(()=>filtrarGrupos(grupos,buscarPermiso),[grupos,buscarPermiso]);
  const gruposNuevo=useMemo(()=>filtrarGrupos(grupos,buscarPermisoNuevo),[grupos,buscarPermisoNuevo]);

  function abrirEditor(u:AnyRow){
    const pu=u?.permisos&&typeof u.permisos==="object"?u.permisos:{};
    const ep:Record<string,boolean>={};permisosConfig.forEach(p=>ep[p.key]=esSi(pu[p.key]));
    setUsuarioEditando(u);setEditNombre(texto(obtener(u,"nombre","nombreCompleto","NOMBRE COMPLETO")));setEditRol(texto(obtener(u,"rol","ROL")));
    setEditActivo(esSi(obtener(u,"activo","ACTIVO")));setEditPermisos(ep);setBuscarPermiso("");setMotivo("");setMensajeModal("");
  }
  const cerrarEditor=()=>{if(!guardando){setUsuarioEditando(null);setMensajeModal("");setMotivo("");}};
  const cambiarPermiso=(k:string)=>setEditPermisos(p=>({...p,[k]:!p[k]}));
  function cambiarGrupo(lista:PermisoConfig[],v:boolean){setEditPermisos(p=>{const c={...p};lista.forEach(x=>c[x.key]=v);return c;});}
  function cambiarGrupoNuevo(lista:PermisoConfig[],v:boolean){setNuevoPermisos(p=>{const c={...p};lista.forEach(x=>c[x.key]=v);return c;});}
  function cambiarTodosEdit(v:boolean){setEditPermisos(p=>{const c={...p};permisosConfig.forEach(x=>c[x.key]=v);return c;});}
  function cambiarTodosNuevo(v:boolean){setNuevoPermisos(p=>{const c={...p};permisosConfig.forEach(x=>c[x.key]=v);return c;});}
  function toggleGrupo(g:string){setGruposAbiertos(p=>({...p,[g]:!p[g]}));}
  function cantidadActivos(lista:PermisoConfig[], mapa:Record<string,boolean>){return lista.filter(p=>!!mapa[p.key]).length;}

  function renderSelectorPermisos(modo:"editar"|"nuevo"){
    const esEditor=modo==="editar";
    const mapa=esEditor?editPermisos:nuevoPermisos;
    const listaGrupos=esEditor?gruposEditor:gruposNuevo;
    const valorBusqueda=esEditor?buscarPermiso:buscarPermisoNuevo;
    const setBusqueda=esEditor?setBuscarPermiso:setBuscarPermisoNuevo;
    const totalActivos=cantidadActivos(permisosConfig,mapa);
    const todos=permisosConfig.length>0&&totalActivos===permisosConfig.length;

    return <div style={{marginTop:14}}>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:12}}>
        <input
          value={valorBusqueda}
          onChange={e=>setBusqueda(e.target.value)}
          placeholder="Buscar módulo o permiso..."
          style={{minHeight:42,flex:"1 1 260px",border:"1px solid #cbd9d6",borderRadius:8,padding:"8px 11px"}}
        />
        <div style={{padding:"9px 11px",background:"#eef7f5",borderRadius:8,fontWeight:900}}>
          {totalActivos}/{permisosConfig.length} habilitados
        </div>
        <button
          type="button"
          style={btn}
          onClick={()=>esEditor?cambiarTodosEdit(!todos):cambiarTodosNuevo(!todos)}
        >
          {todos?"Quitar todos los accesos":"Dar todos los accesos"}
        </button>
      </div>

      {listaGrupos.map(([g,l])=>{
        const listaCompleta=grupos[g]||l;
        const activosGrupo=cantidadActivos(listaCompleta,mapa);
        const todoGrupo=listaCompleta.length>0&&activosGrupo===listaCompleta.length;
        const abierto=!!valorBusqueda||!!gruposAbiertos[g];

        return <div key={g} style={{...card,marginBottom:10,padding:0,overflow:"hidden"}}>
          <div
            style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"12px 14px",background:abierto?"#f7fbfa":"#fff",cursor:"pointer"}}
            onClick={()=>toggleGrupo(g)}
          >
            <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
              <span style={{fontSize:15,fontWeight:900,width:18}}>{abierto?"▾":"▸"}</span>
              <div>
                <b>{g}</b>
                <div style={{fontSize:12,marginTop:2,opacity:.72}}>{activosGrupo}/{listaCompleta.length} permisos habilitados</div>
              </div>
            </div>
            <button
              type="button"
              style={{...btn,padding:"7px 10px",whiteSpace:"nowrap"}}
              onClick={e=>{
                e.stopPropagation();
                esEditor?cambiarGrupo(listaCompleta,!todoGrupo):cambiarGrupoNuevo(listaCompleta,!todoGrupo);
              }}
            >
              {todoGrupo?"Quitar módulo":"Dar todo el módulo"}
            </button>
          </div>

          {abierto&&<div style={{padding:"0 14px 4px"}}>
            {l.map(p=><label key={p.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:"10px 2px",borderTop:"1px solid #edf2f0",cursor:"pointer"}}>
              <span>{etiquetaPermiso(p.key)}</span>
              <input
                type="checkbox"
                checked={!!mapa[p.key]}
                onChange={()=>esEditor?cambiarPermiso(p.key):setNuevoPermisos(v=>({...v,[p.key]:!v[p.key]}))}
                style={{width:18,height:18}}
              />
            </label>)}
          </div>}
        </div>
      })}

      {!listaGrupos.length&&<div style={{padding:12,background:"#fff8e1",borderRadius:8}}>
        No se encontraron módulos o permisos con esa búsqueda.
      </div>}

      {!permisosBackend.length&&<div style={{padding:12,marginTop:10,background:"#fff8e1",borderRadius:8}}>
        El backend no devolvió el catálogo de permisos. Se está mostrando el catálogo maestro del sistema.
      </div>}
    </div>;
  }

  function abrirNuevo(){const x:Record<string,boolean>={};permisosConfig.forEach(p=>x[p.key]=false);setNuevoPermisos(x);setNuevoUsuario("");setNuevoNombre("");setNuevoRol(roles[0]||"");setNuevoPin("");setBuscarPermisoNuevo("");setMotivo("");setMensajeModal("");setNuevoAbierto(true)}
  async function crearUsuario(){if(!nuevoUsuario.trim()||!nuevoNombre.trim()||!nuevoRol.trim()||!nuevoPin.trim())return setMensajeModal("Completa usuario, nombre, rol y PIN.");if(!/^\d{4,8}$/.test(nuevoPin.trim()))return setMensajeModal("El PIN debe tener entre 4 y 8 números.");if(!motivo.trim())return setMensajeModal("Indique el motivo de creación.");const adminUsuario=obtenerAdminActual();if(!adminUsuario)return setMensajeModal("No se pudo identificar la sesión del administrador.");const permisos:Record<string,string>={};permisosConfig.forEach(p=>permisos[p.key]=nuevoPermisos[p.key]?"SI":"NO");setGuardando(true);try{const r=await adminApi("adminGuardarUsuario",{accion:"CREAR",adminUsuario,datos:{usuario:nuevoUsuario.trim(),nombre:nuevoNombre.trim(),rol:nuevoRol.trim(),pin:nuevoPin.trim(),activo:"SI",permisos,motivo:motivo.trim()}});setMensajeModal(texto(r?.message)||"Usuario creado correctamente.");await cargarUsuarios();setTimeout(()=>setNuevoAbierto(false),700)}catch(e:any){setMensajeModal(e?.message||"No se pudo crear el usuario.")}finally{setGuardando(false)}}

  async function guardarAccesos(){
    if(!usuarioEditando)return;
    const usuario=texto(obtener(usuarioEditando,"usuario","USUARIO"));
    if(!usuario)return setMensajeModal("No se pudo identificar el usuario.");
    if(!editNombre.trim())return setMensajeModal("El nombre completo es obligatorio.");
    if(!editRol.trim())return setMensajeModal("Debe seleccionar un rol.");
    if(!motivo.trim())return setMensajeModal("Indique el motivo del cambio.");
    const adminUsuario=obtenerAdminActual();
    if(!adminUsuario)return setMensajeModal("No se pudo identificar la sesión del administrador.");
    const permisos:Record<string,string>={};permisosConfig.forEach(p=>permisos[p.key]=editPermisos[p.key]?"SI":"NO");
    setGuardando(true);setMensajeModal("");
    try{
      const r=await adminApi("adminGuardarUsuario",{accion:"EDITAR",usuario,adminUsuario,cambios:{nombre:editNombre.trim(),rol:editRol.trim(),activo:editActivo?"SI":"NO",permisos,motivo:motivo.trim()}});
      setMensajeModal(texto(r?.message)||"Cambios guardados correctamente.");await cargarUsuarios();setTimeout(()=>setUsuarioEditando(null),700);
    }catch(e:any){setMensajeModal(e?.message||"No se pudieron guardar los cambios.");}finally{setGuardando(false);}
  }


  const cfgRegistro:Record<string,AnyRow>={
    atencion:{
      titulo:"1. Atención al Cliente",buscar:"adminBuscarRegistroAtencion",modificar:"adminModificarRegistroAtencion",anular:"adminAnularRegistroAtencion",
      placeholder:"ID, DNI, placa, nombre o código",
      columnas:[["id","ID"],["placa","PLACA"],["nombre","PERSONA"],["codigo","CÓDIGO"],["fechaHora","FECHA / HORA"],["zona","ZONA"]],
      campos:[["fechaHora","Fecha / hora"],["motivo","Motivo de ingreso"],["placa","Placa"],["zona","Zona"],["guardia","Guardia"],["turno","Turno"],["responsable","Responsable"]]
    },
    cargos:{
      titulo:"2. Cargos y Salidas",buscar:"adminBuscarRegistroCargos",modificar:"adminModificarRegistroCargos",anular:"adminAnularRegistroCargos",
      placeholder:"Correlativo, código, conductor o descripción",
      columnas:[["correlativo","N°"],["tipo","TIPO"],["codigo","CÓDIGO"],["conductor","CONDUCTOR"],["fechaHora","FECHA / HORA"],["estadoAdmin","ESTADO"]],
      campos:[] as any[]
    },
    guias:{
      titulo:"3. Registro de Guías",buscar:"adminBuscarRegistroGuias",modificar:"adminModificarRegistroGuias",anular:"adminAnularRegistroGuias",
      placeholder:"Código o número de lote, ej. 69128",
      columnas:[["codigo","CÓDIGO"],["id","ID"],["placa","PLACA"],["proveedor","PROVEEDOR"],["numeroLotes","N° LOTES"],["condicionLote","CONDICIÓN"]],
      campos:[["id","ID"],["placa","Placa"],["dniProveedor","DNI proveedor"],["proveedor","Proveedor"],["numeroLotes","N° lotes"],["codigo","Código de lote"],["recepcion","Recepción"],["inicioRevision","Inicio revisión"],["serieGRR","Serie GRR"],["numeroGRR","Número GRR"],["serieGRT","Serie GRT"],["numeroGRT","Número GRT"],["finalRevision","Final revisión"],["condicionLote","Condición del lote"]]
    },
    rirm:{
      titulo:"4. Registro RI-RM",buscar:"adminBuscarRegistroRirm",modificar:"adminModificarRegistroRirm",anular:"adminAnularRegistroRirm",
      placeholder:"Código, tipo, ID de ítem o solicitud",
      columnas:[["codigo","CÓDIGO"],["tipo","TIPO"],["idItem","ID ÍTEM"],["idSolicitud","SOLICITUD"],["etapaActual","ETAPA"],["estado","ESTADO"]],
      campos:[["tipo","Tipo"],["codigo","Código"],["modalidad","Modalidad"],["observacion","Observación"],["etapaActual","Etapa actual"],["subestadoActual","Subestado"],["estado","Estado"],["usuarioUltimo","Último responsable"],["pendienteRegularizacion","Pendiente regularización"]]
    }
  };

  function camposCargo(r:AnyRow){
    return r.hoja==="BD SALIDAS CARGO"
      ? [["correlativo","N°"],["tipoSalida","Tipo salida"],["descripcion","Descripción"],["motivoSalida","Motivo"],["cantidad","Cantidad"],["unidad","Unidad"],["observaciones","Observaciones"],["fechaHora","Fecha / hora"],["responsable","Atención al cliente"],["conductor","Conductor"]]
      : [["correlativo","N°"],["tipo","Tipo"],["codigo","Código"],["fechaHora","Fecha / hora"],["responsable","Atención al cliente"],["conductor","Conductor"],["observaciones","Observaciones"]];
  }

  function cambiarModuloRegistro(v:"atencion"|"cargos"|"guias"|"rirm"){
    setModuloRegistro(v);setBusquedaRegistro("");setResultadosRegistro([]);setRegistroEditando(null);setRegistroForm({});setMotivoRegistro("");setMensajeRegistro("");
  }

  async function buscarRegistro(){
    if(!busquedaRegistro.trim()){setMensajeRegistro("Ingrese un dato para buscar.");return;}
    setBuscandoRegistro(true);setMensajeRegistro("");setResultadosRegistro([]);setRegistroEditando(null);
    try{
      const d=await adminApi(cfgRegistro[moduloRegistro].buscar,{busqueda:busquedaRegistro.trim()});
      const lista=Array.isArray(d?.registros)?d.registros:[];
      setResultadosRegistro(lista);
      if(!lista.length)setMensajeRegistro("No se encontraron registros.");
    }catch(e:any){setMensajeRegistro(e?.message||"No se pudo realizar la búsqueda.");}
    finally{setBuscandoRegistro(false);}
  }

  function abrirRegistro(r:AnyRow){setRegistroEditando(r);setRegistroForm({...r});setMotivoRegistro("");setMensajeRegistro("");}
  function cambiarRegistro(campo:string,valor:string){setRegistroForm((p:AnyRow)=>({...p,[campo]:valor}));}

  function camposActuales(){
    if(!registroEditando)return [];
    return moduloRegistro==="cargos"?camposCargo(registroEditando):cfgRegistro[moduloRegistro].campos;
  }

  async function guardarRegistro(){
    if(!registroEditando)return;
    if(!motivoRegistro.trim()){setMensajeRegistro("Indique el motivo de la modificación.");return;}
    const adminUsuario=obtenerAdminActual();
    if(!adminUsuario){setMensajeRegistro("No se pudo identificar la sesión del administrador.");return;}
    const cambios:AnyRow={};
    camposActuales().forEach(([k]:string[])=>{if(texto(registroForm[k])!==texto(registroEditando[k]))cambios[k]=registroForm[k]??"";});
    if(!Object.keys(cambios).length){setMensajeRegistro("No hay cambios para guardar.");return;}
    const payload:AnyRow={adminUsuario,motivo:motivoRegistro.trim(),cambios};
    if(moduloRegistro==="atencion")payload.id=registroEditando.id;
    if(moduloRegistro==="cargos"){payload.fila=registroEditando.fila;payload.hoja=registroEditando.hoja;}
    if(moduloRegistro==="guias")payload.fila=registroEditando.fila;
    if(moduloRegistro==="rirm")payload.idItem=registroEditando.idItem;
    setGuardando(true);setMensajeRegistro("");
    try{
      const d=await adminApi(cfgRegistro[moduloRegistro].modificar,payload);
      setMensajeRegistro(texto(d?.message)||"Registro actualizado correctamente.");
      setRegistroEditando(null);setRegistroForm({});setMotivoRegistro("");
      const b=await adminApi(cfgRegistro[moduloRegistro].buscar,{busqueda:busquedaRegistro.trim()});
      setResultadosRegistro(Array.isArray(b?.registros)?b.registros:[]);
    }catch(e:any){setMensajeRegistro(e?.message||"No se pudo modificar el registro.");}
    finally{setGuardando(false);}
  }

  async function anularRegistro(){
    if(!registroEditando)return;
    if(!motivoRegistro.trim()){setMensajeRegistro("Indique el motivo de la anulación.");return;}
    const adminUsuario=obtenerAdminActual();
    if(!adminUsuario){setMensajeRegistro("No se pudo identificar la sesión del administrador.");return;}
    const ref=texto(registroEditando.codigo||registroEditando.correlativo||registroEditando.idItem||registroEditando.id)||"seleccionado";
    if(typeof window!=="undefined"&&!window.confirm(`¿Confirmas anular el registro ${ref}?\n\nEl registro NO se eliminará físicamente y quedará en Auditoría.`))return;
    const payload:AnyRow={adminUsuario,motivo:motivoRegistro.trim()};
    if(moduloRegistro==="atencion")payload.id=registroEditando.id;
    if(moduloRegistro==="cargos"){payload.fila=registroEditando.fila;payload.hoja=registroEditando.hoja;}
    if(moduloRegistro==="guias")payload.fila=registroEditando.fila;
    if(moduloRegistro==="rirm")payload.idItem=registroEditando.idItem;
    setGuardando(true);setMensajeRegistro("");
    try{
      const d=await adminApi(cfgRegistro[moduloRegistro].anular,payload);
      setMensajeRegistro(texto(d?.message)||"Registro anulado correctamente.");
      setRegistroEditando(null);setRegistroForm({});setMotivoRegistro("");
      const b=await adminApi(cfgRegistro[moduloRegistro].buscar,{busqueda:busquedaRegistro.trim()});
      setResultadosRegistro(Array.isArray(b?.registros)?b.registros:[]);
    }catch(e:any){setMensajeRegistro(e?.message||"No se pudo anular el registro.");}
    finally{setGuardando(false);}
  }

  const btn={border:"1px solid #b8ccc7",borderRadius:8,padding:"8px 12px",background:"#fff",cursor:"pointer",fontWeight:800} as const;
  const card={border:"1px solid #dce7e4",borderRadius:12,padding:14,background:"#fff"} as const;

  if(section==="panel") return <section style={{padding:"0 24px 28px"}}><div className="form-card">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><h2 style={{margin:"0 0 5px"}}>Control general</h2><p style={{margin:0}}>Administración central del sistema.</p></div><button style={btn} onClick={cargarUsuarios}>{cargando?"Actualizando...":"Actualizar"}</button></div>
    {error&&<div style={{marginTop:15,padding:12,background:"#fff3f3",borderRadius:9}}>{error}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginTop:18}}>
      {[["Usuarios",usuarios.length],["Usuarios activos",activos],["Administradores",admins],["Módulos operativos",4]].map(([t,v])=><div key={String(t)} style={card}><small style={{fontWeight:800}}>{t}</small><div style={{fontSize:28,fontWeight:900}}>{v}</div></div>)}
    </div>
  </div></section>;

  if(section==="usuarios") return <><section style={{padding:"0 24px 28px"}}><div className="form-card">
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><div><h2 style={{margin:"0 0 5px"}}>Usuarios y accesos</h2><p style={{margin:0}}>Administra usuarios, perfiles y permisos por módulo.</p></div><div style={{display:"flex",gap:8}}><button style={btn} onClick={abrirNuevo}>+ Agregar usuario</button><button style={btn} onClick={cargarUsuarios}>{cargando?"Cargando...":"Actualizar"}</button></div></div>
    <div style={{display:"flex",gap:10,margin:"18px 0 12px"}}><input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar usuario, nombre o rol" style={{minHeight:42,flex:1,border:"1px solid #cbd9d6",borderRadius:8,padding:"8px 11px"}}/><b style={{padding:10,background:"#eef7f5",borderRadius:8}}>{filtrados.length} usuario(s)</b></div>
    {error&&<div style={{padding:12,background:"#fff3f3",borderRadius:9}}>{error}</div>}
    <div style={{overflowX:"auto",border:"1px solid #d9e4e1",borderRadius:12}}><table style={{width:"100%",minWidth:1050,borderCollapse:"collapse"}}>
      <thead><tr style={{background:"#eef7f5",textAlign:"left"}}>{["USUARIO","NOMBRE COMPLETO","ROL","ESTADO","ÚLTIMO ACCESO","PERMISOS","ACCIÓN"].map(h=><th key={h} style={{padding:11,fontSize:12}}>{h}</th>)}</tr></thead>
      <tbody>{filtrados.map((u,i)=>{const pu=u?.permisos&&typeof u.permisos==="object"?u.permisos:{};const hab=permisosConfig.filter(p=>esSi(pu[p.key]));return <tr key={texto(u.usuario)||String(i)}>
        <td style={{padding:10,borderTop:"1px solid #edf2f0",fontWeight:900}}>{texto(u.usuario)||"—"}</td><td style={{padding:10,borderTop:"1px solid #edf2f0"}}>{texto(u.nombre)||"—"}</td><td style={{padding:10,borderTop:"1px solid #edf2f0"}}>{texto(u.rol)||"—"}</td>
        <td style={{padding:10,borderTop:"1px solid #edf2f0"}}><b>{esSi(u.activo)?"ACTIVO":"INACTIVO"}</b></td><td style={{padding:10,borderTop:"1px solid #edf2f0"}}>{texto(u.ultimoAcceso)||"—"}</td>
        <td style={{padding:10,borderTop:"1px solid #edf2f0",maxWidth:330}}><small>{hab.length?hab.map(p=>etiquetaPermiso(p.key)).join(" · "):"Sin permisos habilitados"}</small></td>
        <td style={{padding:10,borderTop:"1px solid #edf2f0"}}><button style={btn} onClick={()=>abrirEditor(u)}>Editar accesos</button></td></tr>})}</tbody>
    </table></div>
  </div></section>
  {nuevoAbierto&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(12,30,27,.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
    <div style={{width:"min(820px,96vw)",maxHeight:"90vh",overflowY:"auto",background:"#fff",borderRadius:16,padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div><h2 style={{margin:0}}>Agregar usuario</h2><small>Configura el perfil y los accesos por módulo.</small></div>
        <button style={btn} onClick={()=>setNuevoAbierto(false)}>×</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:16}}>
        <label><b>Usuario</b><input value={nuevoUsuario} onChange={e=>setNuevoUsuario(e.target.value.toUpperCase())} style={{width:"100%",minHeight:42,marginTop:6}}/></label>
        <label><b>Nombre completo</b><input value={nuevoNombre} onChange={e=>setNuevoNombre(e.target.value)} style={{width:"100%",minHeight:42,marginTop:6}}/></label>
        <label><b>Rol</b><select value={nuevoRol} onChange={e=>setNuevoRol(e.target.value)} style={{width:"100%",minHeight:42,marginTop:6}}>{roles.map(r=><option key={r}>{r}</option>)}</select></label>
        <label><b>PIN (4 a 8 números)</b><input type="password" inputMode="numeric" value={nuevoPin} onChange={e=>setNuevoPin(e.target.value.replace(/\D/g,"").slice(0,8))} style={{width:"100%",minHeight:42,marginTop:6}}/></label>
      </div>

      <h3 style={{marginBottom:6}}>Accesos permitidos</h3>
      <div style={{fontSize:13,opacity:.72}}>Abre un módulo y habilita solo los submódulos que necesita el usuario.</div>
      {renderSelectorPermisos("nuevo")}

      <label style={{display:"block",marginTop:14}}><b>Motivo</b><textarea value={motivo} onChange={e=>setMotivo(e.target.value)} rows={2} style={{width:"100%",marginTop:6}}/></label>
      {mensajeModal&&<div style={{padding:10,marginTop:10,background:"#f4f8f7",borderRadius:8}}>{mensajeModal}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16}}>
        <button style={btn} onClick={()=>setNuevoAbierto(false)} disabled={guardando}>Cancelar</button>
        <button className="primary-action" disabled={guardando} onClick={()=>void crearUsuario()}>{guardando?"Guardando...":"Crear usuario"}</button>
      </div>
    </div>
  </div>}
  {usuarioEditando&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(12,30,27,.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
    <div style={{width:"min(820px,96vw)",maxHeight:"90vh",overflowY:"auto",background:"#fff",borderRadius:16,padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div><h2 style={{margin:0}}>Editar accesos</h2><small>Usuario: <b>{texto(usuarioEditando.usuario)}</b></small></div>
        <button style={btn} onClick={cerrarEditor}>×</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginTop:18}}>
        <label><b>Nombre completo</b><input value={editNombre} onChange={e=>setEditNombre(e.target.value)} style={{width:"100%",minHeight:42,marginTop:6}}/></label>
        <label><b>Rol</b><select value={editRol} onChange={e=>setEditRol(e.target.value)} style={{width:"100%",minHeight:42,marginTop:6}}>{!roles.includes(editRol)&&editRol&&<option value={editRol}>{editRol}</option>}{roles.map(r=><option key={r}>{r}</option>)}</select></label>
      </div>

      <div style={{...card,marginTop:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div><b>Estado del usuario</b><div style={{fontSize:13,marginTop:3}}>{editActivo?"Puede iniciar sesión.":"Usuario bloqueado."}</div></div>
        <button style={btn} onClick={()=>setEditActivo(!editActivo)}>{editActivo?"ACTIVO":"INACTIVO"}</button>
      </div>

      <h3 style={{marginBottom:6}}>Permisos por módulo</h3>
      <div style={{fontSize:13,opacity:.72}}>Los permisos se muestran según el catálogo maestro y se completan con lo que devuelve el backend.</div>
      {renderSelectorPermisos("editar")}

      <label style={{display:"block",marginTop:14}}><b>Motivo del cambio</b><textarea value={motivo} onChange={e=>setMotivo(e.target.value)} rows={3} style={{width:"100%",marginTop:6}}/></label>
      {mensajeModal&&<div style={{padding:12,marginTop:12,background:"#f4f8f7",borderRadius:8}}>{mensajeModal}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:18}}>
        <button style={btn} onClick={cerrarEditor}>Cancelar</button>
        <button className="primary-action" onClick={guardarAccesos} disabled={guardando}>{guardando?"Guardando...":"Guardar cambios"}</button>
      </div>
    </div>
  </div>}</>;


  if(section==="registros") {
    const cfg=cfgRegistro[moduloRegistro];
    return <section style={{padding:"0 24px 28px"}}><div className="form-card">
      <div><h2 style={{margin:"0 0 5px"}}>Modificar / Anular registros</h2><p style={{margin:0}}>Control administrativo de los módulos 1 al 4. Toda modificación o anulación requiere motivo y queda en Auditoría.</p></div>

      <div style={{display:"grid",gridTemplateColumns:"minmax(230px,320px) 1fr auto",gap:10,margin:"18px 0 14px"}}>
        <select value={moduloRegistro} onChange={e=>cambiarModuloRegistro(e.target.value as any)} style={{minHeight:42,border:"1px solid #cbd9d6",borderRadius:8,padding:"8px 11px",fontWeight:800}}>
          <option value="atencion">1. Atención al Cliente</option>
          <option value="cargos">2. Cargos y Salidas</option>
          <option value="guias">3. Registro de Guías</option>
          <option value="rirm">4. Registro RI-RM</option>
        </select>
        <input value={busquedaRegistro} onChange={e=>setBusquedaRegistro(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void buscarRegistro();}} placeholder={cfg.placeholder} style={{minHeight:42,border:"1px solid #cbd9d6",borderRadius:8,padding:"8px 11px"}}/>
        <button className="primary-action" onClick={()=>void buscarRegistro()} disabled={buscandoRegistro}>{buscandoRegistro?"Buscando...":"Buscar registro"}</button>
      </div>

      <div style={{padding:"10px 12px",marginBottom:12,background:"#eef7f5",borderRadius:8,fontWeight:800}}>Módulo seleccionado: {cfg.titulo}</div>
      {mensajeRegistro&&<div style={{padding:12,marginBottom:12,background:"#f4f8f7",borderRadius:8}}>{mensajeRegistro}</div>}

      {!!resultadosRegistro.length&&<div style={{overflowX:"auto",border:"1px solid #d9e4e1",borderRadius:12}}>
        <table style={{width:"100%",minWidth:950,borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#eef7f5",textAlign:"left"}}>{cfg.columnas.map((x:any)=><th key={x[0]} style={{padding:11,fontSize:12}}>{x[1]}</th>)}<th style={{padding:11,fontSize:12}}>ACCIÓN</th></tr></thead>
          <tbody>{resultadosRegistro.map((r,i)=><tr key={`${r.hoja||moduloRegistro}-${r.fila||r.idItem||r.id||i}-${i}`}>
            {cfg.columnas.map((x:any)=><td key={x[0]} style={{padding:10,borderTop:"1px solid #edf2f0"}}>{texto(r[x[0]])||"—"}</td>)}
            <td style={{padding:10,borderTop:"1px solid #edf2f0"}}><button style={btn} onClick={()=>abrirRegistro(r)}>Ver / Editar</button></td>
          </tr>)}</tbody>
        </table>
      </div>}

      {registroEditando&&<div style={{marginTop:18,...card}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
          <div><h3 style={{margin:"0 0 4px"}}>{cfg.titulo}</h3><small>{texto(registroEditando.hoja)||"Base operativa"} · {texto(registroEditando.codigo||registroEditando.correlativo||registroEditando.idItem||registroEditando.id)||"Registro"}</small></div>
          <button style={btn} onClick={()=>{setRegistroEditando(null);setRegistroForm({});setMotivoRegistro("");}}>Cerrar</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,marginTop:16}}>
          {camposActuales().map(([k,l]:string[])=><label key={k}><b style={{fontSize:12}}>{l}</b><input value={texto(registroForm[k])} onChange={e=>cambiarRegistro(k,e.target.value)} style={{width:"100%",minHeight:40,marginTop:5,border:"1px solid #cbd9d6",borderRadius:7,padding:"7px 9px"}}/></label>)}
        </div>

        <label style={{display:"block",marginTop:15}}><b>Motivo obligatorio</b><textarea value={motivoRegistro} onChange={e=>setMotivoRegistro(e.target.value)} rows={3} placeholder="Indique por qué se modifica o anula el registro" style={{width:"100%",marginTop:6}}/></label>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16,flexWrap:"wrap"}}>
          <button style={{...btn,border:"1px solid #b42318"}} onClick={()=>void anularRegistro()} disabled={guardando}>{guardando?"Procesando...":"Anular registro"}</button>
          <button className="primary-action" onClick={()=>void guardarRegistro()} disabled={guardando}>{guardando?"Guardando...":"Guardar cambios"}</button>
        </div>
      </div>}
    </div></section>;
  }

  if(section==="auditoria") return <section style={{padding:"0 24px 28px"}}><div className="form-card"><div style={{display:"flex",justifyContent:"space-between"}}><div><h2 style={{margin:0}}>Auditoría</h2><p>Historial de modificaciones administrativas.</p></div><button style={btn} onClick={cargarAuditoria}>Actualizar</button></div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:1100,borderCollapse:"collapse"}}><thead><tr>{["FECHA / HORA","USUARIO ADMIN","MÓDULO","REGISTRO","ACCIÓN","CAMPO","VALOR ANTERIOR","VALOR NUEVO","MOTIVO"].map(h=><th key={h} style={{padding:10,textAlign:"left"}}>{h}</th>)}</tr></thead><tbody>{auditoria.map((r,i)=><tr key={i}>{[r.fechaHora,r.usuarioAdmin,r.modulo,r.registro,r.accion,r.campo,r.anterior,r.nuevo,r.motivo].map((v,j)=><td key={j} style={{padding:10,borderTop:"1px solid #edf2f0"}}>{texto(v)||"—"}</td>)}</tr>)}</tbody></table></div>
  </div></section>;

  return <section style={{padding:"0 24px 28px"}}><div className="form-card">
    <h2 style={{margin:"0 0 5px"}}>Catálogos / configuración</h2>
    <p style={{margin:"0 0 14px"}}>Administración de listas maestras utilizadas por los módulos operativos.</p>
    <div style={{padding:14,background:"#fff8e1",borderRadius:10}}>La pantalla está reservada para catálogos. No habilité escrituras todavía porque este backend no expone acciones de catálogo; así evitamos modificar hojas o columnas incorrectas.</div>
  </div></section>;
}
