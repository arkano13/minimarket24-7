import { Router } from "express";

import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  getShiftReport,
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

// Informe de turno unificado — reemplaza los antiguos reportes
// "administrativo" y "ejecutivo". Sirve tanto para el diario (un turno o
// el día completo) como, más adelante, para semanal/mensual: son el
// mismo informe, solo cambia el rango de fechas (desde/hasta).
reportsRouter.get(
  "/turno",
  async (req, res, next) => {
    try {
      const report = await getShiftReport(
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