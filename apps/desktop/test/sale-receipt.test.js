import assert from "node:assert/strict";
import test from "node:test";
import { buildUserSalesReceiptHtml } from "../electron/sale-receipt.js";

test("el recibo incluye precios unitarios, subtotales y total", () => {
  const html = buildUserSalesReceiptHtml({
    fecha: "2026-09-03",
    usuario: { nombre: "Caja" },
    turnos: [{ nombre: "A", horario: "2:00 a. m. – 8:00 a. m.", ventas: [{
      id: 42, creadoEn: "2026-09-03T16:00:00.000Z", monto: 31, estado: "COMPLETADA",
      pagos: [{ metodo: "EFECTIVO", monto: 31 }],
      productos: [{ nombre: "Café", presentacion: "Unidad", cantidad: 3, subtotal: 30 }],
    }] }, { nombre: "B", horario: "", ventas: [] }, { nombre: "C", horario: "", ventas: [] }],
  });

  assert.match(html, /3 × L 10\.00/);
  assert.match(html, /L 30\.00/);
  assert.match(html, /TOTAL/);
  assert.match(html, /L 31\.00/);
  assert.match(html, /TOTAL GENERAL/);
  assert.match(html, /TOTAL TURNO A/);
  assert.match(html, /Efectivo/);
  assert.match(html, /Tarjeta/);
  assert.match(html, /Transferencia/);
});

test("el recibo escapa nombres para impedir HTML inyectado", () => {
  const html = buildUserSalesReceiptHtml({
    fecha: "2026-09-03",
    turnos: [{ nombre: "A", horario: "", ventas: [{ id: 1, creadoEn: "2026-09-03T16:00:00.000Z", monto: 10, estado: "COMPLETADA", pagos: [],
      productos: [{ nombre: "<script>x</script>", presentacion: "Unidad", cantidad: 1, subtotal: 10 }] }] }],
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
