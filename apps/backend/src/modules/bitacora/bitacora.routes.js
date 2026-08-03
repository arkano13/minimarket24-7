import { Router } from "express";
import { requireAuth, requireModule } from "../auth/auth.middleware.js";
import { listMovimientos } from "./bitacora.service.js";

export const bitacoraRouter = Router();

bitacoraRouter.use(requireAuth, requireModule("BITACORA"));

bitacoraRouter.get("/", async (req, res, next) => {
  try {
    const result = await listMovimientos({
      desde: req.query.desde,
      hasta: req.query.hasta,
      usuarioId: req.query.usuarioId,
      origen: req.query.origen,
      page: Number(req.query.page) || 1,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});