import assert from "node:assert/strict";
import { after, before, test } from "node:test";

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/minisuper_pos_test";

const { app } = await import("../src/app.js");

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test("GET /api/health confirma que el backend está disponible", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.service, "Minisúper POS");
  assert.ok(body.timestamp);
});
