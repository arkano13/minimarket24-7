import { Router } from "express";
import {
  requireAdministrator,
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  closeCashShift,
  createCashMovement,
  getCurrentCashShift,
  getInformeCierreParaImprimir,
  getProximoTurnoInforme,
  listCashShiftHistory,
  listMyCashActivity,
  openCashShift,
  setProximoTurnoInforme,
} from "./caja.service.js";

export const cashRouter = Router();

cashRouter.use(
  requireAuth,
  requireModule("CAJA"),
);

cashRouter.get("/mi-actividad", async (req, res, next) => {
  try {
    const activity = await listMyCashActivity(req.auth.usuario.id, {
      fecha: req.query.fecha,
      tipo: req.query.tipo,
      page: req.query.page,
      turnos: typeof req.query.turnos === "string" && req.query.turnos.length > 0
        ? req.query.turnos.split(",")
        : undefined,
    });
    res.json({
      ...activity,
      usuario: { id: req.auth.usuario.id, nombre: req.auth.usuario.nombre },
    });
  } catch (error) {
    next(error);
  }
});

cashRouter.get(
  "/actual",
  async (req, res, next) => {
    try {
      const shift =
        await getCurrentCashShift(req.auth.usuario.id);

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

// Historial de cierres. Un cajero solo ve los suyos (el servicio lo
// fuerza aunque pidan otro usuarioId); un administrador puede ver los
// de cualquiera o de todos si no manda usuarioId.
cashRouter.get("/cierres", async (req, res, next) => {
  try {
    const resultado = await listCashShiftHistory(
      {
        desde: req.query.desde,
        hasta: req.query.hasta,
        usuarioId: req.query.usuarioId,
        page: req.query.page,
      },
      req.auth.usuario,
    );

    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

// HTML del informe de un cierre, para imprimirlo desde el desktop. Un
// cajero solo puede pedir el de sus propios cierres (lo valida el
// servicio); un administrador, el de cualquiera. No afecta el envío
// por WhatsApp.
cashRouter.get("/cierres/:id/informe-html", async (req, res, next) => {
  try {
    const informe = await getInformeCierreParaImprimir(
      req.params.id,
      req.auth.usuario,
    );

    res.json(informe);
  } catch (error) {
    next(error);
  }
});

// Solo administrador: ver y corregir a mano cuál es el próximo turno
// que se enviará por WhatsApp al cerrar caja (por si la rotación
// C→A→B→C se desincroniza).
cashRouter.get(
  "/proximo-turno-informe",
  requireAdministrator,
  async (req, res, next) => {
    try {
      const turno = await getProximoTurnoInforme();

      res.json({ turno });
    } catch (error) {
      next(error);
    }
  },
);

cashRouter.put(
  "/proximo-turno-informe",
  requireAdministrator,
  async (req, res, next) => {
    try {
      const turno = await setProximoTurnoInforme(req.body?.turno);

      res.json({ turno });
    } catch (error) {
      next(error);
    }
  },
);