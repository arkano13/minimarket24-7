import { Router } from "express";

import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  getSalesReport,
  listReportUsers,
} from "./reportes.service.js";

export const reportsRouter = Router();

reportsRouter.use(
  requireAuth,
  requireModule("REPORTES"),
);

reportsRouter.get(
  "/usuarios",
  async (req, res, next) => {
    try {
      const usuarios = await listReportUsers();

      res.json({ usuarios });
    } catch (error) {
      next(error);
    }
  },
);

reportsRouter.get(
  "/ventas",
  async (req, res, next) => {
    try {
      const report = await getSalesReport(
        req.query.desde,
        req.query.hasta,
        typeof req.query.turnos === "string" && req.query.turnos.length > 0
          ? req.query.turnos.split(",")
          : undefined,
        req.query.usuarioId,
      );

      res.json({
        reporte: report,
      });
    } catch (error) {
      next(error);
    }
  },
);