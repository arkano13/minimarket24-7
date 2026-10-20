import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/AppError.js";
import { informesPeriodicosDe } from "../informes-periodicos/periodos.js";

// Los informes semanal y mensual viajan en el job del cierre del Turno C
// que los dispara, como destinatarios extra "SEMANAL|<número>" y
// "MENSUAL|<número>": así cada uno se entrega una sola vez por número y
// se reintenta con el mismo mecanismo que el informe del turno.
async function destinatariosPeriodicos(db, job, numeros) {
  const extra = [];
  for (const tipo of informesPeriodicosDe(job.turno, job.fecha)) {
    // Si hubo dos cierres del Turno C ese día, solo el primero lo manda.
    const yaProgramado = await db.informePendiente.findFirst({
      where: {
        fecha: job.fecha, turno: job.turno, turnoCajaId: { not: job.turnoCajaId },
        destinatarios: { has: `${tipo}|${numeros[0]}` },
      },
      select: { turnoCajaId: true },
    });
    if (!yaProgramado) extra.push(...numeros.map((numero) => `${tipo}|${numero}`));
  }
  return extra;
}

// Import diferido: los datos de estos informes usan Prisma y Puppeteer, que
// no hacen falta para entregar el informe de un turno.
async function crearDocumentoPeriodico(tipo, fecha) {
  const { crearDocumentoPeriodico: crear } = await import("../informes-periodicos/documento.js");
  return crear(tipo, fecha);
}

function separarDestinatario(destinatario) {
  const [tipo, numero] = destinatario.includes("|") ? destinatario.split("|") : [null, destinatario];
  return { tipo, numero };
}

// La aceptación de sendMessage no equivale a lectura/entrega en el teléfono.
// Si el proceso cae después del envío y antes del commit puede repetirse ese destinatario.
export async function entregarInforme({
  db, turnoCajaId, destinatarios, crearDocumento, enviar, now = () => new Date(),
  crearPeriodico = crearDocumentoPeriodico,
}) {
  let job = await db.informePendiente.findUnique({ where: { turnoCajaId } });
  if (!job) throw new AppError("No existe un informe pendiente para ese cierre.", 404);
  if (job.enviadoEn) return { enviado: true };
  if (!job.destinatarios.length) {
    const unique = [...new Set(destinatarios.filter(Boolean))];
    if (!unique.length) throw new AppError("No hay destinatarios configurados.", 503);
    const todos = [...unique, ...await destinatariosPeriodicos(db, job, unique)];
    await db.informePendiente.updateMany({
      where: { turnoCajaId, destinatarios: { isEmpty: true } }, data: { destinatarios: todos },
    });
    job = await db.informePendiente.findUnique({ where: { turnoCajaId } });
  }
  const documentos = new Map();
  let failed = false;
  for (const destinatario of job.destinatarios) {
    const key = { turnoCajaId_destinatario: { turnoCajaId, destinatario } };
    const delivery = await db.informeEntrega.upsert({ where: key, create: { turnoCajaId, destinatario }, update: {} });
    if (delivery.enviadoEn) continue;
    const token = randomUUID();
    const claimed = await db.informeEntrega.updateMany({
      where: { turnoCajaId, destinatario, enviadoEn: null, OR: [{ bloqueoHasta: null }, { bloqueoHasta: { lte: now() } }] },
      data: { bloqueoToken: token, bloqueoHasta: new Date(now().getTime() + 10 * 60_000) },
    });
    if (!claimed.count) { failed = true; continue; }
    try {
      const { tipo, numero } = separarDestinatario(destinatario);
      if (!documentos.has(tipo)) {
        documentos.set(tipo, tipo ? await crearPeriodico(tipo, job.fecha) : await crearDocumento(job));
      }
      const message = await enviar(numero, documentos.get(tipo));
      if (!message?.key?.id) throw new Error("WhatsApp no confirmó el mensaje.");
      const saved = await db.informeEntrega.updateMany({
        where: { turnoCajaId, destinatario, bloqueoToken: token },
        data: { enviadoEn: now(), mensajeId: message.key.id, bloqueoToken: null, bloqueoHasta: null },
      });
      if (!saved.count) failed = true;
    } catch (error) {
      failed = true;
      await db.informeEntrega.updateMany({
        where: { turnoCajaId, destinatario, bloqueoToken: token },
        data: { bloqueoToken: null, bloqueoHasta: null },
      });
      console.error(`Informe de caja #${turnoCajaId}: entrega pendiente:`, error.message);
    }
  }
  if (failed) throw new AppError("Quedan destinatarios pendientes; se reintentará el informe.", 503);
  return { enviado: true };
}
