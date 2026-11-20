import { Router } from "express";
import { login } from "./auth.service.js";
import { requireAuth } from "./auth.middleware.js";
import { deleteSession } from "./session.store.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const resultado = await login(req.body);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({
    usuario: req.auth.usuario,
  });
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    await deleteSession(req.auth.token);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});