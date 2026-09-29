import assert from "node:assert/strict";
import { test } from "node:test";
import { createSearchDedupe } from "../src/modules/ventas/searchDedupe.js";

test("reutiliza la misma búsqueda en curso o reciente y repite si cambia o vence", async () => {
  let clock = 0;
  let calls = 0;
  const dedupe = createSearchDedupe(1500, () => clock);
  const fetcher = async () => ({ productos: [++calls] });

  const [a, b] = await Promise.all([dedupe("coca|", fetcher), dedupe("coca|", fetcher)]);
  assert.equal(calls, 1);
  assert.equal(a, b);

  clock = 1000;
  await dedupe("coca|", fetcher);
  assert.equal(calls, 1);

  await dedupe("coca|7", fetcher);
  assert.equal(calls, 2);

  clock = 5000;
  await dedupe("coca|7", fetcher);
  assert.equal(calls, 3);
});

test("un error no queda guardado", async () => {
  let calls = 0;
  const dedupe = createSearchDedupe();
  await assert.rejects(dedupe("x", async () => { calls++; throw new Error("sin red"); }), /sin red/);
  await dedupe("x", async () => { calls++; return {}; });
  assert.equal(calls, 2);
});
