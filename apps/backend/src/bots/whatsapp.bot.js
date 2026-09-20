// apps/backend/src/bots/whatsapp.bot.js
import "dotenv/config";
import express from "express";
import qrcode from "qrcode";
import { makeWASocket, useMultiFileAuthState, downloadMediaMessage, DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { handleMessage, transcribirAudio } from "../modules/asistente/asistente.service.js";
import { cargarHistorial, guardarMensaje } from "../modules/asistente/asistente.memory.js";
import { getShiftReport } from "../modules/reportes/reportes.service.js";
import { generarInformeTurnoHTML, safePdfName } from "@minisuper/shared/shift-report-pdf";
import { renderHtmlToPdf } from "../lib/pdf-render.js";

const AUTH_DIR = process.env.WHATSAPP_SESSION_DIR || "./whatsapp-session-asistente";
const NUMERO_AUTORIZADO = process.env.WHATSAPP_NUMERO_AUTORIZADO;
const QR_PAGE_SECRET = process.env.QR_PAGE_SECRET;
const INFORME_INTERNO_SECRET = process.env.INFORME_INTERNO_SECRET;

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

// Reasignado en cada (re)conexión dentro de iniciarBot() — el handler
// HTTP de /interno/informe-turno siempre debe usar el socket VIVO más
// reciente, no uno de una conexión ya cerrada.
let sock = null;

const app = express();
app.use(express.json());

app.get("/pair", async (req, res) => {
  if (QR_PAGE_SECRET && req.query.clave !== QR_PAGE_SECRET) {
    return res.status(403).send("No autorizado.");
  }

  if (estadoConexion === "conectado") {
    return res.send(`<h1>Ya conectado</h1><p>El bot de WhatsApp del asistente ya está vinculado.</p>`);
  }

  if (!ultimoQrDataUrl) {
    return res.send(`<meta http-equiv="refresh" content="3"><p>Generando QR, esperá unos segundos...</p>`);
  }

  res.send(`
    <html>
      <head><meta http-equiv="refresh" content="20"></head>
      <body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;padding-top:40px;">
        <h1>Escaneá con WhatsApp</h1>
        <p>Dispositivos vinculados → Vincular dispositivo</p>
        <img src="${ultimoQrDataUrl}" width="300" height="300" />
      </body>
    </html>
  `);
});

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

  // Opcional: con el id de la caja el informe es de esa caja (apertura
  // a cierre). Sin él, se arma por franja horaria como antes.
  if (turnoCajaId != null && (!Number.isSafeInteger(Number(turnoCajaId)) || Number(turnoCajaId) <= 0)) {
    return res.status(400).json({ error: "turnoCajaId inválido." });
  }

  // Responder rápido: el backend que llama no debe esperar a que
  // Chromium renderice el PDF ni a que Baileys termine de mandarlo.
  res.status(202).json({ recibido: true });

  try {
    if (!sock || estadoConexion !== "conectado") {
      console.error("No se pudo enviar el informe de turno: el bot de WhatsApp no está conectado.");
      return;
    }

    const reporte = await getShiftReport(fecha, fecha, [turno], undefined, { turnoCajaId });
    const html = generarInformeTurnoHTML(reporte);
    const pdf = await renderHtmlToPdf(html);
    const fileName = safePdfName(`informe-${SHIFT_LABELS[turno]}-${fecha}`);
    const caption = `${SHIFT_LABELS[turno]} · ${fecha} — cierre de caja registrado.`;

    for (const numero of DESTINATARIOS_INFORME) {
      try {
        await sock.sendMessage(numero, {
          document: pdf,
          fileName,
          mimetype: "application/pdf",
          caption,
        });
      } catch (err) {
        console.error(`No se pudo enviar el informe de turno a ${numero}:`, err);
      }
    }
  } catch (err) {
    console.error("Error generando/enviando el informe de turno tras un cierre de caja:", err);
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

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      estadoConexion = "esperando_qr";
      ultimoQrDataUrl = await qrcode.toDataURL(qr);
      console.log("QR generado. Visitá /pair para escanearlo.");
    }

    if (connection === "close") {
      const motivo = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const debeReconectar = motivo !== DisconnectReason.loggedOut;

      estadoConexion = "conectando";
      console.log(
        "Conexión cerrada.",
        debeReconectar ? "Reconectando..." : "Sesión cerrada, borra la carpeta de sesión y vuelve a escanear.",
      );

      if (debeReconectar) iniciarBot();
    } else if (connection === "open") {
      estadoConexion = "conectado";
      ultimoQrDataUrl = null;
      console.log("Bot de WhatsApp del asistente conectado.");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
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
          await sock.sendMessage(remitente, { text: "No pude entender el audio, ¿podrías escribirlo o intentar de nuevo?" });
          return;
        }
      } catch (err) {
        console.error("Error transcribiendo audio:", err);
        await sock.sendMessage(remitente, { text: "Tuve un problema procesando el audio, intenta escribiendo tu pregunta." });
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

      await sock.sendMessage(remitente, { text: respuesta });
    } catch (err) {
      console.error("Error en bot de asistente (WhatsApp):", err);
      await sock.sendMessage(remitente, { text: "Tuve un problema procesando tu consulta." });
    }
  });
}

iniciarBot();