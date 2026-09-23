export function createAssistantHandler({
  authorized, enviar, downloadMediaMessage,
  backendUrl = process.env.MINIMARKET_API_URL,
  secret = process.env.INFORME_INTERNO_SECRET,
  fetchImpl = fetch,
}) {
  return async function handleIncoming(msg) {
    if (!msg?.message || msg.key.fromMe || msg.key.remoteJid === "status@broadcast" || msg.key.remoteJid?.endsWith("@g.us")) return;
    const remitente = msg.key.remoteJid;
    const numeroReal = msg.key.remoteJidAlt || msg.key.senderPn || remitente;
    if (numeroReal !== authorized) {
      console.warn(`Mensaje ignorado de número no autorizado: ${numeroReal}`);
      return;
    }
    if (!backendUrl || !secret) throw new Error("Falta MINIMARKET_API_URL o INFORME_INTERNO_SECRET.");

    const body = { conversacionId: remitente };
    body.texto = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    if (!body.texto && msg.message.audioMessage) {
      const audio = await downloadMediaMessage(msg, "buffer", {});
      body.audio = { base64: audio.toString("base64"), mimeType: msg.message.audioMessage.mimetype || "audio/ogg" };
    }
    if (!body.texto && !body.audio) return;
    try {
      const response = await fetchImpl(`${backendUrl.replace(/\/+$/, "")}/interno/whatsapp/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Interno-Secret": secret },
        body: JSON.stringify(body), signal: AbortSignal.timeout(90_000),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status !== 200 || typeof result.respuesta !== "string") {
        throw new Error(result.error || `Minimarket respondió HTTP ${response.status}.`);
      }
      await enviar(remitente, { text: result.respuesta });
    } catch (error) {
      console.error("No se pudo procesar la consulta en minimarket:", error.message);
      await enviar(remitente, { text: "Tuve un problema procesando tu consulta." });
    }
  };
}
