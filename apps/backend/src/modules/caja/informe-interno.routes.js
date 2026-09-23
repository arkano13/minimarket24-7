import { Router } from "express";
import { crearDocumentoInforme } from "./informe-documento.js";

export function createInternalReportRouter({
  secret = process.env.INFORME_INTERNO_SECRET,
  crearDocumento = crearDocumentoInforme,
} = {}) {
  const router = Router();
  router.get("/informe-turno-pdf", async (req, res) => {
    const clave = req.query.clave || req.get("X-Interno-Secret");
    if (!secret || clave !== secret) return res.status(403).send("No autorizado.");
    const { turno, fecha, turnoCajaId } = req.query;
    if (!["A", "B", "C"].includes(turno) || typeof fecha !== "string") return res.status(400).send("turno o fecha inválidos.");
    if (turnoCajaId != null && (!Number.isSafeInteger(Number(turnoCajaId)) || Number(turnoCajaId) <= 0)) {
      return res.status(400).send("turnoCajaId inválido.");
    }
    try {
      const { document, fileName } = await crearDocumento({ turno, fecha, turnoCajaId });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.send(document);
    } catch (error) {
      console.error("No se pudo generar el informe directo:", error.message);
      res.status(500).send("No se pudo generar el PDF.");
    }
  });
  return router;
}

export const internalReportRouter = createInternalReportRouter();
