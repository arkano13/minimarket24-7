import { Router } from "express";

import {
  requireAdministrator,
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  getConfiguration,
  updateConfiguration,
} from "./configuracion.service.js";

export const configuracionRouter = Router();

configuracionRouter.use(
  requireAuth,
  requireModule("CONFIGURACION"),
  requireAdministrator,
);

configuracionRouter.get(
  "/",
  async (req, res, next) => {
    try {
      const configuracion =
        await getConfiguration();

      res.json({
        configuracion,
      });
    } catch (error) {
      next(error);
    }
  },
);

configuracionRouter.patch(
  "/",
  async (req, res, next) => {
    try {
      const configuracion =
        await updateConfiguration(req.body);

      res.json({
        configuracion,
        mensaje:
          "Configuración guardada correctamente.",
      });
    } catch (error) {
      next(error);
    }
  },
);