# Atención al Cliente — Control de Ingresos

Aplicación web para registrar el ingreso de conductores, proveedores y acompañantes a planta. Funciona con enfoque **offline-first**: protege cada registro en el dispositivo, permite continuar atendiendo y sincroniza con Google Sheets cuando la conexión está disponible.

## Funciones principales

- Búsqueda de personas por DNI en `BD CLIENTES`.
- Registro de conductor, proveedor y acompañantes.
- Registro de placa, zona, motivo, lotes, carga, código, guardia y turno.
- Actualización de celular, licencia y categoría cuando corresponde.
- Regularización sin modificar la fecha y hora de filas ya registradas.
- Cola local de pendientes con reintento o eliminación individual.
- Sincronización ligera, un registro por vez, para conexiones deficientes.
- Alertas visuales para datos incompletos, errores y confirmación exitosa.

## Estructura

```text
app/                    Interfaz y API de conexión
google-apps-script/     Backend para Google Sheets (V8)
public/                 Íconos, manifiesto y service worker
tests/                  Pruebas automáticas
worker/                 Entrada de Cloudflare Worker
```

## Requisitos

- Node.js 22.13 o superior.
- npm.
- Una hoja de Google Sheets con las pestañas `MATRIZ` y `BD CLIENTES`.
- Un proyecto de Google Apps Script implementado como aplicación web.

## Instalación local

1. Clona o descarga este repositorio.
2. Instala dependencias:

   ```bash
   npm ci
   ```

3. Crea `.env.local` a partir de `.env.example` y coloca tus valores:

   ```env
   GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_IMPLEMENTACION/exec
   GOOGLE_APPS_SCRIPT_API_KEY=TU_CLAVE_PRIVADA
   ```

4. Inicia la aplicación:

   ```bash
   npm run dev
   ```

Nunca publiques `.env.local`, la clave real ni copias de la hoja con datos personales.

## Configurar Google Apps Script

El backend vigente está en [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Sigue las instrucciones de [`google-apps-script/README.md`](google-apps-script/README.md).

La URL `/exec` activa debe responder:

```json
{
  "ok": true,
  "service": "atencion-cliente-sheets",
  "backendVersion": "ATENCION-2026-08-19-V8"
}
```

## Verificación

```bash
npm run lint
npm test
```

GitHub Actions ejecuta estas comprobaciones automáticamente en cada actualización y solicitud de cambios.

## Publicación

Configura estas variables privadas en la plataforma donde se publique la aplicación:

- `GOOGLE_APPS_SCRIPT_URL`
- `GOOGLE_APPS_SCRIPT_API_KEY`

No escribas sus valores directamente en el código ni en archivos que se suban a GitHub.

## Repositorio previsto

`ACOPIO-AMS/ATENCION-AL-CLIENTE`
