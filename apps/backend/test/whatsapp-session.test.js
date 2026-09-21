import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  borrarSesionesSignal,
  crearAlmacenMensajes,
  crearCacheReintentos,
  listarSesionesSignal,
} from "../src/lib/whatsapp-session.js";

test("el almacén devuelve los mensajes enviados y descarta los más viejos", () => {
  const almacen = crearAlmacenMensajes(2);

  almacen.guardar("a", { conversation: "uno" });
  almacen.guardar("b", { conversation: "dos" });
  almacen.guardar("c", { conversation: "tres" });

  assert.equal(almacen.size, 2);
  assert.equal(almacen.obtener("a"), undefined);
  assert.deepEqual(almacen.obtener("c"), { conversation: "tres" });
});

test("el almacén ignora entradas sin id o sin mensaje", () => {
  const almacen = crearAlmacenMensajes(5);

  almacen.guardar(undefined, { conversation: "x" });
  almacen.guardar("a", undefined);

  assert.equal(almacen.size, 0);
});

test("el caché de reintentos cumple la interfaz que usa Baileys", () => {
  const cache = crearCacheReintentos(2);

  cache.set("k1", 1);
  cache.set("k2", 2);
  cache.set("k3", 3);

  assert.equal(cache.get("k1"), undefined);
  assert.equal(cache.get("k3"), 3);

  cache.del("k3");
  assert.equal(cache.get("k3"), undefined);

  cache.flushAll();
  assert.equal(cache.get("k2"), undefined);
});

test("borrar sesiones elimina solo los archivos session-* y conserva creds", async () => {
  const carpeta = await mkdtemp(path.join(os.tmpdir(), "wa-sesion-"));

  try {
    await writeFile(path.join(carpeta, "creds.json"), "{}");
    await writeFile(path.join(carpeta, "session-50499999999.0.json"), "{}");
    await writeFile(path.join(carpeta, "session-50499999999_1.0.json"), "{}");
    await writeFile(path.join(carpeta, "pre-key-1.json"), "{}");
    await writeFile(path.join(carpeta, "app-state-sync-key-AAA.json"), "{}");

    assert.equal((await listarSesionesSignal(carpeta)).length, 2);
    assert.equal(await borrarSesionesSignal(carpeta), 2);

    const restantes = (await readdir(carpeta)).sort();
    assert.deepEqual(restantes, ["app-state-sync-key-AAA.json", "creds.json", "pre-key-1.json"]);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
});

test("borrar sesiones en una carpeta inexistente devuelve 0", async () => {
  assert.equal(await borrarSesionesSignal(path.join(os.tmpdir(), "no-existe-wa-xyz")), 0);
});