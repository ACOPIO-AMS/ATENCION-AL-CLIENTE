# Cargar esta versión en GitHub

Este paquete contiene la aplicación completa. No cargues el archivo ZIP directamente: primero debes extraerlo.

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

## Google Apps Script V10

Después de cargar GitHub, actualiza también el servicio de Google Sheets:

1. Abre `google-apps-script/Code.gs` de este paquete.
2. Copia todo su contenido y reemplaza completamente `Código.gs` en Google Apps Script.
3. Guarda.
4. Ve a **Implementar → Gestionar implementaciones → Editar**.
5. Selecciona **Nueva versión** y pulsa **Implementar**.
6. No ejecutes `configurarBase()`.

La URL `/exec` debe responder con `ATENCION-2026-08-20-V10`.

## Actualizaciones siguientes

Para publicar un cambio futuro, modifica los archivos de la carpeta clonada y repite solamente **Commit to main → Push origin**. La dirección pública de la aplicación no cambia.
