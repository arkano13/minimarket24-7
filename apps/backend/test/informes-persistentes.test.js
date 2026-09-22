import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { entregarInforme } from "../src/modules/caja/informe-entrega.js";

mock.module(new URL("../src/lib/prisma.js", import.meta.url).href, { namedExports: { prisma: {} } });
const { notificarCierreDeCaja, procesarInformesPendientes } = await import("../src/modules/caja/informe-turno-notifier.js");

function database() {
  const job = { turnoCajaId: 1, turno: "C", fecha: "2026-09-21", proximoIntento: new Date(0), intentos: 0, destinatarios: [], enviadoEn: null, bloqueoHasta: null };
  const deliveries = new Map();
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === "OR") return value.some((item) => matches(row, item));
      if (value?.lte) return row[key] != null && row[key] <= value.lte;
      if (value?.isEmpty) return row[key].length === 0;
      return row[key] === value;
    });
  }
  function update(row, { where, data }) {
    if (!matches(row, where)) return { count: 0 };
    for (const [key, value] of Object.entries(data)) row[key] = value?.increment ? row[key] + value.increment : value;
    return { count: 1 };
  }
  const db = {
    informePendiente: {
      create: async ({ data }) => Object.assign(job, data),
      findUnique: async () => ({ ...job }),
      findMany: async ({ where }) => matches(job, where) ? [{ ...job }] : [],
      updateMany: async (args) => update(job, args),
    },
    informeEntrega: {
      upsert: async ({ create }) => {
        if (!deliveries.has(create.destinatario)) deliveries.set(create.destinatario, { ...create, enviadoEn: null, bloqueoHasta: null });
        return { ...deliveries.get(create.destinatario) };
      },
      updateMany: async (args) => update(deliveries.get(args.where.destinatario), args),
    },
  };
  return { db, job, deliveries };
}
const now = () => new Date("2026-09-22T12:00:00Z");
const options = { url: "http://bot:8080/", secret: "test-only", now };

test("el cierre guarda el reporte a cinco minutos usando la transacción recibida", async () => {
  const { db, job } = database();
  await notificarCierreDeCaja("B", "2026-09-22", 1, db, now());
  assert.equal(job.proximoIntento.getTime() - now().getTime(), 300_000);
  let requests = 0;
  await procesarInformesPendientes({ ...options, db, fetchImpl: async () => { requests++; } });
  assert.equal(requests, 0);
});

test("fallo de red persiste reintento, otro worker lo recupera y confirma", async () => {
  const { db, job } = database();
  await procesarInformesPendientes({ ...options, db, fetchImpl: async () => { throw new Error("sin red"); } });
  assert.equal(job.enviadoEn, null);
  assert.equal(job.intentos, 1);
  assert.equal(job.proximoIntento.getTime() - now().getTime(), 30_000);
  assert.equal(job.bloqueoHasta, null);
  await procesarInformesPendientes({ ...options, now: () => new Date(now().getTime() + 31_000), db,
    fetchImpl: async (url) => { assert.equal(url, "http://bot:8080/interno/informe-turno"); return { status: 200, json: async () => ({ enviado: true }) }; },
  });
  assert.ok(job.enviadoEn);
});

test("un 202 no marca enviado y dos workers solo despachan una vez", async () => {
  const { db, job } = database();
  let calls = 0;
  const fetchImpl = async () => { calls++; await new Promise(setImmediate); return { status: 202 }; };
  await Promise.all([procesarInformesPendientes({ ...options, db, fetchImpl }), procesarInformesPendientes({ ...options, db, fetchImpl })]);
  assert.equal(calls, 1);
  assert.equal(job.enviadoEn, null);
});

test("reinicio recupera un bloqueo vencido pero respeta uno vigente", async () => {
  const { db, job } = database();
  let calls = 0;
  job.bloqueoHasta = new Date(now().getTime() + 1000);
  const fetchImpl = async () => { calls++; return { status: 200, json: async () => ({ enviado: true }) }; };
  await procesarInformesPendientes({ ...options, db, fetchImpl });
  assert.equal(calls, 0);
  await procesarInformesPendientes({ ...options, db, fetchImpl, now: () => new Date(now().getTime() + 1001) });
  assert.equal(calls, 1);
});

test("entrega parcial persiste por destinatario y el reintento omite los enviados", async () => {
  const { db, job } = database();
  const sent = [];
  let fail = true;
  const args = { db, turnoCajaId: 1, destinatarios: ["a", "a", "b"], now, crearDocumento: async () => ({}),
    enviar: async (recipient) => { sent.push(recipient); if (recipient === "b" && fail) throw new Error("sin conexión"); return { key: { id: recipient } }; },
  };
  await assert.rejects(entregarInforme(args), (e) => e.status === 503);
  assert.deepEqual(job.destinatarios, ["a", "b"]);
  fail = false;
  assert.deepEqual(await entregarInforme({ ...args, destinatarios: ["c"] }), { enviado: true });
  assert.deepEqual(sent, ["a", "b", "b"]);
  await entregarInforme(args);
  assert.deepEqual(sent, ["a", "b", "b"]);
});

test("peticiones simultáneas al bot no repiten al destinatario en curso", async () => {
  const { db } = database();
  let calls = 0;
  const args = { db, turnoCajaId: 1, destinatarios: ["a"], now, crearDocumento: async () => ({}),
    enviar: async () => { calls++; await new Promise(setImmediate); return { key: { id: "msg" } }; },
  };
  const results = await Promise.allSettled([entregarInforme(args), entregarInforme(args)]);
  assert.equal(calls, 1);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
