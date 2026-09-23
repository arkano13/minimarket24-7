import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";

// Un único proceso por sesión. Escrituras serializadas y reemplazo atómico:
// un reinicio no deja el archivo principal escrito a medias.
export async function crearAlmacenPersistente(carpeta, { replacer, reviver, maximo = 500 } = {}) {
  await mkdir(carpeta, { recursive: true });
  const file = path.join(carpeta, "mensajes-reenvio.json");
  let entries = [];
  try { entries = JSON.parse(await readFile(file, "utf8"), reviver); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!Array.isArray(entries)) throw new Error("El almacén de reenvíos no es válido.");
  const messages = new Map(entries.slice(-maximo));
  let writing = Promise.resolve();
  return {
    obtener: (id) => messages.get(id),
    get size() { return messages.size; },
    guardar(id, message) {
      if (!id || !message) return Promise.resolve();
      messages.delete(id);
      messages.set(id, message);
      while (messages.size > maximo) messages.delete(messages.keys().next().value);
      const snapshot = JSON.stringify([...messages], replacer);
      writing = writing.catch(() => {}).then(async () => {
        await writeFile(`${file}.tmp`, snapshot, { encoding: "utf8", mode: 0o600 });
        await rename(`${file}.tmp`, file);
      });
      return writing;
    },
  };
}
