import assert from "node:assert/strict";
import { test } from "node:test";
import { shiftIdForDate } from "../src/modules/reportes/shifts.js";

test("asigna los límites de los tres turnos en hora de Honduras", () => {
  for (const [time, expected] of [
    ["00:00:00", 3], ["07:59:59", 3], ["08:00:00", 1],
    ["17:59:59", 1], ["18:00:00", 2], ["21:59:59", 2],
    ["22:00:00", 3], ["23:59:59", 3],
  ]) {
    const instant = new Date(`2026-08-27T${time}-06:00`);
    assert.equal(shiftIdForDate(instant.toISOString()), expected, time);
  }
});
