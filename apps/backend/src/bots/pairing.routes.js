import { Router, json } from "express";
import { fileURLToPath } from "node:url";

export function createPairingRouter({ getState, secret, resetSession = null, now = Date.now, waitMs = 20_000 }) {
  const router = Router();
  // Sin esto req.body llega vacío y /codigo nunca recibe el número.
  router.use(json({ limit: "10kb" }));
  let busy = false;
  let lastRequest = -Infinity;
  let cached = null;
  function describe(state) {
    const conectado = state.status === "conectado";
    const registered = Boolean(state.socket?.authState?.creds?.registered);
    const terminal = ["desvinculado", "reemplazada"].includes(state.status);
    const listo = !terminal && !conectado && !registered && Boolean(state.socket && (state.ready || state.qr) && state.socket.ws?.isOpen !== false);
    let mensaje = "El bot está intentando conectar con WhatsApp. Esta página actualizará el estado.";
    if (conectado) mensaje = "WhatsApp conectado correctamente. No necesitas otro código.";
    else if (state.status === "desvinculado") mensaje = "WhatsApp cerró la sesión. No se resolverá esperando ni pidiendo otro código: pulsa «Empezar sesión nueva» y luego solicita el código.";
    else if (state.status === "reemplazada") mensaje = "Otra conexión reemplazó a este bot. Detén la otra instancia que usa la misma sesión antes de reiniciar este servicio.";
    else if (registered) mensaje = "Hay una sesión guardada y se está reconectando. No se puede generar un código para reemplazarla.";
    else if (listo) mensaje = "Listo para vincular. Puedes solicitar el código.";
    return { conectado, estado: state.status, listo, mensaje, ultimaDesconexion: state.lastDisconnect ?? null, qr: state.qr };
  }
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
    res.json(describe(state));
  });
  // Solo funciona si WhatsApp ya cerró la sesión (401): no hay nada que
  // perder. Aparta la sesión muerta y el bot queda listo para un código nuevo.
  router.post("/nueva-sesion", async (req, res) => {
    if (!resetSession) return res.status(503).json({ error: "Este servicio no permite empezar una sesión nueva desde la página." });
    const state = { ...getState() };
    if (state.status !== "desvinculado") {
      return res.status(409).json({ ...describe(state), error: "Solo se puede empezar una sesión nueva cuando WhatsApp cerró la sesión." });
    }
    try {
      await resetSession();
      cached = null;
      lastRequest = -Infinity;
      res.json({ ...describe({ ...getState() }), mensaje: "Sesión nueva iniciada. Espera unos segundos y solicita el código." });
    } catch (error) {
      console.error("No se pudo empezar una sesión nueva:", error.message);
      res.status(500).json({ error: "No se pudo empezar una sesión nueva. Revisa los logs del asistente." });
    }
  });
  router.post("/codigo", async (req, res) => {
    const phone = typeof req.body?.numero === "string" ? req.body.numero.trim() : "";
    if (!/^[1-9]\d{7,14}$/.test(phone)) return res.status(400).json({ error: "Escribe el número emisor con código de país, solo dígitos. Ejemplo: 504 seguido de los 8 dígitos de Honduras." });
    let state = { ...getState() };
    // Esperar el evento de conexión; el código telefónico no depende de
    // haber terminado de convertir una imagen QR.
    const deadline = Date.now() + waitMs;
    while (!describe(state).listo && !["conectado", "desvinculado", "reemplazada"].includes(state.status) && !state.socket?.authState?.creds?.registered && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (res.destroyed) return;
      state = { ...getState() };
    }
    if (["desvinculado", "reemplazada"].includes(state.status)) return res.status(409).json({ ...describe(state), error: describe(state).mensaje });
    if (state.status === "conectado" || state.socket?.authState.creds.registered) return res.status(409).json({ error: "El bot ya está vinculado. No se reemplazará su sesión desde esta página." });
    if (!describe(state).listo) return res.status(503).json({ ...describe(state), error: "No se pudo establecer la conexión con WhatsApp en 20 segundos. Consulta el estado: allí se muestra el último código de desconexión." });
    // El código forma parte del estado criptográfico hasta completar o cerrar
    // esta conexión. Generar otro sobre el mismo socket invalida el anterior.
    if (cached?.socket === state.socket) {
      if (cached.phone === phone) return res.json({ codigo: cached.code });
      return res.status(409).json({ error: "Ya hay una vinculación pendiente en esta conexión. Usa el código mostrado o reinicia con una sesión nueva." });
    }
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
      cached = { socket: state.socket, phone, code };
      res.json({ codigo: code });
    } catch {
      res.status(502).json({ error: "WhatsApp no pudo generar el código. Espera un minuto e intenta nuevamente." });
    } finally { busy = false; }
  });
  return router;
}