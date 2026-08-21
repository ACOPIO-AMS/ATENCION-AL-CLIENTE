# Activación de la base

1. Abre la hoja con `MATRIZ` y `BD CLIENTES`.
2. Ve a **Extensiones → Apps Script** y pega `Code.gs`.
3. Si es una instalación nueva, ejecuta `configurarBase()` una sola vez y autoriza el acceso. Si la app ya está conectada, no vuelvas a ejecutarla porque generaría una clave nueva.
4. Copia `APP_API_KEY` desde **Configuración del proyecto → Propiedades del script**.
5. Implementa como **Aplicación web**, ejecutando como propietario.
6. Copia la URL `/exec` y configura en Cloudflare `GOOGLE_APPS_SCRIPT_URL` y `GOOGLE_APPS_SCRIPT_API_KEY`.

La fila 2 de `MATRIZ` debe incluir estos encabezados: `ID`, `FECHA Y HORA DE INGRESO`, `DNI`, `NOMBRES Y APELLIDOS`, `CELULAR`, `OCUPACION`, `MOTIVO DE INGRESO`, `PLACA`, `ZONA`, `LICENCIA DE CONDUCIR`, `CATEGORIA`, `NUMERO LOTES`, `DETALLE DE CARGA`, `CODIGO`, `GUARDIA`, `TURNO` y `RESPONSABLE`. Para lotes también se aceptan `N.º LOTES`, `N° LOTES`, `N LOTES`, `NRO LOTES` y `CANTIDAD DE LOTES`.

Al actualizar un proyecto existente: reemplaza todo `Code.gs`, guarda y crea una **nueva versión** de la aplicación web. Conserva la misma `APP_API_KEY`.

Verificación obligatoria: abre la URL `/exec` de la implementación activa. Debe responder con `"backendVersion":"ATENCION-2026-08-21-V14-REGULARIZACION-CAMPOS"`. Si no aparece, la aplicación web todavía está usando una versión anterior.

La versión V14 conserva intactas las filas existentes al regularizar: no borra lotes, detalles, códigos ni fechas; completa únicamente campos vacíos e inserta solo personas nuevas. Permite mantener pendientes placa, zona, conductor, proveedor, número de lotes o detalle de carga y reconstruye referencias antiguas guardadas como `null`. Además, valida las columnas de BD CLIENTES para que un celular vacío nunca desplace la categoría hacia el número de licencia.

El guardado es directo y ligero: solo usa `MATRIZ` y `BD CLIENTES`. Las hojas `BD LOTES`, `CONTROL REGULARIZACIONES`, `HISTORIAL CAMBIOS` y `CONTROL SINCRONIZACION` ya no participan en la aplicación; no es necesario borrarlas para instalar V11.

La app envía un registro por solicitud y omite campos vacíos. Un registro de regularización típico ocupa menos de 1 KB; el envío se activa al recuperar conexión y continúa con reintentos breves en segundo plano.
