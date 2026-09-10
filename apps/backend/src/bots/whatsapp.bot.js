// apps/backend/src/bots/whatsapp.bot.js
import "dotenv/config";
import express from "express";
import qrcode from "qrcode";
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { handleMessage } from "../modules/asistente/asistente.service.js";
import { cargarHistorial, guardarMensaje } from "../modules/asistente/asistente.memory.js";

const AUTH_DIR = process.env.WHATSAPP_SESSION_DIR || "./whatsapp-session-asistente";
const NUMERO_AUTORIZADO = process.env.WHATSAPP_NUMERO_AUTORIZADO;
const QR_PAGE_SECRET = process.env.QR_PAGE_SECRET; // clave simple para que no cualquiera vea el QR público

if (!NUMERO_AUTORIZADO) {
  throw new Error("Falta WHATSAPP_NUMERO_AUTORIZADO en el .env");
}

// Estado compartido entre el socket de Baileys y la página web
let estadoConexion = "conectando"; // "conectando" | "esperando_qr" | "conectado"
let ultimoQrDataUrl = null;

// --- Servidor web mínimo para ver el QR ---
const app = express();

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

// --- Bot de WhatsApp ---
async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
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

    const remitente = msg.key.remoteJid;
    const numeroReal = msg.key.remoteJidAlt || msg.key.senderPn || remitente;

    if (numeroReal !== NUMERO_AUTORIZADO) {
      console.warn(`Mensaje ignorado de número no autorizado: ${numeroReal} (jid: ${remitente})`);
      return;
    }

    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
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