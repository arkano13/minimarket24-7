import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const shifts = [
  { id: 1, nombre: "Turno 1", orden: 1, minutoInicio: 480, minutoFin: 1320, activo: true },
  { id: 2, nombre: "Turno 2", orden: 2, minutoInicio: 1320, minutoFin: 120, activo: true },
  { id: 3, nombre: "Turno 3", orden: 3, minutoInicio: 120, minutoFin: 480, activo: true },
];

const state = {
  categoryExists: true,
  createData: null,
  initialMovement: null,
};

const transaction = {
  franjaHorariaPrecio: {
    async findMany() {
      return shifts;
    },
  },
  categoria: {
    async findFirst() {
      return state.categoryExists ? { id: 4 } : null;
    },
  },
  producto: {
    async create({ data }) {
      state.createData = data;
      const item = data.presentaciones.create;
      const barcode = item.codigosBarra?.create;
      const shiftPrices = item.preciosHorario?.create ?? [];
      return {
        id: 20,
        sku: data.sku,
        nombre: data.nombre,
        descripcion: data.descripcion,
        modoPrecio: data.modoPrecio,
        stockActual: data.stockActual,
        stockMinimo: data.stockMinimo,
        costoPromedio: data.costoPromedio,
        activo: true,
        categoria: data.categoriaId ? { id: data.categoriaId, nombre: "Granos" } : null,
        presentaciones: [
          {
            id: 21,
            nombre: item.nombre,
            tipo: item.tipo,
            factorInventario: item.factorInventario,
            precioBase: item.precioBase,
            esPrincipal: true,
            codigosBarra: barcode ? [{ id: 1, ...barcode }] : [],
            preciosHorario: shiftPrices.map((price) => ({
              ...price,
              franja: shifts.find((shift) => shift.id === price.franjaId),
            })),
          },
        ],
      };
    },
  },
  movimientoInventario: {
    async create({ data }) {
      state.initialMovement = data;
      return data;
    },
  },
};

const prisma = {
  bitacora: {
    async create({ data }) {
      return data;
    },
  },
  async $transaction(callback) {
    return callback(transaction);
  },
};

const prismaModule = new URL("../src/lib/prisma.js", import.meta.url);
mock.module(prismaModule.href, { namedExports: { prisma } });

const { createProduct } = await import(
  "../src/modules/productos/productos.service.js"
);

function validProduct(overrides = {}) {
  return {
    nombre: "  Café   molido ",
    descripcion: "Paquete premium",
    sku: "CAF-001",
    codigoBarra: "870729000045",
    categoriaId: 4,
    tipoVenta: "UNIDAD",
    precio: 25,
    cambiaPrecioTurno: false,
    costo: 15,
    stockInicial: 10,
    stockMinimo: 2,
    ...overrides,
  };
}

beforeEach(() => {
  state.categoryExists = true;
  state.createData = null;
  state.initialMovement = null;
});

test("valida nombre, tipo de venta, precio y categoría", async () => {
  await assert.rejects(
    () => createProduct(validProduct({ nombre: "" }), 2),
    /nombre del producto es obligatorio/i,
  );
  await assert.rejects(
    () => createProduct(validProduct({ tipoVenta: "OTRO" }), 2),
    /forma de venta válida/i,
  );
  await assert.rejects(
    () => createProduct(validProduct({ precio: 0 }), 2),
    /precio debe ser un número mayor que cero/i,
  );

  state.categoryExists = false;
  await assert.rejects(
    () => createProduct(validProduct(), 2),
    /categoría seleccionada no existe/i,
  );
});

test("crea producto unitario, código de barras e inventario inicial", async () => {
  const result = await createProduct(validProduct(), 2);

  assert.equal(result.nombre, "Café molido");
  assert.equal(result.stock, 10);
  assert.equal(result.stockMinimo, 2);
  assert.equal(result.costo, 15);
  assert.equal(result.presentacionPrincipal.codigoBarra, "870729000045");
  assert.equal(state.createData.unidadInventario, "UNIDAD");
  assert.equal(Number(state.createData.stockActual), 10);
  assert.equal(state.initialMovement.tipo, "INVENTARIO_INICIAL");
  assert.equal(Number(state.initialMovement.cantidad), 10);
});

test("convierte kilogramos visibles a gramos internos sin alterar valores visibles", async () => {
  const result = await createProduct(validProduct({
    tipoVenta: "PESO",
    stockInicial: 2.5,
    stockMinimo: 0.5,
    costo: 80,
    precio: 120,
  }), 2);

  assert.equal(state.createData.unidadInventario, "GRAMO");
  assert.equal(Number(state.createData.stockActual), 2500);
  assert.equal(Number(state.createData.stockMinimo), 500);
  assert.equal(Number(state.createData.costoPromedio), 0.08);
  assert.equal(result.stock, 2.5);
  assert.equal(result.stockMinimo, 0.5);
  assert.equal(result.costo, 80);
});

test("guarda los tres precios cuando el producto cambia por turno", async () => {
  const result = await createProduct(validProduct({
    cambiaPrecioTurno: true,
    precio: 25,
    precioTurno2: 30,
    precioTurno3: 35,
  }), 2);

  assert.equal(state.createData.modoPrecio, "POR_HORARIO");
  assert.deepEqual(
    result.presentacionPrincipal.preciosTurno.map(({ turno, precio }) => ({ turno, precio })),
    [
      { turno: 1, precio: 25 },
      { turno: 2, precio: 30 },
      { turno: 3, precio: 35 },
    ],
  );
});

test("no crea movimiento inicial cuando el stock comienza en cero", async () => {
  await createProduct(validProduct({ stockInicial: 0 }), 2);
  assert.equal(state.initialMovement, null);
});
