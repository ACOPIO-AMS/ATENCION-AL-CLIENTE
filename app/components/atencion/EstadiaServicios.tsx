"use client";
import {useEffect,useMemo,useState} from "react";
import {btn,duracionDesde,estadiaApi,EstadiaPersona,fechaHora,input,kpi,Loader,page,panel} from "./estadiaApi";

type Comida="DESAYUNO"|"ALMUERZO"|"CENA";
type Estado={solicitados:number;entregados:number;pendientes:number;retiro:number;reasignados:number};
type EstadoSrv={personas:Record<string,Record<string,any>>;resumen:Record<Comida,Estado>;consumos:{AGUA:number;GASEOSA:number;GALLETAS:number}};

const COMIDAS:Comida[]=["DESAYUNO","ALMUERZO","CENA"];

const vacio=():EstadoSrv=>({
  personas:{},
  resumen:{
    DESAYUNO:{solicitados:0,entregados:0,pendientes:0,retiro:0,reasignados:0},
    ALMUERZO:{solicitados:0,entregados:0,pendientes:0,retiro:0,reasignados:0},
    CENA:{solicitados:0,entregados:0,pendientes:0,retiro:0,reasignados:0}
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

  const[ent,setEnt]=useState<Record<Comida,boolean>>({
    DESAYUNO:false,
    ALMUERZO:false,
    CENA:false
  });

  const[agua,setAgua]=useState(0);
  const[gaseosa,setGaseosa]=useState(0);
  const[galletas,setGalletas]=useState(1);
  const[salida,setSalida]=useState("");
  const[msg,setMsg]=useState("");
  const[load,setLoad]=useState("");
  const[ok,setOk]=useState("");
  const[hist,setHist]=useState<any[]>([]);
  const[histPersona,setHistPersona]=useState<EstadiaPersona|null>(null);
  const[detalleComida,setDetalleComida]=useState<any|null>(null);
  const[filtroComida,setFiltroComida]=useState("TODOS");

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

  const vis=useMemo(()=>{
    const z=q.toLowerCase().trim();
    return !z?p:p.filter(x=>
      [x.dni,x.nombre,x.placa,x.idIngreso].some(v=>
        String(v||"").toLowerCase().includes(z)
      )
    );
  },[q,p]);

  const eleg=p.filter(x=>sel.includes(key(x)));

  const reset=()=>{
    setSel([]);
    setSol({DESAYUNO:false,ALMUERZO:false,CENA:false});
    setEnt({DESAYUNO:false,ALMUERZO:false,CENA:false});
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

  async function prevista(){

    if(eleg.length!==1||!salida){
      setMsg("Selecciona una sola persona y fecha/hora.");
      return;
    }

    setMsg("");
    setLoad("Guardando salida prevista...");

    try{

      await estadiaApi("estadiaActualizarSalidaPrevista",{
        idIngreso:eleg[0].idIngreso,
        dni:eleg[0].dni,
        salidaPrevista:salida,
        responsable
      });

      setSalida("");
      setSel([]);

      await cargar(true);

      exito("Salida prevista guardada correctamente");

    }catch(e){

      setMsg(e instanceof Error?e.message:"Error");

    }finally{

      setLoad("");

    }
  }

  const icono=(x:EstadiaPersona,c:Comida)=>{
    const v=estado.personas[key(x)]?.[c];
    return v==="ENTREGADO"?"✓":v==="PENDIENTE"?"⏳":v==="RETIRO"?"✕":v==="REASIGNADO"?"↗":"—";
  };

  const estadoComida=(x:EstadiaPersona,c:Comida)=>String(estado.personas[key(x)]?.[c]||"");
  const badgeComida=(x:EstadiaPersona,c:Comida)=>{
    const v=estadoComida(x,c);
    const cfg:any=v==="ENTREGADO"?{bg:"#e3f6e9",fg:"#176b3a",t:"✓ Entregado"}:v==="PENDIENTE"?{bg:"#fff2df",fg:"#9a5a00",t:"⏳ Pendiente"}:v==="REASIGNADO"?{bg:"#e9efff",fg:"#3456a8",t:"↗ Reasignado"}:v==="RETIRO"?{bg:"#f3f4f5",fg:"#5d6568",t:"✕ No entregado"}:{bg:"transparent",fg:"#778",t:"—"};
    return <span style={{display:"inline-block",padding:v?"5px 8px":"0",borderRadius:8,background:cfg.bg,color:cfg.fg,fontWeight:v?700:500,fontSize:11}}>{cfg.t}</span>;
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
          <span>No entregados <b>{z.retiro}</b></span>
        </div>
        <div style={{fontSize:11,marginTop:8,fontWeight:700}}>Ver personas →</div>
      </div>
    );
  };

  const th={
    textAlign:"left" as const,
    padding:"10px 9px",
    borderBottom:"1px solid #d9e1df",
    whiteSpace:"nowrap" as const
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
                  "Permanencia",
                  "Hab.",
                  "Desayuno",
                  "Almuerzo",
                  "Cena",
                  "Consumos de hoy",
                  "Salida prevista",
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

                  <td style={td}>
                    {duracionDesde(x.fechaIngreso)}
                  </td>

                  <td style={td}>
                    {x.habitacion||"-"}
                  </td>

                  <td style={td}>{badgeComida(x,"DESAYUNO")}</td>
                  <td style={td}>{badgeComida(x,"ALMUERZO")}</td>
                  <td style={td}>{badgeComida(x,"CENA")}</td>

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

                  <td style={td}>{fechaHora(x.salidaPrevista)}</td>
                  <td style={td}>
                    <button style={{...btn,padding:"6px 12px",fontSize:12}} onClick={()=>void verHistorial(x)}>Ver</button>
                  </td>

                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",
        gap:14
      }}>

        <div style={{
          ...panel,
          background:"#fff9e8"
        }}>

          <h3>
            1. Registrar requerimiento de alimentación
          </h3>

          <p style={{fontSize:13}}>
            Marca lo que fue solicitado para las personas seleccionadas.
          </p>

          {COMIDAS.map(c=>
            <label
              key={c}
              style={{
                display:"block",
                padding:6
              }}
            >
              <input
                type="checkbox"
                checked={sol[c]}
                onChange={e=>
                  setSol(v=>({
                    ...v,
                    [c]:e.target.checked
                  }))
                }
              />{" "}
              {c}
            </label>
          )}

          <button
            disabled={!!load}
            style={{
              ...btn,
              marginTop:8
            }}
            onClick={()=>
              void guardar(
                "SOLICITUD",
                COMIDAS
                  .filter(c=>sol[c])
                  .map(c=>({
                    servicio:c,
                    cantidad:1
                  }))
              )
            }
          >
            Registrar requerimiento
          </button>

        </div>

        <div id="entrega-alimentacion" style={{
          ...panel,
          background:"#edf8f0"
        }}>

          <h3>
            2. Registrar entrega de alimentación
          </h3>

          <p style={{fontSize:13}}>
            Marca solo la comida que realmente recibió cada persona.
          </p>

          {COMIDAS.map(c=>
            <label
              key={c}
              style={{
                display:"block",
                padding:6
              }}
            >
              <input
                type="checkbox"
                checked={ent[c]}
                onChange={e=>
                  setEnt(v=>({
                    ...v,
                    [c]:e.target.checked
                  }))
                }
              />{" "}
              {c}
            </label>
          )}

          <button
            disabled={!!load}
            style={{
              ...btn,
              marginTop:8
            }}
            onClick={()=>
              void guardar(
                "ENTREGA",
                COMIDAS
                  .filter(c=>ent[c])
                  .map(c=>({
                    servicio:c,
                    cantidad:1
                  }))
              )
            }
          >
            Entregar alimentación
          </button>

        </div>

        <div style={{
          ...panel,
          background:"#edf7ff"
        }}>

          <h3>
            3. Consumos
          </h3>

          <p style={{fontSize:13}}>
            Agua y gaseosa pueden entregarse juntas. Cantidad aplicada a cada persona seleccionada.
          </p>

          <label style={{
            display:"grid",
            gridTemplateColumns:"1fr 90px",
            gap:8,
            alignItems:"center",
            marginBottom:8
          }}>
            💧 Agua

            <input
              style={input}
              type="number"
              min="0"
              value={agua}
              onChange={e=>
                setAgua(
                  Math.max(
                    0,
                    Number(e.target.value)||0
                  )
                )
              }
            />
          </label>

          <label style={{
            display:"grid",
            gridTemplateColumns:"1fr 90px",
            gap:8,
            alignItems:"center",
            marginBottom:8
          }}>
            🥤 Gaseosa

            <input
              style={input}
              type="number"
              min="0"
              value={gaseosa}
              onChange={e=>
                setGaseosa(
                  Math.max(
                    0,
                    Number(e.target.value)||0
                  )
                )
              }
            />
          </label>

          <label style={{
            display:"grid",
            gridTemplateColumns:"1fr 90px",
            gap:8,
            alignItems:"center",
            marginBottom:8
          }}>
            🍪 Galleta

            <input
              style={input}
              type="number"
              min="0"
              value={galletas}
              onChange={e=>
                setGalletas(
                  Math.max(
                    0,
                    Number(e.target.value)||0
                  )
                )
              }
            />
          </label>

          <button
            disabled={!!load}
            style={btn}
            onClick={()=>
              void guardar(
                "ENTREGA",
                [
                  {
                    servicio:"AGUA",
                    cantidad:agua
                  },
                  {
                    servicio:"GASEOSA",
                    cantidad:gaseosa
                  },
                  {
                    servicio:"GALLETAS",
                    cantidad:galletas
                  }
                ].filter(x=>x.cantidad>0)
              )
            }
          >
            Registrar consumos
          </button>

        </div>

      </div>

      <div style={panel}>

        <h3>
          Salida prevista
        </h3>

        <div style={{
          display:"flex",
          gap:10,
          flexWrap:"wrap"
        }}>

          <input
            style={{
              ...input,
              maxWidth:300
            }}
            type="datetime-local"
            value={salida}
            onChange={e=>setSalida(e.target.value)}
          />

          <button
            disabled={!!load}
            style={btn}
            onClick={()=>void prevista()}
          >
            Guardar salida prevista
          </button>

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

      {detalleComida&&<div style={{position:"fixed",inset:0,zIndex:10002,background:"rgba(5,28,34,.58)",display:"grid",placeItems:"center",padding:20}}><div style={{...panel,width:"min(1050px,97vw)",maxHeight:"88vh",overflow:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><div><h2 style={{margin:0}}>🍽️ Detalle de {String(detalleComida.servicio||"").toLowerCase()} — {fechaOpTexto(detalleComida.fechaOperativa)}</h2><p style={{margin:"5px 0 12px",color:"#60706d"}}>Personas para quienes se solicitó esta comida y su estado real.</p></div><button style={{...btn,background:"#687775"}} onClick={()=>setDetalleComida(null)}>Cerrar</button></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(110px,1fr))",gap:8,marginBottom:12}}>{[["Solicitados",detalleComida.resumen?.solicitados],["Entregados",detalleComida.resumen?.entregados],["Pendientes",detalleComida.resumen?.pendientes],["Reasignados",detalleComida.resumen?.reasignados],["No entregados",detalleComida.resumen?.retiro]].map(([a,b])=><div key={String(a)} style={{...panel,padding:10}}><small>{a}</small><div style={{fontSize:22,fontWeight:800}}>{b||0}</div></div>)}</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>{["TODOS","PENDIENTE","ENTREGADO","REASIGNADO","NO ENTREGADO - RETIRO"].map(f=><button key={f} style={{...btn,background:filtroComida===f?"#1268c4":"#e9eff2",color:filtroComida===f?"white":"#17333a",padding:"7px 10px"}} onClick={()=>setFiltroComida(f)}>{f}</button>)}</div>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr><th style={th}>Placa</th><th style={th}>Persona</th><th style={th}>Hab.</th><th style={th}>Estado</th><th style={th}>Hora</th><th style={th}>Acción</th></tr></thead><tbody>{(detalleComida.personas||[]).filter((x:any)=>filtroComida==="TODOS"||x.estado===filtroComida).map((x:any)=><tr key={`${x.idIngreso}|${x.dni}`}><td style={td}>{x.placa||"-"}</td><td style={td}><b>{x.nombre}</b><div style={{fontSize:11,color:"#667"}}>DNI {x.dni}</div></td><td style={td}>{x.habitacion||"-"}</td><td style={td}><b>{x.estado}</b>{x.entregadoA&&<div style={{fontSize:11}}>A: {x.entregadoA}</div>}</td><td style={td}>{horaTexto(x.hora)}</td><td style={td}>{x.estado==="PENDIENTE"&&x.presente?<button style={{...btn,padding:"6px 10px"}} onClick={async()=>{const persona=p.find(y=>y.idIngreso===x.idIngreso&&y.dni===x.dni);if(!persona)return;setSel([key(persona)]);setEnt({DESAYUNO:false,ALMUERZO:false,CENA:false,[detalleComida.servicio]:true} as Record<Comida,boolean>);setDetalleComida(null);window.setTimeout(()=>document.getElementById("entrega-alimentacion")?.scrollIntoView({behavior:"smooth",block:"center"}),50);}}>Entregar</button>:<button style={{...btn,padding:"6px 10px",background:"#687775"}} onClick={()=>{const persona=p.find(y=>y.idIngreso===x.idIngreso&&y.dni===x.dni);if(persona){setDetalleComida(null);void verHistorial(persona);}}}>Ver</button>}</td></tr>)}</tbody></table></div>
      </div></div>}

      {histPersona&&<div style={{position:"fixed",inset:0,zIndex:10001,background:"rgba(5,28,34,.55)",display:"grid",placeItems:"center",padding:20}}><div style={{...panel,width:"min(1000px,96vw)",maxHeight:"88vh",overflow:"auto"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><div><h2 style={{margin:0}}>Historial de servicios y consumos</h2><p style={{margin:"5px 0 12px"}}><b>{histPersona.nombre}</b> · DNI {histPersona.dni} · Hab. {histPersona.habitacion||"-"}</p></div><button style={{...btn,background:"#687775"}} onClick={()=>{setHistPersona(null);setHist([])}}>Cerrar</button></div>
        <div style={{display:"grid",gap:10}}>{Object.entries(hist.reduce((acc:any,h:any)=>{const f=String(h.fechaOperativa||"");if(!acc[f])acc[f]=[];acc[f].push(h);return acc;},{} as Record<string,any[]>)).sort(([a],[b])=>String(b).localeCompare(String(a))).map(([f,movs]:any)=>{const estado=(c:string)=>{const a=movs.filter((h:any)=>h.servicio===c);if(a.some((h:any)=>h.estado==="ENTREGADO"))return "✓ Entregado";if(a.some((h:any)=>String(h.estado).includes("REASIGN")))return "↗ Reasignado";if(a.some((h:any)=>String(h.estado).includes("RETIRO")))return "✕ No entregado";if(a.some((h:any)=>h.estado==="SOLICITADO"))return "⏳ Pendiente";return "—";};const suma=(c:string)=>movs.filter((h:any)=>h.servicio===c&&["ENTREGADO","ATENDIDO"].includes(h.estado)).reduce((n:number,h:any)=>n+(Number(h.cantidad)||0),0);return <div key={f} style={{...panel,padding:12}}><b style={{fontSize:15}}>{fechaOpTexto(f)}</b><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginTop:8,fontSize:12}}><div>☕ Desayuno<br/><b>{estado("DESAYUNO")}</b></div><div>🍽️ Almuerzo<br/><b>{estado("ALMUERZO")}</b></div><div>🌙 Cena<br/><b>{estado("CENA")}</b></div><div>💧 Agua <b>{suma("AGUA")}</b> · 🥤 <b>{suma("GASEOSA")}</b> · 🍪 <b>{suma("GALLETAS")}</b></div></div><details style={{marginTop:9}}><summary style={{cursor:"pointer",fontWeight:700}}>Ver detalle de movimientos</summary><div style={{overflowX:"auto",marginTop:8}}><table style={{width:"100%",fontSize:11,borderCollapse:"collapse"}}><thead><tr><th style={th}>Hora</th><th style={th}>Servicio</th><th style={th}>Cant.</th><th style={th}>Estado</th><th style={th}>Responsable</th><th style={th}>Observación</th></tr></thead><tbody>{movs.map((h:any,i:number)=><tr key={i}><td style={td}>{horaTexto(h.fechaHora)}</td><td style={td}><b>{h.servicio}</b></td><td style={td}>{h.cantidad}</td><td style={td}>{h.estado}</td><td style={td}>{h.responsable||"-"}</td><td style={td}>{h.observacion||"-"}{h.entregadoA?` · Entregado a: ${h.entregadoA}`:""}</td></tr>)}</tbody></table></div></details></div>})}</div>
      </div></div>}


    </section>
  );
}
     
         
