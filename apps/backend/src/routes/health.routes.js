import { Router } from "express";
import { NOMBRE_SISTEMA } from "@minisuper/shared";

export const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: NOMBRE_SISTEMA,
    timestamp: new Date().toISOString(),
  });
});
