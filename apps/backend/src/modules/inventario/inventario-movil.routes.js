import { Router } from "express";
import { requireAdministrator, requireAuth, requireModule } from "../auth/auth.middleware.js";
import { applyMobileAdjustments, previewMobileAdjustments, searchMobileProducts } from "./inventario-movil.service.js";
export const mobileInventoryRouter = Router();
mobileInventoryRouter.use(requireAuth, requireAdministrator, requireModule("INVENTARIO"));
mobileInventoryRouter.get("/buscar", async (req,res,next)=>{try{res.json(await searchMobileProducts(req.query.q));}catch(e){next(e);}});
mobileInventoryRouter.post("/preview", async (req,res,next)=>{try{res.json(await previewMobileAdjustments(req.body));}catch(e){next(e);}});
mobileInventoryRouter.post("/aplicar", async (req,res,next)=>{try{res.json(await applyMobileAdjustments(req.body,req.auth.usuario.id));}catch(e){next(e);}});
