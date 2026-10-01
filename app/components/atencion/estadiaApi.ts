"use client";
import type { CSSProperties } from "react";

export type EstadiaPersona={idIngreso:string;dni:string;nombre:string;rol:string;placa:string;proveedor:string;fechaIngreso:string;salidaPrevista?:string;fechaSalida?:string;habitacion?:string;estado:"PRESENTE"|"SALIO"};
export type Habitacion={numero:string;estado:"DISPONIBLE"|"OCUPADA"|"RESERVADA"|"POR LIMPIAR"|"FUERA DE SERVICIO";dni?:string;huesped?:string;placa?:string;proveedor?:string;fechaIngreso?:string;salidaPrevista?:string};
export async function estadiaApi<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{const response=await fetch("/api/sheets",{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({action,payload})});const json=await response.json().catch(()=>({ok:false,error:"Respuesta inválida del servidor."}));if(!response.ok||!json.ok)throw new Error(json.error||"No se pudo completar la operación.");return json.data as T;}
export function duracionDesde(value?:string,hasta?:string){if(!value)return "-";const ini=new Date(value).getTime(),fin=hasta?new Date(hasta).getTime():Date.now();if(!Number.isFinite(ini)||!Number.isFinite(fin)||fin<ini)return "-";const min=Math.floor((fin-ini)/60000),d=Math.floor(min/1440),h=Math.floor((min%1440)/60),m=min%60;return `${d?`${d}d `:""}${h}h ${m}m`;}
export const panel:CSSProperties={background:"#fff",border:"1px solid #dce6e4",borderRadius:14,padding:18,boxShadow:"0 3px 12px rgba(0,0,0,.05)"};
export const btn:CSSProperties={border:0,borderRadius:9,padding:"10px 14px",fontWeight:800,cursor:"pointer",background:"#174d47",color:"#fff"};
export const input:CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #cbd8d5",borderRadius:8,padding:"9px 10px",background:"#fff"};
export const kpi=(bg:string,border:string):CSSProperties=>({...panel,background:bg,borderColor:border});
export const roomStyle:Record<string,CSSProperties>={DISPONIBLE:{background:"#eaf8ef",border:"2px solid #55b875"},OCUPADA:{background:"#fff0ef",border:"2px solid #ef716b"},RESERVADA:{background:"#edf5ff",border:"2px solid #5d9fe8"},"POR LIMPIAR":{background:"#fff7e3",border:"2px solid #e9a72e"},"FUERA DE SERVICIO":{background:"#eef1f3",border:"2px solid #7c8790"}};
