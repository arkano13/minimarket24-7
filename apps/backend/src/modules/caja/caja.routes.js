import { Router } from "express";
import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  closeCashShift,
  createCashMovement,
  getCurrentCashShift,
  openCashShift,
} from "./caja.service.js";

export const cashRouter = Router();

cashRouter.use(
  requireAuth,
  requireModule("CAJA"),
);

cashRouter.get(
  "/actual",
  async (req, res, next) => {
    try {
      const shift =
        await getCurrentCashShift();

      res.json({
        turno: shift,
      });
    } catch (error) {
      next(error);
    }
  },
);

cashRouter.post(
  "/abrir",
  async (req, res, next) => {
    try {
      const shift = await openCashShift(
        req.body,
        req.auth.usuario.id,
      );

      res.status(201).json({
        turno: shift,
      });
    } catch (error) {
      next(error);
    }
  },
);

cashRouter.post(
  "/movimientos",
  async (req, res, next) => {
    try {
      const shift =
        await createCashMovement(
          req.body,
          req.auth.usuario.id,
        );

      res.status(201).json({
        turno: shift,
      });
    } catch (error) {
      next(error);
    }
  },
);

cashRouter.post(
  "/cerrar",
  async (req, res, next) => {
    try {
      const shift = await closeCashShift(
        req.body,
        req.auth.usuario.id,
      );

      res.json({
        turno: shift,
      });
    } catch (error) {
      next(error);
    }
  },
);