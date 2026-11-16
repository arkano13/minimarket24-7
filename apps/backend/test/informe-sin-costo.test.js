import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://x:x@127.0.0.1:1/x";
const { datosSinCosto } = await import("../src/modules/informes-periodicos/datos-sin-costo.js");

test("agrupa por categoría sin importar mayúsculas y deja 'Sin categoría' al final", async () => {
  const filas = [
    { categoria: null, producto: "Cabuya", presentacion: "Unidad", precio: "50.00", existencia: "10" },
    { categoria: "condimentos", producto: "Anís", presentacion: "Unidad", precio: "3.00", existencia: "25" },
    { categoria: "Condimentos", producto: "Azúcar", presentacion: "Unidad", precio: "17.00", existencia: "56" },
    { categoria: "Abarrotes", producto: "Aceite libra", presentacion: "Unidad", precio: "25.00", existencia: "0.7812" },
  ];
  const datos = await datosSinCosto({ db: { $queryRaw: async () => filas } });
  assert.deepEqual(datos.categorias.map((c) => c.nombre), ["Abarrotes", "Condimentos", "Sin categoría"]);
  assert.equal(datos.categorias[1].productos.length, 2);
  assert.equal(datos.categorias[0].productos[0].existencia, 0.78);
  assert.equal(datos.total, 4);
});
