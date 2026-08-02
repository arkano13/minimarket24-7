import { Router } from "express";

import {
  requireAdministrator,
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  createUser,
  listModules,
  listUsers,
  resetUserPassword,
  setUserActive,
  updateUser,
} from "./usuarios.service.js";

export const usuariosRouter = Router();

const ROLES = [
  {
    codigo: "ADMINISTRADOR",
    nombre: "Administrador",
    descripcion: "Tiene acceso completo a todo el sistema.",
  },
  {
    codigo: "SUPERVISOR",
    nombre: "Supervisor",
    descripcion:
      "Puede supervisar operaciones y consultar los módulos asignados.",
  },
  {
    codigo: "CAJERO",
    nombre: "Cajero",
    descripcion:
      "Puede realizar ventas y trabajar con la caja.",
  },
  {
    codigo: "BODEGA",
    nombre: "Bodega",
    descripcion:
      "Puede trabajar con productos, inventario y compras.",
  },
];

/*
 * Todas las rutas del módulo requieren:
 * 1. Una sesión válida.
 * 2. Permiso para ver el módulo USUARIOS.
 * 3. Tener el rol ADMINISTRADOR.
 */
usuariosRouter.use(
  requireAuth,
  requireModule("USUARIOS"),
  requireAdministrator,
);

usuariosRouter.get("/modulos", async (req, res, next) => {
  try {
    const modulos = await listModules();

    res.json({
      modulos,
      roles: ROLES,
    });
  } catch (error) {
    next(error);
  }
});

usuariosRouter.get("/", async (req, res, next) => {
  try {
    const usuarios = await listUsers();

    res.json({
      usuarios,
    });
  } catch (error) {
    next(error);
  }
});

usuariosRouter.post("/", async (req, res, next) => {
  try {
    const usuario = await createUser(req.body);

    res.status(201).json({
      usuario,
      mensaje: "Usuario creado correctamente.",
    });
  } catch (error) {
    next(error);
  }
});

usuariosRouter.patch(
  "/:usuarioId",
  async (req, res, next) => {
    try {
      const usuario = await updateUser(
        req.params.usuarioId,
        req.body,
        req.auth.usuario.id,
        req.auth.token,
      );

      res.json({
        usuario,
        mensaje: "Usuario actualizado correctamente.",
      });
    } catch (error) {
      next(error);
    }
  },
);

usuariosRouter.patch(
  "/:usuarioId/estado",
  async (req, res, next) => {
    try {
      const usuario = await setUserActive(
        req.params.usuarioId,
        req.body.activo,
        req.auth.usuario.id,
      );

      res.json({
        usuario,
        mensaje: usuario.activo
          ? "Usuario activado correctamente."
          : "Usuario desactivado correctamente.",
      });
    } catch (error) {
      next(error);
    }
  },
);

usuariosRouter.patch(
  "/:usuarioId/contrasena",
  async (req, res, next) => {
    try {
      const resultado = await resetUserPassword(
        req.params.usuarioId,
        req.body.contrasena,
        req.auth.usuario.id,
        req.auth.token,
      );

      res.json(resultado);
    } catch (error) {
      next(error);
    }
  },
);