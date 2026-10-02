import assert from "node:assert/strict";
import { test } from "node:test";
import { presentationLabel } from "../src/services/presentation.js";

test("la presentación principal muestra el nombre del producto", () => {
  const label = presentationLabel({ nombre: "Cigarro belmont", presentacion: "Unidad", esPrincipal: true, factorInventario: 1 });
  assert.deepEqual(label, { titulo: "Cigarro belmont", detalle: "Unidad", factor: 1 });
});

test("un paquete muestra grande el nombre de la presentación", () => {
  const label = presentationLabel({ nombre: "Cigarro belmont", presentacion: "Paquete grande", esPrincipal: false, factorInventario: 20 });
  assert.deepEqual(label, { titulo: "Paquete grande", detalle: "Cigarro belmont", factor: 20 });
});

test("sin esPrincipal decide por el factor (detalle de compras guardadas)", () => {
  assert.equal(presentationLabel({ nombre: "Agua", presentacion: "Fardo", factorInventario: 12 }).titulo, "Fardo");
  assert.equal(presentationLabel({ nombre: "Agua", presentacion: "Unidad", factorInventario: 1 }).titulo, "Agua");
});
