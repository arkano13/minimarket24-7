// apps/backend/src/modules/informes-periodicos/periodos.js
//
// Qué informes periódicos acompañan al informe de un cierre de caja.
// Viajan en la misma cola que el informe del Turno C (ver
// caja/informe-entrega.js), así heredan los reintentos y la entrega una
// sola vez por destinatario sin tablas nuevas.
//
//   SEMANAL: el Turno C del domingo (que se cierra la madrugada del lunes)
//            manda la semana de lunes a domingo.
//   MENSUAL: el Turno C del último día del mes (cierra la madrugada del
//            día 1) manda el mes completo.
//
// `fecha` es el día comercial del turno (YYYY-MM-DD, corte a las 2 a. m.).

export const TIPOS_PERIODICOS = ["SEMANAL", "MENSUAL"];

function aFecha(fecha) {
  const [year, month, day] = fecha.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function aTexto(date) {
  return date.toISOString().slice(0, 10);
}

export function sumarDias(fecha, dias) {
  const date = aFecha(fecha);
  date.setUTCDate(date.getUTCDate() + dias);
  return aTexto(date);
}

export function diaDeSemana(fecha) {
  return aFecha(fecha).getUTCDay();
}

function ultimoDiaDelMes(fecha) {
  const date = aFecha(fecha);
  return aTexto(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

export function informesPeriodicosDe(turno, fecha) {
  if (turno !== "C" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "")) return [];

  const tipos = [];
  if (diaDeSemana(fecha) === 0) tipos.push("SEMANAL");
  if (ultimoDiaDelMes(fecha) === fecha) tipos.push("MENSUAL");
  return tipos;
}

// Lunes a domingo de la semana que termina en `fecha` (un domingo).
export function rangoSemanal(fecha) {
  return { desde: sumarDias(fecha, -6), hasta: fecha };
}

export function rangoMensual(fecha) {
  return { desde: `${fecha.slice(0, 7)}-01`, hasta: ultimoDiaDelMes(fecha) };
}

export function rangoMesAnterior(fecha) {
  return rangoMensual(sumarDias(`${fecha.slice(0, 7)}-01`, -1));
}

// Semanas del mes para la gráfica: 1–7, 8–14, 15–21 y del 22 a fin de mes.
export function semanasDelMes({ desde, hasta }) {
  const mes = desde.slice(0, 8);
  const ultimo = Number(hasta.slice(8, 10));
  return [[1, 7], [8, 14], [15, 21], [22, ultimo]].map(([inicio, fin]) => ({
    desde: `${mes}${String(inicio).padStart(2, "0")}`,
    hasta: `${mes}${String(fin).padStart(2, "0")}`,
  }));
}

// Instantes UTC del rango de días comerciales [desde 2:00 a. m., hasta+1 1:59:59.999 a. m.].
export function instantesDelRango({ desde, hasta }) {
  return {
    from: new Date(`${desde}T02:00:00.000-06:00`),
    to: new Date(`${sumarDias(hasta, 1)}T01:59:59.999-06:00`),
  };
}
