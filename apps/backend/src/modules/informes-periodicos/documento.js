// apps/backend/src/modules/informes-periodicos/documento.js

import { safePdfName } from "@minisuper/shared/shift-report-pdf";
import { renderHtmlToPdf } from "../../lib/pdf-render.js";
import { datosMensuales } from "./datos-mensual.js";
import { datosSemanales } from "./datos-semanal.js";
import { generarInformeMensualHTML, generarInformeSemanalHTML } from "./plantillas.js";

export async function crearDocumentoPeriodico(tipo, fecha) {
  if (tipo === "SEMANAL") {
    const datos = await datosSemanales(fecha);
    return {
      document: await renderHtmlToPdf(generarInformeSemanalHTML(datos)),
      mimetype: "application/pdf",
      fileName: safePdfName(`informe-semanal-${datos.rango.desde}-al-${datos.rango.hasta}`),
      caption: `Informe semanal · ${datos.rango.desde} al ${datos.rango.hasta}`,
    };
  }

  if (tipo === "MENSUAL") {
    const datos = await datosMensuales(fecha);
    return {
      document: await renderHtmlToPdf(generarInformeMensualHTML(datos)),
      mimetype: "application/pdf",
      fileName: safePdfName(`informe-mensual-${datos.rango.desde.slice(0, 7)}`),
      caption: `Informe mensual · ${datos.rango.desde.slice(0, 7)}`,
    };
  }

  throw new Error(`Tipo de informe desconocido: ${tipo}`);
}
