import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { createSession } from "./session.store.js";
import { registrarBitacora } from "../bitacora/bitacora.service.js";

export async function login({ usuario, contrasena }) {
  if (
    typeof usuario !== "string" ||
    typeof contrasena !== "string" ||
    !usuario.trim() ||
    !contrasena
  ) {
    throw new AppError(
      "Usuario y contraseña son obligatorios.",
      400,
    );
  }

  const usuarioEncontrado = await prisma.usuario.findUnique({
    where: {
      usuario: usuario.trim().toLowerCase(),
    },
    include: {
      modulos: {
        where: {
          permitido: true,
          modulo: {
            activo: true,
          },
        },
        include: {
          modulo: true,
        },
      },
    },
  });

 if (!usuarioEncontrado || !usuarioEncontrado.activo) {
    await registrarBitacora({
      accion: "LOGIN_FALLIDO",
      entidad: "Usuario",
      detalle: { usuario: usuario.trim().toLowerCase() },
    });

    throw new AppError(
      "Usuario o contraseña incorrectos.",
      401,
    );
  }

  const contrasenaCorrecta = await bcrypt.compare(
    contrasena,
    usuarioEncontrado.contrasenaHash,
  );

  if (!contrasenaCorrecta) {
    await registrarBitacora({
      usuarioId: usuarioEncontrado.id,
      accion: "LOGIN_FALLIDO",
      entidad: "Usuario",
      entidadId: usuarioEncontrado.id,
    });

    throw new AppError(
      "Usuario o contraseña incorrectos.",
      401,
    );
  }

  await prisma.usuario.update({
    where: {
      id: usuarioEncontrado.id,
    },
    data: {
      ultimoAcceso: new Date(),
    },
  });
    await registrarBitacora({
    usuarioId: usuarioEncontrado.id,
    accion: "LOGIN",
    entidad: "Usuario",
    entidadId: usuarioEncontrado.id,
  });

  const token = createSession(usuarioEncontrado.id);

  return {
    token,
    usuario: {
      id: usuarioEncontrado.id,
      nombre: usuarioEncontrado.nombre,
      usuario: usuarioEncontrado.usuario,
      rol: usuarioEncontrado.rol,
      modulos: usuarioEncontrado.modulos.map(({ modulo }) => ({
        codigo: modulo.codigo,
        nombre: modulo.nombre,
        tipo: modulo.tipo,
      })),
    },
  };
}