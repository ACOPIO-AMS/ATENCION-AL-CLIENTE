function doPost(e){
 try{
  var b=JSON.parse((e&&e.postData&&e.postData.contents)||"{}");validarApiRirm_(b.apiKey);
  var m=String(b.method||""),a=Array.isArray(b.args)?b.args:[];
  var ok={obtenerTiposSolicitud:1,obtenerConductores:1,obtenerResumen:1,obtenerSolicitudes:1,obtenerHistorialGlobal:1,buscarTipoCodigo:1,validarCodigosExistentes:1,guardarSolicitud:1,registrarMovimiento:1,registrarMovimientosBloque:1,obtenerResumenAdmin:1};
  if(!ok[m])throw new Error("Método RI-RM no permitido: "+m);var fn=this[m];if(typeof fn!=="function")throw new Error("No existe "+m+" en Code.gs.");
  return jsonRirm_({ok:true,data:fn.apply(null,a)});
 }catch(err){return jsonRirm_({ok:false,error:err&&err.message?err.message:String(err)})}
}
function validarApiRirm_(k){var x=PropertiesService.getScriptProperties().getProperty("RIRM_API_KEY");if(!x)throw new Error("Falta RIRM_API_KEY.");if(String(k||"")!==String(x))throw new Error("API key RI-RM no válida.")}
function jsonRirm_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
