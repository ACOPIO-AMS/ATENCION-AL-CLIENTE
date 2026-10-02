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
      await estadiaApi("estadiaRegistrarServiciosLote",{
        personas:eleg,
        servicios,
        responsable,
        modo,
        observacion
      });

      await cargar(true);
      reset();

      exito(
        modo==="SOLICITUD"
          ?"Requerimiento guardado correctamente"
          :"Entrega guardada correctamente"
      );

    }catch(e){
      setMsg(e instanceof Error?e.message:"Error al guardar");
    }finally{
      setLoad("");
    }
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

    return v==="ENTREGADO"
      ?"✓"
      :v==="PENDIENTE"
      ?"⏳"
      :v==="RETIRO"
      ?"✕"
      :v==="REASIGNADO"
      ?"↗"
      :"—";
  };

  const card=(c:Comida,ico:string,bg:string,bd:string)=>{

    const z=estado.resumen[c]||vacio().resumen[c];

    return(
      <div style={kpi(bg,bd)}>

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

          <span>
            Retiro/Reasig.{" "}
            <b>{z.retiro+z.reasignados}</b>
          </span>
        </div>

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
          <b>🥤 Atención de ingreso</b>

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
                  "Ingreso",
                  "Salida prevista",
                  "Permanencia",
                  "Hab.",
                  "Alimentación",
                  "Atención ingreso"
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
                    {fechaHora(x.fechaIngreso)}
                  </td>

                  <td style={td}>
                    {fechaHora(x.salidaPrevista)}
                  </td>

                  <td style={td}>
                    {duracionDesde(x.fechaIngreso)}
                  </td>

                  <td style={td}>
                    {x.habitacion||"-"}
                  </td>

                  <td style={{...td,minWidth:260}}>

                    <span>
                      Des: <b>{icono(x,"DESAYUNO")}</b>
                    </span>

                    <span style={{margin:"0 12px"}}>|</span>

                    <span>
                      Alm: <b>{icono(x,"ALMUERZO")}</b>
                    </span>

                    <span style={{margin:"0 12px"}}>|</span>

                    <span>
                      Cena: <b>{icono(x,"CENA")}</b>
                    </span>

                  </td>

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

        <div style={{
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
            3. Atención de ingreso
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
            Entregar atención de ingreso
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

    </section>
  );
}
     
         
