# Módulo 4 — Registro RI-RM

Paquete aislado para incorporar Registro RI-RM al repositorio `ACOPIO-AMS/ATENCION-AL-CLIENTE` sin modificar todavía los módulos 1, 2 y 3.

## Contenido

- `frontend/index-original.html`: Index RI-RM actual completo, conservado como fuente para la migración visual/funcional.
- `backend/Code.gs`: Backend V017 con MOVIMIENTOS como base operativa.
- `lib/permisos.ts`: matriz inicial de accesos del módulo 4.
- `lib/modulo.ts`: definición del menú y sus cuatro subtítulos.
- `docs/INTEGRACION.md`: pasos para integrar el módulo al shell principal.

## Perfiles

- ADMINISTRADOR: Pendientes, Nueva solicitud, Mis solicitudes, Historial / Buscar.
- CHALA: Pendientes, Nueva solicitud, Mis solicitudes, Historial / Buscar.
- ASISTENTE A4: Pendientes, Nueva solicitud, Mis solicitudes, Historial / Buscar.
- GUIAS: Pendientes, Historial / Buscar.
- ATENCION AL CLIENTE: Pendientes, Historial / Buscar.

## Importante

Este paquete es la separación física del código RI-RM dentro de GitHub. El frontend original usa `google.script.run`, por lo que no debe publicarse directamente como una página Next.js sin adaptar su capa de comunicación. La siguiente fase es conectar este módulo al login/sesión de AMS ACOPIO y reemplazar `google.script.run` por la API del sistema, manteniendo la interfaz y los flujos.

No borre `SOLICITUDES` ni `ITEMS` durante la validación de la migración histórica.
