"use client";
export type AdminSection="panel"|"usuarios"|"registros"|"catalogos"|"auditoria";
const cards={
 panel:["Control general","Acceso administrativo a los módulos 1, 2, 3 y 4 desde la misma sesión."],
 usuarios:["Usuarios y accesos","Administración de usuarios, perfiles, activación y permisos por módulo."],
 registros:["Modificar / Anular registros","Corrección controlada de registros. Las anulaciones deben conservar trazabilidad y motivo."],
 catalogos:["Catálogos / configuración","Parámetros, responsables, conductores y configuraciones operativas."],
 auditoria:["Auditoría","Consulta de usuario, fecha, hora, valor anterior, valor nuevo y motivo de cada cambio."]
} as const;
export default function AdminPanel({section}:{section:AdminSection}){
 const [t,d]=cards[section];
 return <section style={{padding:"0 24px 28px"}}>
   <div className="form-card"><h2 style={{marginTop:0}}>{t}</h2><p>{d}</p>
   {section==="panel"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:18}}>{["ATENCIÓN AL CLIENTE","CARGOS Y SALIDAS","REGISTRO DE GUÍAS","REGISTRO RI-RM"].map((x,i)=><div key={x} style={{border:"1px solid #dce7e4",borderRadius:12,padding:16}}><b>{i+1}. {x}</b><p style={{fontSize:12}}>Acceso administrativo habilitado</p></div>)}</div>}
   {section!=="panel"&&<div style={{marginTop:18,padding:14,borderRadius:10,background:"#fff8e1",border:"1px solid #f1d78b"}}><b>Control administrativo preparado.</b><p style={{marginBottom:0}}>Las operaciones de escritura se habilitarán únicamente mediante endpoints administrativos con validación de rol y auditoría; no se hará borrado físico directo.</p></div>}
   </div>
 </section>
}
