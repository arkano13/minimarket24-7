import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { Prisma } from "@prisma/client";

const state = {
  supplier: null,
  presentations: [],
  purchase: null,
  product: null,
  productUpdates: [],
  movements: [],
  audit: [],
};

const compra = {
  async create({ data }) {
    state.purchase = {
      id: 70,
      proveedorId: data.proveedorId,
      proveedorNombre: data.proveedorNombre,
      usuario: { id: data.usuarioId, nombre: "Bodega" },
      numeroDocumento: data.numeroDocumento,
      notas: data.notas,
      total: data.total,
      estado: "RECIBIDA",
      creadoEn: new Date("2026-08-03T12:00:00Z"),
      anuladaEn: null,
      detalles: data.detalles.create.map((detail, index) => ({ id: index + 1, ...detail })),
    };
    return state.purchase;
  },
  async findUnique() {
    return state.purchase;
  },
  async update({ data }) {
    state.purchase = { ...state.purchase, ...data };
    return state.purchase;
  },
};

const producto = {
  async findUnique() {
    return state.product;
  },
  async update({ data }) {
    state.productUpdates.push(data);

    if (data.stockActual?.decrement !== undefined) {
      state.product.stockActual = new Prisma.Decimal(state.product.stockActual)
        .sub(data.stockActual.decrement);
    } else {
      state.product.stockActual = data.stockActual;
      state.product.costoPromedio = data.costoPromedio;
    }

    return {
      stockActual: state.product.stockActual,
      costoPromedio: state.product.costoPromedio,
    };
  },
};

const transaction = {
  proveedor: {
    async findFirst() {
      return state.supplier;
    },
  },
  presentacionProducto: {
    async findMany() {
      return state.presentations;
    },
  },
  compra,
  producto,
  movimientoInventario: {
    async createMany({ data }) {
      state.movements.push(...data);
      state.movementBatches += 1;
      return { count: data.length };
    },
    async create({ data }) {
      state.movements.push(data);
      return data;
    },
  },
};

const prisma = {
  compra: {
    async findMany(query) {
      state.listQuery = query;
      return [{ ...state.purchase, detalles: query.include.detalles ? state.purchase.detalles : undefined }];
    },
  },
  bitacora: {
    async create({ data }) {
      state.audit.push(data);
      return data;
    },
  },
  async $transaction(callback) {
    return callback(transaction);
  },
};

const prismaModule = new URL("../src/lib/prisma.js", import.meta.url);
mock.module(prismaModule.href, { namedExports: { prisma } });

const { cancelPurchase, createPurchase, listPurchases } = await import(
  "../src/modules/compras/compras.service.js"
);

function presentation() {
  return {
    id: 10,
    productoId: 5,
    nombre: "Caja de 20",
    factorInventario: "20",
    producto: {
      id: 5,
      nombre: "Refresco",
      stockActual: "60",
      costoPromedio: "4",
    },
  };
}

function purchaseInput(overrides = {}) {
  return {
    proveedorId: 3,
    numeroDocumento: " FAC-001 ",
    notas: " Compra   semanal ",
    productos: [{ presentacionId: 10, cantidad: 2, costo: 100 }],
    ...overrides,
  };
}

beforeEach(() => {
  state.supplier = { id: 3, nombre: "Proveedor Uno" };
  state.presentations = [presentation()];
  state.purchase = null;
  state.product = {
    nombre: "Refresco",
    stockActual: new Prisma.Decimal(60),
    costoPromedio: new Prisma.Decimal(4),
  };
  state.productUpdates = [];
  state.movements = [];
  state.audit = [];
  state.movementBatches = 0;
});

test("divide el costo total sin alterar el importe por redondeo", async () => {
  state.presentations[0].factorInventario = "1";
  const result = await createPurchase(purchaseInput({
    productos: [{ presentacionId: 10, cantidad: 300, costoTotal: "100.00" }],
  }), 2);
  assert.equal(result.total, 100);
  assert.equal(result.productos[0].subtotal, 100);
  assert.equal(result.productos[0].costo, 0.3333);
  assert.equal(Number(state.product.stockActual), 360);
  assert.equal(Number(state.product.costoPromedio), 0.9444);
});

test("acepta 300 cervezas por 6000 y calcula 20 por unidad", async () => {
  state.presentations[0].factorInventario = "1";
  const result = await createPurchase(purchaseInput({
    productos: [{ presentacionId: 10, cantidad: 300, costoTotal: 6000 }],
  }), 2);
  assert.equal(result.productos[0].costo, 20);
  assert.equal(result.total, 6000);
});

test("el historial resumido omite detalles y conserva el contrato anterior por defecto", async () => {
  await createPurchase(purchaseInput(), 2);
  const summaries = await listPurchases("", null, true);
  assert.equal(state.listQuery.include.detalles, undefined);
  assert.equal(summaries[0].productos, undefined);
  assert.equal(summaries[0].total, 200);
  const full = await listPurchases();
  assert.equal(full[0].productos.length, 1);
});

test("valida el total y no acepta fracciones de centavo", async () => {
  for (const costoTotal of [0, -1, "abc", "", "0.001"]) {
    await assert.rejects(() => createPurchase(purchaseInput({
      productos: [{ presentacionId: 10, cantidad: 300, costoTotal }],
    }), 2), /costo total/i);
  }
});

test("registra 100 productos con un solo lote de movimientos", async () => {
  state.presentations = Array.from({ length: 100 }, (_, index) => ({
    ...presentation(), id: index + 1, productoId: index + 1,
  }));
  const result = await createPurchase(purchaseInput({
    productos: state.presentations.map(({ id }) => ({
      presentacionId: id, cantidad: 3, costoTotal: 100,
    })),
  }), 2);
  assert.equal(result.total, 10000);
  assert.equal(result.productos.length, 100);
  assert.equal(state.movements.length, 100);
  assert.equal(state.movementBatches, 1);
});

test("valida proveedor, productos y líneas duplicadas", async () => {
  await assert.rejects(
    () => createPurchase(purchaseInput({ proveedorId: 0 }), 2),
    /proveedor no es válido/i,
  );

  await assert.rejects(
    () => createPurchase(purchaseInput({ productos: [] }), 2),
    /al menos un producto/i,
  );

  await assert.rejects(
    () => createPurchase(purchaseInput({
      productos: [
        { presentacionId: 10, cantidad: 1, costo: 100 },
        { presentacionId: 10, cantidad: 2, costo: 90 },
      ],
    }), 2),
    /aparece más de una vez/i,
  );
});

test("rechaza proveedores inactivos y presentaciones no disponibles", async () => {
  state.supplier = null;
  await assert.rejects(
    () => createPurchase(purchaseInput(), 2),
    (error) => error.status === 404 && /proveedor no existe/i.test(error.message),
  );

  state.supplier = { id: 3, nombre: "Proveedor Uno" };
  state.presentations = [];
  await assert.rejects(
    () => createPurchase(purchaseInput(), 2),
    /productos? ya no está disponible/i,
  );
});

test("recibe cajas, convierte a unidades y recalcula costo promedio", async () => {
  const result = await createPurchase(purchaseInput(), 2);

  assert.equal(result.total, 200);
  assert.equal(result.productos[0].cantidad, 2);
  assert.equal(result.productos[0].cantidadInventario, 40);
  assert.equal(result.productos[0].costoInventario, 5);
  assert.equal(result.numeroDocumento, "FAC-001");
  assert.equal(result.notas, "Compra semanal");
  assert.equal(Number(state.product.stockActual), 100);
  assert.equal(Number(state.product.costoPromedio), 4.4);
  assert.equal(state.movements[0].tipo, "COMPRA");
  assert.equal(Number(state.movements[0].cantidad), 40);
});

test("no permite anular si parte del inventario comprado ya se vendió", async () => {
  state.purchase = {
    id: 70,
    proveedorId: 3,
    proveedorNombre: "Proveedor Uno",
    usuario: { id: 2, nombre: "Bodega" },
    numeroDocumento: null,
    notas: null,
    total: "200",
    estado: "RECIBIDA",
    creadoEn: new Date(),
    anuladaEn: null,
    detalles: [
      {
        id: 1,
        productoId: 5,
        presentacionId: 10,
        productoNombre: "Refresco",
        presentacionNombre: "Caja de 20",
        cantidad: new Prisma.Decimal(2),
        factorInventario: new Prisma.Decimal(20),
        cantidadInventario: new Prisma.Decimal(40),
        costoPresentacion: new Prisma.Decimal(100),
        costoUnitarioInventario: new Prisma.Decimal(5),
        subtotal: new Prisma.Decimal(200),
      },
    ],
  };
  state.product.stockActual = new Prisma.Decimal(30);

  await assert.rejects(
    () => cancelPurchase(70, 2),
    /parte del inventario.*ya se vendió/i,
  );
  assert.equal(state.productUpdates.length, 0);
});

test("anula una compra, revierte stock y registra bitácora", async () => {
  await createPurchase(purchaseInput(), 2);

  const result = await cancelPurchase(70, 2);

  assert.equal(result.estado, "ANULADA");
  assert.equal(Number(state.product.stockActual), 60);
  assert.equal(state.movements.at(-1).tipo, "ANULACION_COMPRA");
  assert.equal(Number(state.movements.at(-1).cantidad), -40);
  assert.equal(state.audit.at(-1).accion, "ANULAR_COMPRA");
});
