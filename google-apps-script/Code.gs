// ATENCION AL CLIENTE - SCRIPT FINAL COMPATIBLE CON GOOGLE APPS SCRIPT
// VERSION: ATENCION-2026-08-21-V14-REGULARIZACION-CAMPOS - REEMPLAZAR TODO EL CONTENIDO DE Codigo.gs
// VERIFICACION: este archivo usa sintaxis ES5 compatible, sin operadores modernos.

var SCRIPT_VERSION = 'AMS-2026-10-02-V19-INTEGRAL';
var WRITE_LOCK_MS = 1500;

var CFG = Object.freeze({
    HEADER: 2,
    MATRIX: 'MATRIZ',
    CLIENTS: 'BD CLIENTES',
    CARGOS: 'BD CARGOS',
    SALIDAS: 'BD SALIDAS',
    SALIDAS_CARGO: 'BD SALIDAS CARGO',
    CARGO_DETAIL: 'DETALLE CARGOS',
    USERS: 'USUARIOS',
    CONFIG: 'CONFIG',
    GUIAS_ID: '1wNLHyRGZ8zXvL7w0f-rsfkPEdMLTFpoP60srEjo4Ob0',
    GUIAS_SHEET: 'PROCESOS - GUIAS'
});
var MF = Object.freeze({
    id: ['ID'], dateTime: ['FECHA Y HORA DE INGRESO'], dni: ['DNI'], name: ['NOMBRES Y APELLIDOS'],
    phone: ['CELULAR'], role: ['OCUPACION'], motive: ['MOTIVO DE INGRESO'], plate: ['PLACA'], zone: ['ZONA'],
    license: ['LICENCIA DE CONDUCIR', 'LICENCIA'], category: ['CATEGORIA'],
    lots: ['NUMERO LOTES', 'NUMERO DE LOTES', 'N LOTES', 'N DE LOTES', 'NRO LOTES', 'CANTIDAD LOTES', 'CANTIDAD DE LOTES'],
    detail: ['DETALLE DE CARGA', 'DETALLE CARGA', 'DETALLE'], code: ['CODIGO', 'CODIGO DE LOTE', 'CODIGO LOTE'], guard: ['GUARDIA'],
    shift: ['TURNO'], responsible: ['RESPONSABLE']
});
var CF = Object.freeze({
    dni: ['DNI'], name: ['NOMBRES Y APELLIDOS'], phone: ['CELULAR'], role: ['OCUPACION'],
    license: ['LICENCIA DE CONDUCIR', 'LICENCIA'], category: ['CATEGORIA']
});
function doGet() { return json_({ ok: true, service: 'atencion-cliente-sheets', backendVersion: SCRIPT_VERSION }); }
function doPost(e) {
    try {
        var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
        auth_(body.apiKey);
        var p_1 = body.payload || {};
        var actions = {
          bootstrap: function () { return bootstrap_(p_1); },
            health: function () { return health_(); }, login: function () { return login_(p_1); }, searchPerson: function () { return searchPerson_(p_1.dni); }, recent: function () { return search_(p_1.query || '', p_1.limit || 8); }, today: function () { return today_(); },
            search: function () { return search_(p_1.query || '', p_1.limit || 30); }, pending: function () { return pending_(); }, listPeople: function () { return listPeople_(p_1.limit); },
            getEvent: function () { return getEvent_(p_1.id); }, saveEvent: function () { return saveEvent_(p_1); }, regularizeEvent: function () { return regularize_(p_1); },
           lookupCargoProvider: function () { return lookupCargoProvider_(p_1.code); },
previewCargoCorrelative: function () { return previewCargoCorrelative_(p_1.type); },
saveCargo: function () { return saveCargo_(p_1); },
getCargo: function () { return getCargo_(p_1.id); },
searchCargoExits: function () { return searchCargoExits_(p_1); },
cargoPendingReceipts: function () { return cargoPendingReceipts_(p_1); },
cargoConfirmReceipts: function () { return cargoConfirmReceipts_(p_1); },
            syncBatch: function () { return syncBatch_(p_1.items || []); },

// ============================================================
// MODULO 5 - ADMINISTRADOR
// ============================================================
adminUsuarios: function () {
    return adminUsuarios_(p_1);
},

adminGuardarUsuario: function () {
    return adminGuardarUsuario_(p_1);
},

adminCambiarEstadoUsuario: function () {
    return adminCambiarEstadoUsuario_(p_1);
},

adminAuditoria: function () {
    return adminAuditoria_(p_1);
},

adminBuscarRegistroGuias: function () {
    return adminBuscarRegistroGuias_(p_1);
},

adminModificarRegistroGuias: function () {
    return adminModificarRegistroGuias_(p_1);
},

adminAnularRegistroGuias: function () {
    return adminAnularRegistroGuias_(p_1);
},

adminGestionarRegistroGuias: function () {
    return adminGestionarRegistroGuias_(p_1);
},
adminBuscarRegistroAtencion: function () { return adminBuscarRegistroAtencion_(p_1); },
adminModificarRegistroAtencion: function () { return adminModificarRegistroAtencion_(p_1); },
adminAnularRegistroAtencion: function () { return adminAnularRegistroAtencion_(p_1); },
adminBuscarRegistroCargos: function () { return adminBuscarRegistroCargos_(p_1); },
adminModificarRegistroCargos: function () { return adminModificarRegistroCargos_(p_1); },
adminAnularRegistroCargos: function () { return adminAnularRegistroCargos_(p_1); },
adminBuscarRegistroRirm: function () { return adminBuscarRegistroRirm_(p_1); },
adminModificarRegistroRirm: function () { return adminModificarRegistroRirm_(p_1); },
adminAnularRegistroRirm: function () { return adminAnularRegistroRirm_(p_1); },

// =====================================================
// ESTADIA, SERVICIOS, CONSUMOS Y HABITACIONES - V3
// =====================================================

estadiaListarPresentes: function () {
  return estadiaListarPresentes_();
},

estadiaRegistrarServicio: function () {
  return estadiaRegistrarServicio_(p_1);
},

estadiaRegistrarServiciosLote: function () {
  return estadiaRegistrarServiciosLote_(p_1);
},
estadiaEstadoServicios: function () {
  return estadiaEstadoServicios_();
},
estadiaHistorialPersona: function () { return estadiaHistorialPersona_(p_1); },
estadiaPendientesAlimentacion: function () {
  return estadiaPendientesAlimentacion_(p_1);
},

estadiaActualizarSalidaPrevista: function () {
  return estadiaActualizarSalidaPrevista_(p_1);
},

estadiaRegistrarSalida: function () {
  return estadiaRegistrarSalida_(p_1);
},

estadiaRegistrarSalidasLote: function () {
  return estadiaRegistrarSalidasLote_(p_1);
},

estadiaListarHabitaciones: function () {
  return estadiaListarHabitaciones_();
},

estadiaAsignarHabitacion: function () {
  return estadiaAsignarHabitacion_(p_1);
},

estadiaConfirmarLimpieza: function () {
  return estadiaConfirmarLimpieza_(p_1);
},

estadiaReservarHabitacion: function () {
  return estadiaReservarHabitacion_(p_1);
},

estadiaCancelarReserva: function () {
  return estadiaCancelarReserva_(p_1);
},

estadiaConfirmarReserva: function () {
  return estadiaConfirmarReserva_(p_1);
},

estadiaFueraServicioHabitacion: function () {
  return estadiaFueraServicioHabitacion_(p_1);
},

estadiaHabilitarHabitacion: function () {
  return estadiaHabilitarHabitacion_(p_1);
},

estadiaListarResponsablesAtencion: function () {
  return estadiaListarResponsablesAtencion_();
},

estadiaResumenGuardia: function () {
  return estadiaResumenGuardia_(p_1);
}


        };
        if (!actions[body.action])
            throw new Error('Acción no permitida.');
        return json_({ ok: true, data: actions[body.action]() });
    }
    catch (error) {
        return json_({ ok: false, error: error.message || String(error) });
    }
}
function configurarBase() {
    var matrix = sheet_(CFG.MATRIX), clients = sheet_(CFG.CLIENTS);
    removePeopleColumn_(matrix);
    map_(matrix, MF);
    map_(clients, CF);
    PropertiesService.getScriptProperties().setProperty('APP_API_KEY', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
    SpreadsheetApp.getUi().alert('Base configurada. Copia APP_API_KEY desde Propiedades del script.');
}
// ============================================================
// INICIO DE SESION - USUARIO + PIN
// USUARIOS: A USUARIO | B NOMBRE COMPLETO | C ROL | D ACTIVO
//           E ULTIMO ACCESO | F PIN
// ============================================================
function login_(p) {
  p = p || {};

  var usuario = String(p.user || p.usuario || "").trim().toUpperCase();
  var pin = String(p.pin || "").trim();

  if (!usuario) throw new Error("Ingresa tu usuario.");
  if (!pin) throw new Error("Ingresa tu PIN.");

  var sh = sheet_(CFG.USERS);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  if (lastRow < 2) {
    throw new Error("No hay usuarios registrados.");
  }

  // Lee encabezados completos, incluidos todos los permisos
  var headers = sh
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(function (x) {
      return String(x || "").trim();
    });

  // Lee todos los usuarios una sola vez
  var data = sh
    .getRange(2, 1, lastRow - 1, lastCol)
    .getDisplayValues();

  var fila = -1;
  var row = null;

  for (var i = 0; i < data.length; i++) {
    var userBD = String(data[i][0] || "").trim().toUpperCase();

    if (userBD === usuario) {
      fila = i + 2;
      row = data[i];
      break;
    }
  }

  if (!row) {
    throw new Error("Usuario no encontrado.");
  }

  var nombre = String(row[1] || "").trim();
  var rol = String(row[2] || "").trim().toUpperCase();
  var activo = String(row[3] || "").trim().toUpperCase();
  var pinBD = String(row[5] || "").trim();

  var estaActivo =
    activo === "SI" ||
    activo === "SÍ" ||
    activo === "TRUE" ||
    activo === "1" ||
    activo === "ACTIVO";

  if (!estaActivo) {
    throw new Error("Usuario inactivo.");
  }

  if (pinBD !== pin) {
    throw new Error("PIN incorrecto.");
  }

  // =====================================================
  // PERMISOS
  // Todo lo que esté después de la columna PIN
  // se devuelve automáticamente al frontend.
  // =====================================================
  var permisos = {};

  for (var c = 6; c < headers.length; c++) {
    var nombrePermiso = String(headers[c] || "").trim();

    if (!nombrePermiso) continue;

    var valor = String(row[c] || "").trim().toUpperCase();

    permisos[nombrePermiso] =
      valor === "SI" ||
      valor === "SÍ" ||
      valor === "TRUE" ||
      valor === "1";
  }

  // Actualizar ÚLTIMO ACCESO - columna E
  var ahora = new Date();
  sh.getRange(fila, 5).setValue(ahora);

  return {
    authenticated: true,

    user: usuario,
    usuario: usuario,

    name: nombre,
    nombre: nombre,

    role: rol,
    rol: rol,

    responsableSesion: nombre,

    lastAccess: ahora,

    // NUEVO
    permissions: permisos,
    permisos: permisos
  };
}

// ============================================================
// V16 - BOOTSTRAP RAPIDO DE SESION
// ============================================================
function bootstrap_(p) {
    p = p && typeof p === 'object' ? p : {};
    var usuario = String(p.user || p.usuario || '').trim().toUpperCase();
    if (!usuario) throw new Error('Usuario requerido.');

    var sh = sheet_(CFG.USERS);
    var lastRow = sh.getLastRow();
    var lastColumn = sh.getLastColumn();
    if (lastRow < 2) throw new Error('No hay usuarios configurados.');

    var headers = sh.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    var data = sh.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();
    var row = null;

    for (var i = 0; i < data.length; i++) {
        if (String(data[i][0] || '').trim().toUpperCase() === usuario) {
            row = data[i];
            break;
        }
    }

    if (!row) throw new Error('Usuario no encontrado.');

    var activo = String(row[3] || '').trim().toUpperCase();
    if (['SI', 'SÍ', 'TRUE', '1', 'ACTIVO'].indexOf(activo) < 0) {
        throw new Error('Usuario inactivo.');
    }

    var permisos = {};
    for (var c = 6; c < headers.length; c++) {
        var key = String(headers[c] || '').trim();
        if (!key) continue;
        permisos[key] = String(row[c] || '').trim().toUpperCase();
    }

    var rol = String(row[2] || '').trim().toUpperCase();
    return {
        backendVersion: SCRIPT_VERSION,
        usuario: {
            user: usuario,
            name: String(row[1] || '').trim(),
            role: rol,
            active: true
        },
        permisos: permisos,
        modulos: {
            atencion: true,
            cargos: true,
            guias: true,
            rirm: true,
            admin: rol === 'ADMINISTRADOR'
        }
    };
}

function health_() {
    var matrix = sheet_(CFG.MATRIX), clients = sheet_(CFG.CLIENTS);
    var matrixMap = map_(matrix, MF), clientMap = map_(clients, CF);
    return { connected: true, backendVersion: SCRIPT_VERSION, mode: 'MATRIZ_DIRECTA', spreadsheet: SpreadsheetApp.getActive().getName(), matrixRows: Math.max(matrix.getLastRow() - CFG.HEADER, 0), clientRows: Math.max(clients.getLastRow() - CFG.HEADER, 0),
        matrixColumns: { license: matrixMap.license + 1, category: matrixMap.category + 1, detail: matrixMap.detail + 1, code: matrixMap.code + 1 },
        clientColumns: { license: clientMap.license + 1, category: clientMap.category + 1 } };
}
function searchPerson_(dni) {
    dni = String(dni || '').replace(/\D/g, '');
    if (!/^\d{8}$/.test(dni))
        throw new Error('El DNI debe tener 8 números.');
    var sheet = sheet_(CFG.CLIENTS), m = map_(sheet, CF), count = Math.max(sheet.getLastRow() - CFG.HEADER, 0);
    if (!count)
        return { found: false };
    var hit = sheet.getRange(CFG.HEADER + 1, m.dni + 1, count, 1).createTextFinder(dni).matchEntireCell(true).findNext();
    var row = hit ? sheet.getRange(hit.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0] : null;
    return row ? { found: true, person: clientObject_(row, m) } : { found: false };
}
function syncBatch_(items) {
    return array_(items).slice(0, 5).map(function (item) {
        if (item.action === 'saveEvent')
            return saveEvent_(item.payload || {});
        if (item.action === 'regularizeEvent')
            return regularize_(item.payload || {});
        throw new Error('Acción de lote no permitida.');
    });
}
function listPeople_(limit) {
    var sheet = sheet_(CFG.CLIENTS), m = map_(sheet, CF);
    return values_(sheet, CFG.HEADER + 1).filter(function (r) { return cleanId_(r[m.dni]); }).slice(-(Number(limit) || 200)).reverse().map(function (r) { return clientObject_(r, m); });
}
function saveEvent_(p) {
    validate_(p, false);
    var people = uniqueParticipants_(p.participants);
    if (!people.length)
        throw new Error('Registra al menos una persona con DNI.');
    var status_1 = p.forRegularization || array_(p.pendingReasons).length ? 'PENDIENTE' : 'COMPLETO';
    var synchronizedId = syncedId_(p.clientRequestId);
    if (synchronizedId) {
        finishEvent_(synchronizedId, p, people, status_1, 'CREAR INGRESO');
        return eventAck_(synchronizedId, p, people, status_1);
    }
    var lock = writeLock_(), id_1 = '', sheet_1, m_1;
    try {
        synchronizedId = syncedId_(p.clientRequestId);
        if (synchronizedId) {
            id_1 = synchronizedId;
        }
        else {
        sheet_1 = sheet_(CFG.MATRIX);
        m_1 = map_(sheet_1, MF);
        id_1 = nextId_(sheet_1, m_1);
        var rows = people.map(function (x) { return matrixRow_(sheet_1.getLastColumn(), m_1, id_1, p, x); });
        sheet_1.getRange(sheet_1.getLastRow() + 1, 1, rows.length, sheet_1.getLastColumn()).setValues(rows);
        recordSync_(p.clientRequestId, id_1, 'CREAR INGRESO', true);
        }
    }
    finally {
        lock.releaseLock();
    }
    finishEvent_(id_1, p, people, status_1, 'CREAR INGRESO');
    return eventAck_(id_1, p, people, status_1);
}
function regularize_(p) {
    p = p && typeof p === 'object' ? p : {};
    validate_(p, true);
    var validPeople_1 = uniqueParticipants_(p.participants);
    var status = p.forRegularization || array_(p.pendingReasons).length ? 'PENDIENTE' : 'COMPLETO';
    var synchronizedId = syncedId_(p.clientRequestId);
    if (synchronizedId) {
        finishRegularization_(synchronizedId, p, validPeople_1, [], status);
        return getEvent_(synchronizedId);
    }
    var lock = writeLock_(), id_2 = String(p.id || ''), addedPeople_1 = [];
    try {
        synchronizedId = syncedId_(p.clientRequestId);
        if (synchronizedId) {
            id_2 = synchronizedId;
        }
        else {
        var sheet_2 = sheet_(CFG.MATRIX), m_2 = map_(sheet_2, MF);
        var existing = matrixRowsForId_(sheet_2, m_2, id_2);
        if (!existing.length)
            throw new Error('No se encontró ' + id_2 + '.');
        var base_1 = { dateTime: p.dateTime || new Date(), event: completedEvent_(existing[0].event, p.event || {}), caseId: p.caseId, participants: validPeople_1 };
        var incomingByDni_1 = {};
        validPeople_1.forEach(function (person) { incomingByDni_1[cleanId_(person.dni)] = person; });
        existing.forEach(function (item) {
            var incoming = incomingByDni_1[item.dni];
            if (!incoming)
                return;
            sheet_2.getRange(item.rowNumber, 1, 1, sheet_2.getLastColumn()).setValues([completeExistingRow_(item, m_2, incoming, p.event || {})]);
        });
        var existingDnis_1 = {};
        existing.forEach(function (item) { existingDnis_1[item.dni] = true; });
        addedPeople_1 = validPeople_1.filter(function (person) { return !existingDnis_1[cleanId_(person.dni)]; });
        if (addedPeople_1.length) {
            var last = Math.max.apply(null, existing.map(function (x) { return x.rowNumber; }));
            sheet_2.insertRowsAfter(last, addedPeople_1.length);
            sheet_2.getRange(last + 1, 1, addedPeople_1.length, sheet_2.getLastColumn()).setValues(addedPeople_1.map(function (x) { return matrixRow_(sheet_2.getLastColumn(), m_2, id_2, base_1, x); }));
        }
        recordSync_(p.clientRequestId, id_2, 'REGULARIZAR', true);
        }
    }
    finally {
        lock.releaseLock();
    }
    finishRegularization_(id_2, p, validPeople_1, addedPeople_1, status);
    return getEvent_(id_2);
}
function uniqueParticipants_(people) {
    var byDni = {}, result = [];
    array_(people).forEach(function (person) {
        if (!person)
            return;
        var dni = cleanId_(person.dni);
        if (!/^\d{8}$/.test(dni))
            return;
        if (!byDni[dni]) {
            byDni[dni] = person;
            result.push(person);
            return;
        }
        byDni[dni] = completedPerson_(byDni[dni], person);
        result[result.findIndex(function (item) { return cleanId_(item.dni) === dni; })] = byDni[dni];
    });
    return result;
}
function completedPerson_(current, incoming) {
    var next = {}, keys = ['dni', 'name', 'phone', 'role', 'license', 'category', 'lots', 'detail'];
    keys.forEach(function (key) { next[key] = String(incoming[key] || '').trim() ? incoming[key] : current[key]; });
    var incomingCodes = array_(incoming.lotCodes).filter(function (code) { return String(code || '').trim(); });
    next.lotCodes = incomingCodes.length ? incomingCodes : array_(current.lotCodes);
    return next;
}
function completedEvent_(current, incoming) {
    current = current && typeof current === 'object' ? current : {};
    incoming = incoming && typeof incoming === 'object' ? incoming : {};
    var next = {}, keys = ['motive', 'plate', 'zone', 'guard', 'shift', 'responsible'];
    keys.forEach(function (key) { next[key] = String(incoming[key] || '').trim() ? incoming[key] : current[key]; });
    return next;
}
function completeExistingRow_(existing, m, incoming, event) {
    var row = existing.raw.slice(), nextEvent = event || {}, codes = array_(incoming.lotCodes).map(function (code) { return String(code || '').trim().toUpperCase(); }).filter(Boolean);
    if (String(incoming.name || '').trim())
        row[m.name] = String(incoming.name).toUpperCase();
    if (String(incoming.phone || '').trim())
        row[m.phone] = cleanId_(incoming.phone);
    if (!String(row[m.role] || '').trim() && String(incoming.role || '').trim())
        row[m.role] = String(incoming.role).toUpperCase();
    if (String(incoming.role || '').toUpperCase() === 'CONDUCTOR') {
        if (String(incoming.license || '').trim())
            row[m.license] = String(incoming.license).toUpperCase();
        if (String(incoming.category || '').trim())
            row[m.category] = category_(incoming.category);
    }
    if (!String(row[m.lots] || '').trim() && String(incoming.lots || '').trim())
        row[m.lots] = String(incoming.lots);
    if (!String(row[m.detail] || '').trim() && String(incoming.detail || '').trim())
        row[m.detail] = String(incoming.detail).toUpperCase();
    if (!String(row[m.code] || '').trim() && codes.length)
        row[m.code] = codes.join(' ');
    if (!String(row[m.motive] || '').trim() && String(nextEvent.motive || '').trim())
        row[m.motive] = String(nextEvent.motive).toUpperCase();
    if (!String(row[m.plate] || '').trim() && String(nextEvent.plate || '').trim())
        row[m.plate] = String(nextEvent.plate).slice(0, 7).toUpperCase();
    if (!String(row[m.zone] || '').trim() && String(nextEvent.zone || '').trim())
        row[m.zone] = String(nextEvent.zone).toUpperCase();
    if (!String(row[m.guard] || '').trim() && String(nextEvent.guard || '').trim())
        row[m.guard] = String(nextEvent.guard).toUpperCase();
    if (!String(row[m.responsible] || '').trim() && String(nextEvent.responsible || '').trim())
        row[m.responsible] = String(nextEvent.responsible).toUpperCase();
    return row;
}
function writeLock_() {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(WRITE_LOCK_MS))
        throw new Error('SERVIDOR_OCUPADO: Google Sheets está atendiendo otro registro. Se reintentará automáticamente.');
    return lock;
}
function finishEvent_(id, p, people, status, action) {
    try {
        ensureClients_(people);
    }
    catch (_) {
        // MATRIZ ya fue confirmada. Una falla secundaria de BD CLIENTES no bloquea el registro.
    }
    upsertPending_(id, p.caseId, status, p.pendingReasons || []);
}
function finishRegularization_(id, p, people, additions, status) {
    try {
        ensureClients_(people);
    }
    catch (_) {
        // La regularización en MATRIZ tiene prioridad sobre la actualización de clientes.
    }
    upsertPending_(id, p.caseId, status, p.pendingReasons || []);
}
function search_(query, limit) {
    var sheet = sheet_(CFG.MATRIX), m = map_(sheet, MF), q = norm_(query), groups = {};
    matrixRows_(sheet, m).forEach(function (r) { if (!groups[r.id])
        groups[r.id] = []; groups[r.id].push(r); });
    var ids = Object.keys(groups).filter(function (id) {
        if (!q)
            return true;
        var text = norm_(groups[id].map(function (row) { return [row.id, row.event.plate, row.event.zone, row.dni, row.name, row.detail, row.code].join(' '); }).join(' '));
        return text.indexOf(q) >= 0;
    }).sort(function (a, b) { return new Date(groups[b][0].dateTime) - new Date(groups[a][0].dateTime); }).slice(0, Math.min(Number(limit) || 30, 50));
    var clients = {}, states = pendingMap_();
    return ids.map(function (id) { return eventFromRows_(id, groups[id], clients, null, states); });
}
function today_() {
    var sheet = sheet_(CFG.MATRIX);
    var m = map_(sheet, MF);
    var lastRow = sheet.getLastRow();

    if (lastRow <= CFG.HEADER) {
        return [];
    }

    var startRow = CFG.HEADER + 1;
    var count = lastRow - CFG.HEADER;
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

    // Solo leemos las 2 columnas necesarias para localizar
    // los eventos de hoy: ID y FECHA/HORA.
    var ids = sheet
        .getRange(startRow, m.id + 1, count, 1)
        .getDisplayValues();

    var dates = sheet
        .getRange(startRow, m.dateTime + 1, count, 1)
        .getValues();

    var todayIds = {};
    var i;

    for (i = 0; i < count; i++) {
        var id = String(ids[i][0] || '').trim();
        var value = dates[i][0];

        if (!id || !value) {
            continue;
        }

        var d = value instanceof Date ? value : new Date(value);

        if (isNaN(d.getTime())) {
            continue;
        }

        if (Utilities.formatDate(d, tz, 'yyyy-MM-dd') === today) {
            todayIds[id] = true;
        }
    }

    var eventIds = Object.keys(todayIds);

    if (!eventIds.length) {
        return [];
    }

    var states = pendingMap_();
    var clients = {};
    var result = [];

    // Una vez identificados los ID de hoy,
    // recuperamos únicamente las filas pertenecientes a esos eventos.
    eventIds.forEach(function (id) {
        var rows = matrixRowsForId_(sheet, m, id);

        if (!rows || !rows.length) {
            return;
        }

        result.push(
            eventFromRows_(
                id,
                rows,
                clients,
                null,
                states
            )
        );
    });

    result.sort(function (a, b) {
        return new Date(b.dateTime) - new Date(a.dateTime);
    });

    return result;
}
function pending_() {
    var states = pendingMap_();

    var pendingIds = Object.keys(states).filter(function (id) {
        return states[id] && states[id].status === 'PENDIENTE';
    });

    if (!pendingIds.length) {
        return [];
    }

    var matrix = sheet_(CFG.MATRIX);
    var m = map_(matrix, MF);
    var clients = {};
    var result = [];

    // Ya NO cargamos toda MATRIZ.
    // Buscamos únicamente los ID que realmente están pendientes.
    pendingIds.forEach(function (id) {

        var rows = matrixRowsForId_(matrix, m, String(id));

        if (!rows || !rows.length) {
            return;
        }

        result.push(
            eventFromRows_(
                String(id),
                rows,
                clients,
                null,
                states
            )
        );
    });

    result.sort(function (a, b) {
        return new Date(b.dateTime) - new Date(a.dateTime);
    });

    return result;
}
function getEvent_(id) {
    var sheet = sheet_(CFG.MATRIX), m = map_(sheet, MF), rows = matrixRowsForId_(sheet, m, String(id));
    if (!rows.length)
        throw new Error('No se encontró ' + id + '.');
    return eventFromRows_(String(id), rows);
}
function eventFromRows_(id, rows, clients, codeMap, states) {
    var first = rows[0], state = states ? states[id] || {} : pendingState_(id), people = clients || {};
    return { id: id, dateTime: first.dateTime, caseId: state.caseId || 1, status: state.status || 'COMPLETO', pendingReasons: state.pendingReasons || [],
        motive: first.event.motive, plate: first.event.plate, zone: first.event.zone, guard: first.event.guard, shift: first.event.shift, responsible: first.event.responsible,
        persons: eventPersons_(id, rows, people, codeMap) };
}
function eventPersons_(id, rows, people, codeMap) {
    var byKey = {}, ordered = [];
    rows.forEach(function (r) {
        var person = { dni: r.dni, name: r.name, phone: r.phone, role: r.role, license: r.license || (people[r.dni] ? people[r.dni].license || '' : ''), category: category_(r.category || (people[r.dni] ? people[r.dni].category || '' : '')), lots: r.lots, detail: r.detail, lotCodes: String(r.code || '').split(/\s+/).filter(Boolean) };
        var key = cleanId_(person.dni) + '\u001f' + String(person.role || '').toUpperCase();
        if (!byKey[key]) {
            byKey[key] = person;
            ordered.push(key);
        }
        else {
            byKey[key] = completedPerson_(byKey[key], person);
        }
    });
    return ordered.map(function (key) { return byKey[key]; });
}
function matrixObject_(r, rowNumber, m) {
    return { rowNumber: rowNumber, raw: r.slice(), id: String(r[m.id] || ''), dateTime: iso_(r[m.dateTime]),
        dni: cleanId_(r[m.dni]), name: String(r[m.name] || ''), phone: cleanId_(r[m.phone]), role: String(r[m.role] || '').toUpperCase(), license: String(r[m.license] || ''), category: category_(r[m.category]), lots: cleanId_(r[m.lots]), detail: String(r[m.detail] || ''), code: String(r[m.code] || ''),
        event: { motive: String(r[m.motive] || ''), plate: String(r[m.plate] || ''), zone: String(r[m.zone] || ''), guard: String(r[m.guard] || ''), shift: String(r[m.shift] || ''), responsible: String(r[m.responsible] || '') } };
}
function matrixRows_(sheet, m) {
    return values_(sheet, CFG.HEADER + 1).map(function (r, i) { return matrixObject_(r, CFG.HEADER + 1 + i, m); }).filter(function (r) { return r.id; });
}
function matrixRowsForId_(sheet, m, id) {
    var count = Math.max(sheet.getLastRow() - CFG.HEADER, 0);
    if (!count)
        return [];
    var hits = sheet.getRange(CFG.HEADER + 1, m.id + 1, count, 1).createTextFinder(String(id)).matchEntireCell(true).findAll();
    if (!hits.length)
        return [];
    var rowNumbers = hits.map(function (hit) { return hit.getRow(); }).sort(function (a, b) { return a - b; });
    var start = rowNumbers[0], end = rowNumbers[rowNumbers.length - 1], wanted = {};
    rowNumbers.forEach(function (rowNumber) { wanted[rowNumber] = true; });
    return sheet.getRange(start, 1, end - start + 1, sheet.getLastColumn()).getValues().map(function (row, index) {
        var rowNumber = start + index;
        return wanted[rowNumber] ? matrixObject_(row, rowNumber, m) : null;
    }).filter(Boolean);
}
function matrixRow_(count, m, id, p, person) {
    var row = new Array(count).fill(''), event = p.event || {};
    var providers = array_(p.participants).filter(function (x) { return x && x.role === 'PROVEEDOR' && /^\d{8}$/.test(String(x.dni || '')); });
    var owns = person.role === 'PROVEEDOR' || (!providers.length && person.role === 'CONDUCTOR');
    var codes = array_(person.lotCodes).map(function (value) { return String(value || '').trim().toUpperCase(); }).filter(Boolean);
    row[m.id] = id;
    row[m.dateTime] = p.dateTime ? new Date(p.dateTime) : new Date();
    row[m.dni] = String(person.dni || '');
    row[m.name] = String(person.name || '').toUpperCase();
    row[m.phone] = String(person.phone || '');
    row[m.role] = String(person.role || '').toUpperCase();
    row[m.motive] = String(event.motive || 'PROCESO').toUpperCase();
    row[m.plate] = String(event.plate || '').slice(0, 7).toUpperCase();
    row[m.zone] = String(event.zone || '').toUpperCase();
    row[m.license] = person.role === 'CONDUCTOR' ? String(person.license || '').toUpperCase() : '';
    row[m.category] = person.role === 'CONDUCTOR' ? category_(person.category) : '';
    row[m.lots] = owns ? String(person.lots || '') : '';
    row[m.detail] = owns ? String(person.detail || '') : '';
    row[m.code] = owns ? codes.join(' ') : '';
    row[m.guard] = String(event.guard || '').toUpperCase();
    row[m.shift] = operationalShift_(p.dateTime);
    row[m.responsible] = String(event.responsible || '').toUpperCase();
    return row;
}
function eventAck_(id, p, people, status) {
    var event = p.event || {};
    return {
        id: String(id), dateTime: iso_(p.dateTime || new Date()), caseId: Number(p.caseId) || 1,
        status: status || 'COMPLETO', pendingReasons: array_(p.pendingReasons),
        motive: String(event.motive || 'PROCESO'), plate: String(event.plate || ''), zone: String(event.zone || ''),
        guard: String(event.guard || ''), shift: operationalShift_(p.dateTime), responsible: String(event.responsible || ''),
        persons: array_(people).map(function (person) {
            return { dni: cleanId_(person.dni), name: String(person.name || ''), phone: cleanId_(person.phone), role: String(person.role || '').toUpperCase(),
                license: String(person.license || ''), category: category_(person.category), lots: cleanId_(person.lots), detail: String(person.detail || ''),
                lotCodes: array_(person.lotCodes).map(function (code) { return String(code || '').trim().toUpperCase(); }).filter(Boolean) };
        })
    };
}
function ensureClients_(people) {
    if (!people || !people.length)
        return;
    var sheet = sheet_(CFG.CLIENTS), m = map_(sheet, CF), count = Math.max(sheet.getLastRow() - CFG.HEADER, 0), additions = [];
    array_(people).forEach(function (person) {
        if (!person)
            return;
        var dni = cleanId_(person.dni), hit;
        if (!/^\d{8}$/.test(dni))
            return;
        hit = count ? sheet.getRange(CFG.HEADER + 1, m.dni + 1, count, 1).createTextFinder(dni).matchEntireCell(true).findNext() : null;
        if (hit) {
            var rowNumber = hit.getRow(), current = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
            var nextPhone = cleanId_(person.phone), currentPhone = cleanId_(current[m.phone]);
            if (/^\d{9}$/.test(nextPhone) && nextPhone !== currentPhone) {
                sheet.getRange(rowNumber, m.phone + 1).setValue(nextPhone);
                current[m.phone] = nextPhone;
            }
            if (String(person.role || '').toUpperCase() !== 'CONDUCTOR')
                return;
            var nextLicense = String(person.license || '').trim().toUpperCase(), currentLicense = String(current[m.license] || '').trim().toUpperCase();
            var nextCategory = category_(person.category), currentCategory = category_(current[m.category]);
            if (nextLicense && nextLicense !== currentLicense)
                sheet.getRange(rowNumber, m.license + 1).setValue(nextLicense);
            if (nextCategory && nextCategory !== currentCategory)
                sheet.getRange(rowNumber, m.category + 1).setValue(nextCategory);
            return;
        }
        var row = new Array(sheet.getLastColumn()).fill('');
        row[m.dni] = dni;
        row[m.name] = String(person.name || '').toUpperCase();
        row[m.phone] = String(person.phone || '');
        row[m.role] = String(person.role || '').toUpperCase();
        row[m.license] = String(person.role || '').toUpperCase() === 'CONDUCTOR' ? String(person.license || '').toUpperCase() : '';
        row[m.category] = String(person.role || '').toUpperCase() === 'CONDUCTOR' ? category_(person.category) : '';
        additions.push(row);
    });
    if (additions.length)
        sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, sheet.getLastColumn()).setValues(additions);
}
function ensureClient_(p) {
    var sheet = sheet_(CFG.CLIENTS), m = map_(sheet, CF), dni = cleanId_(p.dni);
    if (!/^\d{8}$/.test(dni))
        return;
    var rows = values_(sheet, CFG.HEADER + 1), existingIndex = rows.findIndex(function (r) { return cleanId_(r[m.dni]) === dni; });
    if (existingIndex >= 0) {
        var rowNumber = CFG.HEADER + 1 + existingIndex, current = rows[existingIndex], changes = [];
        var nextPhone = cleanId_(p.phone), currentPhone = cleanId_(current[m.phone]);
        if (/^\d{9}$/.test(nextPhone) && nextPhone !== currentPhone) {
            sheet.getRange(rowNumber, m.phone + 1).setValue(nextPhone);
            changes.push('celular');
        }
        if (String(p.role || '').toUpperCase() !== 'CONDUCTOR')
            return;
        var nextLicense = String(p.license || '').trim().toUpperCase(), currentLicense = String(current[m.license] || '').trim().toUpperCase();
        var nextCategory = category_(p.category), currentCategory = category_(current[m.category]);
        if (nextLicense && currentLicense !== nextLicense) {
            sheet.getRange(rowNumber, m.license + 1).setValue(nextLicense);
            changes.push('licencia');
        }
        if (nextCategory && currentCategory !== nextCategory) {
            sheet.getRange(rowNumber, m.category + 1).setValue(nextCategory);
            changes.push('categoría');
        }
        return;
    }
    var row = new Array(sheet.getLastColumn()).fill('');
    row[m.dni] = dni;
    row[m.name] = String(p.name || '').toUpperCase();
    row[m.phone] = String(p.phone || '');
    row[m.role] = p.role;
    row[m.license] = p.license || '';
    row[m.category] = p.category || '';
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}
function clientObject_(r, m) {
    var phone = cleanId_(r[m.phone]), rawLicense = String(r[m.license] || '').trim().toUpperCase(), category = category_(r[m.category]);
    if (!/^\d{9}$/.test(phone))
        phone = '';
    if (isCategory_(rawLicense)) {
        if (!isCategory_(category))
            category = category_(rawLicense);
        rawLicense = '';
    }
    if (!isCategory_(category))
        category = '';
    return { dni: cleanId_(r[m.dni]), name: String(r[m.name] || ''), phone: phone, role: String(r[m.role] || ''), license: rawLicense, category: category };
}
function clientMap_() { var s = sheet_(CFG.CLIENTS), m = map_(s, CF), out = {}; values_(s, CFG.HEADER + 1).forEach(function (r) { var p = clientObject_(r, m); if (p.dni)
    out[p.dni] = p; }); return out; }
function upsertPending_(id, caseId, status, reasons) {
    var properties = PropertiesService.getScriptProperties(), key = 'PENDING_' + String(id);
    if (status !== 'PENDIENTE') {
        properties.deleteProperty(key);
        return;
    }
    properties.setProperty(key, JSON.stringify({ caseId: Number(caseId) || 1, status: 'PENDIENTE', pendingReasons: array_(reasons) }));
}
function pendingMap_() {
    var out = {}, all = PropertiesService.getScriptProperties().getProperties();
    Object.keys(all).forEach(function (key) {
        if (key.indexOf('PENDING_') !== 0)
            return;
        var id = key.slice(8), state = parse_(all[key], null);
        if (!id)
            return;
        out[id] = state && typeof state === 'object' ? state : { caseId: 1, status: 'PENDIENTE', pendingReasons: ['Datos pendientes por regularizar'] };
    });
    return out;
}
function pendingState_(id) {
    var raw = PropertiesService.getScriptProperties().getProperty('PENDING_' + String(id));
    if (raw === null || raw === undefined || raw === '')
        return {};
    var state = parse_(raw, null);
    return state && typeof state === 'object' ? state : { caseId: 1, status: 'PENDIENTE', pendingReasons: ['Datos pendientes por regularizar'] };
}
function nextId_(sheet, m) {
    var year = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy'), key = 'ULTIMO_ID_' + year;
    var properties = PropertiesService.getScriptProperties(), max = Number(properties.getProperty(key) || 0);
    if (!max) {
        var count = Math.max(sheet.getLastRow() - CFG.HEADER, 0);
        if (count)
            sheet.getRange(CFG.HEADER + 1, m.id + 1, count, 1).getValues().forEach(function (r) { var hit = String(r[0] || '').match(/(\d+)$/); if (hit)
                max = Math.max(max, Number(hit[1])); });
    }
    max += 1;
    properties.setProperty(key, String(max));
    return 'ING-' + year + '-' + String(max).padStart(6, '0');
}
function operationalShift_(value) { var d = value ? new Date(value) : new Date(), time = Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm'); return time >= '07:00' && time < '19:00' ? 'DÍA' : 'NOCHE'; }
function validate_(p, regularize) { if (regularize && !p.id)
    throw new Error('ID requerido.'); if (!p.forRegularization && array_(p.pendingReasons).length)
    throw new Error('Completa todos los datos obligatorios antes de guardar.'); var e = p.event || {}, c = Number(p.caseId) || 1; if (!String(e.responsible || '').trim())
    throw new Error('Responsable requerido.'); if (String(e.plate || '').length > 7)
    throw new Error('La placa admite máximo 7 caracteres.'); array_(p.participants).forEach(function (person) { if (person && String(person.role || '').toUpperCase() === 'CONDUCTOR' && String(person.license || '').length > 9)
        throw new Error('La licencia admite máximo 9 caracteres.'); }); if (c <= 4 && String(e.motive || '').toUpperCase() !== 'PROCESO')
    throw new Error('El motivo debe ser PROCESO.'); if (c === 5 && String(e.motive || '').toUpperCase() !== 'RETIRO DE LOTE')
    throw new Error('El motivo debe ser RETIRO DE LOTE.'); if (c === 6 && ['PROCESO', 'RM', 'MUESTREO', 'RECOGER MUESTRA'].indexOf(String(e.motive || '').toUpperCase()) < 0)
    throw new Error('Motivo no permitido.'); }
function auth_(key) { var expected = PropertiesService.getScriptProperties().getProperty('APP_API_KEY'); if (!expected)
    throw new Error('Ejecuta configurarBase().'); if (String(key || '') !== expected)
    throw new Error('Acceso no autorizado.'); }
function syncedId_(requestId) {
    if (!requestId)
        return '';
    var recent = array_(parse_(PropertiesService.getScriptProperties().getProperty('SYNC_RECIENTE'), []));
    var hit = recent.filter(function (item) { return item && item.requestId === String(requestId); })[0];
    return hit ? String(hit.id || '') : '';
}
function recordSync_(requestId, id, action, alreadyChecked) {
    if (!requestId || (!alreadyChecked && syncedId_(requestId)))
        return;
    var properties = PropertiesService.getScriptProperties(), recent = array_(parse_(properties.getProperty('SYNC_RECIENTE'), []));
    recent = recent.filter(function (item) { return item && item.requestId !== String(requestId); });
    recent.unshift({ requestId: String(requestId), id: String(id), action: String(action || '') });
    properties.setProperty('SYNC_RECIENTE', JSON.stringify(recent.slice(0, 100)));
}
function removePeopleColumn_(sheet) { var h = sheet.getRange(CFG.HEADER, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(norm_); var i = h.findIndex(function (x) { return ['N PERSONAS', 'NUMERO PERSONAS', 'NUMERO DE PERSONAS'].includes(x); }); if (i >= 0)
    sheet.deleteColumn(i + 1); }
function map_(sheet, fields) { var h = sheet.getRange(CFG.HEADER, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(norm_), out = {}; Object.keys(fields).forEach(function (k) { var opts = fields[k].map(norm_), i = h.findIndex(function (x) { return opts.includes(x); }); if (i < 0)
    throw new Error('Falta "' + fields[k][0] + '" en ' + sheet.getName()); out[k] = i; }); return out; }
function sheet_(name) { var s = SpreadsheetApp.getActive().getSheetByName(name); if (!s)
    throw new Error('No existe la hoja ' + name + '.'); return s; }
function values_(sheet, start) { return sheet.getLastRow() < start ? [] : sheet.getRange(start, 1, sheet.getLastRow() - start + 1, sheet.getLastColumn()).getValues(); }
function norm_(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/gi, ' ').trim().toUpperCase(); }
function cleanId_(v) { return String(v == null ? '' : v).replace(/\.0$/, '').trim(); }
function array_(v) { return Array.isArray(v) ? v : []; }
function category_(v) {
    var raw = String(v || '').trim().toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, ''), compact = raw.replace(/-/g, '');
    var categories = { AI: 'A-I', AIIA: 'A-IIA', AIIB: 'A-IIB', AIIIA: 'A-IIIA', AIIIB: 'A-IIIB', AIIIC: 'A-IIIC' };
    return categories[compact] || raw;
}
function isCategory_(v) { return ['A-I', 'A-IIA', 'A-IIB', 'A-IIIA', 'A-IIIB', 'A-IIIC'].indexOf(category_(v)) >= 0; }
function iso_(v) { var d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? String(v || '') : d.toISOString(); }
function parse_(v, fallback) { try {
    return JSON.parse(v);
}
catch (_) {
    return fallback;
} }
function json_(v) { return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON); }
function probarConexionYRegistro() {
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    var saved = saveEvent_({
        clientRequestId: 'PRUEBA-' + Utilities.getUuid(), caseId: 6, dateTime: new Date().toISOString(), forRegularization: false, pendingReasons: [],
        event: { motive: 'MUESTREO', plate: '', zone: '', guard: 'A', shift: 'DÍA', responsible: 'PRUEBA DE CONEXIÓN' },
        participants: [{ dni: '73342591', name: 'ABIGAIL VANESSA PALOMINO VICENTE', phone: '989422718', role: 'PROVEEDOR', license: '', category: '', lots: '1', detail: '', lotCodes: ['PRUEBA-' + stamp] }]
    });
    SpreadsheetApp.getUi().alert('Conexión correcta. Se creó ' + saved.id + ' directamente en MATRIZ.');
}


// ============================================================
// MODULO CARGOS Y SALIDAS - V15
// ============================================================
function configurarModuloCargos() {
    var ss = SpreadsheetApp.getActive();

    // BD SALIDAS es la base operativa consolidada para Cargos y Salidas.
    // No borra ni modifica los registros históricos existentes.
    ensureSheetWithHeaders_(ss, CFG.SALIDAS, [
        'N°',
        'TIPO',
        'CODIGO',
        'FECHA Y HORA',
        'ATENCION AL CLIENTE',
        'CONDUCTOR',
        'OBSERVACIONES'
    ]);

    // Base exclusiva para AUTORIZACIÓN DE SALIDA - GENERALES (GE).
    // Cada ítem del documento se guarda en una fila con el mismo correlativo GE.
    ensureSheetWithHeaders_(ss, CFG.SALIDAS_CARGO, [
        'N°',
        'TIPO SALIDA',
        'DESCRIPCIÓN',
        'MOTIVO',
        'CANT.',
        'UND. MEDIDA',
        'OBSERVACIONES',
        'FECHA/HORA',
        'ATENCIÓN AL CLIENTE',
        'CONDUCTOR'
    ]);

    ensureSheetWithHeaders_(ss, CFG.USERS, ['USUARIO','NOMBRE COMPLETO','ROL','ACTIVO','ULTIMO ACCESO','PIN']);

    var cfg = ensureSheetWithHeaders_(ss, CFG.CONFIG, ['CLAVE','VALOR']);
    setConfigIfMissing_(cfg, 'CORRELATIVO_CH', '187');
    setConfigIfMissing_(cfg, 'CORRELATIVO_PR', '211');
    setConfigIfMissing_(cfg, 'CORRELATIVO_GE', '0');

    SpreadsheetApp.getUi().alert('Módulo Cargos configurado para guardar en BD SALIDAS. No se modificó el historial existente.');
}
function ensureSheetWithHeaders_(ss, name, headers) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
    else {
        var current = sh.getRange(1,1,1,Math.max(sh.getLastColumn(), headers.length)).getDisplayValues()[0];
        for (var i=0;i<headers.length;i++) if (!String(current[i] || '').trim()) sh.getRange(1,i+1).setValue(headers[i]);
    }
    sh.setFrozenRows(1);
    return sh;
}
function setConfigIfMissing_(sh, key, value) {
    var last = sh.getLastRow();
    if (last > 1) {
        var vals = sh.getRange(2,1,last-1,2).getDisplayValues();
        for (var i=0;i<vals.length;i++) if (String(vals[i][0]).trim() === key) return;
    }
    sh.appendRow([key,value]);
}
function cargoPrefix_(type) {
    type = String(type || '').trim().toUpperCase();

    if (type === 'CHALA') return 'CH';
    if (type === 'PROVEEDORES') return 'PR';
    if (type === 'GENERALES') return 'GE';

    throw new Error('Tipo de documento no válido.');
}


// ============================================================
// CONSULTAR PRÓXIMO CORRELATIVO
// NO incrementa ni modifica la hoja CONFIG
// ============================================================
function previewCargoCorrelative_(type) {
    var prefix = cargoPrefix_(type);
    var key = 'CORRELATIVO_' + prefix;

    var sh = sheet_(CFG.CONFIG);
    var last = sh.getLastRow();
    var current = 0;

    if (last > 1) {
        var vals = sh.getRange(2, 1, last - 1, 2).getValues();

        for (var i = 0; i < vals.length; i++) {
            if (String(vals[i][0]).trim() === key) {
                current = Number(vals[i][1]) || 0;
                break;
            }
        }
    }

    var next = current + 1;

    return {
        type: String(type || '').trim().toUpperCase(),
        prefix: prefix,
        current: current,
        next: next,
        correlative: prefix + '-' + ('0000' + next).slice(-4)
    };
}


// ============================================================
// GENERAR Y RESERVAR CORRELATIVO
// Esta función SÍ incrementa CONFIG.
// Se utiliza únicamente cuando se guarda el documento.
// ============================================================
function nextCargoCorrelative_(type) {
    var prefix = cargoPrefix_(type);
    var key = 'CORRELATIVO_' + prefix;

    var sh = sheet_(CFG.CONFIG);
    var last = sh.getLastRow();
    var row = 0;
    var current = 0;

    if (last > 1) {
        var vals = sh.getRange(2, 1, last - 1, 2).getValues();

        for (var i = 0; i < vals.length; i++) {
            if (String(vals[i][0]).trim() === key) {
                row = i + 2;
                current = Number(vals[i][1]) || 0;
                break;
            }
        }
    }

    if (!row) {
        sh.appendRow([key, 0]);
        row = sh.getLastRow();
    }

    current++;

    sh.getRange(row, 2).setValue(current);

    return prefix + '-' + ('0000' + current).slice(-4);
}
function lookupCargoProvider_(code) {
    code = String(code || '').trim();
    if (!code) throw new Error('Ingresa un código para buscar el proveedor.');
    var ext = SpreadsheetApp.openById(CFG.GUIAS_ID);
    var sh = ext.getSheetByName(CFG.GUIAS_SHEET);
    if (!sh) throw new Error('No se encontró la hoja PROCESOS - GUIAS.');
    var last = sh.getLastRow();
    if (last < 1) return { found:false, code:code, provider:'' };
    var hit = sh.getRange(1,1,last,1).createTextFinder(code).matchEntireCell(true).findNext();
    if (!hit) return { found:false, code:code, provider:'' };
    var provider = String(sh.getRange(hit.getRow(),9).getDisplayValue() || '').trim();
    return { found:Boolean(provider), code:code, provider:provider, row:hit.getRow() };
}
function saveCargo_(p) {
    var type = String(p.type || '').trim().toUpperCase();

    if (['CHALA', 'PROVEEDORES', 'GENERALES'].indexOf(type) < 0) {
        throw new Error('Tipo de documento no válido.');
    }

    var user = String(p.attentionUser || '').trim().toUpperCase();

    if (!user) {
        throw new Error('Falta el responsable de Atención al Cliente.');
    }

    var rows = array_(p.rows).filter(function(r) {
        return r && [
            r.type,
            r.code,
            r.weight,
            r.destination,
            r.description,
            r.reason,
            r.quantity,
            r.unit,
            r.observations
        ].some(function(v) {
            return String(v || '').trim();
        });
    });

    if (!rows.length) {
        throw new Error('Agrega al menos un ítem al documento.');
    }

    if (type === 'PROVEEDORES' && !String(p.provider || '').trim()) {
        throw new Error('Falta identificar el proveedor.');
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {

        var corr = nextCargoCorrelative_(type);
        var now = new Date();
        var conductor = type === 'PROVEEDORES' ? String(p.provider || '').trim().toUpperCase() : String(p.conductor || '').trim().toUpperCase();

        // =====================================================
        // GENERALES -> BD SALIDAS CARGO
        // =====================================================
        if (type === 'GENERALES') {

            var shCargo = sheet_(CFG.SALIDAS_CARGO);

            /*
             * BD SALIDAS CARGO
             *
             * A N°
             * B TIPO SALIDA
             * C DESCRIPCIÓN
             * D MOTIVO
             * E CANT.
             * F UND. MEDIDA
             * G OBSERVACIONES
             * H FECHA/HORA
             * I ATENCIÓN AL CLIENTE
             * J CONDUCTOR
             */

            var tipoSalida = String(
                p.generalExitType || ''
            ).trim().toUpperCase();

            if (!tipoSalida) {
                throw new Error('Selecciona el tipo de salida.');
            }

            var salidaCargo = rows.map(function(r) {

                return [
                    corr,
                    tipoSalida,
                    String(r.description || '').trim().toUpperCase(),
                    String(r.reason || '').trim().toUpperCase(),
                    String(r.quantity || '').trim(),
                    String(r.unit || '').trim().toUpperCase(),
                    String(r.observations || '').trim().toUpperCase(),
                    now,
                    user,
                    conductor
                ];

            });

            var filaCargo = Math.max(
                shCargo.getLastRow() + 1,
                2
            );

            shCargo.getRange(
                filaCargo,
                1,
                salidaCargo.length,
                10
            ).setValues(salidaCargo);

            // FECHA/HORA = columna H
            shCargo.getRange(
                filaCargo,
                8,
                salidaCargo.length,
                1
            ).setNumberFormat('dd/MM/yyyy HH:mm:ss');

        }

        // =====================================================
        // CHALA Y PROVEEDORES -> BD SALIDAS
        // =====================================================
        else {

            var sh = sheet_(CFG.SALIDAS);

            /*
             * BD SALIDAS
             *
             * A N°
             * B TIPO
             * C CODIGO
             * D FECHA Y HORA
             * E ATENCION AL CLIENTE
             * F CONDUCTOR
             * G OBSERVACIONES
             */

            var salida = rows.map(function(r) {

                return [
                    corr,
                    String(r.type || '').trim().toUpperCase(),
                    String(r.code || '').trim().toUpperCase(),
                    now,
                    user,
                    conductor,
                    String(r.observations || '').trim().toUpperCase()
                ];

            });

            var filaInicio = Math.max(
                sh.getLastRow() + 1,
                2
            );

            sh.getRange(
                filaInicio,
                1,
                salida.length,
                7
            ).setValues(salida);

            // FECHA/HORA = columna D
            sh.getRange(
                filaInicio,
                4,
                salida.length,
                1
            ).setNumberFormat('dd/MM/yyyy HH:mm:ss');

        }

        return {
            id: corr,
            correlative: corr,
            savedAt: now.toISOString(),
            status: 'GUARDADO'
        };

    } finally {
        lock.releaseLock();
    }
}

function searchCargoExits_(p) {
    p = p && typeof p === 'object' ? p : {};

    var tipo = String(p.type || '').trim().toUpperCase();
    var codigo = String(p.code || '').trim().toUpperCase();
    var fecha = String(p.date || '').trim();
    var limit = Math.min(Math.max(Number(p.limit) || 200, 1), 500);

    var sh = sheet_(CFG.SALIDAS);
    var last = sh.getLastRow();
    if (last < 2) return [];

    var data = sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), 10)).getValues();

    // Índice de códigos de MATRIZ para recuperar GUARDIA y TURNO
    // de los ingresos ya registrados, sin alterar el historial de BD SALIDAS.
    var matrix = sheet_(CFG.MATRIX);
    var mm = map_(matrix, MF);
    var matrixData = values_(matrix, CFG.HEADER + 1);
    var byCode = {};

    matrixData.forEach(function(r) {
        var rawCodes = String(r[mm.code] || '').toUpperCase().split(/\s+/).filter(Boolean);
        rawCodes.forEach(function(c) {
            if (!byCode[c]) {
                byCode[c] = {
                    guard: String(r[mm.guard] || '').trim().toUpperCase(),
                    shift: String(r[mm.shift] || '').trim().toUpperCase()
                };
            }
        });
    });

    var tz = Session.getScriptTimeZone();
    var out = [];

    data.forEach(function(r) {
        var corr = String(r[0] || '').trim().toUpperCase();
        var rowType = String(r[1] || '').trim().toUpperCase();
        var rowCode = String(r[2] || '').trim().toUpperCase();
        var dt = r[3];
        var responsible = String(r[4] || '').trim().toUpperCase();
        var conductor = String(r[5] || '').trim().toUpperCase();
        var observations = String(r[6] || '').trim().toUpperCase();
        var receiptStatus = String(r[7] || 'PENDIENTE').trim().toUpperCase();
        var receivedAt = r[8];
        var receivedBy = String(r[9] || '').trim().toUpperCase();

        if (!corr || !rowCode) return;
        if (tipo && rowType !== tipo) return;
        if (codigo && rowCode.indexOf(codigo) < 0) return;

        var d = dt instanceof Date ? dt : new Date(dt);
        var validDate = !isNaN(d.getTime());
        var day = validDate ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : '';

        if (fecha && day !== fecha) return;

        var op = byCode[rowCode] || {};
        var shift = String(op.shift || '').trim().toUpperCase();
        if (!shift && validDate) shift = operationalShift_(d);

        out.push({
            correlative: corr,
            type: rowType,
            code: rowCode,
            dateTime: validDate ? d.toISOString() : String(dt || ''),
            responsible: responsible,
            guard: String(op.guard || '').trim().toUpperCase(),
            shift: shift,
            conductor: conductor,
            observations: observations,
            receiptStatus: receiptStatus || 'PENDIENTE',
            receivedAt: receivedAt instanceof Date ? receivedAt.toISOString() : String(receivedAt || ''),
            receivedBy: receivedBy
        });
    });

    out.sort(function(a, b) {
        return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime();
    });

    return out.slice(0, limit);
}

function cargoPendingReceipts_(p) {
  p=p||{};var limit=Math.min(Math.max(Number(p.limit)||300,1),500),sh=sheet_(CFG.SALIDAS),last=sh.getLastRow();if(last<2)return [];
  var data=sh.getRange(2,1,last-1,Math.max(sh.getLastColumn(),10)).getValues(),out=[],tz=Session.getScriptTimeZone();
  data.forEach(function(r){var corr=String(r[0]||'').trim().toUpperCase(),type=String(r[1]||'').trim().toUpperCase(),code=String(r[2]||'').trim().toUpperCase(),st=String(r[7]||'PENDIENTE').trim().toUpperCase();if(!corr||!code||st==='RECIBIDO'||type!=='CH')return;var d=r[3] instanceof Date?r[3]:new Date(r[3]);out.push({correlative:corr,type:type,code:code,dateTime:isNaN(d.getTime())?String(r[3]||''):d.toISOString(),responsible:String(r[4]||''),shift:!isNaN(d.getTime())?operationalShift_(d):'',receiptStatus:'PENDIENTE'});});
  out.sort(function(a,b){return new Date(a.dateTime).getTime()-new Date(b.dateTime).getTime();});return out.slice(0,limit);
}
function cargoConfirmReceipts_(p) {
  p=p||{};var keys=p.keys||[],responsable=String(p.responsable||'').trim().toUpperCase();if(!keys.length)throw new Error('No hay registros seleccionados.');if(!responsable)throw new Error('No se identificó al responsable.');
  var wanted={};keys.forEach(function(k){wanted[String(k).toUpperCase()]=true;});var lock=LockService.getScriptLock();lock.waitLock(15000);try{var sh=sheet_(CFG.SALIDAS),last=sh.getLastRow();if(last<2)return {cantidad:0};var cols=Math.max(sh.getLastColumn(),10),data=sh.getRange(2,1,last-1,cols).getValues(),now=new Date(),n=0;data.forEach(function(r,i){var k=[r[0],r[1],r[2]].map(function(x){return String(x||'').trim().toUpperCase();}).join('|');if(wanted[k]&&String(r[1]||'').trim().toUpperCase()==='CH'&&String(r[7]||'PENDIENTE').toUpperCase()!=='RECIBIDO'){sh.getRange(i+2,8,1,3).setValues([['RECIBIDO',now,responsable]]);sh.getRange(i+2,9).setNumberFormat('dd/MM/yyyy HH:mm:ss');n++;}});if(!n)throw new Error('Los registros seleccionados ya no están pendientes o no corresponden a tipo CH.');return {cantidad:n,fecha:now.toISOString()};}finally{lock.releaseLock();}
}

function getCargo_(id) {
    id = String(id || '').trim().toUpperCase();
    if (!id) throw new Error('Falta el correlativo del cargo.');

    // GE se consulta en su base exclusiva.
    if (id.indexOf('GE-') === 0) {
        var shCargo = sheet_(CFG.SALIDAS_CARGO);
        var lastCargo = shCargo.getLastRow();

        if (lastCargo < 2) throw new Error('Cargo no encontrado.');

        var hitsCargo = shCargo
            .getRange(2, 1, lastCargo - 1, 1)
            .createTextFinder(id)
            .matchEntireCell(true)
            .findAll();

        if (!hitsCargo.length) throw new Error('Cargo no encontrado.');

        var rowsCargo = hitsCargo.map(function(hit) {
            var v = shCargo.getRange(hit.getRow(), 1, 1, 10).getDisplayValues()[0];
            return {
                correlative: v[0],
                generalExitType: v[1],
                description: v[2],
                reason: v[3],
                quantity: v[4],
                unit: v[5],
                observations: v[6],
                dateTime: v[7],
                attentionUser: v[8],
                conductor: v[9]
            };
        });

        return {
            id: id,
            correlative: id,
            type: 'GENERALES',
            generalExitType: rowsCargo[0].generalExitType,
            dateTime: rowsCargo[0].dateTime,
            attentionUser: rowsCargo[0].attentionUser,
            conductor: rowsCargo[0].conductor,
            status: 'GUARDADO',
            rows: rowsCargo
        };
    }

    // CH y PR continúan consultándose en BD SALIDAS.
    var sh = sheet_(CFG.SALIDAS);
    var last = sh.getLastRow();

    if (last < 2) throw new Error('Cargo no encontrado.');

    var hits = sh
        .getRange(2, 1, last - 1, 1)
        .createTextFinder(id)
        .matchEntireCell(true)
        .findAll();

    if (!hits.length) throw new Error('Cargo no encontrado.');

    var rows = hits.map(function(hit) {
        var v = sh.getRange(hit.getRow(), 1, 1, 7).getDisplayValues()[0];
        return {
            correlative: v[0],
            type: v[1],
            code: v[2],
            dateTime: v[3],
            attentionUser: v[4],
            conductor: v[5],
            observations: v[6]
        };
    });

    return {
        id: id,
        correlative: id,
        dateTime: rows[0].dateTime,
        attentionUser: rows[0].attentionUser,
        conductor: rows[0].conductor,
        status: 'GUARDADO',
        rows: rows
    };
}



// ============================================================
// V5 - CONFIGURAR NUEVOS PERMISOS DE SUBMODULOS
// Ejecutar una sola vez desde Apps Script. No borra permisos existentes.
// ============================================================
function configurarPermisosSubmodulosV5() {
  var sh = sheet_(CFG.USERS);
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function(x){return String(x||"").trim();});
  var nuevos = [
    "Estadía, Servicios y Consumos",
    "Salida de Proveedores",
    "Control de Habitaciones",
    "Resumen diario / guardia",
    "Pendientes de recepción"
  ];
  var faltan = nuevos.filter(function(n){return headers.indexOf(n) < 0;});
  if (faltan.length) sh.getRange(1, lastCol + 1, 1, faltan.length).setValues([faltan]);
  return {ok:true, agregados:faltan, total:nuevos.length};
}
