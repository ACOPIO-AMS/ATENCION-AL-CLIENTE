// ATENCION AL CLIENTE - SCRIPT FINAL COMPATIBLE CON GOOGLE APPS SCRIPT
// VERSION: ATENCION-2026-08-21-V11-LIGERO - REEMPLAZAR TODO EL CONTENIDO DE Codigo.gs
// VERIFICACION: este archivo usa sintaxis ES5 compatible, sin operadores modernos.

var SCRIPT_VERSION = 'ATENCION-2026-08-21-V11-LIGERO';
var WRITE_LOCK_MS = 1500;

var CFG = Object.freeze({ HEADER: 2, MATRIX: 'MATRIZ', CLIENTS: 'BD CLIENTES' });
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
            health: function () { return health_(); }, searchPerson: function () { return searchPerson_(p_1.dni); }, recent: function () { return search_(p_1.query || '', p_1.limit || 8); }, today: function () { return today_(); },
            search: function () { return search_(p_1.query || '', p_1.limit || 30); }, pending: function () { return pending_(); }, listPeople: function () { return listPeople_(p_1.limit); },
            getEvent: function () { return getEvent_(p_1.id); }, saveEvent: function () { return saveEvent_(p_1); }, regularizeEvent: function () { return regularize_(p_1); },
            syncBatch: function () { return syncBatch_(p_1.items || []); }
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
    return (items || []).slice(0, 5).map(function (item) {
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
    var people = uniqueParticipants_(p.participants || []);
    if (!people.length)
        throw new Error('Registra al menos una persona con DNI.');
    var status_1 = p.forRegularization || (p.pendingReasons || []).length ? 'PENDIENTE' : 'COMPLETO';
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
    validate_(p, true);
    var validPeople_1 = uniqueParticipants_(p.participants || []);
    var status = p.forRegularization || (p.pendingReasons || []).length ? 'PENDIENTE' : 'COMPLETO';
    var synchronizedId = syncedId_(p.clientRequestId);
    if (synchronizedId)
        return getEvent_(synchronizedId);
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
    (people || []).forEach(function (person) {
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
    var incomingCodes = (incoming.lotCodes || []).filter(function (code) { return String(code || '').trim(); });
    next.lotCodes = incomingCodes.length ? incomingCodes : (current.lotCodes || []);
    return next;
}
function completedEvent_(current, incoming) {
    var next = {}, keys = ['motive', 'plate', 'zone', 'guard', 'shift', 'responsible'];
    keys.forEach(function (key) { next[key] = String(incoming[key] || '').trim() ? incoming[key] : current[key]; });
    return next;
}
function completeExistingRow_(existing, m, incoming, event) {
    var row = existing.raw.slice(), nextEvent = event || {}, codes = (incoming.lotCodes || []).map(function (code) { return String(code || '').trim().toUpperCase(); }).filter(Boolean);
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
    var sheet = sheet_(CFG.MATRIX), m = map_(sheet, MF), groups = {}, todayIds = {}, today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), allRows = matrixRows_(sheet, m);
    allRows.forEach(function (row) {
        if (Utilities.formatDate(new Date(row.dateTime), Session.getScriptTimeZone(), 'yyyy-MM-dd') === today)
            todayIds[row.id] = true;
    });
    allRows.forEach(function (row) {
        if (!todayIds[row.id])
            return;
        if (!groups[row.id])
            groups[row.id] = [];
        groups[row.id].push(row);
    });
    var clients = {}, states = pendingMap_();
    return Object.keys(groups).sort(function (a, b) { return new Date(groups[b][0].dateTime) - new Date(groups[a][0].dateTime); }).map(function (id) { return eventFromRows_(id, groups[id], clients, null, states); });
}
function pending_() {
    var states = pendingMap_(), pendingIds = Object.keys(states).filter(function (id) { return states[id].status === 'PENDIENTE'; });
    if (!pendingIds.length)
        return [];
    var matrix = sheet_(CFG.MATRIX), m = map_(matrix, MF), wanted = {}, groups = {}, clients = {};
    pendingIds.forEach(function (id) { wanted[id] = true; });
    matrixRows_(matrix, m).forEach(function (row) { if (wanted[row.id]) { if (!groups[row.id])
        groups[row.id] = []; groups[row.id].push(row); } });
    return pendingIds.filter(function (id) { return groups[id] && groups[id].length; }).map(function (id) { return eventFromRows_(id, groups[id], clients, null, states); }).sort(function (a, b) { return new Date(b.dateTime) - new Date(a.dateTime); });
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
    var providers = (p.participants || []).filter(function (x) { return x.role === 'PROVEEDOR' && /^\d{8}$/.test(String(x.dni || '')); });
    var owns = person.role === 'PROVEEDOR' || (!providers.length && person.role === 'CONDUCTOR');
    var codes = (person.lotCodes || []).map(function (value) { return String(value || '').trim().toUpperCase(); }).filter(Boolean);
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
        status: status || 'COMPLETO', pendingReasons: p.pendingReasons || [],
        motive: String(event.motive || 'PROCESO'), plate: String(event.plate || ''), zone: String(event.zone || ''),
        guard: String(event.guard || ''), shift: operationalShift_(p.dateTime), responsible: String(event.responsible || ''),
        persons: (people || []).map(function (person) {
            return { dni: cleanId_(person.dni), name: String(person.name || ''), phone: cleanId_(person.phone), role: String(person.role || '').toUpperCase(),
                license: String(person.license || ''), category: category_(person.category), lots: cleanId_(person.lots), detail: String(person.detail || ''),
                lotCodes: (person.lotCodes || []).map(function (code) { return String(code || '').trim().toUpperCase(); }).filter(Boolean) };
        })
    };
}
function ensureClients_(people) {
    if (!people || !people.length)
        return;
    var sheet = sheet_(CFG.CLIENTS), m = map_(sheet, CF), count = Math.max(sheet.getLastRow() - CFG.HEADER, 0), additions = [];
    people.forEach(function (person) {
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
function clientObject_(r, m) { return { dni: cleanId_(r[m.dni]), name: String(r[m.name] || ''), phone: cleanId_(r[m.phone]), role: String(r[m.role] || ''), license: String(r[m.license] || ''), category: category_(r[m.category]) }; }
function clientMap_() { var s = sheet_(CFG.CLIENTS), m = map_(s, CF), out = {}; values_(s, CFG.HEADER + 1).forEach(function (r) { var p = clientObject_(r, m); if (p.dni)
    out[p.dni] = p; }); return out; }
function upsertPending_(id, caseId, status, reasons) {
    var properties = PropertiesService.getScriptProperties(), key = 'PENDING_' + String(id);
    if (status !== 'PENDIENTE') {
        properties.deleteProperty(key);
        return;
    }
    properties.setProperty(key, JSON.stringify({ caseId: Number(caseId) || 1, status: 'PENDIENTE', pendingReasons: reasons || [] }));
}
function pendingMap_() {
    var out = {}, all = PropertiesService.getScriptProperties().getProperties();
    Object.keys(all).forEach(function (key) {
        if (key.indexOf('PENDING_') !== 0)
            return;
        var id = key.slice(8), state = parse_(all[key], null);
        if (id && state)
            out[id] = state;
    });
    return out;
}
function pendingState_(id) { return parse_(PropertiesService.getScriptProperties().getProperty('PENDING_' + String(id)), {}); }
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
    throw new Error('ID requerido.'); var e = p.event || {}, c = Number(p.caseId) || 1; if (!String(e.responsible || '').trim())
    throw new Error('Responsable requerido.'); if (String(e.plate || '').length > 7)
    throw new Error('La placa admite máximo 7 caracteres.'); (p.participants || []).forEach(function (person) { if (String(person.role || '').toUpperCase() === 'CONDUCTOR' && String(person.license || '').length > 9)
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
    var recent = parse_(PropertiesService.getScriptProperties().getProperty('SYNC_RECIENTE'), []);
    var hit = recent.filter(function (item) { return item.requestId === String(requestId); })[0];
    return hit ? String(hit.id || '') : '';
}
function recordSync_(requestId, id, action, alreadyChecked) {
    if (!requestId || (!alreadyChecked && syncedId_(requestId)))
        return;
    var properties = PropertiesService.getScriptProperties(), recent = parse_(properties.getProperty('SYNC_RECIENTE'), []);
    recent = recent.filter(function (item) { return item.requestId !== String(requestId); });
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
function category_(v) {
    var raw = String(v || '').trim().toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, ''), compact = raw.replace(/-/g, '');
    var categories = { AI: 'A-I', AIIA: 'A-IIA', AIIB: 'A-IIB', AIIIA: 'A-IIIA', AIIIB: 'A-IIIB', AIIIC: 'A-IIIC' };
    return categories[compact] || raw;
}
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
