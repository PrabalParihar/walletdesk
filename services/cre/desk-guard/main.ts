// desk-guard: a CRE workflow that keeps WalletDesk's DeskPriceFeed fresh.
//
//   cron ──> HTTP (Coinbase + Kraken, every node) ──> DON median ──> sanity band
//        ──> EVM read  DeskPriceFeed.referenceOf(poolId)
//        ──> signed report abi.encode(bytes32 poolId, uint256 priceX18, uint64 observedAt)
//        ──> EVM write to DeskPriceFeed.onReport via the Chainlink forwarder
//
// OverflowHook refuses to fill from a desk whose quote deviates from this reference by more
// than the maker's max deviation, and refuses when the reference is stale. If this workflow
// cannot produce a trustworthy price it throws and writes nothing, so the reference ages out
// and the hook fails closed.

import {
  bytesToHex,
  consensusMedianAggregation,
  CronCapability,
  type CronPayload,
  EVMClient,
  encodeCallMsg,
  getNetwork,
  HTTPClient,
  handler,
  LATEST_BLOCK_NUMBER,
  type NodeRuntime,
  ok,
  prepareReportRequest,
  Runner,
  type Runtime,
  TxStatus,
  text,
} from "@chainlink/cre-sdk"
import {
  type Address,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  parseAbi,
  parseAbiParameters,
  zeroAddress,
} from "viem"
import { EVM_PB } from "@chainlink/cre-sdk/pb"
import { z } from "zod"
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

// ---------------------------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------------------------

const hexBytes = (n: number) => z.string().regex(new RegExp(`^0x[0-9a-fA-F]{${n * 2}}$`))
const decimalString = z.string().regex(/^\d+(\.\d+)?$/)

const sourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  // Which parser to use for the response body. See price.ts.
  format: z.enum(["coinbase-spot", "kraken-ticker"]),
  // true when the API quotes token0 per token1 and must be inverted to token1 per token0.
  invert: z.boolean(),
})

export const configSchema = z.object({
  // 6-field cron (seconds first), e.g. "*/30 * * * * *".
  schedule: z.string().min(1),
  // chain-selectors name, e.g. "ethereum-testnet-sepolia-unichain-1" or, for the local
  // Unichain-mainnet fork wired as an experimental chain, "ethereum-mainnet-unichain-1".
  chainSelectorName: z.string().min(1),
  // DeskPriceFeed (the IReceiver consumer).
  feedAddress: hexBytes(20),
  // Uniswap v4 PoolId of the desk pool.
  poolId: hexBytes(32),
  // Gas limit for the forwarder -> onReport call.
  gasLimit: z.string().regex(/^\d+$/),
  token0Decimals: z.number().int().min(0).max(36),
  token1Decimals: z.number().int().min(0).max(36),
  // Off-chain sources. Each must return "token1 per token0" after the optional inversion.
  sources: z.array(sourceSchema).min(1),
  // A node fails its observation if fewer sources answered.
  minSources: z.number().int().min(1),
  // A node fails its observation if its sources disagree by more than this.
  maxSourceSpreadBps: z.number().int().min(0),
  // Sanity band on the human price (token1 per token0). Outside it, nothing is written.
  minPrice: decimalString,
  maxPrice: decimalString,
  // Write when |new - onchain| >= deviationThresholdBps, or the onchain value is older than
  // heartbeatSeconds, or the feed is empty. heartbeatSeconds = 0 writes on every run.
  deviationThresholdBps: z.number().int().min(0),
  heartbeatSeconds: z.number().int().min(0),
  // After a broadcast write, read referenceOf back and fail if the report did not land. The
  // simulator's forwarder reports success even when onReport reverts. Consider false on a
  // deployed DON, where the reply carries the receiver status and nodes' RPC heads may lag.
  verifyWrite: z.boolean(),
})

export type Config = z.infer<typeof configSchema>

// ---------------------------------------------------------------------------------------------
// ABI
// ---------------------------------------------------------------------------------------------

export const DESK_PRICE_FEED_ABI = parseAbi([
  "function referenceOf(bytes32 poolId) view returns (uint256 priceX18, uint64 updatedAt)",
])

// What DeskPriceFeed.onReport decodes from the `report` argument.
export const REPORT_PARAMS = parseAbiParameters("bytes32 poolId, uint256 priceX18, uint64 observedAt")

export const encodeDeskReport = (poolId: Hex, priceX18: bigint, observedAt: bigint): Hex =>
  encodeAbiParameters(REPORT_PARAMS, [poolId, priceX18, observedAt])

// ---------------------------------------------------------------------------------------------
// Node mode: every DON node fetches every source on its own.
// ---------------------------------------------------------------------------------------------

const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err))

// Returns this node's observation: the median of its sources, human units (token1 per token0), 1e18.
export const observeReferencePrice = (nodeRuntime: NodeRuntime<Config>): bigint => {
  const cfg = nodeRuntime.config
  const http = new HTTPClient()
  const quotes: bigint[] = []

  for (const source of cfg.sources) {
    try {
      const resp = http.sendRequest(nodeRuntime, { url: source.url, method: "GET", timeout: "5s" }).result()
      if (!ok(resp)) throw new Error(`HTTP ${resp.statusCode}`)
      const raw = parseSourceBody(source.format, text(resp))
      const px = source.invert ? invertX18(raw) : raw
      nodeRuntime.log(`source ${source.name}: ${formatX18(px, 6)}${source.invert ? " (inverted)" : ""}`)
      quotes.push(px)
    } catch (err) {
      nodeRuntime.log(`source ${source.name}: skipped (${errMsg(err)})`)
    }
  }

  if (quotes.length < cfg.minSources) {
    throw new Error(`only ${quotes.length} of ${cfg.sources.length} sources answered, need ${cfg.minSources}`)
  }
  const spread = spreadBps(quotes)
  if (spread > BigInt(cfg.maxSourceSpreadBps)) {
    throw new Error(`sources disagree by ${spread} bps (max ${cfg.maxSourceSpreadBps})`)
  }
  return medianBigint(quotes)
}

// ---------------------------------------------------------------------------------------------
// DON mode
// ---------------------------------------------------------------------------------------------

type OnchainReference = { priceX18: bigint; updatedAt: bigint }

const readReference = (runtime: Runtime<Config>, evm: EVMClient): OnchainReference | null => {
  const cfg = runtime.config
  try {
    const reply = evm
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: cfg.feedAddress as Address,
          data: encodeFunctionData({
            abi: DESK_PRICE_FEED_ABI,
            functionName: "referenceOf",
            args: [cfg.poolId as Hex],
          }),
        }),
        blockNumber: LATEST_BLOCK_NUMBER,
      })
      .result()
    const [priceX18, updatedAt] = decodeFunctionResult({
      abi: DESK_PRICE_FEED_ABI,
      functionName: "referenceOf",
      data: bytesToHex(reply.data),
    })
    return { priceX18, updatedAt: BigInt(updatedAt) }
  } catch (err) {
    runtime.log(`referenceOf(poolId) read failed: ${errMsg(err)}. Treating the feed as empty.`)
    return null
  }
}

export type DeskGuardResult = {
  action: "written" | "skipped"
  poolId: string
  price: string
  priceX18: string
  observedAt: string
  onchainPriceX18: string
  deviationBps: string
  txHash: string
}

export const onCron = (runtime: Runtime<Config>, _payload?: CronPayload): DeskGuardResult => {
  const cfg = runtime.config

  const network = getNetwork({ chainFamily: "evm", chainSelectorName: cfg.chainSelectorName })
  if (!network) throw new Error(`unknown chain selector name: ${cfg.chainSelectorName}`)
  const evm = new EVMClient(network.chainSelector.selector)

  // 1. Off-chain reference: each node observes, the DON takes the median.
  const humanX18 = runtime.runInNodeMode(observeReferencePrice, consensusMedianAggregation<bigint>())().result()
  runtime.log(`consensus reference price: ${formatX18(humanX18, 6)} (token1 per token0)`)

  const minX18 = parseDecimalX18(cfg.minPrice)
  const maxX18 = parseDecimalX18(cfg.maxPrice)
  if (humanX18 < minX18 || humanX18 > maxX18) {
    throw new Error(`reference ${formatX18(humanX18, 6)} outside sanity band [${cfg.minPrice}, ${cfg.maxPrice}]; not writing`)
  }

  const priceX18 = toRawPriceX18(humanX18, cfg.token0Decimals, cfg.token1Decimals)
  const observedAt = BigInt(Math.floor(runtime.now().getTime() / 1000)) // DON time, seconds

  // 2. On-chain state: what the hook currently checks against.
  const prev = readReference(runtime, evm)
  const hasPrev = prev !== null && prev.updatedAt > 0n && prev.priceX18 > 0n
  const dev = hasPrev ? deviationBps(priceX18, prev.priceX18) : 0n
  const age = hasPrev ? observedAt - prev.updatedAt : 0n
  if (hasPrev) {
    runtime.log(`onchain reference: priceX18=${prev.priceX18} updatedAt=${prev.updatedAt} deviation=${dev} bps age=${age}s`)
  }

  const result: DeskGuardResult = {
    action: "skipped",
    poolId: cfg.poolId,
    price: formatX18(humanX18, 6),
    priceX18: priceX18.toString(),
    observedAt: observedAt.toString(),
    onchainPriceX18: hasPrev ? prev.priceX18.toString() : "0",
    deviationBps: dev.toString(),
    txHash: "",
  }

  const due =
    cfg.heartbeatSeconds === 0 ||
    !hasPrev ||
    dev >= BigInt(cfg.deviationThresholdBps) ||
    age >= BigInt(cfg.heartbeatSeconds)
  if (!due) {
    runtime.log(`within ${cfg.deviationThresholdBps} bps and ${cfg.heartbeatSeconds}s heartbeat; no write`)
    return result
  }

  // 3. Signed report -> forwarder -> DeskPriceFeed.onReport(metadata, report).
  const payload = encodeDeskReport(cfg.poolId as Hex, priceX18, observedAt)
  const report = runtime.report(prepareReportRequest(payload)).result()
  const reply = evm
    .writeReport(runtime, {
      receiver: cfg.feedAddress,
      report,
      gasConfig: { gasLimit: cfg.gasLimit },
    })
    .result()

  if (reply.txStatus !== TxStatus.SUCCESS) {
    throw new Error(`writeReport ${TxStatus[reply.txStatus]}: ${reply.errorMessage ?? "no error message"}`)
  }
  if (reply.receiverContractExecutionStatus === EVM_PB.ReceiverContractExecutionStatus.REVERTED) {
    throw new Error(`DeskPriceFeed.onReport reverted: ${reply.errorMessage ?? "no error message"}`)
  }
  const txHash = reply.txHash && reply.txHash.length > 0 ? bytesToHex(reply.txHash) : "0x"
  runtime.log(`report written: poolId=${cfg.poolId} priceX18=${priceX18} observedAt=${observedAt} tx=${txHash}`)

  // The forwarder does not revert when the receiver reverts or fails its ERC165 check; the
  // transaction still succeeds. After a real (broadcast) write, read the feed back to be sure.
  // A dry run has no tx hash and changes no state, so there is nothing to read back.
  if (cfg.verifyWrite && /^0x0*$/.test(txHash) === false) {
    const after = readReference(runtime, evm)
    const landed =
      after !== null && after.priceX18 === priceX18 && (!hasPrev || after.updatedAt !== prev.updatedAt)
    if (!landed) {
      throw new Error(
        "forwarder tx mined but DeskPriceFeed did not store the report " +
          "(onReport reverted, wrong forwarder, or supportsInterface failed the ERC165 check)",
      )
    }
    runtime.log(`read back: referenceOf(poolId) = ${after.priceX18} @ ${after.updatedAt}`)
  }

  return { ...result, action: "written", txHash }
}

export const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCron)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}
