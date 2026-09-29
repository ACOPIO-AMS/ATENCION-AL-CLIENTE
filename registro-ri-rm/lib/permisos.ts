export type PerfilRIRM =
  | 'ADMINISTRADOR'
  | 'CHALA'
  | 'ASISTENTE A4'
  | 'GUIAS'
  | 'ATENCION AL CLIENTE';

export type SeccionRIRM =
  | 'pendientes'
  | 'nueva-solicitud'
  | 'mis-solicitudes'
  | 'historial-buscar';

export const ACCESOS_RIRM: Record<PerfilRIRM, SeccionRIRM[]> = {
  ADMINISTRADOR: ['pendientes','nueva-solicitud','mis-solicitudes','historial-buscar'],
  CHALA: ['pendientes','nueva-solicitud','mis-solicitudes','historial-buscar'],
  'ASISTENTE A4': ['pendientes','nueva-solicitud','mis-solicitudes','historial-buscar'],
  GUIAS: ['pendientes','historial-buscar'],
  'ATENCION AL CLIENTE': ['pendientes','historial-buscar'],
};

export function puedeAccederRIRM(perfil: string, seccion: SeccionRIRM): boolean {
  const normalizado = String(perfil || '').trim().toUpperCase() as PerfilRIRM;
  return (ACCESOS_RIRM[normalizado] || []).includes(seccion);
}
