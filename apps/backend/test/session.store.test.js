import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createSession,
  deleteSession,
  deleteUserSessions,
  getSession,
} from "../src/modules/auth/session.store.js";

test("crea tokens impredecibles y recupera la sesión", () => {
  const first = createSession(10);
  const second = createSession(10);

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.deepEqual(getSession(first), { usuarioId: 10 });

  deleteSession(first);
  deleteSession(second);
});

test("elimina una sesión individual", () => {
  const token = createSession(22);

  assert.equal(deleteSession(token), true);
  assert.equal(getSession(token), null);
  assert.equal(deleteSession(token), false);
});

test("invalida todas las sesiones de un usuario excepto la actual", () => {
  const keep = createSession(30);
  const removeOne = createSession(30);
  const removeTwo = createSession(30);
  const otherUser = createSession(31);

  assert.equal(deleteUserSessions(30, keep), 2);
  assert.deepEqual(getSession(keep), { usuarioId: 30 });
  assert.equal(getSession(removeOne), null);
  assert.equal(getSession(removeTwo), null);
  assert.deepEqual(getSession(otherUser), { usuarioId: 31 });

  deleteSession(keep);
  deleteSession(otherUser);
});
