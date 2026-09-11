// apps/backend/src/modules/asistente/asistente.memory.js
import { prisma } from "../../lib/prisma.js";

const MAX_MENSAJES = 10;

export async function cargarHistorial(canal, identificador) {
  const conversacion = await prisma.conversacionAsistente.findUnique({
    where: { canal_identificador: { canal, identificador } },
    include: { mensajes: { orderBy: { creadoEn: "desc" }, take: MAX_MENSAJES } },
  });

  if (!conversacion) return [];

  return conversacion.mensajes
    .slice()
    .reverse()
    .map((m) => ({ role: m.rol, content: m.contenido }));
}

export async function guardarMensaje(canal, identificador, rol, contenido) {
  const conversacion = await prisma.conversacionAsistente.upsert({
    where: { canal_identificador: { canal, identificador } },
    create: { canal, identificador },
    update: {},
  });

  await prisma.mensajeAsistente.create({
    data: { conversacionId: conversacion.id, rol, contenido },
  });
}