# Cargar esta versión en GitHub

Este paquete contiene la aplicación completa. No cargues el archivo ZIP directamente: primero debes extraerlo.

La revisión V14 permite guardar para regularizar placa, zona, conductor, proveedor, número de lotes y detalle de carga en cualquiera de las opciones. El guardado normal continúa exigiendo todos los datos. También separa celular, licencia y categoría para impedir que una categoría aparezca como número de licencia cuando el celular está vacío. Conserva el formato de fecha `dd/MM/aaaa HH:mm`.

## Método recomendado: GitHub Desktop

1. Instala y abre GitHub Desktop.
2. Selecciona **File → Clone repository**.
3. Elige `ACOPIO-AMS/ATENCION-AL-CLIENTE` y pulsa **Clone**.
4. Extrae `ATENCION-AL-CLIENTE-GITHUB.zip`.
5. Copia el contenido de la carpeta extraída dentro de la carpeta clonada. Acepta **Reemplazar archivos**.
6. No borres la carpeta oculta `.git` de la copia clonada.
7. Regresa a GitHub Desktop. En **Summary** escribe `Actualiza app y reporte diario`.
8. Pulsa **Commit to main** y luego **Push origin**.

Cloudflare publicará automáticamente la rama `main` después de cada `Push origin`.

## Google Apps Script V14 — regularización completa

Después de cargar GitHub, actualiza también el servicio de Google Sheets:

1. Abre `google-apps-script/Code.gs` de este paquete.
2. Copia todo su contenido y reemplaza completamente `Código.gs` en Google Apps Script.
3. Guarda.
4. Ve a **Implementar → Gestionar implementaciones → Editar**.
5. Selecciona **Nueva versión** y pulsa **Implementar**.
6. No ejecutes `configurarBase()`.

La URL `/exec` debe responder con `ATENCION-2026-08-21-V14-REGULARIZACION-CAMPOS`.

Esta versión escribe directamente en `MATRIZ`, reconoce encabezados como `N.º LOTES`, `N° LOTES`, `N LOTES` y `NUMERO LOTES`, sanea colas antiguas que contienen valores `null` y no usa las hojas auxiliares `BD LOTES`, `CONTROL REGULARIZACIONES`, `HISTORIAL CAMBIOS` ni `CONTROL SINCRONIZACION`.

La transferencia envía un registro por solicitud, elimina campos vacíos y mantiene un registro típico por debajo de 1 KB. Cuando vuelve la conexión, el primer intento es inmediato; si la señal es inestable, reintenta cada pocos segundos sin bloquear el formulario.

## Actualizaciones siguientes

Para publicar un cambio futuro, modifica los archivos de la carpeta clonada y repite solamente **Commit to main → Push origin**. La dirección pública de la aplicación no cambia.
