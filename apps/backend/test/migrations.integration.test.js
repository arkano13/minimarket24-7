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

  assert.equal(directories.length, 11);

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

    assert.equal(tableNames.length, 24);
    assert.ok(tableNames.includes("usuarios"));
    assert.ok(tableNames.includes("productos"));
    assert.ok(tableNames.includes("ventas"));
    assert.ok(tableNames.includes("compras"));
    assert.ok(tableNames.includes("devoluciones"));
    assert.ok(tableNames.includes("bitacora"));
  } finally {
    await database.close();
  }
});
