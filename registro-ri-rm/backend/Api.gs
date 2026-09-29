/**
 * AMS REGISTRO RI-RM - API V003
 * Agregar este archivo AL MISMO proyecto de Apps Script donde está
 * registro-ri-rm/backend/Code.gs. No reemplaza Code.gs.
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    validarApiRiRm_(body.apiKey);
    var p = body.payload || {};
    var actions = {
      rirmHealth: function(){ return {connected:true, version:"RIRM-V003"}; },
      rirmTipos: function(){ return obtenerTiposSolicitud(); },
      rirmConductores: function(){ return obtenerConductores(); },
      rirmSolicitudes: function(){ return obtenerSolicitudes(p.usuario); },
      rirmHistorial: function(){ return obtenerHistorialGlobal(); },
      rirmBuscar: function(){ return buscarTipoCodigo(p.tipo,p.codigo); },
      rirmGuardarSolicitud: function(){ return guardarSolicitud(p); },
      rirmMovimiento: function(){ return registrarMovimiento(p); }
    };
    if (!actions[body.action]) throw new Error("Acción RI-RM no permitida.");
    return jsonRiRm_({ok:true,data:actions[body.action]()});
  } catch(err) {
    return jsonRiRm_({ok:false,error:(err && err.message) ? err.message : String(err)});
  }
}
function validarApiRiRm_(key) {
  var expected=PropertiesService.getScriptProperties().getProperty("RIRM_API_KEY");
  if(!expected) throw new Error("Falta configurar RIRM_API_KEY en Propiedades del script.");
  if(String(key||"")!==String(expected)) throw new Error("API key RI-RM no válida.");
}
function jsonRiRm_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
/** Ejecutar UNA VEZ para generar la clave. Luego copiarla a Cloudflare como RIRM_APPS_SCRIPT_API_KEY. */
function generarApiKeyRiRm() {
  var key=Utilities.getUuid().replace(/-/g,"")+Utilities.getUuid().replace(/-/g,"");
  PropertiesService.getScriptProperties().setProperty("RIRM_API_KEY",key);
  Logger.log(key);
  return key;
}
