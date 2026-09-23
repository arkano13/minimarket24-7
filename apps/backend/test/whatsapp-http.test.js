import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createGatewayRouter } from "../src/bots/whatsapp/http.routes.js";

async function setup(t, enviar = async () => ({ key: { id: "msg-1" } })) {
  const app = express();
  const sent = [];
  app.use("/interno", createGatewayRouter({ secret: "test-secret", authDir: ".",
    store: { size: 2 }, getState: () => ({ status: "conectado", lastDisconnect: null }),
    enviar: async (...args) => { sent.push(args); return enviar(...args); } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, secret = "test-secret") => fetch(base + "/interno/enviar", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Interno-Secret": secret }, body: JSON.stringify(body),
  });
  return { base, post, sent };
}

test("gateway autoriza y envía texto sin conocer Prisma ni Gemini", async t => {
  const s = await setup(t);
  assert.equal((await s.post({}, "wrong")).status, 403);
  assert.equal((await s.post({ destinatario: "malo", texto: "hola" })).status, 400);
  const response = await s.post({ destinatario: "50499999999@s.whatsapp.net", texto: "hola" });
  assert.deepEqual(await response.json(), { enviado: true, mensajeId: "msg-1" });
  assert.deepEqual(s.sent[0], ["50499999999@s.whatsapp.net", { text: "hola" }]);
});

test("gateway decodifica documentos y no confirma fallos ambiguos", async t => {
  const s = await setup(t, async () => { throw new Error("socket cerrado"); });
  const response = await s.post({ destinatario: "50499999999@s.whatsapp.net",
    documentoBase64: Buffer.from("pdf").toString("base64"), nombreArchivo: "informe.pdf", mimetype: "application/pdf" });
  assert.equal(response.status, 503);
  assert.equal(s.sent[0][1].document.toString(), "pdf");
});
