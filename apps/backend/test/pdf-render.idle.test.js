import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.PDF_BROWSER_IDLE_MS = "20";
let launches = 0;
let browsersClosed = 0;
mock.module("puppeteer", { defaultExport: {
  launch: async () => {
    launches++;
    return {
      on() {},
      close: async () => { browsersClosed++; },
      newPage: async () => ({
        setContent: async () => {}, pdf: async () => new Uint8Array([1]),
        close: async () => {},
      }),
    };
  },
} });
const { renderHtmlToPdf } = await import("../src/lib/pdf-render.js");
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("Chromium se reutiliza en llamadas cercanas y se cierra al quedar ocioso", async () => {
  await renderHtmlToPdf("a");
  await renderHtmlToPdf("b");
  assert.equal(launches, 1);
  assert.equal(browsersClosed, 0);

  await esperar(60);
  assert.equal(browsersClosed, 1);

  // El siguiente informe vuelve a abrir el navegador sin fallar.
  assert.ok(Buffer.isBuffer(await renderHtmlToPdf("c")));
  assert.equal(launches, 2);
  await esperar(60);
  assert.equal(browsersClosed, 2);
});
