#!/usr/bin/env node
// Writes a desk-guard config from config.example.json plus deployed addresses.
//
//   node scripts/make-config.mjs                       # -> config.local.json from contracts/deployments/local.json
//   node scripts/make-config.mjs --feed 0x... --pool 0x...
//   node scripts/make-config.mjs --target unichain-sepolia --feed 0x... --pool 0x...
//
// The feed address is read from the deployments JSON key "priceFeed" (written by
// contracts/script/DemoSeed.s.sol) unless --feed is given. The pool id comes from "poolId".
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const workflowDir = resolve(here, "..")
const repoRoot = resolve(workflowDir, "..", "..", "..")

const TARGETS = {
  "local-fork": {
    out: "config.local.json",
    chainSelectorName: "ethereum-mainnet-unichain-1",
    heartbeatSeconds: 0,
    deviationThresholdBps: 10,
  },
  "unichain-sepolia": {
    out: "config.unichain-sepolia.json",
    chainSelectorName: "ethereum-testnet-sepolia-unichain-1",
    heartbeatSeconds: 300,
    deviationThresholdBps: 10,
  },
}

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

const target = flag("target") ?? "local-fork"
const preset = TARGETS[target]
if (!preset) {
  console.error(`unknown --target ${target}; expected one of ${Object.keys(TARGETS).join(", ")}`)
  process.exit(1)
}

const deploymentsPath = resolve(flag("deployments") ?? resolve(repoRoot, "contracts/deployments/local.json"))
const deployments = existsSync(deploymentsPath) ? JSON.parse(readFileSync(deploymentsPath, "utf8")) : {}

const feed = flag("feed") ?? deployments.priceFeed
const pool = flag("pool") ?? deployments.poolId

if (!/^0x[0-9a-fA-F]{40}$/.test(feed ?? "")) {
  console.error(`missing feed address: pass --feed 0x... or add "priceFeed" to ${deploymentsPath}`)
  process.exit(1)
}
if (!/^0x[0-9a-fA-F]{64}$/.test(pool ?? "")) {
  console.error(`missing pool id: pass --pool 0x... or add "poolId" to ${deploymentsPath}`)
  process.exit(1)
}

const base = JSON.parse(readFileSync(resolve(workflowDir, "config.example.json"), "utf8"))
const config = {
  ...base,
  chainSelectorName: preset.chainSelectorName,
  feedAddress: feed,
  poolId: pool,
  token0Decimals: deployments.decimals0 ?? base.token0Decimals,
  token1Decimals: deployments.decimals1 ?? base.token1Decimals,
  heartbeatSeconds: preset.heartbeatSeconds,
  deviationThresholdBps: preset.deviationThresholdBps,
}

const outPath = resolve(workflowDir, flag("out") ?? preset.out)
writeFileSync(outPath, JSON.stringify(config, null, 2) + "\n")
console.log(`wrote ${outPath}`)
console.log(`  chain ${config.chainSelectorName}  feed ${config.feedAddress}  pool ${config.poolId}`)
