function gatewayConfig() {
  const url = process.env.WHATSAPP_BOT_URL || (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT_ID ? "" : "http://127.0.0.1:3002");
  return { url: url.replace(/\/+$/, ""), secret: process.env.INFORME_INTERNO_SECRET };
}

export async function enviarPorWhatsApp(destinatario, contenido, {
  fetchImpl = fetch, config = gatewayConfig(), timeout = 90_000,
} = {}) {
  if (!config.url || !config.secret) throw new Error("Gateway de WhatsApp no configurado.");
  const body = contenido.document
    ? { destinatario, documentoBase64: contenido.document.toString("base64"), mimetype: contenido.mimetype,
        nombreArchivo: contenido.fileName, caption: contenido.caption }
    : { destinatario, texto: contenido.text };
  const response = await fetchImpl(`${config.url}/interno/enviar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Interno-Secret": config.secret },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeout),
  });
  const result = await response.json().catch(() => ({}));
  if (response.status !== 200 || result.enviado !== true || !result.mensajeId) {
    throw new Error(result.error || `Gateway sin confirmación de envío (HTTP ${response.status}).`);
  }
  return { key: { id: result.mensajeId } };
}
