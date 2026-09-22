import assert from "node:assert/strict";
import { test } from "node:test";
import { createReconnectController } from "../src/lib/reconnect-controller.js";

test("reconexión: espera creciente, un solo timer y recuperación", async () => {
  const timers = new Map();
  let calls = 0;
  let id = 0;
  const delays = [];
  const controller = createReconnectController(async () => { calls++; }, {
    schedule(fn, delay) { delays.push(delay); timers.set(++id, fn); return id; },
    cancel(key) { timers.delete(key); },
  });
  await controller.start();
  for (let i = 0; i < 8; i++) {
    controller.retry(); controller.retry();
    assert.equal(timers.size, 1);
    const [key, fn] = timers.entries().next().value;
    timers.delete(key); fn();
    await new Promise(setImmediate);
  }
  assert.deepEqual(delays, [2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  assert.equal(calls, 9);
  controller.connected();
  assert.equal(controller.retry(), 2000);
  controller.stop();
  assert.equal(timers.size, 0);
  await controller.start();
  controller.retry();
  assert.equal(calls, 9);
  assert.equal(timers.size, 0);
});

test("un fallo inicial se captura y dos arranques no crean conexiones paralelas", async () => {
  let release;
  let calls = 0;
  const errors = [];
  const timers = [];
  const controller = createReconnectController(async () => {
    calls++;
    await new Promise((resolve) => { release = resolve; });
    throw new Error("sin red");
  }, { schedule: (fn) => { timers.push(fn); return timers.length; }, onError: (e) => errors.push(e) });
  const first = controller.start();
  await controller.start();
  controller.retry();
  release(); await first;
  assert.equal(calls, 1);
  assert.equal(errors.length, 1);
  assert.equal(timers.length, 1);
});
