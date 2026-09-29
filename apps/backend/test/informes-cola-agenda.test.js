import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.WHATSAPP_BOT_URL = "http://bot.test";
process.env.INFORME_INTERNO_SECRET = "secreto";
let consultas = 0;
let pendiente = null;
const prisma = { informePendiente: {
  findMany: async () => { consultas++; return []; },
  findFirst: async () => pendiente,
} };
mock.module(new URL("../src/lib/prisma.js", import.meta.url).href, { namedExports: { prisma } });
const { iniciarColaInformes, notificarCierreDeCaja } = await import("../src/modules/caja/informe-turno-notifier.js");
const vaciar = () => new Promise((resolve) => setImmediate(resolve));

test("sin informes pendientes la cola no consulta la base cada 2 minutos y despierta al cerrar caja", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.parse("2026-09-22T12:00:00Z") });
  try {
    const detener = iniciarColaInformes();
    await vaciar(); await vaciar();
    assert.equal(consultas, 1);

    // Antes: 5 consultas en 10 minutos. Ahora ninguna hasta la red de seguridad.
    mock.timers.tick(10 * 60_000);
    await vaciar();
    assert.equal(consultas, 1);

    // Un cierre de caja agenda la revisión 5 minutos después.
    const transaction = { informePendiente: { create: async () => {} } };
    await notificarCierreDeCaja("B", "2026-09-22", 7, transaction, new Date());
    mock.timers.tick(5 * 60_000);
    await vaciar();
    assert.equal(consultas, 1);
    mock.timers.tick(1_000);
    await vaciar(); await vaciar();
    assert.equal(consultas, 2);

    detener();
    mock.timers.tick(60 * 60_000);
    await vaciar();
    assert.equal(consultas, 2);
  } finally {
    mock.timers.reset();
  }
});
