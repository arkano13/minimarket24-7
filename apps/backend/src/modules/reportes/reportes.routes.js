import { Router } from "express";

import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  getSalesReport,
} from "./reportes.service.js";

export const reportsRouter = Router();

reportsRouter.use(
  requireAuth,
  requireModule("REPORTES"),
);

reportsRouter.get(
  "/ventas",
  async (req, res, next) => {
    try {
      const report = await getSalesReport(
        req.query.desde,
        req.query.hasta,
      );

      res.json({
        reporte: report,
      });
    } catch (error) {
      next(error);
    }
  },
);