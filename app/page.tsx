"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SidebarMenu from "./components/layout/Sidebar";
import LoginScreen from "./components/login/LoginScreen";
import RiRmFrame, { type RirmSection } from "./components/registro-ri-rm/RiRmFrame";
import AdminPanel, { type AdminSection } from "./components/admin/AdminPanel";
import { GUIAS_HTML_INTEGRADO } from "./lib/guias-html";
import EstadiaServicios from "./components/atencion/EstadiaServicios";
import SalidaProveedores from "./components/atencion/SalidaProveedores";
import ControlHabitaciones from "./components/atencion/ControlHabitaciones";
import ResumenGuardia from "./components/atencion/ResumenGuardia";

type Role = "CONDUCTOR" | "PROVEEDOR" | "ACOMPAÑANTE";
type View = "registro" | "hoy" | "pendientes" | "buscar" | "personas" | "estadia" | "salidaProveedores" | "habitaciones" | "resumenGuardia" | "cargos" | "buscarSalidas" | "recepcionCargos" | "guias" | "rirm" | "admin";
type CargoReceipt = { correlative:string; type:string; code:string; dateTime:string; responsible:string; shift:string; receiptStatus:string };
type CargoExitResult = {
  correlative: string; type: string; code: string; dateTime: string;
  responsible: string; guard: string; shift: string; conductor?: string; observations?: string;
};
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
type AppUser = {
  user: string;
  name: string;
  role: string;
  permissions?: Record<string, boolean | string | number>;
};
type CargoRow = { id: number; type: string; code: string; weight: string; destination: string; description: string; reason: string; quantity: string; unit: string; observations: string };

const QUEUE_KEY = "acopio_sync_queue_v1";
const CLIENT_CACHE_KEY = "acopio_client_cache_v1";
const SESSION_KEY = "atencion_usuario_sesion_v1";
const ENTRY_DRAFT_KEY = "atencion_ingreso_pendiente_v1";
const GENERAL_EXIT_TYPES = ["ÚTILES DE OFICINA", "ARTÍCULOS DE LIMPIEZA", "REGALOS BBSS", "EPPS", "PRENDAS DE CAMPAMENTO", "BIDÓN DE AGUA", "BIDÓN DE GASOLINA", "REPUESTOS PARA MOTOCARGA", "BALÓN DE GAS", "MATERIALES DE INSTALACIÓN"];
const CARGO_SAMPLE_TYPES = ["PPO", "RI", "RM", "2RI", "3RI", "2RM", "DIRIMENCIA", "DUPLICADO", "FACP", "REFERENCIALES", "RF"] as const;
const CONDUCTORS = ["JHOMAR GARCIA OSPINO", "WILDER CONCE YAURI", "WILMER ALVARADO ALIAGA", "DONALD ZAMBRANO BASURTO"];
const blankCargoRow = (id: number): CargoRow => ({ id, type: "", code: "", weight: "", destination: "", description: "", reason: "", quantity: "", unit: "", observations: "" });

const SUPPORTED_BACKEND_VERSIONS = [
  "ATENCION-2026-08-21-V11-LIGERO",
  "ATENCION-2026-08-21-V12-COLA-ROBUSTA",
  "ATENCION-2026-08-21-V13-REGULARIZACION-SEGURA",
  "ATENCION-2026-08-21-V14-REGULARIZACION-CAMPOS",
  "ATENCION-2026-09-27-V15-CARGOS",
  "AMS-2026-09-30-V16-OPTIMIZADO",
  "AMS-2026-10-01-V17-PROVEEDOR-BD-SALIDAS"
];
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

function permissionKey(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function permissionAllowed(value: unknown) {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "SI" || normalized === "SÍ" || normalized === "TRUE" || normalized === "1";
}

function normalizePermissions(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, raw]) => [key.trim(), permissionAllowed(raw)])
  );
}

function hasUserPermission(user: AppUser | null, ...keys: string[]) {
  if (!user) return false;
  const role = String(user.role || "").toUpperCase();
  if (["ADMIN", "ADMINISTRADOR"].includes(role)) return true;
  const normalized: Record<string, boolean> = {};
  Object.entries(user.permissions || {}).forEach(([key, value]) => {
    normalized[permissionKey(key)] = permissionAllowed(value);
  });
  return keys.some(key => normalized[permissionKey(key)] === true);
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
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [cargoType, setCargoType] = useState<CargoType>("CHALA");
  const [generalExitType, setGeneralExitType] = useState(GENERAL_EXIT_TYPES[0]);
  const [cargoRowsByType, setCargoRowsByType] = useState<Record<CargoType, CargoRow[]>>({
    CHALA: [blankCargoRow(1)],
    PROVEEDORES: [blankCargoRow(1)],
    GENERALES: [blankCargoRow(1)],
  });
  const cargoRows = cargoRowsByType[cargoType];
  function setCargoRows(value: CargoRow[] | ((current: CargoRow[]) => CargoRow[])) {
    setCargoRowsByType(current => ({
      ...current,
      [cargoType]: typeof value === "function" ? value(current[cargoType]) : value,
    }));
  }
  const [cargoProvider, setCargoProvider] = useState("");
  const [cargoConductor, setCargoConductor] = useState("");
  const [cargoSaved, setCargoSaved] = useState(false);
  const [cargoSaving, setCargoSaving] = useState(false);
  const [cargoCorrelative, setCargoCorrelative] = useState("");
  const [cargoPreviewCorrelative, setCargoPreviewCorrelative] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [providerSource, setProviderSource] = useState<"AUTOMÁTICO" | "MANUAL" | "">("");
  const [exitTypeFilter, setExitTypeFilter] = useState("");
  const [exitCodeFilter, setExitCodeFilter] = useState("");
  const [exitDateFilter, setExitDateFilter] = useState("");
  const [exitResults, setExitResults] = useState<CargoExitResult[]>([]);
  const [exitSearching, setExitSearching] = useState(false);
  const [cargoReceipts,setCargoReceipts]=useState<CargoReceipt[]>([]);
  const [cargoReceiptSel,setCargoReceiptSel]=useState<string[]>([]);
  const [cargoReceiptBusy,setCargoReceiptBusy]=useState(false);
  const [openModule, setOpenModule] = useState<"atencion" | "cargos" | "guias" | "rirm" | "admin" | null>("atencion");
  const [guiasSection, setGuiasSection] = useState<"registrar" | "historial" | "indicadores" | "sacos">("registrar");
  const [rirmSection, setRirmSection] = useState<RirmSection>("pendientes");
  const [adminSection, setAdminSection] = useState<AdminSection>("panel");
  const guiasFrameRef = useRef<HTMLIFrameElement | null>(null);

  function openFirstAuthorized(user: AppUser) {
    if (hasUserPermission(user, "ATENCIÓN AL CLIENTE") && hasUserPermission(user, "Nuevo ingreso")) {
      setActiveView("registro"); setOpenModule("atencion"); return;
    }
    if (hasUserPermission(user, "ATENCIÓN AL CLIENTE") && hasUserPermission(user, "Reporte diario")) {
      setActiveView("hoy"); setOpenModule("atencion"); void loadToday(); return;
    }
    if (hasUserPermission(user, "ATENCIÓN AL CLIENTE") && hasUserPermission(user, "Por regularizar")) {
      setActiveView("pendientes"); setOpenModule("atencion"); void loadPending(); return;
    }
    if (hasUserPermission(user, "ATENCIÓN AL CLIENTE") && hasUserPermission(user, "Buscar")) {
      setActiveView("buscar"); setOpenModule("atencion"); return;
    }
    if (hasUserPermission(user, "ATENCIÓN AL CLIENTE") && hasUserPermission(user, "BD Clientes")) {
      setActiveView("personas"); setOpenModule("atencion"); void loadClients(); return;
    }
    if (hasUserPermission(user, "CARGOS Y SALIDAS") && hasUserPermission(user, "Registrar salida")) {
      setActiveView("cargos"); setOpenModule("cargos"); return;
    }
    if (hasUserPermission(user, "CARGOS Y SALIDAS") && hasUserPermission(user, "Buscar salidas")) {
      setActiveView("buscarSalidas"); setOpenModule("cargos"); return;
    }
    if (hasUserPermission(user, "REGISTRO DE GUÍAS") && hasUserPermission(user, "Registrar")) {
      setGuiasSection("registrar"); setActiveView("guias"); setOpenModule("guias"); return;
    }
    if (hasUserPermission(user, "REGISTRO DE GUÍAS") && hasUserPermission(user, "Historial de registros")) {
      setGuiasSection("historial"); setActiveView("guias"); setOpenModule("guias"); return;
    }
    if (hasUserPermission(user, "REGISTRO DE GUÍAS") && hasUserPermission(user, "Indicadores")) {
      setGuiasSection("indicadores"); setActiveView("guias"); setOpenModule("guias"); return;
    }
    if (hasUserPermission(user, "REGISTRO DE GUÍAS") && hasUserPermission(user, "Registro de Sacos Mineros")) {
      setGuiasSection("sacos"); setActiveView("guias"); setOpenModule("guias"); return;
    }
    if (hasUserPermission(user, "REGISTRO RI-RM") && hasUserPermission(user, "Pendientes")) {
      setRirmSection("pendientes"); setActiveView("rirm"); setOpenModule("rirm"); return;
    }
    if (hasUserPermission(user, "REGISTRO RI-RM") && hasUserPermission(user, "Nueva solicitud")) {
      setRirmSection("nueva-solicitud"); setActiveView("rirm"); setOpenModule("rirm"); return;
    }
    if (
      hasUserPermission(user, "REGISTRO RI-RM") &&
      (hasUserPermission(user, "Historial / Buscar") || hasUserPermission(user, "Mis solicitudes"))
    ) {
      setRirmSection("historial-buscar"); setActiveView("rirm"); setOpenModule("rirm"); return;
    }
    if (["ADMIN", "ADMINISTRADOR"].includes(String(user.role || "").toUpperCase())) {
      setAdminSection("panel"); setActiveView("admin"); setOpenModule("admin"); return;
    }
    setOpenModule(null);
  }

  function openGuiasSection(section: "registrar" | "historial" | "indicadores" | "sacos") {
    setGuiasSection(section);
    setActiveView("guias");
    window.setTimeout(() => {
      const frameWindow = guiasFrameRef.current?.contentWindow as (Window & { mostrarPagina?: (pagina: string) => void }) | null;
      frameWindow?.mostrarPagina?.(section);
    }, 0);
  }

  function openRirmSection(section: RirmSection) {
    setRirmSection(section);
    setActiveView("rirm");
    setOpenModule("rirm");
  }

  function openAdminSection(section: AdminSection) {
    const role = String(currentUser?.role || "").toUpperCase();
    if (!["ADMIN", "ADMINISTRADOR"].includes(role)) return;
    setAdminSection(section);
    setActiveView("admin");
    setOpenModule("admin");
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null") as AppUser | null;
      if (saved?.user && saved?.name && saved?.role && saved.permissions) {
        const restored: AppUser = { ...saved, permissions: normalizePermissions(saved.permissions) };
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(restored));
        window.localStorage.setItem("usuario", restored.user);
        setCurrentUser(restored);
        setEvent(current => ({ ...current, responsible: restored.name }));
        openFirstAuthorized(restored);
      } else if (saved) {
        window.localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    } finally {
      setSessionReady(true);
    }
  }, []);

  async function login() {
    const user = loginUser.trim().toUpperCase();
    const pin = loginPin.trim();
    if (!user) return setLoginError("Ingresa tu usuario.");
    if (!pin) return setLoginError("Ingresa tu PIN.");

    setLoginBusy(true);
    setLoginError("");
    try {
      const data = await sheetsApi<{
        authenticated: boolean;
        user: string;
        name: string;
        role: string;
        permissions?: Record<string, boolean | string | number>;
        permisos?: Record<string, boolean | string | number>;
        data?: {
          user?: string; nombre?: string; name?: string; role?: string; rol?: string;
          permissions?: Record<string, boolean | string | number>;
          permisos?: Record<string, boolean | string | number>;
        };
      }>("login", { user, pin });
      const nested = data?.data || {};

      // V16: después de validar usuario + PIN, refrescar los permisos directamente
      // desde la hoja USUARIOS mediante bootstrap_. Así la sesión no depende de una
      // respuesta de login incompleta ni de permisos antiguos guardados en el navegador.
      const loggedUser = String(data?.user || nested.user || user).trim().toUpperCase();
      const bootstrap = await sheetsApi<{
        usuario?: { user?: string; name?: string; role?: string; active?: boolean };
        permisos?: Record<string, boolean | string | number>;
        permissions?: Record<string, boolean | string | number>;
      }>("bootstrap", { user: loggedUser, usuario: loggedUser });

      const bootstrapUser = bootstrap?.usuario || {};
      const rawPermissions = bootstrap?.permissions ?? bootstrap?.permisos ?? data?.permissions ?? data?.permisos ?? nested.permissions ?? nested.permisos ?? {};
      const session: AppUser = {
        user: String(bootstrapUser.user || loggedUser),
        name: String(bootstrapUser.name || data?.name || nested.name || nested.nombre || ""),
        role: String(bootstrapUser.role || data?.role || nested.role || nested.rol || ""),
        permissions: normalizePermissions(rawPermissions),
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      window.localStorage.setItem("usuario", session.user);
      setCurrentUser(session);
      setEvent(current => ({ ...current, responsible: session.name }));
      openFirstAuthorized(session);
      setLoginPin("");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    if (!window.confirm("¿Cerrar la sesión actual?")) return;
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem("usuario");
    setCurrentUser(null);
    setLoginUser("");
    setLoginPin("");
    setLoginError("");
    setActiveView("registro");
  }

  useEffect(() => {
    if (activeView !== "cargos" || cargoSaved || !currentUser) return;

    let cancelled = false;
    setCargoPreviewCorrelative("");

    void sheetsApi<{ correlative: string }>("previewCargoCorrelative", { type: cargoType })
      .then((data) => {
        if (!cancelled) setCargoPreviewCorrelative(String(data?.correlative || ""));
      })
      .catch(() => {
        if (!cancelled) setCargoPreviewCorrelative("");
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, cargoType, cargoSaved]);

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
    try {
      const saved = JSON.parse(window.localStorage.getItem(ENTRY_DRAFT_KEY) || "null") as {
        activeCase?: number; dateTime?: string; event?: EventForm; participants?: Participant[]; regularizingId?: string | null;
      } | null;
      if (saved?.dateTime && saved?.event && Array.isArray(saved?.participants)) {
        setActiveCase(saved.activeCase || 1);
        setDateTime(saved.dateTime);
        setEvent(saved.event);
        setParticipants(saved.participants);
        setRegularizingId(saved.regularizingId || null);
      }
    } catch {
      window.localStorage.removeItem(ENTRY_DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.name) return;
    setEvent(current => current.responsible === currentUser.name ? current : { ...current, responsible: currentUser.name });
  }, [currentUser?.name]);

  useEffect(() => {
    if (!draftReady || regularizingId) return;
    try {
      window.localStorage.setItem(ENTRY_DRAFT_KEY, JSON.stringify({
        activeCase, dateTime, event, participants, regularizingId: null,
      }));
    } catch {
      // Si el almacenamiento local está bloqueado, el formulario continúa funcionando.
    }
  }, [draftReady, activeCase, dateTime, event, participants, regularizingId]);

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

  function startNewEntry() {
    const nextDateTime = nowValue();
    setActiveView("registro");
    setRegularizingId(null);
    setActiveCase(1);
    setDateTime(nextDateTime);
    setEvent(current => ({ ...current, motive: "PROCESO", plate: "", zone: "", shift: shiftFromDateTime(nextDateTime) }));
    setParticipants(emptyParticipantsForCase(1));
    try {
      window.localStorage.setItem(ENTRY_DRAFT_KEY, JSON.stringify({
        activeCase: 1,
        dateTime: nextDateTime,
        event: { ...event, motive: "PROCESO", plate: "", zone: "", shift: shiftFromDateTime(nextDateTime) },
        participants: emptyParticipantsForCase(1),
        regularizingId: null,
      }));
    } catch {}
  }

  function applyCase(caseId: number) {
    // Cambiar el tipo de atención NO cambia la fecha/hora inicial del ingreso.
    setRegularizingId(null);
    setActiveCase(caseId);
    setEvent(current => ({ ...current, motive: caseId === 5 ? "RETIRO DE LOTE" : "PROCESO", plate: "", zone: "", shift: shiftFromDateTime(dateTime) }));
    setParticipants(emptyParticipantsForCase(caseId));
  }

  function clearEntryKeepingGeneral() {
    window.localStorage.removeItem(ENTRY_DRAFT_KEY);
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

  async function lookupCargoProvider(code: string) {
    if (cargoType !== "PROVEEDORES" || !code.trim()) return;
    try {
      const data = await sheetsApi<{ found: boolean; provider: string }>("lookupCargoProvider", { code: code.trim() });
      if (data.found && data.provider) {
        setCargoProvider(data.provider.toUpperCase());
        setProviderSource("AUTOMÁTICO");
        flash(`Proveedor encontrado: ${data.provider}`, "success");
      } else {
        setCargoProvider("");
        setProviderSource("MANUAL");
        flash("Código no encontrado en PROCESOS - GUIAS. Ingresa el proveedor manualmente.", "warning");
      }
    } catch (error) {
      setProviderSource("MANUAL");
      flash(error instanceof Error ? error.message : "No se pudo buscar el proveedor");
    }
  }

  async function searchCargoExits() {
    setExitSearching(true);
    try {
      const data = await sheetsApi<CargoExitResult[]>("searchCargoExits", {
        type: exitTypeFilter,
        code: exitCodeFilter.trim().toUpperCase(),
        date: exitDateFilter,
        limit: 300,
      });
      setExitResults(Array.isArray(data) ? data : []);
      if (!data.length) flash("No se encontraron salidas con esos filtros.", "warning");
    } catch (error) {
      setExitResults([]);
      flash(error instanceof Error ? error.message : "No se pudo buscar las salidas.");
    } finally {
      setExitSearching(false);
    }
  }

  const cargoReceiptKey=(x:CargoReceipt)=>`${x.correlative}|${x.type}|${x.code}`;
  async function loadCargoReceipts(){setCargoReceiptBusy(true);try{const a=await sheetsApi<CargoReceipt[]>("cargoPendingReceipts",{limit:500});setCargoReceipts(Array.isArray(a)?a:[]);setCargoReceiptSel([]);}catch(e){flash(e instanceof Error?e.message:"No se pudieron cargar los pendientes.");}finally{setCargoReceiptBusy(false);}}
  async function confirmCargoReceipts(){if(!cargoReceiptSel.length)return flash("Selecciona al menos un registro.","warning");if(!confirm(`¿Marcar como recibido ${cargoReceiptSel.length} registro(s) CH?`))return;setCargoReceiptBusy(true);try{await sheetsApi("cargoConfirmReceipts",{keys:cargoReceiptSel,responsable:currentUser?.name||""});flash(`Recepción confirmada: ${cargoReceiptSel.length} registro(s).`);await loadCargoReceipts();}catch(e){flash(e instanceof Error?e.message:"No se pudo confirmar la recepción.");}finally{setCargoReceiptBusy(false);}}

  function clearExitSearch() {
    setExitTypeFilter("");
    setExitCodeFilter("");
    setExitDateFilter("");
    setExitResults([]);
  }

  async function saveCargoDocument() {
    const nonEmpty = cargoRows.filter(r => Object.entries(r).some(([k,v]) => k !== "id" && String(v || "").trim()));
    if (!nonEmpty.length) return flash("Agrega al menos un ítem al documento.");
    if (cargoType !== "PROVEEDORES" && !cargoConductor.trim()) return flash("El conductor es obligatorio.");

    for (let i = 0; i < nonEmpty.length; i++) {
      const row = nonEmpty[i];
      const n = i + 1;
      if (cargoType === "GENERALES") {
        if (!generalExitType.trim()) return flash("El tipo de salida es obligatorio.");
        if (!row.description.trim()) return flash(`Fila ${n}: la descripción es obligatoria.`);
        if (!row.reason.trim()) return flash(`Fila ${n}: el motivo de salida es obligatorio.`);
        if (!row.quantity.trim()) return flash(`Fila ${n}: la cantidad es obligatoria.`);
        if (!row.unit.trim()) return flash(`Fila ${n}: la unidad de medida es obligatoria.`);
      } else {
        if (!row.type.trim()) return flash(`Fila ${n}: el tipo es obligatorio.`);
        if (!row.code.trim()) return flash(`Fila ${n}: el código es obligatorio.`);
        if (cargoType === "CHALA" && !row.weight.trim()) return flash(`Fila ${n}: el peso aproximado es obligatorio.`);
        if (!row.destination.trim()) return flash(`Fila ${n}: el destino es obligatorio.`);
      }
    }

    if (cargoType === "PROVEEDORES" && !cargoProvider.trim()) return flash("El proveedor es obligatorio.");
    setCargoSaving(true);
    try {
      const data = await sheetsApi<{ id: string; correlative: string }>("saveCargo", {
        type: cargoType, generalExitType, attentionUser: currentUser?.name || "", conductor: cargoType === "PROVEEDORES" ? "" : cargoConductor,
        provider: cargoProvider, providerSource: providerSource || (cargoProvider ? "MANUAL" : ""), rows: nonEmpty,
      });
      setCargoId(data.id); setCargoCorrelative(data.correlative); setCargoSaved(true);
      flash(`Documento ${data.correlative} guardado correctamente. Ya puedes imprimir.`, "success");
    } catch (error) {
      setCargoSaved(false);
      flash(error instanceof Error ? error.message : "No se pudo guardar el documento");
    } finally { setCargoSaving(false); }
  }


  function resetCargoAfterPrint() {
    setCargoRows([blankCargoRow(1)]);
    setCargoProvider("");
    setCargoConductor("");
    setGeneralExitType(GENERAL_EXIT_TYPES[0]);
    setProviderSource("");
    setCargoSaved(false);
    setCargoSaving(false);
    setCargoCorrelative("");
    setCargoPreviewCorrelative("");
    setCargoId("");
  }

  function printCargoDocument() {
    if (!cargoSaved || !cargoCorrelative) {
      flash("Primero debes guardar el documento antes de imprimir.");
      return;
    }

    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const now = new Date();
    const fecha = new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric",
    }).format(now);
    const hora = new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).format(now);

    const validRows = cargoRows.filter(row =>
      Object.entries(row).some(([key, value]) => key !== "id" && String(value ?? "").trim() !== "")
    );

    const makeRows = (kind: "CHALA" | "PROVEEDORES" | "GENERALES") => {
      const totalRows = Math.max(1, validRows.length);
      return Array.from({ length: totalRows }, (_, index) => {
        const row = validRows[index];

        if (kind === "CHALA") {
          return `<tr>
            <td class="n">${index + 1}</td>
            <td>${row ? escapeHtml(row.type) : ""}</td>
            <td>${row ? escapeHtml(row.code) : ""}</td>
            <td>${row ? escapeHtml(row.weight) : ""}</td>
            <td>${row ? escapeHtml(row.destination) : ""}</td>
            <td>${row ? escapeHtml(row.observations) : ""}</td>
          </tr>`;
        }

        if (kind === "GENERALES") {
          return `<tr>
            <td class="n">${index + 1}</td>
            <td>${row ? escapeHtml(row.description) : ""}</td>
            <td>${row ? escapeHtml(row.reason) : ""}</td>
            <td>${row ? escapeHtml(row.quantity) : ""}</td>
            <td>${row ? escapeHtml(row.unit) : ""}</td>
            <td>${row ? escapeHtml(row.observations) : ""}</td>
          </tr>`;
        }

        return `<tr>
          <td class="n">${index + 1}</td>
          <td>${row ? escapeHtml(row.type) : ""}</td>
          <td>${row ? escapeHtml(row.code) : ""}</td>
          <td>${row ? escapeHtml(row.destination) : ""}</td>
          <td>${row ? escapeHtml(row.observations) : ""}</td>
        </tr>`;
      }).join("");
    };

    const logoHtml = `
      <div class="analytica-logo">
        <img src="data:image/png;base64,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" alt="Analytica Mineral Services S.A.C." />
      </div>`;

    let documentBody = "";

    if (cargoType === "CHALA") {
      documentBody = `
        <div class="sheet">
          <div class="header-grid">
            <div class="logo-cell">${logoHtml}</div>
            <div class="title-cell">CARGO DE SALIDA DE MUESTRAS</div>
            <div class="correlative-cell">${escapeHtml(cargoCorrelative)}</div>
          </div>

          <div class="info-grid">
            <div class="info-label">FECHA:</div><div class="info-value">${fecha}</div>
            <div class="auth-text" rowspan="2">La administración de comercialización y acopio de Analytica Mineral Services autoriza la salida de lo siguiente:</div>
            <div class="info-label">HORA:</div><div class="info-value">${hora}</div>
          </div>

          <div class="type-grid">
            <div class="type-label">TIPO DE SALIDA</div>
            <div class="type-value chala">MUESTRAS - OFICINA CHALA</div>
          </div>

          <table class="items chala-table">
            <thead><tr>
              <th>N°</th><th>TIPO</th><th>CÓDIGO</th><th>PESO APROX (gr)</th><th>DESTINO</th><th>OBSERVACIONES</th>
            </tr></thead>
            <tbody>${makeRows("CHALA")}</tbody>
          </table>

          <div class="responsibility responsibility-3">
            <div><b>ENTREGADO POR:</b></div>
            <div><b>TRASLADADO POR:</b></div>
            <div><b>RECIBIDO POR:</b></div>

            <div class="role">ATENCIÓN AL CLIENTE</div>
            <div class="role">CONDUCTOR DE RUTINA</div>
            <div class="role">OFICINA CHALA</div>

            <div class="person">${escapeHtml(currentUser.name)}</div>
            <div class="person">${escapeHtml(cargoConductor || "CONDUCTOR DE RUTINA")}</div>
            <div class="person"></div>

            <div class="signature">FIRMA:</div>
            <div class="signature">FIRMA:</div>
            <div class="signature"></div>
          </div>
        </div>`;
    } else if (cargoType === "PROVEEDORES") {
      documentBody = `
        <div class="sheet">
          <div class="header-grid">
            <div class="logo-cell">${logoHtml}</div>
            <div class="title-cell">AUTORIZACIÓN DE SALIDA DE MUESTRAS</div>
            <div class="correlative-cell">${escapeHtml(cargoCorrelative)}</div>
          </div>

          <div class="info-grid">
            <div class="info-label">FECHA:</div><div class="info-value">${fecha}</div>
            <div class="auth-text">La administración de comercialización y acopio de Analytica Mineral Services autoriza la salida de lo siguiente:</div>
            <div class="info-label">HORA:</div><div class="info-value">${hora}</div>
          </div>

          <div class="type-grid">
            <div class="type-label">TIPO DE SALIDA</div>
            <div class="type-value proveedores">MUESTRAS - PROVEEDORES</div>
          </div>

          <table class="items proveedores-table">
            <thead><tr>
              <th>N°</th><th>TIPO</th><th>CÓDIGO</th><th>DESTINO</th><th>OBSERVACIONES</th>
            </tr></thead>
            <tbody>${makeRows("PROVEEDORES")}</tbody>
          </table>

          <div class="responsibility responsibility-2">
            <div><b>ENTREGADO POR:</b></div>
            <div><b>RECIBIDO POR:</b></div>

            <div class="role">ATENCIÓN AL CLIENTE</div>
            <div class="role">PROVEEDOR</div>

            <div class="person">${escapeHtml(currentUser.name)}</div>
            <div class="person provider-name">${escapeHtml(cargoProvider)}</div>

            <div class="signature">FIRMA:</div>
            <div class="signature">FIRMA Y HUELLA:</div>
          </div>
        </div>`;
    } else {
      documentBody = `
        <div class="sheet">
          <div class="header-grid">
            <div class="logo-cell">${logoHtml}</div>
            <div class="title-cell">AUTORIZACIÓN DE SALIDA</div>
            <div class="correlative-cell">${escapeHtml(cargoCorrelative)}</div>
          </div>

          <div class="info-grid">
            <div class="info-label">FECHA:</div><div class="info-value">${fecha}</div>
            <div class="auth-text">La administración de comercialización y acopio de Analytica Mineral Services autoriza la salida de lo siguiente:</div>
            <div class="info-label">HORA:</div><div class="info-value">${hora}</div>
          </div>

          <div class="type-grid">
            <div class="type-label">TIPO DE SALIDA</div>
            <div class="type-value generales">${escapeHtml(generalExitType)}</div>
          </div>

          <table class="items generales-table">
            <thead><tr>
              <th>N°</th>
              <th>DESCRIPCIÓN</th>
              <th>MOTIVO DE SALIDA</th>
              <th>CANT.</th>
              <th>UNID MEDIDA</th>
              <th>OBSERVACIONES</th>
            </tr></thead>
            <tbody>${makeRows("GENERALES")}</tbody>
          </table>

          <div class="responsibility responsibility-3">
            <div><b>ENTREGADO POR:</b></div>
            <div><b>TRASLADADO POR:</b></div>
            <div><b>RECIBIDO POR:</b></div>

            <div class="role">ATENCIÓN AL CLIENTE</div>
            <div class="role">CONDUCTOR</div>
            <div class="role">OFICINA CHALA</div>

            <div class="person">${escapeHtml(currentUser.name)}</div>
            <div class="person">${escapeHtml(cargoConductor)}</div>
            <div class="person"></div>

            <div class="signature">FIRMA:</div>
            <div class="signature">FIRMA:</div>
            <div class="signature">FIRMA:</div>
          </div>
        </div>`;
    }

    const printWindow = window.open("", "_blank", "width=1150,height=850");
    if (!printWindow) {
      flash("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(cargoCorrelative)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:#fff; color:#000; font-family:Arial,Helvetica,sans-serif; }
  body { font-size:12px; }
  .sheet { width:100%; max-width:194mm; margin:0 auto; display:block; }

  .header-grid {
    display:grid; grid-template-columns:27% 53% 20%;
    min-height:18mm; border:1.4px solid #000;
  }
  .header-grid > div { display:flex; align-items:center; justify-content:center; }
  .logo-cell, .title-cell { border-right:1px solid #000; }
  .title-cell { font-size:18px; font-weight:800; text-align:center; padding:2px; white-space:nowrap; }
  .correlative-cell { font-size:20px; font-weight:900; }

  .analytica-logo {
    width:100%;
    height:100%;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:1mm 2mm;
  }
  .analytica-logo img {
    display:block;
    width:100%;
    max-width:45mm;
    height:auto;
    object-fit:contain;
  }

  .info-grid {
    display:grid;
    grid-template-columns:11% 15% 74%;
    grid-template-rows:6mm 6mm;
    border-left:1.4px solid #000; border-right:1.4px solid #000;
  }
  .info-grid > div { border-bottom:1px solid #aaa; display:flex; align-items:center; padding:1px 4px; }
  .info-label { font-weight:800; }
  .info-value { justify-content:center; font-weight:800; font-size:12px; border-right:1px solid #aaa; }
  .auth-text { grid-column:3; grid-row:1 / span 2; line-height:1.25; border-bottom:1px solid #aaa; }

  .type-grid { display:grid; grid-template-columns:27% 73%; border:1.4px solid #000; border-top:0; min-height:7mm; }
  .type-grid > div { display:flex; align-items:center; justify-content:center; font-weight:800; }
  .type-label { border-right:1px solid #000; }
  .type-value { font-family:Georgia,"Times New Roman",serif; font-size:12px; }
  .type-value.chala { background:#dcebf7; }
  .type-value.proveedores { background:#f9e2c8; }

  table.items { width:100%; border-collapse:collapse; table-layout:fixed; }
  .items th, .items td { border:1px solid #000; height:5.6mm; padding:1px 3px; vertical-align:middle; }
  .items th { background:#eee; font-size:10px; font-weight:800; text-align:center; }
  .items td { font-size:11px; font-weight:700; text-align:center; }
  .items td.n { font-weight:800; }
  .chala-table th:nth-child(1){width:7%}
  .chala-table th:nth-child(2){width:20%}
  .chala-table th:nth-child(3){width:16%}
  .chala-table th:nth-child(4){width:18%}
  .chala-table th:nth-child(5){width:20%}
  .chala-table th:nth-child(6){width:19%}
  .proveedores-table th:nth-child(1){width:8%}
  .proveedores-table th:nth-child(2){width:20%}
  .proveedores-table th:nth-child(3){width:22%}
  .proveedores-table th:nth-child(4){width:25%}
  .proveedores-table th:nth-child(5){width:25%}

  .responsibility { display:grid; min-height:34mm; border-left:1.4px solid #000; border-right:1.4px solid #000; border-bottom:1.4px solid #000; }
  .responsibility-3 { grid-template-columns:1fr 1.18fr 1.45fr; }
  .responsibility-2 { grid-template-columns:1fr 1fr; }
  .responsibility > div { border-right:1px solid #000; padding:2px 3px; }
  .responsibility > div:nth-child(3n) { }
  .role { text-align:center; font-weight:800; min-height:6mm; font-size:10px; display:flex; align-items:center; justify-content:center; border-top:1px solid #000; }
  .person { text-align:center; font-weight:800; font-size:10px; min-height:7mm; display:flex; align-items:center; justify-content:center; border-top:1px solid #000; }
  .provider-name { background:#dcebf7; }
  .signature { min-height:20mm; display:flex; align-items:flex-end; font-size:10px; font-weight:800; border-top:1px solid #000; padding-bottom:2px !important; }

  @media print {
    html, body {
      width:100% !important;
      margin:0 !important;
      padding:0 !important;
    }
    .sheet {
      width:100% !important;
      max-width:194mm !important;
      min-height:0 !important;
      margin:0 auto !important;
    }
    thead { display:table-header-group; }
    tr { page-break-inside:avoid; }
  }
</style>
</head>
<body>
${documentBody}
<script>
  window.onload = function () {
    setTimeout(function () { window.print(); }, 300);
  };
  window.onafterprint = function () { window.close(); };
<\/script>
</body>
</html>`);
    printWindow.document.close();

    // El cargo ya fue guardado. La impresión se abre en una ventana independiente
    // y la pantalla principal queda lista inmediatamente para el siguiente registro.
    window.setTimeout(() => {
      resetCargoAfterPrint();
    }, 150);
  }

  if (!sessionReady) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f6f8", fontFamily: "Arial, sans-serif" }}><strong>Cargando aplicación...</strong></main>;
  }

  if (!currentUser) {
    return (
      <LoginScreen
        user={loginUser}
        pin={loginPin}
        loading={loginBusy}
        error={loginError}
        onUserChange={(value) => {
          setLoginUser(value.toUpperCase());
          setLoginError("");
        }}
        onPinChange={(value) => {
          setLoginPin(value.replace(/\D/g, ""));
          setLoginError("");
        }}
        onSubmit={() => void login()}
      />
    );
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">AMS</span><div><strong>AMS ACOPIO</strong><small>Sistema de operaciones</small></div></div>
      <SidebarMenu
        activeView={activeView}
        openModule={openModule}
        guiasSection={guiasSection}
        rirmSection={rirmSection}
        adminSection={adminSection}
        isAdmin={["ADMIN", "ADMINISTRADOR"].includes(String(currentUser.role || "").toUpperCase())}
        permissions={currentUser.permissions}
        pendingCount={pendingEvents.length}
        setOpenModule={setOpenModule}
        nuevo={startNewEntry}
        hoy={() => { setActiveView("hoy"); void loadToday(); }}
        pendientes={() => { setActiveView("pendientes"); void loadPending(); }}
        buscar={() => setActiveView("buscar")}
        clientes={() => { setActiveView("personas"); void loadClients(); }}
        estadia={() => setActiveView("estadia")}
        salidaProveedores={() => setActiveView("salidaProveedores")}
        habitaciones={() => setActiveView("habitaciones")}
        resumenGuardia={() => setActiveView("resumenGuardia")}
        registrarSalida={() => setActiveView("cargos")}
        buscarSalidas={() => setActiveView("buscarSalidas")}
        recepcionCargos={() => {setActiveView("recepcionCargos");void loadCargoReceipts();}}
        abrirGuias={openGuiasSection}
        abrirRirm={openRirmSection}
        abrirAdmin={openAdminSection}
      />
      <div className={`sidebar-card connection-${connection}`}><span className="status-dot" /><div><strong>{connectionTitle}</strong><small>{queue.length ? `${queue.length} registro(s) por sincronizar` : connection === "online" ? "Lectura y escritura habilitadas" : connection === "outdated" ? "Actualiza la implementación de Apps Script" : connection === "unconfigured" ? "Falta configurar Apps Script" : "Los registros quedarán en este equipo"}</small>{queue.length > 0 && <button className="sidebar-sync" type="button" onClick={() => void syncQueue(true)} disabled={syncing || connection === "unconfigured" || connection === "outdated"}>{syncing ? "Sincronizando…" : "Sincronizar ahora"}</button>}</div></div>
      <div className="user-card"><span>{currentUser.name.split(" ").map(part => part[0]).slice(0,2).join("")}</span><div><strong>{currentUser.name}</strong><small>{currentUser.role}</small><button type="button" onClick={logout} style={{ marginTop: 5, border: 0, background: "transparent", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 800, textDecoration: "underline" }}>Cerrar sesión</button></div></div>
    </aside>

    <button type="button" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"
      style={{ position: "fixed", right: 10, top: 10, zIndex: 5000, border: "1px solid #c7d6d2", borderRadius: 9, background: "#ffffff", color: "#173f3b", padding: "7px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.10)" }}>
      Salir
    </button>

    <section className="workspace">
      <header className="topbar ams-integrated-topbar">
        <div className="ams-topbar-brand"><strong>AMS ACOPIO</strong><span>SISTEMA INTEGRADO DE ATENCIÓN, CARGOS, GUÍAS Y RI-RM</span></div>
        <div className="header-actions"><span className={`online connection-pill-${connection}`}>● {connectionLabel}</span></div>
      </header>
      <section className="module-page-heading">
        <div>
          <h1>{activeView === "registro" || activeView === "hoy" || activeView === "pendientes" || activeView === "buscar" || activeView === "personas" || activeView === "estadia" || activeView === "salidaProveedores" || activeView === "habitaciones" || activeView === "resumenGuardia" ? "1. ATENCIÓN AL CLIENTE" : activeView === "cargos" || activeView === "buscarSalidas" || activeView === "recepcionCargos" ? "2. CARGOS Y SALIDAS" : activeView === "guias" ? "3. REGISTRO DE GUÍAS" : activeView === "rirm" ? "4. REGISTRO RI-RM" : "5. ADMINISTRACIÓN GENERAL"}</h1>
          <p>{activeView === "registro" ? "REGISTRO DE PROVEEDORES Y VEHÍCULOS" : activeView === "hoy" ? "REPORTE DIARIO" : activeView === "pendientes" ? "REGISTROS POR REGULARIZAR" : activeView === "buscar" ? "BÚSQUEDA DE REGISTROS" : activeView === "personas" ? "BASE DE DATOS DE CLIENTES" : activeView === "estadia" ? "ESTADÍA, SERVICIOS Y CONSUMOS" : activeView === "salidaProveedores" ? "SALIDA DE PROVEEDORES" : activeView === "habitaciones" ? "CONTROL DE HABITACIONES" : activeView === "resumenGuardia" ? "RESUMEN DIARIO / GUARDIA" : activeView === "cargos" ? "REGISTRO DE SALIDAS DE MATERIALES" : activeView === "buscarSalidas" ? "CONSULTA DE SALIDAS" : activeView === "recepcionCargos" ? "PENDIENTES DE RECEPCIÓN - CH" : activeView === "guias" ? "GESTIÓN Y SEGUIMIENTO DE GUÍAS" : activeView === "rirm" ? "GESTIÓN Y TRAZABILIDAD DE RI / RM" : "CONFIGURACIÓN Y CONTROL DEL SISTEMA"}</p>
        </div>
      </section>
      <section className={`sync-strip connection-${connection}`}><div className="sync-status"><span className="status-dot" /><p><strong>{connectionTitle}</strong><small>{connection === "outdated" ? "La versión activa escribe en columnas incorrectas. Los nuevos registros se conservarán en este dispositivo hasta actualizarla." : queue.length ? `${queue.length} registro(s) asegurado(s). ${syncing ? `Procesando la cola; los demás esperan protegidos.` : queue.some(item => item.lastError) ? "Hay registros que requieren revisión. Abre Gestionar pendientes para ver el motivo." : "Listos para enviarse uno por uno."}` : connection === "online" ? "Conexión verificada. No hay registros pendientes de envío." : "Puedes continuar registrando; los datos se conservarán en este dispositivo."}</small></p></div>{queue.length > 0 && <div className="sync-actions"><button className="manage-sync" type="button" onClick={() => setShowQueueManager(current => !current)}>{showQueueManager ? "Ocultar pendientes" : `Gestionar pendientes (${queue.length})`}</button><button type="button" onClick={() => void syncQueue(true)} disabled={syncing || connection === "unconfigured" || connection === "outdated"}>{syncing ? `Sincronizando…` : `Sincronizar ahora`}</button></div>}</section>
      {showQueueManager && queue.length > 0 && <section className="queue-manager"><div className="queue-manager-head"><div><strong>Pendientes guardados en este dispositivo</strong><span>Un registro con error ya no detiene a los demás. Revísalo antes de eliminarlo.</span></div><button type="button" className="danger-link" onClick={removeAllQueued}>Eliminar todos</button></div><div className="queue-list">{queue.map(item => { const preview = queuePreview(item); return <article className={item.lastError ? "queue-item has-error" : "queue-item"} key={item.queueId}><div className="queue-item-main"><strong>{item.localId}</strong><span>{formatDateTime(item.createdAt)} · {item.action === "regularizeEvent" ? "REGULARIZACIÓN" : "NUEVO INGRESO"}</span><p>{preview.plate} · {preview.people}</p>{item.lastError && <em>{item.lastError}</em>}</div><div className="queue-item-actions"><button type="button" onClick={() => retryQueued(item.queueId)} disabled={syncing}>Reintentar</button><button type="button" className="danger" onClick={() => removeQueued(item.queueId)} disabled={syncing}>Eliminar</button></div></article>; })}</div></section>}

      {activeView === "registro" && <>
        {regularizingId && <section className="regularization-banner"><div><strong>Regularización activa: {regularizingId}</strong><span>Las filas existentes conservan su fecha y hora; solo las personas nuevas usan la hora actual.</span></div></section>}
        <section className="case-panel"><div className="case-heading"><div><span>MATRIZ OPERATIVA ACTUALIZADA</span><h2>Selecciona el tipo de atención</h2></div><p>La opción 1 incluye conductor solo, proveedor pendiente y acompañantes.</p></div><div className="case-grid four-cases">{CASES.map((item) => <button type="button" key={item.id} className={activeCase === item.id ? "case-chip selected" : "case-chip"} onClick={() => applyCase(item.id)}><b>{OPTION_NUMBER[item.id]}</b><span><strong>{item.title}</strong><small>{item.note}</small></span><em>{item.tag}</em></button>)}</div></section>

        <form onSubmit={(e) => e.preventDefault()} className="form-layout"><div className="main-column">
          <section className="form-card"><div className="section-title"><span>1</span><div><h2>Datos generales</h2><p>Fecha, responsable, guardia y turno</p></div><em>OPCIÓN {OPTION_NUMBER[activeCase] || 1}: {caseInfo.title.toUpperCase()}</em></div><div className="fields-grid general-grid">
            <label>Fecha y hora de ingreso<input type="datetime-local" value={dateTime} readOnly title="Hora fijada al iniciar este registro" /></label>
            <label>Responsable<input value={currentUser.name} readOnly title="Responsable asignado automáticamente según el usuario que inició sesión" /></label>
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

      {activeView === "cargos" && <section className="empty-view data-view cargo-view">
        <div className="view-heading"><div><span>▤</span><div><h2>Cargos y Salidas</h2><p>Primero se guarda el documento; recién después se habilita la impresión.</p></div></div></div>
        <div className="cargo-type-grid">
          <button className={cargoType === "CHALA" ? "selected" : ""} onClick={() => { setCargoType("CHALA"); setCargoSaved(false); setCargoCorrelative(""); setCargoId(""); }}><strong>Salida de muestras</strong><small>Oficina Chala · CH</small></button>
          <button className={cargoType === "PROVEEDORES" ? "selected" : ""} onClick={() => { setCargoType("PROVEEDORES"); setCargoSaved(false); setCargoCorrelative(""); setCargoId(""); setCargoProvider(""); setProviderSource(""); }}><strong>Salida de muestras</strong><small>Proveedores · PR</small></button>
          <button className={cargoType === "GENERALES" ? "selected" : ""} onClick={() => { setCargoType("GENERALES"); setCargoSaved(false); setCargoCorrelative(""); setCargoId(""); }}><strong>Autorización de salida</strong><small>Generales</small></button>
        </div>
        <section className="cargo-editor">
          <div
            className="cargo-current-number"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "16px",
              padding: "12px 16px",
              border: "1px solid #9fd4cc",
              borderRadius: "10px",
              background: "#eef9f7"
            }}
          >
            <span style={{ fontWeight: 800, fontSize: "15px", color: "#31514d" }}>
              N° DE SALIDA
            </span>
            <strong style={{ fontSize: "22px", color: "#075b54" }}>
              {cargoCorrelative ||
                cargoPreviewCorrelative ||
                (cargoType === "CHALA"
                  ? "CH - CONSULTANDO..."
                  : cargoType === "PROVEEDORES"
                    ? "PR - CONSULTANDO..."
                    : "GE - CONSULTANDO...")}
            </strong>
          </div>

          <style>{`
            .cargo-editor .cargo-line input,
            .cargo-editor .cargo-line select {
              font-size: 16px !important;
              font-weight: 700 !important;
            }
            .cargo-editor .cargo-meta input,
            .cargo-editor .cargo-meta select {
              font-size: 15px !important;
            }
          `}</style>

          <div className="cargo-meta">
            <label>Atención al cliente<input value={currentUser.name} readOnly /></label>
            {cargoType === "GENERALES" && <label>Tipo de salida *<select value={generalExitType} onChange={e => { setGeneralExitType(e.target.value); setCargoSaved(false); }}>{GENERAL_EXIT_TYPES.map(x => <option key={x}>{x}</option>)}</select></label>}
            {cargoType === "PROVEEDORES" && <label>Proveedor *<input value={cargoProvider} onChange={e => { setCargoProvider(e.target.value.toUpperCase()); setProviderSource("MANUAL"); setCargoSaved(false); }} placeholder="Automático al ingresar un código" /><small>{providerSource ? `Origen: ${providerSource}` : "Se buscará en PROCESOS - GUIAS"}</small></label>}
            {cargoType !== "PROVEEDORES" && <label>Conductor *<select value={cargoConductor} onChange={e => { setCargoConductor(e.target.value); setCargoSaved(false); }}><option value="">Seleccionar</option>{CONDUCTORS.map(x => <option key={x}>{x}</option>)}</select></label>}
          </div>
          <div className="cargo-lines">{cargoRows.map((row,index) => <div className="cargo-line" key={row.id}><b>{index+1}</b>{cargoType === "GENERALES" ? <>
            <input placeholder="Descripción *" value={row.description} onChange={e => setCargoRows(a => a.map(x => x.id===row.id ? {...x,description:e.target.value.toUpperCase()} : x))} />
            <input placeholder="Motivo de salida *" value={row.reason} onChange={e => setCargoRows(a => a.map(x => x.id===row.id ? {...x,reason:e.target.value.toUpperCase()} : x))} />
            <input placeholder="Cant. *" value={row.quantity} onChange={e => setCargoRows(a => a.map(x => x.id===row.id ? {...x,quantity:e.target.value} : x))} />
            <input placeholder="Und. medida *" value={row.unit} onChange={e => setCargoRows(a => a.map(x => x.id===row.id ? {...x,unit:e.target.value.toUpperCase()} : x))} />
          </> : <>
            <select
  value={row.type}
  onChange={e => {
    setCargoRows(a => a.map(x =>
      x.id === row.id ? { ...x, type: e.target.value } : x
    ));
    setCargoSaved(false);
  }}
>
  <option value="">Tipo *</option>
  {CARGO_SAMPLE_TYPES.map(tipo => (
    <option key={tipo} value={tipo}>{tipo}</option>
  ))}
</select>
            <input placeholder="Código *" value={row.code} onChange={e => { const code=e.target.value.toUpperCase(); setCargoRows(a => a.map(x => x.id===row.id ? {...x,code} : x)); if (cargoType === "PROVEEDORES") { setCargoProvider(""); setProviderSource(""); } setCargoSaved(false); }} onBlur={() => { if (cargoType === "PROVEEDORES" && row.code.trim()) void lookupCargoProvider(row.code); }} />
            {cargoType === "CHALA" && <input placeholder="Peso aprox. (g) *" value={row.weight} onChange={e => setCargoRows(a => a.map(x => x.id===row.id ? {...x,weight:e.target.value} : x))} />}
            <input placeholder="Destino *" value={row.destination} onChange={e => setCargoRows(a => a.map(x => x.id===row.id ? {...x,destination:e.target.value.toUpperCase()} : x))} />
          </>}<input placeholder="Observaciones" value={row.observations} onChange={e => { setCargoRows(a => a.map(x => x.id===row.id ? {...x,observations:e.target.value.toUpperCase()} : x)); setCargoSaved(false); }} />
            <button
              type="button"
              className="cargo-delete-row"
              disabled={cargoRows.length <= 1}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (cargoRows.length <= 1) return;
                setCargoRows(a => a.filter(x => x.id !== row.id));
                setCargoSaved(false);
              }}
              title="Eliminar fila"
              aria-label={`Eliminar fila ${index + 1}`}
            >
              ×
            </button>
          </div>)}</div>
          <button className="add-person" type="button" onClick={() => { setCargoRows(a => [...a, blankCargoRow(Math.max(...a.map(x=>x.id),0)+1)]); setCargoSaved(false); }}>＋ Agregar fila</button>
          {cargoCorrelative && <div className="cargo-saved-banner"><strong>{cargoCorrelative}</strong><span>Guardado · ID {cargoId}</span></div>}
          <div className="cargo-actions"><button className="primary-action" disabled={cargoSaving || cargoSaved} onClick={() => void saveCargoDocument()}>{cargoSaving ? "Guardando…" : cargoSaved ? "Guardado" : "Guardar"}</button><button className="secondary-action" disabled={!cargoSaved} onClick={() => printCargoDocument()}>Imprimir</button></div>
        </section>
      </section>}
      {activeView === "buscarSalidas" && <section className="empty-view data-view">
        <div className="view-heading"><div><span>⌕</span><div><h2>Buscar salidas</h2><p>Consulta las muestras que ya fueron enviadas por tipo, código o fecha.</p></div></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, margin: "18px 0" }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>Tipo
            <select value={exitTypeFilter} onChange={e => setExitTypeFilter(e.target.value)} style={{ minHeight: 42, border: "1px solid #cbd9d6", borderRadius: 8, padding: "8px 10px" }}>
              <option value="">TODOS</option>
              {CARGO_SAMPLE_TYPES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>Código
            <input value={exitCodeFilter} onChange={e => setExitCodeFilter(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === "Enter") void searchCargoExits(); }} placeholder="Código o parte del código" style={{ minHeight: 42, border: "1px solid #cbd9d6", borderRadius: 8, padding: "8px 10px" }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontWeight: 800 }}>Fecha
            <input type="date" value={exitDateFilter} onChange={e => setExitDateFilter(e.target.value)} style={{ minHeight: 42, border: "1px solid #cbd9d6", borderRadius: 8, padding: "8px 10px" }} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <button className="primary-action" type="button" onClick={() => void searchCargoExits()} disabled={exitSearching}>{exitSearching ? "Buscando…" : "Buscar"}</button>
          <button className="secondary-action" type="button" onClick={clearExitSearch}>Limpiar filtros</button>
        </div>
        <div style={{ overflowX: "auto", border: "1px solid #d9e4e1", borderRadius: 12 }}>
          <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", background: "#fff" }}>
            <thead><tr style={{ background: "#eef7f5", textAlign: "left" }}>
              {["N° SALIDA","TIPO","CÓDIGO","FECHA Y HORA DE ENVÍO","RESPONSABLE","GUARDIA","TURNO"].map(h => <th key={h} style={{ padding: 11, borderBottom: "1px solid #d9e4e1", fontSize: 12 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {exitResults.map((r,i) => <tr key={`${r.correlative}-${r.code}-${i}`}>
                <td style={{ padding: 10, borderBottom: "1px solid #edf2f0", fontWeight: 800 }}>{r.correlative}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #edf2f0" }}>{r.type || "—"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #edf2f0", fontWeight: 800 }}>{r.code}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #edf2f0" }}>{r.dateTime ? new Date(r.dateTime).toLocaleString("es-PE", { timeZone: "America/Lima" }) : "—"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #edf2f0" }}>{r.responsible || "—"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #edf2f0" }}>{r.guard || "—"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #edf2f0" }}>{r.shift || "—"}</td>
              </tr>)}
              {!exitResults.length && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#6b7d78" }}>Selecciona los filtros y pulsa Buscar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}
      {activeView === "recepcionCargos" && <section className="empty-view data-view"><div className="view-heading"><div><span>✓</span><div><h2>Pendientes de recepción</h2><p>Solo se muestran salidas TIPO CH pendientes de confirmación.</p></div></div><button className="secondary-action" onClick={()=>void loadCargoReceipts()} disabled={cargoReceiptBusy}>{cargoReceiptBusy?"Actualizando…":"Actualizar"}</button></div><div style={{display:"flex",gap:10,margin:"14px 0",flexWrap:"wrap"}}><button className="secondary-action" onClick={()=>setCargoReceiptSel(cargoReceiptSel.length===cargoReceipts.length?[]:cargoReceipts.map(cargoReceiptKey))}>{cargoReceiptSel.length===cargoReceipts.length&&cargoReceipts.length?"Deseleccionar todo":"Seleccionar todo"}</button><button className="primary-action" disabled={!cargoReceiptSel.length||cargoReceiptBusy} onClick={()=>void confirmCargoReceipts()}>Marcar recibido ({cargoReceiptSel.length})</button></div><div style={{overflowX:"auto",border:"1px solid #d9e4e1",borderRadius:12}}><table style={{width:"100%",minWidth:760,borderCollapse:"collapse",background:"#fff"}}><thead><tr style={{background:"#eef7f5"}}><th></th><th>N° salida</th><th>Tipo</th><th>Código</th><th>Fecha y hora de envío</th><th>Responsable</th><th>Turno</th></tr></thead><tbody>{cargoReceipts.map(x=>{const k=cargoReceiptKey(x);return <tr key={k}><td style={{padding:10}}><input type="checkbox" checked={cargoReceiptSel.includes(k)} onChange={e=>setCargoReceiptSel(v=>e.target.checked?[...v,k]:v.filter(y=>y!==k))}/></td><td><b>{x.correlative}</b></td><td><b>{x.type}</b></td><td>{x.code}</td><td>{x.dateTime?new Date(x.dateTime).toLocaleString("es-PE",{timeZone:"America/Lima"}):"—"}</td><td>{x.responsible||"—"}</td><td>{x.shift||"—"}</td></tr>})}{!cargoReceipts.length&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:"#6b7d78"}}>No hay salidas CH pendientes de recepción.</td></tr>}</tbody></table></div></section>}
      {activeView === "estadia" && <EstadiaServicios responsable={currentUser.name} />}
      {activeView === "salidaProveedores" && <SalidaProveedores responsable={currentUser.name} />}
      {activeView === "habitaciones" && <ControlHabitaciones responsable={currentUser.name} />}
      {activeView === "resumenGuardia" && <ResumenGuardia responsable={currentUser.name} />}

      {activeView === "guias" && <section style={{ padding: 0, margin: 0, width: "100%", minHeight: "calc(100vh - 92px)", background: "#f4f6f8" }}>
        <iframe
          ref={guiasFrameRef}
          title="Registro de Guías"
          srcDoc={GUIAS_HTML_INTEGRADO}
          onLoad={() => {
            const frameWindow = guiasFrameRef.current?.contentWindow as (Window & { mostrarPagina?: (pagina: string) => void }) | null;
            frameWindow?.mostrarPagina?.(guiasSection);
          }}
          style={{ width: "100%", height: "calc(100vh - 92px)", minHeight: 760, border: 0, display: "block", background: "white" }}
          allow="clipboard-read; clipboard-write"
        />
      </section>}

      {activeView === "rirm" && <RiRmFrame section={rirmSection} user={currentUser} />}
      {activeView === "admin" && ["ADMIN", "ADMINISTRADOR"].includes(String(currentUser.role || "").toUpperCase()) && <AdminPanel section={adminSection} />}

      {activeView === "personas" && <section className="empty-view data-view"><div className="people-toolbar"><div><h2>BD CLIENTES</h2><p>Fuente maestra para autocompletar por DNI.</p></div><button onClick={loadClients} disabled={busy}>Actualizar</button></div><div className="people-table"><div className="table-head"><span>DNI</span><span>Nombres y apellidos</span><span>Celular</span><span>Licencia</span><span>Estado</span></div>{clients.map(person => <div className="table-row" key={person.dni}><span>{person.dni}</span><strong>{person.name}</strong><span>{person.phone}</span><span>{person.license ? `${person.license} · ${person.category}` : "—"}</span><em>{person.role || "ACTIVO"}</em></div>)}</div>{!clients.length && <p className="empty-message">Pulsa Actualizar para consultar BD CLIENTES.</p>}</section>}
    </section>
    {notice && <div className="notice-toast" role="status" aria-live="polite">{notice}</div>}
    {toast && <div className="alert-overlay" role="alert" aria-live="assertive"><div className={`alert-card ${toast.type}`}><span className="alert-icon">{toast.type === "success" ? "✓" : "!"}</span><div><strong>{toast.type === "success" ? "REGISTRO EXITOSO" : "ATENCIÓN: NO SE GUARDÓ"}</strong><p>{toast.message}</p></div><button type="button" aria-label="Cerrar alerta" onClick={() => setToast(null)}>×</button></div></div>}
  </main>;
}
