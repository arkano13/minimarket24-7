// apps/backend/src/lib/whatsapp-session.js
// Utilidades para que los mensajes que manda el bot de WhatsApp se puedan
// descifrar en el teléfono que los recibe (evita el aviso "Esperando
// mensaje. Esto puede tomar tiempo") y para reparar las sesiones de cifrado.
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

// Guarda en memoria los últimos mensajes que el bot envió. Baileys los pide
// (getMessage) cuando el teléfono del destinatario no logra descifrar uno y
// solicita un reenvío: sin este almacén no hay nada que reenviar y el mensaje
// se queda en "Esperando mensaje" para siempre.
export function crearAlmacenMensajes(maximo = 150) {
  const mensajes = new Map();

  return {
    guardar(id, mensaje) {
      if (!id || !mensaje) return;

      if (mensajes.has(id)) mensajes.delete(id);
      mensajes.set(id, mensaje);

      while (mensajes.size > maximo) {
        mensajes.delete(mensajes.keys().next().value);
      }
    },

    obtener(id) {
      return mensajes.get(id);
    },

    get size() {
      return mensajes.size;
    },
  };
}

// Contador de reintentos de mensajes (interfaz CacheStore de Baileys). Evita
// que un mensaje que no se descifra se reintente sin límite.
export function crearCacheReintentos(maximo = 1000) {
  const datos = new Map();

  return {
    get: (clave) => datos.get(clave),

    set: (clave, valor) => {
      datos.delete(clave);
      datos.set(clave, valor);

      while (datos.size > maximo) {
        datos.delete(datos.keys().next().value);
      }
    },

    del: (clave) => {
      datos.delete(clave);
    },

    flushAll: () => {
      datos.clear();
    },
  };
}

const PATRON_SESION_SIGNAL = /^session-.+\.json$/;

// Archivos de sesiones de cifrado (una por dispositivo con el que se habló).
// No incluye creds.json: borrar las sesiones NO desvincula el número.
export async function listarSesionesSignal(carpeta) {
  const archivos = await readdir(carpeta).catch(() => []);

  return archivos.filter((nombre) => PATRON_SESION_SIGNAL.test(nombre));
}

// Borra las sesiones de cifrado para que se negocien de nuevo en el siguiente
// envío. Es el arreglo cuando el teléfono del destinatario ya no puede
// descifrar lo que manda el bot. Devuelve cuántas borró.
export async function borrarSesionesSignal(carpeta) {
  const sesiones = await listarSesionesSignal(carpeta);

  await Promise.all(
    sesiones.map((nombre) => unlink(path.join(carpeta, nombre)).catch(() => {})),
  );

  return sesiones.length;
}