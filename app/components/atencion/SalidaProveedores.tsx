"use client";
import { useEffect,useState } from "react";
import { btn, estadiaApi, EstadiaPersona, input, panel } from "./estadiaApi";
export default function SalidaProveedores({responsable}:{responsable:string}){
 const [personas,setPersonas]=useState<EstadiaPersona[]>([]); const [sel,setSel]=useState(""); const [msg,setMsg]=useState("");
 const cargar=async()=>{try{setPersonas(await estadiaApi<EstadiaPersona[]>("estadiaListarPresentes"))}catch(e){setMsg(e instanceof Error?e.message:"Error")}};
 useEffect(()=>{void cargar()},[]);
 async function salir(modo:"PERSONA"|"VEHICULO"){const p=personas.find(x=>`${x.idIngreso}|${x.dni}`===sel); if(!p)return setMsg("Selecciona una persona.");
  if(!confirm(modo==="VEHICULO"?`Registrar salida de todas las personas de la placa ${p.placa}?`:`Registrar salida de ${p.nombre}?`))return;
  try{await estadiaApi("estadiaRegistrarSalida",{modo,idIngreso:p.idIngreso,dni:p.dni,placa:p.placa,responsable});setMsg("Salida registrada.");setSel("");await cargar()}catch(e){setMsg(e instanceof Error?e.message:"Error")}}
 return <section style={{display:"grid",gap:16}}><div><h1>Salida de Proveedores</h1><p>Registra la salida individual o de todo el vehículo.</p></div>
 <div style={panel}><label>Persona / vehículo<select style={input} value={sel} onChange={e=>setSel(e.target.value)}><option value="">Seleccionar...</option>{personas.map(p=><option key={`${p.idIngreso}-${p.dni}`} value={`${p.idIngreso}|${p.dni}`}>{p.nombre} · {p.placa||"SIN PLACA"} · {p.proveedor||"-"}</option>)}</select></label>
 <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap"}}><button style={btn} onClick={()=>void salir("PERSONA")}>Registrar salida de persona</button><button style={btn} onClick={()=>void salir("VEHICULO")}>Registrar salida de vehículo completo</button></div></div>
 {msg&&<div style={panel}>{msg}</div>}</section>
}
