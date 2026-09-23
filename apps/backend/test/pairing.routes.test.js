import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { createPairingRouter } from "../src/bots/pairing.routes.js";

async function setup(t, secret = "test-key") {
  let clock = 0;
  let calls = 0;
  const state = { status: "esperando_qr", qr: "data:image/png;base64,test", socket: {
    authState: { creds: { registered: false } },
    requestPairingCode: async (number) => { calls++; assert.equal(number, "50412345678"); return "ABCD1234"; },
  } };
  const app = express();
  app.use(express.json());
  app.use('/pair', createPairingRouter({ getState: () => state, secret, now: () => clock, waitMs: 0 }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/pair`;
  const post = (body = { numero: "50412345678" }, key = "test-key") => fetch(base + '/codigo', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pair-Secret': key }, body: JSON.stringify(body),
  });
  return { base, post, state, calls: () => calls, advance: () => { clock += 61000; } };
}

test('pair protege QR y códigos; no genera códigos sin autorización', async (t) => {
  const s = await setup(t);
  assert.equal((await s.post(undefined, 'incorrecta')).status, 403);
  assert.equal((await fetch(s.base + '/estado')).status, 403);
  assert.equal(s.calls(), 0);
  const page = await fetch(s.base);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  const html = await page.text();
  assert.match(html, /Obtener código/);
  assert.ok(!html.includes('test-key'));
});
test('sin secreto configurado falla cerrado', async (t) => {
  const s = await setup(t, '');
  assert.equal((await s.post()).status, 503);
  assert.equal(s.calls(), 0);
});
test('número internacional y un solo código durante toda la conexión', async (t) => {
  const s = await setup(t);
  assert.equal((await s.post({ numero: '+504 12345678' })).status, 400);
  assert.equal((await s.post({ numero: '123' })).status, 400);
  const response = await s.post();
  assert.deepEqual(await response.json(), { codigo: 'ABCD1234' });
  assert.equal((await s.post()).status, 200);
  assert.equal(s.calls(), 1);
  assert.equal((await s.post({ numero: '50487654321' })).status, 409);
  s.advance();
  assert.equal((await s.post()).status, 200);
  assert.equal(s.calls(), 1);
  s.state.socket = { ...s.state.socket };
  assert.equal((await s.post()).status, 200);
  assert.equal(s.calls(), 2);
});
test('no reemplaza una sesión vinculada ni solicita código antes de estar lista', async (t) => {
  const s = await setup(t);
  s.state.qr = null;
  assert.equal((await s.post()).status, 503);
  s.state.socket.authState.creds.registered = true;
  assert.equal((await s.post()).status, 409);
  assert.equal(s.calls(), 0);
});
test('un cambio de socket descarta el código anterior', async (t) => {
  const s = await setup(t);
  s.state.socket.requestPairingCode = async () => { s.state.socket = null; return 'ABCD1234'; };
  assert.equal((await s.post()).status, 409);
});

test('el código funciona tras el evento connecting aunque no exista imagen QR', async (t) => {
  const s = await setup(t);
  s.state.qr = null;
  s.state.ready = true;
  assert.equal((await s.post()).status, 200);
});

test('desvinculado muestra la causa y no recomienda esperar', async (t) => {
  const s = await setup(t);
  s.state.socket = null;
  s.state.status = 'desvinculado';
  s.state.lastDisconnect = { codigo: 401, fecha: '2026-09-22T12:00:00Z' };
  const response = await s.post();
  assert.equal(response.status, 409);
  const data = await response.json();
  assert.match(data.error, /No se resolverá esperando/);
  assert.equal(data.ultimaDesconexion.codigo, 401);
});
test('errores de WhatsApp no exponen credenciales y se pueden reintentar', async (t) => {
  const s = await setup(t);
  s.state.socket.requestPairingCode = async () => { throw new Error('secret-sensitive'); };
  const response = await s.post();
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('secret-sensitive'));
  s.advance();
  s.state.socket.requestPairingCode = async () => 'ABCD1234';
  assert.equal((await s.post()).status, 200);
});
