import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/AppError.js";

// La aceptación de sendMessage no equivale a lectura/entrega en el teléfono.
// Si el proceso cae después del envío y antes del commit puede repetirse ese destinatario.
export async function entregarInforme({ db, turnoCajaId, destinatarios, crearDocumento, enviar, now = () => new Date() }) {
  let job = await db.informePendiente.findUnique({ where: { turnoCajaId } });
  if (!job) throw new AppError("No existe un informe pendiente para ese cierre.", 404);
  if (job.enviadoEn) return { enviado: true };
  if (!job.destinatarios.length) {
    const unique = [...new Set(destinatarios.filter(Boolean))];
    if (!unique.length) throw new AppError("No hay destinatarios configurados.", 503);
    await db.informePendiente.updateMany({
      where: { turnoCajaId, destinatarios: { isEmpty: true } }, data: { destinatarios: unique },
    });
    job = await db.informePendiente.findUnique({ where: { turnoCajaId } });
  }
  let document;
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
      document ??= await crearDocumento(job);
      const message = await enviar(destinatario, document);
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
