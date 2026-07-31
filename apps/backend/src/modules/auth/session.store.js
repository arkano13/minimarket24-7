import { randomBytes } from "node:crypto";

const sessions = new Map();

export function createSession(usuarioId) {
  const token = randomBytes(32).toString("hex");

  sessions.set(token, {
    usuarioId,
  });

  return token;
}

export function getSession(token) {
  return sessions.get(token) ?? null;
}

export function deleteSession(token) {
  return sessions.delete(token);
}