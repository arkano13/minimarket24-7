import assert from "node:assert/strict";
import { after, before, beforeEach, mock, test } from "node:test";
import bcrypt from "bcryptjs";

const passwordHash = await bcrypt.hash("clave-segura", 4);

const state = {
  user: null,
  moduleAccess: null,
  categories: [],
  audit: [],
};

const prisma = {
  usuario: {
    async findUnique() {
      return state.user;
    },
    async update() {
      return state.user;
    },
  },
  usuarioModulo: {
    async findUnique() {
      return state.moduleAccess;
    },
  },
  categoria: {
    async findMany() {
      return state.categories;
    },
  },
  bitacora: {
    async create({ data }) {
      state.audit.push(data);
      return data;
    },
  },
};

const prismaModule = new URL("../src/lib/prisma.js", import.meta.url);
mock.module(prismaModule.href, { namedExports: { prisma } });

const { app } = await import("../src/app.js");

let server;
let baseUrl;

function activeUser(overrides = {}) {
  return {
    id: 2,
    nombre: "Usuario Caja",
    usuario: "caja",
    contrasenaHash: passwordHash,
    rol: "CAJERO",
    activo: true,
    modulos: [
      {
        modulo: {
          codigo: "PRODUCTOS",
          nombre: "Productos",
          tipo: "OPERATIVO",
        },
      },
    ],
    ...overrides,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

async function login() {
  const { response, body } = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: "CAJA", contrasena: "clave-segura" }),
  });
  assert.equal(response.status, 200);
  return body.token;
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(() => {
  state.user = activeUser();
  state.moduleAccess = { permitido: true, modulo: { activo: true } };
  state.categories = [{ id: 1, nombre: "Bebidas" }];
  state.audit = [];
});

test("responde 404 JSON en rutas inexistentes", async () => {
  const { response, body } = await request("/api/no-existe");

  assert.equal(response.status, 404);
  assert.deepEqual(body, { error: "Ruta no encontrada." });
});

test("rechaza sesiones ausentes o tokens inventados", async () => {
  const missing = await request("/api/productos");
  assert.equal(missing.response.status, 401);
  assert.deepEqual(missing.body, { error: "Sesión no válida." });

  const invalid = await request("/api/productos", {
    headers: { Authorization: "Bearer token-inventado" },
  });
  assert.equal(invalid.response.status, 401);
});

test("valida credenciales y registra intentos fallidos", async () => {
  const empty = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: "", contrasena: "" }),
  });
  assert.equal(empty.response.status, 400);

  const wrong = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: "caja", contrasena: "incorrecta" }),
  });
  assert.equal(wrong.response.status, 401);
  assert.equal(state.audit.at(-1).accion, "LOGIN_FALLIDO");
});

test("login, consulta de sesión, permiso de módulo y logout funcionan juntos", async () => {
  const token = await login();

  const me = await request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.usuario.usuario, "caja");

  const categories = await request("/api/productos/categorias", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(categories.response.status, 200);
  assert.deepEqual(categories.body.categorias, state.categories);

  const logout = await request("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(logout.response.status, 204);

  const expired = await request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(expired.response.status, 401);
});

test("bloquea módulos no asignados", async () => {
  const token = await login();
  state.moduleAccess = { permitido: false, modulo: { activo: true } };

  const result = await request("/api/productos", {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(result.response.status, 403);
  assert.match(result.body.error, /no tienes permiso/i);
});

test("un usuario no administrador no puede abrir configuración", async () => {
  const token = await login();

  const result = await request("/api/configuracion", {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(result.response.status, 403);
  assert.match(result.body.error, /solo un administrador/i);
});

test("solo permite el origen local configurado", async (context) => {
  context.mock.method(console, "error", () => {});

  const allowed = await request("/api/health", {
    headers: { Origin: "http://127.0.0.1:5173" },
  });
  assert.equal(
    allowed.response.headers.get("access-control-allow-origin"),
    "http://127.0.0.1:5173",
  );

  const blocked = await request("/api/health", {
    headers: { Origin: "https://sitio-no-permitido.example" },
  });
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.body.error, "Origen no permitido.");
});
