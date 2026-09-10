// apps/backend/src/bots/whatsapp.bot.js
import "dotenv/config";
import express from "express";
import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { handleMessage } from "../modules/asistente/asistente.service.js";
import { cargarHistorial, guardarMensaje } from "../modules/asistente/asistente.memory.js";

const AUTH_DIR = process.env.WHATSAPP_SESSION_DIR || "./whatsapp-session-asistente";
const NUMERO_AUTORIZADO = process.env.WHATSAPP_NUMERO_AUTORIZADO;
const BOT_NUMERO = process.env.WHATSAPP_BOT_NUMERO; // línea nueva, solo dígitos, sin +
const QR_PAGE_SECRET = process.env.QR_PAGE_SECRET;

if (!NUMERO_AUTORIZADO) throw new Error("Falta WHATSAPP_NUMERO_AUTORIZADO en el .env");
if (!BOT_NUMERO) throw new Error("Falta WHATSAPP_BOT_NUMERO en el .env");

let estadoConexion = "conectando"; // "conectando" | "esperando_codigo" | "conectado"
let codigoActual = null;
let yaSolicitoCodigo = false;

const app = express();

app.get("/pair", (req, res) => {
  if (QR_PAGE_SECRET && req.query.clave !== QR_PAGE_SECRET) {
    return res.status(403).send("No autorizado.");
  }

  if (estadoConexion === "conectado") {
    return res.send(`<h1>Ya conectado</h1><p>El bot de WhatsApp del asistente ya está vinculado.</p>`);
  }

  if (!codigoActual) {
    return res.send(`<meta http-equiv="refresh" content="3"><p>Generando código, esperá unos segundos...</p>`);
  }

  res.send(`
    <html>
      <head><meta http-equiv="refresh" content="20"></head>
      <body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;padding-top:40px;">
        <h1>Vinculá con código</h1>
        <p>En el WhatsApp de la línea ${BOT_NUMERO}:<br>
           Configuración → Dispositivos vinculados → Vincular dispositivo → "Vincular con número de teléfono"</p>
        <h2 style="font-size:48px;letter-spacing:8px;">${codigoActual}</h2>
        <p>El código vence en unos minutos, si expira recargá esta página.</p>
      </body>
    </html>
  `);
});

app.listen(process.env.PORT || 3002, () => {
  console.log(`Página de pairing en el puerto ${process.env.PORT || 3002}`);
});

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"), // requerido para que el pairing code funcione bien
  });

  sock.ev.on("creds.update", saveCreds);

  // Pedimos el código apenas el socket está listo y todavía no hay sesión registrada
  if (!sock.authState.creds.registered && !yaSolicitoCodigo) {
    yaSolicitoCodigo = true;
    setTimeout(async () => {
      try {
        const codigo = await sock.requestPairingCode(BOT_NUMERO);
        codigoActual = codigo;
        estadoConexion = "esperando_codigo";
        console.log(`Código de vinculación: ${codigo} (visitá /pair)`);
      } catch (err) {
        console.error("Error pidiendo pairing code:", err);
      }
    }, 3000); // pequeño delay para que el socket termine de inicializar
  }

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const motivo = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const debeReconectar = motivo !== DisconnectReason.loggedOut;

      estadoConexion = "conectando";
      yaSolicitoCodigo = false;
      codigoActual = null;

      console.log(
        "Conexión cerrada.",
        debeReconectar ? "Reconectando..." : "Sesión cerrada, borra la carpeta de sesión y vuelve a vincular.",
      );

      if (debeReconectar) iniciarBot();
    } else if (connection === "open") {
      estadoConexion = "conectado";
      codigoActual = null;
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