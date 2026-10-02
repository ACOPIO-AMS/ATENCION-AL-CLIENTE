"use client";
import {useEffect,useMemo,useState} from "react";
import {btn,duracionDesde,estadiaApi,EstadiaPersona,fechaHora,input,kpi,Loader,page,panel} from "./estadiaApi";

type Comida="DESAYUNO"|"ALMUERZO"|"CENA";
type Estado={solicitados:number;entregados:number;pendientes:number;reasignados:number};
type EstadoSrv={personas:Record<string,Record<string,any>>;resumen:Record<Comida,Estado>;consumos:{AGUA:number;GASEOSA:number;GALLETAS:number}};

const COMIDAS:Comida[]=["DESAYUNO","ALMUERZO","CENA"];

const vacio=():EstadoSrv=>({
  personas:{},
  resumen:{
    DESAYUNO:{solicitados:0,entregados:0,pendientes:0,reasignados:0},
    ALMUERZO:{solicitados:0,entregados:0,pendientes:0,reasignados:0},
    CENA:{solicitados:0,entregados:0,pendientes:0,reasignados:0}
  },
  consumos:{AGUA:0,GASEOSA:0,GALLETAS:0}
});

export default function EstadiaServicios({responsable}:{responsable:string}){

  const[p,setP]=useState<EstadiaPersona[]>([]);
  const[estado,setEstado]=useState<EstadoSrv>(vacio());
  const[q,setQ]=useState("");
  const[sel,setSel]=useState<string[]>([]);

  const[sol,setSol]=useState<Record<Comida,boolean>>({
    DESAYUNO:false,
    ALMUERZO:false,
    CENA:false
  });

  const[agua,setAgua]=useState(0);
  const[gaseosa,setGaseosa]=useState(0);
  const[galletas,setGalletas]=useState(1);
  const[msg,setMsg]=useState("");
  const[load,setLoad]=useState("");
  const[ok,setOk]=useState("");
  const[hist,setHist]=useState<any[]>([]);
  const[histPersona,setHistPersona]=useState<EstadiaPersona|null>(null);
  const[detalleComida,setDetalleComida]=useState<any|null>(null);
  const[filtroComida,setFiltroComida]=useState("TODOS");
  const[filtroPresencia,setFiltroPresencia]=useState<"TODOS"|"HOY"|"ANTERIORES">("TODOS");
  const[menuComida,setMenuComida]=useState<{k:string;c:Comida}|null>(null);
  const[modalFuera,setModalFuera]=useState<{persona:EstadiaPersona;comida:Comida;observacion:string}|null>(null);
  const[modalReasignar,setModalReasignar]=useState<{persona:EstadiaPersona;comida:Comida;destinoKey:string;busqueda:string;otra:boolean;otroNombre:string;otroDni:string;observacion:string}|null>(null);

  const key=(x:EstadiaPersona)=>`${x.idIngreso}|${x.dni}`;

  const cargar=async(silencioso=false)=>{
    if(!silencioso)setLoad("Cargando información...");
    try{
      const[a,b]=await Promise.all([
        estadiaApi<EstadiaPersona[]>("estadiaListarPresentes"),
        estadiaApi<EstadoSrv>("estadiaEstadoServicios")
      ]);
      setP(a);
      setEstado(b||vacio());
    }catch(e){
      setMsg(e instanceof Error?e.message:"Error");
    }finally{
      if(!silencioso)setLoad("");
    }
  };

  useEffect(()=>{
    void cargar();
  },[]);

  const esIngresoHoy=(x:EstadiaPersona)=>{
    const d=new Date(x.fechaIngreso);
    if(Number.isNaN(d.getTime()))return false;
    const hoy=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Lima",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const fx=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Lima",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
    return fx===hoy;
  };

  const vis=useMemo(()=>{
    const z=q.toLowerCase().trim();
    return p.filter(x=>{
      const coincide=!z||[x.dni,x.nombre,x.placa,x.idIngreso].some(v=>String(v||"").toLowerCase().includes(z));
      if(!coincide)return false;
      if(filtroPresencia==="HOY")return esIngresoHoy(x);
      if(filtroPresencia==="ANTERIORES")return !esIngresoHoy(x);
      return true;
    });
  },[q,p,filtroPresencia]);

  const eleg=p.filter(x=>sel.includes(key(x)));

  const reset=()=>{
    setSel([]);
    setSol({DESAYUNO:false,ALMUERZO:false,CENA:false});
    setAgua(0);
    setGaseosa(0);
    setGalletas(1);
  };

  const exito=(t:string)=>{
    setOk(t);
    window.setTimeout(()=>setOk(""),1400);
  };

  const fechaOpTexto=(v:string)=>{
    const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||"-");
  };
  const horaTexto=(v:string)=>{ if(!v)return "—"; const d=new Date(v); return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("es-PE",{hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:"America/Lima"}).format(d); };

  async function abrirDetalleComida(servicio:Comida){
    setLoad(`Cargando detalle de ${servicio.toLowerCase()}...`);setMsg("");
    try{const d=await estadiaApi<any>("estadiaDetalleAlimentacion",{servicio});setDetalleComida(d);setFiltroComida("TODOS");}
    catch(e){setMsg(e instanceof Error?e.message:"Error al cargar detalle");}
    finally{setLoad("");}
  }

  async function guardar(
    modo:"SOLICITUD"|"ENTREGA",
    servicios:{servicio:string,cantidad:number}[]
  ){
    if(!eleg.length){
      setMsg("Selecciona al menos una persona.");
      return;
    }

    if(!servicios.length){
      setMsg("Selecciona al menos una opción.");
      return;
    }

    setMsg("");
    setLoad(
      modo==="SOLICITUD"
        ?"Guardando requerimiento..."
        :"Guardando entrega..."
    );

    try{
      let observacion="";
      if(modo==="ENTREGA"){
        const ahora=new Date(); const m=ahora.getHours()*60+ahora.getMinutes();
        const fuera=servicios.some(s=>s.servicio==="DESAYUNO"?(m<360||m>480):s.servicio==="ALMUERZO"?(m<720||m>840):s.servicio==="CENA"?(m<1080||m>1200):false);
        if(fuera){ observacion=window.prompt("La entrega está fuera del horario normal. Ingresa el motivo/observación:")?.trim()||""; if(!observacion){setLoad("");setMsg("La observación es obligatoria para entregar fuera de horario.");return;} }
      }
      const resultado=await estadiaApi<any>("estadiaRegistrarServiciosLote",{
        personas:eleg,
        servicios,
        responsable,
        modo,
        observacion
      });

      await cargar(true);
      reset();

      const dup=Array.isArray(resultado?.duplicados)?resultado.duplicados.length:0;
      exito(modo==="SOLICITUD"
        ?(dup?`Requerimiento actualizado. ${dup} duplicado(s) fueron bloqueados.`:"Requerimiento guardado correctamente")
        :"Entrega guardada correctamente");
      if(detalleComida?.servicio){ const d=await estadiaApi<any>("estadiaDetalleAlimentacion",{servicio:detalleComida.servicio}); setDetalleComida(d); }

    }catch(e){
      setMsg(e instanceof Error?e.message:"Error al guardar");
    }finally{
      setLoad("");
    }
  }

  async function verHistorial(x:EstadiaPersona){
    setLoad("Cargando historial..."); setMsg("");
    try{ const h=await estadiaApi<any[]>("estadiaHistorialPersona",{idIngreso:x.idIngreso,dni:x.dni}); setHist(h||[]); setHistPersona(x); }
    catch(e){setMsg(e instanceof Error?e.message:"Error al cargar historial");}
    finally{setLoad("");}
  }

  const icono=(x:EstadiaPersona,c:Comida)=>{
    const v=estado.personas[key(x)]?.[c];
    return v==="ENTREGADO"?"✓":v==="PENDIENTE"?"⏳":v==="RETIRO"?"✕":v==="REASIGNADO"?"↗":"—";
  };

  const estadoComida=(x:EstadiaPersona,c:Comida)=>String(estado.personas[key(x)]?.[c]||"");
  const badgeComida=(x:EstadiaPersona,c:Comida)=>{
    const v=estadoComida(x,c);
    const cfg:any=v==="ENTREGADO"?{bg:"#e3f6e9",fg:"#176b3a",t:"✓ Entregado"}:v==="PENDIENTE"?{bg:"#fff2df",fg:"#9a5a00",t:"⏳ Pendiente"}:v==="REASIGNADO"?{bg:"#e9efff",fg:"#3456a8",t:"↗ Reasignado"}:{bg:"transparent",fg:"#778",t:"—"};
    return <span style={{display:"inline-block",padding:v?"5px 8px":"0",borderRadius:8,background:cfg.bg,color:cfg.fg,fontWeight:v?700:500,fontSize:11}}>{cfg.t}</span>;
  };

  const fechaIngresoTexto=(v:string)=>{
    if(!v)return "—"; const d=new Date(v); if(Number.isNaN(d.getTime()))return "—";
    return new Intl.DateTimeFormat("es-PE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:"America/Lima"}).format(d);
  };

  const fueraHorario=(c:Comida)=>{
    const ahora=new Date(),m=ahora.getHours()*60+ahora.getMinutes();
    return c==="DESAYUNO"?(m<360||m>480):c==="ALMUERZO"?(m<720||m>840):(m<1080||m>1200);
  };

  const horarioComida=(c:Comida)=>c==="DESAYUNO"?"06:00–08:00":c==="ALMUERZO"?"12:00–14:00":"18:00–20:00";

  async function confirmarEntrega(x:EstadiaPersona,c:Comida,observacion=""){
    setLoad(`Entregando ${c.toLowerCase()}...`);setMsg("");
    try{
      await estadiaApi("estadiaRegistrarServiciosLote",{personas:[x],servicios:[{servicio:c,cantidad:1}],responsable,modo:"ENTREGA",observacion});
      await cargar(true);
      if(detalleComida?.servicio){const d=await estadiaApi<any>("estadiaDetalleAlimentacion",{servicio:detalleComida.servicio});setDetalleComida(d);}
      exito("Entrega registrada correctamente");
    }catch(e){setMsg(e instanceof Error?e.message:"Error al entregar");}
    finally{setMenuComida(null);setModalFuera(null);setLoad("");}
  }

  async function entregarUno(x:EstadiaPersona,c:Comida){
    setMenuComida(null);setMsg("");
    if(fueraHorario(c)){
      setModalFuera({persona:x,comida:c,observacion:""});
      return;
    }
    await confirmarEntrega(x,c);
  }

  function reasignarUno(x:EstadiaPersona,c:Comida){
    setMenuComida(null);setMsg("");
    setModalReasignar({persona:x,comida:c,destinoKey:"",busqueda:"",otra:false,otroNombre:"",otroDni:"",observacion:""});
  }

  async function confirmarReasignacion(){
    if(!modalReasignar)return;
    const m=modalReasignar;
    let nombre="",dni="";
    if(m.otra){
      nombre=m.otroNombre.trim().toUpperCase();
      dni=m.otroDni.replace(/\D/g,"");
      if(!nombre){setMsg("Ingresa el nombre de la persona que recibió la ración.");return;}
      if(dni && dni.length!==8){setMsg("El DNI debe tener 8 dígitos o dejarse vacío.");return;}
    }else{
      const destino=p.find(y=>key(y)===m.destinoKey);
      if(!destino){setMsg("Selecciona la persona que recibió la ración.");return;}
      nombre=destino.nombre;dni=destino.dni;
    }
    const obs=m.observacion.trim()||`Reasignado a ${nombre}`;
    setLoad("Guardando reasignación...");setMsg("");
    try{
      await estadiaApi("estadiaReasignarAlimentacion",{idIngreso:m.persona.idIngreso,dni:m.persona.dni,servicio:m.comida,entregadoA:nombre,dniDestino:dni,responsable,observacion:obs});
      await cargar(true);
      if(detalleComida?.servicio){const d=await estadiaApi<any>("estadiaDetalleAlimentacion",{servicio:detalleComida.servicio});setDetalleComida(d);}
      setModalReasignar(null);exito("Ración reasignada correctamente");
    }catch(e){setMsg(e instanceof Error?e.message:"Error al reasignar");}
    finally{setLoad("");}
  }

  const celdaComida=(x:EstadiaPersona,c:Comida)=>{
    const v=estadoComida(x,c),mk=key(x)+"|"+c;
    if(v!=="PENDIENTE")return badgeComida(x,c);
    return <div style={{position:"relative",display:"inline-block"}}>
      <button onClick={()=>setMenuComida(menuComida?.k===key(x)&&menuComida?.c===c?null:{k:key(x),c})} style={{border:0,cursor:"pointer",background:"transparent",padding:0}}>{badgeComida(x,c)}</button>
      {menuComida?.k===key(x)&&menuComida?.c===c&&<div style={{position:"absolute",zIndex:30,top:"100%",left:0,marginTop:4,background:"#fff",border:"1px solid #d9e1df",borderRadius:10,padding:6,boxShadow:"0 8px 24px rgba(0,0,0,.14)",display:"flex",gap:6}}>
        <button style={{...btn,padding:"6px 9px",fontSize:11}} onClick={()=>void entregarUno(x,c)}>✓ Entregar</button>
        <button style={{...btn,padding:"6px 9px",fontSize:11,background:"#596bd8"}} onClick={()=>void reasignarUno(x,c)}>↗ Reasignar</button>
      </div>}
    </div>;
  };

  const card=(c:Comida,ico:string,bg:string,bd:string)=>{

    const z=estado.resumen[c]||vacio().resumen[c];

    return(
      <div onClick={()=>void abrirDetalleComida(c)} title={`Ver personas de ${c.toLowerCase()}`} style={{...kpi(bg,bd),cursor:"pointer"}}>

        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:25}}>{ico}</span>
          <b>{c[0]+c.slice(1).toLowerCase()}</b>
        </div>

        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(2,1fr)",
          gap:4,
          marginTop:8,
          fontSize:12
        }}>
          <span>Solicitados <b>{z.solicitados}</b></span>
          <span>Entregados <b>{z.entregados}</b></span>

          <span>
            Pendientes{" "}
            <b style={{color:"#c43b34"}}>
              {z.pendientes}
            </b>
          </span>

          <span>Reasignados <b>{z.reasignados}</b></span>
        </div>
        <div style={{fontSize:11,marginTop:8,fontWeight:700}}>Ver personas →</div>
      </div>
    );
  };

  const th={
    textAlign:"left" as const,
    padding:"10px 9px",
    borderBottom:"1px solid #d9e1df",
    whiteSpace:"nowrap" as const,
    position:"sticky" as const,
    top:0,
    zIndex:5,
    background:"#f7faf9",
    boxShadow:"0 1px 0 #d9e1df"
  };

  const td={
    padding:"9px",
    borderBottom:"1px solid #eef2f1",
    whiteSpace:"nowrap" as const,
    verticalAlign:"middle" as const
  };

  return(
    <section style={page}>

      {load&&<Loader text={load}/>}

      {ok&&(
        <div style={{
          position:"fixed",
          inset:0,
          zIndex:10000,
          background:"rgba(8,31,36,.32)",
          display:"grid",
          placeItems:"center"
        }}>
          <div style={{
            ...panel,
            minWidth:340,
            textAlign:"center",
            border:"2px solid #65b87a"
          }}>
            <div style={{fontSize:38}}>✅</div>
            <b>{ok}</b>
            <div style={{
              fontSize:12,
              color:"#60706d",
              marginTop:6
            }}>
              La información ya fue actualizada.
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 style={{margin:0}}>
          Estadía, Servicios y Consumos
        </h1>
        <p>
          Solicita alimentación, registra la entrega real y controla consumos por persona.
        </p>
      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(205px,1fr))",
        gap:12
      }}>

        <div style={kpi("#e8f5ff","#83c5ee")}>
          <span style={{fontSize:25}}>👥</span>
          <small style={{display:"block"}}>
            Personas presentes
          </small>
          <strong style={{fontSize:31}}>
            {p.length}
          </strong>
        </div>

        {card("DESAYUNO","☕","#fff7d9","#efc84a")}
        {card("ALMUERZO","🍽️","#fff0df","#f2a24d")}
        {card("CENA","🌙","#f0ecff","#9a84e8")}

        <div style={kpi("#eaf6ff","#67a9d4")}>
          <b>🥤 Consumos de hoy</b>

          <div style={{fontSize:12,marginTop:8}}>
            💧 Agua <b>{estado.consumos.AGUA}</b>
            {" · "}
            🥤 Gaseosa <b>{estado.consumos.GASEOSA}</b>
            {" · "}
            🍪 Galletas <b>{estado.consumos.GALLETAS}</b>
          </div>
        </div>

      </div>

      <div style={panel}>

        <input
          style={input}
          placeholder="Buscar DNI, nombre, placa o ID..."
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:10}}>
          {[["TODOS","Todos los presentes"],["HOY","Ingresaron hoy"],["ANTERIORES","De días anteriores"]].map(([v,t])=>
            <button key={v} onClick={()=>setFiltroPresencia(v as "TODOS"|"HOY"|"ANTERIORES")} style={{...btn,padding:"7px 11px",background:filtroPresencia===v?"#1268c4":"#e9eff2",color:filtroPresencia===v?"#fff":"#17333a"}}>{t}</button>
          )}
        </div>

        <div style={{
          display:"flex",
          gap:10,
          alignItems:"center",
          marginTop:10
        }}>

          <label>
            <input
              type="checkbox"
              checked={
                vis.length>0&&
                vis.every(x=>sel.includes(key(x)))
              }
              onChange={e=>
                setSel(
                  e.target.checked
                    ?Array.from(new Set([...sel,...vis.map(key)]))
                    :sel.filter(k=>!vis.some(x=>key(x)===k))
                )
              }
            />{" "}
            Seleccionar todo lo visible
          </label>

          <b>{sel.length} seleccionada(s)</b>

        </div>

        <div style={{
          overflowX:"auto",
          maxHeight:430,
          marginTop:10
        }}>

          <table style={{
            width:"100%",
            minWidth:1280,
            borderCollapse:"collapse",
            fontSize:13,
            tableLayout:"auto"
          }}>

            <thead>
              <tr>
                {[
                  "",
                  "Placa",
                  "Persona",
                  "DNI",
                  "Fecha de ingreso",
                  "Permanencia",
                  "Hab.",
                  "Desayuno",
                  "Almuerzo",
                  "Cena",
                  "Consumos de hoy",
                  "Acciones"
                ].map(x=>
                  <th key={x} style={th}>
                    {x}
                  </th>
                )}
              </tr>
            </thead>

            <tbody>

              {vis.map(x=>
                <tr key={key(x)}>

                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={sel.includes(key(x))}
                      onChange={e=>
                        setSel(v=>
                          e.target.checked
                            ?Array.from(new Set([...v,key(x)]))
                            :v.filter(k=>k!==key(x))
                        )
                      }
                    />
                  </td>

                  <td style={td}>
                    {x.placa||"-"}
                  </td>

                  <td style={{...td,minWidth:240}}>
                    <b>{x.nombre}</b>
                  </td>

                  <td style={td}>
                    {x.dni}
                  </td>

                  <td style={td}>{fechaIngresoTexto(x.fechaIngreso)}</td>
                  <td style={td}>{duracionDesde(x.fechaIngreso)}</td>
                  <td style={td}>{x.habitacion||"-"}</td>

                  <td style={td}>{celdaComida(x,"DESAYUNO")}</td>
                  <td style={td}>{celdaComida(x,"ALMUERZO")}</td>
                  <td style={td}>{celdaComida(x,"CENA")}</td>

                  <td style={{...td,minWidth:190}}>

                    💧{" "}
                    <b>
                      {estado.personas[key(x)]?.AGUA||0}
                    </b>

                    &nbsp;&nbsp;

                    🥤{" "}
                    <b>
                      {estado.personas[key(x)]?.GASEOSA||0}
                    </b>

                    &nbsp;&nbsp;

                    🍪{" "}
                    <b>
                      {estado.personas[key(x)]?.GALLETAS||0}
                    </b>

                  </td>

                  <td style={td}>
                    <button style={{...btn,padding:"6px 12px",fontSize:12}} onClick={()=>void verHistorial(x)}>Ver</button>
                  </td>

                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(360px,1fr))",gap:14}}>
        <div style={{...panel,background:"#fff9e8"}}>
          <h3 style={{marginTop:0}}>🍽️ Solicitar alimentación</h3>
          <div style={{fontSize:13,marginBottom:9}}><b>{sel.length}</b> persona(s) seleccionada(s)</div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {COMIDAS.map(c=><label key={c} style={{fontWeight:700}}><input type="checkbox" checked={sol[c]} onChange={e=>setSol(v=>({...v,[c]:e.target.checked}))}/> {c[0]+c.slice(1).toLowerCase()}</label>)}
          </div>
          <button disabled={!!load||!sel.length} style={{...btn,marginTop:12}} onClick={()=>void guardar("SOLICITUD",COMIDAS.filter(c=>sol[c]).map(c=>({servicio:c,cantidad:1})))}>Solicitar alimentación</button>
        </div>

        <div style={{...panel,background:"#edf7ff"}}>
          <h3 style={{marginTop:0}}>🥤 Registrar consumos</h3>
          <div style={{fontSize:13,marginBottom:10}}><b>{sel.length}</b> persona(s) seleccionada(s) · cantidad para cada persona</div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"end"}}>
            {[["💧 Agua",agua,setAgua],["🥤 Gaseosa",gaseosa,setGaseosa],["🍪 Galletas",galletas,setGalletas]].map(([lab,val,setter]:any)=><div key={lab} style={{minWidth:125}}><b style={{fontSize:12}}>{lab}</b><div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}><button style={{...btn,padding:"5px 9px"}} onClick={()=>setter(Math.max(0,val-1))}>−</button><strong style={{minWidth:20,textAlign:"center"}}>{val}</strong><button style={{...btn,padding:"5px 9px"}} onClick={()=>setter(val+1)}>+</button></div></div>)}
          </div>
          <button disabled={!!load||!sel.length} style={{...btn,marginTop:12}} onClick={()=>void guardar("ENTREGA",[{servicio:"AGUA",cantidad:agua},{servicio:"GASEOSA",cantidad:gaseosa},{servicio:"GALLETAS",cantidad:galletas}].filter(x=>x.cantidad>0))}>Registrar consumos</button>
        </div>
      </div>

      {msg&&(
        <div
          style={{
            ...panel,
            borderColor:"#d86a61",
            background:"#fff4f2"
          }}
        >
          {msg}
        </div>
      )}

      {modalFuera&&<div style={{position:"fixed",inset:0,zIndex:10020,background:"rgba(5,28,34,.58)",display:"grid",placeItems:"center",padding:20}}>
        <div style={{...panel,width:"min(560px,96vw)",padding:22}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}><div style={{fontSize:34}}>⏰</div><div><h2 style={{margin:0}}>Entrega fuera de horario</h2><div style={{color:"#60706d",marginTop:3}}>{modalFuera.comida[0]+modalFuera.comida.slice(1).toLowerCase()} · horario {horarioComida(modalFuera.comida)}</div></div></div>
          <div style={{marginTop:16,padding:12,borderRadius:10,background:"#f4f8f7"}}><b>{modalFuera.persona.nombre}</b><div style={{fontSize:12,color:"#60706d"}}>DNI {modalFuera.persona.dni} · {modalFuera.persona.placa||"Sin placa"}</div></div>
          <label style={{display:"block",fontWeight:700,marginTop:16}}>Motivo / observación <span style={{color:"#c43b34"}}>*</span></label>
          <textarea autoFocus rows={4} value={modalFuera.observacion} onChange={e=>setModalFuera({...modalFuera,observacion:e.target.value})} placeholder="Ej.: La persona llegó después del horario establecido..." style={{...input,resize:"vertical",marginTop:6}}/>
          <div style={{fontSize:11,color:"#60706d",marginTop:6}}>La entrega quedará registrada como fuera de horario con fecha, hora y responsable.</div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginTop:18}}><button style={{...btn,background:"#687775"}} onClick={()=>setModalFuera(null)}>Cancelar</button><button disabled={!modalFuera.observacion.trim()||!!load} style={{...btn,opacity:modalFuera.observacion.trim()?1:.55}} onClick={()=>void confirmarEntrega(modalFuera.persona,modalFuera.comida,modalFuera.observacion.trim())}>✓ Confirmar entrega</button></div>
        </div>
      </div>}

      {modalReasignar&&<div style={{position:"fixed",inset:0,zIndex:10021,background:"rgba(5,28,34,.62)",display:"grid",placeItems:"center",padding:20}}>
        <div style={{...panel,width:"min(720px,97vw)",maxHeight:"90vh",overflow:"auto",padding:22}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><h2 style={{margin:0}}>↗ Reasignar alimentación</h2><p style={{margin:"5px 0 0",color:"#60706d"}}>{modalReasignar.comida[0]+modalReasignar.comida.slice(1).toLowerCase()} solicitado para <b>{modalReasignar.persona.nombre}</b></p></div><button style={{...btn,background:"#687775",padding:"7px 11px"}} onClick={()=>setModalReasignar(null)}>✕</button></div>
          <div style={{marginTop:15,padding:12,borderRadius:10,background:"#fff7e8",border:"1px solid #f1d397"}}><small>SOLICITADO PARA</small><div><b>{modalReasignar.persona.nombre}</b> · DNI {modalReasignar.persona.dni}</div></div>
          <div style={{display:"flex",gap:8,marginTop:16}}><button style={{...btn,background:!modalReasignar.otra?"#1268c4":"#e9eff2",color:!modalReasignar.otra?"#fff":"#17333a"}} onClick={()=>setModalReasignar({...modalReasignar,otra:false})}>👤 Persona presente</button><button style={{...btn,background:modalReasignar.otra?"#1268c4":"#e9eff2",color:modalReasignar.otra?"#fff":"#17333a"}} onClick={()=>setModalReasignar({...modalReasignar,otra:true,destinoKey:""})}>＋ Otra persona</button></div>
          {!modalReasignar.otra?<>
            <input style={{...input,marginTop:12}} placeholder="Buscar por nombre, DNI o placa..." value={modalReasignar.busqueda} onChange={e=>setModalReasignar({...modalReasignar,busqueda:e.target.value})}/>
            <div style={{display:"grid",gap:7,marginTop:9,maxHeight:260,overflow:"auto"}}>
              {p.filter(y=>key(y)!==key(modalReasignar.persona)).filter(y=>{const z=modalReasignar.busqueda.toLowerCase().trim();return !z||[y.nombre,y.dni,y.placa].some(v=>String(v||"").toLowerCase().includes(z));}).map(y=><button key={key(y)} onClick={()=>setModalReasignar({...modalReasignar,destinoKey:key(y)})} style={{textAlign:"left",padding:11,borderRadius:10,cursor:"pointer",border:modalReasignar.destinoKey===key(y)?"2px solid #1268c4":"1px solid #d9e1df",background:modalReasignar.destinoKey===key(y)?"#eaf4ff":"#fff"}}><b>{y.nombre}</b><div style={{fontSize:11,color:"#60706d",marginTop:2}}>DNI {y.dni} · {y.placa||"Sin placa"}{y.habitacion?` · Hab. ${y.habitacion}`:""}</div></button>)}
            </div>
          </>:<div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,marginTop:12}}><div><label style={{fontWeight:700,fontSize:12}}>Nombre y apellidos *</label><input style={{...input,marginTop:5}} value={modalReasignar.otroNombre} onChange={e=>setModalReasignar({...modalReasignar,otroNombre:e.target.value})} placeholder="Nombre de quien recibió"/></div><div><label style={{fontWeight:700,fontSize:12}}>DNI (opcional)</label><input style={{...input,marginTop:5}} maxLength={8} value={modalReasignar.otroDni} onChange={e=>setModalReasignar({...modalReasignar,otroDni:e.target.value.replace(/\D/g,"").slice(0,8)})} placeholder="8 dígitos"/></div></div>}
          <label style={{display:"block",fontWeight:700,marginTop:15}}>Motivo / observación</label><textarea rows={3} value={modalReasignar.observacion} onChange={e=>setModalReasignar({...modalReasignar,observacion:e.target.value})} placeholder="Ej.: El titular se retiró antes de recibir la ración." style={{...input,resize:"vertical",marginTop:6}}/>
          <div style={{marginTop:13,padding:11,borderRadius:10,background:"#eef6ff",fontSize:12}}><b>Trazabilidad:</b> {modalReasignar.persona.nombre} → {modalReasignar.otra?(modalReasignar.otroNombre.trim()||"Otra persona"):(p.find(y=>key(y)===modalReasignar.destinoKey)?.nombre||"Selecciona un destinatario")}</div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginTop:18}}><button style={{...btn,background:"#687775"}} onClick={()=>setModalReasignar(null)}>Cancelar</button><button disabled={!!load||(!modalReasignar.otra&&!modalReasignar.destinoKey)||(modalReasignar.otra&&!modalReasignar.otroNombre.trim())} style={{...btn,background:"#596bd8"}} onClick={()=>void confirmarReasignacion()}>↗ Confirmar reasignación</button></div>
        </div>
      </div>}

      {detalleComida&&<div style={{position:"fixed",inset:0,zIndex:10002,background:"rgba(5,28,34,.58)",display:"grid",placeItems:"center",padding:20}}><div style={{...panel,width:"min(1050px,97vw)",maxHeight:"88vh",overflow:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><div><h2 style={{margin:0}}>🍽️ Detalle de {String(detalleComida.servicio||"").toLowerCase()} — {fechaOpTexto(detalleComida.fechaOperativa)}</h2><p style={{margin:"5px 0 12px",color:"#60706d"}}>Personas para quienes se solicitó esta comida y su estado real.</p></div><button style={{...btn,background:"#687775"}} onClick={()=>setDetalleComida(null)}>Cerrar</button></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(110px,1fr))",gap:8,marginBottom:12}}>{[["Solicitados",detalleComida.resumen?.solicitados],["Entregados",detalleComida.resumen?.entregados],["Pendientes",detalleComida.resumen?.pendientes],["Reasignados",detalleComida.resumen?.reasignados]].map(([a,b])=><div key={String(a)} style={{...panel,padding:10}}><small>{a}</small><div style={{fontSize:22,fontWeight:800}}>{b||0}</div></div>)}</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>{["TODOS","PENDIENTE","ENTREGADO","REASIGNADO"].map(f=><button key={f} style={{...btn,background:filtroComida===f?"#1268c4":"#e9eff2",color:filtroComida===f?"white":"#17333a",padding:"7px 10px"}} onClick={()=>setFiltroComida(f)}>{f}</button>)}</div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr><th style={th}>Placa</th><th style={th}>Persona</th><th style={th}>Hab.</th><th style={th}>Estado</th><th style={th}>Hora</th><th style={th}>Acción</th></tr></thead><tbody>{(detalleComida.personas||[]).filter((x:any)=>filtroComida==="TODOS"||x.estado===filtroComida).map((x:any)=><tr key={`${x.idIngreso}|${x.dni}`}><td style={td}>{x.placa||"-"}</td><td style={td}><b>{x.nombre}</b><div style={{fontSize:11,color:"#667"}}>DNI {x.dni}</div></td><td style={td}>{x.habitacion||"-"}</td><td style={td}><b>{x.estado}</b>{x.entregadoA&&<div style={{fontSize:11}}>A: {x.entregadoA}</div>}</td><td style={td}>{horaTexto(x.hora)}</td><td style={td}>{x.estado==="PENDIENTE"&&x.presente?<div style={{display:"flex",gap:6}}><button style={{...btn,padding:"6px 10px"}} onClick={()=>{const persona=p.find(y=>y.idIngreso===x.idIngreso&&y.dni===x.dni);if(persona)void entregarUno(persona,detalleComida.servicio as Comida);}}>Entregar</button><button style={{...btn,padding:"6px 10px",background:"#596bd8"}} onClick={()=>{const persona=p.find(y=>y.idIngreso===x.idIngreso&&y.dni===x.dni);if(persona)void reasignarUno(persona,detalleComida.servicio as Comida);}}>Reasignar</button></div>:<button style={{...btn,padding:"6px 10px",background:"#687775"}} onClick={()=>{const persona=p.find(y=>y.idIngreso===x.idIngreso&&y.dni===x.dni);if(persona){setDetalleComida(null);void verHistorial(persona);}}}>Ver</button>}</td></tr>)}</tbody></table></div>
      </div></div>}

      {histPersona&&<div style={{position:"fixed",inset:0,zIndex:10001,background:"rgba(5,28,34,.55)",display:"grid",placeItems:"center",padding:20}}><div style={{...panel,width:"min(1000px,96vw)",maxHeight:"88vh",overflow:"auto"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><h2 style={{margin:0}}>Historial de servicios y consumos</h2><p style={{margin:"5px 0 12px"}}><b>{histPersona.nombre}</b> · DNI {histPersona.dni} · Hab. {histPersona.habitacion||"-"}</p></div><button style={{...btn,background:"#687775"}} onClick={()=>{setHistPersona(null);setHist([])}}>Cerrar</button></div>
        <div style={{display:"grid",gap:10}}>{Object.entries(hist.reduce((acc:any,h:any)=>{const f=String(h.fechaOperativa||"");if(!acc[f])acc[f]=[];acc[f].push(h);return acc;},{} as Record<string,any[]>)).sort(([a],[b])=>String(b).localeCompare(String(a))).map(([f,movs]:any)=>{const estado=(c:string)=>{const a=movs.filter((h:any)=>h.servicio===c);if(a.some((h:any)=>h.estado==="ENTREGADO"))return "✓ Entregado";if(a.some((h:any)=>String(h.estado).includes("REASIGN")))return "↗ Reasignado";if(a.some((h:any)=>h.estado==="SOLICITADO"))return "⏳ Pendiente";return "—";};const suma=(c:string)=>movs.filter((h:any)=>h.servicio===c&&["ENTREGADO","ATENDIDO"].includes(h.estado)).reduce((n:number,h:any)=>n+(Number(h.cantidad)||0),0);return <div key={f} style={{...panel,padding:12}}><b style={{fontSize:15}}>{fechaOpTexto(f)}</b><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:8,fontSize:12}}><div>☕ Desayuno<br/><b>{estado("DESAYUNO")}</b></div><div>🍽️ Almuerzo<br/><b>{estado("ALMUERZO")}</b></div><div>🌙 Cena<br/><b>{estado("CENA")}</b></div><div>💧 Agua <b>{suma("AGUA")}</b> · 🥤 <b>{suma("GASEOSA")}</b> · 🍪 <b>{suma("GALLETAS")}</b></div></div><details style={{marginTop:9}}><summary style={{cursor:"pointer",fontWeight:700}}>Ver detalle de movimientos</summary><div style={{overflowX:"auto",marginTop:8}}><table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}><thead><tr><th style={th}>Hora</th><th style={th}>Servicio</th><th style={th}>Cant.</th><th style={th}>Estado</th><th style={th}>Responsable</th><th style={th}>Observación</th></tr></thead><tbody>{movs.map((h:any,i:number)=><tr key={i}><td style={td}>{horaTexto(h.fechaHora)}</td><td style={td}><b>{h.servicio}</b></td><td style={td}>{h.cantidad}</td><td style={td}>{h.estado}</td><td style={td}>{h.responsable||"-"}</td><td style={td}>{h.observacion||"-"}{h.entregadoA?` · Entregado a: ${h.entregadoA}`:""}</td></tr>)}</tbody></table></div></details></div>})}</div>
      </div></div>}


    </section>
  );
}
     
         
