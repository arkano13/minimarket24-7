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
} = await import("../src/modules/caja/caja.service.js");

beforeEach(() => {
  state.shift = null;
  state.movementId = 0;
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

  const result = await getCurrentCashShift();

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
