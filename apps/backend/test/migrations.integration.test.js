import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const migrationsRoot = fileURLToPath(
  new URL("../prisma/migrations", import.meta.url),
);

test("todas las migraciones se aplican en orden sobre PostgreSQL vacío", async () => {
  const directories = (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.ok(directories.length > 0);

  const database = await PGlite.create();

  try {
    for (const directory of directories) {
      const sql = await readFile(
        path.join(migrationsRoot, directory, "migration.sql"),
        "utf8",
      );

      await database.exec(sql);
    }

    const tables = await database.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tableNames = tables.rows.map((row) => row.table_name);

    assert.ok(tableNames.includes("usuarios"));
    assert.ok(tableNames.includes("productos"));
    assert.ok(tableNames.includes("ventas"));
    assert.ok(tableNames.includes("compras"));
    assert.ok(tableNames.includes("devoluciones"));
    assert.ok(tableNames.includes("bitacora"));
    assert.ok(tableNames.includes("informes_pendientes"));
    assert.ok(tableNames.includes("informes_entregas"));

    // El informe no puede existir sin cierre; un rollback revierte ambos.
    await assert.rejects(database.exec(`INSERT INTO informes_pendientes
      (turno_caja_id, turno, fecha, proximo_intento) VALUES (999, 'A', '2026-09-22', now())`), /foreign key/i);
    await database.exec(`INSERT INTO usuarios (id, nombre, usuario, contrasena_hash, rol, actualizado_en)
      VALUES (1, 'Prueba', 'prueba', 'test-only', 'CAJERO', now());
      BEGIN;
      INSERT INTO turnos_caja (id, usuario_apertura_id, fondo_inicial) VALUES (1, 1, 0);
      INSERT INTO informes_pendientes (turno_caja_id, turno, fecha, proximo_intento)
        VALUES (1, 'A', '2026-09-22', now());
      ROLLBACK;`);
    const pending = await database.query('SELECT count(*) AS total FROM informes_pendientes');
    const shifts = await database.query('SELECT count(*) AS total FROM turnos_caja');
    assert.equal(Number(pending.rows[0].total), 0);
    assert.equal(Number(shifts.rows[0].total), 0);
  } finally {
    await database.close();
  }
});
