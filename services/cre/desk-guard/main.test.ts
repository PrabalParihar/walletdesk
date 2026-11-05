// Unit tests for desk-guard, run with `bun test` using the CRE SDK test runtime
// (@chainlink/cre-sdk/test). HTTP and EVM capabilities are mocked; no network, no chain.
import { describe, expect } from "bun:test"
import { addContractMock, EvmMock, HttpActionsMock, newTestRuntime, test } from "@chainlink/cre-sdk/test"
import { bytesToHex, decodeAbiParameters, type Hex } from "viem"
import { type Config, DESK_PRICE_FEED_ABI, initWorkflow, onCron, REPORT_PARAMS } from "./main"
import {
  deviationBps,
  formatX18,
  invertX18,
  medianBigint,
  parseDecimalX18,
  parseSourceBody,
  spreadBps,
  toRawPriceX18,
} from "./price"

const UNICHAIN_MAINNET_SELECTOR = 1923510103922296319n // ethereum-mainnet-unichain-1
const FEED = "0x00000000000000000000000000000000000000fe" as const
const POOL_ID = "0x1111111111111111111111111111111111111111111111111111111111111111" as const
const NOW_MS = 1_793_912_880_000 // fixed DON time for the test runtime
const NOW_S = BigInt(NOW_MS / 1000)
const METADATA_HEADER = 109 // rawReport = 109-byte header || abi-encoded payload

// Response bodies captured from the live endpoints (trimmed).
const COINBASE_BODY = `{"data":{"amount":"0.99845","base":"USDT","currency":"USDC"}}`
const KRAKEN_BODY = `{"error":[],"result":{"USDCUSDT":{"a":["1.00140000","1899","1899.000"],"b":["1.00130000","715774","715774.000"],"c":["1.00140000","7319.05412298"]}}}`

const COINBASE_X18 = 998_450_000_000_000_000n
const KRAKEN_X18 = 10n ** 36n / 1_001_350_000_000_000_000n // 1 / mid(1.0014, 1.0013)

const baseConfig = (): Config => ({
  schedule: "*/30 * * * * *",
  chainSelectorName: "ethereum-mainnet-unichain-1",
  feedAddress: FEED,
  poolId: POOL_ID,
  gasLimit: "300000",
  token0Decimals: 18,
  token1Decimals: 18,
  sources: [
    { name: "coinbase", url: "https://api.coinbase.com/v2/prices/USDT-USDC/spot", format: "coinbase-spot", invert: false },
    { name: "kraken", url: "https://api.kraken.com/0/public/Ticker?pair=USDCUSDT", format: "kraken-ticker", invert: true },
  ],
  minSources: 1,
  maxSourceSpreadBps: 50,
  minPrice: "0.95",
  maxPrice: "1.05",
  deviationThresholdBps: 10,
  heartbeatSeconds: 0,
  verifyWrite: true,
})

const b64 = (s: string) => Buffer.from(s).toString("base64")

type HttpRoutes = Record<string, { status: number; body: string }>

// The feed mock behaves like DeskPriceFeed behind a forwarder: writeReport decodes the payload
// and stores (priceX18, observedAt) unless `storeOnWrite` is false (a silently failed onReport).
function setup(config: Config, routes: HttpRoutes, onchain: [bigint, bigint] = [0n, 0n], storeOnWrite = true) {
  const http = HttpActionsMock.testInstance()
  http.sendRequest = (req) => {
    const route = routes[req.url]
    if (!route) throw new Error(`unexpected url ${req.url}`)
    return { statusCode: route.status, body: b64(route.body) }
  }

  const evm = EvmMock.testInstance(UNICHAIN_MAINNET_SELECTOR)
  const feed = addContractMock(evm, { address: FEED, abi: DESK_PRICE_FEED_ABI })
  let stored = onchain
  feed.referenceOf = () => stored
  const writes: { payload: Hex; gasLimit: bigint; receiver: string }[] = []
  feed.writeReport = (input) => {
    const payload = bytesToHex(input.report.rawReport.slice(METADATA_HEADER))
    writes.push({ payload, gasLimit: input.gasConfig.gasLimit, receiver: bytesToHex(input.receiver) })
    if (storeOnWrite) {
      const [, priceX18, observedAt] = decodeAbiParameters(REPORT_PARAMS, payload)
      stored = [priceX18, observedAt]
    }
    return { txStatus: "TX_STATUS_SUCCESS", txHash: b64("\x01".repeat(32)) }
  }

  const runtime = newTestRuntime<Config>(null, { timeProvider: () => NOW_MS })
  runtime.config = config
  return { runtime, writes, feed }
}

const bothUp: HttpRoutes = {
  "https://api.coinbase.com/v2/prices/USDT-USDC/spot": { status: 200, body: COINBASE_BODY },
  "https://api.kraken.com/0/public/Ticker?pair=USDCUSDT": { status: 200, body: KRAKEN_BODY },
}

describe("price helpers", () => {
  test("parseDecimalX18 is exact and strict", async () => {
    expect(parseDecimalX18("0.99845")).toBe(COINBASE_X18)
    expect(parseDecimalX18("1")).toBe(10n ** 18n)
    expect(parseDecimalX18("1.0000000000000000019")).toBe(10n ** 18n + 1n) // truncates past 18 dp
    expect(() => parseDecimalX18("1e-3")).toThrow()
    expect(() => parseDecimalX18("-1")).toThrow()
    expect(() => parseDecimalX18("")).toThrow()
  })

  test("parsers read the live response shapes", async () => {
    expect(parseSourceBody("coinbase-spot", COINBASE_BODY)).toBe(COINBASE_X18)
    expect(parseSourceBody("kraken-ticker", KRAKEN_BODY)).toBe(1_001_350_000_000_000_000n)
    expect(() => parseSourceBody("kraken-ticker", `{"error":["EQuery:Unknown asset pair"]}`)).toThrow()
  })

  test("median, spread, deviation, inversion, decimals", async () => {
    expect(medianBigint([3n, 1n, 2n])).toBe(2n)
    expect(medianBigint([1n, 4n])).toBe(2n)
    expect(spreadBps([100n, 101n])).toBe(100n)
    expect(deviationBps(99n, 100n)).toBe(100n)
    expect(invertX18(2n * 10n ** 18n)).toBe(5n * 10n ** 17n)
    // 1 token0 (6 dp) = 1 token1 (18 dp) -> 1e12 raw token1 per raw token0
    expect(toRawPriceX18(10n ** 18n, 6, 18)).toBe(10n ** 30n)
    expect(toRawPriceX18(10n ** 18n, 18, 6)).toBe(10n ** 6n)
    expect(formatX18(COINBASE_X18, 4)).toBe("0.9984")
  })
})

describe("onCron", () => {
  test("writes abi.encode(poolId, priceX18, observedAt) from the median of both sources", async () => {
    const { runtime, writes } = setup(baseConfig(), bothUp)
    const result = onCron(runtime)

    const expected = (COINBASE_X18 + KRAKEN_X18) / 2n
    expect(result.action).toBe("written")
    expect(result.priceX18).toBe(expected.toString())
    expect(writes).toHaveLength(1)
    expect(writes[0].receiver.toLowerCase()).toBe(FEED)
    expect(writes[0].gasLimit).toBe(300_000n)

    const [poolId, priceX18, observedAt] = decodeAbiParameters(REPORT_PARAMS, writes[0].payload)
    expect(poolId).toBe(POOL_ID)
    expect(priceX18).toBe(expected)
    expect(observedAt).toBe(NOW_S)

    const logs = runtime.getLogs().join("\n")
    expect(logs).toContain("source coinbase: 0.998450")
    expect(logs).toContain("source kraken: 0.998651 (inverted)")
    expect(logs).toContain("report written")
    expect(logs).toContain(`read back: referenceOf(poolId) = ${expected} @ ${NOW_S}`)
  })

  test("fails when the tx mines but the feed did not store the report", async () => {
    const { runtime, writes } = setup(baseConfig(), bothUp, [0n, 0n], false)
    expect(() => onCron(runtime)).toThrow("DeskPriceFeed did not store the report")
    expect(writes).toHaveLength(1)
  })

  test("verifyWrite=false skips the read-back", async () => {
    const { runtime } = setup({ ...baseConfig(), verifyWrite: false }, bothUp, [0n, 0n], false)
    expect(onCron(runtime).action).toBe("written")
  })

  test("a dry run (empty tx hash) skips the read-back", async () => {
    const { runtime, feed } = setup(baseConfig(), bothUp, [0n, 0n], false)
    feed.writeReport = () => ({ txStatus: "TX_STATUS_SUCCESS" })
    const result = onCron(runtime)
    expect(result.action).toBe("written")
    expect(result.txHash).toBe("0x")
  })

  test("throws when the receiver reverted", async () => {
    const { runtime, feed } = setup(baseConfig(), bothUp)
    feed.writeReport = () => ({
      txStatus: "TX_STATUS_SUCCESS",
      receiverContractExecutionStatus: "RECEIVER_CONTRACT_EXECUTION_STATUS_REVERTED",
      errorMessage: "StaleReport()",
    })
    expect(() => onCron(runtime)).toThrow("DeskPriceFeed.onReport reverted: StaleReport()")
  })

  test("falls back to the remaining source when one is down", async () => {
    const routes = { ...bothUp, "https://api.kraken.com/0/public/Ticker?pair=USDCUSDT": { status: 503, body: "" } }
    const { runtime, writes } = setup(baseConfig(), routes)
    const result = onCron(runtime)
    expect(result.priceX18).toBe(COINBASE_X18.toString())
    expect(writes).toHaveLength(1)
    expect(runtime.getLogs().join("\n")).toContain("source kraken: skipped (HTTP 503)")
  })

  test("writes nothing when fewer than minSources answer", async () => {
    const routes = { ...bothUp, "https://api.kraken.com/0/public/Ticker?pair=USDCUSDT": { status: 503, body: "" } }
    const { runtime, writes } = setup({ ...baseConfig(), minSources: 2 }, routes)
    expect(() => onCron(runtime)).toThrow("only 1 of 2 sources answered")
    expect(writes).toHaveLength(0)
  })

  test("writes nothing when sources disagree", async () => {
    const routes = {
      ...bothUp,
      "https://api.coinbase.com/v2/prices/USDT-USDC/spot": {
        status: 200,
        body: `{"data":{"amount":"0.97","base":"USDT","currency":"USDC"}}`,
      },
    }
    const { runtime, writes } = setup(baseConfig(), routes)
    expect(() => onCron(runtime)).toThrow("sources disagree")
    expect(writes).toHaveLength(0)
  })

  test("writes nothing outside the sanity band", async () => {
    const { runtime, writes } = setup({ ...baseConfig(), minPrice: "0.999", maxPrice: "1.001" }, bothUp)
    expect(() => onCron(runtime)).toThrow("outside sanity band")
    expect(writes).toHaveLength(0)
  })

  test("skips the write inside deviation threshold and heartbeat", async () => {
    const onchainPrice = (COINBASE_X18 + KRAKEN_X18) / 2n
    const { runtime, writes } = setup(
      { ...baseConfig(), heartbeatSeconds: 300, deviationThresholdBps: 10 },
      bothUp,
      [onchainPrice, NOW_S - 60n],
    )
    const result = onCron(runtime)
    expect(result.action).toBe("skipped")
    expect(writes).toHaveLength(0)
  })

  test("writes once the heartbeat has elapsed", async () => {
    const onchainPrice = (COINBASE_X18 + KRAKEN_X18) / 2n
    const { runtime, writes } = setup(
      { ...baseConfig(), heartbeatSeconds: 300, deviationThresholdBps: 10 },
      bothUp,
      [onchainPrice, NOW_S - 301n],
    )
    expect(onCron(runtime).action).toBe("written")
    expect(writes).toHaveLength(1)
  })

  test("throws when the forwarder transaction reverts", async () => {
    const { runtime, feed } = setup(baseConfig(), bothUp)
    feed.writeReport = () => ({ txStatus: "TX_STATUS_REVERTED", errorMessage: "execution reverted" })
    expect(() => onCron(runtime)).toThrow("writeReport REVERTED: execution reverted")
  })
})

describe("initWorkflow", () => {
  test("registers one cron handler with the configured schedule", async () => {
    const handlers = initWorkflow(baseConfig())
    expect(handlers).toHaveLength(1)
    expect(handlers[0].trigger.config.schedule).toBe("*/30 * * * * *")
  })
})
