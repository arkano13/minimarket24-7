import { Router } from "express";

import { requireAuth, requireModule } from "../auth/auth.middleware.js";

import {
  addPresentation,
  createProduct,
  deactivatePresentation,
  getProductComponents,
  listPresentations,
  listProducts,
  setProductComponents,
  updatePresentation,
  updateProduct,
} from "./productos.service.js";

import { createCategory, listCategories } from "./categorias.service.js";

export const productsRouter = Router();

productsRouter.use(requireAuth, requireModule("PRODUCTOS"));

productsRouter.get("/categorias", async (req, res, next) => {
  try {
    const categories = await listCategories();
    res.json({ categorias: categories });
  } catch (error) {
    next(error);
  }
});

productsRouter.post("/categorias", async (req, res, next) => {
  try {
    const category = await createCategory(req.body);
    res.status(201).json({ categoria: category });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/", async (req, res, next) => {
  try {
    const result = await listProducts(req.query.buscar, req.query.page, req.query.perPage);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

productsRouter.post("/", async (req, res, next) => {
  try {
    const product = await createProduct(req.body, req.auth.usuario.id);
    res.status(201).json({ producto: product });
  } catch (error) {
    next(error);
  }
});

productsRouter.patch("/:id", async (req, res, next) => {
  try {
    const product = await updateProduct(req.params.id, req.body, req.auth.usuario.id);
    res.json({ producto: product });
  } catch (error) {
    next(error);
  }
});

// --- Componentes (productos compuestos, ej. saco de pollo mixto) ----

productsRouter.get("/:id/componentes", async (req, res, next) => {
  try {
    const componentes = await getProductComponents(req.params.id);
    res.json({ componentes });
  } catch (error) {
    next(error);
  }
});

productsRouter.put("/:id/componentes", async (req, res, next) => {
  try {
    const product = await setProductComponents(
      req.params.id,
      req.body.componentes,
      req.auth.usuario.id,
    );

    res.json({ producto: product });
  } catch (error) {
    next(error);
  }
});

// --- Presentaciones adicionales (six-pack, caja, paquete, etc.) -----

productsRouter.get("/:id/presentaciones", async (req, res, next) => {
  try {
    const presentaciones = await listPresentations(req.params.id);
    res.json({ presentaciones });
  } catch (error) {
    next(error);
  }
});

productsRouter.post("/:id/presentaciones", async (req, res, next) => {
  try {
    const product = await addPresentation(req.params.id, req.body, req.auth.usuario.id);
    res.status(201).json({ producto: product });
  } catch (error) {
    next(error);
  }
});

productsRouter.patch("/:id/presentaciones/:presentacionId", async (req, res, next) => {
  try {
    const product = await updatePresentation(
      req.params.id,
      req.params.presentacionId,
      req.body,
      req.auth.usuario.id,
    );

    res.json({ producto: product });
  } catch (error) {
    next(error);
  }
});

productsRouter.delete("/:id/presentaciones/:presentacionId", async (req, res, next) => {
  try {
    const product = await deactivatePresentation(
      req.params.id,
      req.params.presentacionId,
      req.auth.usuario.id,
    );

    res.json({ producto: product });
  } catch (error) {
    next(error);
  }
});