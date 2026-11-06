#!/usr/bin/env node
// Copies the MockKeystoneForwarder runtime code that `cre workflow simulate` uses on Unichain
// Sepolia onto the local anvil fork of Unichain mainnet, at the same address.
//
// Why: CRE has no forwarder on Unichain mainnet (chain id 130), so on the fork that address is
// empty. With --broadcast the simulator sends report(receiver, rawReport, ctx, sigs) to the
// forwarder configured in project.yaml; the mock then calls DeskPriceFeed.onReport(metadata, report).
// The CRE CLI's own e2e tests use the same trick (anvil_setCode of the mock forwarder).
//
//   node scripts/etch-mock-forwarder.mjs
//   LOCAL_RPC=http://127.0.0.1:8545 SOURCE_RPC=https://sepolia.unichain.org node scripts/etch-mock-forwarder.mjs
//
// Only loopback LOCAL_RPC URLs are accepted.

const FORWARDER = "0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1" // Unichain Sepolia MockKeystoneForwarder (CRE Forwarder Directory)
const LOCAL_RPC = process.env.LOCAL_RPC ?? "http://127.0.0.1:8545"
const SOURCE_RPC = process.env.SOURCE_RPC ?? "https://sepolia.unichain.org"

const host = new URL(LOCAL_RPC).hostname
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host)) {
  console.error(`refusing non-loopback LOCAL_RPC ${LOCAL_RPC}`)
  process.exit(1)
}

let id = 0
async function rpc(url, method, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  })
  const body = await res.json()
  if (body.error) throw new Error(`${method} on ${url}: ${JSON.stringify(body.error)}`)
  return body.result
}

const sourceChain = BigInt(await rpc(SOURCE_RPC, "eth_chainId", []))
if (sourceChain !== 1301n) throw new Error(`SOURCE_RPC chain id ${sourceChain}, expected 1301 (Unichain Sepolia)`)
const code = await rpc(SOURCE_RPC, "eth_getCode", [FORWARDER, "latest"])
if (!code || code === "0x") throw new Error(`no code at ${FORWARDER} on Unichain Sepolia`)
console.log(`fetched ${(code.length - 2) / 2} bytes of MockKeystoneForwarder runtime from Unichain Sepolia`)

const localChain = BigInt(await rpc(LOCAL_RPC, "eth_chainId", []))
console.log(`local chain id ${localChain}`)
await rpc(LOCAL_RPC, "anvil_setCode", [FORWARDER, code])
const etched = await rpc(LOCAL_RPC, "eth_getCode", [FORWARDER, "latest"])
if (etched.toLowerCase() !== code.toLowerCase()) throw new Error("etched code does not match")
console.log(`etched MockKeystoneForwarder at ${FORWARDER} on ${LOCAL_RPC}`)
console.log(`DeskPriceFeed.forwarder must be ${FORWARDER} for local simulation`)
