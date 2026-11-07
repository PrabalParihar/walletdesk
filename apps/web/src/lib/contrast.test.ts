import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("globals.css :root uses the palette values", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").toLowerCase();
  for (const [token, value] of [["--wd-surface", palette.page], ["--wd-ink", palette.ink], ["--wd-muted", palette.muted], ["--pool", palette.pool], ["--wd-desk", palette.wallet]] as const) {
    assert.match(css, new RegExp(`${token}:\\s*${value.toLowerCase()};`), token);
  }
  assert.match(css, /:root\s*\{\s*color-scheme:\s*dark;/, ":root declares color-scheme: dark");
  assert.doesNotMatch(css, /^\.dark\s*\{/m, "the .dark block is gone");
});
