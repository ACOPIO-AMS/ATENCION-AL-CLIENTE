# Activación de la base

1. Abre la hoja con `MATRIZ` y `BD CLIENTES`.
2. Ve a **Extensiones → Apps Script** y pega `Code.gs`.
3. Si es una instalación nueva, ejecuta `configurarBase()` una sola vez y autoriza el acceso. Si la app ya está conectada, no vuelvas a ejecutarla porque generaría una clave nueva.
4. Copia `APP_API_KEY` desde **Configuración del proyecto → Propiedades del script**.
5. Implementa como **Aplicación web**, ejecutando como propietario.
6. Copia la URL `/exec` y configura en Sites `GOOGLE_APPS_SCRIPT_URL` y `GOOGLE_APPS_SCRIPT_API_KEY`.

La fila 2 de `MATRIZ` debe incluir estos encabezados: `ID`, `FECHA Y HORA DE INGRESO`, `DNI`, `NOMBRES Y APELLIDOS`, `CELULAR`, `OCUPACION`, `MOTIVO DE INGRESO`, `PLACA`, `ZONA`, `LICENCIA DE CONDUCIR`, `CATEGORIA`, `NUMERO LOTES`, `DETALLE DE CARGA`, `CODIGO`, `GUARDIA`, `TURNO` y `RESPONSABLE`.

Al actualizar un proyecto existente: reemplaza todo `Code.gs`, guarda y crea una **nueva versión** de la aplicación web. Conserva la misma `APP_API_KEY`.

Verificación obligatoria: abre la URL `/exec` de la implementación activa. Debe responder con `"backendVersion":"ATENCION-2026-08-19-V8"`. Si no aparece, la aplicación web todavía está usando una versión anterior.

La versión V8 libera rápidamente el candado de escritura y permite actualizar el celular de un cliente existente cuando se envía un número válido diferente. Un campo vacío nunca borra el teléfono guardado. Si Google Sheets está atendiendo otro registro, la aplicación conserva el dato en el dispositivo y reintenta automáticamente sin bloquear el siguiente ingreso.

La configuración elimina la columna N.º de personas y crea `BD LOTES`, `CONTROL REGULARIZACIONES`, `HISTORIAL CAMBIOS` y `CONTROL SINCRONIZACION`.
