Código pegado: js(20260927-203543)
Archivo
ese es el codigo corrigelo ahi
Pasted text(20260927-204446).txt
Documento
o eso?
al abrir se abre asi 
ya esta ahora quiero que la hoja de la impresion saga al margen y mas grande al menos todo ese margen
tambien quiero que la base de datos me aparezca en uno solo asi 
Código pegado: js(20260927-210323)
Archivo
ESPERA MEJOR QUE ME LANCE LOS DATOS TAL CUAL EL ENCABEZADO DE LA HOJA BD SALIDAS YA NO EL BD CARGO EN EHOJA 

La app es justamente la página que aparece en tu captura. Para abrirla nuevamente:

Abre Google Chrome.
En la barra de direcciones escribe o pega:

Abrir Atención al Cliente – AMS

Presiona Enter.
Cuando abra, presiona Ctrl + F5 para forzar la actualización.
En el menú izquierdo entra a Cargos y Salidas.

Si acabas de publicar la corrección de Apps Script, al recargar debemos comprobar que ya no aparezca el aviso rojo “Apps Script desactualizado”.

SIGUE APARECIENDO DESACTUALIZADO

No, en esta captura ya no aparece desactualizado. Mira la diferencia:

Antes salía en rojo:

Apps Script desactualizado

Ahora arriba aparece en verde:

Google Sheets conectado · Servidor V15
Conexión verificada

Y abajo a la izquierda también:

Google Sheets conectado · Servidor V15
Lectura y escritura habilitadas

Así que la conexión ya quedó corregida. ✅

Lo que todavía está mal es otra cosa: sigue mostrando:

CH - SE ASIGNA AL GUARDAR

Eso significa que el frontend no está mostrando la vista previa del correlativo, aunque el servidor ya está conectado.

No cambiemos Apps Script otra vez. El siguiente arreglo corresponde al page.tsx de GitHub, para que consulte previewCargoCorrelative y muestre, por ejemplo, CH-0200 antes de guardar.

Pásame tu page.tsx actual (el que tienes publicado ahora) y te lo corrijo completo sin tocar lo que acabamos de arreglar en BD SALIDAS.

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

Biblioteca
/
page_corregido_correlativo.tsx
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
