"use client";

import {useEffect,useMemo,useState} from "react";
import {estadiaApi,fechaHora,input,kpi,Loader,page,panel} from "./estadiaApi";

type Comida="DESAYUNO"|"ALMUERZO"|"CENA";

type EstadoAlimentacion={
  solicitados:number;
  entregados:number;
  pendientes:number;
  reasignados:number;
  retiro?:number;
  fueraHorario?:number;
};

type PersonaPeriodo={
  idIngreso:string;
  dni:string;
  nombre:string;
  placa?:string;
  proveedor?:string;
  habitacion?:string;
  fechaIngreso:string;
  fechaSalida?:string;
  salidaPrevista?:string;
  zona?:string;
  estado?:string;
  estadoPeriodo?:string;
  ingresoPeriodo?:boolean;
  salidaPeriodo?:boolean;
  permanece?:boolean;
  alimentacion?:Partial<Record<Comida,string>>;
  consumos?:Record<string,number>;
};

type Reasignacion={
  id?:string;
  fechaHora?:string;
  fechaOperativa?:string;
  turno?:string;
  guardia?:string;
  servicio:string;
  idIngreso?:string;
  dniSolicitante?:string;
  original:string;
  dniDestino:string;
  entregadoA:string;
  observacion?:string;
  usuario?:string;
  zona?:string;
  placa?:string;
  proveedor?:string;
};

type Resumen={
  desde:string;
  hasta:string;
  personasRecibidas:number;
  personasSalieron:number;
  personasPresentes:number;
  desayunos:number;
  almuerzos:number;
  cenas:number;
  agua:number;
  gaseosa:number;
  galletas:number;
  papel:number;
  shampoo:number;
  jabon:number;
  alimentacion:Record<Comida,EstadoAlimentacion>;
  reasignaciones?:Reasignacion[];
  habitaciones:{
    disponibles:number;
    ocupadas:number;
    reservadas:number;
    porLimpiar:number;
    fueraServicio:number;
  };
  presentes:PersonaPeriodo[];
  personasPeriodo?:PersonaPeriodo[];
  ingresosPorFecha?:{fecha:string;cantidad:number}[];
};

function Grafico({data=[]}:{data?:{fecha:string;cantidad:number}[]}){
  if(!data.length){
    return <div style={{padding:22,textAlign:"center",color:"#60706d"}}>
      Sin ingresos para el periodo seleccionado.
    </div>;
  }

  const w=900;
  const h=230;
  const pad=38;
  const max=Math.max(1,...data.map(x=>x.cantidad));
  const pts=data.map((x,i)=>{
    const cx=pad+(data.length===1?0:i*(w-pad*2)/(data.length-1));
    const cy=h-pad-x.cantidad*(h-pad*2)/max;
    return `${cx},${cy}`;
  }).join(" ");

  return <div style={{overflowX:"auto"}}>
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",minWidth:620,height:240}}>
      <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="currentColor" opacity=".25"/>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3"/>
      {data.map((x,i)=>{
        const cx=pad+(data.length===1?0:i*(w-pad*2)/(data.length-1));
        const cy=h-pad-x.cantidad*(h-pad*2)/max;
        return <g key={x.fecha}>
          <circle cx={cx} cy={cy} r="5" fill="currentColor"/>
          <text x={cx} y={cy-10} textAnchor="middle" fontSize="12">{x.cantidad}</text>
          <text x={cx} y={h-12} textAnchor="middle" fontSize="11">{x.fecha.slice(5)}</text>
        </g>;
      })}
    </svg>
  </div>;
}

function duracionPeriodo(x:PersonaPeriodo,hasta:string){
  const inicio=new Date(x.fechaIngreso).getTime();
  if(Number.isNaN(inicio))return "—";

  let fin:number;

  if(x.fechaSalida){
    fin=new Date(x.fechaSalida).getTime();
  }else{
    const limite=new Date(`${hasta}T23:59:59`).getTime();
    fin=Math.min(Date.now(),limite);
  }

  if(Number.isNaN(fin))return "—";

  const m=Math.max(0,Math.floor((fin-inicio)/60000));
  return `${Math.floor(m/60)} h ${m%60} min`;
}

function etiquetaConsumo(k:string){
  return k
    .replace("PAPEL HIGIÉNICO","Papel")
    .replace("SHAMPOO","Shampoo")
    .replace("JABÓN","Jabón")
    .replace("GASEOSA","Gaseosa")
    .replace("GALLETAS","Galletas")
    .replace("AGUA","Agua");
}

function BadgeEstado({value}:{value?:string}){
  const v=String(value||"").trim();
  if(!v)return <>—</>;

  const upper=v.toUpperCase();
  const bg=
    upper.includes("PENDIENTE")?"#fff2d8":
    upper.includes("REASIGNADO")?"#eee7ff":
    upper.includes("RETIRO")?"#f5eeee":
    "#e8f8ee";
  const fg=
    upper.includes("PENDIENTE")?"#b66b00":
    upper.includes("REASIGNADO")?"#7251b5":
    upper.includes("RETIRO")?"#a33c3c":
    "#25834a";

  return <span style={{
    display:"inline-block",
    padding:"3px 7px",
    borderRadius:7,
    fontWeight:800,
    background:bg,
    color:fg,
    whiteSpace:"nowrap"
  }}>
    {v}
  </span>;
}

export default function ResumenGuardia({responsable}:{responsable:string}){
  const hoy=new Date().toLocaleDateString("en-CA",{timeZone:"America/Lima"});

  const[r,setR]=useState<Resumen|null>(null);
  const[desde,setDesde]=useState(hoy);
  const[hasta,setHasta]=useState(hoy);
  const[guardia,setGuardia]=useState("");
  const[turno,setTurno]=useState("");
  const[resp,setResp]=useState(responsable||"");
  const[usuarios,setUsuarios]=useState<string[]>([]);
  const[msg,setMsg]=useState("");
  const[load,setLoad]=useState("");
  const[mov,setMov]=useState<"TODOS"|"RECIBIDOS"|"SALIERON"|"PERMANECEN">("TODOS");

  useEffect(()=>{
    setResp(responsable||"");
  },[responsable]);

  useEffect(()=>{
    void estadiaApi<string[]>("estadiaListarResponsablesAtencion")
      .then(setUsuarios)
      .catch(()=>setUsuarios([]));
  },[]);

  useEffect(()=>{
    let vivo=true;

    const t=window.setTimeout(async()=>{
      setLoad("Actualizando resumen...");

      try{
        const data=await estadiaApi<Resumen>("estadiaResumenGuardia",{
          desde,
          hasta,
          guardia,
          turno,
          responsableFiltro:resp
        });

        if(vivo){
          setR(data);
          setMsg("");
        }

      }catch(e){
        if(vivo){
          setMsg(e instanceof Error?e.message:"Error al cargar el resumen");
        }
      }finally{
        if(vivo)setLoad("");
      }
    },250);

    return()=>{
      vivo=false;
      window.clearTimeout(t);
    };
  },[desde,hasta,guardia,turno,resp]);

  const personasFiltradas=useMemo(()=>{
    if(!r)return [];

    const base=r.personasPeriodo||r.presentes||[];

    return base.filter(x=>{
      if(mov==="RECIBIDOS"&&!x.ingresoPeriodo)return false;
      if(mov==="SALIERON"&&!x.salidaPeriodo)return false;
      if(mov==="PERMANECEN"&&!x.permanece)return false;
      return true;
    });
  },[r,mov]);

  if(!r){
    return <section style={page}>
      {load&&<Loader text={load}/>}
      <h1>Resumen diario / guardia</h1>
      {msg&&<div style={panel}>{msg}</div>}
    </section>;
  }

  const cards=[
    ["👥","Recibidas",r.personasRecibidas,"#eaf8ef","#55b875"],
    ["↪","Salieron",r.personasSalieron,"#e8f5ff","#5d9fe8"],
    ["👤","Permanecen",r.personasPresentes,"#f0ecff","#9a84e8"]
  ] as const;

  const totalPersonas=(r.personasPeriodo||r.presentes||[]).length;

  return <section style={page}>
    {load&&<Loader text={load}/>}

    <div>
      <h1 style={{margin:0}}>Resumen diario / guardia</h1>
      <p>
        {desde} – {hasta}
        {" · "}
        {guardia||"Todas las guardias"}
        {" · "}
        {turno||"Todos los turnos"}
        {" · "}
        {resp||"Todos los responsables"}
      </p>
    </div>

    <div style={{
      ...panel,
      display:"grid",
      gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",
      gap:12
    }}>
      <label>
        Desde
        <input style={input} type="date" value={desde} onChange={e=>setDesde(e.target.value)}/>
      </label>

      <label>
        Hasta
        <input style={input} type="date" value={hasta} onChange={e=>setHasta(e.target.value)}/>
      </label>

      <label>
        Guardia
        <select style={input} value={guardia} onChange={e=>setGuardia(e.target.value)}>
          <option value="">Todas</option>
          <option>A</option>
          <option>B</option>
          <option>C</option>
        </select>
      </label>

      <label>
        Turno
        <select style={input} value={turno} onChange={e=>setTurno(e.target.value)}>
          <option value="">Todos</option>
          <option>DÍA</option>
          <option>NOCHE</option>
        </select>
      </label>

      <label>
        Responsable
        <select style={input} value={resp} onChange={e=>setResp(e.target.value)}>
          <option value="">Todos</option>
          {responsable&&!usuarios.includes(responsable)&&(
            <option value={responsable}>{responsable}</option>
          )}
          {usuarios.map(x=><option key={x} value={x}>{x}</option>)}
        </select>
      </label>
    </div>


    <div style={{
      display:"grid",
      gridTemplateColumns:"minmax(310px,.9fr) minmax(520px,1.55fr) minmax(250px,.7fr)",
      gap:14,
      alignItems:"stretch",
      overflowX:"auto"
    }}>
      <div>
        <h3 style={{color:"#0b5d8d",margin:"0 0 8px"}}>Movimiento de personas</h3>
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(3,minmax(90px,1fr))",
          gap:8
        }}>
          {cards.map(c=><div key={c[1]} style={{...kpi(c[3],c[4]),padding:12}}>
            <span style={{fontSize:20}}>{c[0]}</span>
            <small style={{display:"block"}}>{c[1]}</small>
            <strong style={{fontSize:27}}>{c[2]}</strong>
          </div>)}
        </div>
      </div>

      <div>
        <h3 style={{color:"#c8473d",margin:"0 0 8px"}}>Habitaciones</h3>
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(5,minmax(92px,1fr))",
          gap:8
        }}>
          {[
            ["🛏️","Disponibles",r.habitaciones.disponibles,"#eaf8ef","#55b875"],
            ["🏨","Ocupadas",r.habitaciones.ocupadas,"#fff0ef","#ef716b"],
            ["📅","Reservadas",r.habitaciones.reservadas,"#edf5ff","#5d9fe8"],
            ["🧹","Por limpiar",r.habitaciones.porLimpiar,"#fff7e3","#e9a72e"],
            ["🛠️","Fuera servicio",r.habitaciones.fueraServicio,"#eef1f3","#7c8790"]
          ].map(x=><div key={String(x[1])} style={{...kpi(String(x[3]),String(x[4])),padding:12}}>
            <span style={{fontSize:19}}>{x[0]}</span>
            <small style={{display:"block"}}>{x[1]}</small>
            <strong style={{fontSize:25}}>{x[2]}</strong>
          </div>)}
        </div>
      </div>

      <div style={{...panel,background:"#fff2f2",margin:0,height:"100%"}}>
        <h3 style={{color:"#c43b34",marginTop:0}}>⚠ Pendientes para la siguiente guardia</h3>
        <div style={{lineHeight:1.8}}>
          <b>{r.personasPresentes}</b> persona(s) permanecen
          <br/>
          <b>{r.habitaciones.ocupadas}</b> habitación(es) ocupadas
          <br/>
          <b>{r.habitaciones.porLimpiar}</b> por limpiar.
        </div>
      </div>
    </div>

    <div style={{
      display:"grid",
      gridTemplateColumns:"minmax(0,1.35fr) minmax(0,1fr)",
      gap:14,
      alignItems:"stretch"
    }}>
      <div style={{...panel,background:"#fff8e8",margin:0}}>
        <h3 style={{marginTop:0}}>🍽️ Alimentación</h3>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
          {(["DESAYUNO","ALMUERZO","CENA"] as const).map(c=>{
            const z=r.alimentacion[c];

            return <div key={c} style={{background:"#fff",padding:10,borderRadius:10}}>
              <b>{c[0]+c.slice(1).toLowerCase()}</b>
              <div>Solicitados: <b>{z.solicitados}</b></div>
              <div>Entregados: <b>{z.entregados}</b></div>
              <div style={{color:"#c43b34"}}>Pendientes: <b>{z.pendientes}</b></div>
              <div>Reasignados: <b>{z.reasignados}</b></div>
            </div>;
          })}
        </div>
      </div>

      <div style={{...panel,background:"#eaf6ff",margin:0}}>
        <h3 style={{marginTop:0}}>🥤 Consumos entregados</h3>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8}}>
          {[
            ["💧","Agua",r.agua],
            ["🥤","Gaseosa",r.gaseosa],
            ["🍪","Galletas",r.galletas],
            ["🧻","Papel",r.papel],
            ["🧴","Shampoo",r.shampoo],
            ["🧼","Jabón",r.jabon]
          ].map(x=><div key={String(x[1])}>
            <span>{x[0]}</span>
            <small style={{display:"block"}}>{x[1]}</small>
            <strong style={{fontSize:21}}>{x[2]}</strong>
          </div>)}
        </div>
      </div>

    </div>

    <div style={panel}>
      <h3>Personas del periodo seleccionado</h3>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        {([
          ["TODOS","Todos",totalPersonas],
          ["RECIBIDOS","Recibidos",r.personasRecibidas],
          ["SALIERON","Salieron",r.personasSalieron],
          ["PERMANECEN","Permanecen",r.personasPresentes]
        ] as const).map(([k,t,n])=><button
          key={k}
          type="button"
          onClick={()=>setMov(k)}
          style={{
            border:0,
            borderRadius:9,
            padding:"9px 13px",
            fontWeight:800,
            cursor:"pointer",
            background:mov===k?"#1677d2":"#e8eef2",
            color:mov===k?"#fff":"#18343c"
          }}
        >
          {t} ({n})
        </button>)}
      </div>

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",minWidth:1320,fontSize:12,borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th style={{textAlign:"left"}}>DNI</th>
              <th style={{textAlign:"left"}}>Persona</th>
              <th>Hab.</th>
              <th>Hora de ingreso</th>
              <th>Hora de salida</th>
              <th>Permanencia</th>
              <th>Zona</th>
              <th>Desayuno</th>
              <th>Almuerzo</th>
              <th>Cena</th>
              <th style={{textAlign:"left"}}>Consumos / Kits</th>
            </tr>
          </thead>

          <tbody>
            {personasFiltradas.map(x=>{
              const cons=Object.entries(x.consumos||{})
                .filter(([,v])=>Number(v)>0)
                .map(([k,v])=>`${etiquetaConsumo(k)} ×${v}`)
                .join(" · ");

              return <tr key={`${x.idIngreso}-${x.dni}`}>
                <td style={{padding:8,borderBottom:"1px solid #eee",fontWeight:700}}>
                  {x.dni||"-"}
                </td>
                <td><b>{x.nombre}</b></td>
                <td style={{textAlign:"center"}}>{x.habitacion||"-"}</td>
                <td style={{textAlign:"center"}}>{fechaHora(x.fechaIngreso)}</td>
                <td style={{textAlign:"center"}}>{x.fechaSalida?fechaHora(x.fechaSalida):"—"}</td>
                <td style={{textAlign:"center",fontWeight:700}}>
                  {duracionPeriodo(x,hasta)}
                </td>
                <td style={{textAlign:"center"}}>{x.zona||"-"}</td>
                <td style={{textAlign:"center"}}>
                  <BadgeEstado value={x.alimentacion?.DESAYUNO}/>
                </td>
                <td style={{textAlign:"center"}}>
                  <BadgeEstado value={x.alimentacion?.ALMUERZO}/>
                </td>
                <td style={{textAlign:"center"}}>
                  <BadgeEstado value={x.alimentacion?.CENA}/>
                </td>
                <td>{cons||"—"}</td>
              </tr>;
            })}

            {!personasFiltradas.length&&(
              <tr>
                <td colSpan={11} style={{padding:22,textAlign:"center",color:"#60706d"}}>
                  No hay personas que coincidan con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    {(r.reasignaciones||[]).length>0&&(
      <div style={panel}>
        <h3>↗ Comidas reasignadas</h3>

        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",minWidth:1100,fontSize:12,borderCollapse:"collapse"}}>
            <thead>
              <tr>
                <th>Fecha / hora</th>
                <th>Servicio</th>
                <th>Solicitante original</th>
                <th>DNI solicitante</th>
                <th>Entregado a</th>
                <th>DNI receptor</th>
                <th>Usuario</th>
                <th>Observación</th>
              </tr>
            </thead>

            <tbody>
              {(r.reasignaciones||[]).map((x,i)=><tr key={x.id||`${x.servicio}-${x.dniSolicitante}-${i}`}>
                <td style={{padding:7,borderBottom:"1px solid #eee"}}>
                  {x.fechaHora?fechaHora(x.fechaHora):x.fechaOperativa||"—"}
                </td>
                <td style={{textAlign:"center"}}>{x.servicio}</td>
                <td>{x.original||"—"}</td>
                <td style={{textAlign:"center"}}>{x.dniSolicitante||"—"}</td>
                <td><b>{x.entregadoA||"—"}</b></td>
                <td style={{textAlign:"center"}}>{x.dniDestino||"—"}</td>
                <td>{x.usuario||"—"}</td>
                <td>{x.observacion||"—"}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    )}

    <div style={panel}>
      <h3>📈 Cantidad de personas que ingresaron por fecha</h3>
      <Grafico data={r.ingresosPorFecha}/>
    </div>

    {msg&&<div style={panel}>{msg}</div>}
  </section>;
}
