"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Role = "CONDUCTOR" | "PROVEEDOR" | "ACOMPAÑANTE";
type View = "registro" | "hoy" | "pendientes" | "buscar" | "personas" | "cargos" | "buscarSalidas" | "guias";
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
type AppUser = { user: string; name: string; role: string };
type CargoRow = { id: number; type: string; code: string; weight: string; destination: string; description: string; reason: string; quantity: string; unit: string; observations: string };

const QUEUE_KEY = "acopio_sync_queue_v1";
const CLIENT_CACHE_KEY = "acopio_client_cache_v1";
const SESSION_KEY = "atencion_usuario_sesion_v1";
const ENTRY_DRAFT_KEY = "atencion_ingreso_pendiente_v1";
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

const GUIAS_HTML_INTEGRADO = "<!DOCTYPE html>\n<html>\n<head>\n  <base target=\"_top\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <script src=\"https://www.gstatic.com/charts/loader.js\"></script>\n  <style>\n    *{box-sizing:border-box;font-family:Arial,sans-serif}\n    html,body{margin:0;width:100%;min-height:100%;background:#f4f7fb;color:#253244}\n    button{cursor:pointer}\n\n    #login{position:fixed;inset:0;background:linear-gradient(135deg,#062f57,#0a5b99);display:flex;justify-content:center;align-items:center;z-index:9999;padding:20px}\n    .login-box{width:100%;max-width:410px;background:#fff;border-radius:16px;padding:32px;box-shadow:0 20px 50px rgba(0,0,0,.25)}\n    .login-box h2{text-align:center;color:#0b3764;margin:0 0 5px}\n    .login-box p{text-align:center;color:#718096;margin-bottom:25px}\n    .login-error{display:none;background:#fee2e2;color:#b91c1c;padding:10px;margin-bottom:12px;border-radius:7px}\n    .btn-login{width:100%;border:0;background:#0d6efd;color:#fff;padding:13px;border-radius:8px;font-weight:bold}\n\n    #app{display:none}\n    .sidebar{position:fixed;left:0;top:0;bottom:0;width:190px;background:#0d416d;color:#fff;padding:20px 10px;z-index:100}\n    .marca{padding:3px 8px 22px}.marca h2{margin:0;font-size:18px;line-height:1.05}.marca small{font-size:11px;opacity:.8}\n    .menu-btn{width:100%;border:0;background:transparent;color:#fff;text-align:left;border-radius:7px;padding:12px 10px;margin-bottom:5px;font-size:11px;font-weight:bold}\n    .menu-btn.activo,.menu-btn:hover{background:#196399}\n    #menuIndicadores{display:none}\n    .usuario-menu{position:absolute;left:10px;right:10px;bottom:15px;border-top:1px solid rgba(255,255,255,.25);padding-top:12px;font-size:11px}\n    .btn-salir{margin-top:10px;width:100%;padding:9px;background:#fff;color:#d32f2f;border:none;border-radius:5px;font-weight:bold}\n\n    .contenido{margin-left:190px;min-height:100vh;background:#f4f7fb}\n    .topbar{height:55px;background:#fff;border-bottom:1px solid #dce4ed;display:flex;align-items:center;padding:0 22px}\n    .topbar h1{margin:0;color:#0b3764;font-size:18px}\n    .pagina{display:none;width:100%;padding:14px 18px 25px}.pagina.activa{display:block}\n\n    .card{width:100%;background:#fff;border-radius:10px;padding:17px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.07)}\n    .titulo{color:#0066ff;font-size:15px;font-weight:bold;margin-bottom:14px}\n    .grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}\n    .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}\n    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}\n\n    label{display:block;margin-bottom:5px;font-size:11px;font-weight:bold}\n    input,select,textarea{width:100%;padding:9px;border:1px solid #c7d3df;border-radius:6px;background:#fff;font-size:12px}\n    input:focus,select:focus,textarea:focus{outline:none;border-color:#0d6efd;box-shadow:0 0 0 2px rgba(13,110,253,.08)}\n    input[readonly]{background:#f5f8fb}\n    textarea{min-height:80px;resize:vertical}\n\n    .recepcion-guias{margin-top:14px;border-top:1px solid #e1e7ed;padding-top:13px}\n    .recepcion-guias-titulo{color:#0b3764;font-size:13px;font-weight:bold;margin-bottom:9px}\n    .guia-recepcion{border:1px solid #dae3ec;background:#fafcff;border-radius:7px;padding:10px}\n    .guia-recepcion strong{display:block;font-size:12px;margin-bottom:8px}\n    .grr-rec{border-left:4px solid #31a25d}.grt-rec{border-left:4px solid #0d6efd}\n    .opcional{color:#718096;font-weight:normal;font-size:10px}\n\n    .recepcion{margin-top:14px;padding:13px;border:1px solid #6bcc8a;background:#f3fff6;border-radius:7px;display:grid;grid-template-columns:1fr auto 270px;align-items:center;gap:14px}\n    .recepcion strong{color:#087c3d}.subestado{margin-top:3px;color:#64748b;font-size:10px}\n\n    .tipo-box{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:13px 0}\n    .tipo-opcion{border:2px solid #d8e1eb;border-radius:8px;padding:11px;cursor:pointer}\n    .tipo-opcion.activo{border-color:#0d6efd;background:#eef6ff}\n    .tipo-opcion input{width:auto}.tipo-opcion strong{font-size:11px}.tipo-opcion small{font-size:9px}\n\n    .guia-card{border:1px solid #cfdbe8;border-radius:8px;padding:13px}\n    .remitente{border-color:#80d59a}.transportista{border-color:#79adf7}\n    .guia-titulo{margin-bottom:12px;font-size:13px;font-weight:bold}\n    .remitente .guia-titulo{color:#168246}.transportista .guia-titulo{color:#0d6efd}\n    .oculto{display:none!important}\n\n    .btn{border:none;border-radius:6px;padding:9px 13px;font-size:10px;font-weight:bold}\n    .verde{background:#128145;color:#fff}.azul{background:#0d6efd;color:#fff}.naranja{background:#fa5b00;color:#fff}\n    .rojo{background:#dc3545;color:#fff}.morado{background:#6f42c1;color:#fff}.gris{background:#e7edf3;color:#64748b}\n    .acciones-final{display:flex;justify-content:flex-end;margin-top:12px}\n    .guardar-nuevo{display:flex;justify-content:flex-end;margin-top:14px;padding-top:13px;border-top:1px solid #e3e9f0}\n    .guardar-nuevo .btn{font-size:12px;padding:11px 20px}\n\n    .tiempos{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}\n    .tiempo{background:#edf6ff;border-radius:7px;text-align:center;padding:12px}\n    .tiempo strong{display:block;margin:4px 0;color:#0066ff;font-size:18px}.tiempo small{font-size:9px}\n\n    .tabla-wrap{width:100%;overflow:auto}\n    table{width:100%;border-collapse:collapse;min-width:1350px;font-size:10px}\n    th{padding:8px;background:#0b416e;color:#fff}\n    td{padding:7px;border:1px solid #dce4ec;text-align:center}\n    .busqueda{display:flex;gap:8px;align-items:end;margin-bottom:12px}.busqueda input{width:220px}\n    .badge{display:inline-block;padding:4px 8px;border-radius:12px;font-size:9px;font-weight:bold}\n    .badge-pendiente{background:#fff0bd;color:#8a6000}.badge-finalizado{background:#dff5e6;color:#13773b}.badge-anulado{background:#fde1e1;color:#b91c1c}\n    .accion{margin:2px;padding:5px 7px;border:none;border-radius:5px;font-size:9px}.accion:disabled{opacity:.25;cursor:not-allowed}\n    .accion.eliminar{background:#dc3545;color:#fff;font-weight:bold}\n\n    .filtros{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}\n    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}\n    .kpi{background:#fff;padding:15px;border-radius:8px;text-align:center;box-shadow:0 2px 7px rgba(0,0,0,.06)}\n    .kpi strong{display:block;margin-top:5px;color:#0066ff;font-size:23px}\n    .charts{display:grid;grid-template-columns:1fr 1fr;gap:12px}.chart{height:320px}\n\n    .modal-fondo{display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);justify-content:center;align-items:center;padding:20px}\n    .modal-fondo.abierto{display:flex}.modal{width:100%;max-width:720px;max-height:90vh;overflow:auto;padding:20px;background:#fff;border-radius:10px}\n    .modal-acciones{margin-top:13px;display:flex;justify-content:flex-end;gap:8px}\n    .detalle{background:#f5f8fc;padding:12px;border-radius:8px;line-height:1.8;font-size:12px}\n\n    @media(max-width:1000px){\n      .grid5{grid-template-columns:repeat(2,1fr)}\n      .filtros,.kpis{grid-template-columns:repeat(2,1fr)}\n    }\n    /* ===== TAMAÑO DE LETRAS DE LA APP ===== */\n\nbody {\n  font-size: 15px !important;\n}\n\nlabel {\n  font-size: 13px !important;\n}\n\ninput,\nselect,\ntextarea {\n  font-size: 14px !important;\n}\n\nbutton {\n  font-size: 13px !important;\n}\n\ntable,\nth,\ntd {\n  font-size: 13px !important;\n}\n\n\n    /* ===== REGISTRO DE SACOS MINEROS ===== */\n    .sacos-selector{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}\n    .sacos-salida-layout{display:grid;grid-template-columns:320px 1fr;gap:16px;align-items:start}\n    .sacos-detalle-box{border:1px solid #cbd9e8;border-radius:8px;background:#fbfdff;padding:13px}\n    .sacos-detalle-head,.sacos-detalle-row{display:grid;grid-template-columns:2fr .8fr .8fr 44px;gap:8px;align-items:center}\n    .sacos-detalle-head{font-weight:bold;font-size:11px;color:#475569;margin-bottom:7px}\n    .sacos-detalle-row{margin-bottom:7px}\n    .sacos-agregar{display:grid;grid-template-columns:2fr .8fr .8fr 110px;gap:8px;align-items:end;margin-top:12px;padding-top:12px;border-top:1px solid #dce4ec}\n    .sacos-report-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}\n    .sacos-chart{height:300px}\n    .sacos-chart-wide{grid-column:1/-1;height:330px}\n    .sacos-help{font-size:10px;color:#64748b;margin-top:6px}\n    @media(max-width:1050px){.sacos-salida-layout{grid-template-columns:1fr}.sacos-report-grid{grid-template-columns:1fr}.sacos-chart-wide{grid-column:auto}}\n\n\n    .revision-accion{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:10px 0 14px}\n    .revision-accion .fecha-accion{min-width:270px;max-width:330px}\n    .guias-rec-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px}\n    .guia-rec-full{border:1px solid #d5e0ec;border-radius:8px;padding:12px;background:#fbfdff}\n    .guia-rec-full.rem{border-left:4px solid #31a25d}\n    .guia-rec-full.tra{border-left:4px solid #0d6efd}\n    .guia-rec-full .grid3{margin-top:8px}\n    .reporte-sacos-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}\n    @media(max-width:900px){.guias-rec-grid,.reporte-sacos-grid{grid-template-columns:1fr}}\n  \n    .charts-indicadores{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}\n    .charts-indicadores .chart-wide{grid-column:1/-1}\n    .chart-linea-ancha{height:380px}\n    @media(max-width:1000px){\n      .charts-indicadores{grid-template-columns:1fr}\n      .charts-indicadores .chart-wide{grid-column:auto}\n    }\n\n  \n    #chartZonasSacos{\n      width:100% !important;\n      min-height:420px;\n      overflow:visible !important;\n    }\n\n  \n    #chartEvolucionZonaSacos{\n      width:100% !important;\n      min-height:430px;\n    }\n\n  \n    #chartEvolucionZonaSacos > div{\n      width:100%;\n    }\n    @media(max-width:900px){\n      #chartEvolucionZonaSacos > div{\n        grid-template-columns:140px 1fr !important;\n      }\n    }\n\n  \n    /* REGISTRO GENERAL DE SACOS: ventana fija con máximo aprox. 10 filas visibles */\n    .registro-sacos-scroll{\n      max-height:440px;\n      overflow-y:auto !important;\n      overflow-x:auto !important;\n      border:1px solid #d7e1ec;\n      border-radius:6px;\n    }\n\n    .registro-sacos-scroll .tabla-registro-sacos{\n      margin:0;\n    }\n\n    .registro-sacos-scroll .tabla-registro-sacos thead th{\n      position:sticky;\n      top:0;\n      z-index:5;\n      background:#0b4a78;\n      color:#fff;\n    }\n\n  \n    #chartEvolucionZonaSacos{\n      width:100% !important;\n      min-height:540px;\n      overflow:visible !important;\n    }\n\n  \n    #chartEvolucionZonaSacos{width:100% !important;overflow-x:auto !important;overflow-y:visible !important;padding:8px 16px 18px 16px;box-sizing:border-box;}\n    .registro-sacos-scroll{max-height:440px;overflow-y:auto !important;overflow-x:auto !important;border:1px solid #d7e1ec;border-radius:6px;}\n    .registro-sacos-scroll .tabla-registro-sacos thead th{position:sticky;top:0;z-index:5;background:#0b4a78;color:#fff;}\n\n\n    #chartEvolucionZonaSacos{\n      width:100% !important;\n      display:block !important;\n      position:relative !important;\n      clear:both !important;\n      margin-top:10px !important;\n      padding:8px 18px 20px 18px;\n      box-sizing:border-box;\n      overflow-x:auto !important;\n      overflow-y:visible !important;\n    }\n    #chartEvolucionZonaSacos .evol-zona-tabla{\n      min-width:930px;\n    }\n\n  \n    /* --- CORRECCIÓN FINAL: cada gráfico de zona ocupa su propia tarjeta --- */\n    .reporte-zona-card{\n      height:auto !important;\n      min-height:0 !important;\n      margin:0 0 18px 0 !important;\n      overflow:visible !important;\n      display:block !important;\n      clear:both !important;\n    }\n    .evolucion-zona-card{\n      margin-top:18px !important;\n    }\n    #chartZonasSacos{\n      width:100% !important;\n      min-height:420px;\n      height:auto;\n      display:block;\n      position:relative;\n      overflow:visible !important;\n    }\n    #chartEvolucionZonaSacos{\n      width:100% !important;\n      height:auto !important;\n      min-height:0 !important;\n      display:block !important;\n      position:relative !important;\n      clear:both !important;\n      overflow-x:auto !important;\n      overflow-y:visible !important;\n      padding:4px 10px 16px 10px !important;\n      box-sizing:border-box;\n    }\n\n  \n    .evolucion-zona-card{clear:both;display:block;width:100%;box-sizing:border-box;overflow:hidden;}\n    .evolucion-zona-header{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:10px;}\n    .evolucion-zona-filtro{display:flex;align-items:center;gap:8px;min-width:260px;}\n    .evolucion-zona-filtro label{font-weight:700;white-space:nowrap;}\n    .evolucion-zona-filtro select{min-width:180px;height:34px;}\n    .chart-evolucion-zona-fija{width:100%;height:430px;min-height:430px;overflow:hidden!important;}\n    @media(max-width:900px){\n      .evolucion-zona-header{align-items:stretch;flex-direction:column;}\n      .evolucion-zona-filtro{min-width:0;}\n    }\n\n  \n    .resumen-sacos-compacto{\n      width:360px;\n      max-width:100%;\n      margin:0 !important;\n      padding:10px 12px;\n    }\n\n    .resumen-sacos-compacto table{\n      width:100%;\n      font-size:12px;\n    }\n\n    .sacos-layout-reportes{\n      display:grid;\n      grid-template-columns:360px minmax(520px,1fr) 320px;\n      gap:14px;\n      align-items:start;\n      margin-top:12px;\n    }\n\n    .sacos-movimiento-card{\n      grid-column:2;\n      min-height:300px;\n    }\n\n    .sacos-stock-card{\n      grid-column:3;\n      min-height:300px;\n    }\n\n    .sacos-zona-card,\n    .sacos-evol-total-card,\n    .sacos-evol-zona-card{\n      grid-column:1/-1;\n      margin-top:10px;\n    }\n\n    .sacos-zona-card{ min-height:420px; }\n    .sacos-evol-total-card{ min-height:420px; }\n    .sacos-evol-zona-card{ min-height:420px; }\n\n    #stockActualCompactoWrap{\n      display:flex;\n      align-items:flex-start;\n      justify-content:center;\n      padding-top:18px;\n    }\n\n    #stockActualCompactoWrap .stock-box{\n      width:90%;\n      padding:18px;\n      text-align:center;\n      background:#eef6ff;\n      border-radius:8px;\n      font-size:14px;\n    }\n\n    #stockActualCompactoWrap .stock-box b{\n      display:block;\n      margin-top:8px;\n      color:#0057ff;\n      font-size:20px;\n    }\n\n    @media(max-width:1200px){\n      .sacos-layout-reportes{\n        grid-template-columns:1fr;\n      }\n      .sacos-movimiento-card,\n      .sacos-stock-card,\n      .sacos-zona-card,\n      .sacos-evol-total-card,\n      .sacos-evol-zona-card{\n        grid-column:1;\n      }\n      .resumen-sacos-compacto{\n        width:100%;\n      }\n    }\n\n  \n    /* ===== LAYOUT FINAL REPORTE DE SACOS ===== */\n    .reporte-sacos-principal{overflow:visible !important;}\n    .reporte-superior-final{\n      display:grid !important;\n      grid-template-columns:320px minmax(520px,1fr) 300px !important;\n      gap:14px !important;\n      align-items:stretch !important;\n      margin-top:8px !important;\n      margin-bottom:18px !important;\n    }\n    .reporte-superior-final > .card{margin:0 !important;min-width:0 !important;}\n    .resumen-sacos-final{padding:12px !important;}\n    .tabla-resumen-sacos-final{width:100% !important;min-width:0 !important;border-collapse:collapse !important;}\n    .tabla-resumen-sacos-final th,.tabla-resumen-sacos-final td{padding:8px 6px !important;font-size:12px !important;}\n    .tabla-resumen-sacos-final td:last-child{text-align:center !important;font-weight:700 !important;}\n    .movimiento-sacos-final{min-height:315px !important;}\n    .stock-sacos-final{min-height:315px !important;}\n    .stock-sacos-final .stock-tiempo-final{margin-top:10px !important;min-height:78px !important;}\n    .stock-tiempo-final{margin-top:16px !important;min-height:90px !important;display:flex !important;flex-direction:column !important;justify-content:center !important;align-items:center !important;}\n    .stock-tiempo-final strong{font-size:22px !important;margin-top:8px !important;}\n    .grafico-sacos-bloque{\n      display:block !important;\n      clear:both !important;\n      width:100% !important;\n      margin:0 0 20px 0 !important;\n      padding:14px !important;\n      box-sizing:border-box !important;\n      overflow:visible !important;\n      min-height:0 !important;\n    }\n    .grafico-sacos-bloque #chartZonasSacos{width:100% !important;min-height:420px !important;display:block !important;}\n    .grafico-sacos-bloque #chartEvolucionSalidaSacos{width:100% !important;height:390px !important;display:block !important;}\n    .evolucion-zona-card-final{margin-top:8px !important;}\n    .evolucion-zona-header-final{display:flex !important;justify-content:space-between !important;align-items:flex-end !important;gap:16px !important;margin-bottom:10px !important;}\n    .evolucion-zona-card-final #chartEvolucionZonaSacos{width:100% !important;height:430px !important;min-height:430px !important;display:block !important;overflow:visible !important;}\n    @media(max-width:1200px){\n      .reporte-superior-final{grid-template-columns:1fr !important;}\n      .resumen-sacos-final,.movimiento-sacos-final,.stock-sacos-final{width:100% !important;}\n    }\n\n  </style>\n<script>\n(function(){\n  function payloadFor(action,args){\n    if(args.length===1 && args[0] && typeof args[0]==='object' && !Array.isArray(args[0])) return args[0];\n    const maps={\n      buscarRazonSocialPorRuc:['ruc'],\n      buscarHistorialPorPlaca:['placa'],\n      obtenerAtencionPendiente:['idAtencion','usuario'],\n      obtenerDetalleRegistro:['idAtencion','idGuia'],\n      iniciarRevisionBD:['idAtencion','tipoRevision'],\n      obtenerIndicadores:['filtros','usuario'],\n      obtenerEvolucionIndicadoresMensual:['filtros','usuario'],\n      obtenerDetalleRevisionesResponsable:['filtros','responsable','usuario'],\n      obtenerReporteRangoSacosBD:['desde','hasta','tipoSaco'],\n      obtenerEvolucionMensualSacosBD:['hasta','cantidadMeses','tipoSaco'],\n      obtenerSalidasPorZonaSacosBD:['desde','hasta','tipoSaco'],\n      obtenerEvolucionMensualZonaFijaSacosBD:['zona','tipoSaco'],\n      obtenerCargoSacosBD:['cargo']\n    };\n    const keys=maps[action];\n    if(!keys) return args.length===1 ? args[0] : {args:args};\n    const p={}; keys.forEach(function(k,i){p[k]=args[i];}); return p;\n  }\n  function runner(success,failure){\n    return new Proxy({}, {get:function(_t,prop){\n      if(prop==='withSuccessHandler') return function(fn){return runner(fn,failure);};\n      if(prop==='withFailureHandler') return function(fn){return runner(success,fn);};\n      return function(){\n        const args=Array.prototype.slice.call(arguments);\n        fetch('/api/guias',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:String(prop),payload:payloadFor(String(prop),args)})})\n          .then(async function(r){const j=await r.json().catch(function(){return {ok:false,error:'Respuesta inválida de Registro de Guías.'};}); if(!r.ok||!j.ok) throw new Error(j.error||'No se pudo completar la operación.'); return j.data;})\n          .then(function(data){if(success) success(data);})\n          .catch(function(err){if(failure) failure(err); else console.error(err);});\n      };\n    }});\n  }\n  window.google=window.google||{};\n  window.google.script=window.google.script||{};\n  window.google.script.run=runner(null,null);\n  try{\n    const mainUser=JSON.parse(window.parent.localStorage.getItem('atencion_usuario_sesion_v1')||'null');\n    if(mainUser && mainUser.user){\n      sessionStorage.setItem('usuarioGuias',JSON.stringify({ok:true,usuario:mainUser.user,nombre:mainUser.name||mainUser.user,rol:String(mainUser.role||'').toUpperCase()==='ADMINISTRADOR'?'ADMIN':'REVISOR'}));\n    }\n  }catch(e){console.warn('No se pudo heredar la sesión principal.',e);}\n})();\n</script>\n<style>\n/* En la aplicación unificada se usa el login y cierre de sesión principal. */\n#login{display:none!important}.btn-salir{display:none!important}\n</style>\n</head>\n\n<body style=\"margin:0\">\n\n<div id=\"login\">\n  <div class=\"login-box\">\n    <h2>CONTROL DE GUÍAS</h2>\n    <p>AMS - Revisión de Guías</p>\n    <div id=\"loginError\" class=\"login-error\"></div>\n    <label>Usuario</label>\n    <input id=\"usuario\">\n    <br><br>\n    <label>Contraseña</label>\n    <input id=\"clave\" type=\"password\" onkeydown=\"if(event.key==='Enter'){login();}\">\n    <br><br>\n    <button class=\"btn-login\" onclick=\"login()\">INICIAR SESIÓN</button>\n  </div>\n</div>\n\n<div id=\"app\">\n  <aside class=\"sidebar\">\n    <div class=\"marca\"><h2>CONTROL DE<br>GUÍAS</h2><small>AMS</small></div>\n\n    <button id=\"menuRegistrar\" class=\"menu-btn activo\" onclick=\"mostrarPagina('registrar')\">📝 1. REGISTRAR</button>\n    <button id=\"menuHistorial\" class=\"menu-btn\" onclick=\"mostrarPagina('historial')\">📋 2. HISTORIAL DE REGISTROS</button>\n    <button id=\"menuIndicadores\" class=\"menu-btn\" onclick=\"mostrarPagina('indicadores')\">📊 3. INDICADORES</button>\n<button id=\"menuSacos\" class=\"menu-btn\" onclick=\"mostrarPagina('sacos')\">📦 4. REGISTRO DE SACOS MINEROS</button>\n    <div class=\"usuario-menu\">\n      <strong id=\"nombreUsuario\"></strong>\n      <div id=\"rolUsuario\"></div>\n      <button class=\"btn-salir\" onclick=\"cerrarSesion()\">SALIR</button>\n    </div>\n  </aside>\n\n  <main class=\"contenido\">\n    <header class=\"topbar\"><h1 id=\"tituloPagina\">REGISTRAR</h1></header>\n\n    <section id=\"paginaRegistrar\" class=\"pagina activa\">\n\n      <div class=\"card\">\n        <div class=\"titulo\">1. RECEPCIÓN DE GUÍAS</div>\n\n        <div class=\"grid5\">\n          <div><label>Placa *</label><input id=\"placa\" maxlength=\"7\"></div>\n          <div>\n            <label>Responsable de zona *</label>\n            <select id=\"acopiador\" onchange=\"cambiarAcopiadorPunto1()\">\n              <option value=\"\">Seleccione</option>\n            </select>\n          </div>\n          <div><label>Zona *</label><input id=\"zona\" placeholder=\"Ingrese zona\"></div>\n          <div>\n            <label>Guardia *</label>\n            <select id=\"guardia\"><option value=\"\">Seleccione</option><option>A</option><option>B</option><option>C</option></select>\n          </div>\n          <div>\n            <label>Turno *</label>\n            <select id=\"turno\"><option value=\"\">Seleccione</option><option>DÍA</option><option>NOCHE</option></select>\n          </div>\n        </div>\n\n        <div class=\"recepcion-guias\">\n          <div class=\"recepcion-guias-titulo\">GUÍAS RECEPCIONADAS</div>\n\n          <div class=\"tipo-box\">\n            <label id=\"tipoPublica\" class=\"tipo-opcion activo\">\n              <input type=\"radio\" name=\"tipoRevision\" value=\"PUBLICA\" checked onchange=\"cambiarTipo()\">\n              <strong>GUÍA PÚBLICA</strong><br><small>GRR + GRT</small>\n            </label>\n            <label id=\"tipoPrivada\" class=\"tipo-opcion\">\n              <input type=\"radio\" name=\"tipoRevision\" value=\"PRIVADA\" onchange=\"cambiarTipo()\">\n              <strong>GUÍA PRIVADA</strong><br><small>GRR + GRT</small>\n            </label>\n          </div>\n\n          <div class=\"guias-rec-grid\">\n            <div class=\"guia-rec-full rem\">\n              <strong>GUÍA DE REMISIÓN DEL REMITENTE — GRR <span class=\"opcional\">(independiente)</span></strong>\n              <div class=\"grid3\">\n                <div><label>Serie *</label><input id=\"grrSerie\" placeholder=\"Ej. EG07\"></div>\n                <div><label>Número *</label><input id=\"grrNumero\" placeholder=\"Ej. 000573\" maxlength=\"6\" inputmode=\"numeric\" oninput=\"this.value=this.value.replace(/\\D/g,'').slice(0,6)\" onblur=\"completarNumero6('grrNumero')\"></div>\n                <div><label>Tonelaje *</label><input id=\"grrTonelaje\" type=\"text\" inputmode=\"decimal\" placeholder=\"Ej. 5.5 o 5,5\"></div>\n                <div><label>RUC *</label><input id=\"grrRuc\" maxlength=\"11\" inputmode=\"numeric\" oninput=\"this.value=this.value.replace(/\\D/g,''); if(this.value.length===11) buscarRazonRecepcionRemitente();\"></div>\n                <div style=\"grid-column:span 2\"><label>Razón Social *</label><input id=\"grrRazon\"></div>\n                <div style=\"grid-column:1/-1\"><label>Observación <span class=\"opcional\">(opcional)</span></label><input id=\"grrObservacion\" placeholder=\"Observación opcional\"></div>\n              </div>\n            </div>\n\n            <div class=\"guia-rec-full tra\">\n              <strong>GUÍA DE REMISIÓN DEL TRANSPORTISTA — GRT <span class=\"opcional\">(independiente)</span></strong>\n              <div class=\"grid3\">\n                <div><label>Serie *</label><input id=\"grtSerie\" placeholder=\"Ej. EG03\"></div>\n                <div><label>Número *</label><input id=\"grtNumero\" placeholder=\"Ej. 000152\" maxlength=\"6\" inputmode=\"numeric\" oninput=\"this.value=this.value.replace(/\\D/g,'').slice(0,6)\" onblur=\"completarNumero6('grtNumero')\"></div>\n                <div><label>Tonelaje *</label><input id=\"grtTonelaje\" type=\"text\" inputmode=\"decimal\" placeholder=\"Ej. 12.75 o 12,75\"></div>\n                <div><label>RUC *</label><input id=\"grtRuc\" maxlength=\"11\" inputmode=\"numeric\" oninput=\"this.value=this.value.replace(/\\D/g,''); if(this.value.length===11) buscarRazonRecepcionTransportista();\"></div>\n                <div style=\"grid-column:span 2\"><label>Razón Social *</label><input id=\"grtRazon\"></div>\n                <div style=\"grid-column:1/-1\"><label>Observación <span class=\"opcional\">(opcional)</span></label><input id=\"grtObservacion\" placeholder=\"Observación opcional\"></div>\n              </div>\n            </div>\n          </div>\n        </div>\n\n        <div class=\"recepcion\">\n          <div>\n            <strong>RECEPCIÓN DE DOCUMENTOS</strong>\n            <div id=\"estadoRecepcion\" class=\"subestado\">Pendiente de recepción</div>\n          </div>\n          <button id=\"btnRecepcion\" class=\"btn verde\" onclick=\"recepcionar()\">RECEPCIONAR DOCUMENTOS</button>\n          <div><label>Fecha y hora de recepción</label><input id=\"fechaRecepcion\" readonly></div>\n        </div>\n      </div>\n\n      <div class=\"card\">\n        <div class=\"titulo\">2. REVISIÓN DE GUÍAS</div>\n\n        <div class=\"revision-accion\">\n          <button id=\"btnInicio\" class=\"btn azul\" onclick=\"iniciarRevision()\">▶ INICIAR REVISIÓN</button>\n          <div class=\"fecha-accion\"><label>Fecha y hora de inicio de revisión</label><input id=\"fechaInicio\" readonly></div>\n        </div>\n\n        <div class=\"grid2\">\n          <div class=\"guia-card remitente\">\n            <div class=\"guia-titulo\">GUÍA DE REMISIÓN DEL REMITENTE</div>\n            <div class=\"grid3\">\n              <div><label>Tipo *</label><select id=\"tipoR\"><option>GRR</option></select></div>\n              <div><label>Serie *</label><input id=\"serieR\"></div>\n              <div><label>Número *</label><input id=\"numeroR\" maxlength=\"6\" inputmode=\"numeric\" oninput=\"this.value=this.value.replace(/\\D/g,'').slice(0,6)\" onblur=\"completarNumero6('numeroR')\"></div>\n              <div><label>Tonelaje *</label><input id=\"tonelajeR\" type=\"text\" inputmode=\"decimal\"></div>\n              <div><label>RUC *</label><input id=\"rucR\" maxlength=\"11\" inputmode=\"numeric\" oninput=\"this.value=this.value.replace(/\\D/g,''); if(this.value.length===11) buscarRazonRemitente();\"></div>\n              <div><label>Razón Social *</label><input id=\"razonR\"></div>\n              <div style=\"grid-column:1/-1\"><label>Observación <span class=\"opcional\">(opcional)</span></label><input id=\"observacionR\"></div>\n            </div>\n          </div>\n\n          <div id=\"bloqueTransportista\" class=\"guia-card transportista\">\n            <div class=\"guia-titulo\">GUÍA DE REMISIÓN DEL TRANSPORTISTA</div>\n            <div class=\"grid3\">\n              <div><label>Tipo *</label><select id=\"tipoT\"><option>GRT</option></select></div>\n              <div><label>Serie *</label><input id=\"serieT\"></div>\n              <div><label>Número *</label><input id=\"numeroT\" maxlength=\"6\" inputmode=\"numeric\" oninput=\"this.value=this.value.replace(/\\D/g,'').slice(0,6)\" onblur=\"completarNumero6('numeroT')\"></div>\n              <div><label>Tonelaje *</label><input id=\"tonelajeT\" type=\"text\" inputmode=\"decimal\"></div>\n              <div><label>RUC *</label><input id=\"rucT\" maxlength=\"11\" inputmode=\"numeric\" oninput=\"this.value=this.value.replace(/\\D/g,''); if(this.value.length===11) buscarRazonTransportista();\"></div>\n              <div><label>Razón Social *</label><input id=\"razonT\"></div>\n              <div style=\"grid-column:1/-1\"><label>Observación <span class=\"opcional\">(opcional)</span></label><input id=\"observacionT\"></div>\n            </div>\n\n            <div class=\"revision-accion\" style=\"justify-content:flex-end;margin-top:14px\">\n              <button id=\"btnFinal\" class=\"btn naranja\" onclick=\"finalizarRevision()\">■ FINALIZAR REVISIÓN</button>\n              <div class=\"fecha-accion\"><label>Fecha y hora de finalización</label><input id=\"fechaFinal\" readonly></div>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      <div class=\"card\">\n        <div class=\"titulo\">3. CONTROL DE TIEMPOS</div>\n\n        <div class=\"grid3\">\n          <div><label>Recepción</label><input id=\"tiempoFechaRecepcion\" readonly></div>\n        </div>\n\n        <div class=\"tiempos\">\n          <div class=\"tiempo\">TIEMPO DE ESPERA<strong id=\"tiempoEspera\">00:00:00</strong><small>Inicio revisión − Recepción</small></div>\n          <div class=\"tiempo\">TIEMPO DE REVISIÓN<strong id=\"tiempoRevision\">00:00:00</strong><small>Final revisión − Inicio revisión</small></div>\n        </div>\n\n        <div class=\"guardar-nuevo\">\n          <button id=\"btnGuardarNuevo\" class=\"btn verde\" onclick=\"guardarYNuevoRegistro()\" disabled>💾 GUARDAR Y NUEVO REGISTRO</button>\n        </div>\n      </div>\n\n    </section>\n\n    <section id=\"paginaHistorial\" class=\"pagina\">\n      <div class=\"card\">\n        <div class=\"titulo\">HISTORIAL DE REGISTROS</div>\n\n        <div class=\"busqueda\">\n          <div><label>🔎 Buscar por placa</label><input id=\"buscarPlaca\" maxlength=\"7\" onkeydown=\"if(event.key==='Enter'){cargarHistorial();}\"></div>\n          <button class=\"btn azul\" onclick=\"cargarHistorial()\">BUSCAR</button>\n          <button class=\"btn gris\" onclick=\"limpiarBusquedaHistorial()\">LIMPIAR</button>\n        </div>\n\n        <div class=\"tabla-wrap\">\n          <table>\n            <thead>\n              <tr>\n                <th>ID Atención</th>\n                <th>Fecha</th>\n                <th>Placa</th>\n                <th>Revisión</th>\n                <th>Clase guía</th>\n                <th>Tipo</th>\n                <th>Serie</th>\n                <th>Número</th>\n                <th>Razón Social</th>\n                <th>Tonelaje</th>\n                <th>Responsable</th>\n                <th>Estado</th>\n                <th>Reemplazo</th>\n                <th>Acciones</th>\n              </tr>\n            </thead>\n            <tbody id=\"cuerpoHistorial\"><tr><td colspan=\"14\">Sin registros</td></tr></tbody>\n          </table>\n        </div>\n      </div>\n    </section>\n\n    <section id=\"paginaIndicadores\" class=\"pagina\">\n      <div class=\"card\">\n        <div class=\"titulo\">INDICADORES DE REVISIÓN DE GUÍAS</div>\n        <div class=\"filtros\">\n          <div><label>Desde</label><input id=\"fDesde\" type=\"date\"></div>\n          <div><label>Hasta</label><input id=\"fHasta\" type=\"date\"></div>\n          <div><label>Guardia</label><select id=\"fGuardia\"><option value=\"\">Todas</option><option>A</option><option>B</option><option>C</option></select></div>\n          <div><label>Turno</label><select id=\"fTurno\"><option value=\"\">Todos</option><option>DÍA</option><option>NOCHE</option></select></div>\n          <div><label>Responsable</label><input id=\"fResponsable\"></div>\n        </div>\n        <br>\n        <button class=\"btn azul\" onclick=\"cargarIndicadores()\">ACTUALIZAR INDICADORES</button>\n      </div>\n\n      <div class=\"kpis\">\n        <div class=\"kpi\">Guías finalizadas<strong id=\"kFinalizadas\">0</strong></div>\n        <div class=\"kpi\">Guías pendientes<strong id=\"kPendientes\">0</strong></div>\n        <div class=\"kpi\">Guías anuladas<strong id=\"kAnuladas\">0</strong></div>\n        <div class=\"kpi\">Promedio espera<strong id=\"kEspera\">00:00:00</strong></div>\n        <div class=\"kpi\">Promedio revisión<strong id=\"kRevision\">00:00:00</strong></div>\n      </div>\n\n      <div class=\"charts-indicadores\">\n        <div class=\"card\">\n          <div id=\"chartUsuarios\" class=\"chart\"></div>\n        </div>\n\n        <div class=\"card\">\n          <div id=\"chartRevisionUsuarios\" class=\"chart\"></div>\n        </div>\n\n        <div class=\"card chart-wide\">\n          <div id=\"chartEvolucionGuiasMes\" class=\"chart chart-linea-ancha\"></div>\n        </div>\n\n        <div class=\"card chart-wide\">\n          <div id=\"chartEvolucionGuiasResponsable\" class=\"chart chart-linea-ancha\"></div>\n        </div>\n\n        <div class=\"card chart-wide\">\n          <div id=\"chartEvolucionTiempoResponsable\" class=\"chart chart-linea-ancha\"></div>\n        </div>\n      </div>\n\n\n      <!-- ===================================================== -->\n      <!-- DETALLE DE REVISIONES POR RESPONSABLE                 -->\n      <!-- ===================================================== -->\n      <div id=\"detalleResponsableCard\" class=\"card\">\n        <div id=\"tituloDetalleResponsable\" class=\"titulo\">DETALLE DE REVISIONES</div>\n\n        <div id=\"mensajeDetalleResponsable\"\n             style=\"padding:18px;text-align:center;color:#64748b;font-size:13px;\">\n          Haga clic en una barra del gráfico \"Tiempo promedio de revisión por responsable\".\n        </div>\n\n        <div id=\"contenidoDetalleResponsable\" style=\"display:none;\">\n          <div id=\"resumenDetalleResponsable\"\n               style=\"margin-bottom:12px;padding:10px 12px;background:#eef6ff;border-radius:7px;font-weight:bold;color:#0b416e;\">\n          </div>\n\n          <div class=\"tabla-wrap\">\n            <table style=\"min-width:1050px\">\n              <thead>\n                <tr>\n                  <th>N°</th>\n                  <th>Fecha recepción</th>\n                  <th>Placa</th>\n                  <th>Guardia</th>\n                  <th>Turno</th>\n                  <th>Tipo revisión</th>\n                  <th>Inicio revisión</th>\n                  <th>Final revisión</th>\n                  <th>Tiempo total</th>\n                  <th>Tiempo efectivo</th>\n                  <th>Nivel</th>\n                  <th>Observación</th>\n                </tr>\n              </thead>\n              <tbody id=\"tablaDetalleResponsable\">\n                <tr><td colspan=\"12\">Sin datos</td></tr>\n              </tbody>\n            </table>\n          </div>\n        </div>\n      </div>\n\n      <div class=\"card\">\n        <div class=\"titulo\">RANKING POR TIEMPO DE REVISIÓN</div>\n        <div class=\"tabla-wrap\">\n          <table style=\"min-width:750px\">\n            <thead><tr><th>Responsable</th><th>Guías</th><th>Promedio espera</th><th>Promedio revisión</th><th>Comparación</th></tr></thead>\n            <tbody id=\"rankingUsuarios\"><tr><td colspan=\"5\">Sin datos</td></tr></tbody>\n          </table>\n        </div>\n      </div>\n    </section>\n<!-- ===================================================== -->\n<!-- 4. REGISTRO DE SACOS MINEROS                         -->\n<!-- ===================================================== -->\n<section id=\"paginaSacos\" class=\"pagina\">\n\n  <div class=\"card\">\n    <div class=\"titulo\">1. DATOS GENERALES</div>\n\n    <div class=\"sacos-selector\">\n      <button id=\"btnTipoIngresoSaco\" class=\"btn verde\" onclick=\"seleccionarTipoSaco('INGRESO')\">📥 INGRESO</button>\n      <button id=\"btnTipoSalidaSaco\" class=\"btn gris\" onclick=\"seleccionarTipoSaco('SALIDA')\">📤 SALIDA</button>\n    </div>\n\n    <!-- INGRESO -->\n    <div id=\"formIngresoSaco\">\n      <div class=\"grid5\">\n        <div><label>Fecha y hora</label><input id=\"sacoIngresoFecha\" readonly></div>\n        <div><label>Responsable *</label><input id=\"sacoIngresoResponsable\" placeholder=\"Ingrese responsable\"></div>\n        <div>\n          <label>Descripción *</label>\n          <select id=\"sacoIngresoDescripcion\">\n            <option value=\"\">Seleccione</option>\n            <option value=\"SACOS AMARILLOS\">SACOS AMARILLOS</option>\n            <option value=\"SACOS BLANCOS\">SACOS BLANCOS</option>\n            <option value=\"BOLSAS\">BOLSAS</option>\n          </select>\n        </div>\n        <div><label>Cantidad *</label><input id=\"sacoIngresoCantidad\" type=\"number\" min=\"1\" step=\"1\"></div>\n        <div>\n          <label>Unidad *</label>\n          <select id=\"sacoIngresoUnidad\"><option value=\"UND\">UND</option><option value=\"PAQUETE\">PAQUETE</option></select>\n        </div>\n      </div>\n      <div style=\"margin-top:14px;text-align:right\"><button class=\"btn verde\" onclick=\"registrarIngresoSaco()\">💾 REGISTRAR INGRESO</button></div>\n    </div>\n\n    <!-- SALIDA: un solo cargo con varios materiales -->\n    <div id=\"formSalidaSaco\" class=\"oculto\">\n      <div class=\"sacos-salida-layout\">\n        <div>\n          <div><label>Fecha y hora</label><input id=\"sacoSalidaFecha\" readonly></div><br>\n          <div>\n            <label>Responsable de zona *</label>\n            <select id=\"sacoSalidaAcopiador\" onchange=\"cambiarResponsableZonaSacos()\" onchange=\"cambiarAcopiadorSaco()\"><option value=\"\">Seleccione</option></select>\n          </div>\n<div><label>Zona *</label><input id=\"sacoSalidaZona\" readonly placeholder=\"Se completa automáticamente\"></div>\n<br>\n          <br>\n          <div><label>ENTREGADO A *</label><input id=\"sacoSalidaDestinatario\" placeholder=\"Ingrese nombre de quien recibe\"></div><br>\n          <div><label>Placa (unidad de transporte) *</label><input id=\"sacoSalidaPlaca\" maxlength=\"10\" placeholder=\"Ej. ASV-850\"></div><br>\n        </div>\n\n        <div class=\"sacos-detalle-box\">\n          <div class=\"titulo\" style=\"margin-bottom:10px\">DETALLE DE MATERIALES — UN SOLO CARGO</div>\n          <div class=\"sacos-detalle-head\"><div>Descripción</div><div>Cantidad</div><div>Unidad</div><div></div></div>\n          <div id=\"listaDetalleSalidaSacos\"><div class=\"sacos-help\">Agregue uno o varios materiales para esta salida.</div></div>\n\n          <div class=\"sacos-agregar\">\n            <div>\n              <label>Descripción</label>\n              <select id=\"nuevoMaterialSaco\">\n                <option value=\"\">Seleccione</option>\n                <option value=\"SACOS AMARILLOS\">SACOS AMARILLOS</option>\n                <option value=\"SACOS BLANCOS\">SACOS BLANCOS</option>\n                <option value=\"BOLSAS\">BOLSAS</option>\n              </select>\n            </div>\n            <div><label>Cantidad</label><input id=\"nuevaCantidadSaco\" type=\"number\" min=\"1\" step=\"1\"></div>\n            <div><label>Unidad</label><select id=\"nuevaUnidadSaco\"><option value=\"UND\">UND</option><option value=\"PAQUETE\">PAQUETE</option></select></div>\n            <button class=\"btn azul\" onclick=\"agregarDetalleSalidaSaco()\">+ AGREGAR</button>\n          </div>\n\n          <div style=\"margin-top:15px;text-align:right\">\n            <button class=\"btn verde\" onclick=\"registrarSalidaSaco()\">💾 REGISTRAR SALIDA (UN SOLO CARGO)</button>\n          </div>\n        </div>\n      </div>\n    </div>\n  </div>\n\n  <!-- Se conserva numeración solicitada -->\n  <div class=\"card\">\n    <div class=\"titulo\">2. REGISTRO GENERAL</div>\n    <div style=\"display:flex;gap:9px;align-items:end;flex-wrap:wrap;margin-bottom:12px\">\n      <div><label>Desde</label><input id=\"sacoFiltroDesde\" type=\"date\"></div>\n      <div><label>Hasta</label><input id=\"sacoFiltroHasta\" type=\"date\"></div>\n      <button class=\"btn azul\" onclick=\"filtrarRegistroSacos()\">🔎 FILTRAR</button>\n      <button class=\"btn gris\" onclick=\"limpiarFiltroSacos()\">LIMPIAR</button>\n    </div>\n    <div class=\"tabla-wrap registro-sacos-scroll\">\n      <table class=\"tabla-registro-sacos\" style=\"min-width:1850px\">\n        <thead><tr>\n          <th>N°</th><th>N° CARGO</th><th>USUARIO</th><th>FECHA Y HORA</th><th>TIPO</th><th>DESCRIPCIÓN</th><th>CANTIDAD</th><th>UNIDAD</th><th>RESPONSABLE</th><th>ZONA</th><th>RESPONSABLE DE ZONA</th><th>ENTREGADO A</th><th>PLACA</th><th>ACCIONES</th>\n        </tr></thead>\n        <tbody id=\"cuerpoRegistroSacos\"><tr><td colspan=\"14\">Sin registros</td></tr></tbody>\n      </table>\n    </div>\n  </div>\n\n  <div class=\"card reporte-sacos-principal\">\n    <div id=\"tituloReporteSacos\" class=\"titulo\">3. REPORTE DE SACOS</div>\n\n    <div style=\"display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:10px\">\n\n  <div>\n    <label>Tipo de saco</label>\n    <select id=\"sacoReporteTipo\">\n      <option value=\"SACOS AMARILLOS\">SACOS AMARILLOS</option>\n      <option value=\"SACOS BLANCOS\">SACOS BLANCOS</option>\n    </select>\n  </div>\n\n  <div>\n    <label>Desde</label>\n    <input id=\"sacoReporteDesde\" type=\"date\">\n  </div>\n\n  <div>\n    <label>Hasta</label>\n    <input id=\"sacoReporteHasta\" type=\"date\">\n  </div>\n\n  <button class=\"btn azul\" onclick=\"cargarReporteMensualSacos()\">\n    CONSULTAR\n  </button>\n\n  <button class=\"btn gris\" onclick=\"limpiarFiltroReporteSacos()\">\n    LIMPIAR\n  </button>\n\n</div>\n\n    <div id=\"ayudaReporteSacos\" class=\"sacos-help\" style=\"margin-bottom:10px\">Seleccione el tipo de saco y el rango de fechas para consultar el reporte.</div>\n\n    <!-- FILA 1: RESUMEN + MOVIMIENTO + STOCK -->\n    <div class=\"reporte-superior-final\">\n      <div class=\"card resumen-sacos-final\">\n        <div class=\"titulo\">RESUMEN</div>\n        <table class=\"tabla-resumen-sacos-final\">\n          <thead><tr><th>CONCEPTO</th><th>SACOS</th></tr></thead>\n          <tbody>\n            <tr><td>STOCK INICIAL</td><td id=\"repStockInicialAmarillo\">0</td></tr>\n            <tr><td>INGRESO</td><td id=\"repIngresoAmarillo\">0</td></tr>\n            <tr><td>SALIDA</td><td id=\"repSalidaAmarillo\">0</td></tr>\n            <tr><td>STOCK FINAL</td><td id=\"repStockAmarillo\">0</td></tr>\n          </tbody>\n        </table>\n      </div>\n\n      <div class=\"card movimiento-sacos-final\">\n        <div id=\"tituloMovimientoSacos\" class=\"titulo\">MOVIMIENTO DE SACOS AMARILLOS</div>\n        <div id=\"chartStockAmarillosSacos\" class=\"sacos-chart\"></div>\n      </div>\n\n      <div class=\"card stock-sacos-final\">\n        <div id=\"tituloStockActualSacos\" class=\"titulo\">\n          STOCK ACTUAL\n        </div>\n\n        <div class=\"tiempo stock-tiempo-final\">\n          <span id=\"nombreStockActualSacos\">SACOS AMARILLOS</span>\n          <strong id=\"stockActualSeleccionado\">0</strong>\n        </div>\n      </div>\n    </div>\n\n    <!-- FILA 2: BARRAS POR ZONA; ESTE SÍ RESPONDE A DESDE/HASTA -->\n    <div class=\"card grafico-sacos-bloque\">\n      <div id=\"tituloZonasSacos\" class=\"titulo\">SALIDAS DE SACOS AMARILLOS POR ZONA</div>\n      <div id=\"chartZonasSacos\"></div>\n    </div>\n\n    <!-- FILA 3: EVOLUCIÓN MENSUAL TOTAL; FIJO -->\n    <div class=\"card grafico-sacos-bloque\">\n      <div class=\"titulo\">EVOLUCIÓN MENSUAL DE SALIDAS — SACOS AMARILLOS</div>\n      <div class=\"sacos-help\">Gráfico histórico fijo. No cambia al usar el filtro Desde/Hasta.</div>\n      <div id=\"chartEvolucionSalidaSacos\" class=\"sacos-chart-wide\"></div>\n    </div>\n\n    <!-- FILA 4: EVOLUCIÓN MENSUAL POR UNA ZONA; FIJO -->\n    <div class=\"card grafico-sacos-bloque evolucion-zona-card-final\">\n      <div class=\"evolucion-zona-header-final\">\n        <div>\n          <div class=\"titulo\">EVOLUCIÓN MENSUAL DE SALIDAS POR ZONA — SACOS AMARILLOS</div>\n          <div class=\"sacos-help\">Gráfico histórico fijo. No cambia al usar el filtro Desde/Hasta.</div>\n        </div>\n        <div class=\"evolucion-zona-filtro\">\n          <label for=\"filtroZonaEvolucionSacos\">Zona</label>\n          <select id=\"filtroZonaEvolucionSacos\" onchange=\"cambiarZonaEvolucionSacos()\">\n            <option value=\"CHALA\">CHALA</option>\n          </select>\n        </div>\n      </div>\n      <div id=\"chartEvolucionZonaSacos\" class=\"chart-evolucion-zona-fija\"></div>\n    </div>\n  </div>\n</section>\n  </main>\n</div>\n\n<!-- MODAL VISUALIZAR -->\n<div id=\"modalVer\" class=\"modal-fondo\">\n  <div class=\"modal\">\n    <h3>DETALLE DEL REGISTRO</h3>\n    <div id=\"contenidoDetalle\" class=\"detalle\"></div>\n    <div class=\"modal-acciones\"><button class=\"btn gris\" onclick=\"cerrarModal('modalVer')\">CERRAR</button></div>\n  </div>\n</div>\n\n<!-- MODAL ANULAR -->\n<div id=\"modalAnular\" class=\"modal-fondo\">\n  <div class=\"modal\">\n    <h3>ANULAR GUÍA</h3>\n    <input type=\"hidden\" id=\"anularIdGuia\">\n\n    <label>Motivo de anulación *</label>\n    <select id=\"motivoAnulacionSelect\">\n      <option value=\"\">Seleccione</option>\n      <option value=\"ERROR EN DATOS\">ERROR EN DATOS</option>\n      <option value=\"ERROR EN RUC\">ERROR EN RUC</option>\n      <option value=\"ERROR EN RAZON SOCIAL\">ERROR EN RAZÓN SOCIAL</option>\n      <option value=\"ERROR EN SERIE O NUMERO\">ERROR EN SERIE O NÚMERO</option>\n      <option value=\"ERROR EN TONELAJE\">ERROR EN TONELAJE</option>\n      <option value=\"DOCUMENTO DUPLICADO\">DOCUMENTO DUPLICADO</option>\n      <option value=\"OTRO\">OTRO</option>\n    </select>\n\n    <br><br>\n    <label>Detalle / observación</label>\n    <textarea id=\"detalleAnulacion\" placeholder=\"Detalle adicional...\"></textarea>\n\n    <div class=\"modal-acciones\">\n      <button class=\"btn gris\" onclick=\"cerrarModal('modalAnular')\">CANCELAR</button>\n      <button class=\"btn rojo\" onclick=\"confirmarAnulacion()\">CONFIRMAR ANULACIÓN</button>\n    </div>\n  </div>\n</div>\n\n<!-- MODAL REEMPLAZAR -->\n<div id=\"modalReemplazar\" class=\"modal-fondo\">\n  <div class=\"modal\">\n    <h3>REEMPLAZAR GUÍA ANULADA</h3>\n    <input type=\"hidden\" id=\"reemplazoIdOriginal\">\n\n    <div class=\"detalle\" id=\"detalleGuiaAnulada\"></div>\n\n    <div class=\"grid2\">\n      <div><label>Tipo *</label><select id=\"reemplazoTipo\"><option>GRR</option><option>GRT</option></select></div>\n      <div><label>Serie *</label><input id=\"reemplazoSerie\"></div>\n      <div><label>Número *</label><input id=\"reemplazoNumero\" maxlength=\"6\" inputmode=\"numeric\" oninput=\"this.value=this.value.replace(/\\D/g,'').slice(0,6)\" onblur=\"completarNumero6('reemplazoNumero')\"></div>\n      <div><label>Tonelaje *</label><input id=\"reemplazoTonelaje\" type=\"text\" inputmode=\"decimal\"></div>\n     <div>\n  <label>RUC *</label>\n  <input\n    id=\"reemplazoRuc\"\n    maxlength=\"11\"\n    inputmode=\"numeric\"\n    oninput=\"this.value=this.value.replace(/\\D/g,''); if(this.value.length===11) buscarRazonReemplazo();\">\n</div>\n      <div><label>Razón Social *</label><input id=\"reemplazoRazon\"></div>\n    </div>\n\n    <br>\n    <label>Motivo / observación del reemplazo</label>\n    <textarea id=\"motivoReemplazo\"></textarea>\n\n    <div class=\"modal-acciones\">\n      <button class=\"btn gris\" onclick=\"cerrarModal('modalReemplazar')\">CANCELAR</button>\n      <button class=\"btn morado\" onclick=\"confirmarReemplazo()\">REGISTRAR REEMPLAZO</button>\n    </div>\n  </div>\n</div>\n<!-- ===================================================== -->\n<!-- MODAL MOVIMIENTO SACOS                               -->\n<!-- ===================================================== -->\n<div id=\"modalSacos\" class=\"modal-fondo\">\n  <div class=\"modal\">\n    <h3 id=\"tituloModalSacos\">DETALLE DEL MOVIMIENTO</h3>\n    <input type=\"hidden\" id=\"sacoModalId\">\n    <div class=\"grid2\">\n      <div><label>N° Cargo *</label><input id=\"sacoModalCargo\" readonly required></div>\n      <div><label>Fecha y hora *</label><input id=\"sacoModalFecha\" readonly required></div>\n      <div><label>Tipo *</label><select id=\"sacoModalTipo\" required><option value=\"INGRESO\">INGRESO</option><option value=\"SALIDA\">SALIDA</option></select></div>\n      <div><label>Descripción *</label><select id=\"sacoModalDescripcion\" required><option value=\"SACOS AMARILLOS\">SACOS AMARILLOS</option><option value=\"SACOS BLANCOS\">SACOS BLANCOS</option><option value=\"BOLSAS\">BOLSAS</option></select></div>\n      <div><label>Cantidad *</label><input id=\"sacoModalCantidad\" type=\"number\" min=\"1\" required></div>\n      <div><label>Unidad *</label><select id=\"sacoModalUnidad\" required><option value=\"UND\">UND</option><option value=\"PAQUETE\">PAQUETE</option></select></div>\n      <div><label>Responsable *</label><input id=\"sacoModalResponsable\" required></div>\n      <div><label>Zona *</label><input id=\"sacoModalZona\" required></div>\n      <div><label>Responsable de zona *</label><input id=\"sacoModalAcopiador\" required></div>\n      <div><label>ENTREGADO A *</label><input id=\"sacoModalDestinatario\" required></div>\n      <div><label>Placa *</label><input id=\"sacoModalPlaca\" required></div>\n      <div style=\"grid-column:1/-1\"><label>Observación <span class=\"opcional\">(opcional)</span></label><input id=\"sacoModalObservacion\"></div>\n    </div>\n    <div class=\"modal-acciones\">\n      <button class=\"btn gris\" onclick=\"cerrarModal('modalSacos')\">CERRAR</button>\n      <button id=\"btnGuardarEdicionSaco\" class=\"btn azul\" onclick=\"guardarEdicionSaco()\">💾 GUARDAR CAMBIOS</button>\n    </div>\n  </div>\n</div>\n<script>\nlet USUARIO = null;\nlet ID_ATENCION = null;\nlet RECEPCION_MS = 0;\nlet INICIO_MS = 0;\nlet FINAL_MS = 0;\nlet TIMER_BORRADOR = null;\nlet EVENTOS_ACTIVADOS = false;\nlet EDITANDO_FINALIZADO = false;\n\ngoogle.charts.load('current',{packages:['corechart','bar']});\n\n\n// =====================================================\n// AUTOCOMPLETAR RAZÓN SOCIAL POR RUC\n// Hoja: BD RAZON SOCIAL | A = RUC | B = RAZON SOCIAL\n// =====================================================\n\nfunction buscarRazonRemitente(){\n  buscarRazonSocialEnApp('rucR','razonR');\n}\n\nfunction buscarRazonTransportista(){\n  buscarRazonSocialEnApp('rucT','razonT');\n}\n\nfunction buscarRazonRecepcionRemitente(){\n  buscarRazonSocialEnApp('grrRuc','grrRazon');\n}\n\nfunction buscarRazonRecepcionTransportista(){\n  buscarRazonSocialEnApp('grtRuc','grtRazon');\n}\nfunction buscarRazonReemplazo(){\n  buscarRazonSocialEnApp('reemplazoRuc','reemplazoRazon');\n}\n\nfunction buscarRazonSocialEnApp(idRuc,idRazon){\n  const ruc = valor(idRuc).replace(/\\D/g,'');\n  const campo = document.getElementById(idRazon);\n\n  if(ruc.length !== 11){\n    return;\n  }\n\n  campo.disabled = true;\n  campo.value = 'BUSCANDO...';\n\n  google.script.run\n    .withSuccessHandler(function(r){\n      campo.disabled = false;\n\n      if(r && r.ok && r.razonSocial){\n        setValor(idRazon,r.razonSocial);\n        programarGuardadoBorrador();\n        return;\n      }\n\n      setValor(idRazon,'');\n      alert((r && r.mensaje) ? r.mensaje : 'RUC no encontrado en BD RAZON SOCIAL.');\n      campo.focus();\n    })\n    .withFailureHandler(function(error){\n      campo.disabled = false;\n      setValor(idRazon,'');\n      alert('Error al buscar el RUC: ' + ((error && error.message) || error));\n    })\n    .buscarRazonSocialPorRuc(ruc);\n}\n\n// ======================================================\n// LOGIN\n// ======================================================\n\nfunction login(){\n  const usuario = valor('usuario');\n  const clave = valor('clave');\n  const error = document.getElementById('loginError');\n\n  error.style.display = 'none';\n\n  if(!usuario || !clave){\n    error.innerText = 'Ingrese usuario y contraseña.';\n    error.style.display = 'block';\n    return;\n  }\n\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok){\n        error.innerText = (r && r.mensaje) ? r.mensaje : 'No se pudo iniciar sesión.';\n        error.style.display = 'block';\n        return;\n      }\n\n      USUARIO = r;\n      sessionStorage.setItem('usuarioGuias',JSON.stringify(r));\n      entrarApp();\n    })\n    .withFailureHandler(function(e){\n      error.innerText = 'Error de conexión: ' + ((e && e.message) || e);\n      error.style.display = 'block';\n    })\n    .validarLogin(usuario,clave);\n}\n\nfunction entrarApp(){\n  document.getElementById('login').style.display = 'none';\n  document.getElementById('app').style.display = 'block';\n  document.getElementById('nombreUsuario').innerText = USUARIO.nombre || '';\n  document.getElementById('rolUsuario').innerText = USUARIO.rol || '';\n  document.getElementById('menuIndicadores').style.display = USUARIO.rol === 'ADMIN' ? 'block' : 'none';\n  cargarAcopiadoresGenerales();\n\n  if(!EVENTOS_ACTIVADOS){\n    activarEnterSiguiente();\n    activarGuardadoAutomatico();\n    EVENTOS_ACTIVADOS = true;\n  }\n}\n\nwindow.addEventListener('load',function(){\n  const s = sessionStorage.getItem('usuarioGuias');\n  if(!s) return;\n\n  try{\n    USUARIO = JSON.parse(s);\n    entrarApp();\n  }catch(e){\n    sessionStorage.removeItem('usuarioGuias');\n  }\n});\n\nfunction cerrarSesion(){\n  sessionStorage.removeItem('usuarioGuias');\n  location.reload();\n}\n\n// ======================================================\n// ENTER -> SIGUIENTE CAMPO\n// ======================================================\n\nfunction activarEnterSiguiente(){\n  document.addEventListener('keydown',function(e){\n    if(e.key !== 'Enter') return;\n\n    const actual = e.target;\n    if(actual.tagName === 'TEXTAREA') return;\n    if(!actual.matches('input, select')) return;\n    if(actual.id === 'usuario' || actual.id === 'clave' || actual.id === 'buscarPlaca') return;\n\n    e.preventDefault();\n\n    const campos = Array.from(document.querySelectorAll(\n      '#paginaRegistrar input:not([type=\"hidden\"]):not([readonly]), #paginaRegistrar select'\n    )).filter(function(el){\n      return !el.disabled && el.offsetParent !== null;\n    });\n\n    const i = campos.indexOf(actual);\n    if(i >= 0 && i < campos.length-1) campos[i+1].focus();\n  });\n}\n\n// ======================================================\n// AUTOGUARDADO\n// ======================================================\n\nfunction activarGuardadoAutomatico(){\n  const ids = [\n    'placa','acopiador','zona','guardia','turno',\n    'grrSerie','grrNumero','grrTonelaje','grrRuc','grrRazon','grrObservacion',\n    'grtSerie','grtNumero','grtTonelaje','grtRuc','grtRazon','grtObservacion',\n    'tipoR','serieR','numeroR','tonelajeR','rucR','razonR','observacionR',\n    'tipoT','serieT','numeroT','tonelajeT','rucT','razonT','observacionT'\n  ];\n\n  ids.forEach(function(id){\n    const campo = document.getElementById(id);\n    if(!campo) return;\n    campo.addEventListener('input',programarGuardadoBorrador);\n    campo.addEventListener('change',programarGuardadoBorrador);\n  });\n\n  document.querySelectorAll('input[name=\"tipoRevision\"]').forEach(function(radio){\n    radio.addEventListener('change',programarGuardadoBorrador);\n  });\n}\n\nfunction programarGuardadoBorrador(){\n  if(!ID_ATENCION || FINAL_MS || EDITANDO_FINALIZADO) return;\n  clearTimeout(TIMER_BORRADOR);\n  TIMER_BORRADOR = setTimeout(guardarBorradorActual,700);\n}\n\nfunction guardarBorradorActual(){\n  if(!ID_ATENCION || FINAL_MS || EDITANDO_FINALIZADO) return;\n  if(esIdOffline_(ID_ATENCION) || !navigator.onLine){\n    const reg=buscarOffline_(ID_ATENCION); if(reg){ reg.datos=datosFormularioActual(); upsertOffline_(reg); }\n    return;\n  }\n\n  google.script.run\n    .withFailureHandler(function(e){\n      console.error('No se pudo guardar borrador',e);\n    })\n    .guardarBorradorPendiente(datosFormularioActual());\n}\n\n\nfunction datosFormularioActual(){\n\n  // Antes de INICIAR REVISIÓN, los datos oficiales están ARRIBA.\n  // Después de iniciar, el borrador usa los campos de REVISIÓN de abajo.\n  const revisionIniciada = !!INICIO_MS || EDITANDO_FINALIZADO;\n\n  return {\n    idAtencion:ID_ATENCION,\n    usuario:USUARIO ? USUARIO.usuario : '',\n    placa:valor('placa'),\n    acopiador:valor('acopiador'),\n    zona:valor('zona'),\n    guardia:valor('guardia'),\n    turno:valor('turno'),\n    grrSerie:valor('grrSerie'),\n    grrNumero:valor('grrNumero'),\n    grtSerie:valor('grtSerie'),\n    grtNumero:valor('grtNumero'),\n    tipoRevision:obtenerTipoRevision(),\n\n    remitente: revisionIniciada ? {\n      tipo:'GRR',\n      serie:valor('serieR'),\n      numero:valor('numeroR'),\n      tonelaje:normalizarDecimalApp_(valor('tonelajeR')),\n      ruc:valor('rucR'),\n      razonSocial:valor('razonR'),\n      observacion:valor('observacionR')\n    } : {\n      tipo:'GRR',\n      serie:valor('grrSerie'),\n      numero:valor('grrNumero'),\n      tonelaje:normalizarDecimalApp_(valor('grrTonelaje')),\n      ruc:valor('grrRuc'),\n      razonSocial:valor('grrRazon'),\n      observacion:valor('grrObservacion')\n    },\n\n    transportista: revisionIniciada ? {\n      tipo:'GRT',\n      serie:valor('serieT'),\n      numero:valor('numeroT'),\n      tonelaje:normalizarDecimalApp_(valor('tonelajeT')),\n      ruc:valor('rucT'),\n      razonSocial:valor('razonT'),\n      observacion:valor('observacionT')\n    } : {\n      tipo:'GRT',\n      serie:valor('grtSerie'),\n      numero:valor('grtNumero'),\n      tonelaje:normalizarDecimalApp_(valor('grtTonelaje')),\n      ruc:valor('grtRuc'),\n      razonSocial:valor('grtRazon'),\n      observacion:valor('grtObservacion')\n    }\n  };\n}\n\n\n\n\nfunction datosRecepcionActual(){\n  return {\n    idAtencion:ID_ATENCION,\n    usuario:USUARIO ? USUARIO.usuario : '',\n    placa:valor('placa'),\n    acopiador:valor('acopiador'),\n    zona:valor('zona'),\n    guardia:valor('guardia'),\n    turno:valor('turno'),\n    grrSerie:valor('grrSerie'),\n    grrNumero:valor('grrNumero'),\n    grtSerie:valor('grtSerie'),\n    grtNumero:valor('grtNumero'),\n    tipoRevision:obtenerTipoRevision(),\n    responsable:USUARIO ? USUARIO.nombre : '',\n\n    remitente:{\n      tipo:'GRR',\n      serie:valor('grrSerie'),\n      numero:valor('grrNumero'),\n      tonelaje:normalizarDecimalApp_(valor('grrTonelaje')),\n      ruc:valor('grrRuc'),\n      razonSocial:valor('grrRazon'),\n      observacion:valor('grrObservacion')\n    },\n\n    transportista:{\n      tipo:'GRT',\n      serie:valor('grtSerie'),\n      numero:valor('grtNumero'),\n      tonelaje:normalizarDecimalApp_(valor('grtTonelaje')),\n      ruc:valor('grtRuc'),\n      razonSocial:valor('grtRazon'),\n      observacion:valor('grtObservacion')\n    }\n  };\n}\n\nfunction completarNumero6(id){\n  const el=document.getElementById(id);\n  if(!el) return;\n  const digitos=String(el.value||'').replace(/\\D/g,'').slice(0,6);\n  el.value=digitos ? digitos.padStart(6,'0') : '';\n  if(ID_ATENCION && !FINAL_MS) programarGuardadoBorrador();\n}\n\nfunction numero6Valor(id){\n  const el=document.getElementById(id);\n  if(!el) return '';\n  const digitos=String(el.value||'').replace(/\\D/g,'').slice(0,6);\n  return digitos ? digitos.padStart(6,'0') : '';\n}\n\nfunction formatearMilesApp_(valor){\n  const n=Number(valor||0);\n  if(!Number.isFinite(n)) return String(valor||'');\n  return Math.round(n).toLocaleString('en-US');\n}\n\n\nfunction normalizarDecimalApp_(v){\n  // Conservar EXACTAMENTE el valor digitado: 5.6 o 5,6.\n  return String(v == null ? '' : v).trim();\n}\n\n\nfunction copiarRecepcionARevision(){\n\n  setValor('tipoR','GRR');\n  setValor('serieR',valor('grrSerie'));\n  setValor('numeroR',numero6Valor('grrNumero'));\n  setValor('tonelajeR',normalizarDecimalApp_(valor('grrTonelaje')));\n  setValor('rucR',valor('grrRuc'));\n  setValor('razonR',valor('grrRazon'));\n  setValor('observacionR',valor('grrObservacion'));\n\n  setValor('tipoT','GRT');\n  setValor('serieT',valor('grtSerie'));\n  setValor('numeroT',numero6Valor('grtNumero'));\n  setValor('tonelajeT',normalizarDecimalApp_(valor('grtTonelaje')));\n  setValor('rucT',valor('grtRuc'));\n  setValor('razonT',valor('grtRazon'));\n  setValor('observacionT',valor('grtObservacion'));\n}\n\nfunction validarGuiasRecepcionCompletas_(){\n  const grrTiene = [\n    valor('grrSerie'),\n    valor('grrNumero'),\n    valor('grrTonelaje'),\n    valor('grrRuc'),\n    valor('grrRazon')\n  ].some(function(v){return String(v||'').trim()!=='';});\n\n  const grtTiene = [\n    valor('grtSerie'),\n    valor('grtNumero'),\n    valor('grtTonelaje'),\n    valor('grtRuc'),\n    valor('grtRazon')\n  ].some(function(v){return String(v||'').trim()!=='';});\n\n  if(!grrTiene && !grtTiene){\n    alert('Registre por lo menos una guía: GRR o GRT.');\n    document.getElementById('grrSerie')?.focus();\n    return false;\n  }\n\n  function validarGuia_(prefijo,nombre){\n    const campos=[\n      [prefijo+'Serie','Serie '+nombre],\n      [prefijo+'Numero','Número '+nombre],\n      [prefijo+'Tonelaje','Tonelaje '+nombre],\n      [prefijo+'Ruc','RUC '+nombre],\n      [prefijo+'Razon','Razón Social '+nombre]\n    ];\n\n    for(const [id,etiqueta] of campos){\n      if(!valor(id)){\n        alert('Complete '+etiqueta+'.');\n        document.getElementById(id)?.focus();\n        return false;\n      }\n    }\n\n    const tonelaje=Number(String(valor(prefijo+'Tonelaje')).replace(',','.'));\n    if(!Number.isFinite(tonelaje) || tonelaje<=0){\n      alert('Ingrese un tonelaje '+nombre+' válido.');\n      document.getElementById(prefijo+'Tonelaje')?.focus();\n      return false;\n    }\n\n    return true;\n  }\n\n  // Cada guía es independiente:\n  // si se empezó GRR, se valida solo GRR.\n  // si se empezó GRT, se valida solo GRT.\n  if(grrTiene && !validarGuia_('grr','GRR')) return false;\n  if(grtTiene && !validarGuia_('grt','GRT')) return false;\n\n  return true;\n}\n\n// ======================================================\n// NAVEGACIÓN\n// ======================================================\n\nfunction mostrarPagina(nombre){\n  document.querySelectorAll('.pagina').forEach(function(p){p.classList.remove('activa');});\n  document.querySelectorAll('.menu-btn').forEach(function(b){b.classList.remove('activo');});\n\n  if(nombre === 'registrar'){\n    document.getElementById('paginaRegistrar').classList.add('activa');\n    document.getElementById('menuRegistrar').classList.add('activo');\n    document.getElementById('tituloPagina').innerText = 'REGISTRAR';\n  }\n\n  if(nombre === 'historial'){\n    document.getElementById('paginaHistorial').classList.add('activa');\n    document.getElementById('menuHistorial').classList.add('activo');\n    document.getElementById('tituloPagina').innerText = 'HISTORIAL DE REGISTROS';\n    cargarHistorial();\n  }\n\n  if(nombre === 'indicadores' && USUARIO && USUARIO.rol === 'ADMIN'){\n    document.getElementById('paginaIndicadores').classList.add('activa');\n    document.getElementById('menuIndicadores').classList.add('activo');\n    document.getElementById('tituloPagina').innerText = 'INDICADORES';\n    cargarIndicadores();\n    }\n    if(nombre === 'sacos'){\n\n  document\n    .getElementById('paginaSacos')\n    .classList\n    .add('activa');\n\n  document\n    .getElementById('menuSacos')\n    .classList\n    .add('activo');\n\n  document\n    .getElementById('tituloPagina')\n    .innerText =\n      'REGISTRO DE SACOS MINEROS';\n\n  inicializarModuloSacos();\n}\n  \n}\n\n// ======================================================\n// PÚBLICA / PRIVADA\n// ======================================================\n\nfunction cambiarTipo(){\n  const tipo = obtenerTipoRevision();\n\n  const bp=document.getElementById('tipoPublica');\n  const bv=document.getElementById('tipoPrivada');\n  if(bp) bp.classList.toggle('activo',tipo==='PUBLICA');\n  if(bv) bv.classList.toggle('activo',tipo==='PRIVADA');\n\n  // Tanto PÚBLICA como PRIVADA permiten registrar GRR y GRT.\n  const bloque=document.getElementById('bloqueTransportista');\n  if(bloque) bloque.classList.remove('oculto');\n\n  programarGuardadoBorrador();\n}\n\nfunction obtenerTipoRevision(){\n  const r = document.querySelector('input[name=\"tipoRevision\"]:checked');\n  return r ? r.value : 'PUBLICA';\n}\n\n// ======================================================\n// RECEPCIÓN\n// ======================================================\n\n\n\n\nfunction recepcionar(){\n\n  // OFFLINE: guardar localmente sin intentar llamar al servidor.\n  if(!navigator.onLine){\n    completarNumero6('grrNumero'); completarNumero6('grtNumero');\n    if(!validarGuiasRecepcionCompletas_()) return;\n    recepcionarOffline_(datosRecepcionActual());\n    return;\n  }\n  if(!USUARIO) return;\n\n  if(ID_ATENCION && RECEPCION_MS){\n    return;\n  }\n\n  completarNumero6('grrNumero');\n  completarNumero6('grtNumero');\n\n  if(!validarGuiasRecepcionCompletas_()) return;\n\n  const datos = datosRecepcionActual();\n\n  const btn = document.getElementById('btnRecepcion');\n  const btnNuevo = document.getElementById('btnGuardarNuevo');\n\n  btn.disabled = true;\n  btn.innerText = 'REGISTRANDO...';\n\n  google.script.run\n    .withSuccessHandler(function(r){\n\n      if(!r || !r.ok){\n        btn.disabled = false;\n        btn.innerText = 'RECEPCIONAR DOCUMENTOS';\n        alert((r && r.mensaje) || 'No se registró.');\n        return;\n      }\n\n      ID_ATENCION = r.idAtencion;\n      RECEPCION_MS = Number(r.fechaHora || 0);\n      INICIO_MS = 0;\n      FINAL_MS = 0;\n      EDITANDO_FINALIZADO = false;\n\n      const f = fechaTexto(new Date(RECEPCION_MS));\n      setValor('fechaRecepcion',f);\n      setValor('tiempoFechaRecepcion',f);\n\n      document.getElementById('estadoRecepcion').innerText =\n        'DOCUMENTOS RECEPCIONADOS';\n\n      btn.innerText = 'RECEPCIONAR DOCUMENTOS';\n      btn.disabled = false;\n\n      // NUEVO FLUJO DEFINITIVO:\n      // Al recepcionar, dejar PUNTO 2 ya preparado con una copia de PUNTO 1.\n      // Esto NO inicia la revisión ni registra fecha de inicio.\n      copiarRecepcionARevision();\n\n      setValor('fechaInicio','');\n      setValor('fechaFinal','');\n      document.getElementById('tiempoEspera').innerText = '00:00:00';\n      document.getElementById('tiempoRevision').innerText = '00:00:00';\n\n      document.getElementById('btnInicio').innerText = '▶ INICIAR REVISIÓN';\n      document.getElementById('btnInicio').disabled = false;\n\n      document.getElementById('btnFinal').innerText = '■ FINALIZAR REVISIÓN';\n      document.getElementById('btnFinal').disabled = true;\n\n      // Como ya está guardado PENDIENTE, puede limpiar y registrar otro.\n      if(btnNuevo){\n        btnNuevo.disabled = false;\n        btnNuevo.innerText = '💾 GUARDAR Y NUEVO REGISTRO';\n      }\n    })\n    .withFailureHandler(function(e){\n      btn.disabled = false;\n      btn.innerText = 'RECEPCIONAR DOCUMENTOS';\n      alert('Error al registrar recepción: ' + ((e && e.message) || e));\n    })\n    .registrarRecepcionBD(datos);\n}\n\n// ======================================================\n// INICIAR REVISIÓN\n// ======================================================\n\n\n\n\nfunction iniciarRevision(){\n\n  if(esIdOffline_(ID_ATENCION) || !navigator.onLine){\n    if(!ID_ATENCION){ alert('Primero debe recepcionar los documentos.'); return; }\n    iniciarRevisionOffline_(); return;\n  }\n\n  if(!ID_ATENCION){\n    alert('Primero debe recepcionar los documentos.');\n    return;\n  }\n\n  clearTimeout(TIMER_BORRADOR);\n  TIMER_BORRADOR = null;\n\n  const btn = document.getElementById('btnInicio');\n  const btnNuevo = document.getElementById('btnGuardarNuevo');\n\n  btn.disabled = true;\n  btn.innerText = 'INICIANDO...';\n\n  if(btnNuevo) btnNuevo.disabled = true;\n\n  google.script.run\n    .withSuccessHandler(function(r){\n\n      if(!r || !r.ok){\n        btn.disabled = false;\n        btn.innerText = '▶ INICIAR REVISIÓN';\n        if(btnNuevo) btnNuevo.disabled = false;\n        alert((r && r.mensaje) || 'No se pudo iniciar la revisión.');\n        return;\n      }\n\n      INICIO_MS = Number(r.fechaHora || 0);\n\n      setValor('fechaInicio',fechaTexto(new Date(INICIO_MS)));\n      document.getElementById('tiempoEspera').innerText =\n        r.tiempoEspera || '00:00:00';\n\n      btn.innerText = '✓ REVISIÓN INICIADA';\n      btn.disabled = true;\n\n      // Ya iniciada: primero debe FINALIZAR antes de limpiar.\n      if(btnNuevo) btnNuevo.disabled = true;\n\n      // Habilitar FINALIZAR inmediatamente.\n      const btnFinal = document.getElementById('btnFinal');\n      if(btnFinal){\n        btnFinal.disabled = false;\n        btnFinal.innerText = '■ FINALIZAR REVISIÓN';\n      }\n    })\n    .withFailureHandler(function(e){\n      btn.disabled = false;\n      btn.innerText = '▶ INICIAR REVISIÓN';\n      if(btnNuevo) btnNuevo.disabled = false;\n      alert('Error al iniciar revisión: ' + ((e && e.message) || e));\n    })\n    .iniciarRevisionConDatosBD(datosRecepcionActual());\n}\n\n// ======================================================\n// FINALIZAR\n// ======================================================\n\n\nfunction finalizarRevision(){\n\n  if(esIdOffline_(ID_ATENCION) || !navigator.onLine){\n    if(!ID_ATENCION){ alert('No existe una atención activa.'); return; }\n    if(!INICIO_MS){ alert('Primero debe INICIAR LA REVISIÓN.'); return; }\n    finalizarRevisionOffline_(); return;\n  }\n\n  completarNumero6('numeroR');\n  completarNumero6('numeroT');\n\n  if(!ID_ATENCION){\n    alert('No existe una atención activa.');\n    return;\n  }\n\n  if(!INICIO_MS){\n    alert('Primero debe INICIAR LA REVISIÓN.');\n    return;\n  }\n\n  // Evitar que un autoguardado pendiente compita con FINALIZAR.\n  clearTimeout(TIMER_BORRADOR);\n  TIMER_BORRADOR = null;\n\n  const boton = document.getElementById('btnFinal');\n  const btnNuevo = document.getElementById('btnGuardarNuevo');\n\n  boton.disabled = true;\n  boton.innerText = EDITANDO_FINALIZADO ? 'GUARDANDO CAMBIOS...' : 'GUARDANDO...';\n  if(btnNuevo) btnNuevo.disabled = true;\n\n  const datos = datosFormularioActual();\n\n  google.script.run\n    .withSuccessHandler(function(r){\n\n      if(!r || !r.ok){\n        boton.disabled = false;\n        boton.innerText = EDITANDO_FINALIZADO\n          ? '💾 GUARDAR CAMBIOS'\n          : '■ FINALIZAR REVISIÓN';\n\n        if(btnNuevo) btnNuevo.disabled = true;\n\n        alert((r && r.mensaje) || 'No se pudo guardar.');\n        return;\n      }\n\n      FINAL_MS = Number(r.fechaHora || 0);\n\n      if(FINAL_MS){\n        setValor('fechaFinal',fechaTexto(new Date(FINAL_MS)));\n      }\n\n      document.getElementById('tiempoRevision').innerText =\n        r.tiempoRevision || '00:00:00';\n\n      boton.innerText = '✓ REVISIÓN FINALIZADA';\n      boton.disabled = true;\n\n      if(btnNuevo){\n        btnNuevo.disabled = false;\n        btnNuevo.innerText = '💾 GUARDAR Y NUEVO REGISTRO';\n      }\n\n      cargarHistorial();\n\n      if(r.edicionFinalizada){\n        EDITANDO_FINALIZADO = false;\n        alert(\n          'REGISTRO FINALIZADO ACTUALIZADO CORRECTAMENTE.\\n\\n' +\n          'N° ATENCIÓN: ' + ID_ATENCION\n        );\n      }else{\n        alert(\n          'REVISIÓN FINALIZADA Y GUARDADA CORRECTAMENTE.\\n\\n' +\n          'N° ATENCIÓN: ' + ID_ATENCION + '\\n' +\n          'ESTADO: FINALIZADO'\n        );\n      }\n    })\n    .withFailureHandler(function(e){\n      boton.disabled = false;\n      boton.innerText = EDITANDO_FINALIZADO\n        ? '💾 GUARDAR CAMBIOS'\n        : '■ FINALIZAR REVISIÓN';\n\n      if(btnNuevo) btnNuevo.disabled = true;\n\n      alert('Error al guardar: ' + ((e && e.message) || e));\n    })\n    .finalizarRevisionBD(datos);\n}\n\n\nfunction restablecerEstadoNuevaGuia_(){\n  const bRec=document.getElementById('btnRecepcion');\n  const bIni=document.getElementById('btnInicio');\n  const bFin=document.getElementById('btnFinal');\n  const bNuevo=document.getElementById('btnGuardarNuevo');\n\n  if(bRec){\n    bRec.disabled=false;\n    bRec.removeAttribute('disabled');\n    bRec.innerText='RECEPCIONAR DOCUMENTOS';\n  }\n\n  if(bIni){\n    bIni.disabled=true;\n    bIni.innerText='▶ INICIAR REVISIÓN';\n  }\n\n  if(bFin){\n    bFin.disabled=true;\n    bFin.innerText='■ FINALIZAR REVISIÓN';\n  }\n\n  if(bNuevo){\n    bNuevo.disabled=true;\n    bNuevo.innerText='💾 GUARDAR Y NUEVO REGISTRO';\n  }\n\n  setTexto('estadoRecepcion','Pendiente de recepción');\n  setTexto('tiempoEspera','00:00:00');\n  setTexto('tiempoRevision','00:00:00');\n}\n\n// ======================================================\n// GUARDAR Y NUEVO\n// ======================================================\n\n\nfunction guardarYNuevoRegistro(){\n\n  if(!ID_ATENCION){\n    alert('No existe un registro guardado para cerrar.');\n    return;\n  }\n\n  // Si la revisión ya empezó, debe terminarse antes de limpiar la pantalla.\n  if(INICIO_MS && !FINAL_MS){\n    alert('La revisión está INICIADA. Primero debe FINALIZAR LA REVISIÓN.');\n    return;\n  }\n\n  clearTimeout(TIMER_BORRADOR);\n  TIMER_BORRADOR = null;\n\n  const idGuardado = ID_ATENCION;\n  const estadoGuardado = FINAL_MS ? 'FINALIZADO' : 'PENDIENTE';\n\n  // El registro ya fue guardado:\n  // - al RECEPCIONAR si quedó PENDIENTE\n  // - al FINALIZAR si terminó la revisión\n  alert(\n    'REGISTRO GUARDADO CORRECTAMENTE.\\n\\n' +\n    'N° ATENCIÓN: ' + idGuardado + '\\n' +\n    'ESTADO: ' + estadoGuardado\n  );\n\n  cargarHistorial();\n\n  limpiarNuevaAtencion();\n  restablecerEstadoNuevaGuia_();\n\n  setTimeout(function(){\n    const placa = document.getElementById('placa');\n    if(placa) placa.focus();\n  },120);\n}\n\nfunction limpiarNuevaAtencion(){\n  ID_ATENCION=null;\n  RECEPCION_MS=0;\n  INICIO_MS=0;\n  FINAL_MS=0;\n  EDITANDO_FINALIZADO=false;\n\n  ['placa','acopiador','zona','guardia','turno','grrSerie','grrNumero','grrTonelaje','grrRuc','grrRazon','grrObservacion','grtSerie','grtNumero','grtTonelaje','grtRuc','grtRazon','grtObservacion','serieR','numeroR','tonelajeR','rucR','razonR','observacionR','serieT','numeroT','tonelajeT','rucT','razonT','observacionT','fechaRecepcion','tiempoFechaRecepcion','fechaInicio','fechaFinal'].forEach(function(id){setValor(id,'');});\n\n  const pub=document.querySelector('input[name=\"tipoRevision\"][value=\"PUBLICA\"]');\n  if(pub) pub.checked=true;\n  cambiarTipo();\n  setTexto('estadoRecepcion','Pendiente de recepción');\n  setTexto('tiempoEspera','00:00:00');\n  setTexto('tiempoRevision','00:00:00');\n\n  restablecerEstadoNuevaGuia_();\n\n  setTimeout(function(){\n    const p=document.getElementById('placa');\n    if(p)p.focus();\n  },100);\n}\n\n// ======================================================\n// HISTORIAL\n// ======================================================\n\nfunction cargarHistorial(){\n  if(!USUARIO) return;\n\n  const tbody = document.getElementById('cuerpoHistorial');\n  tbody.innerHTML = '<tr><td colspan=\"14\">Cargando registros...</td></tr>';\n\n  google.script.run\n    .withSuccessHandler(function(datos){\n      dibujarHistorial(datos || []);\n    })\n    .withFailureHandler(function(e){\n      tbody.innerHTML =\n        '<tr><td colspan=\"14\" style=\"color:red;font-weight:bold;\">ERROR AL CARGAR HISTORIAL: ' +\n        esc((e && e.message) || e) + '</td></tr>';\n    })\n    .buscarHistorialPorPlaca(valor('buscarPlaca'));\n}\n\nfunction limpiarBusquedaHistorial(){\n  setValor('buscarPlaca','');\n  cargarHistorial();\n}\n\nfunction dibujarHistorial(datos){\n  const tbody = document.getElementById('cuerpoHistorial');\n\n  if(!datos || !datos.length){\n    tbody.innerHTML = '<tr><td colspan=\"14\">No hay registros.</td></tr>';\n    return;\n  }\n\n  let html = '';\n\n  datos.forEach(function(r){\n    const estado = String(r.estado || '').toUpperCase();\n\n    let badge = 'badge-finalizado';\n    if(estado === 'PENDIENTE') badge = 'badge-pendiente';\n    if(estado === 'ANULADO') badge = 'badge-anulado';\n\n    const esAdmin = !!USUARIO && String(USUARIO.rol || '').trim().toUpperCase() === 'ADMIN';\n    const puedeEditar = estado === 'PENDIENTE' || (esAdmin && estado === 'FINALIZADO');\n    const puedeAnular = estado === 'FINALIZADO' && !!r.idGuia;\n    const puedeReemplazar = estado === 'ANULADO' && !!r.idGuia && !r.idGuiaNueva;\n    const puedeEliminar = !!USUARIO && String(USUARIO.rol || '').trim().toUpperCase() === 'ADMIN';\n  \n    let relacion = '-';\n    if(r.idGuiaReemplazada) relacion = 'Reemplaza a ' + r.idGuiaReemplazada;\n    if(r.idGuiaNueva) relacion = 'Reemplazada por ' + r.idGuiaNueva;\n\n    html += `\n      <tr>\n        <td>${esc(r.idAtencion)}</td>\n        <td>${esc(r.fechaRecepcion)}</td>\n        <td>${esc(r.placa)}</td>\n        <td>${esc(r.tipoRevision)}</td>\n        <td>${esc(r.claseGuia)}</td>\n        <td>${esc(r.tipoGuia)}</td>\n        <td>${esc(r.serie)}</td>\n        <td>${esc(r.numero)}</td>\n        <td>${esc(r.razonSocial)}</td>\n        <td>${esc(r.tonelaje)}</td>\n        <td>${esc(r.responsable)}</td>\n        <td><span class=\"badge ${badge}\">${esc(estado)}</span></td>\n        <td>${esc(relacion)}</td>\n        <td>\n          <button class=\"accion azul\" title=\"Visualizar\"\n            onclick=\"visualizarRegistro('${escJS(r.idAtencion)}','${escJS(r.idGuia)}')\">👁</button>\n\n          <button class=\"accion naranja\" title=\"Editar pendiente\"\n            ${puedeEditar ? '' : 'disabled'}\n            onclick=\"editarPendiente('${escJS(r.idAtencion)}')\">EDITAR</button>\n\n          <button class=\"accion rojo\" title=\"Anular\"\n            ${puedeAnular ? '' : 'disabled'}\n            onclick=\"abrirAnular('${escJS(r.idGuia)}')\">ANULAR</button>\n\n          <button class=\"accion morado\" title=\"Reemplazar\"\n            ${puedeReemplazar ? '' : 'disabled'}\n            onclick=\"abrirReemplazar('${escJS(r.idAtencion)}','${escJS(r.idGuia)}')\">REEMPLAZAR</button>\n            ${puedeEliminar ? `\n  <button\n    class=\"accion eliminar\"\n    title=\"Eliminar atención completa\"\n    onclick=\"eliminarAtencionCompleta('${escJS(r.idAtencion)}')\">\n    🗑\n  </button>\n` : ''}\n        </td>\n      </tr>\n    `;\n  });\n\n  tbody.innerHTML = html;\n}\n\n// ======================================================\n// EDITAR PENDIENTE\n// ======================================================\n\n\n\n\nfunction editarPendiente(idAtencion){\n\n  if(!USUARIO){\n    alert('Sesión no válida.');\n    return;\n  }\n\n  idAtencion = String(idAtencion || '').trim();\n\n  if(!idAtencion){\n    alert('No se encontró el ID de la atención.');\n    return;\n  }\n\n  mostrarPagina('registrar');\n\n  const estadoCarga = document.getElementById('estadoRecepcion');\n  if(estadoCarga) estadoCarga.innerText = 'CARGANDO REGISTRO...';\n\n  const bInicioCarga = document.getElementById('btnInicio');\n  const bFinalCarga = document.getElementById('btnFinal');\n  const bNuevoCarga = document.getElementById('btnGuardarNuevo');\n\n  if(bInicioCarga) bInicioCarga.disabled = true;\n  if(bFinalCarga) bFinalCarga.disabled = true;\n  if(bNuevoCarga) bNuevoCarga.disabled = true;\n\n  google.script.run\n    .withSuccessHandler(function(r){\n\n      if(!r || !r.ok){\n        if(estadoCarga) estadoCarga.innerText = 'Pendiente de recepción';\n        alert((r && r.mensaje) || 'No se pudo abrir el registro.');\n        mostrarPagina('historial');\n        return;\n      }\n\n      // Cancelar cualquier guardado automático anterior.\n      clearTimeout(TIMER_BORRADOR);\n      TIMER_BORRADOR = null;\n\n      // Limpiar SOLO los campos visibles, sin ejecutar limpiarNuevaAtencion()\n      // para que ningún reset vuelva a borrar lo que cargamos.\n      [\n        'placa','acopiador','zona','guardia','turno',\n        'grrSerie','grrNumero','grrTonelaje','grrRuc','grrRazon','grrObservacion',\n        'grtSerie','grtNumero','grtTonelaje','grtRuc','grtRazon','grtObservacion',\n        'serieR','numeroR','tonelajeR','rucR','razonR','observacionR',\n        'serieT','numeroT','tonelajeT','rucT','razonT','observacionT',\n        'fechaRecepcion','tiempoFechaRecepcion','fechaInicio','fechaFinal'\n      ].forEach(function(id){\n        setValor(id,'');\n      });\n\n      ID_ATENCION = r.idAtencion;\n      RECEPCION_MS = Number(r.fechaRecepcion || 0);\n      INICIO_MS = Number(r.fechaInicio || 0);\n\n      const estadoRegistro = String(r.estado || '').trim().toUpperCase();\n      EDITANDO_FINALIZADO = estadoRegistro === 'FINALIZADO';\n      FINAL_MS = EDITANDO_FINALIZADO ? Number(r.fechaFinal || 0) : 0;\n\n      const gr = r.remitente || {};\n      const gt = r.transportista || {};\n\n      // =====================================================\n      // PUNTO 1 - RECEPCIÓN: TRAER TODO\n      // =====================================================\n      setValor('placa',r.placa || '');\n      setValor('acopiador',r.acopiador || '');\n      setValor('zona',r.zona || '');\n      setValor('guardia',r.guardia || '');\n      setValor('turno',r.turno || '');\n\n      setValor('grrSerie',gr.serie || r.grrSerie || '');\n      setValor('grrNumero',gr.numero || r.grrNumero || '');\n      setValor('grrTonelaje',gr.tonelaje || '');\n      setValor('grrRuc',gr.ruc || '');\n      setValor('grrRazon',gr.razonSocial || '');\n      setValor('grrObservacion',gr.observacion || '');\n\n      setValor('grtSerie',gt.serie || r.grtSerie || '');\n      setValor('grtNumero',gt.numero || r.grtNumero || '');\n      setValor('grtTonelaje',gt.tonelaje || '');\n      setValor('grtRuc',gt.ruc || '');\n      setValor('grtRazon',gt.razonSocial || '');\n      setValor('grtObservacion',gt.observacion || '');\n\n      // =====================================================\n      // PUNTO 2 - REVISIÓN: TRAER LOS MISMOS DATOS\n      // LISTOS PARA PULSAR INICIAR REVISIÓN\n      // =====================================================\n      setValor('tipoR',gr.tipo || 'GRR');\n      setValor('serieR',gr.serie || r.grrSerie || '');\n      setValor('numeroR',gr.numero || r.grrNumero || '');\n      setValor('tonelajeR',gr.tonelaje || '');\n      setValor('rucR',gr.ruc || '');\n      setValor('razonR',gr.razonSocial || '');\n      setValor('observacionR',gr.observacion || '');\n\n      setValor('tipoT',gt.tipo || 'GRT');\n      setValor('serieT',gt.serie || r.grtSerie || '');\n      setValor('numeroT',gt.numero || r.grtNumero || '');\n      setValor('tonelajeT',gt.tonelaje || '');\n      setValor('rucT',gt.ruc || '');\n      setValor('razonT',gt.razonSocial || '');\n      setValor('observacionT',gt.observacion || '');\n\n      if(RECEPCION_MS){\n        const f = fechaTexto(new Date(RECEPCION_MS));\n        setValor('fechaRecepcion',f);\n        setValor('tiempoFechaRecepcion',f);\n      }\n\n      const tipo = r.tipoRevision || 'PUBLICA';\n      const radio = document.querySelector(\n        'input[name=\"tipoRevision\"][value=\"'+tipo+'\"]'\n      );\n      if(radio) radio.checked = true;\n\n      // Solo actualizar estilo visual de Pública/Privada.\n      const bp=document.getElementById('tipoPublica');\n      const bv=document.getElementById('tipoPrivada');\n      if(bp) bp.classList.toggle('activo',tipo==='PUBLICA');\n      if(bv) bv.classList.toggle('activo',tipo==='PRIVADA');\n\n      document.getElementById('estadoRecepcion').innerText =\n        EDITANDO_FINALIZADO\n          ? 'EDITANDO REGISTRO FINALIZADO'\n          : 'DOCUMENTOS RECEPCIONADOS';\n\n      const bRecepcion = document.getElementById('btnRecepcion');\n      if(bRecepcion){\n        bRecepcion.innerText = 'RECEPCIONAR DOCUMENTOS';\n        bRecepcion.disabled = false;\n      }\n\n      if(INICIO_MS){\n        setValor('fechaInicio',fechaTexto(new Date(INICIO_MS)));\n        document.getElementById('tiempoEspera').innerText =\n          r.tiempoEspera || '00:00:00';\n\n        document.getElementById('btnInicio').innerText =\n          '✓ REVISIÓN INICIADA';\n        document.getElementById('btnInicio').disabled = true;\n      }else{\n        setValor('fechaInicio','');\n        document.getElementById('tiempoEspera').innerText = '00:00:00';\n\n        document.getElementById('btnInicio').innerText =\n          '▶ INICIAR REVISIÓN';\n        document.getElementById('btnInicio').disabled = false;\n      }\n\n      if(EDITANDO_FINALIZADO && FINAL_MS){\n        setValor('fechaFinal',fechaTexto(new Date(FINAL_MS)));\n        document.getElementById('tiempoRevision').innerText =\n          r.tiempoRevision || '00:00:00';\n      }else{\n        setValor('fechaFinal','');\n        document.getElementById('tiempoRevision').innerText = '00:00:00';\n      }\n\n      const bFinal = document.getElementById('btnFinal');\n\n      if(EDITANDO_FINALIZADO){\n        bFinal.disabled = false;\n        bFinal.innerText = '💾 GUARDAR CAMBIOS';\n      }else{\n        bFinal.disabled = !INICIO_MS;\n        bFinal.innerText = '■ FINALIZAR REVISIÓN';\n      }\n\n      const bNuevo = document.getElementById('btnGuardarNuevo');\n      if(bNuevo){\n        bNuevo.disabled = !!INICIO_MS && !FINAL_MS;\n        bNuevo.innerText = '💾 GUARDAR Y NUEVO REGISTRO';\n      }\n\n      setTimeout(function(){\n        const foco = (!INICIO_MS && !EDITANDO_FINALIZADO)\n          ? document.getElementById('btnInicio')\n          : document.getElementById('serieR');\n        if(foco) foco.focus();\n      },80);\n    })\n    .withFailureHandler(function(e){\n      if(estadoCarga) estadoCarga.innerText = 'Pendiente de recepción';\n      alert('Error al recuperar registro: ' + ((e && e.message) || e));\n      mostrarPagina('historial');\n    })\n    .obtenerAtencionPendiente(idAtencion,USUARIO.usuario);\n}\n\n// ======================================================\n// VISUALIZAR\n// ======================================================\n\nfunction visualizarRegistro(idAtencion,idGuia){\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok){\n        alert((r && r.mensaje) || 'No se pudo visualizar.');\n        return;\n      }\n\n      const a = r.atencion || {};\n      const g = r.guia;\n\n      let html = `\n        <b>ID Atención:</b> ${esc(a.idAtencion)}<br>\n        <b>Placa:</b> ${esc(a.placa)}<br>\n        <b>Acopiador:</b> ${esc(a.acopiador)}<br>\n        <b>Zona:</b> ${esc(a.zona)}<br>\n        <b>Guardia:</b> ${esc(a.guardia)}<br>\n        <b>Turno:</b> ${esc(a.turno)}<br>\n        <b>Tipo revisión:</b> ${esc(a.tipoRevision)}<br>\n        <b>Responsable:</b> ${esc(a.responsable)}<br>\n        <b>Recepción:</b> ${esc(a.recepcion)}<br>\n        <b>Inicio:</b> ${esc(a.inicio)}<br>\n        <b>Final:</b> ${esc(a.final)}<br>\n        <b>Tiempo espera:</b> ${esc(a.tiempoEspera)}<br>\n        <b>Tiempo revisión:</b> ${esc(a.tiempoRevision)}<br>\n        <b>Estado atención:</b> ${esc(a.estado)}\n      `;\n\n      if(g){\n        html += `\n          <hr>\n          <b>ID Guía:</b> ${esc(g.idGuia)}<br>\n          <b>Clase:</b> ${esc(g.clase)}<br>\n          <b>Tipo:</b> ${esc(g.tipo)}<br>\n          <b>Serie:</b> ${esc(g.serie)}<br>\n          <b>Número:</b> ${esc(g.numero)}<br>\n          <b>Tonelaje:</b> ${esc(g.tonelaje)}<br>\n          <b>RUC:</b> ${esc(g.ruc)}<br>\n          <b>Razón Social:</b> ${esc(g.razonSocial)}<br>\n          <b>Estado guía:</b> ${esc(g.estado)}<br>\n          <b>Reemplaza a:</b> ${esc(g.reemplazaA)}<br>\n          <b>Reemplazada por:</b> ${esc(g.reemplazadaPor)}<br>\n          <b>Fecha anulación:</b> ${esc(g.fechaAnulacion)}<br>\n          <b>Motivo anulación:</b> ${esc(g.motivoAnulacion)}<br>\n          <b>Fecha reemplazo:</b> ${esc(g.fechaReemplazo)}<br>\n          <b>Motivo reemplazo:</b> ${esc(g.motivoReemplazo)}\n        `;\n      }\n\n      document.getElementById('contenidoDetalle').innerHTML = html;\n      abrirModal('modalVer');\n    })\n    .withFailureHandler(function(e){\n      alert('Error al visualizar: ' + ((e && e.message) || e));\n    })\n    .obtenerDetalleRegistro(idAtencion,idGuia);\n}\n\n// ======================================================\n// ANULAR\n// ======================================================\n\nfunction abrirAnular(idGuia){\n  setValor('anularIdGuia',idGuia);\n  setValor('motivoAnulacionSelect','');\n  setValor('detalleAnulacion','');\n  abrirModal('modalAnular');\n}\n\nfunction confirmarAnulacion(){\n  const idGuia = valor('anularIdGuia');\n  const motivoBase = valor('motivoAnulacionSelect');\n  const detalle = valor('detalleAnulacion');\n\n  if(!motivoBase){\n    alert('Seleccione el motivo de anulación.');\n    return;\n  }\n\n  const motivo = detalle ? motivoBase + ' - ' + detalle : motivoBase;\n\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok){\n        alert((r && r.mensaje) || 'No se pudo anular.');\n        return;\n      }\n\n      cerrarModal('modalAnular');\n      cargarHistorial();\n      alert('Guía anulada correctamente.');\n    })\n    .withFailureHandler(function(e){\n      alert('Error al anular: ' + ((e && e.message) || e));\n    })\n    .anularGuiaBD({\n      idGuia:idGuia,\n      motivo:motivo,\n      responsable:USUARIO.nombre\n    });\n}\n\n// ======================================================\n// ELIMINAR ATENCIÓN COMPLETA\n// SOLO ADMIN\n// ======================================================\n\nfunction eliminarAtencionCompleta(idAtencion) {\n\n  if (!USUARIO || String(USUARIO.rol || '').trim().toUpperCase() !== 'ADMIN') {\n    alert('No tiene permisos para eliminar registros.');\n    return;\n  }\n\n  const confirmar = window.confirm(\n    '¿ELIMINAR DEFINITIVAMENTE ESTA ATENCIÓN?\\n\\n' +\n    'ID: ' + idAtencion +\n    '\\n\\nSe eliminarán la atención y todas sus guías asociadas.\\n' +\n    'Esta acción no se puede deshacer.'\n  );\n\n  if (!confirmar) return;\n\n  google.script.run\n    .withSuccessHandler(function(r) {\n\n      if (!r || !r.ok) {\n        alert((r && r.mensaje) || 'No se pudo eliminar el registro.');\n        return;\n      }\n\n      alert(\n        'REGISTRO ELIMINADO\\n\\n' +\n        'ID Atención: ' + r.idAtencion +\n        '\\nGuías eliminadas: ' + r.guiasEliminadas\n      );\n\n      cargarHistorial();\n    })\n\n    .withFailureHandler(function(e) {\n      alert(\n        'Error al eliminar: ' +\n        ((e && e.message) || e)\n      );\n    })\n\n    .eliminarAtencionCompletaBD({\n      idAtencion: idAtencion,\n      usuario: USUARIO.usuario\n    });\n}\n\n\n// ==============================================\n// REEMPLAZAR\n// ==============================================\n// ======================================================\n// REEMPLAZAR\n// ======================================================\n\nfunction abrirReemplazar(idAtencion,idGuia){\n  setValor('reemplazoIdOriginal',idGuia);\n  setValor('reemplazoSerie','');\n  setValor('reemplazoNumero','');\n  setValor('reemplazoTonelaje','');\n  setValor('reemplazoRuc','');\n  setValor('reemplazoRazon','');\n  setValor('motivoReemplazo','');\n\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok || !r.guia){\n        alert((r && r.mensaje) || 'No se encontró la guía anulada.');\n        return;\n      }\n\n      const g = r.guia;\n      setValor('reemplazoTipo',g.tipo || 'GRR');\n\n      document.getElementById('detalleGuiaAnulada').innerHTML = `\n        <b>GUÍA ANULADA</b><br>\n        ${esc(g.tipo)} ${esc(g.serie)} - ${esc(g.numero)}<br>\n        RUC: ${esc(g.ruc)}<br>\n        Razón Social: ${esc(g.razonSocial)}<br>\n        Motivo: ${esc(g.motivoAnulacion)}\n      `;\n\n      abrirModal('modalReemplazar');\n    })\n    .withFailureHandler(function(e){\n      alert('Error al abrir reemplazo: ' + ((e && e.message) || e));\n    })\n    .obtenerDetalleRegistro(idAtencion,idGuia);\n}\n\nfunction confirmarReemplazo(){\n  completarNumero6('reemplazoNumero');\n  const datos = {\n    idGuiaOriginal:valor('reemplazoIdOriginal'),\n    tipo:valor('reemplazoTipo'),\n    serie:valor('reemplazoSerie'),\n    numero:valor('reemplazoNumero'),\n    tonelaje:normalizarDecimalApp_(valor('reemplazoTonelaje')),\n    ruc:valor('reemplazoRuc'),\n    razonSocial:valor('reemplazoRazon'),\n    motivo:valor('motivoReemplazo'),\n    responsable:USUARIO.nombre\n  };\n\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok){\n        alert((r && r.mensaje) || 'No se pudo reemplazar.');\n        return;\n      }\n\n      cerrarModal('modalReemplazar');\n      cargarHistorial();\n      alert('Guía reemplazada correctamente. Nueva guía: ' + r.idGuiaNueva);\n    })\n    .withFailureHandler(function(e){\n      alert('Error al reemplazar: ' + ((e && e.message) || e));\n    })\n    .reemplazarGuiaBD(datos);\n}\n\n// ======================================================\n// INDICADORES\n// ======================================================\n\nfunction cargarIndicadores(){\n  if(!USUARIO || USUARIO.rol !== 'ADMIN') return;\n\n  limpiarDetalleResponsable();\n\n  const filtros = {\n    desde:valor('fDesde'),\n    hasta:valor('fHasta'),\n    guardia:valor('fGuardia'),\n    turno:valor('fTurno'),\n    responsable:valor('fResponsable')\n  };\n\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok){\n        alert((r && r.mensaje) || 'No se pudieron cargar los indicadores.');\n        return;\n      }\n\n      document.getElementById('kFinalizadas').innerText = r.kpi.guiasFinalizadas;\n      document.getElementById('kPendientes').innerText = r.kpi.pendientes;\n      document.getElementById('kAnuladas').innerText = r.kpi.guiasAnuladas;\n      document.getElementById('kEspera').innerText = r.kpi.promedioEspera;\n      document.getElementById('kRevision').innerText = r.kpi.promedioRevision;\n\n      dibujarRanking(r.usuarios || []);\n\n      google.charts.setOnLoadCallback(function(){\n        dibujarGraficos(r);\n      });\n\n      google.script.run\n        .withSuccessHandler(function(ev){\n          if(!ev || !ev.ok) return;\n          google.charts.setOnLoadCallback(function(){\n            dibujarEvolucionGuiasMes(ev.meses || []);\n            dibujarEvolucionGuiasResponsable(ev.meses || [], ev.responsables || []);\n            dibujarEvolucionTiempoResponsable(ev.meses || [], ev.responsables || []);\n          });\n        })\n        .obtenerEvolucionIndicadoresMensual(filtros,USUARIO.usuario);\n    })\n    .withFailureHandler(function(e){\n      alert('Error al cargar indicadores: ' + ((e && e.message) || e));\n    })\n    .obtenerIndicadores(filtros,USUARIO.usuario);\n}\n\nfunction dibujarRanking(usuarios){\n  const tbody = document.getElementById('rankingUsuarios');\n\n  if(!usuarios.length){\n    tbody.innerHTML = '<tr><td colspan=\"5\">Sin datos</td></tr>';\n    return;\n  }\n\n  let html = '';\n  usuarios.forEach(function(u,i){\n    let comparacion = '';\n    if(i === 0 && Number(u.promedioRevisionSeg || 0) > 0) comparacion = '🔴 Mayor tiempo';\n    if(i === usuarios.length-1 && Number(u.promedioRevisionSeg || 0) > 0) comparacion = '🟢 Menor tiempo';\n\n    html += `\n      <tr>\n        <td>${esc(u.responsable)}</td>\n        <td>${esc(u.guias)}</td>\n        <td>${esc(u.promedioEspera)}</td>\n        <td>${esc(u.promedioRevision)}</td>\n        <td>${comparacion}</td>\n      </tr>\n    `;\n  });\n\n  tbody.innerHTML = html;\n}\n\nfunction dibujarGraficos(r){\n  dibujarGraficoCantidadUsuarios(r.usuarios || []);\n  dibujarGraficoRevisionUsuarios(r.usuarios || []);\n}\n\n\nfunction colorResponsable_(i){\n  const colores=['#3366CC','#DC3912','#FF9900','#109618','#990099','#0099C6','#DD4477','#66AA00','#B82E2E','#316395'];\n  return colores[i % colores.length];\n}\n\nfunction dibujarGraficoCantidadUsuarios(usuarios){\n  const dt = new google.visualization.DataTable();\n  dt.addColumn('string','Responsable');\n  dt.addColumn('number','Guías');\n  dt.addColumn({type:'string',role:'annotation'});\n  dt.addColumn({type:'string',role:'style'});\n\n  usuarios.forEach(function(u,i){\n    const n=Number(u.guias||0);\n    dt.addRow([u.responsable,n,String(n),'color: '+colorResponsable_(i)]);\n  });\n\n  new google.visualization.ColumnChart(document.getElementById('chartUsuarios')).draw(dt,{\n    title:'Cantidad de guías por responsable',\n    legend:{position:'none'},\n    annotations:{alwaysOutside:true,textStyle:{fontSize:12,bold:true}},\n    vAxis:{minValue:0},\n    chartArea:{left:70,top:60,width:'82%',height:'68%'}\n  });\n}\n\nfunction dibujarGraficoRevisionUsuarios(usuarios){\n  const dt = new google.visualization.DataTable();\n\n  dt.addColumn('string','Responsable');\n  dt.addColumn('number','Revisión (min)');\n  dt.addColumn({type:'string',role:'annotation'});\n  dt.addColumn({type:'string',role:'style'});\n\n  usuarios.forEach(function(u,i){\n    const revisionSeg = Number(u.promedioRevisionSeg || 0);\n\n    dt.addRow([\n      u.responsable,\n      revisionSeg / 60,\n      u.promedioRevision || segundosATextoApp_(revisionSeg),\n      'color: ' + colorResponsable_(i)\n    ]);\n  });\n\n  const contenedor = document.getElementById('chartRevisionUsuarios');\n  const chart = new google.visualization.ColumnChart(contenedor);\n\n  // Al hacer clic en una barra, mostrar los casos de ese responsable.\n  google.visualization.events.addListener(chart,'select',function(){\n    const seleccion = chart.getSelection();\n\n    if (!seleccion || seleccion.length === 0) return;\n\n    const fila = seleccion[0].row;\n    if (fila === null || fila === undefined) return;\n\n    const responsable = dt.getValue(fila,0);\n    cargarDetalleResponsable(responsable);\n  });\n\n  chart.draw(dt,{\n    title:'Tiempo promedio de revisión por responsable',\n    legend:{position:'none'},\n    annotations:{alwaysOutside:true,textStyle:{fontSize:12,bold:true}},\n    vAxis:{title:'Minutos',minValue:0},\n    bar:{groupWidth:'58%'},\n    chartArea:{left:80,top:65,width:'80%',height:'66%'}\n  });\n}\n\n// ======================================================\n// DETALLE DE REVISIONES POR RESPONSABLE\n// ======================================================\nfunction limpiarDetalleResponsable(){\n  const titulo = document.getElementById('tituloDetalleResponsable');\n  const mensaje = document.getElementById('mensajeDetalleResponsable');\n  const contenido = document.getElementById('contenidoDetalleResponsable');\n  const tbody = document.getElementById('tablaDetalleResponsable');\n\n  if (titulo) titulo.innerText = 'DETALLE DE REVISIONES';\n\n  if (mensaje){\n    mensaje.style.display = 'block';\n    mensaje.innerHTML =\n      'Haga clic en una barra del gráfico \"Tiempo promedio de revisión por responsable\".';\n  }\n\n  if (contenido) contenido.style.display = 'none';\n\n  if (tbody){\n    tbody.innerHTML = '<tr><td colspan=\"12\">Sin datos</td></tr>';\n  }\n}\n\nfunction cargarDetalleResponsable(responsable){\n\n  if (!USUARIO || USUARIO.rol !== 'ADMIN') return;\n\n  const filtros = {\n    desde:valor('fDesde'),\n    hasta:valor('fHasta'),\n    guardia:valor('fGuardia'),\n    turno:valor('fTurno')\n  };\n\n  const titulo = document.getElementById('tituloDetalleResponsable');\n  const mensaje = document.getElementById('mensajeDetalleResponsable');\n  const contenido = document.getElementById('contenidoDetalleResponsable');\n  const tbody = document.getElementById('tablaDetalleResponsable');\n  const resumen = document.getElementById('resumenDetalleResponsable');\n\n  if (!titulo || !mensaje || !contenido || !tbody || !resumen) return;\n\n  titulo.innerText = 'DETALLE DE REVISIONES — ' + responsable;\n  mensaje.style.display = 'block';\n  mensaje.innerHTML = 'Cargando revisiones de <b>' + esc(responsable) + '</b>...';\n  contenido.style.display = 'none';\n\n  google.script.run\n    .withSuccessHandler(function(r){\n\n      if (!r || !r.ok){\n        mensaje.innerText =\n          (r && r.mensaje) || 'No se pudo cargar el detalle.';\n        return;\n      }\n\n      const registros = r.registros || [];\n\n      if (!registros.length){\n        mensaje.style.display = 'block';\n        mensaje.innerHTML =\n          'No existen revisiones finalizadas para <b>' +\n          esc(responsable) +\n          '</b> con los filtros seleccionados.';\n        contenido.style.display = 'none';\n        return;\n      }\n\n      mensaje.style.display = 'none';\n      contenido.style.display = 'block';\n\n      resumen.innerHTML =\n        'Responsable: <b>' + esc(responsable) + '</b>' +\n        ' &nbsp;&nbsp;|&nbsp;&nbsp; Revisiones: <b>' +\n        registros.length +\n        '</b> &nbsp;&nbsp;|&nbsp;&nbsp; Mayor tiempo efectivo: <b>' +\n        esc(registros[0].tiempoRevision) +\n        '</b>';\n\n      let html = '';\n\n      registros.forEach(function(x,i){\n\n        let fondo = '';\n        let textoNivel = '';\n\n        if (x.clase === 'verde'){\n          fondo = 'background:#dcfce7;color:#166534;';\n          textoNivel = '🟢 NORMAL';\n        } else if (x.clase === 'amarillo'){\n          fondo = 'background:#fef3c7;color:#92400e;';\n          textoNivel = '🟡 DEMORA';\n        } else {\n          fondo = 'background:#fee2e2;color:#b91c1c;';\n          textoNivel = '🔴 DEMORA ALTA';\n        }\n\n        html += `\n          <tr>\n            <td>${i + 1}</td>\n            <td>${esc(x.fecha)}</td>\n            <td>${esc(x.placa)}</td>\n            <td>${esc(x.guardia)}</td>\n            <td>${esc(x.turno)}</td>\n            <td>${esc(x.tipoRevision)}</td>\n            <td>${esc(x.inicio)}</td>\n            <td>${esc(x.final)}</td>\n            <td>${esc(x.tiempoTotal)}</td>\n            <td style=\"font-weight:bold;${fondo}\">${esc(x.tiempoRevision)}</td>\n            <td style=\"font-weight:bold;${fondo}\">${textoNivel}</td>\n            <td>NORMAL</td>\n          </tr>\n        `;\n      });\n\n      tbody.innerHTML = html;\n\n      const card = document.getElementById('detalleResponsableCard');\n      if (card && card.scrollIntoView){\n        card.scrollIntoView({behavior:'smooth',block:'start'});\n      }\n    })\n    .withFailureHandler(function(e){\n      mensaje.style.display = 'block';\n      mensaje.innerText =\n        'Error al cargar detalle: ' + ((e && e.message) || e);\n      contenido.style.display = 'none';\n    })\n    .obtenerDetalleRevisionesResponsable(\n      filtros,\n      responsable,\n      USUARIO.usuario\n    );\n}\n\n\nfunction dibujarGraficoSimple(id,titulo,datos){\n  const dt = new google.visualization.DataTable();\n  dt.addColumn('string','Categoría');\n  dt.addColumn('number','Cantidad');\n  dt.addColumn({type:'string',role:'annotation'});\n  dt.addColumn({type:'string',role:'style'});\n\n  datos.forEach(function(d,i){\n    const n=Number(d.valor||0);\n    dt.addRow([d.nombre,n,String(n),'color: '+colorResponsable_(i)]);\n  });\n\n  new google.visualization.ColumnChart(document.getElementById(id)).draw(dt,{\n    title:titulo,\n    legend:{position:'none'},\n    annotations:{alwaysOutside:true,textStyle:{fontSize:12,bold:true}},\n    vAxis:{minValue:0},\n    chartArea:{left:70,top:60,width:'82%',height:'68%'}\n  });\n}\n\n\nfunction dibujarEvolucionGuiasMes(meses){\n  const dt = new google.visualization.DataTable();\n  dt.addColumn('string','Mes');\n  dt.addColumn('number','Guías revisadas');\n  dt.addColumn({type:'string',role:'annotation'});\n\n  meses.forEach(function(m){\n    const n=Number(m.totalGuias||0);\n    dt.addRow([m.mes,n,String(n)]);\n  });\n\n  new google.visualization.LineChart(document.getElementById('chartEvolucionGuiasMes')).draw(dt,{\n    title:'Evolución mensual de guías revisadas — últimos 12 meses',\n    legend:{position:'none'},\n    pointSize:7,\n    lineWidth:3,\n    annotations:{alwaysOutside:true,textStyle:{fontSize:11,bold:true}},\n    vAxis:{title:'Guías',minValue:0},\n    hAxis:{title:'Mes'},\n    chartArea:{left:75,top:65,width:'88%',height:'65%'}\n  });\n}\n\nfunction dibujarEvolucionGuiasResponsable(meses,responsables){\n  const dt = new google.visualization.DataTable();\n  dt.addColumn('string','Mes');\n\n  responsables.forEach(function(nombre){\n    dt.addColumn('number',nombre);\n  });\n\n  meses.forEach(function(m){\n    const fila=[m.mes];\n    responsables.forEach(function(nombre){\n      fila.push(Number((m.porResponsable||{})[nombre]||0));\n    });\n    dt.addRow(fila);\n  });\n\n  new google.visualization.LineChart(document.getElementById('chartEvolucionGuiasResponsable')).draw(dt,{\n    title:'Evolución mensual de guías por responsable — últimos 12 meses',\n    legend:{position:'top'},\n    colors:responsables.map(function(_,i){return colorResponsable_(i);}),\n    pointSize:6,\n    lineWidth:3,\n    vAxis:{title:'Guías',minValue:0},\n    hAxis:{title:'Mes'},\n    chartArea:{left:75,top:75,width:'80%',height:'60%'}\n  });\n}\n\nfunction dibujarEvolucionTiempoResponsable(meses,responsables){\n  const dt = new google.visualization.DataTable();\n  dt.addColumn('string','Mes');\n\n  responsables.forEach(function(nombre){\n    dt.addColumn('number',nombre);\n  });\n\n  meses.forEach(function(m){\n    const fila=[m.mes];\n    responsables.forEach(function(nombre){\n      const seg=Number((m.tiempoPromedioSeg||{})[nombre]||0);\n      fila.push(seg/60);\n    });\n    dt.addRow(fila);\n  });\n\n  new google.visualization.LineChart(document.getElementById('chartEvolucionTiempoResponsable')).draw(dt,{\n    title:'Evolución mensual del tiempo promedio de revisión por responsable — últimos 12 meses',\n    legend:{position:'top'},\n    colors:responsables.map(function(_,i){return colorResponsable_(i);}),\n    pointSize:6,\n    lineWidth:3,\n    vAxis:{title:'Minutos',minValue:0},\n    hAxis:{title:'Mes'},\n    chartArea:{left:80,top:75,width:'79%',height:'60%'}\n  });\n}\n\nfunction segundosATextoApp_(segundos){\n  segundos=Math.max(0,Math.round(Number(segundos||0)));\n  const h=Math.floor(segundos/3600);\n  segundos%=3600;\n  const m=Math.floor(segundos/60);\n  const s=segundos%60;\n  return [h,m,s].map(function(x){return String(x).padStart(2,'0');}).join(':');\n}\n\n// ======================================================\n// MODALES Y UTILIDADES\n// ======================================================\n\nfunction abrirModal(id){\n  document.getElementById(id).classList.add('abierto');\n}\n\nfunction cerrarModal(id){\n  document.getElementById(id).classList.remove('abierto');\n}\n\nfunction valor(id){\n  const e = document.getElementById(id);\n  return e ? String(e.value || '').trim() : '';\n}\n\nfunction setValor(id,v){\n  const e = document.getElementById(id);\n  if(e) e.value = (v === null || v === undefined) ? '' : v;\n}\n\nfunction fechaTexto(fecha){\n  return fecha.toLocaleString('es-PE',{\n    day:'2-digit',month:'2-digit',year:'numeric',\n    hour:'2-digit',minute:'2-digit',second:'2-digit',\n    hour12:false\n  });\n}\n\nfunction esc(v){\n  return String(v === null || v === undefined ? '' : v)\n    .replaceAll('&','&amp;')\n    .replaceAll('<','&lt;')\n    .replaceAll('>','&gt;')\n    .replaceAll('\"','&quot;')\n    .replaceAll(\"'\",\"&#039;\");\n}\n\nfunction escJS(v){\n  return String(v === null || v === undefined ? '' : v)\n    .replaceAll('\\\\','\\\\\\\\')\n    .replaceAll(\"'\",\"\\\\'\");\n}\n// ==========================================================\n// SACOS MINEROS — VERSIÓN FINAL\n// ==========================================================\nlet TIPO_SACO_ACTUAL = 'INGRESO';\nlet LISTA_ACOPIADORES_SACOS = [];\nlet DETALLE_SALIDA_SACOS = [];\n\nfunction cargarAcopiadoresGenerales(){\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok){ console.error((r && r.mensaje) || 'No se cargaron acopiadores.'); return; }\n      LISTA_ACOPIADORES_SACOS = r.acopiadores || [];\n      llenarSelectAcopiadores_('acopiador');\n      llenarSelectAcopiadores_('sacoSalidaAcopiador');\n      llenarSelectZonasPunto1_();\n    })\n    .withFailureHandler(function(e){ console.error('Error al cargar acopiadores',e); })\n    .obtenerAcopiadoresSacosBD();\n}\n\nfunction llenarSelectAcopiadores_(id){\n  const s=document.getElementById(id); if(!s) return;\n  const actual=s.value;\n  s.innerHTML='<option value=\"\">Seleccione</option>';\n  LISTA_ACOPIADORES_SACOS.forEach(function(a){\n    const o=document.createElement('option');\n    o.value=a.nombre || ''; o.textContent=a.nombre || '';\n    o.dataset.zona=a.zona || ''; o.dataset.dni=a.dni || ''; o.dataset.cargo=a.cargo || '';\n    s.appendChild(o);\n  });\n  if(actual) s.value=actual;\n}\n\nfunction llenarSelectZonasPunto1_(){\n  const s=document.getElementById('zona');\n  if(!s) return;\n\n  const actual=s.value;\n  const zonas=[...new Set(\n    (LISTA_ACOPIADORES_SACOS||[])\n      .map(function(a){return String(a.zona||'').trim().toUpperCase();})\n      .filter(Boolean)\n  )].sort(function(a,b){return a.localeCompare(b,'es');});\n\n  s.innerHTML='<option value=\"\">Seleccione</option>';\n\n  zonas.forEach(function(z){\n    const o=document.createElement('option');\n    o.value=z;\n    o.textContent=z;\n    s.appendChild(o);\n  });\n\n  if(actual && zonas.includes(String(actual).toUpperCase())){\n    s.value=String(actual).toUpperCase();\n  }\n}\n\nfunction cambiarAcopiadorPunto1(){\n  // En Registro de Guías, la zona es de escritura libre.\n  programarGuardadoBorrador();\n}\n\nfunction inicializarModuloSacos(){\n  actualizarFechasSacos();\n  llenarSelectAcopiadores_('sacoSalidaAcopiador');\n  seleccionarTipoSaco(TIPO_SACO_ACTUAL || 'INGRESO');\n  dibujarDetalleSalidaSacos();\n  cargarRegistroSacos();\n\n  // Al abrir el módulo, cargar automáticamente TODO el acumulado disponible.\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok) return;\n\n      if(r.desde) setValor('sacoReporteDesde',r.desde);\n      if(r.hasta) setValor('sacoReporteHasta',r.hasta);\n\n      cargarReporteMensualSacos();\n    })\n    .obtenerRangoDisponibleSacosBD();\n}\n\nfunction actualizarFechasSacos(){\n  const f=fechaTexto(new Date());\n  setValor('sacoIngresoFecha',f); setValor('sacoSalidaFecha',f);\n}\n\n\nfunction cambiarResponsableZonaSacos(){\n  const s=document.getElementById('sacoSalidaAcopiador');\n  if(!s)return;\n  const o=s.options[s.selectedIndex];\n  const zona=(o&&o.dataset.zona)?String(o.dataset.zona).trim().toUpperCase():'';\n  setValor('sacoSalidaZona',zona);\n}\n\nfunction seleccionarTipoSaco(tipo){\n  TIPO_SACO_ACTUAL=tipo;\n  const ingreso=tipo==='INGRESO';\n  document.getElementById('formIngresoSaco').classList.toggle('oculto',!ingreso);\n  document.getElementById('formSalidaSaco').classList.toggle('oculto',ingreso);\n  document.getElementById('btnTipoIngresoSaco').className=ingreso?'btn verde':'btn gris';\n  document.getElementById('btnTipoSalidaSaco').className=ingreso?'btn gris':'btn naranja';\n  actualizarFechasSacos();\n}\n\nfunction registrarIngresoSaco(){\n  if(!USUARIO) return;\n  const responsable=valor('sacoIngresoResponsable');\n  const descripcion=valor('sacoIngresoDescripcion');\n  const cantidad=Number(valor('sacoIngresoCantidad'));\n  const unidad=valor('sacoIngresoUnidad') || 'UND';\n  if(!responsable){alert('Ingrese el responsable.');return;}\n  if(!descripcion){alert('Seleccione la descripción.');return;}\n  if(!cantidad || cantidad<=0){alert('Ingrese una cantidad válida.');return;}\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok){alert((r&&r.mensaje)||'No se pudo registrar.');return;}\n      alert('INGRESO REGISTRADO CORRECTAMENTE.');\n      setValor('sacoIngresoDescripcion',''); setValor('sacoIngresoCantidad','');\n      actualizarFechasSacos(); cargarRegistroSacos(); refrescarReporteSacosActual();\n    })\n    .withFailureHandler(function(e){alert('Error: '+((e&&e.message)||e));})\n    .registrarMovimientoSacosBD({tipo:'INGRESO',descripcion:descripcion,cantidad:cantidad,unidad:unidad,responsable:responsable,usuario:USUARIO.usuario,nombreUsuario:USUARIO.nombre,observacion:valor('sacoIngresoObservacion')});\n}\n\nfunction agregarDetalleSalidaSaco(){\n  const descripcion=valor('nuevoMaterialSaco');\n  const cantidad=Number(valor('nuevaCantidadSaco'));\n  const unidad=valor('nuevaUnidadSaco') || 'UND';\n  if(!descripcion){alert('Seleccione la descripción.');return;}\n  if(!cantidad || cantidad<=0){alert('Ingrese una cantidad válida.');return;}\n  const i=DETALLE_SALIDA_SACOS.findIndex(function(x){return x.descripcion===descripcion;});\n  if(i>=0){DETALLE_SALIDA_SACOS[i].cantidad+=cantidad;DETALLE_SALIDA_SACOS[i].unidad=unidad;}\n  else DETALLE_SALIDA_SACOS.push({descripcion:descripcion,cantidad:cantidad,unidad:unidad});\n  setValor('nuevoMaterialSaco','');setValor('nuevaCantidadSaco','');setValor('nuevaUnidadSaco','UND');\n  dibujarDetalleSalidaSacos();\n}\n\nfunction dibujarDetalleSalidaSacos(){\n  const c=document.getElementById('listaDetalleSalidaSacos'); if(!c) return;\n  if(!DETALLE_SALIDA_SACOS.length){c.innerHTML='<div class=\"sacos-help\">Agregue uno o varios materiales para esta salida.</div>';return;}\n  c.innerHTML=DETALLE_SALIDA_SACOS.map(function(x,i){return `\n    <div class=\"sacos-detalle-row\">\n      <input value=\"${esc(x.descripcion)}\" readonly>\n      <input type=\"number\" min=\"1\" value=\"${esc(x.cantidad)}\" onchange=\"cambiarCantidadDetalleSaco(${i},this.value)\">\n      <select onchange=\"cambiarUnidadDetalleSaco(${i},this.value)\"><option value=\"UND\" ${x.unidad==='UND'?'selected':''}>UND</option><option value=\"PAQUETE\" ${x.unidad==='PAQUETE'?'selected':''}>PAQUETE</option></select>\n      <button class=\"accion eliminar\" onclick=\"eliminarDetalleSalidaSaco(${i})\">🗑</button>\n    </div>`;}).join('');\n}\n\nfunction cambiarCantidadDetalleSaco(i,v){v=Number(v);if(!v||v<=0){alert('Cantidad inválida.');dibujarDetalleSalidaSacos();return;}if(DETALLE_SALIDA_SACOS[i])DETALLE_SALIDA_SACOS[i].cantidad=v;}\nfunction cambiarUnidadDetalleSaco(i,v){if(DETALLE_SALIDA_SACOS[i])DETALLE_SALIDA_SACOS[i].unidad=String(v||'UND').toUpperCase();}\nfunction eliminarDetalleSalidaSaco(i){DETALLE_SALIDA_SACOS.splice(i,1);dibujarDetalleSalidaSacos();}\n\nfunction cambiarAcopiadorSaco(){\n  const s=document.getElementById('sacoSalidaAcopiador');\n  if(!s) return;\n  const o=s.options[s.selectedIndex];\n  if(o && o.dataset.zona) setValor('sacoSalidaZona',o.dataset.zona);\n}\n\nfunction registrarSalidaSaco(){\n  if(!USUARIO) return;\n  const zona=valor('sacoSalidaZona').toUpperCase();\n  const acopiador=valor('sacoSalidaAcopiador');\n  const destinatario=valor('sacoSalidaDestinatario').toUpperCase();\n  const placa=valor('sacoSalidaPlaca').toUpperCase();\n  if(!zona){alert('Ingrese la zona.');return;}\n  if(!acopiador){alert('Seleccione el acopiador.');return;}\n  if(!destinatario){alert('Ingrese el destinatario.');return;}\n  if(!placa){alert('Ingrese la placa.');return;}\n  if(!DETALLE_SALIDA_SACOS.length){alert('Agregue al menos un material.');return;}\n  if(!confirm('¿Registrar esta salida?\\n\\nTodos los materiales tendrán UN SOLO N° DE CARGO.')) return;\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok){alert((r&&r.mensaje)||'No se pudo registrar la salida.');return;}\n      alert('SALIDA REGISTRADA CORRECTAMENTE.\\n\\nN° CARGO: '+(r.cargo||''));\n      limpiarSalidaSacos(); cargarRegistroSacos(); refrescarReporteSacosActual();\n    })\n    .withFailureHandler(function(e){alert('Error: '+((e&&e.message)||e));})\n    .registrarSalidaMultipleSacosBD({usuario:USUARIO.usuario,nombreUsuario:USUARIO.nombre,responsable:USUARIO.nombre,zona:zona,acopiador:acopiador,destinatario:destinatario,placa:placa,observacion:valor('sacoSalidaObservacion'),detalle:DETALLE_SALIDA_SACOS});\n}\n\nfunction limpiarSalidaSacos(){\n  ['sacoSalidaZona','sacoSalidaAcopiador','sacoSalidaDestinatario','sacoSalidaPlaca','sacoSalidaObservacion','nuevoMaterialSaco','nuevaCantidadSaco'].forEach(function(id){setValor(id,'');});\n  setValor('nuevaUnidadSaco','UND'); DETALLE_SALIDA_SACOS=[]; dibujarDetalleSalidaSacos(); actualizarFechasSacos();\n}\n\nfunction cargarRegistroSacos(desde,hasta){\n  const tb=document.getElementById('cuerpoRegistroSacos'); if(!tb)return;\n  tb.innerHTML='<tr><td colspan=\"14\">Cargando...</td></tr>';\n  google.script.run\n    .withSuccessHandler(function(r){if(!r||!r.ok){tb.innerHTML='<tr><td colspan=\"14\">No se pudo cargar.</td></tr>';return;}dibujarRegistroSacos(r.registros||[]);})\n    .withFailureHandler(function(e){tb.innerHTML='<tr><td colspan=\"14\" style=\"color:red\">'+esc((e&&e.message)||e)+'</td></tr>';})\n    .obtenerRegistroSacosBD({desde:desde||'',hasta:hasta||''});\n}\n\nfunction dibujarRegistroSacos(datos){\n  const tb=document.getElementById('cuerpoRegistroSacos');\n  if(!datos.length){tb.innerHTML='<tr><td colspan=\"14\">Sin registros</td></tr>';return;}\n  const admin=USUARIO && String(USUARIO.rol||'').toUpperCase()==='ADMIN';\n  tb.innerHTML=datos.map(function(r,i){\n    const salida=String(r.tipo||'').toUpperCase()==='SALIDA';\n    let a=`<button class=\"accion azul\" onclick=\"verMovimientoSaco('${escJS(r.id)}')\">👁 VER</button>`;\n    if(admin) a+=`<button class=\"accion naranja\" onclick=\"editarMovimientoSaco('${escJS(r.id)}')\">EDITAR</button><button class=\"accion eliminar\" onclick=\"eliminarMovimientoSaco('${escJS(r.id)}')\">🗑</button>`;\n    if(salida && r.cargo) a+=`<button class=\"accion verde\" onclick=\"imprimirCargoSacos('${escJS(r.cargo)}')\">🖨 IMPRIMIR</button>`;\n    return `<tr><td>${i+1}</td><td>${esc(r.cargo||'-')}</td><td>${esc(r.nombreUsuario||r.usuario||'')}</td><td>${esc(r.fechaHora)}</td><td>${esc(r.tipo)}</td><td>${esc(r.descripcion)}</td><td>${esc(formatearMilesApp_(r.cantidad))}</td><td>${esc(r.unidad||'UND')}</td><td>${esc(r.responsable)}</td><td>${esc(r.zona||'-')}</td><td>${esc(r.acopiador||'-')}</td><td>${esc(r.destinatario||'-')}</td><td>${esc(r.placa||'-')}</td><td>${a}</td></tr>`;\n  }).join('');\n}\n\nfunction filtrarRegistroSacos(){const d=valor('sacoFiltroDesde'),h=valor('sacoFiltroHasta');if(d&&h&&d>h){alert('La fecha DESDE no puede ser mayor que HASTA.');return;}cargarRegistroSacos(d,h);}\nfunction limpiarFiltroSacos(){setValor('sacoFiltroDesde','');setValor('sacoFiltroHasta','');cargarRegistroSacos();}\n\nfunction verMovimientoSaco(id){abrirMovimientoSaco(id,false);}\nfunction editarMovimientoSaco(id){if(!USUARIO||String(USUARIO.rol||'').toUpperCase()!=='ADMIN'){alert('Solo el administrador puede editar.');return;}abrirMovimientoSaco(id,true);}\nfunction abrirMovimientoSaco(id,editar){\n  google.script.run.withSuccessHandler(function(r){\n    if(!r||!r.ok){alert((r&&r.mensaje)||'No se encontró.');return;}\n    const m=r.movimiento||{};\n    setValor('sacoModalId',m.id);setValor('sacoModalCargo',m.cargo||'-');setValor('sacoModalFecha',m.fechaHora);setValor('sacoModalTipo',m.tipo);setValor('sacoModalDescripcion',m.descripcion);setValor('sacoModalCantidad',m.cantidad);setValor('sacoModalUnidad',m.unidad||'UND');setValor('sacoModalResponsable',m.responsable);setValor('sacoModalZona',m.zona);setValor('sacoModalAcopiador',m.acopiador);setValor('sacoModalDestinatario',m.destinatario);setValor('sacoModalPlaca',m.placa);setValor('sacoModalObservacion',m.observacion||'');\n    ['sacoModalTipo','sacoModalDescripcion','sacoModalCantidad','sacoModalUnidad','sacoModalResponsable','sacoModalZona','sacoModalAcopiador','sacoModalDestinatario','sacoModalPlaca','sacoModalObservacion'].forEach(function(c){document.getElementById(c).disabled=!editar;});\n    document.getElementById('btnGuardarEdicionSaco').style.display=editar?'inline-block':'none';\n    document.getElementById('tituloModalSacos').innerText=editar?'EDITAR MOVIMIENTO':'DETALLE DEL MOVIMIENTO'; abrirModal('modalSacos');\n  }).obtenerMovimientoSacosBD(id);\n}\n\nfunction guardarEdicionSaco(){\n  if(!USUARIO || String(USUARIO.rol||'').toUpperCase()!=='ADMIN') return;\n\n  const obligatorios = [\n    ['sacoModalCargo','N° Cargo'],\n    ['sacoModalFecha','Fecha y hora'],\n    ['sacoModalTipo','Tipo'],\n    ['sacoModalDescripcion','Descripción'],\n    ['sacoModalCantidad','Cantidad'],\n    ['sacoModalUnidad','Unidad'],\n    ['sacoModalResponsable','Responsable'],\n    ['sacoModalZona','Zona'],\n    ['sacoModalAcopiador','Responsable de zona'],\n    ['sacoModalDestinatario','Entregado a'],\n    ['sacoModalPlaca','Placa']\n  ];\n\n  for(const item of obligatorios){\n    const el=document.getElementById(item[0]);\n    const v=String(el ? el.value : '').trim();\n\n    if(!v){\n      alert('El campo \"'+item[1]+'\" es obligatorio.');\n      if(el && !el.readOnly && !el.disabled) el.focus();\n      return;\n    }\n  }\n\n  const cantidad=Number(valor('sacoModalCantidad')||0);\n  if(!isFinite(cantidad) || cantidad<=0){\n    alert('La Cantidad debe ser mayor que 0.');\n    document.getElementById('sacoModalCantidad').focus();\n    return;\n  }\n\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok){\n        alert((r&&r.mensaje)||'No se pudo actualizar.');\n        return;\n      }\n\n      cerrarModal('modalSacos');\n      cargarRegistroSacos();\n      refrescarReporteSacosActual();\n      alert('Movimiento actualizado.');\n    })\n    .withFailureHandler(function(e){\n      alert('Error al guardar cambios: '+((e&&e.message)||e));\n    })\n    .editarMovimientoSacosBD({\n      id:valor('sacoModalId'),\n      cargo:valor('sacoModalCargo'),\n      fechaHora:valor('sacoModalFecha'),\n      tipo:valor('sacoModalTipo'),\n      descripcion:valor('sacoModalDescripcion'),\n      cantidad:valor('sacoModalCantidad'),\n      unidad:valor('sacoModalUnidad'),\n      responsable:valor('sacoModalResponsable'),\n      zona:valor('sacoModalZona'),\n      acopiador:valor('sacoModalAcopiador'),\n      destinatario:valor('sacoModalDestinatario'),\n      placa:valor('sacoModalPlaca'),\n      observacion:valor('sacoModalObservacion'),\n      usuarioAdmin:USUARIO.usuario\n    });\n}\n\nfunction eliminarMovimientoSaco(id){\n  if(!USUARIO||String(USUARIO.rol||'').toUpperCase()!=='ADMIN')return;\n  if(!confirm('¿Eliminar este movimiento?'))return;\n  google.script.run.withSuccessHandler(function(r){if(!r||!r.ok){alert((r&&r.mensaje)||'No se pudo eliminar.');return;}cargarRegistroSacos();refrescarReporteSacosActual();alert('Movimiento eliminado.');})\n  .eliminarMovimientoSacosBD({id:id,usuario:USUARIO.usuario});\n}\n\nfunction refrescarReporteSacosActual(){\n  cargarReporteMensualSacos();\n}\n\nfunction cargarResumenStockSacos(){\n  google.script.run.withSuccessHandler(function(r){\n    if(!r||!r.ok)return;\n    const d=r.detalle||{},a=d['SACOS AMARILLOS']||{};\n    const el=document.getElementById('stockAmarillos');\n    if(el) el.innerText=a.stock||0;\n    google.charts.setOnLoadCallback(function(){\n      dibujarStockSaco_('chartStockAmarillosSacos','Sacos amarillos',a);\n    });\n  }).obtenerResumenStockSacosBD();\n}\n\nfunction dibujarStockSaco_(id,titulo,x){\n  const dt=new google.visualization.DataTable();\n  dt.addColumn('string','Concepto');\n  dt.addColumn('number','Cantidad');\n  dt.addColumn({type:'string',role:'annotation'});\n  dt.addColumn({type:'string',role:'style'});\n\n  const stockInicial=Number(x.stockInicial||0);\n  const ingreso=Number(x.ingreso||0);\n  const salida=Number(x.salida||0);\n  const stock=Number(x.stock||0);\n\n  dt.addRows([\n    ['Stock inicial',stockInicial,formatearMilesApp_(stockInicial),'color: #1683e8'],\n    ['Ingreso',ingreso,formatearMilesApp_(ingreso),'color: #16a34a'],\n    ['Salida',salida,formatearMilesApp_(salida),'color: #dc2626'],\n    ['Stock final',stock,formatearMilesApp_(stock),'color: #eab308']\n  ]);\n\n  new google.visualization.ColumnChart(document.getElementById(id)).draw(dt,{\n    title:titulo,\n    legend:{position:'none'},\n    height:300,\n    annotations:{alwaysOutside:true,textStyle:{fontSize:12,bold:true}},\n    vAxis:{minValue:0},\n    chartArea:{left:75,top:55,width:'80%',height:'68%'}\n  });\n}\n\nfunction cargarReporteMensualSacos(){\n\n  const tipoSaco = valor('sacoReporteTipo');\n  const desde = valor('sacoReporteDesde');\n  const hasta = valor('sacoReporteHasta');\n\n  if(!tipoSaco){\n    alert('Seleccione el TIPO DE SACO.');\n    return;\n  }\n\n  if(!desde || !hasta){\n    alert('Seleccione DESDE y HASTA.');\n    return;\n  }\n\n  if(desde > hasta){\n    alert('La fecha DESDE no puede ser mayor que HASTA.');\n    return;\n  }\n\n  google.script.run\n    .withSuccessHandler(function(r){\n\n      if(!r || !r.ok){\n        alert((r && r.mensaje) || 'No se pudo cargar el reporte.');\n        return;\n      }\n\n      const a = r.resumen || {};\n\n      // ============================\n      // TABLA RESUMEN\n      // ============================\n\n      const elStockInicial =\n        document.getElementById('repStockInicialAmarillo');\n\n      const elIngreso =\n        document.getElementById('repIngresoAmarillo');\n\n      const elSalida =\n        document.getElementById('repSalidaAmarillo');\n\n      const elStockFinal =\n        document.getElementById('repStockAmarillo');\n\n      if(elStockInicial){\n        elStockInicial.innerText =\n          formatearMilesApp_(a.stockInicial);\n      }\n\n      if(elIngreso){\n        elIngreso.innerText =\n          formatearMilesApp_(a.ingreso);\n      }\n\n      if(elSalida){\n        elSalida.innerText =\n          formatearMilesApp_(a.salida);\n      }\n\n      if(elStockFinal){\n        elStockFinal.innerText =\n          formatearMilesApp_(a.stockFinal);\n      }\n\n\n      // ============================\n      // STOCK ACTUAL\n      // SOLO DEL TIPO SELECCIONADO\n      // ============================\n\n      const tituloStock =\n        document.getElementById('tituloStockActualSacos');\n\n      const nombreStock =\n        document.getElementById('nombreStockActualSacos');\n\n      const valorStock =\n        document.getElementById('stockActualSeleccionado');\n\n      if(tituloStock){\n        tituloStock.innerText = 'STOCK ACTUAL';\n      }\n\n      if(nombreStock){\n        nombreStock.innerText = tipoSaco;\n      }\n\n      if(valorStock){\n        valorStock.innerText =\n          formatearMilesApp_(a.stockActual);\n      }\n\n\n      // ============================\n      // TÍTULO MOVIMIENTO\n      // ============================\n\n      const tituloMovimiento =\n        document.getElementById('tituloMovimientoSacos');\n\n      if(tituloMovimiento){\n        tituloMovimiento.innerText =\n          'MOVIMIENTO DE ' + tipoSaco;\n      }\n\n\n      // ============================\n      // GRÁFICO PRINCIPAL\n      // ============================\n\n      google.charts.setOnLoadCallback(function(){\n\n        dibujarStockSaco_(\n          'chartStockAmarillosSacos',\n          tipoSaco,\n          {\n            stockInicial:a.stockInicial,\n            ingreso:a.ingreso,\n            salida:a.salida,\n            stock:a.stockFinal\n          }\n        );\n\n      });\n\n      // ============================\n      // TÍTULOS VISIBLES DEL REPORTE\n      // ============================\n\n      const tituloReporte = document.getElementById('tituloReporteSacos');\n      if(tituloReporte){\n        tituloReporte.innerText = '3. REPORTE DE ' + tipoSaco;\n      }\n\n      const tituloZonas = document.getElementById('tituloZonasSacos');\n      if(tituloZonas){\n        tituloZonas.innerText = 'SALIDAS DE ' + tipoSaco + ' POR ZONA';\n      }\n\n      // ============================\n      // GRÁFICO SALIDAS POR ZONA\n      // ============================\n\n      cargarZonasSacos(\n        desde,\n        hasta,\n        tipoSaco\n      );\n\n      // ============================\n      // EVOLUCIÓN MENSUAL\n      // ============================\n      cargarEvolucionSalidaSacosFija(\n        hasta,\n        tipoSaco\n      );\n\n      // ============================\n      // EVOLUCIÓN MENSUAL POR ZONA\n      // ============================\n      const selectZona = document.getElementById('filtroZonaEvolucionSacos');\n      cargarEvolucionZonaSacosFija(\n        (selectZona && selectZona.value) ? selectZona.value : 'CHALA',\n        tipoSaco\n      );\n\n    })\n    .withFailureHandler(function(e){\n\n      alert(\n        'Error al cargar reporte: ' +\n        ((e && e.message) || e)\n      );\n\n    })\n    .obtenerReporteRangoSacosBD(\n      desde,\n      hasta,\n      tipoSaco\n    );\n}\n\nfunction limpiarFiltroReporteSacos(){\n  google.script.run\n    .withSuccessHandler(function(r){\n      if(!r || !r.ok) return;\n      setValor('sacoReporteDesde',r.desde||'');\n      setValor('sacoReporteHasta',r.hasta||'');\n      cargarReporteMensualSacos();\n    })\n    .obtenerRangoDisponibleSacosBD();\n}\n\n\nfunction cargarEvolucionSalidaSacosFija(hasta, tipoSaco){\n\n  tipoSaco = String(\n    tipoSaco ||\n    valor('sacoReporteTipo') ||\n    'SACOS AMARILLOS'\n  ).trim().toUpperCase();\n\n  google.script.run\n    .withSuccessHandler(function(ev){\n\n      const cont = document.getElementById('chartEvolucionSalidaSacos');\n\n      if(!ev || !ev.ok){\n        if(cont){\n          cont.innerHTML =\n            '<div style=\"padding:30px;color:#b91c1c\">' +\n            esc((ev && ev.mensaje) || 'No se pudo cargar la evolución mensual.') +\n            '</div>';\n        }\n        return;\n      }\n\n      dibujarEvolucionSalidaSacos(\n        ev.meses || [],\n        ev.tipoSaco || tipoSaco\n      );\n    })\n    .withFailureHandler(function(e){\n\n      const cont = document.getElementById('chartEvolucionSalidaSacos');\n\n      if(cont){\n        cont.innerHTML =\n          '<div style=\"padding:30px;color:#b91c1c\">Error al cargar gráfico: ' +\n          esc((e && e.message) || e) +\n          '</div>';\n      }\n    })\n    .obtenerEvolucionMensualSacosBD(\n      hasta,\n      12,\n      tipoSaco\n    );\n}\n\nfunction dibujarEvolucionSalidaSacos(meses, tipoSaco){\n\n  const cont = document.getElementById('chartEvolucionSalidaSacos');\n  if(!cont) return;\n\n  if(!window.google || !google.visualization){\n    cont.innerHTML =\n      '<div style=\"padding:30px;color:#b91c1c\">Google Charts todavía no está disponible.</div>';\n    return;\n  }\n\n  tipoSaco = String(tipoSaco || 'SACOS AMARILLOS').trim().toUpperCase();\n\n  const dt = new google.visualization.DataTable();\n\n  dt.addColumn('string','Mes');\n  dt.addColumn('number','Salidas');\n  dt.addColumn({type:'string',role:'annotation'});\n\n  (meses || []).forEach(function(m){\n    const n = Number(m.salida || 0);\n\n    dt.addRow([\n      String(m.mes || ''),\n      n,\n      formatearMilesApp_(n)\n    ]);\n  });\n\n  if(dt.getNumberOfRows() === 0){\n    cont.innerHTML =\n      '<div style=\"padding:30px;color:#64748b\">No existen datos mensuales para mostrar.</div>';\n    return;\n  }\n\n  const chart = new google.visualization.LineChart(cont);\n\n  chart.draw(dt,{\n    title:'Evolución mensual de salidas — ' + tipoSaco.toLowerCase(),\n    legend:{position:'none'},\n    pointSize:7,\n    lineWidth:3,\n    annotations:{\n      alwaysOutside:true,\n      textStyle:{fontSize:11,bold:true}\n    },\n    vAxis:{\n      title:'Cantidad',\n      minValue:0,\n      format:'#,##0'\n    },\n    hAxis:{\n      title:'Mes',\n      slantedText:false\n    },\n    chartArea:{\n      left:90,\n      top:65,\n      width:'86%',\n      height:'65%'\n    }\n  });\n}\n\nfunction cargarZonasSacos(desde, hasta, tipoSaco){\n\n  google.script.run\n    .withSuccessHandler(function(r){\n\n      if(!r || !r.ok) return;\n\n      google.charts.setOnLoadCallback(function(){\n\n        const cont = document.getElementById('chartZonasSacos');\n\n        if(!cont) return;\n\n        const zonas = (r.zonas || []);\n\n        const dt = new google.visualization.DataTable();\n\n        dt.addColumn('string','Zona');\n        dt.addColumn('number','Cantidad');\n        dt.addColumn({type:'string',role:'annotation'});\n        dt.addColumn({type:'string',role:'style'});\n\n        function colorZona_(i,total){\n\n          const inicio = [79,70,229];\n          const fin = [199,210,254];\n\n          const t = total <= 1\n            ? 0\n            : i / (total - 1);\n\n          const rgb = inicio.map(function(v,j){\n\n            return Math.round(\n              v + (fin[j] - v) * t\n            );\n\n          });\n\n          return 'color: rgb(' + rgb.join(',') + ')';\n        }\n\n        zonas.forEach(function(z,i){\n\n          const n = Number(z.cantidad || 0);\n\n          dt.addRow([\n            String(z.zona || ''),\n            n,\n            formatearMilesApp_(n),\n            colorZona_(i,zonas.length)\n          ]);\n\n        });\n\n\n        const alto = Math.max(\n          360,\n          zonas.length * 40 + 120\n        );\n\n        cont.style.height = alto + 'px';\n\n\n        // ======================================\n        // TÍTULO SEGÚN TIPO DE SACO\n        // ======================================\n\n        let titulo = 'Salidas por zona';\n\n        if(tipoSaco === 'SACOS AMARILLOS'){\n          titulo = 'Salidas de sacos amarillos por zona';\n        }\n\n        if(tipoSaco === 'SACOS BLANCOS'){\n          titulo = 'Salidas de sacos blancos por zona';\n        }\n\n\n        new google.visualization.BarChart(cont).draw(\n          dt,\n          {\n            legend:{\n              position:'none'\n            },\n\n            height:alto,\n\n            title:titulo,\n\n            annotations:{\n              alwaysOutside:true,\n              textStyle:{\n                fontSize:11,\n                bold:true\n              }\n            },\n\n            hAxis:{\n              minValue:0,\n              format:'#,##0',\n              textStyle:{\n                fontSize:11\n              }\n            },\n\n            vAxis:{\n              textStyle:{\n                fontSize:12\n              },\n              slantedText:false\n            },\n\n            chartArea:{\n              left:250,\n              top:55,\n              width:'70%',\n              height:'78%'\n            }\n          }\n        );\n\n      });\n\n    })\n\n    .withFailureHandler(function(e){\n\n      console.log(\n        'Error gráfico por zona:',\n        (e && e.message) || e\n      );\n\n    })\n\n    .obtenerSalidasPorZonaSacosBD(\n      desde,\n      hasta,\n      tipoSaco\n    );\n}\n\nfunction cargarEvolucionZonaSacosFija(zonaPreferida, tipoSaco){\n\n  tipoSaco = String(\n    tipoSaco ||\n    valor('sacoReporteTipo') ||\n    'SACOS AMARILLOS'\n  ).trim().toUpperCase();\n\n  google.script.run\n    .withSuccessHandler(function(r){\n\n      const cont = document.getElementById('chartEvolucionZonaSacos');\n\n      if(!r || !r.ok){\n        if(cont){\n          cont.innerHTML =\n            '<div style=\"padding:30px;color:#b91c1c\">' +\n            esc((r && r.mensaje) || 'No se pudo cargar la evolución por zona.') +\n            '</div>';\n        }\n        return;\n      }\n\n      const select = document.getElementById('filtroZonaEvolucionSacos');\n      const zonas = (r.zonas || []);\n\n      if(select){\n\n        const actual = String(\n          zonaPreferida ||\n          select.value ||\n          'CHALA'\n        ).trim().toUpperCase();\n\n        select.innerHTML = '';\n\n        zonas.forEach(function(z){\n          const op = document.createElement('option');\n          op.value = z;\n          op.textContent = z;\n          select.appendChild(op);\n        });\n\n        if(zonas.includes(actual)){\n          select.value = actual;\n        }else if(zonas.includes('CHALA')){\n          select.value = 'CHALA';\n        }else if(zonas.length){\n          select.value = zonas[0];\n        }\n      }\n\n      dibujarEvolucionZonaSacosFija(\n        r.meses || [],\n        r.zona || ((select && select.value) || 'CHALA'),\n        r.tipoSaco || tipoSaco\n      );\n    })\n    .withFailureHandler(function(e){\n\n      const cont = document.getElementById('chartEvolucionZonaSacos');\n\n      if(cont){\n        cont.innerHTML =\n          '<div style=\"padding:30px;color:#b91c1c\">Error al cargar evolución por zona: ' +\n          esc((e && e.message) || e) +\n          '</div>';\n      }\n    })\n    .obtenerEvolucionMensualZonaFijaSacosBD(\n      String(zonaPreferida || 'CHALA').trim().toUpperCase(),\n      tipoSaco\n    );\n}\n\nfunction cambiarZonaEvolucionSacos(){\n\n  const s = document.getElementById('filtroZonaEvolucionSacos');\n\n  const tipoSaco = String(\n    valor('sacoReporteTipo') ||\n    'SACOS AMARILLOS'\n  ).trim().toUpperCase();\n\n  cargarEvolucionZonaSacosFija(\n    s ? s.value : 'CHALA',\n    tipoSaco\n  );\n}\n\nfunction dibujarEvolucionZonaSacosFija(meses,zona,tipoSaco){\n  const cont=document.getElementById('chartEvolucionZonaSacos');\n  if(!cont)return;\n\n  if(!window.google || !google.visualization){\n    cont.innerHTML='<div style=\"padding:30px;color:#b91c1c\">Google Charts todavía no está disponible.</div>';\n    return;\n  }\n\n  const dt=new google.visualization.DataTable();\n  dt.addColumn('string','Mes');\n  dt.addColumn('number',zona);\n  dt.addColumn({type:'string',role:'annotation'});\n\n  (meses||[]).forEach(function(m){\n    const n=Number(m.salida||0);\n    dt.addRow([String(m.mes||''),n,n>0?formatearMilesApp_(n):'0']);\n  });\n\n  if(dt.getNumberOfRows()===0){\n    cont.innerHTML='<div style=\"padding:30px;color:#64748b\">No existen datos históricos para '+esc(zona)+'.</div>';\n    return;\n  }\n\n  const chart=new google.visualization.LineChart(cont);\n  chart.draw(dt,{\n    title:'Evolución mensual de salidas — '+zona+' — '+String(tipoSaco||'SACOS AMARILLOS').toLowerCase(),\n    legend:{position:'none'},\n    colors:['#0f9d8a'],\n    pointSize:7,\n    lineWidth:3,\n    annotations:{\n      alwaysOutside:true,\n      stem:{length:5},\n      textStyle:{fontSize:11,bold:true,auraColor:'#ffffff'}\n    },\n    vAxis:{\n      title:'Cantidad',\n      minValue:0,\n      format:'#,##0',\n      textStyle:{fontSize:11}\n    },\n    hAxis:{\n      title:'Mes',\n      slantedText:false,\n      textStyle:{fontSize:11}\n    },\n    chartArea:{left:90,top:70,width:'86%',height:'65%'},\n    height:420\n  });\n}\n\nfunction imprimirCargoSacos(cargo){\n  if(!cargo)return;\n  google.script.run.withSuccessHandler(function(r){if(!r||!r.ok){alert((r&&r.mensaje)||'No se encontró el cargo.');return;}construirCargoImpresion_(r.cargo,r.registros||[]);}).obtenerCargoSacosBD(cargo);\n}\n\nfunction construirCargoImpresion_(cargo,registros){\n  if(!registros.length)return;\n  const p=registros[0];\n  const filas=registros.map(function(r,i){return `<tr><td>${i+1}</td><td>${esc(r.descripcion)}</td><td>${esc(r.cantidad)}</td><td>${esc(r.unidad||'UND')}</td></tr>`;}).join('');\n  const w=window.open('','_blank');if(!w){alert('El navegador bloqueó la ventana de impresión.');return;}\n  const h=`<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Autorización de salida de sacos mineros</title><style>body{font-family:Arial;margin:25px;color:#000}.doc{max-width:900px;margin:auto;border:2px solid #000}.head{display:grid;grid-template-columns:170px 1fr 210px;border-bottom:2px solid #000;min-height:100px}.logo,.tit,.num{display:flex;align-items:center;justify-content:center;padding:10px}.logo{font-size:24px;font-weight:bold;border-right:1px solid #000}.tit{text-align:center;font-size:18px;font-weight:bold}.num{display:block;border-left:1px solid #000;font-size:12px;line-height:1.8}.body{padding:20px}.dato{display:grid;grid-template-columns:170px 1fr;border-bottom:1px solid #999;padding:8px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #000;padding:8px;text-align:center}th{background:#eee}.firmas{display:grid;grid-template-columns:1fr 1fr;gap:90px;margin:100px 40px 30px}.firma{border-top:1px solid #000;text-align:center;padding-top:7px;font-size:11px}@media print{body{margin:0}}</style></head><body><div class=\"doc\"><div class=\"head\"><div class=\"logo\">AMS</div><div class=\"tit\">AUTORIZACIÓN DE SALIDA<br>DE SACOS MINEROS</div><div class=\"num\"><b>N° CARGO:</b> ${esc(cargo)}<br><b>FECHA:</b> ${esc(p.fechaHora)}</div></div><div class=\"body\"><div class=\"dato\"><b>ZONA:</b><span>${esc(p.zona)}</span></div><div class=\"dato\"><b>RESPONSABLE DE ZONA:</b><span>${esc(p.acopiador)}</span></div><div class=\"dato\"><b>ENTREGADO A:</b><span>${esc(p.destinatario)}</span></div><div class=\"dato\"><b>PLACA:</b><span>${esc(p.placa)}</span></div><table><thead><tr><th>N°</th><th>DESCRIPCIÓN</th><th>CANTIDAD</th><th>UNIDAD</th></tr></thead><tbody>${filas}</tbody></table><div class=\"firmas\"><div class=\"firma\">RESPONSABLE DE ENTREGA<br>${esc(p.responsable)}</div><div class=\"firma\">RECIBÍ CONFORME<br>${esc(p.destinatario)}</div></div></div></div><script>window.onload=function(){setTimeout(function(){window.print();},300);};<\\/script></body></html>`;\n  w.document.open();w.document.write(h);w.document.close();\n}\n\n// =====================================================\n// MODO OFFLINE - COLA LOCAL Y SINCRONIZACION AUTOMATICA\n// =====================================================\nconst OFFLINE_KEY = 'controlGuiasOfflineV1';\nlet SINCRONIZANDO_OFFLINE = false;\n\nfunction offlineId_(){\n  return 'OFF-' + Date.now() + '-' + Math.random().toString(36).slice(2,8).toUpperCase();\n}\nfunction leerColaOffline_(){\n  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); }\n  catch(e){ return []; }\n}\nfunction guardarColaOffline_(cola){\n  localStorage.setItem(OFFLINE_KEY, JSON.stringify(cola || []));\n  actualizarEstadoConexion_();\n}\nfunction buscarOffline_(id){\n  return leerColaOffline_().find(x => x && x.idLocal === id) || null;\n}\nfunction upsertOffline_(reg){\n  const cola = leerColaOffline_();\n  const i = cola.findIndex(x => x && x.idLocal === reg.idLocal);\n  if(i >= 0) cola[i] = reg; else cola.push(reg);\n  guardarColaOffline_(cola);\n}\nfunction quitarOffline_(id){\n  guardarColaOffline_(leerColaOffline_().filter(x => x && x.idLocal !== id));\n}\nfunction esIdOffline_(id){ return String(id || '').indexOf('OFF-') === 0; }\nfunction duracionOffline_(ms){\n  ms = Math.max(0, Number(ms || 0));\n  let s = Math.floor(ms/1000), h=Math.floor(s/3600); s%=3600;\n  let m=Math.floor(s/60); s%=60;\n  return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');\n}\nfunction actualizarEstadoConexion_(){\n  let el = document.getElementById('estadoConexionOffline');\n  if(!el){\n    el=document.createElement('div');\n    el.id='estadoConexionOffline';\n    el.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;padding:8px 12px;border-radius:18px;font:700 12px Arial;box-shadow:0 2px 8px #0003;cursor:pointer;user-select:none';\n    el.title='Haz clic para sincronizar los registros pendientes';\n    el.onclick=sincronizarAhoraOffline_;\n    document.body.appendChild(el);\n  }\n  const n=leerColaOffline_().length;\n  if(navigator.onLine){\n    el.style.background='#d9ead3';\n    el.style.color='#274e13';\n    el.textContent='🟢 EN LÍNEA' + (n?' · '+n+' PENDIENTE(S) · CLIC PARA SINCRONIZAR':'');\n  } else {\n    el.style.background='#f4cccc';\n    el.style.color='#990000';\n    el.textContent='🔴 SIN INTERNET · '+n+' PENDIENTE(S)';\n  }\n}\n\nfunction sincronizarAhoraOffline_(){\n  const n = leerColaOffline_().length;\n\n  if(!n){\n    alert('NO HAY REGISTROS PENDIENTES POR SINCRONIZAR.');\n    actualizarEstadoConexion_();\n    return;\n  }\n\n  if(!navigator.onLine){\n    alert('SIN INTERNET\\n\\nHay '+n+' registro(s) pendiente(s). Conéctate a internet y vuelve a tocar la barra para sincronizar.');\n    return;\n  }\n\n  if(SINCRONIZANDO_OFFLINE){\n    alert('LA SINCRONIZACIÓN YA ESTÁ EN PROCESO.');\n    return;\n  }\n\n  const el = document.getElementById('estadoConexionOffline');\n  if(el){\n    el.style.background='#fff2cc';\n    el.style.color='#7f6000';\n    el.textContent='🔄 SINCRONIZANDO '+n+' PENDIENTE(S)...';\n  }\n\n  sincronizarPendientesOffline_();\n}\nfunction recepcionarOffline_(datos){\n  const ahora=Date.now(), id=offlineId_();\n  ID_ATENCION=id; RECEPCION_MS=ahora; INICIO_MS=0; FINAL_MS=0; EDITANDO_FINALIZADO=false;\n  upsertOffline_({idLocal:id, estado:'PENDIENTE', recepcionMs:ahora, inicioMs:0, finalMs:0, datos:datos, usuario:USUARIO||{}});\n  const f=fechaTexto(new Date(ahora));\n  setValor('fechaRecepcion',f); setValor('tiempoFechaRecepcion',f);\n  document.getElementById('estadoRecepcion').innerText='DOCUMENTOS RECEPCIONADOS · SIN INTERNET';\n  const btn=document.getElementById('btnRecepcion'); btn.innerText='RECEPCIONAR DOCUMENTOS'; btn.disabled=false;\n  copiarRecepcionARevision(); setValor('fechaInicio',''); setValor('fechaFinal','');\n  document.getElementById('tiempoEspera').innerText='00:00:00'; document.getElementById('tiempoRevision').innerText='00:00:00';\n  document.getElementById('btnInicio').innerText='▶ INICIAR REVISIÓN'; document.getElementById('btnInicio').disabled=false;\n  document.getElementById('btnFinal').innerText='■ FINALIZAR REVISIÓN'; document.getElementById('btnFinal').disabled=true;\n  const bn=document.getElementById('btnGuardarNuevo'); if(bn){bn.disabled=false;bn.innerText='💾 GUARDAR Y NUEVO REGISTRO';}\n  alert('SIN INTERNET\\n\\nEl registro quedó guardado en este equipo y se sincronizará automáticamente cuando regrese la conexión.');\n}\nfunction iniciarRevisionOffline_(){\n  const reg=buscarOffline_(ID_ATENCION); if(!reg){ alert('No se encontró el registro offline.'); return; }\n  reg.datos=datosRecepcionActual(); reg.inicioMs=Date.now(); reg.estado='PENDIENTE'; upsertOffline_(reg);\n  INICIO_MS=reg.inicioMs;\n  setValor('fechaInicio',fechaTexto(new Date(INICIO_MS)));\n  document.getElementById('tiempoEspera').innerText=duracionOffline_(INICIO_MS-RECEPCION_MS);\n  const bi=document.getElementById('btnInicio'); bi.innerText='✓ REVISIÓN INICIADA'; bi.disabled=true;\n  const bf=document.getElementById('btnFinal'); bf.innerText='■ FINALIZAR REVISIÓN'; bf.disabled=false;\n  const bn=document.getElementById('btnGuardarNuevo'); if(bn) bn.disabled=true;\n}\nfunction finalizarRevisionOffline_(){\n  const reg=buscarOffline_(ID_ATENCION); if(!reg){ alert('No se encontró el registro offline.'); return; }\n  reg.datos=datosFormularioActual(); reg.inicioMs=INICIO_MS||reg.inicioMs; reg.finalMs=Date.now(); reg.estado='FINALIZADO'; upsertOffline_(reg);\n  FINAL_MS=reg.finalMs;\n  setValor('fechaFinal',fechaTexto(new Date(FINAL_MS)));\n  document.getElementById('tiempoRevision').innerText=duracionOffline_(FINAL_MS-INICIO_MS);\n  const bf=document.getElementById('btnFinal'); bf.innerText='✓ REVISIÓN FINALIZADA'; bf.disabled=true;\n  const bn=document.getElementById('btnGuardarNuevo'); if(bn){bn.disabled=false;bn.innerText='💾 GUARDAR Y NUEVO REGISTRO';}\n  alert('REVISIÓN GUARDADA SIN INTERNET\\n\\nSe sincronizará automáticamente cuando regrese la conexión.');\n}\nfunction sincronizarPendientesOffline_(){\n  if(!navigator.onLine || SINCRONIZANDO_OFFLINE) return;\n  const cola=leerColaOffline_(); if(!cola.length){ actualizarEstadoConexion_(); return; }\n  SINCRONIZANDO_OFFLINE=true;\n  const reg=cola[0];\n  google.script.run.withSuccessHandler(function(r){\n    SINCRONIZANDO_OFFLINE=false;\n    if(r && r.ok){\n      const eraActual = ID_ATENCION === reg.idLocal;\n      quitarOffline_(reg.idLocal);\n      if(eraActual && r.idAtencion) ID_ATENCION=r.idAtencion;\n      setTimeout(sincronizarPendientesOffline_,250);\n    }else{\n      actualizarEstadoConexion_();\n      console.error('Pendiente offline no sincronizado',r);\n    }\n  }).withFailureHandler(function(e){\n    SINCRONIZANDO_OFFLINE=false; actualizarEstadoConexion_(); console.error('Sin conexión para sincronizar',e);\n  }).sincronizarRegistroOfflineBD(reg);\n}\nwindow.addEventListener('online',function(){ actualizarEstadoConexion_(); setTimeout(sincronizarPendientesOffline_,500); });\nwindow.addEventListener('offline',actualizarEstadoConexion_);\nwindow.addEventListener('load',function(){ actualizarEstadoConexion_(); if(navigator.onLine) setTimeout(sincronizarPendientesOffline_,1200); });\n\n</script>\n\n</body>\n</html>";

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
  const [cargoRows, setCargoRows] = useState<CargoRow[]>([blankCargoRow(1)]);
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

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null") as AppUser | null;
      if (saved?.user && saved?.name && saved?.role) {
        setCurrentUser(saved);
        setEvent(current => ({ ...current, responsible: saved.name }));
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
      const data = await sheetsApi<{ authenticated: boolean; user: string; name: string; role: string }>("login", { user, pin });
      const session: AppUser = { user: data.user, name: data.name, role: data.role };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setCurrentUser(session);
      setEvent(current => ({ ...current, responsible: session.name }));
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
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "linear-gradient(135deg,#eef3f6,#dfe9ee)", fontFamily: "Arial, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 410, background: "#fff", borderRadius: 18, padding: 28, boxShadow: "0 18px 50px rgba(0,0,0,.14)", border: "1px solid #dce5e9" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: "#667b86" }}>ANALYTICA MINERAL SERVICES SAC</div>
          <h1 style={{ margin: "10px 0 4px", fontSize: 25, color: "#18364a" }}>ATENCIÓN AL CLIENTE</h1>
          <div style={{ color: "#71838c", fontSize: 14 }}>Inicio de sesión</div>
        </div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 900, marginBottom: 6, color: "#344c59" }}>USUARIO</label>
        <input value={loginUser} onChange={e => { setLoginUser(e.target.value.toUpperCase()); setLoginError(""); }} onKeyDown={e => { if (e.key === "Enter") void login(); }} autoComplete="username" autoFocus placeholder="Ingresa tu usuario" style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 10, border: "1px solid #bdcbd2", fontSize: 16, marginBottom: 16, textTransform: "uppercase" }} />
        <label style={{ display: "block", fontSize: 12, fontWeight: 900, marginBottom: 6, color: "#344c59" }}>PIN</label>
        <input type="password" inputMode="numeric" value={loginPin} onChange={e => { setLoginPin(e.target.value.replace(/\D/g, "")); setLoginError(""); }} onKeyDown={e => { if (e.key === "Enter") void login(); }} autoComplete="current-password" placeholder="••••" style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 10, border: "1px solid #bdcbd2", fontSize: 18, marginBottom: 12, letterSpacing: 3 }} />
        {loginError && <div style={{ margin: "4px 0 12px", padding: "10px 12px", borderRadius: 9, background: "#fff1f1", color: "#a52020", fontSize: 13, fontWeight: 700 }}>{loginError}</div>}
        <button type="button" onClick={() => void login()} disabled={loginBusy} style={{ width: "100%", border: 0, borderRadius: 10, padding: "14px 16px", fontWeight: 900, fontSize: 14, cursor: loginBusy ? "wait" : "pointer", background: "#18364a", color: "#fff", opacity: loginBusy ? .7 : 1 }}>{loginBusy ? "VALIDANDO..." : "INICIAR SESIÓN"}</button>
      </div>
    </main>;
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">AC</span><div><strong>Atención al Cliente</strong><small>Control de ingresos</small></div></div>
      <nav aria-label="Navegación principal">
        <button className={activeView === "registro" ? "nav-item active" : "nav-item"} onClick={startNewEntry}><span>＋</span> Nuevo ingreso</button>
        <button className={activeView === "hoy" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("hoy"); void loadToday(); }}><span>▦</span> Reporte diario</button>
        <button className={activeView === "pendientes" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("pendientes"); void loadPending(); }}><span>◷</span> Por regularizar {pendingEvents.length > 0 && <b>{pendingEvents.length}</b>}</button>
        <button className={activeView === "buscar" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("buscar")}><span>⌕</span> Buscar</button>
        <button className={activeView === "personas" ? "nav-item active" : "nav-item"} onClick={() => { setActiveView("personas"); void loadClients(); }}><span>◎</span> BD Clientes</button>
        <button className={activeView === "cargos" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("cargos")}><span>▤</span> Cargos y Salidas</button>
        <button className={activeView === "buscarSalidas" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("buscarSalidas")}><span>⌕</span> Buscar salidas</button>
        <button className={activeView === "guias" ? "nav-item active" : "nav-item"} onClick={() => setActiveView("guias")}><span>▣</span> Registro de Guías</button>
      </nav>
      <div className={`sidebar-card connection-${connection}`}><span className="status-dot" /><div><strong>{connectionTitle}</strong><small>{queue.length ? `${queue.length} registro(s) por sincronizar` : connection === "online" ? "Lectura y escritura habilitadas" : connection === "outdated" ? "Actualiza la implementación de Apps Script" : connection === "unconfigured" ? "Falta configurar Apps Script" : "Los registros quedarán en este equipo"}</small>{queue.length > 0 && <button className="sidebar-sync" type="button" onClick={() => void syncQueue(true)} disabled={syncing || connection === "unconfigured" || connection === "outdated"}>{syncing ? "Sincronizando…" : "Sincronizar ahora"}</button>}</div></div>
      <div className="user-card"><span>{currentUser.name.split(" ").map(part => part[0]).slice(0,2).join("")}</span><div><strong>{currentUser.name}</strong><small>{currentUser.role}</small><button type="button" onClick={logout} style={{ marginTop: 5, border: 0, background: "transparent", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 800, textDecoration: "underline" }}>Cerrar sesión</button></div></div>
    </aside>

    <button type="button" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"
      style={{ position: "fixed", right: 10, top: 10, zIndex: 5000, border: "1px solid #c7d6d2", borderRadius: 9, background: "#ffffff", color: "#173f3b", padding: "7px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.10)" }}>
      Salir
    </button>

    <section className="workspace">
      <header className="topbar"><div><p>REGISTRO DE PROVEEDORES ATENCIÓN AL CLIENTE - AMS - v001crq.</p><h1>{activeView === "registro" ? (regularizingId ? `Regularizar ${regularizingId}` : "Registrar ingreso") : activeView === "hoy" ? "Reporte diario" : activeView === "pendientes" ? "Eventos por regularizar" : activeView === "buscar" ? "Buscar registros" : activeView === "personas" ? "BD Clientes" : activeView === "buscarSalidas" ? "Buscar salidas" : activeView === "guias" ? "Registro de Guías" : "Cargos y Salidas"}</h1></div><div className="header-actions"><span className={`online connection-pill-${connection}`}>● {connectionLabel}</span></div></header>
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
      {activeView === "guias" && <section style={{ padding: 0, margin: 0, width: "100%", minHeight: "calc(100vh - 92px)", background: "#f4f6f8" }}>
        <iframe
          title="Registro de Guías"
          srcDoc={GUIAS_HTML_INTEGRADO}
          style={{ width: "100%", height: "calc(100vh - 92px)", minHeight: 760, border: 0, display: "block", background: "white" }}
          allow="clipboard-read; clipboard-write"
        />
      </section>}

      {activeView === "personas" && <section className="empty-view data-view"><div className="people-toolbar"><div><h2>BD CLIENTES</h2><p>Fuente maestra para autocompletar por DNI.</p></div><button onClick={loadClients} disabled={busy}>Actualizar</button></div><div className="people-table"><div className="table-head"><span>DNI</span><span>Nombres y apellidos</span><span>Celular</span><span>Licencia</span><span>Estado</span></div>{clients.map(person => <div className="table-row" key={person.dni}><span>{person.dni}</span><strong>{person.name}</strong><span>{person.phone}</span><span>{person.license ? `${person.license} · ${person.category}` : "—"}</span><em>{person.role || "ACTIVO"}</em></div>)}</div>{!clients.length && <p className="empty-message">Pulsa Actualizar para consultar BD CLIENTES.</p>}</section>}
    </section>
    {notice && <div className="notice-toast" role="status" aria-live="polite">{notice}</div>}
    {toast && <div className="alert-overlay" role="alert" aria-live="assertive"><div className={`alert-card ${toast.type}`}><span className="alert-icon">{toast.type === "success" ? "✓" : "!"}</span><div><strong>{toast.type === "success" ? "REGISTRO EXITOSO" : "ATENCIÓN: NO SE GUARDÓ"}</strong><p>{toast.message}</p></div><button type="button" aria-label="Cerrar alerta" onClick={() => setToast(null)}>×</button></div></div>}
  </main>;
}
