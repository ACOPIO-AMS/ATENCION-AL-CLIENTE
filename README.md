# Atención al Cliente — Control de Ingresos

Aplicación web para registrar conductores, proveedores y acompañantes. Google Sheets continúa siendo la base de datos y Google Apps Script funciona como servicio de conexión.

## Administración independiente

El código principal vive en este repositorio de GitHub. Cloudflare Workers publica automáticamente la rama `main`, por lo que la aplicación no depende de una cuenta de ChatGPT para permanecer activa.

Flujo de publicación:

1. Se modifica el código en GitHub.
2. El cambio se incorpora a la rama `main`.
3. Cloudflare compila y publica automáticamente.
4. Los teléfonos y computadoras reciben la versión nueva en la misma URL.

## Configuración inicial en Cloudflare

1. Crear una cuenta gratuita en Cloudflare.
2. Abrir **Workers & Pages → Create → Import a repository**.
3. Conectar `ACOPIO-AMS/ATENCION-AL-CLIENTE` y seleccionar la rama `main`.
4. Usar estos comandos:

   - Build command: `npm run build`
   - Deploy command: `npm run deploy:cloudflare`
   - Root directory: `/`

5. En **Settings → Variables and Secrets**, crear como secretos:

   - `GOOGLE_APPS_SCRIPT_URL`
   - `GOOGLE_APPS_SCRIPT_API_KEY`

6. Volver a ejecutar la implementación.

Nunca escribas la URL privada ni la clave dentro de un archivo del repositorio.

## Desarrollo

Requisitos:

- Node.js 22 o superior.
- npm.

Comandos principales:

```bash
npm ci
npm run dev
npm run lint
npm run build
```

## Componentes

- `app/`: formulario, vistas y ruta segura del servidor.
- `public/`: manifiesto, iconos y actualización automática de la aplicación.
- `google-apps-script/Code.gs`: backend que debe instalarse en Google Apps Script.
- `wrangler.jsonc`: configuración de publicación en Cloudflare.

## Seguridad

La aplicación nunca debe incluir la clave de Apps Script en el código del navegador. La ruta `/api/sheets` lee los dos secretos desde Cloudflare y realiza la comunicación con Google Sheets.
