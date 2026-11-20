import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://x:x@127.0.0.1:1/x";
const { crearAlmacenSesiones } = await import("../src/modules/auth/session.store.js");

// Base falsa en memoria con la forma de prisma.sesion.
function baseFalsa() {
  const filas = new Map();
  const coincide = (fila, where) =>
    (where.token === undefined || (typeof where.token === "string" ? fila.token === where.token : fila.token !== where.token.not)) &&
    (where.usuarioId === undefined || fila.usuarioId === where.usuarioId);
  return {
    filas,
    sesion: {
      async create({ data }) { filas.set(data.token, { ...data }); return data; },
      async findUnique({ where }) { return filas.get(where.token) ?? null; },
      async deleteMany({ where }) {
        let count = 0;
        for (const [token, fila] of filas) if (coincide(fila, where)) { filas.delete(token); count += 1; }
        return { count };
      },
    },
  };
}

test("crea tokens impredecibles y los guarda en la base", async () => {
  const db = baseFalsa();
  const almacen = crearAlmacenSesiones({ db });
  const first = await almacen.createSession(10);
  const second = await almacen.createSession(10);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.deepEqual(await almacen.getSession(first), { usuarioId: 10 });
  assert.equal(db.filas.size, 2);
});

test("la sesión sobrevive a un reinicio del servidor", async () => {
  const db = baseFalsa();
  const token = await crearAlmacenSesiones({ db }).createSession(7);
  const despuesDelReinicio = crearAlmacenSesiones({ db });
  assert.deepEqual(await despuesDelReinicio.getSession(token), { usuarioId: 7 });
  assert.equal(await despuesDelReinicio.getSession("no-existe"), null);
});

test("elimina una sesión individual", async () => {
  const almacen = crearAlmacenSesiones({ db: baseFalsa() });
  const token = await almacen.createSession(22);
  assert.equal(await almacen.deleteSession(token), true);
  assert.equal(await almacen.getSession(token), null);
  assert.equal(await almacen.deleteSession(token), false);
});

test("invalida todas las sesiones de un usuario excepto la actual", async () => {
  const almacen = crearAlmacenSesiones({ db: baseFalsa() });
  const keep = await almacen.createSession(30);
  const removeOne = await almacen.createSession(30);
  const removeTwo = await almacen.createSession(30);
  const otherUser = await almacen.createSession(31);
  assert.equal(await almacen.deleteUserSessions(30, keep), 2);
  assert.deepEqual(await almacen.getSession(keep), { usuarioId: 30 });
  assert.equal(await almacen.getSession(removeOne), null);
  assert.equal(await almacen.getSession(removeTwo), null);
  assert.deepEqual(await almacen.getSession(otherUser), { usuarioId: 31 });
});
