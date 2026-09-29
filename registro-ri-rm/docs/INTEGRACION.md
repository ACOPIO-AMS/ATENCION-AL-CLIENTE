# Integración prevista

Ruta objetivo dentro del repositorio:

`modulos/registro-ri-rm/`

El sistema principal seguirá en `app/`.

## Menú

4. REGISTRO RI-RM
- Pendientes
- Nueva solicitud
- Mis solicitudes
- Historial / Buscar

5. ADMINISTRADOR se implementará en el shell principal, no dentro de RI-RM, porque administrará toda la aplicación.

## Regla de seguridad

Los permisos deben validarse tanto en interfaz como en servidor. Ocultar una opción de menú no sustituye la autorización del backend.
