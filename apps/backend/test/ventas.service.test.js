import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const state = {
  openShift: { id: 8 },
  specialClient: null,
  searchPresentations: [],
  salePresentations: [],
  createdSaleData: null,
  stockUpdates: [],
  inventoryMovements: [],
};

const rootPresentation = {
  async findMany() {
    return state.searchPresentations;
  },
};

const transaction = {
  turnoCaja: {
    async findFirst() {
      return state.openShift;
    },
  },
  clienteEspecial: {
    async findFirst() {
      return state.specialClient;
    },
  },
  presentacionProducto: {
    async findMany() {
      return state.salePresentations;
    },
  },
  venta: {
    async create({ data }) {
      state.createdSaleData = data;
      return {
        id: 44,
        estado: "COMPLETADA",
        subtotal: data.subtotal,
        total: data.total,
        creadoEn: new Date("2026-08-03T12:00:00Z"),
        clienteEspecialId: data.clienteEspecialId,
        clienteNombre: data.clienteNombre,
        usuario: { id: data.usuarioId, nombre: "Caja" },
        detalles: data.detalles.create.map((detail, index) => ({
          id: index + 1,
          ...detail,
        })),
        pagos: [{ id: 1, ...data.pagos.create }],
      };
    },
  },
  producto: {
    async updateMany({ where, data }) {
      state.stockUpdates.push({ where, data });
      return { count: 1 };
    },
    async findUnique() {
      return { stockActual: "7", costoPromedio: "4" };
    },
  },
  movimientoInventario: {
    async create({ data }) {
      state.inventoryMovements.push(data);
      return data;
    },
  },
};

const prisma = {
  clienteEspecial: {
    async findFirst() {
      return state.specialClient;
    },
  },
  presentacionProducto: rootPresentation,
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

const {
  createSale,
  repriceCartForClient,
  searchSaleProducts,
} = await import("../src/modules/ventas/ventas.service.js");

function presentation(overrides = {}) {
  return {
    id: 10,
    productoId: 5,
    nombre: "Unidad",
    tipo: "UNIDAD",
    factorInventario: "1",
    precioBase: "10",
    codigosBarra: [{ codigo: "123456", principal: true }],
    preciosHorario: [],
    preciosEspeciales: [],
    producto: {
      id: 5,
      nombre: "Café",
      sku: "CAF-1",
      modoPrecio: "UNICO",
      stockActual: "10",
      costoPromedio: "4",
      categoria: { id: 2, nombre: "Bebidas" },
    },
    ...overrides,
  };
}

beforeEach(() => {
  state.openShift = { id: 8 };
  state.specialClient = null;
  state.searchPresentations = [];
  state.salePresentations = [];
  state.createdSaleData = null;
  state.stockUpdates = [];
  state.inventoryMovements = [];
});

test("valida productos y método de pago antes de abrir transacción", async () => {
  await assert.rejects(
    () => createSale({ productos: [], metodoPago: "EFECTIVO" }, 2),
    /al menos un producto/i,
  );

  await assert.rejects(
    () => createSale({
      productos: [{ presentacionId: 1, cantidad: 1 }],
      metodoPago: "CHEQUE",
    }, 2),
    /método de pago válido/i,
  );

  await assert.rejects(
    () => createSale({
      productos: [{ presentacionId: 1, cantidad: 0 }],
      metodoPago: "EFECTIVO",
    }, 2),
    /cantidad debe ser mayor que cero/i,
  );
});

test("exige una caja abierta para vender", async () => {
  state.openShift = null;

  await assert.rejects(
    () => createSale({
      productos: [{ presentacionId: 10, cantidad: 1 }],
      metodoPago: "EFECTIVO",
      montoRecibido: 20,
    }, 2),
    /abrir la caja antes de vender/i,
  );
});

test("aplica precio por turno y prioriza coincidencia exacta de código", async () => {
  const minute = new Date().getHours() * 60 + new Date().getMinutes();
  const timed = presentation({
    producto: {
      ...presentation().producto,
      modoPrecio: "POR_HORARIO",
    },
    preciosHorario: [
      {
        precio: "15.5",
        franja: {
          activo: true,
          orden: 2,
          nombre: "Noche",
          minutoInicio: (minute + 1439) % 1440,
          minutoFin: (minute + 1) % 1440,
        },
      },
    ],
  });
  state.searchPresentations = [
    presentation({
      id: 11,
      codigosBarra: [{ codigo: "999", principal: true }],
      producto: { ...presentation().producto, id: 6, nombre: "Otro" },
    }),
    timed,
  ];

  const result = await searchSaleProducts("123456");

  assert.equal(result[0].presentacionId, 10);
  assert.equal(result[0].precio, 15.5);
  assert.equal(result[0].precioOrigen, "TURNO_2");
  assert.equal(result[0].turno.nombre, "Noche");
  assert.equal(result[0].coincidenciaExacta, true);
});

test("el precio especial del cliente tiene prioridad sobre el turno", async () => {
  state.specialClient = { id: 7 };
  state.searchPresentations = [
    presentation({
      preciosEspeciales: [{ precio: "8.25" }],
    }),
  ];

  const result = await searchSaleProducts("", 7);

  assert.equal(result[0].precio, 8.25);
  assert.equal(result[0].precioOrigen, "CLIENTE_ESPECIAL");
  assert.equal(result[0].precioEspecial, true);
});

test("rechaza un cliente especial inexistente", async () => {
  await assert.rejects(
    () => repriceCartForClient([10], 999),
    (error) => error.status === 404 && /cliente especial no existe/i.test(error.message),
  );
});

test("combina líneas repetidas, descuenta stock y calcula cambio", async () => {
  state.salePresentations = [presentation()];

  const result = await createSale({
    productos: [
      { presentacionId: 10, cantidad: 1 },
      { presentacionId: 10, cantidad: 2 },
    ],
    metodoPago: "efectivo",
    montoRecibido: 50,
  }, 2);

  assert.equal(result.total, 30);
  assert.equal(result.productos.length, 1);
  assert.equal(result.productos[0].cantidad, 3);
  assert.equal(result.pago.recibido, 50);
  assert.equal(result.pago.cambio, 20);
  assert.equal(state.stockUpdates.length, 1);
  assert.equal(Number(state.stockUpdates[0].data.stockActual.decrement), 3);
  assert.equal(state.inventoryMovements.length, 1);
  assert.equal(Number(state.inventoryMovements[0].cantidad), 3);
});

test("no crea la venta si falta inventario o efectivo", async () => {
  state.salePresentations = [
    presentation({
      producto: { ...presentation().producto, stockActual: "1" },
    }),
  ];

  await assert.rejects(
    () => createSale({
      productos: [{ presentacionId: 10, cantidad: 2 }],
      metodoPago: "EFECTIVO",
      montoRecibido: 50,
    }, 2),
    /existencia suficiente/i,
  );
  assert.equal(state.createdSaleData, null);

  state.salePresentations = [presentation()];
  await assert.rejects(
    () => createSale({
      productos: [{ presentacionId: 10, cantidad: 2 }],
      metodoPago: "EFECTIVO",
      montoRecibido: 10,
    }, 2),
    /efectivo recibido es menor/i,
  );
  assert.equal(state.createdSaleData, null);
});
