import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createWhatsAppAssistantRouter } from "../src/modules/asistente/asistente-whatsapp.routes.js";
import { enviarPorWhatsApp } from "../src/modules/caja/whatsapp-gateway.client.js";
import { createInternalReportRouter } from "../src/modules/caja/informe-interno.routes.js";

test("minimarket procesa y guarda la conversación solicitada por el gateway", async t => {
  const saved = [];
  const router = createWhatsAppAssistantRouter({ secret: "shared",
    loadHistory: async () => [{ role: "assistant", content: "anterior" }],
    saveMessage: async (...args) => saved.push(args),
    answer: async history => { assert.equal(history.at(-1).content, "existencias"); return "Hay 20"; },
  });
  const app = express(); app.use("/interno/whatsapp", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const wrong = await fetch(base + "/interno/whatsapp/responder", { method: "POST",
    headers: { "Content-Type": "application/json", "X-Interno-Secret": "wrong" }, body: "{}" });
  assert.equal(wrong.status, 403);
  const response = await fetch(base + "/interno/whatsapp/responder", { method: "POST",
    headers: { "Content-Type": "application/json", "X-Interno-Secret": "shared" },
    body: JSON.stringify({ conversacionId: "chat-1", texto: "existencias" }) });
  assert.deepEqual(await response.json(), { respuesta: "Hay 20" });
  assert.deepEqual(saved, [["WHATSAPP", "chat-1", "user", "existencias"], ["WHATSAPP", "chat-1", "assistant", "Hay 20"]]);
});

test("cliente de minimarket envía el documento al gateway y exige un ID", async () => {
  let request;
  const result = await enviarPorWhatsApp("50499999999@s.whatsapp.net", {
    document: Buffer.from("pdf"), mimetype: "application/pdf", fileName: "informe.pdf", caption: "Turno C",
  }, { config: { url: "http://gateway:8080", secret: "shared" }, fetchImpl: async (url, options) => {
    request = { url, options }; return { status: 200, json: async () => ({ enviado: true, mensajeId: "abc" }) };
  } });
  assert.deepEqual(result, { key: { id: "abc" } });
  assert.equal(request.url, "http://gateway:8080/interno/enviar");
  assert.deepEqual(JSON.parse(request.options.body), { destinatario: "50499999999@s.whatsapp.net",
    documentoBase64: Buffer.from("pdf").toString("base64"), mimetype: "application/pdf",
    nombreArchivo: "informe.pdf", caption: "Turno C" });
});

test("cliente no acepta una respuesta HTTP sin confirmación", async () => {
  await assert.rejects(enviarPorWhatsApp("jid", { text: "hola" }, {
    config: { url: "http://gateway", secret: "shared" },
    fetchImpl: async () => ({ status: 202, json: async () => ({ enviado: false }) }),
  }), /HTTP 202/);
});

test("la descarga de emergencia ahora vive en minimarket", async t => {
  const app = express();
  app.use("/interno", createInternalReportRouter({ secret: "shared", crearDocumento: async job => {
    assert.equal(job.turnoCajaId, "12");
    return { document: Buffer.from("%PDF-test"), fileName: "informe.pdf" };
  } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + "/interno/informe-turno-pdf?turno=C&fecha=2026-09-22&turnoCajaId=12&clave=wrong")).status, 403);
  const response = await fetch(base + "/interno/informe-turno-pdf?turno=C&fecha=2026-09-22&turnoCajaId=12&clave=shared");
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(await response.text(), "%PDF-test");
});
