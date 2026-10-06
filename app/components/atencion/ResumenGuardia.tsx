"use client";

import {useEffect,useMemo,useState} from "react";
import {btn,estadiaApi,fechaHora,input,kpi,Loader,page,panel} from "./estadiaApi";

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

function Grafico({data=[],compact=false}:{data?:{fecha:string;cantidad:number}[];compact?:boolean}){
  if(!data.length){
    return <div style={{padding:22,textAlign:"center",color:"#60706d"}}>
      Sin ingresos para el periodo seleccionado.
    </div>;
  }

  const w=900;
  const h=compact?118:230;
  const pad=compact?22:38;
  const max=Math.max(1,...data.map(x=>x.cantidad));
  const pts=data.map((x,i)=>{
    const cx=data.length===1?w/2:pad+i*(w-pad*2)/(data.length-1);
    const cy=h-pad-x.cantidad*(h-pad*2)/max;
    return `${cx},${cy}`;
  }).join(" ");

  return <div style={{overflowX:"auto"}}>
    <svg viewBox={`0 0 ${w} ${h}`} style={{
      width:"100%",
      minWidth:compact?360:620,
      height:compact?124:240
    }}>
      <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="currentColor" opacity=".25"/>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3"/>
      {data.map((x,i)=>{
        const cx=data.length===1?w/2:pad+i*(w-pad*2)/(data.length-1);
        const cy=h-pad-x.cantidad*(h-pad*2)/max;
        const m=String(x.fecha||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const etiqueta=m?`${m[3]}/${m[2]}`:x.fecha;
        return <g key={x.fecha}>
          <circle cx={cx} cy={cy} r="5" fill="currentColor"/>
          <text x={cx} y={cy-9} textAnchor="middle" fontSize={compact?13:12}>{x.cantidad}</text>
          <text x={cx} y={h-9} textAnchor="middle" fontSize={compact?12:11}>{etiqueta}</text>
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
  const ahora=new Date();
  const hoyCalendario=ahora.toLocaleDateString("en-CA",{timeZone:"America/Lima"});
  const horaLima=Number(new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Lima",
    hour:"2-digit",
    hourCycle:"h23"
  }).format(ahora));
  const fechaReporteActual=horaLima>=19
    ?new Date(ahora.getTime()+24*60*60*1000)
    :ahora;
  const hoy=fechaReporteActual.toLocaleDateString("en-CA",{timeZone:"America/Lima"});

  const[r,setR]=useState<Resumen|null>(null);
  const[desde,setDesde]=useState(hoy);
  const[hasta,setHasta]=useState(hoy);
  const[guardia,setGuardia]=useState("");
  const[turno,setTurno]=useState("");
  const[msg,setMsg]=useState("");
  const[load,setLoad]=useState("");
  const[mov,setMov]=useState<"TODOS"|"RECIBIDOS"|"SALIERON"|"PERMANECEN">("TODOS");
  const[vistaReporte,setVistaReporte]=useState(false);
  const[actualizacion,setActualizacion]=useState(0);

  const[reasignar,setReasignar]=useState<{
    persona:PersonaPeriodo;
    comida:Comida;
    dniDestino:string;
    entregadoA:string;
    observacion:string;
  }|null>(null);

  const esPendiente=(v?:string)=>
    String(v||"").trim().toUpperCase().startsWith("PENDIENTE");

  async function confirmarReasignacion(){
    if(!reasignar)return;

    const dniDestino=reasignar.dniDestino.replace(/\D/g,"");
    const entregadoA=reasignar.entregadoA
      .trim()
      .replace(/\s+/g," ")
      .toUpperCase();

    if(!/^\d{8}$/.test(dniDestino)){
      setMsg("El DNI de la persona receptora debe tener 8 dígitos.");
      return;
    }

    if(entregadoA.split(" ").filter(Boolean).length<2){
      setMsg("Ingresa los nombres completos de la persona que recibió la comida.");
      return;
    }

    setLoad(`Reasignando ${reasignar.comida.toLowerCase()}...`);
    setMsg("");

    try{
      await estadiaApi("estadiaReasignarAlimentacion",{
        idIngreso:reasignar.persona.idIngreso,
        dni:reasignar.persona.dni,
        servicio:reasignar.comida,
        entregadoA,
        dniDestino,
        responsable,
        observacion:reasignar.observacion.trim()
      });

      setReasignar(null);
      setActualizacion(v=>v+1);
      setMsg("✓ Comida reasignada correctamente.");

    }catch(e){
      setMsg(e instanceof Error?e.message:"Error al reasignar la comida.");
    }finally{
      setLoad("");
    }
  }

  const celdaComida=(x:PersonaPeriodo,c:Comida)=>{
    const valor=x.alimentacion?.[c];

    /*
     * Si la persona ya salió y la comida quedó pendiente,
     * solo se habilita REASIGNAR.
     *
     * Se limita al día calendario actual porque el backend
     * reasigna únicamente solicitudes pendientes de hoy.
     */
    const yaSalio=!!x.fechaSalida;
    const esHoy=desde===hoyCalendario&&hasta===hoyCalendario;
    const puedeReasignar=yaSalio&&esPendiente(valor)&&esHoy;

    return <div style={{
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      gap:5,
      flexWrap:"wrap"
    }}>
      <BadgeEstado value={valor}/>

      {puedeReasignar&&(
        <button
          type="button"
          onClick={()=>setReasignar({
            persona:x,
            comida:c,
            dniDestino:"",
            entregadoA:"",
            observacion:""
          })}
          style={{
            ...btn,
            padding:"4px 7px",
            fontSize:10.5,
            background:"#596bd8",
            whiteSpace:"nowrap"
          }}
        >
          ↗ Reasignar
        </button>
      )}
    </div>;
  };


  useEffect(()=>{
    let vivo=true;

    const t=window.setTimeout(async()=>{
      setLoad("Actualizando resumen...");

      try{
        const data=await estadiaApi<Resumen>("estadiaResumenGuardia",{
          desde,
          hasta,
          guardia,
          turno
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
  },[desde,hasta,guardia,turno,actualizacion]);

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

  return <section style={{
    ...page,
    ...(vistaReporte?{
      gap:3,
      padding:"4px 6px",
      fontSize:12.5
    }:{})
  }}>
    {load&&<Loader text={load}/>}

    {!vistaReporte?(
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
        <div>
          <h1 style={{margin:0}}>Resumen diario / guardia</h1>
          <p>
            {desde} – {hasta}
            {" · "}
            {guardia||"Todas las guardias"}
            {" · "}
            {turno||"Todos los turnos"}
          </p>
        </div>

        <button
          type="button"
          onClick={()=>{
            setMov("TODOS");
            setVistaReporte(true);
            window.scrollTo({top:0,behavior:"smooth"});
          }}
          style={{
            border:"1px solid #b9c9d0",
            background:"#fff",
            color:"#0b4f75",
            borderRadius:10,
            padding:"10px 14px",
            fontWeight:800,
            cursor:"pointer",
            whiteSpace:"nowrap"
          }}
        >
          👁 Vista reporte
        </button>
      </div>
    ):(
      <div style={{
        background:"#0b4f75",
        color:"#fff",
        borderRadius:12,
        padding:"5px 8px",
        display:"grid",
        gridTemplateColumns:"minmax(220px,1.2fr) repeat(3,minmax(95px,.48fr)) auto",
        gap:4,
        alignItems:"center"
      }}>
        <div>
          <div style={{fontSize:11,fontWeight:800,opacity:.85}}>AMS ACOPIO</div>
          <div style={{fontSize:20,fontWeight:900,lineHeight:1.05}}>RESUMEN DIARIO / GUARDIA</div>
        </div>

        <div>
          <small style={{opacity:.82,fontSize:10.5}}>Fecha</small>
          <div style={{fontWeight:800,fontSize:12.5}}>{desde===hasta?desde:`${desde} – ${hasta}`}</div>
        </div>

        <div>
          <small style={{opacity:.82,fontSize:10.5}}>Guardia</small>
          <div style={{fontWeight:800,fontSize:12.5}}>{guardia||"Todas"}</div>
        </div>

        <div>
          <small style={{opacity:.82,fontSize:10.5}}>Turno</small>
          <div style={{fontWeight:800,fontSize:12.5}}>{turno||"Todos"}</div>
        </div>

        <button
          type="button"
          onClick={()=>setVistaReporte(false)}
          style={{
            border:0,
            background:"#fff3bf",
            color:"#17333a",
            borderRadius:9,
            padding:"9px 12px",
            fontWeight:900,
            cursor:"pointer",
            whiteSpace:"nowrap"
          }}
        >
          👁 Vista normal
        </button>
      </div>
    )}

    {!vistaReporte&&<div style={{
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

      <div style={{display:"flex",alignItems:"end"}}>
        <button
          type="button"
          onClick={()=>setActualizacion(v=>v+1)}
          disabled={!!load}
          style={{
            ...input,
            cursor:load?"wait":"pointer",
            fontWeight:800,
            background:"#fff",
            color:"#0b4f75"
          }}
        >
          🔄 {load?"Actualizando...":"Actualizar"}
        </button>
      </div>
    </div>}


    <div style={{
      display:"grid",
      gridTemplateColumns:"minmax(0,.9fr) minmax(0,1.45fr) minmax(0,1.2fr) minmax(0,.9fr) minmax(0,.85fr)",
      gap:vistaReporte?3:12,
      alignItems:"stretch",
      overflowX:"auto"
    }}>
      {/* MOVIMIENTO DE PERSONAS */}
      <div style={{
        ...panel,
        margin:0,
        padding:0,
        overflow:"hidden",
        border:"1px solid #b8d8cc",
        minWidth:0
      }}>
        <div style={{
          padding:vistaReporte?"3px 6px":"8px 10px",
          background:"#eef9f4",
          color:"#0b5d8d",
          fontWeight:800,
          fontSize:vistaReporte?12.5:12.5,
          borderBottom:"1px solid #d7e6e0"
        }}>
          👥 Movimiento de personas
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
          {cards.map((c,i)=><div key={c[1]} style={{
            padding:vistaReporte?"3px 2px":"9px 5px",
            textAlign:"center",
            borderRight:i<2?"1px solid #d8e4df":"none",
            minWidth:0
          }}>
            <span style={{fontSize:vistaReporte?15:16}}>{c[0]}</span>
            <small style={{display:"block",marginTop:0,color:"#45615a",fontSize:vistaReporte?10.5:10.5,lineHeight:vistaReporte?1.0:undefined}}>{c[1]}</small>
            <strong style={{display:"block",fontSize:vistaReporte?22:23,marginTop:0,color:"#173c34",lineHeight:vistaReporte?1.0:undefined}}>{c[2]}</strong>
          </div>)}
        </div>
      </div>

      {/* HABITACIONES */}
      <div style={{
        ...panel,
        margin:0,
        padding:0,
        overflow:"hidden",
        border:"1px solid #e3c7c4",
        minWidth:0
      }}>
        <div style={{
          padding:vistaReporte?"3px 6px":"8px 10px",
          background:"#fff4f3",
          color:"#c8473d",
          fontWeight:800,
          fontSize:vistaReporte?12.5:12.5,
          borderBottom:"1px solid #ead9d7"
        }}>
          🛏️ Habitaciones
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))"}}>
          {[
            ["🛏️","Disponibles",r.habitaciones.disponibles],
            ["🏨","Ocupadas",r.habitaciones.ocupadas],
            ["📅","Reservadas",r.habitaciones.reservadas],
            ["🧹","Por limpiar",r.habitaciones.porLimpiar],
            ["🛠️","Fuera servicio",r.habitaciones.fueraServicio]
          ].map((x,i)=><div key={String(x[1])} style={{
            padding:vistaReporte?"3px 1px":"9px 3px",
            textAlign:"center",
            borderRight:i<4?"1px solid #eadfdd":"none",
            minWidth:0
          }}>
            <span style={{fontSize:vistaReporte?14:15}}>{x[0]}</span>
            <small style={{display:"block",marginTop:0,color:"#654d4b",fontSize:vistaReporte?9.5:9.8,lineHeight:vistaReporte?1.0:1.1}}>{x[1]}</small>
            <strong style={{display:"block",fontSize:vistaReporte?21:22,marginTop:0,color:"#3c2725",lineHeight:vistaReporte?1.0:undefined}}>{x[2]}</strong>
          </div>)}
        </div>
      </div>

      {/* ALIMENTACIÓN */}
      <div style={{
        ...panel,
        background:"#fff8e8",
        margin:0,
        padding:0,
        overflow:"hidden",
        minWidth:0
      }}>
        <div style={{
          padding:vistaReporte?"3px 6px":"8px 10px",
          fontWeight:800,
          fontSize:vistaReporte?12.5:12.5,
          borderBottom:"1px solid #eadfbd"
        }}>
          🍽️ Alimentación
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
          {(["DESAYUNO","ALMUERZO","CENA"] as const).map((c,i)=>{
            const z=r.alimentacion[c];
            return <div key={c} style={{
              padding:vistaReporte?"3px 3px":"9px 6px",
              borderRight:i<2?"1px solid #eee3c8":"none",
              minWidth:0,
              fontSize:vistaReporte?10.2:10.2,
              lineHeight:vistaReporte?1.12:1.45
            }}>
              <b style={{display:"block",fontSize:vistaReporte?11.2:11.5,marginBottom:0}}>{c[0]+c.slice(1).toLowerCase()}</b>
              <div>Solicitados: <b>{z.solicitados}</b></div>
              <div>Entregados: <b>{z.entregados}</b></div>
              <div style={{color:"#c43b34"}}>Pendientes: <b>{z.pendientes}</b></div>
              <div>Reasignados: <b>{z.reasignados}</b></div>
            </div>;
          })}
        </div>
      </div>

      {/* CONSUMOS ENTREGADOS */}
      <div style={{
        ...panel,
        background:"#eaf6ff",
        margin:0,
        padding:0,
        overflow:"hidden",
        minWidth:0
      }}>
        <div style={{
          padding:vistaReporte?"3px 6px":"8px 10px",
          fontWeight:800,
          fontSize:vistaReporte?12.5:12.5,
          borderBottom:"1px solid #cfe3f2"
        }}>
          🥤 Consumos entregados
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:0}}>
          {[
            ["💧","Agua",r.agua],
            ["🥤","Gaseosa",r.gaseosa],
            ["🍪","Galletas",r.galletas],
            ["🧻","Papel",r.papel],
            ["🧴","Shampoo",r.shampoo],
            ["🧼","Jabón",r.jabon]
          ].map(x=><div key={String(x[1])} style={{
            padding:vistaReporte?"2px 2px":"7px 4px",
            textAlign:"center",
            minWidth:0
          }}>
            <span style={{fontSize:vistaReporte?13:14}}>{x[0]}</span>
            <small style={{display:"block",fontSize:vistaReporte?9.5:9.5,lineHeight:vistaReporte?1.0:1.05}}>{x[1]}</small>
            <strong style={{display:"block",fontSize:vistaReporte?19:20,marginTop:0}}>{x[2]}</strong>
          </div>)}
        </div>
      </div>

      {/* PENDIENTES SIGUIENTE GUARDIA */}
      <div style={{
        ...panel,
        background:"#fff2f2",
        margin:0,
        padding:0,
        overflow:"hidden",
        minWidth:0
      }}>
        <div style={{
          padding:vistaReporte?"3px 6px":"8px 10px",
          color:"#c43b34",
          fontWeight:800,
          fontSize:vistaReporte?12.2:12,
          borderBottom:"1px solid #efdddd",
          lineHeight:1.25
        }}>
          ⚠ Pendientes para la siguiente guardia
        </div>

        <div style={{
          padding:vistaReporte?"3px 6px":"10px 10px",
          lineHeight:vistaReporte?1.15:1.65,
          fontSize:vistaReporte?10.5:10.5
        }}>
          <div><b>{r.personasPresentes}</b> persona(s) permanecen</div>
          <div><b>{r.habitaciones.ocupadas}</b> habitación(es) ocupadas</div>
          <div><b>{r.habitaciones.porLimpiar}</b> por limpiar.</div>
        </div>
      </div>
    </div>

    <div style={{...panel,padding:vistaReporte?5:undefined}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <h3 style={{margin:vistaReporte?0:undefined,fontSize:vistaReporte?13.5:undefined}}>Personas del periodo seleccionado</h3>
        {vistaReporte&&<div style={{fontSize:10.8,fontWeight:700,color:"#60706d"}}>
          Todos: {totalPersonas} · Recibidos: {r.personasRecibidas} · Salieron: {r.personasSalieron} · Permanecen: {r.personasPresentes}
        </div>}
      </div>

      {!vistaReporte&&<div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:02}}>
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
      </div>}

      <div style={{overflowX:"auto",marginTop:vistaReporte?2:0}}>
        <table style={{
          width:"100%",
          minWidth:vistaReporte?0:1320,
          fontSize:vistaReporte?11.2:12,
          borderCollapse:"collapse",
          tableLayout:"auto",
          lineHeight:vistaReporte?1.08:undefined
        }}>
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
                <td style={{padding:vistaReporte?2.5:8,borderBottom:"1px solid #eee",fontWeight:700}}>
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
                  {celdaComida(x,"DESAYUNO")}
                </td>
                <td style={{textAlign:"center"}}>
                  {celdaComida(x,"ALMUERZO")}
                </td>
                <td style={{textAlign:"center"}}>
                  {celdaComida(x,"CENA")}
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

    <div style={{
      display:"grid",
      gridTemplateColumns:(r.reasignaciones||[]).length
        ?"minmax(0,1.35fr) minmax(320px,.75fr)"
        :"1fr",
      gap:vistaReporte?8:14,
      alignItems:"stretch"
    }}>
      {(r.reasignaciones||[]).length>0&&(
        <div style={{...panel,padding:vistaReporte?5:undefined,margin:0}}>
          <h3 style={{marginTop:0}}>↗ Comidas reasignadas</h3>

          <div style={{overflowX:"auto"}}>
            <table style={{
              width:"100%",
              minWidth:vistaReporte?0:980,
              fontSize:vistaReporte?11.2:12,
              borderCollapse:"collapse",
              tableLayout:"auto",
              lineHeight:vistaReporte?1.08:undefined
            }}>
              <thead>
                <tr>
                  <th>Fecha / hora</th>
                  <th>Servicio</th>
                  <th>Solicitante original</th>
                  <th>DNI solicitante</th>
                  <th>Entregado a</th>
                  <th>DNI receptor</th>
                  <th>Observación</th>
                </tr>
              </thead>

              <tbody>
                {(r.reasignaciones||[]).map((x,i)=><tr key={x.id||`${x.servicio}-${x.dniSolicitante}-${i}`}>
                  <td style={{padding:vistaReporte?2.5:7,borderBottom:"1px solid #eee"}}>
                    {x.fechaHora?fechaHora(x.fechaHora):x.fechaOperativa||"—"}
                  </td>
                  <td style={{textAlign:"center"}}>{x.servicio}</td>
                  <td>{x.original||"—"}</td>
                  <td style={{textAlign:"center"}}>{x.dniSolicitante||"—"}</td>
                  <td><b>{x.entregadoA||"—"}</b></td>
                  <td style={{textAlign:"center"}}>{x.dniDestino||"—"}</td>
                  <td>{x.observacion||"—"}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{...panel,padding:vistaReporte?5:undefined,margin:0}}>
        <h3 style={{marginTop:0}}>📈 Cantidad de personas que ingresaron por fecha</h3>
        <Grafico data={r.ingresosPorFecha} compact={vistaReporte}/>
      </div>
    </div>


    {reasignar&&(
      <div style={{
        position:"fixed",
        inset:0,
        zIndex:10000,
        background:"rgba(5,28,34,.55)",
        display:"grid",
        placeItems:"center",
        padding:20
      }}>
        <div style={{
          ...panel,
          width:"min(520px,96vw)",
          maxHeight:"85vh",
          overflow:"auto"
        }}>
          <h2 style={{marginTop:0}}>
            ↗ Reasignar {reasignar.comida.toLowerCase()}
          </h2>

          <p style={{fontSize:13,lineHeight:1.45}}>
            <b>{reasignar.persona.nombre}</b> ya registró su salida y la comida
            continúa pendiente. En este caso solo puede reasignarse.
          </p>

          <label style={{display:"block",marginBottom:10}}>
            DNI de quien recibió *
            <input
              style={input}
              inputMode="numeric"
              maxLength={8}
              value={reasignar.dniDestino}
              onChange={e=>
                setReasignar(m=>m?{
                  ...m,
                  dniDestino:e.target.value.replace(/\D/g,"").slice(0,8)
                }:m)
              }
              placeholder="8 dígitos"
            />
          </label>

          <label style={{display:"block",marginBottom:10}}>
            Nombres completos *
            <input
              style={input}
              value={reasignar.entregadoA}
              onChange={e=>
                setReasignar(m=>m?{
                  ...m,
                  entregadoA:e.target.value.toUpperCase()
                }:m)
              }
              placeholder="Nombres y apellidos"
            />
          </label>

          <label style={{display:"block",marginBottom:12}}>
            Observación
            <input
              style={input}
              value={reasignar.observacion}
              onChange={e=>
                setReasignar(m=>m?{
                  ...m,
                  observacion:e.target.value
                }:m)
              }
              placeholder="Opcional"
            />
          </label>

          <div style={{
            display:"flex",
            justifyContent:"flex-end",
            gap:10,
            flexWrap:"wrap"
          }}>
            <button
              type="button"
              style={{...btn,background:"#6b7775"}}
              onClick={()=>setReasignar(null)}
              disabled={!!load}
            >
              Cancelar
            </button>

            <button
              type="button"
              style={{...btn,background:"#596bd8"}}
              onClick={()=>void confirmarReasignacion()}
              disabled={!!load}
            >
              ↗ Confirmar reasignación
            </button>
          </div>
        </div>
      </div>
    )}

    {msg&&<div style={panel}>{msg}</div>}
  </section>;
}
