import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const state = {
  caja: null,
  sales: [],
  movimientos: [],
  cierres: [],
};

const prisma = {
  usuario: {
    async findMany() {
      return [];
    },
  },
  turnoCaja: {
    async findUnique() {
      return state.caja;
    },
    async findMany() {
      return state.cierres;
    },
  },
  venta: {
    async findMany() {
      return state.sales;
    },
  },
  movimientoCaja: {
    async findMany() {
      return state.movimientos;
    },
  },
  compra: {
    async findMany() {
      return [];
    },
  },
};

const prismaModule = new URL("../src/lib/prisma.js", import.meta.url);
mock.module(prismaModule.href, {
  namedExports: { prisma },
});

const { getShiftReport } = await import(
  "../src/modules/reportes/reportes.service.js"
);
const { generarInformeTurnoHTML } = await import(
  "@minisuper/shared/shift-report-pdf"
);

function venta(id, total, metodo, hora) {
  return {
    id,
    creadoEn: new Date(`2026-09-20T${hora}-06:00`),
    clienteNombre: null,
    total: String(total),
    usuario: { id: 2, nombre: "cajera" },
    pagos: [{ metodo, monto: String(total) }],
    detalles: [
      {
        productoId: id,
        productoNombre: `Producto ${id}`,
        cantidad: "1",
        costoUnitario: "0",
        subtotal: String(total),
      },
    ],
  };
}

function movimiento(id, tipo, metodo, monto, motivo) {
  return {
    id,
    tipo,
    metodo,
    monto: String(monto),
    motivo,
    creadoEn: new Date("2026-09-20T04:14:00-06:00"),
  };
}

beforeEach(() => {
  state.caja = {
    id: 79,
    abiertoEn: new Date("2026-09-20T01:36:00-06:00"),
    cerradoEn: new Date("2026-09-20T08:04:00-06:00"),
    fondoInicial: "0",
  };
  state.sales = [
    venta(1, 7737, "EFECTIVO", "03:10:00"),
    venta(2, 1699, "TARJETA", "05:20:00"),
  ];
  state.movimientos = [movimiento(1, "INGRESO", "EFECTIVO", 15, "3 sopa preparadas")];
  state.cierres = [];
});

test("el cuadre total suma efectivo, tarjeta, transferencia y entradas menos salidas", async () => {
  const report = await getShiftReport("2026-09-20", "2026-09-20", ["A"], undefined, {
    turnoCajaId: 79,
  });

  // El total vendido solo cuenta ventas.
  assert.equal(report.resumen.total, 9436);
  // El cuadre total incluye además las entradas de caja (el libro suma 9,451).
  assert.equal(report.resumen.cuadreTotal, 9451);
  assert.equal(report.cierre.cuadreTotal, 9451);
  assert.equal(report.cierre.tarjetaVentas, 1699);
  assert.equal(report.cierre.transferenciaVentas, 0);
  // Efectivo esperado en la gaveta: 7,737 + 15.
  assert.equal(report.resumen.efectivoEsperado, 7752);
});

test("las salidas restan del cuadre total y del efectivo esperado", async () => {
  state.movimientos.push(movimiento(2, "RETIRO", "EFECTIVO", 500, "pago proveedor"));

  const report = await getShiftReport("2026-09-20", "2026-09-20", ["A"], undefined, {
    turnoCajaId: 79,
  });

  assert.equal(report.resumen.cuadreTotal, 8951);
  assert.equal(report.resumen.efectivoEsperado, 7252);
  assert.equal(report.resumen.total, 9436);
});

test("el efectivo esperado suma el fondo inicial y solo las entradas en efectivo", async () => {
  state.caja.fondoInicial = "200";
  state.movimientos.push(movimiento(3, "INGRESO", "TARJETA", 50, "cobro con tarjeta"));

  const report = await getShiftReport("2026-09-20", "2026-09-20", ["A"], undefined, {
    turnoCajaId: 79,
  });

  // 200 fondo + 7,737 ventas + 15 entrada en efectivo (los 50 de tarjeta no van a la gaveta).
  assert.equal(report.resumen.efectivoEsperado, 7952);
  assert.equal(report.cierre.fondoInicial, 200);
  assert.equal(report.cierre.entradasEfectivo, 15);
  // Cuadre total: todo el dinero, sin fondo inicial: 7,737 + 1,699 + 15 + 50.
  assert.equal(report.resumen.cuadreTotal, 9501);
});

test("sin caja (informe por reloj) no se suma fondo inicial", async () => {
  const report = await getShiftReport("2026-09-20", "2026-09-20", ["A"]);

  assert.equal(report.cierre.fondoInicial, 0);
  assert.equal(report.resumen.efectivoEsperado, 7752);
  assert.equal(report.resumen.cuadreTotal, 9451);
});

test("el informe impreso muestra Ventas del turno y Cuadre total", async () => {
  const report = await getShiftReport("2026-09-20", "2026-09-20", ["A"], undefined, {
    turnoCajaId: 79,
  });
  const html = generarInformeTurnoHTML(report);

  assert.match(html, /Ventas del turno/);
  assert.match(html, /Cuadre total/);
  assert.match(html, /L 9,436\.00/);
  assert.match(html, /L 9,451\.00/);
  assert.match(html, /L 7,752\.00/);

  // El Total vendido solo se muestra en el panel de ventas, no como tarjeta de arriba,
  // y el panel de Cuadre total ya no repite el efectivo esperado ni la nota.
  assert.equal((html.match(/Total vendido/gi) || []).length, 1);
  assert.doesNotMatch(html, /Efectivo esperado en gaveta/);
  assert.doesNotMatch(html, /Tarjeta \+ transferencia/);
});