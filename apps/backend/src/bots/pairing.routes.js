import { Router } from "express";
import { fileURLToPath } from "node:url";

export function createPairingRouter({ getState, secret, now = Date.now }) {
  const router = Router();
  let busy = false;
  let lastRequest = -Infinity;
  let cached = null;
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  router.get("/", (req, res) => res.sendFile(fileURLToPath(new URL("../../public/pair.html", import.meta.url))));
  router.use((req, res, next) => {
    if (!secret) return res.status(503).json({ error: "Configura QR_PAGE_SECRET en el asistente para habilitar la vinculación." });
    if (req.get("X-Pair-Secret") !== secret) return res.status(403).json({ error: "La clave de vinculación no es correcta." });
    next();
  });
  router.get("/estado", (req, res) => {
    const state = { ...getState() };
    res.json({ conectado: state.status === "conectado", estado: state.status, listo: Boolean(state.socket && state.qr && !state.socket.authState.creds.registered), qr: state.qr });
  });
  router.post("/codigo", async (req, res) => {
    const phone = typeof req.body?.numero === "string" ? req.body.numero.trim() : "";
    if (!/^[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: "Escribe el número emisor con código de país, solo dígitos. Ejemplo: 504 seguido de los 8 dígitos de Honduras." });
    const state = { ...getState() };
    if (state.status === "conectado" || state.socket?.authState.creds.registered) return res.status(409).json({ error: "El bot ya está vinculado. No se reemplazará su sesión desde esta página." });
    if (!state.socket || !state.qr) return res.status(503).json({ error: "La conexión aún no está lista. Espera unos segundos y consulta el estado." });
    if (cached?.socket === state.socket && cached.phone === phone && now() - cached.at < 60_000) return res.json({ codigo: cached.code });
    if (busy || now() - lastRequest < 60_000) {
      res.set("Retry-After", "60");
      return res.status(429).json({ error: "Espera un minuto antes de solicitar otro código." });
    }
    busy = true;
    lastRequest = now();
    cached = null;
    try {
      const code = await state.socket.requestPairingCode(phone);
      if (getState().socket !== state.socket) return res.status(409).json({ error: "La conexión cambió. Consulta el estado y solicita un código nuevo." });
      cached = { socket: state.socket, phone, code, at: now() };
      res.json({ codigo: code });
    } catch {
      res.status(502).json({ error: "WhatsApp no pudo generar el código. Espera un minuto e intenta nuevamente." });
    } finally { busy = false; }
  });
  return router;
}
