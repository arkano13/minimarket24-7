import { Router } from "express";

import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  cancelPurchase,
  createPurchase,
  getPurchase,
  listPurchases,
  searchPurchaseProducts,
  searchPurchaseSuppliers,
} from "./compras.service.js";

export const purchasesRouter = Router();

purchasesRouter.use(
  requireAuth,
  requireModule("COMPRAS"),
);

purchasesRouter.get(
  "/proveedores",
  async (req, res, next) => {
    try {
      const suppliers =
        await searchPurchaseSuppliers(
          req.query.buscar,
        );

      res.json({
        proveedores: suppliers,
      });
    } catch (error) {
      next(error);
    }
  },
);

purchasesRouter.get(
  "/productos",
  async (req, res, next) => {
    try {
      const products =
        await searchPurchaseProducts(
          req.query.buscar,
        );

      res.json({
        productos: products,
      });
    } catch (error) {
      next(error);
    }
  },
);

purchasesRouter.get(
  "/",
  async (req, res, next) => {
    try {
      const purchases =
        await listPurchases(
          req.query.buscar,
        );

      res.json({
        compras: purchases,
      });
    } catch (error) {
      next(error);
    }
  },
);

purchasesRouter.get(
  "/:compraId",
  async (req, res, next) => {
    try {
      const purchase = await getPurchase(
        req.params.compraId,
      );

      res.json({
        compra: purchase,
      });
    } catch (error) {
      next(error);
    }
  },
);

purchasesRouter.post(
  "/",
  async (req, res, next) => {
    try {
      const purchase = await createPurchase(
        req.body,
        req.auth.usuario.id,
      );

      res.status(201).json({
        compra: purchase,
      });
    } catch (error) {
      next(error);
    }
  },
);

purchasesRouter.post(
  "/:compraId/anular",
  async (req, res, next) => {
    try {
      const purchase = await cancelPurchase(
        req.params.compraId,
        req.auth.usuario.id,
      );

      res.json({
        compra: purchase,
        mensaje: "Compra anulada correctamente.",
      });
    } catch (error) {
      next(error);
    }
  },
);