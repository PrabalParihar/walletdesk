import assert from "node:assert/strict";
import test from "node:test";

import { aggregate, fetchReference, saneStablePrice, toPriceX18 } from "./reference.mjs";

test("median of two sources", () => {
  assert.equal(aggregate([0.998, 1.0]), 0.999);
  assert.equal(aggregate([1.0]), 1.0);
});

test("drops insane quotes", () => {
  assert.equal(saneStablePrice(Number.NaN), false);
  assert.equal(saneStablePrice(3000), false);
  assert.equal(aggregate([3000, 0.999]), 0.999);
  assert.equal(aggregate([]), null);
});

test("price unit matches the hook (raw token1 per raw token0 * 1e18)", () => {
  assert.equal(toPriceX18(1), 10n ** 18n);
  assert.equal(toPriceX18(0.998245), 998245000000000000n);
  // 18-decimal token0, 6-decimal token1: 1.0 human is 1e6 raw per 1e18 raw -> 1e6 in X18 units.
  assert.equal(toPriceX18(1, 18, 6), 10n ** 6n);
  assert.throws(() => toPriceX18(0));
});

test("fetchReference survives one dead source", async () => {
  const fake = async (url) => {
    if (url.includes("kraken")) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, json: async () => ({ data: { amount: "0.9990" } }) };
  };
  const { price, sources } = await fetchReference(fake);
  assert.equal(price, 0.999);
  assert.deepEqual(sources, ["coinbase"]);
});
