import assert from "node:assert/strict";
import test from "node:test";

import { feeToUsdc6, isLoopbackRpc } from "./scale.mjs";

test("18 decimal shelf fee scales to 6 decimal USDC units", () => {
  assert.equal(feeToUsdc6(12_000_000_000_000_000n), 12_000n);
  assert.equal(feeToUsdc6(12_000n, 6), 12_000n);
});

test("dust below one micro-USDC scales to zero", () => {
  assert.equal(feeToUsdc6(10n ** 12n - 1n), 0n);
});

test("loopback check", () => {
  assert.equal(isLoopbackRpc("http://127.0.0.1:8545"), true);
  assert.equal(isLoopbackRpc("https://sepolia.unichain.org"), false);
});
