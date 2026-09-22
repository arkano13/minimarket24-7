import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { Prisma } from "@prisma/client";
import { validateDecimalColumn, validateSaleNumbers } from "../src/lib/decimal-range.js";

test("límites NUMERIC incluyen el redondeo que puede desbordar la columna", () => {
  validateDecimalColumn("999999999999.99", 14, 2, "Monto");
  validateDecimalColumn("999999999999.994", 14, 2, "Monto");
  for (const value of ["999999999999.995", "1000000000000", "-1000000000000", "Infinity", "NaN"]) {
    assert.throws(() => validateDecimalColumn(value, 14, 2, "Monto"), (e) => e.status === 400);
  }
  validateDecimalColumn(null, 14, 2, "Opcional");
});

test("costos calculados tienen su propio límite de cuatro decimales", () => {
  assert.throws(() => validateSaleNumbers({ details: [{ productoNombre: "Caja", costoUnitario: "10000000000" }] }), /costo unitario de Caja/);
});

let inserted = false;
const tx = {
  turnoCaja: { findFirst: async () => ({ id: 1 }) },
  presentacionProducto: { findMany: async () => [{
    id: 1, productoId: 1, nombre: "Unidad", factorInventario: new Prisma.Decimal(1), precioBase: new Prisma.Decimal(20),
    producto: { nombre: "Producto", stockActual: new Prisma.Decimal(10), costoPromedio: new Prisma.Decimal(5) },
  }] },
  loteInventario: { findMany: async () => [] },
  venta: { create: async () => { inserted = true; throw new Error("No debe insertar"); } },
};
mock.module(new URL("../src/lib/prisma.js", import.meta.url).href, { namedExports: { prisma: { $transaction: async (fn) => fn(tx) } } });
const { createSale } = await import("../src/modules/ventas/ventas.service.js");

test("un código de barras en efectivo recibido se rechaza antes de insertar venta/pago", async () => {
  await assert.rejects(createSale({ productos: [{ presentacionId: 1, cantidad: 1 }], metodoPago: "EFECTIVO", montoRecibido: "7501234567890" }, 1),
    (error) => error.status === 400 && /monto recibido/.test(error.message));
  assert.equal(inserted, false);
});
