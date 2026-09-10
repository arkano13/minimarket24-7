// apps/backend/src/bots/telegram.bot.js
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { handleMessage } from "../modules/asistente/asistente.service.js";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
console.log("Bot de Telegram del asistente corriendo...");

// Historial simple en memoria por chat — se pierde al reiniciar.
// Si más adelante quieres persistirlo, se agrega una tabla Conversation/Message
// igual que en AsistenteIA, pero no es necesario para arrancar.
const historialPorChat = new Map();

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (String(chatId) !== String(process.env.TELEGRAM_CHAT_ID)) {
    console.warn(`Mensaje ignorado de chat no autorizado: ${chatId}`);
    return;
  }

  if (!msg.text) return;

  try {
    const historial = historialPorChat.get(chatId) ?? [];
    historial.push({ role: "user", content: msg.text });

    const respuesta = await handleMessage(historial);
    historial.push({ role: "assistant", content: respuesta });

    historialPorChat.set(chatId, historial.slice(-20)); // limitar memoria
    await bot.sendMessage(chatId, respuesta);
  } catch (err) {
    console.error("Error en bot de asistente:", err);
    await bot.sendMessage(chatId, "Tuve un problema procesando tu consulta.");
  }
});