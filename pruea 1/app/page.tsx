"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "CONDUCTOR" | "PROVEEDOR" | "ACOMPAÑANTE";
type View = "registro" | "pendientes" | "buscar" | "personas";
type PersonRecord = { name: string; phone: string; license?: string; category?: string };
type Participant = { id: number; dni: string; name: string; phone: string; role: Role; license: string; category: string; found: boolean | null; newPerson: boolean; automaticDriver: boolean; expectedLater: boolean; lots: string; detail: string; lotCodes: string[]; cargoRegularize: boolean };
type EventForm = { motive: string; plate: string; zone: string; guard: string; shift: string; responsible: string };
type RecentPerson = { dni: string; name: string; role: Role; lots: string; detail: string; lotCodes: string[] };
type RecentItem = { id: string; time: string; plate: string; status: string; persons: RecentPerson[] };
type SheetPerson = RecentPerson & { phone: string; license?: string; category?: string };
type SheetEvent = { id: string; dateTime: string; caseId: number; status: string; pendingReasons?: string[]; motive: string; plate: string; zone: string; guard: string; shift: string; responsible: string; persons: SheetPerson[] };
type Connection = "checking" | "online" | "offline" | "unconfigured" | "outdated";
type QueueItem = { queueId: string; localId: string; action: "saveEvent" | "regularizeEvent"; payload: Record<string, unknown>; createdAt: string; attempts: number; lastError?: string };
type AlertType = "success" | "error" | "warning";
type ModalAlertType = Exclude<AlertType, "warning">;

const QUEUE_KEY = "acopio_sync_queue_v1";
const CLIENT_CACHE_KEY = "acopio_client_cache_v1";
const SUPPORTED_BACKEND_VERSIONS = ["ATENCION-2026-08-19-V8"];

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

const PEOPLE: Record<string, PersonRecord> = {
  "46281937": { name: "JUAN TAPIA GUTIÉRREZ", phone: "973928453", license: "Q46281937", category: "A-IIb" },
  "78541236": { name: "FIDEL VARGAS FUSTER", phone: "922342486" },
  "73420951": { name: "NELSY RI RIM", phone: "964108225" },
};

const CASES = [
  { id: 1, title: "General", note: "Vehículo, proveedor y acompañantes", tag: "COMPLETO" },
  { id: 2, title: "Solo conductor", note: "El conductor reporta lotes y carga", tag: "DIRECTO" },
  { id: 3, title: "Vehículo solo", note: "Proveedor llegará después", tag: "PENDIENTE" },
  { id: 4, title: "Proveedor solo", note: "Vehículo y conductor llegarán después", tag: "PENDIENTE" },
  { id: 5, title: "Retiro de lote", note: "Vehículo retira lotes registrados", tag: "RETIRO" },
  { id: 6, title: "RM / Muestreo / Recoger muestra", note: "Proveedor sin vehículo", tag: "ESPECIAL" },
];

function normalizeCategory(value?: string) {
  const raw = String(value ?? "").trim().toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, "");
  const compact = raw.replace(/-/g, "");
  const categories: Record<string, string> = { AI: "A-I", AIIA: "A-IIA", AIIB: "A-IIB", AIIIA: "A-IIIA", AIIIB: "A-IIIB", AIIIC: "A-IIIC" };
  return categories[compact] ?? raw;
}

function compactWritePayload(payload: Record<string, unknown>) {
  const source = payload as Record<string, unknown> & { participants?: Array<Partial<Participant>> };
  const compactParticipants = (source.participants || []).filter(person => /^\d{8}$/.test(String(person.dni || ""))).map(person => ({
    dni: String(person.dni || ""), name: String(person.name || ""), phone: String(person.phone || ""), role: person.role,
    license: person.role === "CONDUCTOR" ? String(person.license || "") : "",
    category: person.role === "CONDUCTOR" ? normalizeCategory(person.category) : "",
    lots: String(person.lots || ""), detail: String(person.detail || ""), lotCodes: (person.lotCodes || []).filter(Boolean),
  }));
  return { ...payload, participants: compactParticipants };
}

const blankPerson = (id: number, role: Role, automaticDriver = false): Participant => ({ id, dni: "", name: "", phone: "", role, license: "", category: "", found: null, newPerson: false, automaticDriver, expectedLater: false, lots: "", detail: "", lotCodes: [], cargoRegularize: false });
const knownPerson = (id: number, dni: string, role: Role, automaticDriver = false): Participant => {
  const person = PEOPLE[dni];
  return {
    ...blankPerson(id, role, automaticDriver),
    dni,
    name: person.name,
    phone: person.phone,
    license: role === "CONDUCTOR" ? person.license ?? "" : "",
    category: role === "CONDUCTOR" ? normalizeCategory(person.category) : "",
    found: true,
  };
};

function withCargo(person: Participant, lots: string, detail = "", lotCodes: string[] = []) {
  return { ...person, lots, detail, lotCodes };
}

function cargoMode(caseId: number, role: Role, providerCount = 1): "detail" | "codes" | null {
  if (role === "CONDUCTOR" && providerCount > 0) return null;
  if (caseId === 1 && role === "PROVEEDOR") return "detail";
  if (caseId === 1 && role === "CONDUCTOR") return "detail";
  if (caseId === 2 && role === "CONDUCTOR") return "detail";
  if ((caseId === 3 || caseId === 4) && role === "PROVEEDOR") return "detail";
  if (caseId === 5 && role === "CONDUCTOR") return "codes";
  if (caseId === 6 && role === "PROVEEDOR") return "codes";
  return null;
}

function nowValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function shiftFromDateTime(value: string) {
  const time = value.slice(11, 16);
  return time >= "07:00" && time < "19:00" ? "DÍA" : "NOCHE";
}

function emptyParticipantsForCase(caseId: number): Participant[] {
  if (caseId === 1) return [blankPerson(1, "CONDUCTOR", true), blankPerson(2, "PROVEEDOR")];
  if (caseId === 2) return [blankPerson(1, "CONDUCTOR", true)];
  if (caseId === 3) return [blankPerson(1, "CONDUCTOR", true), { ...blankPerson(2, "PROVEEDOR"), expectedLater: true, cargoRegularize: true }];
  if (caseId === 4) return [{ ...blankPerson(1, "CONDUCTOR", true), expectedLater: true }, blankPerson(2, "PROVEEDOR")];
  if (caseId === 5) return [blankPerson(1, "CONDUCTOR", true)];
  return [blankPerson(1, "PROVEEDOR")];
}

function validFullName(value: string) {
  return /^[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){2,}$/i.test(value.trim());
}

async function sheetsApi<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const controller = new AbortController();
  const writeAction = action === "saveEvent" || action === "regularizeEvent";
  const timeout = writeAction ? 45_000 : action === "searchPerson" || action === "health" ? 12_000 : 30_000;
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch("/api/sheets", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ action, payload }), signal: controller.signal, keepalive: writeAction });
    const result = await response.json().catch(() => ({ ok: false, error: "Respuesta inválida.", configured: true }));
    if (!response.ok || !result.ok) throw new SheetsApiError(result.error || "No se pudo completar la operación.", response.status, result.configured !== false);
    return result.data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new SheetsApiError("La conexión tardó demasiado; se reintentará automáticamente.", 0, true);
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function recentFromSheet(item: SheetEvent): RecentItem {
  return { id: item.id, time: new Date(item.dateTime).toLocaleString("es-PE"), plate: item.plate || "SIN PLACA", status: item.status === "PENDIENTE" ? "Pendiente" : "Registrado", persons: item.persons };
}

function queuePreview(item: QueueItem) {
  const payload = item.payload as { event?: Partial<EventForm>; participants?: Array<Partial<Participant>> };
  const persons = payload.participants || [];
  return {
    plate: String(payload.event?.plate || "SIN PLACA"),
    people: persons.map(person => String(person.name || person.dni || person.role || "PERSONA")).join(", ") || "Sin personas identificadas",
  };
}

function readCachedPerson(dni: string): PersonRecord | undefined {
  if (PEOPLE[dni]) return PEOPLE[dni];
  if (typeof window === "undefined") return undefined;
  try {
    const cache = JSON.parse(window.localStorage.getItem(CLIENT_CACHE_KEY) || "{}") as Record<string, PersonRecord>;
    return cache[dni];
  } catch {
    return undefined;
  }
}

function cachePerson(dni: string, person: PersonRecord) {
  if (typeof window === "undefined") return;
  try {
    const cache = JSON.parse(window.localStorage.getItem(CLIENT_CACHE_KEY) || "{}") as Record<string, PersonRecord>;
    const previous = cache[dni];
    const safePerson = { ...person, phone: /^\d{9}$/.test(person.phone) ? person.phone : previous?.phone || "" };
    window.localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify({ ...cache, [dni]: safePerson }));
  } catch {
    // El registro principal no debe fallar si el almacenamiento local está bloqueado.
  }
}

export default function Home() {
  const [activeCase, setActiveCase] = useState(1);
  const [activeView, setActiveView] = useState<View>("registro");
  const [dateTime, setDateTime] = useState(nowValue());
  const [event, setEvent] = useState<EventForm>(() => ({ motive: "PROCESO", plate: "VEF-803", zone: "HUANCAYO", guard: "A", shift: shiftFromDateTime(nowValue()), responsible: "LIZETH SURICHAQUI" }));
  const [participants, setParticipants] = useState<Participant[]>([knownPerson(1, "46281937", "CONDUCTOR", true), withCargo(knownPerson(2, "78541236", "PROVEEDOR"), "2", "60 20"), knownPerson(3, "73420951", "ACOMPAÑANTE")]);
  const [toast, setToast] = useState<{ message: string; type: ModalAlertType } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const [connection, setConnection] = useState<Connection>("checking");
  const [backendVersion, setBackendVersion] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [showQueueManager, setShowQueueManager] = useState(false);
  const queueRef = useRef<QueueItem[]>(queue);
  const syncLockRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const failedInCycleRef = useRef<Set<string>>(new Set());
  const backendVerifiedRef = useRef(false);
  const enqueueLockRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [regularizingId, setRegularizingId] = useState<string | null>(null);
  const [pendingEvents, setPendingEvents] = useState<SheetEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SheetEvent[]>([]);
  const [clients, setClients] = useState<Array<PersonRecord & { dni: string; role?: string }>>([]);
  const [recent, setRecent] = useState<RecentItem[]>([
    { id: "ING-00842", time: "10:18", plate: "VEF-803", status: "Registrado", persons: [{ dni: "46281937", name: "JUAN TAPIA GUTIÉRREZ", role: "CONDUCTOR", lots: "", detail: "", lotCodes: [] }, { dni: "78541236", name: "FIDEL VARGAS FUSTER", role: "PROVEEDOR", lots: "2", detail: "60 20", lotCodes: [] }] },
    { id: "ING-00841", time: "09:54", plate: "ABC-890", status: "Pendiente", persons: [{ dni: "46281937", name: "JUAN TAPIA GUTIÉRREZ", role: "CONDUCTOR", lots: "4", detail: "2 5 80 20", lotCodes: [] }] },
  ]);

  const caseInfo = CASES.find((item) => item.id === activeCase) ?? CASES[0];
  const hasVehicle = activeCase !== 6;
  const drivers = participants.filter((person) => person.role === "CONDUCTOR");
  const providers = participants.filter((person) => person.role === "PROVEEDOR");
  const totalLots = participants.reduce((total, person) => total + (Number(person.lots) || 0), 0);
  const motiveOptions = activeCase === 5 ? ["RETIRO DE LOTE"] : activeCase === 6 ? ["PROCESO", "RM", "MUESTREO", "RECOGER MUESTRA"] : ["PROCESO"];
  const motiveIsSelectable = activeCase === 5 || activeCase === 6;
  const connectionLabel = connection === "online" ? "CONECTADO" : connection === "outdated" ? "SCRIPT ANTERIOR" : connection === "unconfigured" ? "SIN CONFIGURAR" : connection === "checking" ? "VERIFICANDO" : "SIN INTERNET";
  const backendShort = backendVersion.match(/V\d+$/)?.[0] || "";
  const connectionTitle = connection === "online" ? `Google Sheets conectado${backendShort ? ` · Servidor ${backendShort}` : ""}` : connection === "outdated" ? "Apps Script desactualizado" : connection === "unconfigured" ? "Google Sheets sin configurar" : connection === "checking" ? "Verificando conexión" : "Trabajo sin conexión";

  const pendingReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!event.responsible.trim()) reasons.push("Responsable de atención");
    if (hasVehicle && !event.plate.trim()) reasons.push("Placa del vehículo");
    if (hasVehicle && !event.zone.trim()) reasons.push("Zona del vehículo");
    if ((activeCase === 3 || activeCase === 6) && providers.length === 0) reasons.push("Al menos un proveedor");
    if (hasVehicle && drivers.length === 0) reasons.push("Datos del conductor");
    participants.forEach((person) => {
      if (person.expectedLater && !person.dni) {
        reasons.push(`Datos del ${person.role.toLowerCase()} que llegará después`);
      } else {
        if (!/^\d{8}$/.test(person.dni)) reasons.push(`DNI válido de ${person.role.toLowerCase()}`);
        if (!validFullName(person.name)) reasons.push(`Nombre y dos apellidos de ${person.role.toLowerCase()}`);
        if (person.role === "ACOMPAÑANTE") {
          if (person.phone && !/^\d{9}$/.test(person.phone)) reasons.push("Celular válido de acompañante, o dejarlo vacío");
        } else if (!/^\d{9}$/.test(person.phone)) {
          reasons.push(`Celular de 9 dígitos de ${person.role.toLowerCase()}`);
        }
        if (person.role === "CONDUCTOR") {
          if (!person.license.trim()) reasons.push("Número de licencia del conductor");
          if (!person.category) reasons.push("Categoría de licencia del conductor");
        }
      }
      const mode = cargoMode(activeCase, person.role, providers.length);
      if (mode && !person.lots) reasons.push(`Número de lotes de ${person.name || person.role.toLowerCase()}`);
      if (mode === "detail" && !person.detail.trim()) reasons.push(`Detalle de carga de ${person.name || person.role.toLowerCase()}`);
      if (person.cargoRegularize) reasons.push(`Carga de ${person.name || person.role.toLowerCase()} marcada para regularizar`);
    });
    return Array.from(new Set(reasons));
  }, [activeCase, drivers.length, event, hasVehicle, participants, providers.length]);

  function flash(message: string, type: AlertType = "error") {
    if (type === "warning") {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      setNotice(message);
      noticeTimerRef.current = window.setTimeout(() => setNotice(null), 5000);
      return;
    }
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => setToast(null), type === "success" ? 4000 : 6000);
  }
  function storeQueue(rows: QueueItem[]) {
    try {
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify(rows));
      queueRef.current = rows;
      setQueue(rows);
      return true;
    } catch {
      return false;
    }
  }
  function connectionFromError(error: unknown): Connection {
    return error instanceof SheetsApiError && !error.configured ? "unconfigured" : "offline";
  }
  async function checkConnection(syncAfter = false) {
    if (!navigator.onLine) { setConnection("offline"); return; }
    try {
      const health = await sheetsApi<{ connected: boolean; backendVersion?: string }>("health");
      if (!health.backendVersion || !SUPPORTED_BACKEND_VERSIONS.includes(health.backendVersion)) {
        backendVerifiedRef.current = false;
        setBackendVersion(health.backendVersion || "");
        setConnection("outdated");
        return;
      }
      backendVerifiedRef.current = true;
      setBackendVersion(health.backendVersion);
      setConnection("online");
      if (syncAfter && queueRef.current.length) {
        void syncQueue();
        return;
      }
      void sheetsApi<SheetEvent[]>("recent", { limit: 8 }).then(rows => {
        setRecent(current => {
          const locals = current.filter(item => item.status === "Por sincronizar");
          return [...locals, ...rows.map(recentFromSheet)].slice(0, 8);
        });
      }).catch(() => undefined);
    } catch (error) {
      backendVerifiedRef.current = false;
      setConnection(connectionFromError(error));
    }
  }
  async function syncQueue(force = false) {
    if (syncLockRef.current || !queueRef.current.length || !navigator.onLine) return;
    let item = queueRef.current.find(row => !failedInCycleRef.current.has(row.queueId));
    if (!item && force) {
      failedInCycleRef.current.clear();
      item = queueRef.current[0];
    }
    if (!item) return;
    syncLockRef.current = true; setSyncing(true);
    let continueQueue = false;
    let retryDelay = 0;
    try {
      if (!backendVerifiedRef.current) {
        const health = await sheetsApi<{ connected: boolean; backendVersion?: string }>("health");
        if (!health.backendVersion || !SUPPORTED_BACKEND_VERSIONS.includes(health.backendVersion)) {
          setConnection("outdated");
          return;
        }
        backendVerifiedRef.current = true;
        setBackendVersion(health.backendVersion);
      }
      setConnection("online");
      try {
        const saved = await sheetsApi<SheetEvent>(item.action, compactWritePayload(item.payload));
        if (!storeQueue(queueRef.current.filter(row => row.queueId !== item.queueId))) {
          flash("No se pudo actualizar la cola local. Libera espacio en el dispositivo.");
          return;
        }
        const recentItem = recentFromSheet(saved);
        setRecent(current => [recentItem, ...current.filter(row => row.id !== item.localId && row.id !== saved.id)].slice(0, 8));
        failedInCycleRef.current.delete(item.queueId);
        if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
        if (!queueRef.current.length) failedInCycleRef.current.clear();
        continueQueue = queueRef.current.some(row => !failedInCycleRef.current.has(row.queueId));
        flash(continueQueue ? `${saved.id} registrado correctamente en Google Sheets. Continúa el siguiente registro.` : `${saved.id} registrado correctamente. Sincronización completada.`, "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error de sincronización";
        const attempts = item.attempts + 1;
        storeQueue(queueRef.current.map(row => row.queueId === item.queueId ? { ...row, attempts, lastError: message } : row));
        const retryable = /SERVIDOR_OCUPADO|candado|reintentar|tardó demasiado|tiempo de espera/i.test(message);
        if (retryable) {
          setConnection("online");
          retryDelay = Math.min(2000 * Math.pow(2, Math.min(attempts - 1, 3)), 15_000);
          flash(`Google Sheets está ocupado. El registro sigue protegido y se reintentará en segundo plano.`, "warning");
        } else {
          failedInCycleRef.current.add(item.queueId);
          const serverResponded = error instanceof SheetsApiError && error.status > 0 && error.configured;
          if (!serverResponded) backendVerifiedRef.current = false;
          setConnection(serverResponded ? "online" : connectionFromError(error));
          continueQueue = queueRef.current.some(row => !failedInCycleRef.current.has(row.queueId));
          flash(`Pendiente de sincronización. El registro sigue protegido en el dispositivo. Motivo: ${message}`, "warning");
        }
      }
    } catch (error) {
      backendVerifiedRef.current = false;
      setConnection(connectionFromError(error));
      flash(`Sincronización pendiente. Los registros siguen protegidos. ${error instanceof Error ? error.message : "Verifica la conexión."}`, "warning");
    }
    finally {
      syncLockRef.current = false;
      setSyncing(false);
      if (retryDelay) {
        if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = window.setTimeout(() => { void syncQueue(); }, retryDelay);
      } else if (continueQueue) {
        window.setTimeout(() => { void syncQueue(); }, 800);
      }
    }
  }

  function retryQueued(queueId: string) {
    const selected = queueRef.current.find(item => item.queueId === queueId);
    if (!selected || syncing) return;
    failedInCycleRef.current.delete(queueId);
    const reordered = [{ ...selected, attempts: 0, lastError: undefined }, ...queueRef.current.filter(item => item.queueId !== queueId)];
    if (!storeQueue(reordered)) return flash("No se pudo actualizar la cola local. Libera espacio en el dispositivo.");
    flash("Reintento iniciado. Puedes continuar usando el formulario.", "warning");
    window.setTimeout(() => { void syncQueue(true); }, 0);
  }

  function removeQueued(queueId: string) {
    const selected = queueRef.current.find(item => item.queueId === queueId);
    if (!selected || !window.confirm(`Eliminar ${selected.localId} de este dispositivo? Hazlo solo si comprobaste que no está registrado en MATRIZ.`)) return;
    failedInCycleRef.current.delete(queueId);
    if (!storeQueue(queueRef.current.filter(item => item.queueId !== queueId))) return flash("No se pudo actualizar la cola local. Libera espacio en el dispositivo.");
    setRecent(current => current.filter(item => item.id !== selected.localId));
    flash(`${selected.localId} fue eliminado de la cola del dispositivo.`, "warning");
    if (!queueRef.current.length) setShowQueueManager(false);
  }

  function removeAllQueued() {
    if (!queueRef.current.length || !window.confirm(`Eliminar los ${queueRef.current.length} registros pendientes de este dispositivo? Confirma primero que no estén registrados en MATRIZ.`)) return;
    const localIds = new Set(queueRef.current.map(item => item.localId));
    if (!storeQueue([])) return flash("No se pudo limpiar la cola local. Libera espacio en el dispositivo.");
    failedInCycleRef.current.clear();
    setRecent(current => current.filter(item => !localIds.has(item.id)));
    setShowQueueManager(false);
    flash("La cola local fue eliminada.", "warning");
  }

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => registration.update());
    }
    const online = () => { void checkConnection(true); };
    const offline = () => setConnection("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const initialCheck = window.setTimeout(() => {
      let restored: QueueItem[] = [];
      try { restored = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || "[]") as QueueItem[]; } catch { restored = []; }
      queueRef.current = restored;
      setQueue(restored);
      void checkConnection(true);
    }, 0);
    const timer = window.setInterval(() => {
      if (!navigator.onLine) return;
      if (queueRef.current.length) void syncQueue();
      else void checkConnection(false);
    }, 15_000);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); window.clearTimeout(initialCheck); if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current); if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current); if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current); window.clearInterval(timer); };
    // La comprobación se inicia una sola vez; las funciones usan referencias estables para la cola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateParticipant(id: number, changes: Partial<Participant>) { setParticipants((current) => current.map((person) => person.id === id ? { ...person, ...changes } : person)); }
  function resizeLotCodes(id: number, value: string) {
    const count = Math.min(Number(value) || 0, 30);
    setParticipants((current) => current.map((person) => person.id === id ? { ...person, lots: value, lotCodes: Array.from({ length: count }, (_, index) => person.lotCodes[index] ?? "") } : person));
  }
  function updateLotCode(id: number, index: number, value: string) {
    setParticipants((current) => current.map((person) => person.id === id ? { ...person, lotCodes: person.lotCodes.map((code, codeIndex) => codeIndex === index ? value.toUpperCase() : code) } : person));
  }

  async function searchDni(person: Participant) {
    if (!/^\d{8}$/.test(person.dni)) return flash("El DNI debe contener exactamente 8 números");
    const applyFoundPerson = (result: PersonRecord, offline = false) => {
      // La ocupación corresponde a este ingreso. Nunca debe ser reemplazada por
      // la ocupación histórica guardada en BD CLIENTES.
      updateParticipant(person.id, {
        name: result.name,
        phone: result.phone,
        role: person.role,
        found: true,
        newPerson: false,
        expectedLater: false,
        license: person.role === "CONDUCTOR" ? result.license ?? "" : "",
        category: person.role === "CONDUCTOR" ? normalizeCategory(result.category) : "",
      });
      cachePerson(person.dni, result);
      flash(offline ? "Persona encontrada en la copia local de BD CLIENTES" : "Persona encontrada en BD CLIENTES", "warning");
    };
    const applyNewPerson = () => {
      updateParticipant(person.id, { found: false, newPerson: true, name: "", phone: "", license: "", category: "", expectedLater: false });
      flash("DNI no encontrado: completa los datos para registrarlo en BD CLIENTES");
    };
    const cached = readCachedPerson(person.dni);
    if (cached) {
      applyFoundPerson(cached, true);
      void sheetsApi<{ found: boolean; person?: PersonRecord }>("searchPerson", { dni: person.dni }).then(result => {
        if (result.found && result.person) {
          updateParticipant(person.id, {
            name: result.person.name, phone: result.person.phone, role: person.role, found: true, newPerson: false, expectedLater: false,
            license: person.role === "CONDUCTOR" ? result.person.license ?? "" : "",
            category: person.role === "CONDUCTOR" ? normalizeCategory(result.person.category) : "",
          });
          cachePerson(person.dni, result.person);
          setConnection("online");
        }
      }).catch(() => undefined);
      return;
    }
    setBusy(true);
    try {
      // El indicador de conexión puede quedar desactualizado. La búsqueda siempre
      // intenta consultar Google Sheets antes de decidir que el DNI es nuevo.
      const result = await sheetsApi<{ found: boolean; person?: PersonRecord }>("searchPerson", { dni: person.dni });
      if (result.found && result.person) {
        applyFoundPerson(result.person);
      } else {
        applyNewPerson();
      }
    } catch (error) {
      setConnection(connectionFromError(error));
      updateParticipant(person.id, { found: null, newPerson: false });
      const detail = (error instanceof Error ? error.message : "Error de conexión").replace(/[.!?]+$/, "");
      flash(`No se pudo consultar BD CLIENTES: ${detail}. El DNI no fue marcado como nuevo.`, "warning");
    }
    finally { setBusy(false); }
  }

  function registerNewPerson(person: Participant) {
    if (!/^\d{8}$/.test(person.dni)) return flash("El DNI debe tener 8 números");
    if (!validFullName(person.name)) return flash("Registra como mínimo un nombre y dos apellidos, solo texto");
    if (person.role === "ACOMPAÑANTE") {
      if (person.phone && !/^\d{9}$/.test(person.phone)) return flash("El celular del acompañante debe tener 9 números o quedar vacío");
    } else if (!/^\d{9}$/.test(person.phone)) return flash("El celular debe tener exactamente 9 números");
    if (person.role === "CONDUCTOR" && (!person.license.trim() || !person.category)) return flash("Completa el número y la categoría de licencia");
    updateParticipant(person.id, { found: true, newPerson: false });
    flash("La persona se añadirá a BD CLIENTES al guardar el ingreso", "warning");
  }

  function applyCase(caseId: number) {
    setRegularizingId(null); setActiveCase(caseId); setDateTime(nowValue());
    const baseEvent = { ...event, motive: "PROCESO", plate: "VEF-803", zone: "HUANCAYO" };
    if (caseId === 1) { setEvent(baseEvent); setParticipants([knownPerson(1, "46281937", "CONDUCTOR", true), withCargo(knownPerson(2, "78541236", "PROVEEDOR"), "2", "60 20"), knownPerson(3, "73420951", "ACOMPAÑANTE")]); }
    if (caseId === 2) { setEvent({ ...baseEvent, plate: "ABC-890" }); setParticipants([withCargo(knownPerson(1, "46281937", "CONDUCTOR", true), "4", "2 5 80 20")]); }
    if (caseId === 3) { setParticipants([knownPerson(1, "46281937", "CONDUCTOR", true), { ...blankPerson(2, "PROVEEDOR"), expectedLater: true, cargoRegularize: true }]); }
    if (caseId === 4) { setEvent({ ...baseEvent, plate: "", zone: "" }); setParticipants([{ ...blankPerson(1, "CONDUCTOR", true), expectedLater: true }, withCargo(knownPerson(2, "78541236", "PROVEEDOR"), "3", "100 50 20")]); }
    if (caseId === 5) { setEvent({ ...baseEvent, motive: "RETIRO DE LOTE", plate: "ABC-890", zone: "JAUJA" }); setParticipants([withCargo(knownPerson(1, "46281937", "CONDUCTOR", true), "2", "", ["L-204", "L-205"]), knownPerson(2, "73420951", "ACOMPAÑANTE")]); }
    if (caseId === 6) { setEvent({ ...baseEvent, motive: "MUESTREO", plate: "", zone: "" }); setParticipants([withCargo(knownPerson(1, "73420951", "PROVEEDOR"), "3", "", ["RM-120", "RM-121", "RM-122"])]); }
  }

  function clearEntryKeepingGeneral() {
    setEvent(current => ({ ...current, motive: activeCase === 5 ? "RETIRO DE LOTE" : activeCase === 6 ? "MUESTREO" : "PROCESO", plate: "", zone: "" }));
    setParticipants(emptyParticipantsForCase(activeCase));
    setRegularizingId(null);
  }

  function saveEvent(forRegularization: boolean) {
    if (pendingReasons.length && !forRegularization) return flash(`No se guardó. Faltan datos: ${pendingReasons.slice(0, 5).join("; ")}${pendingReasons.length > 5 ? "; y otros campos" : ""}.`);
    if (enqueueLockRef.current) return;
    enqueueLockRef.current = true;
    window.setTimeout(() => { enqueueLockRef.current = false; }, 500);
    const action = regularizingId ? "regularizeEvent" : "saveEvent";
    const clientRequestId = requestId();
    const compactParticipants = participants.filter(person => /^\d{8}$/.test(person.dni)).map(person => ({
      dni: person.dni, name: person.name, phone: person.phone, role: person.role,
      license: person.role === "CONDUCTOR" ? person.license : "",
      category: person.role === "CONDUCTOR" ? normalizeCategory(person.category) : "",
      lots: person.lots, detail: person.detail, lotCodes: person.lotCodes.filter(Boolean),
    }));
    const payload = { id: regularizingId, caseId: activeCase, dateTime, event, participants: compactParticipants, forRegularization, pendingReasons, clientRequestId };
    const localId = regularizingId || `LOCAL-${clientRequestId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const queued: QueueItem = { queueId: clientRequestId, localId, action, payload, createdAt: dateTime, attempts: 0 };
    if (!storeQueue([...queueRef.current, queued])) {
      enqueueLockRef.current = false;
      return flash("No se pudo asegurar el registro en este dispositivo. Libera espacio antes de continuar.");
    }
    compactParticipants.forEach(person => cachePerson(person.dni, { name: person.name, phone: person.phone, license: person.license, category: person.category }));
    setRecent(current => [{ id: localId, time: new Date(dateTime).toLocaleString("es-PE"), plate: event.plate || "SIN PLACA", status: "Por sincronizar", persons: participants.filter(person => /^\d{8}$/.test(person.dni)) }, ...current.filter(row => row.id !== localId)].slice(0, 8));
    clearEntryKeepingGeneral();
    flash(forRegularization ? "Guardado en el dispositivo para regularizar. Pendiente de confirmación en Google Sheets." : "Registro asegurado en el dispositivo. Pendiente de confirmación en Google Sheets.", "warning");
    window.setTimeout(() => { void syncQueue(); }, 0);
  }

  async function loadPending() {
    setBusy(true); try { setPendingEvents(await sheetsApi<SheetEvent[]>("pending")); }
    catch (error) { flash(error instanceof Error ? error.message : "No se pudieron cargar los pendientes", "warning"); }
    finally { setBusy(false); }
  }

  async function runSearch() {
    if (!searchQuery.trim()) return flash("Escribe una placa, código, nombre, DNI o ID");
    setBusy(true); try { setSearchResults(await sheetsApi<SheetEvent[]>("search", { query: searchQuery, limit: 30 })); }
    catch (error) { flash(error instanceof Error ? error.message : "No se pudo buscar", "warning"); }
    finally { setBusy(false); }
  }

  async function loadClients() {
    setBusy(true); try { setClients(await sheetsApi<Array<PersonRecord & { dni: string; role?: string }>>("listPeople", { limit: 200 })); }
    catch (error) { flash(error instanceof Error ? error.message : "No se pudo cargar BD CLIENTES", "warning"); }
    finally { setBusy(false); }
  }

  function openRegularization(item: SheetEvent) {
    setRegularizingId(item.id); setActiveCase(item.caseId || 1); setDateTime(nowValue());
    setEvent({ motive: item.motive, plate: item.plate, zone: item.zone, guard: item.guard, shift: item.shift, responsible: item.responsible });
    const loaded = item.persons.map((person, index) => ({ ...blankPerson(index + 1, person.role, person.role === "CONDUCTOR"), ...person, category: person.role === "CONDUCTOR" ? normalizeCategory(person.category) : "", found: true }));
    if ((item.caseId || 1) === 4 && !loaded.some((person) => person.role === "CONDUCTOR")) {
      loaded.unshift({ ...blankPerson(loaded.length + 1, "CONDUCTOR", true), expectedLater: true });
    }
    setParticipants(loaded.map((person, index) => ({ ...person, id: index + 1 })));
    setActiveView("registro"); flash(`${item.id} abierto: las personas nuevas se insertarán debajo de su bloque`, "warning");
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">AC</span><div><strong>Atención al Cliente</strong><small>Control de ingresos</small></div></div>
      <nav aria-label="Navegación principal">
        <button className={activeView === "registro" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("registro")}><span>＋</span> Nuevo ingreso</button>
        <button className={activeView === "pendientes" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("pendientes"); void loadPending(); }}><span>◷</span> Por regularizar {pendingEvents.length > 0 && <b>{pendingEvents.length}</b>}</button>
        <button className={activeView === "buscar" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("buscar")}><span>⌕</span> Buscar</button>
        <button className={activeView === "personas" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("personas"); void loadClients(); }}><span>◎</span> BD Clientes</button>
      </nav>
      <div className={`sidebar-card connection-${connection}`}><span className="status-dot" /><div><strong>{connectionTitle}</strong><small>{queue.length ? `${queue.length} registro(s) por sincronizar` : connection === "online" ? "Lectura y escritura habilitadas" : connection === "outdated" ? "Actualiza la implementación de Apps Script" : connection === "unconfigured" ? "Falta configurar Apps Script" : "Los registros quedarán en este equipo"}</small>{queue.length > 0 && <button className="sidebar-sync" type="button" onClick={() => void syncQueue(true)} disabled={syncing || connection === "unconfigured" || connection === "outdated"}>{syncing ? "Sincronizando…" : "Sincronizar ahora"}</button>}</div></div>
      <div className="user-card"><span>LS</span><div><strong>Lizeth Surichaqui</strong><small>Responsable de atención</small></div></div>
    </aside>

    <section className="workspace">
      <header className="topbar"><div><p>OPERACIONES / ATENCIÓN AL CLIENTE</p><h1>{activeView === "registro" ? (regularizingId ? `Regularizar ${regularizingId}` : "Registrar ingreso") : activeView === "pendientes" ? "Eventos por regularizar" : activeView === "buscar" ? "Buscar registros" : "BD Clientes"}</h1></div><div className="header-actions"><span className={`online connection-pill-${connection}`}>● {connectionLabel}</span></div></header>
      <section className={`sync-strip connection-${connection}`}><div className="sync-status"><span className="status-dot" /><p><strong>{connectionTitle}</strong><small>{connection === "outdated" ? "La versión activa escribe en columnas incorrectas. Los nuevos registros se conservarán en este dispositivo hasta actualizarla." : queue.length ? `${queue.length} registro(s) asegurado(s). ${syncing ? `Procesando la cola; los demás esperan protegidos.` : queue.some(item => item.lastError) ? "Hay registros que requieren revisión. Abre Gestionar pendientes para ver el motivo." : "Listos para enviarse uno por uno."}` : connection === "online" ? "Conexión verificada. No hay registros pendientes de envío." : "Puedes continuar registrando; los datos se conservarán en este dispositivo."}</small></p></div>{queue.length > 0 && <div className="sync-actions"><button className="manage-sync" type="button" onClick={() => setShowQueueManager(current => !current)}>{showQueueManager ? "Ocultar pendientes" : `Gestionar pendientes (${queue.length})`}</button><button type="button" onClick={() => void syncQueue(true)} disabled={syncing || connection === "unconfigured" || connection === "outdated"}>{syncing ? `Sincronizando…` : `Sincronizar ahora`}</button></div>}</section>
      {showQueueManager && queue.length > 0 && <section className="queue-manager"><div className="queue-manager-head"><div><strong>Pendientes guardados en este dispositivo</strong><span>Un registro con error ya no detiene a los demás. Revísalo antes de eliminarlo.</span></div><button type="button" className="danger-link" onClick={removeAllQueued}>Eliminar todos</button></div><div className="queue-list">{queue.map(item => { const preview = queuePreview(item); return <article className={item.lastError ? "queue-item has-error" : "queue-item"} key={item.queueId}><div className="queue-item-main"><strong>{item.localId}</strong><span>{new Date(item.createdAt).toLocaleString("es-PE")} · {item.action === "regularizeEvent" ? "REGULARIZACIÓN" : "NUEVO INGRESO"}</span><p>{preview.plate} · {preview.people}</p>{item.lastError && <em>{item.lastError}</em>}</div><div className="queue-item-actions"><button type="button" onClick={() => retryQueued(item.queueId)} disabled={syncing}>Reintentar</button><button type="button" className="danger" onClick={() => removeQueued(item.queueId)} disabled={syncing}>Eliminar</button></div></article>; })}</div></section>}

      {activeView === "registro" && <>
        {regularizingId && <section className="regularization-banner"><div><strong>Regularización activa: {regularizingId}</strong><span>Las filas existentes conservan su fecha y hora; solo las personas nuevas usan la hora actual.</span></div></section>}
        <section className="case-panel"><div className="case-heading"><div><span>MATRIZ OPERATIVA ACTUALIZADA</span><h2>Prueba los 6 casos de atención</h2></div><p>No se guarda N.º de personas; el total se calcula contando las filas con el mismo ID.</p></div><div className="case-grid six-cases">{CASES.map((item) => <button type="button" key={item.id} className={activeCase === item.id ? "case-chip selected" : "case-chip"} onClick={() => applyCase(item.id)}><b>{item.id}</b><span><strong>{item.title}</strong><small>{item.note}</small></span><em>{item.tag}</em></button>)}</div></section>

        <form onSubmit={(e) => e.preventDefault()} className="form-layout"><div className="main-column">
          <section className="form-card"><div className="section-title"><span>1</span><div><h2>Datos generales</h2><p>Fecha, responsable, guardia y turno</p></div><em>CASO {activeCase}: {caseInfo.title.toUpperCase()}</em></div><div className="fields-grid general-grid">
            <label>Fecha y hora de ingreso<input type="datetime-local" value={dateTime} onInput={(e) => { const value = e.currentTarget.value; setDateTime(value); setEvent(current => ({ ...current, shift: shiftFromDateTime(value) })); }} onChange={() => undefined} /></label>
            <label>Responsable<input value={event.responsible} onChange={(e) => setEvent({ ...event, responsible: e.target.value.replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, "").toUpperCase() })} /></label>
            <label>Guardia<select value={event.guard} onChange={(e) => setEvent({ ...event, guard: e.target.value })}><option>A</option><option>B</option><option>C</option></select></label>
            <label>Turno<select value={event.shift} disabled><option>DÍA</option><option>NOCHE</option></select><small>Automático: Día 07:00–18:59 · Noche 19:00–06:59</small></label>
          </div></section>

          <section className="form-card"><div className="section-title"><span>2</span><div><h2>Datos del ingreso</h2><p>Motivo, placa y zona del vehículo</p></div><em>{hasVehicle ? "CON VEHÍCULO" : "SIN VEHÍCULO"}</em></div><div className="fields-grid operation-grid">
            <label>Motivo de ingreso<select value={event.motive} disabled={!motiveIsSelectable} onChange={(e) => setEvent({ ...event, motive: e.target.value })}>{motiveOptions.map((motive) => <option key={motive}>{motive}</option>)}</select><small>{activeCase <= 4 ? "Opción única: PROCESO" : activeCase === 5 ? "Motivo del caso: RETIRO DE LOTE" : "PROCESO, RM, MUESTREO o RECOGER MUESTRA"}</small></label>
            {hasVehicle ? <><label>Placa del vehículo<input maxLength={7} placeholder="Máximo 7 caracteres" value={event.plate} onChange={(e) => setEvent({ ...event, plate: e.target.value.slice(0, 7) })} /><small>Única restricción: máximo 7 caracteres</small></label><label>Zona<input placeholder="Ej. HUANCAYO" value={event.zone} onChange={(e) => setEvent({ ...event, zone: e.target.value.replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, "").toUpperCase() })} /></label></> : <div className="locked-fields wide"><span>⊘</span><div><strong>Placa y zona no aplican en el caso 6</strong><small>El proveedor llega sin vehículo para RM, muestreo o recoger muestra.</small></div></div>}
          </div></section>

          <section className="form-card"><div className="section-title"><span>3</span><div><h2>Personas y lotes</h2><p>Conductor automático, participantes y datos de carga</p></div><em>{participants.length} {participants.length === 1 ? "PERSONA" : "PERSONAS"}</em></div>
            {activeCase !== 6 && <div className="driver-banner"><span>✓</span><div><strong>Conductor generado automáticamente</strong><small>Este bloque es obligatorio en el caso {activeCase}. Incluye número y categoría de licencia.</small></div></div>}
            <div className="participants-list">{participants.map((person, index) => {
              const mode = cargoMode(activeCase, person.role, providers.length);
              return <article className={`participant-card role-${person.role.toLowerCase()} ${person.expectedLater ? "expected" : ""}`} key={person.id}>
              <div className="participant-head"><div><span className="person-number">{index + 1}</span>{person.automaticDriver ? <strong>CONDUCTOR OBLIGATORIO</strong> : <select aria-label={`Ocupación de persona ${index + 1}`} value={person.role} onChange={(e) => { const role = e.target.value as Role; updateParticipant(person.id, { role, license: "", category: "", ...(role === "ACOMPAÑANTE" ? { lots: "", detail: "", lotCodes: [], cargoRegularize: false } : {}) }); }}><option>PROVEEDOR</option><option>ACOMPAÑANTE</option></select>}</div>{!person.automaticDriver && participants.length > 1 && <button type="button" className="remove" onClick={() => setParticipants((current) => current.filter((item) => item.id !== person.id))}>Eliminar</button>}</div>
              {person.expectedLater && <div className="expected-note"><span>◷</span><div><strong>{person.role === "CONDUCTOR" ? "Conductor" : "Proveedor"} pendiente de llegada</strong><small>No se crea una fila vacía; se insertará al regularizar.</small></div><button type="button" onClick={() => updateParticipant(person.id, { expectedLater: false })}>Completar datos del {person.role === "CONDUCTOR" ? "conductor" : "proveedor"}</button></div>}
              {!person.expectedLater && <><div className="person-fields">
                <label>DNI<div className="search-control"><input inputMode="numeric" maxLength={8} placeholder="8 números" value={person.dni} onChange={(e) => updateParticipant(person.id, { dni: e.target.value.replace(/\D/g, "").slice(0, 8), found: null, newPerson: false, name: "", phone: "", license: "", category: "" })} onKeyDown={(e) => { if (e.key === "Enter" && person.dni.length === 8) { e.preventDefault(); void searchDni(person); } }} /><button type="button" aria-label={`Buscar DNI ${person.dni}`} disabled={person.dni.length !== 8 || busy} onClick={() => void searchDni(person)}>{busy ? "Buscando…" : "Buscar DNI"}</button></div><small>Consulta BD CLIENTES siempre; solo usa la copia local si la conexión falla.</small></label>
                <label>Nombres y apellidos<input value={person.name} readOnly={!person.newPerson} placeholder="1 nombre y 2 apellidos" onChange={(e) => updateParticipant(person.id, { name: e.target.value.replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, "").toUpperCase() })} /><small>Solo texto; mínimo tres palabras</small></label>
                <label>Celular<input inputMode="numeric" maxLength={9} value={person.phone} placeholder={person.role === "ACOMPAÑANTE" ? "Opcional" : "9 números"} onChange={(e) => updateParticipant(person.id, { phone: e.target.value.replace(/\D/g, "").slice(0, 9) })} /><small>{person.role === "ACOMPAÑANTE" ? "Opcional; si cambia, actualiza BD CLIENTES" : "9 números; puedes corregirlo y actualizar BD CLIENTES"}</small></label>
              </div>
              {person.role === "CONDUCTOR" && <div className="license-fields"><label>Número de licencia<input placeholder="Ej. Q46281937" value={person.license} onChange={(e) => updateParticipant(person.id, { license: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} /><small>Editable para completar o actualizar el registro.</small></label><label>Categoría<select value={normalizeCategory(person.category)} onChange={(e) => updateParticipant(person.id, { category: normalizeCategory(e.target.value) })}><option value="">Seleccionar</option><option value="A-I">A-I</option><option value="A-IIA">A-IIa</option><option value="A-IIB">A-IIb</option><option value="A-IIIA">A-IIIa</option><option value="A-IIIB">A-IIIb</option><option value="A-IIIC">A-IIIc</option></select><small>Se actualizará también en BD CLIENTES.</small></label></div>}
              {person.found === true && <div className="match-message success"><span>✓</span><div><strong>Persona identificada</strong><small>Encontrada o lista para añadirse a BD CLIENTES</small></div></div>}
              {person.newPerson && <div className="new-person"><div><span>!</span><p><strong>DNI no registrado</strong><small>Completa nombres{person.role === "ACOMPAÑANTE" ? "; el celular es opcional" : ", celular"}{person.role === "CONDUCTOR" ? ", licencia y categoría" : ""}.</small></p></div><button type="button" onClick={() => registerNewPerson(person)}>Registrar nueva persona</button></div>}
              {mode && <div className="cargo-block person-cargo"><div className="cargo-heading"><div><span>▦</span><div><h3>{mode === "codes" ? "Lotes y códigos opcionales" : "Lotes y detalle de carga"}</h3><p>Información enlazada únicamente a {person.name || `este ${person.role.toLowerCase()}`}.</p></div></div><label className="regularize-inline"><input type="checkbox" checked={person.cargoRegularize} onChange={(e) => updateParticipant(person.id, { cargoRegularize: e.target.checked })} /><span><strong>Regularizar</strong><small>Esta información</small></span></label></div>
                <div className="cargo-fields"><label>Número de lotes<input inputMode="numeric" placeholder="Ej. 3" value={person.lots} onChange={(e) => mode === "codes" ? resizeLotCodes(person.id, e.target.value.replace(/\D/g, "")) : updateParticipant(person.id, { lots: e.target.value.replace(/\D/g, "") })} /></label>{mode === "detail" && <label>Detalle de carga<input placeholder="Ej. 60 20 40" value={person.detail} onChange={(e) => updateParticipant(person.id, { detail: e.target.value.toUpperCase() })} /><small>Valores separados por un espacio</small></label>}</div>
                {mode === "codes" && person.lots && <div className="lot-codes-grid">{person.lotCodes.map((code, codeIndex) => <label key={codeIndex}>Código de lote {codeIndex + 1} (opcional)<input placeholder="Puede dejarse vacío" value={code} onChange={(e) => updateLotCode(person.id, codeIndex, e.target.value)} /></label>)}</div>}
                {person.cargoRegularize && <div className="regularize-message"><span>◷</span><div><strong>Carga marcada para regularización</strong><small>Podrá completarse posteriormente sin afectar la información de otros proveedores.</small></div></div>}
              </div>}</>}
            </article>;
            })}</div>
            <button className="add-person" type="button" onClick={() => setParticipants((current) => [...current, blankPerson(Math.max(...current.map((p) => p.id), 0) + 1, activeCase === 1 || activeCase === 3 || activeCase === 6 ? "PROVEEDOR" : "ACOMPAÑANTE")])}><span>＋</span> Agregar proveedor o acompañante</button>
          </section>
        </div>

        <aside className="summary-column"><section className="summary-card"><div className="summary-title"><span>✓</span><div><h2>Validación del caso</h2><p>Reglas aplicadas automáticamente</p></div></div><ul className="rule-list">
          <li><span className={activeCase === 6 || drivers.length ? "ok" : "warn"}>{activeCase === 6 || drivers.length ? "✓" : "!"}</span><div><strong>Conductor</strong><small>{activeCase === 6 ? "No aplica en RM/Muestreo/Recojo" : "Bloque obligatorio generado"}</small></div></li>
          <li><span className="ok">✓</span><div><strong>Vehículo</strong><small>{hasVehicle ? event.plate || "Sin placa registrada" : "No aplica para el caso 6"}</small></div></li>
          <li><span className={pendingReasons.length ? "warn" : "ok"}>{pendingReasons.length ? "!" : "✓"}</span><div><strong>Estado del registro</strong><small>{pendingReasons.length ? `${pendingReasons.length} dato(s) pendiente(s)` : "Listo para registrar"}</small></div></li>
        </ul>{pendingReasons.length > 0 && <div className="pending-box"><strong>Pendiente de completar</strong>{pendingReasons.slice(0, 6).map((reason) => <span key={reason}>• {reason}</span>)}</div>}<div className="summary-total"><span>Participantes actuales</span><b>{participants.filter(person => person.dni).length}</b><span>Proveedores</span><b>{providers.filter(person => person.dni).length}</b><span>Total de lotes</span><b>{totalLots || "—"}</b><span>Destino</span><b>MATRIZ</b></div><div className="action-stack"><button className="primary-action" type="button" disabled={busy} onClick={() => saveEvent(false)}>{regularizingId ? "Guardar regularización" : "Guardar"}<span>✓</span></button><button className="secondary-action" type="button" disabled={busy} onClick={() => saveEvent(true)}>Guardar para regularizar<span>◷</span></button></div><p className="action-help">El formulario se libera al instante. La escritura en MATRIZ continúa en segundo plano.</p>{connection !== "online" && <p className="connection-warning">{connection === "outdated" ? "Protección activa: no se enviarán datos al script anterior. El registro quedará en este dispositivo hasta instalar la versión correcta." : "Modo campo activo: el registro se guardará temporalmente en este dispositivo y se enviará al recuperar conexión."}</p>}</section>
          <section className="recent-card"><div className="recent-title"><div><h3>Últimos registros</h3><small>Personas y detalle de lotes</small></div><button type="button" onClick={() => setActiveView("pendientes")}>Ver todos</button></div>{recent.slice(0, 3).map((item) => <article className="recent-event" key={item.id}><div className="recent-event-head"><div><strong>{item.id}</strong><small>{item.time} · Placa: {item.plate}</small></div><em className={item.status === "Pendiente" ? "pending" : item.status === "Por sincronizar" ? "queued" : "done"}>{item.status}</em></div><div className="recent-people">{item.persons.map((person, index) => <div className="recent-person" key={`${item.id}-${person.dni}-${index}`}><div className="recent-person-main"><span>{person.role === "CONDUCTOR" ? "C" : person.role === "PROVEEDOR" ? "P" : "A"}</span><div><strong>{person.name}</strong><small>DNI {person.dni || "PENDIENTE"} · {person.role}</small></div></div><div className="recent-lots"><span>{person.lots ? `${person.lots} lote${person.lots === "1" ? "" : "s"}` : "Sin lotes"}</span><small>{person.lotCodes.length ? person.lotCodes.join(" · ") : person.detail || "Sin detalle de lotes"}</small></div></div>)}</div></article>)}</section>
        </aside></form>
      </>}

      {activeView === "pendientes" && <section className="empty-view data-view"><div className="view-heading"><div><span>◷</span><div><h2>Eventos por regularizar</h2><p>Las personas nuevas se insertarán debajo del bloque existente.</p></div></div><button onClick={loadPending} disabled={busy}>Actualizar</button></div><div className="pending-table dynamic">{pendingEvents.length ? pendingEvents.map(item => <div key={item.id}><strong>{item.id}</strong><span>{item.plate || "SIN PLACA"} · {item.persons.map(person => person.name).join(", ")}</span><em>{item.pendingReasons?.join(" · ") || "Datos pendientes"}</em><button onClick={() => openRegularization(item)}>Regularizar</button></div>) : <p className="empty-message">{connection === "online" ? "No hay eventos pendientes." : "Conecta Google Sheets para consultar los pendientes."}</p>}</div></section>}
      {activeView === "buscar" && <section className="empty-view data-view"><div className="view-heading"><div><span>⌕</span><div><h2>Búsqueda en MATRIZ</h2><p>Placa, código de lote, persona, DNI o ID.</p></div></div></div><div className="record-search"><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void runSearch(); }} placeholder="Ej. ABC-450, RM-120, nombre o DNI" /><button onClick={runSearch} disabled={busy}>{busy ? "Buscando…" : "Buscar"}</button></div><div className="search-results">{searchResults.map(item => <article className="search-result" key={item.id}><div className="search-result-head"><div><strong>{item.id}</strong><span>{new Date(item.dateTime).toLocaleString("es-PE")} · {item.plate || "SIN PLACA"} · {item.zone || "SIN ZONA"}</span></div><button onClick={() => openRegularization(item)}>{item.status === "PENDIENTE" ? "Regularizar" : "Abrir"}</button></div><div className="result-persons">{item.persons.map((person, index) => <div key={`${item.id}-${person.dni}-${index}`}><strong>{person.name}</strong><span>DNI {person.dni} · {person.role}</span><small>{person.lots ? `${person.lots} lote(s): ${person.lotCodes.length ? person.lotCodes.join(", ") : person.detail}` : "Sin lotes asignados"}</small></div>)}</div></article>)}{!searchResults.length && <p className="empty-message">Los resultados aparecerán del más reciente al más antiguo.</p>}</div></section>}
      {activeView === "personas" && <section className="empty-view data-view"><div className="people-toolbar"><div><h2>BD CLIENTES</h2><p>Fuente maestra para autocompletar por DNI.</p></div><button onClick={loadClients} disabled={busy}>Actualizar</button></div><div className="people-table"><div className="table-head"><span>DNI</span><span>Nombres y apellidos</span><span>Celular</span><span>Licencia</span><span>Estado</span></div>{(clients.length ? clients : Object.entries(PEOPLE).map(([dni, person]) => ({ dni, ...person, role: "ACTIVO" }))).map(person => <div className="table-row" key={person.dni}><span>{person.dni}</span><strong>{person.name}</strong><span>{person.phone}</span><span>{person.license ? `${person.license} · ${person.category}` : "—"}</span><em>{person.role || "ACTIVO"}</em></div>)}</div></section>}
    </section>
    {notice && <div className="notice-toast" role="status" aria-live="polite">{notice}</div>}
    {toast && <div className="alert-overlay" role="alert" aria-live="assertive"><div className={`alert-card ${toast.type}`}><span className="alert-icon">{toast.type === "success" ? "✓" : "!"}</span><div><strong>{toast.type === "success" ? "REGISTRO EXITOSO" : "ATENCIÓN: NO SE GUARDÓ"}</strong><p>{toast.message}</p></div><button type="button" aria-label="Cerrar alerta" onClick={() => setToast(null)}>×</button></div></div>}
  </main>;
}
