import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { entregarInforme } from "./informe-entrega.js";
import { crearDocumentoInforme } from "./informe-documento.js";
import { enviarPorWhatsApp } from "./whatsapp-gateway.client.js";

const LEASE_MS = 10 * 60_000;
// La cola ya no consulta la base cada 2 minutos todo el día: agenda la
// siguiente revisión para cuando toca el próximo informe pendiente. Como
// red de seguridad revisa al menos cada 30 minutos.
const ESPERA_MINIMA_MS = 15_000;
const ESPERA_MAXIMA_MS = 30 * 60_000;

// Lo registra iniciarColaInformes; permite adelantar la próxima revisión.
let despertarCola = null;

export async function notificarCierreDeCaja(turno, fecha, turnoCajaId, transaction, cerradoEn = new Date()) {
  // Mismo commit que el cierre: no queda un cierre sin aviso pendiente.
  const proximoIntento = new Date(cerradoEn.getTime() + 5 * 60_000);
  await transaction.informePendiente.create({
    data: { turnoCajaId, turno, fecha, proximoIntento },
  });
  // Si la transacción se revierte, solo habrá una revisión de más.
  despertarCola?.(proximoIntento);
}

export async function calcularEsperaCola({ db = prisma, now = () => new Date() } = {}) {
  const siguiente = await db.informePendiente.findFirst({
    where: { enviadoEn: null },
    orderBy: { proximoIntento: "asc" },
    select: { proximoIntento: true, bloqueoHasta: true },
  });
  if (!siguiente) return ESPERA_MAXIMA_MS;
  const listo = Math.max(siguiente.proximoIntento.getTime(), siguiente.bloqueoHasta?.getTime() ?? 0);
  return Math.min(ESPERA_MAXIMA_MS, Math.max(ESPERA_MINIMA_MS, listo - now().getTime() + 1_000));
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
  let timer = null;
  let siguienteEn = Infinity;
  const programar = (delay) => {
    const en = Date.now() + delay;
    // Solo adelantar: nunca posponer una revisión ya agendada antes.
    if (timer && en >= siguienteEn) return;
    clearTimeout(timer);
    siguienteEn = en;
    timer = setTimeout(tick, delay);
    timer.unref();
  };
  async function tick() {
    timer = null;
    siguienteEn = Infinity;
    if (stopped) return;
    if (busy) { programar(ESPERA_MINIMA_MS); return; }
    busy = true;
    let espera = ESPERA_MAXIMA_MS;
    try {
      await procesarInformesPendientes();
      // Sin bot configurado no se envía nada: no tiene sentido revisar seguido.
      if (process.env.WHATSAPP_BOT_URL && process.env.INFORME_INTERNO_SECRET) espera = await calcularEsperaCola();
    } catch (error) {
      console.error("Error procesando la cola de informes:", error.message);
      espera = 2 * 60_000;
    } finally { busy = false; }
    if (!stopped) programar(espera);
  }
  despertarCola = (cuando) => {
    if (!stopped) programar(Math.max(ESPERA_MINIMA_MS, cuando.getTime() - Date.now() + 1_000));
  };
  void tick();
  return () => { stopped = true; despertarCola = null; clearTimeout(timer); };
}
