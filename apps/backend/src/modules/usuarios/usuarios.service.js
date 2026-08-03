import bcrypt from "bcryptjs";

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { deleteUserSessions } from "../auth/session.store.js";
import { registrarBitacora } from "../bitacora/bitacora.service.js";

const ROLES_VALIDOS = [
  "ADMINISTRADOR",
  "SUPERVISOR",
  "CAJERO",
  "BODEGA",
];

const USUARIO_INCLUDE = {
  modulos: {
    include: {
      modulo: {
        select: {
          codigo: true,
          nombre: true,
          tipo: true,
          activo: true,
        },
      },
    },
    orderBy: {
      moduloCodigo: "asc",
    },
  },
};

function parseUsuarioId(value) {
  const usuarioId = Number(value);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    throw new AppError("El usuario indicado no es válido.", 400);
  }

  return usuarioId;
}

function normalizarNombre(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizarUsuario(value) {
  return String(value ?? "").trim().toLowerCase();
}

function validarNombre(nombre) {
  if (!nombre) {
    throw new AppError("Escribe el nombre completo.", 400);
  }

  if (nombre.length > 120) {
    throw new AppError(
      "El nombre no puede superar los 120 caracteres.",
      400,
    );
  }
}

function validarNombreUsuario(usuario) {
  if (!usuario) {
    throw new AppError("Escribe el nombre de usuario.", 400);
  }

  if (usuario.length < 3 || usuario.length > 50) {
    throw new AppError(
      "El usuario debe tener entre 3 y 50 caracteres.",
      400,
    );
  }

  if (!/^[a-z0-9._-]+$/.test(usuario)) {
    throw new AppError(
      "El usuario solo puede contener letras, números, punto, guion y guion bajo.",
      400,
    );
  }
}

function validarRol(rol) {
  if (!ROLES_VALIDOS.includes(rol)) {
    throw new AppError("Selecciona un rol válido.", 400);
  }
}

function validarContrasena(contrasena) {
  if (typeof contrasena !== "string" || contrasena.length < 8) {
    throw new AppError(
      "La contraseña debe tener al menos 8 caracteres.",
      400,
    );
  }

  if (contrasena.length > 72) {
    throw new AppError(
      "La contraseña no puede superar los 72 caracteres.",
      400,
    );
  }
}

function formatearUsuario(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    usuario: usuario.usuario,
    rol: usuario.rol,
    activo: usuario.activo,
    ultimoAcceso: usuario.ultimoAcceso,
    creadoEn: usuario.creadoEn,
    actualizadoEn: usuario.actualizadoEn,
    modulos: usuario.modulos
      .filter((acceso) => acceso.permitido && acceso.modulo.activo)
      .map((acceso) => ({
        codigo: acceso.modulo.codigo,
        nombre: acceso.modulo.nombre,
        tipo: acceso.modulo.tipo,
      })),
  };
}

async function resolverModulos(
  client,
  rol,
  modulosSolicitados = [],
) {
  const modulosActivos = await client.modulo.findMany({
    where: {
      activo: true,
    },
    select: {
      codigo: true,
    },
    orderBy: {
      nombre: "asc",
    },
  });

  const codigosActivos = modulosActivos.map(
    (modulo) => modulo.codigo,
  );

  /*
   * Los administradores reciben todos los módulos activos.
   * Así evitamos crear un administrador que no pueda entrar
   * al módulo de usuarios o configuraciones.
   */
  if (rol === "ADMINISTRADOR") {
    return codigosActivos;
  }

  if (!Array.isArray(modulosSolicitados)) {
    throw new AppError(
      "La lista de módulos no es válida.",
      400,
    );
  }

  const codigosSolicitados = [
    ...new Set(
      modulosSolicitados
        .map((codigo) => String(codigo).trim().toUpperCase())
        .filter(Boolean),
    ),
  ];

  if (codigosSolicitados.length === 0) {
    throw new AppError(
      "Selecciona al menos un módulo para el usuario.",
      400,
    );
  }

  const codigosInvalidos = codigosSolicitados.filter(
    (codigo) => !codigosActivos.includes(codigo),
  );

  if (codigosInvalidos.length > 0) {
    throw new AppError(
      `Hay módulos no válidos: ${codigosInvalidos.join(", ")}.`,
      400,
    );
  }

  return codigosSolicitados;
}

async function comprobarUltimoAdministrador(
  client,
  usuarioActual,
  nuevoRol,
  nuevoEstado,
) {
  const dejaraDeSerAdministrador =
    usuarioActual.rol === "ADMINISTRADOR" &&
    usuarioActual.activo &&
    (nuevoRol !== "ADMINISTRADOR" || nuevoEstado === false);

  if (!dejaraDeSerAdministrador) {
    return;
  }

  const administradoresActivos = await client.usuario.count({
    where: {
      rol: "ADMINISTRADOR",
      activo: true,
    },
  });

  if (administradoresActivos <= 1) {
    throw new AppError(
      "No puedes desactivar o cambiar el rol del último administrador activo.",
      400,
    );
  }
}

function manejarErrorPrisma(error) {
  if (error?.code === "P2002") {
    throw new AppError(
      "Ese nombre de usuario ya está siendo utilizado.",
      409,
    );
  }

  throw error;
}

export async function listModules() {
  return prisma.modulo.findMany({
    where: {
      activo: true,
    },
    select: {
      codigo: true,
      nombre: true,
      tipo: true,
    },
    orderBy: [
      {
        tipo: "asc",
      },
      {
        nombre: "asc",
      },
    ],
  });
}

export async function listUsers() {
  const usuarios = await prisma.usuario.findMany({
    include: USUARIO_INCLUDE,
    orderBy: [
      {
        activo: "desc",
      },
      {
        nombre: "asc",
      },
    ],
  });

  return usuarios.map(formatearUsuario);
}

export async function createUser(payload = {}, creadoPorId = null) {
  const nombre = normalizarNombre(payload.nombre);
  const usuario = normalizarUsuario(payload.usuario);
  const contrasena = String(payload.contrasena ?? "");
  const rol = String(payload.rol ?? "").trim().toUpperCase();

  validarNombre(nombre);
  validarNombreUsuario(usuario);
  validarContrasena(contrasena);
  validarRol(rol);

  const contrasenaHash = await bcrypt.hash(contrasena, 12);

  try {
    const usuarioCreado = await prisma.$transaction(
      async (transaction) => {
        const modulos = await resolverModulos(
          transaction,
          rol,
          payload.modulos,
        );

        return transaction.usuario.create({
          data: {
            nombre,
            usuario,
            contrasenaHash,
            rol,
            activo: true,
            modulos: {
              create: modulos.map((moduloCodigo) => ({
                moduloCodigo,
                permitido: true,
              })),
            },
          },
          include: USUARIO_INCLUDE,
        });
      },
    );

    await registrarBitacora({
      usuarioId: creadoPorId,
      accion: "CREAR_USUARIO",
      entidad: "Usuario",
      entidadId: usuarioCreado.id,
      detalle: {
        usuario: usuarioCreado.usuario,
        rol: usuarioCreado.rol,
      },
    });

    return formatearUsuario(usuarioCreado);
  } catch (error) {
    manejarErrorPrisma(error);
  }
}

export async function updateUser(
  usuarioIdValue,
  payload = {},
  actorUsuarioIdValue,
  actorToken,
) {
  const usuarioId = parseUsuarioId(usuarioIdValue);
  const actorUsuarioId = parseUsuarioId(actorUsuarioIdValue);

  const nombre = normalizarNombre(payload.nombre);
  const usuario = normalizarUsuario(payload.usuario);
  const rol = String(payload.rol ?? "").trim().toUpperCase();

  validarNombre(nombre);
  validarNombreUsuario(usuario);
  validarRol(rol);

  try {
    const usuarioActualizado = await prisma.$transaction(
      async (transaction) => {
        const usuarioActual =
          await transaction.usuario.findUnique({
            where: {
              id: usuarioId,
            },
            select: {
              id: true,
              rol: true,
              activo: true,
            },
          });

        if (!usuarioActual) {
          throw new AppError("Usuario no encontrado.", 404);
        }

        if (
          usuarioId === actorUsuarioId &&
          usuarioActual.rol !== rol
        ) {
          throw new AppError(
            "No puedes cambiar tu propio rol.",
            400,
          );
        }

        await comprobarUltimoAdministrador(
          transaction,
          usuarioActual,
          rol,
          usuarioActual.activo,
        );

        const modulos = await resolverModulos(
          transaction,
          rol,
          payload.modulos,
        );

        await transaction.usuarioModulo.deleteMany({
          where: {
            usuarioId,
          },
        });

        await transaction.usuario.update({
          where: {
            id: usuarioId,
          },
          data: {
            nombre,
            usuario,
            rol,
          },
        });

        await transaction.usuarioModulo.createMany({
          data: modulos.map((moduloCodigo) => ({
            usuarioId,
            moduloCodigo,
            permitido: true,
          })),
        });

        return transaction.usuario.findUnique({
          where: {
            id: usuarioId,
          },
          include: USUARIO_INCLUDE,
        });
      },
    );

    deleteUserSessions(
      usuarioId,
      usuarioId === actorUsuarioId ? actorToken : null,
    );

    await registrarBitacora({
      usuarioId: actorUsuarioId,
      accion: "EDITAR_USUARIO",
      entidad: "Usuario",
      entidadId: usuarioId,
      detalle: { nombre, usuario, rol },
    });

    return formatearUsuario(usuarioActualizado);
  } catch (error) {
    manejarErrorPrisma(error);
  }
}

export async function setUserActive(
  usuarioIdValue,
  activoValue,
  actorUsuarioIdValue,
) {
  const usuarioId = parseUsuarioId(usuarioIdValue);
  const actorUsuarioId = parseUsuarioId(actorUsuarioIdValue);

  if (typeof activoValue !== "boolean") {
    throw new AppError(
      "El estado del usuario no es válido.",
      400,
    );
  }

  if (usuarioId === actorUsuarioId && activoValue === false) {
    throw new AppError(
      "No puedes desactivar tu propia cuenta.",
      400,
    );
  }

  const usuarioActualizado = await prisma.$transaction(
    async (transaction) => {
      const usuarioActual =
        await transaction.usuario.findUnique({
          where: {
            id: usuarioId,
          },
          select: {
            id: true,
            rol: true,
            activo: true,
          },
        });

      if (!usuarioActual) {
        throw new AppError("Usuario no encontrado.", 404);
      }

      await comprobarUltimoAdministrador(
        transaction,
        usuarioActual,
        usuarioActual.rol,
        activoValue,
      );

      return transaction.usuario.update({
        where: {
          id: usuarioId,
        },
        data: {
          activo: activoValue,
        },
        include: USUARIO_INCLUDE,
      });
    },
  );

  if (!activoValue) {
    deleteUserSessions(usuarioId);
  }

  await registrarBitacora({
    usuarioId: actorUsuarioId,
    accion: activoValue ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO",
    entidad: "Usuario",
    entidadId: usuarioId,
  });

  return formatearUsuario(usuarioActualizado);
}

export async function resetUserPassword(
  usuarioIdValue,
  contrasenaValue,
  actorUsuarioIdValue,
  actorToken,
) {
  const usuarioId = parseUsuarioId(usuarioIdValue);
  const actorUsuarioId = parseUsuarioId(actorUsuarioIdValue);
  const contrasena = String(contrasenaValue ?? "");

  validarContrasena(contrasena);

  const usuarioExiste = await prisma.usuario.findUnique({
    where: {
      id: usuarioId,
    },
    select: {
      id: true,
    },
  });

  if (!usuarioExiste) {
    throw new AppError("Usuario no encontrado.", 404);
  }

  const contrasenaHash = await bcrypt.hash(contrasena, 12);

  await prisma.usuario.update({
    where: {
      id: usuarioId,
    },
    data: {
      contrasenaHash,
    },
  });

  deleteUserSessions(
    usuarioId,
    usuarioId === actorUsuarioId ? actorToken : null,
  );

  await registrarBitacora({
    usuarioId: actorUsuarioId,
    accion: "RESET_CONTRASENA",
    entidad: "Usuario",
    entidadId: usuarioId,
  });

  return {
    mensaje: "Contraseña actualizada correctamente.",
  };
}