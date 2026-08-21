"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "CONDUCTOR" | "PROVEEDOR" | "ACOMPAÑANTE";
type View = "registro" | "hoy" | "pendientes" | "buscar" | "personas";
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

const QUEUE_KEY = "acopio_sync_queue_v1";
const CLIENT_CACHE_KEY = "acopio_client_cache_v1";
const SUPPORTED_BACKEND_VERSIONS = ["ATENCION-2026-08-21-V11-LIGERO", "ATENCION-2026-08-21-V12-COLA-ROBUSTA", "ATENCION-2026-08-21-V13-REGULARIZACION-SEGURA", "ATENCION-2026-08-21-V14-REGULARIZACION-CAMPOS"];

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
  { id: 4, title: "Proveedor solo", note: "Vehículo y conductor llegarán después", tag: "PENDIENTE" },
  { id: 5, title: "Retiro de lote", note: "Vehículo retira lotes registrados", tag: "RETIRO" },
  { id: 6, title: "RM / Muestreo / Recoger muestra", note: "Proveedor sin vehículo", tag: "ESPECIAL" },
];

const OPTION_NUMBER: Record<number, number> = { 1: 1, 4: 2, 5: 3, 6: 4, 2: 1, 3: 1 };

const LEGACY_CASES: Record<number, (typeof CASES)[number]> = {
  2: { id: 2, title: "Solo conductor", note: "Registro anterior compatible", tag: "ANTERIOR" },
  3: { id: 3, title: "Vehículo solo", note: "Registro anterior compatible", tag: "ANTERIOR" },
};

function normalizeCategory(value?: string) {
  const raw = String(value ?? "").trim().toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, "");
  const compact = raw.replace(/-/g, "");
  const categories: Record<string, string> = { AI: "A-I", AIIA: "A-IIA", AIIB: "A-IIB", AIIIA: "A-IIIA", AIIIB: "A-IIIB", AIIIC: "A-IIIC" };
  return categories[compact] ?? raw;
}

function normalizeLicense(value?: string) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
}

function isLicenseCategory(value?: string) {
  return ["A-I", "A-IIA", "A-IIB", "A-IIIA", "A-IIIB", "A-IIIC"].includes(normalizeCategory(value));
}

function normalizePersonRecord(person?: Partial<PersonRecord>): PersonRecord {
  const rawLicense = String(person?.license ?? "").trim();
  const licenseContainsCategory = isLicenseCategory(rawLicense);
  const phoneCandidate = String(person?.phone ?? "").replace(/\D/g, "");
  const categoryCandidate = normalizeCategory(person?.category);
  return {
    name: String(person?.name ?? ""),
    phone: /^\d{9}$/.test(phoneCandidate) ? phoneCandidate : "",
    license: licenseContainsCategory ? "" : normalizeLicense(rawLicense),
    category: isLicenseCategory(categoryCandidate) ? categoryCandidate : licenseContainsCategory ? normalizeCategory(rawLicense) : "",
  };
}

function compactFields(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => {
    if (field === "" || field === null || field === undefined) return false;
    return !Array.isArray(field) || field.length > 0;
  }));
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function compactWritePayload(payload: Record<string, unknown>) {
  const source = payload as Record<string, unknown> & { participants?: unknown; event?: Record<string, unknown> };
  const compactParticipants = safeArray<Partial<Participant> | null>(source.participants)
    .filter((person): person is Partial<Participant> => Boolean(person) && /^\d{8}$/.test(String(person?.dni || "")))
    .map(person => compactFields({
      dni: String(person.dni || ""), name: String(person.name || ""), phone: String(person.phone || ""), role: person.role,
      license: person.role === "CONDUCTOR" ? normalizeLicense(person.license) : "",
      category: person.role === "CONDUCTOR" ? normalizeCategory(person.category) : "",
      lots: String(person.lots || ""), detail: String(person.detail || ""), lotCodes: safeArray<string>(person.lotCodes).filter(Boolean),
    }));
  return compactFields({
    ...source,
    event: source.event ? compactFields(source.event) : undefined,
    participants: compactParticipants,
  });
}

const blankPerson = (id: number, role: Role, automaticDriver = false): Participant => ({ id, dni: "", name: "", phone: "", role, license: "", category: "", found: null, newPerson: false, automaticDriver, expectedLater: false, lots: "", detail: "", lotCodes: [], cargoRegularize: false });

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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Lima",
  }).format(date).replace(",", "");
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
  const timeout = writeAction ? 25_000 : action === "searchPerson" || action === "health" ? 10_000 : 25_000;
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
  const persons = safeArray<SheetPerson | null>(item.persons).filter((person): person is SheetPerson => Boolean(person)).map(person => ({ ...person, lotCodes: safeArray<string>(person.lotCodes) }));
  return { id: item.id, time: formatDateTime(item.dateTime), plate: item.plate || "SIN PLACA", status: item.status === "PENDIENTE" ? "Pendiente" : "Registrado", persons };
}

function uniqueSheetPeople(persons: SheetPerson[]) {
  const byPerson = new Map<string, SheetPerson>();
  safeArray<SheetPerson | null>(persons).filter((person): person is SheetPerson => Boolean(person)).forEach((person) => {
    person = { ...person, lotCodes: safeArray<string>(person.lotCodes) };
    const key = `${person.dni.replace(/\D/g, "")}|${person.role}`;
    const current = byPerson.get(key);
    if (!current) {
      byPerson.set(key, person);
      return;
    }
    byPerson.set(key, {
      ...current,
      name: person.name || current.name,
      phone: person.phone || current.phone,
      license: person.license || current.license,
      category: person.category || current.category,
      lots: person.lots || current.lots,
      detail: person.detail || current.detail,
      lotCodes: person.lotCodes.length ? person.lotCodes : current.lotCodes,
    });
  });
  return Array.from(byPerson.values());
}

function isTodayInPeru(value: string) {
  const options: Intl.DateTimeFormatOptions = { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" };
  return new Date(value).toLocaleDateString("es-PE", options) === new Date().toLocaleDateString("es-PE", options);
}

function queuePreview(item: QueueItem) {
  const payload = item.payload as { event?: Partial<EventForm>; participants?: unknown };
  const persons = safeArray<Partial<Participant> | null>(payload.participants).filter((person): person is Partial<Participant> => Boolean(person));
  return {
    plate: String(payload.event?.plate || "SIN PLACA"),
    people: persons.map(person => String(person.name || person.dni || person.role || "PERSONA")).join(", ") || "Sin personas identificadas",
  };
}

function readCachedPerson(dni: string): PersonRecord | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const cache = JSON.parse(window.localStorage.getItem(CLIENT_CACHE_KEY) || "{}") as Record<string, PersonRecord>;
    return cache[dni] ? normalizePersonRecord(cache[dni]) : undefined;
  } catch {
    return undefined;
  }
}

function cachePerson(dni: string, person: PersonRecord) {
  if (typeof window === "undefined") return;
  try {
    const cache = JSON.parse(window.localStorage.getItem(CLIENT_CACHE_KEY) || "{}") as Record<string, PersonRecord>;
    const previous = normalizePersonRecord(cache[dni]);
    const normalized = normalizePersonRecord(person);
    const safePerson = { ...normalized, phone: normalized.phone || previous.phone };
    window.localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify({ ...cache, [dni]: safePerson }));
  } catch {
    // El registro principal no debe fallar si el almacenamiento local está bloqueado.
  }
}

export default function Home() {
  const [activeCase, setActiveCase] = useState(1);
  const [activeView, setActiveView] = useState<View>("registro");
  const [dateTime, setDateTime] = useState(nowValue());
  const [event, setEvent] = useState<EventForm>(() => ({ motive: "PROCESO", plate: "", zone: "", guard: "", shift: shiftFromDateTime(nowValue()), responsible: "" }));
  const [participants, setParticipants] = useState<Participant[]>(() => emptyParticipantsForCase(1));
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
  const [todayEvents, setTodayEvents] = useState<SheetEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SheetEvent[]>([]);
  const [clients, setClients] = useState<Array<PersonRecord & { dni: string; role?: string }>>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const caseInfo = CASES.find((item) => item.id === activeCase) ?? LEGACY_CASES[activeCase] ?? CASES[0];
  const hasVehicle = activeCase !== 6;
  const drivers = participants.filter((person) => person.role === "CONDUCTOR");
  const providers = participants.filter((person) => person.role === "PROVEEDOR");
  const motiveOptions = activeCase === 5 ? ["RETIRO DE LOTE"] : activeCase === 6 ? ["PROCESO", "RM", "MUESTREO", "RECOGER MUESTRA"] : ["PROCESO"];
  const motiveIsSelectable = activeCase === 5 || activeCase === 6;
  const todayCards = useMemo(() => todayEvents.map(item => ({ ...item, persons: uniqueSheetPeople(item.persons) })), [todayEvents]);
  const connectionLabel = connection === "online" ? "CONECTADO" : connection === "outdated" ? "SCRIPT ANTERIOR" : connection === "unconfigured" ? "SIN CONFIGURAR" : connection === "checking" ? "VERIFICANDO" : "SIN INTERNET";
  const backendShort = backendVersion.match(/V\d+/)?.[0] || "";
  const connectionTitle = connection === "online" ? `Google Sheets conectado${backendShort ? ` · Servidor ${backendShort}` : ""}` : connection === "outdated" ? "Apps Script desactualizado" : connection === "unconfigured" ? "Google Sheets sin configurar" : connection === "checking" ? "Verificando conexión" : "Trabajo sin conexión";

  const validation = useMemo(() => {
    const blocking: string[] = [];
    const regularizable: string[] = [];
    if (!event.responsible.trim()) blocking.push("Responsable de atención");
    if (!event.guard) blocking.push("Guardia");
    if (!participants.some(person => /^\d{8}$/.test(person.dni))) blocking.push("Al menos una persona con DNI válido");
    if (hasVehicle && !event.plate.trim()) regularizable.push("Placa del vehículo");
    if (hasVehicle && !event.zone.trim()) regularizable.push("Zona del vehículo");
    if ((activeCase === 3 || activeCase === 4 || activeCase === 6) && providers.length === 0) regularizable.push("Datos del proveedor");
    if (hasVehicle && drivers.length === 0) regularizable.push("Datos del conductor");
    participants.forEach((person) => {
      if (person.expectedLater && !person.dni) {
        regularizable.push(`Datos del ${person.role.toLowerCase()} que llegará después`);
      } else {
        if (!/^\d{8}$/.test(person.dni)) regularizable.push(`DNI válido de ${person.role.toLowerCase()}`);
        if (!validFullName(person.name)) regularizable.push(`Nombre y dos apellidos de ${person.role.toLowerCase()}`);
        if (person.role === "ACOMPAÑANTE") {
          if (person.phone && !/^\d{9}$/.test(person.phone)) regularizable.push("Celular válido de acompañante, o dejarlo vacío");
        } else if (!/^\d{9}$/.test(person.phone)) {
          regularizable.push(`Celular de 9 dígitos de ${person.role.toLowerCase()}`);
        }
        if (person.role === "CONDUCTOR") {
          if (!person.license.trim()) regularizable.push("Número de licencia del conductor");
          if (person.license.length > 9) regularizable.push("Licencia del conductor de máximo 9 caracteres");
          if (!person.category) regularizable.push("Categoría de licencia del conductor");
        }
      }
      const mode = cargoMode(activeCase, person.role, providers.length);
      if (mode && person.cargoRegularize) {
        regularizable.push(`Carga de ${person.name || person.role.toLowerCase()} marcada para regularizar`);
      } else {
        if (mode && !person.lots) regularizable.push(`Número de lotes de ${person.name || person.role.toLowerCase()}`);
        if (mode === "detail" && !person.detail.trim()) regularizable.push(`Detalle de carga de ${person.name || person.role.toLowerCase()}`);
      }
    });
    const blockingReasons = Array.from(new Set(blocking));
    const regularizationReasons = Array.from(new Set(regularizable));
    return { blockingReasons, regularizationReasons, pendingReasons: [...blockingReasons, ...regularizationReasons] };
  }, [activeCase, drivers.length, event, hasVehicle, participants, providers.length]);
  const { blockingReasons, regularizationReasons, pendingReasons } = validation;

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
      failedInCycleRef.current.clear();
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
        const writePayload = compactWritePayload(item.payload);
        if (item.action === "regularizeEvent" && (item.repairLegacy || /null.*caseId|caseId.*null/i.test(item.lastError || ""))) {
          writePayload.clientRequestId = requestId();
        }
        const validPeople = safeArray<Record<string, unknown>>(writePayload.participants);
        if (item.action === "saveEvent" && !validPeople.some(person => /^\d{8}$/.test(String(person.dni || "")))) {
          throw new SheetsApiError("REGISTRO_INCOMPLETO: no contiene ninguna persona con DNI. Revísalo o elimínalo desde Gestionar pendientes.", 422, true);
        }
        const saved = await sheetsApi<SheetEvent>(item.action, writePayload);
        if (!storeQueue(queueRef.current.filter(row => row.queueId !== item.queueId))) {
          flash("No se pudo actualizar la cola local. Libera espacio en el dispositivo.");
          return;
        }
        const recentItem = recentFromSheet(saved);
        setRecent(current => [recentItem, ...current.filter(row => row.id !== item.localId && row.id !== saved.id)].slice(0, 8));
        setPendingEvents(current => saved.status === "PENDIENTE"
          ? [saved, ...current.filter(row => row.id !== saved.id)]
          : current.filter(row => row.id !== saved.id));
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
          retryDelay = Math.min(1500 * Math.pow(2, Math.min(attempts - 1, 3)), 8_000);
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
        window.setTimeout(() => { void syncQueue(); }, 250);
      }
    }
  }

  function retryQueued(queueId: string) {
    const selected = queueRef.current.find(item => item.queueId === queueId);
    if (!selected || syncing) return;
    failedInCycleRef.current.delete(queueId);
    const repairLegacy = selected.repairLegacy || /null.*caseId|caseId.*null/i.test(selected.lastError || "");
    const reordered = [{ ...selected, attempts: 0, lastError: undefined, repairLegacy }, ...queueRef.current.filter(item => item.queueId !== queueId)];
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
    let active = true;
    let refreshing = false;
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    let serviceWorkerUpdateTimer: number | undefined;
    const reloadForNewVersion = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    const checkForAppUpdate = () => {
      if (navigator.onLine && serviceWorkerRegistration) void serviceWorkerRegistration.update();
    };
    const checkVisibleVersion = () => {
      if (document.visibilityState === "visible") checkForAppUpdate();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", reloadForNewVersion);
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => {
        if (!active) return;
        serviceWorkerRegistration = registration;
        void registration.update();
        serviceWorkerUpdateTimer = window.setInterval(checkForAppUpdate, 60_000);
      });
    }
    document.addEventListener("visibilitychange", checkVisibleVersion);
    const online = () => { void checkConnection(true); };
    const offline = () => setConnection("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const initialCheck = window.setTimeout(() => {
      let restored: QueueItem[] = [];
      try { restored = safeArray<QueueItem>(JSON.parse(window.localStorage.getItem(QUEUE_KEY) || "[]")); } catch { restored = []; }
      queueRef.current = restored;
      setQueue(restored);
      void checkConnection(true);
    }, 0);
    const timer = window.setInterval(() => {
      if (!navigator.onLine) return;
      if (queueRef.current.length) void syncQueue();
      else void checkConnection(false);
    }, 5_000);
    return () => {
      active = false;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", checkVisibleVersion);
      if ("serviceWorker" in navigator) navigator.serviceWorker.removeEventListener("controllerchange", reloadForNewVersion);
      window.clearTimeout(initialCheck);
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (serviceWorkerUpdateTimer) window.clearInterval(serviceWorkerUpdateTimer);
      window.clearInterval(timer);
    };
    // La comprobación se inicia una sola vez; las funciones usan referencias estables para la cola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const updateClock = () => {
      if (activeView !== "registro") return;
      const current = nowValue();
      setDateTime(current);
      setEvent(previous => ({ ...previous, shift: shiftFromDateTime(current) }));
    };
    const handleVisibility = () => { if (document.visibilityState === "visible") updateClock(); };
    const clockTimer = window.setInterval(updateClock, 15_000);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(clockTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeView]);

  function updateParticipant(id: number, changes: Partial<Participant>) { setParticipants((current) => current.map((person) => person.id === id ? { ...person, ...changes } : person)); }
  function deferProvider(person: Participant) {
    const hasEnteredData = Boolean(person.dni || person.name || person.phone || person.lots || person.detail || person.lotCodes.some(Boolean));
    if (hasEnteredData && !window.confirm("Se limpiarán los datos de este proveedor para registrarlo cuando llegue. ¿Continuar?")) return;
    updateParticipant(person.id, { dni: "", name: "", phone: "", found: null, newPerson: false, expectedLater: true, lots: "", detail: "", lotCodes: [], cargoRegularize: true });
  }
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
      const normalized = normalizePersonRecord(result);
      // La ocupación corresponde a este ingreso. Nunca debe ser reemplazada por
      // la ocupación histórica guardada en BD CLIENTES.
      updateParticipant(person.id, {
        name: normalized.name,
        phone: normalized.phone,
        role: person.role,
        found: true,
        newPerson: false,
        expectedLater: false,
        license: person.role === "CONDUCTOR" ? normalized.license || "" : "",
        category: person.role === "CONDUCTOR" ? normalized.category || "" : "",
      });
      cachePerson(person.dni, normalized);
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
          const normalized = normalizePersonRecord(result.person);
          updateParticipant(person.id, {
            name: normalized.name, phone: normalized.phone, role: person.role, found: true, newPerson: false, expectedLater: false,
            license: person.role === "CONDUCTOR" ? normalized.license || "" : "",
            category: person.role === "CONDUCTOR" ? normalized.category || "" : "",
          });
          cachePerson(person.dni, normalized);
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
    if (person.role === "CONDUCTOR" && person.license.length > 9) return flash("La licencia debe tener como máximo 9 caracteres");
    updateParticipant(person.id, { found: true, newPerson: false });
    flash("La persona se añadirá a BD CLIENTES al guardar el ingreso", "warning");
  }

  function applyCase(caseId: number) {
    const nextDateTime = nowValue();
    setRegularizingId(null); setActiveCase(caseId); setDateTime(nextDateTime);
    setEvent(current => ({ ...current, motive: caseId === 5 ? "RETIRO DE LOTE" : "PROCESO", plate: "", zone: "", shift: shiftFromDateTime(nextDateTime) }));
    setParticipants(emptyParticipantsForCase(caseId));
  }

  function clearEntryKeepingGeneral() {
    const currentDateTime = nowValue();
    setDateTime(currentDateTime);
    setEvent(current => ({ ...current, motive: activeCase === 5 ? "RETIRO DE LOTE" : activeCase === 6 ? "MUESTREO" : "PROCESO", plate: "", zone: "", shift: shiftFromDateTime(currentDateTime) }));
    setParticipants(emptyParticipantsForCase(activeCase));
    setRegularizingId(null);
  }

  function saveEvent(forRegularization: boolean) {
    const missing = forRegularization ? blockingReasons : pendingReasons;
    if (missing.length) return flash(`No se guardó. Completa los campos obligatorios: ${missing.slice(0, 5).join("; ")}${missing.length > 5 ? "; y otros campos" : ""}.`);
    if (forRegularization && !regularizationReasons.length) return flash("No se guardó para regularizar porque no hay datos marcados como pendientes. Usa Guardar para registrar el ingreso completo.");
    if (enqueueLockRef.current) return;
    enqueueLockRef.current = true;
    window.setTimeout(() => { enqueueLockRef.current = false; }, 500);
    const action = regularizingId ? "regularizeEvent" : "saveEvent";
    const clientRequestId = requestId();
    const compactParticipants = participants.filter(person => /^\d{8}$/.test(person.dni)).map(person => ({
      dni: person.dni, name: person.name, phone: person.phone, role: person.role,
      license: person.role === "CONDUCTOR" ? normalizeLicense(person.license) : "",
      category: person.role === "CONDUCTOR" ? normalizeCategory(person.category) : "",
      lots: person.lots, detail: person.detail, lotCodes: safeArray<string>(person.lotCodes).filter(Boolean),
    }));
    if (!compactParticipants.length && action === "saveEvent") {
      enqueueLockRef.current = false;
      return flash("No se guardó. Registra por lo menos una persona con DNI antes de guardar o regularizar.");
    }
    const payload = { id: regularizingId, caseId: activeCase, dateTime, event, participants: compactParticipants, forRegularization, pendingReasons, clientRequestId };
    const localId = regularizingId || `LOCAL-${clientRequestId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const queued: QueueItem = { queueId: clientRequestId, localId, action, payload, createdAt: dateTime, attempts: 0 };
    if (!storeQueue([...queueRef.current, queued])) {
      enqueueLockRef.current = false;
      return flash("No se pudo asegurar el registro en este dispositivo. Libera espacio antes de continuar.");
    }
    compactParticipants.forEach(person => cachePerson(person.dni, { name: person.name, phone: person.phone, license: person.license, category: person.category }));
    setRecent(current => [{ id: localId, time: formatDateTime(dateTime), plate: event.plate || "SIN PLACA", status: "Por sincronizar", persons: participants.filter(person => /^\d{8}$/.test(person.dni)) }, ...current.filter(row => row.id !== localId)].slice(0, 8));
    clearEntryKeepingGeneral();
    flash(forRegularization ? "Guardado en el dispositivo para regularizar. Pendiente de confirmación en Google Sheets." : "Registro asegurado en el dispositivo. Pendiente de confirmación en Google Sheets.", "warning");
    window.setTimeout(() => { void syncQueue(); }, 0);
  }

  async function loadPending() {
    setBusy(true); try { setPendingEvents(await sheetsApi<SheetEvent[]>("pending")); }
    catch (error) { flash(error instanceof Error ? error.message : "No se pudieron cargar los pendientes", "warning"); }
    finally { setBusy(false); }
  }

  async function loadToday() {
    setBusy(true);
    try {
      try {
        setTodayEvents(await sheetsApi<SheetEvent[]>("today"));
      } catch (error) {
        if (!(error instanceof Error) || !/Acción no permitida/i.test(error.message)) throw error;
        const recentRows = await sheetsApi<SheetEvent[]>("recent", { limit: 50 });
        setTodayEvents(recentRows.filter(item => isTodayInPeru(item.dateTime)));
      }
    } catch (error) {
      flash(error instanceof Error ? error.message : "No se pudo cargar el reporte de hoy", "warning");
    } finally {
      setBusy(false);
    }
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
    const savedPeople = uniqueSheetPeople(item.persons);
    const savedProviderCount = savedPeople.filter((person) => person.role === "PROVEEDOR").length;
    const loaded = savedPeople.map((person, index) => {
      const mode = cargoMode(item.caseId || 1, person.role, savedProviderCount);
      const cargoStillPending = Boolean(mode && (!person.lots || (mode === "detail" && !person.detail.trim())));
      const normalized = normalizePersonRecord(person);
      return { ...blankPerson(index + 1, person.role, person.role === "CONDUCTOR"), ...person, phone: normalized.phone, license: person.role === "CONDUCTOR" ? normalized.license || "" : "", category: person.role === "CONDUCTOR" ? normalized.category || "" : "", found: true, cargoRegularize: item.status === "PENDIENTE" && cargoStillPending };
    });
    const pendingText = safeArray<string>(item.pendingReasons).join(" ").toUpperCase();
    if ((item.caseId || 1) !== 6 && !loaded.some((person) => person.role === "CONDUCTOR")) loaded.unshift(blankPerson(loaded.length + 1, "CONDUCTOR", true));
    if (!loaded.some((person) => person.role === "PROVEEDOR") && (/PROVEEDOR/.test(pendingText) || [4, 6].includes(item.caseId || 1))) loaded.push(blankPerson(loaded.length + 1, "PROVEEDOR"));
    setParticipants(loaded.map((person, index) => ({ ...person, id: index + 1 })));
    setActiveView("registro"); flash(`${item.id} abierto: las personas nuevas se insertarán debajo de su bloque`, "warning");
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">AC</span><div><strong>Atención al Cliente</strong><small>Control de ingresos</small></div></div>
      <nav aria-label="Navegación principal">
        <button className={activeView === "registro" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("registro")}><span>＋</span> Nuevo ingreso</button>
        <button className={activeView === "hoy" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("hoy"); void loadToday(); }}><span>▦</span> Reporte diario</button>
        <button className={activeView === "pendientes" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("pendientes"); void loadPending(); }}><span>◷</span> Por regularizar {pendingEvents.length > 0 && <b>{pendingEvents.length}</b>}</button>
        <button className={activeView === "buscar" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("buscar")}><span>⌕</span> Buscar</button>
        <button className={activeView === "personas" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("personas"); void loadClients(); }}><span>◎</span> BD Clientes</button>
      </nav>
      <div className={`sidebar-card connection-${connection}`}><span className="status-dot" /><div><strong>{connectionTitle}</strong><small>{queue.length ? `${queue.length} registro(s) por sincronizar` : connection === "online" ? "Lectura y escritura habilitadas" : connection === "outdated" ? "Actualiza la implementación de Apps Script" : connection === "unconfigured" ? "Falta configurar Apps Script" : "Los registros quedarán en este equipo"}</small>{queue.length > 0 && <button className="sidebar-sync" type="button" onClick={() => void syncQueue(true)} disabled={syncing || connection === "unconfigured" || connection === "outdated"}>{syncing ? "Sincronizando…" : "Sincronizar ahora"}</button>}</div></div>
      <div className="user-card"><span>LS</span><div><strong>Lizeth Surichaqui</strong><small>Responsable de atención</small></div></div>
    </aside>

    <section className="workspace">
      <header className="topbar"><div><p>REGISTRO DE PROVEEDORES ATENCIÓN AL CLIENTE - AMS - v001crq.</p><h1>{activeView === "registro" ? (regularizingId ? `Regularizar ${regularizingId}` : "Registrar ingreso") : activeView === "hoy" ? "Reporte diario" : activeView === "pendientes" ? "Eventos por regularizar" : activeView === "buscar" ? "Buscar registros" : "BD Clientes"}</h1></div><div className="header-actions"><span className={`online connection-pill-${connection}`}>● {connectionLabel}</span></div></header>
      <section className={`sync-strip connection-${connection}`}><div className="sync-status"><span className="status-dot" /><p><strong>{connectionTitle}</strong><small>{connection === "outdated" ? "La versión activa escribe en columnas incorrectas. Los nuevos registros se conservarán en este dispositivo hasta actualizarla." : queue.length ? `${queue.length} registro(s) asegurado(s). ${syncing ? `Procesando la cola; los demás esperan protegidos.` : queue.some(item => item.lastError) ? "Hay registros que requieren revisión. Abre Gestionar pendientes para ver el motivo." : "Listos para enviarse uno por uno."}` : connection === "online" ? "Conexión verificada. No hay registros pendientes de envío." : "Puedes continuar registrando; los datos se conservarán en este dispositivo."}</small></p></div>{queue.length > 0 && <div className="sync-actions"><button className="manage-sync" type="button" onClick={() => setShowQueueManager(current => !current)}>{showQueueManager ? "Ocultar pendientes" : `Gestionar pendientes (${queue.length})`}</button><button type="button" onClick={() => void syncQueue(true)} disabled={syncing || connection === "unconfigured" || connection === "outdated"}>{syncing ? `Sincronizando…` : `Sincronizar ahora`}</button></div>}</section>
      {showQueueManager && queue.length > 0 && <section className="queue-manager"><div className="queue-manager-head"><div><strong>Pendientes guardados en este dispositivo</strong><span>Un registro con error ya no detiene a los demás. Revísalo antes de eliminarlo.</span></div><button type="button" className="danger-link" onClick={removeAllQueued}>Eliminar todos</button></div><div className="queue-list">{queue.map(item => { const preview = queuePreview(item); return <article className={item.lastError ? "queue-item has-error" : "queue-item"} key={item.queueId}><div className="queue-item-main"><strong>{item.localId}</strong><span>{formatDateTime(item.createdAt)} · {item.action === "regularizeEvent" ? "REGULARIZACIÓN" : "NUEVO INGRESO"}</span><p>{preview.plate} · {preview.people}</p>{item.lastError && <em>{item.lastError}</em>}</div><div className="queue-item-actions"><button type="button" onClick={() => retryQueued(item.queueId)} disabled={syncing}>Reintentar</button><button type="button" className="danger" onClick={() => removeQueued(item.queueId)} disabled={syncing}>Eliminar</button></div></article>; })}</div></section>}

      {activeView === "registro" && <>
        {regularizingId && <section className="regularization-banner"><div><strong>Regularización activa: {regularizingId}</strong><span>Las filas existentes conservan su fecha y hora; solo las personas nuevas usan la hora actual.</span></div></section>}
        <section className="case-panel"><div className="case-heading"><div><span>MATRIZ OPERATIVA ACTUALIZADA</span><h2>Selecciona el tipo de atención</h2></div><p>La opción 1 incluye conductor solo, proveedor pendiente y acompañantes.</p></div><div className="case-grid four-cases">{CASES.map((item) => <button type="button" key={item.id} className={activeCase === item.id ? "case-chip selected" : "case-chip"} onClick={() => applyCase(item.id)}><b>{OPTION_NUMBER[item.id]}</b><span><strong>{item.title}</strong><small>{item.note}</small></span><em>{item.tag}</em></button>)}</div></section>

        <form onSubmit={(e) => e.preventDefault()} className="form-layout"><div className="main-column">
          <section className="form-card"><div className="section-title"><span>1</span><div><h2>Datos generales</h2><p>Fecha, responsable, guardia y turno</p></div><em>OPCIÓN {OPTION_NUMBER[activeCase] || 1}: {caseInfo.title.toUpperCase()}</em></div><div className="fields-grid general-grid">
            <label>Fecha y hora de ingreso<input type="datetime-local" value={dateTime} onInput={(e) => { const value = e.currentTarget.value; setDateTime(value); setEvent(current => ({ ...current, shift: shiftFromDateTime(value) })); }} onChange={() => undefined} /></label>
            <label className={!event.responsible.trim() ? "required-field" : ""}>Responsable<input aria-invalid={!event.responsible.trim()} value={event.responsible} onChange={(e) => setEvent({ ...event, responsible: e.target.value.replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, "").toUpperCase() })} /></label>
            <label className={!event.guard ? "required-field" : ""}>Guardia<select aria-invalid={!event.guard} value={event.guard} onChange={(e) => setEvent({ ...event, guard: e.target.value })}><option value="">Seleccionar</option><option>A</option><option>B</option><option>C</option></select></label>
            <label>Turno<select value={event.shift} disabled><option>DÍA</option><option>NOCHE</option></select><small>Automático: Día 07:00–18:59 · Noche 19:00–06:59</small></label>
          </div></section>

          <section className="form-card"><div className="section-title"><span>2</span><div><h2>Datos del ingreso</h2><p>Motivo, placa y zona del vehículo</p></div><em>{hasVehicle ? "CON VEHÍCULO" : "SIN VEHÍCULO"}</em></div><div className="fields-grid operation-grid">
            <label>Motivo de ingreso<select value={event.motive} disabled={!motiveIsSelectable} onChange={(e) => setEvent({ ...event, motive: e.target.value })}>{motiveOptions.map((motive) => <option key={motive}>{motive}</option>)}</select><small>{activeCase <= 4 ? "Opción única: PROCESO" : activeCase === 5 ? "Motivo del caso: RETIRO DE LOTE" : "PROCESO, RM, MUESTREO o RECOGER MUESTRA"}</small></label>
            {hasVehicle ? <><label className={!event.plate.trim() ? "required-field" : ""}>Placa del vehículo<input aria-invalid={!event.plate.trim()} maxLength={7} placeholder="Máximo 7 caracteres" value={event.plate} onChange={(e) => setEvent({ ...event, plate: e.target.value.slice(0, 7) })} /><small>Única restricción: máximo 7 caracteres</small></label><label className={!event.zone.trim() ? "required-field" : ""}>Zona<input aria-invalid={!event.zone.trim()} placeholder="Ej. HUANCAYO" value={event.zone} onChange={(e) => setEvent({ ...event, zone: e.target.value.replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, "").toUpperCase() })} /></label></> : <div className="locked-fields wide"><span>⊘</span><div><strong>Placa y zona no aplican en el caso 6</strong><small>El proveedor llega sin vehículo para RM, muestreo o recoger muestra.</small></div></div>}
          </div></section>

          <section className="form-card"><div className="section-title"><span>3</span><div><h2>Personas y lotes</h2><p>Conductor automático, participantes y datos de carga</p></div><em>{participants.length} {participants.length === 1 ? "PERSONA" : "PERSONAS"}</em></div>
            {activeCase !== 6 && <div className="driver-banner"><span>✓</span><div><strong>Conductor generado automáticamente</strong><small>Este bloque es obligatorio en la opción {OPTION_NUMBER[activeCase] || 1}. Incluye número y categoría de licencia.</small></div></div>}
            <div className="participants-list">{participants.map((person, index) => {
              const mode = cargoMode(activeCase, person.role, providers.length);
              return <article className={`participant-card role-${person.role.toLowerCase()} ${person.expectedLater ? "expected" : ""}`} key={person.id}>
              <div className="participant-head"><div><span className="person-number">{index + 1}</span>{person.automaticDriver ? <strong>CONDUCTOR OBLIGATORIO</strong> : <select aria-label={`Ocupación de persona ${index + 1}`} value={person.role} onChange={(e) => { const role = e.target.value as Role; updateParticipant(person.id, { role, license: "", category: "", ...(role === "ACOMPAÑANTE" ? { lots: "", detail: "", lotCodes: [], cargoRegularize: false, expectedLater: false } : {}) }); }}><option>PROVEEDOR</option><option>ACOMPAÑANTE</option></select>}</div><div className="participant-actions">{activeCase === 1 && person.role === "PROVEEDOR" && !person.expectedLater && <button type="button" className="defer-person" onClick={() => deferProvider(person)}>Llegará después</button>}{!person.automaticDriver && participants.length > 1 && <button type="button" className="remove" onClick={() => setParticipants((current) => current.filter((item) => item.id !== person.id))}>Eliminar</button>}</div></div>
              {person.expectedLater && <div className="expected-note"><span>◷</span><div><strong>{person.role === "CONDUCTOR" ? "Conductor" : "Proveedor"} pendiente de llegada</strong><small>No se crea una fila vacía; se insertará al regularizar.</small></div><button type="button" onClick={() => updateParticipant(person.id, { expectedLater: false, cargoRegularize: false })}>Completar datos del {person.role === "CONDUCTOR" ? "conductor" : "proveedor"}</button></div>}
              {!person.expectedLater && <><div className="person-fields">
                <label className={!/^\d{8}$/.test(person.dni) ? "required-field" : ""}>DNI<div className="search-control"><input aria-invalid={!/^\d{8}$/.test(person.dni)} inputMode="numeric" maxLength={8} placeholder="8 números" value={person.dni} onChange={(e) => updateParticipant(person.id, { dni: e.target.value.replace(/\D/g, "").slice(0, 8), found: null, newPerson: false, name: "", phone: "", license: "", category: "" })} onKeyDown={(e) => { if (e.key === "Enter" && person.dni.length === 8) { e.preventDefault(); void searchDni(person); } }} /><button type="button" aria-label={`Buscar DNI ${person.dni}`} disabled={person.dni.length !== 8 || busy} onClick={() => void searchDni(person)}>{busy ? "Buscando…" : "Buscar DNI"}</button></div><small>Consulta BD CLIENTES siempre; solo usa la copia local si la conexión falla.</small></label>
                <label className={!validFullName(person.name) ? "required-field" : ""}>Nombres y apellidos<input aria-invalid={!validFullName(person.name)} value={person.name} readOnly={!person.newPerson} placeholder="1 nombre y 2 apellidos" onChange={(e) => updateParticipant(person.id, { name: e.target.value.replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, "").toUpperCase() })} /><small>Solo texto; mínimo tres palabras</small></label>
                <label className={(person.role === "ACOMPAÑANTE" ? Boolean(person.phone) && !/^\d{9}$/.test(person.phone) : !/^\d{9}$/.test(person.phone)) ? "required-field" : ""}>Celular<input aria-invalid={person.role === "ACOMPAÑANTE" ? Boolean(person.phone) && !/^\d{9}$/.test(person.phone) : !/^\d{9}$/.test(person.phone)} inputMode="numeric" maxLength={9} value={person.phone} placeholder={person.role === "ACOMPAÑANTE" ? "Opcional" : "9 números"} onChange={(e) => updateParticipant(person.id, { phone: e.target.value.replace(/\D/g, "").slice(0, 9) })} /><small>{person.role === "ACOMPAÑANTE" ? "Opcional; si cambia, actualiza BD CLIENTES" : "9 números; puedes corregirlo y actualizar BD CLIENTES"}</small></label>
              </div>
              {person.role === "CONDUCTOR" && <div className="license-fields"><label className={!person.license.trim() ? "required-field" : ""}>Número de licencia<input aria-invalid={!person.license.trim()} maxLength={9} placeholder="Máximo 9 caracteres" value={person.license} onChange={(e) => updateParticipant(person.id, { license: normalizeLicense(e.target.value) })} /><small>Máximo 9 caracteres; editable para completar o actualizar.</small></label><label className={!person.category ? "required-field" : ""}>Categoría<select aria-invalid={!person.category} value={normalizeCategory(person.category)} onChange={(e) => updateParticipant(person.id, { category: normalizeCategory(e.target.value) })}><option value="">Seleccionar</option><option value="A-I">A-I</option><option value="A-IIA">A-IIa</option><option value="A-IIB">A-IIb</option><option value="A-IIIA">A-IIIa</option><option value="A-IIIB">A-IIIb</option><option value="A-IIIC">A-IIIc</option></select><small>Se actualizará también en BD CLIENTES.</small></label></div>}
              {person.found === true && <div className="match-message success"><span>✓</span><div><strong>Persona identificada</strong><small>Encontrada o lista para añadirse a BD CLIENTES</small></div></div>}
              {person.newPerson && <div className="new-person"><div><span>!</span><p><strong>DNI no registrado</strong><small>Completa nombres{person.role === "ACOMPAÑANTE" ? "; el celular es opcional" : ", celular"}{person.role === "CONDUCTOR" ? ", licencia y categoría" : ""}.</small></p></div><button type="button" onClick={() => registerNewPerson(person)}>Registrar nueva persona</button></div>}
              {mode && <div className="cargo-block person-cargo"><div className="cargo-heading"><div><span>▦</span><div><h3>{mode === "codes" ? "Lotes y códigos opcionales" : "Lotes y detalle de carga"}</h3><p>Información enlazada únicamente a {person.name || `este ${person.role.toLowerCase()}`}.</p></div></div><label className="regularize-inline"><input type="checkbox" checked={person.cargoRegularize} onChange={(e) => updateParticipant(person.id, { cargoRegularize: e.target.checked })} /><span><strong>Regularizar</strong><small>Esta información</small></span></label></div>
                <div className="cargo-fields"><label className={!person.cargoRegularize && !person.lots ? "required-field" : ""}>Número de lotes<input aria-invalid={!person.cargoRegularize && !person.lots} inputMode="numeric" placeholder="Ej. 3" value={person.lots} onChange={(e) => mode === "codes" ? resizeLotCodes(person.id, e.target.value.replace(/\D/g, "")) : updateParticipant(person.id, { lots: e.target.value.replace(/\D/g, "") })} /></label>{mode === "detail" && <label className={!person.cargoRegularize && !person.detail.trim() ? "required-field" : ""}>Detalle de carga<input aria-invalid={!person.cargoRegularize && !person.detail.trim()} placeholder="Ej. 60 20 40" value={person.detail} onChange={(e) => updateParticipant(person.id, { detail: e.target.value.toUpperCase() })} /><small>Valores separados por un espacio</small></label>}</div>
                {mode === "codes" && person.lots && <div className="lot-codes-grid">{person.lotCodes.map((code, codeIndex) => <label key={codeIndex}>Código de lote {codeIndex + 1} (opcional)<input placeholder="Puede dejarse vacío" value={code} onChange={(e) => updateLotCode(person.id, codeIndex, e.target.value)} /></label>)}</div>}
                {person.cargoRegularize && <div className="regularize-message"><span>◷</span><div><strong>Carga marcada para regularización</strong><small>Podrá completarse posteriormente sin afectar la información de otros proveedores.</small></div></div>}
              </div>}</>}
            </article>;
            })}</div>
            <button className="add-person" type="button" onClick={() => setParticipants((current) => [...current, blankPerson(Math.max(...current.map((p) => p.id), 0) + 1, activeCase === 1 || activeCase === 3 || activeCase === 6 ? "PROVEEDOR" : "ACOMPAÑANTE")])}><span>＋</span> Agregar proveedor o acompañante</button>
          </section>
        </div>

        <aside className="summary-column"><section className="summary-card"><div className="summary-title"><span>{pendingReasons.length ? "!" : "✓"}</span><div><h2>Pendiente por completar</h2><p>{pendingReasons.length ? `${pendingReasons.length} dato(s) pendiente(s)` : "No falta información obligatoria"}</p></div></div>{pendingReasons.length > 0 ? <div className="pending-box pending-only"><strong>Complete estos datos</strong>{pendingReasons.map((reason) => <span key={reason}>• {reason}</span>)}</div> : <div className="validation-ready"><strong>Sin datos pendientes</strong><span>El registro está listo para guardar.</span></div>}<div className="action-stack"><button className="primary-action" type="button" disabled={busy} onClick={() => saveEvent(false)}>{regularizingId ? "Completar regularización" : "Guardar"}<span>✓</span></button><button className="secondary-action" type="button" disabled={busy} onClick={() => saveEvent(true)}>{regularizingId ? "Guardar avance y mantener pendiente" : "Guardar para regularizar"}<span>◷</span></button></div><p className="action-help">El formulario se libera al instante. La escritura en MATRIZ continúa en segundo plano.</p>{connection !== "online" && <p className="connection-warning">{connection === "outdated" ? "Protección activa: no se enviarán datos al script anterior. El registro quedará en este dispositivo hasta instalar la versión correcta." : "Modo campo activo: el registro se guardará temporalmente en este dispositivo y se enviará al recuperar conexión."}</p>}</section>
          <section className="recent-card"><div className="recent-title"><div><h3>Últimos registros</h3><small>Personas y detalle de lotes</small></div><button type="button" onClick={() => setActiveView("pendientes")}>Ver todos</button></div>{recent.slice(0, 3).map((item) => <article className="recent-event" key={item.id}><div className="recent-event-head"><div><strong>{item.id}</strong><small>{item.time} · Placa: {item.plate}</small></div><em className={item.status === "Pendiente" ? "pending" : item.status === "Por sincronizar" ? "queued" : "done"}>{item.status}</em></div><div className="recent-people">{item.persons.map((person, index) => <div className="recent-person" key={`${item.id}-${person.dni}-${index}`}><div className="recent-person-main"><span>{person.role === "CONDUCTOR" ? "C" : person.role === "PROVEEDOR" ? "P" : "A"}</span><div><strong>{person.name}</strong><small>DNI {person.dni || "PENDIENTE"} · {person.role}</small></div></div><div className="recent-lots"><span>{person.lots ? `${person.lots} lote${person.lots === "1" ? "" : "s"}` : "Sin lotes"}</span><small>{person.lotCodes.length ? person.lotCodes.join(" · ") : person.detail || "Sin detalle de lotes"}</small></div></div>)}</div></article>)}</section>
        </aside></form>
      </>}

      {activeView === "hoy" && <section className="empty-view data-view today-report"><div className="view-heading"><div><span>▦</span><div><h2>Reporte diario</h2><p>Un recuadro por ingreso, identificado por la placa y con todas las personas registradas.</p></div></div><button onClick={loadToday} disabled={busy}>{busy ? "Actualizando…" : "Actualizar"}</button></div><div className="today-cards">{todayCards.map(item => <article className="today-card" key={item.id}><header><div><span>PLACA</span><strong>{item.plate || "SIN PLACA"}</strong></div><div className="today-card-meta"><span>{formatDateTime(item.dateTime)}</span><b>{item.zone || "SIN ZONA"}</b><small>{item.id}</small></div></header><div className="today-card-people">{item.persons.map((person, index) => <div className="today-card-person" key={`${item.id}-${person.dni}-${person.role}-${index}`}><div className="today-person-name"><span>{person.role === "CONDUCTOR" ? "C" : person.role === "PROVEEDOR" ? "P" : "A"}</span><div><strong>{person.name || "SIN NOMBRE"}</strong><small>{person.role} · DNI {person.dni || "—"}</small></div></div><div className="today-person-cargo"><b>{person.lots ? `${person.lots} lote${person.lots === "1" ? "" : "s"}` : "Sin lotes"}</b><span>{person.lotCodes.length ? person.lotCodes.join(" · ") : person.detail || "Sin detalle"}</span></div></div>)}</div></article>)}</div>{!todayCards.length && <p className="empty-message">{busy ? "Consultando los registros de hoy…" : "No hay registros para hoy."}</p>}</section>}

      {activeView === "pendientes" && <section className="empty-view data-view"><div className="view-heading"><div><span>◷</span><div><h2>Eventos por regularizar</h2><p>Las personas nuevas se insertarán debajo del bloque existente.</p></div></div><button onClick={loadPending} disabled={busy}>Actualizar</button></div><div className="pending-table dynamic">{pendingEvents.length ? pendingEvents.map(item => <div key={item.id}><strong>{item.id}</strong><span>{item.plate || "SIN PLACA"} · {item.persons.map(person => person.name).join(", ")}</span><em>{item.pendingReasons?.join(" · ") || "Datos pendientes"}</em><button onClick={() => openRegularization(item)}>Regularizar</button></div>) : <p className="empty-message">{connection === "online" ? "No hay eventos pendientes." : "Conecta Google Sheets para consultar los pendientes."}</p>}</div></section>}
      {activeView === "buscar" && <section className="empty-view data-view"><div className="view-heading"><div><span>⌕</span><div><h2>Búsqueda en MATRIZ</h2><p>Placa, código de lote, persona, DNI o ID.</p></div></div></div><div className="record-search"><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void runSearch(); }} placeholder="Ej. ABC-450, RM-120, nombre o DNI" /><button onClick={runSearch} disabled={busy}>{busy ? "Buscando…" : "Buscar"}</button></div><div className="search-results">{searchResults.map(item => <article className="search-result" key={item.id}><div className="search-result-head"><div><strong>{item.id}</strong><span>{formatDateTime(item.dateTime)} · {item.plate || "SIN PLACA"} · {item.zone || "SIN ZONA"}</span></div><button onClick={() => openRegularization(item)}>{item.status === "PENDIENTE" ? "Regularizar" : "Abrir"}</button></div><div className="result-persons">{item.persons.map((person, index) => <div key={`${item.id}-${person.dni}-${index}`}><strong>{person.name}</strong><span>DNI {person.dni} · {person.role}</span><small>{person.lots ? `${person.lots} lote(s): ${person.lotCodes.length ? person.lotCodes.join(", ") : person.detail}` : "Sin lotes asignados"}</small></div>)}</div></article>)}{!searchResults.length && <p className="empty-message">Los resultados aparecerán del más reciente al más antiguo.</p>}</div></section>}
      {activeView === "personas" && <section className="empty-view data-view"><div className="people-toolbar"><div><h2>BD CLIENTES</h2><p>Fuente maestra para autocompletar por DNI.</p></div><button onClick={loadClients} disabled={busy}>Actualizar</button></div><div className="people-table"><div className="table-head"><span>DNI</span><span>Nombres y apellidos</span><span>Celular</span><span>Licencia</span><span>Estado</span></div>{clients.map(person => <div className="table-row" key={person.dni}><span>{person.dni}</span><strong>{person.name}</strong><span>{person.phone}</span><span>{person.license ? `${person.license} · ${person.category}` : "—"}</span><em>{person.role || "ACTIVO"}</em></div>)}</div>{!clients.length && <p className="empty-message">Pulsa Actualizar para consultar BD CLIENTES.</p>}</section>}
    </section>
    {notice && <div className="notice-toast" role="status" aria-live="polite">{notice}</div>}
    {toast && <div className="alert-overlay" role="alert" aria-live="assertive"><div className={`alert-card ${toast.type}`}><span className="alert-icon">{toast.type === "success" ? "✓" : "!"}</span><div><strong>{toast.type === "success" ? "REGISTRO EXITOSO" : "ATENCIÓN: NO SE GUARDÓ"}</strong><p>{toast.message}</p></div><button type="button" aria-label="Cerrar alerta" onClick={() => setToast(null)}>×</button></div></div>}
  </main>;
}
