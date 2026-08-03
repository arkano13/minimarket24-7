import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const state = {
  sales: [],
  lastQuery: null,
};

const prisma = {
  venta: {
    async findMany(query) {
      state.lastQuery = query;
      return state.sales;
    },
  },
};

const prismaModule = new URL("../src/lib/prisma.js", import.meta.url);
mock.module(prismaModule.href, {
  namedExports: { prisma },
});

const { getSalesReport } = await import(
  "../src/modules/reportes/reportes.service.js"
);

beforeEach(() => {
  state.sales = [];
  state.lastQuery = null;
});

test("rechaza fechas inexistentes en el calendario", async () => {
  await assert.rejects(
    () => getSalesReport("2026-02-30", "2026-03-01"),
    (error) => error.status === 400 && /fecha inicial/i.test(error.message),
  );
});

test("rechaza rangos invertidos y mayores a 366 días", async () => {
  await assert.rejects(
    () => getSalesReport("2026-08-03", "2026-08-01"),
    /no puede ser posterior/i,
  );

  await assert.rejects(
    () => getSalesReport("2024-01-01", "2026-01-02"),
    /no puede superar 366 días/i,
  );
});

test("agrega ventas, pagos, productos, costos y horas", async () => {
  state.sales = [
    {
      id: 1,
      creadoEn: new Date(2026, 7, 3, 14, 10),
      clienteNombre: null,
      total: "125.50",
      usuario: { id: 2, nombre: "Caja" },
      pagos: [{ metodo: "EFECTIVO", monto: "125.50" }],
      detalles: [
        {
          productoId: 5,
          productoNombre: "Café",
          cantidad: "2",
          costoUnitario: "30",
          subtotal: "100",
        },
        {
          productoId: 6,
          productoNombre: "Pan",
          cantidad: "1",
          costoUnitario: "15.5",
          subtotal: "25.5",
        },
      ],
    },
    {
      id: 2,
      creadoEn: new Date(2026, 7, 3, 14, 40),
      clienteNombre: "Cliente especial",
      total: "50",
      usuario: { id: 2, nombre: "Caja" },
      pagos: [{ metodo: "TARJETA", monto: "50" }],
      detalles: [
        {
          productoId: 5,
          productoNombre: "Café",
          cantidad: "1",
          costoUnitario: "30",
          subtotal: "50",
        },
      ],
    },
  ];

  const report = await getSalesReport("2026-08-03", "2026-08-03");

  assert.deepEqual(report.periodo, {
    desde: "2026-08-03",
    hasta: "2026-08-03",
  });
  assert.deepEqual(report.resumen, {
    operaciones: 2,
    total: 175.5,
    costoEstimado: 105.5,
    gananciaEstimada: 70,
    promedio: 87.75,
  });
  assert.deepEqual(
    report.pagos.map(({ metodo, operaciones, total }) => ({
      metodo,
      operaciones,
      total,
    })),
    [
      { metodo: "EFECTIVO", operaciones: 1, total: 125.5 },
      { metodo: "TARJETA", operaciones: 1, total: 50 },
      { metodo: "TRANSFERENCIA", operaciones: 0, total: 0 },
    ],
  );
  assert.deepEqual(report.productos[0], {
    productoId: 5,
    nombre: "Café",
    cantidad: 3,
    ventas: 150,
    costo: 90,
    ganancia: 60,
  });
  assert.deepEqual(report.horas, [
    { hora: 14, operaciones: 2, total: 175.5 },
  ]);
  assert.equal(state.lastQuery.where.estado, "COMPLETADA");
});
