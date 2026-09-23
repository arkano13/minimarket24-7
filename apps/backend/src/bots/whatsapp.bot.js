import { createPairingRouter } from "./pairing.routes.js";
// apps/backend/src/bots/whatsapp.bot.js
import "dotenv/config";
import express from "express";
import qrcode from "qrcode";
import { makeWASocket, useMultiFileAuthState, downloadMediaMessage, DisconnectReason, BufferJSON } from "@whiskeysockets/baileys";
import path from "node:path";
import { crearAlmacenPersistente } from "../lib/whatsapp-message-store.js";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { prisma } from "../lib/prisma.js";
import { createReconnectController } from "../lib/reconnect-controller.js";
import { entregarInforme } from "../modules/caja/informe-entrega.js";
import { handleMessage, transcribirAudio } from "../modules/asistente/asistente.service.js";
import { cargarHistorial, guardarMensaje } from "../modules/asistente/asistente.memory.js";
import { getShiftReport } from "../modules/reportes/reportes.service.js";
import { generarInformeTurnoHTML, safePdfName } from "@minisuper/shared/shift-report-pdf";
import { renderHtmlToPdf } from "../lib/pdf-render.js";
import {
  crearCacheReintentos,
  listarSesionesSignal,
} from "../lib/whatsapp-session.js";

const AUTH_DIR = process.env.WHATSAPP_SESSION_DIR || "./whatsapp-session-asistente";
const NUMERO_AUTORIZADO = process.env.WHATSAPP_NUMERO_AUTORIZADO;
const QR_PAGE_SECRET = process.env.QR_PAGE_SECRET;
const INFORME_INTERNO_SECRET = process.env.INFORME_INTERNO_SECRET;

// Nivel de log de Baileys. "warn" muestra los errores de cifrado ("Bad MAC",
// "No session"...) que antes quedaban ocultos. Para ver más: "info" o "debug".
const LOG_LEVEL = process.env.WHATSAPP_LOG_LEVEL || "warn";

// Además del número autorizado del asistente, a quién más se le manda
// el informe al cerrar caja (p.ej. el dueño). Formato JID de WhatsApp,
// separados por coma: "50499999999@s.whatsapp.net,50488888888@s.whatsapp.net"
const NUMEROS_INFORME_ADICIONALES = (process.env.WHATSAPP_NUMEROS_INFORME_ADICIONALES || "")
  .split(",")
  .map((numero) => numero.trim())
  .filter(Boolean);

const DESTINATARIOS_INFORME = [NUMERO_AUTORIZADO, ...NUMEROS_INFORME_ADICIONALES];

const SHIFT_LABELS = { A: "Turno A", B: "Turno B", C: "Turno C" };

if (!NUMERO_AUTORIZADO) throw new Error("Falta WHATSAPP_NUMERO_AUTORIZADO en el .env");

let estadoConexion = "conectando";
let ultimoQrDataUrl = null;
let pairingReady = false;
let ultimaDesconexion = null;

// Últimos mensajes enviados: Baileys los necesita para reenviarlos cuando el
// teléfono que los recibe no logra descifrarlos ("Esperando mensaje").
const mensajesEnviados = await crearAlmacenPersistente(AUTH_DIR, {
  replacer: BufferJSON.replacer, reviver: BufferJSON.reviver,
});
console.log("Carpeta de sesión y reenvíos:", path.resolve(AUTH_DIR));
if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  const relative = path.relative(path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH), path.resolve(AUTH_DIR));
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    console.error("WHATSAPP_SESSION_DIR está fuera del volumen. Las sesiones y reenvíos pueden perderse al redesplegar.");
  }
}
const cacheReintentos = crearCacheReintentos();

// Reasignado en cada (re)conexión dentro de iniciarBot() — el handler
// HTTP de /interno/informe-turno siempre debe usar el socket VIVO más
// reciente, no uno de una conexión ya cerrada.
let sock = null;
const reconexion = createReconnectController(iniciarBot, {
  onError: (error) => console.error("No se pudo iniciar WhatsApp; se reintentará:", error.message),
});

const app = express();
app.use(express.json());

app.use("/pair", createPairingRouter({
  secret: QR_PAGE_SECRET,
  getState: () => ({ socket: sock, status: estadoConexion, qr: ultimoQrDataUrl, ready: pairingReady, lastDisconnect: ultimaDesconexion }),
}));

app.listen(process.env.PORT || 3002, () => {
  console.log(`Página de pairing en el puerto ${process.env.PORT || 3002}`);
});

// Llamada por el backend (API) justo después de cerrar una caja — ver
// apps/backend/src/modules/caja/informe-turno-notifier.js. Nunca la
// llama nadie más (protegida por secreto compartido), y un fallo acá
// no afecta el cierre de caja que ya se guardó del otro lado.
app.post("/interno/informe-turno", async (req, res) => {
  if (!INFORME_INTERNO_SECRET || req.get("X-Interno-Secret") !== INFORME_INTERNO_SECRET) {
    return res.status(403).json({ error: "No autorizado." });
  }

  const { turno, fecha, turnoCajaId } = req.body ?? {};

  if (!["A", "B", "C"].includes(turno) || typeof fecha !== "string") {
    return res.status(400).json({ error: "turno o fecha inválidos." });
  }

  // La cola identifica cada envío por cierre para conservar sus entregas.
  if (turnoCajaId != null && (!Number.isSafeInteger(Number(turnoCajaId)) || Number(turnoCajaId) <= 0)) {
    return res.status(400).json({ error: "turnoCajaId inválido." });
  }

  if (turnoCajaId == null) {
    return res.status(400).json({ error: "El envío requiere turnoCajaId para evitar duplicados." });
  }

  try {
    if (!sock || estadoConexion !== "conectado") {
      return res.status(503).json({ error: "El bot de WhatsApp no está conectado; el informe sigue pendiente." });
    }

    const result = await entregarInforme({
      db: prisma, turnoCajaId: Number(turnoCajaId), destinatarios: DESTINATARIOS_INFORME, enviar,
      crearDocumento: async (job) => {
        const reporte = await getShiftReport(job.fecha, job.fecha, [job.turno], undefined, { turnoCajaId: job.turnoCajaId });
        const pdf = await renderHtmlToPdf(generarInformeTurnoHTML(reporte));
        return {
          document: pdf, mimetype: "application/pdf",
          fileName: safePdfName(`informe-${SHIFT_LABELS[job.turno]}-${job.fecha}`),
          caption: `${SHIFT_LABELS[job.turno]} · ${job.fecha} — cierre #${job.turnoCajaId}`,
        };
      },
    });
    res.json(result);
  } catch (err) {
    console.error("Error generando/enviando el informe de turno tras un cierre de caja:", err);
    res.status(err.status ?? 500).json({ error: "No se confirmó el envío completo; el informe sigue pendiente." });
  }
});

// Emergencia: descarga el PDF directo por HTTP, sin pasar por WhatsApp
// para nada — útil si la sesión de WhatsApp está caída/desincronizada
// y necesitás el informe YA. Acepta el secreto por query (?clave=...)
// para poder pegarlo directo en el navegador, no solo por curl.
// Ejemplo: GET /interno/informe-turno-pdf?turno=C&fecha=2026-09-16&clave=TU_SECRETO
app.get("/interno/informe-turno-pdf", async (req, res) => {
  const clave = req.query.clave || req.get("X-Interno-Secret");

  if (!INFORME_INTERNO_SECRET || clave !== INFORME_INTERNO_SECRET) {
    return res.status(403).send("No autorizado.");
  }

  const { turno, fecha, turnoCajaId } = req.query;

  if (!["A", "B", "C"].includes(turno) || typeof fecha !== "string") {
    return res.status(400).send("turno o fecha inválidos.");
  }

  if (turnoCajaId != null && (!Number.isSafeInteger(Number(turnoCajaId)) || Number(turnoCajaId) <= 0)) {
    return res.status(400).send("turnoCajaId inválido.");
  }

  try {
    const reporte = await getShiftReport(fecha, fecha, [turno], undefined, { turnoCajaId });
    const html = generarInformeTurnoHTML(reporte);
    const pdf = await renderHtmlToPdf(html);
    const fileName = safePdfName(`informe-${SHIFT_LABELS[turno]}-${fecha}`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.send(pdf);
  } catch (err) {
    console.error("Error generando el PDF del informe de turno (descarga directa):", err);
    res.status(500).send("No se pudo generar el PDF.");
  }
});

// Todo envío pasa por aquí para guardar el mensaje y poder reenviarlo si el
// destinatario lo pide.
async function enviar(jid, contenido) {
  if (!sock || estadoConexion !== "conectado") throw new Error("WhatsApp no está conectado.");
  const enviado = await sock.sendMessage(jid, contenido);

  if (enviado?.key?.id && enviado.message) {
    await mensajesEnviados.guardar(enviado.key.id, enviado.message);
  }

  return enviado;
}

function claveInternaValida(req) {
  const clave = req.query.clave || req.get("X-Interno-Secret");

  return Boolean(INFORME_INTERNO_SECRET) && clave === INFORME_INTERNO_SECRET;
}

// Diagnóstico sin necesidad de ver los logs de Railway.
// GET /interno/estado?clave=TU_SECRETO
app.get("/interno/estado", async (req, res) => {
  if (!claveInternaValida(req)) {
    return res.status(403).json({ error: "No autorizado." });
  }

  res.json({
    conexion: estadoConexion,
    sesionesDeCifrado: (await listarSesionesSignal(AUTH_DIR)).length,
    mensajesGuardadosParaReenvio: mensajesEnviados.size,
    destinatariosDeInformes: DESTINATARIOS_INFORME.length,
  });
});

// Compatibilidad con enlaces antiguos: no eliminar claves mientras el socket
// puede estar leyéndolas/escribiéndolas. La recuperación requiere detener el bot.
app.post("/interno/reset-sesiones", async (req, res) => {
  if (req.get("X-Interno-Secret") !== INFORME_INTERNO_SECRET || !INFORME_INTERNO_SECRET) {
    return res.status(403).json({ error: "No autorizado." });
  }

  res.status(409).json({ error: "El borrado de sesiones en caliente está deshabilitado. Detén el bot antes de una recuperación de vinculación." });
});

// Manda un mensaje corto a todos los destinatarios de informes para comprobar
// que llegan legibles, sin esperar a un cierre de caja.
app.post("/interno/prueba-envio", async (req, res) => {
  if (req.get("X-Interno-Secret") !== INFORME_INTERNO_SECRET || !INFORME_INTERNO_SECRET) {
    return res.status(403).json({ error: "No autorizado." });
  }

  if (!sock || estadoConexion !== "conectado") {
    return res.status(503).json({ error: "El bot de WhatsApp no está conectado." });
  }

  const resultados = [];

  for (const [indice, numero] of DESTINATARIOS_INFORME.entries()) {
    try {
      await enviar(numero, { text: "Prueba del bot de informes de Minimarket 24/7. Si lees esto, el envío funciona." });
      resultados.push({ destinatario: indice + 1, enviado: true });
    } catch (err) {
      console.error(`No se pudo enviar la prueba al destinatario ${indice + 1}:`, err);
      resultados.push({ destinatario: indice + 1, enviado: false });
    }
  }

  res.json({ resultados });
});

async function iniciarBot() {
  pairingReady = false;
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const currentSocket = makeWASocket({
    auth: state,
    // Da más margen antes de que el cliente rote referencias QR y cierre
    // la conexión por agotarlas. No modifica la caducidad fijada por WhatsApp
    // para los códigos de vinculación por teléfono.
    qrTimeout: 120_000,
    logger: pino({ level: LOG_LEVEL }),
    // Sin getMessage, Baileys no puede reenviar un mensaje que el teléfono
    // del destinatario no descifró, y ese mensaje queda en "Esperando mensaje".
    getMessage: async (key) => mensajesEnviados.obtener(key.id),
    msgRetryCounterCache: cacheReintentos,
  });
  sock = currentSocket;

  currentSocket.ev.on("creds.update", () => {
    if (sock === currentSocket) void saveCreds().catch((error) => console.error("No se guardaron las credenciales de WhatsApp:", error.message));
  });

  currentSocket.ev.on("connection.update", (update) => {
    void manejarConexion(update).catch((error) => console.error("Error de conexión WhatsApp:", error.message));
  });
  async function manejarConexion(update) {
    if (sock !== currentSocket) return;
    const { connection, lastDisconnect, qr } = update;
    if (connection === "connecting" || qr) pairingReady = true;

    if (qr) {
      estadoConexion = "esperando_qr";
      const dataUrl = await qrcode.toDataURL(qr);
      if (sock !== currentSocket) return;
      ultimoQrDataUrl = dataUrl;
      console.log("QR generado. Visitá /pair para escanearlo.");
    }

    if (connection === "close") {
      const motivo = lastDisconnect?.error?.output?.statusCode ?? new Boom(lastDisconnect?.error).output.statusCode;
      console.error("WhatsApp desconectado:", { codigo: motivo, motivo: lastDisconnect?.error?.message ?? "Sin detalle" });
      ultimaDesconexion = { codigo: motivo, fecha: new Date().toISOString() };
      pairingReady = false;
      sock = null;
      ultimoQrDataUrl = null;
      currentSocket.ev.removeAllListeners("connection.update");
      currentSocket.ev.removeAllListeners("messages.upsert");
      currentSocket.ev.removeAllListeners("creds.update");

      // Otra instancia abrió esta misma sesión (por ejemplo el bot corriendo
      // también en otra PC o en otro servicio de Railway). Reconectar haría
      // que las dos se echen una a la otra sin parar y se dañe el cifrado,
      // que es lo que produce "Esperando mensaje".
      if (motivo === DisconnectReason.connectionReplaced) {
        reconexion.stop();
        estadoConexion = "reemplazada";
        console.error(
          "Conexión reemplazada: otra instancia está usando esta misma sesión de WhatsApp. " +
            "No se reconecta. Apagá la otra instancia y reiniciá este servicio.",
        );
        return;
      }

      const debeReconectar = motivo !== DisconnectReason.loggedOut;

      estadoConexion = debeReconectar ? "conectando" : "desvinculado";
      if (debeReconectar) {
        const delay = reconexion.retry();
        console.log(`Reintento de WhatsApp programado${delay ? ` en ${delay / 1000}s` : ""}.`);
      } else {
        reconexion.stop();
        console.error("Sesión desvinculada: requiere una nueva vinculación. No se borran credenciales automáticamente.");
      }
    } else if (connection === "open") {
      estadoConexion = "conectado";
      pairingReady = false;
      ultimaDesconexion = null;
      reconexion.connected();
      ultimoQrDataUrl = null;
      console.log("Bot de WhatsApp del asistente conectado.");
    }
  }

  currentSocket.ev.on("messages.upsert", (event) => {
    void manejarMensajes(event).catch((error) => console.error("Error procesando mensaje WhatsApp:", error.message));
  });
  async function manejarMensajes({ messages }) {
    if (sock !== currentSocket) return;
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;
    if (msg.key.remoteJid === "status@broadcast") return;
    if (msg.key.remoteJid?.endsWith("@g.us")) return;

    const remitente = msg.key.remoteJid;
    const numeroReal = msg.key.remoteJidAlt || msg.key.senderPn || remitente;

    if (numeroReal !== NUMERO_AUTORIZADO) {
      console.warn(`Mensaje ignorado de número no autorizado: ${numeroReal} (jid: ${remitente})`);
      return;
    }

    let texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

    if (msg.message.audioMessage) {
      try {
        const buffer = await downloadMediaMessage(msg, "buffer", {});
        const base64Audio = buffer.toString("base64");
        const mimeType = msg.message.audioMessage.mimetype || "audio/ogg";
        texto = await transcribirAudio(base64Audio, mimeType);

        if (!texto) {
          await enviar(remitente, { text: "No pude entender el audio, ¿podrías escribirlo o intentar de nuevo?" });
          return;
        }
      } catch (err) {
        console.error("Error transcribiendo audio:", err);
        await enviar(remitente, { text: "Tuve un problema procesando el audio, intenta escribiendo tu pregunta." });
        return;
      }
    }

    if (!texto) return;

    try {
      const historial = await cargarHistorial("WHATSAPP", remitente);
      historial.push({ role: "user", content: texto });
      await guardarMensaje("WHATSAPP", remitente, "user", texto);

      const respuesta = await handleMessage(historial);
      await guardarMensaje("WHATSAPP", remitente, "assistant", respuesta);

      await enviar(remitente, { text: respuesta });
    } catch (err) {
      console.error("Error en bot de asistente (WhatsApp):", err);
      await enviar(remitente, { text: "Tuve un problema procesando tu consulta." });
    }
  }
}

void reconexion.start();
