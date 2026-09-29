/************************************************************
 * AMS - GESTIÓN DE SOLICITUDES
 * BACKEND V010 - RECUPERACION HISTORIAL
 *
 * ORIGEN CHALA:
 * CHALA -> GUIAS -> LABORATORIO -> ATENCION -> CHALA -> FINALIZADO
 *
 * ORIGEN LABORATORIO:
 * LABORATORIO -> (FINALIZAR EN LABORATORIO)
 *              o
 *              -> ATENCION -> CHALA -> FINALIZADO
 *
 * EXCEPCIÓN:
 * ATENCION puede registrar RECEPCIONADO DIRECTO cuando un código
 * proveniente de CHALA llegó físicamente a Atención sin que
 * Laboratorio haya registrado su recepción.
 * Laboratorio regulariza después sin retroceder el estado actual.
 ************************************************************/

const CONFIG = {
  SPREADSHEET_ID: "1_qMqhqU2KLdqtPkqbdwBrqY5LKDhlefpMoNLaIdFvhg",
  HOJA_USUARIOS: "USUARIOS",
  HOJA_SOLICITUDES: "SOLICITUDES",
  HOJA_ITEMS: "ITEMS",
  HOJA_MOVIMIENTOS: "MOVIMIENTOS",
  HOJA_CONDUCTORES: "CONDUCTORES",

  MAX_ITEMS: 20,

  TIPOS_SOLICITUD: [
    "RI","2RI","3RI","4RI","5RI",
    "RM","2RM","3RM","4RM","5RM",
    "RP","2RP",
    "ACP","2ACP","3ACP",
    "FACP","2FACP","3FACP"
  ]
};

function doGet() {
  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .setTitle("AMS - Gestión de Solicitudes")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nombreArchivo) {
  return HtmlService
    .createHtmlOutputFromFile(nombreArchivo)
    .getContent();
}


function obtenerBase_() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/************************************************************
 * ESTRUCTURA
 ************************************************************/

function crearBaseDatos() {
  return actualizarEstructuraBase();
}

function actualizarEstructuraBase() {
  const ss = obtenerBase_();

  asegurarHoja_(ss, CONFIG.HOJA_USUARIOS, [
    "ID_USUARIO","USUARIO","CLAVE","NOMBRE","PERFIL","ACTIVO","FECHA_CREACION"
  ]);

  asegurarHoja_(ss, CONFIG.HOJA_SOLICITUDES, [
    "ID_SOLICITUD","FECHA_CREACION","HORA_CREACION","AREA_ORIGEN","SOLICITANTE",
    "MODALIDAD","PRIORIDAD","OBSERVACION_GENERAL","ESTADO_GENERAL","ETAPA_ACTUAL",
    "USUARIO_CREACION","FECHA_ULTIMO_MOVIMIENTO","HORA_ULTIMO_MOVIMIENTO"
  ]);

  asegurarHoja_(ss, CONFIG.HOJA_ITEMS, [
    "ID_ITEM","ID_SOLICITUD","ITEM","TIPO","CODIGO","MODALIDAD","OBSERVACION","ETAPA_ACTUAL",
    "SUBESTADO_ACTUAL","ESTADO_ITEM","FECHA_ULTIMO_MOVIMIENTO",
    "HORA_ULTIMO_MOVIMIENTO","USUARIO_ULTIMO_MOVIMIENTO",
    "PENDIENTE_REGULARIZACION_LAB"
  ]);

  asegurarHoja_(ss, CONFIG.HOJA_MOVIMIENTOS, [
    "ID_MOVIMIENTO","ID_SOLICITUD","ID_ITEM","TIPO","CODIGO","MODALIDAD",
    "AREA","ACCION","RESPONSABLE",
    "FECHA_EVENTO","HORA_EVENTO","FECHA_HORA_EVENTO",
    "FECHA_REGISTRO","HORA_REGISTRO","FECHA_HORA_REGISTRO",
    "SECUENCIA","ESTADO_RESULTANTE","AREA_ORIGEN","AREA_DESTINO",
    "OBSERVACION","TIPO_MOVIMIENTO",
    "RESPONSABLE_RECEPCION_LAB","RESPONSABLE_ENTREGA_LAB",
    "OPERARIO_SELLADO","MEDIO_ENTREGA","DESTINATARIO",
    "FECHA","HORA","TIPO_PERSONA","NOMBRE_PERSONA","TURNO"
  ]);

  asegurarHoja_(ss, CONFIG.HOJA_CONDUCTORES, ["ID","NOMBRE"]);
  crearUsuariosIniciales_();

  return "Estructura actualizada correctamente. No se eliminaron registros existentes.";
}

function asegurarHoja_(ss, nombreHoja, columnas) {
  let hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) hoja = ss.insertSheet(nombreHoja);

  if (hoja.getLastRow() === 0) {
    hoja.getRange(1,1,1,columnas.length).setValues([columnas]);
    hoja.setFrozenRows(1);
    return hoja;
  }

  const encabezados = hoja
    .getRange(1,1,1,hoja.getLastColumn())
    .getDisplayValues()[0];

  columnas.forEach(function(columna) {
    if (
      columna === "CODIGO" &&
      (encabezados.includes("CODIGO") || encabezados.includes("PPO"))
    ) return;

    if (!encabezados.includes(columna)) {
      hoja.getRange(1, hoja.getLastColumn() + 1).setValue(columna);
      encabezados.push(columna);
    }
  });

  hoja.setFrozenRows(1);
  return hoja;
}

function crearUsuariosIniciales_() {
  const ss = obtenerBase_();
  const hoja = ss.getSheetByName(CONFIG.HOJA_USUARIOS);
  if (!hoja || hoja.getLastRow() > 1) return;

  const ahora = new Date();
  const usuarios = [
    ["U001","chala","1234","Usuario Oficina Chala","CHALA","SI",ahora],
    ["U002","guias","1234","Usuario Oficina Guías","GUIAS","SI",ahora],
    ["U003","a4","1234","Usuario Asistente A4","ASISTENTE A4","SI",ahora],
    ["U004","atencion","1234","Usuario Atención al Cliente","ATENCION","SI",ahora],
    ["U005","admin","1234","Administrador","ADMIN","SI",ahora]
  ];

  hoja.getRange(2,1,usuarios.length,usuarios[0].length).setValues(usuarios);
}

/************************************************************
 * LOGIN / CATÁLOGOS
 ************************************************************/

function iniciarSesion(usuario, clave, responsableSesion) {
  usuario = String(usuario || "").trim();
  clave = String(clave || "").trim();
  responsableSesion = mayuscula_(responsableSesion);

  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(CONFIG.HOJA_USUARIOS);

  if (!hoja) {
    return {ok:false, mensaje:"No existe la hoja USUARIOS."};
  }

  const datos = hoja.getDataRange().getDisplayValues();

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];

    if (
      String(fila[1] || "").trim() === usuario &&
      String(fila[2] || "").trim() === clave &&
      mayuscula_(fila[5]) === "SI"
    ) {
      const responsable = responsableSesion || mayuscula_(fila[3]);

      return {
        ok:true,
        usuario:{
          id:fila[0],
          usuario:fila[1],
          nombreCuenta:fila[3],
          nombre:responsable,
          responsableSesion:responsable,
          perfil:(mayuscula_(fila[4]) === "LABORATORIO" ? "ASISTENTE A4" : mayuscula_(fila[4]))
        }
      };
    }
  }

  return {ok:false, mensaje:"Usuario o contraseña incorrectos."};
}

function obtenerTiposSolicitud() {
  return CONFIG.TIPOS_SOLICITUD;
}

function obtenerConductores() {
  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(CONFIG.HOJA_CONDUCTORES);

  if (!hoja || hoja.getLastRow() < 2) return [];

  return hoja
    .getRange(2,2,hoja.getLastRow()-1,1)
    .getDisplayValues()
    .map(f => mayuscula_(f[0]))
    .filter(Boolean);
}

/************************************************************
 * GUARDAR SOLICITUD
 ************************************************************/

function esTipoEspecialA4_(tipo){ return /^(?:\d+)?(?:ACP|RP|FACP)$/.test(mayuscula_(tipo)); }

function guardarSolicitud(datos) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error("La base está ocupada. Intenta nuevamente.");

  try {
    if (!datos || !datos.usuario) throw new Error("Sesión no válida.");

    const usuario = datos.usuario;
    const perfil = mayuscula_(usuario.perfil);
    if (!["CHALA","ASISTENTE A4"].includes(perfil)) throw new Error("Solo Chala o Asistente A4 pueden crear solicitudes.");

    const responsable = obtenerResponsableSesion_(usuario);
    const items = datos.items || [];
    if (items.length < 1 || items.length > CONFIG.MAX_ITEMS) {
      throw new Error("La solicitud debe tener entre 1 y 20 códigos.");
    }
    if (!datos.prioridad) throw new Error("Falta la prioridad.");

    const claves = {};
    items.forEach(function(item,index){
      const tipo = mayuscula_(item.tipo);
      const codigo = mayuscula_(item.codigo || item.ppo);
      const modalidad = mayuscula_(item.modalidad);
      if (!tipo || !codigo || !modalidad) throw new Error("Complete TIPO, CÓDIGO y MODALIDAD en el ítem " + (index+1) + ".");
      const k = tipo + "||" + codigo;
      if (claves[k]) throw new Error("⚠ Este código ya fue solicitado: " + tipo + " - " + codigo);
      claves[k] = true;
    });

    const ss = obtenerBase_();
    const hojaSolicitudes = ss.getSheetByName(CONFIG.HOJA_SOLICITUDES);
    const hojaItems = ss.getSheetByName(CONFIG.HOJA_ITEMS);
    const existentes = leerObjetos_(hojaItems);
    items.forEach(function(item){
      const tipo=mayuscula_(item.tipo), codigo=mayuscula_(item.codigo || item.ppo);
      if (existentes.some(x => mayuscula_(x.TIPO)===tipo && mayuscula_(x.CODIGO || x.PPO)===codigo)) {
        throw new Error("⚠ Este código ya fue solicitado: " + tipo + " - " + codigo);
      }
    });

    const ahora=new Date(), fecha=fecha_(ahora), hora=hora_(ahora);
    const idSolicitud=generarIdSolicitud_();
    const origen = perfil === "ASISTENTE A4" ? "ASISTENTE A4" : "CHALA";
    const etapaInicial = origen === "CHALA" ? "GUIAS" : "ASISTENTE A4";
    const estadoInicial = origen === "CHALA" ? "SOLICITUD CREADA" : "SOLICITUD CREADA";
    appendObjeto_(hojaSolicitudes,{
      ID_SOLICITUD:idSolicitud, FECHA_CREACION:fecha, HORA_CREACION:hora,
      AREA_ORIGEN:origen, SOLICITANTE:responsable, MODALIDAD:"",
      PRIORIDAD:String(datos.prioridad).trim(), OBSERVACION_GENERAL:datos.observacionGeneral || "",
      ESTADO_GENERAL:"EN PROCESO", ETAPA_ACTUAL:etapaInicial, USUARIO_CREACION:responsable,
      FECHA_ULTIMO_MOVIMIENTO:fecha, HORA_ULTIMO_MOVIMIENTO:hora
    });

    items.forEach(function(item,index){
      const tipo=mayuscula_(item.tipo), codigo=mayuscula_(item.codigo || item.ppo);
      const modalidad=mayuscula_(item.modalidad);
      const idItem=idSolicitud+"-"+String(index+1).padStart(2,"0");
      const especialA4 = origen === "ASISTENTE A4" && esTipoEspecialA4_(tipo);
      const etapaItem = origen === "CHALA" ? "GUIAS" : (especialA4 ? "ASISTENTE A4" : "ATENCION");
      const estadoItemInicial = origen === "CHALA" ? "SOLICITUD CREADA" : (especialA4 ? "SOLICITUD CREADA" : "EN LABORATORIO");
      appendObjetoAlias_(hojaItems,{
        ID_ITEM:idItem,ID_SOLICITUD:idSolicitud,ITEM:index+1,TIPO:tipo,CODIGO:codigo,
        MODALIDAD:modalidad,OBSERVACION:"",ETAPA_ACTUAL:etapaItem,
        SUBESTADO_ACTUAL:estadoItemInicial,ESTADO_ITEM:"EN PROCESO",
        FECHA_ULTIMO_MOVIMIENTO:fecha,HORA_ULTIMO_MOVIMIENTO:hora,
        USUARIO_ULTIMO_MOVIMIENTO:responsable,PENDIENTE_REGULARIZACION_LAB:"NO"
      });
      guardarMovimiento_({
        idSolicitud,idItem,tipo,codigo,modalidad,area:origen,areaOrigen:origen,
        areaDestino:etapaItem,estadoResultante:estadoItemInicial,accion:estadoItemInicial,
        responsable,fechaEvento:fecha,horaEvento:hora,fechaRegistro:fecha,horaRegistro:hora,
        observacion:"",tipoMovimiento:"NORMAL"
      });
    });
    return {ok:true,idSolicitud:idSolicitud,mensaje:"Solicitud registrada correctamente."};
  } finally { lock.releaseLock(); }
}

function obtenerSolicitudes(usuario) {
  if (!usuario) return [];
  const perfil = mayuscula_(usuario.perfil) === "LABORATORIO" ? "ASISTENTE A4" : mayuscula_(usuario.perfil);
  const ss=obtenerBase_();
  const solicitudes=leerObjetos_(ss.getSheetByName(CONFIG.HOJA_SOLICITUDES));
  const items=leerObjetos_(ss.getSheetByName(CONFIG.HOJA_ITEMS));
  const resultado=[];

  solicitudes.forEach(function(s){
    let its=items.filter(i=>String(i.ID_SOLICITUD)===String(s.ID_SOLICITUD));
    if(perfil==="GUIAS") its=its.filter(i=>mayuscula_(i.ETAPA_ACTUAL)==="GUIAS");
    if(perfil==="ASISTENTE A4") its=its.filter(i=>["ASISTENTE A4","LABORATORIO"].includes(mayuscula_(i.ETAPA_ACTUAL)));
    if(perfil==="ATENCION") its=its.filter(i=>mayuscula_(i.ETAPA_ACTUAL)==="ATENCION");
    if(perfil==="CHALA"){
      // Chala conserva sus solicitudes y además recibe el cierre final.
      its=its.filter(i=>mayuscula_(s.AREA_ORIGEN)==="CHALA" || mayuscula_(i.ETAPA_ACTUAL)==="CHALA");
    }
    if(!its.length && perfil!=="ADMIN") return;
    resultado.push({
      idSolicitud:s.ID_SOLICITUD,fecha:s.FECHA_CREACION,hora:s.HORA_CREACION,
      areaOrigen:(mayuscula_(s.AREA_ORIGEN)==="LABORATORIO"?"ASISTENTE A4":s.AREA_ORIGEN),
      solicitante:s.SOLICITANTE,modalidad:s.MODALIDAD,prioridad:s.PRIORIDAD,
      observacion:s.OBSERVACION_GENERAL,estadoGeneral:s.ESTADO_GENERAL,
      etapaActual:s.ETAPA_ACTUAL,usuarioCreacion:s.USUARIO_CREACION,
      fechaUltimo:s.FECHA_ULTIMO_MOVIMIENTO,horaUltimo:s.HORA_ULTIMO_MOVIMIENTO,
      items:its.map(convertirItem_)
    });
  });
  return resultado;
}

function obtenerHistorialGlobal() {

  const ss = obtenerBase_();

  const solicitudes = leerObjetos_(
    ss.getSheetByName(CONFIG.HOJA_SOLICITUDES)
  );

  const items = leerObjetos_(
    ss.getSheetByName(CONFIG.HOJA_ITEMS)
  );

  return solicitudes.map(function(s) {
    const itemsSolicitud = items
      .filter(function(i) {
        return String(i.ID_SOLICITUD) === String(s.ID_SOLICITUD);
      })
      .map(convertirItem_);

    return {
      idSolicitud:s.ID_SOLICITUD,
      fecha:s.FECHA_CREACION,
      hora:s.HORA_CREACION,
      areaOrigen:s.AREA_ORIGEN,
      solicitante:s.SOLICITANTE,
      prioridad:s.PRIORIDAD,
      observacion:s.OBSERVACION_GENERAL,
      estadoGeneral:s.ESTADO_GENERAL,
      etapaActual:s.ETAPA_ACTUAL,
      usuarioCreacion:s.USUARIO_CREACION,
      fechaUltimo:s.FECHA_ULTIMO_MOVIMIENTO,
      horaUltimo:s.HORA_ULTIMO_MOVIMIENTO,
      items:itemsSolicitud
    };
  });
}

function convertirItem_(i) {
  const codigo = i.CODIGO || i.PPO || "";

  return {
    idItem:i.ID_ITEM,
    idSolicitud:i.ID_SOLICITUD,
    item:i.ITEM,
    tipo:i.TIPO,
    codigo:codigo,
    ppo:codigo,
    modalidad:i.MODALIDAD || "",
    observacion:i.OBSERVACION,
    etapaActual:i.ETAPA_ACTUAL,
    subestadoActual:i.SUBESTADO_ACTUAL,
    subestado:i.SUBESTADO_ACTUAL,
    estado:i.ESTADO_ITEM,
    fechaUltimoMovimiento:i.FECHA_ULTIMO_MOVIMIENTO,
    horaUltimoMovimiento:i.HORA_ULTIMO_MOVIMIENTO,
    fechaUltimo:i.FECHA_ULTIMO_MOVIMIENTO,
    horaUltimo:i.HORA_ULTIMO_MOVIMIENTO,
    usuarioUltimoMovimiento:i.USUARIO_ULTIMO_MOVIMIENTO,
    usuarioUltimo:i.USUARIO_ULTIMO_MOVIMIENTO,
    pendienteRegularizacionLab:
      mayuscula_(i.PENDIENTE_REGULARIZACION_LAB) === "SI"
  };
}

/************************************************************
 * BUSCAR / HISTORIAL
 ************************************************************/

function buscarTipoCodigo(tipo, codigo) {
  tipo = mayuscula_(tipo);
  codigo = mayuscula_(codigo);

  if (!tipo || !codigo) {
    return {ok:false, mensaje:"Ingrese Tipo y Código."};
  }

  const ss = obtenerBase_();

  const items = leerObjetos_(
    ss.getSheetByName(CONFIG.HOJA_ITEMS)
  );

  const encontrado = items.find(function(i) {
    return (
      mayuscula_(i.TIPO) === tipo &&
      mayuscula_(i.CODIGO || i.PPO) === codigo
    );
  });

  if (!encontrado) {
    return {
      ok:false,
      mensaje:"No se encontró " + tipo + " - " + codigo + "."
    };
  }

  const item = convertirItem_(encontrado);
  const solicitud = obtenerSolicitudPorId_(item.idSolicitud);
  const movimientos = obtenerMovimientosItem_(item.idItem);

  return {
    ok:true,
    item:item,
    solicitud:solicitud,
    movimientos:movimientos,
    timeline:construirTimeline_(item,movimientos)
  };
}

function buscarCodigo(tipo,codigo) {
  return buscarTipoCodigo(tipo,codigo);
}

function buscarPPO(ppo) {
  const codigo = mayuscula_(ppo);
  const ss = obtenerBase_();

  const items = leerObjetos_(
    ss.getSheetByName(CONFIG.HOJA_ITEMS)
  );

  const encontrado = items.find(
    i => mayuscula_(i.CODIGO || i.PPO) === codigo
  );

  if (!encontrado) {
    return {ok:false,mensaje:"No se encontró el código."};
  }

  return buscarTipoCodigo(encontrado.TIPO,codigo);
}

function obtenerSolicitudPorId_(idSolicitud) {
  const ss = obtenerBase_();

  const s = leerObjetos_(
    ss.getSheetByName(CONFIG.HOJA_SOLICITUDES)
  ).find(
    fila => String(fila.ID_SOLICITUD) === String(idSolicitud)
  );

  if (!s) return null;

  return {
    idSolicitud:s.ID_SOLICITUD,
    fecha:s.FECHA_CREACION,
    hora:s.HORA_CREACION,
    areaOrigen:s.AREA_ORIGEN,
    solicitante:s.SOLICITANTE,
    modalidad:s.MODALIDAD,
    prioridad:s.PRIORIDAD,
    observacion:s.OBSERVACION_GENERAL,
    estadoGeneral:s.ESTADO_GENERAL,
    etapaActual:s.ETAPA_ACTUAL,
    usuarioCreacion:s.USUARIO_CREACION,
    fechaUltimo:s.FECHA_ULTIMO_MOVIMIENTO,
    horaUltimo:s.HORA_ULTIMO_MOVIMIENTO
  };
}

function obtenerMovimientosItem_(idItem) {
  const ss = obtenerBase_();
  const hoja = ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS);
  if (!hoja) return [];

  return leerObjetos_(hoja)
    .filter(m => String(m.ID_ITEM) === String(idItem))
    .map(function(m) {
      const fechaEvento = m.FECHA_EVENTO || m.FECHA || "";
      const horaEvento = m.HORA_EVENTO || m.HORA || "";

      return {
        idMovimiento:m.ID_MOVIMIENTO,
        idSolicitud:m.ID_SOLICITUD,
        idItem:m.ID_ITEM,
        codigo:m.CODIGO || m.PPO || "",
        area:m.AREA,
        accion:m.ACCION,
        responsable:m.RESPONSABLE,
        fecha:fechaEvento,
        hora:horaEvento,
        fechaEvento:fechaEvento,
        horaEvento:horaEvento,
        fechaRegistro:m.FECHA_REGISTRO || m.FECHA || "",
        horaRegistro:m.HORA_REGISTRO || m.HORA || "",
        observacion:m.OBSERVACION,
        tipoMovimiento:m.TIPO_MOVIMIENTO || "NORMAL",
        responsableRecepcionLab:m.RESPONSABLE_RECEPCION_LAB || "",
        responsableEntregaLab:m.RESPONSABLE_ENTREGA_LAB || "",
        operarioSellado:m.OPERARIO_SELLADO || "",
        medioEntrega:m.MEDIO_ENTREGA || m.TIPO_PERSONA || "",
        destinatario:m.DESTINATARIO || m.NOMBRE_PERSONA || "",
        estadoResultante:m.ESTADO_RESULTANTE || "",
        areaDestino:m.AREA_DESTINO || ""
      };
    });
}

/************************************************************
 * REGISTRAR MOVIMIENTO
 ************************************************************/


/* ==========================================================
   AMS V6 - ACCESO RAPIDO A ITEMS / MOVIMIENTOS
   Evita leer toda la base al registrar cada estado.
   ========================================================== */
function buscarFilaPorIdRapido_(hoja, nombreColumna, valor) {
  if (!hoja || hoja.getLastRow() < 2) return null;
  const headers = hoja.getRange(1,1,1,hoja.getLastColumn()).getValues()[0]
    .map(function(x){ return String(x||"").trim().toUpperCase(); });
  const idx = headers.indexOf(String(nombreColumna||"").trim().toUpperCase());
  if (idx < 0) throw new Error("No existe la columna " + nombreColumna + ".");
  const rango = hoja.getRange(2,idx+1,hoja.getLastRow()-1,1);
  const celda = rango.createTextFinder(String(valor))
    .matchEntireCell(true).matchCase(false).findNext();
  if (!celda) return null;
  const fila = celda.getRow();
  const vals = hoja.getRange(fila,1,1,headers.length).getValues()[0];
  const obj = {};
  headers.forEach(function(k,i){ obj[k]=vals[i]; });
  return {fila:fila,obj:obj,headers:headers};
}
function actualizarFilaRapida_(hoja, fila, headers, cambios) {
  const map={};
  headers.forEach(function(h,i){map[String(h||"").trim().toUpperCase()]=i+1;});
  Object.keys(cambios).forEach(function(k){
    const c=map[String(k).toUpperCase()];
    if(c) hoja.getRange(fila,c).setValue(cambios[k]);
  });
}
function contarItemsSolicitudRapido_(hojaItems,idSolicitud) {
  if(hojaItems.getLastRow()<2)return {total:0,finalizados:0};
  const headers=hojaItems.getRange(1,1,1,hojaItems.getLastColumn()).getValues()[0]
    .map(function(x){return String(x||"").trim().toUpperCase();});
  const cSol=headers.indexOf("ID_SOLICITUD")+1, cEstado=headers.indexOf("ESTADO_ITEM")+1;
  if(!cSol||!cEstado)return {total:0,finalizados:0};
  const vals=hojaItems.getRange(2,1,hojaItems.getLastRow()-1,hojaItems.getLastColumn()).getValues();
  let total=0,finalizados=0;
  vals.forEach(function(r){
    if(String(r[cSol-1])===String(idSolicitud)){
      total++;
      if(mayuscula_(r[cEstado-1])==="FINALIZADO")finalizados++;
    }
  });
  return {total:total,finalizados:finalizados};
}

function registrarMovimiento(datos) {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(8000)) throw new Error("Otro usuario está actualizando la base. Intenta nuevamente.");

  try{
    if(!datos || !datos.idItem || !datos.accion || !datos.usuario) throw new Error("Datos incompletos.");

    const usuario=datos.usuario;
    const perfil0=mayuscula_(usuario.perfil);
    const perfil=perfil0==="LABORATORIO" ? "ASISTENTE A4" : perfil0;
    const responsableSesion=obtenerResponsableSesion_(usuario);
    let accion=normalizarAccion_(datos.accion);

    const ss=obtenerBase_();
    const hojaItems=ss.getSheetByName(CONFIG.HOJA_ITEMS);
    const encontrado=buscarFilaPorIdRapido_(hojaItems,"ID_ITEM",datos.idItem);
    if(!encontrado) throw new Error("Ítem no encontrado.");

    const item=encontrado.obj;
    let etapa=mayuscula_(item.ETAPA_ACTUAL);
    if(etapa==="LABORATORIO") etapa="ASISTENTE A4";
    let subestado=mayuscula_(item.SUBESTADO_ACTUAL);
    let estadoItem=mayuscula_(item.ESTADO_ITEM)||"EN PROCESO";

    const ahora=new Date();
    const fechaRegistro=fecha_(ahora), horaRegistro=hora_(ahora);
    let fechaEvento=fechaRegistro,horaEvento=horaRegistro;
    let responsableRecepcionLab=mayuscula_(datos.responsableRecepcionLab);
    let responsableEntregaLab=mayuscula_(datos.responsableEntregaLab);
    let operarioSellado=mayuscula_(datos.operarioSellado);
    let medioEntrega=mayuscula_(datos.medioEntrega||datos.tipoPersona);
    let destinatario=mayuscula_(datos.destinatario||datos.nombrePersona);

    if(perfil==="GUIAS"){
      if(etapa!=="GUIAS") throw new Error("Este código ya fue procesado por otro usuario.");
      if(accion==="COORDINADO"){
        if(subestado!=="SOLICITUD CREADA") throw new Error("Este código ya no está pendiente de coordinación.");
        subestado="COORDINADO";
      }else if(accion==="CONFIRMADO"){
        if(subestado!=="COORDINADO") throw new Error("Este código ya no está pendiente de confirmación.");
        etapa="ASISTENTE A4"; subestado="CONFIRMADO";
      }else throw new Error("Movimiento no permitido para Guías.");
    }
    else if(perfil==="ASISTENTE A4"){
      const solItem=obtenerSolicitudPorId_(item.ID_SOLICITUD);
      const rutaEspecialA4=mayuscula_(solItem&&solItem.areaOrigen)==="ASISTENTE A4" && esTipoEspecialA4_(item.TIPO);
      if(rutaEspecialA4){
        if(etapa!=="ASISTENTE A4" || subestado!=="SOLICITUD CREADA" || accion!=="FINALIZADO")
          throw new Error("Este código ya no está pendiente de recepción y finalización en Asistente A4.");
        if(!datos.fechaEvento || !datos.horaEvento) throw new Error("Ingrese la fecha y hora real del evento.");
        responsableRecepcionLab=responsableRecepcionLab||responsableSesion;
        if(!responsableEntregaLab) throw new Error("Ingrese quién devolvió la muestra desde Laboratorio.");
        fechaEvento=normalizarFechaEvento_(datos.fechaEvento);
        horaEvento=normalizarHoraEvento_(datos.horaEvento);
        etapa="FINALIZADO";
        subestado="FINALIZADO";
        estadoItem="FINALIZADO";
        accion="RECEPCIONADO Y FINALIZADO";
      }else{
        if(etapa!=="ASISTENTE A4" || !["CONFIRMADO","PENDIENTE DE RECEPCION"].includes(subestado) || !["EN LABORATORIO","RECEPCIONADO","PASAR A ATENCION"].includes(accion)) throw new Error("Este código ya no corresponde a Asistente A4.");
        if(!datos.fechaEvento || !datos.horaEvento) throw new Error("Ingrese la fecha y hora real del evento.");
        responsableRecepcionLab=responsableRecepcionLab||responsableSesion;
        if(!responsableEntregaLab) throw new Error("Ingrese quién devolvió la muestra desde Laboratorio.");
        fechaEvento=normalizarFechaEvento_(datos.fechaEvento); horaEvento=normalizarHoraEvento_(datos.horaEvento);
        etapa="ATENCION"; subestado="EN LABORATORIO"; accion="EN LABORATORIO";
      }
    }
    else if(perfil==="ATENCION"){
      if(accion==="RECEPCIONADO"){
        if(etapa!=="ATENCION" || subestado!=="EN LABORATORIO")
          throw new Error("Este código ya no está pendiente de recepción en Atención al Cliente.");
        if(!operarioSellado) throw new Error("Ingrese el nombre del operario de sellado.");
        subestado="RECEPCIONADO";
      }else if(accion==="ENVIADO"){
        if(etapa!=="ATENCION" || subestado!=="RECEPCIONADO")
          throw new Error("Este código ya no está pendiente de envío.");
        if(!["CONDUCTOR","PROVEEDOR"].includes(medioEntrega)) throw new Error("Seleccione Conductor o Proveedor.");
        if(!destinatario) throw new Error(medioEntrega==="CONDUCTOR"?"Seleccione el conductor.":"Ingrese el nombre del proveedor.");
        if(medioEntrega==="PROVEEDOR"){
          etapa="FINALIZADO"; subestado="FINALIZADO"; estadoItem="FINALIZADO";
        }else{
          etapa="CHALA"; subestado="ENVIADO";
        }
      }else throw new Error("Movimiento no permitido para Atención al Cliente.");
    }
    else if(perfil==="CHALA"){
      if(accion!=="RECIBIDO" || etapa!=="CHALA" || subestado!=="ENVIADO")
        throw new Error("Este código ya no está pendiente de recepción en Chala.");
      etapa="FINALIZADO"; subestado="RECIBIDO"; estadoItem="FINALIZADO";
    }else throw new Error("Este perfil no puede registrar movimientos.");

    actualizarFilaRapida_(hojaItems,encontrado.fila,encontrado.headers,{
      ETAPA_ACTUAL:etapa,SUBESTADO_ACTUAL:subestado,ESTADO_ITEM:estadoItem,
      FECHA_ULTIMO_MOVIMIENTO:fechaRegistro,HORA_ULTIMO_MOVIMIENTO:horaRegistro,
      USUARIO_ULTIMO_MOVIMIENTO:responsableSesion,PENDIENTE_REGULARIZACION_LAB:"NO"
    });

    guardarMovimiento_({
      idSolicitud:item.ID_SOLICITUD,idItem:item.ID_ITEM,tipo:mayuscula_(item.TIPO),
      codigo:item.CODIGO||item.PPO||"",modalidad:mayuscula_(item.MODALIDAD),
      area:perfil,areaOrigen:perfil,areaDestino:etapa,estadoResultante:subestado,accion:accion,
      responsable:responsableSesion,fechaEvento:fechaEvento,horaEvento:horaEvento,
      fechaRegistro:fechaRegistro,horaRegistro:horaRegistro,observacion:datos.observacion||"",
      tipoMovimiento:"NORMAL",responsableRecepcionLab:responsableRecepcionLab,
      responsableEntregaLab:responsableEntregaLab,operarioSellado:operarioSellado,
      medioEntrega:medioEntrega,destinatario:destinatario
    });

    // Solo al finalizar se recalcula el estado general de la solicitud.
    if(estadoItem==="FINALIZADO") actualizarEstadoSolicitud_(item.ID_SOLICITUD);

    return {
      ok:true,mensaje:"Movimiento registrado correctamente.",idItem:item.ID_ITEM,
      accion:accion,etapa:etapa,subestado:subestado,estadoItem:estadoItem,
      fecha:fechaRegistro,hora:horaRegistro,usuario:responsableSesion
    };
  } finally { lock.releaseLock(); }
}

function guardarMovimiento_(datos) {
  const hoja = obtenerBase_()
    .getSheetByName(CONFIG.HOJA_MOVIMIENTOS);

  const fechaHoraEvento = combinarFechaHora_(
    datos.fechaEvento,
    datos.horaEvento
  );

  const fechaHoraRegistro = combinarFechaHora_(
    datos.fechaRegistro,
    datos.horaRegistro
  );

  appendObjetoAlias_(hoja, {
    ID_MOVIMIENTO:generarIdMovimiento_(),
    ID_SOLICITUD:datos.idSolicitud,
    ID_ITEM:datos.idItem,
    TIPO:mayuscula_(datos.tipo),
    CODIGO:datos.codigo,
    MODALIDAD:mayuscula_(datos.modalidad),

    AREA:mayuscula_(datos.area),
    ACCION:mayuscula_(datos.accion),
    RESPONSABLE:mayuscula_(datos.responsable),

    FECHA_EVENTO:datos.fechaEvento,
    HORA_EVENTO:datos.horaEvento,
    FECHA_HORA_EVENTO:fechaHoraEvento,

    FECHA_REGISTRO:datos.fechaRegistro,
    HORA_REGISTRO:datos.horaRegistro,
    FECHA_HORA_REGISTRO:fechaHoraRegistro,

    SECUENCIA:obtenerSecuenciaMovimiento_(datos.idItem),
    ESTADO_RESULTANTE:mayuscula_(datos.estadoResultante),
    AREA_ORIGEN:mayuscula_(datos.areaOrigen),
    AREA_DESTINO:mayuscula_(datos.areaDestino),

    OBSERVACION:datos.observacion || "",
    TIPO_MOVIMIENTO:datos.tipoMovimiento || "NORMAL",

    RESPONSABLE_RECEPCION_LAB:mayuscula_(datos.responsableRecepcionLab),
    RESPONSABLE_ENTREGA_LAB:mayuscula_(datos.responsableEntregaLab),
    OPERARIO_SELLADO:mayuscula_(datos.operarioSellado),
    MEDIO_ENTREGA:mayuscula_(datos.medioEntrega),
    DESTINATARIO:mayuscula_(datos.destinatario),

    // Compatibilidad con registros/lecturas anteriores.
    FECHA:datos.fechaEvento,
    HORA:datos.horaEvento,
    TIPO_PERSONA:datos.medioEntrega || "",
    NOMBRE_PERSONA:mayuscula_(datos.destinatario),
    TURNO:obtenerTurno_(datos.horaEvento || datos.horaRegistro)
  });

  // Formato real de fecha/hora para facilitar cálculos en Sheets/Looker/Power BI.
  const ultimaFila = hoja.getLastRow();
  const encabezados = hoja.getRange(1,1,1,hoja.getLastColumn()).getDisplayValues()[0];

  ["FECHA_HORA_EVENTO","FECHA_HORA_REGISTRO"].forEach(function(campo) {
    const col = encabezados.indexOf(campo) + 1;
    if (col > 0 && ultimaFila > 1) {
      hoja.getRange(ultimaFila,col).setNumberFormat("dd/MM/yyyy HH:mm:ss");
    }
  });
}

function obtenerSecuenciaMovimiento_(idItem) {
  const hoja = obtenerBase_().getSheetByName(CONFIG.HOJA_MOVIMIENTOS);
  if (!hoja || hoja.getLastRow() < 2) return 1;

  const encabezados = hoja.getRange(1,1,1,hoja.getLastColumn()).getDisplayValues()[0];
  const colIdItem = encabezados.indexOf("ID_ITEM") + 1;
  if (colIdItem < 1) return 1;

  const valores = hoja
    .getRange(2,colIdItem,hoja.getLastRow()-1,1)
    .getDisplayValues()
    .flat();

  return valores.filter(function(v) {
    return String(v) === String(idItem);
  }).length + 1;
}

function combinarFechaHora_(fechaTexto, horaTexto) {
  const f = String(fechaTexto || "").trim();
  const h = String(horaTexto || "").trim();

  const mf = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const mh = h.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!mf || !mh) return "";

  return new Date(
    Number(mf[3]),
    Number(mf[2]) - 1,
    Number(mf[1]),
    Number(mh[1]),
    Number(mh[2]),
    Number(mh[3] || 0)
  );
}


/**
 * PREPARA MOVIMIENTOS DESDE CERO Y EN EL ORDEN DEFINITIVO.
 * Úsala solo ahora, mientras los registros actuales son pruebas.
 *
 * Seguridad:
 * 1) Crea una copia de respaldo de la hoja MOVIMIENTOS.
 * 2) Limpia solamente MOVIMIENTOS.
 * 3) Coloca los encabezados en el orden definitivo.
 * No toca SOLICITUDES, ITEMS, USUARIOS ni CONDUCTORES.
 */
function prepararMovimientosDesdeCero() {
  const ss = obtenerBase_();
  const nombre = CONFIG.HOJA_MOVIMIENTOS;
  let hoja = ss.getSheetByName(nombre);

  const columnas = [
    "ID_MOVIMIENTO","ID_SOLICITUD","ID_ITEM",
    "TIPO","CODIGO","MODALIDAD",
    "AREA","ACCION","RESPONSABLE",
    "FECHA_EVENTO","HORA_EVENTO","FECHA_HORA_EVENTO",
    "FECHA_REGISTRO","HORA_REGISTRO","FECHA_HORA_REGISTRO",
    "SECUENCIA","ESTADO_RESULTANTE","AREA_ORIGEN","AREA_DESTINO",
    "OBSERVACION","TIPO_MOVIMIENTO",
    "RESPONSABLE_RECEPCION_LAB","RESPONSABLE_ENTREGA_LAB",
    "OPERARIO_SELLADO","MEDIO_ENTREGA","DESTINATARIO"
  ];

  if (!hoja) {
    hoja = ss.insertSheet(nombre);
  } else if (hoja.getLastRow() > 0 || hoja.getLastColumn() > 0) {
    const tz = Session.getScriptTimeZone() || "America/Lima";
    const sello = Utilities.formatDate(new Date(), tz, "yyyyMMdd_HHmmss");
    let nombreRespaldo = "MOVIMIENTOS_RESPALDO_" + sello;

    // Google Sheets limita el nombre a 100 caracteres.
    if (nombreRespaldo.length > 99) {
      nombreRespaldo = nombreRespaldo.substring(0, 99);
    }

    const respaldo = hoja.copyTo(ss);
    respaldo.setName(nombreRespaldo);
  }

  hoja.clear();

  // Asegura suficientes columnas y deja el orden exacto.
  if (hoja.getMaxColumns() < columnas.length) {
    hoja.insertColumnsAfter(
      hoja.getMaxColumns(),
      columnas.length - hoja.getMaxColumns()
    );
  }

  hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
  hoja.setFrozenRows(1);

  // Formato básico.
  hoja.getRange(1, 1, 1, columnas.length).setFontWeight("bold");
  hoja.autoResizeColumns(1, columnas.length);

  return "MOVIMIENTOS quedó lista desde cero. Se creó una hoja de respaldo con los registros de prueba.";
}



/**
 * RECUPERA LOS MOVIMIENTOS DEL ÚLTIMO RESPALDO.
 * No borra movimientos nuevos y no duplica ID_MOVIMIENTO.
 */
function recuperarMovimientosDesdeRespaldo() {
  actualizarEstructuraBase();

  const ss = obtenerBase_();
  const hojaDestino = ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS);
  const hojaItems = ss.getSheetByName(CONFIG.HOJA_ITEMS);

  const respaldos = ss.getSheets()
    .filter(function(sh) {
      return /^MOVIMIENTOS_RESPALDO_/.test(sh.getName());
    })
    .sort(function(a,b) {
      return b.getName().localeCompare(a.getName());
    });

  if (!respaldos.length) {
    throw new Error("No se encontró ninguna hoja MOVIMIENTOS_RESPALDO_.");
  }

  const hojaOrigen = respaldos[0];

  if (hojaOrigen.getLastRow() < 2) {
    return "El último respaldo no contiene movimientos.";
  }

  const encabezadosDestino = hojaDestino
    .getRange(1,1,1,hojaDestino.getLastColumn())
    .getDisplayValues()[0];

  const encabezadosOrigen = hojaOrigen
    .getRange(1,1,1,hojaOrigen.getLastColumn())
    .getDisplayValues()[0];

  const filasOrigen = hojaOrigen
    .getRange(2,1,hojaOrigen.getLastRow()-1,hojaOrigen.getLastColumn())
    .getValues();

  const items = leerObjetos_(hojaItems);
  const mapaItems = {};
  items.forEach(function(i) {
    mapaItems[String(i.ID_ITEM || "")] = i;
  });

  const idsExistentes = {};
  if (hojaDestino.getLastRow() >= 2) {
    const colIdMov = encabezadosDestino.indexOf("ID_MOVIMIENTO") + 1;
    if (colIdMov > 0) {
      hojaDestino
        .getRange(2,colIdMov,hojaDestino.getLastRow()-1,1)
        .getDisplayValues()
        .flat()
        .forEach(function(id) {
          if (id) idsExistentes[String(id)] = true;
        });
    }
  }

  function valorOrigen_(fila, nombres) {
    for (var i = 0; i < nombres.length; i++) {
      var idx = encabezadosOrigen.indexOf(nombres[i]);
      if (idx >= 0 && fila[idx] !== "" && fila[idx] !== null) {
        return fila[idx];
      }
    }
    return "";
  }

  const contadorSecuencia = {};
  const filasNuevas = [];

  filasOrigen.forEach(function(fila) {
    const idMovimiento = String(
      valorOrigen_(fila, ["ID_MOVIMIENTO"]) || ""
    );

    if (!idMovimiento || idsExistentes[idMovimiento]) return;

    const idItem = String(valorOrigen_(fila, ["ID_ITEM"]) || "");
    const item = mapaItems[idItem] || {};

    const fechaEvento = valorOrigen_(fila, ["FECHA_EVENTO","FECHA"]);
    const horaEvento = valorOrigen_(fila, ["HORA_EVENTO","HORA"]);

    const fechaRegistro = valorOrigen_(fila, ["FECHA_REGISTRO","FECHA"]);
    const horaRegistro = valorOrigen_(fila, ["HORA_REGISTRO","HORA"]);

    contadorSecuencia[idItem] = (contadorSecuencia[idItem] || 0) + 1;

    const obj = {
      ID_MOVIMIENTO:idMovimiento,
      ID_SOLICITUD:valorOrigen_(fila, ["ID_SOLICITUD"]),
      ID_ITEM:idItem,
      TIPO:valorOrigen_(fila, ["TIPO"]) || item.TIPO || "",
      CODIGO:valorOrigen_(fila, ["CODIGO","PPO"]) || item.CODIGO || item.PPO || "",
      MODALIDAD:valorOrigen_(fila, ["MODALIDAD"]) || item.MODALIDAD || "",
      AREA:valorOrigen_(fila, ["AREA"]),
      ACCION:valorOrigen_(fila, ["ACCION","MOVIMIENTO"]),
      RESPONSABLE:valorOrigen_(fila, ["RESPONSABLE"]),
      FECHA_EVENTO:fechaEvento,
      HORA_EVENTO:horaEvento,
      FECHA_HORA_EVENTO:
        valorOrigen_(fila, ["FECHA_HORA_EVENTO"]) ||
        combinarFechaHora_(fechaEvento,horaEvento),
      FECHA_REGISTRO:fechaRegistro,
      HORA_REGISTRO:horaRegistro,
      FECHA_HORA_REGISTRO:
        valorOrigen_(fila, ["FECHA_HORA_REGISTRO"]) ||
        combinarFechaHora_(fechaRegistro,horaRegistro),
      SECUENCIA:
        valorOrigen_(fila, ["SECUENCIA"]) ||
        contadorSecuencia[idItem],
      ESTADO_RESULTANTE:valorOrigen_(fila, ["ESTADO_RESULTANTE"]),
      AREA_ORIGEN:
        valorOrigen_(fila, ["AREA_ORIGEN"]) ||
        valorOrigen_(fila, ["AREA"]),
      AREA_DESTINO:valorOrigen_(fila, ["AREA_DESTINO"]),
      OBSERVACION:valorOrigen_(fila, ["OBSERVACION"]),
      TIPO_MOVIMIENTO:
        valorOrigen_(fila, ["TIPO_MOVIMIENTO"]) || "NORMAL",
      RESPONSABLE_RECEPCION_LAB:
        valorOrigen_(fila, ["RESPONSABLE_RECEPCION_LAB"]),
      RESPONSABLE_ENTREGA_LAB:
        valorOrigen_(fila, ["RESPONSABLE_ENTREGA_LAB"]),
      OPERARIO_SELLADO:
        valorOrigen_(fila, ["OPERARIO_SELLADO"]),
      MEDIO_ENTREGA:
        valorOrigen_(fila, ["MEDIO_ENTREGA"]),
      DESTINATARIO:
        valorOrigen_(fila, ["DESTINATARIO","NOMBRE_PERSONA"]),
      FECHA:fechaEvento,
      HORA:horaEvento,
      TIPO_PERSONA:valorOrigen_(fila, ["TIPO_PERSONA"]),
      NOMBRE_PERSONA:
        valorOrigen_(fila, ["NOMBRE_PERSONA","DESTINATARIO"])
    };

    filasNuevas.push(
      encabezadosDestino.map(function(campo) {
        return Object.prototype.hasOwnProperty.call(obj,campo)
          ? obj[campo]
          : "";
      })
    );

    idsExistentes[idMovimiento] = true;
  });

  if (!filasNuevas.length) {
    return "No había movimientos pendientes de recuperar.";
  }

  hojaDestino
    .getRange(
      hojaDestino.getLastRow()+1,
      1,
      filasNuevas.length,
      encabezadosDestino.length
    )
    .setValues(filasNuevas);

  ["FECHA_HORA_EVENTO","FECHA_HORA_REGISTRO"].forEach(function(campo) {
    const col = encabezadosDestino.indexOf(campo) + 1;
    if (col > 0 && hojaDestino.getLastRow() > 1) {
      hojaDestino
        .getRange(2,col,hojaDestino.getLastRow()-1,1)
        .setNumberFormat("dd/MM/yyyy HH:mm:ss");
    }
  });

  return "Recuperación terminada desde " +
    hojaOrigen.getName() +
    ". Movimientos recuperados: " +
    filasNuevas.length;
}


/**
 * Ejecutar UNA VEZ después de pegar esta versión.
 * Completa TIPO, MODALIDAD y las fechas-horas combinadas en movimientos antiguos.
 * No elimina movimientos.
 */
function migrarMovimientosAnaliticos() {
  actualizarEstructuraBase();

  const ss = obtenerBase_();
  const hojaMov = ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS);
  const hojaItems = ss.getSheetByName(CONFIG.HOJA_ITEMS);

  if (!hojaMov || hojaMov.getLastRow() < 2) {
    return "MOVIMIENTOS está vacío. La nueva estructura ya quedó preparada.";
  }

  const items = leerObjetos_(hojaItems);
  const mapaItems = {};
  items.forEach(function(i) {
    mapaItems[String(i.ID_ITEM)] = i;
  });

  const encabezados = hojaMov.getRange(1,1,1,hojaMov.getLastColumn()).getDisplayValues()[0];
  const datos = hojaMov.getRange(2,1,hojaMov.getLastRow()-1,hojaMov.getLastColumn()).getValues();

  function idx(campo) {
    return encabezados.indexOf(campo);
  }

  const cIdItem = idx("ID_ITEM");
  const cTipo = idx("TIPO");
  const cCodigo = idx("CODIGO");
  const cModalidad = idx("MODALIDAD");
  const cFE = idx("FECHA_EVENTO");
  const cHE = idx("HORA_EVENTO");
  const cFHE = idx("FECHA_HORA_EVENTO");
  const cFR = idx("FECHA_REGISTRO");
  const cHR = idx("HORA_REGISTRO");
  const cFHR = idx("FECHA_HORA_REGISTRO");
  const cSec = idx("SECUENCIA");
  const cEstado = idx("ESTADO_RESULTANTE");
  const cArea = idx("AREA");
  const cAreaO = idx("AREA_ORIGEN");
  const cAreaD = idx("AREA_DESTINO");

  const contador = {};

  datos.forEach(function(fila) {
    const idItem = cIdItem >= 0 ? String(fila[cIdItem] || "") : "";
    const item = mapaItems[idItem] || {};

    if (cTipo >= 0 && !fila[cTipo]) fila[cTipo] = item.TIPO || "";
    if (cCodigo >= 0 && !fila[cCodigo]) fila[cCodigo] = item.CODIGO || item.PPO || "";
    if (cModalidad >= 0 && !fila[cModalidad]) fila[cModalidad] = item.MODALIDAD || "";

    if (cFHE >= 0 && !fila[cFHE]) {
      fila[cFHE] = combinarFechaHora_(
        cFE >= 0 ? fila[cFE] : "",
        cHE >= 0 ? fila[cHE] : ""
      );
    }

    if (cFHR >= 0 && !fila[cFHR]) {
      fila[cFHR] = combinarFechaHora_(
        cFR >= 0 ? fila[cFR] : "",
        cHR >= 0 ? fila[cHR] : ""
      );
    }

    contador[idItem] = (contador[idItem] || 0) + 1;
    if (cSec >= 0 && !fila[cSec]) fila[cSec] = contador[idItem];

    if (cAreaO >= 0 && !fila[cAreaO] && cArea >= 0) fila[cAreaO] = fila[cArea] || "";
    if (cAreaD >= 0 && !fila[cAreaD]) fila[cAreaD] = item.ETAPA_ACTUAL || "";
    if (cEstado >= 0 && !fila[cEstado]) fila[cEstado] = "";
  });

  hojaMov.getRange(2,1,datos.length,encabezados.length).setValues(datos);

  [cFHE,cFHR].forEach(function(c) {
    if (c >= 0 && datos.length) {
      hojaMov.getRange(2,c+1,datos.length,1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
    }
  });

  return "Migración terminada. Se conservaron los movimientos existentes.";
}


/************************************************************
 * ESTADO GENERAL
 ************************************************************/

function actualizarEstadoSolicitud_(idSolicitud) {
  const ss = obtenerBase_();
  const hojaItems = ss.getSheetByName(CONFIG.HOJA_ITEMS);
  const hojaSolicitudes = ss.getSheetByName(CONFIG.HOJA_SOLICITUDES);

  const items = leerObjetos_(hojaItems).filter(
    i => String(i.ID_SOLICITUD) === String(idSolicitud)
  );

  if (!items.length) return;

  const todosFinalizados = items.every(
    i => mayuscula_(i.ESTADO_ITEM) === "FINALIZADO"
  );

  let etapaGeneral;

  if (todosFinalizados) {
    etapaGeneral = "FINALIZADO";
  } else {
    const etapas = [];
    items.forEach(function(i) {
      const e = mayuscula_(i.ETAPA_ACTUAL);
      if (e && !etapas.includes(e)) etapas.push(e);
    });

    etapaGeneral = etapas.length === 1 ? etapas[0] : "MIXTO";
  }

  const ahora = new Date();

  actualizarObjetoPorId_(
    hojaSolicitudes,
    "ID_SOLICITUD",
    idSolicitud,
    {
      ESTADO_GENERAL:todosFinalizados ? "FINALIZADO" : "EN PROCESO",
      ETAPA_ACTUAL:etapaGeneral,
      FECHA_ULTIMO_MOVIMIENTO:fecha_(ahora),
      HORA_ULTIMO_MOVIMIENTO:hora_(ahora)
    }
  );
}


function obtenerTurno_(hora) {
  const s=String(hora||"").trim();
  const m=s.match(/(\d{1,2}):(\d{2})/);
  const hh=m?Number(m[1]):new Date().getHours();
  return (hh>=7 && hh<19) ? "DIA" : "NOCHE";
}

function normalizarAreaVisible_(a){
  a=mayuscula_(a);
  if(a==="LABORATORIO") return "ASISTENTE A4";
  if(a==="ATENCION") return "ATENCION AL CLIENTE";
  return a;
}

/************************************************************
 * TIMELINE
 ************************************************************/

function construirTimeline_(item,movimientos) {
  const pasos = movimientos.map(function(m) {
    const detalle = [];

    if (m.responsableRecepcionLab) {
      detalle.push("Recepción A4: " + m.responsableRecepcionLab);
    }

    if (m.responsableEntregaLab) {
      detalle.push("Entrega A4: " + m.responsableEntregaLab);
    }

    if (m.operarioSellado) {
      detalle.push("Operario sellado: " + m.operarioSellado);
    }

    if (m.medioEntrega && m.destinatario) {
      detalle.push(
        (mayuscula_(m.medioEntrega) === "CONDUCTOR" ? "Conductor: " : "Proveedor: ")
        + m.destinatario
      );
    }

    return {
      area:normalizarAreaVisible_(m.area),
      accion:m.accion,
      responsable:m.responsable || "—",
      fecha:m.fechaEvento || "—",
      hora:m.horaEvento || "—",
      fechaRegistro:m.fechaRegistro || "—",
      horaRegistro:m.horaRegistro || "—",
      detalle:detalle.join(" · "),
      tipoMovimiento:m.tipoMovimiento || "NORMAL"
    };
  });

  return pasos;
}

/************************************************************
 * RESUMEN / ADMIN
 ************************************************************/

function obtenerResumen() {
  const ss = obtenerBase_();
  const items = leerObjetos_(ss.getSheetByName(CONFIG.HOJA_ITEMS));

  const r = {
    guias:0,
    a4:0,
    laboratorio:0,
    atencion:0,
    chala:0,
    finalizados:0,
    regularizaciones:0
  };

  items.forEach(function(i) {
    const etapa = mayuscula_(i.ETAPA_ACTUAL);

    if (etapa === "GUIAS") r.guias++;
    if (["ASISTENTE A4","LABORATORIO"].includes(etapa)) { r.a4++; r.laboratorio++; }
    if (etapa === "ATENCION") r.atencion++;
    if (etapa === "CHALA") r.chala++;
    if (etapa === "FINALIZADO") r.finalizados++;

    if (mayuscula_(i.PENDIENTE_REGULARIZACION_LAB) === "SI") {
      r.regularizaciones++;
    }
  });

  return r;
}

function obtenerIndicadoresAdmin() {
  const ss = obtenerBase_();

  const solicitudes = leerObjetos_(
    ss.getSheetByName(CONFIG.HOJA_SOLICITUDES)
  );

  const items = leerObjetos_(
    ss.getSheetByName(CONFIG.HOJA_ITEMS)
  );

  const movimientos = leerObjetos_(
    ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS)
  );

  const hoy = fecha_(new Date());

  let solicitudesHoy = 0;
  let enProceso = 0;
  let urgentes = 0;
  let finalizadasHoy = 0;

  solicitudes.forEach(function(s) {
    if (String(s.FECHA_CREACION) === hoy) solicitudesHoy++;
    if (mayuscula_(s.ESTADO_GENERAL) !== "FINALIZADO") enProceso++;
    if (mayuscula_(s.PRIORIDAD) === "URGENTE") urgentes++;

    if (
      mayuscula_(s.ESTADO_GENERAL) === "FINALIZADO" &&
      String(s.FECHA_ULTIMO_MOVIMIENTO) === hoy
    ) {
      finalizadasHoy++;
    }
  });

  const porArea = {
    guias:0,a4:0,
    laboratorio:0,atencion:0,chala:0,finalizados:0,mixtos:0
  };

  solicitudes.forEach(function(s) {
    const e = mayuscula_(s.ETAPA_ACTUAL);
    if (e === "GUIAS") porArea.guias++;
    if (e === "LABORATORIO") porArea.laboratorio++;
    if (e === "ATENCION") porArea.atencion++;
    if (e === "CHALA") porArea.chala++;
    if (e === "FINALIZADO") porArea.finalizados++;
    if (e === "MIXTO") porArea.mixtos++;
  });

  let recepcionesDirectas = 0;
  let regularizacionesCompletadas = 0;

  movimientos.forEach(function(m) {
    if (mayuscula_(m.TIPO_MOVIMIENTO) === "DIRECTO") recepcionesDirectas++;
    if (mayuscula_(m.TIPO_MOVIMIENTO) === "REGULARIZACION") {
      regularizacionesCompletadas++;
    }
  });

  const pendientesRegularizacion = items.filter(
    i => mayuscula_(i.PENDIENTE_REGULARIZACION_LAB) === "SI"
  ).length;

  return {
    solicitudesHoy,
    enProceso,
    urgentes,
    finalizadasHoy,
    tiempoPromedio:"—",
    porArea,
    recepcionesDirectas,
    pendientesRegularizacion,
    regularizacionesCompletadas
  };
}

/************************************************************
 * HELPERS
 ************************************************************/

function normalizarAccion_(accion) {
  accion = mayuscula_(accion);

  if (accion === "RECEPCIONAR DIRECTO") return "RECEPCIONADO DIRECTO";
  if (accion === "REGULARIZACIÓN LABORATORIO") {
    return "REGULARIZACION LABORATORIO";
  }
  if (accion === "PASAR A ATENCIÓN") return "PASAR A ATENCION";

  return accion;
}

function obtenerResponsableSesion_(usuario) {
  const responsable = mayuscula_(
    usuario.responsableSesion ||
    usuario.nombre ||
    usuario.nombreCuenta
  );

  if (!responsable) {
    throw new Error("No se identificó al responsable de la sesión.");
  }

  return responsable;
}

function normalizarFechaEvento_(valor) {
  if (!valor) return "";

  const texto = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const p = texto.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  return texto;
}

function normalizarHoraEvento_(valor) {
  if (!valor) return "";

  let texto = String(valor).trim();

  if (/^\d{2}:\d{2}$/.test(texto)) {
    texto += ":00";
  }

  return texto;
}

function leerObjetos_(hoja) {
  if (!hoja || hoja.getLastRow() < 2) return [];

  const valores = hoja.getDataRange().getDisplayValues();
  const encabezados = valores[0];
  const resultado = [];

  for (let i = 1; i < valores.length; i++) {
    const fila = valores[i];
    let vacia = true;
    const obj = {};

    encabezados.forEach(function(encabezado,index) {
      const nombre = String(encabezado || "").trim();
      if (!nombre) return;

      obj[nombre] = fila[index];

      if (String(fila[index] || "").trim() !== "") {
        vacia = false;
      }
    });

    if (!vacia) resultado.push(obj);
  }

  return resultado;
}

function appendObjeto_(hoja,objeto) {
  const encabezados = hoja
    .getRange(1,1,1,hoja.getLastColumn())
    .getDisplayValues()[0];

  const fila = encabezados.map(
    columna => objeto[columna] !== undefined ? objeto[columna] : ""
  );

  hoja.appendRow(fila);
}

function appendObjetoAlias_(hoja,objeto) {
  const encabezados = hoja
    .getRange(1,1,1,hoja.getLastColumn())
    .getDisplayValues()[0];

  const fila = encabezados.map(function(columna) {
    if (columna === "PPO" && objeto.CODIGO !== undefined) return objeto.CODIGO;
    if (columna === "CODIGO" && objeto.PPO !== undefined) return objeto.PPO;

    return objeto[columna] !== undefined ? objeto[columna] : "";
  });

  hoja.appendRow(fila);
}

function actualizarObjetoPorId_(hoja,columnaId,id,cambios) {
  const datos = hoja.getDataRange().getDisplayValues();
  if (datos.length < 2) return false;

  const encabezados = datos[0];
  const indiceId = encabezados.indexOf(columnaId);

  if (indiceId === -1) {
    throw new Error("No existe columna " + columnaId);
  }

  let filaHoja = -1;

  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][indiceId]) === String(id)) {
      filaHoja = i + 1;
      break;
    }
  }

  if (filaHoja === -1) return false;

  Object.keys(cambios).forEach(function(columna) {
    let indice = encabezados.indexOf(columna);

    if (indice === -1 && columna === "CODIGO") {
      indice = encabezados.indexOf("PPO");
    }

    if (indice !== -1) {
      hoja.getRange(filaHoja,indice + 1).setValue(cambios[columna]);
    }
  });

  return true;
}

function generarIdSolicitud_() {
  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(CONFIG.HOJA_SOLICITUDES);

  if (hoja.getLastRow() < 2) return "SOL-00001";

  const datos = hoja
    .getRange(2,1,hoja.getLastRow()-1,1)
    .getDisplayValues();

  let maximo = 0;

  datos.forEach(function(fila) {
    const m = String(fila[0] || "").match(/SOL-(\d+)/);
    if (m) maximo = Math.max(maximo,Number(m[1]));
  });

  return "SOL-" + String(maximo + 1).padStart(5,"0");
}

function generarIdMovimiento_() {
  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(CONFIG.HOJA_MOVIMIENTOS);

  if (hoja.getLastRow() < 2) return "MOV-000001";

  const datos = hoja
    .getRange(2,1,hoja.getLastRow()-1,1)
    .getDisplayValues();

  let maximo = 0;

  datos.forEach(function(fila) {
    const m = String(fila[0] || "").match(/MOV-(\d+)/);
    if (m) maximo = Math.max(maximo,Number(m[1]));
  });

  return "MOV-" + String(maximo + 1).padStart(6,"0");
}

function fecha_(fecha) {
  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    "dd/MM/yyyy"
  );
}

function hora_(fecha) {
  return Utilities.formatDate(
    fecha,
    Session.getScriptTimeZone(),
    "HH:mm:ss"
  );
}

function mayuscula_(texto) {
  return String(texto || "").trim().toUpperCase();
}

function validarCodigosExistentes(items){
  items=Array.isArray(items)?items:[];
  if(!items.length)return {ok:true,existentes:[]};
  const h=obtenerBase_().getSheetByName(CONFIG.HOJA_ITEMS);
  if(!h||h.getLastRow()<2)return {ok:true,existentes:[]};
  const hd=h.getRange(1,1,1,h.getLastColumn()).getDisplayValues()[0].map(mayuscula_);
  const ct=hd.indexOf("TIPO"), cc=hd.indexOf("CODIGO")>=0?hd.indexOf("CODIGO"):hd.indexOf("PPO");
  if(ct<0||cc<0)return {ok:true,existentes:[]};
  const q={}; items.forEach(x=>{const t=mayuscula_(x.tipo),c=mayuscula_(x.codigo||x.ppo);if(t&&c)q[t+"||"+c]=1;});
  const out={};
  h.getRange(2,1,h.getLastRow()-1,h.getLastColumn()).getDisplayValues().forEach(r=>{
    const k=mayuscula_(r[ct])+"||"+mayuscula_(r[cc]); if(q[k])out[k]=1;
  });
  return {ok:true,existentes:Object.keys(out)};
}


/* ===== AMS V014 - ESTADOS / INGRESO LAB / MIS SOLICITUDES ===== */
function obtenerSolicitudes(usuario) {
  if (!usuario) return [];
  const perfil = mayuscula_(usuario.perfil) === "LABORATORIO" ? "ASISTENTE A4" : mayuscula_(usuario.perfil);
  const ss=obtenerBase_();
  const solicitudes=leerObjetos_(ss.getSheetByName(CONFIG.HOJA_SOLICITUDES));
  const items=leerObjetos_(ss.getSheetByName(CONFIG.HOJA_ITEMS));
  const movs=leerObjetos_(ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS));
  const ingresoLab={};
  movs.forEach(function(m){
    const area=mayuscula_(m.AREA), acc=mayuscula_(m.ACCION), er=mayuscula_(m.ESTADO_RESULTANTE);
    if((area==="ASISTENTE A4"||area==="LABORATORIO") && (acc==="EN LABORATORIO"||acc==="RECEPCIONADO"||er==="EN LABORATORIO")){
      ingresoLab[String(m.ID_ITEM)]={fecha:m.FECHA_EVENTO||m.FECHA||m.FECHA_REGISTRO||"",hora:m.HORA_EVENTO||m.HORA||m.HORA_REGISTRO||""};
    }
  });
  const resultado=[];
  solicitudes.forEach(function(s){
    let its=items.filter(i=>String(i.ID_SOLICITUD)===String(s.ID_SOLICITUD));
    if(perfil==="GUIAS") its=its.filter(i=>mayuscula_(i.ETAPA_ACTUAL)==="GUIAS");
    if(perfil==="ASISTENTE A4") its=its.filter(i=>["ASISTENTE A4","LABORATORIO"].includes(mayuscula_(i.ETAPA_ACTUAL)) || mayuscula_(s.AREA_ORIGEN)==="ASISTENTE A4");
    if(perfil==="ATENCION") its=its.filter(i=>mayuscula_(i.ETAPA_ACTUAL)==="ATENCION");
    if(perfil==="CHALA") its=its.filter(i=>mayuscula_(s.AREA_ORIGEN)==="CHALA" || mayuscula_(i.ETAPA_ACTUAL)==="CHALA");
    if(!its.length && perfil!=="ADMIN") return;
    const conv=its.map(function(x){const z=convertirItem_(x),g=ingresoLab[String(x.ID_ITEM)]||{};z.fechaIngresoLab=g.fecha||"";z.horaIngresoLab=g.hora||"";return z;});
    resultado.push({idSolicitud:s.ID_SOLICITUD,fecha:s.FECHA_CREACION,hora:s.HORA_CREACION,areaOrigen:(mayuscula_(s.AREA_ORIGEN)==="LABORATORIO"?"ASISTENTE A4":s.AREA_ORIGEN),solicitante:s.SOLICITANTE,modalidad:s.MODALIDAD,prioridad:s.PRIORIDAD,observacion:s.OBSERVACION_GENERAL,estadoGeneral:s.ESTADO_GENERAL,etapaActual:s.ETAPA_ACTUAL,usuarioCreacion:s.USUARIO_CREACION,fechaUltimo:s.FECHA_ULTIMO_MOVIMIENTO,horaUltimo:s.HORA_ULTIMO_MOVIMIENTO,items:conv});
  });
  return resultado;
}


/* ===== AMS V015 - REGISTRO POR BLOQUE ===== */
function registrarMovimientosBloque(lista) {
  if (!Array.isArray(lista) || !lista.length) throw new Error("No hay códigos seleccionados.");
  if (lista.length > 20) throw new Error("Máximo 20 códigos por bloque.");
  const resultados=[];
  for (let i=0;i<lista.length;i++) {
    try { resultados.push({ok:true,resultado:registrarMovimiento(lista[i])}); }
    catch(e) { resultados.push({ok:false,idItem:lista[i].idItem,mensaje:e && e.message ? e.message : String(e)}); }
  }
  const errores=resultados.filter(x=>!x.ok);
  return {ok:errores.length===0,total:lista.length,procesados:lista.length-errores.length,errores:errores};
}


/* ===== AMS V016 - HISTORIAL GLOBAL CON FECHA/HORA DE INGRESO A LABORATORIO ===== */
function obtenerHistorialGlobal() {
  const ss = obtenerBase_();
  const solicitudes = leerObjetos_(ss.getSheetByName(CONFIG.HOJA_SOLICITUDES));
  const items = leerObjetos_(ss.getSheetByName(CONFIG.HOJA_ITEMS));
  const movs = leerObjetos_(ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS));

  // Conserva el PRIMER ingreso real a laboratorio de cada ítem.
  const ingresoLab = {};
  movs.forEach(function(m){
    const id = String(m.ID_ITEM || "");
    if (!id || ingresoLab[id]) return;
    const area = mayuscula_(m.AREA);
    const accion = mayuscula_(m.ACCION);
    const estado = mayuscula_(m.ESTADO_RESULTANTE);
    if ((area === "ASISTENTE A4" || area === "LABORATORIO") &&
        (accion === "EN LABORATORIO" || estado === "EN LABORATORIO")) {
      ingresoLab[id] = {
        fecha: m.FECHA_EVENTO || m.FECHA || m.FECHA_REGISTRO || "",
        hora:  m.HORA_EVENTO  || m.HORA  || m.HORA_REGISTRO  || ""
      };
    }
  });

  return solicitudes.map(function(s){
    const itemsSolicitud = items
      .filter(function(x){ return String(x.ID_SOLICITUD) === String(s.ID_SOLICITUD); })
      .map(function(x){
        const z = convertirItem_(x);
        const g = ingresoLab[String(x.ID_ITEM)] || {};
        z.fechaIngresoLab = g.fecha || "";
        z.horaIngresoLab = g.hora || "";
        return z;
      });

    return {
      idSolicitud:s.ID_SOLICITUD,
      fecha:s.FECHA_CREACION,
      hora:s.HORA_CREACION,
      areaOrigen:(mayuscula_(s.AREA_ORIGEN)==="LABORATORIO"?"ASISTENTE A4":s.AREA_ORIGEN),
      solicitante:s.SOLICITANTE,
      prioridad:s.PRIORIDAD,
      observacion:s.OBSERVACION_GENERAL,
      estadoGeneral:s.ESTADO_GENERAL,
      etapaActual:s.ETAPA_ACTUAL,
      usuarioCreacion:s.USUARIO_CREACION,
      fechaUltimo:s.FECHA_ULTIMO_MOVIMIENTO,
      horaUltimo:s.HORA_ULTIMO_MOVIMIENTO,
      items:itemsSolicitud
    };
  });
}

/* ============================================================================
   AMS V017 - MOVIMIENTOS COMO UNICA BASE OPERATIVA
   - USUARIOS y CONDUCTORES permanecen como catalogos.
   - SOLICITUDES e ITEMS quedan solo como respaldo/migracion; las funciones V017
     ya no los usan para la operacion normal.
   - Ejecutar UNA VEZ: migrarBaseAMovimientosUnicos()
   ============================================================================ */

const MOV_V017_COLUMNAS_EXTRA = [
  "ITEM","SOLICITANTE","PRIORIDAD","OBSERVACION_GENERAL","USUARIO_CREACION"
];

function prepararMovimientosV017_(){
  const ss=obtenerBase_();
  const hoja=ss.getSheetByName(CONFIG.HOJA_MOVIMIENTOS) || ss.insertSheet(CONFIG.HOJA_MOVIMIENTOS);
  const base=[
    "ID_MOVIMIENTO","ID_SOLICITUD","ID_ITEM","TIPO","CODIGO","MODALIDAD",
    "AREA","ACCION","RESPONSABLE",
    "FECHA_EVENTO","HORA_EVENTO","FECHA_HORA_EVENTO",
    "FECHA_REGISTRO","HORA_REGISTRO","FECHA_HORA_REGISTRO",
    "SECUENCIA","ESTADO_RESULTANTE","AREA_ORIGEN","AREA_DESTINO",
    "OBSERVACION","TIPO_MOVIMIENTO",
    "RESPONSABLE_RECEPCION_LAB","RESPONSABLE_ENTREGA_LAB",
    "OPERARIO_SELLADO","MEDIO_ENTREGA","DESTINATARIO",
    "FECHA","HORA","TIPO_PERSONA","NOMBRE_PERSONA","TURNO"
  ].concat(MOV_V017_COLUMNAS_EXTRA);
  asegurarHoja_(ss,CONFIG.HOJA_MOVIMIENTOS,base);
  return hoja;
}

function mapaHeadersV017_(hoja){
  const h=hoja.getRange(1,1,1,hoja.getLastColumn()).getDisplayValues()[0];
  const m={}; h.forEach((x,i)=>m[mayuscula_(x)]=i);
  return {headers:h,map:m};
}

function valorV017_(fila,map,campo){
  const i=map[mayuscula_(campo)];
  return i===undefined ? "" : fila[i];
}

function leerMovimientosV017_(){
  const hoja=prepararMovimientosV017_();
  if(hoja.getLastRow()<2) return [];
  return leerObjetos_(hoja);
}

function numeroSecuenciaV017_(m){
  const n=Number(m.SECUENCIA||0); return isNaN(n)?0:n;
}

function fechaHoraOrdenV017_(m){
  const v=m.FECHA_HORA_REGISTRO || m.FECHA_HORA_EVENTO;
  if(v instanceof Date) return v.getTime();
  const d=combinarFechaHora_(m.FECHA_REGISTRO||m.FECHA_EVENTO||m.FECHA||"",m.HORA_REGISTRO||m.HORA_EVENTO||m.HORA||"");
  return d instanceof Date ? d.getTime() : 0;
}

function ordenarMovsItemV017_(arr){
  return arr.slice().sort(function(a,b){
    const s=numeroSecuenciaV017_(a)-numeroSecuenciaV017_(b);
    return s!==0?s:fechaHoraOrdenV017_(a)-fechaHoraOrdenV017_(b);
  });
}

function indiceMovimientosV017_(){
  const movs=leerMovimientosV017_();
  const porItem={}, porSolicitud={};
  movs.forEach(function(m){
    const ii=String(m.ID_ITEM||""); const is=String(m.ID_SOLICITUD||"");
    if(ii)(porItem[ii]||(porItem[ii]=[])).push(m);
    if(is)(porSolicitud[is]||(porSolicitud[is]=[])).push(m);
  });
  Object.keys(porItem).forEach(k=>porItem[k]=ordenarMovsItemV017_(porItem[k]));
  return {movs,porItem,porSolicitud};
}

function solicitudDesdeMovsV017_(movsSolicitud,porItem){
  if(!movsSolicitud||!movsSolicitud.length) return null;
  const orden=movsSolicitud.slice().sort((a,b)=>fechaHoraOrdenV017_(a)-fechaHoraOrdenV017_(b));
  const first=orden[0], last=orden[orden.length-1];
  const ids=[]; const seen={};
  orden.forEach(m=>{const id=String(m.ID_ITEM||""); if(id&&!seen[id]){seen[id]=1;ids.push(id);}});
  const items=ids.map(id=>itemDesdeMovsV017_(porItem[id]||[])).filter(Boolean);
  const finalizados=items.filter(i=>mayuscula_(i.estado)==="FINALIZADO").length;
  return {
    idSolicitud:first.ID_SOLICITUD,
    fecha:first.FECHA_EVENTO||first.FECHA_REGISTRO||first.FECHA||"",
    hora:first.HORA_EVENTO||first.HORA_REGISTRO||first.HORA||"",
    areaOrigen:normalizarAreaVisible_(first.AREA_ORIGEN||first.AREA||""),
    solicitante:first.SOLICITANTE||first.USUARIO_CREACION||first.RESPONSABLE||"",
    modalidad:first.MODALIDAD||"",
    prioridad:first.PRIORIDAD||"NORMAL",
    observacion:first.OBSERVACION_GENERAL||"",
    estadoGeneral:(items.length&&finalizados===items.length)?"FINALIZADO":"EN PROCESO",
    etapaActual:items.length===1?items[0].etapaActual:"MULTIPLE",
    usuarioCreacion:first.USUARIO_CREACION||first.SOLICITANTE||first.RESPONSABLE||"",
    fechaUltimo:last.FECHA_REGISTRO||last.FECHA_EVENTO||last.FECHA||"",
    horaUltimo:last.HORA_REGISTRO||last.HORA_EVENTO||last.HORA||"",
    items:items
  };
}

function itemDesdeMovsV017_(movs){
  if(!movs||!movs.length) return null;
  const a=ordenarMovsItemV017_(movs), first=a[0], last=a[a.length-1];
  const etapa=normalizarAreaVisible_(last.AREA_DESTINO||last.AREA||"");
  const sub=mayuscula_(last.ESTADO_RESULTANTE||last.ACCION||"");
  const fin=etapa==="FINALIZADO" || sub==="FINALIZADO" || sub==="RECIBIDO" || sub==="RECEPCIONADO Y FINALIZADO";
  let ingreso={};
  for(const m of a){
    const area=mayuscula_(m.AREA), ac=mayuscula_(m.ACCION), er=mayuscula_(m.ESTADO_RESULTANTE);
    if((area==="ASISTENTE A4"||area==="LABORATORIO") && (ac==="EN LABORATORIO"||er==="EN LABORATORIO")){
      ingreso={fecha:m.FECHA_EVENTO||m.FECHA||m.FECHA_REGISTRO||"",hora:m.HORA_EVENTO||m.HORA||m.HORA_REGISTRO||""}; break;
    }
  }
  return {
    idItem:first.ID_ITEM,idSolicitud:first.ID_SOLICITUD,item:first.ITEM||"",
    tipo:first.TIPO,codigo:first.CODIGO||first.PPO||"",ppo:first.CODIGO||first.PPO||"",
    modalidad:first.MODALIDAD||"",observacion:last.OBSERVACION||"",
    etapaActual:etapa,subestadoActual:sub,subestado:sub,estado:fin?"FINALIZADO":"EN PROCESO",
    fechaUltimoMovimiento:last.FECHA_REGISTRO||last.FECHA_EVENTO||last.FECHA||"",
    horaUltimoMovimiento:last.HORA_REGISTRO||last.HORA_EVENTO||last.HORA||"",
    fechaUltimo:last.FECHA_REGISTRO||last.FECHA_EVENTO||last.FECHA||"",
    horaUltimo:last.HORA_REGISTRO||last.HORA_EVENTO||last.HORA||"",
    usuarioUltimoMovimiento:last.RESPONSABLE||"",usuarioUltimo:last.RESPONSABLE||"",
    pendienteRegularizacionLab:false,fechaIngresoLab:ingreso.fecha||"",horaIngresoLab:ingreso.hora||""
  };
}

function guardarMovimientoV017_(datos){
  const hoja=prepararMovimientosV017_();
  const fechaHoraEvento=combinarFechaHora_(datos.fechaEvento,datos.horaEvento);
  const fechaHoraRegistro=combinarFechaHora_(datos.fechaRegistro,datos.horaRegistro);
  appendObjetoAlias_(hoja,{
    ID_MOVIMIENTO:generarIdMovimiento_(),ID_SOLICITUD:datos.idSolicitud,ID_ITEM:datos.idItem,
    TIPO:mayuscula_(datos.tipo),CODIGO:datos.codigo,MODALIDAD:mayuscula_(datos.modalidad),
    AREA:mayuscula_(datos.area),ACCION:mayuscula_(datos.accion),RESPONSABLE:mayuscula_(datos.responsable),
    FECHA_EVENTO:datos.fechaEvento,HORA_EVENTO:datos.horaEvento,FECHA_HORA_EVENTO:fechaHoraEvento,
    FECHA_REGISTRO:datos.fechaRegistro,HORA_REGISTRO:datos.horaRegistro,FECHA_HORA_REGISTRO:fechaHoraRegistro,
    SECUENCIA:datos.secuencia||obtenerSecuenciaMovimientoV017_(hoja,datos.idItem),
    ESTADO_RESULTANTE:mayuscula_(datos.estadoResultante),AREA_ORIGEN:mayuscula_(datos.areaOrigen),AREA_DESTINO:mayuscula_(datos.areaDestino),
    OBSERVACION:datos.observacion||"",TIPO_MOVIMIENTO:datos.tipoMovimiento||"NORMAL",
    RESPONSABLE_RECEPCION_LAB:mayuscula_(datos.responsableRecepcionLab),RESPONSABLE_ENTREGA_LAB:mayuscula_(datos.responsableEntregaLab),
    OPERARIO_SELLADO:mayuscula_(datos.operarioSellado),MEDIO_ENTREGA:mayuscula_(datos.medioEntrega),DESTINATARIO:mayuscula_(datos.destinatario),
    FECHA:datos.fechaEvento,HORA:datos.horaEvento,TIPO_PERSONA:datos.medioEntrega||"",NOMBRE_PERSONA:mayuscula_(datos.destinatario),
    TURNO:obtenerTurno_(datos.horaEvento||datos.horaRegistro),ITEM:datos.item||"",SOLICITANTE:mayuscula_(datos.solicitante),
    PRIORIDAD:datos.prioridad||"NORMAL",OBSERVACION_GENERAL:datos.observacionGeneral||"",USUARIO_CREACION:mayuscula_(datos.usuarioCreacion||datos.solicitante)
  });
  const row=hoja.getLastRow(), hm=mapaHeadersV017_(hoja).map;
  ["FECHA_HORA_EVENTO","FECHA_HORA_REGISTRO"].forEach(c=>{if(hm[c]!==undefined)hoja.getRange(row,hm[c]+1).setNumberFormat("dd/MM/yyyy HH:mm:ss");});
}

function obtenerSecuenciaMovimientoV017_(hoja,idItem){
  if(!hoja||hoja.getLastRow()<2)return 1;
  const hm=mapaHeadersV017_(hoja).map, c=hm.ID_ITEM;
  if(c===undefined)return 1;
  const vals=hoja.getRange(2,c+1,hoja.getLastRow()-1,1).getDisplayValues().flat();
  let n=0; vals.forEach(v=>{if(String(v)===String(idItem))n++;}); return n+1;
}

function validarCodigosExistentes(items){
  items=Array.isArray(items)?items:[]; if(!items.length)return {ok:true,existentes:[]};
  const q={}; items.forEach(x=>{const t=mayuscula_(x.tipo),c=mayuscula_(x.codigo||x.ppo);if(t&&c)q[t+"||"+c]=1;});
  const out={}; leerMovimientosV017_().forEach(m=>{const k=mayuscula_(m.TIPO)+"||"+mayuscula_(m.CODIGO||m.PPO);if(q[k])out[k]=1;});
  return {ok:true,existentes:Object.keys(out)};
}

function guardarSolicitud(datos){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))throw new Error("La base está ocupada. Intenta nuevamente.");
  try{
    if(!datos||!datos.usuario)throw new Error("Sesión no válida.");
    const perfil=mayuscula_(datos.usuario.perfil)==="LABORATORIO"?"ASISTENTE A4":mayuscula_(datos.usuario.perfil);
    if(!["CHALA","ASISTENTE A4"].includes(perfil))throw new Error("Solo Chala o Asistente A4 pueden crear solicitudes.");
    const responsable=obtenerResponsableSesion_(datos.usuario), items=datos.items||[];
    if(items.length<1||items.length>CONFIG.MAX_ITEMS)throw new Error("La solicitud debe tener entre 1 y 20 códigos.");
    if(!datos.prioridad)throw new Error("Falta la prioridad.");
    const claves={}; items.forEach(function(x,i){
      const t=mayuscula_(x.tipo),c=mayuscula_(x.codigo||x.ppo),mo=mayuscula_(x.modalidad),k=t+"||"+c;
      if(!t||!c||!mo)throw new Error("Complete TIPO, CÓDIGO y MODALIDAD en el ítem "+(i+1)+".");
      if(claves[k])throw new Error("⚠ Este código ya fue solicitado: "+t+" - "+c); claves[k]=1;
    });
    const dup=validarCodigosExistentes(items).existentes; if(dup.length)throw new Error("⚠ Este código ya fue solicitado: "+dup[0].replace("||"," - "));
    const ahora=new Date(),fecha=fecha_(ahora),hora=hora_(ahora),idSolicitud=generarIdSolicitudV017_(),origen=perfil;
    items.forEach(function(x,index){
      const tipo=mayuscula_(x.tipo),codigo=mayuscula_(x.codigo||x.ppo),modalidad=mayuscula_(x.modalidad),idItem=idSolicitud+"-"+String(index+1).padStart(2,"0");
      const especial=origen==="ASISTENTE A4"&&esTipoEspecialA4_(tipo);
      const destino=origen==="CHALA"?"GUIAS":(especial?"ASISTENTE A4":"ATENCION");
      const estado=origen==="CHALA"?"SOLICITUD CREADA":(especial?"SOLICITUD CREADA":"EN LABORATORIO");
      guardarMovimientoV017_({idSolicitud,idItem,item:index+1,tipo,codigo,modalidad,area:origen,accion:estado,responsable,
        fechaEvento:fecha,horaEvento:hora,fechaRegistro:fecha,horaRegistro:hora,secuencia:1,estadoResultante:estado,
        areaOrigen:origen,areaDestino:destino,observacion:"",tipoMovimiento:"NORMAL",solicitante:responsable,
        prioridad:String(datos.prioridad).trim(),observacionGeneral:datos.observacionGeneral||"",usuarioCreacion:responsable});
    });
    return {ok:true,idSolicitud,mensaje:"Solicitud registrada correctamente."};
  }finally{lock.releaseLock();}
}

function generarIdSolicitudV017_(){
  const hoy=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||"America/Lima","yyyyMMdd");
  const pref="SOL-"+hoy+"-", movs=leerMovimientosV017_(); let max=0;
  movs.forEach(m=>{const id=String(m.ID_SOLICITUD||""); if(id.indexOf(pref)===0){const n=parseInt(id.slice(pref.length),10);if(!isNaN(n)&&n>max)max=n;}});
  return pref+String(max+1).padStart(4,"0");
}

function obtenerSolicitudes(usuario){
  if(!usuario)return [];
  const perfil=mayuscula_(usuario.perfil)==="LABORATORIO"?"ASISTENTE A4":mayuscula_(usuario.perfil), idx=indiceMovimientosV017_();
  const sols=[]; Object.keys(idx.porSolicitud).forEach(id=>{const s=solicitudDesdeMovsV017_(idx.porSolicitud[id],idx.porItem);if(s)sols.push(s);});
  sols.sort((a,b)=>String(b.idSolicitud).localeCompare(String(a.idSolicitud)));
  return sols.map(function(s){
    let its=s.items.slice();
    if(perfil==="GUIAS")its=its.filter(i=>mayuscula_(i.etapaActual)==="GUIAS");
    if(perfil==="ASISTENTE A4")its=its.filter(i=>["ASISTENTE A4","LABORATORIO"].includes(mayuscula_(i.etapaActual))||mayuscula_(s.areaOrigen)==="ASISTENTE A4");
    if(perfil==="ATENCION")its=its.filter(i=>mayuscula_(i.etapaActual)==="ATENCION");
    if(perfil==="CHALA")its=its.filter(i=>mayuscula_(s.areaOrigen)==="CHALA"||mayuscula_(i.etapaActual)==="CHALA");
    if(!its.length&&perfil!=="ADMIN")return null; return Object.assign({},s,{items:its});
  }).filter(Boolean);
}

function obtenerHistorialGlobal(){
  const idx=indiceMovimientosV017_(), out=[];
  Object.keys(idx.porSolicitud).forEach(id=>{const s=solicitudDesdeMovsV017_(idx.porSolicitud[id],idx.porItem);if(s)out.push(s);});
  return out.sort((a,b)=>String(b.idSolicitud).localeCompare(String(a.idSolicitud)));
}

function obtenerSolicitudPorId_(idSolicitud){
  const idx=indiceMovimientosV017_(); return solicitudDesdeMovsV017_(idx.porSolicitud[String(idSolicitud)]||[],idx.porItem);
}

function obtenerMovimientosItem_(idItem){
  const idx=indiceMovimientosV017_();
  return (idx.porItem[String(idItem)]||[]).map(function(m){return {
    idMovimiento:m.ID_MOVIMIENTO,idSolicitud:m.ID_SOLICITUD,idItem:m.ID_ITEM,codigo:m.CODIGO||m.PPO||"",area:m.AREA,accion:m.ACCION,responsable:m.RESPONSABLE,
    fecha:m.FECHA_EVENTO||m.FECHA||"",hora:m.HORA_EVENTO||m.HORA||"",fechaEvento:m.FECHA_EVENTO||m.FECHA||"",horaEvento:m.HORA_EVENTO||m.HORA||"",
    fechaRegistro:m.FECHA_REGISTRO||m.FECHA||"",horaRegistro:m.HORA_REGISTRO||m.HORA||"",observacion:m.OBSERVACION,tipoMovimiento:m.TIPO_MOVIMIENTO||"NORMAL",
    responsableRecepcionLab:m.RESPONSABLE_RECEPCION_LAB||"",responsableEntregaLab:m.RESPONSABLE_ENTREGA_LAB||"",operarioSellado:m.OPERARIO_SELLADO||"",
    medioEntrega:m.MEDIO_ENTREGA||m.TIPO_PERSONA||"",destinatario:m.DESTINATARIO||m.NOMBRE_PERSONA||"",estadoResultante:m.ESTADO_RESULTANTE||"",areaDestino:m.AREA_DESTINO||""
  };});
}

function buscarTipoCodigo(tipo,codigo){
  tipo=mayuscula_(tipo);codigo=mayuscula_(codigo);if(!tipo||!codigo)return {ok:false,mensaje:"Ingrese Tipo y Código."};
  const idx=indiceMovimientosV017_(); let id="";
  for(const k of Object.keys(idx.porItem)){const a=idx.porItem[k],f=a[0]||{};if(mayuscula_(f.TIPO)===tipo&&mayuscula_(f.CODIGO||f.PPO)===codigo){id=k;break;}}
  if(!id)return {ok:false,mensaje:"No se encontró "+tipo+" - "+codigo+"."};
  const item=itemDesdeMovsV017_(idx.porItem[id]),sol=solicitudDesdeMovsV017_(idx.porSolicitud[String(item.idSolicitud)]||[],idx.porItem),movs=obtenerMovimientosItem_(id);
  return {ok:true,item:item,solicitud:sol,movimientos:movs,timeline:construirTimeline_(item,movs)};
}

function buscarCodigo(tipo,codigo){return buscarTipoCodigo(tipo,codigo);}
function buscarPPO(ppo){
  const c=mayuscula_(ppo),idx=indiceMovimientosV017_();
  for(const k of Object.keys(idx.porItem)){const f=idx.porItem[k][0]||{};if(mayuscula_(f.CODIGO||f.PPO)===c)return buscarTipoCodigo(f.TIPO,c);}
  return {ok:false,mensaje:"No se encontró el código."};
}

function registrarMovimiento(datos){
  const lock=LockService.getScriptLock(); if(!lock.tryLock(8000))throw new Error("Otro usuario está actualizando la base. Intenta nuevamente.");
  try{
    if(!datos||!datos.idItem||!datos.accion||!datos.usuario)throw new Error("Datos incompletos.");
    const perfil0=mayuscula_(datos.usuario.perfil),perfil=perfil0==="LABORATORIO"?"ASISTENTE A4":perfil0,responsable=obtenerResponsableSesion_(datos.usuario);
    let accion=normalizarAccion_(datos.accion),idx=indiceMovimientosV017_(),arr=idx.porItem[String(datos.idItem)]||[];
    if(!arr.length)throw new Error("Ítem no encontrado.");
    const first=arr[0],last=arr[arr.length-1];
    let etapa=normalizarAreaVisible_(last.AREA_DESTINO||last.AREA||""),subestado=mayuscula_(last.ESTADO_RESULTANTE||last.ACCION||""),estadoItem=(etapa==="FINALIZADO"?"FINALIZADO":"EN PROCESO");
    const origen=normalizarAreaVisible_(first.AREA_ORIGEN||first.AREA||"");
    const ahora=new Date(),fechaRegistro=fecha_(ahora),horaRegistro=hora_(ahora); let fechaEvento=fechaRegistro,horaEvento=horaRegistro;
    let rr=mayuscula_(datos.responsableRecepcionLab),re=mayuscula_(datos.responsableEntregaLab),op=mayuscula_(datos.operarioSellado),medio=mayuscula_(datos.medioEntrega||datos.tipoPersona),dest=mayuscula_(datos.destinatario||datos.nombrePersona);
    if(perfil==="GUIAS"){
      if(etapa!=="GUIAS")throw new Error("Este código ya fue procesado por otro usuario.");
      if(accion==="COORDINADO"){if(subestado!=="SOLICITUD CREADA")throw new Error("Este código ya no está pendiente de coordinación.");subestado="COORDINADO";}
      else if(accion==="CONFIRMADO"){if(subestado!=="COORDINADO")throw new Error("Este código ya no está pendiente de confirmación.");etapa="ASISTENTE A4";subestado="CONFIRMADO";}
      else throw new Error("Movimiento no permitido para Guías.");
    }else if(perfil==="ASISTENTE A4"){
      const especial=origen==="ASISTENTE A4"&&esTipoEspecialA4_(first.TIPO);
      if(especial){
        if(etapa!=="ASISTENTE A4"||subestado!=="SOLICITUD CREADA"||accion!=="FINALIZADO")throw new Error("Este código ya no está pendiente de recepción y finalización en Asistente A4.");
        if(!datos.fechaEvento||!datos.horaEvento)throw new Error("Ingrese la fecha y hora real del evento."); rr=rr||responsable;if(!re)throw new Error("Ingrese quién devolvió la muestra desde Laboratorio.");
        fechaEvento=normalizarFechaEvento_(datos.fechaEvento);horaEvento=normalizarHoraEvento_(datos.horaEvento);etapa="FINALIZADO";subestado="FINALIZADO";estadoItem="FINALIZADO";accion="RECEPCIONADO Y FINALIZADO";
      }else{
        if(etapa!=="ASISTENTE A4"||!["CONFIRMADO","PENDIENTE DE RECEPCION"].includes(subestado)||!["EN LABORATORIO","RECEPCIONADO","PASAR A ATENCION"].includes(accion))throw new Error("Este código ya no corresponde a Asistente A4.");
        if(!datos.fechaEvento||!datos.horaEvento)throw new Error("Ingrese la fecha y hora real del evento.");rr=rr||responsable;if(!re)throw new Error("Ingrese quién devolvió la muestra desde Laboratorio.");
        fechaEvento=normalizarFechaEvento_(datos.fechaEvento);horaEvento=normalizarHoraEvento_(datos.horaEvento);etapa="ATENCION";subestado="EN LABORATORIO";accion="EN LABORATORIO";
      }
    }else if(perfil==="ATENCION"){
      if(accion==="RECEPCIONADO"){if(etapa!=="ATENCION"||subestado!=="EN LABORATORIO")throw new Error("Este código ya no está pendiente de recepción en Atención al Cliente.");if(!op)throw new Error("Ingrese el nombre del operario de sellado.");subestado="RECEPCIONADO";}
      else if(accion==="ENVIADO"){if(etapa!=="ATENCION"||subestado!=="RECEPCIONADO")throw new Error("Este código ya no está pendiente de envío.");if(!["CONDUCTOR","PROVEEDOR"].includes(medio))throw new Error("Seleccione Conductor o Proveedor.");if(!dest)throw new Error(medio==="CONDUCTOR"?"Seleccione el conductor.":"Ingrese el nombre del proveedor.");if(medio==="PROVEEDOR"){etapa="FINALIZADO";subestado="FINALIZADO";estadoItem="FINALIZADO";}else{etapa="CHALA";subestado="ENVIADO";}}
      else throw new Error("Movimiento no permitido para Atención al Cliente.");
    }else if(perfil==="CHALA"){
      if(accion!=="RECIBIDO"||etapa!=="CHALA"||subestado!=="ENVIADO")throw new Error("Este código ya no está pendiente de recepción en Chala.");etapa="FINALIZADO";subestado="RECIBIDO";estadoItem="FINALIZADO";
    }else throw new Error("Este perfil no puede registrar movimientos.");
    guardarMovimientoV017_({idSolicitud:first.ID_SOLICITUD,idItem:first.ID_ITEM,item:first.ITEM,tipo:first.TIPO,codigo:first.CODIGO||first.PPO||"",modalidad:first.MODALIDAD,
      area:perfil,accion,responsable,fechaEvento,horaEvento,fechaRegistro,horaRegistro,estadoResultante:subestado,areaOrigen:origen,areaDestino:etapa,observacion:datos.observacion||"",tipoMovimiento:"NORMAL",
      responsableRecepcionLab:rr,responsableEntregaLab:re,operarioSellado:op,medioEntrega:medio,destinatario:dest,solicitante:first.SOLICITANTE||first.RESPONSABLE,
      prioridad:first.PRIORIDAD||"NORMAL",observacionGeneral:first.OBSERVACION_GENERAL||"",usuarioCreacion:first.USUARIO_CREACION||first.RESPONSABLE});
    return {ok:true,mensaje:"Movimiento registrado correctamente.",idItem:first.ID_ITEM,accion,etapa,subestado,estadoItem,fecha:fechaRegistro,hora:horaRegistro,usuario:responsable};
  }finally{lock.releaseLock();}
}

function migrarBaseAMovimientosUnicos(){
  const lock=LockService.getScriptLock(); if(!lock.tryLock(30000))throw new Error("La base está ocupada. Intenta nuevamente.");
  try{
    const ss=obtenerBase_(),mov=prepararMovimientosV017_(); if(mov.getLastRow()<2)return {ok:true,mensaje:"MOVIMIENTOS no tiene registros para migrar.",actualizados:0};
    const sols=leerObjetos_(ss.getSheetByName(CONFIG.HOJA_SOLICITUDES)),items=leerObjetos_(ss.getSheetByName(CONFIG.HOJA_ITEMS));
    const ms={};sols.forEach(s=>ms[String(s.ID_SOLICITUD)]=s);const mi={};items.forEach(i=>mi[String(i.ID_ITEM)]=i);
    const hm=mapaHeadersV017_(mov),vals=mov.getRange(2,1,mov.getLastRow()-1,mov.getLastColumn()).getValues();
    let n=0;
    vals.forEach(function(r){
      const idS=String(valorV017_(r,hm.map,"ID_SOLICITUD")||""),idI=String(valorV017_(r,hm.map,"ID_ITEM")||""),s=ms[idS]||{},i=mi[idI]||{};
      const set=function(c,v){const x=hm.map[c];if(x!==undefined && (r[x]===""||r[x]===null) && v!==undefined&&v!==null&&String(v)!==""){r[x]=v;n++;}};
      set("ITEM",i.ITEM);set("SOLICITANTE",s.SOLICITANTE);set("PRIORIDAD",s.PRIORIDAD||"NORMAL");set("OBSERVACION_GENERAL",s.OBSERVACION_GENERAL);set("USUARIO_CREACION",s.USUARIO_CREACION||s.SOLICITANTE);
      set("AREA_ORIGEN",s.AREA_ORIGEN);set("MODALIDAD",i.MODALIDAD);set("TIPO",i.TIPO);set("CODIGO",i.CODIGO||i.PPO);
    });
    mov.getRange(2,1,vals.length,vals[0].length).setValues(vals);
    return {ok:true,mensaje:"Migración terminada. MOVIMIENTOS ya contiene los datos necesarios para operar sin SOLICITUDES ni ITEMS.",actualizados:n,filas:vals.length};
  }finally{lock.releaseLock();}
}
