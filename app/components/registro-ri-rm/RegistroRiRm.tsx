"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type AppUser = { user: string; name: string; role: string };
type Section = "pendientes" | "nueva-solicitud" | "mis-solicitudes" | "historial-buscar";

const SESSION_KEY = "atencion_usuario_sesion_v1";
const titles: Record<Section,string> = {
  "pendientes":"Pendientes",
  "nueva-solicitud":"Nueva solicitud",
  "mis-solicitudes":"Mis solicitudes",
  "historial-buscar":"Historial / Buscar"
};

function normalizeRole(role:string) {
  const r=String(role||"").trim().toUpperCase();
  if(r==="ADMIN") return "ADMINISTRADOR";
  if(r==="ATENCION") return "ATENCION AL CLIENTE";
  if(r==="LABORATORIO") return "ASISTENTE A4";
  return r;
}

function allowed(role:string, section:Section) {
  const r=normalizeRole(role);
  if(["ADMINISTRADOR","CHALA","ASISTENTE A4"].includes(r)) return true;
  if(["GUIAS","ATENCION AL CLIENTE"].includes(r)) return ["pendientes","historial-buscar"].includes(section);
  return false;
}

export default function RegistroRiRm() {
  const params=useSearchParams();
  const raw=params.get("seccion") as Section | null;
  const section:Section = raw && raw in titles ? raw : "pendientes";
  const [user,setUser]=useState<AppUser|null>(null);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||"null") as AppUser|null;
      setUser(saved?.user ? saved : null);
    } catch { setUser(null); }
    setReady(true);
  },[]);

  const canUse=useMemo(()=>user ? allowed(user.role,section) : false,[user,section]);

  if(!ready) return <main style={{padding:32,fontFamily:"Arial,sans-serif"}}>Cargando RI-RM…</main>;
  if(!user) return <main style={{padding:32,fontFamily:"Arial,sans-serif"}}>
    <h1>REGISTRO RI-RM</h1><p>No existe una sesión activa.</p>
    <a href="/">Volver al inicio de sesión</a>
  </main>;

  return <main style={{minHeight:"100vh",background:"#f4f7f6",fontFamily:"Arial,sans-serif",color:"#18364a"}}>
    <header style={{background:"#173f3b",color:"#fff",padding:"18px 28px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><strong style={{fontSize:18}}>AMS ACOPIO</strong><div style={{fontSize:11,opacity:.75}}>4. REGISTRO RI-RM</div></div>
      <div style={{textAlign:"right",fontSize:12}}><strong>{user.name}</strong><div>{normalizeRole(user.role)}</div></div>
    </header>

    <div style={{display:"grid",gridTemplateColumns:"260px 1fr",minHeight:"calc(100vh - 70px)"}}>
      <aside style={{background:"#fff",borderRight:"1px solid #dce5e2",padding:18}}>
        <a href="/" style={{display:"block",marginBottom:18,color:"#173f3b",fontWeight:800,textDecoration:"none"}}>← Sistema integrado</a>
        {(["pendientes","nueva-solicitud","mis-solicitudes","historial-buscar"] as Section[]).map(s=>{
          if(!allowed(user.role,s)) return null;
          return <a key={s} href={`/registro-ri-rm?seccion=${s}`} style={{
            display:"block",padding:"11px 12px",marginBottom:6,borderRadius:9,textDecoration:"none",
            background:section===s?"#e8f4f1":"transparent",color:section===s?"#12665c":"#415b59",fontWeight:section===s?900:700,fontSize:13
          }}>{titles[s]}</a>
        })}
      </aside>

      <section style={{padding:"26px 30px"}}>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:900,letterSpacing:1.2,color:"#718783"}}>REGISTRO RI-RM</div>
          <h1 style={{margin:"6px 0",fontSize:28}}>{titles[section]}</h1>
        </div>

        {!canUse ? <div style={{background:"#fff",border:"1px solid #ead0cd",borderRadius:14,padding:22}}>
          <strong>Acceso no habilitado para este perfil.</strong>
        </div> :
        <div style={{background:"#fff",border:"1px solid #dce5e2",borderRadius:14,padding:22,boxShadow:"0 8px 24px rgba(20,60,55,.06)"}}>
          <strong style={{display:"block",marginBottom:8}}>Módulo RI-RM integrado</strong>
          <p style={{margin:0,lineHeight:1.6,color:"#60716f"}}>
            La navegación y los permisos ya están conectados a la sesión del sistema principal.
            La siguiente versión conectará esta vista con los movimientos, solicitudes e historial del backend RI-RM.
          </p>
        </div>}
      </section>
    </div>
  </main>;
}
