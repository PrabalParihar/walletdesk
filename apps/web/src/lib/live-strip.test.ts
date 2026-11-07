import { test } from "node:test";
import assert from "node:assert/strict";
import { formatStrip, humanAge, type Guard } from "./live-strip.ts";

const price = (x: bigint) => (Number(x) / 1e18).toFixed(6);
const guard: Guard = { spotX18: 993386000000000000n, referenceX18: 998693000000000000n, referenceAge: 39600, maxReferenceAge: 86400, deskCount: 1n, cap: 1000000000000000000n };

test("labels and values in order", () => {
  assert.deepEqual(formatStrip(guard, "Unichain Sepolia", price), [
    { label: "POOL SPOT", value: "0.993386" },
    { label: "CRE REF", value: "0.998693 · 11 h" },
    { label: "DESKS", value: "1" },
    { label: "CHAIN", value: "Unichain Sepolia" },
  ]);
});
test("no data yet shows dashes, not zeros", () => {
  assert.deepEqual(formatStrip(null, "Unichain Sepolia", price).map((i) => i.value), ["—", "—", "—", "Unichain Sepolia"]);
});
test("no CRE reference shows a dash with no age", () => {
  assert.equal(formatStrip({ ...guard, referenceX18: null, referenceAge: null }, "Unichain Sepolia", price)[1].value, "—");
});
test("zero desks is a real zero", () => {
  assert.equal(formatStrip({ ...guard, deskCount: 0n }, "Unichain Sepolia", price)[2].value, "0");
});
test("humanAge unchanged", () => {
  assert.equal(humanAge(30), "30s");
  assert.equal(humanAge(600), "10 min");
  assert.equal(humanAge(39600), "11 h");
  assert.equal(humanAge(259200), "3 d");
});
