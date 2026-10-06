"use client";

import {useEffect,useMemo,useState} from "react";
import {
  btn,
  duracionDesde,
  estadiaApi,
  EstadiaPersona,
  fechaHora,
  input,
  Loader,
  page,
  panel,
  kpi
} from "./estadiaApi";

type GrupoSalida={
  id:string;
  placa?:string;
  personas:EstadiaPersona[];
};

export default function SalidaProveedores({responsable}:{responsable:string}){

  const[p,setP]=useState<EstadiaPersona[]>([]);
  const[q,setQ]=useState("");
  const[sel,setSel]=useState<string[]>([]);
  const[msg,setMsg]=useState("");
  const[load,setLoad]=useState("");

  const key=(x:EstadiaPersona)=>`${x.idIngreso}|${x.dni}`;

  const cargar=async()=>{
    try{
      setP(await estadiaApi("estadiaListarPresentes"));
    }catch(e){
      setMsg(e instanceof Error?e.message:"Error");
    }
  };

  useEffect(()=>{
    void cargar();
  },[]);

  const vis=useMemo(()=>{
    const z=q.toLowerCase().trim();
    return !z
      ?p
      :p.filter(x=>
        [x.dni,x.nombre,x.placa,x.idIngreso]
          .some(v=>String(v||"").toLowerCase().includes(z))
      );
  },[q,p]);

  const grupos=Array.from(
    new Map<string,GrupoSalida>(
      vis.map(x=>[
        String(x.idIngreso),
        {
          id:String(x.idIngreso),
          placa:x.placa,
          personas:vis.filter(y=>y.idIngreso===x.idIngreso)
        }
      ])
    ).values()
  );

  async function preparar(xs:EstadiaPersona[],texto:string){
    if(!xs.length){
      setMsg("Selecciona al menos una persona.");
      return;
    }

    if(!confirm(texto))return;

    // La salida ya no obliga a resolver una comida pendiente.
    // La ración seguirá PENDIENTE para poder reasignarla después.
    await ejecutar(xs);
  }

  async function ejecutar(xs:EstadiaPersona[]){
    setLoad(`Registrando salida de ${xs.length} persona(s)...`);
    setMsg("");

    try{
      await estadiaApi("estadiaRegistrarSalidasLote",{
        personas:xs,
        responsable
      });

      setSel([]);
      await cargar();

      setMsg(
        `✓ Se registró la salida de ${xs.length} persona(s). `+
        "Las comidas no entregadas permanecen PENDIENTES para su reasignación."
      );

    }catch(e){
      setMsg(e instanceof Error?e.message:"Error");
    }finally{
      setLoad("");
    }
  }

  return <section style={page}>
    {load&&<Loader text={load}/>}

    <div>
      <h1>Salida de Proveedores</h1>
      <p>
        Busca por DNI, nombre, placa o ID. Las comidas pendientes no bloquean
        la salida y quedan disponibles para reasignación.
      </p>
    </div>

    <div style={{
      display:"grid",
      gridTemplateColumns:"repeat(2,minmax(190px,300px))",
      gap:12
    }}>
      <div style={kpi("#e8f5ff","#83c5ee")}>
        <span>👥</span>
        <small style={{display:"block"}}>Personas presentes</small>
        <strong style={{fontSize:30}}>{p.length}</strong>
      </div>

      <div style={kpi("#eaf8ef","#55b875")}>
        <span>🚚</span>
        <small style={{display:"block"}}>Vehículos / ingresos</small>
        <strong style={{fontSize:30}}>
          {new Set(p.map(x=>x.idIngreso)).size}
        </strong>
      </div>
    </div>

    <div style={panel}>
      <input
        style={input}
        value={q}
        onChange={e=>setQ(e.target.value)}
        placeholder="Buscar DNI, nombre, placa o ID..."
      />
    </div>

    {grupos.map(g=>
      <div style={panel} key={g.id}>
        <div style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          gap:10,
          flexWrap:"wrap"
        }}>
          <div>
            <b style={{fontSize:18}}>{g.placa||"SIN PLACA"}</b>
            <div style={{fontSize:12,color:"#60706d"}}>
              ID {g.id} · {g.personas.length} persona(s)
            </div>
          </div>

          <button
            style={btn}
            onClick={()=>void preparar(
              g.personas,
              `¿Registrar salida del vehículo ${g.placa||"SIN PLACA"} y sus ${g.personas.length} persona(s)?`
            )}
          >
            Salida vehículo completo
          </button>
        </div>

        <div style={{overflowX:"auto",marginTop:10}}>
          <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
            <tbody>
              {g.personas.map(x=>
                <tr key={key(x)}>
                  <td style={{padding:8}}>
                    <input
                      type="checkbox"
                      checked={sel.includes(key(x))}
                      onChange={e=>
                        setSel(v=>
                          e.target.checked
                            ?[...v,key(x)]
                            :v.filter(k=>k!==key(x))
                        )
                      }
                    />
                  </td>
                  <td>
                    <b>{x.nombre}</b><br/>
                    <small>{x.dni}</small>
                  </td>
                  <td style={{whiteSpace:"nowrap"}}>
                    Ingreso: {fechaHora(x.fechaIngreso)}
                  </td>
                  <td>{duracionDesde(x.fechaIngreso)}</td>
                  <td>Hab. {x.habitacion||"-"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}

    <div style={{
      position:"sticky",
      bottom:10,
      ...panel,
      display:"flex",
      justifyContent:"space-between",
      alignItems:"center",
      zIndex:5
    }}>
      <b>{sel.length} seleccionada(s)</b>
      <button
        style={btn}
        onClick={()=>void preparar(
          p.filter(x=>sel.includes(key(x))),
          `¿Registrar salida de ${sel.length} persona(s)?`
        )}
      >
        Registrar salida seleccionada
      </button>
    </div>

    {msg&&<div style={panel}>{msg}</div>}
  </section>;
}
