import assert from "node:assert/strict";
import { test } from "node:test";
import { shiftIdForDate } from "../src/modules/reportes/shifts.js";

test("asigna los límites de los tres turnos en hora de Honduras", () => {
  for (const [time, expected] of [
    ["00:00:00", "C"], ["01:59:59", "C"], ["02:00:00", "A"],
    ["07:59:59", "A"], ["08:00:00", "B"], ["17:59:59", "B"],
    ["18:00:00", "C"], ["23:59:59", "C"],
  ]) {
    const instant = new Date(`2026-08-27T${time}-06:00`);
    assert.equal(shiftIdForDate(instant.toISOString()), expected, time);
  }
});
