# Activación de la base

1. Abre la hoja con `MATRIZ` y `BD CLIENTES`.
2. Ve a **Extensiones → Apps Script** y pega `Code.gs`.
3. Si es una instalación nueva, ejecuta `configurarBase()` una sola vez y autoriza el acceso. Si la app ya está conectada, no vuelvas a ejecutarla porque generaría una clave nueva.
4. Copia `APP_API_KEY` desde **Configuración del proyecto → Propiedades del script**.
5. Implementa como **Aplicación web**, ejecutando como propietario.
6. Copia la URL `/exec` y configura en Cloudflare `GOOGLE_APPS_SCRIPT_URL` y `GOOGLE_APPS_SCRIPT_API_KEY`.

La fila 2 de `MATRIZ` debe incluir estos encabezados: `ID`, `FECHA Y HORA DE INGRESO`, `DNI`, `NOMBRES Y APELLIDOS`, `CELULAR`, `OCUPACION`, `MOTIVO DE INGRESO`, `PLACA`, `ZONA`, `LICENCIA DE CONDUCIR`, `CATEGORIA`, `NUMERO LOTES`, `DETALLE DE CARGA`, `CODIGO`, `GUARDIA`, `TURNO` y `RESPONSABLE`. Para lotes también se aceptan `N.º LOTES`, `N° LOTES`, `N LOTES`, `NRO LOTES` y `CANTIDAD DE LOTES`.

Al actualizar un proyecto existente: reemplaza todo `Code.gs`, guarda y crea una **nueva versión** de la aplicación web. Conserva la misma `APP_API_KEY`.

Verificación obligatoria: abre la URL `/exec` de la implementación activa. Debe responder con `"backendVersion":"ATENCION-2026-08-21-V13-REGULARIZACION-SEGURA"`. Si no aparece, la aplicación web todavía está usando una versión anterior.

La versión V13 conserva intactas las filas existentes al regularizar: no borra lotes, detalles, códigos ni fechas; completa únicamente campos vacíos e inserta solo personas nuevas. Permite mantener pendientes el número de lotes o el detalle de carga y reconstruye referencias antiguas guardadas como `null` para que el evento continúe visible y sincronizable.

El guardado es directo y ligero: solo usa `MATRIZ` y `BD CLIENTES`. Las hojas `BD LOTES`, `CONTROL REGULARIZACIONES`, `HISTORIAL CAMBIOS` y `CONTROL SINCRONIZACION` ya no participan en la aplicación; no es necesario borrarlas para instalar V11.
