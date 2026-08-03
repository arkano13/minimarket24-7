import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

const state = {
  supplier: null,
  client: null,
  specialPrice: null,
  adminCount: 1,
  user: null,
  audit: [],
};

const proveedor = {
  async create({ data }) {
    state.supplier = { id: 1, activo: true, ...data };
    return state.supplier;
  },
  async findUnique() {
    return state.supplier;
  },
  async update({ data }) {
    state.supplier = { ...state.supplier, ...data };
    return state.supplier;
  },
};

const clienteEspecial = {
  async create({ data }) {
    state.client = {
      id: 2,
      activo: true,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
      precios: [],
      ...data,
    };
    return state.client;
  },
  async findUnique() {
    return state.client;
  },
  async findFirst() {
    return state.client?.activo ? { id: state.client.id } : null;
  },
  async update({ data }) {
    state.client = { ...state.client, ...data };
    return state.client;
  },
};

const precioEspecialCliente = {
  async upsert({ create, update }) {
    state.specialPrice = state.specialPrice
      ? { ...state.specialPrice, ...update }
      : { id: 9, activo: true, ...create };
    state.client.precios = [
      {
        ...state.specialPrice,
        presentacion: {
          id: 10,
          nombre: "Unidad",
          tipo: "UNIDAD",
          precioBase: "25",
          producto: { id: 5, nombre: "Café", sku: "CAF-1", activo: true },
          codigosBarra: [{ codigo: "123" }],
        },
      },
    ];
    return state.specialPrice;
  },
  async findUnique() {
    return state.specialPrice;
  },
  async update({ data }) {
    state.specialPrice = { ...state.specialPrice, ...data };
    state.client.precios = [];
    return state.specialPrice;
  },
};

const usuario = {
  async findUnique() {
    return state.user;
  },
  async count() {
    return state.adminCount;
  },
  async update({ data }) {
    state.user = { ...state.user, ...data };
    return state.user;
  },
};

const prisma = {
  proveedor,
  clienteEspecial,
  presentacionProducto: {
    async findFirst() {
      return { id: 10 };
    },
  },
  precioEspecialCliente,
  usuario,
  bitacora: {
    async create({ data }) {
      state.audit.push(data);
      return data;
    },
  },
  async $transaction(callback) {
    return callback({
      clienteEspecial,
      presentacionProducto: this.presentacionProducto,
      precioEspecialCliente,
      usuario,
    });
  },
};

const prismaModule = new URL("../src/lib/prisma.js", import.meta.url);
mock.module(prismaModule.href, { namedExports: { prisma } });

const { createSupplier, updateSupplier } = await import(
  "../src/modules/proveedores/proveedores.service.js"
);
const {
  createSpecialClient,
  removeSpecialPrice,
  setSpecialPrice,
} = await import("../src/modules/clientes/clientes.service.js");
const { setUserActive } = await import(
  "../src/modules/usuarios/usuarios.service.js"
);

beforeEach(() => {
  state.supplier = null;
  state.client = null;
  state.specialPrice = null;
  state.adminCount = 1;
  state.user = {
    id: 4,
    nombre: "Administrador",
    usuario: "admin",
    rol: "ADMINISTRADOR",
    activo: true,
    ultimoAcceso: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    modulos: [],
  };
  state.audit = [];
});

test("proveedores valida correo y normaliza sus datos", async () => {
  await assert.rejects(
    () => createSupplier({ nombre: "Proveedor", correo: "correo-invalido" }),
    /correo válido/i,
  );

  const supplier = await createSupplier({
    nombre: "  Proveedor   Uno ",
    contacto: " Ana   López ",
    correo: "VENTAS@EJEMPLO.COM",
  });

  assert.equal(supplier.nombre, "Proveedor Uno");
  assert.equal(supplier.contacto, "Ana López");
  assert.equal(supplier.correo, "ventas@ejemplo.com");
});

test("proveedores rechaza IDs inexistentes al editar", async () => {
  await assert.rejects(
    () => updateSupplier("abc", {}),
    /proveedor no es válido/i,
  );
  await assert.rejects(
    () => updateSupplier(99, { nombre: "Otro" }),
    (error) => error.status === 404 && /proveedor no existe/i.test(error.message),
  );
});

test("clientes normaliza datos y guarda un precio especial", async () => {
  const client = await createSpecialClient({
    nombre: "  Cliente   Frecuente ",
    telefono: " 9999-9999 ",
  });
  assert.equal(client.nombre, "Cliente Frecuente");

  const updated = await setSpecialPrice(client.id, {
    presentacionId: 10,
    precio: 20,
  });
  assert.equal(updated.precios[0].precio, 20);
  assert.equal(updated.precios[0].precioNormal, 25);
  assert.equal(updated.precios[0].codigoBarra, "123");
});

test("clientes valida precios y eliminaciones inexistentes", async () => {
  await assert.rejects(
    () => setSpecialPrice(2, { presentacionId: 10, precio: 0 }),
    /precio especial debe ser mayor que cero/i,
  );
  await assert.rejects(
    () => removeSpecialPrice(2, 10),
    (error) => error.status === 404 && /precio especial no existe/i.test(error.message),
  );
});

test("un usuario no puede desactivar su propia cuenta", async () => {
  await assert.rejects(
    () => setUserActive(4, false, 4),
    /no puedes desactivar tu propia cuenta/i,
  );
});

test("protege al último administrador y permite desactivar si existe otro", async () => {
  await assert.rejects(
    () => setUserActive(4, false, 8),
    /último administrador activo/i,
  );

  state.adminCount = 2;
  const result = await setUserActive(4, false, 8);

  assert.equal(result.activo, false);
  assert.equal(state.audit.at(-1).accion, "DESACTIVAR_USUARIO");
});
