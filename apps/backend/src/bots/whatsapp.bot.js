// apps/backend/src/bots/whatsapp.bot.js
import "dotenv/config";
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { handleMessage } from "../modules/asistente/asistente.service.js";
import { cargarHistorial, guardarMensaje } from "../modules/asistente/asistente.memory.js";

// En local usa una carpeta relativa. En Railway, WHATSAPP_SESSION_DIR apunta
// al volumen persistente (ej. /data/whatsapp-session) para no perder la sesión
// en cada deploy/restart.
const AUTH_DIR = process.env.WHATSAPP_SESSION_DIR || "./whatsapp-session-asistente";

// Solo este número puede hablarle al asistente. Formato: "50499999999@s.whatsapp.net"
const NUMERO_AUTORIZADO = process.env.WHATSAPP_NUMERO_AUTORIZADO;

if (!NUMERO_AUTORIZADO) {
  throw new Error("Falta WHATSAPP_NUMERO_AUTORIZADO en el .env");
}

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Escanea este QR con WhatsApp (Dispositivos vinculados -> Vincular dispositivo):");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const motivo = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const debeReconectar = motivo !== DisconnectReason.loggedOut;

      console.log(
        "Conexión cerrada.",
        debeReconectar
          ? "Reconectando..."
          : "Sesión cerrada, borra la carpeta de sesión y vuelve a escanear el QR.",
      );

      if (debeReconectar) iniciarBot();
    } else if (connection === "open") {
      console.log("Bot de WhatsApp del asistente conectado.");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const remitente = msg.key.remoteJid;
    if (remitente !== NUMERO_AUTORIZADO) {
      console.warn(`Mensaje ignorado de número no autorizado: ${remitente}`);
      return;
    }

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

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