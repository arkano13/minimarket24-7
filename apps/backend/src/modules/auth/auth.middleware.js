import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { getSession } from "./session.store.js";

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (
      typeof authorization !== "string" ||
      !authorization.startsWith("Bearer ")
    ) {
      throw new AppError("Sesión no válida.", 401);
    }

    const token = authorization.slice(7).trim();
    const session = getSession(token);

    if (!token || !session) {
      throw new AppError("Sesión no válida.", 401);
    }

    const usuario = await prisma.usuario.findUnique({
      where: {
        id: session.usuarioId,
      },
      select: {
        id: true,
        nombre: true,
        usuario: true,
        rol: true,
        activo: true,
      },
    });

    if (!usuario || !usuario.activo) {
      throw new AppError("Sesión no válida.", 401);
    }

    req.auth = {
      token,
      usuario,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireModule(moduloCodigo) {
  return async function moduleMiddleware(req, res, next) {
    try {
      if (!req.auth?.usuario?.id) {
        throw new AppError("Sesión no válida.", 401);
      }

      const acceso = await prisma.usuarioModulo.findUnique({
        where: {
          usuarioId_moduloCodigo: {
            usuarioId: req.auth.usuario.id,
            moduloCodigo,
          },
        },
        include: {
          modulo: {
            select: {
              activo: true,
            },
          },
        },
      });

      if (!acceso?.permitido || !acceso.modulo.activo) {
        throw new AppError(
          "No tienes permiso para usar este módulo.",
          403,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}