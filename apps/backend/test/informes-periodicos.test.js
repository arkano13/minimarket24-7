import assert from "node:assert/strict";
import { test } from "node:test";
import {
  informesPeriodicosDe, instantesDelRango, rangoMensual, rangoMesAnterior, rangoSemanal, semanasDelMes,
} from "../src/modules/informes-periodicos/periodos.js";

test("solo el Turno C del domingo o del último día del mes dispara informes periódicos", () => {
  assert.deepEqual(informesPeriodicosDe("C", "2026-10-18"), ["SEMANAL"]); // domingo
  assert.deepEqual(informesPeriodicosDe("C", "2026-10-31"), ["MENSUAL"]); // sábado, fin de mes
  assert.deepEqual(informesPeriodicosDe("C", "2026-05-31"), ["SEMANAL", "MENSUAL"]);
  assert.deepEqual(informesPeriodicosDe("B", "2026-10-18"), []);
  assert.deepEqual(informesPeriodicosDe("C", "2026-10-19"), []);
  assert.deepEqual(informesPeriodicosDe("C", "2028-02-29"), ["MENSUAL"]);
});

test("rangos de semana, mes, mes anterior y semanas del mes", () => {
  assert.deepEqual(rangoSemanal("2026-10-18"), { desde: "2026-10-12", hasta: "2026-10-18" });
  assert.deepEqual(rangoMensual("2026-09-30"), { desde: "2026-09-01", hasta: "2026-09-30" });
  assert.deepEqual(rangoMesAnterior("2026-01-31"), { desde: "2025-12-01", hasta: "2025-12-31" });
  assert.deepEqual(semanasDelMes(rangoMensual("2026-02-28")).map((semana) => `${semana.desde}/${semana.hasta}`), [
    "2026-02-01/2026-02-07", "2026-02-08/2026-02-14", "2026-02-15/2026-02-21", "2026-02-22/2026-02-28",
  ]);
});

test("el rango usa el día comercial de 2:00 a. m. a 1:59 a. m. hora de Honduras", () => {
  const { from, to } = instantesDelRango({ desde: "2026-10-12", hasta: "2026-10-18" });
  assert.equal(from.toISOString(), "2026-10-12T08:00:00.000Z");
  assert.equal(to.toISOString(), "2026-10-19T07:59:59.999Z");
});
