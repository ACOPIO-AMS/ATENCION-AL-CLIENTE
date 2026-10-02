"use client";

import { useEffect, useMemo, useState } from "react";
import {
  btn,
  duracionDesde,
  estadiaApi,
  EstadiaPersona,
  fechaHora,
  input,
  kpi,
  Loader,
  page,
  panel,
} from "./estadiaApi";

type Comida = "DESAYUNO" | "ALMUERZO" | "CENA";

type Estado = {
  solicitados: number;
  entregados: number;
  pendientes: number;
  retiro: number;
  reasignados: number;
};

type EstadoSrv = {
  personas: Record<string, Record<string, any>>;
  resumen: Record<Comida, Estado>;
  consumos: {
    AGUA: number;
    GASEOSA: number;
    GALLETAS: number;
  };
};

const COMIDAS: Comida[] = ["DESAYUNO", "ALMUERZO", "CENA"];

const vacio = (): EstadoSrv => ({
  personas: {},
  resumen: {
    DESAYUNO: {
      solicitados: 0,
      entregados: 0,
      pendientes: 0,
      retiro: 0,
      reasignados: 0,
    },
    ALMUERZO: {
      solicitados: 0,
      entregados: 0,
      pendientes: 0,
      retiro: 0,
      reasignados: 0,
    },
    CENA: {
      solicitados: 0,
      entregados: 0,
      pendientes: 0,
      retiro: 0,
      reasignados: 0,
    },
  },
  consumos: {
    AGUA: 0,
    GASEOSA: 0,
    GALLETAS: 0,
  },
});

export default function EstadiaServicios({
  responsable,
}: {
  responsable: string;
}) {
  const [p, setP] = useState<EstadiaPersona[]>([]);
  const [estado, setEstado] = useState<EstadoSrv>(vacio());
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);

  const [sol, setSol] = useState<Record<Comida, boolean>>({
    DESAYUNO: false,
    ALMUERZO: false,
    CENA: false,
  });

  const [ent, setEnt] = useState<Record<Comida, boolean>>({
    DESAYUNO: false,
    ALMUERZO: false,
    CENA: false,
  });

  const [agua, setAgua] = useState(0);
  const [gaseosa, setGaseosa] = useState(0);
  const [galletas, setGalletas] = useState(1);
  const [salida, setSalida] = useState("");
  const [msg, setMsg] = useState("");
  const [load, setLoad] = useState("");
  const [ok, setOk] = useState("");

  const key = (x: EstadiaPersona) => `${x.idIngreso}|${x.dni}`;

  const cargar = async (silencioso = false) => {
    if (!silencioso) setLoad("Cargando información...");

    try {
      const [a, b] = await Promise.all([
        estadiaApi<EstadiaPersona[]>("estadiaListarPresentes"),
        estadiaApi<EstadoSrv>("estadiaEstadoServicios"),
      ]);

      setP(a);
      setEstado(b || vacio());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error");
    } finally {
      if (!silencioso) setLoad("");
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const vis = useMemo(() => {
    const z = q.toLowerCase().trim();

    return !z
      ? p
      : p.filter((x) =>
          [x.dni, x.nombre, x.placa, x.idIngreso].some((v) =>
            String(v || "")
              .toLowerCase()
              .includes(z)
          )
        );
  }, [q, p]);

  const eleg = p.filter((x) => sel.includes(key(x)));

  const reset = () => {
    setSel([]);

    setSol({
      DESAYUNO: false,
      ALMUERZO: false,
      CENA: false,
    });

    setEnt({
      DESAYUNO: false,
      ALMUERZO: false,
      CENA: false,
    });

    setAgua(0);
    setGaseosa(0);
    setGalletas(1);
  };

  const exito = (t: string) => {
    setOk(t);

    window.setTimeout(() => {
      setOk("");
    }, 1400);
  };

  async function guardar(
    modo: "SOLICITUD" | "ENTREGA",
    servicios: { servicio: string; cantidad: number }[]
  ) {
    if (!eleg.length) {
      return setMsg("Selecciona al menos una persona.");
    }

    if (!servicios.length) {
      return setMsg("Selecciona al menos una opción.");
    }

    setMsg("");

    setLoad(
      modo === "SOLICITUD"
        ? "Guardando requerimiento..."
        : "Guardando entrega..."
    );

    try {
      await estadiaApi("estadiaRegistrarServiciosLote", {
        personas: eleg,
        servicios,
        responsable,
        modo,
      });

      await cargar(true);

      reset();

      exito(
        modo === "SOLICITUD"
          ? "Requerimiento guardado correctamente"
          : "Entrega guardada correctamente"
      );
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "Error al guardar"
      );
    } finally {
      setLoad("");
    }
  }

  async function prevista() {
    if (eleg.length !== 1 || !salida) {
      return setMsg(
        "Selecciona una sola persona y fecha/hora."
      );
    }

    setLoad("Guardando salida prevista...");

    try {
     
