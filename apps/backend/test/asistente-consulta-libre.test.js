import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://x:x@127.0.0.1:1/x";
const { validarConsulta, consultaLibre } = await import("../src/modules/asistente/consulta-libre.js");

test("el asistente puede leer cualquier tabla con SELECT o WITH", () => {
  assert.equal(validarConsulta("select * from productos;"), "select * from productos");
  validarConsulta("with x as (select 1) select * from x");
  validarConsulta("select * from productos where nombre = 'update'");
});

test("el asistente no puede escribir ni leer contraseñas", () => {
  const rechazadas = [
    "insert into productos values (1)",
    "update productos set nombre = 'x'",
    "select 1; delete from productos",
    "with d as (delete from categorias returning *) select * from d",
    "select * into copia from productos",
    "select contrasena_hash from usuarios",
    "select * from sesiones",
    "select pg_sleep(10)",
    "select pg_read_file('/etc/passwd')",
  ];
  for (const sql of rechazadas) assert.throws(() => validarConsulta(sql), Error, sql);
});

test("la consulta corre en transacción de solo lectura y limita filas", async () => {
  const sentencias = [];
  const tx = {
    $executeRawUnsafe: async (s) => sentencias.push(s),
    $queryRawUnsafe: async (s) => {
      sentencias.push(s);
      return Array.from({ length: 250 }, (_, i) => ({ id: BigInt(i), total: { toNumber: () => 1.5 } }));
    },
  };
  const r = await consultaLibre("select id, total from ventas", { db: { $transaction: (fn) => fn(tx) } });
  assert.equal(sentencias[0], "SET TRANSACTION READ ONLY");
  assert.match(sentencias[2], /LIMIT 201$/);
  assert.equal(r.total, 200);
  assert.deepEqual(r.filas[3], { id: 3, total: 1.5 });
  assert.ok(r.aviso);
});
