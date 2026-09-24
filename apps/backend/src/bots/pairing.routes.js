import { Router } from "express";

// Vinculación de WhatsApp igual que en el HotelBot:
//   GET /pair               -> formulario para escribir el número
//   GET /pair?telefono=504… -> muestra el código de vinculación
//   GET /qr                 -> QR para escanear (se refresca solo)
// Sin clave, igual que el HotelBot.

function pagina(contenido, refrescarSegundos = null) {
  const refresh = refrescarSegundos ? `<meta http-equiv="refresh" content="${refrescarSegundos}">` : "";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="referrer" content="no-referrer">
    ${refresh}
    <title>Vincular WhatsApp · Minimarket</title>
  </head>
  <body style="font-family: sans-serif; text-align: center; padding: 40px;">
    ${contenido}
  </body>
</html>`;
}

export async function solicitarCodigoVinculacion(getState, telefono) {
  const { socket, status } = getState();

  if (status === "conectado") {
    throw new Error("WhatsApp ya está conectado. No necesitas otro código.");
  }

  if (!socket) {
    throw new Error("El cliente de WhatsApp no está listo todavía. Espera unos segundos e intenta de nuevo.");
  }

  const numeroLimpio = String(telefono ?? "").replace(/\D/g, "");

  if (!numeroLimpio) {
    throw new Error("Manda el número en formato internacional, sin +, ej: 50499999999");
  }

  return socket.requestPairingCode(numeroLimpio);
}

export function createPairingRouter({ getState }) {
  const router = Router();

  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  router.get("/qr", (req, res) => {
    const { qr, status } = getState();

    if (status === "conectado") {
      return res.send(pagina(`
        <h2>WhatsApp ya está conectado</h2>
        <p>No necesitas escanear nada.</p>
      `));
    }

    if (!qr) {
      return res.send(pagina(`
        <h2>No hay código QR disponible en este momento</h2>
        <p>Esto pasa si WhatsApp ya está conectado, o si el servidor apenas está arrancando.
        Esta página se recarga sola cada 5 segundos.</p>
      `, 5));
    }

    // state.qr ya viene como imagen (data URL) desde whatsapp.bot.js.
    res.send(pagina(`
      <h2>Escanea este código con WhatsApp</h2>
      <p>Configuración → Dispositivos vinculados → Vincular un dispositivo</p>
      <img src="${qr}" width="320" height="320" alt="QR de WhatsApp" />
      <p style="color: #888; font-size: 13px;">El código vence cada 20-30 segundos — esta página se refresca sola cada 15 segundos para que siempre veas uno vigente. Escanéalo apenas la veas, no la dejes abierta esperando.</p>
    `, 15));
  });

  router.get("/pair", async (req, res) => {
    const telefono = String(req.query.telefono ?? "").replace(/\D/g, "");

    if (!telefono) {
      return res.send(pagina(`
        <h2>Vincular por código</h2>
        <p>Escribe el número de WhatsApp que va a usar el bot, en formato internacional, sin "+" ni espacios.</p>
        <form method="get" action="/pair">
          <input name="telefono" inputmode="numeric" placeholder="50499999999" style="font-size: 18px; padding: 8px; width: 220px;" />
          <button type="submit" style="font-size: 18px; padding: 8px 16px;">Pedir código</button>
        </form>
        <p style="margin-top: 24px;"><a href="/qr">O vincular con QR</a></p>
      `));
    }

    try {
      const codigo = await solicitarCodigoVinculacion(getState, telefono);

      res.send(pagina(`
        <h2>Tu código de vinculación</h2>
        <p style="font-size: 42px; font-weight: bold; letter-spacing: 4px; color: #2563eb;">${codigo}</p>
        <p>En el celular con el número <strong>${telefono}</strong>: abre WhatsApp → Configuración → Dispositivos vinculados → Vincular un dispositivo → "Vincular con número de teléfono en su lugar", y escribe este código.</p>
        <p style="color: #888; font-size: 13px;">Este código vence en unos minutos — si tarda demasiado, recarga esta misma página para pedir uno nuevo.</p>
      `));
    } catch (error) {
      const mensaje = String(error?.message ?? "No se pudo generar el código.")
        .replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);

      res.status(500).send(pagina(`
        <h2>Error</h2>
        <p>${mensaje}</p>
        <p><a href="/pair">Volver a intentar</a></p>
      `));
    }
  });

  return router;
}