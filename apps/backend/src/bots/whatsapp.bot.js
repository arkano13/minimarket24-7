// apps/backend/src/bots/whatsapp.bot.js
import "dotenv/config";
import { makeWASocket, useMultiFileAuthState, downloadMediaMessage, DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { handleMessage, transcribirAudio } from "../modules/asistente/asistente.service.js";
import { cargarHistorial, guardarMensaje } from "../modules/asistente/asistente.memory.js";

const AUTH_DIR = process.env.WHATSAPP_SESSION_DIR || "./whatsapp-session-asistente";
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

        console.log(`Audio transcrito de ${remitente}: ${texto}`);
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