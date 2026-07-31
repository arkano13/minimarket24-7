import { Router } from "express";
import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";
import {
  createSale,
  searchSaleClients,
  searchSaleProducts,
} from "./ventas.service.js";

export const salesRouter = Router();

salesRouter.use(requireAuth, requireModule("VENTAS"));

salesRouter.get("/clientes", async (req, res, next) => {
  try {
    const clients = await searchSaleClients(req.query.buscar);
    res.json({ clientes: clients });
  } catch (error) {
    next(error);
  }
});

salesRouter.get("/productos", async (req, res, next) => {
  try {
    const products = await searchSaleProducts(
      req.query.buscar,
      req.query.clienteId,
    );

    res.json({ productos: products });
  } catch (error) {
    next(error);
  }
});

salesRouter.post("/", async (req, res, next) => {
  try {
    const sale = await createSale(req.body, req.auth.usuario.id);
    res.status(201).json({ venta: sale });
  } catch (error) {
    next(error);
  }
});