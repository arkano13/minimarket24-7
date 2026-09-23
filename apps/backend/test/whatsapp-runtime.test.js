import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createWhatsAppConnection } from '../src/bots/whatsapp/connection.js';
import { createSendQueue } from '../src/bots/whatsapp/send-queue.js';
import { createAssistantHandler } from '../src/bots/whatsapp/assistant.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; }
function setup(options = {}) {
  const sockets = [], timers = [], messages = [];
  const connection = createWhatsAppConnection({
    loadAuth: async () => ({ state: { creds: {} }, saveCreds: async () => {} }),
    makeSocket: () => { const s = { ev: new EventEmitter(), end() { this.ended = true; } }; sockets.push(s); return s; },
    toQr: async value => value, onMessage: async message => messages.push(message),
    logger: { log() {}, error() {} },
    reconnectOptions: { schedule(fn) { timers.push(fn); return fn; }, cancel() {} },
    ...options,
  });
  return { connection, sockets, timers, messages };
}
function close(socket, code) {
  socket.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: code } } } });
}

test('401/440 detienen reintentos y conservan diagnóstico', async () => {
  for (const code of [401, 440]) {
    const s = setup(); await s.connection.start(); close(s.sockets[0], code);
    assert.equal(s.connection.getState().status, code === 401 ? 'desvinculado' : 'reemplazada');
    assert.equal(s.connection.getState().lastDisconnect.codigo, code);
    assert.equal(s.timers.length, 0);
    assert.equal(s.sockets[0].ev.listenerCount('creds.update'), 0);
    await s.connection.stop();
  }
});

test('QR tardío no reaparece tras abrir ni cerrar la conexión', async () => {
  for (const state of ['open', 'close']) {
    const qr = deferred(); const s = setup({ toQr: () => qr.promise });
    await s.connection.start();
    s.sockets[0].ev.emit('connection.update', { qr: 'old' });
    s.sockets[0].ev.emit('connection.update', { connection: state });
    qr.resolve('obsolete-image'); await tick();
    assert.equal(s.connection.getState().qr, null);
    await s.connection.stop();
  }
});

test('reconexión espera el guardado de credenciales; stop no hace logout', async () => {
  const saved = deferred(); let loads = 0;
  const s = setup({ loadAuth: async () => { loads++; return { state: { creds: {} }, saveCreds: () => saved.promise }; } });
  await s.connection.start(); s.sockets[0].ev.emit('creds.update', {});
  close(s.sockets[0], 515); assert.equal(s.timers.length, 1);
  s.timers[0](); await tick(); assert.equal(loads, 1);
  saved.resolve(); await tick(); assert.equal(loads, 2);
  close(s.sockets[0], 401); assert.equal(s.connection.getState().status, 'conectando');
  await s.connection.stop(); assert.equal(s.sockets[1].ended, true);
});

test('procesa todo el lote en orden e ignora sincronización histórica', async () => {
  const s = setup(); await s.connection.start();
  s.sockets[0].ev.emit('messages.upsert', { type: 'append', messages: ['old'] });
  s.sockets[0].ev.emit('messages.upsert', { type: 'notify', messages: ['a', 'b'] });
  await tick(); assert.deepEqual(s.messages, ['a', 'b']); await s.connection.stop();
});

test('cola serializa envíos y guarda antes de confirmar; usa el socket actual', async () => {
  const saved = deferred(), calls = [];
  const first = { sendMessage: async () => { calls.push('first'); return { key: { id: '1' }, message: {} }; } };
  const second = { sendMessage: async () => { calls.push('second'); return { key: { id: '2' }, message: {} }; } };
  let socket = first;
  const queue = createSendQueue({ getState: () => ({ socket, status: 'conectado' }), store: { guardar: id => id === '1' ? saved.promise : Promise.resolve() } });
  const a = queue.enviar('jid', {}), b = queue.enviar('jid', {});
  await tick(); assert.deepEqual(calls, ['first']); socket = second;
  saved.resolve(); await Promise.all([a, b]); assert.deepEqual(calls, ['first', 'second']);
  await queue.stop(); await assert.rejects(queue.enviar('jid', {}), /deteniendo/);
});

test('un envío fallido no bloquea la cola ni se repite automáticamente', async () => {
  let count = 0;
  const queue = createSendQueue({ getState: () => ({ status: 'conectado', socket: {
    sendMessage: async () => { if (++count === 1) throw new Error('fallo'); return { key: { id: 'ok' } }; },
  } }), store: {} });
  await assert.rejects(queue.enviar('jid', {}), /fallo/);
  assert.equal((await queue.enviar('jid', {})).key.id, 'ok'); assert.equal(count, 2);
  await queue.stop();
});

test('gateway delega el asistente a minimarket y responde al JID autorizado alternativo', async () => {
  const requests = [], sent = [];
  const handler = createAssistantHandler({ authorized: 'authorized', enviar: async (...args) => sent.push(args),
    backendUrl: 'http://minimarket:3001', secret: 'shared',
    fetchImpl: async (url, options) => { requests.push({ url, options }); return { status: 200, json: async () => ({ respuesta: 'respuesta' }) }; },
  });
  await handler({ key: { remoteJid: 'lid', remoteJidAlt: 'authorized' }, message: { conversation: 'hola' } });
  assert.deepEqual(sent, [['lid', { text: 'respuesta' }]]);
  assert.equal(requests[0].url, 'http://minimarket:3001/interno/whatsapp/responder');
  assert.deepEqual(JSON.parse(requests[0].options.body), { conversacionId: 'lid', texto: 'hola' });
  await handler({ key: { remoteJid: 'lid', fromMe: true }, message: { conversation: 'hola' } });
  assert.equal(sent.length, 1);
});
