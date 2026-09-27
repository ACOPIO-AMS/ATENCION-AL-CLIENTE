SIGUE APARECIENDO DESACTUALIZADO
page (4).tsx
TypeScript

Ya revisé el page (4).tsx que me acabas de pasar. Encontré la causa exacta: el frontend no tenía ninguna llamada a previewCargoCorrelative; solo mostraba el correlativo después de guardar. El archivo sí tiene el estado cargoCorrelative y la lógica de guardado, pero faltaba la consulta previa.

Ya lo corregí completo:

Descargar page.tsx corregido

Ahora esta versión:

consulta previewCargoCorrelative al entrar a Cargos y Salidas;
cambia automáticamente al seleccionar CH / PR / GE;
mostrará CH-xxxx antes de guardar;
al guardar, reemplaza la vista previa por el correlativo definitivo que devuelve Apps Script;
después de imprimir y limpiar, consulta el siguiente número;
no cambia la conexión V15 ni lo que acabamos de configurar para BD SALIDAS.
Ahora en GitHub

Entra al archivo actual app/page.tsx → Edit ✏️ → Ctrl+A → pega todo el contenido del archivo que te acabo de dar → Commit changes.

No toques Apps Script esta vez.

Cuando hagas el commit, dime YA ESTÁ y verificamos la publicación. 

page_corregido_correlativo.tsx
Código
LA IMPRESION DEBE SALIR COMO LA SEGUNDA IMAGEN EL CUADRO NO COMO LA PRIMERA DISTORSIONADO 

Sí, ya veo la diferencia. La primera impresión está deformada verticalmente: al haber un solo ítem, el bloque de firmas se estira para ocupar casi toda la hoja. La segunda mantiene el cuadro compacto, con sus filas y proporciones originales.

Ya corregí el page.tsx para que salga como la segunda imagen:

Mantiene 13 filas visibles en la tabla aunque solo hayas registrado 1, 2 o 3 muestras.
El bloque de firmas ya no se estira hasta abajo.
El formulario queda ancho y compacto.
Logo, título, correlativo, fecha y datos quedan proporcionados.
Mantiene la corrección del correlativo previo que acabamos de hacer.
No toca BD SALIDAS ni Apps Script.

Descargar page.tsx corregido – impresión como segunda imagen

Ahora reemplaza nuevamente app/page.tsx en GitHub con este archivo y haz Commit changes.

No toques Apps Script.

Cuando esté publicado, prueba con 1 solo ítem. Aunque registres uno, en la impresión deben verse las 13 filas del cuadro, igual que en tu segunda imagen. 

page_impresion_como_referencia_2.tsx
Código
PERO SOLO QUE SALGA LA IMPRESION LOS ITEM RELLENADOS 

Sí, correcto. No deben salir las 13 filas vacías. Debe conservarse el tamaño y proporción de la segunda imagen, pero imprimir únicamente los ítems que realmente llenaste.

Ya lo corregí:

Descargar page.tsx – impresión solo con ítems rellenados

Quedará así:

1 ítem registrado → imprime 1 fila.
3 ítems → 3 filas.
8 ítems → 8 filas.
Sin filas vacías adicionales.
El cuadro de firmas queda compacto; no vuelve a estirarse como en la primera imagen.
Mantiene el correlativo previo y BD SALIDAS.

Reemplaza app/page.tsx en GitHub con este último archivo y haz Commit changes. No necesitas modificar Apps Script. 

page_impresion_solo_items_rellenados.tsx
Código

Biblioteca
/
page_impresion_solo_items_rellenados.tsx
9999
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
"use client";


import { useEffect, useMemo, useRef, useState } from "react";


type Role = "CONDUCTOR" | "PROVEEDOR" | "ACOMPAÑANTE";
type View = "registro" | "hoy" | "pendientes" | "buscar" | "personas" | "cargos";
type PersonRecord = { name: string; phone: string; license?: string; category?: string };
type Participant = { id: number; dni: string; name: string; phone: string; role: Role; license: string; category: string; found: boolean | null; newPerson: boolean; automaticDriver: boolean; expectedLater: boolean; lots: string; detail: string; lotCodes: string[]; cargoRegularize: boolean };
type EventForm = { motive: string; plate: string; zone: string; guard: string; shift: string; responsible: string };
type RecentPerson = { dni: string; name: string; role: Role; lots: string; detail: string; lotCodes: string[] };
type RecentItem = { id: string; time: string; plate: string; status: string; persons: RecentPerson[] };
type SheetPerson = RecentPerson & { phone: string; license?: string; category?: string };
type SheetEvent = { id: string; dateTime: string; caseId: number; status: string; pendingReasons?: string[]; motive: string; plate: string; zone: string; guard: string; shift: string; responsible: string; persons: SheetPerson[] };
type Connection = "checking" | "online" | "offline" | "unconfigured" | "outdated";
type QueueItem = { queueId: string; localId: string; action: "saveEvent" | "regularizeEvent"; payload: Record<string, unknown>; createdAt: string; attempts: number; lastError?: string; repairLegacy?: boolean };
type AlertType = "success" | "error" | "warning";
type ModalAlertType = Exclude<AlertType, "warning">;
type CargoType = "CHALA" | "PROVEEDORES" | "GENERALES";
type CargoRow = { id: number; type: string; code: string; weight: string; destination: string; description: string; reason: string; quantity: string; unit: string; observations: string };


const QUEUE_KEY = "acopio_sync_queue_v1";
const CLIENT_CACHE_KEY = "acopio_client_cache_v1";
const GENERAL_EXIT_TYPES = ["ÚTILES DE OFICINA", "ARTÍCULOS DE LIMPIEZA", "REGALOS BBSS", "EPPS", "PRENDAS DE CAMPAMENTO", "BIDÓN DE AGUA", "BIDÓN DE GASOLINA", "REPUESTOS PARA MOTOCARGA", "BALÓN DE GAS", "MATERIALES DE INSTALACIÓN"];
const CARGO_SAMPLE_TYPES = ["PPO", "RI", "RM", "2RI", "3RI", "2RM", "DIRIMENCIA", "DUPLICADO", "FACP", "REFERENCIALES", "RF"] as const;
const CONDUCTORS = ["JHOMAR GARCIA OSPINO", "WILDER CONCE YAURI", "WILMER ALVARADO ALIAGA", "DONALD ZAMBRANO BASURTO"];
const blankCargoRow = (id: number): CargoRow => ({ id, type: "", code: "", weight: "", destination: "", description: "", reason: "", quantity: "", unit: "", observations: "" });


const SUPPORTED_BACKEND_VERSIONS = ["ATENCION-2026-08-21-V11-LIGERO", "ATENCION-2026-08-21-V12-COLA-ROBUSTA", "ATENCION-2026-08-21-V13-REGULARIZACION-SEGURA", "ATENCION-2026-08-21-V14-REGULARIZACION-CAMPOS", "ATENCION-2026-09-27-V15-CARGOS"];


class SheetsApiError extends Error {
  status: number;
  configured: boolean;
  constructor(message: string, status: number, configured = true) {
    super(message);
    this.status = status;
    this.configured = configured;
  }
}


function requestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


const CASES = [
  { id: 1, title: "Ingreso general", note: "Conductor solo o con proveedor y acompañantes", tag: "GENERAL" },

Estás haciendo solicitudes demasiado rápido. Hemos limitado temporalmente el acceso a tus conversaciones para proteger tus datos.

Espera unos minutos antes de intentarlo de nuevo.
