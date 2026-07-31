import {
  Router,
} from "express";

import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  createSpecialClient,
  listSpecialClients,
  removeSpecialPrice,
  searchProductsForSpecialPrice,
  setSpecialPrice,
  updateSpecialClient,
} from "./clientes.service.js";

export const clientsRouter =
  Router();

clientsRouter.use(
  requireAuth,
  requireModule("CLIENTES"),
);

clientsRouter.get(
  "/productos",
  async (req, res, next) => {
    try {
      const products =
        await searchProductsForSpecialPrice(
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

clientsRouter.get(
  "/",
  async (req, res, next) => {
    try {
      const clients =
        await listSpecialClients(
          req.query.buscar,
        );

      res.json({
        clientes: clients,
      });
    } catch (error) {
      next(error);
    }
  },
);

clientsRouter.post(
  "/",
  async (req, res, next) => {
    try {
      const client =
        await createSpecialClient(
          req.body,
        );

      res.status(201).json({
        cliente: client,
      });
    } catch (error) {
      next(error);
    }
  },
);

clientsRouter.patch(
  "/:clienteId",
  async (req, res, next) => {
    try {
      const client =
        await updateSpecialClient(
          req.params.clienteId,
          req.body,
        );

      res.json({
        cliente: client,
      });
    } catch (error) {
      next(error);
    }
  },
);

clientsRouter.put(
  "/:clienteId/precios",
  async (req, res, next) => {
    try {
      const client =
        await setSpecialPrice(
          req.params.clienteId,
          req.body,
        );

      res.json({
        cliente: client,
      });
    } catch (error) {
      next(error);
    }
  },
);

clientsRouter.delete(
  "/:clienteId/precios/:presentacionId",
  async (req, res, next) => {
    try {
      const client =
        await removeSpecialPrice(
          req.params.clienteId,
          req.params.presentacionId,
        );

      res.json({
        cliente: client,
      });
    } catch (error) {
      next(error);
    }
  },
);