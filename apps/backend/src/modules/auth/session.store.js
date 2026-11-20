import { randomBytes } from "node:crypto";

import { prisma } from "../../lib/prisma.js";

// Las sesiones se guardan en la tabla "sesiones" para que sobrevivan a los
// reinicios del servidor (cada publicación en Railway reinicia el backend y,
// cuando vivían solo en memoria, sacaba a todas las cajas). La memoria es un
// caché para no consultar la base en cada petición.
export function crearAlmacenSesiones({ db = prisma } = {}) {
  const cache = new Map();

  return {
    async createSession(usuarioId) {
      const token = randomBytes(32).toString("hex");
      await db.sesion.create({ data: { token, usuarioId } });
      cache.set(token, { usuarioId });
      return token;
    },

    async getSession(token) {
      if (typeof token !== "string" || !token) return null;
      if (cache.has(token)) return cache.get(token);

      const fila = await db.sesion.findUnique({
        where: { token },
        select: { usuarioId: true },
      });
      if (!fila) return null;

      const session = { usuarioId: fila.usuarioId };
      cache.set(token, session);
      return session;
    },

    async deleteSession(token) {
      cache.delete(token);
      const { count } = await db.sesion.deleteMany({ where: { token } });
      return count > 0;
    },

    async deleteUserSessions(usuarioId, exceptToken = null) {
      for (const [token, session] of cache.entries()) {
        if (session.usuarioId === usuarioId && token !== exceptToken) cache.delete(token);
      }
      const { count } = await db.sesion.deleteMany({
        where: { usuarioId, ...(exceptToken ? { token: { not: exceptToken } } : {}) },
      });
      return count;
    },
  };
}

const almacen = crearAlmacenSesiones();

export const createSession = (...args) => almacen.createSession(...args);
export const getSession = (...args) => almacen.getSession(...args);
export const deleteSession = (...args) => almacen.deleteSession(...args);
export const deleteUserSessions = (...args) => almacen.deleteUserSessions(...args);
