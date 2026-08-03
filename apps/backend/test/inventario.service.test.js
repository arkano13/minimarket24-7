import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const state = {
  product: null,
  productUpdate: null,
  movementData: null,
};

function product(overrides = {}) {
  return {
    id: 5,
    nombre: "Café",
    stockActual: "10",
    costoPromedio: "2",
    presentaciones: [
      {
        id: 10,
        nombre: "Unidad",
        tipo: "UNIDAD",
        factorInventario: "1",
        esPrincipal: true,
      },
    ],
    ...overrides,
  };
}

const transaction = {
  producto: {
    async findFirst() {
      return state.product;
    },
    async update({ data }) {
      state.productUpdate = data;
      state.product.stockActual = data.stockActual;
      state.product.costoPromedio = data.costoPromedio;
      return state.product;
    },
  },
  movimientoInventario: {
    async create({ data }) {
      state.movementData = data;
      return {
        id: 1,
        ...data,
        creadoEn: new Date("2026-08-03T12:00:00Z"),
        producto: state.product,
        usuario: { id: data.usuarioId, nombre: "Bodega" },
      };
    },
  },
};

const prisma = {
  movimientoInventario: {
    async findMany() {
      return [];
    },
  },
  async $transaction(callback) {
    return callback(transaction);
  },
};

const prismaModule = new URL("../src/lib/prisma.js", import.meta.url);
mock.module(prismaModule.href, { namedExports: { prisma } });

const { createInventoryMovement, listInventoryMovements } = await import(
  "../src/modules/inventario/inventario.service.js"
);

beforeEach(() => {
  state.product = product();
  state.productUpdate = null;
  state.movementData = null;
});

test("valida producto, cantidad, tipo y motivo de una salida", async () => {
  await assert.rejects(
    () => createInventoryMovement({
      productoId: 0,
      tipoMovimiento: "ENTRADA",
      cantidad: 1,
    }, 2),
    /producto no es válido/i,
  );

  await assert.rejects(
    () => createInventoryMovement({
      productoId: 5,
      tipoMovimiento: "OTRO",
      cantidad: 1,
    }, 2),
    /tipo de movimiento válido/i,
  );

  await assert.rejects(
    () => createInventoryMovement({
      productoId: 5,
      tipoMovimiento: "SALIDA",
      cantidad: 1,
      motivo: "   ",
    }, 2),
    /motivo de la salida/i,
  );
});

test("impide una salida mayor al stock", async () => {
  await assert.rejects(
    () => createInventoryMovement({
      productoId: 5,
      tipoMovimiento: "SALIDA",
      cantidad: 11,
      motivo: "Producto dañado",
    }, 2),
    /supera la existencia disponible/i,
  );
  assert.equal(state.productUpdate, null);
});

test("una entrada actualiza stock y costo promedio ponderado", async () => {
  const result = await createInventoryMovement({
    productoId: 5,
    tipoMovimiento: "ENTRADA",
    cantidad: 10,
    costo: 4,
  }, 2);

  assert.equal(Number(state.productUpdate.stockActual), 20);
  assert.equal(Number(state.productUpdate.costoPromedio), 3);
  assert.equal(state.movementData.tipo, "COMPRA");
  assert.equal(result.cantidad, 10);
  assert.equal(result.saldoPosterior, 20);
  assert.equal(result.costo, 4);
});

test("una salida descuenta stock y normaliza su motivo", async () => {
  const result = await createInventoryMovement({
    productoId: 5,
    tipoMovimiento: "SALIDA",
    cantidad: 3,
    motivo: "  Producto   dañado ",
  }, 2);

  assert.equal(Number(state.productUpdate.stockActual), 7);
  assert.equal(Number(state.productUpdate.costoPromedio), 2);
  assert.equal(state.movementData.tipo, "AJUSTE_NEGATIVO");
  assert.equal(state.movementData.motivo, "Producto dañado");
  assert.equal(result.saldoPosterior, 7);
});

test("rechaza filtros de producto inválidos al listar", async () => {
  await assert.rejects(
    () => listInventoryMovements("abc"),
    /producto no es válido/i,
  );
});
