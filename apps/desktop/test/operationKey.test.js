import assert from "node:assert/strict";
import test from "node:test";

import { newOperationKey } from "../src/services/operationKey.js";

test("cada operación nueva recibe una clave distinta y válida", () => {
  const first = newOperationKey();
  const second = newOperationKey();

  assert.notEqual(first, second);
  assert.ok(first.length > 0 && first.length <= 64);
  assert.ok(second.length > 0 && second.length <= 64);
});
