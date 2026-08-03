import express from "express";
import cors from "cors";

import { healthRouter } from "./routes/health.routes.js";

import { authRouter } from "./modules/auth/auth.routes.js";

import { productsRouter } from "./modules/productos/productos.routes.js";

import { inventoryRouter } from "./modules/inventario/inventario.routes.js";

import { salesRouter } from "./modules/ventas/ventas.routes.js";

import { cashRouter } from "./modules/caja/caja.routes.js";

import { clientsRouter } from "./modules/clientes/clientes.routes.js";

import { suppliersRouter } from "./modules/proveedores/proveedores.routes.js";

import { purchasesRouter } from "./modules/compras/compras.routes.js";

import { reportsRouter } from "./modules/reportes/reportes.routes.js";

import { errorMiddleware } from "./middleware/error.middleware.js";

import { configuracionRouter } from "./modules/configuracion/configuracion.routes.js";

import { usuariosRouter } from "./modules/usuarios/usuarios.routes.js";

import { bitacoraRouter } from "./modules/bitacora/bitacora.routes.js";
  

const allowedOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

export const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido."));
    },
  }),
);

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use("/api/health", healthRouter);

app.use("/api/auth", authRouter);

app.use("/api/productos", productsRouter);

app.use("/api/inventario", inventoryRouter);

app.use("/api/ventas", salesRouter);

app.use("/api/caja", cashRouter);

app.use("/api/clientes", clientsRouter);

app.use("/api/proveedores", suppliersRouter);

app.use("/api/compras", purchasesRouter);

app.use("/api/reportes", reportsRouter);

app.use("/api/configuracion", configuracionRouter);

app.use("/api/usuarios", usuariosRouter);

app.use("/api/bitacora", bitacoraRouter);



app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada.",
  });
});

app.use(errorMiddleware);
