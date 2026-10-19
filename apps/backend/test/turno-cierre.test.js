import assert from "node:assert/strict";
import { test } from "node:test";
import { inferirTurnoDeCierre } from "../src/modules/caja/turno-cierre.js";

// Hora de Honduras = UTC−6.
const hn = (fechaHora) => new Date(`${fechaHora}-06:00`);

test("la letra del informe sale del fin de turno más cercano a la hora del cierre", () => {
  const casos = [
    ["2026-10-18T18:49", "B", "2026-10-18"],
    ["2026-10-18T19:30", "B", "2026-10-18"], // B cerrado tarde
    ["2026-10-19T02:03", "C", "2026-10-18"], // C de madrugada → día anterior
    ["2026-10-18T23:40", "C", "2026-10-18"], // C cerrado temprano
    ["2026-10-19T08:05", "A", "2026-10-19"],
    ["2026-10-19T08:14", "A", "2026-10-19"], // un segundo cierre no corre las letras
    ["2026-10-19T06:30", "A", "2026-10-19"],
  ];

  for (const [hora, turno, fecha] of casos) {
    const resultado = inferirTurnoDeCierre(hn(hora));
    assert.equal(resultado.turno, turno, hora);
    assert.equal(resultado.fecha, fecha, hora);
  }
});

test("porTolerancia indica si el cierre quedó a más de una hora del fin del turno", () => {
  assert.equal(inferirTurnoDeCierre(hn("2026-10-18T18:30")).porTolerancia, true);
  assert.equal(inferirTurnoDeCierre(hn("2026-10-18T20:30")).porTolerancia, false);
  assert.equal(inferirTurnoDeCierre(hn("2026-10-18T20:30")).turno, "B");
});
