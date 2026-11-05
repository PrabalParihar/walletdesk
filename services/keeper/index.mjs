import { createServer } from "node:http";
import { readFileSync } from "node:fs";

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { fetchReference, toPriceX18 } from "./reference.mjs";
import { feeToUsdc6, isLoopbackRpc } from "./scale.mjs";

const deploymentPath = process.env.DEPLOYMENTS_PATH;
if (!deploymentPath) {
  console.error("Set DEPLOYMENTS_PATH to contracts/deployments/local.json");
  process.exit(1);
}

const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
const rpcUrl = process.env.RPC_URL || deployment.rpcUrl;
const port = Number(process.env.KEEPER_PORT || 8787);

if (process.env.KEEPER_PRIVATE_KEY && !isLoopbackRpc(rpcUrl)) {
  console.error("KEEPER_PRIVATE_KEY is only accepted for a loopback RPC. Use services/keeper/cctp-settle.mjs on testnet.");
  process.exit(1);
}

const publicClient = createPublicClient({ transport: http(rpcUrl) });

const hookAbi = parseAbi([
  "event OverflowRouted(bytes32 indexed poolId, address indexed maker, uint256 residualIn, uint256 filledOut)",
  "event FeeAccrued(bytes32 indexed fillId, address indexed maker, address token, uint256 feeAmount)",
  "function lastFill(bytes32 poolId) view returns (address maker, address tokenIn, address tokenOut, uint256 residualIn, uint256 filledOut, uint256 feeOut, bytes32 fillId)",
  "event DeskSkipped(bytes32 indexed poolId, address indexed maker, uint8 reason)",
]);

const feedAbi = parseAbi([
  "function onReport(bytes metadata, bytes report)",
  "function referenceOf(bytes32 poolId) view returns (uint256 priceX18, uint64 updatedAt)",
  "function lastObservedAt(bytes32 poolId) view returns (uint64)",
  "function forwarder() view returns (address)",
]);

const aquaAbi = parseAbi([
  "event Pulled(address maker, address app, bytes32 strategyHash, address token, uint256 amount)",
  "event Pushed(address maker, address app, bytes32 strategyHash, address token, uint256 amount)",
]);

const treasuryAbi = parseAbi([
  "function creditFromFill(bytes32 fillId, address maker, uint256 amount)",
  "function deposit(uint256 amount)",
  "function fillCredited(bytes32 fillId) view returns (bool)",
  "function claimable(address maker) view returns (uint256)",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const fills = new Map();
const skips = new Map();
let lastError = null;
let scanning = false;
const reference = { price: null, priceX18: null, sources: [], pushedAt: null, txHash: null, note: "not started" };

function json(res, status, body) {
  const payload = JSON.stringify(body, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(payload);
}

async function credit(fill) {
  const key = process.env.KEEPER_PRIVATE_KEY;
  if (!key || fill.credited || !deployment.treasury || !deployment.usdc) return;
  const usdcAmount = feeToUsdc6(BigInt(fill.feeOut));
  if (usdcAmount === 0n) {
    fill.creditNote = "fee scales to 0 USDC units";
    return;
  }
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, transport: http(rpcUrl) });
  const already = await publicClient.readContract({
    address: deployment.treasury,
    abi: treasuryAbi,
    functionName: "fillCredited",
    args: [fill.fillId],
  });
  if (already) {
    fill.credited = true;
    fill.creditNote = "already credited";
    return;
  }
  const allowance = await publicClient.readContract({
    address: deployment.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, deployment.treasury],
  });
  if (allowance < usdcAmount) {
    const approveHash = await wallet.writeContract({
      address: deployment.usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [deployment.treasury, usdcAmount * 1000n],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }
  const balance = await publicClient.readContract({
    address: deployment.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance < usdcAmount) {
    fill.creditNote = "keeper USDC balance is short";
    return;
  }
  const depositHash = await wallet.writeContract({
    address: deployment.treasury,
    abi: treasuryAbi,
    functionName: "deposit",
    args: [usdcAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });
  try {
    const creditHash = await wallet.writeContract({
      address: deployment.treasury,
      abi: treasuryAbi,
      functionName: "creditFromFill",
      args: [fill.fillId, fill.maker, usdcAmount],
    });
    await publicClient.waitForTransactionReceipt({ hash: creditHash });
    fill.credited = true;
    fill.usdcAmount = usdcAmount.toString();
    fill.creditTx = creditHash;
    fill.creditNote = "attestor on local fork";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("AlreadyCredited")) {
      fill.credited = true;
      fill.creditNote = "already credited";
      return;
    }
    throw error;
  }
}

async function scan() {
  if (scanning) return;
  scanning = true;
  try {
    const latest = await publicClient.getBlockNumber();
    const fromBlock = BigInt(deployment.deployBlock || 0);
    const feeLogs = await publicClient.getLogs({
      address: deployment.hook,
      event: hookAbi[1],
      fromBlock,
      toBlock: latest,
    });
    const skipLogs = await publicClient.getLogs({
      address: deployment.hook,
      event: hookAbi[3],
      fromBlock,
      toBlock: latest,
    });
    for (const log of skipLogs) {
      const key = `${log.transactionHash}:${log.logIndex}`;
      if (skips.has(key)) continue;
      skips.set(key, {
        txHash: log.transactionHash,
        maker: log.args.maker,
        reason: Number(log.args.reason),
        blockNumber: Number(log.blockNumber),
      });
    }
    for (const log of feeLogs) {
      const id = log.args.fillId;
      if (!id || fills.has(id)) continue;
      const receipt = await publicClient.getTransactionReceipt({ hash: log.transactionHash });
      const moved = [];
      for (const entry of receipt.logs) {
        if (entry.address.toLowerCase() !== deployment.aqua.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi: aquaAbi, data: entry.data, topics: entry.topics });
          if (decoded.eventName === "Pulled" || decoded.eventName === "Pushed") {
            moved.push({
              event: decoded.eventName,
              token: decoded.args.token,
              amount: decoded.args.amount.toString(),
              maker: decoded.args.maker,
            });
          }
        } catch {
          // not an Aqua pull or push
        }
      }
      const routed = receipt.logs
        .map((entry) => {
          try {
            return decodeEventLog({ abi: hookAbi, data: entry.data, topics: entry.topics });
          } catch {
            return null;
          }
        })
        .find((decoded) => decoded?.eventName === "OverflowRouted");
      const fill = {
        fillId: id,
        maker: log.args.maker,
        token: log.args.token,
        feeOut: (log.args.feeAmount || 0n).toString(),
        residualIn: routed?.args.residualIn?.toString() ?? null,
        filledOut: routed?.args.filledOut?.toString() ?? null,
        txHash: log.transactionHash,
        blockNumber: Number(log.blockNumber),
        transfers: moved,
        credited: false,
      };
      fills.set(id, fill);
      await credit(fill);
    }
    lastError = null;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    console.error("scan failed", lastError);
  } finally {
    scanning = false;
  }
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    json(res, 200, {
      ok: lastError === null,
      fills: fills.size,
      settlement: deployment.settlement || "attestor",
      reference: reference.note,
      rpc: isLoopbackRpc(rpcUrl) ? "loopback" : "remote",
      error: lastError,
    });
    return;
  }
  if (url.pathname === "/fills") {
    json(res, 200, { fills: [...fills.values()].sort((a, b) => b.blockNumber - a.blockNumber) });
    return;
  }
  if (url.pathname === "/skips") {
    json(res, 200, { skips: [...skips.values()].sort((a, b) => b.blockNumber - a.blockNumber) });
    return;
  }
  if (url.pathname === "/reference") {
    json(res, 200, reference);
    return;
  }
  if (url.pathname === "/desk") {
    json(res, 200, {
      network: deployment.network,
      chainId: deployment.chainId,
      hook: deployment.hook,
      maker: deployment.maker,
      taker: deployment.taker,
      settlement: deployment.settlement,
      poolId: deployment.poolId,
    });
    return;
  }
  json(res, 404, { error: "not found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`keeper listening on ${port}`);
});

/**
 * Local stand-in for the Chainlink CRE workflow (services/cre/desk-guard). Only on a loopback RPC, and only when
 * the keeper key is the feed's forwarder (DemoSeed sets that). On a real chain the CRE forwarder writes reports.
 */
async function pushReference() {
  const key = process.env.KEEPER_PRIVATE_KEY;
  if (!key || !deployment.priceFeed || !isLoopbackRpc(rpcUrl) || process.env.REFERENCE_PUSH === "0") {
    reference.note = "off (needs loopback RPC, KEEPER_PRIVATE_KEY and priceFeed)";
    return;
  }
  try {
    const account = privateKeyToAccount(key);
    const forwarder = await publicClient.readContract({ address: deployment.priceFeed, abi: feedAbi, functionName: "forwarder" });
    if (forwarder.toLowerCase() !== account.address.toLowerCase()) {
      reference.note = "off (keeper is not the feed forwarder; the CRE workflow owns this feed)";
      return;
    }
    const { price, sources } = await fetchReference();
    if (price === null) {
      reference.note = "no usable quote from the public APIs; the hook fails closed when the reference ages out";
      return;
    }
    // Observation time is the wall clock (like the CRE DON clock); it only has to increase per pool.
    const lastObserved = await publicClient.readContract({
      address: deployment.priceFeed,
      abi: feedAbi,
      functionName: "lastObservedAt",
      args: [deployment.poolId],
    });
    const wallClock = BigInt(Math.floor(Date.now() / 1000));
    const observedAt = wallClock > lastObserved ? wallClock : lastObserved + 1n;
    const priceX18 = toPriceX18(price, deployment.decimals0 ?? 18, deployment.decimals1 ?? 18);
    const report = encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }, { type: "uint64" }],
      [deployment.poolId, priceX18, observedAt],
    );
    const wallet = createWalletClient({ account, transport: http(rpcUrl) });
    const hash = await wallet.writeContract({
      address: deployment.priceFeed,
      abi: feedAbi,
      functionName: "onReport",
      args: ["0x", report],
      chain: null,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    Object.assign(reference, {
      price,
      priceX18: priceX18.toString(),
      sources,
      pushedAt: Number(observedAt),
      txHash: hash,
      note: `local CRE stand-in, median of ${sources.join(" + ")}`,
    });
  } catch (error) {
    reference.note = `push failed: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`;
  }
}

await scan();
await pushReference();
setInterval(scan, 4000);
setInterval(pushReference, Number(process.env.REFERENCE_INTERVAL_MS || 30000));
