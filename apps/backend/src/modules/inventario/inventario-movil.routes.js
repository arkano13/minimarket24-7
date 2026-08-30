import { Router } from "express";
import { requireAdministrator, requireAuth, requireModule } from "../auth/auth.middleware.js";
import { applyMobileAdjustments, previewMobileAdjustments } from "./inventario-movil.service.js";
export const mobileInventoryRouter = Router();
mobileInventoryRouter.use(requireAuth, requireAdministrator, requireModule("INVENTARIO"));
mobileInventoryRouter.post("/preview", async (req,res,next)=>{try{res.json(await previewMobileAdjustments(req.body));}catch(e){next(e);}});
mobileInventoryRouter.post("/aplicar", async (req,res,next)=>{try{res.json(await applyMobileAdjustments(req.body,req.auth.usuario.id));}catch(e){next(e);}});
