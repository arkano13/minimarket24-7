import { Router } from "express";
import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";
import {
  cancelSale,
  createSale,
  listCreditSales,
  listSales,
  marcarCreditoComoPagado,
  repriceCartForClient,
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

// Créditos ("fiado") de TODOS los cajeros, no solo del usuario autenticado —
// a propósito, para que cualquiera pueda ver a quién se le fió.
salesRouter.get("/creditos", async (req, res, next) => {
  try {
    const ventas = await listCreditSales(req.query.buscar);
    res.json({ ventas });
  } catch (error) {
    next(error);
  }
});

// Marca un crédito como saldado — lo saca de la lista de pendientes.
// No mueve dinero ni inventario; si el cliente pagó de verdad, el
// cobro se registra aparte como entrada de caja normal.
salesRouter.put("/creditos/:id/pagado", async (req, res, next) => {
  try {
    await marcarCreditoComoPagado(req.params.id);
    res.status(204).end();
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

salesRouter.post("/:ventaId/cancelar", async (req, res, next) => {
  try {
    const sale = await cancelSale(
      req.params.ventaId,
      req.auth.usuario.id,
    );

    res.json({
      venta: sale,
      mensaje: "Venta cancelada correctamente.",
    });
  } catch (error) {
    next(error);
  }
});

salesRouter.get("/", async (req, res, next) => {
  try {
    const sales = await listSales(req.query.buscar);
    res.json({ ventas: sales });
  } catch (error) {
    next(error);
  }
});

salesRouter.post("/reprecio", async (req, res, next) => {
  try {
    const productos = await repriceCartForClient(
      req.body.presentacionIds,
      req.body.clienteId,
    );

    res.json({ productos });
  } catch (error) {
    next(error);
  }
});