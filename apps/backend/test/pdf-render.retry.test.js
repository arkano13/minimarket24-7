import assert from "node:assert/strict";
import { mock, test } from "node:test";

let launches = 0;
let closed = 0;
mock.module("puppeteer", { defaultExport: {
  launch: async () => {
    if (++launches === 1) throw new Error("Chromium no disponible");
    return {
      on() {},
      newPage: async () => ({
        setContent: async () => {}, pdf: async () => new Uint8Array([1, 2]),
        close: async () => { closed++; },
      }),
    };
  },
} });
const { renderHtmlToPdf } = await import("../src/lib/pdf-render.js");
test("la cola puede volver a generar PDF después de un fallo de Chromium", async () => {
  await assert.rejects(renderHtmlToPdf("prueba"), /Chromium/);
  assert.ok(Buffer.isBuffer(await renderHtmlToPdf("prueba")));
  await renderHtmlToPdf("prueba");
  assert.equal(launches, 2);
  assert.equal(closed, 2);
});
