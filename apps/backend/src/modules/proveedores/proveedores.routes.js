import { Router } from "express";
import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  createSupplier,
  listSuppliers,
  updateSupplier,
} from "./proveedores.service.js";

export const suppliersRouter = Router();

suppliersRouter.use(
  requireAuth,
  requireModule("PROVEEDORES"),
);

suppliersRouter.get("/", async (req, res, next) => {
  try {
    const suppliers = await listSuppliers(
      req.query.buscar,
    );

    res.json({
      proveedores: suppliers,
    });
  } catch (error) {
    next(error);
  }
});

suppliersRouter.post("/", async (req, res, next) => {
  try {
    const supplier = await createSupplier(
      req.body,
    );

    res.status(201).json({
      proveedor: supplier,
    });
  } catch (error) {
    next(error);
  }
});

suppliersRouter.patch(
  "/:proveedorId",
  async (req, res, next) => {
    try {
      const supplier = await updateSupplier(
        req.params.proveedorId,
        req.body,
      );

      res.json({
        proveedor: supplier,
      });
    } catch (error) {
      next(error);
    }
  },
);