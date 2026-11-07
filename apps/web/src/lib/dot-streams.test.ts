import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dotCounts } from "./dot-streams.ts";

test("proportional split of 1 : 4 over 30 dots", () => assert.deepEqual(dotCounts(1, 4, 30), { pool: 6, desk: 24 }));
test("a tiny side still gets one dot", () => assert.deepEqual(dotCounts(0.01, 4.99, 30), { pool: 1, desk: 29 }));
test("an empty side gets none", () => assert.deepEqual(dotCounts(5, 0, 30), { pool: 30, desk: 0 }));
test("animation only runs when motion is allowed", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const blocks = css.split("@media (prefers-reduced-motion: no-preference)").slice(1);
  assert.ok(blocks.some((b) => /\.wd-flow\b/.test(b.slice(0, b.indexOf("\n}")))), ".wd-flow is defined inside a no-preference block");
  assert.doesNotMatch(css.split("@media")[0], /\.wd-flow\b/, ".wd-flow is not defined outside a media block");
});
