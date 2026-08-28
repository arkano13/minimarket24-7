import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

function makeShift(overrides = {}) {
  return {
    id: 1,
    estado: "ABIERTO",
    fondoInicial: "500",
    efectivoEsperadoCierre: null,
    efectivoContado: null,
    diferencia: null,
    abiertoEn: new Date("2026-08-03T08:00:00Z"),
    cerradoEn: null,
    usuarioApertura: { id: 2, nombre: "Caja" },
    usuarioCierre: null,
    ventas: [],
    movimientos: [],
    ...overrides,
  };
}

const state = {
  shift: null,
  movementId: 0,
};

const turnoCaja = {
  async findFirst() {
    return state.shift;
  },
  async create({ data }) {
    state.shift = makeShift({
      usuarioApertura: { id: data.usuarioAperturaId, nombre: "Caja" },
      fondoInicial: data.fondoInicial,
    });
    return state.shift;
  },
  async update({ data }) {
    state.shift = {
      ...state.shift,
      ...data,
      usuarioCierre: { id: data.usuarioCierreId, nombre: "Supervisor" },
    };
    return state.shift;
  },
};

const movimientoCaja = {
  async findMany(query) {
    state.activityQuery = query;
    return state.activity.filter((item) => item.usuarioId === query.where.usuarioId && item.tipo === query.where.tipo)
      .slice(query.skip, query.skip + query.take);
  },
  async create({ data }) {
    const movement = {
      id: ++state.movementId,
      ...data,
      creadoEn: new Date("2026-08-03T12:00:00Z"),
      usuario: { id: data.usuarioId, nombre: "Caja" },
    };
    state.shift.movimientos.unshift(movement);
    return movement;
  },
};

const transaction = { turnoCaja, movimientoCaja };
const prisma = {
  venta: {
    async findMany(query) {
      state.activityQuery = query;
      return state.activity.filter((item) => item.usuarioId === query.where.usuarioId)
        .slice(query.skip, query.skip + query.take);
    },
  },
  turnoCaja,
  movimientoCaja,
  async $transaction(callback) {
    return callback(transaction);
  },
};

const prismaModule = new URL("../src/lib/prisma.js", import.meta.url);
mock.module(prismaModule.href, { namedExports: { prisma } });

const {
  closeCashShift,
  createCashMovement,
  getCurrentCashShift,
  openCashShift,
  listMyCashActivity,
} = await import("../src/modules/caja/caja.service.js");

beforeEach(() => {
  state.shift = null;
  state.movementId = 0;
  state.activity = [];
  state.activityQuery = null;
});

test("mi actividad pagina ventas propias, incluidas canceladas, con fecha de Honduras", async () => {
  state.activity = Array.from({ length: 22 }, (_, index) => ({
    id: index + 1, usuarioId: 2, turnoCajaId: 1, creadoEn: new Date("2026-08-27T20:00:00Z"),
    total: "50", estado: index === 0 ? "CANCELADA" : "COMPLETADA",
    detalles: [{ id: 1, productoNombre: "Pan", presentacionNombre: "Unidad", cantidad: "2", subtotal: "50" }],
    pagos: [{ metodo: "EFECTIVO", monto: "50" }],
  }));
  state.activity.unshift({ ...state.activity[0], id: 999, usuarioId: 3 });
  const first = await listMyCashActivity(2, { fecha: "2026-08-27", usuarioId: 3 });
  assert.equal(first.registros.length, 20);
  assert.equal(first.hayMas, true);
  assert.equal(first.registros[0].id, 1);
  assert.equal(first.registros[0].estado, "CANCELADA");
  assert.equal(first.registros[0].productos[0].cantidad, 2);
  assert.equal(state.activityQuery.where.usuarioId, 2);
  assert.equal(state.activityQuery.where.creadoEn.gte.toISOString(), "2026-08-27T06:00:00.000Z");
  assert.equal(state.activityQuery.where.creadoEn.lt.toISOString(), "2026-08-28T06:00:00.000Z");
  const second = await listMyCashActivity(2, { fecha: "2026-08-27", page: 2 });
  assert.deepEqual(second.registros.map((item) => item.id), [21, 22]);
  assert.equal(second.hayMas, false);
});

test("mi actividad filtra ingresos y retiros por autor, no por quien abrió caja", async () => {
  state.activity = [
    { id: 1, usuarioId: 2, tipo: "INGRESO", monto: "25", motivo: "Cambio" },
    { id: 2, usuarioId: 3, tipo: "INGRESO", monto: "80", motivo: "Otro usuario" },
    { id: 3, usuarioId: 2, tipo: "RETIRO", monto: "10", motivo: "Pago" },
  ];
  const incomes = await listMyCashActivity(2, { tipo: "INGRESO" });
  assert.deepEqual(incomes.registros.map((item) => item.id), [1]);
  assert.equal(incomes.registros[0].monto, 25);
  const withdrawals = await listMyCashActivity(2, { tipo: "RETIRO" });
  assert.deepEqual(withdrawals.registros.map((item) => item.id), [3]);
});

test("valida identidad, fecha, tipo y página antes de consultar actividad", async () => {
  await assert.rejects(() => listMyCashActivity(undefined), (error) => error.status === 401);
  for (const filters of [{ fecha: "2026-02-30" }, { fecha: "" }, { tipo: "TODOS" }, { page: -1 }, { page: "abc" }]) {
    await assert.rejects(() => listMyCashActivity(2, filters), (error) => error.status === 400);
  }
  assert.equal(state.activityQuery, null);
});

test("caja no expone movimientos ajenos pero conserva el saldo compartido", async () => {
  state.shift = makeShift({ movimientos: [
    { id: 1, tipo: "INGRESO", monto: "20", usuario: { id: 2 } },
    { id: 2, tipo: "INGRESO", monto: "80", usuario: { id: 3 } },
  ] });
  const current = await getCurrentCashShift(2);
  assert.equal(current.efectivoEsperado, 600);
  assert.deepEqual(current.movimientos.map((item) => item.id), [1]);
  const updated = await createCashMovement({ tipo: "INGRESO", monto: 10, motivo: "Cambio" }, 2);
  assert.ok(updated.movimientos.every((item) => item.usuario.id === 2));
  const closed = await closeCashShift({ efectivoContado: 610 }, 2);
  assert.equal(closed.diferencia, 0);
  assert.ok(closed.movimientos.every((item) => item.usuario.id === 2));
});

test("no permite abrir una segunda caja", async () => {
  state.shift = makeShift();

  await assert.rejects(
    () => openCashShift({ fondoInicial: 500 }, 2),
    (error) => error.status === 409 && /ya existe una caja abierta/i.test(error.message),
  );
});

test("valida el fondo y abre una caja", async () => {
  await assert.rejects(
    () => openCashShift({ fondoInicial: -0.01 }, 2),
    /cero o mayor/i,
  );

  const result = await openCashShift({ fondoInicial: "750.25" }, 2);

  assert.equal(result.estado, "ABIERTO");
  assert.equal(result.fondoInicial, 750.25);
  assert.equal(result.efectivoEsperado, 750.25);
});

test("calcula efectivo, tarjeta, transferencia, ingresos y retiros", async () => {
  state.shift = makeShift({
    ventas: [
      {
        id: 1,
        total: "175",
        pagos: [
          { metodo: "EFECTIVO", monto: "100" },
          { metodo: "TARJETA", monto: "50" },
          { metodo: "TRANSFERENCIA", monto: "25" },
        ],
      },
    ],
    movimientos: [
      { id: 1, tipo: "INGRESO", monto: "20", motivo: "Cambio", creadoEn: new Date(), usuario: { id: 2, nombre: "Caja" } },
      { id: 2, tipo: "RETIRO", monto: "30", motivo: "Pago", creadoEn: new Date(), usuario: { id: 2, nombre: "Caja" } },
    ],
  });

  const result = await getCurrentCashShift(2);

  assert.equal(result.efectivoEsperado, 590);
  assert.deepEqual(result.totales, {
    cantidadVentas: 1,
    ventas: 175,
    efectivo: 100,
    tarjeta: 50,
    transferencia: 25,
    ingresos: 20,
    retiros: 30,
  });
});

test("impide retirar más efectivo del esperado", async () => {
  state.shift = makeShift({ fondoInicial: "100" });

  await assert.rejects(
    () => createCashMovement(
      { tipo: "RETIRO", monto: 100.01, motivo: "Pago" },
      2,
    ),
    /supera el efectivo esperado/i,
  );
  assert.equal(state.shift.movimientos.length, 0);
});

test("registra movimientos y normaliza el motivo", async () => {
  state.shift = makeShift();

  const result = await createCashMovement(
    { tipo: "ingreso", monto: 25, motivo: "  Cambio   extra  " },
    2,
  );

  assert.equal(result.totales.ingresos, 25);
  assert.equal(result.movimientos[0].motivo, "Cambio extra");
  assert.equal(result.efectivoEsperado, 525);
});

test("cierra la caja y calcula diferencia de efectivo", async () => {
  state.shift = makeShift({
    ventas: [
      {
        id: 1,
        total: "100",
        pagos: [{ metodo: "EFECTIVO", monto: "100" }],
      },
    ],
  });

  const result = await closeCashShift({ efectivoContado: 590 }, 3);

  assert.equal(result.estado, "CERRADO");
  assert.equal(result.efectivoEsperado, 600);
  assert.equal(result.efectivoContado, 590);
  assert.equal(result.diferencia, -10);
  assert.equal(result.usuarioCierre.id, 3);
});
