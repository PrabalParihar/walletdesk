import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio } from "./contrast.ts";
import { palette } from "./palette.ts";

test("contrastRatio matches known values", () => {
  assert.equal(Math.round(contrastRatio("#FFFFFF", "#000000") * 10) / 10, 21);
  assert.equal(Math.round(contrastRatio("#000000", "#000000") * 10) / 10, 1);
});

const AA = 4.5;
const bodyText: Array<[keyof typeof palette, keyof typeof palette]> = [
  ["ink", "page"], ["ink", "raised"], ["ink", "sunken"],
  ["muted", "page"], ["muted", "raised"], ["muted", "sunken"],
  ["onFill", "pool"], ["onFill", "wallet"],
  ["onPrimary", "primary"], ["pool", "page"], ["wallet", "page"], ["danger", "page"], ["ok", "page"],
];
for (const [fg, bg] of bodyText) {
  test(`${fg} on ${bg} passes AA`, () => {
    assert.ok(contrastRatio(palette[fg], palette[bg]) >= AA, `${palette[fg]} on ${palette[bg]}`);
  });
}

test("white on the legs fails, which is why onFill is black", () => {
  assert.ok(contrastRatio("#FFFFFF", palette.pool) < AA);
  assert.ok(contrastRatio("#FFFFFF", palette.wallet) < AA);
});
