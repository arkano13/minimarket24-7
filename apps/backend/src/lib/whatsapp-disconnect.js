// Extrae únicamente campos de diagnóstico: nunca serializar el error completo,
// los nodos binarios o las credenciales de la sesión.
export function describeDisconnect({ error, code, registered, opened, now = new Date() }) {
  const attrs = error?.data?.attrs ?? error?.data;
  const detalles = {};
  for (const field of ['reason', 'location', 'code']) {
    const value = attrs?.[field];
    if ((typeof value === 'string' || typeof value === 'number') && /^[a-zA-Z0-9_-]{1,64}$/.test(String(value))) {
      detalles[field] = String(value);
    }
  }
  return {
    codigo: code,
    fecha: now.toISOString(),
    etapa: opened ? 'conexion_abierta' : registered ? 'reconexion_sesion_guardada' : 'vinculacion',
    detalles,
  };
}
