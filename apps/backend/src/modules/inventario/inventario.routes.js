import { Router } from "express";

import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  createInventoryMovement,
  listInventoryMovements,
} from "./inventario.service.js";

export const inventoryRouter = Router();

inventoryRouter.use(
  requireAuth,
  requireModule("INVENTARIO"),
);

inventoryRouter.get(
  "/movimientos",
  async (req, res, next) => {
    try {
      const movements =
        await listInventoryMovements(
          req.query.productoId,
        );

      res.json({
        movimientos: movements,
      });
    } catch (error) {
      next(error);
    }
  },
);

inventoryRouter.post(
  "/movimientos",
  async (req, res, next) => {
    try {
      const movement =
        await createInventoryMovement(
          req.body,
          req.auth.usuario.id,
        );

      res.status(201).json({
        movimiento: movement,
      });
    } catch (error) {
      next(error);
    }
  },
);