import type { SeccionRIRM } from './permisos';

export const MODULO_RIRM = {
  id: 'registro-ri-rm',
  numero: 4,
  titulo: 'REGISTRO RI-RM',
  secciones: [
    { id: 'pendientes' as SeccionRIRM, titulo: 'Pendientes' },
    { id: 'nueva-solicitud' as SeccionRIRM, titulo: 'Nueva solicitud' },
    { id: 'mis-solicitudes' as SeccionRIRM, titulo: 'Mis solicitudes' },
    { id: 'historial-buscar' as SeccionRIRM, titulo: 'Historial / Buscar' },
  ],
} as const;
