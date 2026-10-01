"use client";
import { useEffect, useMemo, useState } from "react";
import { btn, duracionDesde, estadiaApi, EstadiaPersona, input, panel } from "./estadiaApi";

type Servicio = "DESAYUNO"|"ALMUERZO"|"CENA"|"AGUA"|"GASEOSA"|"GALLETAS"|"PAPEL HIGIÉNICO"|"SHAMPOO"|"JABÓN";

export default function EstadiaServicios({ responsable }: { responsable: string }) {
  const [personas,setPersonas]=useState<EstadiaPersona[]>([]);
  const [sel,setSel]=useState("");
  const [servicio,setServicio]=useState<Servicio>("AGUA");
  const [cantidad,setCantidad]=useState(1);
  const [salidaPrevista,setSalidaPrevista]=useState("");
  const [msg,setMsg]=useState("");
  const [,tick]=useState(0);
  const cargar=async()=>{ try{ setPersonas(await estadiaApi<EstadiaPersona[]>("estadiaListarPresentes")); }catch(e){setMsg(e instanceof Error?e.message:"Error");}};
  useEffect(()=>{void cargar(); const t=setInterval(()=>tick(x=>x+1),60000); return()=>clearInterval(t)},[]);
  const actual=useMemo(()=>personas.find(p=>`${p.idIngreso}|${p.dni}`===sel),[personas,sel]);
  async function guardarServicio(){
    if(!actual) return setMsg("Selecciona una persona.");
    try{
      await estadiaApi("estadiaRegistrarServicio",{idIngreso:actual.idIngreso,dni:actual.dni,nombre:actual.nombre,placa:actual.placa,proveedor:actual.proveedor,servicio,cantidad,responsable});
      setMsg("Servicio registrado."); 
    }catch(e){setMsg(e instanceof Error?e.message:"Error");}
  }
  async function guardarSalidaPrevista(){
    if(!actual||!salidaPrevista) return setMsg("Selecciona persona y salida prevista.");
    try{await estadiaApi("estadiaActualizarSalidaPrevista",{idIngreso:actual.idIngreso,dni:actual.dni,salidaPrevista,responsable}); setMsg("Salida prevista actualizada."); await cargar();}
    catch(e){setMsg(e instanceof Error?e.message:"Error");}
  }
  const comidas={desayuno:personas.length,almuerzo:personas.length,cena:personas.length};
  return <section style={{display:"grid",gap:16}}>
    <div><h1 style={{margin:0}}>Estadía, Servicios y Consumos</h1><p style={{margin:"6px 0 0",color:"#60706d"}}>Personas actualmente en instalaciones y registro individual de servicios.</p></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
      {[["Personas presentes",personas.length],["Desayunos requeridos",comidas.desayuno],["Almuerzos requeridos",comidas.almuerzo],["Cenas requeridas",comidas.cena]].map(([a,b])=><div key={String(a)} style={panel}><small>{a}</small><strong style={{display:"block",fontSize:28,marginTop:6}}>{b}</strong></div>)}
    </div>
    <div style={panel}>
      <h3>Personas en instalaciones</h3>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Placa","Proveedor","Persona","Ingreso","Salida prevista","Permanencia","Habitación"].map(x=><th key={x} style={{textAlign:"left",padding:8,borderBottom:"1px solid #ddd"}}>{x}</th>)}</tr></thead>
      <tbody>{personas.map(p=><tr key={`${p.idIngreso}-${p.dni}`} onClick={()=>setSel(`${p.idIngreso}|${p.dni}`)} style={{cursor:"pointer",background:sel===`${p.idIngreso}|${p.dni}`?"#eef8f6":undefined}}><td style={{padding:8}}>{p.placa||"-"}</td><td>{p.proveedor||"-"}</td><td>{p.nombre}</td><td>{p.fechaIngreso}</td><td>{p.salidaPrevista||"-"}</td><td>{duracionDesde(p.fechaIngreso)}</td><td>{p.habitacion||"-"}</td></tr>)}</tbody></table></div>
    </div>
    <div style={{...panel,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,alignItems:"end"}}>
      <label>Persona<select style={input} value={sel} onChange={e=>setSel(e.target.value)}><option value="">Seleccionar...</option>{personas.map(p=><option key={`${p.idIngreso}-${p.dni}`} value={`${p.idIngreso}|${p.dni}`}>{p.nombre} · {p.placa}</option>)}</select></label>
      <label>Servicio<select style={input} value={servicio} onChange={e=>setServicio(e.target.value as Servicio)}>{["DESAYUNO","ALMUERZO","CENA","AGUA","GASEOSA","GALLETAS","PAPEL HIGIÉNICO","SHAMPOO","JABÓN"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Cantidad<input style={input} type="number" min={1} value={cantidad} onChange={e=>setCantidad(Math.max(1,Number(e.target.value)||1))}/></label>
      <button style={btn} onClick={()=>void guardarServicio()}>Registrar servicio</button>
      <label>Salida prevista<input style={input} type="datetime-local" value={salidaPrevista} onChange={e=>setSalidaPrevista(e.target.value)}/></label>
      <button style={btn} onClick={()=>void guardarSalidaPrevista()}>Guardar salida prevista</button>
    </div>
    {msg&&<div style={{...panel,padding:12}}>{msg}</div>}
  </section>
}
