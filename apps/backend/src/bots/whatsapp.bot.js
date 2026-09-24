import "dotenv/config";
import express from "express";
import qrcode from "qrcode";
import makeWASocket, {
  useMultiFileAuthState, downloadMediaMessage, BufferJSON, fetchLatestWaWebVersion,
} from "@whiskeysockets/baileys";
import path from "node:path";
import pino from "pino";
import { crearAlmacenPersistente } from "../lib/whatsapp-message-store.js";
import { archivarSesion, crearCacheReintentos } from "../lib/whatsapp-session.js";
import { createPairingRouter } from "./pairing.routes.js";
import { createWhatsAppConnection } from "./whatsapp/connection.js";
import { createSendQueue } from "./whatsapp/send-queue.js";
import { createAssistantHandler } from "./whatsapp/assistant.js";
import { createGatewayRouter } from "./whatsapp/http.routes.js";

const AUTH_DIR = process.env.WHATSAPP_SESSION_DIR || "./whatsapp-session-asistente";
const NUMERO_AUTORIZADO = process.env.WHATSAPP_NUMERO_AUTORIZADO;
const INFORME_INTERNO_SECRET = process.env.INFORME_INTERNO_SECRET;
const MINIMARKET_API_URL = process.env.MINIMARKET_API_URL;

// Nivel de log de Baileys. "warn" muestra los errores de cifrado ("Bad MAC",
// "No session"...) que antes quedaban ocultos. Para ver más: "info" o "debug".
const LOG_LEVEL = process.env.WHATSAPP_LOG_LEVEL || "warn";

if (!NUMERO_AUTORIZADO) throw new Error("Falta WHATSAPP_NUMERO_AUTORIZADO en el .env");
if (!INFORME_INTERNO_SECRET) throw new Error("Falta INFORME_INTERNO_SECRET en el .env");
if (!MINIMARKET_API_URL) throw new Error("Falta MINIMARKET_API_URL en el .env");

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

async function apartarSesionCerrada() {
  const { movidos, destino } = await archivarSesion(AUTH_DIR);
  console.log(`Sesión cerrada por WhatsApp: ${movidos} archivo(s) apartados en ${destino}. Listo para vincular de nuevo.`);
}

// Misma configuración que el HotelBot (que vincula sin problemas):
// Baileys 7, identidad por defecto y la versión REAL de WhatsApp Web.
const connection = createWhatsAppConnection({
  loadAuth: () => useMultiFileAuthState(AUTH_DIR),
  makeSocket: makeWASocket,
  toQr: value => qrcode.toDataURL(value),
  getVersion: async () => {
    // fetchLatestBaileysVersion() y la versión por defecto de Baileys pueden
    // ser viejas: el código se genera pero WhatsApp rechaza el vínculo al
    // final ("No se pudo vincular el dispositivo" / 401).
    const { version } = await fetchLatestWaWebVersion({});
    console.log(`Usando WhatsApp Web versión ${version.join(".")}`);
    return version;
  },
  onLoggedOut: apartarSesionCerrada,
  socketOptions: {
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    logger: pino({ level: LOG_LEVEL }),
    getMessage: async key => mensajesEnviados.obtener(key.id),
    msgRetryCounterCache: cacheReintentos,
  },
  onMessage: message => assistant(message),
});
const queue = createSendQueue({ getState: connection.getState, store: mensajesEnviados });
const assistant = createAssistantHandler({
  authorized: NUMERO_AUTORIZADO, enviar: queue.enviar,
  downloadMediaMessage, backendUrl: MINIMARKET_API_URL, secret: INFORME_INTERNO_SECRET,
});
const app = express();
// /pair y /qr, igual que el HotelBot.
app.use(createPairingRouter({ getState: connection.getState }));
app.use("/interno", createGatewayRouter({
  secret: INFORME_INTERNO_SECRET, authDir: AUTH_DIR, store: mensajesEnviados,
  getState: connection.getState, enviar: queue.enviar,
}));
const server = app.listen(process.env.PORT || 3002, () => {
  console.log(`Vinculación en /pair y /qr (puerto ${process.env.PORT || 3002})`);
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  // Cerrar el transporte, sin logout ni borrar la sesión persistente.
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  try {
    const httpClosed = new Promise(resolve => server.close(resolve));
    await Promise.all([connection.stop(), queue.stop()]);
    await httpClosed;
    clearTimeout(deadline);
    process.exit(0);
  } catch (error) {
    console.error("Error deteniendo WhatsApp:", error.message);
    process.exit(1);
  }
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
void connection.start();