import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDisconnect } from '../src/lib/whatsapp-disconnect.js';

test('conserva atributos del rechazo sin exponer datos de sesión', () => {
  const result = describeDisconnect({ code: 401, error: { data: {
    reason: '401', location: 'test-region', token: 'secret', jid: '50412345678@s.whatsapp.net',
  } } });
  assert.deepEqual(result.detalles, { reason: '401', location: 'test-region' });
  assert.equal(result.etapa, 'vinculacion');
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.ok(!JSON.stringify(result).includes('50412345678'));
});

test('soporta nodos stream y distingue conexión abierta de reconexión', () => {
  const error = { data: { attrs: { code: '401', location: 'invalid sensitive value' }, content: Buffer.from('secret') } };
  assert.deepEqual(describeDisconnect({ error, code: 401, registered: true }).detalles, { code: '401' });
  assert.equal(describeDisconnect({ error, registered: true }).etapa, 'reconexion_sesion_guardada');
  assert.equal(describeDisconnect({ error, registered: true, opened: true }).etapa, 'conexion_abierta');
});
