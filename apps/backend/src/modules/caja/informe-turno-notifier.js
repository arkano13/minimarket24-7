import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { entregarInforme } from "./informe-entrega.js";
import { crearDocumentoInforme } from "./informe-documento.js";
import { enviarPorWhatsApp } from "./whatsapp-gateway.client.js";

const LEASE_MS = 10 * 60_000;

export async function notificarCierreDeCaja(turno, fecha, turnoCajaId, transaction, cerradoEn = new Date()) {
  // Mismo commit que el cierre: no queda un cierre sin aviso pendiente.
  await transaction.informePendiente.create({
    data: { turnoCajaId, turno, fecha, proximoIntento: new Date(cerradoEn.getTime() + 5 * 60_000) },
  });
}

export async function procesarInformesPendientes({
  db = prisma, now = () => new Date(),
  crearDocumento = crearDocumentoInforme,
  enviar = enviarPorWhatsApp,
  destinatarios = [
    process.env.WHATSAPP_NUMERO_AUTORIZADO,
    ...(process.env.WHATSAPP_NUMEROS_INFORME_ADICIONALES || "").split(",").map(value => value.trim()),
  ].filter(Boolean),
} = {}) {
  if (enviar === enviarPorWhatsApp && (!process.env.WHATSAPP_BOT_URL || !process.env.INFORME_INTERNO_SECRET)) return;
  const jobs = await db.informePendiente.findMany({
    where: { enviadoEn: null, proximoIntento: { lte: now() }, OR: [{ bloqueoHasta: null }, { bloqueoHasta: { lte: now() } }] },
    orderBy: { proximoIntento: "asc" }, take: 5,
  });
  for (const job of jobs) {
    const token = randomUUID();
    const claim = await db.informePendiente.updateMany({
      where: { turnoCajaId: job.turnoCajaId, enviadoEn: null, proximoIntento: { lte: now() }, OR: [{ bloqueoHasta: null }, { bloqueoHasta: { lte: now() } }] },
      data: { bloqueoToken: token, bloqueoHasta: new Date(now().getTime() + LEASE_MS), intentos: { increment: 1 } },
    });
    if (!claim.count) continue;
    try {
      await entregarInforme({
        db, turnoCajaId: job.turnoCajaId, destinatarios, crearDocumento, enviar, now,
      });
      await db.informePendiente.updateMany({
        where: { turnoCajaId: job.turnoCajaId, bloqueoToken: token },
        data: { enviadoEn: now(), bloqueoToken: null, bloqueoHasta: null, ultimoError: null },
      });
    } catch (error) {
      const detail = `${error.message}${error.cause?.code ? ` (${error.cause.code})` : ""}`.slice(0, 500);
      const delay = Math.min(60 * 60_000, 30_000 * 2 ** Math.min(job.intentos, 7));
      await db.informePendiente.updateMany({
        where: { turnoCajaId: job.turnoCajaId, bloqueoToken: token },
        data: { bloqueoToken: null, bloqueoHasta: null, ultimoError: detail, proximoIntento: new Date(now().getTime() + delay) },
      });
      console.error(`Informe de caja #${job.turnoCajaId} pendiente; se reintentará: ${detail}`);
    }
  }
}

export function iniciarColaInformes() {
  let busy = false;
  let stopped = false;
  if (!process.env.INFORME_INTERNO_SECRET || (!process.env.WHATSAPP_BOT_URL && (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT_ID))) {
    console.warn("Informes pendientes: configura WHATSAPP_BOT_URL e INFORME_INTERNO_SECRET. Los cierres se conservarán en la cola.");
  }
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try { await procesarInformesPendientes(); }
    catch (error) { console.error("Error procesando la cola de informes:", error.message); }
    finally { busy = false; }
  };
  const timer = setInterval(tick, 2 * 60_000);
  timer.unref();
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
