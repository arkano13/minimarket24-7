import assert from "node:assert/strict";
import { mock, test } from "node:test";

let committed;
let failQueue = false;
const prisma = {
  async $transaction(callback) {
    const draft = { shift: { id: 1, estado: "ABIERTO", fondoInicial: 50, ventas: [], movimientos: [] }, job: null, turno: "C" };
    const result = await callback({
      turnoCaja: {
        findFirst: async () => draft.shift,
        update: async ({ data }) => (draft.shift = { ...draft.shift, ...data }),
      },
      configuracionSistema: {
        upsert: async () => ({ proximoTurnoInforme: draft.turno }),
        update: async ({ data }) => { draft.turno = data.proximoTurnoInforme; },
      },
      informePendiente: { create: async ({ data }) => {
        if (failQueue) throw new Error("No se pudo guardar la cola");
        draft.job = data;
      } },
    });
    committed = draft;
    return result;
  },
};
mock.module(new URL("../src/lib/prisma.js", import.meta.url).href, { namedExports: { prisma } });
const { closeCashShift } = await import("../src/modules/caja/caja.service.js");

test("el servicio de caja incluye cierre, rotación e informe en una transacción", async () => {
  const result = await closeCashShift({ efectivoContado: 50 }, 1);
  assert.equal(result.estado, "CERRADO");
  assert.equal(committed.turno, "A");
  assert.equal(committed.job.turno, "C");
  assert.equal(committed.job.turnoCajaId, 1);
  assert.equal(committed.job.proximoIntento.getTime() - committed.shift.cerradoEn.getTime(), 300_000);
});

test("un fallo al guardar el informe no confirma un cierre sin trabajo pendiente", async () => {
  committed = null;
  failQueue = true;
  await assert.rejects(closeCashShift({ efectivoContado: 50 }, 1), /guardar la cola/);
  assert.equal(committed, null);
});
