// Records the demo footage for the Remotion video from the local fork (./script/demo.sh must be running).
//
// Each clip is captured with Chrome's screencast as JPEG frames (sharper than Playwright's built-in video),
// together with the time of every click (so the video can draw a cursor) and named markers (which drive captions).
// Output: video/public/footage/<clip>/NNNNN.jpg and video/public/footage/<clip>/manifest.json
//
// Usage: node video/capture/capture.cjs [clip ...]   (clips: landing desk live guard how; default: all)

const { chromium } = require("playwright");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "video/public/footage");
const UI = process.env.DEMO_UI_URL || "http://127.0.0.1:43127";
const RPC = process.env.DEMO_RPC_URL || "http://127.0.0.1:8545";
const VIEWPORT = { width: 1600, height: 900 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(browser, name, script) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const frames = [];
  const marks = [];
  const clicks = [];
  let t0 = null;
  const now = () => (t0 === null ? 0 : (Date.now() - t0) / 1000);
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const t = t0 === null ? 0 : metadata.timestamp - t0 / 1000;
    const file = `${String(frames.length).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, "base64"));
    frames.push({ t: Math.max(0, Number(t.toFixed(3))), f: file });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });

  const rec = {
    page,
    mark: (label) => marks.push({ t: Number(now().toFixed(3)), name: label }),
    async click(locator, label) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (box) clicks.push({ t: Number((now() + 0.05).toFixed(3)), x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) });
      if (label) rec.mark(label);
      await locator.click();
    },
    async type(locator, text, label) {
      await rec.click(locator, label);
      await locator.press("ControlOrMeta+a");
      await locator.pressSequentially(text, { delay: 220 });
    },
    async scrollTo(locator, offset = 120) {
      await locator.evaluate((el, off) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - off, behavior: "smooth" }), offset);
      await sleep(1100);
    },
  };

  // Start the clock once the first page has painted, so the clip opens on content, not a blank tab.
  await script.before?.(rec);
  t0 = Date.now();
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: VIEWPORT.width, maxHeight: VIEWPORT.height, everyNthFrame: 1 });
  await sleep(300);
  await script.run(rec);
  const duration = Number(now().toFixed(3));
  await cdp.send("Page.stopScreencast");
  await sleep(300);
  await context.close();
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ name, width: VIEWPORT.width, height: VIEWPORT.height, duration, frames, marks, clicks }, null, 1));
  console.log(`${name}: ${duration}s, ${frames.length} frames, marks ${marks.map((m) => `${m.name}@${m.t}`).join(" ")}`);
}

// ---- Fork helpers for the price-guard clip ----------------------------------------------------------------

function deployerKey() {
  // Anvil prints its public development keys; account (0) is the deployer and the fork's feed forwarder.
  const log = fs.readFileSync("/tmp/walletdesk-anvil.log", "utf8");
  const after = log.split("Private Keys")[1] || "";
  const match = after.match(/\(0\)\s+(0x[0-9a-fA-F]{64})/);
  if (!match) throw new Error("could not read Anvil account (0) from /tmp/walletdesk-anvil.log");
  return match[1];
}

function keeperPids() {
  return fs
    .readdirSync("/proc")
    .filter((p) => /^\d+$/.test(p))
    .filter((p) => {
      try {
        return fs.readFileSync(`/proc/${p}/cmdline`, "utf8").includes("keeper/index.mjs");
      } catch {
        return false;
      }
    });
}

async function restartKeeperWithoutReferencePush(key) {
  for (const pid of keeperPids()) process.kill(Number(pid));
  await sleep(800);
  const child = spawn("node", [path.join(ROOT, "services/keeper/index.mjs")], {
    env: { ...process.env, DEPLOYMENTS_PATH: path.join(ROOT, "contracts/deployments/local.json"), KEEPER_PRIVATE_KEY: key, RPC_URL: RPC, REFERENCE_PUSH: "0" },
    detached: true,
    stdio: ["ignore", fs.openSync("/tmp/walletdesk-keeper.log", "a"), fs.openSync("/tmp/walletdesk-keeper.log", "a")],
  });
  child.unref();
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://127.0.0.1:8787/health");
      if (res.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("keeper did not come back");
}

function pushReference(key, priceX18) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "contracts/deployments/local.json"), "utf8"));
  // The feed only accepts a report whose observation time is later than the last one; an idle fork mines no blocks,
  // so take the wall clock (ahead of every earlier push) rather than the latest block's timestamp.
  const observedAt = Math.floor(Date.now() / 1000) + 400000;
  const report = execFileSync("cast", ["abi-encode", "f(bytes32,uint256,uint64)", d.poolId, priceX18, String(observedAt)], { encoding: "utf8" }).trim();
  try {
    execFileSync("cast", ["send", d.priceFeed, "onReport(bytes,bytes)", "0x", report, "--private-key", key, "--rpc-url", RPC], { stdio: "ignore" });
  } catch {
    throw new Error("pushing the reference failed (cast send onReport); the command is not echoed because it carries a key");
  }
}

// ---- Clips ------------------------------------------------------------------------------------------------

const clips = {
  landing: {
    before: async ({ page }) => {
      await page.goto(`${UI}/`, { waitUntil: "networkidle" });
      await page.evaluate(() => window.scrollTo(0, 0));
    },
    run: async (rec) => {
      const { page } = rec;
      // Reload inside the recording so the split bar draws on camera.
      await page.reload({ waitUntil: "networkidle" });
      rec.mark("hero");
      await sleep(4200);
      await rec.scrollTo(page.locator("#problem-heading"), 90);
      rec.mark("problem");
      await sleep(5200);
      await rec.scrollTo(page.getByText("Running on chain, simulated on"), 90);
      rec.mark("proof");
      await sleep(3600);
      await rec.scrollTo(page.locator("#judge-heading"), 120);
      rec.mark("judges");
      await sleep(3200);
    },
  },
  desk: {
    before: async ({ page }) => {
      await page.goto(`${UI}/desk`, { waitUntil: "networkidle" });
    },
    run: async (rec) => {
      const { page } = rec;
      await sleep(1500);
      await rec.click(page.getByRole("button", { name: "Demo maker" }), "connect");
      await page.getByRole("button", { name: "Approve and ship" }).waitFor({ timeout: 20000 });
      await sleep(1200);
      await rec.type(page.getByLabel("Shelf amount"), "500", "form");
      await sleep(2200);
      await rec.click(page.getByRole("button", { name: "Approve and ship" }), "ship");
      await page.getByText("Register the desk on OverflowHook").waitFor({ timeout: 60000 });
      await page.getByRole("button", { name: "Approve and ship" }).waitFor({ timeout: 60000 });
      rec.mark("shipped");
      await sleep(4200);
    },
  },
  live: {
    before: async ({ page }) => {
      await page.goto(`${UI}/live`, { waitUntil: "networkidle" });
      await page.getByText("Pool spot").first().waitFor({ timeout: 20000 });
      await sleep(1500);
    },
    run: async (rec) => {
      const { page } = rec;
      rec.mark("page");
      await sleep(2500);
      await rec.click(page.getByRole("button", { name: "Demo taker" }), "connect");
      await sleep(1200);
      await rec.click(page.getByRole("button", { name: "Uniswap PoolSwapTest" }), "router");
      await sleep(900);
      await rec.type(page.locator("#swap-size"), "3", "size");
      await sleep(3200);
      rec.mark("preview");
      await rec.click(page.getByRole("button", { name: "Run overflow" }), "swap");
      await page.getByText("Swap mined").waitFor({ timeout: 60000 });
      rec.mark("mined");
      await sleep(1500);
      // Wait for the 8 s refresh, then show the updated fill and the maker's balances.
      await sleep(8000);
      await rec.scrollTo(page.getByText("Overflow fill", { exact: true }), 100);
      rec.mark("fill");
      await sleep(3800);
      await rec.scrollTo(page.getByText("Maker wallet", { exact: true }).first(), 100);
      rec.mark("balances");
      await sleep(3200);
    },
  },
  guard: {
    before: async ({ page }) => {
      const key = deployerKey();
      await restartKeeperWithoutReferencePush(key);
      pushReference(key, "950000000000000000");
      await page.goto(`${UI}/live`, { waitUntil: "networkidle" });
      await page.getByText("Pool spot").first().waitFor({ timeout: 20000 });
      await page.getByText(/0\.95\d* ·/).waitFor({ timeout: 30000 });
      await page.getByText("Price guard", { exact: true }).first().scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -80));
      await sleep(800);
    },
    run: async (rec) => {
      const { page } = rec;
      rec.mark("reference");
      await sleep(4500);
      await rec.click(page.getByRole("button", { name: "Demo taker" }), "connect");
      await sleep(1000);
      await rec.click(page.getByRole("button", { name: "Uniswap PoolSwapTest" }), "router");
      await rec.type(page.locator("#swap-size"), "3", "size");
      await sleep(1600);
      await rec.click(page.getByRole("button", { name: "Run overflow" }), "swap");
      await page.getByText("Swap mined").waitFor({ timeout: 60000 });
      rec.mark("mined");
      await sleep(1500);
      await rec.scrollTo(page.getByText("Price guard", { exact: true }).first(), 100);
      await page.getByRole("row", { name: /Last skip/ }).filter({ hasNotText: "none" }).waitFor({ timeout: 40000 });
      rec.mark("skip");
      await sleep(4500);
    },
  },
  how: {
    before: async ({ page }) => {
      await page.goto(`${UI}/how`, { waitUntil: "networkidle" });
    },
    run: async (rec) => {
      const { page } = rec;
      rec.mark("diagram");
      await sleep(3500);
      await rec.scrollTo(page.getByText("What happens on chain"), 90);
      rec.mark("steps");
      await sleep(3200);
      await rec.scrollTo(page.getByText("Each partner, in the code"), 90);
      rec.mark("code");
      await sleep(4200);
      await page.keyboard.press("Control+k");
      rec.mark("jump");
      await sleep(1000);
      await page.getByRole("combobox").pressSequentially("hook", { delay: 230 });
      await sleep(2600);
      await page.keyboard.press("Escape");
      rec.mark("end");
      await sleep(800);
    },
  },
};

(async () => {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : ["landing", "desk", "live", "guard", "how"];
  const browser = await chromium.launch();
  try {
    for (const name of names) await record(browser, name, clips[name]);
  } finally {
    await browser.close();
  }
})();
