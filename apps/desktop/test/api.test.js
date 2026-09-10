import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import {
  cancelSale,
  createSale,
  getSalesReport,
  listBitacora,
  listPurchases,
  listMyCashActivity,
  login,
  logout,
  searchSaleProducts,
} from "../src/services/api.js";

afterEach(() => {
  mock.restoreAll();
});

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return body;
    },
  };
}

test("mi actividad envía fecha, tipo y página sin permitir elegir otro usuario", async () => {
  mock.method(globalThis, "fetch", async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/api/caja/mi-actividad");
    assert.equal(parsed.searchParams.get("fecha"), "2026-08-27");
    assert.equal(parsed.searchParams.get("tipo"), "RETIRO");
    assert.equal(parsed.searchParams.get("page"), "2");
    assert.equal(parsed.searchParams.has("usuarioId"), false);
    assert.equal(options.headers.Authorization, "Bearer token");
    return jsonResponse(200, { registros: [], hayMas: false });
  });
  await listMyCashActivity("token", { fecha: "2026-08-27", tipo: "RETIRO", page: 2, usuarioId: 999 });
});

test("login envía credenciales JSON al backend local", async () => {
  let request;
  mock.method(globalThis, "fetch", async (url, options) => {
    request = { url, options };
    return jsonResponse(200, { token: "abc" });
  });

  const result = await login(" admin ", "secreto");

  assert.deepEqual(result, { token: "abc" });
  assert.equal(request.url, "http://127.0.0.1:3001/api/auth/login");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.options.body), {
    usuario: " admin ",
    contrasena: "secreto",
  });
});

test("las llamadas autenticadas conservan el token y codifican filtros", async () => {
  const urls = [];
  mock.method(globalThis, "fetch", async (url, options) => {
    urls.push({ url, authorization: options.headers.Authorization });
    return jsonResponse(200, {});
  });

  await searchSaleProducts("token-1", "café 500 ml", 7);
  await listPurchases("token-1", "factura #2", 9);
  await getSalesReport("token-1", "2026-08-01", "2026-08-03");
  await listBitacora("token-1", {
    desde: "2026-08-01",
    origen: "CAJA",
    page: 2,
  });

  assert.deepEqual(urls, [
    {
      url: "http://127.0.0.1:3001/api/ventas/productos?buscar=caf%C3%A9+500+ml&clienteId=7",
      authorization: "Bearer token-1",
    },
    {
      url: "http://127.0.0.1:3001/api/compras?buscar=factura+%232&proveedorId=9",
      authorization: "Bearer token-1",
    },
    {
      url: "http://127.0.0.1:3001/api/reportes/ventas?desde=2026-08-01&hasta=2026-08-03",
      authorization: "Bearer token-1",
    },
    {
      url: "http://127.0.0.1:3001/api/bitacora?desde=2026-08-01&origen=CAJA&page=2",
      authorization: "Bearer token-1",
    },
  ]);
});

test("crear y cancelar venta usan métodos y cuerpos correctos", async () => {
  const calls = [];
  mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return jsonResponse(200, { ok: true });
  });

  const sale = {
    productos: [{ presentacionId: 4, cantidad: 2 }],
    metodoPago: "EFECTIVO",
    montoRecibido: 100,
  };

  await createSale("token", sale);
  await cancelSale("token", 33);

  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), sale);
  assert.equal(
    calls[1].url,
    "http://127.0.0.1:3001/api/ventas/33/cancelar",
  );
  assert.equal(calls[1].options.method, "POST");
});

test("logout acepta respuestas 204 sin intentar leer JSON", async () => {
  mock.method(globalThis, "fetch", async () => ({
    status: 204,
    ok: true,
    async json() {
      assert.fail("No debe intentar leer JSON en una respuesta 204");
    },
  }));

  assert.equal(await logout("token"), null);
});

test("los errores del backend se presentan al usuario", async () => {
  mock.method(globalThis, "fetch", async () =>
    jsonResponse(409, { error: "Ya existe una caja abierta." }),
  );

  await assert.rejects(
    () => createSale("token", {}),
    /Ya existe una caja abierta\./,
  );
});

test("usa un mensaje seguro cuando el backend no entrega detalle", async () => {
  mock.method(globalThis, "fetch", async () =>
    jsonResponse(500, {}),
  );

  await assert.rejects(
    () => cancelSale("token", 1),
    /No se pudo completar la solicitud\./,
  );
});

test("reintenta una consulta fallida pero nunca una escritura", async () => {
  let calls = 0;
  mock.method(globalThis, "fetch", async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("Failed to fetch");
    return jsonResponse(200, { compras: [] });
  });
  assert.deepEqual(await listPurchases("token"), { compras: [] });
  assert.equal(calls, 2);

  calls = 0;
  await assert.rejects(() => createSale("token", {}), /Revisa el historial/);
  assert.equal(calls, 1);
});

test("explica respuestas incompletas sin repetir operaciones", async () => {
  let calls = 0;
  mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return { status: 502, ok: false, async json() { throw new SyntaxError("HTML"); } };
  });
  await assert.rejects(() => cancelSale("token", 1), /Revisa el historial/);
  assert.equal(calls, 1);
});

test("solicita historial resumido solo cuando se pide", async () => {
  mock.method(globalThis, "fetch", async (url) => {
    assert.equal(new URL(url).searchParams.get("resumen"), "true");
    return jsonResponse(200, { compras: [] });
  });
  await listPurchases("token", "", "", true);
});
