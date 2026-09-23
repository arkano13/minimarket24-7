import { Router, json } from "express";
import { listarSesionesSignal } from "../../lib/whatsapp-session.js";

export function createGatewayRouter({ secret, authDir, store, getState, enviar }) {
  const router = Router();
  router.use(json({ limit: "20mb" }));
  router.use((req, res, next) => {
    if (!secret || req.get("X-Interno-Secret") !== secret) return res.status(403).json({ error: "No autorizado." });
    next();
  });
  router.get("/estado", async (_req, res) => {
    const state = getState();
    res.json({ conexion: state.status, ultimaDesconexion: state.lastDisconnect,
      sesionesDeCifrado: (await listarSesionesSignal(authDir)).length,
      mensajesGuardadosParaReenvio: store.size });
  });
  router.post("/enviar", async (req, res) => {
    const { destinatario, texto, documentoBase64, mimetype, nombreArchivo, caption } = req.body ?? {};
    if (typeof destinatario !== "string" || !/^\d{7,15}@s\.whatsapp\.net$/.test(destinatario)) {
      return res.status(400).json({ error: "Destinatario inválido." });
    }
    let contenido;
    if (typeof texto === "string" && texto.length > 0 && texto.length <= 10_000) contenido = { text: texto };
    else if (typeof documentoBase64 === "string" && documentoBase64.length <= 20_000_000 && typeof nombreArchivo === "string" && nombreArchivo.length <= 180) {
      contenido = { document: Buffer.from(documentoBase64, "base64"),
        mimetype: typeof mimetype === "string" ? mimetype : "application/pdf", fileName: nombreArchivo,
        caption: typeof caption === "string" ? caption.slice(0, 1024) : undefined };
    } else return res.status(400).json({ error: "Contenido inválido." });
    try {
      const enviado = await enviar(destinatario, contenido);
      if (!enviado?.key?.id) throw new Error("WhatsApp no confirmó el mensaje.");
      res.json({ enviado: true, mensajeId: enviado.key.id });
    } catch (error) {
      console.error("Gateway no pudo enviar:", error.message);
      res.status(503).json({ error: "WhatsApp no confirmó el envío." });
    }
  });
  router.post("/reset-sesiones", (_req, res) => res.status(409).json({ error: "El borrado de sesiones en caliente está deshabilitado." }));
  return router;
}
