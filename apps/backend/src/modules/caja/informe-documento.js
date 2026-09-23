import { getShiftReport } from "../reportes/reportes.service.js";
import { generarInformeTurnoHTML, safePdfName } from "@minisuper/shared/shift-report-pdf";
import { renderHtmlToPdf } from "../../lib/pdf-render.js";

const SHIFT_LABELS = { A: "Turno A", B: "Turno B", C: "Turno C" };
export async function crearDocumentoInforme(job) {
  const reporte = await getShiftReport(job.fecha, job.fecha, [job.turno], undefined, { turnoCajaId: job.turnoCajaId });
  return {
    document: await renderHtmlToPdf(generarInformeTurnoHTML(reporte)),
    mimetype: "application/pdf",
    fileName: safePdfName(`informe-${SHIFT_LABELS[job.turno]}-${job.fecha}`),
    caption: `${SHIFT_LABELS[job.turno]} · ${job.fecha} — cierre #${job.turnoCajaId}`,
  };
}
