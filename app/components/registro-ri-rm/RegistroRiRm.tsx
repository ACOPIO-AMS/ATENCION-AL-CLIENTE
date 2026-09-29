"use client";
import {useEffect,useMemo,useState} from "react";
import {useSearchParams} from "next/navigation";

type User={user:string;name:string;role:string;responsableSesion?:string;perfil?:string};
type Item={idItem:string;idSolicitud:string;tipo:string;codigo:string;modalidad?:string;etapaActual:string;subestadoActual:string;estado:string;fechaUltimoMovimiento?:string;horaUltimoMovimiento?:string;usuarioUltimoMovimiento?:string};
type Sol={idSolicitud:string;fecha:string;hora:string;areaOrigen:string;solicitante:string;prioridad:string;observacion?:string;estadoGeneral:string;items:Item[]};
type Section="pendientes"|"nueva-solicitud"|"mis-solicitudes"|"historial-buscar";
const SESSION_KEY="atencion_usuario_sesion_v1";
const TYPES=["RI","2RI","3RI","4RI","5RI","RM","2RM","3RM","4RM","5RM","RP","2RP","ACP","2ACP","3ACP","FACP","2FACP","3FACP"];
const titles:Record<Section,string>={"pendientes":"Pendientes","nueva-solicitud":"Nueva solicitud","mis-solicitudes":"Mis solicitudes","historial-buscar":"Historial / Buscar"};
const U=(v:any)=>String(v||"").trim().toUpperCase();
const role=(u:User|null)=>{const r=U(u?.role||u?.perfil);return r==="ADMIN"?"ADMINISTRADOR":r==="ATENCION"?"ATENCION":r==="LABORATORIO"?"ASISTENTE A4":r};
const special=(t:string)=>/^(?:\d+)?(?:ACP|RP|FACP)$/.test(U(t));
async function call(action:string,payload:any={}){const r=await fetch("/api/registro-ri-rm",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,payload})});const j=await r.json();if(!j.ok)throw new Error(j.error||"Error RI-RM");return j.data}
function actions(i:Item,s:Sol,u:User|null){
 const p=role(u),e=U(i.etapaActual),st=U(i.subestadoActual),o=U(s.areaOrigen);
 if(p==="GUIAS"&&e==="GUIAS"&&st==="SOLICITUD CREADA")return["COORDINADO"];
 if(p==="GUIAS"&&e==="GUIAS"&&st==="COORDINADO")return["CONFIRMADO"];
 if(p==="ASISTENTE A4"&&o==="ASISTENTE A4"&&special(i.tipo)&&e==="ASISTENTE A4"&&st==="SOLICITUD CREADA")return["FINALIZADO"];
 if(p==="ASISTENTE A4"&&e==="ASISTENTE A4"&&["CONFIRMADO","PENDIENTE DE RECEPCION"].includes(st))return["EN LABORATORIO"];
 if(p==="ATENCION"&&e==="ATENCION"&&st==="EN LABORATORIO")return["RECEPCIONADO"];
 if(p==="ATENCION"&&e==="ATENCION"&&st==="RECEPCIONADO")return["ENVIADO"];
 if(p==="CHALA"&&e==="CHALA"&&st==="ENVIADO")return["RECIBIDO"];
 return[];
}
function Badge({v}:{v:string}){return <span style={{padding:"6px 10px",borderRadius:999,background:"#eef4f3",fontSize:12,fontWeight:800}}>{v||"—"}</span>}
export default function RegistroRiRm(){
 const q=useSearchParams(); const raw=q.get("seccion") as Section|null; const section:Section=raw&&titles[raw]?raw:"pendientes";
 const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(""),[sols,setSols]=useState<Sol[]>([]);
 const [rows,setRows]=useState([{tipo:"RI",codigo:"",modalidad:""}]),[priority,setPriority]=useState("NORMAL"),[obs,setObs]=useState("");
 const [bt,setBt]=useState("RI"),[bc,setBc]=useState(""),[found,setFound]=useState<any>(null);
 useEffect(()=>{try{setUser(JSON.parse(localStorage.getItem(SESSION_KEY)||"null"))}catch{}setReady(true)},[]);
 const apiUser=useMemo(()=>user?{usuario:user.user,nombre:user.name,responsableSesion:user.responsableSesion||user.name,perfil:role(user)}:null,[user]);
 async function load(){if(!apiUser)return;setLoading(true);setError("");try{setSols(await call("rirmSolicitudes",{usuario:apiUser})||[])}catch(e:any){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{if(ready&&user&&section!=="nueva-solicitud")load()},[ready,user,section]);
 async function move(i:Item,s:Sol,a:string){
   const d:any={idItem:i.idItem,accion:a,usuario:apiUser,observacion:""};
   if(role(user)==="ASISTENTE A4"){d.fechaEvento=new Date().toLocaleDateString("en-CA");d.horaEvento=new Date().toTimeString().slice(0,5);d.responsableRecepcionLab=user?.name||"";d.responsableEntregaLab=prompt("Devuelto por Laboratorio por:")||"";if(!d.responsableEntregaLab)return}
   if(role(user)==="ATENCION"&&a==="RECEPCIONADO"){d.operarioSellado=prompt("Operario de sellado:")||"";if(!d.operarioSellado)return}
   if(role(user)==="ATENCION"&&a==="ENVIADO"){d.medioEntrega=(prompt("Medio: CONDUCTOR o PROVEEDOR","CONDUCTOR")||"").toUpperCase();d.destinatario=prompt("Nombre del conductor/proveedor:")||"";if(!d.destinatario)return}
   if(!confirm(`¿Confirmar ${a} para ${i.tipo} - ${i.codigo}?`))return;
   setLoading(true);try{await call("rirmMovimiento",d);await load()}catch(e:any){setError(e.message);setLoading(false)}
 }
 async function save(){
   const clean=rows.map(x=>({...x,codigo:U(x.codigo),tipo:U(x.tipo),modalidad:U(x.modalidad)}));
   if(clean.some(x=>!x.codigo||!x.modalidad)){setError("Complete código y modalidad.");return}
   const keys=clean.map(x=>x.tipo+"|"+x.codigo); if(new Set(keys).size!==keys.length){setError("Hay códigos duplicados en la solicitud.");return}
   setLoading(true);setError("");try{const r=await call("rirmGuardarSolicitud",{usuario:apiUser,prioridad:priority,observacionGeneral:obs,items:clean});alert(r.mensaje||"Solicitud registrada.");setRows([{tipo:"RI",codigo:"",modalidad:""}]);setObs("");location.href="/registro-ri-rm?seccion=mis-solicitudes"}catch(e:any){setError(e.message)}finally{setLoading(false)}
 }
 async function search(){setLoading(true);setError("");try{setFound(await call("rirmBuscar",{tipo:bt,codigo:U(bc)}))}catch(e:any){setError(e.message);setFound(null)}finally{setLoading(false)}}
 if(!ready)return <main style={{padding:30}}>Cargando…</main>;
 if(!user)return <main style={{padding:30}}><h2>REGISTRO RI-RM</h2><p>No existe sesión activa.</p><a href="/">Volver</a></main>;
 const pending=sols.flatMap(s=>(s.items||[]).map(i=>({s,i}))).filter(x=>actions(x.i,x.s,user).length);
 const active=sols.flatMap(s=>(s.items||[]).map(i=>({s,i}))).filter(x=>U(x.i.estado)!=="FINALIZADO");
 return <main style={{minHeight:"100vh",background:"#f5f7f7",fontFamily:"Arial,sans-serif",color:"#183b3a"}}>
  <header style={{background:"#173f3b",color:"white",padding:"16px 28px",display:"flex",justifyContent:"space-between"}}><b>AMS ACOPIO · REGISTRO RI-RM</b><span>{user.name} · {role(user)}</span></header>
  <div style={{display:"grid",gridTemplateColumns:"240px 1fr"}}>
   <aside style={{background:"white",minHeight:"calc(100vh - 50px)",padding:16,borderRight:"1px solid #dfe7e5"}}><a href="/" style={{display:"block",marginBottom:18,fontWeight:800,color:"#17675d"}}>← Sistema integrado</a>
    {(Object.keys(titles) as Section[]).map(s=><a key={s} href={`/registro-ri-rm?seccion=${s}`} style={{display:"block",padding:11,borderRadius:8,marginBottom:5,textDecoration:"none",fontWeight:800,color:section===s?"#0b665a":"#506664",background:section===s?"#e5f3f0":"transparent"}}>{titles[s]}</a>)}
   </aside>
   <section style={{padding:28,overflow:"auto"}}><h1>{titles[section]}</h1>{error&&<div style={{background:"#fee2e2",padding:12,borderRadius:9,marginBottom:15}}>{error}</div>}{loading&&<p>Actualizando…</p>}
    {section==="pendientes"&&<Table data={pending} user={user} onMove={move}/>}
    {section==="mis-solicitudes"&&<Table data={active} user={user} onMove={move} showAll/>}
    {section==="nueva-solicitud"&&["CHALA","ASISTENTE A4","ADMINISTRADOR"].includes(role(user))&&<div style={{background:"white",padding:20,borderRadius:12}}>
      <div style={{display:"flex",gap:10,marginBottom:14}}><select value={priority} onChange={e=>setPriority(e.target.value)}><option>NORMAL</option><option>URGENTE</option></select><input placeholder="Observación general" value={obs} onChange={e=>setObs(e.target.value)} style={{flex:1}}/></div>
      {rows.map((x,k)=><div key={k} style={{display:"grid",gridTemplateColumns:"160px 1fr 180px 40px",gap:8,marginBottom:8}}>
       <select value={x.tipo} onChange={e=>setRows(rows.map((r,j)=>j===k?{...r,tipo:e.target.value}:r))}>{TYPES.map(t=><option key={t}>{t}</option>)}</select>
       <input placeholder="Código" value={x.codigo} onChange={e=>setRows(rows.map((r,j)=>j===k?{...r,codigo:e.target.value}:r))}/>
       <select value={x.modalidad} onChange={e=>setRows(rows.map((r,j)=>j===k?{...r,modalidad:e.target.value}:r))}><option value="">Modalidad</option><option>PRESENCIAL</option><option>NO PRESENCIAL</option></select>
       <button onClick={()=>setRows(rows.filter((_,j)=>j!==k))}>×</button>
      </div>)}
      <button disabled={rows.length>=20} onClick={()=>setRows([...rows,{tipo:"RI",codigo:"",modalidad:""}])}>+ Agregar código</button> <button onClick={save}>Guardar solicitud</button>
    </div>}
    {section==="historial-buscar"&&<div><div style={{display:"flex",gap:8,marginBottom:16}}><select value={bt} onChange={e=>setBt(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select><input placeholder="Código" value={bc} onChange={e=>setBc(e.target.value)}/><button onClick={search}>Buscar</button></div>
     {found&&<div style={{background:"white",padding:18,borderRadius:12}}><h3>{found.item?.tipo} - {found.item?.codigo}</h3><p>Estado: <b>{found.item?.subestadoActual}</b> · Área: <b>{found.item?.etapaActual}</b></p><h4>Movimientos</h4>{(found.movimientos||[]).map((m:any)=><div key={m.idMovimiento} style={{padding:"9px 0",borderBottom:"1px solid #eee"}}><b>{m.accion}</b> · {m.area} · {m.responsable}<br/><small>{m.fechaEvento} {m.horaEvento}</small></div>)}</div>}
    </div>}
   </section>
  </div>
 </main>
}
function Table({data,user,onMove,showAll=false}:{data:{s:Sol,i:Item}[];user:User;onMove:(i:Item,s:Sol,a:string)=>void;showAll?:boolean}){
 return <div style={{background:"white",borderRadius:12,overflow:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["SOLICITUD","TIPO-CÓDIGO","ORIGEN","ESTADO","FLUJO ACTUAL","ÚLTIMO MOVIMIENTO","ACCIÓN"].map(h=><th key={h} style={{padding:12,textAlign:"left",borderBottom:"1px solid #ddd"}}>{h}</th>)}</tr></thead><tbody>
 {data.map(({s,i})=><tr key={i.idItem}><td style={{padding:12}}>{s.idSolicitud}</td><td style={{padding:12,fontWeight:900,color:"#1267a5"}}>{i.tipo} - {i.codigo}</td><td style={{padding:12}}>{s.areaOrigen}</td><td style={{padding:12}}><Badge v={i.subestadoActual}/></td><td style={{padding:12}}>{i.etapaActual}</td><td style={{padding:12}}>{i.fechaUltimoMovimiento} {i.horaUltimoMovimiento}</td><td style={{padding:12}}>{actions(i,s,user).map(a=><button key={a} onClick={()=>onMove(i,s,a)} style={{marginRight:5}}>{a}</button>)}</td></tr>)}
 {!data.length&&<tr><td colSpan={7} style={{padding:30,textAlign:"center",color:"#71817f"}}>No hay registros para mostrar.</td></tr>}</tbody></table></div>
}
