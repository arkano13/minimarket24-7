import { Router, json } from "express";
import { handleMessage, transcribirAudio } from "./asistente.service.js";
import { cargarHistorial, guardarMensaje } from "./asistente.memory.js";

export function createWhatsAppAssistantRouter({
  secret = process.env.INFORME_INTERNO_SECRET,
  loadHistory = cargarHistorial,
  saveMessage = guardarMensaje,
  answer = handleMessage,
  transcribe = transcribirAudio,
} = {}) {
  const router = Router();
  router.use(json({ limit: "12mb" }));
  router.use((req, res, next) => {
    if (!secret || req.get("X-Interno-Secret") !== secret) {
      return res.status(403).json({ error: "No autorizado." });
    }
    next();
  });
  router.post("/responder", async (req, res, next) => {
    try {
      const { conversacionId, texto, audio } = req.body ?? {};
      if (typeof conversacionId !== "string" || !conversacionId || conversacionId.length > 160) {
        return res.status(400).json({ error: "conversacionId inválido." });
      }
      let contenido = typeof texto === "string" ? texto.trim() : "";
      if (!contenido && audio) {
        if (typeof audio.base64 !== "string" || audio.base64.length > 14_000_000) {
          return res.status(400).json({ error: "Audio inválido o demasiado grande." });
        }
        contenido = await transcribe(audio.base64, audio.mimeType || "audio/ogg");
      }
      if (!contenido) return res.status(422).json({ error: "No se pudo obtener texto del mensaje." });

      const historial = await loadHistory("WHATSAPP", conversacionId);
      historial.push({ role: "user", content: contenido });
      await saveMessage("WHATSAPP", conversacionId, "user", contenido);
      const respuesta = await answer(historial);
      await saveMessage("WHATSAPP", conversacionId, "assistant", respuesta);
      res.json({ respuesta });
    } catch (error) { next(error); }
  });
  return router;
}

export const whatsappAssistantRouter = createWhatsAppAssistantRouter();
