import { Router } from "express";

import {
  requireAuth,
  requireModule,
} from "../auth/auth.middleware.js";

import {
  createProduct,
  listProducts,
  updateProduct,
} from "./productos.service.js";

import {
  createCategory,
  listCategories,
} from "./categorias.service.js";

export const productsRouter = Router();

productsRouter.use(
  requireAuth,
  requireModule("PRODUCTOS"),
);

productsRouter.get(
  "/categorias",
  async (req, res, next) => {
    try {
      const categories = await listCategories();

      res.json({
        categorias: categories,
      });
    } catch (error) {
      next(error);
    }
  },
);

productsRouter.post(
  "/categorias",
  async (req, res, next) => {
    try {
      const category = await createCategory(
        req.body,
      );

      res.status(201).json({
        categoria: category,
      });
    } catch (error) {
      next(error);
    }
  },
);

productsRouter.get(
  "/",
  async (req, res, next) => {
    try {
      const products = await listProducts(
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

productsRouter.post(
  "/",
  async (req, res, next) => {
    try {
      const product = await createProduct(
        req.body,
        req.auth.usuario.id,
      );

      res.status(201).json({
        producto: product,
      });
    } catch (error) {
      next(error);
    }
  },
);

productsRouter.patch(
  "/:id",
  async (req, res, next) => {
    try {
      const product = await updateProduct(
        req.params.id,
        req.body,
        req.auth.usuario.id,
      );

      res.json({
        producto: product,
      });
    } catch (error) {
      next(error);
    }
  },
);