// apps/backend/src/modules/caja/informe-turno-notifier.js
//
// El backend (API) y el bot de WhatsApp corren como procesos separados
// (`npm run start` vs `npm run bot:whatsapp`). Este módulo es el único
// punto de contacto entre los dos: una petición HTTP, disparada 5
// minutos después de cerrar una caja (para dar tiempo a corregir un
// cierre hecho por error antes de que salga el informe), para que el
// bot genere y envíe el informe de turno correspondiente.
//
// Principio importante: esto NUNCA debe afectar el cierre de caja en
// sí. Si el bot está caído, tarda, o responde con error, se registra
// en consola y el cajero sigue su flujo normal — el cierre ya quedó
// guardado en la base de datos antes de llegar aquí.
//
// Limitación conocida: el retraso se hace con setTimeout en memoria del
// proceso del backend. Si el backend se reinicia (deploy/crash) dentro
// de esos 5 minutos, ese envío pendiente se pierde — no hay una cola
// persistente detrás. Para el volumen de un minimarket esto es
// aceptable; si en algún momento importa que nunca se pierda un envío,
// hay que pasar esto a una tabla en la base de datos en vez de un timer.

const BOT_URL = process.env.WHATSAPP_BOT_URL || "http://127.0.0.1:3002";
const SECRET = process.env.INFORME_INTERNO_SECRET;
const RETRASO_ENVIO_MS = 5 * 60 * 1000;

export function notificarCierreDeCaja(turno, fecha) {
  setTimeout(() => {
    enviarAhora(turno, fecha);
  }, RETRASO_ENVIO_MS);
}

async function enviarAhora(turno, fecha) {
  if (!SECRET) {
    console.warn(
      "INFORME_INTERNO_SECRET no está configurado — no se notificó el " +
        "cierre de caja al bot de WhatsApp (el informe no se envió).",
    );

    return;
  }

  try {
    const response = await fetch(`${BOT_URL}/interno/informe-turno`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "X-Interno-Secret": SECRET,
      },

      body: JSON.stringify({ turno, fecha }),

      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error(
        `El bot de WhatsApp respondió ${response.status} al notificar ` +
          `el cierre de caja (turno ${turno}, ${fecha}).`,
      );
    }
  } catch (error) {
    console.error(
      `No se pudo notificar el cierre de caja al bot de WhatsApp ` +
        `(turno ${turno}, ${fecha}):`,
      error.message,
    );
  }
}