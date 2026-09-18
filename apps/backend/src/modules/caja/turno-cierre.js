// apps/backend/src/modules/caja/turno-cierre.js
//
// Deduce a qué turno (A/B/C) corresponde un cierre de caja a partir de
// la HORA en que se cerró, con una tolerancia de ±1 hora alrededor del
// fin de cada turno. Se usa SOLO para imprimir el informe de un cierre
// desde el historial: el envío por WhatsApp sigue usando la rotación
// A → B → C (obtenerYAvanzarProximoTurno) y no se ve afectado.
//
// Fin de cada turno (hora de Honduras, UTC-6, sin horario de verano):
//   Turno A: 2:00 a. m. – 8:00 a. m.   → termina 8:00 a. m.
//   Turno B: 8:00 a. m. – 6:00 p. m.   → termina 6:00 p. m.
//   Turno C: 6:00 p. m. – 2:00 a. m.   → termina 2:00 a. m.
//
// Ejemplos con tolerancia de 60 min:
//   cierre 8:05 a. m.  → Turno A   (cae en 7:00–9:00 a. m.)
//   cierre 5:40 p. m.  → Turno B   (cae en 5:00–7:00 p. m.)
//   cierre 6:30 p. m.  → Turno B
//   cierre 1:30 a. m.  → Turno C   (cae en 1:00–3:00 a. m.)
//   cierre 12:00 m.    → fuera de toda tolerancia: Turno B (el que
//                        contiene esa hora)

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

export const TOLERANCIA_CIERRE_MINUTOS = 60;

// Minuto del día (0-1439) en que termina cada turno.
const FIN_DE_TURNO = { A: 480, B: 1080, C: 120 };

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HONDURAS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function fechaYMinutoLocal(date) {
  const parts = formatter.formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;

  return {
    fecha: `${part("year")}-${part("month")}-${part("day")}`,
    minuto: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

function sumarDias(fecha, dias) {
  const value = new Date(`${fecha}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + dias);
  return value.toISOString().slice(0, 10);
}

// Distancia entre dos minutos del día contando que 23:59 y 00:00 son
// vecinos (necesario para el fin del Turno C, a las 2:00 a. m.).
function distanciaCircular(a, b) {
  const diferencia = Math.abs(a - b);
  return Math.min(diferencia, 1440 - diferencia);
}

function turnoQueContiene(minuto) {
  if (minuto >= 120 && minuto < 480) return "A";
  if (minuto >= 480 && minuto < 1080) return "B";
  return "C";
}

/**
 * @param {Date} cerradoEn instante en que se cerró la caja
 * @param {number} [tolerancia] minutos de margen (arriba y abajo) alrededor
 *   del fin de cada turno
 * @returns {{ turno: "A"|"B"|"C", fecha: string, porTolerancia: boolean }}
 *   `fecha` es el día comercial (YYYY-MM-DD) del turno — el Turno C que
 *   termina de madrugada pertenece al día calendario anterior.
 */
export function inferirTurnoDeCierre(
  cerradoEn,
  tolerancia = TOLERANCIA_CIERRE_MINUTOS,
) {
  const { fecha: fechaLocal, minuto } = fechaYMinutoLocal(cerradoEn);

  let turno = null;
  let mejorDistancia = Infinity;

  for (const [candidato, fin] of Object.entries(FIN_DE_TURNO)) {
    const distancia = distanciaCircular(minuto, fin);

    if (distancia <= tolerancia && distancia < mejorDistancia) {
      turno = candidato;
      mejorDistancia = distancia;
    }
  }

  const porTolerancia = turno !== null;

  if (!porTolerancia) {
    turno = turnoQueContiene(minuto);
  }

  // El Turno C cruza la medianoche: si el cierre ocurrió de madrugada
  // (antes del mediodía), el turno empezó el día calendario anterior.
  const fecha =
    turno === "C" && minuto < 720 ? sumarDias(fechaLocal, -1) : fechaLocal;

  return { turno, fecha, porTolerancia };
}