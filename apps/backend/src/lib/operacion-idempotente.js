import { AppError } from "../utils/AppError.js";

export function claveOperacion(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new AppError("La clave de la operación no es válida.", 400);
  }

  const key = value.trim();

  if (!key || key.length > 64) {
    throw new AppError("La clave de la operación no es válida.", 400);
  }

  return key;
}

function whereFor(userId, type, key) {
  return {
    usuarioId_tipo_clave: {
      usuarioId: userId,
      tipo: type,
      clave: key,
    },
  };
}

export async function buscarResultadoOperacion(client, userId, type, key) {
  if (!key) {
    return { encontrado: false, resultado: null };
  }

  const operation = await client.operacionIdempotente.findUnique({
    where: whereFor(userId, type, key),
    select: { respuesta: true },
  });

  return operation
    ? { encontrado: true, resultado: operation.respuesta }
    : { encontrado: false, resultado: null };
}

export async function reservarOperacion(transaction, userId, type, key) {
  if (!key) {
    return null;
  }

  return transaction.operacionIdempotente.create({
    data: {
      usuarioId: userId,
      tipo: type,
      clave: key,
      respuesta: {},
    },
    select: { id: true },
  });
}

export async function completarOperacion(transaction, operation, result) {
  if (!operation) {
    return;
  }

  await transaction.operacionIdempotente.update({
    where: { id: operation.id },
    // Prisma Json solo admite valores JSON puros. Esto convierte Date a su
    // ISO y elimina propiedades undefined, igual que la respuesta HTTP.
    data: { respuesta: JSON.parse(JSON.stringify(result)) },
  });
}

export function esConflictoIdempotente(error) {
  return error?.code === "P2002";
}
