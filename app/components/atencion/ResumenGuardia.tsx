"use client";
import { useEffect,useState } from "react";
import { estadiaApi,panel } from "./estadiaApi";
type Resumen={fechaOperativa:string;turno:string;guardia:string;personasRecibidas:number;personasSalieron:number;personasPresentes:number;desayunos:number;almuerzos:number;cenas:number;agua:number;gaseosa:number;galletas:number;papel:number;shampoo:number;jabon:number;habitaciones:{disponibles:number;ocupadas:number;porLimpiar:number}};
export default function ResumenGuardia({responsable}:{responsable:string}){
 const [r,setR]=useState<Resumen|null>(null);const [msg,setMsg]=useState("");
 useEffect(()=>{estadiaApi<Resumen>("estadiaResumenGuardia",{responsable}).then(setR).catch(e=>setMsg(e instanceof Error?e.message:"Error"))},[responsable]);
 if(!r)return <section><h1>Resumen diario / guardia</h1><div style={panel}>{msg||"Cargando..."}</div></section>;
 return <section style={{display:"grid",gap:16}}><div><h1>Resumen diario / guardia</h1><p>{r.fechaOperativa} · {r.turno} · Guardia {r.guardia||"-"} · {responsable}</p></div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>{[["Recibidas",r.personasRecibidas],["Salieron",r.personasSalieron],["Permanecen",r.personasPresentes],["Desayunos",r.desayunos],["Almuerzos",r.almuerzos],["Cenas",r.cenas],["Agua",r.agua],["Gaseosa",r.gaseosa],["Galletas",r.galletas]].map(([a,b])=><div style={panel} key={String(a)}><small>{a}</small><strong style={{display:"block",fontSize:26}}>{b}</strong></div>)}</div>
 <div style={panel}><h3>Habitaciones</h3><p>Disponibles: <b>{r.habitaciones.disponibles}</b> · Ocupadas: <b>{r.habitaciones.ocupadas}</b> · Por limpiar: <b>{r.habitaciones.porLimpiar}</b></p></div></section>
}
