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

function etiquetaPermiso(key:string){
  const m:Record<string,string>={
    ATENCION_NUEVO:"Nuevo ingreso",ATENCION_REPORTE:"Reporte diario",ATENCION_REGULARIZAR:"Por regularizar",
    ATENCION_BUSCAR:"Buscar",ATENCION_CLIENTES:"BD Clientes",CARGOS_REGISTRAR:"Registrar salida",
    CARGOS_BUSCAR:"Buscar salidas",GUIAS_REGISTRAR:"Registrar",GUIAS_HISTORIAL:"Historial de registros",
    GUIAS_INDICADORES:"Indicadores",GUIAS_SACOS:"Registro de Sacos Mineros",RI_RM:"Acceso Registro RI-RM",
    PENDIENTES:"Pendientes","NUEVA SOLICITUD":"Nueva solicitud","MIS SOLICITUDES":"Mis solicitudes",
    "HISTORIAL / BUSCAR":"Historial / Buscar"
  };
  const k=texto(key).toUpperCase();
  return m[k]||texto(key).replaceAll("_"," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
}
function grupoPermiso(key:string){
  const k=texto(key).toUpperCase();
  if(k.startsWith("ATENCION")) return "1. ATENCIÓN AL CLIENTE";
  if(k.startsWith("CARGO")||k.startsWith("SALIDA")) return "2. CARGOS Y SALIDAS";
  if(k.startsWith("GUIA")) return "3. REGISTRO DE GUÍAS";
  if(k.startsWith("RI")||k.includes("PENDIENT")||k.includes("SOLICITUD")||k.includes("HISTORIAL / BUSCAR")) return "4. REGISTRO RI-RM";
  return "OTROS PERMISOS";
}

export default function AdminPanel({section}:{section:AdminSection}) {
  const [usuarios,setUsuarios]=useState<AnyRow[]>([]);
  const [permisosConfig,setPermisosConfig]=useState<PermisoConfig[]>([]);
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

  // MODIFICAR / ANULAR REGISTROS
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
      setPermisosConfig((Array.isArray(d?.permisos)?d.permisos:[]).map((x:any)=>typeof x==="string"?{key:x}:{key:texto(x?.key),columna:Number(x?.columna)||undefined}).filter((x:PermisoConfig)=>!!x.key));
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
  const grupos=useMemo(()=>{const g:Record<string,PermisoConfig[]>={};permisosConfig.forEach(p=>(g[grupoPermiso(p.key)]??=[]).push(p));return g;},[permisosConfig]);

  function abrirEditor(u:AnyRow){
    const pu=u?.permisos&&typeof u.permisos==="object"?u.permisos:{};
    const ep:Record<string,boolean>={};permisosConfig.forEach(p=>ep[p.key]=esSi(pu[p.key]));
    setUsuarioEditando(u);setEditNombre(texto(obtener(u,"nombre","nombreCompleto","NOMBRE COMPLETO")));setEditRol(texto(obtener(u,"rol","ROL")));
    setEditActivo(esSi(obtener(u,"activo","ACTIVO")));setEditPermisos(ep);setMotivo("");setMensajeModal("");
  }
  const cerrarEditor=()=>{if(!guardando){setUsuarioEditando(null);setMensajeModal("");setMotivo("");}};
  const cambiarPermiso=(k:string)=>setEditPermisos(p=>({...p,[k]:!p[k]}));
  function cambiarGrupo(lista:PermisoConfig[],v:boolean){setEditPermisos(p=>{const c={...p};lista.forEach(x=>c[x.key]=v);return c;});}

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


  async function buscarRegistroGuias(){
    if(!busquedaRegistro.trim()){setMensajeRegistro("Ingrese un código para buscar.");return;}
    setBuscandoRegistro(true);setMensajeRegistro("");setResultadosRegistro([]);setRegistroEditando(null);
    try{
      const d=await adminApi("adminBuscarRegistroGuias",{busqueda:busquedaRegistro.trim()});
      const lista=Array.isArray(d?.registros)?d.registros:[];
      setResultadosRegistro(lista);
      if(!lista.length)setMensajeRegistro("No se encontraron registros.");
    }catch(e:any){setMensajeRegistro(e?.message||"No se pudo realizar la búsqueda.");}
    finally{setBuscandoRegistro(false);}
  }

  function abrirRegistro(r:AnyRow){
    setRegistroEditando(r);
    setRegistroForm({...r});
    setMotivoRegistro("");
    setMensajeRegistro("");
  }

  function cambiarRegistro(campo:string,valor:string){
    setRegistroForm((p:AnyRow)=>({...p,[campo]:valor}));
  }

  async function guardarRegistro(){
    if(!registroEditando)return;
    if(!motivoRegistro.trim()){setMensajeRegistro("Indique el motivo de la modificación.");return;}
    const adminUsuario=obtenerAdminActual();
    if(!adminUsuario){setMensajeRegistro("No se pudo identificar la sesión del administrador.");return;}

    const claves=["id","placa","dniProveedor","proveedor","numeroLotes","codigo","recepcion","inicioRevision","serieGRR","numeroGRR","serieGRT","numeroGRT","finalRevision","condicionLote"];
    const cambios:AnyRow={};
    claves.forEach(k=>{
      if(texto(registroForm[k])!==texto(registroEditando[k])) cambios[k]=registroForm[k]??"";
    });
    if(!Object.keys(cambios).length){setMensajeRegistro("No hay cambios para guardar.");return;}

    setGuardando(true);setMensajeRegistro("");
    try{
      const d=await adminApi("adminModificarRegistroGuias",{fila:registroEditando.fila,adminUsuario,motivo:motivoRegistro.trim(),cambios});
      setMensajeRegistro(texto(d?.message)||"Registro actualizado correctamente.");
      const b=await adminApi("adminBuscarRegistroGuias",{busqueda:texto(registroForm.codigo)||busquedaRegistro.trim()});
      const lista=Array.isArray(b?.registros)?b.registros:[];
      setResultadosRegistro(lista);
      setRegistroEditando(null);
      setRegistroForm({});
      setMotivoRegistro("");
    }catch(e:any){setMensajeRegistro(e?.message||"No se pudo modificar el registro.");}
    finally{setGuardando(false);}
  }

  async function anularRegistro(){
    if(!registroEditando)return;
    if(!motivoRegistro.trim()){setMensajeRegistro("Indique el motivo de la anulación.");return;}
    const adminUsuario=obtenerAdminActual();
    if(!adminUsuario){setMensajeRegistro("No se pudo identificar la sesión del administrador.");return;}
    if(typeof window!=="undefined"&&!window.confirm(`¿Confirmas anular el registro ${texto(registroEditando.codigo)||"seleccionado"}?\\n\\nNo se eliminará la fila y el movimiento quedará en Auditoría.`))return;

    setGuardando(true);setMensajeRegistro("");
    try{
      const d=await adminApi("adminAnularRegistroGuias",{fila:registroEditando.fila,adminUsuario,motivo:motivoRegistro.trim()});
      setMensajeRegistro(texto(d?.message)||"Registro anulado correctamente.");
      const b=await adminApi("adminBuscarRegistroGuias",{busqueda:busquedaRegistro.trim()});
      setResultadosRegistro(Array.isArray(b?.registros)?b.registros:[]);
      setRegistroEditando(null);
      setRegistroForm({});
      setMotivoRegistro("");
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
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><div><h2 style={{margin:"0 0 5px"}}>Usuarios y accesos</h2><p style={{margin:0}}>Administra usuarios, perfiles y permisos por módulo.</p></div><button style={btn} onClick={cargarUsuarios}>{cargando?"Cargando...":"Actualizar"}</button></div>
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
  {usuarioEditando&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(12,30,27,.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
    <div style={{width:"min(760px,96vw)",maxHeight:"90vh",overflowY:"auto",background:"#fff",borderRadius:16,padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><div><h2 style={{margin:0}}>Editar accesos</h2><small>Usuario: <b>{texto(usuarioEditando.usuario)}</b></small></div><button style={btn} onClick={cerrarEditor}>×</button></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:18}}>
        <label><b>Nombre completo</b><input value={editNombre} onChange={e=>setEditNombre(e.target.value)} style={{width:"100%",minHeight:42,marginTop:6}}/></label>
        <label><b>Rol</b><select value={editRol} onChange={e=>setEditRol(e.target.value)} style={{width:"100%",minHeight:42,marginTop:6}}>{!roles.includes(editRol)&&editRol&&<option value={editRol}>{editRol}</option>}{roles.map(r=><option key={r}>{r}</option>)}</select></label>
      </div>
      <div style={{...card,marginTop:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><b>Estado del usuario</b><div>{editActivo?"Puede iniciar sesión.":"Usuario bloqueado."}</div></div><button style={btn} onClick={()=>setEditActivo(!editActivo)}>{editActivo?"ACTIVO":"INACTIVO"}</button></div>
      <h3>Permisos por módulo</h3>
      {Object.entries(grupos).map(([g,l])=><div key={g} style={{...card,marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b>{g}</b><button style={btn} onClick={()=>cambiarGrupo(l,!l.every(p=>editPermisos[p.key]))}>{l.every(p=>editPermisos[p.key])?"Quitar todos":"Dar todos"}</button></div>
        {l.map(p=><label key={p.key} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderTop:"1px solid #edf2f0"}}><span>{etiquetaPermiso(p.key)}</span><input type="checkbox" checked={!!editPermisos[p.key]} onChange={()=>cambiarPermiso(p.key)}/></label>)}
      </div>)}
      {!permisosConfig.length&&<div style={{padding:12,background:"#fff8e1"}}>No se recibieron permisos configurados desde USUARIOS.</div>}
      <label style={{display:"block",marginTop:14}}><b>Motivo del cambio</b><textarea value={motivo} onChange={e=>setMotivo(e.target.value)} rows={3} style={{width:"100%",marginTop:6}}/></label>
      {mensajeModal&&<div style={{padding:12,marginTop:12,background:"#f4f8f7",borderRadius:8}}>{mensajeModal}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:18}}><button style={btn} onClick={cerrarEditor}>Cancelar</button><button className="primary-action" onClick={guardarAccesos} disabled={guardando}>{guardando?"Guardando...":"Guardar cambios"}</button></div>
    </div>
  </div>}</>;


  if(section==="registros") return <section style={{padding:"0 24px 28px"}}><div className="form-card">
    <div><h2 style={{margin:"0 0 5px"}}>Modificar / Anular registros</h2><p style={{margin:0}}>Busca un lote de Registro de Guías, revisa sus datos y realiza cambios administrativos con auditoría.</p></div>

    <div style={{display:"flex",gap:10,margin:"18px 0 14px",flexWrap:"wrap"}}>
      <input value={busquedaRegistro} onChange={e=>setBusquedaRegistro(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void buscarRegistroGuias();}} placeholder="Código o número de lote, ej. 68254" style={{minHeight:42,flex:"1 1 300px",border:"1px solid #cbd9d6",borderRadius:8,padding:"8px 11px"}}/>
      <button className="primary-action" onClick={()=>void buscarRegistroGuias()} disabled={buscandoRegistro}>{buscandoRegistro?"Buscando...":"Buscar registro"}</button>
    </div>

    {mensajeRegistro&&<div style={{padding:12,marginBottom:12,background:"#f4f8f7",borderRadius:8}}>{mensajeRegistro}</div>}

    {!!resultadosRegistro.length&&<div style={{overflowX:"auto",border:"1px solid #d9e4e1",borderRadius:12}}>
      <table style={{width:"100%",minWidth:950,borderCollapse:"collapse"}}>
        <thead><tr style={{background:"#eef7f5",textAlign:"left"}}>{["CÓDIGO","ID","PLACA","PROVEEDOR","N° LOTES","RECEPCIÓN","CONDICIÓN","ACCIÓN"].map(h=><th key={h} style={{padding:11,fontSize:12}}>{h}</th>)}</tr></thead>
        <tbody>{resultadosRegistro.map((r,i)=><tr key={`${r.fila}-${i}`}>
          {[r.codigo,r.id,r.placa,r.proveedor,r.numeroLotes,r.recepcion,r.condicionLote].map((v,j)=><td key={j} style={{padding:10,borderTop:"1px solid #edf2f0"}}>{texto(v)||"—"}</td>)}
          <td style={{padding:10,borderTop:"1px solid #edf2f0"}}><button style={btn} onClick={()=>abrirRegistro(r)}>Ver / Editar</button></td>
        </tr>)}</tbody>
      </table>
    </div>}

    {registroEditando&&<div style={{marginTop:18,...card}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><h3 style={{margin:"0 0 4px"}}>Registro: {texto(registroEditando.codigo)||"—"}</h3><small>Fila {registroEditando.fila} · PROCESOS - GUIAS</small></div><button style={btn} onClick={()=>{setRegistroEditando(null);setRegistroForm({});setMotivoRegistro("");}}>Cerrar</button></div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:12,marginTop:16}}>
        {[
          ["id","ID"],["placa","Placa"],["dniProveedor","DNI proveedor"],["proveedor","Proveedor"],
          ["numeroLotes","N° lotes"],["codigo","Código de lote"],["recepcion","Recepción"],["inicioRevision","Inicio revisión"],
          ["serieGRR","Serie GRR"],["numeroGRR","Número GRR"],["serieGRT","Serie GRT"],["numeroGRT","Número GRT"],
          ["finalRevision","Final revisión"],["condicionLote","Condición del lote"]
        ].map(([k,l])=><label key={k}><b style={{fontSize:12}}>{l}</b><input value={texto(registroForm[k])} onChange={e=>cambiarRegistro(k,e.target.value)} style={{width:"100%",minHeight:40,marginTop:5,border:"1px solid #cbd9d6",borderRadius:7,padding:"7px 9px"}}/></label>)}
      </div>

      <label style={{display:"block",marginTop:15}}><b>Motivo obligatorio</b><textarea value={motivoRegistro} onChange={e=>setMotivoRegistro(e.target.value)} rows={3} placeholder="Indique por qué se modifica o anula el registro" style={{width:"100%",marginTop:6}}/></label>

      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:16,flexWrap:"wrap"}}>
        <button style={{...btn,border:"1px solid #b42318"}} onClick={()=>void anularRegistro()} disabled={guardando}>{guardando?"Procesando...":"Anular registro"}</button>
        <button className="primary-action" onClick={()=>void guardarRegistro()} disabled={guardando}>{guardando?"Guardando...":"Guardar cambios"}</button>
      </div>
    </div>}
  </div></section>;

  if(section==="auditoria") return <section style={{padding:"0 24px 28px"}}><div className="form-card"><div style={{display:"flex",justifyContent:"space-between"}}><div><h2 style={{margin:0}}>Auditoría</h2><p>Historial de modificaciones administrativas.</p></div><button style={btn} onClick={cargarAuditoria}>Actualizar</button></div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:1100,borderCollapse:"collapse"}}><thead><tr>{["FECHA / HORA","USUARIO ADMIN","MÓDULO","REGISTRO","ACCIÓN","CAMPO","VALOR ANTERIOR","VALOR NUEVO","MOTIVO"].map(h=><th key={h} style={{padding:10,textAlign:"left"}}>{h}</th>)}</tr></thead><tbody>{auditoria.map((r,i)=><tr key={i}>{[r.fechaHora,r.usuarioAdmin,r.modulo,r.registro,r.accion,r.campo,r.anterior,r.nuevo,r.motivo].map((v,j)=><td key={j} style={{padding:10,borderTop:"1px solid #edf2f0"}}>{texto(v)||"—"}</td>)}</tr>)}</tbody></table></div>
  </div></section>;

  return <section style={{padding:"0 24px 28px"}}><div className="form-card">
    <h2 style={{margin:"0 0 5px"}}>Catálogos / configuración</h2>
    <p style={{margin:"0 0 14px"}}>Administración de listas maestras utilizadas por los módulos operativos.</p>
    <div style={{padding:14,background:"#fff8e1",borderRadius:10}}>La pantalla está reservada para catálogos. No habilité escrituras todavía porque este backend no expone acciones de catálogo; así evitamos modificar hojas o columnas incorrectas.</div>
  </div></section>;
}
