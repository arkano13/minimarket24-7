import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BufferJSON } from "@whiskeysockets/baileys";
import { crearAlmacenPersistente } from "../src/lib/whatsapp-message-store.js";

test("los reenvíos sobreviven reinicios conservando claves binarias de documentos", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wa-store-test-"));
  try {
    const options = { replacer: BufferJSON.replacer, reviver: BufferJSON.reviver, maximo: 2 };
    const store = await crearAlmacenPersistente(dir, options);
    await Promise.all([
      store.guardar("a", { conversation: "primero" }),
      store.guardar("b", { documentMessage: { mediaKey: Buffer.from([1, 2, 3]) } }),
      store.guardar("c", { conversation: "último" }),
    ]);
    const restored = await crearAlmacenPersistente(dir, options);
    assert.equal(restored.size, 2);
    assert.equal(restored.obtener("a"), undefined);
    assert.deepEqual(restored.obtener("b").documentMessage.mediaKey, Buffer.from([1, 2, 3]));
    assert.equal(restored.obtener("c").conversation, "último");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("un archivo corrupto no se sobreescribe como si fuera un almacén vacío", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wa-store-test-"));
  try {
    await writeFile(path.join(dir, "mensajes-reenvio.json"), "{incompleto");
    await assert.rejects(crearAlmacenPersistente(dir), SyntaxError);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
