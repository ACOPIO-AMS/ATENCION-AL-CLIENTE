/**
 * AMS - ESTADÍA, SERVICIOS, HABITACIONES Y SALIDAS
 * Archivo independiente. No reemplaza Código.gs.
 * Compatible con Google Apps Script / V8.
 */

var EST_CFG = Object.freeze({
  ESTADIAS: "ESTADIAS",
  SERVICIOS: "SERVICIOS CONSUMOS",
  HABITACIONES: "HABITACIONES",
  MOVIMIENTOS: "MOVIMIENTOS ESTADIA"
});

function estadiaSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function estadiaSheet_(name, headers) {
  var ss = estadiaSS_();
  var sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }

  return sh;
}

/**
 * Función pública de prueba/configuración.
 * Esta sí debe aparecer en el selector de Apps Script.
 */
function configurarModuloEstadia() {
  estadiaInit_();
  SpreadsheetApp.getUi().alert(
    "Módulo de Estadía configurado correctamente.\n\n" +
    "Se verificaron las hojas ESTADIAS, SERVICIOS CONSUMOS, HABITACIONES y MOVIMIENTOS ESTADIA."
  );
}

function estadiaInit_() {
  function asegurarHeaders_(sh, headers) {
    if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  var shEstadias = estadiaSheet_(EST_CFG.ESTADIAS, [
    "ID INGRESO", "DNI", "NOMBRE", "ROL", "PLACA", "PROVEEDOR",
    "FECHA INGRESO", "SALIDA PREVISTA", "FECHA SALIDA", "HABITACION",
    "ESTADO", "RESPONSABLE ULTIMO", "FECHA ACTUALIZACION", "ZONA"
  ]);
  asegurarHeaders_(shEstadias, [
    "ID INGRESO", "DNI", "NOMBRE", "ROL", "PLACA", "PROVEEDOR",
    "FECHA INGRESO", "SALIDA PREVISTA", "FECHA SALIDA", "HABITACION",
    "ESTADO", "RESPONSABLE ULTIMO", "FECHA ACTUALIZACION", "ZONA"
  ]);

  var shServicios = estadiaSheet_(EST_CFG.SERVICIOS, [
    "FECHA Y HORA", "FECHA OPERATIVA", "TURNO", "GUARDIA",
    "ID INGRESO", "DNI", "NOMBRE", "PLACA", "PROVEEDOR",
    "SERVICIO", "CANTIDAD", "ESTADO", "RESPONSABLE",
    "ENTREGADO A", "DNI DESTINO", "OBSERVACION", "CUMPLIMIENTO HORARIO"
  ]);
  asegurarHeaders_(shServicios, [
    "FECHA Y HORA", "FECHA OPERATIVA", "TURNO", "GUARDIA",
    "ID INGRESO", "DNI", "NOMBRE", "PLACA", "PROVEEDOR",
    "SERVICIO", "CANTIDAD", "ESTADO", "RESPONSABLE",
    "ENTREGADO A", "DNI DESTINO", "OBSERVACION", "CUMPLIMIENTO HORARIO"
  ]);

  estadiaSheet_(EST_CFG.MOVIMIENTOS, [
    "FECHA Y HORA", "FECHA OPERATIVA", "TURNO", "GUARDIA",
    "ACCION", "ID INGRESO", "DNI", "NOMBRE", "PLACA",
    "DETALLE", "RESPONSABLE"
  ]);

  var h = estadiaSheet_(EST_CFG.HABITACIONES, [
    "HABITACION", "ESTADO", "DNI", "HUESPED", "PLACA",
    "PROVEEDOR", "FECHA INGRESO", "SALIDA PREVISTA",
    "RESPONSABLE", "FECHA ACTUALIZACION"
  ]);

  if (h.getLastRow() < 2) {
    var nums = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 29, 31
    ];

    var roomRows = nums.map(function (n) {
      return [String(n), "DISPONIBLE", "", "", "", "", "", "", "", ""];
    });

    h.getRange(2, 1, roomRows.length, 10).setValues(roomRows);
  }
}

function estadiaAhora_() {
  return new Date();
}

function estadiaTurno_(d) {
  var h = d.getHours();
  return h >= 7 && h < 19 ? "DÍA" : "NOCHE";
}

function estadiaFechaOperativa_(d) {
  var x = new Date(d);
  if (x.getHours() < 7) {
    x.setDate(x.getDate() - 1);
  }

  return Utilities.formatDate(
    x,
    Session.getScriptTimeZone() || "America/Lima",
    "yyyy-MM-dd"
  );
}

function estadiaGuardia_(payload) {
  return String((payload && payload.guardia) || "");
}

function estadiaRows_(sh) {
  if (!sh || sh.getLastRow() < 2) {
    return [];
  }

  return sh.getRange(
    2,
    1,
    sh.getLastRow() - 1,
    sh.getLastColumn()
  ).getValues();
}

function estadiaIso_(v) {
  if (!v) {
    return "";
  }

  var d = v instanceof Date ? v : new Date(v);

  if (isNaN(d.getTime())) {
    return String(v);
  }

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone() || "America/Lima",
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}

function estadiaNormalizarPresentesAntiguos_() {
  var sh = estadiaSS_().getSheetByName(EST_CFG.ESTADIAS);
  if (!sh || sh.getLastRow() < 2) return;
  var rows = estadiaRows_(sh);
  var limite = new Date();
  limite.setDate(limite.getDate() - 7);
  for (var i = 0; i < rows.length; i++) {
    var estado = String(rows[i][10] || "").toUpperCase();
    var ingreso = rows[i][6] instanceof Date ? rows[i][6] : new Date(rows[i][6]);
    if (estado === "PRESENTE" && !isNaN(ingreso.getTime()) && ingreso < limite) {
      sh.getRange(i + 2, 11, 1, 3).setValues([["HISTORICO", "SISTEMA", new Date()]]);
    }
  }
}

function estadiaSincronizarMatriz_() {
  estadiaInit_();

  var ss = estadiaSS_();
  var m = ss.getSheetByName("MATRIZ");

  if (!m || m.getLastRow() < 3) {
    return;
  }

  var lastCol = m.getLastColumn();
  var headers = m.getRange(2, 1, 1, lastCol).getDisplayValues()[0];

  function col_() {
    var a, i, n;

    for (a = 0; a < arguments.length; a++) {
      n = String(arguments[a] || "").trim().toUpperCase();

      for (i = 0; i < headers.length; i++) {
        if (String(headers[i] || "").trim().toUpperCase() === n) {
          return i;
        }
      }
    }

    return -1;
  }

  var cId = col_("ID");
  var cDni = col_("DNI");
  var cNom = col_("NOMBRES Y APELLIDOS");
  var cRol = col_("OCUPACION");
  var cPlaca = col_("PLACA");
  var cFecha = col_("FECHA Y HORA DE INGRESO");
  var cZona = col_("ZONA", "SECTOR", "AREA", "ÁREA");

  if (cId < 0 || cDni < 0 || cNom < 0 || cFecha < 0) {
    return;
  }

  var rows = m.getRange(3, 1, m.getLastRow() - 2, lastCol).getValues();
  var e = ss.getSheetByName(EST_CFG.ESTADIAS);
  var existing = estadiaRows_(e);
  var keys = {};
  var proveedoresPorIngreso = {};

  existing.forEach(function (r) {
    keys[String(r[0]) + "|" + String(r[1])] = true;
  });

  /* Primero identifica el proveedor de cada ingreso para poder
     asociarlo también al conductor y acompañantes del mismo vehículo. */
  rows.forEach(function (r) {
    var id = String(r[cId] || "").trim();
    var rol = cRol >= 0 ? String(r[cRol] || "").trim().toUpperCase() : "";
    var nombre = String(r[cNom] || "").trim();

    if (id && rol === "PROVEEDOR" && nombre) {
      proveedoresPorIngreso[id] = nombre;
    }
  });

  var add = [];

  rows.forEach(function (r) {
    var id = String(r[cId] || "").trim();
    var dni = String(r[cDni] || "").trim();

    if (!id || !dni) {
      return;
    }

    var fechaIngreso = r[cFecha] instanceof Date ? r[cFecha] : new Date(r[cFecha]);
    var limiteSync = new Date();
    limiteSync.setDate(limiteSync.getDate() - 7);
    if (isNaN(fechaIngreso.getTime()) || fechaIngreso < limiteSync) {
      return;
    }

    var k = id + "|" + dni;

    if (keys[k]) {
      return;
    }

    keys[k] = true;

    var rol = cRol >= 0 ? String(r[cRol] || "") : "";
    var nombre = String(r[cNom] || "");
    var placa = cPlaca >= 0 ? String(r[cPlaca] || "") : "";
    var proveedor = proveedoresPorIngreso[id] || "";

    if (!proveedor && String(rol).toUpperCase() === "PROVEEDOR") {
      proveedor = nombre;
    }

    add.push([
      id,
      dni,
      nombre,
      rol,
      placa,
      proveedor,
      r[cFecha],
      "",
      "",
      "",
      "PRESENTE",
      "",
      new Date(),
      cZona >= 0 ? String(r[cZona] || "") : ""
    ]);
  });

  if (add.length) {
    e.getRange(e.getLastRow() + 1, 1, add.length, 14).setValues(add);
  }
}

function estadiaListarPresentes_() {
  var cache = CacheService.getScriptCache();
  if (!cache.get("ESTADIA_SYNC_V4")) {
    estadiaSincronizarMatriz_();
    cache.put("ESTADIA_SYNC_V4", "1", 30);
  }
  estadiaNormalizarPresentesAntiguos_();

  var sh = estadiaSS_().getSheetByName(EST_CFG.ESTADIAS);

  return estadiaRows_(sh)
    .filter(function (r) {
      return String(r[10] || "").toUpperCase() === "PRESENTE";
    })
    .map(function (r) {
      return {
        idIngreso: String(r[0] || ""),
        dni: String(r[1] || ""),
        nombre: String(r[2] || ""),
        rol: String(r[3] || ""),
        placa: String(r[4] || ""),
        proveedor: String(r[5] || ""),
        fechaIngreso: estadiaIso_(r[6]),
        salidaPrevista: estadiaIso_(r[7]),
        fechaSalida: estadiaIso_(r[8]),
        habitacion: String(r[9] || ""),
        estado: "PRESENTE",
        zona: String(r[13] || "")
      };
    });
}


function estadiaServicioEsComida_(x){x=String(x||"").toUpperCase();return x==="DESAYUNO"||x==="ALMUERZO"||x==="CENA";}
function estadiaRegistrarServicio_(p){return estadiaRegistrarServiciosLote_({personas:[p],servicios:[{servicio:p.servicio,cantidad:p.cantidad}],responsable:p.responsable,guardia:p.guardia,modo:p.modo});}
function estadiaRegistrarServiciosLote_(p){
  p=p||{};estadiaInit_();
  var personas=p.personas||[],servicios=p.servicios||[];
  if(!personas.length||!servicios.length)throw new Error("No hay personas o servicios para registrar.");
  var sh=estadiaSS_().getSheetByName(EST_CFG.SERVICIOS),d=new Date(),rows=estadiaRows_(sh),add=[],modo=String(p.modo||"ENTREGA").toUpperCase();
  var fechaOp=estadiaFechaOperativa_(d), cambios=[];
  function horaMin_(x){return x.getHours()*60+x.getMinutes();}
  function cumplimiento_(serv){var m=horaMin_(d),ok=serv==="DESAYUNO"?(m>=360&&m<=480):serv==="ALMUERZO"?(m>=720&&m<=840):serv==="CENA"?(m>=1080&&m<=1200):true;return ok?"EN HORARIO":"FUERA DE HORARIO";}
  function pendiente_(x,serv){for(var i=rows.length-1;i>=0;i--){if(String(rows[i][1])===fechaOp&&String(rows[i][4])===String(x.idIngreso)&&String(rows[i][5])===String(x.dni)&&String(rows[i][9]).toUpperCase()===serv&&String(rows[i][11]).toUpperCase()==="SOLICITADO")return i;}return -1;}
  function yaEntregado_(x,serv){for(var i=rows.length-1;i>=0;i--){if(String(rows[i][1])===fechaOp&&String(rows[i][4])===String(x.idIngreso)&&String(rows[i][5])===String(x.dni)&&String(rows[i][9]).toUpperCase()===serv&&String(rows[i][11]).toUpperCase()==="ENTREGADO")return true;}return false;}
  personas.forEach(function(x){servicios.forEach(function(sv){
    var serv=String(sv.servicio||"").toUpperCase(),cant=Math.max(0,Number(sv.cantidad)||0);if(!serv||cant<=0)return;
    if(estadiaServicioEsComida_(serv)&&modo==="SOLICITUD"){
      if(pendiente_(x,serv)<0&&!yaEntregado_(x,serv))add.push([d,fechaOp,estadiaTurno_(d),String(p.guardia||x.guardia||""),x.idIngreso||"",x.dni||"",x.nombre||"",x.placa||"",x.proveedor||"",serv,1,"SOLICITADO",p.responsable||"","","","",""]);
      return;
    }
    if(estadiaServicioEsComida_(serv)){
      if(yaEntregado_(x,serv))return;
      var comp=cumplimiento_(serv),obs=String(p.observacion||sv.observacion||"").trim();
      if(comp==="FUERA DE HORARIO"&&!obs)throw new Error(serv+": entrega fuera del horario normal. Ingresa el motivo/observación para continuar.");
      var pi=pendiente_(x,serv);if(pi<0)throw new Error(serv+": primero debe existir una solicitud pendiente para "+String(x.nombre||x.dni||"la persona")+".");
      cambios.push({fila:pi+2});rows[pi][11]="ATENDIDO";
      add.push([d,fechaOp,estadiaTurno_(d),String(p.guardia||x.guardia||""),x.idIngreso||"",x.dni||"",x.nombre||"",x.placa||"",x.proveedor||"",serv,1,"ENTREGADO",p.responsable||"","","",obs,comp]);
    }else{
      add.push([d,fechaOp,estadiaTurno_(d),String(p.guardia||x.guardia||""),x.idIngreso||"",x.dni||"",x.nombre||"",x.placa||"",x.proveedor||"",serv,cant,"ENTREGADO",p.responsable||"","","",String(p.observacion||sv.observacion||""),""]);
    }
  });});
  cambios.forEach(function(c){sh.getRange(c.fila,12).setValue("ATENDIDO");});
  if(add.length)sh.getRange(sh.getLastRow()+1,1,add.length,17).setValues(add);
  return {ok:true,cantidad:add.length};
}
function estadiaEstadoServicios_() {
  estadiaInit_();

  var ss = estadiaSS_();
  var shEst = ss.getSheetByName(EST_CFG.ESTADIAS);
  var shSrv = ss.getSheetByName(EST_CFG.SERVICIOS);

  var est = estadiaRows_(shEst);
  var srv = estadiaRows_(shSrv);

  var out = {
    personas: {},
    resumen: {
      DESAYUNO: {
        solicitados: 0,
        entregados: 0,
        pendientes: 0,
        retiro: 0,
        reasignados: 0
      },
      ALMUERZO: {
        solicitados: 0,
        entregados: 0,
        pendientes: 0,
        retiro: 0,
        reasignados: 0
      },
      CENA: {
        solicitados: 0,
        entregados: 0,
        pendientes: 0,
        retiro: 0,
        reasignados: 0
      }
    },
    consumos: {
      AGUA: 0,
      GASEOSA: 0,
      GALLETAS: 0
    }
  };

  function txt_(v) {
    return String(v === null || v === undefined ? "" : v)
      .trim()
      .toUpperCase();
  }

  function limpio_(v) {
    return txt_(v)
      .replace(/\u00A0/g, "")
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9]/g, "");
  }

  // ============================================================
  // PERSONAS ACTUALMENTE PRESENTES
  // ============================================================

  var presentesExactos = {};
  var presentesPorId = {};
  var presentesPorDni = {};

  est.forEach(function(r) {

    var estadoPersona = txt_(r[10]);

    if (estadoPersona !== "PRESENTE") return;

    var idOriginal = String(r[0] || "").trim();
    var dniOriginal = String(r[1] || "").trim();

    var id = limpio_(r[0]);
    var dni = limpio_(r[1]);

    var keyFrontend = idOriginal + "|" + dniOriginal;

    out.personas[keyFrontend] =
      out.personas[keyFrontend] || {};

    if (id || dni) {
      presentesExactos[id + "|" + dni] = keyFrontend;
    }

    if (id) {
      presentesPorId[id] = keyFrontend;
    }

    if (dni) {
      presentesPorDni[dni] = keyFrontend;
    }
  });


  // ============================================================
  // ESTADO ACTUAL DE ALIMENTACIÓN
  // ============================================================

  var comidas = {};

  srv.forEach(function(r) {

    var id = limpio_(r[4]);
    var dni = limpio_(r[5]);

    var personaKey = "";

    // 1. Coincidencia exacta ID + DNI
    if (presentesExactos[id + "|" + dni]) {
      personaKey = presentesExactos[id + "|" + dni];

    // 2. Coincidencia por ID
    } else if (id && presentesPorId[id]) {
      personaKey = presentesPorId[id];

    // 3. Coincidencia por DNI
    } else if (dni && presentesPorDni[dni]) {
      personaKey = presentesPorDni[dni];
    }

    // No pertenece a una persona actualmente presente
    if (!personaKey) return;


    var servicio = txt_(r[9]);
    var cantidad = Number(r[10]) || 0;
    var estado = txt_(r[11]);


    // ==========================================================
    // ALIMENTACIÓN
    // ==========================================================

    if (
      servicio === "DESAYUNO" ||
      servicio === "ALMUERZO" ||
      servicio === "CENA"
    ) {

      var ck = personaKey + "|" + servicio;

      if (!comidas[ck]) {
        comidas[ck] = {
          persona: personaKey,
          servicio: servicio,
          solicitado: false,
          estado: ""
        };
      }

      if (
        estado === "SOLICITADO" ||
        estado === "ENTREGADO" ||
        estado === "ATENDIDO" ||
        estado.indexOf("RETIRO") >= 0 ||
        estado.indexOf("REASIGN") >= 0
      ) {
        comidas[ck].solicitado = true;
      }

      /*
       * El último movimiento registrado en la hoja
       * representa el estado actual.
       */
      comidas[ck].estado = estado;

      return;
    }


    // ==========================================================
    // ATENCIÓN DE INGRESO
    // ==========================================================

    if (
      servicio === "AGUA" ||
      servicio === "GASEOSA" ||
      servicio === "GALLETAS"
    ) {

      if (
        estado === "ENTREGADO" ||
        estado === "ATENDIDO"
      ) {

        out.consumos[servicio] += cantidad;

        out.personas[personaKey][servicio] =
          (out.personas[personaKey][servicio] || 0) +
          cantidad;
      }
    }
  });


  // ============================================================
  // CONSOLIDAR ALIMENTACIÓN
  // ============================================================

  Object.keys(comidas).forEach(function(ck) {

    var x = comidas[ck];
    var z = out.resumen[x.servicio];

    if (!z) return;

    if (x.solicitado) {
      z.solicitados++;
    }

    var visual = "—";


    if (x.estado === "SOLICITADO") {

      visual = "PENDIENTE";


    } else if (
      x.estado === "ENTREGADO" ||
      x.estado === "ATENDIDO"
    ) {

      visual = "ENTREGADO";
      z.entregados++;


    } else if (
      x.estado.indexOf("RETIRO") >= 0
    ) {

      visual = "RETIRO";
      z.retiro++;


    } else if (
      x.estado.indexOf("REASIGN") >= 0
    ) {

      visual = "REASIGNADO";
      z.reasignados++;
    }


    out.personas[x.persona][x.servicio] = visual;
  });


  // ============================================================
  // PENDIENTES
  // ============================================================

  ["DESAYUNO", "ALMUERZO", "CENA"].forEach(
    function(servicio) {

      var z = out.resumen[servicio];

      z.pendientes = Math.max(
        0,
        z.solicitados -
        z.entregados -
        z.retiro -
        z.reasignados
      );
    }
  );


  return out;
}

function estadiaPendientesAlimentacion_(p){p=p||{};var wanted={};(p.personas||[]).forEach(function(x){wanted[String(x.idIngreso)+"|"+String(x.dni)]=true;});var rs=estadiaRows_(estadiaSS_().getSheetByName(EST_CFG.SERVICIOS)),out=[];rs.forEach(function(r,i){var k=String(r[4])+"|"+String(r[5]),sv=String(r[9]).toUpperCase(),st=String(r[11]).toUpperCase();if(wanted[k]&&estadiaServicioEsComida_(sv)&&st==="SOLICITADO")out.push({fila:i+2,idIngreso:String(r[4]),dni:String(r[5]),nombre:String(r[6]),servicio:sv,fecha:String(r[1])});});return out;}
function estadiaActualizarSalidaPrevista_(p){p=p||{};estadiaInit_();var sh=estadiaSS_().getSheetByName(EST_CFG.ESTADIAS),rs=estadiaRows_(sh);for(var i=0;i<rs.length;i++)if(String(rs[i][0])===String(p.idIngreso)&&String(rs[i][1])===String(p.dni)){sh.getRange(i+2,8).setValue(p.salidaPrevista||"");sh.getRange(i+2,12,1,2).setValues([[p.responsable||"",new Date()]]);return {ok:true};}throw new Error("No se encontró la estadía.");}
function estadiaRegistrarSalida_(p){p=p||{};var personas=[];if(String(p.modo||"").toUpperCase()==="VEHICULO"){var rs=estadiaRows_(estadiaSS_().getSheetByName(EST_CFG.ESTADIAS));rs.forEach(function(r){if(String(r[0])===String(p.idIngreso)&&String(r[10]).toUpperCase()==="PRESENTE")personas.push({idIngreso:r[0],dni:r[1]});});}else personas=[{idIngreso:p.idIngreso,dni:p.dni}];return estadiaRegistrarSalidasLote_({personas:personas,responsable:p.responsable});}
function estadiaRegistrarSalidasLote_(p){
 p=p||{};estadiaInit_();var ss=estadiaSS_(),sh=ss.getSheetByName(EST_CFG.ESTADIAS),rs=estadiaRows_(sh),wanted={},d=new Date(),changed=0,rooms={},resMap={};
 (p.personas||[]).forEach(function(x){wanted[String(x.idIngreso)+"|"+String(x.dni)]=true;});
 (p.resoluciones||[]).forEach(function(x){resMap[String(x.idIngreso)+"|"+String(x.dni)+"|"+String(x.servicio).toUpperCase()]=x;});
 var srv=ss.getSheetByName(EST_CFG.SERVICIOS),sr=estadiaRows_(srv),pend=[];
 for(var z=0;z<sr.length;z++){var kk=String(sr[z][4])+"|"+String(sr[z][5]),sv=String(sr[z][9]).toUpperCase();if(wanted[kk]&&estadiaServicioEsComida_(sv)&&String(sr[z][11]).toUpperCase()==="SOLICITADO")pend.push({i:z,k:kk,sv:sv});}
 pend.forEach(function(x){var rr=resMap[x.k+"|"+x.sv];if(!rr)throw new Error("Hay alimentación pendiente sin resolver: "+x.sv+".");var tipo=String(rr.tipo||"").toUpperCase();if(tipo!=="RETIRO"&&tipo!=="REASIGNADO")throw new Error("Selecciona Retiro o Reasignado para "+x.sv+".");if(tipo==="REASIGNADO"&&!String(rr.entregadoA||"").trim())throw new Error("Indica a quién se reasignó "+x.sv+".");});
 var estUpdates=[];for(var i=0;i<rs.length;i++){var k=String(rs[i][0])+"|"+String(rs[i][1]);if(wanted[k]&&String(rs[i][10]).toUpperCase()==="PRESENTE"){if(rs[i][9])rooms[String(rs[i][9])]=true;estUpdates.push(i+2);changed++;}}
 if(!changed)throw new Error("No se encontraron personas presentes para registrar salida.");
 estUpdates.forEach(function(row){sh.getRange(row,9,1,5).setValues([[d,sh.getRange(row,10).getValue(),"SALIO",p.responsable||"",d]]);});
 pend.forEach(function(x){var rr=resMap[x.k+"|"+x.sv]||{},tipo=String(rr.tipo||"").toUpperCase(),row=x.i+2;if(tipo==="REASIGNADO")srv.getRange(row,12,1,5).setValues([["REASIGNADO",p.responsable||sr[x.i][12]||"",rr.entregadoA||"",rr.dniDestino||"",rr.observacion||""]]);else srv.getRange(row,12,1,5).setValues([["NO ENTREGADO - RETIRO",p.responsable||sr[x.i][12]||"","","",rr.observacion||""]]);});
 var h=ss.getSheetByName(EST_CFG.HABITACIONES),hr=estadiaRows_(h);for(var j=0;j<hr.length;j++)if(rooms[String(hr[j][0])])h.getRange(j+2,2,1,9).setValues([["POR LIMPIAR","","","","","","",p.responsable||"",d]]);
 return {ok:true,cantidad:changed};
}
function estadiaListarHabitaciones_(){estadiaInit_();var sh=estadiaSS_().getSheetByName(EST_CFG.HABITACIONES);return estadiaRows_(sh).map(function(r){return {numero:String(r[0]||""),estado:String(r[1]||""),dni:String(r[2]||""),huesped:String(r[3]||""),placa:String(r[4]||""),proveedor:String(r[5]||""),fechaIngreso:estadiaIso_(r[6]),salidaPrevista:estadiaIso_(r[7]),responsable:String(r[8]||""),observacion:String(r[10]||"")};});}
function estadiaAsignarHabitacion_(p){
 p=p||{};estadiaInit_();var ss=estadiaSS_(),h=ss.getSheetByName(EST_CFG.HABITACIONES),hrs=estadiaRows_(h),hr=-1;for(var i=0;i<hrs.length;i++)if(String(hrs[i][0])===String(p.habitacion)&&String(hrs[i][1]).toUpperCase()==="DISPONIBLE"){hr=i;break;}if(hr<0)throw new Error("La habitación ya no está disponible.");
 var e=ss.getSheetByName(EST_CFG.ESTADIAS),ers=estadiaRows_(e),er=-1;for(var j=0;j<ers.length;j++)if(String(ers[j][0])===String(p.idIngreso)&&String(ers[j][1])===String(p.dni)){er=j;break;}if(er<0)throw new Error("No se encontró la estadía.");
 var d=new Date();hrs[hr]=[String(p.habitacion),"OCUPADA",p.dni||"",p.nombre||"",p.placa||"",p.proveedor||"",d,p.salidaPrevista||"",p.responsable||"",d];h.getRange(hr+2,1,1,10).setValues([hrs[hr]]);ers[er][9]=String(p.habitacion);ers[er][11]=p.responsable||"";ers[er][12]=d;e.getRange(er+2,1,1,Math.max(13,e.getLastColumn())).setValues([ers[er]]);
 estadiaRegistrarServiciosLote_({personas:[p],servicios:[{servicio:"PAPEL HIGIÉNICO",cantidad:1},{servicio:"SHAMPOO",cantidad:1},{servicio:"JABÓN",cantidad:1}],responsable:p.responsable,guardia:p.guardia});return {ok:true};
}
function estadiaRoomRow_(numero){var h=estadiaSS_().getSheetByName(EST_CFG.HABITACIONES),rs=estadiaRows_(h);for(var i=0;i<rs.length;i++)if(String(rs[i][0])===String(numero))return {sh:h,rows:rs,i:i};throw new Error("Habitación no encontrada.");}
function estadiaReservarHabitacion_(p){var x=estadiaRoomRow_(p.habitacion);if(String(x.rows[x.i][1]).toUpperCase()!=="DISPONIBLE")throw new Error("La habitación no está disponible.");x.rows[x.i][1]="RESERVADA";x.rows[x.i][3]=p.nombre||"";x.rows[x.i][7]=p.salidaPrevista||"";x.rows[x.i][8]=p.responsable||"";x.rows[x.i][9]=new Date();x.sh.getRange(x.i+2,1,1,10).setValues([x.rows[x.i]]);return {ok:true};}
function estadiaCancelarReserva_(p){var x=estadiaRoomRow_(p.habitacion);x.rows[x.i]=[String(p.habitacion),"DISPONIBLE","","","","","","",p.responsable||"",new Date()];x.sh.getRange(x.i+2,1,1,10).setValues([x.rows[x.i]]);return {ok:true};}
function estadiaConfirmarReserva_(p){var x=estadiaRoomRow_(p.habitacion);if(String(x.rows[x.i][1]).toUpperCase()!=="RESERVADA")throw new Error("La habitación no está reservada.");x.rows[x.i][1]="OCUPADA";x.rows[x.i][6]=new Date();x.rows[x.i][8]=p.responsable||"";x.rows[x.i][9]=new Date();x.sh.getRange(x.i+2,1,1,10).setValues([x.rows[x.i]]);return {ok:true};}
function estadiaFueraServicioHabitacion_(p){var x=estadiaRoomRow_(p.habitacion);if(!p.motivo)throw new Error("El motivo es obligatorio.");if(String(x.rows[x.i][1]).toUpperCase()!=="DISPONIBLE")throw new Error("Solo una habitación disponible puede ponerse fuera de servicio.");x.rows[x.i]=[String(p.habitacion),"FUERA DE SERVICIO","","","","","","",p.responsable||"",new Date()];x.sh.getRange(x.i+2,1,1,10).setValues([x.rows[x.i]]);return {ok:true};}
function estadiaHabilitarHabitacion_(p){var x=estadiaRoomRow_(p.habitacion);x.rows[x.i]=[String(p.habitacion),"DISPONIBLE","","","","","","",p.responsable||"",new Date()];x.sh.getRange(x.i+2,1,1,10).setValues([x.rows[x.i]]);return {ok:true};}
function estadiaConfirmarLimpieza_(p){return estadiaHabilitarHabitacion_(p);}
function estadiaListarResponsablesAtencion_(){
 var sh=estadiaSS_().getSheetByName("USUARIOS");if(!sh||sh.getLastRow()<2)return [];var vals=sh.getDataRange().getDisplayValues(),head=vals[0].map(function(x){return String(x).trim().toUpperCase();});function c(names){for(var n=0;n<names.length;n++){var i=head.indexOf(names[n]);if(i>=0)return i;}return-1;}var cn=c(["NOMBRE","NOMBRES","USUARIO"]),cr=c(["ROL","PERFIL","CARGO"]),ce=c(["ESTADO","ACTIVO"]);var out={};for(var r=1;r<vals.length;r++){var rol=cr>=0?String(vals[r][cr]).toUpperCase():"";var est=ce>=0?String(vals[r][ce]).toUpperCase():"";if((!rol||rol.indexOf("ATENC")>=0||rol.indexOf("ADMIN")>=0)&&(!est||est==="ACTIVO"||est==="SI"||est==="SÍ"||est==="TRUE")){var n=cn>=0?String(vals[r][cn]).trim():"";if(n)out[n]=true;}}return Object.keys(out).sort();
}
function estadiaResumenGuardia_(p){
 p=p||{};estadiaInit_();var desde=String(p.desde||estadiaFechaOperativa_(new Date())),hasta=String(p.hasta||desde),fg=String(p.guardia||"").toUpperCase(),ft=String(p.turno||"").toUpperCase(),fr=String(p.responsableFiltro||"").toUpperCase();
 var ss=estadiaSS_(),ers=estadiaRows_(ss.getSheetByName(EST_CFG.ESTADIAS)),srs=estadiaRows_(ss.getSheetByName(EST_CFG.SERVICIOS)),h=estadiaListarHabitaciones_();
 var out={desde:desde,hasta:hasta,personasRecibidas:0,personasSalieron:0,personasPresentes:0,desayunos:0,almuerzos:0,cenas:0,agua:0,gaseosa:0,galletas:0,papel:0,shampoo:0,jabon:0,alimentacion:{DESAYUNO:{solicitados:0,entregados:0,pendientes:0,retiro:0,reasignados:0,fueraHorario:0},ALMUERZO:{solicitados:0,entregados:0,pendientes:0,retiro:0,reasignados:0,fueraHorario:0},CENA:{solicitados:0,entregados:0,pendientes:0,retiro:0,reasignados:0,fueraHorario:0}},habitaciones:{disponibles:0,ocupadas:0,reservadas:0,porLimpiar:0,fueraServicio:0},presentes:[],personasPeriodo:[],ingresosPorFecha:[],reasignaciones:[]};
 function fechaLima(d){return Utilities.formatDate(d,Session.getScriptTimeZone()||"America/Lima","yyyy-MM-dd");}function fechaVal(d){if(!(d instanceof Date))d=new Date(d);if(isNaN(d.getTime()))return "";return fechaLima(d);}function enPeriodo(d){var f=fechaVal(d);return !!f&&f>=desde&&f<=hasta;}function turnoOk(d){return !ft||estadiaTurno_(d)===ft;}
 var ingresos={},permitidos={};srs.forEach(function(r){var f=String(r[1]||"");if(f<desde||f>hasta)return;if(fg&&String(r[3]||"").toUpperCase()!==fg)return;if(ft&&String(r[2]||"").toUpperCase()!==ft)return;if(fr&&String(r[12]||"").toUpperCase()!==fr)return;permitidos[String(r[4])+"|"+String(r[5])]=true;});
 ers.forEach(function(r){var fi=r[6] instanceof Date?r[6]:new Date(r[6]),fs=r[8]?(r[8] instanceof Date?r[8]:new Date(r[8])):null,k=String(r[0])+"|"+String(r[1]);var toca=enPeriodo(fi)||(fs&&enPeriodo(fs))||(fechaVal(fi)<=hasta&&(!fs||fechaVal(fs)>=desde));if((fg||ft||fr)&&!permitidos[k]&&fr)return;if(enPeriodo(fi)&&turnoOk(fi)){out.personasRecibidas++;var f=fechaLima(fi);ingresos[f]=(ingresos[f]||0)+1;}if(fs&&enPeriodo(fs)&&turnoOk(fs))out.personasSalieron++;if(String(r[10]).toUpperCase()==="PRESENTE")out.personasPresentes++;if(toca){var obj={idIngreso:String(r[0]),dni:String(r[1]),nombre:String(r[2]),placa:String(r[4]),habitacion:String(r[9]||""),salidaPrevista:estadiaIso_(r[7]),fechaIngreso:estadiaIso_(r[6]),fechaSalida:estadiaIso_(r[8]),zona:String(r[13]||""),estado:String(r[10]||"")};out.personasPeriodo.push(obj);if(String(r[10]).toUpperCase()==="PRESENTE")out.presentes.push(obj);}});
 var req={};srs.forEach(function(r){var f=String(r[1]||"");if(f<desde||f>hasta)return;if(fg&&String(r[3]||"").toUpperCase()!==fg)return;if(ft&&String(r[2]||"").toUpperCase()!==ft)return;if(fr&&String(r[12]||"").toUpperCase()!==fr)return;var sv=String(r[9]).toUpperCase(),st=String(r[11]).toUpperCase(),n=Number(r[10])||0,k=String(r[4])+"|"+String(r[5])+"|"+f+"|"+sv;if(estadiaServicioEsComida_(sv)){if(st==="SOLICITADO"||st==="ATENDIDO"||st.indexOf("RETIRO")>=0||st.indexOf("REASIGN")>=0)req[k]=sv;if(st==="ENTREGADO"){out.alimentacion[sv].entregados++;if(String(r[16]||"").toUpperCase()==="FUERA DE HORARIO")out.alimentacion[sv].fueraHorario++;}else if(st.indexOf("RETIRO")>=0)out.alimentacion[sv].retiro++;else if(st.indexOf("REASIGN")>=0){out.alimentacion[sv].reasignados++;out.reasignaciones.push({servicio:sv,original:String(r[6]||""),entregadoA:String(r[13]||""),dniDestino:String(r[14]||""),observacion:String(r[15]||"")});}}else if(sv==="AGUA")out.agua+=n;else if(sv==="GASEOSA")out.gaseosa+=n;else if(sv==="GALLETAS")out.galletas+=n;else if(sv==="PAPEL HIGIÉNICO")out.papel+=n;else if(sv==="SHAMPOO")out.shampoo+=n;else if(sv==="JABÓN")out.jabon+=n;});
 Object.keys(req).forEach(function(k){out.alimentacion[req[k]].solicitados++;});["DESAYUNO","ALMUERZO","CENA"].forEach(function(sv){var z=out.alimentacion[sv];z.pendientes=Math.max(0,z.solicitados-z.entregados-z.retiro-z.reasignados);});out.desayunos=out.alimentacion.DESAYUNO.entregados;out.almuerzos=out.alimentacion.ALMUERZO.entregados;out.cenas=out.alimentacion.CENA.entregados;
 Object.keys(ingresos).sort().forEach(function(f){out.ingresosPorFecha.push({fecha:f,cantidad:ingresos[f]});});h.forEach(function(x){var e=String(x.estado).toUpperCase();if(e==="DISPONIBLE")out.habitaciones.disponibles++;else if(e==="OCUPADA")out.habitaciones.ocupadas++;else if(e==="RESERVADA")out.habitaciones.reservadas++;else if(e==="POR LIMPIAR")out.habitaciones.porLimpiar++;else if(e==="FUERA DE SERVICIO")out.habitaciones.fueraServicio++;});return out;
}
